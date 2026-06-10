import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Metric } = require('../db/models');

const BASE = '/api/_metrics/web-vitals';

describe('POST /api/_metrics/web-vitals', () => {
    it('accepts a valid CLS payload and returns 202', async () => {
        const res = await request(app)
            .post(BASE)
            .set('Content-Type', 'application/json')
            .send({ name: 'CLS', value: 0.05, rating: 'good', path: '/' });
        expect(res.status).toBe(202);
        expect(res.body).toEqual({ ok: true });
    });

    it('rejects payload with an unknown metric name (400)', async () => {
        const res = await request(app)
            .post(BASE)
            .set('Content-Type', 'application/json')
            .send({ name: 'BOGUS', value: 1 });
        expect(res.status).toBe(400);
    });

    it('rejects a non-numeric value (400)', async () => {
        const res = await request(app)
            .post(BASE)
            .set('Content-Type', 'application/json')
            .send({ name: 'LCP', value: 'fast' });
        expect(res.status).toBe(400);
    });

    it('rejects a negative value (400)', async () => {
        const res = await request(app)
            .post(BASE)
            .set('Content-Type', 'application/json')
            .send({ name: 'INP', value: -1 });
        expect(res.status).toBe(400);
    });

    it('accepts each supported metric name (CLS/LCP/INP/TTFB/FCP)', async () => {
        for (const name of ['CLS', 'LCP', 'INP', 'TTFB', 'FCP']) {
            const res = await request(app)
                .post(BASE)
                .set('Content-Type', 'application/json')
                .send({ name, value: 12.5, rating: 'needs-improvement' });
            expect(res.status, `metric ${name}`).toBe(202);
        }
    });

    it('does not write to the Metric collection in test mode (fire-and-forget skipped)', async () => {
        const before = await Metric.countDocuments();
        await request(app)
            .post(BASE)
            .set('Content-Type', 'application/json')
            .send({ name: 'TTFB', value: 250, rating: 'good', path: '/scholarships?foo=bar#x' });
        const after = await Metric.countDocuments();
        // NODE_ENV=test → endpoint short-circuits the DB write so it stays
        // a pure validator in unit tests; full integration with persistence
        // is exercised in production environments.
        expect(after).toBe(before);
    });

    it('exposes a sane Metric model with required schema fields', () => {
        const paths = Metric.schema.paths;
        expect(paths.name).toBeDefined();
        expect(paths.value).toBeDefined();
        expect(paths.rating).toBeDefined();
        expect(paths.createdAt).toBeDefined();
        // TTL is implemented via `expires` on createdAt — surfaced as
        // expireAfterSeconds in the index spec.
        expect(paths.createdAt.options.expires).toBe(60 * 60 * 24 * 7);
    });
});
