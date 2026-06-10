import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserCircle,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import AuthShell from "./shared/AuthShell";
import AccountTypeModal from "./shared/AccountTypeModal";
import GoogleButton from "./shared/GoogleButton";
import { PasswordStrengthMeter } from "../ui/password-strength";
import { Seo } from "../seo/Seo";

// -----------------------------------------------------------------------------
// Hero copy (builder so we re-render on locale switch)
// -----------------------------------------------------------------------------
const buildHero = (t) => ({
  scholar: {
    headline: t("auth.signupHeroHeadline"),
    subtitle: t("auth.signupHeroSubtitleScholar"),
    eyebrow: t("auth.signupEyebrowScholar"),
  },
  admin: {
    headline: t("auth.signupHeroHeadline"),
    subtitle: t("auth.signupHeroSubtitleAdmin"),
    eyebrow: t("auth.signupEyebrowAdmin"),
  },
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const randomCode = (prefix = "") => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return prefix + out;
};

// -----------------------------------------------------------------------------
// Reusable input (duplicated locally for self-contained styling)
// -----------------------------------------------------------------------------
const Field = ({
  label,
  icon: Icon,
  error,
  type = "text",
  showToggle = false,
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
            showToggle ? "pr-12" : "pr-4",
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
      </div>
      {error && (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      )}
    </div>
  );
};

const RoleIndicator = ({ role, onChange }) => {
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
        {t("auth.signupVerbAs")} <span className="font-bold text-slate-900">{roleLabel}</span>
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
// STUDENT FORM
// =============================================================================
const StudentForm = ({ onDone, isSubmitting, signUp }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordBreached, setPasswordBreached] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = t("auth.signupValidationFirstName");
    if (!form.lastName.trim()) next.lastName = t("auth.signupValidationLastName");
    if (!form.username.trim()) next.username = t("auth.signupValidationUsername");
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = t("auth.emailInvalid");
    if (!form.password) next.password = t("auth.passwordRequired");
    else if (form.password.length < 8)
      next.password = t("auth.signupValidationPasswordMin");
    else if (passwordBreached)
      next.password = t("auth.passwordBreached");
    else if (passwordScore < 2)
      next.password = t("auth.passwordWeak");
    if (form.confirmPassword !== form.password)
      next.confirmPassword = t("auth.passwordsDontMatch");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error(t("auth.fixHighlightedFields"));
      return;
    }
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const result = await signUp({
      name: fullName,
      email: form.email.trim(),
      password: form.password,
    });
    if (result.ok) {
      toast.success(t("auth.signupToastWelcome"));
      onDone("scholar");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <div className="mt-6 space-y-4">
        <GoogleButton label={t("auth.signupGoogleLabel")} returnTo="/scholar" />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("auth.orDivider")}
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      </div>
      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="stu-first"
          name="firstName"
          label={t("auth.signupFirstNameLabel")}
          icon={User}
          placeholder={t("auth.signupFirstNamePlaceholder")}
          autoComplete="given-name"
          value={form.firstName}
          onChange={onChange}
          error={errors.firstName}
        />
        <Field
          id="stu-last"
          name="lastName"
          label={t("auth.signupLastNameLabel")}
          icon={User}
          placeholder={t("auth.signupLastNamePlaceholder")}
          autoComplete="family-name"
          value={form.lastName}
          onChange={onChange}
          error={errors.lastName}
        />
      </div>

      <Field
        id="stu-user"
        name="username"
        label={t("auth.signupUsernameLabel")}
        icon={UserCircle}
        placeholder={t("auth.signupUsernamePlaceholderScholar")}
        autoComplete="username"
        value={form.username}
        onChange={onChange}
        error={errors.username}
      />

      <Field
        id="stu-email"
        name="email"
        type="email"
        label={t("auth.signupEmailLabel")}
        icon={Mail}
        placeholder={t("auth.signupEmailPlaceholderScholar")}
        autoComplete="email"
        value={form.email}
        onChange={onChange}
        error={errors.email}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Field
            id="stu-pw"
            name="password"
            label={t("auth.signupPasswordLabel")}
            icon={Lock}
            showToggle
            placeholder={t("auth.signupPasswordPlaceholder")}
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
          />
          <PasswordStrengthMeter
            password={form.password}
            userInputs={[form.email, form.firstName, form.lastName, form.username]}
            onEvaluate={({ score, breached }) => {
              setPasswordScore(score);
              setPasswordBreached(breached);
            }}
          />
        </div>
        <Field
          id="stu-pw2"
          name="confirmPassword"
          label={t("auth.signupConfirmLabel")}
          icon={Lock}
          showToggle
          placeholder={t("auth.signupConfirmPlaceholder")}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting} label={t("auth.signupSubmitScholar")} />
    </form>
    </>
  );
};

// =============================================================================
// ADMIN FORM
// =============================================================================
const AdminForm = ({ onDone, isSubmitting, signUp }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    fullName: "",
    organization: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    inviteCode: "",
  });
  const [errors, setErrors] = useState({});
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordBreached, setPasswordBreached] = useState(false);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setErrors((er) => ({ ...er, [name]: "" }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = t("auth.signupValidationFullName");
    if (!form.organization.trim())
      next.organization = t("auth.signupValidationOrganization");
    if (!form.username.trim()) next.username = t("auth.signupValidationUsername");
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = t("auth.emailRequired");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = t("auth.emailInvalid");
    else if (!email.endsWith("@schooladmin.com"))
      next.email = t("auth.emailAdminDomain");
    if (!form.password) next.password = t("auth.passwordRequired");
    else if (form.password.length < 8)
      next.password = t("auth.signupValidationPasswordMin");
    else if (passwordBreached)
      next.password = t("auth.passwordBreached");
    else if (passwordScore < 2)
      next.password = t("auth.passwordWeak");
    if (form.confirmPassword !== form.password)
      next.confirmPassword = t("auth.passwordsDontMatch");
    if (!form.inviteCode.trim())
      next.inviteCode = t("auth.signupValidationInvite");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error(t("auth.fixHighlightedFields"));
      return;
    }

    // Map spec fields to the backend's admin schema.
    // Username is reused as both the department code (admin's personal login
    // code) and the 2FA code so the admin can sign in with a single value.
    const username = form.username.trim();
    const departmentCode = username || randomCode("ADM-");
    const twoFactorCode = username || randomCode();

    const result = await signUp({
      name: form.fullName.trim(),
      email: form.email.trim(),
      password: form.password,
      department: form.organization.trim(),
      departmentCode,
      twoFactorCode,
      inviteCode: form.inviteCode.trim(),
    });
    if (result.ok) {
      toast.success(
        t("auth.signupToastAdminCreated", { username }),
        { duration: 6000 },
      );
      onDone("admin");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
      <Field
        id="adm-name"
        name="fullName"
        label={t("auth.signupFullNameLabel")}
        icon={User}
        placeholder={t("auth.signupFullNamePlaceholder")}
        autoComplete="name"
        value={form.fullName}
        onChange={onChange}
        error={errors.fullName}
      />

      <Field
        id="adm-org"
        name="organization"
        label={t("auth.signupOrganizationLabel")}
        icon={Building2}
        placeholder={t("auth.signupOrganizationPlaceholder")}
        autoComplete="organization"
        value={form.organization}
        onChange={onChange}
        error={errors.organization}
      />

      <Field
        id="adm-user"
        name="username"
        label={t("auth.signupUsernameLabel")}
        icon={UserCircle}
        placeholder={t("auth.signupUsernamePlaceholderAdmin")}
        autoComplete="username"
        value={form.username}
        onChange={onChange}
        error={errors.username}
      />

      <Field
        id="adm-email"
        name="email"
        type="email"
        label={t("auth.signupEmailLabel")}
        icon={Mail}
        placeholder={t("auth.signupEmailPlaceholderAdmin")}
        autoComplete="email"
        value={form.email}
        onChange={onChange}
        error={errors.email}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <Field
            id="adm-pw"
            name="password"
            label={t("auth.signupPasswordLabel")}
            icon={Lock}
            showToggle
            placeholder={t("auth.signupPasswordPlaceholder")}
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={errors.password}
          />
          <PasswordStrengthMeter
            password={form.password}
            userInputs={[form.email, form.fullName, form.username, form.organization]}
            onEvaluate={({ score, breached }) => {
              setPasswordScore(score);
              setPasswordBreached(breached);
            }}
          />
        </div>
        <Field
          id="adm-pw2"
          name="confirmPassword"
          label={t("auth.signupConfirmLabel")}
          icon={Lock}
          showToggle
          placeholder={t("auth.signupConfirmPlaceholder")}
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword}
        />
      </div>

      <Field
        id="adm-invite"
        name="inviteCode"
        label={t("auth.signupInviteCodeLabel")}
        icon={KeyRound}
        placeholder={t("auth.signupInviteCodePlaceholder")}
        value={form.inviteCode}
        onChange={onChange}
        error={errors.inviteCode}
      />

      <SubmitButton isSubmitting={isSubmitting} label={t("auth.signupSubmitAdmin")} />
    </form>
  );
};

// -----------------------------------------------------------------------------
// Shared submit button
// -----------------------------------------------------------------------------
const SubmitButton = ({ isSubmitting, label }) => {
  const { t } = useTranslation();
  return (
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
          {t("auth.signupSubmitting")}
        </>
      ) : (
        <>
          {label} <ArrowRight className="h-4 w-4" />
        </>
      )}
    </motion.button>
  );
};

// =============================================================================
// MAIN PAGE
// =============================================================================
const SignupPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signUpAsScholar, signUpAsAdmin, isSubmitting } = useAuth();

  const initialRole = searchParams.get("role") === "admin" ? "admin" : "scholar";
  const [role, setRole] = useState(initialRole);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // no-op; placeholder for any future reset on role change
  }, [role]);

  const handleDone = (finishedRole) => {
    if (finishedRole === "scholar") {
      navigate("/scholar");
    } else {
      navigate("/login");
    }
  };

  const hero = buildHero(t)[role];

  return (
    <>
      <Seo
        title={t("auth.signupSeoTitle")}
        description={t("auth.signupSeoDescription")}
        path="/signup"
      />
      <AuthShell
        headline={hero.headline}
        subtitle={hero.subtitle}
        eyebrow={hero.eyebrow}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {t("auth.signupFormTitle")}
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              {t("auth.signupFormSubtitle")}
            </p>

            <RoleIndicator role={role} onChange={() => setModalOpen(true)} />

            {role === "scholar" ? (
              <StudentForm
                onDone={handleDone}
                isSubmitting={isSubmitting}
                signUp={signUpAsScholar}
              />
            ) : (
              <AdminForm
                onDone={handleDone}
                isSubmitting={isSubmitting}
                signUp={signUpAsAdmin}
              />
            )}

            <p className="mt-6 text-center text-sm text-slate-500">
              {t("auth.signupHaveAccount")}{" "}
              <Link
                to="/login"
                className="font-semibold text-[#059669] hover:text-[#047857]"
              >
                {t("common.signIn")}
              </Link>
            </p>
          </motion.div>
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

export default SignupPage;
