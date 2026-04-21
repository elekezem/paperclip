import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTradingMission } from "../services/dashboard.js";

function delayedFetch(delayMs: number, payload: Record<string, unknown>) {
  return vi.fn().mockImplementation((_input: URL | string, init?: RequestInit) => (
    new Promise((resolve, reject) => {
      const signal = init?.signal;
      const timer = setTimeout(() => {
        resolve({
          ok: true,
          json: vi.fn().mockResolvedValue(payload),
        } satisfies Partial<Response> as Response);
      }, delayMs);

      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        const error = new Error("The operation was aborted.");
        error.name = "AbortError";
        reject(error);
      }, { once: true });
    })
  ));
}

describe("fetchTradingMission", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps moderately slow mission-control responses instead of dropping them", async () => {
    const fetchImpl = delayedFetch(40, {
      enabled: true,
      companyName: "OSEKA",
      campaignEpochId: "epoch-1",
      liveCount: 1,
      queueCount: 0,
      activeWorkspaceCount: 0,
      materialActivities: [{ id: "evt-1" }],
      openIssues: [],
      activeRuns: [],
      executionWorkspaces: [],
      researchOutputs: [],
      strategyRevisions: [],
      routineHealth: [],
      campaignSnapshot: {
        effectiveStatus: "active",
        autoTradingStatus: "active",
        currentEquityUsd: 992.33,
        realizedPnlUsd: -11.05,
        unrealizedPnlUsd: 3.38,
        activeCapitalRatioPct: 15.32,
        openPositionCount: 3,
      },
    });

    const mission = await fetchTradingMission("company-1", {
      timeoutMs: 100,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mission).not.toBeNull();
    expect(mission?.companyName).toBe("OSEKA");
    expect(mission?.liveCount).toBe(1);
    expect(mission?.latestTradingActivities).toHaveLength(1);
  });

  it("returns null when the mission-control request exceeds the timeout", async () => {
    const fetchImpl = delayedFetch(50, {
      enabled: true,
      companyName: "OSEKA",
    });

    const mission = await fetchTradingMission("company-1", {
      timeoutMs: 10,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mission).toBeNull();
  });
});
