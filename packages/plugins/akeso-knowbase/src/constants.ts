export const PLUGIN_ID = "akeso.knowbase";
export const PLUGIN_VERSION = "0.1.0";

export const DEFAULT_CONFIG = {
  knowbaseRepoPath: "/Users/ntnbdyy/REPO/AKESO_KNOWBASE",
  knowbaseProjectRoot: "/Users/ntnbdyy/REPO/AKESO_KNOWBASE",
  uvCommand: "uv",
  publicCompanyName: "AKESO KNOWBASE",
} as const;

export const TOOL_NAMES = {
  search: "search",
  packContext: "pack_context",
  createBrief: "create_brief",
  compileIssueContext: "compile_issue_context",
  runHealthCheck: "run_health_check",
  promoteToPublicCanon: "promote_to_public_canon",
} as const;

