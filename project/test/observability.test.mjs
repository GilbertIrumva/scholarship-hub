import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { captureException, isObservabilityEnabled } = require('../lib/observability');

describe('T4.2 — X-Request-Id middleware', () => {
    it('echoes back a fresh UUID when no inbound header is provided', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        const id = res.headers['x-request-id'];
        expect(id).toBeTruthy();
        // crypto.randomUUID() shape — accept any string that looks like a UUID.
        expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('echoes back a valid inbound X-Request-Id verbatim', async () => {
        const inbound = 'trace-abc-12345';
        const res = await request(app).get('/healthz').set('X-Request-Id', inbound);
        expect(res.status).toBe(200);
        expect(res.headers['x-request-id']).toBe(inbound);
    });

    it('rejects an inbound X-Request-Id with unsafe characters and mints a new one', async () => {
        const inbound = 'bad value with spaces!!';
        const res = await request(app).get('/healthz').set('X-Request-Id', inbound);
        expect(res.status).toBe(200);
        const id = res.headers['x-request-id'];
        expect(id).not.toBe(inbound);
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('returns the requestId in the error body on 500 responses', async () => {
        // Trigger the 500 path via the contact endpoint with a payload that
        // satisfies the schema but causes the DB write to fail by replacing
        // ContactMessage.create with a thrower for this test only.
        const { ContactMessage } = require('../db/models');
        const orig = ContactMessage.create;
        ContactMessage.create = vi.fn().mockRejectedValueOnce(new Error('boom'));

        try {
            const res = await request(app)
                .post('/api/public/contact')
                .send({
                    name: 'Test',
                    email: 'test@example.com',
                    topic: 'general',
                    message: 'A long-enough message body for the validator to accept',
                });
            expect(res.status).toBe(500);
            expect(res.body.requestId).toBeTruthy();
            expect(res.body.requestId).toBe(res.headers['x-request-id']);
        } finally {
            ContactMessage.create = orig;
        }
    });
});

describe('T4.2 — observability adapter', () => {
    it('reports disabled when SENTRY_DSN is unset (graceful no-op)', () => {
        expect(isObservabilityEnabled()).toBe(false);
    });

    it('captureException is a safe no-op when the sink is disabled', () => {
        // Must not throw, must not write anything observable.
        expect(() => captureException(new Error('test'))).not.toThrow();
        expect(() => captureException(null)).not.toThrow();
        expect(() => captureException(new Error('with ctx'), {
            requestId: 'r1',
            route: '/x',
            principal: { kind: 'scholar', id: 'abc' },
            tags: { method: 'GET' },
            extras: { foo: 'bar' },
        })).not.toThrow();
    });
});
