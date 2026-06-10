// Security & sessions panel used by both admin and scholar settings.
// Provides:
//   - 2FA enrollment wizard (QR + backup codes)
//   - 2FA status / disable / regenerate-backup-codes controls
//   - Active sessions list with per-row revoke + "sign out everywhere else"
//
// Calls the T3.4 backend at /api/auth/2fa/* and /api/auth/sessions/*.
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Copy,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  disableTwoFactor,
  enableTwoFactor,
  getTwoFactorStatus,
  listSessions,
  regenerateBackupCodes,
  revokeOtherSessions,
  revokeSession,
  setupTwoFactor,
} from "../../../services/twoFactor";

// ---------- helpers ---------------------------------------------------------

const copyToClipboard = async (text, label) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard.`);
  } catch {
    toast.error("Clipboard unavailable. Copy manually.");
  }
};

const downloadBackupCodes = (codes) => {
  const blob = new Blob(
    [
      "ScholarshipZone — Two-factor backup codes",
      "Keep these safe. Each code can be used only once.",
      "",
      ...codes,
      "",
    ].join("\n"),
    { type: "text/plain;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "scholarshipzone-backup-codes.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
};

// Lightweight UA → short label parser. Best-effort only.
const summariseUserAgent = (ua) => {
  if (!ua) return "Unknown device";
  let device = "Desktop";
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) device = "Mobile";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";
  let os = "";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iOS/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${browser} · ${device}${os ? ` · ${os}` : ""}`;
};

// ---------- subcomponents ---------------------------------------------------

const BackupCodesList = ({ codes }) => (
  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="text-sm font-semibold text-emerald-900">
        Save these backup codes
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => copyToClipboard(codes.join("\n"), "Backup codes")}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </button>
        <button
          type="button"
          onClick={() => downloadBackupCodes(codes)}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </button>
      </div>
    </div>
    <ul className="grid grid-cols-2 gap-2 font-mono text-sm text-emerald-950 sm:grid-cols-2">
      {codes.map((code) => (
        <li
          key={code}
          className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-center"
        >
          {code}
        </li>
      ))}
    </ul>
    <p className="mt-3 text-xs text-emerald-800/80">
      Each code may be used only once. We will not show them again — store them
      somewhere safe (password manager, printed copy, etc.).
    </p>
  </div>
);

// ---------- main panel ------------------------------------------------------

const TwoFactorAndSessionsPanel = ({ sessionToken, principalKind = "scholar" }) => {
  // 2FA status
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Enrollment wizard
  const [setupData, setSetupData] = useState(null); // {secret, otpauthUrl, qrDataUrl}
  const [enrollCode, setEnrollCode] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [issuedBackupCodes, setIssuedBackupCodes] = useState(null);

  // Disable flow
  const [showDisable, setShowDisable] = useState(false);
  const [disableForm, setDisableForm] = useState({ password: "", totpCode: "", backupCode: "" });
  const [disabling, setDisabling] = useState(false);

  // Regenerate
  const [regenCode, setRegenCode] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionBusyId, setSessionBusyId] = useState("");
  const [revokingOthers, setRevokingOthers] = useState(false);

  const issuer = useMemo(() => "ScholarshipZone", []);

  // -- load status + sessions ------------------------------------------------
  const refreshStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await getTwoFactorStatus(sessionToken);
      setStatus(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to load 2FA status.");
    } finally {
      setLoadingStatus(false);
    }
  };

  const refreshSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await listSessions(sessionToken);
      setSessions(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to load sessions.");
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    refreshStatus();
    refreshSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // -- enrollment actions ----------------------------------------------------
  const beginEnrollment = async () => {
    setEnrolling(true);
    try {
      const data = await setupTwoFactor(sessionToken);
      setSetupData(data);
      setIssuedBackupCodes(null);
      setEnrollCode("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to start 2FA setup.");
    } finally {
      setEnrolling(false);
    }
  };

  const confirmEnrollment = async (e) => {
    e?.preventDefault?.();
    if (!/^\d{6}$/.test(enrollCode.trim())) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setEnrolling(true);
    try {
      const result = await enableTwoFactor(sessionToken, enrollCode.trim());
      setIssuedBackupCodes(result.backupCodes);
      setSetupData(null);
      setEnrollCode("");
      toast.success("Two-factor authentication enabled.");
      refreshStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Code did not match. Try again.");
    } finally {
      setEnrolling(false);
    }
  };

  // -- disable ---------------------------------------------------------------
  const handleDisable = async (e) => {
    e?.preventDefault?.();
    if (!disableForm.password) {
      toast.error("Confirm your password to disable 2FA.");
      return;
    }
    if (!disableForm.totpCode && !disableForm.backupCode) {
      toast.error("Provide a current authenticator or backup code.");
      return;
    }
    setDisabling(true);
    try {
      await disableTwoFactor(sessionToken, {
        password: disableForm.password,
        ...(disableForm.totpCode ? { totpCode: disableForm.totpCode.trim() } : {}),
        ...(disableForm.backupCode ? { backupCode: disableForm.backupCode.trim() } : {}),
      });
      toast.success("Two-factor authentication disabled.");
      setDisableForm({ password: "", totpCode: "", backupCode: "" });
      setShowDisable(false);
      refreshStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to disable 2FA.");
    } finally {
      setDisabling(false);
    }
  };

  // -- regenerate backup codes -----------------------------------------------
  const handleRegenerate = async (e) => {
    e?.preventDefault?.();
    if (!/^\d{6}$/.test(regenCode.trim())) {
      toast.error("Enter your current 6-digit authenticator code.");
      return;
    }
    setRegenBusy(true);
    try {
      const result = await regenerateBackupCodes(sessionToken, regenCode.trim());
      setIssuedBackupCodes(result.backupCodes);
      setRegenCode("");
      toast.success("New backup codes generated. Old codes are now invalid.");
      refreshStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to regenerate codes.");
    } finally {
      setRegenBusy(false);
    }
  };

  // -- sessions --------------------------------------------------------------
  const handleRevoke = async (id) => {
    setSessionBusyId(id);
    try {
      const result = await revokeSession(sessionToken, id);
      toast.success("Session signed out.");
      if (result.revokedCurrent) {
        // The current session was wiped — force a hard reload back to login.
        window.location.href = "/login";
        return;
      }
      refreshSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to revoke session.");
    } finally {
      setSessionBusyId("");
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const result = await revokeOtherSessions(sessionToken);
      toast.success(
        result.deletedCount === 0
          ? "No other sessions to sign out."
          : `Signed out ${result.deletedCount} other session${result.deletedCount === 1 ? "" : "s"}.`,
      );
      refreshSessions();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to revoke other sessions.");
    } finally {
      setRevokingOthers(false);
    }
  };

  // -- render ----------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ---------- 2FA card -------------------------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Two-factor authentication
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Add a one-time code from an authenticator app on every
              {principalKind === "admin" ? " admin" : ""} sign-in.
            </p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            {loadingStatus ? "…" : status?.enabled ? "Enabled" : "Disabled"}
          </div>
        </header>

        {/* Setup wizard */}
        {!status?.enabled && !setupData && !issuedBackupCodes && (
          <button
            type="button"
            onClick={beginEnrollment}
            disabled={enrolling || loadingStatus}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enrolling ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Set up two-factor authentication
          </button>
        )}

        {setupData && (
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-[auto,1fr] sm:items-start">
              <img
                src={setupData.qrDataUrl}
                alt="Scan this QR code with your authenticator app"
                className="h-44 w-44 rounded-xl border border-slate-200 bg-white p-2"
              />
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  Scan the QR code with{" "}
                  <span className="font-semibold">
                    Google Authenticator, 1Password, Authy
                  </span>{" "}
                  or any TOTP-compatible app.
                </p>
                <p className="text-slate-500">
                  Can&apos;t scan? Enter this secret manually:
                </p>
                <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs">
                  <span className="flex-1 break-all">{setupData.secret}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(setupData.secret, "Secret")}
                    className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900"
                    title="Copy secret"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500">Issuer: {issuer}</p>
              </div>
            </div>

            <form
              onSubmit={confirmEnrollment}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <label className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Enter the 6-digit code to confirm
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value)}
                  placeholder="123 456"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-wider focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={enrolling}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enrolling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Verify &amp; enable
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupData(null);
                    setEnrollCode("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {issuedBackupCodes && (
          <div className="space-y-4">
            <BackupCodesList codes={issuedBackupCodes} />
            <button
              type="button"
              onClick={() => setIssuedBackupCodes(null)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              I&apos;ve saved them
            </button>
          </div>
        )}

        {/* Enabled view */}
        {status?.enabled && !issuedBackupCodes && (
          <div className="space-y-5">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-900">
              <p className="font-semibold">Two-factor is active for this account.</p>
              <p className="mt-1 text-emerald-800/90">
                Backup codes remaining:{" "}
                <span className="font-semibold">
                  {status.backupCodesRemaining}
                </span>{" "}
                / {status.backupCodesTotal}
              </p>
            </div>

            <form
              onSubmit={handleRegenerate}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-end"
            >
              <label className="flex-1">
                <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Regenerate backup codes (requires current authenticator code)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value)}
                  placeholder="123 456"
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-wider focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </label>
              <button
                type="submit"
                disabled={regenBusy}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {regenBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Generate new codes
              </button>
            </form>

            {!showDisable ? (
              <button
                type="button"
                onClick={() => setShowDisable(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                <ShieldOff className="h-4 w-4" />
                Disable two-factor authentication
              </button>
            ) : (
              <form
                onSubmit={handleDisable}
                className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4"
              >
                <p className="text-sm text-rose-800">
                  Disabling 2FA weakens your account security. Confirm your
                  password and provide a current authenticator or backup code.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Current password
                    </span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={disableForm.password}
                      onChange={(e) =>
                        setDisableForm((f) => ({ ...f, password: e.target.value }))
                      }
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Authenticator code
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={disableForm.totpCode}
                      onChange={(e) =>
                        setDisableForm((f) => ({ ...f, totpCode: e.target.value }))
                      }
                      placeholder="123 456"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-wider focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                  </label>
                  <label>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Or backup code
                    </span>
                    <input
                      type="text"
                      value={disableForm.backupCode}
                      onChange={(e) =>
                        setDisableForm((f) => ({ ...f, backupCode: e.target.value }))
                      }
                      placeholder="xxxx-xxxx"
                      className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={disabling}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {disabling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                    Disable 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDisable(false);
                      setDisableForm({ password: "", totpCode: "", backupCode: "" });
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {/* ---------- Sessions card --------------------------------------- */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Smartphone className="h-5 w-5 text-emerald-600" />
              Active sessions
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Devices currently signed in to your account. Revoke any you
              don&apos;t recognise.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokingOthers || sessions.length < 2}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revokingOthers ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Sign out other devices
          </button>
        </header>

        {loadingSessions ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading sessions…
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-500">No active sessions found.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {sessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                    {summariseUserAgent(s.userAgent)}
                    {s.current && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {s.ipAddress || "Unknown IP"} · Last seen{" "}
                    {formatDate(s.lastUsedAt || s.updatedAt || s.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(s.id)}
                  disabled={sessionBusyId === s.id}
                  className="inline-flex items-center gap-1 self-start rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
                >
                  {sessionBusyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default TwoFactorAndSessionsPanel;
