import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — animated loading placeholder.
 *
 * Examples:
 *   <Skeleton className="h-4 w-32" />          // line of text
 *   <Skeleton className="h-10 w-10 rounded-full" />  // avatar
 *   <Skeleton.Card />                          // generic card placeholder
 *   <Skeleton.Text lines={3} />                // multi-line text block
 */
const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      "animate-pulse rounded-md bg-surface-2",
      "dark:bg-white/5",
      className
    )}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";

const SkeletonText = ({ lines = 3, className }) => (
  <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
      />
    ))}
  </div>
);

const SkeletonCard = ({ className }) => (
  <div
    className={cn(
      "rounded-xl border border-border bg-surface p-5 shadow-card space-y-4",
      className
    )}
    aria-busy="true"
  >
    <div className="flex items-center gap-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
);

Skeleton.Text = SkeletonText;
Skeleton.Card = SkeletonCard;

export { Skeleton, SkeletonText, SkeletonCard };
