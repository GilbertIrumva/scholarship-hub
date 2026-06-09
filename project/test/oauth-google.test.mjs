import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

// Configure Google OAuth env vars BEFORE loading the app module so the
// `googleOAuthConfig()` helper sees them as truthy.
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:4000/api/auth/google/callback';
process.env.OAUTH_STATE_SECRET = 'test-only-state-secret-not-for-prod';
process.env.APP_BASE_URL = 'http://localhost:5173';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Session } = require('../db/models');

// ---------------------------------------------------------------------------
// Helpers: re-create the same HMAC state envelope the start route would
// produce, so the callback tests can run without first hitting /start.
// ---------------------------------------------------------------------------
const STATE_SECRET = process.env.OAUTH_STATE_SECRET;
const base64Url = (input) =>
    Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const buildState = ({ ts = Date.now(), returnTo = '/scholar', nonce } = {}) => {
    const body = base64Url(
        JSON.stringify({ nonce: nonce || crypto.randomBytes(8).toString('hex'), ts, returnTo }),
    );
    const sig = base64Url(crypto.createHmac('sha256', STATE_SECRET).update(body).digest());
    return `${body}.${sig}`;
};

const mockFetchSequence = (responses) => {
    const queue = [...responses];
    return vi.fn(async () => {
        const next = queue.shift();
        if (!next) throw new Error('mockFetch: no more queued responses');
        return {
            ok: next.ok !== false,
            status: next.status || 200,
            json: async () => next.json || {},
            text: async () => next.text || '',
        };
    });
};

const tokenAndProfileResponses = (profile) => [
    { ok: true, json: { access_token: 'ya29.test-access-token', token_type: 'Bearer', expires_in: 3600 } },
    { ok: true, json: profile },
];

const followRedirect = (res) => new URL(res.headers.location);

describe('Google OAuth — /api/auth/google/start', () => {
    let originalFetch;
    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('redirects to Google with the expected query parameters', async () => {
        const res = await request(app).get('/api/auth/google/start');
        expect(res.status).toBe(302);
        const loc = new URL(res.headers.location);
        expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(loc.searchParams.get('client_id')).toBe(process.env.GOOGLE_CLIENT_ID);
        expect(loc.searchParams.get('redirect_uri')).toBe(process.env.GOOGLE_REDIRECT_URI);
        expect(loc.searchParams.get('response_type')).toBe('code');
        expect(loc.searchParams.get('scope')).toBe('openid email profile');
        expect(loc.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    });

    it('rejects open-redirect attempts in returnTo by falling back to /scholar', async () => {
        const res = await request(app).get('/api/auth/google/start').query({
            returnTo: 'https://evil.example.com/steal',
        });
        expect(res.status).toBe(302);
        const state = new URL(res.headers.location).searchParams.get('state');
        const [body] = state.split('.');
        const decoded = JSON.parse(
            Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        );
        expect(decoded.returnTo).toBe('/scholar');
    });

    it('accepts a same-origin returnTo path', async () => {
        const res = await request(app).get('/api/auth/google/start').query({
            returnTo: '/scholar/scholarships',
        });
        const state = new URL(res.headers.location).searchParams.get('state');
        const [body] = state.split('.');
        const decoded = JSON.parse(
            Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
        );
        expect(decoded.returnTo).toBe('/scholar/scholarships');
    });
});

describe('Google OAuth — /api/auth/google/callback', () => {
    let originalFetch;
    beforeEach(() => {
        originalFetch = globalThis.fetch;
    });
    afterEach(() => {
        globalThis.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('redirects with invalid_state when state is missing', async () => {
        const res = await request(app).get('/api/auth/google/callback').query({ code: 'abc' });
        expect(res.status).toBe(302);
        const loc = followRedirect(res);
        expect(loc.pathname).toBe('/auth/google');
        expect(loc.searchParams.get('error')).toBe('invalid_state');
    });

    it('redirects with invalid_state when the HMAC signature is wrong', async () => {
        const tampered = buildState() + 'x';
        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'abc',
            state: tampered,
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('invalid_state');
    });

    it('redirects with invalid_state when state is expired', async () => {
        const expired = buildState({ ts: Date.now() - 11 * 60 * 1000 });
        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'abc',
            state: expired,
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('invalid_state');
    });

    it('redirects with google_denied when the provider returns error=access_denied', async () => {
        const res = await request(app).get('/api/auth/google/callback').query({
            error: 'access_denied',
            state: buildState(),
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('google_denied');
    });

    it('redirects with missing_code when state is valid but code is absent', async () => {
        const res = await request(app).get('/api/auth/google/callback').query({
            state: buildState(),
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('missing_code');
    });

    it('redirects with token_exchange_failed when Google rejects the code', async () => {
        globalThis.fetch = vi.fn(async () => ({
            ok: false,
            status: 400,
            json: async () => ({ error: 'invalid_grant' }),
            text: async () => '{"error":"invalid_grant"}',
        }));
        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'bad-code',
            state: buildState(),
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('token_exchange_failed');
    });

    it('redirects with unverified_google_email when profile.email_verified is false', async () => {
        globalThis.fetch = mockFetchSequence(
            tokenAndProfileResponses({
                sub: '1029384756',
                email: 'unverified@example.com',
                email_verified: false,
                name: 'Unverified User',
            }),
        );
        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'good-code',
            state: buildState(),
        });
        expect(followRedirect(res).searchParams.get('error')).toBe('unverified_google_email');
    });

    it('creates a brand-new scholar on first Google sign-in and issues a session', async () => {
        globalThis.fetch = mockFetchSequence(
            tokenAndProfileResponses({
                sub: 'google-sub-new-user-123',
                email: 'newuser@example.com',
                email_verified: true,
                name: 'New Google User',
                picture: 'https://lh3.googleusercontent.com/a/test',
            }),
        );

        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'good-code',
            state: buildState({ returnTo: '/scholar/saved' }),
        });

        expect(res.status).toBe(302);
        const loc = followRedirect(res);
        expect(loc.pathname).toBe('/auth/google');
        expect(loc.searchParams.get('token')).toBeTruthy();
        expect(loc.searchParams.get('created')).toBe('1');
        expect(loc.searchParams.get('returnTo')).toBe('/scholar/saved');

        const scholar = await Scholar.findOne({ email: 'newuser@example.com' });
        expect(scholar).not.toBeNull();
        expect(scholar.googleId).toBe('google-sub-new-user-123');
        expect(scholar.emailVerified).toBe(true);
        expect(scholar.avatarUrl).toContain('googleusercontent.com');
        expect(scholar.passwordHash).toBe('');

        const session = await Session.findOne({ token: loc.searchParams.get('token') });
        expect(session).not.toBeNull();
        expect(session.kind).toBe('scholar');
        expect(String(session.principalId)).toBe(String(scholar._id));
    });

    it('links an existing email-only scholar to Google and marks the email verified', async () => {
        const existing = await Scholar.create({
            name: 'Existing User',
            email: 'existing@example.com',
            role: 'student',
            passwordSalt: 'salt',
            passwordHash: 'hash',
            emailVerified: false,
        });

        globalThis.fetch = mockFetchSequence(
            tokenAndProfileResponses({
                sub: 'google-sub-link-456',
                email: 'existing@example.com',
                email_verified: true,
                name: 'Existing User',
            }),
        );

        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'good-code',
            state: buildState(),
        });
        expect(res.status).toBe(302);
        const loc = followRedirect(res);
        expect(loc.searchParams.get('token')).toBeTruthy();
        expect(loc.searchParams.get('created')).toBeNull();

        const updated = await Scholar.findById(existing._id);
        expect(updated.googleId).toBe('google-sub-link-456');
        expect(updated.emailVerified).toBe(true);
        expect(updated.emailVerifiedAt).toBeInstanceOf(Date);
        // Password is preserved so the user can still sign in with either method.
        expect(updated.passwordHash).toBe('hash');
    });

    it('reuses the same scholar on subsequent Google sign-ins (lookup by googleId)', async () => {
        const returning = await Scholar.create({
            name: 'Returning User',
            email: 'returning@example.com',
            role: 'student',
            googleId: 'google-sub-returning-789',
            emailVerified: true,
            emailVerifiedAt: new Date(),
        });

        globalThis.fetch = mockFetchSequence(
            tokenAndProfileResponses({
                sub: 'google-sub-returning-789',
                email: 'returning@example.com',
                email_verified: true,
                name: 'Returning User',
            }),
        );

        const res = await request(app).get('/api/auth/google/callback').query({
            code: 'good-code',
            state: buildState(),
        });
        expect(res.status).toBe(302);
        const loc = followRedirect(res);
        expect(loc.searchParams.get('created')).toBeNull();

        const count = await Scholar.countDocuments({ email: 'returning@example.com' });
        expect(count).toBe(1);

        const session = await Session.findOne({ token: loc.searchParams.get('token') });
        expect(String(session.principalId)).toBe(String(returning._id));
    });
});

describe('Google OAuth — when not configured', () => {
    let originalEnv;
    beforeAll(() => {
        originalEnv = {
            id: process.env.GOOGLE_CLIENT_ID,
            secret: process.env.GOOGLE_CLIENT_SECRET,
            uri: process.env.GOOGLE_REDIRECT_URI,
            state: process.env.OAUTH_STATE_SECRET,
        };
    });
    afterEach(() => {
        process.env.GOOGLE_CLIENT_ID = originalEnv.id;
        process.env.GOOGLE_CLIENT_SECRET = originalEnv.secret;
        process.env.GOOGLE_REDIRECT_URI = originalEnv.uri;
        process.env.OAUTH_STATE_SECRET = originalEnv.state;
    });

    it('returns 503 on /start when GOOGLE_CLIENT_ID is missing', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        const res = await request(app).get('/api/auth/google/start');
        expect(res.status).toBe(503);
        expect(res.body.message).toMatch(/not configured/i);
    });

    it('returns 503 on /callback when OAUTH_STATE_SECRET is missing', async () => {
        delete process.env.OAUTH_STATE_SECRET;
        const res = await request(app).get('/api/auth/google/callback').query({ code: 'x' });
        expect(res.status).toBe(503);
    });
});
