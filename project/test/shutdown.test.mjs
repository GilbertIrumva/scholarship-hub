import request from 'supertest';
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { app, gracefulShutdown } = require('../index');

describe('graceful shutdown (T4.3)', () => {
    it('gracefulShutdown is exported and is a function', () => {
        expect(typeof gracefulShutdown).toBe('function');
    });

    it('flipping shutdown forces /readyz to 503 + status:not-ready', async () => {
        // Stub process.exit so the shutdown helper doesn't kill the test runner
        // when the (very short) grace timer elapses.
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});

        // Override the grace window to ~0 so we don't actually wait 25s in tests.
        const prev = process.env.SHUTDOWN_GRACE_MS;
        process.env.SHUTDOWN_GRACE_MS = '50';

        try {
            // Kick off shutdown — do NOT await; it returns after the grace
            // timer + a 50ms exit delay. We only need the shuttingDown flag
            // to flip synchronously, which the implementation does on entry.
            const promise = gracefulShutdown('test');

            // The flag flips before the first `await`, so /readyz observes
            // shuttingDown=true on the very next request.
            const res = await request(app).get('/readyz');
            expect(res.status).toBe(503);
            expect(res.body.status).toBe('not-ready');
            expect(res.body.checks.shuttingDown).toBe(true);

            // Liveness keeps reporting 200 but advertises shuttingDown=true
            // so dashboards can highlight draining pods.
            const live = await request(app).get('/healthz');
            expect(live.status).toBe(200);
            expect(live.body.shuttingDown).toBe(true);

            await promise; // let the helper finish its mocked-exit cycle
            // Helper schedules `setTimeout(() => process.exit(0), 50).unref()` after
            // resolving. Wait past that timer so the real process.exit isn't called
            // once we restore the spy in `finally`.
            await new Promise((r) => setTimeout(r, 120));
        } finally {
            if (prev === undefined) delete process.env.SHUTDOWN_GRACE_MS;
            else process.env.SHUTDOWN_GRACE_MS = prev;
            exitSpy.mockRestore();
        }
    });

    it('is idempotent — calling gracefulShutdown twice does not throw', async () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
        const prev = process.env.SHUTDOWN_GRACE_MS;
        process.env.SHUTDOWN_GRACE_MS = '10';

        try {
            await expect(gracefulShutdown('again')).resolves.toBeUndefined();
            await expect(gracefulShutdown('again-2')).resolves.toBeUndefined();
            await new Promise((r) => setTimeout(r, 120));
        } finally {
            if (prev === undefined) delete process.env.SHUTDOWN_GRACE_MS;
            else process.env.SHUTDOWN_GRACE_MS = prev;
            exitSpy.mockRestore();
        }
    });
});
