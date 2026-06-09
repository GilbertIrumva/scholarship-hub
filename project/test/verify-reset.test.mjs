import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Session, VerificationToken, AuditLog } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

describe('email verification flow', () => {
    let scholar;

    beforeEach(async () => {
        scholar = await Scholar.create({
            name: 'Verify Me',
            email: 'verify@example.com',
            role: 'student',
            ...makePasswordRecord('StrongPassw0rd!'),
        });
    });

    it('issues a verification token on sign-up and marks new scholars unverified', async () => {
        const res = await request(app)
            .post('/api/auth/student/sign-up')
            .send({ name: 'New', email: 'newkid@example.com', password: 'StrongPassw0rd!' });
        expect(res.status).toBe(201);
        expect(res.body.scholar.emailVerified).toBe(false);

        const created = await Scholar.findOne({ email: 'newkid@example.com' });
        expect(created.emailVerified).toBe(false);

        // Give the fire-and-forget verification email a tick to land.
        await new Promise((r) => setTimeout(r, 50));
        const token = await VerificationToken.findOne({
            principalId: created._id,
            kind: 'email-verify',
        });
        expect(token).toBeTruthy();
        expect(token.principalKind).toBe('scholar');
    });

    it('verifies the email when given a valid token (single-use)', async () => {
        const tok = await VerificationToken.create({
            token: crypto.randomUUID(),
            kind: 'email-verify',
            principalKind: 'scholar',
            principalId: scholar._id,
            expiresAt: new Date(Date.now() + 60_000),
        });
        const res = await request(app)
            .post('/api/auth/student/verify-email')
            .send({ token: tok.token });
        expect(res.status).toBe(200);
        expect(res.body.scholar.emailVerified).toBe(true);

        const refreshed = await Scholar.findById(scholar._id);
        expect(refreshed.emailVerified).toBe(true);

        // Token must be single-use: cannot replay.
        const replay = await request(app)
            .post('/api/auth/student/verify-email')
            .send({ token: tok.token });
        expect(replay.status).toBe(410);
    });

    it('rejects an invalid or expired verification token (410)', async () => {
        const res = await request(app)
            .post('/api/auth/student/verify-email')
            .send({ token: 'nope-not-real' });
        expect(res.status).toBe(410);
    });

    it('resend-verification returns 202 even when the email is unknown', async () => {
        const res = await request(app)
            .post('/api/auth/student/resend-verification')
            .send({ email: 'does-not-exist@example.com' });
        expect(res.status).toBe(202);
    });
});

describe('password reset flow', () => {
    let scholar;
    const OLD_PASSWORD = 'OldStrongPassw0rd!';
    const NEW_PASSWORD = 'NewStrongPassw0rd!';

    beforeEach(async () => {
        scholar = await Scholar.create({
            name: 'Reset Me',
            email: 'reset@example.com',
            role: 'student',
            ...makePasswordRecord(OLD_PASSWORD),
        });
    });

    it('forgot-password returns 202 regardless of whether the email exists', async () => {
        const known = await request(app)
            .post('/api/auth/student/forgot-password')
            .send({ email: scholar.email });
        const unknown = await request(app)
            .post('/api/auth/student/forgot-password')
            .send({ email: 'never-heard-of-you@example.com' });
        expect(known.status).toBe(202);
        expect(unknown.status).toBe(202);
    });

    it('issues a reset token for known emails (and not for unknown ones)', async () => {
        await request(app)
            .post('/api/auth/student/forgot-password')
            .send({ email: scholar.email });
        const known = await VerificationToken.findOne({
            principalId: scholar._id,
            kind: 'password-reset',
        });
        expect(known).toBeTruthy();

        await request(app)
            .post('/api/auth/student/forgot-password')
            .send({ email: 'ghost@example.com' });
        const unknownCount = await VerificationToken.countDocuments({ kind: 'password-reset' });
        expect(unknownCount).toBe(1);
    });

    it('resets the password and invalidates existing scholar sessions', async () => {
        // Pre-create a session that should be killed.
        await Session.create({
            token: crypto.randomUUID(),
            kind: 'scholar',
            principalId: scholar._id,
            expiresAt: new Date(Date.now() + 60_000),
        });

        const tok = await VerificationToken.create({
            token: crypto.randomUUID(),
            kind: 'password-reset',
            principalKind: 'scholar',
            principalId: scholar._id,
            expiresAt: new Date(Date.now() + 60_000),
        });

        const res = await request(app)
            .post('/api/auth/student/reset-password')
            .send({ token: tok.token, password: NEW_PASSWORD });
        expect(res.status).toBe(200);

        // Sessions blown away.
        const remaining = await Session.countDocuments({ kind: 'scholar', principalId: scholar._id });
        expect(remaining).toBe(0);

        // Old password no longer works, new one does.
        const oldTry = await request(app)
            .post('/api/auth/student/sign-in')
            .send({ email: scholar.email, password: OLD_PASSWORD });
        expect(oldTry.status).toBe(401);

        const newTry = await request(app)
            .post('/api/auth/student/sign-in')
            .send({ email: scholar.email, password: NEW_PASSWORD });
        expect(newTry.status).toBe(200);
    });

    it('rejects a short new password (400)', async () => {
        const tok = await VerificationToken.create({
            token: crypto.randomUUID(),
            kind: 'password-reset',
            principalKind: 'scholar',
            principalId: scholar._id,
            expiresAt: new Date(Date.now() + 60_000),
        });
        const res = await request(app)
            .post('/api/auth/student/reset-password')
            .send({ token: tok.token, password: 'short' });
        expect(res.status).toBe(400);
    });
});
