const { Schema, model, Types } = require('mongoose');

/**
 * TravelDocument — sensitive identity/travel documents (passport, visa,
 * insurance, vaccination certificate) that a scholar needs once a
 * scholarship has been awarded.
 *
 * Access rules (enforced in routes, not the model):
 *   - The owning scholar can always read/write their own docs.
 *   - Admins can only read travel docs belonging to a scholar who has
 *     at least one ScholarshipApplication in status 'approved'.
 *
 * Encryption:
 *   - The file binary lives on disk (same pattern as AcademicCredential).
 *   - The plaintext document NUMBER is never persisted. We keep
 *     `documentNumberEncrypted` (ciphertext + iv + auth tag) and only
 *     decrypt on the server when an authorised caller asks for it.
 */
const travelDocumentSchema = new Schema(
    {
        scholar: { type: Types.ObjectId, ref: 'Scholar', required: true, index: true },

        type: {
            type: String,
            enum: ['passport', 'visa', 'travel-insurance', 'vaccination', 'other-travel'],
            required: true,
            index: true,
        },

        // Human-friendly label (e.g. "Nigerian passport", "F-1 US visa").
        title: { type: String, required: true, trim: true, maxlength: 200 },

        // Issuing country (ISO-3166 alpha-2 or alpha-3, uppercase).
        country: { type: String, trim: true, uppercase: true, maxlength: 3, default: '' },

        // Document number — STORED ENCRYPTED. Never write plaintext here.
        documentNumberEncrypted: {
            ciphertext: { type: String, default: '' }, // base64
            iv: { type: String, default: '' },         // base64 (12 bytes for GCM)
            authTag: { type: String, default: '' },    // base64 (16 bytes)
        },

        // Last 4 chars of the plaintext doc number — safe to display as a hint.
        documentNumberLast4: { type: String, default: '', maxlength: 4 },

        issuedDate: { type: Date, default: null },
        expiryDate: { type: Date, default: null, index: true },

        // ----- File metadata (binary lives on disk) -------------------------
        originalName: { type: String, required: true, maxlength: 300 },
        // For backend='local' this is a path under project/uploads.
        // For backend='s3' this is the object key inside S3_BUCKET.
        storagePath: { type: String, required: true, maxlength: 500 },
        storageBackend: { type: String, enum: ['local', 's3'], default: 'local', index: true },
        mimeType: { type: String, required: true, maxlength: 120 },
        sizeBytes: { type: Number, required: true, min: 0 },

        // ----- Review state (mirrors AcademicCredential) --------------------
        verificationStatus: {
            type: String,
            enum: ['unverified', 'pending', 'verified', 'rejected'],
            default: 'unverified',
            index: true,
        },
        verificationNote: { type: String, default: '', maxlength: 1000 },
        verifiedBy: { type: Types.ObjectId, ref: 'Admin', default: null },
        verifiedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

travelDocumentSchema.index({ scholar: 1, type: 1, createdAt: -1 });

module.exports = model('TravelDocument', travelDocumentSchema);
