import type { UiLanguagePreference } from "@paperclipai/shared";
import { Languages } from "lucide-react";
import { useI18n } from "../context/LocaleContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "../lib/utils";

const languageOptions: UiLanguagePreference[] = ["system", "en", "zh-CN"];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { languageOverride, setLanguageOverride, t } = useI18n();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn("text-muted-foreground shrink-0", !compact && "w-auto px-2")}
          aria-label={t("layout.languageSwitcherLabel")}
          title={t("layout.languageSwitcherLabel")}
        >
          <Languages className="h-4 w-4 shrink-0" />
          {!compact ? (
            <span className="ml-1.5 text-xs font-medium uppercase">
              {languageOverride === "zh-CN" ? "中" : languageOverride === "en" ? "EN" : "Auto"}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languageOptions.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => setLanguageOverride(option)}
            className={cn(languageOverride === option && "bg-accent")}
          >
            {option === "system"
              ? t("common.languageSystem")
              : option === "zh-CN"
                ? t("common.chineseSimplified")
                : t("common.english")}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
