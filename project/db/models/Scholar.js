const { Schema, model, Types } = require('mongoose');

const scholarSchema = new Schema(
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
        role: { type: String, default: 'student' },
        application: { type: Types.ObjectId, ref: 'Application', default: null },
        passwordSalt: { type: String, required: true },
        passwordHash: { type: String, required: true },
    },
    { timestamps: true }
);

module.exports = model('Scholar', scholarSchema);
