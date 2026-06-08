const { Schema, model, Types } = require('mongoose');

const scholarshipApplicationSchema = new Schema(
    {
        scholar: { type: Types.ObjectId, ref: 'Scholar', required: true, index: true },
        scholarship: { type: Types.ObjectId, ref: 'Scholarship', required: true, index: true },
        motivation: { type: String, default: '', trim: true },
        status: {
            type: String,
            enum: ['submitted', 'under-review', 'approved', 'rejected', 'withdrawn'],
            default: 'submitted',
            index: true,
        },
        decisionNote: { type: String, default: '' },
        decidedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

scholarshipApplicationSchema.index({ scholar: 1, scholarship: 1 }, { unique: true });

module.exports = model('ScholarshipApplication', scholarshipApplicationSchema);
