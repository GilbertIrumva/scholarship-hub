/**
 * lib/passwordSecurity.js — zxcvbn-ts wrapper + HIBP k-anonymity breach check.
 *
 * - `scorePassword(pw)` runs zxcvbn-ts and returns a normalized result. The
 *   matcher/dictionary load happens lazily on first call so the library doesn't
 *   bloat the initial bundle (the language packs are ~700 KB combined).
 * - `checkPasswordBreached(pw, {signal})` hits the HaveIBeenPwned range API
 *   using k-anonymity: only the first 5 chars of the SHA-1 are sent. The full
 *   suffix is matched locally. Returns `{breached: boolean, count: number}`.
 *   Network failures resolve to `{breached: false, count: 0, error: true}` so
 *   the UI can show a soft warning without blocking submission.
 *
 * The HIBP endpoint is unauthenticated and CORS-enabled, so this runs
 * straight from the browser. Padding header avoids leaking the prefix length.
 */

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';

let zxcvbnInstance = null;
let zxcvbnLoading = null;

const loadZxcvbn = async () => {
  if (zxcvbnInstance) return zxcvbnInstance;
  if (zxcvbnLoading) return zxcvbnLoading;
  zxcvbnLoading = (async () => {
    const [{ zxcvbn, zxcvbnOptions }, common, en] = await Promise.all([
      import('@zxcvbn-ts/core'),
      import('@zxcvbn-ts/language-common'),
      import('@zxcvbn-ts/language-en'),
    ]);
    zxcvbnOptions.setOptions({
      translations: en.translations,
      graphs: common.adjacencyGraphs,
      dictionary: {
        ...common.dictionary,
        ...en.dictionary,
      },
    });
    zxcvbnInstance = zxcvbn;
    return zxcvbn;
  })();
  return zxcvbnLoading;
};

const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_PERCENT = [10, 30, 55, 80, 100];

/**
 * Run zxcvbn-ts against the password.
 * @param {string} password
 * @param {string[]} [userInputs] - email, name, etc. so leaked PII is penalized
 * @returns {Promise<{score: 0|1|2|3|4, label: string, percent: number, warning: string, suggestions: string[]}>}
 */
export const scorePassword = async (password, userInputs = []) => {
  const pw = String(password || '');
  if (!pw) {
    return { score: 0, label: '', percent: 0, warning: '', suggestions: [] };
  }
  const zxcvbn = await loadZxcvbn();
  // zxcvbn-ts only scans the first 100 chars internally; truncate so wildly long
  // strings don't stall the matcher.
  const result = zxcvbn(pw.slice(0, 100), userInputs.filter(Boolean));
  const score = Math.max(0, Math.min(4, result.score));
  return {
    score,
    label: STRENGTH_LABELS[score],
    percent: STRENGTH_PERCENT[score],
    warning: result.feedback?.warning || '',
    suggestions: Array.isArray(result.feedback?.suggestions) ? result.feedback.suggestions : [],
  };
};

const bufferToHex = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out.toUpperCase();
};

const sha1Hex = async (input) => {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-1', data);
  return bufferToHex(digest);
};

/**
 * Query HaveIBeenPwned with k-anonymity. The first 5 chars of the SHA-1
 * (the "prefix") are sent over the wire; the response contains every suffix
 * whose prefix matches, along with how many times each one has been seen in
 * known breaches.
 *
 * @param {string} password
 * @param {{signal?: AbortSignal}} [opts]
 * @returns {Promise<{breached: boolean, count: number, error?: true}>}
 */
export const checkPasswordBreached = async (password, { signal } = {}) => {
  const pw = String(password || '');
  if (!pw) return { breached: false, count: 0 };

  // Browsers without SubtleCrypto (very old or non-secure contexts) can't do this.
  if (typeof crypto === 'undefined' || !crypto?.subtle?.digest) {
    return { breached: false, count: 0, error: true };
  }

  try {
    const hash = await sha1Hex(pw);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const resp = await fetch(`${HIBP_RANGE_URL}${prefix}`, {
      method: 'GET',
      // Tell HIBP to pad the response so an observer can't infer the prefix
      // from the byte count.
      headers: { 'Add-Padding': 'true' },
      signal,
    });
    if (!resp.ok) {
      return { breached: false, count: 0, error: true };
    }
    const text = await resp.text();
    // Body is "SUFFIX:count\r\n" per line. Find ours.
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const [lineSuffix, lineCount] = line.split(':');
      if (lineSuffix && lineSuffix.trim().toUpperCase() === suffix) {
        const count = Number.parseInt(String(lineCount || '').trim(), 10);
        if (Number.isFinite(count) && count > 0) {
          return { breached: true, count };
        }
      }
    }
    return { breached: false, count: 0 };
  } catch (err) {
    // AbortError from the caller cancelling a debounced check — bubble up
    // a clean "not breached" so the UI does not flash an error.
    if (err?.name === 'AbortError') return { breached: false, count: 0 };
    return { breached: false, count: 0, error: true };
  }
};

/**
 * Convenience predicate: is this password acceptable for sign-up / reset?
 *
 * Policy: zxcvbn score >= 2 (Fair) AND not present in HIBP.
 * Returns `{ok, reason}` where reason is a user-facing string when !ok.
 */
export const evaluatePasswordPolicy = ({ score, breached }) => {
  if (typeof score === 'number' && score < 2) {
    return { ok: false, reason: 'Please choose a stronger password.' };
  }
  if (breached) {
    return {
      ok: false,
      reason: 'This password has appeared in a known data breach. Please choose a different one.',
    };
  }
  return { ok: true, reason: '' };
};
