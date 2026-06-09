import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock axios BEFORE importing the module under test so the service grabs the
// mocked version. Each method is a vi.fn() we can configure per-test.
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

import axios from 'axios';
import {
    getPublicStats,
    getPublicFilters,
    searchPublicScholarships,
    getPublicScholarshipById,
} from './publicApi.js';

describe('publicApi service', () => {
    beforeEach(() => {
        axios.get.mockReset();
        axios.post.mockReset();
    });

    it('getPublicStats() returns the data payload from /api/public/stats', async () => {
        axios.get.mockResolvedValue({ data: { totalScholars: 42, totalScholarships: 7 } });
        const stats = await getPublicStats();
        expect(axios.get).toHaveBeenCalledWith('/api/public/stats');
        expect(stats).toEqual({ totalScholars: 42, totalScholarships: 7 });
    });

    it('getPublicFilters() returns the data payload from /api/public/filters', async () => {
        axios.get.mockResolvedValue({ data: { countries: ['Rwanda'], fields: ['CS'] } });
        const filters = await getPublicFilters();
        expect(axios.get).toHaveBeenCalledWith('/api/public/filters');
        expect(filters.countries).toContain('Rwanda');
    });

    it('searchPublicScholarships() forwards filter params', async () => {
        axios.get.mockResolvedValue({ data: { items: [], total: 0 } });
        await searchPublicScholarships({ country: 'Kenya', q: 'engineering' });
        expect(axios.get).toHaveBeenCalledWith(
            '/api/public/scholarships',
            { params: { country: 'Kenya', q: 'engineering' } }
        );
    });

    it('getPublicScholarshipById() requests the right URL', async () => {
        axios.get.mockResolvedValue({ data: { _id: 'abc123', title: 'Test' } });
        const result = await getPublicScholarshipById('abc123');
        expect(axios.get).toHaveBeenCalledWith('/api/public/scholarships/abc123');
        expect(result.title).toBe('Test');
    });

    it('propagates network errors', async () => {
        axios.get.mockRejectedValue(new Error('Network down'));
        await expect(getPublicStats()).rejects.toThrow('Network down');
    });
});
