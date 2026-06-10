// project/test/twofactor.test.mjs
//
// Tests for the TOTP-based 2FA + device/session management endpoints
// introduced in T3.4. Covers: setup → enable → verify gating during
// sign-in, backup codes, regeneration, disable, and the /sessions
// list/revoke routes.

import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';
import * as otplib from 'otplib';

const TOTP_OPTS = {
    type: 'totp',
    plugins: [otplib.NobleCryptoPlugin, otplib.ScureBase32Plugin],
    window: 1,
    step: 30,
};
const generateToken = (secret) =>
    otplib.generateSync({ ...TOTP_OPTS, secret });

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Admin, Scholar, Session } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};
const extractRefreshCookie = (setCookieHeaders = []) => {
    for (const raw of setCookieHeaders) {
        if (raw && raw.startsWith('sz_rt=')) {
            return raw.split(';')[0].split('=').slice(1).join('=');
        }
    }
    return null;
};

const PASSWORD = 'StrongPassw0rd!';

const signInScholar = async (email = 'tfa-scholar@example.com', password = PASSWORD) => {
    const res = await request(app)
        .post('/api/auth/student/sign-in')
        .send({ email, password });
    return res;
};

const setup2faOnScholar = async () => {
    const scholar = await Scholar.create({
        name: 'TFA Scholar',
        email: 'tfa-scholar@example.com',
        role: 'student',
        emailVerified: true,
        ...makePasswordRecord(PASSWORD),
    });
    const signIn = await signInScholar(scholar.email);
    const accessToken = signIn.body.sessionToken;
    const setup = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${accessToken}`);
    const enable = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ totpCode: generateToken(setup.body.secret) });
    return {
        scholar: await Scholar.findById(scholar._id),
        accessToken,
        secret: setup.body.secret,
        backupCodes: enable.body.backupCodes,
    };
};

describe('POST /api/auth/2fa/setup', () => {
    it('requires an authenticated session', async () => {
        const res = await request(app).post('/api/auth/2fa/setup');
        expect(res.status).toBe(401);
    });

    it('returns a secret, otpauth URL, and QR data URL for the signed-in scholar', async () => {
        const scholar = await Scholar.create({
            name: 'Setup Tester',
            email: 'setup@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const signIn = await signInScholar(scholar.email);
        const accessToken = signIn.body.sessionToken;

        const res = await request(app)
            .post('/api/auth/2fa/setup')
            .set('Authorization', `Bearer ${accessToken}`);

        expect(res.status).toBe(200);
        expect(res.body.secret).toMatch(/^[A-Z2-7]+$/);
        expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
        expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
        expect(res.body.label).toBe(scholar.email);

        // The encrypted secret was persisted but totpEnabled stays false
        // until /enable confirms a working code.
        const updated = await Scholar.findById(scholar._id);
        expect(updated.totpEnabled).toBe(false);
        expect(updated.totpSecret.ciphertext).toBeTruthy();
    });

    it('refuses /setup once 2FA is already enabled', async () => {
        const { accessToken } = await setup2faOnScholar();
        const res = await request(app)
            .post('/api/auth/2fa/setup')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(res.status).toBe(409);
    });
});

describe('POST /api/auth/2fa/enable', () => {
    it('rejects an invalid TOTP code', async () => {
        const scholar = await Scholar.create({
            name: 'Bad Code',
            email: 'bad-code@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const signIn = await signInScholar(scholar.email);
        const accessToken = signIn.body.sessionToken;
        await request(app)
            .post('/api/auth/2fa/setup')
            .set('Authorization', `Bearer ${accessToken}`);

        const res = await request(app)
            .post('/api/auth/2fa/enable')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ totpCode: '000000' });

        expect(res.status).toBe(401);
        const updated = await Scholar.findById(scholar._id);
        expect(updated.totpEnabled).toBe(false);
    });

    it('enables 2FA and returns ten backup codes formatted as xxxx-xxxx', async () => {
        const { scholar, backupCodes } = await setup2faOnScholar();
        expect(scholar.totpEnabled).toBe(true);
        expect(scholar.totpBackupCodes).toHaveLength(10);
        expect(backupCodes).toHaveLength(10);
        for (const code of backupCodes) {
            expect(code).toMatch(/^[0-9a-f]{4}-[0-9a-f]{4}$/);
        }
    });

    it('requires /setup to have run first', async () => {
        const scholar = await Scholar.create({
            name: 'No Setup',
            email: 'no-setup@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const signIn = await signInScholar(scholar.email);
        const accessToken = signIn.body.sessionToken;
        const res = await request(app)
            .post('/api/auth/2fa/enable')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ totpCode: '123456' });
        expect(res.status).toBe(400);
    });
});

describe('scholar sign-in with 2FA enabled', () => {
    it('returns requires2fa + a challengeId instead of a session', async () => {
        const { scholar } = await setup2faOnScholar();
        const res = await signInScholar(scholar.email);

        expect(res.status).toBe(200);
        expect(res.body.requires2fa).toBe(true);
        expect(res.body.challengeId).toBeTruthy();
        expect(res.body.sessionToken).toBeUndefined();

        // No refresh cookie should be set yet — the challenge isn't a real
        // session.
        const cookies = res.headers['set-cookie'] || [];
        expect(cookies.find((c) => c.startsWith('sz_rt='))).toBeUndefined();
    });

    it('rejects a wrong TOTP code on /api/auth/2fa/challenge', async () => {
        const { scholar } = await setup2faOnScholar();
        const signIn = await signInScholar(scholar.email);
        const res = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({ challengeId: signIn.body.challengeId, totpCode: '000000' });
        expect(res.status).toBe(401);
    });

    it('completes sign-in with a valid TOTP and issues a refresh cookie', async () => {
        const { scholar, secret } = await setup2faOnScholar();
        const signIn = await signInScholar(scholar.email);
        const res = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({
                challengeId: signIn.body.challengeId,
                totpCode: generateToken(secret),
            });
        expect(res.status).toBe(200);
        expect(res.body.sessionToken).toBeTruthy();
        const cookies = res.headers['set-cookie'] || [];
        expect(cookies.find((c) => c.startsWith('sz_rt='))).toBeTruthy();
    });

    it('accepts a backup code and marks it used (one-shot)', async () => {
        const { scholar, backupCodes } = await setup2faOnScholar();
        const code = backupCodes[0];

        // First use succeeds.
        const signIn1 = await signInScholar(scholar.email);
        const ok = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({ challengeId: signIn1.body.challengeId, backupCode: code });
        expect(ok.status).toBe(200);

        // Replaying the same code fails.
        const signIn2 = await signInScholar(scholar.email);
        const replay = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({ challengeId: signIn2.body.challengeId, backupCode: code });
        expect(replay.status).toBe(401);

        const after = await Scholar.findById(scholar._id);
        const remaining = after.totpBackupCodes.filter((c) => !c.usedAt).length;
        expect(remaining).toBe(9);
    });

    it('410s an expired challenge', async () => {
        const { scholar, secret } = await setup2faOnScholar();
        const signIn = await signInScholar(scholar.email);
        await Session.updateOne(
            { token: signIn.body.challengeId },
            { $set: { expiresAt: new Date(Date.now() - 1000), accessExpiresAt: new Date(Date.now() - 1000) } },
        );
        const res = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({
                challengeId: signIn.body.challengeId,
                totpCode: generateToken(secret),
            });
        expect(res.status).toBe(410);
    });
});

describe('POST /api/auth/2fa/disable', () => {
    it('requires the account password', async () => {
        const { accessToken, secret } = await setup2faOnScholar();
        const res = await request(app)
            .post('/api/auth/2fa/disable')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: 'wrong-password', totpCode: generateToken(secret) });
        expect(res.status).toBe(401);
    });

    it('requires a current TOTP or backup code', async () => {
        const { accessToken } = await setup2faOnScholar();
        const res = await request(app)
            .post('/api/auth/2fa/disable')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: PASSWORD });
        expect(res.status).toBe(401);
    });

    it('disables 2FA and wipes the secret + backup codes', async () => {
        const { scholar, accessToken, secret } = await setup2faOnScholar();
        const res = await request(app)
            .post('/api/auth/2fa/disable')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ password: PASSWORD, totpCode: generateToken(secret) });
        expect(res.status).toBe(200);
        const updated = await Scholar.findById(scholar._id);
        expect(updated.totpEnabled).toBe(false);
        expect(updated.totpSecret.ciphertext).toBe('');
        expect(updated.totpBackupCodes).toHaveLength(0);
    });
});

describe('POST /api/auth/2fa/backup-codes/regenerate', () => {
    it('requires a current TOTP code', async () => {
        const { accessToken } = await setup2faOnScholar();
        const res = await request(app)
            .post('/api/auth/2fa/backup-codes/regenerate')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ totpCode: '000000' });
        expect(res.status).toBe(401);
    });

    it('invalidates the previous backup codes', async () => {
        const { scholar, accessToken, secret, backupCodes } = await setup2faOnScholar();
        const oldCode = backupCodes[0];

        const res = await request(app)
            .post('/api/auth/2fa/backup-codes/regenerate')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ totpCode: generateToken(secret) });
        expect(res.status).toBe(200);
        expect(res.body.backupCodes).toHaveLength(10);
        expect(res.body.backupCodes).not.toContain(oldCode);

        // Old code should no longer be accepted during sign-in.
        const signIn = await signInScholar(scholar.email);
        const replay = await request(app)
            .post('/api/auth/2fa/challenge')
            .send({ challengeId: signIn.body.challengeId, backupCode: oldCode });
        expect(replay.status).toBe(401);
    });
});

describe('GET /api/auth/2fa/status', () => {
    it('reports counts of remaining backup codes', async () => {
        const { accessToken } = await setup2faOnScholar();
        const res = await request(app)
            .get('/api/auth/2fa/status')
            .set('Authorization', `Bearer ${accessToken}`);
        expect(res.status).toBe(200);
        expect(res.body.enabled).toBe(true);
        expect(res.body.backupCodesTotal).toBe(10);
        expect(res.body.backupCodesRemaining).toBe(10);
    });
});

describe('admin sign-in with 2FA enabled', () => {
    const ADMIN_PASSWORD = 'AdminPassw0rd!';
    let admin;
    let totpSecret;

    beforeEach(async () => {
        admin = await Admin.create({
            name: 'TFA Admin',
            email: 'tfa-admin@example.com',
            role: 'administrator',
            department: 'Engineering',
            departmentCode: 'ENG-2026',
            twoFactorCode: '654321',
            ...makePasswordRecord(ADMIN_PASSWORD),
        });

        // Sign in once to get a session, then bootstrap TOTP via the API.
        const signIn = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: ADMIN_PASSWORD });
        const verify = await request(app)
            .post('/api/auth/admin/verify')
            .send({ challengeId: signIn.body.challengeId, verificationCode: 'ENG-2026' });
        const adminToken = verify.body.sessionToken;

        const setup = await request(app)
            .post('/api/auth/2fa/setup')
            .set('Authorization', `Bearer ${adminToken}`);
        await request(app)
            .post('/api/auth/2fa/enable')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ totpCode: generateToken(setup.body.secret) });
        totpSecret = setup.body.secret;
        admin = await Admin.findById(admin._id);
    });

    it('rejects /admin/verify when totpCode is missing', async () => {
        const signIn = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: ADMIN_PASSWORD });
        const verify = await request(app)
            .post('/api/auth/admin/verify')
            .send({ challengeId: signIn.body.challengeId, verificationCode: 'ENG-2026' });
        expect(verify.status).toBe(401);
        expect(verify.body.requires2fa).toBe(true);
    });

    it('accepts /admin/verify when departmentCode + valid totpCode are supplied', async () => {
        const signIn = await request(app)
            .post('/api/auth/admin/sign-in')
            .send({ email: admin.email, password: ADMIN_PASSWORD });
        const verify = await request(app)
            .post('/api/auth/admin/verify')
            .send({
                challengeId: signIn.body.challengeId,
                verificationCode: 'ENG-2026',
                totpCode: generateToken(totpSecret),
            });
        expect(verify.status).toBe(200);
        expect(verify.body.sessionToken).toBeTruthy();
    });
});

describe('GET/DELETE /api/auth/sessions', () => {
    it('lists the scholar\'s active sessions and flags the current one', async () => {
        const scholar = await Scholar.create({
            name: 'Multi Device',
            email: 'multi@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        // Two devices = two sign-ins.
        const a = await signInScholar(scholar.email);
        const b = await signInScholar(scholar.email);

        const list = await request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${b.body.sessionToken}`);

        expect(list.status).toBe(200);
        expect(list.body.sessions.length).toBeGreaterThanOrEqual(2);
        const current = list.body.sessions.find((s) => s.current);
        expect(current).toBeTruthy();
        const others = list.body.sessions.filter((s) => !s.current);
        expect(others.length).toBeGreaterThanOrEqual(1);

        // a.sessionToken should now be revoke-able from the b context.
        const aSessionId = list.body.sessions.find((s) => !s.current).id;
        const del = await request(app)
            .delete(`/api/auth/sessions/${aSessionId}`)
            .set('Authorization', `Bearer ${b.body.sessionToken}`);
        expect(del.status).toBe(200);
        expect(del.body.revokedCurrent).toBe(false);

        // Confirm a's bearer is gone.
        const after = await request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${a.body.sessionToken}`);
        expect(after.status).toBe(401);
    });

    it('DELETE /api/auth/sessions revokes all OTHER sessions', async () => {
        const scholar = await Scholar.create({
            name: 'Three Devices',
            email: 'three@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const a = await signInScholar(scholar.email);
        const b = await signInScholar(scholar.email);
        const c = await signInScholar(scholar.email);

        const del = await request(app)
            .delete('/api/auth/sessions')
            .set('Authorization', `Bearer ${c.body.sessionToken}`);
        expect(del.status).toBe(200);
        expect(del.body.deletedCount).toBeGreaterThanOrEqual(2);

        // Current session still works; others don't.
        const me = await request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${c.body.sessionToken}`);
        expect(me.status).toBe(200);
        expect(me.body.sessions).toHaveLength(1);

        for (const dead of [a.body.sessionToken, b.body.sessionToken]) {
            const res = await request(app)
                .get('/api/auth/sessions')
                .set('Authorization', `Bearer ${dead}`);
            expect(res.status).toBe(401);
        }
    });

    it('returns 404 for a session id that does not belong to the principal', async () => {
        const s1 = await Scholar.create({
            name: 'Owner',
            email: 'owner@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const s2 = await Scholar.create({
            name: 'Intruder',
            email: 'intruder@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const s1SignIn = await signInScholar(s1.email);
        const s2SignIn = await signInScholar(s2.email);
        const s1List = await request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${s1SignIn.body.sessionToken}`);
        const targetId = s1List.body.sessions[0].id;

        // s2 tries to revoke s1's session.
        const res = await request(app)
            .delete(`/api/auth/sessions/${targetId}`)
            .set('Authorization', `Bearer ${s2SignIn.body.sessionToken}`);
        expect(res.status).toBe(404);
    });

    it('rejects malformed session ids', async () => {
        const scholar = await Scholar.create({
            name: 'Bad ID',
            email: 'bad-id@example.com',
            role: 'student',
            emailVerified: true,
            ...makePasswordRecord(PASSWORD),
        });
        const signIn = await signInScholar(scholar.email);
        const res = await request(app)
            .delete('/api/auth/sessions/not-an-objectid')
            .set('Authorization', `Bearer ${signIn.body.sessionToken}`);
        expect(res.status).toBe(400);
    });
});
