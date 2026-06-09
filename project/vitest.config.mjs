import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: false,
        setupFiles: ['./test/setup.mjs'],
        // Each test file gets its own worker so the shared mongoose connection
        // in setup.mjs does not race across files. Memory-server is fast to boot.
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 120_000,
        include: ['test/**/*.test.mjs'],
    },
});
