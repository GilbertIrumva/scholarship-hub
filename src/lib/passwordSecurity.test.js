import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scorePassword,
  checkPasswordBreached,
  evaluatePasswordPolicy,
} from './passwordSecurity';

describe('passwordSecurity / scorePassword', () => {
  it('returns score 0 for empty input', async () => {
    const result = await scorePassword('');
    expect(result.score).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.label).toBe('');
  });

  it('returns a low score for a trivial password', async () => {
    const result = await scorePassword('password');
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.label).toBeTruthy();
    expect(result.percent).toBeGreaterThan(0);
  });

  it('returns a high score for a strong passphrase', async () => {
    const result = await scorePassword('correct horse battery staple river7!');
    expect(result.score).toBeGreaterThanOrEqual(3);
  });

  it('penalises passwords that contain provided user inputs', async () => {
    const generic = await scorePassword('janeDoe2024');
    const withContext = await scorePassword('janeDoe2024', ['jane', 'doe', 'jane@example.com']);
    // The user-input variant should never score higher than the generic one.
    expect(withContext.score).toBeLessThanOrEqual(generic.score);
  });
});

describe('passwordSecurity / evaluatePasswordPolicy', () => {
  it('rejects scores below 2', () => {
    expect(evaluatePasswordPolicy({ score: 0, breached: false }).ok).toBe(false);
    expect(evaluatePasswordPolicy({ score: 1, breached: false }).ok).toBe(false);
  });

  it('accepts score >= 2 when not breached', () => {
    expect(evaluatePasswordPolicy({ score: 2, breached: false }).ok).toBe(true);
    expect(evaluatePasswordPolicy({ score: 4, breached: false }).ok).toBe(true);
  });

  it('always rejects when breached, even at high score', () => {
    expect(evaluatePasswordPolicy({ score: 4, breached: true }).ok).toBe(false);
  });
});

describe('passwordSecurity / checkPasswordBreached', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns not-breached for empty input', async () => {
    const result = await checkPasswordBreached('');
    expect(result).toEqual({ breached: false, count: 0 });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('detects a known-breached password via k-anonymity match', async () => {
    // SHA-1 of "password" is 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    // prefix = "5BAA6", suffix = "1E4C9B93F3F0682250B6CF8331B7EE68FD8"
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () =>
        ['003D68EB55068C33ACE09247EE4C639306B:3', '1E4C9B93F3F0682250B6CF8331B7EE68FD8:12345'].join('\r\n'),
    });
    const result = await checkPasswordBreached('password');
    expect(result.breached).toBe(true);
    expect(result.count).toBe(12345);
    // Verify only the 5-char prefix was sent — k-anonymity.
    const url = globalThis.fetch.mock.calls[0][0];
    expect(url).toBe('https://api.pwnedpasswords.com/range/5BAA6');
    // Verify the padding header is set.
    const opts = globalThis.fetch.mock.calls[0][1];
    expect(opts.headers['Add-Padding']).toBe('true');
  });

  it('returns not-breached when the suffix is absent from the response', async () => {
    globalThis.fetch.mockResolvedValueOnce({
      ok: true,
      text: async () => 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1\r\nBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB:2',
    });
    const result = await checkPasswordBreached('password');
    expect(result.breached).toBe(false);
    expect(result.count).toBe(0);
  });

  it('treats non-OK HTTP responses as an error (does not block submission)', async () => {
    globalThis.fetch.mockResolvedValueOnce({ ok: false, status: 503, text: async () => '' });
    const result = await checkPasswordBreached('password');
    expect(result).toEqual({ breached: false, count: 0, error: true });
  });

  it('treats network errors as an error (does not block submission)', async () => {
    globalThis.fetch.mockRejectedValueOnce(new Error('network down'));
    const result = await checkPasswordBreached('password');
    expect(result).toEqual({ breached: false, count: 0, error: true });
  });

  it('returns clean (non-breached) when the caller aborts', async () => {
    const abortErr = new Error('aborted');
    abortErr.name = 'AbortError';
    globalThis.fetch.mockRejectedValueOnce(abortErr);
    const result = await checkPasswordBreached('password');
    expect(result).toEqual({ breached: false, count: 0 });
  });
});
