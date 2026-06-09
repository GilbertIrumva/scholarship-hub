import * as React from "react";
import { cva } from "class-variance-authority";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Alert — inline status banner with icon, title, and description.
 *
 * Composition:
 *   <Alert variant="success">
 *     <AlertTitle>Saved</AlertTitle>
 *     <AlertDescription>Your changes are live.</AlertDescription>
 *   </Alert>
 *
 * Pass `icon={SomeIcon}` to override; pass `icon={false}` to hide.
 */
const alertVariants = cva(
  "relative w-full rounded-xl border p-4 flex gap-3",
  {
    variants: {
      variant: {
        info:    "border-sky-200 bg-sky-50 text-sky-900",
        success: "border-emerald-200 bg-emerald-50 text-emerald-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900",
        danger:  "border-red-200 bg-red-50 text-red-900",
        neutral: "border-border bg-surface-2 text-ink",
      },
    },
    defaultVariants: { variant: "info" },
  }
);

const DEFAULT_ICON = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  neutral: Info,
};

const Alert = React.forwardRef(
  ({ className, variant = "info", icon, children, ...props }, ref) => {
    const ResolvedIcon =
      icon === false ? null : icon ?? DEFAULT_ICON[variant] ?? Info;

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        {ResolvedIcon && (
          <ResolvedIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        <div className="flex-1 space-y-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm font-bold leading-tight", className)}
    {...props}
  />
));
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm leading-relaxed opacity-90", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription, alertVariants };
