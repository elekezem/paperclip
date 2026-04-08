import { describe, expect, it, vi } from "vitest";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import { createPluginToolDispatcher } from "../services/plugin-tool-dispatcher.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";

const manifest: PaperclipPluginManifestV1 = {
  id: "akeso.knowbase",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "AKESO KNOWBASE",
  description: "KNOWBASE test manifest",
  author: "AKESO",
  categories: ["automation"],
  capabilities: ["agent.tools.register"],
  tools: [
    {
      name: "search",
      displayName: "Search",
      description: "Search KNOWBASE",
      parametersSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
};

describe("plugin-tool-dispatcher", () => {
  it("routes tool execution through the plugin database id when provided", async () => {
    const call = vi.fn(async () => ({
      content: "ok",
      data: { ok: true },
    }));
    const isRunning = vi.fn((pluginId: string) => pluginId === "plugin-db-id");

    const workerManager = {
      startWorker: vi.fn(),
      stopWorker: vi.fn(),
      getWorker: vi.fn(),
      isRunning,
      stopAll: vi.fn(),
      diagnostics: vi.fn(() => []),
      call,
    } as unknown as PluginWorkerManager;

    const dispatcher = createPluginToolDispatcher({ workerManager });
    await dispatcher.initialize();
    dispatcher.registerPluginTools("akeso.knowbase", manifest, "plugin-db-id");

    const tools = dispatcher.listToolsForAgent();
    expect(tools).toEqual([
      expect.objectContaining({
        name: "akeso.knowbase:search",
        pluginId: "akeso.knowbase",
      }),
    ]);

    const result = await dispatcher.executeTool(
      "akeso.knowbase:search",
      { query: "paraxial lca" },
      {
        agentId: "agent-1",
        runId: "run-1",
        companyId: "company-1",
        projectId: "project-1",
      },
    );

    expect(isRunning).toHaveBeenCalledWith("plugin-db-id");
    expect(call).toHaveBeenCalledWith(
      "plugin-db-id",
      "executeTool",
      expect.objectContaining({
        toolName: "search",
        parameters: { query: "paraxial lca" },
        runContext: {
          agentId: "agent-1",
          runId: "run-1",
          companyId: "company-1",
          projectId: "project-1",
        },
      }),
    );
    expect(result).toEqual({
      pluginId: "akeso.knowbase",
      toolName: "search",
      result: {
        content: "ok",
        data: { ok: true },
      },
    });
  });
});
