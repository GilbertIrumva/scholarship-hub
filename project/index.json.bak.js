const crypto = require('crypto');
const express = require('express');
const app = express();
const cors = require('cors');
const fs = require('fs');
const path = require('path');

app.use(cors());

const DB_PATH = path.join(__dirname, 'db.json');
const pendingAdminChallenges = new Map();
const adminSessions = new Map();
const scholarSessions = new Map();

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 60 * 60 * 1000;

const readDb = () => {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
};

const writeDb = (db) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
};

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const hashPassword = (password, salt) => (
    crypto.scryptSync(String(password), salt, 32).toString('base64')
);

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

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyPassword = (password, admin) => {
    const candidateHash = hashPassword(password, admin.passwordSalt);
    return safeEqual(candidateHash, admin.passwordHash);
};

const cleanupExpiredEntries = (store) => {
    const now = Date.now();

    for (const [key, value] of store.entries()) {
        if (value.expiresAt <= now) {
            store.delete(key);
        }
    }
};

const toPublicAdmin = (admin) => ({
    id: admin.id,
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
    id: scholar.id,
    name: scholar.name,
    email: scholar.email,
    role: scholar.role,
});

const toEditableScholar = (scholar) => ({
    ...toPublicScholar(scholar),
    applicationId: scholar.applicationId || null,
});

const buildDashboardSummary = (admin, applicants) => {
    const totalApplicants = applicants.length;
    const graduateApplicants = applicants.filter((applicant) => (
        String(applicant.status || '').toLowerCase().includes('graduate')
        || String(applicant.education || '').toLowerCase().includes('master')
    )).length;
    const averageAge = totalApplicants
        ? Math.round(applicants.reduce((sum, applicant) => sum + Number(applicant.age || 0), 0) / totalApplicants)
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
        .map((applicant) => ({
            id: applicant.id,
            name: applicant.name,
            nationality: applicant.nationality,
            status: applicant.status,
            education: applicant.education || 'Not supplied',
            age: applicant.age,
            contact: applicant.contact,
        })),
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

const toProfileApplication = (application) => {
    if (!application) return null;
    return {
        id: application.id,
        name: application.name,
        nationality: application.nationality || '',
        status: application.status || '',
        education: application.education || 'Not supplied',
        contact: application.contact || '',
        age: application.age || null,
        gender: application.gender || '',
        dateOfBirth: application.dateOfBirth || '',
        address: application.address || '',
        bio: application.bio || '',
        photo: application.photo || '',
    };
};

const buildScholarProfilePayload = (scholar, application) => ({
    scholar: toPublicScholar(scholar),
    application: toProfileApplication(application),
});

const requireAdminSession = (req, res, next) => {
    cleanupExpiredEntries(adminSessions);

    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Admin session is required.' });
    }

    const session = adminSessions.get(token);

    if (!session) {
        return res.status(401).json({ message: 'Admin session is invalid or expired.' });
    }

    const db = readDb();
    const admin = (db.admins || []).find((entry) => entry.id === session.adminId);

    if (!admin) {
        adminSessions.delete(token);
        return res.status(401).json({ message: 'Admin account was not found.' });
    }

    req.admin = admin;
    req.sessionToken = token;
    return next();
};

const requireScholarSession = (req, res, next) => {
    cleanupExpiredEntries(scholarSessions);

    const authorization = req.headers.authorization || '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: 'Scholar session is required.' });
    }

    const session = scholarSessions.get(token);

    if (!session) {
        return res.status(401).json({ message: 'Scholar session is invalid or expired.' });
    }

    const db = readDb();
    const scholar = (db.scholarAccounts || []).find((entry) => entry.id === session.scholarId);

    if (!scholar) {
        scholarSessions.delete(token);
        return res.status(401).json({ message: 'Scholar account was not found.' });
    }

    req.scholar = scholar;
    req.sessionToken = token;
    return next();
};

app.use(express.json({ limit: '10mb' }));


app.get('/', (req, res) => res.send('Scholarship API is running!'));

app.post('/api/auth/admin/sign-in', (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = readDb();
    const admin = (db.admins || []).find((entry) => normalizeEmail(entry.email) === normalizeEmail(email));

    if (!admin || !verifyPassword(password, admin)) {
        return res.status(401).json({ message: 'Invalid admin email or password.' });
    }

    cleanupExpiredEntries(pendingAdminChallenges);

    const challengeId = crypto.randomUUID();
    const expiresAt = Date.now() + CHALLENGE_TTL_MS;

    pendingAdminChallenges.set(challengeId, {
        adminId: admin.id,
        expiresAt,
    });

    return res.json({
        challengeId,
        expiresAt,
        admin: toPublicAdmin(admin),
        verificationHint: `Enter the department code or 2FA code for ${admin.department}.`,
    });
});

app.post('/api/auth/admin/verify', (req, res) => {
    const { challengeId, verificationCode } = req.body || {};

    if (!challengeId || !verificationCode) {
        return res.status(400).json({ message: 'Challenge id and verification code are required.' });
    }

    cleanupExpiredEntries(pendingAdminChallenges);

    const challenge = pendingAdminChallenges.get(challengeId);

    if (!challenge) {
        return res.status(410).json({ message: 'Verification challenge expired. Sign in again.' });
    }

    const db = readDb();
    const admin = (db.admins || []).find((entry) => entry.id === challenge.adminId);

    if (!admin) {
        pendingAdminChallenges.delete(challengeId);
        return res.status(404).json({ message: 'Admin account was not found.' });
    }

    const normalizedCode = String(verificationCode).trim();
    const validCode = normalizedCode === admin.departmentCode || normalizedCode === admin.twoFactorCode;

    if (!validCode) {
        return res.status(401).json({ message: 'Invalid department or 2FA code.' });
    }

    pendingAdminChallenges.delete(challengeId);
    cleanupExpiredEntries(adminSessions);

    const sessionToken = crypto.randomUUID();
    adminSessions.set(sessionToken, {
        adminId: admin.id,
        expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return res.json({
        message: 'Admin verification complete.',
        sessionToken,
        admin: toPublicAdmin(admin),
    });
});

app.get('/api/auth/admin/dashboard', requireAdminSession, (req, res) => {
    const db = readDb();
    const applicants = db.scholarShip || [];

    return res.json(buildDashboardPayload(req.admin, applicants));
});

app.get('/api/auth/admin/settings', requireAdminSession, (req, res) => {
    const db = readDb();
    const scholar = (db.scholarAccounts || [])[0] || null;

    return res.json({
        admin: toEditableAdmin(req.admin),
        scholar: scholar ? toEditableScholar(scholar) : null,
    });
});

app.put('/api/auth/admin/settings', requireAdminSession, (req, res) => {
    const { admin: adminInput = {}, scholar: scholarInput = {} } = req.body || {};
    const hasAdminUpdate = Object.keys(adminInput).length > 0;
    const hasScholarUpdate = Object.keys(scholarInput).length > 0;

    if (!hasAdminUpdate && !hasScholarUpdate) {
        return res.status(400).json({ message: 'No credential updates were provided.' });
    }

    const db = readDb();
    const adminIndex = (db.admins || []).findIndex((entry) => entry.id === req.admin.id);
    const scholarIndex = Array.isArray(db.scholarAccounts) ? 0 : -1;

    if (adminIndex === -1) {
        return res.status(404).json({ message: 'Admin account was not found.' });
    }

    if (hasScholarUpdate && scholarIndex === -1) {
        return res.status(404).json({ message: 'Scholar account was not found.' });
    }

    const nextAdmin = { ...db.admins[adminIndex] };
    const nextScholar = scholarIndex === -1 ? null : { ...db.scholarAccounts[scholarIndex] };

    if (hasAdminUpdate) {
        if (Object.prototype.hasOwnProperty.call(adminInput, 'name')) {
            const name = String(adminInput.name || '').trim();

            if (!name) {
                return res.status(400).json({ message: 'Admin name is required.' });
            }

            nextAdmin.name = name;
        }

        if (Object.prototype.hasOwnProperty.call(adminInput, 'email')) {
            const email = normalizeEmail(adminInput.email);

            if (!isValidEmail(email)) {
                return res.status(400).json({ message: 'Enter a valid admin email address.' });
            }

            if (!email.endsWith('@schooladmin.com')) {
                return res.status(400).json({ message: 'Admin email must use the @schooladmin.com domain.' });
            }

            nextAdmin.email = email;
        }

        if (Object.prototype.hasOwnProperty.call(adminInput, 'department')) {
            const department = String(adminInput.department || '').trim();

            if (!department) {
                return res.status(400).json({ message: 'Admin department is required.' });
            }

            nextAdmin.department = department;
        }

        if (Object.prototype.hasOwnProperty.call(adminInput, 'departmentCode')) {
            const departmentCode = String(adminInput.departmentCode || '').trim();

            if (!departmentCode) {
                return res.status(400).json({ message: 'Department code is required.' });
            }

            nextAdmin.departmentCode = departmentCode;
        }

        if (Object.prototype.hasOwnProperty.call(adminInput, 'twoFactorCode')) {
            const twoFactorCode = String(adminInput.twoFactorCode || '').trim();

            if (!twoFactorCode) {
                return res.status(400).json({ message: '2FA code is required.' });
            }

            nextAdmin.twoFactorCode = twoFactorCode;
        }

        if (Object.prototype.hasOwnProperty.call(adminInput, 'password')) {
            const password = String(adminInput.password || '').trim();

            if (password && !isValidPassword(password)) {
                return res.status(400).json({ message: 'Admin password must be at least 8 characters.' });
            }

            if (password) {
                Object.assign(nextAdmin, createPasswordRecord(password));
            }
        }
    }

    if (hasScholarUpdate && nextScholar) {
        if (Object.prototype.hasOwnProperty.call(scholarInput, 'name')) {
            const name = String(scholarInput.name || '').trim();

            if (!name) {
                return res.status(400).json({ message: 'Scholar name is required.' });
            }

            nextScholar.name = name;
        }

        if (Object.prototype.hasOwnProperty.call(scholarInput, 'email')) {
            const email = normalizeEmail(scholarInput.email);

            if (!isValidEmail(email)) {
                return res.status(400).json({ message: 'Enter a valid scholar email address.' });
            }

            nextScholar.email = email;
        }

        if (Object.prototype.hasOwnProperty.call(scholarInput, 'password')) {
            const password = String(scholarInput.password || '').trim();

            if (password && !isValidPassword(password)) {
                return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
            }

            if (password) {
                Object.assign(nextScholar, createPasswordRecord(password));
            }
        }
    }

    if (nextScholar && nextAdmin.email === nextScholar.email) {
        return res.status(400).json({ message: 'Admin and scholar emails must be different.' });
    }

    db.admins[adminIndex] = nextAdmin;

    if (nextScholar) {
        db.scholarAccounts[scholarIndex] = nextScholar;
    }

    writeDb(db);

    return res.json({
        message: 'Credentials updated successfully.',
        admin: toEditableAdmin(nextAdmin),
        scholar: nextScholar ? toEditableScholar(nextScholar) : null,
    });
});

app.get('/api/auth/admin/scholars', requireAdminSession, (req, res) => {
    const db = readDb();
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];

    return res.json({
        scholars: scholars.map(toEditableScholar),
    });
});

app.put('/api/auth/admin/scholars/:id', requireAdminSession, (req, res) => {
    const scholarId = Number(req.params.id);
    const input = req.body || {};

    if (!Number.isFinite(scholarId)) {
        return res.status(400).json({ message: 'A valid scholar id is required.' });
    }

    const db = readDb();
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];
    const index = scholars.findIndex((entry) => Number(entry.id) === scholarId);

    if (index === -1) {
        return res.status(404).json({ message: 'Scholar account was not found.' });
    }

    const next = { ...scholars[index] };

    if (Object.prototype.hasOwnProperty.call(input, 'name')) {
        const name = String(input.name || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'Scholar name is required.' });
        }
        next.name = name;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'email')) {
        const email = normalizeEmail(input.email);
        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Enter a valid scholar email address.' });
        }
        if (scholars.some((entry, i) => i !== index && normalizeEmail(entry.email) === email)) {
            return res.status(409).json({ message: 'Another scholar already uses this email.' });
        }
        next.email = email;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'password')) {
        const password = String(input.password || '').trim();
        if (password) {
            if (!isValidPassword(password)) {
                return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
            }
            Object.assign(next, createPasswordRecord(password));
        }
    }

    db.scholarAccounts[index] = next;
    writeDb(db);

    return res.json({
        message: 'Scholar credentials updated.',
        scholar: toEditableScholar(next),
    });
});

app.delete('/api/auth/admin/scholars/:id', requireAdminSession, (req, res) => {
    const scholarId = Number(req.params.id);

    if (!Number.isFinite(scholarId)) {
        return res.status(400).json({ message: 'A valid scholar id is required.' });
    }

    const db = readDb();
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];
    const index = scholars.findIndex((entry) => Number(entry.id) === scholarId);

    if (index === -1) {
        return res.status(404).json({ message: 'Scholar account was not found.' });
    }

    db.scholarAccounts = scholars.filter((_, i) => i !== index);
    writeDb(db);

    return res.json({ message: 'Scholar account removed.', scholarId });
});

app.post('/api/auth/student/sign-in', (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const db = readDb();
    const scholar = (db.scholarAccounts || []).find((entry) => normalizeEmail(entry.email) === normalizeEmail(email));

    if (!scholar || !verifyPassword(password, scholar)) {
        return res.status(401).json({ message: 'Invalid scholar email or password.' });
    }

    cleanupExpiredEntries(scholarSessions);

    const sessionToken = crypto.randomUUID();
    scholarSessions.set(sessionToken, {
        scholarId: scholar.id,
        expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return res.json({
        message: 'Scholar sign-in complete.',
        sessionToken,
        scholar: toPublicScholar(scholar),
    });
});

app.get('/api/auth/student/profile', requireScholarSession, (req, res) => {
    const db = readDb();
    const application = (db.scholarShip || []).find((entry) => entry.id === req.scholar.applicationId) || null;

    return res.json(buildScholarProfilePayload(req.scholar, application));
});

app.put('/api/auth/student/profile', requireScholarSession, (req, res) => {
    const input = req.body || {};
    const db = readDb();
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];
    const applicants = Array.isArray(db.scholarShip) ? db.scholarShip : [];
    const scholarIndex = scholars.findIndex((entry) => entry.id === req.scholar.id);

    if (scholarIndex === -1) {
        return res.status(404).json({ message: 'Scholar account was not found.' });
    }

    const scholar = { ...scholars[scholarIndex] };
    let applicationIndex = applicants.findIndex((entry) => entry.id === scholar.applicationId);
    let application;

    if (applicationIndex === -1) {
        const nextId = applicants.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1;
        application = { id: nextId, name: scholar.name };
        applicants.push(application);
        applicationIndex = applicants.length - 1;
        scholar.applicationId = nextId;
    } else {
        application = { ...applicants[applicationIndex] };
    }

    for (const field of PROFILE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
            const value = input[field];
            if (field === 'age') {
                application.age = value === '' || value === null || value === undefined ? null : Number(value);
            } else {
                application[field] = value == null ? '' : String(value);
            }
        }
    }

    if (application.name && application.name !== scholar.name) {
        scholar.name = application.name;
    }

    applicants[applicationIndex] = application;
    scholars[scholarIndex] = scholar;
    db.scholarAccounts = scholars;
    db.scholarShip = applicants;
    writeDb(db);

    return res.json(buildScholarProfilePayload(scholar, application));
});

app.get('/api/auth/admin/applicants', requireAdminSession, (req, res) => {
    const db = readDb();
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];
    const applicants = (db.scholarShip || []).map((entry) => {
        const linkedAccount = scholars.find((s) => s.applicationId === entry.id);
        return {
            ...toProfileApplication(entry),
            email: linkedAccount?.email || '',
            scholarAccountId: linkedAccount?.id || null,
        };
    });

    return res.json({ applicants });
});

app.get('/api/auth/admin/applicants/:id', requireAdminSession, (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
        return res.status(400).json({ message: 'A valid applicant id is required.' });
    }
    const db = readDb();
    const application = (db.scholarShip || []).find((entry) => Number(entry.id) === id);
    if (!application) {
        return res.status(404).json({ message: 'Applicant not found.' });
    }
    const scholars = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];
    const linkedAccount = scholars.find((s) => s.applicationId === id) || null;

    return res.json({
        applicant: {
            ...toProfileApplication(application),
            email: linkedAccount?.email || '',
            scholarAccountId: linkedAccount?.id || null,
        },
    });
});

app.post('/api/auth/student/sign-up', (req, res) => {
    const { name, email, password } = req.body || {};
    const trimmedName = String(name || '').trim();
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedName) {
        return res.status(400).json({ message: 'Scholar name is required.' });
    }

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Enter a valid scholar email address.' });
    }

    if (!isValidPassword(password)) {
        return res.status(400).json({ message: 'Scholar password must be at least 8 characters.' });
    }

    const db = readDb();
    const accounts = Array.isArray(db.scholarAccounts) ? db.scholarAccounts : [];

    if (accounts.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
        return res.status(409).json({ message: 'A scholar account with this email already exists.' });
    }

    const nextId = accounts.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1;
    const passwordRecord = createPasswordRecord(password);

    const newScholar = {
        id: nextId,
        name: trimmedName,
        email: normalizedEmail,
        role: 'student',
        applicationId: null,
        ...passwordRecord,
    };

    db.scholarAccounts = [...accounts, newScholar];
    writeDb(db);

    cleanupExpiredEntries(scholarSessions);
    const sessionToken = crypto.randomUUID();
    scholarSessions.set(sessionToken, {
        scholarId: newScholar.id,
        expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return res.status(201).json({
        message: 'Scholar account created.',
        sessionToken,
        scholar: toPublicScholar(newScholar),
    });
});

app.post('/api/auth/admin/sign-up', (req, res) => {
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

    if (!trimmedName) {
        return res.status(400).json({ message: 'Admin name is required.' });
    }

    if (!isValidEmail(normalizedEmail)) {
        return res.status(400).json({ message: 'Enter a valid admin email address.' });
    }

    if (!normalizedEmail.endsWith('@schooladmin.com')) {
        return res.status(400).json({ message: 'Admin email must use the @schooladmin.com domain.' });
    }

    if (!isValidPassword(password)) {
        return res.status(400).json({ message: 'Admin password must be at least 8 characters.' });
    }

    if (!trimmedDepartment) {
        return res.status(400).json({ message: 'Department is required.' });
    }

    if (!trimmedDepartmentCode) {
        return res.status(400).json({ message: 'Department code is required.' });
    }

    if (!trimmedTwoFactorCode) {
        return res.status(400).json({ message: '2FA code is required.' });
    }

    if (!trimmedInviteCode) {
        return res.status(400).json({ message: 'An admin invite code is required.' });
    }

    const db = readDb();
    const admins = Array.isArray(db.admins) ? db.admins : [];

    const inviteMatches = admins.some((entry) => (
        entry.departmentCode === trimmedInviteCode
        || entry.twoFactorCode === trimmedInviteCode
    ));

    if (!inviteMatches) {
        return res.status(401).json({ message: 'Invalid admin invite code.' });
    }

    if (admins.some((entry) => normalizeEmail(entry.email) === normalizedEmail)) {
        return res.status(409).json({ message: 'An admin with this email already exists.' });
    }

    const nextId = admins.reduce((max, entry) => Math.max(max, Number(entry.id) || 0), 0) + 1;
    const passwordRecord = createPasswordRecord(password);

    const newAdmin = {
        id: nextId,
        name: trimmedName,
        email: normalizedEmail,
        role: 'administrator',
        department: trimmedDepartment,
        departmentCode: trimmedDepartmentCode,
        twoFactorCode: trimmedTwoFactorCode,
        ...passwordRecord,
    };

    db.admins = [...admins, newAdmin];
    writeDb(db);

    return res.status(201).json({
        message: 'Admin account created. Sign in with the new credentials.',
        admin: toPublicAdmin(newAdmin),
    });
});

app.get('/api/scholarships', (req, res) => {
    const db = readDb();
    res.json(db.scholarShip);
});

app.get('/api/scholarships/:id', (req, res) => {
    const db = readDb();
    const student = db.scholarShip.find(s => s.id === parseInt(req.params.id, 10));

    return student
        ? res.json(student)
        : res.status(404).json({ message: "Student not found" });
});

app.post('/api/scholarships', (req, res) => {
    const db = readDb();
    const nextId = db.scholarShip.length
        ? Math.max(...db.scholarShip.map(s => s.id)) + 1
        : 1;
    const newEntry = { id: nextId, ...req.body };
    db.scholarShip.push(newEntry);
    writeDb(db);

    res.status(201).json(newEntry);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running at http://localhost:${PORT}`));