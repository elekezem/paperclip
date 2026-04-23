const AGENT_RUN_CLOSEOUT_COMMENT_MARKERS = [
  "original work complete",
  "no new action required",
  "closing issue",
];

export function isAutomatedAgentCloseoutCommentWake(input: {
  authorAgentId: string | null | undefined;
  authorRunId: string | null | undefined;
  assigneeAgentId: string | null | undefined;
  body: string | null | undefined;
}) {
  if (!input.authorAgentId || !input.authorRunId || !input.assigneeAgentId) return false;
  if (input.authorAgentId === input.assigneeAgentId) return false;

  const normalizedBody = input.body?.toLowerCase() ?? "";
  return AGENT_RUN_CLOSEOUT_COMMENT_MARKERS.some((marker) => normalizedBody.includes(marker));
}

export function shouldSuppressAgentCloseoutCommentWake(input: {
  actorType: "agent" | "user";
  actorId: string;
  actorRunId: string | null;
  assigneeAgentId: string | null | undefined;
  body: string | null | undefined;
}) {
  if (input.actorType !== "agent") return false;
  return isAutomatedAgentCloseoutCommentWake({
    authorAgentId: input.actorId,
    authorRunId: input.actorRunId,
    assigneeAgentId: input.assigneeAgentId,
    body: input.body,
  });
}
