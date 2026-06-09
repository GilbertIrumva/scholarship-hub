/**
 * lib/storage.js — Pluggable file storage abstraction.
 *
 * Two backends are supported:
 *   - 'local'  Files written to disk under project/uploads/. The current,
 *              zero-config default. Downloads stream through the API.
 *   - 's3'     Files PUT to an S3-compatible bucket (AWS S3 or Cloudflare R2)
 *              via @aws-sdk/client-s3. Downloads are 302-redirects to a 15-min
 *              presigned URL so the browser fetches directly from the bucket
 *              and the Node process never proxies the bytes.
 *
 * Each persisted record stores the `storageBackend` it was created against,
 * so flipping the global `STORAGE_BACKEND` env at any point does NOT break
 * access to existing files — old records still resolve through the local
 * adapter while new uploads land in S3.
 *
 * The S3 SDK is loaded lazily so that:
 *   - Test runs and dev environments without the SDK installed still boot.
 *   - When the env vars are not set, `preferredBackend()` falls back to local
 *     instead of crashing — making the migration completely opt-in.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_ROOT = path.resolve(__dirname, '..', 'uploads');

// Pre-existing records (from before this abstraction landed) stored the full
// absolute path in `storagePath`. New records store a forward-slash key that
// is relative to UPLOADS_ROOT. This helper accepts both shapes.
const resolveLocalPath = (key) => {
    if (!key) return '';
    if (path.isAbsolute(key)) return key;
    return path.join(UPLOADS_ROOT, key);
};

// ---------------------------------------------------------------------------
// Local-disk backend (default)
// ---------------------------------------------------------------------------
const localBackend = {
    name: 'local',
    isConfigured() {
        return true;
    },

    async put({ buffer, prefix, originalName }) {
        const dir = path.join(UPLOADS_ROOT, prefix);
        fs.mkdirSync(dir, { recursive: true });
        const safeExt = path.extname(originalName || '').toLowerCase().slice(0, 8);
        const filename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
        const fullPath = path.join(dir, filename);
        await fs.promises.writeFile(fullPath, buffer);
        // Store a stable, OS-agnostic key relative to UPLOADS_ROOT so the
        // record is portable between Linux and Windows checkouts.
        const key = path.relative(UPLOADS_ROOT, fullPath).split(path.sep).join('/');
        return { key, size: buffer.length };
    },

    async getReadStream(key) {
        const fullPath = resolveLocalPath(key);
        if (!fs.existsSync(fullPath)) return null;
        return fs.createReadStream(fullPath);
    },

    async delete(key) {
        const fullPath = resolveLocalPath(key);
        await fs.promises.unlink(fullPath).catch(() => {});
    },

    // Local backend has no signed URLs; callers should fall back to streaming.
    async signedReadUrl() {
        return null;
    },
};

// ---------------------------------------------------------------------------
// S3 backend (lazy-loaded — the SDK is optional at runtime)
// ---------------------------------------------------------------------------
let cachedSdk; // undefined = not tried, null = tried but missing, object = loaded
const loadSdk = () => {
    if (cachedSdk !== undefined) return cachedSdk;
    try {
        const clientS3 = require('@aws-sdk/client-s3');
        const presigner = require('@aws-sdk/s3-request-presigner');
        cachedSdk = {
            S3Client: clientS3.S3Client,
            PutObjectCommand: clientS3.PutObjectCommand,
            GetObjectCommand: clientS3.GetObjectCommand,
            DeleteObjectCommand: clientS3.DeleteObjectCommand,
            getSignedUrl: presigner.getSignedUrl,
        };
    } catch {
        cachedSdk = null;
    }
    return cachedSdk;
};

let cachedClient;
let cachedClientFingerprint = '';
const buildClientFingerprint = () =>
    [
        process.env.S3_REGION || '',
        process.env.S3_ENDPOINT || '',
        process.env.S3_ACCESS_KEY_ID || '',
        process.env.S3_SECRET_ACCESS_KEY || '',
        process.env.S3_BUCKET || '',
    ].join('|');

const ensureClient = () => {
    const sdk = loadSdk();
    if (!sdk) return null;
    const fingerprint = buildClientFingerprint();
    if (cachedClient && cachedClientFingerprint === fingerprint) return cachedClient;
    const region = process.env.S3_REGION || 'us-east-1';
    const endpoint = process.env.S3_ENDPOINT || undefined;
    const credentials =
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                  accessKeyId: process.env.S3_ACCESS_KEY_ID,
                  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined;
    cachedClient = new sdk.S3Client({
        region,
        endpoint,
        // Path-style is required by R2 + most non-AWS providers; AWS itself
        // accepts it too.
        forcePathStyle: Boolean(endpoint),
        credentials,
    });
    cachedClientFingerprint = fingerprint;
    return cachedClient;
};

const buildContentDisposition = (filename, inline) => {
    const safe = String(filename || '').replace(/[\r\n"]/g, '');
    const kind = inline ? 'inline' : 'attachment';
    if (!safe) return kind;
    // RFC 5987 — the * variant covers non-ASCII names cleanly.
    return `${kind}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

const s3Backend = {
    name: 's3',
    isConfigured() {
        return Boolean(process.env.S3_BUCKET && loadSdk());
    },

    async put({ buffer, contentType, prefix, originalName }) {
        const sdk = loadSdk();
        const client = ensureClient();
        if (!sdk || !client) throw new Error('S3 backend not configured');
        const safeExt = path.extname(originalName || '').toLowerCase().slice(0, 8);
        const key = `${prefix}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
        await client.send(
            new sdk.PutObjectCommand({
                Bucket: process.env.S3_BUCKET,
                Key: key,
                Body: buffer,
                ContentType: contentType || 'application/octet-stream',
            }),
        );
        return { key, size: buffer.length };
    },

    async getReadStream(key) {
        const sdk = loadSdk();
        const client = ensureClient();
        if (!sdk || !client) return null;
        try {
            const resp = await client.send(
                new sdk.GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
            );
            return resp.Body; // Node Readable stream
        } catch (err) {
            if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NoSuchKey') return null;
            throw err;
        }
    },

    async delete(key) {
        const sdk = loadSdk();
        const client = ensureClient();
        if (!sdk || !client) return;
        await client
            .send(new sdk.DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
            .catch(() => {});
    },

    async signedReadUrl(key, { expiresInSec = 900, filename, inline = true } = {}) {
        const sdk = loadSdk();
        const client = ensureClient();
        if (!sdk || !client) return null;
        const cmd = new sdk.GetObjectCommand({
            Bucket: process.env.S3_BUCKET,
            Key: key,
            ResponseContentDisposition: buildContentDisposition(filename, inline),
        });
        return sdk.getSignedUrl(client, cmd, { expiresIn: expiresInSec });
    },
};

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
const backends = Object.freeze({ local: localBackend, s3: s3Backend });

const preferredBackend = () => {
    if (process.env.STORAGE_BACKEND === 's3' && s3Backend.isConfigured()) {
        return s3Backend;
    }
    return localBackend;
};

const backendFor = (name) => backends[name] || localBackend;

// Test-only — lets the test suite reset the SDK/client cache after mutating
// env vars. Not used by production code.
const __resetForTests = () => {
    cachedSdk = undefined;
    cachedClient = null;
    cachedClientFingerprint = '';
};

module.exports = {
    backends,
    preferredBackend,
    backendFor,
    localBackend,
    s3Backend,
    UPLOADS_ROOT,
    __resetForTests,
};
