import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertCompanyAccess } from "./authz.js";

const kernelBaseUrl =
  process.env.PAPERCLIP_TRADING_KERNEL_URL
  ?? process.env.TRADING_KERNEL_URL
  ?? "http://127.0.0.1:3231";

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
    const error = new Error(errorText || `Trading Kernel request failed: ${response.status}`);
    Object.assign(error, { status: response.status });
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function readFallback(companyId: string, kind: "mission-control" | "dashboard" | "demo-status") {
  if (kind === "mission-control") {
    return {
      enabled: false,
      companyId,
      companyName: null,
      executionMode: "shadow_only",
      connectors: [],
      stats: {
        marketPulses: 0,
        candidates: 0,
        opportunities: 0,
        shadowOrders: 0,
        demoOrders: 0,
        notes: 0,
        revisions: 0,
        briefs: 0,
      },
      demo: {
        readiness: "not_configured",
        executionMode: "shadow_only",
        configured: false,
        account: null,
        error: "Trading Kernel not available",
      },
    };
  }
  if (kind === "dashboard") {
    return {
      generatedAt: new Date().toISOString(),
      companyId,
      companyName: null,
      refreshSeconds: 60,
      executionMode: "shadow_only",
      demo: {
        readiness: "not_configured",
        executionMode: "shadow_only",
        configured: false,
        account: null,
        error: "Trading Kernel not available",
      },
      orderSummary: { shadow: 0, demo: 0, live: 0 },
      panels: {
        marketScan: { title: "Market Scan", items: [] },
        candidatePool: { title: "Candidate Pool", items: [] },
        opportunityBoard: { title: "Opportunity Board", items: [] },
        sourceGraph: { title: "Source Graph", items: [] },
        knowledgeBase: { title: "Knowledge Base", notes: [], revisions: [], founderBriefs: [] },
      },
      connectors: [],
    };
  }
  return {
    readiness: "not_configured",
    executionMode: "shadow_only",
    configured: false,
    account: null,
    error: "Trading Kernel not available",
  };
}

export function tradingRoutes(_db: Db) {
  const router = Router();

  router.get("/trading/companies/:companyId/mission-control", async (req, res) => {
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

  router.get("/trading/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    try {
      res.json(await proxyKernel(`/api/companies/${companyId}/dashboard`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        res.json(readFallback(companyId, "dashboard"));
        return;
      }
      throw error;
    }
  });

  for (const route of ["opportunities", "orders", "knowledge", "revisions", "source-graph", "connectors", "candidates", "market-scan", "briefs", "governance"] as const) {
    router.get(`/trading/companies/:companyId/${route}`, async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      res.json(await proxyKernel(`/api/companies/${companyId}/${route}`));
    });
  }

  router.get("/trading/companies/:companyId/demo/status", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    try {
      res.json(await proxyKernel(`/api/companies/${companyId}/demo/status`));
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        res.json(readFallback(companyId, "demo-status"));
        return;
      }
      throw error;
    }
  });

  router.post("/trading/companies/:companyId/demo/orders", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    res.json(await proxyKernel(`/api/companies/${companyId}/demo/orders`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    }));
  });

  router.get("/trading/companies/:companyId/demo/orders/:orderId", async (req, res) => {
    const companyId = req.params.companyId as string;
    const orderId = req.params.orderId as string;
    assertCompanyAccess(req, companyId);
    res.json(await proxyKernel(`/api/companies/${companyId}/demo/orders/${orderId}`));
  });

  router.post("/trading/companies/:companyId/demo/orders/:orderId/cancel", async (req, res) => {
    const companyId = req.params.companyId as string;
    const orderId = req.params.orderId as string;
    assertCompanyAccess(req, companyId);
    res.json(await proxyKernel(`/api/companies/${companyId}/demo/orders/${orderId}/cancel`, {
      method: "POST",
      body: JSON.stringify(req.body ?? {}),
    }));
  });

  return router;
}
