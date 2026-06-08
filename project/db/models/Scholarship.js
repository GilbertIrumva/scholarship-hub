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

module.exports = model('Scholarship', scholarshipSchema);
