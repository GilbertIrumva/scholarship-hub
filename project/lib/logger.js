// T4.2 — Shared pino logger instance.
// Owning the logger in its own module breaks the circular-dependency risk
// that would arise if `lib/audit.js`, `lib/notify.js` etc. tried to import
// the logger from `project/index.js` (index.js already imports them).
//
// The configuration here mirrors what index.js used previously:
//   • Pretty-printed in dev, structured JSON in prod.
//   • Redact paths cover every auth-sensitive field the API receives.
//   • LOG_LEVEL env override always wins.
const pino = require('pino');

const IS_PROD = process.env.NODE_ENV === 'production';
const IS_TEST = process.env.NODE_ENV === 'test';

const logger = pino({
    // In tests we silence everything below `warn` so the vitest output
    // stays readable. Set LOG_LEVEL to override.
    level: process.env.LOG_LEVEL || (IS_TEST ? 'warn' : IS_PROD ? 'info' : 'debug'),
    redact: {
        paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.verificationCode',
            'req.body.departmentCode',
            'req.body.twoFactorCode',
            'req.body.totpCode',
            'req.body.backupCode',
            // T4.2 — also redact the refresh-token cookie value if it
            // somehow lands in a log entry under a custom shape.
            'req.body.refreshToken',
            '*.refreshToken',
            '*.refreshTokenHash',
        ],
        censor: '[redacted]',
    },
    ...(IS_PROD || IS_TEST
        ? {}
        : {
            transport: {
                target: 'pino-pretty',
                options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
            },
        }),
});

module.exports = { logger };
