const { Schema, model } = require('mongoose');

/**
 * Session — persistent, TTL-backed auth state for ScholarshipZone.
 *
 * Replaces the in-memory Map()-based stores that did not survive process
 * restarts and could not scale beyond a single Node instance.
 *
 * `kind` discriminates between four uses of the same collection:
 *   - 'admin-challenge'    Short-lived 2FA challenge after admin sign-in.
 *   - 'scholar-challenge'  Short-lived 2FA challenge after scholar sign-in (T3.4).
 *   - 'admin'              Issued after the admin completes 2FA verification.
 *   - 'scholar'            Issued on scholar sign-in / sign-up.
 *
 * Sliding-session model (T3.3):
 *   `token` is a SHORT-LIVED access token (default 15 min, see ACCESS_TTL_MS
 *   in index.js). When it expires, the client calls POST /api/auth/refresh
 *   with the httpOnly `sz_rt` cookie. The server hashes the cookie value and
 *   looks it up against `refreshTokenHash`. On a hit the entire session is
 *   rotated: a new access token + a new refresh token are issued, the old
 *   refresh hash is moved into `previousRefreshHash`, and `refreshExpiresAt`
 *   slides forward. If a subsequent request presents the previous (already
 *   rotated) refresh token, that constitutes token reuse — the session is
 *   destroyed and a `*.session.reuse_detected` audit event is recorded.
 *
 * The Mongo TTL monitor uses `expiresAt` (which is set to the LATER of access
 * and refresh expirations) so each session document is purged automatically
 * after its refresh window ends.
 */
const sessionSchema = new Schema(
    {
        // The opaque bearer access token used by the client. Lookup key.
        token: { type: String, required: true, unique: true, index: true },

        kind: {
            type: String,
            required: true,
            enum: ['admin-challenge', 'scholar-challenge', 'admin', 'scholar'],
            index: true,
        },

        // Reference to the owning principal. ObjectId of an Admin or Scholar.
        principalId: { type: Schema.Types.ObjectId, required: true, index: true },

        // Mongo TTL index: documents expire automatically after this instant.
        // For sliding sessions (T3.3) this tracks the REFRESH expiry, which
        // is always >= access expiry. Legacy rows (pre-T3.3) set this to the
        // access expiry directly.
        expiresAt: { type: Date, required: true, index: { expires: 0 } },

        // ----- Sliding-session fields (T3.3) ---------------------------------
        // Access-token expiry. Optional for backward compat — when missing
        // (legacy session) the auth middleware falls back to `expiresAt`.
        accessExpiresAt: { type: Date },

        // SHA-256(refreshToken) — hex digest. Indexed for fast /refresh lookup.
        // Optional: admin-challenge sessions never get a refresh token.
        refreshTokenHash: { type: String, index: true, sparse: true },

        // When the current refresh token stops being valid.
        refreshExpiresAt: { type: Date },

        // The hash of the just-rotated refresh token. If this value is ever
        // presented to /refresh, that means an attacker is replaying a stolen
        // token after the legitimate client already rotated — we revoke.
        previousRefreshHash: { type: String, index: true, sparse: true },

        // Wall-clock of the most recent successful access/refresh. Powers the
        // T3.4 device management UI.
        lastActiveAt: { type: Date },

        // Bumped every time the session is rotated. Diagnostic / forensic.
        rotationCount: { type: Number, default: 0 },

        // Optional forensic metadata.
        ip: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);

module.exports = model('Session', sessionSchema);
