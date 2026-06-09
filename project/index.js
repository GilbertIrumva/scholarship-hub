require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');

const { connectDb } = require('./db/connect');
const { Admin, Scholar, Application, Scholarship, ScholarshipApplication, ContactMessage, AcademicCredential, TravelDocument, VisaWorkflow } = require('./db/models');
const { sendEmail } = require('./mailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// File-upload setup (Phase 4: AcademicCredential vault)
// ---------------------------------------------------------------------------
const UPLOADS_ROOT = path.resolve(__dirname, 'uploads');
const CREDENTIALS_ROOT = path.join(UPLOADS_ROOT, 'credentials');
if (!fs.existsSync(CREDENTIALS_ROOT)) {
    fs.mkdirSync(CREDENTIALS_ROOT, { recursive: true });
}

const credentialStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const scholarId = req.scholar && String(req.scholar._id);
        if (!scholarId) return cb(new Error('No scholar bound to request.'));
        const dir = path.join(CREDENTIALS_ROOT, scholarId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase().slice(0, 8);
        const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
        cb(null, unique);
    },
});

const CREDENTIAL_ALLOWED_MIME = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
]);

const uploadCredential = multer({
    storage: credentialStorage,
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

const travelStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const scholarId = req.scholar && String(req.scholar._id);
        if (!scholarId) return cb(new Error('No scholar bound to request.'));
        const dir = path.join(TRAVEL_DOCS_ROOT, scholarId);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeExt = path.extname(file.originalname).toLowerCase().slice(0, 8);
        const unique = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt}`;
        cb(null, unique);
    },
});

const uploadTravelDoc = multer({
    storage: travelStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!CREDENTIAL_ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error('Only PDF or image files (jpg, png, webp, heic) are allowed.'));
        }
        cb(null, true);
    },
});

// Derive a 32-byte AES key from the TRAVEL_DOC_SECRET env var.
// In production this MUST be set to a long random string.
const TRAVEL_DOC_SECRET = process.env.TRAVEL_DOC_SECRET
    || 'dev-only-travel-doc-secret-please-set-TRAVEL_DOC_SECRET-in-prod';
if (TRAVEL_DOC_SECRET.startsWith('dev-only')) {
    console.warn('[api] TRAVEL_DOC_SECRET not set — using insecure dev fallback. Set it in production.');
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
        console.warn('[api] Failed to decrypt travel-doc number:', err.message);
        return '';
    }
};

// ---------------------------------------------------------------------------
// In-memory auth state (challenges & session tokens). Persisted state lives
// in MongoDB; only ephemeral, short-lived tokens are kept in memory.
// ---------------------------------------------------------------------------
const pendingAdminChallenges = new Map();
const adminSessions = new Map();
const scholarSessions = new Map();

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 60 * 60 * 1000;

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
    const candidate = hashPassword(password, record.passwordSalt);
    return safeEqual(candidate, record.passwordHash);
};

const cleanupExpiredEntries = (store) => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
        if (value.expiresAt <= now) store.delete(key);
    }
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
        cleanupExpiredEntries(adminSessions);
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Admin session is required.' });
        }
        const session = adminSessions.get(token);
        if (!session) {
            return res.status(401).json({ message: 'Admin session is invalid or expired.' });
        }
        const admin = await Admin.findById(session.adminId);
        if (!admin) {
            adminSessions.delete(token);
            return res.status(401).json({ message: 'Admin account was not found.' });
        }
        req.admin = admin;
        req.sessionToken = token;
        return next();
    } catch (err) {
        return next(err);
    }
};

const requireScholarSession = async (req, res, next) => {
    try {
        cleanupExpiredEntries(scholarSessions);
        const [scheme, token] = (req.headers.authorization || '').split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ message: 'Scholar session is required.' });
        }
        const session = scholarSessions.get(token);
        if (!session) {
            return res.status(401).json({ message: 'Scholar session is invalid or expired.' });
        }
        const scholar = await Scholar.findById(session.scholarId);
        if (!scholar) {
            scholarSessions.delete(token);
            return res.status(401).json({ message: 'Scholar account was not found.' });
        }
        req.scholar = scholar;
        req.sessionToken = token;
        return next();
    } catch (err) {
        return next(err);
    }
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get('/', (req, res) => res.send('ScholarshipZone API is running!'));

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
        const { country, grade, field, q, limit } = req.query;
        const filter = { active: true };
        if (country) filter.countries = { $in: [country] };
        if (grade) filter.grades = { $in: [grade] };
        if (field) filter.fields = { $in: [field] };
        if (q) {
            const rx = new RegExp(String(q).trim(), 'i');
            filter.$or = [{ title: rx }, { description: rx }, { provider: rx }];
        }
        const cap = Math.min(Number(limit) || 12, 50);
        const items = await Scholarship.find(filter).sort({ deadline: 1 }).limit(cap);
        res.json({ count: items.length, items });
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

app.post('/api/public/contact', async (req, res, next) => {
    const { name, email, topic, message } = req.body || {};
    const trimmedName = String(name || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedTopic = String(topic || 'general').trim().slice(0, 40);
    const trimmedMessage = String(message || '').trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
        return res.status(400).json({ message: 'Name, email, and message are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        return res.status(400).json({ message: 'Enter a valid email address.' });
    }
    if (trimmedMessage.length > CONTACT_MAX_LEN) {
        return res.status(413).json({ message: 'Message is too long.' });
    }

    try {
        const doc = await ContactMessage.create({
            name: trimmedName,
            email: trimmedEmail,
            topic: trimmedTopic,
            message: trimmedMessage,
            ipAddress: (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString(),
            userAgent: (req.headers['user-agent'] || '').toString().slice(0, 500),
        });
        console.log('[contact] New message stored', { id: doc._id.toString(), email: trimmedEmail });
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
app.post('/api/auth/admin/sign-in', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        const admin = await Admin.findOne({ email: normalizeEmail(email) });
        if (!admin || !verifyPassword(password, admin)) {
            return res.status(401).json({ message: 'Invalid admin email or password.' });
        }
        cleanupExpiredEntries(pendingAdminChallenges);
        const challengeId = crypto.randomUUID();
        const expiresAt = Date.now() + CHALLENGE_TTL_MS;
        pendingAdminChallenges.set(challengeId, { adminId: admin._id.toString(), expiresAt });
        return res.json({
            challengeId,
            expiresAt,
            admin: toPublicAdmin(admin),
            verificationHint: `Enter the department code or 2FA code for ${admin.department}.`,
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/admin/verify', async (req, res, next) => {
    try {
        const { challengeId, verificationCode } = req.body || {};
        if (!challengeId || !verificationCode) {
            return res.status(400).json({ message: 'Challenge id and verification code are required.' });
        }
        cleanupExpiredEntries(pendingAdminChallenges);
        const challenge = pendingAdminChallenges.get(challengeId);
        if (!challenge) {
            return res.status(410).json({ message: 'Verification challenge expired. Sign in again.' });
        }
        const admin = await Admin.findById(challenge.adminId);
        if (!admin) {
            pendingAdminChallenges.delete(challengeId);
            return res.status(404).json({ message: 'Admin account was not found.' });
        }
        const normalizedCode = String(verificationCode).trim();
        const validCode =
            normalizedCode === admin.departmentCode || normalizedCode === admin.twoFactorCode;
        if (!validCode) {
            return res.status(401).json({ message: 'Invalid department or 2FA code.' });
        }
        pendingAdminChallenges.delete(challengeId);
        cleanupExpiredEntries(adminSessions);
        const sessionToken = crypto.randomUUID();
        adminSessions.set(sessionToken, {
            adminId: admin._id.toString(),
            expiresAt: Date.now() + SESSION_TTL_MS,
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
app.post('/api/auth/student/sign-in', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }
        const scholar = await Scholar.findOne({ email: normalizeEmail(email) });
        if (!scholar || !verifyPassword(password, scholar)) {
            return res.status(401).json({ message: 'Invalid scholar email or password.' });
        }
        cleanupExpiredEntries(scholarSessions);
        const sessionToken = crypto.randomUUID();
        scholarSessions.set(sessionToken, {
            scholarId: scholar._id.toString(),
            expiresAt: Date.now() + SESSION_TTL_MS,
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
        status: entry.status,
        decisionNote: entry.decisionNote || '',
        decidedAt: entry.decidedAt,
        submittedAt: entry.createdAt,
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
        if (existing) {
            return res.status(409).json({
                message: 'You have already applied to this scholarship.',
                application: serializeScholarshipApplication(existing),
            });
        }

        const created = await ScholarshipApplication.create({
            scholar: req.scholar._id,
            scholarship: scholarship._id,
            motivation: trimmedMotivation,
        });
        const populated = await created.populate('scholarship');
        return res.status(201).json({ application: serializeScholarshipApplication(populated) });
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
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ message: 'Unknown credential type.' });
            }
            const trimmedTitle = String(title || '').trim();
            if (!trimmedTitle) {
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ message: 'A title is required.' });
            }

            const yearNum = issuedYear ? Number(issuedYear) : null;
            if (issuedYear && (!Number.isFinite(yearNum) || yearNum < 1950 || yearNum > 2100)) {
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ message: 'Issued year must be between 1950 and 2100.' });
            }

            const created = await AcademicCredential.create({
                scholar: req.scholar._id,
                type,
                title: trimmedTitle.slice(0, 200),
                country: String(country || '').trim().toUpperCase().slice(0, 3),
                issuingBody: String(issuingBody || '').trim().slice(0, 200),
                issuedYear: yearNum,
                originalName: req.file.originalname.slice(0, 300),
                storagePath: req.file.path,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
                gradeConversion: parseGradeConversionField(gradeConversion) || undefined,
            });
            return res.status(201).json({ credential: serializeCredential(created) });
        } catch (err) {
            if (req.file) fs.unlink(req.file.path, () => {});
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
            if (!fs.existsSync(entry.storagePath)) {
                return res.status(410).json({ message: 'File is no longer available.' });
            }
            res.setHeader('Content-Type', entry.mimeType);
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${entry.originalName.replace(/"/g, '')}"`
            );
            fs.createReadStream(entry.storagePath).pipe(res);
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
            const filePath = entry.storagePath;
            await entry.deleteOne();
            fs.unlink(filePath, () => {});
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
            if (!fs.existsSync(entry.storagePath)) {
                return res.status(410).json({ message: 'File is no longer available.' });
            }
            res.setHeader('Content-Type', entry.mimeType);
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${entry.originalName.replace(/"/g, '')}"`
            );
            fs.createReadStream(entry.storagePath).pipe(res);
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
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ message: 'Unknown travel-document type.' });
            }
            const trimmedTitle = String(title || '').trim();
            if (!trimmedTitle) {
                fs.unlink(req.file.path, () => {});
                return res.status(400).json({ message: 'A title is required.' });
            }

            const issued = parseDateOrNull(issuedDate);
            const expiry = parseDateOrNull(expiryDate);

            const plainNumber = String(documentNumber || '').trim();
            const encrypted = encryptDocNumber(plainNumber);
            const last4 = plainNumber.length >= 4
                ? plainNumber.slice(-4)
                : plainNumber;

            const created = await TravelDocument.create({
                scholar: req.scholar._id,
                type,
                title: trimmedTitle.slice(0, 200),
                country: String(country || '').trim().toUpperCase().slice(0, 3),
                documentNumberEncrypted: encrypted,
                documentNumberLast4: last4,
                issuedDate: issued,
                expiryDate: expiry,
                originalName: req.file.originalname.slice(0, 300),
                storagePath: req.file.path,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size,
            });
            return res.status(201).json({
                document: {
                    ...serializeTravelDoc(created, { revealNumber: true }),
                    downloadUrl: `/api/auth/student/travel-docs/${created._id}/download`,
                },
            });
        } catch (err) {
            if (req.file) fs.unlink(req.file.path, () => {});
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
            if (!fs.existsSync(entry.storagePath)) {
                return res.status(410).json({ message: 'File is no longer available.' });
            }
            res.setHeader('Content-Type', entry.mimeType);
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${entry.originalName.replace(/"/g, '')}"`
            );
            fs.createReadStream(entry.storagePath).pipe(res);
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
            const filePath = entry.storagePath;
            await entry.deleteOne();
            fs.unlink(filePath, () => {});
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

            if (!fs.existsSync(entry.storagePath)) {
                return res.status(410).json({ message: 'File is no longer available.' });
            }
            res.setHeader('Content-Type', entry.mimeType);
            res.setHeader(
                'Content-Disposition',
                `inline; filename="${entry.originalName.replace(/"/g, '')}"`
            );
            fs.createReadStream(entry.storagePath).pipe(res);
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
app.post('/api/auth/student/sign-up', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};
        const trimmedName = String(name || '').trim();
        const normalizedEmail = normalizeEmail(email);

        if (!trimmedName) return res.status(400).json({ message: 'Scholar name is required.' });
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ message: 'Enter a valid scholar email address.' });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
        }

        const existing = await Scholar.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({ message: 'A scholar account with this email already exists.' });
        }

        const passwordRecord = createPasswordRecord(password);
        const newScholar = await Scholar.create({
            name: trimmedName,
            email: normalizedEmail,
            role: 'student',
            application: null,
            ...passwordRecord,
        });

        cleanupExpiredEntries(scholarSessions);
        const sessionToken = crypto.randomUUID();
        scholarSessions.set(sessionToken, {
            scholarId: newScholar._id.toString(),
            expiresAt: Date.now() + SESSION_TTL_MS,
        });

        return res.status(201).json({
            message: 'Scholar account created.',
            sessionToken,
            scholar: toPublicScholar(newScholar),
        });
    } catch (err) {
        next(err);
    }
});

app.post('/api/auth/admin/sign-up', async (req, res, next) => {
    try {
        const {
            name,
            email,
            password,
            department,
            departmentCode,
            twoFactorCode,
            inviteCode,
        } = req.body || {};

        const trimmedName = String(name || '').trim();
        const normalizedEmail = normalizeEmail(email);
        const trimmedDepartment = String(department || '').trim();
        const trimmedDepartmentCode = String(departmentCode || '').trim();
        const trimmedTwoFactorCode = String(twoFactorCode || '').trim();
        const trimmedInviteCode = String(inviteCode || '').trim();

        if (!trimmedName) return res.status(400).json({ message: 'Admin name is required.' });
        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({ message: 'Enter a valid admin email address.' });
        }
        if (!normalizedEmail.endsWith('@schooladmin.com')) {
            return res.status(400).json({ message: 'Admin email must use the @schooladmin.com domain.' });
        }
        if (!isValidPassword(password)) {
            return res.status(400).json({ message: 'Admin password must be at least 8 characters.' });
        }
        if (!trimmedDepartment) return res.status(400).json({ message: 'Department is required.' });
        if (!trimmedDepartmentCode) return res.status(400).json({ message: 'Department code is required.' });
        if (!trimmedTwoFactorCode) return res.status(400).json({ message: '2FA code is required.' });
        if (!trimmedInviteCode) return res.status(400).json({ message: 'An admin invite code is required.' });

        const inviteAdmin = await Admin.findOne({
            $or: [{ departmentCode: trimmedInviteCode }, { twoFactorCode: trimmedInviteCode }],
        });
        if (!inviteAdmin) return res.status(401).json({ message: 'Invalid admin invite code.' });

        const dup = await Admin.findOne({ email: normalizedEmail });
        if (dup) return res.status(409).json({ message: 'An admin with this email already exists.' });

        const newAdmin = await Admin.create({
            name: trimmedName,
            email: normalizedEmail,
            role: 'administrator',
            department: trimmedDepartment,
            departmentCode: trimmedDepartmentCode,
            twoFactorCode: trimmedTwoFactorCode,
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

app.post('/api/scholarships/catalog', requireAdminSession, async (req, res, next) => {
    try {
        const created = await Scholarship.create(req.body || {});
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
// Error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
    console.error('[api] Unhandled error:', err);
    if (res.headersSent) return;
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'File is too large (max 10 MB).' });
        }
        return res.status(400).json({ message: err.message });
    }
    if (err && /Only PDF or image/.test(err.message || '')) {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Internal server error.' });
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

const startServer = () => {
    app.listen(PORT, () => {
        console.log(`[api] ScholarshipZone API listening on http://localhost:${PORT}`);
    });
};

const logMongoStartupFailure = (err) => {
    const message = String(err?.message || err || 'Unknown MongoDB connection error');
    console.warn('[api] Starting without MongoDB:', message);

    if (!process.env.MONGODB_URI) {
        console.warn('[api] DB-backed endpoints will fail until MONGODB_URI is configured.');
        return;
    }

    if (/auth|authentication/i.test(message)) {
        console.warn('[api] DB-backed endpoints will fail until the MongoDB username/password in MONGODB_URI are corrected.');
        return;
    }

    console.warn('[api] DB-backed endpoints will fail until the MongoDB connection in MONGODB_URI succeeds.');
};

connectDb()
    .then(() => startServer())
    .catch((err) => {
        logMongoStartupFailure(err);
        startServer();
    });
