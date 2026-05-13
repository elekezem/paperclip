import type { AdapterModel } from "./types.js";
import { models as codexFallbackModels } from "@paperclipai/adapter-codex-local";

function dedupeModels(models: AdapterModel[]): AdapterModel[] {
  const seen = new Set<string>();
  const deduped: AdapterModel[] = [];
  for (const model of models) {
    const id = model.id.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push({ id, label: model.label.trim() || id });
  }
  return deduped;
}

export async function listCodexModels(): Promise<AdapterModel[]> {
  // Codex discovery must stay offline-friendly and must not trigger OpenAI Platform API model probes.
  return dedupeModels(codexFallbackModels);
}

export async function refreshCodexModels(): Promise<AdapterModel[]> {
  // AKESO policy: refresh is intentionally offline and subscription-auth only.
  return listCodexModels();
}

export function resetCodexModelsCacheForTests() {
  // no-op: model listing no longer performs network discovery or caching
}
