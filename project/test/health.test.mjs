import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');

describe('health probes', () => {
    it('GET /healthz returns 200 + status:ok', async () => {
        const res = await request(app).get('/healthz');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(typeof res.body.uptime).toBe('number');
    });

    it('GET /readyz returns 200 + db:connected when mongo is up', async () => {
        const res = await request(app).get('/readyz');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ready');
        expect(res.body.db).toBe('connected');
    });

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
});
