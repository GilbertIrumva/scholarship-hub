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
    // Optional: required only if the admin has TOTP enabled. Validated
    // server-side; the API rejects sign-in without it when enabled.
    totpCode: z.string().trim().min(1).optional(),
    backupCode: z.string().trim().min(1).optional(),
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

// ----- Email verification + password reset (scholar) -------------------------

const ForgotPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

const ResetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required.'),
    password: z.string().min(8, 'New password must be at least 8 characters.'),
});

const VerifyEmailSchema = z.object({
    token: z.string().min(1, 'Verification token is required.'),
});

const ResendVerificationSchema = z.object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

// ----- Admin audit log query -------------------------------------------------

const AuditLogQuerySchema = z.object({
    action: z.string().trim().min(1).optional(),
    actorEmail: z.string().trim().toLowerCase().optional(),
    outcome: z.enum(['success', 'failure']).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    cursor: z.string().optional(), // ISO timestamp of the last seen createdAt
});

// ----- Scholar recommendations query -----------------------------------------

const RecommendationsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

// ----- Notifications ---------------------------------------------------------

const NotificationListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    unreadOnly: z
        .union([z.literal('true'), z.literal('false'), z.boolean()])
        .optional()
        .transform((v) => v === true || v === 'true'),
});

// ----- TOTP / 2FA (T3.4) -----------------------------------------------------

// Used by POST /api/auth/2fa/enable to confirm the user has correctly
// scanned the QR by submitting a fresh code from their authenticator.
const TwoFactorEnableSchema = z.object({
    totpCode: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator.'),
});

// Used by POST /api/auth/2fa/disable. Always requires the account password;
// requires a TOTP/backup code as well when 2FA is currently enabled.
const TwoFactorDisableSchema = z.object({
    password: z.string().min(1, 'Password is required to disable two-factor authentication.'),
    totpCode: z.string().trim().min(1).optional(),
    backupCode: z.string().trim().min(1).optional(),
});

// Used by POST /api/auth/2fa/challenge during a pending sign-in.
const TwoFactorChallengeSchema = z.object({
    challengeId: z.string().min(1, 'Challenge id is required.'),
    totpCode: z.string().trim().min(1).optional(),
    backupCode: z.string().trim().min(1).optional(),
}).refine((v) => Boolean(v.totpCode || v.backupCode), {
    message: 'Provide either a TOTP code or a backup code.',
    path: ['totpCode'],
});

// T4.1 — anonymous Core Web Vitals payload from the browser.
// Kept permissive on optional metadata; strict on `name` + `value`.
const WebVitalsSchema = z.object({
    name: z.enum(['CLS', 'LCP', 'INP', 'TTFB', 'FCP']),
    value: z.number().finite().min(0).max(1_000_000),
    rating: z.enum(['good', 'needs-improvement', 'poor', 'unknown']).optional(),
    navigationType: z.string().max(64).nullable().optional(),
    id: z.string().max(128).nullable().optional(),
    path: z.string().max(256).nullable().optional(),
});

module.exports = {
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
    CONTACT_MAX_LEN,
};
