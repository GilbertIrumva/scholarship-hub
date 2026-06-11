// Friendly empty-state illustrations.
// Each export is a self-contained SVG that scales to its container,
// uses the active text color for line work, and tints fills via the
// emerald primary palette. Pass through `className` to size them.

import * as React from "react";
import { cn } from "@/lib/utils";

const BASE_CLASS = "h-32 w-auto text-primary";

// Stargazing telescope on a hill — "we're looking for the right fit for you".
export const RecommendationsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      {/* Background blob */}
      <ellipse cx="110" cy="138" rx="92" ry="10" fill="currentColor" opacity="0.08" />

      {/* Stars */}
      <g fill="currentColor" opacity="0.45">
        <circle cx="34" cy="34" r="1.6" />
        <circle cx="178" cy="22" r="2.2" />
        <circle cx="198" cy="60" r="1.4" />
        <circle cx="60" cy="18" r="1.2" />
        <circle cx="156" cy="52" r="1.6" />
      </g>

      {/* Big sparkly star */}
      <g fill="currentColor">
        <path d="M186 36 L188.6 41.4 L194 44 L188.6 46.6 L186 52 L183.4 46.6 L178 44 L183.4 41.4 Z" />
      </g>

      {/* Hill */}
      <path
        d="M10 130 Q70 90 130 110 T214 122 L214 138 L10 138 Z"
        fill="currentColor"
        opacity="0.14"
      />

      {/* Telescope tube */}
      <g transform="rotate(-32 110 90)">
        <rect x="78" y="80" width="78" height="18" rx="9" fill="currentColor" opacity="0.18" />
        <rect x="78" y="80" width="78" height="18" rx="9" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <rect x="146" y="76" width="12" height="26" rx="3" fill="currentColor" opacity="0.55" />
        <circle cx="78" cy="89" r="5" fill="currentColor" />
      </g>

      {/* Tripod */}
      <path
        d="M96 116 L90 142 M124 116 L130 142 M110 116 L110 142"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="110" cy="116" r="4.5" fill="currentColor" />
    </svg>
  )
);
RecommendationsIllustration.displayName = "RecommendationsIllustration";

// Open bookmark with a heart — "no saved scholarships yet".
export const SavedIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="86" ry="9" fill="currentColor" opacity="0.08" />

      {/* Floating sparkles */}
      <g fill="currentColor" opacity="0.55">
        <path d="M40 40 L42 45 L47 47 L42 49 L40 54 L38 49 L33 47 L38 45 Z" />
        <path d="M180 110 L181.5 114 L185 115.5 L181.5 117 L180 121 L178.5 117 L175 115.5 L178.5 114 Z" />
      </g>

      {/* Back card (slightly rotated) */}
      <g transform="rotate(-8 78 80)">
        <rect x="44" y="42" width="80" height="92" rx="10" fill="currentColor" opacity="0.12" />
        <rect x="44" y="42" width="80" height="92" rx="10" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      </g>

      {/* Front bookmark */}
      <g transform="translate(96 32)">
        <path
          d="M0 6 a6 6 0 0 1 6 -6 h44 a6 6 0 0 1 6 6 v92 L28 84 L0 98 Z"
          fill="white"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {/* Heart inside */}
        <path
          d="M28 56 C18 48 18 32 28 36 C38 32 38 48 28 56 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </g>
    </svg>
  )
);
SavedIllustration.displayName = "SavedIllustration";

// Paper plane mid-flight — "no applications yet".
export const ApplicationsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="86" ry="9" fill="currentColor" opacity="0.08" />

      {/* Dotted flight path */}
      <path
        d="M28 124 Q70 60 130 80 T204 36"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 7"
        opacity="0.45"
      />

      {/* Tiny clouds */}
      <g fill="currentColor" opacity="0.18">
        <ellipse cx="48" cy="46" rx="14" ry="6" />
        <ellipse cx="58" cy="42" rx="9" ry="5" />
        <ellipse cx="178" cy="98" rx="12" ry="5" />
      </g>

      {/* Paper plane body */}
      <g transform="translate(82 56) rotate(-12)">
        <path
          d="M0 24 L82 0 L60 56 L42 36 Z"
          fill="white"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M42 36 L82 0 L52 40 Z"
          fill="currentColor"
          opacity="0.22"
        />
        <path
          d="M42 36 L60 56"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  )
);
ApplicationsIllustration.displayName = "ApplicationsIllustration";
