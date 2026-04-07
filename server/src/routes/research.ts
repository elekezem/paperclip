import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";

const kernelBaseUrl =
  process.env.PAPERCLIP_RESEARCH_KERNEL_URL
  ?? process.env.RESEARCH_KERNEL_URL
  ?? "http://127.0.0.1:3210";

async function proxyKernel(pathname: string, init?: RequestInit) {
  const response = await fetch(new URL(pathname, kernelBaseUrl), {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(errorText || `Research Kernel request failed: ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function unwrapItems<T>(payload: T[] | { items?: T[] } | null | undefined): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.items)) {
    return payload.items;
  }
  return [];
}

function readFallback(companyId: string, kind: "programs" | "studies" | "runs" | "artifacts" | "learning" | "golden-studies" | "reference-blueprints" | "mission-control" | "governance") {
  if (kind === "mission-control") {
    return {
      enabled: false,
      companyId,
      companyName: null,
      domainFocus: [],
      governance: {
        constitutionVersion: "n/a",
        roleAdapterCount: 0,
        verifierCount: 0,
      },
      staging: {
        goldenStudyCount: 0,
        instantiatedGoldenStudies: 0,
      },
      programs: { total: 0, active: 0, paused: 0, archived: 0 },
      studies: { total: 0, running: 0, blocked: 0, reviewing: 0, readyToArchive: 0 },
      compute: { activeRuns: 0, queuedRuns: 0, failedRuns: 0, budgetHours: 0, consumedHours: 0 },
      artifacts: { total: 0, released: 0, scaffolded: 0 },
      learning: { total: 0, reusablePatterns: 0, recentFailures: 0 },
      highlights: [],
      recentFailures: [],
    };
  }
  if (kind === "governance") {
    return null;
  }
  return [];
}

export function researchRoutes(_db: Db) {
  const router = Router();

  router.get("/research/companies/:companyId/mission-control", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    try {
      res.json(await proxyKernel(`/api/companies/${companyId}/mission-control`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        res.json(readFallback(companyId, "mission-control"));
        return;
      }
      throw error;
    }
  });

  router.get("/research/companies/:companyId/governance", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    try {
      res.json(await proxyKernel(`/api/companies/${companyId}/governance`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        res.json(readFallback(companyId, "governance"));
        return;
      }
      throw error;
    }
  });

  for (const route of ["programs", "studies", "runs", "artifacts", "learning", "golden-studies", "reference-blueprints"] as const) {
    router.get(`/research/companies/:companyId/${route}`, async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      try {
        const payload = await proxyKernel(`/api/companies/${companyId}/${route}`);
        res.json(unwrapItems(payload as { items?: unknown[] } | unknown[]));
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          res.json(readFallback(companyId, route));
          return;
        }
        throw error;
      }
    });
  }

  router.post("/research/companies/:companyId/studies", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await proxyKernel(`/api/companies/${companyId}/studies`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    }));
  });

  router.post("/research/companies/:companyId/idea-intake", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await proxyKernel(`/api/companies/${companyId}/idea-intake`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    }));
  });

  router.post("/research/companies/:companyId/golden-studies/:goldenStudyId/instantiate", async (req, res) => {
    const companyId = req.params.companyId as string;
    const goldenStudyId = req.params.goldenStudyId as string;
    assertCompanyAccess(req, companyId);
    const payload = await proxyKernel(`/api/companies/${companyId}/golden-studies/${goldenStudyId}/instantiate`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    }) as { study?: unknown };
    res.json(payload);
  });

  for (const action of ["launch", "start", "pause", "resume"] as const) {
    router.post("/research/companies/:companyId/studies/:studyId/" + action, async (req, res) => {
      const companyId = req.params.companyId as string;
      const studyId = req.params.studyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await proxyKernel(`/api/companies/${companyId}/studies/${studyId}/${action}`, {
        method: "POST",
        body: JSON.stringify(req.body ?? {}),
      }));
    });
  }

  return router;
}
