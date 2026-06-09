import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Admin, Scholar, Session, AuditLog } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

// Wait until at least `n` audit entries exist for the given action; audit
// writes are fire-and-forget so we cannot assume they're flushed yet.
const waitForAudit = async (filter, atLeast = 1, attempts = 20) => {
    for (let i = 0; i < attempts; i++) {
        const count = await AuditLog.countDocuments(filter);
        if (count >= atLeast) return count;
        await new Promise((r) => setTimeout(r, 25));
    }
    return AuditLog.countDocuments(filter);
};

describe('audit log: auth events', () => {
    let admin;
    const PASSWORD = 'StrongPassw0rd!';
    const DEPT = 'DEPT-AUDIT';

    beforeEach(async () => {
        admin = await Admin.create({
            name: 'Audit Admin',
            email: 'audit@example.com',
            role: 'administrator',
            department: 'Programs',
            departmentCode: DEPT,
            twoFactorCode: 'TFA-AUDIT-001',
            ...makePasswordRecord(PASSWORD),
        });
    });

    it('records a failure on bad admin password', async () => {
        await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: 'wrong-one' });
        const count = await waitForAudit({ action: 'admin.sign-in', outcome: 'failure' });
        expect(count).toBeGreaterThanOrEqual(1);
    });

    it('records sign-in.challenge-issued + admin.sign-in on the full 2FA flow', async () => {
        const signin = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: PASSWORD });
        await request(app)
            .post('/api/auth/admin/verify')
            .send({ challengeId: signin.body.challengeId, verificationCode: DEPT });

        const challengeCount = await waitForAudit({ action: 'admin.sign-in.challenge-issued' });
        const successCount = await waitForAudit({ action: 'admin.sign-in', outcome: 'success' });
        expect(challengeCount).toBeGreaterThanOrEqual(1);
        expect(successCount).toBeGreaterThanOrEqual(1);
    });

    it('records scholar.sign-up on new account creation', async () => {
        await request(app)
            .post('/api/auth/student/sign-up')
            .send({ name: 'Aud', email: 'aud@example.com', password: 'StrongPassw0rd!' });
        const count = await waitForAudit({ action: 'scholar.sign-up' });
        expect(count).toBeGreaterThanOrEqual(1);
    });
});

describe('GET /api/auth/admin/audit-log', () => {
    let admin;
    let adminToken;
    const PASSWORD = 'StrongPassw0rd!';

    beforeEach(async () => {
        admin = await Admin.create({
            name: 'Viewer',
            email: 'viewer@example.com',
            role: 'administrator',
            department: 'Programs',
            departmentCode: 'DEPT-VIEW',
            twoFactorCode: 'TFA-VIEW-001',
            ...makePasswordRecord(PASSWORD),
        });
        const session = await Session.create({
            token: crypto.randomUUID(),
            kind: 'admin',
            principalId: admin._id,
            expiresAt: new Date(Date.now() + 60_000),
        });
        adminToken = session.token;

        // Seed deterministic audit entries spread across time.
        const base = Date.now();
        const docs = [];
        for (let i = 0; i < 5; i++) {
            docs.push({
                action: i % 2 === 0 ? 'test.alpha' : 'test.beta',
                actor: { kind: 'admin', id: admin._id, email: admin.email },
                outcome: i === 4 ? 'failure' : 'success',
                createdAt: new Date(base - i * 1000),
            });
        }
        await AuditLog.insertMany(docs);
    });

    it('requires an admin session (401 without token)', async () => {
        const res = await request(app).get('/api/auth/admin/audit-log');
        expect(res.status).toBe(401);
    });

    it('returns entries newest first with default limit', async () => {
        const res = await request(app)
            .get('/api/auth/admin/audit-log')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.items)).toBe(true);
        expect(res.body.items.length).toBeGreaterThanOrEqual(5);
        // Sorted newest first.
        for (let i = 1; i < res.body.items.length; i++) {
            const prev = new Date(res.body.items[i - 1].createdAt).getTime();
            const curr = new Date(res.body.items[i].createdAt).getTime();
            expect(prev).toBeGreaterThanOrEqual(curr);
        }
    });

    it('filters by action', async () => {
        const res = await request(app)
            .get('/api/auth/admin/audit-log?action=test.alpha')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.items.every((e) => e.action === 'test.alpha')).toBe(true);
    });

    it('filters by outcome=failure', async () => {
        const res = await request(app)
            .get('/api/auth/admin/audit-log?outcome=failure')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body.items.every((e) => e.outcome === 'failure')).toBe(true);
    });

    it('paginates via cursor', async () => {
        const first = await request(app)
            .get('/api/auth/admin/audit-log?limit=2')
            .set('Authorization', `Bearer ${adminToken}`);
        expect(first.status).toBe(200);
        expect(first.body.items.length).toBe(2);
        expect(first.body.nextCursor).toBeTruthy();

        const second = await request(app)
            .get(`/api/auth/admin/audit-log?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(second.status).toBe(200);
        expect(second.body.items.length).toBeGreaterThan(0);
        // No overlap with page 1.
        const page1Ids = new Set(first.body.items.map((e) => e._id));
        for (const item of second.body.items) {
            expect(page1Ids.has(item._id)).toBe(false);
        }
    });
});
