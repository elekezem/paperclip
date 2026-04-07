import { cn } from "../lib/utils";
import { useI18n } from "../context/LocaleContext";
import { statusBadge, statusBadgeDefault } from "../lib/status-colors";

export function StatusBadge({ status }: { status: string }) {
  const { formatStatus } = useI18n();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap shrink-0",
        statusBadge[status] ?? statusBadgeDefault
      )}
    >
      {formatStatus(status)}
    </span>
  );
}
