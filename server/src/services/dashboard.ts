import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, costEvents, issues } from "@paperclipai/db";
import type { DashboardSummary, TradingMissionSummary } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

const tradingKernelBaseUrl =
  process.env.PAPERCLIP_TRADING_KERNEL_URL
  ?? process.env.TRADING_KERNEL_URL
  ?? "http://127.0.0.1:3231";

async function fetchTradingMission(companyId: string): Promise<TradingMissionSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const response = await fetch(new URL(`/api/companies/${companyId}/mission-control`, tradingKernelBaseUrl), {
      headers: {
        "content-type": "application/json",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const mission = await response.json();
    if (!mission || mission.enabled !== true) {
      return null;
    }
    return {
      enabled: true,
      companyId,
      companyName: mission.companyName ?? null,
      campaignEpochId: mission.campaignEpochId ?? null,
      liveCount: Number(mission.liveCount ?? 0),
      queueCount: Number(mission.queueCount ?? 0),
      activeWorkspaceCount: Number(mission.activeWorkspaceCount ?? 0),
      latestTradingActivities: Array.isArray(mission.materialActivities) ? mission.materialActivities.slice(0, 10) : [],
      openTradingIssues: Array.isArray(mission.openIssues) ? mission.openIssues.slice(0, 6) : [],
      activeRuns: Array.isArray(mission.activeRuns) ? mission.activeRuns.slice(0, 6) : [],
      executionWorkspaces: Array.isArray(mission.executionWorkspaces) ? mission.executionWorkspaces.slice(0, 8) : [],
      researchOutputs: Array.isArray(mission.researchOutputs) ? mission.researchOutputs.slice(0, 8) : [],
      strategyRevisions: Array.isArray(mission.strategyRevisions) ? mission.strategyRevisions.slice(0, 8) : [],
      routineHealth: Array.isArray(mission.routineHealth) ? mission.routineHealth.slice(0, 8) : [],
      campaignSnapshot: mission.campaignSnapshot ?? null,
    } satisfies TradingMissionSummary;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const [agentRows, taskRows, pendingApprovals, tradingMission] = await Promise.all([
        db
          .select({ status: agents.status, count: sql<number>`count(*)` })
          .from(agents)
          .where(eq(agents.companyId, companyId))
          .groupBy(agents.status),
        db
          .select({ status: issues.status, count: sql<number>`count(*)` })
          .from(issues)
          .where(eq(issues.companyId, companyId))
          .groupBy(issues.status),
        db
          .select({ count: sql<number>`count(*)` })
          .from(approvals)
          .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
          .then((rows) => Number(rows[0]?.count ?? 0)),
        fetchTradingMission(companyId),
      ]);

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::double precision`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
        tradingMission,
      } satisfies DashboardSummary;
    },
  };
}
