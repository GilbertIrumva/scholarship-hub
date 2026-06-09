import request from 'supertest';
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Session, Scholarship } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

const createSignedInScholar = async () => {
    const scholar = await Scholar.create({
        name: 'Saved Scholar',
        email: `saved-${crypto.randomUUID()}@example.com`,
        role: 'student',
        ...makePasswordRecord('StrongPassw0rd!'),
    });
    const token = crypto.randomUUID();
    await Session.create({
        token,
        kind: 'scholar',
        principalId: scholar._id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { scholar, token };
};

const createScholarship = (overrides = {}) =>
    Scholarship.create({
        title: 'Test Scholarship',
        provider: 'Test Provider',
        amount: 5000,
        currency: 'USD',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        active: true,
        ...overrides,
    });

describe('Saved scholarships endpoints', () => {
    it('rejects unauthenticated list', async () => {
        const res = await request(app).get('/api/auth/student/saved');
        expect(res.status).toBe(401);
    });

    it('rejects unauthenticated save', async () => {
        const s = await createScholarship();
        const res = await request(app).post(`/api/auth/student/saved/${s._id}`);
        expect(res.status).toBe(401);
    });

    it('returns an empty list for a fresh scholar', async () => {
        const { token } = await createSignedInScholar();
        const res = await request(app)
            .get('/api/auth/student/saved')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.ids).toEqual([]);
    });

    it('400 on invalid scholarship id', async () => {
        const { token } = await createSignedInScholar();
        const res = await request(app)
            .post('/api/auth/student/saved/not-an-id')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });

    it('404 when scholarship does not exist', async () => {
        const { token } = await createSignedInScholar();
        const fakeId = '507f1f77bcf86cd799439011';
        const res = await request(app)
            .post(`/api/auth/student/saved/${fakeId}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('saves, lists, and unsaves a scholarship idempotently', async () => {
        const { token } = await createSignedInScholar();
        const s = await createScholarship({ title: 'Bookmark Me' });
        const id = String(s._id);

        // POST adds.
        const save1 = await request(app)
            .post(`/api/auth/student/saved/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(save1.status).toBe(200);
        expect(save1.body.saved).toBe(true);
        expect(save1.body.ids).toContain(id);

        // POST again is idempotent — still in the list, no duplicate.
        const save2 = await request(app)
            .post(`/api/auth/student/saved/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(save2.status).toBe(200);
        expect(save2.body.ids.filter((x) => x === id)).toHaveLength(1);

        // GET returns populated scholarship.
        const list = await request(app)
            .get('/api/auth/student/saved')
            .set('Authorization', `Bearer ${token}`);
        expect(list.status).toBe(200);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].title).toBe('Bookmark Me');
        expect(list.body.ids).toEqual([id]);

        // DELETE removes.
        const unsave = await request(app)
            .delete(`/api/auth/student/saved/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(unsave.status).toBe(200);
        expect(unsave.body.saved).toBe(false);
        expect(unsave.body.ids).not.toContain(id);

        // DELETE again is idempotent — no error.
        const unsave2 = await request(app)
            .delete(`/api/auth/student/saved/${id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(unsave2.status).toBe(200);
    });

    it('does not leak saved scholarships between scholars', async () => {
        const a = await createSignedInScholar();
        const b = await createSignedInScholar();
        const s = await createScholarship({ title: 'Private' });

        await request(app)
            .post(`/api/auth/student/saved/${s._id}`)
            .set('Authorization', `Bearer ${a.token}`);

        const bList = await request(app)
            .get('/api/auth/student/saved')
            .set('Authorization', `Bearer ${b.token}`);
        expect(bList.body.items).toEqual([]);
        expect(bList.body.ids).toEqual([]);
    });

    it('filters out inactive scholarships from the populated list', async () => {
        const { token } = await createSignedInScholar();
        const active = await createScholarship({ title: 'Active' });
        const inactive = await createScholarship({ title: 'Inactive', active: false });

        await request(app)
            .post(`/api/auth/student/saved/${active._id}`)
            .set('Authorization', `Bearer ${token}`);
        // Inactive saves are blocked at POST (only active are findable), so set directly:
        await Scholar.updateOne(
            { _id: (await Session.findOne({ token })).principalId },
            { $addToSet: { savedScholarships: inactive._id } }
        );

        const list = await request(app)
            .get('/api/auth/student/saved')
            .set('Authorization', `Bearer ${token}`);
        expect(list.body.items).toHaveLength(1);
        expect(list.body.items[0].title).toBe('Active');
    });
});
