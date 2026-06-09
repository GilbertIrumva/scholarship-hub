const { Schema, model } = require('mongoose');

/**
 * Session — persistent, TTL-backed auth state for ScholarshipZone.
 *
 * Replaces the in-memory Map()-based stores that did not survive process
 * restarts and could not scale beyond a single Node instance.
 *
 * `kind` discriminates between three uses of the same collection:
 *   - 'admin-challenge'  Short-lived 2FA challenge after admin sign-in.
 *   - 'admin'            Issued after the admin completes 2FA verification.
 *   - 'scholar'          Issued on scholar sign-in / sign-up.
 *
 * The Mongo TTL monitor automatically purges documents whose `expiresAt`
 * is in the past, so no application-side sweep loop is needed.
 */
const sessionSchema = new Schema(
    {
        // The opaque bearer token used by the client. Also the lookup key.
        token: { type: String, required: true, unique: true, index: true },

        kind: {
            type: String,
            required: true,
            enum: ['admin-challenge', 'admin', 'scholar'],
            index: true,
        },

        // Reference to the owning principal. ObjectId of an Admin or Scholar.
        principalId: { type: Schema.Types.ObjectId, required: true, index: true },

        // Mongo TTL index: documents expire automatically after this instant.
        expiresAt: { type: Date, required: true, index: { expires: 0 } },

        // Optional forensic metadata.
        ip: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);

module.exports = model('Session', sessionSchema);
