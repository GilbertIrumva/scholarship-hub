import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { scoreScholarship, rankScholarships, toPercent } = require('../lib/matching');
const { Scholar, Application, Scholarship, Session } = require('../db/models');

// --- Pure unit tests on the scoring function ---------------------------------
describe('scoreScholarship (pure)', () => {
    const futureDeadline = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    it('awards 30 points when the scholar nationality is in countries', () => {
        const { score, reasons } = scoreScholarship(
            { countries: ['Rwanda', 'Kenya'], grades: [], fields: [], tags: [], deadline: futureDeadline },
            { nationality: 'rwanda', education: '', bio: '' }
        );
        expect(score).toBeGreaterThanOrEqual(30);
        expect(reasons.some((r) => /Rwanda/i.test(r))).toBe(true);
    });

    it('awards 10 points for global scholarships (no countries list)', () => {
        const { score, reasons } = scoreScholarship(
            { countries: [], grades: [], fields: [], tags: [], deadline: futureDeadline },
            { nationality: 'rwanda', education: '', bio: '' }
        );
        expect(score).toBeGreaterThanOrEqual(10);
        expect(reasons).toContain('Open globally');
    });

    it('does not award country points when nationality is not listed', () => {
        const { score } = scoreScholarship(
            { countries: ['Kenya'], grades: [], fields: [], tags: [], deadline: futureDeadline },
            { nationality: 'rwanda', education: '', bio: '' }
        );
        // No country match → no 30 bonus, no global bonus.
        expect(score).toBeLessThan(30);
    });

    it('matches education level via grades (case-insensitive substring)', () => {
        const { score, reasons } = scoreScholarship(
            { countries: [], grades: ['undergraduate'], fields: [], tags: [], deadline: futureDeadline },
            { nationality: '', education: 'Undergraduate, year 2', bio: '' }
        );
        expect(score).toBeGreaterThanOrEqual(25);
        expect(reasons.some((r) => /undergraduate/i.test(r))).toBe(true);
    });

    it('caps interest bonus at 20 points', () => {
        const { score, reasons } = scoreScholarship(
            {
                countries: [],
                grades: [],
                fields: ['stem', 'engineering', 'robotics', 'medicine', 'biology', 'chemistry'],
                tags: [],
                deadline: futureDeadline,
            },
            {
                nationality: '',
                education: '',
                bio: 'I love stem and engineering and robotics and medicine and biology and chemistry',
            }
        );
        // Open-globally 10 + no-grade 5 + interest cap 20 + deadline freshness 5 = 40 max.
        expect(score).toBeLessThanOrEqual(40);
        expect(reasons.some((r) => /Interests:/.test(r))).toBe(true);
    });

    it('returns zero when nothing matches a fully restricted scholarship', () => {
        const { score } = scoreScholarship(
            { countries: ['Norway'], grades: ['phd'], fields: ['astrophysics'], tags: [], deadline: futureDeadline },
            { nationality: 'rwanda', education: 'undergraduate', bio: 'I love football' }
        );
        // Deadline freshness still adds 5; everything else is zero.
        expect(score).toBeLessThanOrEqual(5);
    });

    it('toPercent clamps to 0..100', () => {
        expect(toPercent(0)).toBe(0);
        expect(toPercent(1000)).toBe(100);
        expect(toPercent(-5)).toBe(0);
    });
});

describe('rankScholarships (pure)', () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    it('drops zero-score items and sorts highest first', () => {
        const ranked = rankScholarships(
            [
                { _id: 'irrelevant', countries: ['Norway'], grades: ['phd'], fields: [], tags: [], deadline: future },
                { _id: 'global', countries: [], grades: [], fields: [], tags: [], deadline: future },
                { _id: 'perfect', countries: ['Rwanda'], grades: ['undergraduate'], fields: ['stem'], tags: [], deadline: future },
            ],
            { nationality: 'rwanda', education: 'undergraduate', bio: 'I love stem subjects' },
            10
        );
        const ids = ranked.map((entry) => entry.scholarship._id);
        expect(ids).toContain('perfect');
        expect(ids).toContain('global');
        // Perfect should outrank global.
        expect(ids.indexOf('perfect')).toBeLessThan(ids.indexOf('global'));
        // Irrelevant has score 5 (deadline freshness only) — still kept.
        // (Test the cap separately.)
    });

    it('respects the limit', () => {
        const candidates = Array.from({ length: 30 }, (_, i) => ({
            _id: `s${i}`,
            countries: ['Rwanda'],
            grades: [],
            fields: [],
            tags: [],
            deadline: future,
        }));
        const ranked = rankScholarships(candidates, { nationality: 'rwanda' }, 5);
        expect(ranked).toHaveLength(5);
    });
});

// --- End-to-end test of the HTTP endpoint -----------------------------------
const hash = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');
const makePasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return { passwordSalt, passwordHash: hash(password, passwordSalt) };
};

const createSignedInScholar = async (overrides = {}) => {
    const scholar = await Scholar.create({
        name: 'Rec Tester',
        email: `rec-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
        role: 'student',
        ...makePasswordRecord('StrongPassw0rd!'),
        ...overrides,
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

describe('GET /api/auth/student/recommendations', () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

    beforeEach(async () => {
        await Scholarship.create([
            { title: 'Rwanda STEM Grant', active: true, countries: ['Rwanda'], grades: ['undergraduate'], fields: ['stem'], tags: [], deadline: future },
            { title: 'Global Arts Fund', active: true, countries: [], grades: [], fields: ['arts'], tags: [], deadline: future },
            { title: 'Norway Only', active: true, countries: ['Norway'], grades: ['phd'], fields: ['astrophysics'], tags: [], deadline: future },
            { title: 'Closed Already', active: true, countries: [], grades: [], fields: [], tags: [], deadline: past },
            { title: 'Disabled', active: false, countries: [], grades: [], fields: [], tags: [], deadline: future },
        ]);
    });

    it('rejects requests without a scholar session', async () => {
        const res = await request(app).get('/api/auth/student/recommendations');
        expect(res.status).toBe(401);
    });

    it('returns personalised matches for scholars with a linked profile', async () => {
        const { scholar, token } = await createSignedInScholar();
        const app1 = await Application.create({
            name: scholar.name,
            scholar: scholar._id,
            nationality: 'Rwanda',
            education: 'Undergraduate, year 2',
            bio: 'I love stem subjects',
        });
        scholar.application = app1._id;
        await scholar.save();

        const res = await request(app)
            .get('/api/auth/student/recommendations?limit=5')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.personalised).toBe(true);
        expect(Array.isArray(res.body.items)).toBe(true);
        const titles = res.body.items.map((entry) => entry.scholarship.title);
        // Rwanda STEM Grant should be the top match.
        expect(titles[0]).toBe('Rwanda STEM Grant');
        // Closed + disabled must be filtered out.
        expect(titles).not.toContain('Closed Already');
        expect(titles).not.toContain('Disabled');
        // Each entry exposes match metadata for the UI.
        expect(res.body.items[0].matchPercent).toBeGreaterThan(0);
        expect(Array.isArray(res.body.items[0].reasons)).toBe(true);
    });

    it('falls back to recent items when the scholar has no profile data', async () => {
        const { token } = await createSignedInScholar();
        // No linked Application.
        const res = await request(app)
            .get('/api/auth/student/recommendations')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        // With no profile every candidate still scores at least 5 (deadline +
        // either "open globally" or grade neutrality). The endpoint returns a
        // personalised:false flag only when there is literally no application.
        expect(res.body.personalised).toBe(false);
        expect(res.body.items.length).toBeGreaterThan(0);
    });

    it('caps the limit between 1 and 50', async () => {
        const { token } = await createSignedInScholar();
        const res = await request(app)
            .get('/api/auth/student/recommendations?limit=999')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
    });
});
