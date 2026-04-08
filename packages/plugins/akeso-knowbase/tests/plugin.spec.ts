import { describe, expect, it, vi } from "vitest";
import { createTestHarness, type Company } from "@paperclipai/plugin-sdk";
import manifest from "../src/manifest.js";
import { createKnowbasePlugin } from "../src/worker.js";
import type { KnowbaseRuntime } from "../src/runtime.js";

describe("AKESO KNOWBASE plugin", () => {
  it("resolves the active company name and runs search through the runtime", async () => {
    const runtime = {
      search: vi.fn(async () => [{ record_type: "document", ref: "doc-1", title: "Paraxial LCA" }]),
      packContext: vi.fn(),
      createBrief: vi.fn(),
      compileIssueContext: vi.fn(),
      runHealthCheck: vi.fn(),
      promoteToPublicCanon: vi.fn(),
    } satisfies KnowbaseRuntime;
    const plugin = createKnowbasePlugin(runtime);
    const harness = createTestHarness({ manifest });
    const company: Company = {
      id: "cmp_research",
      name: "AKESO REsearch",
      urlKey: "akeso-research",
      description: "Research company",
      status: "active",
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      pauseReason: null,
      pausedAt: null,
      requireBoardApprovalForNewAgents: false,
      brandColor: null,
      logoAssetId: null,
      feedbackDataSharingEnabled: false,
      feedbackDataSharingConsentAt: null,
      feedbackDataSharingConsentByUserId: null,
      feedbackDataSharingTermsVersion: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    harness.seed({ companies: [company] });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("search", { query: "paraxial lca", limit: 3 }, {
      companyId: company.id,
      projectId: "proj_1",
      agentId: "agt_1",
      runId: "run_1",
    });

    expect(runtime.search).toHaveBeenCalledWith(
      expect.objectContaining({ knowbaseRepoPath: expect.any(String) }),
      expect.objectContaining({
        query: "paraxial lca",
        company: "AKESO REsearch",
        limit: 3,
        privateOnly: false,
      }),
    );
    expect(result.content).toContain("Paraxial LCA");
  });

  it("returns markdown content for create_brief and uses explicit company overrides", async () => {
    const runtime = {
      search: vi.fn(),
      packContext: vi.fn(),
      createBrief: vi.fn(async () => ({
        outputPath: "/tmp/brief.md",
        markdown: "# Brief\n\nHello.",
      })),
      compileIssueContext: vi.fn(),
      runHealthCheck: vi.fn(),
      promoteToPublicCanon: vi.fn(),
    } satisfies KnowbaseRuntime;
    const plugin = createKnowbasePlugin(runtime);
    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const result = await harness.executeTool("create_brief", {
      question: "What changed?",
      company: "AKESO ntnb",
    }, {
      companyId: "cmp_ntnb",
      projectId: "proj_1",
      agentId: "agt_1",
      runId: "run_1",
    });

    expect(runtime.createBrief).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        question: "What changed?",
        company: "AKESO ntnb",
      }),
    );
    expect(result.content).toContain("# Brief");
    expect(result.data).toEqual({ company: "AKESO ntnb", outputPath: "/tmp/brief.md" });
  });

  it("validates config and reports missing paths", async () => {
    const plugin = createKnowbasePlugin({
      search: vi.fn(),
      packContext: vi.fn(),
      createBrief: vi.fn(),
      compileIssueContext: vi.fn(),
      runHealthCheck: vi.fn(),
      promoteToPublicCanon: vi.fn(),
    } satisfies KnowbaseRuntime);
    const result = await plugin.definition.onValidateConfig?.({
      knowbaseRepoPath: "/definitely/missing/repo",
      knowbaseProjectRoot: "/definitely/missing/project",
      uvCommand: "",
      publicCompanyName: "",
    });

    expect(result?.ok).toBe(false);
    expect(result?.errors.join("\n")).toContain("knowbaseRepoPath does not exist");
    expect(result?.errors.join("\n")).toContain("uvCommand must not be empty");
  });
});
