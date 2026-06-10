import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import AuthShell from "./shared/AuthShell";
import { Seo } from "../seo/Seo";
import { PasswordStrengthMeter } from "../ui/password-strength";
import { resetPassword } from "../../services/scholarAccount";

const ResetPasswordPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordScore, setPasswordScore] = useState(0);
  const [passwordBreached, setPasswordBreached] = useState(false);

  const validate = () => {
    const next = {};
    if (!token) next.token = t("auth.resetValidationTokenMissing");
    if (!form.password || form.password.length < 8) next.password = t("auth.resetValidationPasswordMin");
    else if (passwordBreached)
      next.password = t("auth.passwordBreached");
    else if (passwordScore < 2)
      next.password = t("auth.passwordWeak");
    if (form.password !== form.confirm) next.confirm = t("auth.passwordsDontMatch");
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await resetPassword({ token, password: form.password });
      toast.success(t("auth.resetToastSuccess"));
      navigate("/login", { replace: true });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        t("auth.resetToastError");
      toast.error(message);
      setErrors((prev) => ({ ...prev, token: message }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title={t("auth.resetSeoTitle")} path="/reset-password" noindex />
      <AuthShell
      eyebrow={t("auth.resetEyebrow")}
      headline={t("auth.resetTitle")}
      subtitle={t("auth.resetSubtitle")}
    >
      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-5"
      >
        {errors.token && (
          <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800 ring-1 ring-rose-100">{errors.token}</div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="reset-password" className="text-sm font-semibold text-slate-700">
            {t("auth.resetNewPasswordLabel")}
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="reset-password"
              type={show ? "text" : "password"}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              tabIndex={-1}
              aria-label={show ? t("auth.passwordHide") : t("auth.passwordShow")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs font-medium text-rose-600">{errors.password}</p>}
          <PasswordStrengthMeter
            password={form.password}
            onEvaluate={({ score, breached }) => {
              setPasswordScore(score);
              setPasswordBreached(breached);
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reset-confirm" className="text-sm font-semibold text-slate-700">
            {t("auth.resetConfirmLabel")}
          </label>
          <input
            id="reset-confirm"
            type={show ? "text" : "password"}
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
          />
          {errors.confirm && <p className="text-xs font-medium text-rose-600">{errors.confirm}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting || !token}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {submitting ? t("auth.resetSubmitting") : t("auth.resetSubmit")}
        </button>

        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
            {t("auth.backToSignIn")}
          </Link>
        </p>
      </motion.form>
    </AuthShell>
    </>
  );
};

export default ResetPasswordPage;
