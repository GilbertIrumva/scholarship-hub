// Pill-style EN/FR switcher. Persists choice via i18next-browser-languagedetector
// (localStorage key 'scholarz_lang' — see src/i18n/index.js).
//
// Usage:
//   <LanguageSwitcher />                  // default pills
//   <LanguageSwitcher variant="compact" />// dense, for dashboard topbar
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, changeLanguage } from "../../i18n";
import { Languages } from "lucide-react";

function cn(...c) {
  return c.filter(Boolean).join(" ");
}

export default function LanguageSwitcher({ variant = "default", className = "" }) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  const handle = (code) => {
    if (code === current) return;
    changeLanguage(code);
  };

  if (variant === "compact") {
    return (
      <div
        role="group"
        aria-label={t("nav.language")}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full bg-slate-100 p-0.5 text-xs font-bold",
          className
        )}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => handle(l.code)}
            aria-pressed={current === l.code}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              current === l.code
                ? "bg-white text-ink shadow-sm"
                : "text-muted hover:text-ink"
            )}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("nav.language")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-white p-1 text-sm font-bold shadow-sm",
        className
      )}
    >
      <Languages className="ml-1.5 h-4 w-4 text-muted" aria-hidden />
      {SUPPORTED_LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => handle(l.code)}
          aria-pressed={current === l.code}
          className={cn(
            "rounded-full px-3 py-1 transition-colors",
            current === l.code
              ? "bg-primary text-white"
              : "text-muted hover:text-ink"
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
