import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { researchApi } from "../api/research";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { StatusBadge } from "../components/StatusBadge";
import { Button } from "@/components/ui/button";

export function ResearchGoldenStudies() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([{ label: "Golden Studies" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.research.goldenStudies(selectedCompanyId!),
    queryFn: () => researchApi.goldenStudies(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: programs } = useQuery({
    queryKey: queryKeys.research.programs(selectedCompanyId!),
    queryFn: () => researchApi.programs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const instantiateMutation = useMutation({
    mutationFn: async (goldenStudyId: string) => {
      return researchApi.instantiateGoldenStudy(selectedCompanyId!, goldenStudyId, {
        programId: programs?.[0]?.id,
      });
    },
    onSuccess: (study) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.research.goldenStudies(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.research.studies(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.research.learning(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.research.missionControl(selectedCompanyId!) });
      pushToast({
        title: "Study shell created",
        body: `Instantiated ${study.title}.`,
        tone: "success",
      });
    },
    onError: (mutationError) => {
      pushToast({
        title: "Failed to instantiate Golden Study",
        body: mutationError instanceof Error ? mutationError.message : "Unknown error",
        tone: "error",
      });
    },
  });

  if (!selectedCompanyId) {
    return <EmptyState icon={FlaskConical} message="Select a company to view Golden Studies." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const goldenStudies = data ?? [];

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}
      {goldenStudies.length === 0 ? (
        <EmptyState icon={FlaskConical} message="No Golden Studies seeded yet." />
      ) : (
        <div className="grid gap-3">
          {goldenStudies.map((study) => {
            const pending = instantiateMutation.isPending && instantiateMutation.variables === study.id;
            return (
              <div key={study.id} className="rounded-xl border border-border px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{study.title}</p>
                      <StatusBadge status={study.status} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {study.domain} · {study.id}
                    </p>
                    {study.briefSummary ? (
                      <p className="mt-2 text-sm text-muted-foreground">{study.briefSummary}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => instantiateMutation.mutate(study.id)}
                  >
                    {pending ? "Creating..." : "Create study shell"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Success criteria</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {study.successCriteria ?? "No success criteria written yet."}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Package root</p>
                    <p className="mt-2 break-all text-sm text-muted-foreground">{study.packageRoot}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                  <span>brief: {study.briefPath}</span>
                  <span>hypothesis: {study.approvedHypothesisPath}</span>
                  <span>literature: {study.literatureSetPath}</span>
                  <span>datasets: {study.datasetsPath}</span>
                  <span>baseline: {study.baselinePath}</span>
                  <span>evaluation: {study.evaluationContractPath}</span>
                  <span>artifacts: {study.expectedArtifactsPath}</span>
                  <span>gates: {study.gateRulesPath}</span>
                  <span>budget: {study.computeBudgetPath}</span>
                  <span>stop conditions: {study.stopConditionsPath}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Instantiated {study.instantiateCount} time(s)</span>
                  <span>Last study: {study.lastInstantiatedStudyId ?? "none"}</span>
                  <span>{study.seededExample ? "seeded example" : "custom package"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
