import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { formatDate } from "../lib/utils";

export function ResearchPrograms() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Programs" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.programs(selectedCompanyId!),
    queryFn: () => researchApi.programs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Search} message="Select a company to view research programs." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const programs = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {programs.length === 0 ? (
        <EmptyState icon={Search} message="No research programs yet." />
      ) : (
        <div className="border border-border divide-y divide-border overflow-hidden">
          {programs.map((program) => (
            <div key={program.id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{program.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {program.domain ?? "general"} · updated {formatDate(program.updatedAt)}
                </p>
                {program.description ? (
                  <p className="mt-2 text-sm text-muted-foreground">{program.description}</p>
                ) : null}
              </div>
              <StatusBadge status={program.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
