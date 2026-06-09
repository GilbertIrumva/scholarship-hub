import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validate } = require('../lib/validate');

const makeApp = (schema, source = 'body') => {
    const app = express();
    app.use(express.json());
    app.post('/test', validate(schema, source), (req, res) => {
        res.json({ ok: true, received: req[source] });
    });
    app.get('/test', validate(schema, source), (req, res) => {
        res.json({ ok: true, received: req[source] });
    });
    return app;
};

describe('validate() middleware', () => {
    it('passes when body matches the schema and strips unknown keys', async () => {
        const app = makeApp(z.object({ email: z.string().email() }).strict());
        const res = await request(app).post('/test').send({ email: 'a@b.com' });
        expect(res.status).toBe(200);
        expect(res.body.received).toEqual({ email: 'a@b.com' });
    });

    it('returns 400 with issues when body is invalid', async () => {
        const app = makeApp(z.object({
            email: z.string().email(),
            password: z.string().min(8),
        }));
        const res = await request(app).post('/test').send({ email: 'nope', password: 'x' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/validation/i);
        expect(Array.isArray(res.body.issues)).toBe(true);
        expect(res.body.issues.length).toBeGreaterThanOrEqual(2);
        expect(res.body.issues[0]).toHaveProperty('path');
        expect(res.body.issues[0]).toHaveProperty('message');
    });

    it('coerces and trims using schema transforms', async () => {
        const app = makeApp(z.object({
            email: z.string().trim().toLowerCase(),
        }));
        const res = await request(app).post('/test').send({ email: '  FOO@BAR.com  ' });
        expect(res.status).toBe(200);
        expect(res.body.received.email).toBe('foo@bar.com');
    });
});
