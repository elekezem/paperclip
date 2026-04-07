import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/utils";

export function ResearchRuns() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Runs" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.runs(selectedCompanyId!),
    queryFn: () => researchApi.runs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={GitBranch} message="Select a company to view research runs." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const runs = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {runs.length === 0 ? (
        <EmptyState icon={GitBranch} message="No research runs yet." />
      ) : (
        <div className="border border-border divide-y divide-border overflow-hidden">
          {runs.map((run) => (
            <div key={run.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{run.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {run.studyId} · branch {run.branchKey ?? "main"} · updated {formatDate(run.updatedAt)}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Verifier: {run.verifierState ?? "pending"} · started {run.startedAt ? formatDate(run.startedAt) : "not started"}
                </p>
              </div>
              <StatusBadge status={run.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
