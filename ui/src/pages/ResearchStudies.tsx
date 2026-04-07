import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleDot } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/utils";

export function ResearchStudies() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Studies" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.studies(selectedCompanyId!),
    queryFn: () => researchApi.studies(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={CircleDot} message="Select a company to view studies." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const studies = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {studies.length === 0 ? (
        <EmptyState icon={CircleDot} message="No studies yet." />
      ) : (
        <div className="grid gap-3">
          {studies.map((study) => (
            <div key={study.id} className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{study.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {study.id} · updated {formatDate(study.updatedAt)}
                  </p>
                </div>
                <StatusBadge status={study.status} />
              </div>
              {study.hypothesis ? (
                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{study.hypothesis}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>Gate: {study.approvalGate ?? "none"}</span>
                <span>Budget: {study.budgetHours ?? 0}h</span>
                <span>{study.negativeResultEligible ? "Negative results eligible" : "Positive-result only"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
