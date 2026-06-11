import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — friendly placeholder for empty lists, tables, or sections.
 *
 * Examples:
 *   <EmptyState
 *     icon={Inbox}
 *     title="No applications yet"
 *     description="Submitted applications will appear here."
 *     action={<Button onClick={…}>Browse scholarships</Button>}
 *   />
 *
 *   // Compact inline variant inside a table cell:
 *   <EmptyState size="sm" title="No results" description="Try a different filter." />
 */
const SIZE_MAP = {
  sm: {
    wrapper: "px-4 py-8",
    iconWrap: "h-10 w-10",
    icon: "h-5 w-5",
    title: "text-sm font-semibold",
    description: "text-xs",
  },
  md: {
    wrapper: "px-6 py-12",
    iconWrap: "h-14 w-14",
    icon: "h-6 w-6",
    title: "text-base font-bold",
    description: "text-sm",
  },
  lg: {
    wrapper: "px-8 py-16",
    iconWrap: "h-16 w-16",
    icon: "h-7 w-7",
    title: "text-lg font-bold",
    description: "text-sm",
  },
};

const EmptyState = React.forwardRef(
  (
    {
      icon: Icon = Inbox,
      illustration,
      title,
      description,
      action,
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    const cfg = SIZE_MAP[size] ?? SIZE_MAP.md;
    return (
      <div
        ref={ref}
        role="status"
        className={cn(
          "flex flex-col items-center justify-center text-center",
          cfg.wrapper,
          className
        )}
        {...props}
      >
        {illustration ? (
          <div className="mb-1 flex items-center justify-center">{illustration}</div>
        ) : (
          Icon && (
            <div
              className={cn(
                "grid place-items-center rounded-2xl border border-border bg-surface-2 text-muted",
                cfg.iconWrap
              )}
              aria-hidden="true"
            >
              <Icon className={cfg.icon} />
            </div>
          )
        )}
        {title && (
          <p className={cn("mt-4 text-ink", cfg.title)}>{title}</p>
        )}
        {description && (
          <p className={cn("mt-1 max-w-sm text-muted", cfg.description)}>
            {description}
          </p>
        )}
        {action && <div className="mt-5">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
