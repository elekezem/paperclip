import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FAKE_HERMES_SESSION_ID = "20260330_221824_311fec";

type HermesExecute = (input: Record<string, unknown>) => Promise<{
  exitCode: number | null;
  resultJson?: Record<string, unknown> | null;
}>;

async function loadHermesExecute(): Promise<HermesExecute | null> {
  const pluginStoreEntry = path.join(
    os.homedir(),
    ".paperclip",
    "adapter-plugins",
    "node_modules",
    "@henkey",
    "hermes-paperclip-adapter",
    "dist",
    "server",
    "index.js",
  );
  try {
    await fs.access(pluginStoreEntry);
    const mod = await import(pathToFileURL(pluginStoreEntry).href) as { execute?: HermesExecute };
    return typeof mod.execute === "function" ? mod.execute : null;
  } catch {
    return null;
  }
}

const hermesExecute = await loadHermesExecute();

async function writeFakeHermesCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
process.stdout.write("hello\\n\\nsession_id: ${FAKE_HERMES_SESSION_ID}\\n");
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
};

async function runHermesExecute(args: {
  commandPath: string;
  workspace: string;
  capturePath: string;
  runtime: {
    sessionId: string | null;
    sessionParams: Record<string, unknown> | null;
    sessionDisplayId: string | null;
    taskKey: string | null;
  };
}) {
  return hermesExecute!({
    runId: "run-1",
    agent: {
      id: "agent-1",
      companyId: "company-1",
      name: "Hermes Worker",
      adapterType: "hermes_local",
      adapterConfig: {
        hermesCommand: args.commandPath,
        cwd: args.workspace,
        env: {
          PAPERCLIP_TEST_CAPTURE_PATH: args.capturePath,
        },
        promptTemplate: "Follow the paperclip heartbeat.",
      },
    },
    runtime: args.runtime,
    config: {},
    context: {},
    authToken: "run-jwt-token",
    onLog: async () => {},
  });
}

describe.runIf(hermesExecute)("hermes execute", () => {
  it("passes the external adapter default model when adapterConfig.model is unset", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-hermes-default-model-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "hermes");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeHermesCommand(commandPath);

    try {
      const result = await runHermesExecute({
        commandPath,
        workspace,
        capturePath,
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
      });

      expect(result.exitCode).toBe(0);

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.argv).toContain("-m");
      expect(capture.argv).toContain("anthropic/claude-sonnet-4");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("resumes from structured runtime.sessionParams", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-hermes-runtime-session-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "hermes");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeHermesCommand(commandPath);

    try {
      const result = await runHermesExecute({
        commandPath,
        workspace,
        capturePath,
        runtime: {
          sessionId: null,
          sessionParams: {
            sessionId: "persisted-session-1",
          },
          sessionDisplayId: "persisted-session-1",
          taskKey: null,
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.resultJson?.session_id).toBe(FAKE_HERMES_SESSION_ID);

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.argv).toContain("--resume");
      expect(capture.argv).toContain("persisted-session-1");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("prefers sessionParams.sessionId over the legacy runtime.sessionId", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-hermes-session-params-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "hermes");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeHermesCommand(commandPath);

    try {
      const result = await runHermesExecute({
        commandPath,
        workspace,
        capturePath,
        runtime: {
          sessionId: "legacy-session-1",
          sessionParams: {
            sessionId: "structured-session-1",
          },
          sessionDisplayId: "structured-session-1",
          taskKey: null,
        },
      });

      expect(result.exitCode).toBe(0);

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      const resumeFlagIndex = capture.argv.indexOf("--resume");
      expect(resumeFlagIndex).toBeGreaterThanOrEqual(0);
      expect(capture.argv[resumeFlagIndex + 1]).toBe("structured-session-1");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
