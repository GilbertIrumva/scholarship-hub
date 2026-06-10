// T4.2 — Frontend logger + optional Sentry sink.
//
// Adapter pattern: when `VITE_SENTRY_DSN` is set AND `@sentry/react` is
// installed, errors flow through Sentry. Otherwise this module is a
// near-zero-cost no-op so dev / preview / tests stay quiet.
//
// Usage:
//   import { initObservability, logger, captureException } from "@/lib/logger";
//   initObservability();                       // call once in main.jsx
//   logger.warn("something odd", { context });
//   captureException(err, { extras: { ... } });

let sentryClient = null;
let initPromise = null;

function envDsn() {
  try {
    return import.meta.env?.VITE_SENTRY_DSN || "";
  } catch {
    return "";
  }
}

export function initObservability() {
  if (initPromise) return initPromise;
  const dsn = envDsn();
  if (!dsn) {
    initPromise = Promise.resolve(null);
    return initPromise;
  }
  // Build the specifier at runtime so Vite's static import analyser can't
  // resolve "@sentry/react" at dev/build time. The package is intentionally
  // an optional peer — if it isn't installed we silently no-op.
  const sentryPkg = ["@sentry", "react"].join("/");
  initPromise = import(/* @vite-ignore */ sentryPkg)
    .then((Sentry) => {
      try {
        Sentry.init({
          dsn,
          environment: import.meta.env?.MODE || "production",
          release: import.meta.env?.VITE_SENTRY_RELEASE || undefined,
          // Conservative defaults — opt in via env when needed.
          tracesSampleRate: Number(import.meta.env?.VITE_SENTRY_TRACES_SAMPLE_RATE || 0),
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        });
        sentryClient = Sentry;
        return Sentry;
      } catch {
        return null;
      }
    })
    .catch(() => null);
  return initPromise;
}

// Tiny console wrapper. Lets us swap to a structured sink later without
// touching every call-site. In production builds (no Sentry, no DSN) we
// only forward `warn`/`error` so the console stays readable.
const IS_PROD = (() => {
  try {
    return import.meta.env?.PROD === true;
  } catch {
    return false;
  }
})();

export const logger = {
  debug: (...args) => {
    if (!IS_PROD) console.debug(...args);
  },
  info: (...args) => {
    if (!IS_PROD) console.info(...args);
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

export function captureException(err, ctx = {}) {
  if (!err) return;
  // Always log locally so devs see it without depending on Sentry.
  console.error(err, ctx);
  if (!sentryClient) return;
  try {
    sentryClient.withScope((scope) => {
      if (ctx.requestId) scope.setTag("request_id", String(ctx.requestId));
      if (ctx.route) scope.setTag("route", String(ctx.route));
      if (ctx.tags && typeof ctx.tags === "object") {
        for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, String(v));
      }
      if (ctx.extras && typeof ctx.extras === "object") {
        for (const [k, v] of Object.entries(ctx.extras)) scope.setExtra(k, v);
      }
      sentryClient.captureException(err);
    });
  } catch {
    // Never let observability break the app.
  }
}
