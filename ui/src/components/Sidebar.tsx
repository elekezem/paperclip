import {
  Inbox,
  CircleDot,
  Target,
  LayoutDashboard,
  DollarSign,
  History,
  Search,
  SquarePen,
  Network,
  Boxes,
  Repeat,
  GitBranch,
  Settings,
  Bot,
  ShieldCheck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "@/lib/router";
import { SidebarSection } from "./SidebarSection";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarProjects } from "./SidebarProjects";
import { SidebarAgents } from "./SidebarAgents";
import { CompanyLaneChips } from "./CompanyLaneChips";
import { useDialogActions } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useI18n } from "../context/LocaleContext";
import { dashboardApi } from "../api/dashboard";
import { heartbeatsApi } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { Button } from "@/components/ui/button";
import { PluginSlotOutlet } from "@/plugins/slots";
import { SidebarCompanyMenu } from "./SidebarCompanyMenu";

export function Sidebar() {
  const { t } = useI18n();
  const { openNewIssue } = useDialogActions();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const inboxBadge = useInboxBadge(selectedCompanyId);
  const { data: experimentalSettings } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });
  const { data: liveRuns } = useQuery({
    queryKey: queryKeys.liveRuns(selectedCompanyId!),
    queryFn: () => heartbeatsApi.liveRunsForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });
  const { data: summary } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const { data: labels } = useQuery({
    queryKey: queryKeys.issues.labels(selectedCompanyId!),
    queryFn: () => issuesApi.listLabels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const liveRunCount = liveRuns?.length ?? 0;
  const showWorkspacesLink = experimentalSettings?.enableIsolatedWorkspaces === true;
  const companyDescription = selectedCompany?.description ?? t("common.aiNativeExecutionCompany");

  function openSearch() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
  }

  const pluginContext = {
    companyId: selectedCompanyId,
    companyPrefix: selectedCompany?.issuePrefix ?? null,
  };

  return (
    <aside className="w-60 h-full min-h-0 border-r border-border bg-background flex flex-col">
      <div className="flex items-center gap-1 px-3 h-12 shrink-0">
        {selectedCompany?.brandColor && (
          <div
            className="w-4 h-4 rounded-sm shrink-0 ml-1"
            style={{ backgroundColor: selectedCompany.brandColor }}
          />
        )}
        <span className="flex-1 text-sm font-bold text-foreground truncate pl-1">
          {selectedCompany?.name ?? t("common.selectCompany")}
        </span>
        <Button
          asChild
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground shrink-0"
          aria-label="Search"
          title="Search"
        >
          <NavLink to="/search">
            <Search className="h-4 w-4" />
          </NavLink>
        </Button>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-auto-hide flex flex-col gap-4 px-3 py-2">
        <div
          className="rounded-xl border border-border/80 px-3 py-3"
          style={selectedCompany?.brandColor ? {
            backgroundImage: `linear-gradient(180deg, ${selectedCompany.brandColor}10, transparent 80%)`,
          } : undefined}
        >
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 h-9 w-9 shrink-0 rounded-xl border border-border/70"
              style={{ backgroundColor: selectedCompany?.brandColor ?? "hsl(var(--muted))" }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {selectedCompany?.name ?? t("common.selectCompany")}
                </p>
                {liveRunCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                    </span>
                    {t("common.live")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {companyDescription}
              </p>
            </div>
          </div>

          <CompanyLaneChips labels={labels} className="mt-3" />

          <div className="mt-3 grid grid-cols-3 gap-1.5">
            <div className="rounded-lg border border-border/70 bg-background/70 px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <Bot className="h-3 w-3" />
                {t("common.live")}
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{liveRunCount}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 px-2 py-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {t("common.opsQueue")}
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">{summary?.tasks.inProgress ?? 0}</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/70 px-2 py-2">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" />
                {t("common.board")}
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {(summary?.pendingApprovals ?? 0) + (summary?.budgets.pendingApprovals ?? 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            <SquarePen className="h-4 w-4 shrink-0" />
            <span className="truncate">{t("sidebar.newIssue")}</span>
          </button>
          <SidebarNavItem to="/dashboard" label={t("common.missionControl")} icon={LayoutDashboard} liveCount={liveRunCount} />
          <SidebarNavItem
            to="/inbox"
            label={t("sidebar.nav.inbox")}
            icon={Inbox}
            badge={inboxBadge.inbox}
            badgeTone={inboxBadge.failedRuns > 0 ? "danger" : "default"}
            alert={inboxBadge.failedRuns > 0}
          />
          <PluginSlotOutlet
            slotTypes={["sidebar"]}
            context={pluginContext}
            className="flex flex-col gap-0.5"
            itemClassName="text-[13px] font-medium"
            missingBehavior="placeholder"
          />
        </div>

        <SidebarSection label={t("sidebar.section.missionControl")}>
          <SidebarNavItem to="/issues" label={t("sidebar.nav.issues")} icon={CircleDot} />
          <SidebarNavItem to="/activity" label={t("sidebar.nav.activity")} icon={History} />
        </SidebarSection>

        <SidebarSection label={t("sidebar.section.planning")}>
          <SidebarNavItem to="/routines" label={t("sidebar.nav.routines")} icon={Repeat} textBadge="Beta" textBadgeTone="amber" />
          <SidebarNavItem to="/goals" label={t("sidebar.nav.goals")} icon={Target} />
          {showWorkspacesLink ? (
            <SidebarNavItem to="/workspaces" label={t("sidebar.nav.workspaces")} icon={GitBranch} />
          ) : null}
        </SidebarSection>

        <SidebarProjects />

        <SidebarAgents />

        <SidebarSection label={t("sidebar.section.company")}>
          <SidebarNavItem to="/org" label={t("sidebar.company.org")} icon={Network} />
          <SidebarNavItem to="/skills" label={t("sidebar.company.skills")} icon={Boxes} />
          <SidebarNavItem to="/costs" label={t("sidebar.company.costs")} icon={DollarSign} />
          <SidebarNavItem to="/company/settings" label={t("sidebar.nav.settings")} icon={Settings} />
        </SidebarSection>

        <PluginSlotOutlet
          slotTypes={["sidebarPanel"]}
          context={pluginContext}
          className="flex flex-col gap-3"
          itemClassName="rounded-lg border border-border p-3"
          missingBehavior="placeholder"
        />
      </nav>
    </aside>
  );
}
