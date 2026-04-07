import { formatRelativeUiTime, type ResolvedUiLocale } from "./ui-language";

export function timeAgo(date: Date | string, locale?: ResolvedUiLocale): string {
  return formatRelativeUiTime(date, locale);
}
