/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { connectDb, disconnectDb } = require('../db/connect');
const { Admin, Scholar, Application, Scholarship } = require('../db/models');

const DB_JSON = path.join(__dirname, '..', 'db.json');

const loadJson = () => {
    if (!fs.existsSync(DB_JSON)) {
        console.warn(`[migrate] ${DB_JSON} not found — nothing to migrate.`);
        return { scholarShip: [], scholarAccounts: [], admins: [] };
    }
    return JSON.parse(fs.readFileSync(DB_JSON, 'utf-8'));
};

const seedScholarships = async () => {
    const count = await Scholarship.countDocuments();
    if (count > 0) {
        console.log(`[migrate] Scholarships catalog already has ${count} entries — skipping seed.`);
        return;
    }

    const docs = [
        {
            title: 'Undergraduate Merit Scholarship',
            provider: 'ScholarshipZone Foundation',
            description: 'Full-tuition award for outstanding undergraduate applicants.',
            amount: 5000,
            currency: 'USD',
            eligibility: 'Bachelor program applicants with strong academic record.',
            deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            countries: ['Kenya', 'Uganda', 'Rwanda', 'DRC', 'Tanzania'],
            grades: ['High School', 'Undergraduate'],
            fields: ['Engineering', 'Computer Science', 'Business'],
            tags: ['undergraduate', 'merit'],
        },
        {
            title: 'Graduate Research Grant',
            provider: 'ScholarshipZone Foundation',
            description: 'Funding for master and PhD candidates working on research projects.',
            amount: 8000,
            currency: 'USD',
            eligibility: 'Master or PhD program applicants.',
            deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
            countries: ['Kenya', 'Nigeria', 'South Africa', 'Ghana'],
            grades: ['Graduate', 'PhD'],
            fields: ['Public Health', 'Data Science', 'Education'],
            tags: ['graduate', 'research'],
        },
        {
            title: 'Diploma Skills Bursary',
            provider: 'ScholarshipZone Foundation',
            description: 'Support for diploma-level students pursuing vocational tracks.',
            amount: 2000,
            currency: 'USD',
            eligibility: 'Diploma applicants from underserved communities.',
            deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
            countries: ['Kenya', 'Uganda', 'DRC', 'Tanzania', 'Sudan'],
            grades: ['Diploma', 'Vocational'],
            fields: ['Agriculture', 'Hospitality', 'ICT', 'Healthcare'],
            tags: ['diploma', 'bursary'],
        },
        {
            title: 'Refugee Education Pathway',
            provider: 'UNHCR Partner Initiative',
            description: 'Dedicated scholarship for refugee students continuing their studies.',
            amount: 4500,
            currency: 'USD',
            eligibility: 'Refugee-status students with valid documentation.',
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            countries: ['DRC', 'South Sudan', 'Somalia', 'Burundi', 'Ethiopia'],
            grades: ['High School', 'Undergraduate', 'Diploma'],
            fields: ['Any field'],
            tags: ['refugee', 'priority'],
        },
        {
            title: 'Women in STEM Award',
            provider: 'ScholarshipZone x TechAfrica',
            description: 'Empowering women pursuing science and technology degrees.',
            amount: 6000,
            currency: 'USD',
            eligibility: 'Female students enrolled in STEM programs.',
            deadline: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
            countries: ['Kenya', 'Rwanda', 'Uganda', 'Nigeria', 'Ghana'],
            grades: ['Undergraduate', 'Graduate'],
            fields: ['Engineering', 'Computer Science', 'Data Science', 'Mathematics'],
            tags: ['women', 'stem'],
        },
    ];

    await Scholarship.insertMany(docs);
    console.log(`[migrate] Seeded ${docs.length} scholarships.`);
};

const migrate = async () => {
    await connectDb();

    const json = loadJson();
    const legacyApplicants = Array.isArray(json.scholarShip) ? json.scholarShip : [];
    const legacyScholars = Array.isArray(json.scholarAccounts) ? json.scholarAccounts : [];
    const legacyAdmins = Array.isArray(json.admins) ? json.admins : [];

    // Admins
    for (const a of legacyAdmins) {
        const exists = await Admin.findOne({ email: String(a.email).toLowerCase() });
        if (exists) continue;
        await Admin.create({
            legacyId: a.id,
            name: a.name,
            email: a.email,
            role: a.role || 'administrator',
            department: a.department,
            departmentCode: a.departmentCode,
            twoFactorCode: a.twoFactorCode,
            passwordSalt: a.passwordSalt,
            passwordHash: a.passwordHash,
        });
    }
    console.log(`[migrate] Admins synced (${legacyAdmins.length}).`);

    // Applications (from scholarShip list)
    const appIdMap = new Map(); // legacyApplicationId -> ObjectId
    for (const app of legacyApplicants) {
        const existing = await Application.findOne({ legacyId: app.id });
        if (existing) {
            appIdMap.set(app.id, existing._id);
            continue;
        }
        const doc = await Application.create({
            legacyId: app.id,
            name: app.name || 'Unnamed Applicant',
            nationality: app.nationality || '',
            status: app.status || '',
            education: app.education || '',
            contact: app.contact || '',
            age: app.age ?? null,
            gender: app.gender || '',
            dateOfBirth: app.dateOfBirth || '',
            address: app.address || '',
            bio: app.bio || '',
            photo: app.photo || '',
        });
        appIdMap.set(app.id, doc._id);
    }
    console.log(`[migrate] Applications synced (${legacyApplicants.length}).`);

    // Scholar accounts
    for (const s of legacyScholars) {
        const linkedApp = s.applicationId ? appIdMap.get(s.applicationId) || null : null;
        const exists = await Scholar.findOne({ email: String(s.email).toLowerCase() });
        if (exists) {
            if (linkedApp && !exists.application) {
                exists.application = linkedApp;
                await exists.save();
            }
            continue;
        }
        const scholar = await Scholar.create({
            legacyId: s.id,
            name: s.name,
            email: s.email,
            role: s.role || 'student',
            application: linkedApp,
            passwordSalt: s.passwordSalt,
            passwordHash: s.passwordHash,
        });

        if (linkedApp) {
            await Application.updateOne({ _id: linkedApp }, { scholar: scholar._id });
        }
    }
    console.log(`[migrate] Scholar accounts synced (${legacyScholars.length}).`);

    await seedScholarships();

    console.log('[migrate] Done.');
};

migrate()
    .catch((err) => {
        console.error('[migrate] Failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDb();
    });
