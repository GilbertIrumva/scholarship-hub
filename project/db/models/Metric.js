// T4.1 — Lightweight Core Web Vitals telemetry collection.
// Capped at 7 days via TTL index on `createdAt` so we never accumulate
// unbounded volume from anonymous browser pings.
const mongoose = require('mongoose');

const MetricSchema = new mongoose.Schema(
    {
        // CLS / LCP / INP / TTFB / FCP — clamp to a small enum so junk
        // payloads can't pollute the collection.
        name: {
            type: String,
            required: true,
            enum: ['CLS', 'LCP', 'INP', 'TTFB', 'FCP'],
            index: true,
        },
        value: { type: Number, required: true, min: 0 },
        rating: {
            type: String,
            enum: ['good', 'needs-improvement', 'poor', 'unknown'],
            default: 'unknown',
        },
        navigationType: { type: String, default: null },
        // Sanitised path only (no query string, no fragment).
        path: { type: String, default: null, maxlength: 256 },
        // Truncated UA + IP for coarse aggregation; we never key on them.
        userAgent: { type: String, default: null, maxlength: 256 },
        ip: { type: String, default: null, maxlength: 64 },
        createdAt: {
            type: Date,
            default: () => new Date(),
            // 7-day TTL — Mongo drops stale docs automatically.
            expires: 60 * 60 * 24 * 7,
        },
    },
    { versionKey: false },
);

module.exports = mongoose.models.Metric || mongoose.model('Metric', MetricSchema);
