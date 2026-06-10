/**
 * audit() — fire-and-forget recorder for the `AuditLog` collection.
 *
 * Designed so route handlers can call it without `await`-ing and without
 * worrying about errors propagating to the user response. If the write
 * fails we log it and move on; auditing must never break the actual flow.
 *
 * Usage:
 *   audit(req, {
 *       action: 'admin.message.delete',
 *       actor: { kind: 'admin', id: req.admin._id, email: req.admin.email },
 *       target: { kind: 'ContactMessage', id: msg._id, label: msg.email },
 *       outcome: 'success',
 *       metadata: { reason: 'spam' },
 *   });
 */
const { AuditLog } = require('../db/models');
const { logger } = require('./logger');

const audit = (req, {
    action,
    actor = { kind: 'anonymous' },
    target = null,
    outcome = 'success',
    metadata = {},
} = {}) => {
    if (!action) return;
    const payload = {
        action,
        actor,
        target: target || { kind: null, id: null, label: null },
        outcome,
        metadata,
        ip: req?.ip || (req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null),
        userAgent: req?.headers?.['user-agent']?.toString().slice(0, 500) || null,
    };
    // Fire and forget — never block the request.
    AuditLog.create(payload).catch((err) => {
        const log = req?.log || logger;
        log.warn({ err: err.message, action, requestId: req?.id }, 'audit write failed');
    });
};

module.exports = { audit };
