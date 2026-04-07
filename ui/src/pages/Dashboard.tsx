import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { executionWorkspacesApi } from "../api/execution-workspaces";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useI18n } from "../context/LocaleContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";

import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { CompanyLaneChips } from "../components/CompanyLaneChips";
import { ExecutionWorkspaceChip } from "../components/ExecutionWorkspaceChip";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle, ArrowRight, GitBranch } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

const dashboardPriorityRank: Record<Issue["priority"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function Dashboard() {
  const { selectedCompanyId, selectedCompany, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { t, formatRelativeTime } = useI18n();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: t("dashboard.title") }]);
  }, [setBreadcrumbs, t]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: labels } = useQuery({
    queryKey: queryKeys.issues.labels(selectedCompanyId!),
    queryFn: () => issuesApi.listLabels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: executionWorkspaces } = useQuery({
    queryKey: queryKeys.executionWorkspaces.list(selectedCompanyId!),
    queryFn: () => executionWorkspacesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: researchMission } = useQuery({
    queryKey: queryKeys.research.missionControl(selectedCompanyId!),
    queryFn: () => researchApi.missionControl(selectedCompanyId!),
    enabled: !!selectedCompanyId && selectedCompany?.name === "AKESO REsearch",
  });
  const { data: researchGovernance } = useQuery({
    queryKey: queryKeys.research.governance(selectedCompanyId!),
    queryFn: () => researchApi.governance(selectedCompanyId!),
    enabled: !!selectedCompanyId && selectedCompany?.name === "AKESO REsearch",
  });
  const { data: goldenStudies } = useQuery({
    queryKey: queryKeys.research.goldenStudies(selectedCompanyId!),
    queryFn: () => researchApi.goldenStudies(selectedCompanyId!),
    enabled: !!selectedCompanyId && selectedCompany?.name === "AKESO REsearch",
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);
  const workspaceById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof executionWorkspaces>[number]>();
    for (const workspace of executionWorkspaces ?? []) {
      map.set(workspace.id, workspace);
    }
    return map;
  }, [executionWorkspaces]);
  const activeExecutionWorkspaces = useMemo(
    () => (executionWorkspaces ?? []).filter((workspace) => workspace.status === "active" || workspace.status === "idle"),
    [executionWorkspaces],
  );
  const hotIssues = useMemo(() => {
    return [...(issues ?? [])]
      .filter((issue) => issue.status !== "done" && issue.status !== "cancelled")
      .sort((a, b) => {
        const priorityDelta = dashboardPriorityRank[a.priority] - dashboardPriorityRank[b.priority];
        if (priorityDelta !== 0) return priorityDelta;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      })
      .slice(0, 5);
  }, [issues]);

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message={t("dashboard.empty.welcome")}
          action={t("dashboard.empty.getStarted")}
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message={t("dashboard.empty.selectCompany")} />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {t("dashboard.noAgents")}
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            {t("dashboard.createAgentHere")}
          </button>
        </div>
      )}

      {data && (
        <>
          {researchMission?.enabled ? (
            <div className="rounded-2xl border border-border/80 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    Research Mission Control
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
                    {researchMission.companyName}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Digital-experiment portfolio across optics, semiconductor, ophthalmology, vision science, and AI/ML methods.
                  </p>
                </div>
                <Link to="/research/studies" className="text-xs text-muted-foreground hover:text-foreground">
                  Open studies
                </Link>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                {researchMission.highlights.map((item) => (
                  <div key={item.label} className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Gate health</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {researchMission.studies.running} running · {researchMission.studies.blocked} blocked · {researchMission.studies.reviewing} in review · {researchMission.studies.readyToArchive} ready to archive
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Recent failures</p>
                  {researchMission.recentFailures.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No recent verifier or run failures.</p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {researchMission.recentFailures.slice(0, 3).map((item) => (
                        <div key={item.id} className="text-sm">
                          <p className="font-medium">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.summary ?? item.signal}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Governance substrate</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Constitution {researchGovernance?.constitution.version ?? researchMission.governance.constitutionVersion} · {researchMission.governance.roleAdapterCount} adapters · {researchMission.governance.verifierCount} verifiers
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Injection order: {researchGovernance?.constitution.injectionOrder.join(" -> ") ?? "constitution -> company_profile -> role_adapter -> live_study_context -> local_memory"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Golden Study staging</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {(goldenStudies ?? []).length} seeded package(s) · {researchMission.staging.instantiatedGoldenStudies} instantiated
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Fixed, replayable study bundles are the default staging surface for the first FARS runs.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_320px]">
            <div
              className="rounded-2xl border border-border/80 p-5"
              style={selectedCompany?.brandColor ? {
                backgroundImage: `linear-gradient(135deg, ${selectedCompany.brandColor}16, transparent 58%)`,
              } : undefined}
            >
              <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    {t("common.missionControl")}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    {selectedCompany?.name ?? t("common.selectCompany")}
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    {selectedCompany?.description ?? t("common.aiNativeExecutionCompany")}
                  </p>
                </div>
                {selectedCompany?.brandColor ? (
                  <div
                    className="hidden h-12 w-12 shrink-0 rounded-2xl border border-border/70 lg:block"
                    style={{ backgroundColor: selectedCompany.brandColor }}
                  />
                ) : null}
              </div>

              <CompanyLaneChips labels={labels} className="mt-4" />

              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("sidebar.agents")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{data.agents.running}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.agents.paused} {t("common.paused").toLowerCase()} · {data.agents.error} error</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("common.opsQueue")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{data.tasks.inProgress}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{data.tasks.open} open · {data.tasks.blocked} blocked</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{t("dashboard.activeWorktrees")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{activeExecutionWorkspaces.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Execution workspaces currently attached to delivery</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/issues" className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/60">
                  Open queue
                  <ArrowRight className="h-3 w-3" />
                </Link>
                <Link to="/activity" className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60">
                  Activity stream
                </Link>
                <Link to="/costs" className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60">
                  Cost pulse
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-border/80 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                    {t("dashboard.criticalQueue")}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">What needs attention now</h2>
                </div>
                <Link to="/issues" className="text-xs text-muted-foreground hover:text-foreground">
                  See all
                </Link>
              </div>

              {hotIssues.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-sm text-muted-foreground">
                  No active issues.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {hotIssues.map((issue) => {
                    const workspace = issue.currentExecutionWorkspace
                      ?? (issue.executionWorkspaceId ? workspaceById.get(issue.executionWorkspaceId) ?? null : null);

                    return (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="block rounded-xl border border-border/70 px-3 py-3 text-inherit no-underline transition-colors hover:bg-accent/50"
                      >
                        <div className="flex items-start gap-3">
                          <StatusIcon status={issue.status} className="mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{issue.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span className="font-mono">{issue.identifier ?? issue.id.slice(0, 8)}</span>
                                  <span>{formatRelativeTime(issue.updatedAt)}</span>
                                  {issue.assigneeAgentId && agentName(issue.assigneeAgentId) ? (
                                    <Identity name={agentName(issue.assigneeAgentId)!} size="sm" />
                                  ) : null}
                                </div>
                              </div>
                              <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                {issue.priority}
                              </span>
                            </div>

                            {workspace ? (
                              <div className="mt-2">
                                <ExecutionWorkspaceChip workspace={workspace} compact />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/80 p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                {t("dashboard.operationsPulse")}
              </p>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t("approvals.pending")}</span>
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">
                    {data.pendingApprovals + data.budgets.pendingApprovals}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Month spend</span>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{formatCents(data.costs.monthSpendCents)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.costs.monthBudgetCents > 0
                      ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)}`
                      : "Unlimited budget"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Budget incidents</span>
                    <PauseCircle className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{data.budgets.activeIncidents}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{t("dashboard.activeWorktrees")}</span>
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{activeExecutionWorkspaces.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeExecutionWorkspaces.slice(0, 2).map((workspace) => workspace.branchName ?? workspace.name).join(" · ") || "No execution workspaces"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <ActiveAgentsPanel companyId={selectedCompanyId!} />

          {data.budgets.activeIncidents > 0 ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused · {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Run Activity" subtitle="Last 14 days">
              <RunActivityChart runs={runs ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Priority" subtitle="Last 14 days">
              <PriorityChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Status" subtitle="Last 14 days">
              <IssueStatusChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Success Rate" subtitle="Last 14 days">
              <SuccessRateChart runs={runs ?? []} />
            </ChartCard>
          </div>

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Activity</h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Tasks */}
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Recent Tasks</h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => {
                    const workspace = issue.currentExecutionWorkspace
                      ?? (issue.executionWorkspaceId ? workspaceById.get(issue.executionWorkspaceId) ?? null : null);

                    return (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                      >
                        <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Status icon - left column on mobile */}
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex"><StatusIcon status={issue.status} /></span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name
                                ? <span className="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {formatRelativeTime(issue.updatedAt)}
                            </span>
                          </span>
                          {workspace && (
                            <span className="mt-1 hidden sm:inline-flex">
                              <ExecutionWorkspaceChip workspace={workspace} compact />
                            </span>
                          )}
                        </span>
                      </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
