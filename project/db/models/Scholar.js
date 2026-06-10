const { Schema, model, Types } = require('mongoose');

const scholarSchema = new Schema(
    {
        legacyId: { type: Number, index: true },
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        role: { type: String, default: 'student' },
        application: { type: Types.ObjectId, ref: 'Application', default: null },
        savedScholarships: [
            { type: Types.ObjectId, ref: 'Scholarship', default: [] },
        ],
        // Password is optional for accounts created via OAuth providers.
        passwordSalt: { type: String, default: '' },
        passwordHash: { type: String, default: '' },
        // OAuth identity providers. Sparse unique index so multiple accounts
        // without a googleId do not collide. We deliberately do NOT set a
        // `default` here — sparse indexes only skip docs where the field is
        // truly absent (undefined). A `default: null` would store `null` and
        // trigger E11000 on the second password-only signup.
        googleId: { type: String, index: { unique: true, sparse: true } },
        avatarUrl: { type: String, default: '' },
        emailVerified: { type: Boolean, default: false, index: true },
        emailVerifiedAt: { type: Date, default: null },
        // TOTP (RFC 6238) second factor — opt-in (T3.4). Secret stored
        // encrypted via AES-256-GCM (encryptSecret in project/index.js).
        // Backup codes hashed with SHA-256.
        totpSecret: {
            ciphertext: { type: String, default: '' },
            iv: { type: String, default: '' },
            authTag: { type: String, default: '' },
        },
        totpEnabled: { type: Boolean, default: false, index: true },
        totpBackupCodes: [
            {
                hash: { type: String, required: true },
                usedAt: { type: Date, default: null },
            },
        ],
    },
    { timestamps: true }
);

module.exports = model('Scholar', scholarSchema);
