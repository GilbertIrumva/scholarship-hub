/**
 * validate() — express middleware factory that validates `req.body`, `req.query`
 * or `req.params` against a zod schema.
 *
 * Replaces the ad-hoc `if (!email || !password)` checks scattered across the
 * route handlers with a single, declarative, well-tested boundary check.
 *
 * Behaviour:
 *   - Parses the chosen segment with `schema.safeParse()`.
 *   - On success, replaces `req.body|query|params` with the *parsed* value so
 *     downstream handlers see coerced + trimmed data and unknown keys are
 *     stripped (depending on the schema). Mutating only the chosen segment
 *     keeps the contract for handlers that read raw `req.headers` etc.
 *   - On failure, returns HTTP 400 with a stable error shape:
 *       { message: 'Validation failed.', issues: [{ path, message }] }
 *
 * Usage:
 *   const { z } = require('zod');
 *   const { validate } = require('./lib/validate');
 *   const SignInSchema = z.object({
 *       email: z.string().email(),
 *       password: z.string().min(8),
 *   });
 *   app.post('/api/auth/admin/sign-in', validate(SignInSchema), handler);
 */
const validate = (schema, source = 'body') => (req, res, next) => {
    if (!['body', 'query', 'params'].includes(source)) {
        return next(new Error(`validate(): unknown source "${source}"`));
    }
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
        return res.status(400).json({
            message: 'Validation failed.',
            issues: result.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
            })),
        });
    }
    // Reassign the parsed payload so downstream code reads coerced values.
    // `req.query` and `req.params` are read-only on Express 5; mutate in place.
    if (source === 'body') {
        req.body = result.data;
    } else {
        for (const key of Object.keys(req[source])) {
            delete req[source][key];
        }
        Object.assign(req[source], result.data);
    }
    return next();
};

module.exports = { validate };
