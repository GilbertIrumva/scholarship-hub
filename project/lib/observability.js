// T4.2 — Pluggable error sink.
//
// `captureException(err, ctx)` is the single call-site the rest of the API
// uses to forward unexpected errors to an external tracker. We follow the
// adapter pattern established by `lib/storage.js` and the T2.4 OAuth helpers:
// when `SENTRY_DSN` is unset (the dev + test default) we no-op so local
// development and the test suite stay quiet AND so a missing env var can
// never crash boot.
//
// Sentry is loaded LAZILY via `require` only when actually configured —
// this keeps `@sentry/node` out of the import graph for tests and the
// 99% of dev runs that never need it. The package is a peer dep: if it
// is not installed we silently fall back to the no-op sink.

const { logger } = require('./logger');

let sentryClient = null;
let initialised = false;

function tryInitSentry() {
    if (initialised) return sentryClient;
    initialised = true;
    const dsn = process.env.SENTRY_DSN || '';
    if (!dsn) return null;
    let Sentry;
    try {
        // Lazy require so tests / dev installs don't need the package.
        // eslint-disable-next-line global-require
        Sentry = require('@sentry/node');
    } catch {
        logger.warn(
            'SENTRY_DSN is set but @sentry/node is not installed — error tracking is disabled. Run `npm i @sentry/node` in project/.',
        );
        return null;
    }
    try {
        Sentry.init({
            dsn,
            environment: process.env.NODE_ENV || 'development',
            release: process.env.SENTRY_RELEASE || undefined,
            // Conservative defaults — tracing/profiling are opt-in features
            // that require extra packages and have their own perf cost.
            tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
        });
        sentryClient = Sentry;
        logger.info({ environment: process.env.NODE_ENV || 'development' }, 'Sentry server-side error tracking enabled');
        return Sentry;
    } catch (err) {
        logger.warn({ err: err.message }, 'Sentry init failed — continuing without error tracking');
        return null;
    }
}

/**
 * captureException — forward an error to the configured sink.
 *
 * @param {unknown} err   The thrown value.
 * @param {object} [ctx]  Optional metadata: { requestId, route, principal, tags, extras }
 */
function captureException(err, ctx = {}) {
    if (!err) return;
    const client = tryInitSentry();
    if (!client) return; // graceful no-op when not configured
    try {
        client.withScope((scope) => {
            if (ctx.requestId) scope.setTag('request_id', ctx.requestId);
            if (ctx.route) scope.setTag('route', ctx.route);
            if (ctx.principal) {
                scope.setUser({
                    id: ctx.principal.id ? String(ctx.principal.id) : undefined,
                    // Email is intentionally omitted — PII minimisation. The
                    // request-id + audit log together identify the actor.
                    username: ctx.principal.kind || undefined,
                });
            }
            if (ctx.tags && typeof ctx.tags === 'object') {
                for (const [k, v] of Object.entries(ctx.tags)) scope.setTag(k, String(v));
            }
            if (ctx.extras && typeof ctx.extras === 'object') {
                for (const [k, v] of Object.entries(ctx.extras)) scope.setExtra(k, v);
            }
            client.captureException(err);
        });
    } catch {
        // Never let observability break the request — this code is on the
        // error path already.
    }
}

/**
 * isObservabilityEnabled — exposed for health/readiness probes + tests.
 */
function isObservabilityEnabled() {
    return Boolean(tryInitSentry());
}

module.exports = {
    captureException,
    isObservabilityEnabled,
};
