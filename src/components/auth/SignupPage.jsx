import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
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
// Hero copy
// -----------------------------------------------------------------------------
const HERO = {
  scholar: {
    headline: "Start Learning",
    subtitle: "Join the community.",
    eyebrow: "Get started",
  },
  admin: {
    headline: "Start Learning",
    subtitle: "Set up your admin account.",
    eyebrow: "Admin onboarding",
  },
};

const ROLE_LABEL = { scholar: "Student", admin: "Admin" };

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
            aria-label={show ? "Hide password" : "Show password"}
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

const RoleIndicator = ({ role, onChange }) => (
  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      {role === "admin" ? (
        <ShieldCheck className="h-4 w-4 text-[#059669]" />
      ) : (
        <GraduationCap className="h-4 w-4 text-[#059669]" />
      )}
      Joining as <span className="font-bold text-slate-900">{ROLE_LABEL[role]}</span>
    </span>
    <button
      type="button"
      onClick={onChange}
      className="text-sm font-semibold text-[#059669] underline-offset-4 transition-colors hover:text-[#047857] hover:underline"
    >
      Change account type
    </button>
  </div>
);

// =============================================================================
// STUDENT FORM
// =============================================================================
const StudentForm = ({ onDone, isSubmitting, signUp }) => {
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
    if (!form.firstName.trim()) next.firstName = "First name is required.";
    if (!form.lastName.trim()) next.lastName = "Last name is required.";
    if (!form.username.trim()) next.username = "Username is required.";
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8)
      next.password = "Use at least 8 characters.";
    else if (passwordBreached)
      next.password =
        "This password appeared in a known data breach. Please choose a different one.";
    else if (passwordScore < 2)
      next.password = "Please choose a stronger password.";
    if (form.confirmPassword !== form.password)
      next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the highlighted fields.");
      return;
    }
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const result = await signUp({
      name: fullName,
      email: form.email.trim(),
      password: form.password,
    });
    if (result.ok) {
      toast.success("Welcome to ScholarshipZone!");
      onDone("scholar");
    } else {
      toast.error(result.message);
    }
  };

  return (
    <>
      <div className="mt-6 space-y-4">
        <GoogleButton label="Sign up with Google" returnTo="/scholar" />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            or
          </span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      </div>
      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="stu-first"
          name="firstName"
          label="First Name"
          icon={User}
          placeholder="Jane"
          autoComplete="given-name"
          value={form.firstName}
          onChange={onChange}
          error={errors.firstName}
        />
        <Field
          id="stu-last"
          name="lastName"
          label="Last Name"
          icon={User}
          placeholder="Scholar"
          autoComplete="family-name"
          value={form.lastName}
          onChange={onChange}
          error={errors.lastName}
        />
      </div>

      <Field
        id="stu-user"
        name="username"
        label="Username"
        icon={UserCircle}
        placeholder="jane.scholar"
        autoComplete="username"
        value={form.username}
        onChange={onChange}
        error={errors.username}
      />

      <Field
        id="stu-email"
        name="email"
        type="email"
        label="Email"
        icon={Mail}
        placeholder="you@example.com"
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
            label="Password"
            icon={Lock}
            showToggle
            placeholder="Min. 8 chars"
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
          label="Confirm"
          icon={Lock}
          showToggle
          placeholder="Repeat"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword}
        />
      </div>

      <SubmitButton isSubmitting={isSubmitting} label="Create Account" />
    </form>
    </>
  );
};

// =============================================================================
// ADMIN FORM
// =============================================================================
const AdminForm = ({ onDone, isSubmitting, signUp }) => {
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
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.organization.trim())
      next.organization = "Organization name is required.";
    if (!form.username.trim()) next.username = "Username is required.";
    const email = form.email.trim().toLowerCase();
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email.";
    else if (!email.endsWith("@schooladmin.com"))
      next.email = "Admin email must use @schooladmin.com.";
    if (!form.password) next.password = "Password is required.";
    else if (form.password.length < 8)
      next.password = "Use at least 8 characters.";
    else if (passwordBreached)
      next.password =
        "This password appeared in a known data breach. Please choose a different one.";
    else if (passwordScore < 2)
      next.password = "Please choose a stronger password.";
    if (form.confirmPassword !== form.password)
      next.confirmPassword = "Passwords do not match.";
    if (!form.inviteCode.trim())
      next.inviteCode = "An admin invite code is required.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the highlighted fields.");
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
        `Admin account created. Sign in using your username (${username}) as the access code.`,
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
        label="Full Name"
        icon={User}
        placeholder="Operations Admin"
        autoComplete="name"
        value={form.fullName}
        onChange={onChange}
        error={errors.fullName}
      />

      <Field
        id="adm-org"
        name="organization"
        label="Organization"
        icon={Building2}
        placeholder="Admissions Office"
        autoComplete="organization"
        value={form.organization}
        onChange={onChange}
        error={errors.organization}
      />

      <Field
        id="adm-user"
        name="username"
        label="Username"
        icon={UserCircle}
        placeholder="ops.admin (also your access code)"
        autoComplete="username"
        value={form.username}
        onChange={onChange}
        error={errors.username}
      />

      <Field
        id="adm-email"
        name="email"
        type="email"
        label="Email"
        icon={Mail}
        placeholder="name@schooladmin.com"
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
            label="Password"
            icon={Lock}
            showToggle
            placeholder="Min. 8 chars"
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
          label="Confirm"
          icon={Lock}
          showToggle
          placeholder="Repeat"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={errors.confirmPassword}
        />
      </div>

      <Field
        id="adm-invite"
        name="inviteCode"
        label="Invite Code"
        icon={KeyRound}
        placeholder="From an existing admin"
        value={form.inviteCode}
        onChange={onChange}
        error={errors.inviteCode}
      />

      <SubmitButton isSubmitting={isSubmitting} label="Create Admin Account" />
    </form>
  );
};

// -----------------------------------------------------------------------------
// Shared submit button
// -----------------------------------------------------------------------------
const SubmitButton = ({ isSubmitting, label }) => (
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
        Creating account…
      </>
    ) : (
      <>
        {label} <ArrowRight className="h-4 w-4" />
      </>
    )}
  </motion.button>
);

// =============================================================================
// MAIN PAGE
// =============================================================================
const SignupPage = () => {
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

  const hero = HERO[role];

  return (
    <>
      <Seo
        title="Create your account"
        description="Create a free ScholarshipZone account to discover verified scholarships, apply with one profile, and never miss a deadline."
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
              Create Account
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              It only takes a minute.
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
              Have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-[#059669] hover:text-[#047857]"
              >
                Sign in
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
