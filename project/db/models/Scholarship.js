const { Schema, model } = require('mongoose');

const scholarshipSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        provider: { type: String, default: '' },
        description: { type: String, default: '' },
        amount: { type: Number, default: 0 },
        currency: { type: String, default: 'USD' },
        eligibility: { type: String, default: '' },
        deadline: { type: Date, default: null },
        countries: [{ type: String }],
        grades: [{ type: String }],
        fields: [{ type: String }],
        tags: [{ type: String }],
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Common access patterns:
//   - Public catalog filters by `active`, often combined with `deadline`.
//   - Country / field / tag filters use $in over the array columns.
//   - Free-text search runs across title + provider + description.
scholarshipSchema.index({ active: 1, deadline: 1 });
scholarshipSchema.index({ countries: 1 });
scholarshipSchema.index({ fields: 1 });
scholarshipSchema.index({ tags: 1 });
scholarshipSchema.index(
    { title: 'text', provider: 'text', description: 'text' },
    { name: 'ScholarshipTextIndex', default_language: 'english' }
);

module.exports = model('Scholarship', scholarshipSchema);
