const { Schema, model } = require('mongoose');

/**
 * AuditLog — append-only record of security- and admin-relevant actions.
 *
 * Designed to answer "who did what, when, to whom?" Useful for incident
 * response, compliance, and on-call triage.
 *
 * Conventions:
 *   - `action` is a dotted slug, e.g. 'admin.sign-in', 'scholar.password-reset',
 *     'admin.message.delete'. Stable strings so dashboards can group on them.
 *   - `actor` describes who initiated the action. `kind: 'system'` is reserved
 *     for cron/background jobs.
 *   - `target` is optional context describing the entity acted upon.
 *   - `metadata` is a free-form object; keep it small and never store secrets.
 *
 * Indexes target the two most common queries:
 *   - "show me the last N events" (createdAt desc)
 *   - "show me everything actor X did" / "everything action Y" (combined index)
 */
const auditLogSchema = new Schema(
    {
        action: { type: String, required: true, index: true },
        actor: {
            kind: {
                type: String,
                required: true,
                enum: ['admin', 'scholar', 'anonymous', 'system'],
                default: 'anonymous',
            },
            id: { type: Schema.Types.ObjectId, default: null },
            email: { type: String, default: null },
        },
        target: {
            kind: { type: String, default: null },
            id: { type: Schema.Types.ObjectId, default: null },
            label: { type: String, default: null },
        },
        outcome: {
            type: String,
            enum: ['success', 'failure'],
            default: 'success',
            index: true,
        },
        metadata: { type: Schema.Types.Mixed, default: {} },
        ip: { type: String, default: null },
        userAgent: { type: String, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ 'actor.id': 1, createdAt: -1 });

module.exports = model('AuditLog', auditLogSchema);
