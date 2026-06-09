import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — small status/label chip.
 *
 * Examples:
 *   <Badge>Default</Badge>
 *   <Badge variant="success">Verified</Badge>
 *   <Badge variant="warning" size="sm">Pending</Badge>
 *   <Badge variant="outline">Draft</Badge>
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default:   "bg-primary/10 text-primary",
        secondary: "bg-surface-2 text-ink",
        success:   "bg-emerald-100 text-emerald-800",
        warning:   "bg-amber-100 text-amber-800",
        danger:    "bg-red-100 text-red-700",
        info:      "bg-sky-100 text-sky-800",
        outline:   "border border-border text-ink",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] uppercase tracking-wider",
        md: "px-2.5 py-1 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

const Badge = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(badgeVariants({ variant, size }), className)}
    {...props}
  />
));
Badge.displayName = "Badge";

export { Badge, badgeVariants };
