const { Schema, model, Types } = require('mongoose');

/**
 * AcademicCredential — files (PDF / image) a scholar uploads to prove
 * their academic history: secondary-school certificates, transcripts,
 * national-ID copies, language scores, recommendation letters, etc.
 *
 * Files are stored on disk under project/uploads/credentials/<scholarId>/
 * and the path is kept here as `storagePath`. We never store the raw
 * binary in Mongo.
 *
 * `gradeConversion` is an optional snapshot of the converter result so
 * admins can see (and trust) what the scholar saw at upload time.
 */
const academicCredentialSchema = new Schema(
    {
        scholar: { type: Types.ObjectId, ref: 'Scholar', required: true, index: true },

        // What kind of document is this?
        type: {
            type: String,
            enum: [
                'secondary-certificate',
                'transcript',
                'national-id',
                'passport',
                'language-test',
                'recommendation-letter',
                'cv',
                'other',
            ],
            required: true,
            index: true,
        },

        // Human-friendly label the scholar gave it (e.g. "WAEC June 2024").
        title: { type: String, required: true, trim: true, maxlength: 200 },

        // Country & issuing body context — useful for admins reviewing.
        country: { type: String, trim: true, uppercase: true, maxlength: 3, default: '' },
        issuingBody: { type: String, trim: true, maxlength: 200, default: '' },
        issuedYear: {
            type: Number,
            min: 1950,
            max: 2100,
            default: null,
        },

        // Optional snapshot of a grade conversion run against this credential.
        gradeConversion: {
            systemId: { type: String, default: '' },
            input: { type: String, default: '' },
            percentage: { type: Number, default: null },
            gpa4: { type: Number, default: null },
            ukClass: { type: String, default: '' },
            ects: { type: String, default: '' },
            tier: { type: String, default: '' },
            convertedAt: { type: Date, default: null },
        },

        // ----- File metadata (binary lives on disk) -------------------------
        originalName: { type: String, required: true, maxlength: 300 },
        storagePath: { type: String, required: true, maxlength: 500 },
        mimeType: { type: String, required: true, maxlength: 120 },
        sizeBytes: { type: Number, required: true, min: 0 },

        // ----- Review state -------------------------------------------------
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

// One scholar can have many credentials of the same type (e.g. several
// transcripts), so no unique compound index is needed.
academicCredentialSchema.index({ scholar: 1, type: 1, createdAt: -1 });

module.exports = model('AcademicCredential', academicCredentialSchema);
