require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const multer = require('multer');
const otplib = require('otplib');
const QRCode = require('qrcode');

const { connectDb } = require('./db/connect');
const { Admin, Scholar, Application, Scholarship, ScholarshipApplication, ContactMessage, AcademicCredential, TravelDocument, VisaWorkflow, Session, VerificationToken, AuditLog, Notification, Metric } = require('./db/models');
const { sendEmail } = require('./mailer');
const { validate } = require('./lib/validate');
const { audit } = require('./lib/audit');
const { notify, notifyAdmins } = require('./lib/notify');
const { rankScholarships, scoreScholarship } = require('./lib/matching');
const { preferredBackend, backendFor } = require('./lib/storage');
const { logger } = require('./lib/logger');
const { captureException } = require('./lib/observability');
const {
    AdminSignInSchema,
    AdminVerifySchema,
    AdminSignUpSchema,
    ScholarSignInSchema,
    ScholarSignUpSchema,
    ContactMessageSchema,
    ForgotPasswordSchema,
    ResetPasswordSchema,
    VerifyEmailSchema,
    ResendVerificationSchema,
    AuditLogQuerySchema,
    RecommendationsQuerySchema,
    NotificationListQuerySchema,
    TwoFactorEnableSchema,
    TwoFactorDisableSchema,
    TwoFactorChallengeSchema,
    WebVitalsSchema,
} = require('./lib/schemas');

// ---------------------------------------------------------------------------
// Logging — structured JSON in production, pretty-printed in dev.
// The pino instance itself lives in ./lib/logger.js so library modules
// (audit.js, notify.js, observability.js, etc.) can share it without a
// circular dependency on index.js.
// ---------------------------------------------------------------------------
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();

// Trust the first proxy hop so express-rate-limit and req.ip see the real
// client address when deployed behind a reverse proxy (Render, Fly, nginx).
app.set('trust proxy', 1);

// Helmet — secure HTTP headers (CSP relaxed; the API serves JSON only).
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
}));

// CORS — an allow-list driven by CORS_ORIGINS (comma-separated). When unset
// in development we fall back to permissive mode so `npm run dev` still works.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        // Same-origin / curl / server-to-server requests have no origin header.
        if (!origin) return cb(null, true);
        if (CORS_ORIGINS.length === 0) {
            if (IS_PROD) {
                return cb(new Error(`CORS blocked: set CORS_ORIGINS to allow ${origin}`));
            }
            return cb(null, true);
        }
        if (CORS_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
}));

// T4.2 \u2014 Request correlation id. Accept an inbound X-Request-Id (so
// upstream proxies / clients can propagate their own trace id) when it
// looks safe; otherwise mint a fresh UUID. The value is mirrored back on
// the response so users can quote it in support tickets, attached to
// `req.id` for pino-http, and forwarded to Sentry via captureException.
const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_RE = /^[a-zA-Z0-9_-]{8,128}$/;
app.use((req, res, next) => {
    const inbound = req.headers[REQUEST_ID_HEADER];
    const id = typeof inbound === 'string' && REQUEST_ID_RE.test(inbound)
        ? inbound
        : crypto.randomUUID();
    req.id = id;
    res.setHeader('X-Request-Id', id);
    next();
});

app.use(pinoHttp({
    logger,
    // T4.2 \u2014 emit `requestId` on every log line and let pino-http reuse
    // the value we attach below in the request-id middleware.
    genReqId: (req) => req.id,
    customProps: (req) => ({ requestId: req.id }),
    customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    // Quiet healthchecks + telemetry pings in the request log.
    autoLogging: {
        ignore: (req) =>
            req.url === '/healthz' ||
            req.url === '/readyz' ||
            req.url === '/api/health' ||
            req.url === '/api/ready' ||
            req.url === '/api/_metrics/web-vitals',
    },
}));

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// T4.3 — Inflight request tracking + graceful-shutdown state.
//
// `inflightRequests` is incremented on every incoming request and decremented
// when the response finishes (or the socket closes). The graceful shutdown
// loop polls this counter so we know when it's safe to call `server.close()`.
//
// `shuttingDown` flips to true on SIGTERM/SIGINT. While true:
//   • /readyz starts returning 503 so load balancers stop sending traffic.
//   • New requests still complete (we don't want partial writes).
// ---------------------------------------------------------------------------
let inflightRequests = 0;
let shuttingDown = false;

app.use((req, res, next) => {
    inflightRequests += 1;
    // Liveness/readiness probes shouldn't count against drain — orchestrators
    // poll them constantly and we never want them to delay shutdown.
    const isProbe =
        req.url === '/healthz' ||
        req.url === '/readyz' ||
        req.url === '/api/health' ||
        req.url === '/api/ready';
    if (isProbe) inflightRequests -= 1;
    let settled = isProbe;
    const release = () => {
        if (settled) return;
        settled = true;
        inflightRequests = Math.max(0, inflightRequests - 1);
    };
    res.on('finish', release);
    res.on('close', release);
    next();
});

// ---------------------------------------------------------------------------
// Rate limiters — protect auth + write endpoints from brute force / abuse.
// In NODE_ENV=test we disable rate limiting entirely so the test suite can
// fire dozens of auth requests without tripping the limiter.
// ---------------------------------------------------------------------------
const IS_TEST = process.env.NODE_ENV === 'test';
const noopLimiter = (_req, _res, next) => next();

const authLimiter = IS_TEST ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000,     // 15 minutes
    max: 10,                      // 10 auth attempts per IP per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many authentication attempts. Please try again later.' },
});

const contactLimiter = IS_TEST ? noopLimiter : rateLimit({
    windowMs: 60 * 60 * 1000,     // 1 hour
    max: 5,                       // 5 contact-form submissions per IP per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many messages from this address. Please try again later.' },
});

const apiLimiter = IS_TEST ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,                     // 600 general API calls per IP per window (~40/min)
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please slow down and try again shortly.' },
});
app.use('/api/', apiLimiter);

// T4.1 — Looser limiter for the web-vitals telemetry endpoint. A single page
// load can fire 5 metrics (CLS/LCP/INP/TTFB/FCP), and SPAs may navigate
// repeatedly, so we allow a higher cap. Still capped to deter abuse.
const metricsLimiter = IS_TEST ? noopLimiter : rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 240,                     // ~16/min per IP
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    message: { message: 'Telemetry rate limit reached.' },
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// File-upload setup (multer keeps the file in RAM; the storage abstraction
// in lib/storage.js then writes it to disk OR S3 based on STORAGE_BACKEND).
// ---------------------------------------------------------------------------
const UPLOADS_ROOT = path.resolve(__dirname, 'uploads');
// The local backend still writes under uploads/credentials and uploads/travel,
// so we keep these directories around for backwards compatibility with any
// records created before the storage abstraction landed. Once everything is
// on S3 the folders simply stay empty.
const CREDENTIALS_ROOT = path.join(UPLOADS_ROOT, 'credentials');
if (!fs.existsSync(CREDENTIALS_ROOT)) {
    fs.mkdirSync(CREDENTIALS_ROOT, { recursive: true });
}

const CREDENTIAL_ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
]);

const uploadCredential = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
        if (!CREDENTIAL_ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Only PDF or image files (jpg, png, webp, heic) are allowed.'));
        }
        cb(null, true);
    },
});

// ---------------------------------------------------------------------------
// Travel-document storage + AES-256-GCM encryption (Phase 6)
// ---------------------------------------------------------------------------
const TRAVEL_DOCS_ROOT = path.join(UPLOADS_ROOT, 'travel');
if (!fs.existsSync(TRAVEL_DOCS_ROOT)) {
    fs.mkdirSync(TRAVEL_DOCS_ROOT, { recursive: true });
}

const uploadTravelDoc = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!CREDENTIAL_ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Only PDF or image files (jpg, png, webp, heic) are allowed.'));
        }
        cb(null, true);
    },
});

// Helper: stream a stored file to the response, using a 302 redirect to a
// presigned URL when the backend supports it (S3) or a direct pipe otherwise
// (local disk). `entry` is any document with storagePath/storageBackend/mimeType.
const serveStoredFile = async (entry, res) => {
    const backend = backendFor(entry.storageBackend);
    const filenameHeader = String(entry.originalName || '').replace(/"/g, '');

    if (typeof backend.signedReadUrl === 'function') {
        const signed = await backend.signedReadUrl(entry.storagePath, {
            expiresInSec: 15 * 60,
            filename: filenameHeader,
            inline: true,
        });
        if (signed) {
            return res.redirect(302, signed);
        }
    }

    const stream = await backend.getReadStream(entry.storagePath);
    if (!stream) {
        return res.status(410).json({ message: 'File is no longer available.' });
    }
    res.setHeader('Content-Type', entry.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filenameHeader}"`);
    stream.on('error', () => {
        if (!res.headersSent) res.status(500).end();
        else res.end();
    });
    stream.pipe(res);
    return undefined;
};

// Derive a 32-byte AES key from the TRAVEL_DOC_SECRET env var.
// In production this MUST be set to a long random string.
const TRAVEL_DOC_SECRET = process.env.TRAVEL_DOC_SECRET
    || 'dev-only-travel-doc-secret-please-set-TRAVEL_DOC_SECRET-in-prod';
if (TRAVEL_DOC_SECRET.startsWith('dev-only')) {
    if (IS_PROD) {
        logger.fatal('TRAVEL_DOC_SECRET is unset in production. Refusing to start.');
        process.exit(1);
    }
    logger.warn('TRAVEL_DOC_SECRET not set — using insecure dev fallback. Set it in production.');
}
const TRAVEL_DOC_KEY = crypto.createHash('sha256').update(TRAVEL_DOC_SECRET).digest();

const encryptDocNumber = (plaintext) => {
    if (plaintext == null || plaintext === '') {
        return { ciphertext: '', iv: '', authTag: '' };
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', TRAVEL_DOC_KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
    };
};

const decryptDocNumber = (record) => {
    if (!record || !record.ciphertext || !record.iv || !record.authTag) return '';
    try {
        const iv = Buffer.from(record.iv, 'base64');
        const authTag = Buffer.from(record.authTag, 'base64');
        const ciphertext = Buffer.from(record.ciphertext, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', TRAVEL_DOC_KEY, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        logger.warn({ err: err.message }, 'Failed to decrypt travel-doc number');
        return '';
    }
};

// ---------------------------------------------------------------------------
// TOTP (RFC 6238) second-factor helpers — T3.4.
// The encryption key is derived from TOTP_ENC_SECRET so the encrypted
// secret stays opaque even to a DB-only attacker. Falls back to a labelled
// hash of TRAVEL_DOC_SECRET in dev so a single env var keeps both features
// working; in production both vars MUST be set.
// ---------------------------------------------------------------------------
// otplib 13.x exposes a functional API. We compose the crypto + base32
// plugins once and re-use them across helpers below. `window: 1` permits a
// ±1-step (~30 s) skew between the user's authenticator and the server.
const TOTP_PLUGINS = [otplib.NobleCryptoPlugin, otplib.ScureBase32Plugin];
const TOTP_OPTS = { type: 'totp', plugins: TOTP_PLUGINS, window: 1, step: 30 };

const TOTP_ENC_SECRET = process.env.TOTP_ENC_SECRET
    || `${TRAVEL_DOC_SECRET}:totp-fallback`;
if (IS_PROD && !process.env.TOTP_ENC_SECRET) {
    logger.fatal('TOTP_ENC_SECRET is unset in production. Refusing to start.');
    process.exit(1);
}
const TOTP_KEY = crypto.createHash('sha256').update(TOTP_ENC_SECRET).digest();

const encryptSecret = (plaintext) => {
    if (plaintext == null || plaintext === '') {
        return { ciphertext: '', iv: '', authTag: '' };
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', TOTP_KEY, iv);
    const encrypted = Buffer.concat([
        cipher.update(String(plaintext), 'utf8'),
        cipher.final(),
    ]);
    return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
    };
};

const decryptSecret = (record) => {
    if (!record || !record.ciphertext || !record.iv || !record.authTag) return '';
    try {
        const iv = Buffer.from(record.iv, 'base64');
        const authTag = Buffer.from(record.authTag, 'base64');
        const ciphertext = Buffer.from(record.ciphertext, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', TOTP_KEY, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        logger.warn({ err: err.message }, 'Failed to decrypt TOTP secret');
        return '';
    }
};

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'ScholarshipZone';
const BACKUP_CODE_COUNT = 10;

// Backup codes are displayed once as `xxxx-xxxx` for readability, but stored
// as SHA-256 hashes of the normalised (lowercase, no dashes) value so a DB
// dump cannot replay them.
const normalizeBackupCode = (code) =>
    String(code || '').trim().toLowerCase().replace(/[\s-]/g, '');

const hashBackupCode = (code) =>
    crypto.createHash('sha256').update(normalizeBackupCode(code)).digest('hex');

const generateBackupCodes = (count = BACKUP_CODE_COUNT) => {
    const plain = [];
    const hashed = [];
    for (let i = 0; i < count; i += 1) {
        // 4 bytes → 8 hex chars; format as `xxxx-xxxx`.
        const raw = crypto.randomBytes(4).toString('hex');
        const formatted = `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
        plain.push(formatted);
        hashed.push({ hash: hashBackupCode(formatted), usedAt: null });
    }
    return { plain, hashed };
};

const verifyTotpCode = (secret, code) => {
    if (!secret || !code) return false;
    const normalized = String(code).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;
    try {
        // otplib 13.x returns an object like `{valid: true, delta, epoch, timeStep}`
        // on success and `{valid: false}` on failure. The object is always
        // truthy, so we MUST check the `valid` field explicitly.
        const result = otplib.verifySync({ ...TOTP_OPTS, token: normalized, secret });
        return Boolean(result?.valid);
    } catch {
        return false;
    }
};

// Consume a backup code in-place on the account doc. Returns true if a
// matching UNUSED code was found and marked used. Caller must `.save()`.
const consumeBackupCode = (account, code) => {
    if (!account?.totpBackupCodes?.length) return false;
    const target = hashBackupCode(code);
    if (!target || target.length !== 64) return false;
    const entry = account.totpBackupCodes.find(
        (e) => e.hash === target && !e.usedAt,
    );
    if (!entry) return false;
    entry.usedAt = new Date();
    return true;
};

const buildOtpAuthUrl = (account, secret) => {
    const label = account?.email || 'user';
    return otplib.generateURI({
        type: 'totp',
        plugins: TOTP_PLUGINS,
        accountName: label,
        issuer: TOTP_ISSUER,
        secret,
    });
};

const buildOtpQrDataUrl = async (otpauthUrl) => {
    try {
        return await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1 });
    } catch (err) {
        logger.warn({ err: err.message }, 'Failed to render TOTP QR code');
        return '';
    }
};

// ---------------------------------------------------------------------------
// Auth state — persisted in MongoDB via the Session model so tokens survive
// process restarts and so the API can be horizontally scaled. Each Session
// document has a TTL index on `expiresAt`, so Mongo purges them automatically.
//
// Sliding-session design (T3.3):
//   - Access token: short-lived bearer (15 min), sent as `Authorization: Bearer`.
//   - Refresh token: long-lived opaque value (30 days), delivered ONLY via the
//     httpOnly `sz_rt` cookie. Hashed at rest. Rotated on every /refresh call.
//   - On refresh: the just-rotated hash is kept in `previousRefreshHash`; any
//     subsequent presentation of that hash triggers reuse detection (the
//     session is destroyed and the event is audited).
// ---------------------------------------------------------------------------
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TTL_MS = 15 * 60 * 1000;             // 15 min
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

const REFRESH_COOKIE_NAME = 'sz_rt';
const REFRESH_COOKIE_PATH = '/api/auth';

const refreshCookieOptions = (maxAgeMs) => ({
    httpOnly: true,
    secure: IS_PROD,
    // In production the SPA and the API typically live on different subdomains
    // so we need SameSite=None + Secure for the cookie to ride along on
    // cross-site fetches. In dev we use 'lax' so localhost works without TLS.
    sameSite: IS_PROD ? 'none' : 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeMs,
});

const hashRefreshToken = (token) =>
    crypto.createHash('sha256').update(String(token)).digest('hex');

const setRefreshCookie = (res, token, maxAgeMs = REFRESH_TTL_MS) => {
    if (!res || typeof res.cookie !== 'function') return;
    res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions(maxAgeMs));
};

const clearRefreshCookie = (res) => {
    if (!res || typeof res.clearCookie !== 'function') return;
    res.clearCookie(REFRESH_COOKIE_NAME, { ...refreshCookieOptions(0), maxAge: undefined });
};

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const hashPassword = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');

const createPasswordRecord = (password) => {
    const passwordSalt = crypto.randomBytes(16).toString('hex');
    return {
        passwordSalt,
        passwordHash: hashPassword(password, passwordSalt),
    };
};

const isValidEmail = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
const isValidPassword = (password = '') => String(password).trim().length >= 8;

const safeEqual = (left, right) => {
    const leftBuffer = Buffer.from(String(left));
    const rightBuffer = Buffer.from(String(right));
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyPassword = (password, record) => {
    // Accounts created via OAuth may have no password set at all.
    if (!record?.passwordSalt || !record?.passwordHash) return false;
    const candidate = hashPassword(password, record.passwordSalt);
    return safeEqual(candidate, record.passwordHash);
};

/**
 * issueSession — create a new Session document.
 *
 * For 'admin-challenge' sessions only an access token is issued (the
 * challenge is short-lived and single-use, so a refresh token would be
 * pointless). For 'scholar' and 'admin' sessions BOTH tokens are issued
 * and the refresh token is dropped into the httpOnly `sz_rt` cookie.
 *
 * @returns {Promise<{token: string, expiresAt: Date, refreshToken?: string, refreshExpiresAt?: Date}>}
 */
const issueSession = async ({ kind, principalId, ttlMs, req, res }) => {
    const token = crypto.randomUUID();
    const now = Date.now();
    const accessTtl = ttlMs || ACCESS_TTL_MS;
    const accessExpiresAt = new Date(now + accessTtl);

    const isAuthSession = kind === 'scholar' || kind === 'admin';
    const refreshToken = isAuthSession ? crypto.randomUUID() + crypto.randomBytes(16).toString('hex') : undefined;
    const refreshExpiresAt = isAuthSession ? new Date(now + REFRESH_TTL_MS) : undefined;

    await Session.create({
        token,
        kind,
        principalId,
        // `expiresAt` always holds the LATER of access/refresh expiry so the
        // Mongo TTL index keeps the row alive for the full refresh window.
        expiresAt: refreshExpiresAt || accessExpiresAt,
        accessExpiresAt,
        refreshTokenHash: refreshToken ? hashRefreshToken(refreshToken) : undefined,
        refreshExpiresAt,
        lastActiveAt: new Date(now),
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
    });

    if (refreshToken && res) {
        setRefreshCookie(res, refreshToken);
    }

    return {
        token,
        expiresAt: accessExpiresAt,
        refreshToken,
        refreshExpiresAt,
    };
};

const findActiveSession = async (token, kind) => {
    if (!token) return null;
    const doc = await Session.findOne({ token, kind });
    if (!doc) return null;
    // Prefer the new `accessExpiresAt` field; fall back to `expiresAt` for
    // legacy rows created before T3.3 landed.
    const accessExpiry = doc.accessExpiresAt || doc.expiresAt;
    if (accessExpiry.getTime() <= Date.now()) {
        // Don't delete here — the refresh token may still be valid, in which
        // case POST /api/auth/refresh will rotate the access token. The TTL
        // index handles cleanup when the refresh expires too.
        return null;
    }
    return doc;
};

const revokeSession = async (token) => {
    if (!token) return;
    await Session.deleteOne({ token }).catch(() => {});
};

// Touch lastActiveAt at most once every 5 minutes per session. Avoids
// hammering Mongo with a write on every authenticated request while still
// giving the device-management UI fresh data.
const LAST_ACTIVE_THROTTLE_MS = 5 * 60 * 1000;
const touchLastActive = async (session) => {
    if (!session) return;
    const last = session.lastActiveAt ? session.lastActiveAt.getTime() : 0;
    if (Date.now() - last < LAST_ACTIVE_THROTTLE_MS) return;
    await Session.updateOne(
        { _id: session._id },
        { $set: { lastActiveAt: new Date() } },
    ).catch(() => {});
};

// ---------------------------------------------------------------------------
// Google OAuth 2.0 — sign-in / sign-up via Google.
// Stateless: the `state` parameter is an HMAC-signed JSON envelope so we do
// not need an extra collection or express-session middleware.
// ---------------------------------------------------------------------------
const GOOGLE_OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

const googleOAuthConfig = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || '';
    const stateSecret = process.env.OAUTH_STATE_SECRET || '';
    const configured = Boolean(clientId && clientSecret && redirectUri && stateSecret);
    return { clientId, clientSecret, redirectUri, stateSecret, configured };
};

const base64UrlEncode = (input) =>
    Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const base64UrlDecode = (input) => {
    const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return Buffer.from(normalized, 'base64').toString('utf8');
};

const signOAuthState = (payload, secret) => {
    const body = base64UrlEncode(JSON.stringify(payload));
    const sig = crypto.createHmac('sha256', secret).update(body).digest();
    return `${body}.${base64UrlEncode(sig)}`;
};

const verifyOAuthState = (state, secret) => {
    if (typeof state !== 'string' || !state.includes('.')) return null;
    const [body, providedSig] = state.split('.', 2);
    if (!body || !providedSig) return null;
    const expectedSig = crypto.createHmac('sha256', secret).update(body).digest();
    let providedBuf;
    try {
        providedBuf = Buffer.from(
            providedSig.replace(/-/g, '+').replace(/_/g, '/') +
                (providedSig.length % 4 === 0 ? '' : '='.repeat(4 - (providedSig.length % 4))),
            'base64',
        );
    } catch {
        return null;
    }
    if (providedBuf.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(providedBuf, expectedSig)) return null;
    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(body));
    } catch {
        return null;
    }
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.ts !== 'number') return null;
    if (Date.now() - payload.ts > GOOGLE_OAUTH_STATE_TTL_MS) return null;
    return payload;
};

// Only allow same-origin relative paths so the callback cannot be tricked
// into redirecting to an attacker-controlled site (open-redirect protection).
const sanitizeReturnTo = (raw) => {
    if (typeof raw !== 'string' || !raw) return '/scholar';
    if (!raw.startsWith('/') || raw.startsWith('//')) return '/scholar';
    // Disallow newlines / control chars in case the value is logged.
    if (/[\r\n\t\0]/.test(raw)) return '/scholar';
    return raw.slice(0, 200);
};

const exchangeGoogleCode = async ({ code, clientId, clientSecret, redirectUri }) => {
    const body = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
    });
    const response = await globalThis.fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`google-token-exchange-failed: ${response.status} ${text.slice(0, 200)}`);
    }
    return response.json();
};

const fetchGoogleProfile = async (accessToken) => {
    const response = await globalThis.fetch(GOOGLE_USERINFO_URL, {
        headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`google-userinfo-failed: ${response.status} ${text.slice(0, 200)}`);
    }
    return response.json();
};

const buildOAuthRedirect = (params) => {
    const url = new URL(`${APP_BASE_URL}/auth/google`);
    for (const [k, v] of Object.entries(params)) {
        if (v != null) url.searchParams.set(k, String(v));
    }
    return url.toString();
};

// ---------------------------------------------------------------------------
// Verification tokens — short-lived single-use tokens for email-verify and
// password-reset flows. Mongo TTL purges them automatically.
// ---------------------------------------------------------------------------
const APP_BASE_URL = (process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;     // 1h

const issueVerificationToken = async ({ kind, principalKind, principalId, ttlMs, req }) => {
    // Invalidate any outstanding token of the same kind for this principal so
    // the latest link is always the only one that works.
    await VerificationToken.deleteMany({ kind, principalKind, principalId }).catch(() => {});
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlMs);
    await VerificationToken.create({
        token,
        kind,
        principalKind,
        principalId,
        expiresAt,
        ip: req?.ip,
        userAgent: req?.headers?.['user-agent'],
    });
    return { token, expiresAt };
};

const consumeVerificationToken = async (token, kind) => {
    if (!token) return null;
    const doc = await VerificationToken.findOne({ token, kind });
    if (!doc) return null;
    if (doc.expiresAt.getTime() <= Date.now()) {
        await VerificationToken.deleteOne({ _id: doc._id }).catch(() => {});
        return null;
    }
    // Single-use: delete on success so the same link cannot replay.
    await VerificationToken.deleteOne({ _id: doc._id }).catch(() => {});
    return doc;
};

const sendVerificationEmail = async (scholar, token) => {
    const link = `${APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    return sendEmail({
        to: scholar.email,
        subject: 'Verify your ScholarshipZone email',
        text:
            `Hi ${scholar.name || 'there'},\n\n` +
            `Welcome to ScholarshipZone! Please confirm your email address by opening the link below within 24 hours:\n\n` +
            `${link}\n\n` +
            `If you did not create this account you can safely ignore this message.\n`,
    });
};

const sendPasswordResetEmail = async (scholar, token) => {
    const link = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    return sendEmail({
        to: scholar.email,
        subject: 'Reset your ScholarshipZone password',
        text:
            `Hi ${scholar.name || 'there'},\n\n` +
            `Someone requested a password reset for your ScholarshipZone account. ` +
            `Open the link below within 1 hour to choose a new password:\n\n` +
            `${link}\n\n` +
            `If this was not you, ignore this email — your current password will remain unchanged.\n`,
    });
};

// ---------------------------------------------------------------------------
// Public DTO helpers — keep response shape identical to the legacy JSON server
// so the React frontend works without changes. We use `legacyId` if present,
// otherwise fall back to the Mongo ObjectId string.
// ---------------------------------------------------------------------------
const pickId = (doc) => (doc.legacyId != null ? doc.legacyId : String(doc._id));

const toPublicAdmin = (admin) => ({
    id: pickId(admin),
    name: admin.name,
    email: admin.email,
    department: admin.department,
    role: admin.role,
});

const toEditableAdmin = (admin) => ({
    ...toPublicAdmin(admin),
    departmentCode: admin.departmentCode,
    twoFactorCode: admin.twoFactorCode,
});

const toPublicScholar = (scholar) => ({
    id: pickId(scholar),
    name: scholar.name,
    email: scholar.email,
    role: scholar.role,
    emailVerified: Boolean(scholar.emailVerified),
});

const toEditableScholar = (scholar) => ({
    ...toPublicScholar(scholar),
    applicationId: scholar.application
        ? (scholar.applicationLegacyId != null ? scholar.applicationLegacyId : String(scholar.application))
        : null,
});

const toProfileApplication = (application) => {
    if (!application) return null;
    return {
        id: pickId(application),
        name: application.name,
        nationality: application.nationality || '',
        status: application.status || '',
        education: application.education || 'Not supplied',
        contact: application.contact || '',
        age: application.age ?? null,
        gender: application.gender || '',
        dateOfBirth: application.dateOfBirth || '',
        address: application.address || '',
        bio: application.bio || '',
        photo: application.photo || '',
    };
};

const buildDashboardSummary = (admin, applicants) => {
    const totalApplicants = applicants.length;
    const graduateApplicants = applicants.filter(
        (a) =>
            String(a.status || '').toLowerCase().includes('graduate') ||
            String(a.education || '').toLowerCase().includes('master')
    ).length;
    const averageAge = totalApplicants
        ? Math.round(applicants.reduce((s, a) => s + Number(a.age || 0), 0) / totalApplicants)
        : 0;
    return {
        totalApplicants,
        graduateApplicants,
        averageAge,
        department: admin.department,
        reviewQueue: Math.max(totalApplicants - graduateApplicants, 0),
    };
};

const buildDashboardPayload = (admin, applicants) => ({
    admin: toPublicAdmin(admin),
    summary: buildDashboardSummary(admin, applicants),
    recentApplicants: [...applicants]
        .reverse()
        .slice(0, 6)
        .map((a) => ({
            id: pickId(a),
            name: a.name,
            nationality: a.nationality,
            status: a.status,
            education: a.education || 'Not supplied',
            age: a.age,
            contact: a.contact,
        })),
});

const buildScholarProfilePayload = (scholar, application) => ({
    scholar: toPublicScholar(scholar),
    application: toProfileApplication(application),
});

const PROFILE_FIELDS = [
    'name',
    'nationality',
    'status',
    'education',
    'contact',
    'age',
    'gender',
    'dateOfBirth',
    'address',
    'bio',
    'photo',
];

// ---------------------------------------------------------------------------
// Lookup helpers — accept both legacyId (numeric) and ObjectId strings so
// existing frontend URLs continue to work.
// ---------------------------------------------------------------------------
const findByEitherId = async (Model, idParam) => {
    const asNumber = Number(idParam);
    if (Number.isFinite(asNumber)) {
        const byLegacy = await Model.findOne({ legacyId: asNumber });
        if (byLegacy) return byLegacy;
    }
    if (/^[a-f\d]{24}$/i.test(String(idParam))) {
        return Model.findById(idParam);
    }
    return null;
};

// ---------------------------------------------------------------------------
// Auth middlewares
// ---------------------------------------------------------------------------
const requireAdminSession = async (req, res, next) => {
    try {
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Admin session is required.' });
        }
        const session = await findActiveSession(token, 'admin');
        if (!session) {
            return res.status(401).json({ message: 'Admin session is invalid or expired.' });
        }
        const admin = await Admin.findById(session.principalId);
        if (!admin) {
            await revokeSession(token);
            return res.status(401).json({ message: 'Admin account was not found.' });
        }
        req.admin = admin;
        req.sessionToken = token;
        touchLastActive(session);
        return next();
    } catch (err) {
        return next(err);
    }
};

const requireScholarSession = async (req, res, next) => {
    try {
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Scholar session is required.' });
        }
        const session = await findActiveSession(token, 'scholar');
        if (!session) {
            return res.status(401).json({ message: 'Scholar session is invalid or expired.' });
        }
        const scholar = await Scholar.findById(session.principalId);
        if (!scholar) {
            await revokeSession(token);
            return res.status(401).json({ message: 'Scholar account was not found.' });
        }
        req.scholar = scholar;
        req.sessionToken = token;
        touchLastActive(session);
        return next();
    } catch (err) {
        return next(err);
    }
};

// -----------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
// Sanity placeholder for `/` — only used when no SPA bundle is mounted
// (i.e. local dev where Vite serves the frontend on a separate port).
// When SERVE_SPA is enabled in production, the static SPA handler below
// the API routes returns dist/index.html instead.
const SPA_DIR = path.resolve(__dirname, '..', 'dist');
const SERVE_SPA = (process.env.SERVE_SPA === '1' || IS_PROD)
    && fs.existsSync(path.join(SPA_DIR, 'index.html'));
if (!SERVE_SPA) {
    app.get('/', (req, res) => res.send('ScholarshipZone API is running!'));
}

// ----- Sliding-session refresh + logout (T3.3) ----------------------------
//
// POST /api/auth/refresh
//   Reads the httpOnly `sz_rt` cookie. Validates it against the stored hash
//   (per-session), rotates the access AND refresh tokens, and returns the
//   new `{token, expiresAt, kind}` plus a fresh cookie. If the presented
//   token matches a *previously rotated* hash, treat it as token reuse:
//   revoke the entire session and audit the event.
app.post('/api/auth/refresh', async (req, res, next) => {
    try {
        const presented = req.cookies?.[REFRESH_COOKIE_NAME];
        if (!presented) {
            return res.status(401).json({ message: 'Refresh token is required.' });
        }
        const incomingHash = hashRefreshToken(presented);

        const session = await Session.findOne({ refreshTokenHash: incomingHash });
        if (!session) {
            // Reuse detection: did we just rotate this very token away?
            const replayed = await Session.findOne({ previousRefreshHash: incomingHash });
            if (replayed) {
                const principalKind = replayed.kind === 'admin' ? 'admin' : 'scholar';
                await Session.deleteOne({ _id: replayed._id }).catch(() => {});
                audit(req, {
                    action: `${principalKind}.session.reuse_detected`,
                    outcome: 'failure',
                    actor: { kind: principalKind, id: replayed.principalId },
                    metadata: { sessionId: String(replayed._id) },
                });
            }
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Refresh token is invalid.' });
        }

        if (!session.refreshExpiresAt || session.refreshExpiresAt.getTime() <= Date.now()) {
            await Session.deleteOne({ _id: session._id }).catch(() => {});
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Refresh token has expired. Please sign in again.' });
        }

        if (session.kind !== 'admin' && session.kind !== 'scholar') {
            // Should never happen — admin-challenge sessions don't have a
            // refresh token — but be defensive.
            clearRefreshCookie(res);
            return res.status(401).json({ message: 'Refresh token is invalid for this session.' });
        }

        // Rotate.
        const now = Date.now();
        const newAccessToken = crypto.randomUUID();
        const newRefreshToken = crypto.randomUUID() + crypto.randomBytes(16).toString('hex');
        const newAccessExpiresAt = new Date(now + ACCESS_TTL_MS);
        const newRefreshExpiresAt = new Date(now + REFRESH_TTL_MS);

        await Session.updateOne(
            { _id: session._id },
            {
                $set: {
                    token: newAccessToken,
                    accessExpiresAt: newAccessExpiresAt,
                    refreshTokenHash: hashRefreshToken(newRefreshToken),
                    refreshExpiresAt: newRefreshExpiresAt,
                    previousRefreshHash: session.refreshTokenHash,
                    expiresAt: newRefreshExpiresAt,
                    lastActiveAt: new Date(now),
                    ip: req.ip,
                    userAgent: req.headers?.['user-agent'],
                },
                $inc: { rotationCount: 1 },
            },
        );

        setRefreshCookie(res, newRefreshToken);
        return res.json({
            sessionToken: newAccessToken,
            expiresAt: newAccessExpiresAt.toISOString(),
            kind: session.kind,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/logout
//   Revokes the current session (matched by EITHER the Authorization bearer
//   OR the refresh cookie — whichever is present) and clears the cookie.
//   Always responds 200 so the client can call it without first checking
//   whether it actually has a live session.
app.post('/api/auth/logout', async (req, res, next) => {
    try {
        const [scheme, bearer] = (req.headers.authorization || '').split(' ');
        if (scheme === 'Bearer' && bearer) {
            await Session.deleteOne({ token: bearer }).catch(() => {});
        }
        const presented = req.cookies?.[REFRESH_COOKIE_NAME];
        if (presented) {
            await Session.deleteOne({ refreshTokenHash: hashRefreshToken(presented) }).catch(() => {});
        }
        clearRefreshCookie(res);
        return res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

// ----- TOTP 2FA + device/session management (T3.4) ------------------------
//
// All routes here work for both scholars and admins. The principal is
// determined from the bearer token: requireAuthenticatedSession resolves the
// underlying account and attaches `req.principal = {kind, account, session}`.

const requireAuthenticatedSession = async (req, res, next) => {
    try {
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Authentication is required.' });
        }
        const session = await Session.findOne({
            token,
            kind: { $in: ['scholar', 'admin'] },
        });
        if (!session) {
            return res.status(401).json({ message: 'Session is invalid or expired.' });
        }
        const accessExpiry = session.accessExpiresAt || session.expiresAt;
        if (accessExpiry.getTime() <= Date.now()) {
            return res.status(401).json({ message: 'Session is expired.' });
        }
        const Model = session.kind === 'admin' ? Admin : Scholar;
        const account = await Model.findById(session.principalId);
        if (!account) {
            await revokeSession(token);
            return res.status(401).json({ message: 'Account was not found.' });
        }
        req.principal = { kind: session.kind, account, session };
        req.sessionToken = token;
        touchLastActive(session);
        return next();
    } catch (err) {
        return next(err);
    }
};

// POST /api/auth/2fa/setup
//   Generates a fresh secret + QR for the signed-in principal. The secret is
//   stored encrypted but `totpEnabled` stays false until /enable confirms a
//   working code. Calling /setup again before enabling overwrites the
//   pending secret (intentional — lets a user start over on a new device).
app.post('/api/auth/2fa/setup', authLimiter, requireAuthenticatedSession, async (req, res, next) => {
    try {
        const { account, kind } = req.principal;
        if (account.totpEnabled) {
            return res.status(409).json({ message: 'Two-factor authentication is already enabled.' });
        }
        const secret = otplib.generateSecret();
        account.totpSecret = encryptSecret(secret);
        await account.save();
        const otpauthUrl = buildOtpAuthUrl(account, secret);
        const qrDataUrl = await buildOtpQrDataUrl(otpauthUrl);
        audit(req, {
            action: `${kind}.2fa.setup`,
            actor: { kind, id: account._id, email: account.email },
        });
        return res.json({
            secret,            // shown once as a fallback if the QR scan fails
            otpauthUrl,
            qrDataUrl,
            issuer: TOTP_ISSUER,
            label: account.email,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/2fa/enable
//   Confirms the user can produce a valid code, flips totpEnabled to true,
//   generates one-time backup codes, and returns them (shown ONCE).
app.post('/api/auth/2fa/enable', authLimiter, requireAuthenticatedSession, validate(TwoFactorEnableSchema), async (req, res, next) => {
    try {
        const { account, kind } = req.principal;
        const { totpCode } = req.body;
        if (account.totpEnabled) {
            return res.status(409).json({ message: 'Two-factor authentication is already enabled.' });
        }
        const secret = decryptSecret(account.totpSecret);
        if (!secret) {
            return res.status(400).json({ message: 'Run /api/auth/2fa/setup first to generate a secret.' });
        }
        if (!verifyTotpCode(secret, totpCode)) {
            audit(req, {
                action: `${kind}.2fa.enable`,
                outcome: 'failure',
                actor: { kind, id: account._id, email: account.email },
                metadata: { reason: 'bad-totp' },
            });
            return res.status(401).json({ message: 'Invalid authenticator code. Try again.' });
        }
        const { plain, hashed } = generateBackupCodes();
        account.totpEnabled = true;
        account.totpBackupCodes = hashed;
        await account.save();
        audit(req, {
            action: `${kind}.2fa.enable`,
            actor: { kind, id: account._id, email: account.email },
        });
        return res.json({
            message: 'Two-factor authentication enabled. Store these backup codes — they will not be shown again.',
            backupCodes: plain,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/2fa/disable
//   Requires the account password AND a current TOTP/backup code. Wipes the
//   secret and backup codes.
app.post('/api/auth/2fa/disable', authLimiter, requireAuthenticatedSession, validate(TwoFactorDisableSchema), async (req, res, next) => {
    try {
        const { account, kind } = req.principal;
        const { password, totpCode, backupCode } = req.body;
        if (!verifyPassword(password, account)) {
            audit(req, {
                action: `${kind}.2fa.disable`,
                outcome: 'failure',
                actor: { kind, id: account._id, email: account.email },
                metadata: { reason: 'bad-password' },
            });
            return res.status(401).json({ message: 'Password is incorrect.' });
        }
        if (account.totpEnabled) {
            let ok = false;
            if (totpCode) {
                const secret = decryptSecret(account.totpSecret);
                ok = verifyTotpCode(secret, totpCode);
            } else if (backupCode) {
                ok = consumeBackupCode(account, backupCode);
            }
            if (!ok) {
                audit(req, {
                    action: `${kind}.2fa.disable`,
                    outcome: 'failure',
                    actor: { kind, id: account._id, email: account.email },
                    metadata: { reason: totpCode || backupCode ? 'bad-totp' : 'totp-required' },
                });
                return res.status(401).json({
                    message: totpCode || backupCode
                        ? 'Invalid authenticator or backup code.'
                        : 'A current authenticator or backup code is required to disable 2FA.',
                });
            }
        }
        account.totpEnabled = false;
        account.totpSecret = { ciphertext: '', iv: '', authTag: '' };
        account.totpBackupCodes = [];
        await account.save();
        audit(req, {
            action: `${kind}.2fa.disable`,
            actor: { kind, id: account._id, email: account.email },
        });
        return res.json({ message: 'Two-factor authentication disabled.' });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/2fa/status
//   Light-weight: lets the settings UI know whether the meter is on.
app.get('/api/auth/2fa/status', requireAuthenticatedSession, async (req, res, next) => {
    try {
        const { account } = req.principal;
        const backupCodes = account.totpBackupCodes || [];
        return res.json({
            enabled: Boolean(account.totpEnabled),
            backupCodesTotal: backupCodes.length,
            backupCodesRemaining: backupCodes.filter((c) => !c.usedAt).length,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/2fa/backup-codes/regenerate
//   Re-issues a fresh set of backup codes. Requires a current TOTP because
//   anyone with the access token (e.g. a session left open on a friend's
//   laptop) should NOT be able to invalidate the user's real backup codes
//   without proving they still have the authenticator.
app.post('/api/auth/2fa/backup-codes/regenerate', authLimiter, requireAuthenticatedSession, validate(TwoFactorEnableSchema), async (req, res, next) => {
    try {
        const { account, kind } = req.principal;
        const { totpCode } = req.body;
        if (!account.totpEnabled) {
            return res.status(409).json({ message: 'Enable two-factor authentication first.' });
        }
        const secret = decryptSecret(account.totpSecret);
        if (!verifyTotpCode(secret, totpCode)) {
            return res.status(401).json({ message: 'Invalid authenticator code.' });
        }
        const { plain, hashed } = generateBackupCodes();
        account.totpBackupCodes = hashed;
        await account.save();
        audit(req, {
            action: `${kind}.2fa.backup-codes.regenerate`,
            actor: { kind, id: account._id, email: account.email },
        });
        return res.json({
            message: 'New backup codes issued. The previous set is no longer valid.',
            backupCodes: plain,
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/auth/2fa/challenge
//   Completes a scholar sign-in that was paused for a TOTP challenge.
//   (Admins use POST /api/auth/admin/verify which handles the TOTP gate
//   inline.)
app.post('/api/auth/2fa/challenge', authLimiter, validate(TwoFactorChallengeSchema), async (req, res, next) => {
    try {
        const { challengeId, totpCode, backupCode } = req.body;
        const challenge = await findActiveSession(challengeId, 'scholar-challenge');
        if (!challenge) {
            return res.status(410).json({ message: 'Verification challenge expired. Sign in again.' });
        }
        const scholar = await Scholar.findById(challenge.principalId);
        if (!scholar) {
            await revokeSession(challengeId);
            return res.status(404).json({ message: 'Scholar account was not found.' });
        }
        if (!scholar.totpEnabled) {
            // Defensive — should not happen if the challenge was issued from
            // the sign-in branch that checked totpEnabled.
            await revokeSession(challengeId);
            return res.status(409).json({ message: 'Two-factor authentication is not enabled for this account.' });
        }
        let ok = false;
        if (totpCode) {
            const secret = decryptSecret(scholar.totpSecret);
            ok = verifyTotpCode(secret, totpCode);
        } else if (backupCode) {
            ok = consumeBackupCode(scholar, backupCode);
            if (ok) await scholar.save();
        }
        if (!ok) {
            audit(req, {
                action: 'scholar.2fa.challenge',
                outcome: 'failure',
                actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
                metadata: { reason: 'bad-code' },
            });
            return res.status(401).json({ message: 'Invalid authenticator or backup code.' });
        }
        await revokeSession(challengeId);
        const { token: sessionToken } = await issueSession({
            kind: 'scholar',
            principalId: scholar._id,
            req,
            res,
        });
        audit(req, {
            action: 'scholar.sign-in',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            metadata: { totp: backupCode ? 'backup-code' : 'totp' },
        });
        return res.json({
            message: 'Two-factor verification complete.',
            sessionToken,
            scholar: toPublicScholar(scholar),
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/sessions
//   Lists all active sessions for the signed-in principal. The current
//   session is flagged with `current: true` so the UI can disable revoke
//   on it (sign-out is the appropriate action there).
app.get('/api/auth/sessions', requireAuthenticatedSession, async (req, res, next) => {
    try {
        const { account, kind, session: current } = req.principal;
        const now = Date.now();
        const sessions = await Session.find({
            kind,
            principalId: account._id,
            // Skip rows whose access AND refresh windows have both passed.
            // The TTL index sweeps them eventually but a slightly-stale UI
            // is worse than a single extra query filter.
            $or: [
                { refreshExpiresAt: { $gt: new Date(now) } },
                { accessExpiresAt: { $gt: new Date(now) } },
                { expiresAt: { $gt: new Date(now) } },
            ],
        }).sort({ lastActiveAt: -1, createdAt: -1 });

        return res.json({
            sessions: sessions.map((s) => ({
                id: String(s._id),
                ip: s.ip || '',
                userAgent: s.userAgent || '',
                createdAt: s.createdAt,
                lastActiveAt: s.lastActiveAt || s.createdAt,
                accessExpiresAt: s.accessExpiresAt || s.expiresAt,
                refreshExpiresAt: s.refreshExpiresAt || null,
                rotationCount: s.rotationCount || 0,
                current: String(s._id) === String(current._id),
            })),
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/auth/sessions/:id
//   Revoke a single session (any of the principal's, including the current
//   one). DELETE /api/auth/sessions revokes ALL sessions OTHER than the
//   current one (handy "sign out other devices" button).
app.delete('/api/auth/sessions/:id', requireAuthenticatedSession, async (req, res, next) => {
    try {
        const { account, kind, session: current } = req.principal;
        const { id } = req.params;
        // Validate ObjectId so we don't 500 on bad input.
        if (!/^[0-9a-fA-F]{24}$/.test(String(id))) {
            return res.status(400).json({ message: 'Invalid session id.' });
        }
        const target = await Session.findOne({ _id: id, kind, principalId: account._id });
        if (!target) {
            return res.status(404).json({ message: 'Session was not found.' });
        }
        await Session.deleteOne({ _id: target._id });
        const revokedCurrent = String(target._id) === String(current._id);
        if (revokedCurrent) {
            clearRefreshCookie(res);
        }
        audit(req, {
            action: `${kind}.session.revoke`,
            actor: { kind, id: account._id, email: account.email },
            metadata: { sessionId: String(target._id), current: revokedCurrent },
        });
        return res.json({ message: 'Session revoked.', revokedCurrent });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/auth/sessions', requireAuthenticatedSession, async (req, res, next) => {
    try {
        const { account, kind, session: current } = req.principal;
        const result = await Session.deleteMany({
            kind,
            principalId: account._id,
            _id: { $ne: current._id },
        });
        audit(req, {
            action: `${kind}.session.revoke-others`,
            actor: { kind, id: account._id, email: account.email },
            metadata: { deletedCount: result.deletedCount || 0 },
        });
        return res.json({
            message: 'Other sessions revoked.',
            deletedCount: result.deletedCount || 0,
        });
    } catch (err) {
        next(err);
    }
});

// ----- Health probes (used by load balancers / orchestrators) ------------
//
// T4.3 — `/healthz` is LIVENESS only: returns 200 as long as the process is
// up and the event loop responds. NEVER touches the DB; never returns 503.
// `/readyz` is READINESS: probes MongoDB via `db.admin().ping()` AND the
// active storage backend. Returns 503 if any dependency is unhealthy so
// load balancers stop sending traffic.
//
// Aliases `/api/health` + `/api/ready` are mounted for orchestrators that
// require API-prefixed paths.
const livenessHandler = (_req, res) => res.json({
    status: 'ok',
    uptime: process.uptime(),
    pid: process.pid,
    shuttingDown: Boolean(shuttingDown),
});

const readinessHandler = async (_req, res) => {
    const checks = { db: 'unknown', storage: 'unknown' };
    let allOk = true;
    const mongoose = require('mongoose');

    // 1) MongoDB — readyState first (cheap), then a real ping if connected.
    try {
        const ready = mongoose.connection.readyState === 1;
        if (!ready) {
            checks.db = 'disconnected';
            allOk = false;
        } else if (typeof mongoose.connection.db?.admin === 'function') {
            await mongoose.connection.db.admin().ping();
            checks.db = 'connected';
        } else {
            checks.db = 'connected';
        }
    } catch (err) {
        checks.db = `error: ${(err && err.message) || 'unknown'}`;
        allOk = false;
    }

    // 2) Storage backend — probe the active backend (local always healthy;
    //    S3 returns false from isConfigured() if its env vars are missing).
    try {
        const backend = preferredBackend();
        const ok = typeof backend.isConfigured === 'function' ? backend.isConfigured() : true;
        checks.storage = ok ? (backend.name || 'ok') : 'misconfigured';
        if (!ok) allOk = false;
    } catch (err) {
        checks.storage = `error: ${(err && err.message) || 'unknown'}`;
        allOk = false;
    }

    // 3) During graceful shutdown we proactively fail readiness so the LB
    //    drains us before the close window expires.
    if (shuttingDown) {
        allOk = false;
        checks.shuttingDown = true;
    }

    return res.status(allOk ? 200 : 503).json({
        status: allOk ? 'ready' : 'not-ready',
        checks,
        inflight: inflightRequests,
        uptime: process.uptime(),
    });
};

app.get('/healthz', livenessHandler);
app.get('/api/health', livenessHandler);
app.get('/readyz', readinessHandler);
app.get('/api/ready', readinessHandler);

// T4.1 — Anonymous Core Web Vitals ingestion. Browsers POST one tiny JSON
// document per metric (CLS / LCP / INP / TTFB / FCP) using sendBeacon.
// Guarantees:
//   • Always returns 2xx on validation success even if the DB write fails
//     (telemetry must never break the SPA — this is a fire-and-forget pipe).
//   • Rate-limited per IP via metricsLimiter (noop in NODE_ENV=test).
//   • Skips DB writes when NODE_ENV=test so existing tests don't need a
//     Metric collection unless they opt in.
//   • UA + IP are truncated; path is stripped of query string + fragment.
app.post('/api/_metrics/web-vitals', metricsLimiter, validate(WebVitalsSchema), async (req, res) => {
    const payload = req.body;
    const sanitisedPath = typeof payload.path === 'string'
        ? payload.path.split('?')[0].split('#')[0].slice(0, 256)
        : null;
    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 256) || null;
    const ip = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim() || null);
    const ipTruncated = ip ? ip.slice(0, 64) : null;

    if (!IS_TEST) {
        // Fire-and-forget — never await, never surface DB errors to the client.
        Metric.create({
            name: payload.name,
            value: payload.value,
            rating: payload.rating || 'unknown',
            navigationType: payload.navigationType || null,
            path: sanitisedPath,
            userAgent,
            ip: ipTruncated,
        }).catch((err) => {
            // Log at debug level only — we don't want noisy alerts from telemetry.
            logger.debug({ err: err.message, metric: payload.name }, 'web-vitals write failed');
        });
    }

    return res.status(202).json({ ok: true });
});

// ----- Public (no auth) endpoints for the marketing landing page ---------
app.get('/api/public/stats', async (req, res, next) => {
    try {
        const [activeScholarships, studentsPlaced, totalApplicants] = await Promise.all([
            Scholarship.countDocuments({ active: true }),
            Application.countDocuments({ reviewStatus: 'approved' }),
            Application.countDocuments({}),
        ]);
        res.json({
            activeScholarships,
            studentsPlaced,
            totalApplicants,
            updatedAt: new Date().toISOString(),
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/public/scholarships', async (req, res, next) => {
    try {
        const {
            country,
            grade,
            field,
            q,
            limit,
            offset,
            minAmount,
            maxAmount,
            deadlineBefore,
            deadlineAfter,
            openOnly,
            sort,
        } = req.query;

        const filter = { active: true };
        if (country) filter.countries = { $in: [country] };
        if (grade) filter.grades = { $in: [grade] };
        if (field) filter.fields = { $in: [field] };
        if (q) {
            const rx = new RegExp(String(q).trim(), 'i');
            filter.$or = [{ title: rx }, { description: rx }, { provider: rx }];
        }

        // Amount range filters (skip invalid numbers silently).
        const min = Number(minAmount);
        const max = Number(maxAmount);
        if (Number.isFinite(min) && min > 0) filter.amount = { ...(filter.amount || {}), $gte: min };
        if (Number.isFinite(max) && max > 0) filter.amount = { ...(filter.amount || {}), $lte: max };

        // Deadline window filters.
        const before = deadlineBefore ? new Date(deadlineBefore) : null;
        const after = deadlineAfter ? new Date(deadlineAfter) : null;
        if (before instanceof Date && !Number.isNaN(before.getTime())) {
            filter.deadline = { ...(filter.deadline || {}), $lte: before };
        }
        if (after instanceof Date && !Number.isNaN(after.getTime())) {
            filter.deadline = { ...(filter.deadline || {}), $gte: after };
        }
        // openOnly = exclude scholarships whose deadline has already passed.
        if (String(openOnly) === 'true' || openOnly === true) {
            const now = new Date();
            // Either no deadline set (rolling) OR deadline in the future.
            filter.$and = [
                ...(filter.$and || []),
                { $or: [{ deadline: null }, { deadline: { $gte: now } }] },
            ];
        }

        // Sort mapping. Default = soonest deadline first (with rolling/no-deadline
        // at the end via secondary createdAt sort).
        const sortMap = {
            'deadline-asc': { deadline: 1, createdAt: -1 },
            'deadline-desc': { deadline: -1, createdAt: -1 },
            'amount-desc': { amount: -1, deadline: 1 },
            'amount-asc': { amount: 1, deadline: 1 },
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            'title-asc': { title: 1 },
            'title-desc': { title: -1 },
        };
        const sortSpec = sortMap[sort] || sortMap['deadline-asc'];

        const cap = Math.min(Number(limit) || 12, 50);
        const skip = Math.max(Number(offset) || 0, 0);

        const [items, total] = await Promise.all([
            Scholarship.find(filter).sort(sortSpec).skip(skip).limit(cap),
            Scholarship.countDocuments(filter),
        ]);
        res.json({ count: items.length, total, offset: skip, limit: cap, items });
    } catch (err) {
        next(err);
    }
});

app.get('/api/public/scholarships/:id', async (req, res, next) => {
    try {
        if (!req.params.id || !req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid scholarship id.' });
        }
        const scholarship = await Scholarship.findOne({ _id: req.params.id, active: true });
        if (!scholarship) return res.status(404).json({ message: 'Scholarship not found.' });
        res.json({ scholarship });
    } catch (err) {
        next(err);
    }
});

app.get('/api/public/filters', async (req, res, next) => {
    try {
        const [countries, grades, fields] = await Promise.all([
            Scholarship.distinct('countries', { active: true }),
            Scholarship.distinct('grades', { active: true }),
            Scholarship.distinct('fields', { active: true }),
        ]);
        res.json({
            countries: countries.filter(Boolean).sort(),
            grades: grades.filter(Boolean).sort(),
            fields: fields.filter(Boolean).sort(),
        });
    } catch (err) {
        next(err);
    }
});

// Contact form — persists messages to MongoDB for admin review.
const CONTACT_MAX_LEN = 4000;

app.post('/api/public/contact', contactLimiter, validate(ContactMessageSchema), async (req, res, next) => {
    const { name, email, topic, message } = req.body;

    try {
        const doc = await ContactMessage.create({
            name,
            email,
            topic,
            message,
            ipAddress: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
            userAgent: (req.headers['user-agent'] || '').toString().slice(0, 500),
        });
        (req.log || logger).info({ contactMessageId: doc._id.toString(), email }, 'contact message stored');

        // Fan-out in-app notification to every admin so they see a new message
        // without polling the inbox. Fire-and-forget — failures never block the response.
        notifyAdmins({
            kind: 'admin.message.new',
            title: `New message from ${name}`,
            body: topic && topic !== 'general' ? `[${topic}] ${message.slice(0, 140)}` : message.slice(0, 140),
            url: '/admin/messages',
            data: { contactMessageId: String(doc._id), email },
        });

        return res.status(201).json({ message: 'Message received. We will reply soon.' });
    } catch (err) {
        return next(err);
    }
});

// Admin inbox — list/update contact messages.
app.get('/api/auth/admin/messages', requireAdminSession, async (req, res, next) => {
    try {
        const { status, q } = req.query || {};
        const filter = {};
        if (status && ['new', 'read', 'replied', 'archived'].includes(String(status))) {
            filter.status = status;
        }
        if (q) {
            const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ name: rx }, { email: rx }, { message: rx }, { topic: rx }];
        }
        const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).lean();
        const unread = await ContactMessage.countDocuments({ status: 'new' });
        res.json({ messages, unread });
    } catch (err) {
        next(err);
    }
});

app.patch('/api/auth/admin/messages/:id', requireAdminSession, async (req, res, next) => {
    try {
        const updates = {};
        const { status, notes } = req.body || {};
        if (status && ['new', 'read', 'replied', 'archived'].includes(status)) {
            updates.status = status;
            if (status === 'read') updates.readAt = new Date();
            if (status === 'replied') updates.repliedAt = new Date();
        }
        if (typeof notes === 'string') updates.notes = notes;
        const doc = await ContactMessage.findByIdAndUpdate(req.params.id, updates, { new: true }).lean();
        if (!doc) return res.status(404).json({ message: 'Message not found.' });
        res.json(doc);
    } catch (err) {
        next(err);
    }
});

app.delete('/api/auth/admin/messages/:id', requireAdminSession, async (req, res, next) => {
    try {
        const doc = await ContactMessage.findByIdAndDelete(req.params.id).lean();
        if (!doc) return res.status(404).json({ message: 'Message not found.' });
        audit(req, {
            action: 'admin.message.delete',
            actor: { kind: 'admin', id: req.admin._id, email: req.admin.email },
            target: { kind: 'ContactMessage', id: doc._id, label: doc.email },
        });
        res.json({ message: 'Deleted.' });
    } catch (err) {
        next(err);
    }
});

// Admin reply — appends a reply, attempts email delivery, and marks the message replied.
app.post('/api/auth/admin/messages/:id/reply', requireAdminSession, async (req, res, next) => {
    try {
        const body = String(req.body?.body || '').trim();
        if (!body) return res.status(400).json({ message: 'Reply body is required.' });
        if (body.length > 8000) return res.status(413).json({ message: 'Reply is too long.' });

        const doc = await ContactMessage.findById(req.params.id);
        if (!doc) return res.status(404).json({ message: 'Message not found.' });

        const subjectBase = doc.topic && doc.topic !== 'general' ? `[${doc.topic}] Your message` : 'Your message';
        const subject = `Re: ${subjectBase}`;
        const fromName = req.admin.name || 'ScholarshipZone Admin';
        const greeting = doc.name ? `Hi ${doc.name},` : 'Hello,';
        const text = `${greeting}\n\n${body}\n\n— ${fromName}\nScholarshipZone Team\n\n--- Original message ---\n${doc.message}`;

        const delivery = await sendEmail({
            to: doc.email,
            subject,
            text,
            fromName,
            replyTo: req.admin.email,
        });

        doc.replies.push({
            body,
            sentByName: fromName,
            sentByEmail: req.admin.email || '',
            deliveredVia: delivery.mode,
            deliveryStatus: delivery.ok ? 'sent' : 'failed',
            deliveryError: delivery.error || '',
        });
        doc.status = 'replied';
        doc.repliedAt = new Date();
        await doc.save();

        // If the original sender has a scholar account, drop an in-app
        // notification so they see the reply on their dashboard.
        Scholar.findOne({ email: doc.email })
            .then((scholar) => {
                if (!scholar) return null;
                return notify(
                    { kind: 'scholar', id: scholar._id },
                    {
                        kind: 'message.reply',
                        title: `Reply from ${fromName}`,
                        body: body.slice(0, 200),
                        url: '/scholar',
                        data: { contactMessageId: String(doc._id) },
                    }
                );
            })
            .catch(() => {});

        return res.json({
            message: delivery.ok
                ? delivery.mode === 'log'
                    ? 'Reply saved. (No SMTP configured — email body logged to server console only.)'
                    : 'Reply sent.'
                : `Reply saved but email delivery failed: ${delivery.error}`,
            contactMessage: doc.toObject(),
            delivery,
        });
    } catch (err) {
        next(err);
    }
});

// ----- Admin auth ---------------------------------------------------------
app.post('/api/auth/admin/sign-in', authLimiter, validate(AdminSignInSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin || !verifyPassword(password, admin)) {
            audit(req, {
                action: 'admin.sign-in',
                outcome: 'failure',
                actor: { kind: 'anonymous', email },
                metadata: { reason: admin ? 'bad-password' : 'unknown-email' },
            });
            return res.status(401).json({ message: 'Invalid admin email or password.' });
        }
        const { token: challengeId, expiresAt } = await issueSession({
            kind: 'admin-challenge',
            principalId: admin._id,
            ttlMs: CHALLENGE_TTL_MS,
            req,
        });
        audit(req, {
            action: 'admin.sign-in.challenge-issued',
            actor: { kind: 'admin', id: admin._id, email: admin.email },
        });
        return res.json({
            challengeId,
            expiresAt: expiresAt.getTime(),
            admin: toPublicAdmin(admin),
            verificationHint: `Enter the department code or 2FA code for ${admin.department}.`,
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/admin/verify', authLimiter, validate(AdminVerifySchema), async (req, res, next) => {
    try {
        const { challengeId, verificationCode, totpCode, backupCode } = req.body;
        const challenge = await findActiveSession(challengeId, 'admin-challenge');
        if (!challenge) {
            return res.status(410).json({ message: 'Verification challenge expired. Sign in again.' });
        }
        const admin = await Admin.findById(challenge.principalId);
        if (!admin) {
            await revokeSession(challengeId);
            return res.status(404).json({ message: 'Admin account was not found.' });
        }
        const normalizedCode = String(verificationCode).trim();
        const validCode =
            normalizedCode === admin.departmentCode || normalizedCode === admin.twoFactorCode;
        if (!validCode) {
            audit(req, {
                action: 'admin.sign-in.verify',
                outcome: 'failure',
                actor: { kind: 'admin', id: admin._id, email: admin.email },
                metadata: { reason: 'bad-code' },
            });
            return res.status(401).json({ message: 'Invalid department or 2FA code.' });
        }
        // Second factor (TOTP) — required when the admin has opted in.
        if (admin.totpEnabled) {
            let totpOk = false;
            if (totpCode) {
                const secret = decryptSecret(admin.totpSecret);
                totpOk = verifyTotpCode(secret, totpCode);
            } else if (backupCode) {
                totpOk = consumeBackupCode(admin, backupCode);
                if (totpOk) await admin.save();
            }
            if (!totpOk) {
                audit(req, {
                    action: 'admin.sign-in.verify',
                    outcome: 'failure',
                    actor: { kind: 'admin', id: admin._id, email: admin.email },
                    metadata: { reason: totpCode || backupCode ? 'bad-totp' : 'totp-required' },
                });
                return res.status(401).json({
                    message: totpCode || backupCode
                        ? 'Invalid authenticator or backup code.'
                        : 'Two-factor authentication is required for this admin account.',
                    requires2fa: true,
                });
            }
        }
        await revokeSession(challengeId);
        const { token: sessionToken } = await issueSession({
            kind: 'admin',
            principalId: admin._id,
            req,
            res,
        });
        audit(req, {
            action: 'admin.sign-in',
            actor: { kind: 'admin', id: admin._id, email: admin.email },
            metadata: admin.totpEnabled ? { totp: backupCode ? 'backup-code' : 'totp' } : undefined,
        });
        return res.json({
            message: 'Admin verification complete.',
            sessionToken,
            admin: toPublicAdmin(admin),
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/auth/admin/dashboard', requireAdminSession, async (req, res, next) => {
    try {
        const applicants = await Application.find().sort({ createdAt: 1 });
        return res.json(buildDashboardPayload(req.admin, applicants));
    } catch (err) {
        next(err);
    }
});

app.get('/api/auth/admin/settings', requireAdminSession, async (req, res, next) => {
    try {
        const scholar = await Scholar.findOne().sort({ createdAt: 1 });
        return res.json({
            admin: toEditableAdmin(req.admin),
            scholar: scholar ? toEditableScholar(scholar) : null,
        });
    } catch (err) {
        next(err);
    }
});

app.put('/api/auth/admin/settings', requireAdminSession, async (req, res, next) => {
    try {
        const { admin: adminInput = {}, scholar: scholarInput = {} } = req.body || {};
        const hasAdminUpdate = Object.keys(adminInput).length > 0;
        const hasScholarUpdate = Object.keys(scholarInput).length > 0;

        if (!hasAdminUpdate && !hasScholarUpdate) {
            return res.status(400).json({ message: 'No credential updates were provided.' });
        }

        const admin = await Admin.findById(req.admin._id);
        if (!admin) return res.status(404).json({ message: 'Admin account was not found.' });

        let scholar = null;
        if (hasScholarUpdate) {
            scholar = await Scholar.findOne().sort({ createdAt: 1 });
            if (!scholar) return res.status(404).json({ message: 'Scholar account was not found.' });
        }

        if (hasAdminUpdate) {
            if (Object.prototype.hasOwnProperty.call(adminInput, 'name')) {
                const name = String(adminInput.name || '').trim();
                if (!name) return res.status(400).json({ message: 'Admin name is required.' });
                admin.name = name;
            }
            if (Object.prototype.hasOwnProperty.call(adminInput, 'email')) {
                const email = normalizeEmail(adminInput.email);
                if (!isValidEmail(email)) {
                    return res.status(400).json({ message: 'Enter a valid admin email address.' });
                }
                if (!email.endsWith('@schooladmin.com')) {
                    return res.status(400).json({ message: 'Admin email must use the @schooladmin.com domain.' });
                }
                admin.email = email;
            }
            if (Object.prototype.hasOwnProperty.call(adminInput, 'department')) {
                const department = String(adminInput.department || '').trim();
                if (!department) return res.status(400).json({ message: 'Admin department is required.' });
                admin.department = department;
            }
            if (Object.prototype.hasOwnProperty.call(adminInput, 'departmentCode')) {
                const code = String(adminInput.departmentCode || '').trim();
                if (!code) return res.status(400).json({ message: 'Department code is required.' });
                admin.departmentCode = code;
            }
            if (Object.prototype.hasOwnProperty.call(adminInput, 'twoFactorCode')) {
                const tfa = String(adminInput.twoFactorCode || '').trim();
                if (!tfa) return res.status(400).json({ message: '2FA code is required.' });
                admin.twoFactorCode = tfa;
            }
            if (Object.prototype.hasOwnProperty.call(adminInput, 'password')) {
                const password = String(adminInput.password || '').trim();
                if (password && !isValidPassword(password)) {
                    return res.status(400).json({ message: 'Admin password must be at least 8 characters.' });
                }
                if (password) Object.assign(admin, createPasswordRecord(password));
            }
        }

        if (hasScholarUpdate && scholar) {
            if (Object.prototype.hasOwnProperty.call(scholarInput, 'name')) {
                const name = String(scholarInput.name || '').trim();
                if (!name) return res.status(400).json({ message: 'Scholar name is required.' });
                scholar.name = name;
            }
            if (Object.prototype.hasOwnProperty.call(scholarInput, 'email')) {
                const email = normalizeEmail(scholarInput.email);
                if (!isValidEmail(email)) {
                    return res.status(400).json({ message: 'Enter a valid scholar email address.' });
                }
                scholar.email = email;
            }
            if (Object.prototype.hasOwnProperty.call(scholarInput, 'password')) {
                const password = String(scholarInput.password || '').trim();
                if (password && !isValidPassword(password)) {
                    return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
                }
                if (password) Object.assign(scholar, createPasswordRecord(password));
            }
        }

        if (scholar && admin.email === scholar.email) {
            return res.status(400).json({ message: 'Admin and scholar emails must be different.' });
        }

        await admin.save();
        if (scholar) await scholar.save();

        return res.json({
            message: 'Credentials updated successfully.',
            admin: toEditableAdmin(admin),
            scholar: scholar ? toEditableScholar(scholar) : null,
        });
    } catch (err) {
        next(err);
    }
});

// ----- Admin: scholars management ----------------------------------------
app.get('/api/auth/admin/scholars', requireAdminSession, async (req, res, next) => {
    try {
        const scholars = await Scholar.find().sort({ createdAt: 1 });
        return res.json({ scholars: scholars.map(toEditableScholar) });
    } catch (err) {
        next(err);
    }
});

app.put('/api/auth/admin/scholars/:id', requireAdminSession, async (req, res, next) => {
    try {
        const scholar = await findByEitherId(Scholar, req.params.id);
        if (!scholar) return res.status(404).json({ message: 'Scholar account was not found.' });

        const input = req.body || {};

        if (Object.prototype.hasOwnProperty.call(input, 'name')) {
            const name = String(input.name || '').trim();
            if (!name) return res.status(400).json({ message: 'Scholar name is required.' });
            scholar.name = name;
        }
        if (Object.prototype.hasOwnProperty.call(input, 'email')) {
            const email = normalizeEmail(input.email);
            if (!isValidEmail(email)) {
                return res.status(400).json({ message: 'Enter a valid scholar email address.' });
            }
            const dup = await Scholar.findOne({ email, _id: { $ne: scholar._id } });
            if (dup) return res.status(409).json({ message: 'Another scholar already uses this email.' });
            scholar.email = email;
        }
        if (Object.prototype.hasOwnProperty.call(input, 'password')) {
            const password = String(input.password || '').trim();
            if (password) {
                if (!isValidPassword(password)) {
                    return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
                }
                Object.assign(scholar, createPasswordRecord(password));
            }
        }

        await scholar.save();
        return res.json({ message: 'Scholar credentials updated.', scholar: toEditableScholar(scholar) });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/auth/admin/scholars/:id', requireAdminSession, async (req, res, next) => {
    try {
        const scholar = await findByEitherId(Scholar, req.params.id);
        if (!scholar) return res.status(404).json({ message: 'Scholar account was not found.' });
        const scholarId = pickId(scholar);
        await scholar.deleteOne();
        return res.json({ message: 'Scholar account removed.', scholarId });
    } catch (err) {
        next(err);
    }
});

// ----- Scholar (student) auth & profile ----------------------------------
app.post('/api/auth/student/sign-in', authLimiter, validate(ScholarSignInSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const scholar = await Scholar.findOne({ email });
        if (!scholar || !verifyPassword(password, scholar)) {
            audit(req, {
                action: 'scholar.sign-in',
                outcome: 'failure',
                actor: { kind: 'anonymous', email },
                metadata: { reason: scholar ? 'bad-password' : 'unknown-email' },
            });
            return res.status(401).json({ message: 'Invalid scholar email or password.' });
        }
        // Second factor (TOTP). If enabled, issue a short-lived challenge
        // session instead of a real session. The client must complete it
        // via POST /api/auth/2fa/challenge with a TOTP or backup code.
        if (scholar.totpEnabled) {
            const { token: challengeId, expiresAt } = await issueSession({
                kind: 'scholar-challenge',
                principalId: scholar._id,
                ttlMs: CHALLENGE_TTL_MS,
                req,
            });
            audit(req, {
                action: 'scholar.sign-in.challenge-issued',
                actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            });
            return res.json({
                message: 'Two-factor authentication required.',
                requires2fa: true,
                challengeId,
                expiresAt: expiresAt.getTime(),
                scholar: toPublicScholar(scholar),
            });
        }
        const { token: sessionToken } = await issueSession({
            kind: 'scholar',
            principalId: scholar._id,
            req,
            res,
        });
        audit(req, {
            action: 'scholar.sign-in',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
        });
        return res.json({
            message: 'Scholar sign-in complete.',
            sessionToken,
            scholar: toPublicScholar(scholar),
        });
    } catch (err) {
        next(err);
    }
});

// ----- Google OAuth (scholar sign-in / sign-up) ---------------------------
app.get('/api/auth/google/start', authLimiter, (req, res, next) => {
    try {
        const { clientId, redirectUri, stateSecret, configured } = googleOAuthConfig();
        if (!configured) {
            return res.status(503).json({
                message:
                    'Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI and OAUTH_STATE_SECRET.',
            });
        }
        const returnTo = sanitizeReturnTo(req.query.returnTo);
        const nonce = crypto.randomBytes(16).toString('hex');
        const state = signOAuthState({ nonce, ts: Date.now(), returnTo }, stateSecret);
        const authorizeUrl = new URL(GOOGLE_AUTH_URL);
        authorizeUrl.searchParams.set('client_id', clientId);
        authorizeUrl.searchParams.set('redirect_uri', redirectUri);
        authorizeUrl.searchParams.set('response_type', 'code');
        authorizeUrl.searchParams.set('scope', 'openid email profile');
        authorizeUrl.searchParams.set('state', state);
        authorizeUrl.searchParams.set('prompt', 'select_account');
        authorizeUrl.searchParams.set('access_type', 'online');
        authorizeUrl.searchParams.set('include_granted_scopes', 'true');
        return res.redirect(302, authorizeUrl.toString());
    } catch (err) {
        next(err);
    }
});

app.get('/api/auth/google/callback', authLimiter, async (req, res, next) => {
    try {
        const config = googleOAuthConfig();
        if (!config.configured) {
            return res.status(503).json({ message: 'Google sign-in is not configured.' });
        }

        const { code, state, error: providerError } = req.query;

        if (providerError) {
            audit(req, {
                action: 'scholar.oauth.google',
                outcome: 'failure',
                actor: { kind: 'anonymous' },
                metadata: { reason: 'provider-error', error: String(providerError).slice(0, 120) },
            });
            return res.redirect(302, buildOAuthRedirect({ error: 'google_denied' }));
        }

        const payload = verifyOAuthState(state, config.stateSecret);
        if (!payload) {
            audit(req, {
                action: 'scholar.oauth.google',
                outcome: 'failure',
                actor: { kind: 'anonymous' },
                metadata: { reason: 'invalid-state' },
            });
            return res.redirect(302, buildOAuthRedirect({ error: 'invalid_state' }));
        }
        const returnTo = sanitizeReturnTo(payload.returnTo);

        if (typeof code !== 'string' || !code) {
            return res.redirect(302, buildOAuthRedirect({ error: 'missing_code', returnTo }));
        }

        let tokens;
        try {
            tokens = await exchangeGoogleCode({
                code,
                clientId: config.clientId,
                clientSecret: config.clientSecret,
                redirectUri: config.redirectUri,
            });
        } catch (err) {
            (req.log || console).warn?.({ err: err.message }, '[oauth] google token exchange failed');
            return res.redirect(302, buildOAuthRedirect({ error: 'token_exchange_failed', returnTo }));
        }

        let profile;
        try {
            profile = await fetchGoogleProfile(tokens.access_token);
        } catch (err) {
            (req.log || console).warn?.({ err: err.message }, '[oauth] google userinfo failed');
            return res.redirect(302, buildOAuthRedirect({ error: 'userinfo_failed', returnTo }));
        }

        const googleId = String(profile.sub || '').trim();
        const email = normalizeEmail(profile.email || '');
        const emailVerifiedByGoogle = Boolean(profile.email_verified);
        const name = String(profile.name || profile.given_name || email.split('@')[0] || 'Scholar').trim();
        const avatarUrl = typeof profile.picture === 'string' ? profile.picture : '';

        if (!googleId || !email || !emailVerifiedByGoogle) {
            audit(req, {
                action: 'scholar.oauth.google',
                outcome: 'failure',
                actor: { kind: 'anonymous', email },
                metadata: { reason: 'unverified-or-missing-profile' },
            });
            return res.redirect(302, buildOAuthRedirect({ error: 'unverified_google_email', returnTo }));
        }

        // 1) Match by googleId (returning user).
        // 2) Else match by email (link existing password account to Google).
        // 3) Else create a new scholar.
        let scholar = await Scholar.findOne({ googleId });
        let createdNewAccount = false;
        if (!scholar) {
            scholar = await Scholar.findOne({ email });
        }

        if (scholar) {
            const updates = {};
            if (!scholar.googleId) updates.googleId = googleId;
            if (!scholar.emailVerified) {
                updates.emailVerified = true;
                updates.emailVerifiedAt = new Date();
            }
            if (avatarUrl && !scholar.avatarUrl) updates.avatarUrl = avatarUrl;
            if (Object.keys(updates).length > 0) {
                Object.assign(scholar, updates);
                await scholar.save();
            }
        } else {
            try {
                scholar = await Scholar.create({
                    name,
                    email,
                    role: 'student',
                    application: null,
                    googleId,
                    avatarUrl,
                    emailVerified: true,
                    emailVerifiedAt: new Date(),
                });
                createdNewAccount = true;
            } catch (err) {
                // Race: someone else just signed up with the same email/googleId.
                if (err && err.code === 11000) {
                    scholar = (await Scholar.findOne({ googleId })) || (await Scholar.findOne({ email }));
                    if (!scholar) {
                        return res.redirect(302, buildOAuthRedirect({ error: 'account_conflict', returnTo }));
                    }
                } else {
                    throw err;
                }
            }
        }

        const { token: sessionToken } = await issueSession({
            kind: 'scholar',
            principalId: scholar._id,
            req,
            res,
        });

        audit(req, {
            action: createdNewAccount ? 'scholar.oauth.google.signup' : 'scholar.oauth.google.signin',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            target: { kind: 'Scholar', id: scholar._id, label: scholar.email },
        });

        return res.redirect(
            302,
            buildOAuthRedirect({
                token: sessionToken,
                returnTo,
                created: createdNewAccount ? '1' : undefined,
            }),
        );
    } catch (err) {
        next(err);
    }
});


app.get('/api/auth/student/profile', requireScholarSession, async (req, res, next) => {
    try {
        const application = req.scholar.application
            ? await Application.findById(req.scholar.application)
            : null;
        return res.json(buildScholarProfilePayload(req.scholar, application));
    } catch (err) {
        next(err);
    }
});

app.put('/api/auth/student/profile', requireScholarSession, async (req, res, next) => {
    try {
        const input = req.body || {};
        const scholar = await Scholar.findById(req.scholar._id);
        if (!scholar) return res.status(404).json({ message: 'Scholar account was not found.' });

        let application = scholar.application ? await Application.findById(scholar.application) : null;
        if (!application) {
            application = await Application.create({ name: scholar.name, scholar: scholar._id });
            scholar.application = application._id;
        }

        for (const field of PROFILE_FIELDS) {
            if (Object.prototype.hasOwnProperty.call(input, field)) {
                const value = input[field];
                if (field === 'age') {
                    application.age =
                        value === '' || value === null || value === undefined ? null : Number(value);
                } else {
                    application[field] = value == null ? '' : String(value);
                }
            }
        }

        if (application.name && application.name !== scholar.name) {
            scholar.name = application.name;
        }

        await application.save();
        await scholar.save(); 

        return res.json(buildScholarProfilePayload(scholar, application));
    } catch (err) {
        next(err);
    }
});

// ----- Scholar: scholarship applications ----------------------------------
const APPLICATION_MOTIVATION_MAX = 2000;
const APPLICATION_FREETEXT_MAX = 500;

// Sanitize a free-text field to a trimmed, length-capped string.
const cleanText = (value, max = APPLICATION_FREETEXT_MAX) => {
    if (value === null || value === undefined) return '';
    return String(value).trim().slice(0, max);
};

const sanitizePersonalInfo = (raw = {}) => ({
    fullName: cleanText(raw.fullName, 200),
    phone: cleanText(raw.phone, 60),
    dateOfBirth: cleanText(raw.dateOfBirth, 40),
    nationality: cleanText(raw.nationality, 120),
    country: cleanText(raw.country, 120),
    address: cleanText(raw.address, 500),
});

const sanitizeAcademicInfo = (raw = {}) => ({
    currentLevel: cleanText(raw.currentLevel, 120),
    institution: cleanText(raw.institution, 200),
    fieldOfStudy: cleanText(raw.fieldOfStudy, 200),
    gradePoint: cleanText(raw.gradePoint, 60),
    expectedCompletion: cleanText(raw.expectedCompletion, 60),
});

const sanitizeDocumentRefs = (raw = []) => {
    if (!Array.isArray(raw)) return [];
    const seen = new Set();
    const out = [];
    for (const doc of raw.slice(0, 20)) {
        if (!doc || !doc.credentialId) continue;
        const id = String(doc.credentialId);
        if (!/^[0-9a-fA-F]{24}$/.test(id) || seen.has(id)) continue;
        seen.add(id);
        out.push({
            credentialId: id,
            title: cleanText(doc.title, 200),
            type: cleanText(doc.type, 60),
        });
    }
    return out;
};

// Ensure the wizard payload is internally consistent and safe.
const buildApplicationPayload = (body = {}) => {
    const motivation = cleanText(body.motivation, APPLICATION_MOTIVATION_MAX);
    return {
        motivation,
        personalInfo: sanitizePersonalInfo(body.personalInfo || {}),
        academicInfo: sanitizeAcademicInfo(body.academicInfo || {}),
        documents: sanitizeDocumentRefs(body.documents || []),
        lastStep: Math.max(0, Math.min(Number(body.lastStep) || 0, 10)),
    };
};

const serializeScholarshipApplication = (entry) => {
    const scholarship = entry.scholarship && typeof entry.scholarship === 'object' && entry.scholarship.title
        ? {
              id: String(entry.scholarship._id),
              title: entry.scholarship.title,
              provider: entry.scholarship.provider || '',
              amount: entry.scholarship.amount || 0,
              currency: entry.scholarship.currency || 'USD',
              deadline: entry.scholarship.deadline || null,
          }
        : null;
    return {
        id: String(entry._id),
        scholarshipId: scholarship ? scholarship.id : String(entry.scholarship),
        scholarship,
        motivation: entry.motivation || '',
        personalInfo: entry.personalInfo ? entry.personalInfo.toObject?.() || entry.personalInfo : {},
        academicInfo: entry.academicInfo ? entry.academicInfo.toObject?.() || entry.academicInfo : {},
        documents: Array.isArray(entry.documents)
            ? entry.documents.map((d) => ({
                  credentialId: d.credentialId ? String(d.credentialId) : null,
                  title: d.title || '',
                  type: d.type || '',
              }))
            : [],
        lastStep: typeof entry.lastStep === 'number' ? entry.lastStep : 0,
        status: entry.status,
        decisionNote: entry.decisionNote || '',
        decidedAt: entry.decidedAt,
        submittedAt: entry.submittedAt || (entry.status !== 'draft' ? entry.createdAt : null),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
};

app.get('/api/auth/student/applications', requireScholarSession, async (req, res, next) => {
    try {
        const entries = await ScholarshipApplication.find({ scholar: req.scholar._id })
            .populate('scholarship')
            .sort({ createdAt: -1 });
        res.json({ applications: entries.map(serializeScholarshipApplication) });
    } catch (err) {
        next(err);
    }
});

// Load the current draft (or submitted application) for a single scholarship.
// Used by the wizard to resume where the scholar left off.
app.get(
    '/api/auth/student/applications/draft/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!/^[0-9a-fA-F]{24}$/.test(scholarshipId)) {
                return res.status(400).json({ message: 'A valid scholarship id is required.' });
            }
            const entry = await ScholarshipApplication.findOne({
                scholar: req.scholar._id,
                scholarship: scholarshipId,
            }).populate('scholarship');
            if (!entry) {
                return res.json({ application: null });
            }
            res.json({ application: serializeScholarshipApplication(entry) });
        } catch (err) {
            next(err);
        }
    }
);

// Upsert a draft for a single scholarship. Idempotent — called repeatedly by
// the wizard's auto-save. Will not overwrite an already-submitted application:
// if `status !== 'draft'` the request is rejected with 409.
app.put(
    '/api/auth/student/applications/draft/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!/^[0-9a-fA-F]{24}$/.test(scholarshipId)) {
                return res.status(400).json({ message: 'A valid scholarship id is required.' });
            }

            const scholarship = await Scholarship.findOne({ _id: scholarshipId, active: true });
            if (!scholarship) {
                return res.status(404).json({ message: 'Scholarship not found or no longer active.' });
            }

            const existing = await ScholarshipApplication.findOne({
                scholar: req.scholar._id,
                scholarship: scholarship._id,
            });
            if (existing && existing.status !== 'draft') {
                return res.status(409).json({
                    message: 'This application has already been submitted and can no longer be edited.',
                    application: serializeScholarshipApplication(existing),
                });
            }

            const payload = buildApplicationPayload(req.body || {});
            const update = {
                ...payload,
                scholar: req.scholar._id,
                scholarship: scholarship._id,
                status: 'draft',
            };

            const saved = await ScholarshipApplication.findOneAndUpdate(
                { scholar: req.scholar._id, scholarship: scholarship._id },
                { $set: update },
                { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
            ).populate('scholarship');

            res.json({ application: serializeScholarshipApplication(saved) });
        } catch (err) {
            if (err && err.code === 11000) {
                // Race on the unique index — return the canonical record.
                const existing = await ScholarshipApplication.findOne({
                    scholar: req.scholar._id,
                    scholarship: req.params.scholarshipId,
                }).populate('scholarship');
                return res.json({ application: serializeScholarshipApplication(existing) });
            }
            next(err);
        }
    }
);

// Discard a draft entirely. Only allowed when the application has not yet
// been submitted.
app.delete(
    '/api/auth/student/applications/draft/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!/^[0-9a-fA-F]{24}$/.test(scholarshipId)) {
                return res.status(400).json({ message: 'A valid scholarship id is required.' });
            }
            const existing = await ScholarshipApplication.findOne({
                scholar: req.scholar._id,
                scholarship: scholarshipId,
            });
            if (!existing) return res.json({ deleted: false });
            if (existing.status !== 'draft') {
                return res.status(409).json({
                    message: 'Submitted applications cannot be deleted from here.',
                });
            }
            await existing.deleteOne();
            res.json({ deleted: true });
        } catch (err) {
            next(err);
        }
    }
);

// Promote a draft to a fully submitted application. Accepts the final payload
// (the wizard sends the latest local form values so we don't rely on a
// possibly stale draft) and applies the same validation as the legacy POST.
app.post(
    '/api/auth/student/applications/submit/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!/^[0-9a-fA-F]{24}$/.test(scholarshipId)) {
                return res.status(400).json({ message: 'A valid scholarship id is required.' });
            }

            const scholarship = await Scholarship.findOne({ _id: scholarshipId, active: true });
            if (!scholarship) {
                return res.status(404).json({ message: 'Scholarship not found or no longer active.' });
            }
            if (scholarship.deadline && new Date(scholarship.deadline) < new Date()) {
                return res.status(400).json({ message: 'This scholarship has closed.' });
            }

            const existing = await ScholarshipApplication.findOne({
                scholar: req.scholar._id,
                scholarship: scholarship._id,
            });
            if (existing && existing.status !== 'draft') {
                return res.status(409).json({
                    message: 'You have already applied to this scholarship.',
                    application: serializeScholarshipApplication(existing),
                });
            }

            const payload = buildApplicationPayload(req.body || {});

            // Soft validation: require the bare minimum to call this a real
            // application. Everything else is optional so the wizard can stay
            // friendly.
            if (!payload.personalInfo.fullName) {
                return res.status(400).json({ message: 'Please provide your full name.' });
            }

            const update = {
                ...payload,
                scholar: req.scholar._id,
                scholarship: scholarship._id,
                status: 'submitted',
                submittedAt: new Date(),
            };

            const saved = await ScholarshipApplication.findOneAndUpdate(
                { scholar: req.scholar._id, scholarship: scholarship._id },
                { $set: update },
                { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
            ).populate('scholarship');

            res.status(existing ? 200 : 201).json({
                application: serializeScholarshipApplication(saved),
            });
        } catch (err) {
            if (err && err.code === 11000) {
                return res.status(409).json({ message: 'You have already applied to this scholarship.' });
            }
            next(err);
        }
    }
);

app.post('/api/auth/student/applications', requireScholarSession, async (req, res, next) => {
    try {
        const { scholarshipId, motivation } = req.body || {};
        if (!scholarshipId || !String(scholarshipId).match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'A valid scholarship id is required.' });
        }
        const trimmedMotivation = String(motivation || '').trim();
        if (trimmedMotivation.length > APPLICATION_MOTIVATION_MAX) {
            return res.status(413).json({ message: 'Motivation statement is too long.' });
        }

        const scholarship = await Scholarship.findOne({ _id: scholarshipId, active: true });
        if (!scholarship) {
            return res.status(404).json({ message: 'Scholarship not found or no longer active.' });
        }

        if (scholarship.deadline && new Date(scholarship.deadline) < new Date()) {
            return res.status(400).json({ message: 'This scholarship has closed.' });
        }

        const existing = await ScholarshipApplication.findOne({
            scholar: req.scholar._id,
            scholarship: scholarship._id,
        });
        if (existing && existing.status !== 'draft') {
            return res.status(409).json({
                message: 'You have already applied to this scholarship.',
                application: serializeScholarshipApplication(existing),
            });
        }

        let saved;
        if (existing) {
            existing.motivation = trimmedMotivation;
            existing.status = 'submitted';
            existing.submittedAt = new Date();
            saved = await existing.save();
        } else {
            saved = await ScholarshipApplication.create({
                scholar: req.scholar._id,
                scholarship: scholarship._id,
                motivation: trimmedMotivation,
                status: 'submitted',
                submittedAt: new Date(),
            });
        }
        const populated = await saved.populate('scholarship');
        return res.status(existing ? 200 : 201).json({
            application: serializeScholarshipApplication(populated),
        });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ message: 'You have already applied to this scholarship.' });
        }
        next(err);
    }
});

// ----- Scholar: academic credentials --------------------------------------
const CREDENTIAL_TYPES = [
    'secondary-certificate',
    'transcript',
    'national-id',
    'passport',
    'language-test',
    'recommendation-letter',
    'cv',
    'other',
];

const serializeCredential = (entry) => ({
    id: String(entry._id),
    type: entry.type,
    title: entry.title,
    country: entry.country || '',
    issuingBody: entry.issuingBody || '',
    issuedYear: entry.issuedYear || null,
    originalName: entry.originalName,
    mimeType: entry.mimeType,
    sizeBytes: entry.sizeBytes,
    verificationStatus: entry.verificationStatus,
    verificationNote: entry.verificationNote || '',
    verifiedAt: entry.verifiedAt,
    gradeConversion: entry.gradeConversion && entry.gradeConversion.systemId
        ? {
            systemId: entry.gradeConversion.systemId,
            input: entry.gradeConversion.input,
            percentage: entry.gradeConversion.percentage,
            gpa4: entry.gradeConversion.gpa4,
            ukClass: entry.gradeConversion.ukClass,
            ects: entry.gradeConversion.ects,
            tier: entry.gradeConversion.tier,
            convertedAt: entry.gradeConversion.convertedAt,
        }
        : null,
    downloadUrl: `/api/auth/student/credentials/${entry._id}/download`,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
});

app.get('/api/auth/student/credentials', requireScholarSession, async (req, res, next) => {
    try {
        const entries = await AcademicCredential.find({ scholar: req.scholar._id })
            .sort({ createdAt: -1 });
        res.json({ credentials: entries.map(serializeCredential) });
    } catch (err) {
        next(err);
    }
});

const parseGradeConversionField = (raw) => {
    if (!raw) return null;
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== 'object' || !parsed.systemId) return null;
        return {
            systemId: String(parsed.systemId).slice(0, 30),
            input: String(parsed.input ?? '').slice(0, 30),
            percentage: Number.isFinite(parsed.percentage) ? Number(parsed.percentage) : null,
            gpa4: Number.isFinite(parsed.gpa4) ? Number(parsed.gpa4) : null,
            ukClass: String(parsed.ukClass ?? '').slice(0, 20),
            ects: String(parsed.ects ?? '').slice(0, 5),
            tier: String(parsed.tier ?? '').slice(0, 30),
            convertedAt: new Date(),
        };
    } catch {
        return null;
    }
};

app.post(
    '/api/auth/student/credentials',
    requireScholarSession,
    uploadCredential.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'A file is required.' });
            }
            const { type, title, country, issuingBody, issuedYear, gradeConversion } = req.body || {};
            if (!CREDENTIAL_TYPES.includes(type)) {
                return res.status(400).json({ message: 'Unknown credential type.' });
            }
            const trimmedTitle = String(title || '').trim();
            if (!trimmedTitle) {
                return res.status(400).json({ message: 'A title is required.' });
            }

            const yearNum = issuedYear ? Number(issuedYear) : null;
            if (issuedYear && (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > 2100)) {
                return res.status(400).json({ message: 'Issued year must be between 1950 and 2100.' });
            }

            const backend = preferredBackend();
            const stored = await backend.put({
                buffer: req.file.buffer,
                contentType: req.file.mimetype,
                prefix: `credentials/${String(req.scholar._id)}`,
                originalName: req.file.originalname,
            });

            let created;
            try {
                created = await AcademicCredential.create({
                    scholar: req.scholar._id,
                    type,
                    title: trimmedTitle.slice(0, 200),
                    country: String(country || '').trim().toUpperCase().slice(0, 3),
                    issuingBody: String(issuingBody || '').trim().slice(0, 200),
                    issuedYear: yearNum,
                    originalName: req.file.originalname.slice(0, 300),
                    storagePath: stored.key,
                    storageBackend: backend.name,
                    mimeType: req.file.mimetype,
                    sizeBytes: req.file.size,
                    gradeConversion: parseGradeConversionField(gradeConversion) || undefined,
                });
            } catch (err) {
                // If the DB write fails, clean up the orphaned file we just wrote
                // so we do not leak bytes in the bucket / on disk.
                await backend.delete(stored.key).catch(() => {});
                throw err;
            }
            return res.status(201).json({ credential: serializeCredential(created) });
        } catch (err) {
            next(err);
        }
    }
);

app.get(
    '/api/auth/student/credentials/:id/download',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const entry = await AcademicCredential.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!entry) return res.status(404).json({ message: 'Credential not found.' });
            await serveStoredFile(entry, res);
        } catch (err) {
            next(err);
        }
    }
);

app.delete(
    '/api/auth/student/credentials/:id',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const entry = await AcademicCredential.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!entry) return res.status(404).json({ message: 'Credential not found.' });
            const { storagePath, storageBackend } = entry;
            await entry.deleteOne();
            await backendFor(storageBackend).delete(storagePath).catch(() => {});
            return res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Admin: review academic credentials ---------------------------------
const CREDENTIAL_REVIEW_STATUSES = ['unverified', 'pending', 'verified', 'rejected'];

const serializeCredentialForAdmin = (entry, scholarDoc) => {
    const base = serializeCredential(entry);
    const scholar = scholarDoc || entry.scholar;
    return {
        ...base,
        downloadUrl: `/api/auth/admin/credentials/${entry._id}/download`,
        scholar: scholar
            ? {
                id: pickId(scholar),
                name: scholar.name,
                email: scholar.email,
            }
            : null,
        verifiedBy: entry.verifiedBy ? String(entry.verifiedBy) : null,
    };
};

app.get('/api/auth/admin/credentials', requireAdminSession, async (req, res, next) => {
    try {
        const { status, type, scholar: scholarId } = req.query || {};
        const filter = {};
        if (status && CREDENTIAL_REVIEW_STATUSES.includes(String(status))) {
            filter.verificationStatus = String(status);
        }
        if (type && CREDENTIAL_TYPES.includes(String(type))) {
            filter.type = String(type);
        }
        if (scholarId && /^[0-9a-fA-F]{24}$/.test(String(scholarId))) {
            filter.scholar = scholarId;
        }

        const entries = await AcademicCredential.find(filter)
            .populate('scholar', 'name email legacyId')
            .sort({ createdAt: -1 })
            .limit(500);

        res.json({ credentials: entries.map((e) => serializeCredentialForAdmin(e, e.scholar)) });
    } catch (err) {
        next(err);
    }
});

app.get('/api/auth/admin/credentials/:id', requireAdminSession, async (req, res, next) => {
    try {
        const entry = await AcademicCredential.findById(req.params.id)
            .populate('scholar', 'name email legacyId');
        if (!entry) return res.status(404).json({ message: 'Credential not found.' });
        res.json({ credential: serializeCredentialForAdmin(entry, entry.scholar) });
    } catch (err) {
        next(err);
    }
});

app.get(
    '/api/auth/admin/credentials/:id/download',
    requireAdminSession,
    async (req, res, next) => {
        try {
            const entry = await AcademicCredential.findById(req.params.id);
            if (!entry) return res.status(404).json({ message: 'Credential not found.' });
            await serveStoredFile(entry, res);
        } catch (err) {
            next(err);
        }
    }
);

app.patch('/api/auth/admin/credentials/:id', requireAdminSession, async (req, res, next) => {
    try {
        const { verificationStatus, verificationNote } = req.body || {};
        if (!CREDENTIAL_REVIEW_STATUSES.includes(String(verificationStatus))) {
            return res.status(400).json({
                message: `verificationStatus must be one of: ${CREDENTIAL_REVIEW_STATUSES.join(', ')}.`,
            });
        }
        const entry = await AcademicCredential.findById(req.params.id);
        if (!entry) return res.status(404).json({ message: 'Credential not found.' });

        entry.verificationStatus = verificationStatus;
        entry.verificationNote = String(verificationNote || '').slice(0, 1000);
        if (verificationStatus === 'verified' || verificationStatus === 'rejected') {
            entry.verifiedBy = req.admin._id;
            entry.verifiedAt = new Date();
        } else {
            entry.verifiedBy = null;
            entry.verifiedAt = null;
        }
        await entry.save();

        const populated = await entry.populate('scholar', 'name email legacyId');
        res.json({ credential: serializeCredentialForAdmin(populated, populated.scholar) });
    } catch (err) {
        next(err);
    }
});

// ----- Scholar: travel documents (Phase 6) --------------------------------
const TRAVEL_DOC_TYPES = ['passport', 'visa', 'travel-insurance', 'vaccination', 'other-travel'];

const serializeTravelDoc = (entry, { revealNumber = false } = {}) => {
    const out = {
        id: String(entry._id),
        type: entry.type,
        title: entry.title,
        country: entry.country || '',
        documentNumberLast4: entry.documentNumberLast4 || '',
        documentNumber: revealNumber ? decryptDocNumber(entry.documentNumberEncrypted) : null,
        issuedDate: entry.issuedDate,
        expiryDate: entry.expiryDate,
        originalName: entry.originalName,
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        verificationStatus: entry.verificationStatus,
        verificationNote: entry.verificationNote || '',
        verifiedAt: entry.verifiedAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
    };
    return out;
};

const parseDateOrNull = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d : null;
};

app.get('/api/auth/student/travel-docs', requireScholarSession, async (req, res, next) => {
    try {
        const entries = await TravelDocument.find({ scholar: req.scholar._id })
            .sort({ createdAt: -1 });
        // Scholars always see their own document numbers in full.
        res.json({
            documents: entries.map((e) => ({
                ...serializeTravelDoc(e, { revealNumber: true }),
                downloadUrl: `/api/auth/student/travel-docs/${e._id}/download`,
            })),
        });
    } catch (err) {
        next(err);
    }
});

app.post(
    '/api/auth/student/travel-docs',
    requireScholarSession,
    uploadTravelDoc.single('file'),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: 'A file is required.' });
            }
            const { type, title, country, documentNumber, issuedDate, expiryDate } = req.body || {};
            if (!TRAVEL_DOC_TYPES.includes(type)) {
                return res.status(400).json({ message: 'Unknown travel-document type.' });
            }
            const trimmedTitle = String(title || '').trim();
            if (!trimmedTitle) {
                return res.status(400).json({ message: 'A title is required.' });
            }

            const issued = parseDateOrNull(issuedDate);
            const expiry = parseDateOrNull(expiryDate);

            const plainNumber = String(documentNumber || '').trim();
            const encrypted = encryptDocNumber(plainNumber);
            const last4 = plainNumber.length >= 4
                ? plainNumber.slice(-4)
                : plainNumber;

            const backend = preferredBackend();
            const stored = await backend.put({
                buffer: req.file.buffer,
                contentType: req.file.mimetype,
                prefix: `travel/${String(req.scholar._id)}`,
                originalName: req.file.originalname,
            });

            let created;
            try {
                created = await TravelDocument.create({
                    scholar: req.scholar._id,
                    type,
                    title: trimmedTitle.slice(0, 200),
                    country: String(country || '').trim().toUpperCase().slice(0, 3),
                    documentNumberEncrypted: encrypted,
                    documentNumberLast4: last4,
                    issuedDate: issued,
                    expiryDate: expiry,
                    originalName: req.file.originalname.slice(0, 300),
                    storagePath: stored.key,
                    storageBackend: backend.name,
                    mimeType: req.file.mimetype,
                    sizeBytes: req.file.size,
                });
            } catch (err) {
                await backend.delete(stored.key).catch(() => {});
                throw err;
            }
            return res.status(201).json({
                document: {
                    ...serializeTravelDoc(created, { revealNumber: true }),
                    downloadUrl: `/api/auth/student/travel-docs/${created._id}/download`,
                },
            });
        } catch (err) {
            next(err);
        }
    }
);

app.get(
    '/api/auth/student/travel-docs/:id/download',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const entry = await TravelDocument.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!entry) return res.status(404).json({ message: 'Travel document not found.' });
            await serveStoredFile(entry, res);
        } catch (err) {
            next(err);
        }
    }
);

app.delete(
    '/api/auth/student/travel-docs/:id',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const entry = await TravelDocument.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!entry) return res.status(404).json({ message: 'Travel document not found.' });
            const { storagePath, storageBackend } = entry;
            await entry.deleteOne();
            await backendFor(storageBackend).delete(storagePath).catch(() => {});
            return res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Admin: travel documents --------------------------------------------
// Visibility rule: admins can ONLY see travel docs for scholars who have at
// least one ScholarshipApplication with status 'approved'. This protects
// sensitive identity data from being browsed casually.

const scholarHasApprovedApplication = async (scholarId) => {
    const count = await ScholarshipApplication.countDocuments({
        scholar: scholarId,
        status: 'approved',
    });
    return count > 0;
};

const serializeTravelDocForAdmin = (entry, scholar) => ({
    ...serializeTravelDoc(entry, { revealNumber: true }),
    downloadUrl: `/api/auth/admin/travel-docs/${entry._id}/download`,
    scholar: scholar
        ? {
            id: pickId(scholar),
            name: scholar.name,
            email: scholar.email,
        }
        : null,
    verifiedBy: entry.verifiedBy ? String(entry.verifiedBy) : null,
});

app.get('/api/auth/admin/travel-docs', requireAdminSession, async (req, res, next) => {
    try {
        const { scholar: scholarId, type, status } = req.query || {};

        // Always require a scholar filter for the admin list — we never let
        // admins page through every scholar's identity documents in one shot.
        if (!scholarId || !/^[0-9a-fA-F]{24}$/.test(String(scholarId))) {
            return res.status(400).json({
                message: 'A scholar id is required to view travel documents.',
            });
        }

        const allowed = await scholarHasApprovedApplication(scholarId);
        if (!allowed) {
            return res.status(403).json({
                message: 'Travel documents are only visible after at least one scholarship has been approved for this scholar.',
            });
        }

        const filter = { scholar: scholarId };
        if (type && TRAVEL_DOC_TYPES.includes(String(type))) filter.type = String(type);
        if (status && CREDENTIAL_REVIEW_STATUSES.includes(String(status))) {
            filter.verificationStatus = String(status);
        }

        const entries = await TravelDocument.find(filter)
            .populate('scholar', 'name email legacyId')
            .sort({ createdAt: -1 });

        res.json({
            documents: entries.map((e) => serializeTravelDocForAdmin(e, e.scholar)),
        });
    } catch (err) {
        next(err);
    }
});

app.get(
    '/api/auth/admin/travel-docs/:id/download',
    requireAdminSession,
    async (req, res, next) => {
        try {
            const entry = await TravelDocument.findById(req.params.id);
            if (!entry) return res.status(404).json({ message: 'Travel document not found.' });

            const allowed = await scholarHasApprovedApplication(entry.scholar);
            if (!allowed) {
                return res.status(403).json({
                    message: 'Travel documents are only visible after at least one scholarship has been approved.',
                });
            }

            await serveStoredFile(entry, res);
        } catch (err) {
            next(err);
        }
    }
);

app.patch('/api/auth/admin/travel-docs/:id', requireAdminSession, async (req, res, next) => {
    try {
        const { verificationStatus, verificationNote } = req.body || {};
        if (!CREDENTIAL_REVIEW_STATUSES.includes(String(verificationStatus))) {
            return res.status(400).json({
                message: `verificationStatus must be one of: ${CREDENTIAL_REVIEW_STATUSES.join(', ')}.`,
            });
        }
        const entry = await TravelDocument.findById(req.params.id);
        if (!entry) return res.status(404).json({ message: 'Travel document not found.' });

        const allowed = await scholarHasApprovedApplication(entry.scholar);
        if (!allowed) {
            return res.status(403).json({
                message: 'Travel documents are only reviewable after at least one scholarship has been approved.',
            });
        }

        entry.verificationStatus = verificationStatus;
        entry.verificationNote = String(verificationNote || '').slice(0, 1000);
        if (verificationStatus === 'verified' || verificationStatus === 'rejected') {
            entry.verifiedBy = req.admin._id;
            entry.verifiedAt = new Date();
        } else {
            entry.verifiedBy = null;
            entry.verifiedAt = null;
        }
        await entry.save();

        const populated = await entry.populate('scholar', 'name email legacyId');
        res.json({ document: serializeTravelDocForAdmin(populated, populated.scholar) });
    } catch (err) {
        next(err);
    }
});

// Helper for the admin UI: check whether a scholar is eligible (has an
// approved application) WITHOUT returning the documents themselves.
app.get(
    '/api/auth/admin/travel-docs/eligibility/:scholarId',
    requireAdminSession,
    async (req, res, next) => {
        try {
            const { scholarId } = req.params;
            if (!/^[0-9a-fA-F]{24}$/.test(scholarId)) {
                return res.status(400).json({ message: 'Invalid scholar id.' });
            }
            const allowed = await scholarHasApprovedApplication(scholarId);
            const approvedCount = await ScholarshipApplication.countDocuments({
                scholar: scholarId,
                status: 'approved',
            });
            res.json({ eligible: allowed, approvedCount });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Visa workflows (Phase 7) -------------------------------------------
const VISA_WORKFLOW_STATUSES = [
    'not-started', 'in-progress', 'submitted', 'approved',
    'rejected', 'completed', 'on-hold',
];
const VISA_TYPES = ['student', 'exchange', 'research', 'training', 'other'];
const MILESTONE_STATUSES = ['pending', 'in-progress', 'done', 'blocked', 'skipped'];

const serializeVisaWorkflow = (entry, scholarshipApp) => ({
    id: String(entry._id),
    scholarshipApplicationId: scholarshipApp ? String(scholarshipApp._id || scholarshipApp) : null,
    scholarship: scholarshipApp && scholarshipApp.scholarship && typeof scholarshipApp.scholarship === 'object'
        ? {
            id: String(scholarshipApp.scholarship._id),
            title: scholarshipApp.scholarship.title,
            provider: scholarshipApp.scholarship.provider,
            country: scholarshipApp.scholarship.country,
        }
        : null,
    destinationCountry: entry.destinationCountry || '',
    visaType: entry.visaType,
    status: entry.status,
    embassy: {
        country: entry.embassy?.country || '',
        city: entry.embassy?.city || '',
        address: entry.embassy?.address || '',
        website: entry.embassy?.website || '',
        contactEmail: entry.embassy?.contactEmail || '',
    },
    appointmentDate: entry.appointmentDate,
    submittedAt: entry.submittedAt,
    decisionAt: entry.decisionAt,
    visaIssuedAt: entry.visaIssuedAt,
    visaExpiry: entry.visaExpiry,
    visaReference: entry.visaReference || '',
    milestones: (entry.milestones || []).map((m) => ({
        key: m.key,
        label: m.label,
        status: m.status,
        dueDate: m.dueDate,
        completedAt: m.completedAt,
        note: m.note || '',
    })),
    timeline: (entry.timeline || []).map((n) => ({
        id: String(n._id),
        body: n.body,
        author: n.author,
        authorName: n.authorName || '',
        createdAt: n.createdAt,
    })),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
});

// Scholar: list workflows + the approved applications eligible for one.
app.get('/api/auth/student/visa-workflows', requireScholarSession, async (req, res, next) => {
    try {
        const approvedApps = await ScholarshipApplication.find({
            scholar: req.scholar._id,
            status: 'approved',
        }).populate('scholarship', 'title provider country');

        const workflows = await VisaWorkflow.find({ scholar: req.scholar._id })
            .sort({ createdAt: -1 });

        const wfByAppId = new Map(
            workflows.map((w) => [String(w.scholarshipApplication), w])
        );

        const eligibleApps = approvedApps.map((app) => ({
            id: String(app._id),
            scholarship: app.scholarship
                ? {
                    id: String(app.scholarship._id),
                    title: app.scholarship.title,
                    provider: app.scholarship.provider,
                    country: app.scholarship.country,
                }
                : null,
            hasWorkflow: wfByAppId.has(String(app._id)),
            workflowId: wfByAppId.has(String(app._id))
                ? String(wfByAppId.get(String(app._id))._id)
                : null,
        }));

        const serialized = workflows.map((w) => {
            const app = approvedApps.find((a) => String(a._id) === String(w.scholarshipApplication));
            return serializeVisaWorkflow(w, app);
        });

        res.json({ workflows: serialized, eligibleApplications: eligibleApps });
    } catch (err) {
        next(err);
    }
});

// Scholar: create a workflow against an approved application.
app.post('/api/auth/student/visa-workflows', requireScholarSession, async (req, res, next) => {
    try {
        const { scholarshipApplicationId, destinationCountry, visaType } = req.body || {};
        if (!scholarshipApplicationId || !/^[0-9a-fA-F]{24}$/.test(String(scholarshipApplicationId))) {
            return res.status(400).json({ message: 'A valid scholarshipApplicationId is required.' });
        }

        const app = await ScholarshipApplication.findOne({
            _id: scholarshipApplicationId,
            scholar: req.scholar._id,
        }).populate('scholarship', 'title provider country');

        if (!app) return res.status(404).json({ message: 'Scholarship application not found.' });
        if (app.status !== 'approved') {
            return res.status(403).json({
                message: 'Visa tracking is only available for approved scholarships.',
            });
        }

        const existing = await VisaWorkflow.findOne({ scholarshipApplication: app._id });
        if (existing) {
            return res.status(409).json({
                message: 'A visa workflow already exists for this scholarship.',
                workflow: serializeVisaWorkflow(existing, app),
            });
        }

        const country = String(destinationCountry || app.scholarship?.country || '')
            .trim().toUpperCase().slice(0, 3);
        const type = VISA_TYPES.includes(visaType) ? visaType : 'student';

        const created = await VisaWorkflow.create({
            scholar: req.scholar._id,
            scholarshipApplication: app._id,
            destinationCountry: country,
            visaType: type,
        });

        res.status(201).json({ workflow: serializeVisaWorkflow(created, app) });
    } catch (err) {
        if (err && err.code === 11000) {
            return res.status(409).json({ message: 'A visa workflow already exists for this application.' });
        }
        next(err);
    }
});

// Scholar: read one of mine.
app.get('/api/auth/student/visa-workflows/:id', requireScholarSession, async (req, res, next) => {
    try {
        const wf = await VisaWorkflow.findOne({
            _id: req.params.id,
            scholar: req.scholar._id,
        });
        if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });
        const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
            .populate('scholarship', 'title provider country');
        res.json({ workflow: serializeVisaWorkflow(wf, app) });
    } catch (err) {
        next(err);
    }
});

// Scholar: update top-level fields (embassy, dates, visaReference, status).
app.patch('/api/auth/student/visa-workflows/:id', requireScholarSession, async (req, res, next) => {
    try {
        const wf = await VisaWorkflow.findOne({
            _id: req.params.id,
            scholar: req.scholar._id,
        });
        if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

        const body = req.body || {};
        if (body.destinationCountry !== undefined) {
            wf.destinationCountry = String(body.destinationCountry || '').trim().toUpperCase().slice(0, 3);
        }
        if (body.visaType !== undefined && VISA_TYPES.includes(body.visaType)) {
            wf.visaType = body.visaType;
        }
        if (body.status !== undefined && VISA_WORKFLOW_STATUSES.includes(body.status)) {
            wf.status = body.status;
        }
        if (body.visaReference !== undefined) {
            wf.visaReference = String(body.visaReference || '').trim().slice(0, 100);
        }
        for (const dateKey of ['appointmentDate', 'submittedAt', 'decisionAt', 'visaIssuedAt', 'visaExpiry']) {
            if (body[dateKey] !== undefined) {
                wf[dateKey] = body[dateKey] ? new Date(body[dateKey]) : null;
            }
        }
        if (body.embassy && typeof body.embassy === 'object') {
            wf.embassy = {
                country: String(body.embassy.country || '').trim().toUpperCase().slice(0, 3),
                city: String(body.embassy.city || '').trim().slice(0, 100),
                address: String(body.embassy.address || '').trim().slice(0, 300),
                website: String(body.embassy.website || '').trim().slice(0, 300),
                contactEmail: String(body.embassy.contactEmail || '').trim().toLowerCase().slice(0, 200),
            };
        }
        await wf.save();

        const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
            .populate('scholarship', 'title provider country');
        res.json({ workflow: serializeVisaWorkflow(wf, app) });
    } catch (err) {
        next(err);
    }
});

// Scholar: update a single milestone.
app.patch(
    '/api/auth/student/visa-workflows/:id/milestones/:key',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const wf = await VisaWorkflow.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

            const milestone = wf.milestones.find((m) => m.key === req.params.key);
            if (!milestone) return res.status(404).json({ message: 'Milestone not found.' });

            const body = req.body || {};
            if (body.status !== undefined && MILESTONE_STATUSES.includes(body.status)) {
                milestone.status = body.status;
                if (body.status === 'done') {
                    milestone.completedAt = milestone.completedAt || new Date();
                } else {
                    milestone.completedAt = null;
                }
            }
            if (body.dueDate !== undefined) {
                milestone.dueDate = body.dueDate ? new Date(body.dueDate) : null;
            }
            if (body.note !== undefined) {
                milestone.note = String(body.note || '').slice(0, 500);
            }
            await wf.save();

            const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
                .populate('scholarship', 'title provider country');
            res.json({ workflow: serializeVisaWorkflow(wf, app) });
        } catch (err) {
            next(err);
        }
    }
);

// Scholar: add a timeline note.
app.post(
    '/api/auth/student/visa-workflows/:id/notes',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const wf = await VisaWorkflow.findOne({
                _id: req.params.id,
                scholar: req.scholar._id,
            });
            if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

            const body = String(req.body?.body || '').trim();
            if (!body) return res.status(400).json({ message: 'Note body is required.' });

            wf.timeline.push({
                body: body.slice(0, 1000),
                author: 'scholar',
                authorName: req.scholar.name || '',
            });
            await wf.save();

            const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
                .populate('scholarship', 'title provider country');
            res.status(201).json({ workflow: serializeVisaWorkflow(wf, app) });
        } catch (err) {
            next(err);
        }
    }
);

// Admin: list workflows (optional scholar filter).
app.get('/api/auth/admin/visa-workflows', requireAdminSession, async (req, res, next) => {
    try {
        const { scholar: scholarId, status } = req.query || {};
        const filter = {};
        if (scholarId && /^[0-9a-fA-F]{24}$/.test(String(scholarId))) {
            filter.scholar = scholarId;
        }
        if (status && VISA_WORKFLOW_STATUSES.includes(String(status))) {
            filter.status = String(status);
        }

        const workflows = await VisaWorkflow.find(filter)
            .populate('scholar', 'name email legacyId')
            .sort({ updatedAt: -1 })
            .limit(500);

        const appIds = workflows.map((w) => w.scholarshipApplication);
        const apps = await ScholarshipApplication.find({ _id: { $in: appIds } })
            .populate('scholarship', 'title provider country');
        const appMap = new Map(apps.map((a) => [String(a._id), a]));

        const serialized = workflows.map((w) => {
            const app = appMap.get(String(w.scholarshipApplication));
            const base = serializeVisaWorkflow(w, app);
            return {
                ...base,
                scholar: w.scholar
                    ? { id: pickId(w.scholar), name: w.scholar.name, email: w.scholar.email }
                    : null,
            };
        });

        res.json({ workflows: serialized });
    } catch (err) {
        next(err);
    }
});

// Admin: analytics summary (Phase 8).
app.get('/api/auth/admin/visa-workflows/stats', requireAdminSession, async (req, res, next) => {
    try {
        const all = await VisaWorkflow.find()
            .populate('scholar', 'name email legacyId')
            .populate({
                path: 'scholarshipApplication',
                populate: { path: 'scholarship', select: 'title provider country' },
            });

        const total = all.length;
        const byStatus = Object.fromEntries(VISA_WORKFLOW_STATUSES.map((s) => [s, 0]));
        const byVisaType = Object.fromEntries(VISA_TYPES.map((t) => [t, 0]));
        const byDestination = {};

        let totalMilestones = 0;
        let doneMilestones = 0;
        const milestoneByStatus = Object.fromEntries(
            MILESTONE_STATUSES.map((s) => [s, 0])
        );
        const milestoneBreakdown = {};

        const now = Date.now();
        const ONE_DAY = 86400000;
        const upcomingAppointments = [];
        const overdueMilestones = [];
        const expiringVisas = [];
        const recentlyUpdated = [];

        const scholarOf = (wf) =>
            wf.scholar
                ? { id: pickId(wf.scholar), name: wf.scholar.name, email: wf.scholar.email }
                : null;

        for (const wf of all) {
            byStatus[wf.status] = (byStatus[wf.status] || 0) + 1;
            byVisaType[wf.visaType] = (byVisaType[wf.visaType] || 0) + 1;
            if (wf.destinationCountry) {
                byDestination[wf.destinationCountry] =
                    (byDestination[wf.destinationCountry] || 0) + 1;
            }

            for (const m of wf.milestones) {
                totalMilestones += 1;
                if (m.status === 'done') doneMilestones += 1;
                milestoneByStatus[m.status] = (milestoneByStatus[m.status] || 0) + 1;
                if (!milestoneBreakdown[m.key]) {
                    milestoneBreakdown[m.key] = {
                        key: m.key,
                        label: m.label,
                        pending: 0,
                        'in-progress': 0,
                        done: 0,
                        blocked: 0,
                        skipped: 0,
                    };
                }
                milestoneBreakdown[m.key][m.status] =
                    (milestoneBreakdown[m.key][m.status] || 0) + 1;

                if (m.dueDate && m.status !== 'done' && m.status !== 'skipped') {
                    const due = new Date(m.dueDate).getTime();
                    if (Number.isFinite(due) && due < now) {
                        overdueMilestones.push({
                            workflowId: String(wf._id),
                            scholar: scholarOf(wf),
                            milestoneKey: m.key,
                            milestoneLabel: m.label,
                            dueDate: m.dueDate,
                            daysOverdue: Math.floor((now - due) / ONE_DAY),
                        });
                    }
                }
            }

            if (wf.appointmentDate) {
                const appt = new Date(wf.appointmentDate).getTime();
                if (Number.isFinite(appt) && appt > now && appt - now < 30 * ONE_DAY) {
                    upcomingAppointments.push({
                        workflowId: String(wf._id),
                        scholar: scholarOf(wf),
                        appointmentDate: wf.appointmentDate,
                        destinationCountry: wf.destinationCountry || null,
                        daysUntil: Math.ceil((appt - now) / ONE_DAY),
                    });
                }
            }

            if (wf.visaExpiry) {
                const exp = new Date(wf.visaExpiry).getTime();
                if (Number.isFinite(exp) && exp > now && exp - now < 90 * ONE_DAY) {
                    expiringVisas.push({
                        workflowId: String(wf._id),
                        scholar: scholarOf(wf),
                        visaExpiry: wf.visaExpiry,
                        daysUntil: Math.ceil((exp - now) / ONE_DAY),
                    });
                }
            }

            recentlyUpdated.push({
                workflowId: String(wf._id),
                scholar: scholarOf(wf),
                status: wf.status,
                destinationCountry: wf.destinationCountry || null,
                updatedAt: wf.updatedAt,
            });
        }

        upcomingAppointments.sort((a, b) => a.daysUntil - b.daysUntil);
        overdueMilestones.sort((a, b) => b.daysOverdue - a.daysOverdue);
        expiringVisas.sort((a, b) => a.daysUntil - b.daysUntil);
        recentlyUpdated.sort(
            (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        const topDestinations = Object.entries(byDestination)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([country, count]) => ({ country, count }));

        res.json({
            total,
            byStatus,
            byVisaType,
            topDestinations,
            milestones: {
                total: totalMilestones,
                done: doneMilestones,
                completionRate:
                    totalMilestones > 0
                        ? Math.round((doneMilestones / totalMilestones) * 100)
                        : 0,
                byStatus: milestoneByStatus,
                breakdown: Object.values(milestoneBreakdown),
            },
            upcomingAppointments: upcomingAppointments.slice(0, 20),
            overdueMilestones: overdueMilestones.slice(0, 20),
            expiringVisas: expiringVisas.slice(0, 20),
            recentlyUpdated: recentlyUpdated.slice(0, 15),
        });
    } catch (err) {
        next(err);
    }
});

// Admin: read a single workflow.
app.get('/api/auth/admin/visa-workflows/:id', requireAdminSession, async (req, res, next) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({ message: 'Invalid workflow id.' });
        }
        const wf = await VisaWorkflow.findById(req.params.id)
            .populate('scholar', 'name email legacyId')
            .populate({
                path: 'scholarshipApplication',
                populate: { path: 'scholarship', select: 'title provider country' },
            });
        if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

        const base = serializeVisaWorkflow(wf, wf.scholarshipApplication);
        res.json({
            workflow: {
                ...base,
                scholar: wf.scholar
                    ? {
                        id: pickId(wf.scholar),
                        name: wf.scholar.name,
                        email: wf.scholar.email,
                    }
                    : null,
            },
        });
    } catch (err) {
        next(err);
    }
});

// Admin: update workflow details.
app.patch('/api/auth/admin/visa-workflows/:id', requireAdminSession, async (req, res, next) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
            return res.status(400).json({ message: 'Invalid workflow id.' });
        }
        const wf = await VisaWorkflow.findById(req.params.id);
        if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

        const body = req.body || {};
        if (body.destinationCountry !== undefined) {
            wf.destinationCountry = String(body.destinationCountry || '')
                .toUpperCase()
                .slice(0, 3);
        }
        if (body.visaType !== undefined && VISA_TYPES.includes(body.visaType)) {
            wf.visaType = body.visaType;
        }
        if (body.status !== undefined && VISA_WORKFLOW_STATUSES.includes(body.status)) {
            wf.status = body.status;
        }
        if (body.visaReference !== undefined) {
            wf.visaReference = String(body.visaReference || '').slice(0, 100);
        }
        for (const key of [
            'appointmentDate',
            'submittedAt',
            'decisionAt',
            'visaIssuedAt',
            'visaExpiry',
        ]) {
            if (body[key] !== undefined) {
                wf[key] = body[key] ? new Date(body[key]) : null;
            }
        }
        if (body.embassy && typeof body.embassy === 'object') {
            wf.embassy = {
                country: String(body.embassy.country || '').toUpperCase().slice(0, 3),
                city: String(body.embassy.city || '').slice(0, 100),
                address: String(body.embassy.address || '').slice(0, 300),
                website: String(body.embassy.website || '').slice(0, 300),
                contactEmail: String(body.embassy.contactEmail || '').slice(0, 200),
            };
        }
        await wf.save();

        const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
            .populate('scholarship', 'title provider country');
        res.json({ workflow: serializeVisaWorkflow(wf, app) });
    } catch (err) {
        next(err);
    }
});

// Admin: update a single milestone.
app.patch(
    '/api/auth/admin/visa-workflows/:id/milestones/:key',
    requireAdminSession,
    async (req, res, next) => {
        try {
            if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
                return res.status(400).json({ message: 'Invalid workflow id.' });
            }
            const wf = await VisaWorkflow.findById(req.params.id);
            if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

            const m = wf.milestones.find((ms) => ms.key === req.params.key);
            if (!m) return res.status(404).json({ message: 'Milestone not found.' });

            const body = req.body || {};
            if (body.status !== undefined && MILESTONE_STATUSES.includes(body.status)) {
                m.status = body.status;
                m.completedAt = body.status === 'done' ? new Date() : null;
            }
            if (body.dueDate !== undefined) {
                m.dueDate = body.dueDate ? new Date(body.dueDate) : null;
            }
            if (body.note !== undefined) {
                m.note = String(body.note || '').slice(0, 500);
            }
            await wf.save();

            const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
                .populate('scholarship', 'title provider country');
            res.json({ workflow: serializeVisaWorkflow(wf, app) });
        } catch (err) {
            next(err);
        }
    }
);

// Admin: add a timeline note on any workflow.
app.post(
    '/api/auth/admin/visa-workflows/:id/notes',
    requireAdminSession,
    async (req, res, next) => {
        try {
            if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
                return res.status(400).json({ message: 'Invalid workflow id.' });
            }
            const wf = await VisaWorkflow.findById(req.params.id);
            if (!wf) return res.status(404).json({ message: 'Visa workflow not found.' });

            const body = String(req.body?.body || '').trim();
            if (!body) return res.status(400).json({ message: 'Note body is required.' });

            wf.timeline.push({
                body: body.slice(0, 1000),
                author: 'admin',
                authorName: req.admin.name || req.admin.email || 'Admin',
            });
            await wf.save();

            const app = await ScholarshipApplication.findById(wf.scholarshipApplication)
                .populate('scholarship', 'title provider country');
            res.status(201).json({ workflow: serializeVisaWorkflow(wf, app) });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Admin: applicants --------------------------------------------------
app.get('/api/auth/admin/applicants', requireAdminSession, async (req, res, next) => {
    try {
        const applications = await Application.find().sort({ createdAt: 1 });
        const scholars = await Scholar.find({
            application: { $in: applications.map((a) => a._id) },
        });
        const scholarByAppId = new Map(scholars.map((s) => [String(s.application), s]));

        const applicants = applications.map((entry) => {
            const linked = scholarByAppId.get(String(entry._id));
            return {
                ...toProfileApplication(entry),
                email: linked?.email || '',
                scholarAccountId: linked ? pickId(linked) : null,
            };
        });
        return res.json({ applicants });
    } catch (err) {
        next(err);
    }
});

app.get('/api/auth/admin/applicants/:id', requireAdminSession, async (req, res, next) => {
    try {
        const application = await findByEitherId(Application, req.params.id);
        if (!application) return res.status(404).json({ message: 'Applicant not found.' });
        const linked = await Scholar.findOne({ application: application._id });
        return res.json({
            applicant: {
                ...toProfileApplication(application),
                email: linked?.email || '',
                scholarAccountId: linked ? pickId(linked) : null,
            },
        });
    } catch (err) {
        next(err);
    }
});

// ----- Sign-up ------------------------------------------------------------
app.post('/api/auth/student/sign-up', authLimiter, validate(ScholarSignUpSchema), async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existing = await Scholar.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'A scholar account with this email already exists.' });
        }

        const passwordRecord = createPasswordRecord(password);
        const newScholar = await Scholar.create({
            name,
            email,
            role: 'student',
            application: null,
            ...passwordRecord,
        });

        const { token: sessionToken } = await issueSession({
            kind: 'scholar',
            principalId: newScholar._id,
            req,
            res,
        });

        // Fire-and-forget verification email so the response is not delayed by SMTP.
        issueVerificationToken({
            kind: 'email-verify',
            principalKind: 'scholar',
            principalId: newScholar._id,
            ttlMs: EMAIL_VERIFY_TTL_MS,
            req,
        })
            .then(({ token }) => sendVerificationEmail(newScholar, token))
            .catch((err) => (req.log || console).warn?.({ err: err.message }, '[verify-email] dispatch failed'));

        audit(req, {
            action: 'scholar.sign-up',
            actor: { kind: 'scholar', id: newScholar._id, email: newScholar.email },
            target: { kind: 'Scholar', id: newScholar._id, label: newScholar.email },
        });

        return res.status(201).json({
            message: 'Scholar account created. Check your email to verify the address.',
            sessionToken,
            scholar: toPublicScholar(newScholar),
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/admin/sign-up', authLimiter, validate(AdminSignUpSchema), async (req, res, next) => {
    try {
        const {
            name,
            email,
            password,
            department,
            departmentCode,
            twoFactorCode,
            inviteCode,
        } = req.body;

        const inviteAdmin = await Admin.findOne({
            $or: [{ departmentCode: inviteCode }, { twoFactorCode: inviteCode }],
        });
        if (!inviteAdmin) return res.status(401).json({ message: 'Invalid admin invite code.' });

        const dup = await Admin.findOne({ email });
        if (dup) return res.status(409).json({ message: 'An admin with this email already exists.' });

        const newAdmin = await Admin.create({
            name,
            email,
            role: 'administrator',
            department,
            departmentCode,
            twoFactorCode,
            ...createPasswordRecord(password),
        });

        return res.status(201).json({
            message: 'Admin account created. Sign in with the new credentials.',
            admin: toPublicAdmin(newAdmin),
        });
    } catch (err) {
        next(err);
    }
});

// ----- Email verification + password reset (scholar) ---------------------
// All four endpoints respond with a generic success message even when the
// email is unknown, so attackers cannot enumerate registered accounts.

app.post('/api/auth/student/verify-email', authLimiter, validate(VerifyEmailSchema), async (req, res, next) => {
    try {
        const { token } = req.body;
        const record = await consumeVerificationToken(token, 'email-verify');
        if (!record || record.principalKind !== 'scholar') {
            audit(req, { action: 'scholar.email-verify', outcome: 'failure', metadata: { reason: 'invalid-token' } });
            return res.status(410).json({ message: 'Verification link is invalid or has expired.' });
        }
        const scholar = await Scholar.findById(record.principalId);
        if (!scholar) {
            return res.status(404).json({ message: 'Scholar account no longer exists.' });
        }
        if (!scholar.emailVerified) {
            scholar.emailVerified = true;
            scholar.emailVerifiedAt = new Date();
            await scholar.save();
        }
        audit(req, {
            action: 'scholar.email-verify',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            target: { kind: 'Scholar', id: scholar._id, label: scholar.email },
        });
        return res.json({
            message: 'Email verified.',
            scholar: toPublicScholar(scholar),
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/student/resend-verification', authLimiter, validate(ResendVerificationSchema), async (req, res, next) => {
    try {
        const { email } = req.body;
        const scholar = await Scholar.findOne({ email });
        // Always 202 — never leak which addresses exist.
        if (!scholar) {
            return res.status(202).json({ message: 'If the account exists and is unverified, a new email has been sent.' });
        }
        if (scholar.emailVerified) {
            return res.status(202).json({ message: 'If the account exists and is unverified, a new email has been sent.' });
        }
        const { token } = await issueVerificationToken({
            kind: 'email-verify',
            principalKind: 'scholar',
            principalId: scholar._id,
            ttlMs: EMAIL_VERIFY_TTL_MS,
            req,
        });
        await sendVerificationEmail(scholar, token);
        audit(req, {
            action: 'scholar.email-verify.resend',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            target: { kind: 'Scholar', id: scholar._id, label: scholar.email },
        });
        return res.status(202).json({ message: 'If the account exists and is unverified, a new email has been sent.' });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/student/forgot-password', authLimiter, validate(ForgotPasswordSchema), async (req, res, next) => {
    try {
        const { email } = req.body;
        const scholar = await Scholar.findOne({ email });
        // Always 202 — never leak which addresses exist.
        if (!scholar) {
            audit(req, { action: 'scholar.password-reset.request', outcome: 'failure', metadata: { reason: 'unknown-email', email } });
            return res.status(202).json({ message: 'If the account exists, a password reset email has been sent.' });
        }
        const { token } = await issueVerificationToken({
            kind: 'password-reset',
            principalKind: 'scholar',
            principalId: scholar._id,
            ttlMs: PASSWORD_RESET_TTL_MS,
            req,
        });
        await sendPasswordResetEmail(scholar, token);
        audit(req, {
            action: 'scholar.password-reset.request',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            target: { kind: 'Scholar', id: scholar._id, label: scholar.email },
        });
        return res.status(202).json({ message: 'If the account exists, a password reset email has been sent.' });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/student/reset-password', authLimiter, validate(ResetPasswordSchema), async (req, res, next) => {
    try {
        const { token, password } = req.body;
        const record = await consumeVerificationToken(token, 'password-reset');
        if (!record || record.principalKind !== 'scholar') {
            audit(req, { action: 'scholar.password-reset.complete', outcome: 'failure', metadata: { reason: 'invalid-token' } });
            return res.status(410).json({ message: 'Reset link is invalid or has expired.' });
        }
        const scholar = await Scholar.findById(record.principalId);
        if (!scholar) {
            return res.status(404).json({ message: 'Scholar account no longer exists.' });
        }
        Object.assign(scholar, createPasswordRecord(password));
        await scholar.save();
        // Force-logout every other session — the credential changed.
        await Session.deleteMany({ kind: 'scholar', principalId: scholar._id }).catch(() => {});
        audit(req, {
            action: 'scholar.password-reset.complete',
            actor: { kind: 'scholar', id: scholar._id, email: scholar.email },
            target: { kind: 'Scholar', id: scholar._id, label: scholar.email },
        });
        return res.json({ message: 'Password updated. Sign in with your new password.' });
    } catch (err) {
        next(err);
    }
});

// ----- Admin audit log viewer --------------------------------------------
app.get('/api/auth/admin/audit-log', requireAdminSession, validate(AuditLogQuerySchema, 'query'), async (req, res, next) => {
    try {
        const { action, actorEmail, outcome, limit, cursor } = req.query;
        const filter = {};
        if (action) filter.action = action;
        if (actorEmail) filter['actor.email'] = actorEmail;
        if (outcome) filter.outcome = outcome;
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!Number.isNaN(cursorDate.getTime())) {
                filter.createdAt = { $lt: cursorDate };
            }
        }
        const entries = await AuditLog
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit + 1)
            .lean();
        const hasMore = entries.length > limit;
        const items = hasMore ? entries.slice(0, limit) : entries;
        const nextCursor = hasMore && items.length
            ? items[items.length - 1].createdAt.toISOString()
            : null;
        return res.json({ items, nextCursor });
    } catch (err) {
        next(err);
    }
});

// ----- Public scholarship endpoints --------------------------------------
// Legacy: /api/scholarships returned the *applicants* list. We keep that
// shape for backward compatibility, and expose the new scholarships catalog
// under /api/scholarships/catalog.

app.get('/api/scholarships', async (req, res, next) => {
    try {
        const applications = await Application.find().sort({ createdAt: 1 });
        res.json(applications.map(toProfileApplication));
    } catch (err) {
        next(err);
    }
});

app.get('/api/scholarships/catalog', async (req, res, next) => {
    try {
        const items = await Scholarship.find({ active: true }).sort({ deadline: 1 });
        res.json(items);
    } catch (err) {
        next(err);
    }
});

// Personalised recommendations for the signed-in scholar. Ranks active,
// not-yet-closed scholarships against the scholar's linked Application
// (nationality / education level / bio interests). Returns a small array of
// `{ scholarship, score, matchPercent, reasons }` entries — never throws on
// missing profile data, just falls back to a generic recent list.
app.get(
    '/api/auth/student/recommendations',
    requireScholarSession,
    validate(RecommendationsQuerySchema, 'query'),
    async (req, res, next) => {
        try {
            const application = req.scholar.application
                ? await Application.findById(req.scholar.application)
                : null;
            const profile = {
                nationality: application ? application.nationality : '',
                education: application ? application.education : '',
                bio: application ? application.bio : '',
            };

            const candidates = await Scholarship.find({
                active: true,
                $or: [{ deadline: null }, { deadline: { $gte: new Date() } }],
            })
                .sort({ deadline: 1 })
                .limit(200)
                .lean();

            const ranked = rankScholarships(candidates, profile, req.query.limit);

            // If nothing scored above zero (e.g. brand-new scholar with no
            // profile data yet) fall back to the soonest upcoming items so the
            // UI never renders an empty rail.
            if (ranked.length === 0 && candidates.length) {
                const fallback = candidates.slice(0, req.query.limit).map((s) => ({
                    scholarship: s,
                    score: 0,
                    matchPercent: 0,
                    reasons: ['Recently added'],
                }));
                return res.json({ items: fallback, personalised: false });
            }

            return res.json({ items: ranked, personalised: Boolean(application) });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Saved / watchlist scholarships -------------------------------------
// Scholars can bookmark scholarships they're interested in. Stored as an array
// of Scholarship ObjectIds on the Scholar document. Toggling is idempotent:
// POST adds, DELETE removes, GET returns the populated list.

const mongoose = require('mongoose');

app.get(
    '/api/auth/student/saved',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const scholar = await Scholar.findById(req.scholar._id)
                .populate({
                    path: 'savedScholarships',
                    match: { active: true },
                })
                .lean();
            const items = Array.isArray(scholar?.savedScholarships)
                ? scholar.savedScholarships.filter(Boolean)
                : [];
            return res.json({ items, ids: items.map((s) => String(s._id)) });
        } catch (err) {
            next(err);
        }
    }
);

app.post(
    '/api/auth/student/saved/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(scholarshipId)) {
                return res.status(400).json({ message: 'Invalid scholarship id.' });
            }
            const exists = await Scholarship.exists({ _id: scholarshipId, active: true });
            if (!exists) {
                return res.status(404).json({ message: 'Scholarship not found.' });
            }
            await Scholar.updateOne(
                { _id: req.scholar._id },
                { $addToSet: { savedScholarships: scholarshipId } }
            );
            const updated = await Scholar.findById(req.scholar._id)
                .select('savedScholarships')
                .lean();
            return res.json({
                saved: true,
                ids: (updated?.savedScholarships || []).map((id) => String(id)),
            });
        } catch (err) {
            next(err);
        }
    }
);

app.delete(
    '/api/auth/student/saved/:scholarshipId',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const { scholarshipId } = req.params;
            if (!mongoose.Types.ObjectId.isValid(scholarshipId)) {
                return res.status(400).json({ message: 'Invalid scholarship id.' });
            }
            await Scholar.updateOne(
                { _id: req.scholar._id },
                { $pull: { savedScholarships: scholarshipId } }
            );
            const updated = await Scholar.findById(req.scholar._id)
                .select('savedScholarships')
                .lean();
            return res.json({
                saved: false,
                ids: (updated?.savedScholarships || []).map((id) => String(id)),
            });
        } catch (err) {
            next(err);
        }
    }
);

// ----- Notifications (shared scholar + admin) ------------------------------

// Reusable list handler — caller passes the recipient descriptor derived from
// either requireScholarSession (req.scholar) or requireAdminSession (req.admin).
const listNotifications = async (recipient, query) => {
    const filter = { 'recipient.kind': recipient.kind, 'recipient.id': recipient.id };
    if (query.unreadOnly) filter.readAt = null;
    const items = await Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(query.limit)
        .lean();
    const unread = await Notification.countDocuments({
        'recipient.kind': recipient.kind,
        'recipient.id': recipient.id,
        readAt: null,
    });
    return { items, unread };
};

app.get(
    '/api/auth/student/notifications',
    requireScholarSession,
    validate(NotificationListQuerySchema, 'query'),
    async (req, res, next) => {
        try {
            const payload = await listNotifications(
                { kind: 'scholar', id: req.scholar._id },
                req.query
            );
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

app.post(
    '/api/auth/student/notifications/:id/read',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const updated = await Notification.findOneAndUpdate(
                {
                    _id: req.params.id,
                    'recipient.kind': 'scholar',
                    'recipient.id': req.scholar._id,
                },
                { $set: { readAt: new Date() } },
                { returnDocument: 'after' }
            );
            if (!updated) return res.status(404).json({ message: 'Notification not found.' });
            res.json({ notification: updated });
        } catch (err) {
            next(err);
        }
    }
);

app.post(
    '/api/auth/student/notifications/read-all',
    requireScholarSession,
    async (req, res, next) => {
        try {
            const result = await Notification.updateMany(
                { 'recipient.kind': 'scholar', 'recipient.id': req.scholar._id, readAt: null },
                { $set: { readAt: new Date() } }
            );
            res.json({ modified: result.modifiedCount || 0 });
        } catch (err) {
            next(err);
        }
    }
);

app.get(
    '/api/auth/admin/notifications',
    requireAdminSession,
    validate(NotificationListQuerySchema, 'query'),
    async (req, res, next) => {
        try {
            const payload = await listNotifications(
                { kind: 'admin', id: req.admin._id },
                req.query
            );
            res.json(payload);
        } catch (err) {
            next(err);
        }
    }
);

app.post(
    '/api/auth/admin/notifications/:id/read',
    requireAdminSession,
    async (req, res, next) => {
        try {
            const updated = await Notification.findOneAndUpdate(
                {
                    _id: req.params.id,
                    'recipient.kind': 'admin',
                    'recipient.id': req.admin._id,
                },
                { $set: { readAt: new Date() } },
                { returnDocument: 'after' }
            );
            if (!updated) return res.status(404).json({ message: 'Notification not found.' });
            res.json({ notification: updated });
        } catch (err) {
            next(err);
        }
    }
);

app.post(
    '/api/auth/admin/notifications/read-all',
    requireAdminSession,
    async (req, res, next) => {
        try {
            const result = await Notification.updateMany(
                { 'recipient.kind': 'admin', 'recipient.id': req.admin._id, readAt: null },
                { $set: { readAt: new Date() } }
            );
            res.json({ modified: result.modifiedCount || 0 });
        } catch (err) {
            next(err);
        }
    }
);

app.post('/api/scholarships/catalog', requireAdminSession, async (req, res, next) => {
    try {
        const created = await Scholarship.create(req.body || {});

        // Fan-out: notify up to 100 scholars whose profile scores above zero
        // against the new scholarship. Async + best-effort; we never block the
        // admin's response on this.
        (async () => {
            try {
                const scholarsWithProfiles = await Scholar.find({ application: { $ne: null } })
                    .populate('application')
                    .limit(500)
                    .lean();
                let sent = 0;
                for (const s of scholarsWithProfiles) {
                    if (sent >= 100) break;
                    const app = s.application;
                    if (!app) continue;
                    const { score, reasons } = scoreScholarship(created, {
                        nationality: app.nationality,
                        education: app.education,
                        bio: app.bio,
                    });
                    if (score < 25) continue; // only ping clearly relevant matches
                    sent += 1;
                    await notify(
                        { kind: 'scholar', id: s._id },
                        {
                            kind: 'scholarship.new',
                            title: `New scholarship matches your profile: ${created.title}`,
                            body: reasons.slice(0, 2).join(' • '),
                            url: `/scholar/scholarships/${created._id}`,
                            data: { scholarshipId: String(created._id), score },
                        }
                    );
                }
            } catch (err) {
                logger.warn({ err: err && err.message }, 'scholarship.new fan-out failed');
            }
        })();

        res.status(201).json(created);
    } catch (err) {
        next(err);
    }
});

app.get('/api/scholarships/:id', async (req, res, next) => {
    try {
        const application = await findByEitherId(Application, req.params.id);
        if (!application) return res.status(404).json({ message: 'Student not found' });
        res.json(toProfileApplication(application));
    } catch (err) {
        next(err);
    }
});

app.post('/api/scholarships', async (req, res, next) => {
    try {
        const created = await Application.create(req.body || {});
        res.status(201).json(toProfileApplication(created));
    } catch (err) {
        next(err);
    }
});

// ---------------------------------------------------------------------------
// SPA static hosting (single-host deploy)
// ---------------------------------------------------------------------------
// When the Vite frontend is built into ../dist (Render / single-container
// deploy), serve it from the same Express process. Registered AFTER all
// /api/* and /healthz routes so it never shadows them, and BEFORE the
// error handler so the wildcard fallback only catches truly unmatched paths.
if (SERVE_SPA) {
    app.use(express.static(SPA_DIR, {
        index: false,
        maxAge: IS_PROD ? '1y' : 0,
        setHeaders: (res, filePath) => {
            // The HTML shell must never be cached — the asset hashes inside
            // it change every build and stale HTML would point at deleted JS.
            if (filePath.endsWith('.html') || filePath.endsWith('/sw.js')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
        },
    }));
    // SPA fallback for client-side routes (anything not under /api, /healthz,
    // /readyz, or /uploads). Express 5 accepts named regex params.
    app.get(/^\/(?!api\/|healthz|readyz|uploads\/).*/, (req, res) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(SPA_DIR, 'index.html'));
    });
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    // req.log is attached by pino-http; falls back to the global logger.
    const log = req.log || logger;
    const requestId = req.id;
    log.error(
        { err: { message: err.message, stack: err.stack }, url: req.url, requestId },
        'Unhandled error',
    );

    // T4.2 \u2014 forward to the configured error sink (Sentry when SENTRY_DSN
    // is set; no-op otherwise). Always include the request id so the entry
    // can be correlated with the structured log line above.
    captureException(err, {
        requestId,
        route: req.originalUrl || req.url,
        principal: req.principal
            ? { kind: req.principal.kind, id: req.principal.account?._id }
            : (req.admin
                ? { kind: 'admin', id: req.admin._id }
                : (req.scholar ? { kind: 'scholar', id: req.scholar._id } : undefined)),
        tags: { method: req.method },
    });

    if (res.headersSent) return;
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'File is too large (max 10 MB).', requestId });
        }
        return res.status(400).json({ message: err.message, requestId });
    }
    if (err && /Only PDF or image/.test(err.message || '')) {
        return res.status(400).json({ message: err.message, requestId });
    }
    if (err && /CORS/.test(err.message || '')) {
        return res.status(403).json({ message: 'CORS: origin not allowed.', requestId });
    }
    // Never leak stack traces or internal messages to clients in production.
    res.status(500).json({
        message: IS_PROD ? 'Internal server error.' : (err.message || 'Internal server error.'),
        requestId,
    });
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

// T4.3 — `startServer()` returns the HTTP server handle so the graceful
// shutdown helper can call `server.close()` to stop accepting new sockets
// while letting in-flight requests drain.
let httpServer = null;

const startServer = () => {
    httpServer = app.listen(PORT, () => {
        logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'ScholarshipZone API listening');
    });
    return httpServer;
};

// T4.3 — Graceful shutdown.
//
// Flow (triggered on SIGTERM / SIGINT, or via the exported helper from a
// supervisor):
//   1. Flip `shuttingDown = true` so /readyz starts returning 503 (the LB
//      drains us within its probe cycle, typically 5-15s).
//   2. Call `server.close()` so no new sockets are accepted.
//   3. Poll `inflightRequests` until it hits 0, then close Mongoose.
//   4. If the 25s grace timer expires first, log the holdout count and
//      force-exit so we don't block a Kubernetes pod from terminating.
//
// Tests do NOT register signal handlers (see `if (require.main === module)`
// below) so vitest's own SIGTERM doesn't trigger this path.
const SHUTDOWN_GRACE_MS = Number(process.env.SHUTDOWN_GRACE_MS || 25_000);
const SHUTDOWN_POLL_MS = 100;

const gracefulShutdown = async (reason = 'shutdown') => {
    if (shuttingDown) return; // idempotent
    shuttingDown = true;
    logger.info({ reason, inflight: inflightRequests }, 'graceful shutdown requested');

    if (httpServer) {
        httpServer.close((err) => {
            if (err) logger.warn({ err: err.message }, 'http server close error');
        });
    }

    const deadline = Date.now() + SHUTDOWN_GRACE_MS;
    while (inflightRequests > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, SHUTDOWN_POLL_MS));
    }
    if (inflightRequests > 0) {
        logger.warn({ inflight: inflightRequests }, 'shutdown grace timer elapsed with requests still in flight');
    }

    try {
        const mongoose = require('mongoose');
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close(false);
            logger.info('mongoose connection closed');
        }
    } catch (err) {
        logger.warn({ err: err.message }, 'mongoose close error');
    }

    logger.info({ reason }, 'shutdown complete');
    // Allow last log line to flush before exiting under PID 1 (Docker).
    setTimeout(() => process.exit(0), 50).unref();
};

const logMongoStartupFailure = (err) => {
    const message = String(err?.message || err || 'Unknown MongoDB connection error');
    logger.warn({ err: message }, 'Starting without MongoDB');

    if (!process.env.MONGODB_URI) {
        logger.warn('DB-backed endpoints will fail until MONGODB_URI is configured.');
        return;
    }

    if (/auth|authentication/i.test(message)) {
        logger.warn('DB-backed endpoints will fail until the MongoDB username/password in MONGODB_URI are corrected.');
        return;
    }

    logger.warn('DB-backed endpoints will fail until the MongoDB connection in MONGODB_URI succeeds.');
};

// First-deploy convenience: if the Admin collection is empty and the
// ADMIN_EMAIL / ADMIN_PASSWORD env vars are set, seed a single bootstrap
// admin so the operator can sign in immediately. No-op once any admin
// exists, so it's safe to leave the env vars set across restarts.
const ensureBootstrapAdmin = async () => {
    const email = normalizeEmail(process.env.ADMIN_EMAIL || '');
    const password = process.env.ADMIN_PASSWORD || '';
    if (!email || !password) return;

    const existing = await Admin.estimatedDocumentCount();
    if (existing > 0) return;

    if (!isValidEmail(email) || !isValidPassword(password)) {
        logger.warn('ADMIN_EMAIL / ADMIN_PASSWORD set but invalid; skipping bootstrap admin.');
        return;
    }

    await Admin.create({
        name: process.env.ADMIN_NAME || 'Bootstrap Admin',
        email,
        role: 'administrator',
        department: process.env.ADMIN_DEPARTMENT || 'Operations',
        departmentCode: process.env.ADMIN_DEPARTMENT_CODE || crypto.randomBytes(6).toString('hex').toUpperCase(),
        twoFactorCode: process.env.ADMIN_TWO_FACTOR_CODE || crypto.randomInt(100000, 999999).toString(),
        ...createPasswordRecord(password),
    });
    logger.info({ email }, 'bootstrap admin created');
};

// Only start the HTTP listener when run directly (e.g. `node index.js` or
// `npm start`). When the file is `require()`'d (e.g. from a Supertest test
// suite), we export the configured express `app` and a `boot()` helper
// instead, so tests can drive requests in-process.
if (require.main === module) {
    connectDb()
        .then(() => ensureBootstrapAdmin().catch((err) => {
            logger.warn({ err: err.message }, 'bootstrap admin seed failed');
        }))
        .then(() => startServer())
        .catch((err) => {
            logMongoStartupFailure(err);
            startServer();
        });

    // T4.3 — Register graceful-shutdown signal handlers ONLY in the
    // standalone-process branch. Tests import this file and we must NOT
    // intercept vitest's own SIGTERM. `once()` so a second Ctrl+C still
    // hard-kills the process (escape hatch).
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = {
    app,
    logger,
    connectDb,
    startServer,
    gracefulShutdown,
};
