/**
 * Centralised zod schemas for request validation.
 *
 * Each schema is the single source of truth for "what a valid request body
 * looks like" for a given endpoint. Handlers downstream can trust that
 * `req.body` matches the schema's parsed shape.
 *
 * Conventions:
 *   - `.trim()` and `.toLowerCase()` are applied at the boundary so handlers
 *     don't need to repeat normalisation.
 *   - Min lengths mirror the existing ad-hoc checks in `index.js`:
 *       passwords  >= 8
 *       names      >= 1 (after trim)
 *       message    <= 4000 (CONTACT_MAX_LEN)
 *   - `.strict()` is intentionally NOT used so clients can send extra fields
 *     (e.g. a future `rememberMe` flag) without breaking older deployments.
 */
const { z } = require('zod');

// ----- Auth: admin -----------------------------------------------------------

const AdminSignInSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid admin email address.'),
    password: z.string().min(1, 'Password is required.'),
});

const AdminVerifySchema = z.object({
    challengeId: z.string().min(1, 'Challenge id is required.'),
    verificationCode: z.string().min(1, 'Verification code is required.'),
});

const AdminSignUpSchema = z.object({
    name: z.string().trim().min(1, 'Admin name is required.'),
    email: z.string().trim().toLowerCase().email('Enter a valid admin email address.')
        .refine((v) => v.endsWith('@schooladmin.com'), {
            message: 'Admin email must use the @schooladmin.com domain.',
        }),
    password: z.string().min(8, 'Admin password must be at least 8 characters.'),
    department: z.string().trim().min(1, 'Department is required.'),
    departmentCode: z.string().trim().min(1, 'Department code is required.'),
    twoFactorCode: z.string().trim().min(1, '2FA code is required.'),
    inviteCode: z.string().trim().min(1, 'An admin invite code is required.'),
});

// ----- Auth: scholar/student -------------------------------------------------

const ScholarSignInSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid scholar email address.'),
    password: z.string().min(1, 'Password is required.'),
});

const ScholarSignUpSchema = z.object({
    name: z.string().trim().min(1, 'Scholar name is required.'),
    email: z.string().trim().toLowerCase().email('Enter a valid scholar email address.'),
    password: z.string().min(8, 'Scholar password must be at least 8 characters.'),
});

// ----- Public contact form ---------------------------------------------------

const CONTACT_MAX_LEN = 4000;

const ContactMessageSchema = z.object({
    name: z.string().trim().min(1, 'Name is required.'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
    topic: z.string().trim().max(40).optional().default('general'),
    message: z.string().trim().min(1, 'Message is required.').max(CONTACT_MAX_LEN, 'Message is too long.'),
});

module.exports = {
    AdminSignInSchema,
    AdminVerifySchema,
    AdminSignUpSchema,
    ScholarSignInSchema,
    ScholarSignUpSchema,
    ContactMessageSchema,
    CONTACT_MAX_LEN,
};
