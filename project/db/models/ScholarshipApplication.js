const { Schema, model, Types } = require('mongoose');

/**
 * ScholarshipApplication
 *
 * Captures the full multi-step application a scholar files for a single
 * scholarship. The same document represents both a `draft` (autosaved by the
 * wizard) and the final `submitted` record once the scholar promotes it.
 *
 *  - Uniqueness `{scholar, scholarship}` guarantees one application per
 *    scholar+scholarship pair, so drafts and submissions never duplicate.
 *  - `personalInfo`, `academicInfo`, `documents` capture the rich payload
 *    introduced with the T2.3 wizard. They default to empty so legacy callers
 *    that only send `{motivation}` continue to work.
 *  - `lastStep` records the wizard step the user paused on, enabling
 *    resume-where-you-left-off behaviour.
 *  - `submittedAt` is set the moment a draft is promoted to `submitted`.
 */
const personalInfoSchema = new Schema(
    {
        fullName: { type: String, default: '', trim: true },
        phone: { type: String, default: '', trim: true },
        dateOfBirth: { type: String, default: '', trim: true },
        nationality: { type: String, default: '', trim: true },
        country: { type: String, default: '', trim: true },
        address: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const academicInfoSchema = new Schema(
    {
        currentLevel: { type: String, default: '', trim: true },
        institution: { type: String, default: '', trim: true },
        fieldOfStudy: { type: String, default: '', trim: true },
        gradePoint: { type: String, default: '', trim: true },
        expectedCompletion: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const documentRefSchema = new Schema(
    {
        credentialId: { type: Types.ObjectId, ref: 'AcademicCredential' },
        title: { type: String, default: '', trim: true },
        type: { type: String, default: '', trim: true },
    },
    { _id: false }
);

const scholarshipApplicationSchema = new Schema(
    {
        scholar: { type: Types.ObjectId, ref: 'Scholar', required: true, index: true },
        scholarship: { type: Types.ObjectId, ref: 'Scholarship', required: true, index: true },
        motivation: { type: String, default: '', trim: true },
        status: {
            type: String,
            enum: ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'withdrawn'],
            default: 'submitted',
            index: true,
        },
        personalInfo: { type: personalInfoSchema, default: () => ({}) },
        academicInfo: { type: academicInfoSchema, default: () => ({}) },
        documents: { type: [documentRefSchema], default: [] },
        lastStep: { type: Number, default: 0, min: 0 },
        submittedAt: { type: Date, default: null },
        decisionNote: { type: String, default: '' },
        decidedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

scholarshipApplicationSchema.index({ scholar: 1, scholarship: 1 }, { unique: true });

module.exports = model('ScholarshipApplication', scholarshipApplicationSchema);
