import os from "node:os";
import path from "node:path";

export const PAPERCLIP_WECOM_SKILL_SLUGS = [
  "wecomcli-contact",
  "wecomcli-todo",
  "wecomcli-meeting",
  "wecomcli-msg",
  "wecomcli-schedule",
  "wecomcli-doc",
] as const;

export type PaperclipWeComSkillSlug = (typeof PAPERCLIP_WECOM_SKILL_SLUGS)[number];

function expandHomePrefix(value: string) {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function buildPaperclipWeComSkillKey(slug: PaperclipWeComSkillSlug) {
  return `paperclipai/paperclip/${slug}`;
}

export function listPaperclipWeComSkillKeys(): string[] {
  return PAPERCLIP_WECOM_SKILL_SLUGS.map((slug) => buildPaperclipWeComSkillKey(slug));
}

export function resolvePaperclipInstanceRootFromEnv(
  env: NodeJS.ProcessEnv = process.env,
) {
  const paperclipHome = env.PAPERCLIP_HOME?.trim()
    ? path.resolve(expandHomePrefix(env.PAPERCLIP_HOME.trim()))
    : path.resolve(os.homedir(), ".paperclip");
  const instanceId = env.PAPERCLIP_INSTANCE_ID?.trim() || "default";
  return path.resolve(paperclipHome, "instances", instanceId);
}

export function resolveWeComCliDirectories(
  companyId: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const trimmedCompanyId = companyId.trim();
  if (!trimmedCompanyId) {
    throw new Error("WeCom CLI directories require a company id.");
  }
  const instanceRoot = resolvePaperclipInstanceRootFromEnv(env);
  const companyRoot = path.resolve(instanceRoot, "wecom", trimmedCompanyId);
  return {
    instanceRoot,
    companyRoot,
    configDir: path.resolve(companyRoot, "config"),
    tmpDir: path.resolve(companyRoot, "tmp"),
  };
}
