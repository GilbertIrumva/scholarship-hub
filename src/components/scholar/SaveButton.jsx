import { useState } from "react";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSavedScholarships } from "../../context/useSavedScholarships";

/**
 * SaveButton — heart-shaped bookmark toggle for a scholarship.
 *
 * Props:
 *   scholarshipId (required)
 *   scholarshipTitle (optional, used in toast feedback)
 *   variant: "icon" (default, 36×36 round) | "pill" (icon + label text)
 *   size: "sm" (32) | "md" (36, default) | "lg" (44)
 *   className: extra Tailwind classes
 *   onChange: optional callback `(nowSaved: boolean) => void`
 *
 * Stops click propagation so it works safely inside <Link>/clickable cards.
 */
const SaveButton = ({
  scholarshipId,
  scholarshipTitle,
  variant = "icon",
  size = "md",
  className,
  onChange,
}) => {
  const { isSaved, toggle } = useSavedScholarships();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(scholarshipId);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const next = await toggle(scholarshipId, scholarshipTitle);
      onChange?.(next);
    } finally {
      setBusy(false);
    }
  };

  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  };
  const iconMap = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={saved}
        aria-label={saved ? "Remove from saved" : "Save scholarship"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
          saved
            ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
            : "border-border bg-surface text-muted hover:text-ink hover:bg-slate-100 dark:hover:bg-slate-800",
          busy && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        {busy ? (
          <Loader2 className={cn(iconMap[size], "animate-spin")} aria-hidden="true" />
        ) : (
          <Heart
            className={cn(iconMap[size], saved && "fill-current")}
            aria-hidden="true"
          />
        )}
        <span>{saved ? "Saved" : "Save"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save scholarship"}
      title={saved ? "Remove from saved" : "Save scholarship"}
      className={cn(
        "grid place-items-center rounded-full border transition",
        sizeMap[size],
        saved
          ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-300"
          : "border-border bg-surface/90 text-muted backdrop-blur hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40",
        busy && "opacity-60 cursor-not-allowed",
        className
      )}
    >
      {busy ? (
        <Loader2 className={cn(iconMap[size], "animate-spin")} aria-hidden="true" />
      ) : (
        <Heart
          className={cn(iconMap[size], saved && "fill-current")}
          aria-hidden="true"
        />
      )}
    </button>
  );
};

export default SaveButton;
export { SaveButton };
