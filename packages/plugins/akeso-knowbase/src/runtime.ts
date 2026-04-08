import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { PluginContext, ToolRunContext } from "@paperclipai/plugin-sdk";
import { DEFAULT_CONFIG } from "./constants.js";

const execFileAsync = promisify(execFile);

export type KnowbasePluginConfig = {
  knowbaseRepoPath: string;
  knowbaseProjectRoot: string;
  uvCommand: string;
  publicCompanyName: string;
};

export type SearchArgs = {
  query: string;
  company: string;
  limit?: number;
  privateOnly?: boolean;
};

export type PackContextArgs = {
  query: string;
  company: string;
  limit?: number;
  expansion?: number;
  privateOnly?: boolean;
};

export type CreateBriefArgs = {
  question: string;
  company: string;
  limit?: number;
  expansion?: number;
  privateOnly?: boolean;
};

export type CompileIssueContextArgs = {
  company: string;
  assetLimit?: number;
  topicLimit?: number;
  includeSourceGroups?: string[];
  promote?: boolean;
};

export type PromoteArgs = {
  company: string;
  sourceGroup?: string;
  refs?: string[];
  issueId?: string;
  runId?: string;
  publicCompany?: string;
};

export type HealthCheckResult = {
  reportPath: string;
  findings: unknown[];
};

export interface KnowbaseRuntime {
  search(config: KnowbasePluginConfig, args: SearchArgs): Promise<unknown[]>;
  packContext(config: KnowbasePluginConfig, args: PackContextArgs): Promise<Record<string, unknown>>;
  createBrief(config: KnowbasePluginConfig, args: CreateBriefArgs): Promise<{ outputPath: string; markdown: string }>;
  compileIssueContext(config: KnowbasePluginConfig, args: CompileIssueContextArgs): Promise<Record<string, unknown>>;
  runHealthCheck(config: KnowbasePluginConfig): Promise<HealthCheckResult>;
  promoteToPublicCanon(config: KnowbasePluginConfig, args: PromoteArgs): Promise<Record<string, unknown>>;
}

function parseJson<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${label} JSON: ${String(error)}\n${raw}`);
  }
}

function appendOptionalFlag(args: string[], flag: string, value: string | undefined | null) {
  if (value === undefined || value === null || value === "") return;
  args.push(flag, value);
}

function appendBooleanFlag(args: string[], flag: string, enabled: boolean | undefined) {
  if (enabled) args.push(flag);
}

function appendRepeatedFlag(args: string[], flag: string, values: string[] | undefined) {
  for (const value of values ?? []) {
    args.push(flag, value);
  }
}

export async function resolvePluginConfig(ctx: PluginContext): Promise<KnowbasePluginConfig> {
  const config = await ctx.config.get();
  return {
    knowbaseRepoPath:
      typeof config.knowbaseRepoPath === "string" && config.knowbaseRepoPath.length > 0
        ? config.knowbaseRepoPath
        : DEFAULT_CONFIG.knowbaseRepoPath,
    knowbaseProjectRoot:
      typeof config.knowbaseProjectRoot === "string" && config.knowbaseProjectRoot.length > 0
        ? config.knowbaseProjectRoot
        : DEFAULT_CONFIG.knowbaseProjectRoot,
    uvCommand:
      typeof config.uvCommand === "string" && config.uvCommand.length > 0
        ? config.uvCommand
        : DEFAULT_CONFIG.uvCommand,
    publicCompanyName:
      typeof config.publicCompanyName === "string" && config.publicCompanyName.length > 0
        ? config.publicCompanyName
        : DEFAULT_CONFIG.publicCompanyName,
  };
}

export async function resolveCompanyName(
  ctx: PluginContext,
  runCtx: ToolRunContext,
  explicitCompany?: string,
): Promise<string> {
  if (explicitCompany && explicitCompany.trim().length > 0) {
    return explicitCompany.trim();
  }
  const company = await ctx.companies.get(runCtx.companyId);
  if (company?.name) return company.name;
  throw new Error(`Could not resolve company name for companyId=${runCtx.companyId}`);
}

export function validateConfig(config: KnowbasePluginConfig): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!existsSync(config.knowbaseRepoPath)) {
    errors.push(`knowbaseRepoPath does not exist: ${config.knowbaseRepoPath}`);
  }
  if (!existsSync(config.knowbaseProjectRoot)) {
    errors.push(`knowbaseProjectRoot does not exist: ${config.knowbaseProjectRoot}`);
  }
  if (!config.uvCommand.trim()) {
    errors.push("uvCommand must not be empty");
  }
  if (!config.publicCompanyName.trim()) {
    errors.push("publicCompanyName must not be empty");
  }
  if (config.knowbaseRepoPath !== config.knowbaseProjectRoot) {
    warnings.push("knowbaseRepoPath and knowbaseProjectRoot differ; ensure the project root points at the intended knowbase.json");
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

export function createCliRuntime(): KnowbaseRuntime {
  async function runCommand(
    config: KnowbasePluginConfig,
    args: string[],
    envPatch?: Record<string, string>,
  ): Promise<string> {
    const { stdout } = await execFileAsync(config.uvCommand, args, {
      cwd: config.knowbaseRepoPath,
      env: {
        ...process.env,
        ...envPatch,
      },
      maxBuffer: 1024 * 1024 * 16,
    });
    return stdout.trim();
  }

  return {
    async search(config, args) {
      const command = [
        "run",
        "knowbase",
        "search",
        args.query,
        "--project-root",
        config.knowbaseProjectRoot,
        "--company",
        args.company,
        "--limit",
        String(args.limit ?? 5),
        "--json",
      ];
      appendBooleanFlag(command, "--private-only", args.privateOnly);
      return parseJson<unknown[]>(await runCommand(config, command), "search");
    },

    async packContext(config, args) {
      const python = [
        "run",
        "python",
        "-c",
        [
          "import json, os",
          "from knowbase.config import load_config, resolve_project_root",
          "from knowbase.db import open_database",
          "from knowbase.search import pack_context",
          "root = resolve_project_root(os.environ['KB_PROJECT_ROOT'])",
          "config = load_config(root)",
          "with open_database(config.paths.index_path) as db:",
          "    result = pack_context(config, db, os.environ['KB_QUERY'], limit=int(os.environ['KB_LIMIT']), expansion=int(os.environ['KB_EXPANSION']), company=os.environ.get('KB_COMPANY') or None, include_public=os.environ.get('KB_INCLUDE_PUBLIC', '1') == '1')",
          "print(json.dumps(result))",
        ].join("\n"),
      ];
      return parseJson<Record<string, unknown>>(
        await runCommand(config, python, {
          KB_PROJECT_ROOT: config.knowbaseProjectRoot,
          KB_QUERY: args.query,
          KB_LIMIT: String(args.limit ?? 5),
          KB_EXPANSION: String(args.expansion ?? 2),
          KB_COMPANY: args.company,
          KB_INCLUDE_PUBLIC: args.privateOnly ? "0" : "1",
        }),
        "pack_context",
      );
    },

    async createBrief(config, args) {
      const command = [
        "run",
        "knowbase",
        "answer",
        args.question,
        "--project-root",
        config.knowbaseProjectRoot,
        "--company",
        args.company,
        "--limit",
        String(args.limit ?? 5),
        "--expansion",
        String(args.expansion ?? 2),
      ];
      appendBooleanFlag(command, "--private-only", args.privateOnly);
      const outputPath = await runCommand(config, command);
      const markdown = await readFile(outputPath, "utf8");
      return { outputPath, markdown };
    },

    async compileIssueContext(config, args) {
      const command = [
        "run",
        "knowbase",
        "compile",
        "run",
        "--project-root",
        config.knowbaseProjectRoot,
        "--company",
        args.company,
        "--asset-limit",
        String(args.assetLimit ?? 20),
        "--topic-limit",
        String(args.topicLimit ?? 1),
      ];
      appendRepeatedFlag(command, "--include-source-group", args.includeSourceGroups);
      appendBooleanFlag(command, "--promote", args.promote);
      return parseJson<Record<string, unknown>>(await runCommand(config, command), "compile run");
    },

    async runHealthCheck(config) {
      const output = await runCommand(config, [
        "run",
        "knowbase",
        "health",
        "--project-root",
        config.knowbaseProjectRoot,
        "--json",
      ]);
      const lines = output.split(/\r?\n/).filter(Boolean);
      const reportPath = lines.shift() ?? "";
      const findings = lines.length > 0 ? parseJson<unknown[]>(lines.join("\n"), "health") : [];
      return { reportPath, findings };
    },

    async promoteToPublicCanon(config, args) {
      const command = [
        "run",
        "knowbase",
        "promote",
        "--project-root",
        config.knowbaseProjectRoot,
        "--company",
        args.company,
      ];
      appendOptionalFlag(command, "--source-group", args.sourceGroup);
      appendRepeatedFlag(command, "--ref", args.refs);
      appendOptionalFlag(command, "--issue-id", args.issueId);
      appendOptionalFlag(command, "--run-id", args.runId);
      appendOptionalFlag(command, "--public-company", args.publicCompany);
      return parseJson<Record<string, unknown>>(await runCommand(config, command), "promote");
    },
  };
}
