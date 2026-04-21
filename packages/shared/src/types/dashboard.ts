export interface TradingMissionActivity {
  id: string;
  eventType: string;
  title: string;
  summary: string;
  severity: string;
  source: string;
  instId: string | null;
  symbol: string | null;
  occurredAt: string;
}

export interface TradingMissionIssue {
  issueId: string;
  kind: string;
  severity: string;
  status: string;
  title: string;
  summary: string;
  updatedAt: string;
  agentKey: string;
}

export interface TradingMissionRun {
  runId: string;
  workspaceId: string;
  title: string;
  summary: string;
  kind: string;
  status: string;
  agentKey: string;
  startedAt: string;
}

export interface TradingMissionWorkspace {
  workspaceId: string;
  title: string;
  summary: string;
  kind: string;
  status: string;
  agentKey: string;
  updatedAt: string;
}

export interface TradingResearchOutput {
  outputId: string;
  workspaceId: string;
  runId: string;
  kind: string;
  title: string;
  summary: string;
  instId: string | null;
  symbol: string | null;
  triggerKind: string | null;
  agentKey: string;
  status: string;
  severity: string;
  createdAt: string;
}

export interface TradingStrategyRevision {
  revisionId: string;
  source: string;
  kind: string;
  status: string;
  summary: string;
  patch: Record<string, unknown>;
  validationErrors: string[];
  metricsSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface TradingRoutineHealth {
  routineKey: string;
  title: string;
  status: string;
  summary: string;
  updatedAt: string | null;
  agentKey: string;
}

export interface TradingMissionSummary {
  enabled: boolean;
  companyId: string;
  companyName: string | null;
  campaignEpochId: string | null;
  liveCount: number;
  queueCount: number;
  activeWorkspaceCount: number;
  latestTradingActivities: TradingMissionActivity[];
  openTradingIssues: TradingMissionIssue[];
  activeRuns: TradingMissionRun[];
  executionWorkspaces: TradingMissionWorkspace[];
  researchOutputs: TradingResearchOutput[];
  strategyRevisions: TradingStrategyRevision[];
  routineHealth: TradingRoutineHealth[];
  campaignSnapshot: {
    effectiveStatus: string;
    autoTradingStatus: string;
    currentEquityUsd: number;
    realizedPnlUsd: number;
    unrealizedPnlUsd: number;
    activeCapitalRatioPct: number;
    openPositionCount: number;
  } | null;
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
  tradingMission?: TradingMissionSummary | null;
}
