// project/test/refresh.test.mjs
//
// Tests for the sliding-session refresh + logout endpoints introduced in T3.3.
// Covers the happy path, expiry, reuse detection, and cookie semantics.

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Session } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

// Pull the value of the sz_rt cookie out of a Set-Cookie array.
const extractRefreshCookie = (setCookieHeaders = []) => {
    for (const raw of setCookieHeaders) {
        if (raw && raw.startsWith('sz_rt=')) {
            // The cookie value is everything before the first ';'.
            return raw.split(';')[0].split('=').slice(1).join('=');
        }
    }
    return null;
};

describe('POST /api/auth/refresh', () => {
    const PASSWORD = 'StrongPassw0rd!';
    let scholar;
    let initialAccessToken;
    let initialRefreshCookie;

    beforeEach(async () => {
        scholar = await Scholar.create({
            name: 'Refresh Tester',
            email: 'refresh@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });

        const signIn = await request(app)
            .post('/api/auth/student/sign-in')
            .send({ email: scholar.email, password: PASSWORD });
        expect(signIn.status).toBe(200);

        initialAccessToken = signIn.body.sessionToken;
        initialRefreshCookie = extractRefreshCookie(signIn.headers['set-cookie']);
        expect(initialAccessToken).toBeTruthy();
        expect(initialRefreshCookie).toBeTruthy();
    });

    it('sign-in sets an httpOnly, path-scoped refresh cookie', async () => {
        const cookies = (await request(app)
            .post('/api/auth/student/sign-in')
            .send({ email: scholar.email, password: PASSWORD })).headers['set-cookie'];
        const rt = cookies.find((c) => c.startsWith('sz_rt='));
        expect(rt).toMatch(/HttpOnly/i);
        expect(rt).toMatch(/Path=\/api\/auth/i);
    });

    it('returns 401 when no refresh cookie is presented', async () => {
        const res = await request(app).post('/api/auth/refresh');
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/refresh token is required/i);
    });

    it('returns 401 when the cookie value does not match any session', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', ['sz_rt=this-token-was-never-issued']);
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/invalid/i);
    });

    it('rotates BOTH access and refresh tokens on success', async () => {
        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`]);
        expect(res.status).toBe(200);
        expect(res.body.sessionToken).toBeTruthy();
        expect(res.body.sessionToken).not.toBe(initialAccessToken);
        expect(res.body.kind).toBe('scholar');

        const newRefresh = extractRefreshCookie(res.headers['set-cookie']);
        expect(newRefresh).toBeTruthy();
        expect(newRefresh).not.toBe(initialRefreshCookie);

        // The new access token must work against a protected route immediately.
        const profile = await request(app)
            .get('/api/auth/student/profile')
            .set('Authorization', `Bearer ${res.body.sessionToken}`);
        expect(profile.status).toBe(200);
    });

    it('records the previous refresh hash for reuse detection', async () => {
        const beforeHash = crypto.createHash('sha256').update(initialRefreshCookie).digest('hex');

        await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`])
            .expect(200);

        const session = await Session.findOne({ principalId: scholar._id, kind: 'scholar' });
        expect(session).toBeTruthy();
        expect(session.previousRefreshHash).toBe(beforeHash);
        expect(session.refreshTokenHash).not.toBe(beforeHash);
        expect(session.rotationCount).toBe(1);
    });

    it('detects reuse: replaying the OLD refresh token after rotation revokes the session', async () => {
        // First rotation — succeeds.
        await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`])
            .expect(200);

        // Replay the original (now superseded) refresh token.
        const replay = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`]);
        expect(replay.status).toBe(401);

        // The session must be gone — both the original AND the freshly-rotated
        // access token should be unusable.
        const session = await Session.findOne({ principalId: scholar._id, kind: 'scholar' });
        expect(session).toBeNull();
    });

    it('returns 401 and deletes the session when the refresh has expired', async () => {
        // Force-expire the refresh token by rewinding refreshExpiresAt.
        await Session.updateOne(
            { principalId: scholar._id, kind: 'scholar' },
            { $set: { refreshExpiresAt: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() - 1000) } },
        );

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`]);
        expect(res.status).toBe(401);
        expect(res.body.message).toMatch(/expired/i);

        const session = await Session.findOne({ principalId: scholar._id, kind: 'scholar' });
        expect(session).toBeNull();
    });

    it('persists the rotated session so it survives a subsequent /refresh', async () => {
        const first = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${initialRefreshCookie}`]);
        expect(first.status).toBe(200);
        const firstNewCookie = extractRefreshCookie(first.headers['set-cookie']);

        const second = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', [`sz_rt=${firstNewCookie}`]);
        expect(second.status).toBe(200);
        expect(second.body.sessionToken).not.toBe(first.body.sessionToken);

        const session = await Session.findOne({ principalId: scholar._id, kind: 'scholar' });
        expect(session.rotationCount).toBe(2);
    });
});

describe('POST /api/auth/logout', () => {
    const PASSWORD = 'StrongPassw0rd!';
    let scholar;
    let accessToken;
    let refreshCookie;

    beforeEach(async () => {
        scholar = await Scholar.create({
            name: 'Logout Tester',
            email: 'logout@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const signIn = await request(app)
            .post('/api/auth/student/sign-in')
            .send({ email: scholar.email, password: PASSWORD });
        accessToken = signIn.body.sessionToken;
        refreshCookie = extractRefreshCookie(signIn.headers['set-cookie']);
    });

    it('deletes the session and clears the refresh cookie', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .set('Cookie', [`sz_rt=${refreshCookie}`]);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        const clearing = (res.headers['set-cookie'] || []).find((c) => c.startsWith('sz_rt='));
        expect(clearing).toBeTruthy();
        // Clearing a cookie either sets the value empty AND/OR sets an expiry
        // in the past. Either way the value should NOT match the original.
        expect(clearing).not.toContain(refreshCookie);

        const session = await Session.findOne({ principalId: scholar._id, kind: 'scholar' });
        expect(session).toBeNull();

        // The bearer token must no longer authenticate.
        const profile = await request(app)
            .get('/api/auth/student/profile')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(profile.status).toBe(401);
    });

    it('responds 200 even when no session exists (idempotent)', async () => {
        const res = await request(app).post('/api/auth/logout');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });
});
