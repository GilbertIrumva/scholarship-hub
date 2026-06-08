const { Schema, model } = require('mongoose');

const replySchema = new Schema(
    {
        body: { type: String, required: true },
        sentByName: { type: String, default: '' },
        sentByEmail: { type: String, default: '' },
        deliveredVia: {
            type: String,
            enum: ['smtp', 'log', 'manual'],
            default: 'log',
        },
        deliveryStatus: {
            type: String,
            enum: ['sent', 'failed', 'pending'],
            default: 'sent',
        },
        deliveryError: { type: String, default: '' },
    },
    { timestamps: true }
);

const contactMessageSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true, index: true },
        topic: { type: String, default: 'general', trim: true },
        message: { type: String, required: true },
        status: {
            type: String,
            enum: ['new', 'read', 'replied', 'archived'],
            default: 'new',
            index: true,
        },
        ipAddress: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        readAt: { type: Date, default: null },
        repliedAt: { type: Date, default: null },
        notes: { type: String, default: '' },
        replies: { type: [replySchema], default: [] },
    },
    { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

module.exports = model('ContactMessage', contactMessageSchema);
