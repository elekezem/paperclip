import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "hermes-paperclip-adapter/server";

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
process.stdout.write("hello\\n\\nsession_id: hermes-session-1\\n");
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
  return execute({
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

describe("hermes execute", () => {
  it("omits the model flag when adapterConfig.model is unset", async () => {
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
      expect(capture.argv).not.toContain("-m");
      expect(capture.argv).not.toContain("anthropic/claude-sonnet-4");
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("falls back to runtime.sessionId when sessionParams are missing", async () => {
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
          sessionId: "persisted-session-1",
          sessionParams: null,
          sessionDisplayId: "persisted-session-1",
          taskKey: null,
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.resultJson?.session_id).toBe("hermes-session-1");

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
