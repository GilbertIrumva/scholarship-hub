require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const cors = require('cors');

const { connectDb } = require('./db/connect');
const { Admin, Scholar, Application, Scholarship, ScholarshipApplication, ContactMessage } = require('./db/models');
const { sendEmail } = require('./mailer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
