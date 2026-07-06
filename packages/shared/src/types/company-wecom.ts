export type CompanyWeComStatusState =
  | "missing_opencode"
  | "missing_wecom_cli"
  | "company_not_initialized"
  | "ready";

export interface CompanyWeComCommandStatus {
  name: string;
  command: string;
  available: boolean;
  resolvedPath: string | null;
  version: string | null;
}

export interface CompanyWeComConfigStatus {
  instanceRoot: string;
  companyRoot: string;
  configDir: string;
  tmpDir: string;
  configExists: boolean;
  tmpExists: boolean;
  initialized: boolean;
  configFileCount: number;
}

export interface CompanyWeComStatus {
  companyId: string;
  state: CompanyWeComStatusState;
  ready: boolean;
  skillsSeeded: boolean;
  seededSkillKeys: string[];
  missingSkillKeys: string[];
  commands: {
    opencode: CompanyWeComCommandStatus;
    wecomCli: CompanyWeComCommandStatus;
  };
  config: CompanyWeComConfigStatus;
  initCommand: string;
  nextAction: string | null;
}
