// T4.1 — Lightweight Core Web Vitals reporter.
// Dynamically imports `web-vitals` so its bytes stay out of the main bundle
// and are only fetched in production browsers.
//
// Sends each metric to POST /api/_metrics/web-vitals via sendBeacon when
// available (so reports survive page unload), falling back to fetch with
// `keepalive`. All failures are swallowed — telemetry must never break the
// SPA.

const ENDPOINT = "/api/_metrics/web-vitals";

function buildPayload(metric) {
  return {
    name: metric.name,
    value: typeof metric.value === "number" ? metric.value : 0,
    rating: metric.rating || "unknown",
    navigationType: metric.navigationType || null,
    id: metric.id || null,
    path:
      typeof window !== "undefined" && window.location
        ? window.location.pathname
        : null,
  };
}

function send(payload) {
  try {
    const body = JSON.stringify(payload);
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    if (typeof fetch === "function") {
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
        credentials: "omit",
      }).catch(() => {});
    }
  } catch {
    // Never let telemetry surface errors.
  }
}

export function reportWebVitals() {
  if (typeof window === "undefined") return;
  // Skip in unit tests / SSR / non-browser environments.
  if (!("performance" in window)) return;

  import("web-vitals")
    .then(({ onCLS, onLCP, onINP, onTTFB, onFCP }) => {
      const handler = (metric) => send(buildPayload(metric));
      onCLS(handler);
      onLCP(handler);
      onINP(handler);
      onTTFB(handler);
      onFCP(handler);
    })
    .catch(() => {
      // If the chunk fails to load (offline, CSP, etc.), silently no-op.
    });
}
