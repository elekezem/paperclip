import type { IssueLabel } from "@paperclipai/shared";
import { pickTextColorForPillBg } from "@/lib/color-contrast";
import { cn } from "../lib/utils";

interface CompanyLaneChipsProps {
  labels?: IssueLabel[] | null;
  max?: number;
  className?: string;
  chipClassName?: string;
}

export function CompanyLaneChips({
  labels,
  max = 5,
  className,
  chipClassName,
}: CompanyLaneChipsProps) {
  const visibleLabels = (labels ?? []).slice(0, max);
  if (visibleLabels.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visibleLabels.map((label) => (
        <span
          key={label.id}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
            chipClassName,
          )}
          style={{
            borderColor: `${label.color}55`,
            color: pickTextColorForPillBg(label.color, 0.12),
            backgroundColor: `${label.color}18`,
          }}
        >
          {label.name}
        </span>
      ))}
    </div>
  );
}
