const { Schema, model } = require('mongoose');

/**
 * VerificationToken — short-lived, single-use tokens for self-service flows.
 *
 * `kind` discriminates between use cases:
 *   - 'email-verify'    Issued on scholar sign-up, consumed by the verify endpoint.
 *   - 'password-reset'  Issued by the forgot-password endpoint, consumed by reset-password.
 *
 * Tokens are random UUIDs; we never store the raw token in any other collection.
 * The Mongo TTL monitor automatically purges documents whose `expiresAt` is in
 * the past, so no application-side sweep loop is needed.
 *
 * `principalKind` lets us reuse the same model for admins later without a
 * second collection. `principalId` references the Admin/Scholar by ObjectId.
 */
const verificationTokenSchema = new Schema(
    {
        token: { type: String, required: true, unique: true, index: true },
        kind: {
            type: String,
            required: true,
            enum: ['email-verify', 'password-reset'],
            index: true,
        },
        principalKind: {
            type: String,
            required: true,
            enum: ['scholar', 'admin'],
        },
        principalId: { type: Schema.Types.ObjectId, required: true, index: true },
        // Mongo TTL index — documents are purged once `expiresAt` is in the past.
        expiresAt: { type: Date, required: true, index: { expires: 0 } },
        // Forensic metadata.
        ip: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);

module.exports = model('VerificationToken', verificationTokenSchema);
