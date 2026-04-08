import { definePlugin, runWorker, type PaperclipPlugin, type PluginContext } from "@paperclipai/plugin-sdk";
import type { ToolResult } from "@paperclipai/plugin-sdk";
import manifest from "./manifest.js";
import { TOOL_NAMES } from "./constants.js";
import {
  createCliRuntime,
  resolveCompanyName,
  resolvePluginConfig,
  validateConfig,
  type KnowbaseRuntime,
} from "./runtime.js";

function summarizeSearchResult(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "No knowledge base hits were found.";
  return rows
    .slice(0, 5)
    .map((row) => {
      const recordType = typeof row.record_type === "string" ? row.record_type : "record";
      const ref = typeof row.ref === "string" ? row.ref : "unknown";
      const title = typeof row.title === "string" ? row.title : "untitled";
      return `- [${recordType}] ${title} (${ref})`;
    })
    .join("\n");
}

function summarizeContextPack(pack: Record<string, unknown>): string {
  const refs = Array.isArray(pack.refs) ? pack.refs.length : 0;
  const hits = Array.isArray(pack.hits) ? pack.hits.length : 0;
  const sourceGroups = Array.isArray(pack.source_groups) ? pack.source_groups.join(", ") : "n/a";
  return `Built context pack with ${hits} hits, ${refs} refs, source groups: ${sourceGroups}.`;
}

function summarizeCompileResult(result: Record<string, unknown>): string {
  const planned = typeof result.planned_count === "number" ? result.planned_count : null;
  const completed = typeof result.completed_count === "number" ? result.completed_count : null;
  return `Compile batch finished. planned=${planned ?? "n/a"}, completed=${completed ?? "n/a"}.`;
}

function summarizeHealth(result: { reportPath: string; findings: unknown[] }): string {
  return `Health sweep complete. findings=${result.findings.length}, report=${result.reportPath}`;
}

async function registerTools(ctx: PluginContext, runtime: KnowbaseRuntime): Promise<void> {
  ctx.tools.register(
    TOOL_NAMES.search,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.search)!,
    async (params, runCtx): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const company = await resolveCompanyName(ctx, runCtx, (params as { company?: string }).company);
      const result = await runtime.search(config, {
        query: String((params as { query: string }).query),
        company,
        limit: Number((params as { limit?: number }).limit ?? 5),
        privateOnly: Boolean((params as { privateOnly?: boolean }).privateOnly),
      });
      return {
        content: summarizeSearchResult(result as Array<Record<string, unknown>>),
        data: { company, hits: result },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.packContext,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.packContext)!,
    async (params, runCtx): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const company = await resolveCompanyName(ctx, runCtx, (params as { company?: string }).company);
      const result = await runtime.packContext(config, {
        query: String((params as { query: string }).query),
        company,
        limit: Number((params as { limit?: number }).limit ?? 5),
        expansion: Number((params as { expansion?: number }).expansion ?? 2),
        privateOnly: Boolean((params as { privateOnly?: boolean }).privateOnly),
      });
      return {
        content: summarizeContextPack(result),
        data: { company, ...result },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.createBrief,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.createBrief)!,
    async (params, runCtx): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const company = await resolveCompanyName(ctx, runCtx, (params as { company?: string }).company);
      const result = await runtime.createBrief(config, {
        question: String((params as { question: string }).question),
        company,
        limit: Number((params as { limit?: number }).limit ?? 5),
        expansion: Number((params as { expansion?: number }).expansion ?? 2),
        privateOnly: Boolean((params as { privateOnly?: boolean }).privateOnly),
      });
      return {
        content: result.markdown,
        data: { company, outputPath: result.outputPath },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.compileIssueContext,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.compileIssueContext)!,
    async (params, runCtx): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const company = await resolveCompanyName(ctx, runCtx, (params as { company?: string }).company);
      const result = await runtime.compileIssueContext(config, {
        company,
        assetLimit: Number((params as { assetLimit?: number }).assetLimit ?? 20),
        topicLimit: Number((params as { topicLimit?: number }).topicLimit ?? 1),
        includeSourceGroups: Array.isArray((params as { includeSourceGroups?: string[] }).includeSourceGroups)
          ? (params as { includeSourceGroups?: string[] }).includeSourceGroups
          : undefined,
        promote: Boolean((params as { promote?: boolean }).promote),
      });
      return {
        content: summarizeCompileResult(result),
        data: { company, ...result },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.runHealthCheck,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.runHealthCheck)!,
    async (): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const result = await runtime.runHealthCheck(config);
      return {
        content: summarizeHealth(result),
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.promoteToPublicCanon,
    manifest.tools!.find((tool) => tool.name === TOOL_NAMES.promoteToPublicCanon)!,
    async (params, runCtx): Promise<ToolResult> => {
      const config = await resolvePluginConfig(ctx);
      const company = await resolveCompanyName(ctx, runCtx, (params as { company?: string }).company);
      const result = await runtime.promoteToPublicCanon(config, {
        company,
        sourceGroup: (params as { sourceGroup?: string }).sourceGroup,
        refs: Array.isArray((params as { refs?: string[] }).refs)
          ? (params as { refs?: string[] }).refs
          : undefined,
        issueId: (params as { issueId?: string }).issueId,
        runId: (params as { runId?: string }).runId,
        publicCompany: (params as { publicCompany?: string }).publicCompany,
      });
      return {
        content: `Promoted selected knowledge into the shared public canon for ${company}.`,
        data: { company, ...result },
      };
    },
  );
}

export function createKnowbasePlugin(runtime: KnowbaseRuntime = createCliRuntime()): PaperclipPlugin {
  let currentContext: PluginContext | null = null;
  return definePlugin({
    async setup(ctx) {
      currentContext = ctx;
      await registerTools(ctx, runtime);
      ctx.logger.info("AKESO KNOWBASE plugin setup complete", { pluginId: manifest.id });
    },

    async onHealth() {
      const ctx = currentContext;
      if (!ctx) {
        return { status: "warn", message: "Plugin context is not initialized yet." };
      }
      const config = await resolvePluginConfig(ctx);
      const validation = validateConfig(config);
      if (!validation.ok) {
        return {
          status: "error",
          message: "AKESO KNOWBASE plugin config is invalid.",
          details: { errors: validation.errors, warnings: validation.warnings },
        };
      }
      return {
        status: "ok",
        message: "AKESO KNOWBASE plugin is ready.",
        details: {
          repoPath: config.knowbaseRepoPath,
          projectRoot: config.knowbaseProjectRoot,
          publicCompanyName: config.publicCompanyName,
        },
      };
    },

    async onValidateConfig(rawConfig) {
      const config = {
        knowbaseRepoPath: typeof rawConfig.knowbaseRepoPath === "string" ? rawConfig.knowbaseRepoPath : "",
        knowbaseProjectRoot: typeof rawConfig.knowbaseProjectRoot === "string" ? rawConfig.knowbaseProjectRoot : "",
        uvCommand: typeof rawConfig.uvCommand === "string" ? rawConfig.uvCommand : "",
        publicCompanyName: typeof rawConfig.publicCompanyName === "string" ? rawConfig.publicCompanyName : "",
      };
      const validation = validateConfig(config);
      return validation;
    },
  });
}

const plugin = createKnowbasePlugin();

export default plugin;
runWorker(plugin, import.meta.url);
