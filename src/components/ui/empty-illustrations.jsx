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

// Soft envelope with motion lines — "no notifications yet" / "all caught up".
export const NotificationsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="84" ry="9" fill="currentColor" opacity="0.08" />

      {/* Motion sparkles */}
      <g fill="currentColor" opacity="0.5">
        <circle cx="38" cy="58" r="2" />
        <circle cx="186" cy="50" r="1.6" />
        <circle cx="200" cy="86" r="1.4" />
        <circle cx="28" cy="96" r="1.2" />
      </g>

      {/* Envelope back */}
      <g transform="translate(58 50)">
        <rect x="0" y="0" width="104" height="68" rx="8" fill="currentColor" opacity="0.14" />
        <rect x="0" y="0" width="104" height="68" rx="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M0 8 L52 44 L104 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
      </g>

      {/* Floating letter */}
      <g transform="translate(94 16) rotate(-6)">
        <rect x="0" y="0" width="52" height="36" rx="4" fill="white" stroke="currentColor" strokeWidth="2.2" />
        <path d="M6 8 H46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
        <path d="M6 16 H38" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
        <path d="M6 24 H30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
      </g>

      {/* Bell badge */}
      <g transform="translate(150 92)">
        <circle r="11" fill="currentColor" opacity="0.85" />
        <path d="M-4 -2 a4 4 0 0 1 8 0 v3 l1 2 h-10 l1 -2 z" fill="white" />
        <circle cy="4.5" r="1.6" fill="white" />
      </g>
    </svg>
  )
);
NotificationsIllustration.displayName = "NotificationsIllustration";

// Magnifying glass over a list — "no results matching filter".
export const SearchEmptyIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="84" ry="9" fill="currentColor" opacity="0.08" />

      {/* Paper sheet */}
      <g transform="translate(54 28)">
        <rect x="0" y="0" width="92" height="106" rx="8" fill="currentColor" opacity="0.12" />
        <rect x="0" y="0" width="92" height="106" rx="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.6" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45">
          <path d="M14 22 H66" />
          <path d="M14 36 H58" />
          <path d="M14 50 H72" />
          <path d="M14 64 H50" />
        </g>
      </g>

      {/* Magnifier */}
      <g transform="translate(128 84)">
        <circle r="26" fill="white" stroke="currentColor" strokeWidth="3" />
        <circle r="26" fill="currentColor" opacity="0.1" />
        <path d="M20 20 L40 40" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <path d="M-8 0 H8 M0 -8 V8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.55" />
      </g>
    </svg>
  )
);
SearchEmptyIllustration.displayName = "SearchEmptyIllustration";

// Scroll with a quill — "no audit log entries yet".
export const AuditLogIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="84" ry="9" fill="currentColor" opacity="0.08" />

      {/* Scroll roll top */}
      <rect x="56" y="22" width="108" height="14" rx="7" fill="currentColor" opacity="0.55" />
      {/* Scroll body */}
      <rect x="62" y="32" width="96" height="92" rx="4" fill="white" stroke="currentColor" strokeWidth="2.2" />
      {/* Scroll roll bottom */}
      <rect x="56" y="120" width="108" height="14" rx="7" fill="currentColor" opacity="0.55" />

      {/* Lines */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4">
        <path d="M74 50 H146" />
        <path d="M74 64 H140" />
        <path d="M74 78 H134" />
        <path d="M74 92 H120" />
      </g>

      {/* Tiny check on top right */}
      <g transform="translate(146 44)">
        <circle r="12" fill="currentColor" />
        <path d="M-5 1 L-1 5 L6 -3" fill="none" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
);
AuditLogIllustration.displayName = "AuditLogIllustration";

// Two chat bubbles — "no incoming messages".
export const MessagesIllustration = React.forwardRef(
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

      {/* Back bubble */}
      <g transform="translate(48 32)">
        <path
          d="M0 12 a12 12 0 0 1 12 -12 h64 a12 12 0 0 1 12 12 v40 a12 12 0 0 1 -12 12 h-32 l-14 14 v-14 h-18 a12 12 0 0 1 -12 -12 z"
          fill="currentColor"
          opacity="0.15"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <g fill="currentColor" opacity="0.55">
          <circle cx="26" cy="32" r="3" />
          <circle cx="40" cy="32" r="3" />
          <circle cx="54" cy="32" r="3" />
        </g>
      </g>

      {/* Front bubble */}
      <g transform="translate(96 70)">
        <path
          d="M0 12 a12 12 0 0 1 12 -12 h64 a12 12 0 0 1 12 12 v36 a12 12 0 0 1 -12 12 h-50 l-14 14 v-14 h-0 a12 12 0 0 1 -12 -12 z"
          fill="white"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <g fill="currentColor" opacity="0.8">
          <circle cx="26" cy="30" r="3" />
          <circle cx="44" cy="30" r="3" />
          <circle cx="62" cy="30" r="3" />
        </g>
      </g>
    </svg>
  )
);
MessagesIllustration.displayName = "MessagesIllustration";

// Folder with a ribbon/badge — "no credentials uploaded".
export const CredentialsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="84" ry="9" fill="currentColor" opacity="0.08" />

      {/* Folder back tab */}
      <path d="M42 40 H94 L104 52 H178 V60 H42 Z" fill="currentColor" opacity="0.5" />
      {/* Folder body */}
      <rect x="42" y="56" width="136" height="74" rx="8" fill="currentColor" opacity="0.18" />
      <rect x="42" y="56" width="136" height="74" rx="8" fill="none" stroke="currentColor" strokeWidth="2.2" />

      {/* Document peeking out */}
      <g transform="translate(72 50)">
        <rect x="0" y="0" width="68" height="68" rx="4" fill="white" stroke="currentColor" strokeWidth="2" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.45">
          <path d="M10 18 H50" />
          <path d="M10 30 H44" />
          <path d="M10 42 H38" />
        </g>
      </g>

      {/* Badge ribbon */}
      <g transform="translate(146 96)">
        <circle r="14" fill="currentColor" />
        <path d="M-5 -1 L-1 4 L6 -4" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-7 12 L-3 24 L0 18 L3 24 L7 12" fill="currentColor" />
      </g>
    </svg>
  )
);
CredentialsIllustration.displayName = "CredentialsIllustration";

// Passport with a plane — "no travel docs uploaded".
export const TravelDocsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="84" ry="9" fill="currentColor" opacity="0.08" />

      {/* Dotted route */}
      <path
        d="M20 122 Q70 70 132 86 T210 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
        opacity="0.4"
      />

      {/* Passport */}
      <g transform="translate(54 44) rotate(-6)">
        <rect x="0" y="0" width="80" height="100" rx="8" fill="currentColor" opacity="0.85" />
        <rect x="0" y="0" width="80" height="100" rx="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <circle cx="40" cy="42" r="14" fill="none" stroke="white" strokeWidth="2.4" />
        <path d="M26 42 H54 M40 28 V56" stroke="white" strokeWidth="1.8" opacity="0.7" />
        <path d="M22 72 H58 M22 80 H58 M22 88 H46" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.85" />
      </g>

      {/* Mini plane */}
      <g transform="translate(160 60) rotate(20)">
        <path d="M0 0 L26 -6 L20 8 L12 4 Z" fill="white" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M12 4 L20 8 L16 14 Z" fill="currentColor" opacity="0.55" />
      </g>
    </svg>
  )
);
TravelDocsIllustration.displayName = "TravelDocsIllustration";

// Group of three figures — "no applicants yet".
export const ApplicantsIllustration = React.forwardRef(
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

      {/* Side person (left) */}
      <g transform="translate(40 56)">
        <circle cx="22" cy="14" r="11" fill="currentColor" opacity="0.4" />
        <path d="M2 60 q20 -24 40 0 v8 H2 Z" fill="currentColor" opacity="0.4" />
      </g>

      {/* Side person (right) */}
      <g transform="translate(140 56)">
        <circle cx="22" cy="14" r="11" fill="currentColor" opacity="0.4" />
        <path d="M2 60 q20 -24 40 0 v8 H2 Z" fill="currentColor" opacity="0.4" />
      </g>

      {/* Center person (taller) */}
      <g transform="translate(88 38)">
        <circle cx="22" cy="16" r="13" fill="white" stroke="currentColor" strokeWidth="2.4" />
        <path d="M2 70 q20 -28 40 0 v12 H2 Z" fill="white" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        {/* Tiny graduation cap */}
        <g transform="translate(22 0)">
          <path d="M-12 2 L0 -4 L12 2 L0 8 Z" fill="currentColor" />
          <path d="M10 4 V12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
);
ApplicantsIllustration.displayName = "ApplicantsIllustration";

// Calendar with checkmark — "no upcoming/overdue milestones".
export const MilestonesIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="142" rx="80" ry="9" fill="currentColor" opacity="0.08" />

      {/* Calendar */}
      <g transform="translate(58 34)">
        <rect x="0" y="8" width="104" height="98" rx="8" fill="white" stroke="currentColor" strokeWidth="2.2" />
        <rect x="0" y="8" width="104" height="22" rx="8" fill="currentColor" opacity="0.85" />
        <rect x="0" y="22" width="104" height="8" fill="currentColor" opacity="0.85" />

        {/* Hooks */}
        <rect x="20" y="0" width="6" height="20" rx="3" fill="currentColor" opacity="0.55" />
        <rect x="78" y="0" width="6" height="20" rx="3" fill="currentColor" opacity="0.55" />

        {/* Grid dots */}
        <g fill="currentColor" opacity="0.35">
          <circle cx="22" cy="48" r="2.4" />
          <circle cx="42" cy="48" r="2.4" />
          <circle cx="62" cy="48" r="2.4" />
          <circle cx="82" cy="48" r="2.4" />
          <circle cx="22" cy="66" r="2.4" />
          <circle cx="42" cy="66" r="2.4" />
          <circle cx="82" cy="66" r="2.4" />
          <circle cx="22" cy="84" r="2.4" />
          <circle cx="82" cy="84" r="2.4" />
        </g>

        {/* Big check */}
        <g transform="translate(62 66)">
          <circle r="16" fill="currentColor" />
          <path d="M-7 0 L-2 6 L8 -5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  )
);
MilestonesIllustration.displayName = "MilestonesIllustration";

// Laptop with shield — "no active sessions".
export const SessionsIllustration = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 220 160"
      role="img"
      aria-hidden="true"
      className={cn(BASE_CLASS, className)}
      {...props}
    >
      <ellipse cx="110" cy="138" rx="86" ry="8" fill="currentColor" opacity="0.08" />

      {/* Laptop screen */}
      <rect x="50" y="40" width="120" height="72" rx="6" fill="white" stroke="currentColor" strokeWidth="2.4" />
      <rect x="56" y="46" width="108" height="60" rx="3" fill="currentColor" opacity="0.14" />

      {/* Laptop base */}
      <path d="M36 116 H184 L194 128 H26 Z" fill="currentColor" opacity="0.55" />
      <path d="M36 116 H184 L194 128 H26 Z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />

      {/* Shield in middle */}
      <g transform="translate(110 76)">
        <path d="M0 -22 L20 -14 V0 Q20 16 0 24 Q-20 16 -20 0 V-14 Z" fill="currentColor" />
        <path d="M-8 0 L-2 6 L10 -8" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
);
SessionsIllustration.displayName = "SessionsIllustration";

// Inline mini illustration for plain-text empty zones (small areas like 64-80px tall).
// Single dotted circle with checkmark — neutral "nothing here yet" badge.
export const InlineEmptyMark = React.forwardRef(
  ({ className, ...props }, ref) => (
    <svg
      ref={ref}
      viewBox="0 0 120 80"
      role="img"
      aria-hidden="true"
      className={cn("h-16 w-auto text-primary", className)}
      {...props}
    >
      <ellipse cx="60" cy="68" rx="38" ry="5" fill="currentColor" opacity="0.08" />
      <circle cx="60" cy="36" r="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" opacity="0.55" />
      <g transform="translate(60 36)">
        <circle r="11" fill="currentColor" opacity="0.85" />
        <path d="M-5 0 L-1 4 L6 -4" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
);
InlineEmptyMark.displayName = "InlineEmptyMark";
