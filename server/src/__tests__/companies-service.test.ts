import { describe, expect, it, vi } from "vitest";
import { companyService } from "../services/companies.ts";

function createSelectChain(result: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    then: vi.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(result))),
  };
  return chain;
}

describe("companyService", () => {
  it("unwraps Drizzle duplicate issue-prefix errors when auto-allocating a prefix", async () => {
    const created = {
      id: "company-1",
      name: "AKESO REsearch",
      description: null,
      status: "active",
      issuePrefix: "AKEA",
      issueCounter: 1,
      budgetMonthlyCents: 0,
      spentMonthlyCents: 0,
      requireBoardApprovalForNewAgents: false,
      feedbackDataSharingEnabled: false,
      feedbackDataSharingConsentAt: null,
      feedbackDataSharingConsentByUserId: null,
      feedbackDataSharingTermsVersion: null,
      brandColor: null,
      logoAssetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const duplicateCause = Object.assign(new Error("duplicate key value violates unique constraint \"companies_issue_prefix_idx\""), {
      code: "23505",
      constraint_name: "companies_issue_prefix_idx",
    });
    const wrappedDuplicate = Object.assign(new Error("Failed query"), { cause: duplicateCause });
    const insertReturning = vi.fn()
      .mockRejectedValueOnce(wrappedDuplicate)
      .mockResolvedValueOnce([created]);
    const values = vi.fn(() => ({ returning: insertReturning }));
    const db = {
      insert: vi.fn(() => ({ values })),
      select: vi.fn()
        .mockReturnValueOnce(createSelectChain([created]))
        .mockReturnValueOnce(createSelectChain([])),
    };

    const result = await companyService(db as any).create({ name: "AKESO REsearch" } as any);

    expect(result.issuePrefix).toBe("AKEA");
    expect(values).toHaveBeenNthCalledWith(1, expect.objectContaining({ issuePrefix: "AKE" }));
    expect(values).toHaveBeenNthCalledWith(2, expect.objectContaining({ issuePrefix: "AKEA" }));
  });
});
