// Two-factor authentication (T3.4) + active-session management.
//
// All routes here are bearer-authenticated except `completeTwoFactorChallenge`,
// which uses the short-lived challengeId returned by sign-in.
import axios from "axios";

const buildAuthConfig = (sessionToken) => ({
  headers: { Authorization: `Bearer ${sessionToken}` },
});

// ----- TOTP enrollment + management -----------------------------------------

export const setupTwoFactor = async (sessionToken) => {
  const { data } = await axios.post(
    "/api/auth/2fa/setup",
    {},
    buildAuthConfig(sessionToken),
  );
  return data; // {secret, otpauthUrl, qrDataUrl, issuer, label}
};

export const enableTwoFactor = async (sessionToken, totpCode) => {
  const { data } = await axios.post(
    "/api/auth/2fa/enable",
    { totpCode },
    buildAuthConfig(sessionToken),
  );
  return data; // {message, backupCodes}
};

export const disableTwoFactor = async (sessionToken, payload) => {
  // payload: { password, totpCode?: '...', backupCode?: '...' }
  const { data } = await axios.post(
    "/api/auth/2fa/disable",
    payload,
    buildAuthConfig(sessionToken),
  );
  return data;
};

export const regenerateBackupCodes = async (sessionToken, totpCode) => {
  const { data } = await axios.post(
    "/api/auth/2fa/backup-codes/regenerate",
    { totpCode },
    buildAuthConfig(sessionToken),
  );
  return data; // {message, backupCodes}
};

export const getTwoFactorStatus = async (sessionToken) => {
  const { data } = await axios.get(
    "/api/auth/2fa/status",
    buildAuthConfig(sessionToken),
  );
  return data; // {enabled, backupCodesTotal, backupCodesRemaining}
};

// ----- Sign-in challenge completion (scholar) -------------------------------
//
// Called when /api/auth/student/sign-in returned {requires2fa: true,
// challengeId}. Submit either a totpCode or a backupCode to receive the
// final scholar session.
export const completeTwoFactorChallenge = async ({ challengeId, totpCode, backupCode }) => {
  const { data } = await axios.post("/api/auth/2fa/challenge", {
    challengeId,
    ...(totpCode ? { totpCode } : {}),
    ...(backupCode ? { backupCode } : {}),
  });
  return data; // {sessionToken, scholar, message}
};

// ----- Device / session management ------------------------------------------

export const listSessions = async (sessionToken) => {
  const { data } = await axios.get(
    "/api/auth/sessions",
    buildAuthConfig(sessionToken),
  );
  return data.sessions || [];
};

export const revokeSession = async (sessionToken, id) => {
  const { data } = await axios.delete(
    `/api/auth/sessions/${id}`,
    buildAuthConfig(sessionToken),
  );
  return data; // {message, revokedCurrent}
};

export const revokeOtherSessions = async (sessionToken) => {
  const { data } = await axios.delete(
    "/api/auth/sessions",
    buildAuthConfig(sessionToken),
  );
  return data; // {message, deletedCount}
};
