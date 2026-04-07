export type ResearchProgramStatus = "active" | "paused" | "archived";
export type ResearchStudyStatus =
  | "Explore"
  | "Surveyed"
  | "HypothesisApproved"
  | "PlanApproved"
  | "Running"
  | "Analyzing"
  | "Writing"
  | "Reviewing"
  | "Blocked"
  | "ReadyToArchive"
  | "Done";
export type ResearchRunStatus = "queued" | "running" | "paused" | "failed" | "completed";
export type ResearchArtifactStatus = "scaffolded" | "draft" | "released";
export type ResearchLearningSignal = "success" | "failure" | "neutral";
export type GoldenStudyStatus = "template" | "ready" | "instantiated";

export interface ReferenceBlueprint {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  domain: string;
  summary: string | null;
  benchmarkFocus: string[];
  seedPromptPath: string | null;
  surveyReferencePath: string | null;
  assetRootPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IdeaIntakeRequest {
  seedPrompt: string;
  domainHint?: string | null;
  referenceBlueprintId?: string | null;
}

export interface ProposalPackageSummary {
  title: string;
  clarityMode: "standard" | "expanded";
  seedPrompt: string;
  domainHint: string | null;
  thesis: string;
  scope: string;
  successCriteria: string[];
  openQuestions: string[];
  nextQuestions: string[];
  referenceBlueprintId: string | null;
}

export interface StudyBranchCandidate {
  id: string;
  title: string;
  summary: string;
  score: number;
}

export interface StudyBranchSummary {
  laneKey: string;
  laneLabel: string;
  selectedCandidateId: string;
  selectedRationale: string;
  candidates: StudyBranchCandidate[];
}

export interface BenchmarkDimensionScore {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  gap: string;
}

export interface BenchmarkReport {
  blueprintId: string | null;
  blueprintTitle: string | null;
  overallRating: string;
  dimensions: BenchmarkDimensionScore[];
  majorGaps: string[];
  promotionRecommendation: string;
}

export interface IdeaIntakeArtifactDocument {
  key: string;
  title: string;
  body: string;
}

export interface IdeaIntakeIssueSpec {
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done";
  priority: "critical" | "high" | "medium" | "low";
  assigneeKey?: string | null;
}

export interface IdeaIntakeApprovalSpec {
  type: "proposal_review" | "survey_review";
  ownerAgentKey?: string | null;
  payload: Record<string, unknown>;
}

export interface IdeaIntakeResult {
  study: ResearchStudy;
  artifact: ResearchArtifact;
  referenceBlueprint: ReferenceBlueprint | null;
  proposal: ProposalPackageSummary;
  branches: StudyBranchSummary[];
  benchmark: BenchmarkReport;
  project: {
    name: string;
    description: string;
    status: "planned" | "in_progress";
    color: string | null;
  };
  motherIssue: IdeaIntakeIssueSpec;
  childIssues: Array<IdeaIntakeIssueSpec & { laneKey: string }>;
  documents: IdeaIntakeArtifactDocument[];
  approvals: IdeaIntakeApprovalSpec[];
}

export interface ResearchConstitution {
  id: string;
  version: string;
  title: string;
  governanceModel: string;
  principles: string[];
  hardBoundaries: string[];
  injectionOrder: string[];
  updatedAt: string;
}

export interface ResearchCompanyProfile {
  companyId: string;
  companyName: string;
  mission: string;
  domainFocus: string[];
  controlPlane: string;
  executionPlane: string;
  updatedAt: string;
}

export interface ResearchRoleAdapter {
  id: string;
  target: string;
  summary: string;
  responsibilities: string[];
  verifierIds: string[];
  injectedAfter: string[];
  updatedAt: string;
}

export interface ResearchVerifierSpec {
  id: string;
  name: string;
  scope: string;
  summary: string;
  blocking: boolean;
  updatedAt: string;
}

export interface ResearchGovernanceBundle {
  companyId: string;
  constitution: ResearchConstitution;
  companyProfile: ResearchCompanyProfile;
  roleAdapters: ResearchRoleAdapter[];
  verifierPack: ResearchVerifierSpec[];
  updatedAt: string;
}

export interface ResearchProgram {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: ResearchProgramStatus;
  domain: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchStudy {
  id: string;
  companyId: string;
  programId: string;
  title: string;
  hypothesis: string | null;
  primaryDomain?: string | null;
  status: ResearchStudyStatus;
  approvalGate: string | null;
  launchGateStatus?: string | null;
  budgetHours: number | null;
  negativeResultEligible: boolean;
  assignedDirector?: string | null;
  latestRunId?: string | null;
  artifactBundleId?: string | null;
  sourceGoldenStudyId?: string | null;
  governanceVersion?: string | null;
  packageRoot?: string | null;
  seededExample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchRun {
  id: string;
  companyId: string;
  studyId: string;
  title: string;
  status: ResearchRunStatus;
  branchKey: string | null;
  verifierState: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchArtifact {
  id: string;
  companyId: string;
  studyId: string;
  status: ResearchArtifactStatus;
  bundleRoot: string;
  paperPath: string;
  codePath: string;
  runsPath: string;
  analysisPath: string;
  figuresPath: string;
  reviewsPath: string;
  lineagePath: string;
  receiptPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoldenStudy {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  domain: string;
  status: GoldenStudyStatus;
  briefSummary: string | null;
  successCriteria: string | null;
  packageRoot: string;
  briefPath: string;
  approvedHypothesisPath: string;
  literatureSetPath: string;
  datasetsPath: string;
  baselinePath: string;
  evaluationContractPath: string;
  expectedArtifactsPath: string;
  gateRulesPath: string;
  computeBudgetPath: string;
  stopConditionsPath: string;
  instantiateCount: number;
  lastInstantiatedStudyId: string | null;
  seededExample: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchLearningRecord {
  id: string;
  companyId: string;
  studyId: string | null;
  title: string;
  signal: ResearchLearningSignal;
  reusable: boolean;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchMissionControlSummary {
  enabled: boolean;
  companyId: string;
  companyName: string;
  domainFocus: string[];
  governance: {
    constitutionVersion: string;
    roleAdapterCount: number;
    verifierCount: number;
  };
  staging: {
    goldenStudyCount: number;
    instantiatedGoldenStudies: number;
  };
  programs: {
    total: number;
    active: number;
    paused: number;
    archived: number;
  };
  studies: {
    total: number;
    running: number;
    blocked: number;
    reviewing: number;
    readyToArchive: number;
  };
  compute: {
    activeRuns: number;
    queuedRuns: number;
    failedRuns: number;
    budgetHours: number;
    consumedHours: number;
  };
  artifacts: {
    total: number;
    released: number;
    scaffolded: number;
  };
  learning: {
    total: number;
    reusablePatterns: number;
    recentFailures: number;
  };
  highlights: Array<{
    label: string;
    value: string;
  }>;
  recentFailures: ResearchLearningRecord[];
}
