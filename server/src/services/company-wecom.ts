import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companies } from "@paperclipai/db";
import { readPaperclipSkillSyncPreference, writePaperclipSkillSyncPreference } from "@paperclipai/adapter-utils/server-utils";
import {
  listPaperclipWeComSkillKeys,
  resolveWeComCliDirectories,
} from "@paperclipai/adapter-opencode-local/server";
import type { CompanyWeComCommandStatus, CompanyWeComStatus } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { agentService } from "./agents.js";
import { companySkillService } from "./company-skills.js";

const execFile = promisify(execFileCallback);
const PAPERCLIP_WECOM_COMMANDS = {
  opencode: "opencode",
  wecomCli: "wecom-cli",
} as const;

function mergeUnique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function firstNonEmptyLine(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const first = value
      ?.split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (first) return first;
  }
  return null;
}

function shellEscape(value: string) {
  return JSON.stringify(value);
}

async function statPath(targetPath: string) {
  return fs.stat(targetPath).catch(() => null);
}

async function resolveCommandPath(command: string) {
  const trimmed = command.trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  if (trimmed.includes(path.sep)) {
    candidates.push(path.resolve(trimmed));
  } else {
    for (const segment of (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)) {
      candidates.push(path.resolve(segment, trimmed));
    }
  }

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

async function readCommandVersion(commandPath: string | null) {
  if (!commandPath) return null;
  try {
    const { stdout, stderr } = await execFile(commandPath, ["--version"], {
      env: process.env,
      maxBuffer: 1024 * 1024,
    });
    return firstNonEmptyLine(stdout, stderr);
  } catch (error) {
    if (!(error instanceof Error)) return null;
    const execError = error as Error & { stdout?: string; stderr?: string };
    return firstNonEmptyLine(execError.stdout, execError.stderr, execError.message);
  }
}

async function describeCommand(name: string, command: string): Promise<CompanyWeComCommandStatus> {
  const resolvedPath = await resolveCommandPath(command);
  return {
    name,
    command,
    available: Boolean(resolvedPath),
    resolvedPath,
    version: await readCommandVersion(resolvedPath),
  };
}

async function countFiles(root: string): Promise<number> {
  const stats = await statPath(root);
  if (!stats?.isDirectory()) return 0;
  const entries = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  let total = 0;
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const nextPath = path.resolve(root, entry.name);
    if (entry.isDirectory()) {
      total += await countFiles(nextPath);
      continue;
    }
    total += 1;
  }
  return total;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function mergeDesiredWeComSkillsForAdapter(adapterType: string, desiredSkills: string[]) {
  if (adapterType !== "opencode_local") {
    return mergeUnique(desiredSkills);
  }
  return mergeUnique([...desiredSkills, ...listPaperclipWeComSkillKeys()]);
}

export function companyWeComService(db: Db) {
  const agents = agentService(db);
  const companySkills = companySkillService(db);

  async function ensureCompanyExists(companyId: string) {
    const row = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.id, companyId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Company not found");
    return row;
  }

  async function getStatus(companyId: string): Promise<CompanyWeComStatus> {
    await ensureCompanyExists(companyId);

    const skills = await companySkills.listFull(companyId);
    const seededSkillKeys = skills
      .map((skill) => skill.key)
      .filter((key) => listPaperclipWeComSkillKeys().includes(key))
      .sort((left, right) => left.localeCompare(right));
    const missingSkillKeys = listPaperclipWeComSkillKeys().filter((key) => !seededSkillKeys.includes(key));

    const [opencode, wecomCli] = await Promise.all([
      describeCommand("opencode", PAPERCLIP_WECOM_COMMANDS.opencode),
      describeCommand("wecom-cli", PAPERCLIP_WECOM_COMMANDS.wecomCli),
    ]);

    const directories = resolveWeComCliDirectories(companyId);
    const [configExists, tmpExists, configFileCount] = await Promise.all([
      statPath(directories.configDir).then((entry) => Boolean(entry?.isDirectory())),
      statPath(directories.tmpDir).then((entry) => Boolean(entry?.isDirectory())),
      countFiles(directories.configDir),
    ]);
    const initialized = configFileCount > 0;

    let state: CompanyWeComStatus["state"] = "ready";
    if (!opencode.available) {
      state = "missing_opencode";
    } else if (!wecomCli.available) {
      state = "missing_wecom_cli";
    } else if (!initialized || missingSkillKeys.length > 0) {
      state = "company_not_initialized";
    }

    const initCommand = [
      `WECOM_CLI_CONFIG_DIR=${shellEscape(directories.configDir)}`,
      `WECOM_CLI_TMP_DIR=${shellEscape(directories.tmpDir)}`,
      PAPERCLIP_WECOM_COMMANDS.wecomCli,
      "init",
    ].join(" ");

    let nextAction: string | null = null;
    if (state === "missing_opencode") {
      nextAction = "Install OpenCode CLI and make sure `opencode` is available in PATH.";
    } else if (state === "missing_wecom_cli") {
      nextAction = "Install WeCom CLI (`npm install -g @wecom/cli`) and make sure `wecom-cli` is available in PATH.";
    } else if (missingSkillKeys.length > 0) {
      nextAction = `Bundled WeCom skills are missing from the company library: ${missingSkillKeys.join(", ")}.`;
    } else if (state === "company_not_initialized") {
      nextAction = `Run \`paperclipai company wecom init ${companyId}\` to initialize this company's WeCom CLI profile.`;
    }

    return {
      companyId,
      state,
      ready: state === "ready" && missingSkillKeys.length === 0,
      skillsSeeded: missingSkillKeys.length === 0,
      seededSkillKeys,
      missingSkillKeys,
      commands: {
        opencode,
        wecomCli,
      },
      config: {
        instanceRoot: directories.instanceRoot,
        companyRoot: directories.companyRoot,
        configDir: directories.configDir,
        tmpDir: directories.tmpDir,
        configExists,
        tmpExists,
        initialized,
        configFileCount,
      },
      initCommand,
      nextAction,
    };
  }

  async function backfillAll() {
    const companyRows = await db
      .select({ id: companies.id })
      .from(companies);

    for (const company of companyRows) {
      await companySkills.listFull(company.id);
      const companyAgents = await agents.list(company.id, { includeTerminated: false });
      for (const agent of companyAgents) {
        if (agent.adapterType !== "opencode_local") continue;
        const config =
          typeof agent.adapterConfig === "object" && agent.adapterConfig !== null && !Array.isArray(agent.adapterConfig)
            ? agent.adapterConfig as Record<string, unknown>
            : {};
        const preference = readPaperclipSkillSyncPreference(config);
        const mergedDesiredSkills = mergeDesiredWeComSkillsForAdapter(agent.adapterType, preference.desiredSkills);
        const nextConfig = writePaperclipSkillSyncPreference(config, mergedDesiredSkills);
        if (preference.explicit && arraysEqual(preference.desiredSkills, mergedDesiredSkills)) {
          continue;
        }
        await agents.update(agent.id, {
          adapterConfig: nextConfig,
        }, {
          recordRevision: {
            source: "wecom-bundled-skills-backfill",
          },
        });
      }
    }
  }

  return {
    getStatus,
    backfillAll,
  };
}
