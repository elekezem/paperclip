import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { UiLanguagePreference } from "@paperclipai/shared";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { messages, type TranslationKey } from "../i18n/messages";
import {
  UI_LANGUAGE_OVERRIDE_STORAGE_KEY,
  detectBrowserUiLocale,
  formatDateTime,
  formatNumber,
  formatRelativeUiTime,
  resolveUiLocale,
  type ResolvedUiLocale,
} from "../lib/ui-language";

type MessageValues = Record<string, string | number>;

interface LocaleContextValue {
  locale: ResolvedUiLocale;
  defaultUiLanguage: UiLanguagePreference;
  languageOverride: UiLanguagePreference;
  setLanguageOverride: (language: UiLanguagePreference) => void;
  t: (key: TranslationKey, values?: MessageValues) => string;
  formatDateTime: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (value: Date | string | number) => string;
  formatStatus: (status: string) => string;
  formatApprovalType: (type: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);
const warnedMissingKeys = new Set<string>();

function interpolate(template: string, values?: MessageValues) {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = values[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

function readStoredLanguageOverride(): UiLanguagePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(UI_LANGUAGE_OVERRIDE_STORAGE_KEY);
    if (stored === "en" || stored === "zh-CN" || stored === "system") {
      return stored;
    }
  } catch {
    // Ignore storage access failures in restricted environments.
  }
  return "system";
}

function statusTranslationKey(status: string): TranslationKey | null {
  const key = `common.status.${status}` as TranslationKey;
  return Object.prototype.hasOwnProperty.call(messages.en, key) ? key : null;
}

function approvalTypeTranslationKey(type: string): TranslationKey | null {
  const key = `approvalType.${type}` as TranslationKey;
  return Object.prototype.hasOwnProperty.call(messages.en, key) ? key : null;
}

function humanizeFallback(value: string) {
  return value.replaceAll("_", " ");
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [languageOverride, setLanguageOverrideState] = useState<UiLanguagePreference>(() => readStoredLanguageOverride());
  const generalSettingsQuery = useQuery({
    queryKey: queryKeys.instance.generalSettings,
    queryFn: () => instanceSettingsApi.getGeneral(),
    retry: false,
  });

  const defaultUiLanguage = generalSettingsQuery.data?.defaultUiLanguage ?? "system";
  const locale = resolveUiLocale(languageOverride, defaultUiLanguage);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
    document.documentElement.dataset.uiLocale = locale;
  }, [locale]);

  const setLanguageOverride = useCallback((language: UiLanguagePreference) => {
    setLanguageOverrideState(language);
    try {
      window.localStorage.setItem(UI_LANGUAGE_OVERRIDE_STORAGE_KEY, language);
    } catch {
      // Ignore local storage write failures in restricted environments.
    }
  }, []);

  const t = useCallback((key: TranslationKey, values?: MessageValues) => {
    const localized = messages[locale][key] ?? messages.en[key];
    if (!localized && import.meta.env.DEV && !warnedMissingKeys.has(key)) {
      warnedMissingKeys.add(key);
      console.warn(`[i18n] Missing translation key: ${key}`);
    }
    return interpolate(localized ?? key, values);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    defaultUiLanguage,
    languageOverride,
    setLanguageOverride,
    t,
    formatDateTime: (value, options) => formatDateTime(value, options, locale),
    formatNumber: (value, options) => formatNumber(value, options, locale),
    formatRelativeTime: (value) => formatRelativeUiTime(value, locale),
    formatStatus: (status) => {
      const key = statusTranslationKey(status);
      return key ? t(key) : humanizeFallback(status);
    },
    formatApprovalType: (type) => {
      const key = approvalTypeTranslationKey(type);
      return key ? t(key) : humanizeFallback(type);
    },
  }), [defaultUiLanguage, languageOverride, locale, setLanguageOverride, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return context;
}

export function detectDefaultLocaleForTests() {
  return detectBrowserUiLocale();
}
