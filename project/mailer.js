/*
 * Lightweight email transport. Three modes:
 *   1. If SMTP_HOST + SMTP_USER + SMTP_PASS are set in .env → sends real email via nodemailer
 *   2. Otherwise → logs the email payload to the console (great for local dev)
 *
 * Env vars:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true            (true for port 465, false for 587)
 *   SMTP_USER=youraddress@gmail.com
 *   SMTP_PASS=app-password
 *   MAIL_FROM="ScholarshipZone <noreply@scholarshipzone.app>"
 */

const nodemailer = require('nodemailer');

let cachedTransporter = null;
let cachedMode = null;

const buildTransport = () => {
    if (cachedTransporter || cachedMode === 'log') return { transporter: cachedTransporter, mode: cachedMode };

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        cachedMode = 'log';
        console.log('[mailer] SMTP not configured — emails will be logged to the console only.');
        return { transporter: null, mode: 'log' };
    }

    cachedTransporter = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 465),
        secure: String(process.env.SMTP_SECURE || 'true') === 'true',
        auth: { user, pass },
    });
    cachedMode = 'smtp';
    console.log(`[mailer] SMTP ready (host=${host})`);
    return { transporter: cachedTransporter, mode: 'smtp' };
};

const sendEmail = async ({ to, subject, text, html, fromName, replyTo }) => {
    const { transporter, mode } = buildTransport();

    const from =
        process.env.MAIL_FROM ||
        (process.env.SMTP_USER
            ? `${fromName || 'ScholarshipZone'} <${process.env.SMTP_USER}>`
            : `${fromName || 'ScholarshipZone'} <noreply@scholarshipzone.local>`);

    if (mode === 'log') {
        console.log('\n──────── [mailer] outbound email (LOG MODE) ────────');
        console.log(`From:      ${from}`);
        console.log(`To:        ${to}`);
        console.log(`Reply-To:  ${replyTo || from}`);
        console.log(`Subject:   ${subject}`);
        console.log('Body:');
        console.log(text);
        console.log('────────────────────────────────────────────────────\n');
        return { ok: true, mode, messageId: `log-${Date.now()}` };
    }

    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            text,
            html: html || `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${text}</pre>`,
            replyTo: replyTo || from,
        });
        return { ok: true, mode, messageId: info.messageId };
    } catch (err) {
        console.error('[mailer] send failed', err.message);
        return { ok: false, mode, error: err.message };
    }
};

module.exports = { sendEmail };