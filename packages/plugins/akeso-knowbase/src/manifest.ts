import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "akeso.knowbase";
const PLUGIN_VERSION = "0.1.0";
const DEFAULT_CONFIG = {
  knowbaseRepoPath: "/Users/ntnbdyy/REPO/AKESO_KNOWBASE",
  knowbaseProjectRoot: "/Users/ntnbdyy/REPO/AKESO_KNOWBASE",
  uvCommand: "uv",
  publicCompanyName: "AKESO KNOWBASE",
};
const TOOL_NAMES = {
  search: "search",
  path: "path",
  explain: "explain",
  packContext: "pack_context",
  createBrief: "create_brief",
  compileIssueContext: "compile_issue_context",
  runHealthCheck: "run_health_check",
  promoteToPublicCanon: "promote_to_public_canon",
};

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "AKESO KNOWBASE",
  description: "CLI-backed knowledge base tools for company-scoped private memory and shared public canon promotion.",
  author: "AKESO",
  categories: ["connector", "automation", "workspace"],
  capabilities: [
    "agent.tools.register",
    "companies.read",
    "instance.settings.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      knowbaseRepoPath: {
        type: "string",
        title: "KNOWBASE Repo Path",
        default: DEFAULT_CONFIG.knowbaseRepoPath,
      },
      knowbaseProjectRoot: {
        type: "string",
        title: "KNOWBASE Project Root",
        default: DEFAULT_CONFIG.knowbaseProjectRoot,
      },
      uvCommand: {
        type: "string",
        title: "uv Command",
        default: DEFAULT_CONFIG.uvCommand,
      },
      publicCompanyName: {
        type: "string",
        title: "Public Canon Company",
        default: DEFAULT_CONFIG.publicCompanyName,
      },
    },
    required: ["knowbaseRepoPath", "knowbaseProjectRoot", "uvCommand", "publicCompanyName"],
  },
  tools: [
    {
      name: TOOL_NAMES.search,
      displayName: "KNOWBASE Search",
      description: "Search the current company's private knowledge base and then the AKESO KNOWBASE public canon.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          company: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          privateOnly: { type: "boolean", default: false },
        },
        required: ["query"],
      },
    },
    {
      name: TOOL_NAMES.path,
      displayName: "KNOWBASE Path",
      description: "Find the strongest visible graph path between two refs inside the company-private graph plus optional shared public canon.",
      parametersSchema: {
        type: "object",
        properties: {
          fromRef: { type: "string" },
          toRef: { type: "string" },
          company: { type: "string" },
          maxDepth: { type: "integer", minimum: 1, maximum: 12, default: 6 },
          privateOnly: { type: "boolean", default: false },
        },
        required: ["fromRef", "toRef"],
      },
    },
    {
      name: TOOL_NAMES.explain,
      displayName: "KNOWBASE Explain",
      description: "Explain a ref's graph neighborhood, community tags, and edge evidence inside the company-private graph plus optional shared public canon.",
      parametersSchema: {
        type: "object",
        properties: {
          ref: { type: "string" },
          company: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
          privateOnly: { type: "boolean", default: false },
        },
        required: ["ref"],
      },
    },
    {
      name: TOOL_NAMES.packContext,
      displayName: "KNOWBASE Pack Context",
      description: "Build a company-scoped issue context pack from the private binding plus shared public canon.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          company: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          expansion: { type: "integer", minimum: 0, maximum: 8, default: 2 },
          privateOnly: { type: "boolean", default: false },
        },
        required: ["query"],
      },
    },
    {
      name: TOOL_NAMES.createBrief,
      displayName: "KNOWBASE Create Brief",
      description: "Generate a markdown brief for the current company using the strong synthesis layer when needed.",
      parametersSchema: {
        type: "object",
        properties: {
          question: { type: "string" },
          company: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 20, default: 5 },
          expansion: { type: "integer", minimum: 0, maximum: 8, default: 2 },
          privateOnly: { type: "boolean", default: false },
        },
        required: ["question"],
      },
    },
    {
      name: TOOL_NAMES.compileIssueContext,
      displayName: "KNOWBASE Compile Issue Context",
      description: "Run a company-scoped compile batch for the active private binding and return compile artifacts.",
      parametersSchema: {
        type: "object",
        properties: {
          company: { type: "string" },
          assetLimit: { type: "integer", minimum: 1, maximum: 200, default: 20 },
          topicLimit: { type: "integer", minimum: 0, maximum: 10, default: 1 },
          includeSourceGroups: {
            type: "array",
            items: { type: "string" },
          },
          promote: { type: "boolean", default: false },
        },
      },
    },
    {
      name: TOOL_NAMES.runHealthCheck,
      displayName: "KNOWBASE Health Check",
      description: "Run non-model integrity checks over the local knowledge base and return the latest report path.",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: TOOL_NAMES.promoteToPublicCanon,
      displayName: "KNOWBASE Promote To Public Canon",
      description: "Promote selected private draft pages into the AKESO KNOWBASE shared public canon with provenance.",
      parametersSchema: {
        type: "object",
        properties: {
          company: { type: "string" },
          sourceGroup: { type: "string" },
          refs: {
            type: "array",
            items: { type: "string" },
          },
          issueId: { type: "string" },
          runId: { type: "string" },
          publicCompany: { type: "string" },
        },
      },
    },
  ],
};

export default manifest;
