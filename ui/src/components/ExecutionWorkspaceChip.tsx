import type { MouseEventHandler, ReactNode } from "react";
import type { ExecutionWorkspace } from "@paperclipai/shared";
import { FolderTree, GitBranch, Boxes } from "lucide-react";
import { cn } from "../lib/utils";

function summarizeWorkspace(workspace: ExecutionWorkspace) {
  if (workspace.branchName?.trim()) return workspace.branchName.trim();
  if (workspace.cwd?.trim()) {
    const segments = workspace.cwd.split(/[\\/]/).filter(Boolean);
    return segments[segments.length - 1] ?? workspace.cwd.trim();
  }
  if (workspace.name?.trim()) return workspace.name.trim();
  return workspace.id.slice(0, 8);
}

function workspaceStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function workspaceTone(status: ExecutionWorkspace["status"]) {
  switch (status) {
    case "active":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "cleanup_failed":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "in_review":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "idle":
    case "archived":
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function WorkspaceInner({
  workspace,
  linkedIssueCount,
  compact,
}: {
  workspace: ExecutionWorkspace;
  linkedIssueCount?: number;
  compact?: boolean;
}) {
  const Icon = workspace.branchName ? GitBranch : workspace.mode === "shared_workspace" ? Boxes : FolderTree;
  const primary = summarizeWorkspace(workspace);
  const status = workspaceStatusLabel(workspace.status);

  return (
    <>
      <Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      <span className="min-w-0 truncate font-mono text-[10px]">{primary}</span>
      {!compact ? (
        <span className="hidden text-[9px] uppercase tracking-[0.16em] lg:inline">
          {status}
        </span>
      ) : null}
      {linkedIssueCount && linkedIssueCount > 1 ? (
        <span className="hidden rounded-full bg-background/70 px-1 py-0.5 text-[9px] font-medium text-muted-foreground md:inline">
          {linkedIssueCount} issues
        </span>
      ) : null}
    </>
  );
}

interface ExecutionWorkspaceChipProps {
  workspace: ExecutionWorkspace;
  linkedIssueCount?: number;
  compact?: boolean;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

function baseClasses(status: ExecutionWorkspace["status"], compact?: boolean) {
  return cn(
    "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium transition-colors",
    workspaceTone(status),
    compact ? "max-w-[180px]" : "max-w-[240px]",
  );
}

function titleForWorkspace(workspace: ExecutionWorkspace, linkedIssueCount?: number) {
  const parts = [workspace.name, workspace.branchName, workspace.cwd, workspaceStatusLabel(workspace.status)].filter(Boolean);
  if (linkedIssueCount && linkedIssueCount > 1) {
    parts.push(`${linkedIssueCount} linked issues`);
  }
  return parts.join(" · ");
}

export function ExecutionWorkspaceChip({
  workspace,
  linkedIssueCount,
  compact,
  className,
  onClick,
}: ExecutionWorkspaceChipProps) {
  const inner: ReactNode = (
    <WorkspaceInner
      workspace={workspace}
      linkedIssueCount={linkedIssueCount}
      compact={compact}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClasses(workspace.status, compact), "hover:bg-accent/60", className)}
        title={titleForWorkspace(workspace, linkedIssueCount)}
      >
        {inner}
      </button>
    );
  }

  return (
    <span className={cn(baseClasses(workspace.status, compact), className)} title={titleForWorkspace(workspace, linkedIssueCount)}>
      {inner}
    </span>
  );
}
