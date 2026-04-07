import type { UiLanguagePreference } from "@paperclipai/shared";

export type ResolvedUiLocale = "en" | "zh-CN";

export const UI_LANGUAGE_OVERRIDE_STORAGE_KEY = "paperclip.uiLanguageOverride";

export function normalizeResolvedUiLocale(value: string | null | undefined): ResolvedUiLocale {
  return value?.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
}

export function detectBrowserUiLocale(): ResolvedUiLocale {
  if (typeof navigator === "undefined") return "en";
  const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    if (candidate?.toLowerCase().startsWith("zh")) {
      return "zh-CN";
    }
  }
  return "en";
}

export function resolveUiLocale(
  overrideLanguage: UiLanguagePreference | null | undefined,
  defaultLanguage: UiLanguagePreference | null | undefined,
): ResolvedUiLocale {
  const preference = overrideLanguage && overrideLanguage !== "system"
    ? overrideLanguage
    : defaultLanguage && defaultLanguage !== "system"
      ? defaultLanguage
      : null;
  if (preference) {
    return normalizeResolvedUiLocale(preference);
  }
  return detectBrowserUiLocale();
}

export function getDocumentUiLocale(): ResolvedUiLocale {
  if (typeof document === "undefined") return "en";
  return normalizeResolvedUiLocale(document.documentElement.lang || document.documentElement.dataset.uiLocale || "en");
}

export function formatDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
  locale?: ResolvedUiLocale,
): string {
  return new Intl.DateTimeFormat(locale ?? getDocumentUiLocale(), options).format(new Date(value));
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  locale?: ResolvedUiLocale,
): string {
  return new Intl.NumberFormat(locale ?? getDocumentUiLocale(), options).format(value);
}

export function formatRelativeUiTime(
  value: Date | string | number,
  locale?: ResolvedUiLocale,
): string {
  const resolvedLocale = locale ?? getDocumentUiLocale();
  const now = Date.now();
  const then = new Date(value).getTime();
  const deltaSeconds = Math.round((then - now) / 1000);
  const absolute = Math.abs(deltaSeconds);
  const formatter = new Intl.RelativeTimeFormat(resolvedLocale, { numeric: "auto" });

  if (absolute < 60) {
    return formatter.format(Math.round(deltaSeconds), "second");
  }
  if (absolute < 60 * 60) {
    return formatter.format(Math.round(deltaSeconds / 60), "minute");
  }
  if (absolute < 60 * 60 * 24) {
    return formatter.format(Math.round(deltaSeconds / (60 * 60)), "hour");
  }
  if (absolute < 60 * 60 * 24 * 7) {
    return formatter.format(Math.round(deltaSeconds / (60 * 60 * 24)), "day");
  }
  if (absolute < 60 * 60 * 24 * 30) {
    return formatter.format(Math.round(deltaSeconds / (60 * 60 * 24 * 7)), "week");
  }
  return formatter.format(Math.round(deltaSeconds / (60 * 60 * 24 * 30)), "month");
}
