import { existsSync } from "node:fs";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asString,
  parseObject,
  ensurePathInEnv,
} from "@paperclipai/adapter-utils/server-utils";
import {
  ensureAdapterExecutionTargetCommandResolvable,
  ensureAdapterExecutionTargetDirectory,
  maybeRunSandboxInstallCommand,
  runAdapterExecutionTargetProcess,
  describeAdapterExecutionTarget,
  resolveAdapterExecutionTargetCwd,
  prepareAdapterExecutionTargetRuntime,
} from "@paperclipai/adapter-utils/execution-target";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseCodexJsonl } from "./parse.js";
import { SANDBOX_INSTALL_COMMAND } from "../index.js";
import { codexHomeDir, readCodexAuthInfo } from "./quota.js";
import { buildCodexExecArgs } from "./codex-args.js";
import { resolveCodexCommand } from "./command.js";
import { prepareManagedCodexHome } from "./codex-home.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stripOpenAiApiKey<T extends Record<string, string | undefined> & { OPENAI_API_KEY?: string }>(env: T): T {
  if (!isNonEmpty(env.OPENAI_API_KEY)) return env;
  const sanitized = { ...env };
  sanitized.OPENAI_API_KEY = "" as T["OPENAI_API_KEY"];
  return sanitized as T;
}

function firstNonEmptyLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

function summarizeProbeDetail(stdout: string, stderr: string, parsedError: string | null): string | null {
  const raw = parsedError?.trim() || firstNonEmptyLine(stderr) || firstNonEmptyLine(stdout);
  if (!raw) return null;
  const clean = raw.replace(/\s+/g, " ").trim();
  const max = 240;
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const CODEX_AUTH_REQUIRED_RE =
  /(?:not\s+logged\s+in|login\s+required|authentication\s+required|unauthorized|invalid(?:\s+or\s+missing)?\s+api(?:[_\s-]?key)?|openai[_\s-]?api[_\s-]?key|api[_\s-]?key.*required|please\s+run\s+`?codex\s+login`?)/i;

async function prepareCodexHelloProbe(input: {
  runId: string;
  companyId: string;
  target: AdapterEnvironmentTestContext["executionTarget"] | null;
  targetIsRemote: boolean;
  cwd: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  probeApiKey: string | null;
}): Promise<{
  command: string;
  args: string[];
  env: Record<string, string>;
  cleanup: () => Promise<void>;
}> {
  let preparedRuntime: Awaited<ReturnType<typeof prepareAdapterExecutionTargetRuntime>> | null = null;
  let preparedRuntimeWorkspaceLocalDir: string | null = null;

  const cleanup = async () => {
    await preparedRuntime?.restoreWorkspace().catch(() => {});
    if (preparedRuntimeWorkspaceLocalDir) {
      await fs.rm(preparedRuntimeWorkspaceLocalDir, { recursive: true, force: true }).catch(() => {});
    }
  };

  if (input.targetIsRemote && !input.probeApiKey) {
    const managedHome = await prepareManagedCodexHome(process.env, async () => {}, input.companyId, {
      apiKey: null,
    });
    preparedRuntimeWorkspaceLocalDir = await fs.mkdtemp(
      path.join(os.tmpdir(), `paperclip-codex-envtest-${input.runId}-`),
    );
    preparedRuntime = await prepareAdapterExecutionTargetRuntime({
      runId: input.runId,
      target: input.target,
      adapterKey: "codex",
      workspaceLocalDir: preparedRuntimeWorkspaceLocalDir,
      // Pass `input.cwd` as the base (not a pre-built per-run subdir).
      // `prepareRemoteManagedRuntime` itself appends
      // `.paperclip-runtime/runs/<runId>/workspace` to whatever it gets, so
      // pre-building a per-run path here would double-nest the run ID.
      workspaceRemoteDir: input.cwd,
      installCommand: SANDBOX_INSTALL_COMMAND,
      detectCommand: input.command,
      assets: [
        {
          key: "home",
          localDir: managedHome,
          followSymlinks: true,
        },
      ],
    });

    return {
      command: input.command,
      args: input.args,
      env: preparedRuntime.assetDirs.home
        ? { ...input.env, CODEX_HOME: preparedRuntime.assetDirs.home }
        : { ...input.env },
      cleanup,
    };
  }

  if (input.probeApiKey) {
    const probeHome = input.targetIsRemote
      ? path.posix.join(input.cwd, ".paperclip-runtime", "codex", `probe-home-${input.runId}`)
      : path.join(os.tmpdir(), `paperclip-codex-probe-${input.runId}`);
    return {
      command: "sh",
      args: [
        "-c",
        'set -e; mkdir -p "$CODEX_HOME"; umask 077; printf "%s" "$_PAPERCLIP_CODEX_AUTH_JSON" > "$CODEX_HOME/auth.json"; unset _PAPERCLIP_CODEX_AUTH_JSON; trap \'rm -rf "$CODEX_HOME"\' EXIT INT TERM; "$0" "$@"',
        input.command,
        ...input.args,
      ],
      env: {
        ...input.env,
        CODEX_HOME: probeHome,
        _PAPERCLIP_CODEX_AUTH_JSON: JSON.stringify({ OPENAI_API_KEY: input.probeApiKey }),
      },
      cleanup,
    };
  }

  return {
    command: input.command,
    args: input.args,
    env: { ...input.env },
    cleanup,
  };
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = resolveCodexCommand(config.command, {
    bundledCodexExists:
      process.platform === "darwin" && existsSync("/Applications/Codex.app/Contents/Resources/codex"),
  });
  const target = ctx.executionTarget ?? null;
  const targetIsRemote = target?.kind === "remote";
  const targetIsSandbox = target?.kind === "remote" && target.transport === "sandbox";
  const cwd = resolveAdapterExecutionTargetCwd(target, asString(config.cwd, ""), process.cwd());
  const targetLabel = targetIsRemote
    ? ctx.environmentName ?? describeAdapterExecutionTarget(target)
    : null;
  const runId = `codex-envtest-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  if (targetLabel) {
    checks.push({
      code: "codex_environment_target",
      level: "info",
      message: `Probing inside environment: ${targetLabel}`,
    });
  }

  try {
    await ensureAdapterExecutionTargetDirectory(runId, target, cwd, {
      cwd,
      env: {},
      createIfMissing: true,
    });
    checks.push({
      code: "codex_cwd_valid",
      level: "info",
      message: `Working directory is valid: ${cwd}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_cwd_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid working directory",
      detail: cwd,
    });
  }

  const envConfig = parseObject(config.env);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(envConfig)) {
    if (typeof value === "string") env[key] = value;
  }
  const runtimeEnv = ensurePathInEnv(stripOpenAiApiKey({ ...process.env, ...env }));
  const installCheck = await maybeRunSandboxInstallCommand({
    runId,
    target,
    adapterKey: "codex",
    installCommand: SANDBOX_INSTALL_COMMAND,
    detectCommand: command,
    env: stripOpenAiApiKey(env),
  });
  if (installCheck) checks.push(installCheck);
  try {
    await ensureAdapterExecutionTargetCommandResolvable(command, target, cwd, runtimeEnv);
    checks.push({
      code: "codex_command_resolvable",
      level: "info",
      message: `Command is executable: ${command}`,
    });
  } catch (err) {
    checks.push({
      code: "codex_command_unresolvable",
      level: "error",
      message: err instanceof Error ? err.message : "Command is not executable",
      detail: command,
    });
  }

  const configOpenAiKey = env.OPENAI_API_KEY;
  const hostOpenAiKey = targetIsRemote ? undefined : process.env.OPENAI_API_KEY;
  if (isNonEmpty(configOpenAiKey) || isNonEmpty(hostOpenAiKey)) {
    const source = isNonEmpty(configOpenAiKey) ? "adapter config env" : "server environment";
    checks.push({
      code: "codex_openai_api_key_ignored",
      level: "info",
      message: "OPENAI_API_KEY is set, but Codex local ignores it to preserve subscription routing.",
      detail: `Detected in ${source}.`,
      hint: "Remove OPENAI_API_KEY from the Codex runtime if you no longer need legacy OpenAI Platform API flows.",
    });
  }
  if (!targetIsRemote) {
    const codexHome = isNonEmpty(env.CODEX_HOME) ? env.CODEX_HOME : undefined;
    const codexAuth = await readCodexAuthInfo(codexHome).catch(() => null);
    if (codexAuth) {
      checks.push({
        code: "codex_native_auth_present",
        level: "info",
        message: "Codex is authenticated via its own auth configuration.",
        detail: codexAuth.email ? `Logged in as ${codexAuth.email}.` : `Credentials found in ${path.join(codexHome ?? codexHomeDir(), "auth.json")}.`,
      });
    } else {
      checks.push({
        code: "codex_native_auth_missing",
        level: "warn",
        message: "Codex native auth is not configured. Codex runs may fail until `codex login` completes.",
        hint: "Run `codex login` to authenticate with ChatGPT/Codex OAuth, then retry the probe.",
      });
    }
  }

  const canRunProbe =
    checks.every((check) => check.code !== "codex_cwd_invalid" && check.code !== "codex_command_unresolvable");
  if (canRunProbe) {
    if (!commandLooksLike(command, "codex")) {
      checks.push({
        code: "codex_hello_probe_skipped_custom_command",
        level: "info",
        message: "Skipped hello probe because command is not `codex`.",
        detail: command,
        hint: "Use the `codex` CLI command to run the automatic login and installation probe.",
      });
    } else {
      const execArgs = buildCodexExecArgs(
        { ...config, fastMode: false },
        { skipGitRepoCheck: targetIsSandbox },
      );
      const args = execArgs.args;
      if (execArgs.fastModeIgnoredReason) {
        checks.push({
          code: "codex_fast_mode_unsupported_model",
          level: "warn",
          message: execArgs.fastModeIgnoredReason,
          hint: "Switch the agent model to GPT-5.4 or enter a manual model ID to enable Codex Fast mode.",
        });
      }
      if (targetIsSandbox) {
        checks.push({
          code: "codex_git_repo_check_skipped",
          level: "info",
          message: "Added --skip-git-repo-check for sandbox hello probes.",
          hint: "Codex requires an explicit trust bypass in headless remote sandbox workspaces.",
        });
      }

      const preparedProbe = await prepareCodexHelloProbe({
        runId,
        companyId: ctx.companyId,
        target,
        targetIsRemote,
        cwd,
        command,
        args,
        env: stripOpenAiApiKey(env),
        probeApiKey: null,
      });
      try {
        const probe = await runAdapterExecutionTargetProcess(
          runId,
          target,
          preparedProbe.command,
          preparedProbe.args,
          {
            cwd,
            env: preparedProbe.env,
            timeoutSec: 45,
            graceSec: 5,
            stdin: "Respond with hello.",
            onLog: async () => {},
          },
        );
        const parsed = parseCodexJsonl(probe.stdout);
        const detail = summarizeProbeDetail(probe.stdout, probe.stderr, parsed.errorMessage);
        const authEvidence = `${parsed.errorMessage ?? ""}\n${probe.stdout}\n${probe.stderr}`.trim();

        if (probe.timedOut) {
          checks.push({
            code: "codex_hello_probe_timed_out",
            level: "warn",
            message: "Codex hello probe timed out.",
            hint: "Retry the probe. If this persists, verify Codex can run `Respond with hello` from this directory manually.",
          });
        } else if ((probe.exitCode ?? 1) === 0) {
          const summary = parsed.summary.trim();
          const hasHello = /\bhello\b/i.test(summary);
          checks.push({
            code: hasHello ? "codex_hello_probe_passed" : "codex_hello_probe_unexpected_output",
            level: hasHello ? "info" : "warn",
            message: hasHello
              ? "Codex hello probe succeeded."
              : "Codex probe ran but did not return `hello` as expected.",
            ...(summary ? { detail: summary.replace(/\s+/g, " ").trim().slice(0, 240) } : {}),
            ...(hasHello
              ? {}
              : {
                  hint: "Try the probe manually (`codex exec --json -` then prompt: Respond with hello) to inspect full output.",
                }),
          });
        } else if (CODEX_AUTH_REQUIRED_RE.test(authEvidence)) {
          checks.push({
            code: "codex_hello_probe_auth_required",
            level: "warn",
            message: "Codex CLI is installed, but authentication is not ready.",
            ...(detail ? { detail } : {}),
            hint: "Run `codex login` to restore ChatGPT/Codex OAuth, then retry the probe.",
          });
        } else {
          checks.push({
            code: "codex_hello_probe_failed",
            level: "error",
            message: "Codex hello probe failed.",
            ...(detail ? { detail } : {}),
            hint: "Run `codex exec --json -` manually in this working directory and prompt `Respond with hello` to debug.",
          });
        }
      } finally {
        await preparedProbe.cleanup();
      }
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
