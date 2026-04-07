import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";

export function ResearchGovernance() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Governance" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.governance(selectedCompanyId!),
    queryFn: () => researchApi.governance(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={ShieldCheck} message="Select a company to view governance." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  if (!data) {
    return <EmptyState icon={ShieldCheck} message="No governance bundle seeded yet." />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      <div className="rounded-xl border border-border px-4 py-4">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Constitution</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="text-base font-semibold">{data.constitution.title}</p>
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
            {data.constitution.version}
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {data.companyProfile.mission}
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Principles</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {data.constitution.principles.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Hard boundaries</p>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              {data.constitution.hardBoundaries.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Control plane: {data.companyProfile.controlPlane}</span>
          <span>Execution plane: {data.companyProfile.executionPlane}</span>
          <span>Updated {formatDate(data.updatedAt)}</span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Injection order: {data.constitution.injectionOrder.join(" -> ")}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Role adapters</p>
          <div className="mt-3 space-y-3">
            {data.roleAdapters.map((adapter) => (
              <div key={adapter.id} className="rounded-lg border border-border/70 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{adapter.target}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{adapter.summary}</p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {adapter.id}
                  </span>
                </div>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Responsibilities</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {adapter.responsibilities.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Verifier refs</p>
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {adapter.verifierIds.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border px-4 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Verifier pack</p>
          <div className="mt-3 space-y-3">
            {data.verifierPack.map((verifier) => (
              <div key={verifier.id} className="rounded-lg border border-border/70 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{verifier.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{verifier.summary}</p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                    {verifier.scope}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>ID: {verifier.id}</span>
                  <span>{verifier.blocking ? "blocking" : "non-blocking"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
