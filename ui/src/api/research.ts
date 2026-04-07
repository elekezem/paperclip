import type {
  IdeaIntakeRequest,
  IdeaIntakeResult,
  ReferenceBlueprint,
  ResearchArtifact,
  ResearchGovernanceBundle,
  GoldenStudy,
  ResearchLearningRecord,
  ResearchMissionControlSummary,
  ResearchProgram,
  ResearchRun,
  ResearchStudy,
} from "@paperclipai/shared";
import { api } from "./client";

function unwrapItems<T>(payload: T[] | { items?: T[] }): T[] {
  return Array.isArray(payload) ? payload : payload.items ?? [];
}

function unwrapStudy(payload: ResearchStudy | { study?: ResearchStudy } | { result?: ResearchStudy }): ResearchStudy {
  if ("study" in payload && payload.study) {
    return payload.study as ResearchStudy;
  }
  if ("result" in payload && payload.result) {
    return payload.result as ResearchStudy;
  }
  return payload as ResearchStudy;
}

function unwrapRun(payload: ResearchRun | { result?: ResearchRun }): ResearchRun {
  if ("result" in payload && payload.result) {
    return payload.result as ResearchRun;
  }
  return payload as ResearchRun;
}

export const researchApi = {
  missionControl: (companyId: string) =>
    api.get<ResearchMissionControlSummary>(`/research/companies/${companyId}/mission-control`),
  governance: (companyId: string) =>
    api.get<ResearchGovernanceBundle | null>(`/research/companies/${companyId}/governance`),
  programs: async (companyId: string) =>
    unwrapItems(await api.get<ResearchProgram[] | { items?: ResearchProgram[] }>(`/research/companies/${companyId}/programs`)),
  studies: async (companyId: string) =>
    unwrapItems(await api.get<ResearchStudy[] | { items?: ResearchStudy[] }>(`/research/companies/${companyId}/studies`)),
  runs: async (companyId: string) =>
    unwrapItems(await api.get<ResearchRun[] | { items?: ResearchRun[] }>(`/research/companies/${companyId}/runs`)),
  artifacts: async (companyId: string) =>
    unwrapItems(await api.get<ResearchArtifact[] | { items?: ResearchArtifact[] }>(`/research/companies/${companyId}/artifacts`)),
  learning: async (companyId: string) =>
    unwrapItems(await api.get<ResearchLearningRecord[] | { items?: ResearchLearningRecord[] }>(`/research/companies/${companyId}/learning`)),
  goldenStudies: async (companyId: string) =>
    unwrapItems(await api.get<GoldenStudy[] | { items?: GoldenStudy[] }>(`/research/companies/${companyId}/golden-studies`)),
  referenceBlueprints: async (companyId: string) =>
    unwrapItems(await api.get<ReferenceBlueprint[] | { items?: ReferenceBlueprint[] }>(`/research/companies/${companyId}/reference-blueprints`)),
  ideaIntake: (companyId: string, body: IdeaIntakeRequest) =>
    api.post<IdeaIntakeResult>(`/research/companies/${companyId}/idea-intake`, body),
  createStudy: (
    companyId: string,
    body: { title: string; hypothesis?: string; programId?: string; budgetHours?: number; negativeResultEligible?: boolean },
  ) => api.post<ResearchStudy | { study?: ResearchStudy }>(`/research/companies/${companyId}/studies`, body).then(unwrapStudy),
  instantiateGoldenStudy: (
    companyId: string,
    goldenStudyId: string,
    body: { title?: string; hypothesis?: string; programId?: string } = {},
  ) => api.post<{ study?: ResearchStudy }>(`/research/companies/${companyId}/golden-studies/${goldenStudyId}/instantiate`, body).then(unwrapStudy),
  launchStudy: (companyId: string, studyId: string) =>
    api.post<ResearchStudy | { result?: ResearchStudy }>(`/research/companies/${companyId}/studies/${studyId}/launch`, {}).then(unwrapStudy),
  startStudy: (companyId: string, studyId: string) =>
    api.post<ResearchRun | { result?: ResearchRun }>(`/research/companies/${companyId}/studies/${studyId}/start`, {}).then(unwrapRun),
  pauseStudy: (companyId: string, studyId: string) =>
    api.post<ResearchRun | { result?: ResearchRun }>(`/research/companies/${companyId}/studies/${studyId}/pause`, {}).then(unwrapRun),
  resumeStudy: (companyId: string, studyId: string) =>
    api.post<ResearchRun | { result?: ResearchRun }>(`/research/companies/${companyId}/studies/${studyId}/resume`, {}).then(unwrapRun),
};
