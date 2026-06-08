const { Schema, model, Types } = require('mongoose');

const applicationSchema = new Schema(
    {
        legacyId: { type: Number, index: true },
        scholar: { type: Types.ObjectId, ref: 'Scholar', default: null },
        scholarship: { type: Types.ObjectId, ref: 'Scholarship', default: null },
        name: { type: String, required: true, trim: true },
        nationality: { type: String, default: '' },
        status: { type: String, default: '' },
        education: { type: String, default: '' },
        contact: { type: String, default: '' },
        age: { type: Number, default: null },
        gender: { type: String, default: '' },
        dateOfBirth: { type: String, default: '' },
        address: { type: String, default: '' },
        bio: { type: String, default: '' },
        photo: { type: String, default: '' },
        reviewStatus: {
            type: String,
            enum: ['pending', 'under-review', 'approved', 'rejected'],
            default: 'pending',
        },
    },
    { timestamps: true }
);

module.exports = model('Application', applicationSchema);
