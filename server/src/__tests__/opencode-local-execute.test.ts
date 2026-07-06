import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-opencode-local/server";

async function writeFakeOpenCodeCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const args = process.argv.slice(2);
if (args[0] === "models") {
  console.log("openai/gpt-5.2-codex");
  process.exit(0);
}

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv: args,
  prompt: fs.readFileSync(0, "utf8"),
  wecomCliConfigDir: process.env.WECOM_CLI_CONFIG_DIR || null,
  wecomCliTmpDir: process.env.WECOM_CLI_TMP_DIR || null,
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({
  type: "text",
  sessionID: "opencode-session-1",
  part: { text: "hello" },
}));
console.log(JSON.stringify({
  type: "step_finish",
  sessionID: "opencode-session-1",
  part: {
    reason: "done",
    cost: 0.001,
    tokens: {
      input: 1,
      output: 1,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  },
}));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  wecomCliConfigDir: string | null;
  wecomCliTmpDir: string | null;
};

describe("opencode execute", () => {
  it("injects company-scoped WeCom CLI directories into the runtime env", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-execute-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "opencode");
    const capturePath = path.join(root, "capture.json");
    const paperclipHome = path.join(root, "paperclip-home");
    await fs.mkdir(workspace, { recursive: true });
    await writeFakeOpenCodeCommand(commandPath);

    const expectedConfigDir = path.join(
      paperclipHome,
      "instances",
      "test-instance",
      "wecom",
      "company-1",
      "config",
    );
    const expectedTmpDir = path.join(
      paperclipHome,
      "instances",
      "test-instance",
      "wecom",
      "company-1",
      "tmp",
    );

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    const previousPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;
    process.env.PAPERCLIP_INSTANCE_ID = "test-instance";

    try {
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "OpenCode Agent",
          adapterType: "opencode_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          model: "openai/gpt-5.2-codex",
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
        onMeta: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.argv).toContain("run");
      expect(capture.wecomCliConfigDir).toBe(expectedConfigDir);
      expect(capture.wecomCliTmpDir).toBe(expectedTmpDir);
      expect((await fs.stat(expectedConfigDir)).isDirectory()).toBe(true);
      expect((await fs.stat(expectedTmpDir)).isDirectory()).toBe(true);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
      else process.env.PAPERCLIP_INSTANCE_ID = previousPaperclipInstanceId;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
