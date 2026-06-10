import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/useTheme";

/**
 * ThemeToggle — accessible 3-way switch (light / system / dark).
 *
 * Usage:
 *   <ThemeToggle />                  // default segmented control
 *   <ThemeToggle variant="icon" />   // compact single icon button that cycles
 *
 * Pair with the ThemeProvider mounted in src/main.jsx.
 */
const OPTIONS = [
  { value: "light", labelKey: "themeToggle.light", Icon: Sun },
  { value: "system", labelKey: "themeToggle.system", Icon: Monitor },
  { value: "dark", labelKey: "themeToggle.dark", Icon: Moon },
];

const SegmentedToggle = ({ theme, setTheme, className }) => {
  const { t } = useTranslation();
  return (
    <div
      role="radiogroup"
      aria-label={t("themeToggle.groupLabel")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-surface p-1 shadow-card",
        className
      )}
    >
      {OPTIONS.map(({ value, labelKey, Icon }) => {
        const active = theme === value;
        const label = t(labelKey);
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              active && "bg-primary text-primary-foreground shadow-sm"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
};

const IconToggle = ({ resolvedTheme, toggleTheme, className }) => {
  const { t } = useTranslation();
  const Icon = resolvedTheme === "dark" ? Sun : Moon;
  const next = resolvedTheme === "dark" ? "light" : "dark";
  const switchLabel = t("themeToggle.switchTo", { theme: t(`themeToggle.${next}`) });
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={switchLabel}
      title={switchLabel}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink shadow-card transition-all",
        "hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
};

export const ThemeToggle = ({ variant = "segmented", className }) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === "icon") {
    return (
      <IconToggle
        resolvedTheme={resolvedTheme}
        toggleTheme={toggleTheme}
        className={className}
      />
    );
  }

  return <SegmentedToggle theme={theme} setTheme={setTheme} className={className} />;
};

export default ThemeToggle;
