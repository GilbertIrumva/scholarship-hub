/* eslint-disable no-console */
require('dotenv').config();

const crypto = require('crypto');
const { connectDb, disconnectDb } = require('./db/connect');
const { Admin } = require('./db/models');

const parseArgs = (argv) => {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const current = argv[index];
        if (current === '-h' || current === '--help') {
            options.help = true;
            continue;
        }
        if (!current.startsWith('--')) continue;
        const key = current.slice(2);
        const value = argv[index + 1];
        if (!value || value.startsWith('--')) {
            throw new Error(`Missing value for --${key}`);
        }
        options[key] = value;
        index += 1;
    }
    return options;
};

const hashPassword = (password, salt) =>
    crypto.scryptSync(String(password), salt, 32).toString('base64');

const printUsage = () => {
    console.log(
        'Usage: npm run set-admin -- --email name@schooladmin.com --password YourPassword123 --department-code ADM-2026 --two-factor-code 246810'
    );
    console.log('Optional flags: --name, --department, --id (legacyId or ObjectId)');
};

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const findTargetAdmin = async (idArg) => {
    if (idArg) {
        const asNumber = Number(idArg);
        if (Number.isFinite(asNumber)) {
            const byLegacy = await Admin.findOne({ legacyId: asNumber });
            if (byLegacy) return byLegacy;
        }
        if (/^[a-f\d]{24}$/i.test(idArg)) {
            const byId = await Admin.findById(idArg);
            if (byId) return byId;
        }
        throw new Error(`Admin with id ${idArg} was not found.`);
    }
    const first = await Admin.findOne().sort({ createdAt: 1 });
    if (!first) throw new Error('No admin records were found in MongoDB.');
    return first;
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));

    if (args.help || Object.keys(args).length === 0) {
        printUsage();
        return;
    }

    await connectDb();

    const admin = await findTargetAdmin(args.id);

    if (args.name) admin.name = args.name.trim();
    if (args.email) admin.email = normalizeEmail(args.email);
    if (args.department) admin.department = args.department.trim();
    if (args['department-code']) admin.departmentCode = args['department-code'].trim();
    if (args['two-factor-code']) admin.twoFactorCode = args['two-factor-code'].trim();

    if (args.password) {
        const passwordSalt = crypto.randomBytes(16).toString('hex');
        admin.passwordSalt = passwordSalt;
        admin.passwordHash = hashPassword(args.password, passwordSalt);
    }

    await admin.save();

    console.log('Admin credentials updated.');
    console.log(
        JSON.stringify(
            {
                id: admin.legacyId ?? String(admin._id),
                name: admin.name,
                email: admin.email,
                department: admin.department,
                departmentCode: admin.departmentCode,
                twoFactorCode: admin.twoFactorCode,
            },
            null,
            2
        )
    );
};

main()
    .catch((error) => {
        console.error(error.message);
        printUsage();
        process.exitCode = 1;
    })
    .finally(async () => {
        await disconnectDb();
    });
