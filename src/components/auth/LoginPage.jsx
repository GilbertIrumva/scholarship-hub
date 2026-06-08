import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
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

// -----------------------------------------------------------------------------
// Hero copy per role
// -----------------------------------------------------------------------------
const HERO = {
  scholar: {
    headline: "Welcome Back",
    subtitle: "Sign in to keep learning.",
    eyebrow: "Sign in",
  },
  admin: {
    headline: "Welcome Back",
    subtitle: "Secure access to your console.",
    eyebrow: "Admin sign in",
  },
};

const ROLE_LABEL = { scholar: "Student", admin: "Admin" };

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
            aria-label={show ? "Hide password" : "Show password"}
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
const RoleIndicator = ({ verb, role, onChange }) => (
  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      {role === "admin" ? (
        <ShieldCheck className="h-4 w-4 text-[#059669]" />
      ) : (
        <GraduationCap className="h-4 w-4 text-[#059669]" />
      )}
      {verb} as <span className="font-bold text-slate-900">{ROLE_LABEL[role]}</span>
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
// MAIN PAGE
// =============================================================================
const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInAsScholar, signInAdminDirect, isSubmitting } = useAuth();

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
    if (!email) next.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Enter a valid email.";
    else if (role === "admin" && !email.endsWith("@schooladmin.com"))
      next.email = "Admin email must use @schooladmin.com.";

    if (!form.password) next.password = "Password is required.";

    if (role === "admin" && !form.accessCode.trim())
      next.accessCode = "Admin access code is required.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      toast.error("Please correct the highlighted fields.");
      return;
    }

    if (role === "scholar") {
      const result = await signInAsScholar({
        email: form.email.trim(),
        password: form.password,
      });
      if (result.ok) {
        toast.success("Welcome back!");
        navigate("/scholar");
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
        toast.success("Welcome back, Admin.");
        navigate("/admin");
      } else {
        toast.error(result.message);
      }
    }
  };

  const hero = HERO[role];

  return (
    <>
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
              Sign In
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Enter your credentials.
            </p>

            <RoleIndicator
              verb="Logging in"
              role={role}
              onChange={() => setModalOpen(true)}
            />

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              <Field
                id="login-email"
                name="email"
                type="email"
                label="Email"
                icon={Mail}
                placeholder={
                  role === "admin" ? "name@schooladmin.com" : "you@example.com"
                }
                autoComplete="email"
                value={form.email}
                onChange={onChange}
                error={errors.email}
              />

              <Field
                id="login-password"
                name="password"
                label="Password"
                icon={Lock}
                showToggle
                placeholder="••••••••"
                autoComplete="current-password"
                value={form.password}
                onChange={onChange}
                error={errors.password}
              />

              {role === "admin" && (
                <Field
                  id="login-access"
                  name="accessCode"
                  label="Access Code"
                  icon={KeyRound}
                  placeholder="Department or 2FA code"
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
                  Remember Me
                </label>
                <a
                  href={
                    role === "admin"
                      ? "mailto:security@schooladmin.com?subject=Admin%20Access%20Recovery"
                      : "mailto:support@scholarshipzone.org?subject=Password%20Reset"
                  }
                  className="font-semibold text-[#059669] hover:text-[#047857]"
                >
                  Forgot?
                </a>
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
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </motion.button>

              <p className="text-center text-sm text-slate-500">
                New here?{" "}
                <Link
                  to="/signup"
                  className="font-semibold text-[#059669] hover:text-[#047857]"
                >
                  Create account
                </Link>
              </p>
            </form>
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

export default LoginPage;
