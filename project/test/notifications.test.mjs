import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Admin, Session, Notification, Application, Scholarship, ContactMessage } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

const createSignedInScholar = async () => {
    const scholar = await Scholar.create({
        name: 'Notif Scholar',
        email: `notif-${crypto.randomUUID()}@example.com`,
        role: 'student',
        ...makePasswordRecord('StrongPassw0rd!'),
    });
    const token = crypto.randomUUID();
    await Session.create({
        token,
        kind: 'scholar',
        principalId: scholar._id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { scholar, token };
};

const createSignedInAdmin = async () => {
    const admin = await Admin.create({
        name: 'Notif Admin',
        email: `admin-${crypto.randomUUID()}@example.com`,
        department: 'Operations',
        departmentCode: 'OPS',
        twoFactorCode: '000000',
        ...makePasswordRecord('Admin12345!'),
    });
    const token = crypto.randomUUID();
    await Session.create({
        token,
        kind: 'admin',
        principalId: admin._id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { admin, token };
};

const waitFor = async (predicate, { attempts = 20, intervalMs = 25 } = {}) => {
    for (let i = 0; i < attempts; i += 1) {
        const result = await predicate();
        if (result) return result;
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    return predicate();
};

describe('Notification endpoints', () => {
    it('rejects scholar list without session', async () => {
        const res = await request(app).get('/api/auth/student/notifications');
        expect(res.status).toBe(401);
    });

    it('rejects admin list without session', async () => {
        const res = await request(app).get('/api/auth/admin/notifications');
        expect(res.status).toBe(401);
    });

    it('lists scholar notifications newest first with unread count', async () => {
        const { scholar, token } = await createSignedInScholar();
        await Notification.create([
            {
                recipient: { kind: 'scholar', id: scholar._id },
                kind: 'message.reply',
                title: 'Old reply',
            },
            {
                recipient: { kind: 'scholar', id: scholar._id },
                kind: 'scholarship.new',
                title: 'New scholarship',
            },
            // A notification for someone else must NOT leak.
            {
                recipient: { kind: 'scholar', id: (await createSignedInScholar()).scholar._id },
                kind: 'message.reply',
                title: 'Leak test',
            },
        ]);
        const res = await request(app)
            .get('/api/auth/student/notifications')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(2);
        expect(res.body.items[0].title).toBe('New scholarship');
        expect(res.body.unread).toBe(2);
    });

    it('marks a single notification as read', async () => {
        const { scholar, token } = await createSignedInScholar();
        const n = await Notification.create({
            recipient: { kind: 'scholar', id: scholar._id },
            kind: 'message.reply',
            title: 'Hello',
        });
        const res = await request(app)
            .post(`/api/auth/student/notifications/${n._id}/read`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.notification.readAt).toBeTruthy();
        // unread count should now be zero
        const list = await request(app)
            .get('/api/auth/student/notifications')
            .set('Authorization', `Bearer ${token}`);
        expect(list.body.unread).toBe(0);
    });

    it('cannot mark another scholar\'s notification as read', async () => {
        const { token: tokenA } = await createSignedInScholar();
        const { scholar: scholarB } = await createSignedInScholar();
        const foreign = await Notification.create({
            recipient: { kind: 'scholar', id: scholarB._id },
            kind: 'message.reply',
            title: 'Not yours',
        });
        const res = await request(app)
            .post(`/api/auth/student/notifications/${foreign._id}/read`)
            .set('Authorization', `Bearer ${tokenA}`);
        expect(res.status).toBe(404);
    });

    it('read-all marks every unread scholar notification', async () => {
        const { scholar, token } = await createSignedInScholar();
        await Notification.create([
            { recipient: { kind: 'scholar', id: scholar._id }, kind: 'message.reply', title: 'a' },
            { recipient: { kind: 'scholar', id: scholar._id }, kind: 'message.reply', title: 'b' },
            { recipient: { kind: 'scholar', id: scholar._id }, kind: 'message.reply', title: 'c' },
        ]);
        const res = await request(app)
            .post('/api/auth/student/notifications/read-all')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.modified).toBe(3);
    });

    it('unreadOnly=true filters out read items', async () => {
        const { scholar, token } = await createSignedInScholar();
        await Notification.create([
            { recipient: { kind: 'scholar', id: scholar._id }, kind: 'a', title: 'unread' },
            {
                recipient: { kind: 'scholar', id: scholar._id },
                kind: 'b',
                title: 'read',
                readAt: new Date(),
            },
        ]);
        const res = await request(app)
            .get('/api/auth/student/notifications?unreadOnly=true')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].title).toBe('unread');
    });
});

describe('Event hooks fan out notifications', () => {
    it('notifies admins when a new contact message is submitted', async () => {
        const { admin } = await createSignedInAdmin();
        await request(app)
            .post('/api/public/contact')
            .send({
                name: 'Visitor',
                email: 'visitor@example.com',
                topic: 'support',
                message: 'I need help applying.',
            });
        const found = await waitFor(() =>
            Notification.findOne({
                'recipient.kind': 'admin',
                'recipient.id': admin._id,
                kind: 'admin.message.new',
            })
        );
        expect(found).toBeTruthy();
        expect(found.title).toMatch(/Visitor/);
        expect(found.url).toBe('/admin/messages');
    });

    it('notifies the matching scholar when an admin replies to their contact message', async () => {
        const { admin, token: adminToken } = await createSignedInAdmin();
        const { scholar } = await createSignedInScholar();
        const msg = await ContactMessage.create({
            name: scholar.name,
            email: scholar.email,
            topic: 'general',
            message: 'Question',
            status: 'new',
            replies: [],
        });
        const res = await request(app)
            .post(`/api/auth/admin/messages/${msg._id}/reply`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ body: 'Here is the answer.' });
        expect(res.status).toBe(200);
        const found = await waitFor(() =>
            Notification.findOne({
                'recipient.kind': 'scholar',
                'recipient.id': scholar._id,
                kind: 'message.reply',
            })
        );
        expect(found).toBeTruthy();
        // Just make sure admin object referenced exists (no crash path)
        expect(admin._id).toBeTruthy();
    });

    it('notifies matching scholars when a new scholarship is added', async () => {
        const { token: adminToken } = await createSignedInAdmin();
        const { scholar } = await createSignedInScholar();
        // Give the scholar a matching profile.
        const application = await Application.create({
            name: scholar.name,
            scholar: scholar._id,
            nationality: 'Rwanda',
            education: 'Undergraduate, year 2',
            bio: 'Engineering and stem are my passion',
        });
        scholar.application = application._id;
        await scholar.save();

        const res = await request(app)
            .post('/api/scholarships/catalog')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Rwanda STEM Scholars',
                active: true,
                countries: ['Rwanda'],
                grades: ['undergraduate'],
                fields: ['engineering', 'stem'],
                deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            });
        expect(res.status).toBe(201);
        const found = await waitFor(() =>
            Notification.findOne({
                'recipient.kind': 'scholar',
                'recipient.id': scholar._id,
                kind: 'scholarship.new',
            })
        );
        expect(found).toBeTruthy();
        expect(found.title).toMatch(/Rwanda STEM Scholars/);
        // Bare-existence of Scholarship record
        const sc = await Scholarship.findOne({ title: 'Rwanda STEM Scholars' });
        expect(sc).toBeTruthy();
    });

    it('does NOT notify scholars whose profile does not match', async () => {
        const { token: adminToken } = await createSignedInAdmin();
        const { scholar } = await createSignedInScholar();
        const application = await Application.create({
            name: scholar.name,
            scholar: scholar._id,
            nationality: 'Norway',
            education: 'PhD',
            bio: 'astrophysics',
        });
        scholar.application = application._id;
        await scholar.save();

        await request(app)
            .post('/api/scholarships/catalog')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Rwanda Only Undergrad',
                active: true,
                countries: ['Rwanda'],
                grades: ['undergraduate'],
                fields: ['agriculture'],
                deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            });
        // Wait a beat, then assert no notification was created.
        await new Promise((r) => setTimeout(r, 150));
        const count = await Notification.countDocuments({
            'recipient.kind': 'scholar',
            'recipient.id': scholar._id,
            kind: 'scholarship.new',
        });
        expect(count).toBe(0);
    });
});
