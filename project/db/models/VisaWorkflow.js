const { Schema, model, Types } = require('mongoose');

/**
 * VisaWorkflow — one record per approved scholarship.
 *
 * Each approved ScholarshipApplication can produce exactly one workflow
 * that tracks the visa application end-to-end: documents, appointment,
 * biometrics, interview, decision, issuance.
 *
 * Access rules (enforced in routes):
 *   - Scholar owns and edits their workflow.
 *   - Admin can read all workflows and add timeline notes.
 *   - Workflow can only be created against an Application in status 'approved'.
 */

// Default milestones seeded when a workflow is first created. Scholars
// can mark each one done, set a due date, and attach a short note.
const DEFAULT_MILESTONES = [
    { key: 'collect-documents',   label: 'Collect required documents' },
    { key: 'financial-proof',     label: 'Prepare financial proof' },
    { key: 'book-appointment',    label: 'Book embassy appointment' },
    { key: 'pay-visa-fee',        label: 'Pay visa fee' },
    { key: 'biometrics',          label: 'Complete biometrics' },
    { key: 'interview',           label: 'Attend visa interview' },
    { key: 'submit-application',  label: 'Submit visa application' },
    { key: 'decision',            label: 'Receive decision' },
    { key: 'visa-issued',         label: 'Visa issued / collected' },
];

const milestoneSchema = new Schema(
    {
        key: { type: String, required: true, maxlength: 60 },
        label: { type: String, required: true, maxlength: 200 },
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'done', 'blocked', 'skipped'],
            default: 'pending',
        },
        dueDate: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        note: { type: String, default: '', maxlength: 500 },
    },
    { _id: false }
);

const timelineNoteSchema = new Schema(
    {
        body: { type: String, required: true, maxlength: 1000 },
        author: {
            type: String,
            enum: ['scholar', 'admin'],
            required: true,
        },
        authorName: { type: String, default: '', maxlength: 200 },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: true }
);

const visaWorkflowSchema = new Schema(
    {
        scholar: { type: Types.ObjectId, ref: 'Scholar', required: true, index: true },
        scholarshipApplication: {
            type: Types.ObjectId,
            ref: 'ScholarshipApplication',
            required: true,
            unique: true,
            index: true,
        },

        // Where the scholar is going.
        destinationCountry: { type: String, trim: true, uppercase: true, maxlength: 3, default: '' },
        visaType: {
            type: String,
            enum: ['student', 'exchange', 'research', 'training', 'other'],
            default: 'student',
        },

        // Overall workflow status — derived from milestones but also
        // settable manually for cases that don't fit the default flow.
        status: {
            type: String,
            enum: [
                'not-started',
                'in-progress',
                'submitted',
                'approved',
                'rejected',
                'completed',
                'on-hold',
            ],
            default: 'not-started',
            index: true,
        },

        // Embassy / consulate contact info.
        embassy: {
            country: { type: String, trim: true, uppercase: true, maxlength: 3, default: '' },
            city: { type: String, trim: true, maxlength: 100, default: '' },
            address: { type: String, trim: true, maxlength: 300, default: '' },
            website: { type: String, trim: true, maxlength: 300, default: '' },
            contactEmail: { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
        },

        // Key dates.
        appointmentDate: { type: Date, default: null },
        submittedAt: { type: Date, default: null },
        decisionAt: { type: Date, default: null },
        visaIssuedAt: { type: Date, default: null },
        visaExpiry: { type: Date, default: null, index: true },

        // Visa reference (not encrypted — admins routinely need it for
        // travel coordination; sensitive identity numbers live in
        // TravelDocument with AES-256-GCM).
        visaReference: { type: String, trim: true, maxlength: 100, default: '' },

        // Workflow steps and shared notes timeline.
        milestones: { type: [milestoneSchema], default: () => DEFAULT_MILESTONES.map((m) => ({ ...m })) },
        timeline: { type: [timelineNoteSchema], default: [] },
    },
    { timestamps: true }
);

visaWorkflowSchema.statics.DEFAULT_MILESTONES = DEFAULT_MILESTONES;

module.exports = model('VisaWorkflow', visaWorkflowSchema);
