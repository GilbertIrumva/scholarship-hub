const { Schema, model } = require('mongoose');

const adminSchema = new Schema(
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
        role: { type: String, default: 'administrator' },
        department: { type: String, required: true, trim: true },
        departmentCode: { type: String, required: true, trim: true },
        // Legacy static department-issued 2FA PIN. Kept for backward compat
        // with the existing /api/auth/admin/verify challenge flow. The new
        // TOTP fields below (added in T3.4) are the modern second factor.
        twoFactorCode: { type: String, required: true, trim: true },
        passwordSalt: { type: String, required: true },
        passwordHash: { type: String, required: true },
        // TOTP (RFC 6238) second factor — opt-in. The secret is stored
        // encrypted (AES-256-GCM via encryptSecret/decryptSecret in
        // project/index.js). Backup codes are stored as SHA-256 hashes.
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

module.exports = model('Admin', adminSchema);
