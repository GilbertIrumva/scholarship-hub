/**
 * Public catalog tests — covers `/api/public/scholarships` faceted filters,
 * sort options, deadline window, amount range, and open-only flag introduced
 * with the T2.2 upgrade.
 */
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app } = require('../index');
const { Scholarship } = require('../db/models');

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();

const seedCatalog = async () => {
    await Scholarship.create([
        {
            title: 'Future Africa Fellowship',
            provider: 'Africa Foundation',
            description: 'STEM funding for African graduates',
            amount: 25_000,
            currency: 'USD',
            countries: ['Rwanda', 'Kenya'],
            grades: ['Masters'],
            fields: ['Engineering'],
            deadline: new Date(now() + 10 * DAY),
            active: true,
        },
        {
            title: 'European Arts Award',
            provider: 'EU Council',
            description: 'Visual arts grant',
            amount: 5_000,
            currency: 'EUR',
            countries: ['France', 'Germany'],
            grades: ['Undergraduate'],
            fields: ['Arts'],
            deadline: new Date(now() + 60 * DAY),
            active: true,
        },
        {
            title: 'Global PhD Programme',
            provider: 'World Education',
            description: 'PhD funding worldwide',
            amount: 50_000,
            currency: 'USD',
            countries: ['Rwanda', 'France', 'USA'],
            grades: ['PhD'],
            fields: ['Engineering', 'Sciences'],
            deadline: new Date(now() + 200 * DAY),
            active: true,
        },
        {
            title: 'Closed Legacy Grant',
            provider: 'Old Trust',
            description: 'Already past',
            amount: 1_000,
            currency: 'USD',
            countries: ['Rwanda'],
            grades: ['Masters'],
            fields: ['Engineering'],
            deadline: new Date(now() - 30 * DAY),
            active: true,
        },
        {
            title: 'Inactive Hidden',
            provider: 'Hidden Inc',
            amount: 100_000,
            currency: 'USD',
            countries: ['Rwanda'],
            active: false,
        },
    ]);
};

describe('GET /api/public/scholarships — faceted search', () => {
    beforeEach(async () => {
        await seedCatalog();
    });

    it('returns only active scholarships with a total count', async () => {
        const res = await request(app).get('/api/public/scholarships');
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ total: 4 });
        expect(res.body.items.length).toBe(4);
        expect(res.body.items.every((s) => s.active)).toBe(true);
    });

    it('filters by country using $in match', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ country: 'France' });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).toContain('European Arts Award');
        expect(titles).toContain('Global PhD Programme');
        expect(titles).not.toContain('Future Africa Fellowship');
    });

    it('filters by grade and field together', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ grade: 'Masters', field: 'Engineering' });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).toContain('Future Africa Fellowship');
        expect(titles).toContain('Closed Legacy Grant');
    });

    it('filters by full-text query against title/provider/description', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ q: 'phd' });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).toEqual(['Global PhD Programme']);
    });

    it('applies minAmount and maxAmount range', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ minAmount: 10_000, maxAmount: 30_000 });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).toEqual(['Future Africa Fellowship']);
    });

    it('hides closed scholarships when openOnly=true', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ openOnly: 'true' });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).not.toContain('Closed Legacy Grant');
        expect(titles.length).toBe(3);
    });

    it('filters by deadlineBefore', async () => {
        const before = new Date(now() + 30 * DAY).toISOString();
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ deadlineBefore: before });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        // Future Africa (10 days) + Closed Legacy (past). NOT European (60d) or Global (200d).
        expect(titles).toContain('Future Africa Fellowship');
        expect(titles).toContain('Closed Legacy Grant');
        expect(titles).not.toContain('European Arts Award');
        expect(titles).not.toContain('Global PhD Programme');
    });

    it('combines openOnly with deadlineBefore (window of next 30 days)', async () => {
        const before = new Date(now() + 30 * DAY).toISOString();
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ openOnly: 'true', deadlineBefore: before });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        expect(titles).toEqual(['Future Africa Fellowship']);
    });

    it('sorts by amount-desc when requested', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ sort: 'amount-desc' });
        expect(res.status).toBe(200);
        const amounts = res.body.items.map((s) => s.amount);
        const sorted = [...amounts].sort((a, b) => b - a);
        expect(amounts).toEqual(sorted);
    });

    it('sorts alphabetically with sort=title-asc', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ sort: 'title-asc' });
        expect(res.status).toBe(200);
        const titles = res.body.items.map((s) => s.title);
        const sorted = [...titles].sort();
        expect(titles).toEqual(sorted);
    });

    it('defaults to deadline-asc when sort is missing or unknown', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ sort: 'bogus-value' });
        expect(res.status).toBe(200);
        const deadlines = res.body.items
            .map((s) => (s.deadline ? new Date(s.deadline).getTime() : Infinity));
        const sorted = [...deadlines].sort((a, b) => a - b);
        expect(deadlines).toEqual(sorted);
    });

    it('paginates via offset + limit and returns the same total', async () => {
        const first = await request(app)
            .get('/api/public/scholarships')
            .query({ limit: 2, offset: 0, sort: 'title-asc' });
        const second = await request(app)
            .get('/api/public/scholarships')
            .query({ limit: 2, offset: 2, sort: 'title-asc' });
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.total).toBe(4);
        expect(second.body.total).toBe(4);
        expect(first.body.items.length).toBe(2);
        expect(second.body.items.length).toBe(2);
        const firstTitles = first.body.items.map((s) => s.title);
        const secondTitles = second.body.items.map((s) => s.title);
        // No overlap between pages.
        expect(firstTitles.some((t) => secondTitles.includes(t))).toBe(false);
    });

    it('ignores invalid numeric inputs without erroring', async () => {
        const res = await request(app)
            .get('/api/public/scholarships')
            .query({ minAmount: 'abc', maxAmount: '-5' });
        expect(res.status).toBe(200);
        expect(res.body.total).toBe(4);
    });
});
