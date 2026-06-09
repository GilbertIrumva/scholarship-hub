/**
 * Application wizard tests — covers the draft/submit endpoints introduced
 * with the T2.3 upgrade.
 */
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholar, Session, Scholarship, ScholarshipApplication } = require('../db/models');

const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

const createSignedInScholar = async () => {
    const scholar = await Scholar.create({
        name: 'Wizard Tester',
        email: `wizard-${crypto.randomUUID()}@example.com`,
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
        title: 'Wizard Test Scholarship',
        provider: 'Test Provider',
        amount: 5_000,
        currency: 'USD',
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        countries: ['Rwanda'],
        fields: ['Engineering'],
        active: true,
        ...overrides,
    });

const sampleDraft = {
    motivation: 'I am driven and curious.',
    personalInfo: {
        fullName: 'Alice Example',
        phone: '+250700000000',
        dateOfBirth: '2002-04-12',
        nationality: 'Rwandan',
        country: 'Rwanda',
        address: 'Kigali',
    },
    academicInfo: {
        currentLevel: 'Undergraduate',
        institution: 'University of Rwanda',
        fieldOfStudy: 'Computer Science',
        gradePoint: '3.8',
        expectedCompletion: '2027',
    },
    documents: [],
    lastStep: 2,
};

describe('Application wizard — draft + submit', () => {
    it('requires a scholar session', async () => {
        const sch = await createScholarship();
        const res = await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .send(sampleDraft);
        expect(res.status).toBe(401);
    });

    it('rejects an invalid scholarship id format', async () => {
        const { token } = await createSignedInScholar();
        const res = await request(app)
            .put('/api/auth/student/applications/draft/not-an-id')
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(400);
    });

    it('returns 404 when the scholarship does not exist or is inactive', async () => {
        const { token } = await createSignedInScholar();
        const inactive = await createScholarship({ active: false });
        const res = await request(app)
            .put(`/api/auth/student/applications/draft/${inactive._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(404);
    });

    it('upserts a draft on first PUT and returns the saved application', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const res = await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(200);
        expect(res.body.application.status).toBe('draft');
        expect(res.body.application.personalInfo.fullName).toBe('Alice Example');
        expect(res.body.application.lastStep).toBe(2);
        expect(res.body.application.scholarship?.id).toBe(String(sch._id));
    });

    it('is idempotent — multiple PUTs update the same draft', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const second = await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                ...sampleDraft,
                motivation: 'Updated motivation',
                lastStep: 3,
            });
        expect(second.status).toBe(200);
        expect(second.body.application.motivation).toBe('Updated motivation');
        expect(second.body.application.lastStep).toBe(3);

        const count = await ScholarshipApplication.countDocuments();
        expect(count).toBe(1);
    });

    it('returns null when no draft exists', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const res = await request(app)
            .get(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.application).toBeNull();
    });

    it('GET draft returns the existing draft', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const res = await request(app)
            .get(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.application.status).toBe('draft');
        expect(res.body.application.academicInfo.institution).toBe('University of Rwanda');
    });

    it('drafts are isolated per scholar', async () => {
        const a = await createSignedInScholar();
        const b = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${a.token}`)
            .send(sampleDraft);

        const res = await request(app)
            .get(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${b.token}`);
        expect(res.status).toBe(200);
        expect(res.body.application).toBeNull();
    });

    it('DELETE removes a draft but refuses for submitted applications', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const del = await request(app)
            .delete(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(del.status).toBe(200);
        expect(del.body.deleted).toBe(true);

        // Submit a fresh one
        await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const block = await request(app)
            .delete(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(block.status).toBe(409);
    });

    it('submit promotes a draft to submitted and sets submittedAt', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const res = await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(200);
        expect(res.body.application.status).toBe('submitted');
        expect(res.body.application.submittedAt).toBeTruthy();

        const stored = await ScholarshipApplication.findOne({ scholarship: sch._id });
        expect(stored.status).toBe('submitted');
        expect(stored.submittedAt).toBeInstanceOf(Date);
    });

    it('submit without an existing draft creates a brand-new submitted application', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const res = await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(201);
        expect(res.body.application.status).toBe('submitted');
    });

    it('submit requires a full name', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const res = await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ ...sampleDraft, personalInfo: { ...sampleDraft.personalInfo, fullName: '' } });
        expect(res.status).toBe(400);
    });

    it('submit refuses to overwrite an already-submitted application', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        const res = await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(409);
    });

    it('submit rejects scholarships whose deadline has passed', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship({
            deadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });
        const res = await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);
        expect(res.status).toBe(400);
    });

    it('PUT refuses to overwrite a submitted application', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        await request(app)
            .post(`/api/auth/student/applications/submit/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send(sampleDraft);

        const res = await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({ ...sampleDraft, motivation: 'cant change this' });
        expect(res.status).toBe(409);
    });

    it('sanitizes overly long text fields by trimming to caps', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const long = 'x'.repeat(5_000);
        const res = await request(app)
            .put(`/api/auth/student/applications/draft/${sch._id}`)
            .set('Authorization', `Bearer ${token}`)
            .send({
                ...sampleDraft,
                motivation: long,
                personalInfo: { ...sampleDraft.personalInfo, fullName: long },
            });
        expect(res.status).toBe(200);
        expect(res.body.application.motivation.length).toBeLessThanOrEqual(2000);
        expect(res.body.application.personalInfo.fullName.length).toBeLessThanOrEqual(200);
    });

    it('legacy POST still works and now marks the record as submitted', async () => {
        const { token } = await createSignedInScholar();
        const sch = await createScholarship();
        const res = await request(app)
            .post('/api/auth/student/applications')
            .set('Authorization', `Bearer ${token}`)
            .send({ scholarshipId: String(sch._id), motivation: 'short motivation' });
        expect(res.status).toBe(201);
        expect(res.body.application.status).toBe('submitted');
        expect(res.body.application.submittedAt).toBeTruthy();
    });
});
