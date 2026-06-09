import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Admin, Scholar, Session } = require('../db/models');

// Re-derive the password record the same way the API does, so we can seed
// admins / scholars without standing up the full sign-up route.
const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

describe('admin auth flow', () => {
    const PASSWORD = 'StrongPassw0rd!';
    const DEPT_CODE = 'DEPT-42';
    let admin;

    beforeEach(async () => {
        admin = await Admin.create({
            name: 'Test Admin',
            email: 'admin@example.com',
            role: 'administrator',
            department: 'Programs',
            departmentCode: DEPT_CODE,
            twoFactorCode: 'TFA-12345',
            ...makePasswordRecord(PASSWORD),
        });
    });

    it('rejects sign-in with missing credentials (400)', async () => {
        const res = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({});
        expect(res.status).toBe(400);
    });

    it('rejects sign-in with wrong password (401)', async () => {
        const res = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: 'nope-nope' });
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid/i);
    });

    it('issues a challenge on valid credentials and persists it in mongo', async () => {
        const res = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('challengeId');
        expect(res.body.admin.email).toBe(admin.email);

        const stored = await Session.findOne({ token: res.body.challengeId });
        expect(stored).toBeTruthy();
        expect(stored.kind).toBe('admin-challenge');
        expect(String(stored.principalId)).toBe(String(admin._id));
    });

    it('completes 2FA verification with the department code and returns a session token', async () => {
        const signin = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: PASSWORD });
        const { challengeId } = signin.body;

        const verify = await request(app)
            .post('/api/auth/admin/verify')
            .send({ challengeId, verificationCode: DEPT_CODE });
        expect(verify.status).toBe(200);
        expect(verify.body).toHaveProperty('sessionToken');

        // Challenge was consumed.
        expect(await Session.findOne({ token: challengeId })).toBeNull();
        // Real session was issued.
        const session = await Session.findOne({ token: verify.body.sessionToken });
        expect(session).toBeTruthy();
        expect(session.kind).toBe('admin');
    });

    it('rejects 2FA with an invalid code (401)', async () => {
        const signin = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: PASSWORD });
        const res = await request(app)
            .post('/api/auth/admin/verify')
            .send({ challengeId: signin.body.challengeId, verificationCode: 'WRONG' });
        expect(res.status).toBe(401);
    });
});

describe('admin RBAC', () => {
    it('GET /api/auth/admin/dashboard without a token returns 401', async () => {
        const res = await request(app).get('/api/auth/admin/dashboard');
        expect(res.status).toBe(401);
    });

    it('GET /api/auth/admin/dashboard with a scholar token returns 401', async () => {
        const scholar = await Scholar.create({
            name: 'A Scholar',
            email: 'scholar@example.com',
            role: 'student',
            ...makePasswordRecord('StrongPassw0rd!'),
        });
        const session = await Session.create({
            token: crypto.randomUUID(),
            kind: 'scholar',
            principalId: scholar._id,
            expiresAt: new Date(Date.now() + 60_000),
        });
        const res = await request(app)
            .get('/api/auth/admin/dashboard')
            .set('Authorization', `Bearer ${session.token}`);
        expect(res.status).toBe(401);
    });
});

describe('scholar sign-up', () => {
    it('rejects a short password (400)', async () => {
        const res = await request(app)
            .post('/api/auth/student/sign-up')
            .send({ name: 'Bob', email: 'bob@example.com', password: 'short' });
        expect(res.status).toBe(400);
    });

    it('creates a scholar + returns a session token', async () => {
        const res = await request(app)
            .post('/api/auth/student/sign-up')
            .send({ name: 'Bob', email: 'bob@example.com', password: 'StrongPassw0rd!' });
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('sessionToken');
        expect(res.body.scholar.email).toBe('bob@example.com');

        const stored = await Scholar.findOne({ email: 'bob@example.com' });
        expect(stored).toBeTruthy();
        // Password is hashed, not stored in plain text.
        expect(stored.passwordHash).toBeTruthy();
        expect(stored.passwordHash).not.toBe('StrongPassw0rd!');

        const session = await Session.findOne({ token: res.body.sessionToken });
        expect(session.kind).toBe('scholar');
    });

    it('rejects duplicate emails (409)', async () => {
        await Scholar.create({
            name: 'Existing',
            email: 'dup@example.com',
            role: 'student',
            ...makePasswordRecord('StrongPassw0rd!'),
        });
        const res = await request(app)
            .post('/api/auth/student/sign-up')
            .send({ name: 'Dup', email: 'dup@example.com', password: 'StrongPassw0rd!' });
        expect(res.status).toBe(409);
    });
});
