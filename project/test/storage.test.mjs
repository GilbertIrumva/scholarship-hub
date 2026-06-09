// project/test/storage.test.mjs
//
// Tests for the storage abstraction introduced in T3.1.
// We only exercise the local backend with real file IO (fast + hermetic) and
// the s3 backend through the standard SDK error path (no real bucket needed).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const storage = require('../lib/storage');

const {
    localBackend,
    s3Backend,
    preferredBackend,
    backendFor,
    UPLOADS_ROOT,
    __resetForTests,
} = storage;

describe('lib/storage — local backend', () => {
    const written = [];

    afterEach(async () => {
        // Clean up anything the tests wrote so we do not pollute uploads/.
        for (const key of written.splice(0)) {
            await localBackend.delete(key).catch(() => {});
        }
    });

    it('put() writes a file and returns a forward-slash relative key', async () => {
        const buffer = Buffer.from('hello world', 'utf8');
        const { key, size } = await localBackend.put({
            buffer,
            prefix: 'storage-test/round-trip',
            originalName: 'note.txt',
        });
        written.push(key);

        expect(key.startsWith('storage-test/round-trip/')).toBe(true);
        expect(key.includes('\\')).toBe(false);
        expect(size).toBe(buffer.length);

        const fullPath = path.join(UPLOADS_ROOT, key);
        expect(fs.existsSync(fullPath)).toBe(true);
        expect(fs.readFileSync(fullPath, 'utf8')).toBe('hello world');
    });

    it('getReadStream() returns the same bytes that were written', async () => {
        const buffer = Buffer.from('roundtrip-bytes-' + crypto.randomBytes(4).toString('hex'));
        const { key } = await localBackend.put({
            buffer,
            prefix: 'storage-test/stream',
            originalName: 'r.bin',
        });
        written.push(key);

        const stream = await localBackend.getReadStream(key);
        expect(stream).not.toBeNull();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        expect(Buffer.concat(chunks).toString()).toBe(buffer.toString());
    });

    it('getReadStream() returns null when the key does not exist', async () => {
        const stream = await localBackend.getReadStream('storage-test/missing/nope.bin');
        expect(stream).toBeNull();
    });

    it('delete() removes the file and is idempotent', async () => {
        const { key } = await localBackend.put({
            buffer: Buffer.from('temp'),
            prefix: 'storage-test/delete',
            originalName: 'd.txt',
        });
        const fullPath = path.join(UPLOADS_ROOT, key);
        expect(fs.existsSync(fullPath)).toBe(true);

        await localBackend.delete(key);
        expect(fs.existsSync(fullPath)).toBe(false);

        // Idempotent: deleting again must not throw.
        await expect(localBackend.delete(key)).resolves.toBeUndefined();
    });

    it('resolves legacy absolute paths from pre-abstraction records', async () => {
        // Simulate an "old" record by writing a file outside the new layout and
        // storing its absolute path as the key.
        const dir = path.join(UPLOADS_ROOT, 'storage-test', 'legacy-abs');
        fs.mkdirSync(dir, { recursive: true });
        const fullPath = path.join(dir, 'legacy.txt');
        fs.writeFileSync(fullPath, 'legacy-content');
        written.push(path.relative(UPLOADS_ROOT, fullPath).split(path.sep).join('/'));

        const stream = await localBackend.getReadStream(fullPath);
        expect(stream).not.toBeNull();
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        expect(Buffer.concat(chunks).toString()).toBe('legacy-content');
    });

    it('signedReadUrl() returns null (local backend has no presigned URLs)', async () => {
        await expect(localBackend.signedReadUrl('anything')).resolves.toBeNull();
    });
});

describe('lib/storage — preferredBackend / backendFor', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        __resetForTests();
        delete process.env.STORAGE_BACKEND;
        delete process.env.S3_BUCKET;
        delete process.env.S3_REGION;
        delete process.env.S3_ENDPOINT;
        delete process.env.S3_ACCESS_KEY_ID;
        delete process.env.S3_SECRET_ACCESS_KEY;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        __resetForTests();
    });

    it('returns the local backend when STORAGE_BACKEND is unset', () => {
        expect(preferredBackend().name).toBe('local');
    });

    it('returns local when STORAGE_BACKEND=s3 but S3_BUCKET is missing', () => {
        process.env.STORAGE_BACKEND = 's3';
        expect(preferredBackend().name).toBe('local');
    });

    it('s3Backend.isConfigured() is false without a bucket', () => {
        expect(s3Backend.isConfigured()).toBe(false);
    });

    it('backendFor() falls back to local for unknown names', () => {
        expect(backendFor('does-not-exist').name).toBe('local');
        expect(backendFor('local').name).toBe('local');
        expect(backendFor('s3').name).toBe('s3');
    });
});
