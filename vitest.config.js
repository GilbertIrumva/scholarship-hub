import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    test: {
        environment: 'jsdom',
        globals: false,
        setupFiles: ['./src/test/setup.js'],
        include: ['src/**/*.{test,spec}.{js,jsx}'],
        // Avoid pulling tests from the backend project folder.
        exclude: ['node_modules/**', 'project/**', 'dist/**'],
        css: false,
    },
});
