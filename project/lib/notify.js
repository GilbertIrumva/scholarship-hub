'use strict';

const { Notification } = require('../db/models');

/**
 * notify(recipient, payload) — fire-and-forget Notification create.
 *
 * Never blocks the caller, never throws — failed inserts are logged via
 * console.warn so a flaky write does not break the user-visible request.
 *
 *   recipient = { kind: 'scholar' | 'admin', id: ObjectId | string }
 *   payload   = { kind, title, body?, url?, data? }
 *
 * Returns the in-flight Promise so callers can opt into awaiting it
 * (mostly used by tests).
 */
const notify = (recipient, payload) => {
    if (!recipient || !recipient.kind || !recipient.id) {
        return Promise.resolve(null);
    }
    if (!payload || !payload.kind || !payload.title) {
        return Promise.resolve(null);
    }
    return Notification.create({
        recipient: { kind: recipient.kind, id: recipient.id },
        kind: payload.kind,
        title: payload.title,
        body: payload.body || '',
        url: payload.url || '',
        data: payload.data || {},
    }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('notify(): failed to persist notification', err && err.message);
        return null;
    });
};

/**
 * notifyAdmins(payload) — fan-out helper that writes one notification per
 * Admin in the DB. Kept simple (no batching) because the admin set is small.
 */
const notifyAdmins = async (payload) => {
    try {
        const { Admin } = require('../db/models');
        const admins = await Admin.find({}, { _id: 1 }).lean();
        await Promise.all(admins.map((a) => notify({ kind: 'admin', id: a._id }, payload)));
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('notifyAdmins(): failed', err && err.message);
    }
};

module.exports = { notify, notifyAdmins };
