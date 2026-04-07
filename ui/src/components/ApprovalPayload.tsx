import { UserPlus, Lightbulb, ShieldAlert, ShieldCheck, Send, Telescope, Cpu, FileText } from "lucide-react";
import { useI18n } from "../context/LocaleContext";
import { formatCents } from "../lib/utils";

const fallbackTypeLabels: Record<string, string> = {
  hire_agent: "Hire Agent",
  approve_ceo_strategy: "CEO Strategy",
  budget_override_required: "Budget Override",
  content_publish_release: "Content Publish Release",
  proposal_review: "Proposal Review",
  survey_review: "Survey Review",
  study_launch: "Study Launch",
  compute_budget_raise: "Compute Budget Raise",
  paper_release: "Paper Release",
};

/** Build a contextual label for an approval, e.g. "Hire Agent: Designer" */
export function approvalLabel(type: string, payload?: Record<string, unknown> | null): string {
  const base = fallbackTypeLabels[type] ?? type;
  if (type === "hire_agent" && payload?.name) {
    return `${base}: ${String(payload.name)}`;
  }
  if (type === "content_publish_release" && payload?.accountLabel) {
    return `${base}: ${String(payload.accountLabel)}`;
  }
  if (type === "study_launch" && payload?.studyTitle) {
    return `${base}: ${String(payload.studyTitle)}`;
  }
  if (type === "proposal_review" && payload?.studyTitle) {
    return `${base}: ${String(payload.studyTitle)}`;
  }
  if (type === "survey_review" && payload?.studyTitle) {
    return `${base}: ${String(payload.studyTitle)}`;
  }
  if (type === "paper_release" && payload?.paperTitle) {
    return `${base}: ${String(payload.paperTitle)}`;
  }
  return base;
}

export const typeIcon: Record<string, typeof UserPlus> = {
  hire_agent: UserPlus,
  approve_ceo_strategy: Lightbulb,
  budget_override_required: ShieldAlert,
  content_publish_release: Send,
  proposal_review: Lightbulb,
  survey_review: Telescope,
  study_launch: Telescope,
  compute_budget_raise: Cpu,
  paper_release: FileText,
};

export const defaultTypeIcon = ShieldCheck;

function PayloadField({ label, value }: { label: string; value: unknown }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">{label}</span>
      <span>{String(value)}</span>
    </div>
  );
}

function SkillList({ values }: { values: unknown }) {
  if (!Array.isArray(values)) return null;
  const items = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Skills</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span
            key={item}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HireAgentPayload({ payload }: { payload: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Name</span>
        <span className="font-medium">{String(payload.name ?? "—")}</span>
      </div>
      <PayloadField label="Role" value={payload.role} />
      <PayloadField label="Title" value={payload.title} />
      <PayloadField label="Icon" value={payload.icon} />
      {!!payload.capabilities && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">Capabilities</span>
          <span className="text-muted-foreground">{String(payload.capabilities)}</span>
        </div>
      )}
      {!!payload.adapterType && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs">Adapter</span>
          <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
            {String(payload.adapterType)}
          </span>
        </div>
      )}
      <SkillList values={payload.desiredSkills} />
    </div>
  );
}

export function CeoStrategyPayload({ payload }: { payload: Record<string, unknown> }) {
  const plan = payload.plan ?? payload.description ?? payload.strategy ?? payload.text;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Title" value={payload.title} />
      {!!plan && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
          {String(plan)}
        </div>
      )}
      {!plan && (
        <pre className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground overflow-x-auto max-h-48">
          {JSON.stringify(payload, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function BudgetOverridePayload({ payload }: { payload: Record<string, unknown> }) {
  const budgetAmount = typeof payload.budgetAmount === "number" ? payload.budgetAmount : null;
  const observedAmount = typeof payload.observedAmount === "number" ? payload.observedAmount : null;
  return (
    <div className="mt-3 space-y-1.5 text-sm">
      <PayloadField label="Scope" value={payload.scopeName ?? payload.scopeType} />
      <PayloadField label="Window" value={payload.windowKind} />
      <PayloadField label="Metric" value={payload.metric} />
      {(budgetAmount !== null || observedAmount !== null) ? (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Limit {budgetAmount !== null ? formatCents(budgetAmount) : "—"} · Observed {observedAmount !== null ? formatCents(observedAmount) : "—"}
        </div>
      ) : null}
      {!!payload.guidance && (
        <p className="text-muted-foreground">{String(payload.guidance)}</p>
      )}
    </div>
  );
}

export function ContentPublishReleasePayload({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useI18n();
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const proofRequirements = Array.isArray(payload.proofRequirements)
    ? payload.proofRequirements.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return (
    <div className="mt-3 space-y-2 text-sm">
      <PayloadField label={t("approvalPayload.content.channel")} value={payload.channel} />
      <PayloadField label={t("approvalPayload.content.account")} value={payload.accountLabel} />
      <PayloadField label={t("approvalPayload.content.window")} value={payload.targetPublishWindow} />
      <PayloadField label={t("approvalPayload.content.issue")} value={payload.issueId} />
      <PayloadField label={t("approvalPayload.content.archivePath")} value={payload.archivePath} />
      {!!payload.assetSummary && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-20 sm:w-24 shrink-0 text-xs pt-0.5">{t("approvalPayload.content.assets")}</span>
          <span className="text-muted-foreground whitespace-pre-wrap">{String(payload.assetSummary)}</span>
        </div>
      )}
      {!!payload.draftBodyPreview && (
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">{t("approvalPayload.content.preview")}</span>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
            {String(payload.draftBodyPreview)}
          </div>
        </div>
      )}
      {checklist.length > 0 ? (
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">{t("approvalPayload.content.checklist")}</span>
          <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {checklist.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {proofRequirements.length > 0 ? (
        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">{t("approvalPayload.content.proof")}</span>
          <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {proofRequirements.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ResearchApprovalPayload({
  payload,
  primaryLabel,
  primaryValue,
}: {
  payload: Record<string, unknown>;
  primaryLabel: string;
  primaryValue: unknown;
}) {
  const checklist = Array.isArray(payload.checklist)
    ? payload.checklist.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];

  return (
    <div className="mt-3 space-y-2 text-sm">
      <PayloadField label={primaryLabel} value={primaryValue} />
      <PayloadField label="Program" value={payload.programName} />
      <PayloadField label="Study" value={payload.studyId} />
      <PayloadField label="Run" value={payload.runId} />
      <PayloadField label="Scope" value={payload.scopeName ?? payload.scopeType} />
      <PayloadField label="Budget" value={payload.budgetWindow ?? payload.requestedBudgetHours} />
      <PayloadField label="Artifact" value={payload.artifactBundleId ?? payload.artifactPath} />
      {!!payload.summary && (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap">
          {String(payload.summary)}
        </div>
      )}
      {checklist.length > 0 ? (
        <ul className="space-y-1 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {checklist.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ApprovalPayloadRenderer({ type, payload }: { type: string; payload: Record<string, unknown> }) {
  if (type === "hire_agent") return <HireAgentPayload payload={payload} />;
  if (type === "budget_override_required") return <BudgetOverridePayload payload={payload} />;
  if (type === "content_publish_release") return <ContentPublishReleasePayload payload={payload} />;
  if (type === "proposal_review") {
    return <ResearchApprovalPayload payload={payload} primaryLabel="Proposal" primaryValue={payload.studyTitle ?? payload.studyId} />;
  }
  if (type === "survey_review") {
    return <ResearchApprovalPayload payload={payload} primaryLabel="Survey" primaryValue={payload.studyTitle ?? payload.studyId} />;
  }
  if (type === "study_launch") {
    return <ResearchApprovalPayload payload={payload} primaryLabel="Study" primaryValue={payload.studyTitle ?? payload.studyId} />;
  }
  if (type === "compute_budget_raise") {
    return <ResearchApprovalPayload payload={payload} primaryLabel="Budget" primaryValue={payload.requestedBudgetHours ?? payload.budgetWindow} />;
  }
  if (type === "paper_release") {
    return <ResearchApprovalPayload payload={payload} primaryLabel="Paper" primaryValue={payload.paperTitle ?? payload.studyTitle} />;
  }
  return <CeoStrategyPayload payload={payload} />;
}
