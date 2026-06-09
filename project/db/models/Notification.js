const { Schema, model, Types } = require('mongoose');

/**
 * In-app notifications. Backend writes; users read + mark-read via the
 * scholar/admin notification endpoints. Kept intentionally minimal: a single
 * collection with a `recipient.{kind,id}` discriminator so both scholars and
 * admins share the same UI pattern.
 *
 * Notification kinds (extend as needed):
 *   - 'application.status'  — your application moved to under-review / approved / rejected
 *   - 'message.reply'       — admin replied to your contact message
 *   - 'scholarship.new'     — a scholarship matching your profile was added
 *   - 'admin.message.new'   — new contact message arrived for admins
 *   - 'admin.audit.alert'   — significant audit event (e.g. repeated sign-in failures)
 *
 * `data` is a free-form Mixed payload so handlers can stash entity ids / URLs
 * without needing a schema migration for every new event type.
 */
const notificationSchema = new Schema(
    {
        recipient: {
            kind: {
                type: String,
                enum: ['scholar', 'admin'],
                required: true,
            },
            id: { type: Types.ObjectId, required: true, index: true },
        },
        kind: { type: String, required: true, index: true },
        title: { type: String, required: true, trim: true },
        body: { type: String, default: '' },
        url: { type: String, default: '' }, // optional in-app target route
        data: { type: Schema.Types.Mixed, default: {} },
        readAt: { type: Date, default: null, index: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ 'recipient.kind': 1, 'recipient.id': 1, createdAt: -1 });
notificationSchema.index({ 'recipient.kind': 1, 'recipient.id': 1, readAt: 1 });

module.exports = model('Notification', notificationSchema);
