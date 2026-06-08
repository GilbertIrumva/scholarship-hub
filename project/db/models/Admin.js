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
        twoFactorCode: { type: String, required: true, trim: true },
        passwordSalt: { type: String, required: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = model('Admin', adminSchema);
