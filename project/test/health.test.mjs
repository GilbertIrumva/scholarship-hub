import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');

describe('liveness probe', () => {
    it('GET /healthz returns 200 with status:ok + uptime + pid', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
        expect(res.body.uptime).toBeGreaterThan(0);
        expect(typeof res.body.pid).toBe('number');
        expect(res.body.shuttingDown).toBe(false);
    });

    it('GET /api/health is an alias for /healthz', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
    });
});

describe('readiness probe', () => {
    it('GET /readyz returns 200 + checks.db:connected when mongo is up', async () => {
        const res = await request(app).get('/readyz');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ready');
        expect(res.body.checks).toBeDefined();
        expect(res.body.checks.db).toBe('connected');
        expect(typeof res.body.checks.storage).toBe('string');
        expect(res.body.checks.storage).not.toMatch(/^error:/);
        expect(res.body.checks.storage).not.toBe('misconfigured');
        expect(typeof res.body.inflight).toBe('number');
        expect(typeof res.body.uptime).toBe('number');
    });

    it('GET /api/ready is an alias for /readyz', async () => {
        const res = await request(app).get('/api/ready');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ready');
        expect(res.body.checks.db).toBe('connected');
    });

    it('readiness response does not leak internal-error stack', async () => {
        const res = await request(app).get('/readyz');
        const body = JSON.stringify(res.body);
        // Stack frames usually contain "at " — make sure none leaked.
        expect(body).not.toMatch(/\n\s+at\s/);
    });
});

describe('root banner', () => {
    it('GET / returns the API banner', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/ScholarshipZone API is running/);
    });
});

describe('security headers (helmet)', () => {
    it('sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy', async () => {
        const res = await request(app).get('/healthz');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
        expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    it('echoes X-Request-Id on probe responses (T4.2)', async () => {
        const res = await request(app).get('/healthz');
        // Either accepts an inbound id OR mints one; either way the header must be set.
        expect(res.headers['x-request-id']).toBeDefined();
        expect(res.headers['x-request-id']).toMatch(/^[a-zA-Z0-9-_]{8,128}$/);
    });
});
