import { useI18n, useLang, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { code: Lang; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "ar", label: "عربي", name: "العربية" },
];

/**
 * Segmented EN | عربي control. It is pinned to `dir="ltr"` so the two options keep the same
 * position in both directions, and each option is labelled in its own language.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const lang = useLang((state) => state.lang);
  const setLang = useLang((state) => state.setLang);
  const { t } = useI18n();

  return (
    <div
      role="group"
      dir="ltr"
      aria-label={t("a11y.language")}
      className={cn("inline-flex h-9 items-stretch border border-line", className)}
    >
      {OPTIONS.map((option) => {
        const active = lang === option.code;
        return (
          <button
            key={option.code}
            type="button"
            lang={option.code}
            aria-pressed={active}
            aria-label={option.name}
            title={option.name}
            onClick={() => setLang(option.code)}
            className={cn(
              "min-w-10 px-2.5 font-display text-xs leading-none transition-colors duration-200",
              active ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** One-tap variant for tight mobile headers: shows the language you would switch to. */
export function LanguageToggleCompact({ className }: { className?: string }) {
  const lang = useLang((state) => state.lang);
  const setLang = useLang((state) => state.setLang);
  const target = OPTIONS.find((option) => option.code !== lang) ?? OPTIONS[0];

  return (
    <button
      type="button"
      lang={target.code}
      aria-label={target.name}
      title={target.name}
      onClick={() => setLang(target.code)}
      className={cn(
        "inline-flex h-9 min-w-10 items-center justify-center border border-line px-2.5 font-display text-xs leading-none text-fg",
        className,
      )}
    >
      {target.label}
    </button>
  );
}
