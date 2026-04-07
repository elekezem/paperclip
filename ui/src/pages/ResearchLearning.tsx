import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";

export function ResearchLearning() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Learning" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.learning(selectedCompanyId!),
    queryFn: () => researchApi.learning(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={Brain} message="Select a company to view learning records." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const records = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {records.length === 0 ? (
        <EmptyState icon={Brain} message="No learning records yet." />
      ) : (
        <div className="grid gap-3">
          {records.map((record) => (
            <div key={record.id} className="rounded-xl border border-border px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{record.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {record.signal} · {record.reusable ? "reusable" : "contextual"} · updated {formatDate(record.updatedAt)}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {record.studyId ?? "global"}
                </span>
              </div>
              {record.summary ? (
                <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{record.summary}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
