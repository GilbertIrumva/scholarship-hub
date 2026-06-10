import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AuthShell from "./shared/AuthShell";
import AccountTypeModal from "./shared/AccountTypeModal";
import GoogleButton from "./shared/GoogleButton";
import { Seo } from "../seo/Seo";

// -----------------------------------------------------------------------------
// Hero copy per role
// -----------------------------------------------------------------------------
const buildHero = (t) => ({
  scholar: {
    headline: t("auth.loginHeroHeadline"),
    subtitle: t("auth.loginHeroSubtitleScholar"),
    eyebrow: t("auth.loginEyebrow"),
  },
  admin: {
    headline: t("auth.loginHeroHeadline"),
    subtitle: t("auth.loginHeroSubtitleAdmin"),
    eyebrow: t("auth.loginAdminEyebrow"),
  },
});

// -----------------------------------------------------------------------------
// Reusable input
// -----------------------------------------------------------------------------
const Field = ({
  label,
  icon: Icon,
  error,
  type = "text",
  showToggle = false,
  rightAdornment,
  ...inputProps
}) => {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const inputType = showToggle ? (show ? "text" : "password") : type;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputProps.id}
        className="text-sm font-semibold text-slate-700"
      >
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          {...inputProps}
          type={inputType}
          className={[
            "h-12 w-full rounded-xl border bg-white text-sm text-slate-900 placeholder:text-slate-400 transition-all",
            "focus:outline-none focus:ring-4 focus:ring-[#059669]/20",
            Icon ? "pl-10" : "pl-4",
            showToggle || rightAdornment ? "pr-12" : "pr-4",
            error
              ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
              : "border-slate-200 focus:border-[#059669]",
          ].join(" ")}
        />
        {showToggle && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((s) => !s)}
            aria-label={show ? t("auth.passwordHide") : t("auth.passwordShow")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
        {!showToggle && rightAdornment}
      </div>
      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Role indicator row
// -----------------------------------------------------------------------------
const RoleIndicator = ({ verb, role, onChange }) => {
  const { t } = useTranslation();
  const roleLabel =
    role === "admin"
      ? t("auth.accountTypeAdmin")
      : t("auth.accountTypeStudent");
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1.5 text-slate-600">
        {role === "admin" ? (
          <ShieldCheck className="h-4 w-4 text-[#059669]" />
        ) : (
          <GraduationCap className="h-4 w-4 text-[#059669]" />
        )}
        {verb} <span className="font-bold text-slate-900">{roleLabel}</span>
      </span>
      <button
        type="button"
        onClick={onChange}
        className="text-sm font-semibold text-[#059669] underline-offset-4 transition-colors hover:text-[#047857] hover:underline"
      >
        {t("auth.changeAccountType")}
      </button>
    </div>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================
const LoginPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInAsScholar, completeScholar2fa, signInAdminDirect, isSubmitting } = useAuth();

  const initialRole = searchParams.get("role") === "admin" ? "admin" : "scholar";
  const [role, setRole] = useState(initialRole);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    accessCode: "",
    remember: false,
  });
  const [errors, setErrors] = useState({});
  // Holds the active 2FA challenge while the scholar is on the TOTP step.
  // When non-null, the form swaps to a code-entry view.
  const [twoFactor, setTwoFactor] = useState(null); // { challengeId, useBackup, code }

  // Reset errors when role changes
  useEffect(() => {
    setErrors({});
  }, [role]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = t("auth.emailInvalid");
    else if (role === "admin" && !email.endsWith("@schooladmin.com"))
      next.email = t("auth.emailAdminDomain");

    if (!form.password) next.password = t("auth.passwordRequired");

    if (role === "admin" && !form.accessCode.trim())
      next.accessCode = t("auth.loginAccessCodeRequired");

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error(t("auth.fixHighlightedFields"));
      return;
    }

    if (role === "scholar") {
      const result = await signInAsScholar({
        email: form.email.trim(),
        password: form.password,
      });
      if (result.ok) {
        toast.success(t("auth.loginToastWelcomeBack"));
        navigate("/scholar");
      } else if (result.requires2fa && result.challengeId) {
        // Pause the sign-in flow until the scholar submits a TOTP / backup
        // code. The credentials are not retained — only the challengeId.
        setTwoFactor({ challengeId: result.challengeId, useBackup: false, code: "" });
        toast(t("auth.loginToastEnter2fa"), { icon: "🔐" });
      } else {
        toast.error(result.message);
      }
    } else {
      const result = await signInAdminDirect({
        email: form.email.trim(),
        password: form.password,
        accessCode: form.accessCode.trim(),
      });
      if (result.ok) {
        toast.success(t("auth.loginToastWelcomeAdmin"));
        navigate("/admin");
      } else {
        toast.error(result.message);
      }
    }
  };

  // Submit the TOTP / backup code from the 2FA challenge panel.
  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    const raw = (twoFactor?.code || "").trim();
    if (!raw) {
      toast.error(
        twoFactor.useBackup
          ? t("auth.twoFactorErrorBackupRequired")
          : t("auth.twoFactorErrorAppRequired"),
      );
      return;
    }
    const payload = twoFactor.useBackup
      ? { challengeId: twoFactor.challengeId, backupCode: raw }
      : { challengeId: twoFactor.challengeId, totpCode: raw };
    const result = await completeScholar2fa(payload);
    if (result.ok) {
      toast.success(t("auth.loginToastWelcomeBack"));
      setTwoFactor(null);
      navigate("/scholar");
    } else {
      toast.error(result.message);
    }
  };

  const cancelTwoFactor = () => {
    setTwoFactor(null);
    setForm((f) => ({ ...f, password: "" }));
  };

  const hero = buildHero(t)[role];

  return (
    <>
      <Seo
        title={t("auth.loginSeoTitle")}
        description={t("auth.loginSeoDescription")}
        path="/login"
      />
      <AuthShell
        headline={hero.headline}
        subtitle={hero.subtitle}
        eyebrow={hero.eyebrow}
      >
        <AnimatePresence mode="wait">
          {twoFactor ? (
            <motion.div
              key="two-factor"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t("auth.twoFactorBadge")}
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                {t("auth.twoFactorTitle")}
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {twoFactor.useBackup
                  ? t("auth.twoFactorSubtitleBackup")
                  : t("auth.twoFactorSubtitleApp")}
              </p>

              <form className="mt-6 space-y-5" onSubmit={handleTwoFactorSubmit} noValidate>
                <Field
                  id="two-factor-code"
                  name="twoFactorCode"
                  label={twoFactor.useBackup ? t("auth.twoFactorBackupLabel") : t("auth.twoFactorAppLabel")}
                  icon={twoFactor.useBackup ? KeyRound : ShieldCheck}
                  placeholder={twoFactor.useBackup ? t("auth.twoFactorBackupPlaceholder") : t("auth.twoFactorAppPlaceholder")}
                  autoComplete="one-time-code"
                  value={twoFactor.code}
                  onChange={(e) =>
                    setTwoFactor((s) => ({ ...s, code: e.target.value }))
                  }
                />

                <motion.button
                  type="submit"
                  disabled={isSubmitting}
                  whileHover={isSubmitting ? undefined : { scale: 1.005 }}
                  whileTap={isSubmitting ? undefined : { scale: 0.99 }}
                  className={[
                    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#059669] text-sm font-bold text-white shadow-sm transition-all",
                    "hover:bg-[#047857] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30",
                    "disabled:cursor-not-allowed disabled:opacity-70",
                  ].join(" ")}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("auth.twoFactorVerifying")}
                    </>
                  ) : (
                    <>
                      {t("auth.twoFactorVerify")} <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setTwoFactor((s) => ({ ...s, useBackup: !s.useBackup, code: "" }))
                    }
                    className="font-semibold text-[#059669] hover:text-[#047857]"
                  >
                    {twoFactor.useBackup
                      ? t("auth.twoFactorUseApp")
                      : t("auth.twoFactorUseBackup")}
                  </button>
                  <button
                    type="button"
                    onClick={cancelTwoFactor}
                    className="font-medium text-slate-500 hover:text-slate-700"
                  >
                    {t("auth.twoFactorCancel")}
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {t("auth.loginFormTitle")}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {t("auth.loginFormSubtitle")}
            </p>

            <RoleIndicator
              verb={t("auth.loginVerbAs")}
              role={role}
              onChange={() => setModalOpen(true)}
            />

            {role === "scholar" && (
              <div className="mt-6 space-y-4">
                <GoogleButton label={t("auth.loginGoogleLabel")} returnTo="/scholar" />
                <div className="flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    {t("auth.orDivider")}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <Field
                id="login-email"
                name="email"
                type="email"
                label={t("auth.loginEmailLabel")}
                icon={Mail}
                placeholder={
                  role === "admin"
                    ? t("auth.loginEmailPlaceholderAdmin")
                    : t("auth.loginEmailPlaceholderScholar")
                }
                autoComplete="email"
                value={form.email}
                onChange={onChange}
                error={errors.email}
              />

              <Field
                id="login-password"
                name="password"
                label={t("auth.loginPasswordLabel")}
                icon={Lock}
                showToggle
                placeholder={t("auth.loginPasswordPlaceholder")}
                autoComplete="current-password"
                value={form.password}
                onChange={onChange}
                error={errors.password}
              />

              {role === "admin" && (
                <Field
                  id="login-access"
                  name="accessCode"
                  label={t("auth.loginAccessCodeLabel")}
                  icon={KeyRound}
                  placeholder={t("auth.loginAccessCodePlaceholder")}
                  autoComplete="one-time-code"
                  value={form.accessCode}
                  onChange={onChange}
                  error={errors.accessCode}
                />
              )}

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex cursor-pointer items-center gap-2 select-none text-slate-600">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={form.remember}
                    onChange={onChange}
                    className="h-4 w-4 rounded border-slate-300 text-[#059669] focus:ring-[#059669]"
                  />
                  {t("auth.rememberMe")}
                </label>
                {role === "admin" ? (
                  <a
                    href="mailto:security@schooladmin.com?subject=Admin%20Access%20Recovery"
                    className="font-semibold text-[#059669] hover:text-[#047857]"
                  >
                    {t("auth.forgot")}
                  </a>
                ) : (
                  <Link
                    to="/forgot-password"
                    className="font-semibold text-[#059669] hover:text-[#047857]"
                  >
                    {t("auth.forgot")}
                  </Link>
                )}
              </div>

              <motion.button
                type="submit"
                disabled={isSubmitting}
                whileHover={isSubmitting ? undefined : { scale: 1.005 }}
                whileTap={isSubmitting ? undefined : { scale: 0.99 }}
                className={[
                  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#059669] text-sm font-bold text-white shadow-sm transition-all",
                  "hover:bg-[#047857] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30",
                  "disabled:cursor-not-allowed disabled:opacity-70",
                ].join(" ")}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("auth.loginSubmitting")}
                  </>
                ) : (
                  <>
                    {t("auth.loginSubmit")} <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              <p className="text-center text-sm text-slate-500">
                {t("auth.loginNewHere")}{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-[#059669] hover:text-[#047857]"
                >
                  {t("auth.loginCreateAccount")}
                </Link>
              </p>
            </form>
          </motion.div>
          )}
        </AnimatePresence>
      </AuthShell>

      <AccountTypeModal
        open={modalOpen}
        currentRole={role}
        onClose={() => setModalOpen(false)}
        onConfirm={(next) => setRole(next)}
      />
    </>
  );
};

export default LoginPage;
