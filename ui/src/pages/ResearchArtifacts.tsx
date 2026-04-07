import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";

export function ResearchArtifacts() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Artifacts" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.artifacts(selectedCompanyId!),
    queryFn: () => researchApi.artifacts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Boxes} message="Select a company to view research artifacts." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const artifacts = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {artifacts.length === 0 ? (
        <EmptyState icon={Boxes} message="No artifact bundles yet." />
      ) : (
        <div className="grid gap-3">
          {artifacts.map((artifact) => (
            <div key={artifact.id} className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{artifact.studyId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{artifact.bundleRoot}</p>
                </div>
                <StatusBadge status={artifact.status} />
              </div>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span>paper: {artifact.paperPath}</span>
                <span>code: {artifact.codePath}</span>
                <span>runs: {artifact.runsPath}</span>
                <span>analysis: {artifact.analysisPath}</span>
                <span>figures: {artifact.figuresPath}</span>
                <span>reviews: {artifact.reviewsPath}</span>
                <span>lineage: {artifact.lineagePath}</span>
                <span>receipt: {artifact.receiptPath}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
