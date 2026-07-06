import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { companyWeComService } from "../services/company-wecom.js";

const mockAgentService = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
}));

const mockCompanySkillService = vi.hoisted(() => ({
  listFull: vi.fn(),
}));

vi.mock("../services/agents.js", () => ({
  agentService: () => mockAgentService,
}));

vi.mock("../services/company-skills.js", () => ({
  companySkillService: () => mockCompanySkillService,
}));

function createDb(companyIds: string[]) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        const promise = Promise.resolve(companyIds.map((id) => ({ id })));
        return Object.assign(promise, {
          where: vi.fn(() => Promise.resolve(companyIds.slice(0, 1).map((id) => ({ id })))),
        });
      }),
    })),
  } as any;
}

async function writeFakeCommand(commandPath: string, version: string) {
  await fs.writeFile(
    commandPath,
    `#!/bin/sh\necho "${version}"\n`,
    "utf8",
  );
  await fs.chmod(commandPath, 0o755);
}

describe("companyWeComService", () => {
  const cleanupDirs = new Set<string>();

  beforeEach(() => {
    vi.resetAllMocks();
    mockCompanySkillService.listFull.mockResolvedValue([
      { key: "paperclipai/paperclip/wecomcli-contact" },
      { key: "paperclipai/paperclip/wecomcli-todo" },
      { key: "paperclipai/paperclip/wecomcli-meeting" },
      { key: "paperclipai/paperclip/wecomcli-msg" },
      { key: "paperclipai/paperclip/wecomcli-schedule" },
      { key: "paperclipai/paperclip/wecomcli-doc" },
    ]);
    mockAgentService.list.mockResolvedValue([]);
    mockAgentService.update.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs, (dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("backfills bundled WeCom desired skills onto existing opencode_local agents only", async () => {
    const db = createDb(["company-1", "company-2"]);
    mockAgentService.list.mockImplementation(async (companyId: string) => {
      if (companyId === "company-1") {
        return [
          {
            id: "agent-opencode-1",
            adapterType: "opencode_local",
            adapterConfig: {},
          },
          {
            id: "agent-claude-1",
            adapterType: "claude_local",
            adapterConfig: {},
          },
        ];
      }
      return [
        {
          id: "agent-opencode-2",
          adapterType: "opencode_local",
          adapterConfig: {
            paperclipSkillSync: {
              desiredSkills: ["paperclipai/paperclip/wecomcli-msg"],
            },
          },
        },
      ];
    });

    await companyWeComService(db).backfillAll();

    expect(mockCompanySkillService.listFull).toHaveBeenCalledTimes(2);
    expect(mockAgentService.update).toHaveBeenCalledTimes(2);
    expect(mockAgentService.update).toHaveBeenNthCalledWith(
      1,
      "agent-opencode-1",
      expect.objectContaining({
        adapterConfig: expect.objectContaining({
          paperclipSkillSync: expect.objectContaining({
            desiredSkills: [
              "paperclipai/paperclip/wecomcli-contact",
              "paperclipai/paperclip/wecomcli-todo",
              "paperclipai/paperclip/wecomcli-meeting",
              "paperclipai/paperclip/wecomcli-msg",
              "paperclipai/paperclip/wecomcli-schedule",
              "paperclipai/paperclip/wecomcli-doc",
            ],
          }),
        }),
      }),
      expect.objectContaining({
        recordRevision: expect.objectContaining({
          source: "wecom-bundled-skills-backfill",
        }),
      }),
    );
  });

  it("distinguishes missing commands, uninitialized config, and ready state", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-company-wecom-status-"));
    const binDir = path.join(root, "bin");
    cleanupDirs.add(root);
    await fs.mkdir(binDir, { recursive: true });

    const previousPath = process.env.PATH;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    const previousPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
    process.env.PATH = binDir;
    process.env.PAPERCLIP_HOME = path.join(root, "paperclip-home");
    process.env.PAPERCLIP_INSTANCE_ID = "status-instance";

    try {
      const db = createDb(["company-1"]);
      const service = companyWeComService(db);

      const missingOpenCode = await service.getStatus("company-1");
      expect(missingOpenCode.state).toBe("missing_opencode");

      await writeFakeCommand(path.join(binDir, "opencode"), "opencode 1.0.0");
      const missingWeComCli = await service.getStatus("company-1");
      expect(missingWeComCli.state).toBe("missing_wecom_cli");

      await writeFakeCommand(path.join(binDir, "wecom-cli"), "wecom-cli 1.0.0");
      const notInitialized = await service.getStatus("company-1");
      expect(notInitialized.state).toBe("company_not_initialized");

      await fs.mkdir(notInitialized.config.configDir, { recursive: true });
      await fs.writeFile(path.join(notInitialized.config.configDir, "profile.json"), "{}\n", "utf8");

      const ready = await service.getStatus("company-1");
      expect(ready.state).toBe("ready");
      expect(ready.ready).toBe(true);
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
      else process.env.PAPERCLIP_INSTANCE_ID = previousPaperclipInstanceId;
    }
  });
});
