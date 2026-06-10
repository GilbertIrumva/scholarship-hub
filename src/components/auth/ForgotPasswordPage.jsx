import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import AuthShell from "./shared/AuthShell";
import { Seo } from "../seo/Seo";
import { requestPasswordReset } from "../../services/scholarAccount";

const ForgotPasswordPage = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setDone(true);
      toast.success(t("auth.forgotToastSuccess"));
    } catch {
      toast.error(t("auth.forgotToastError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Seo title={t("auth.forgotSeoTitle")} path="/forgot-password" noindex />
      <AuthShell
      eyebrow={t("auth.forgotEyebrow")}
      headline={t("auth.forgotTitle")}
      subtitle={t("auth.forgotSubtitle")}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {done ? (
          <div className="rounded-2xl bg-emerald-50/60 p-5 ring-1 ring-emerald-100">
            <p className="font-bold text-emerald-900">{t("auth.forgotCheckInbox")}</p>
            <p className="mt-1 text-sm text-emerald-800">
              {t("auth.forgotCheckInboxPrefix")} <span className="font-semibold">{email}</span>{t("auth.forgotCheckInboxSuffix")}
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
            >
              {t("auth.backToSignIn")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="forgot-email" className="text-sm font-semibold text-slate-700">
                {t("auth.forgotEmailLabel")}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="forgot-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("auth.forgotEmailPlaceholder")}
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {submitting ? t("auth.forgotSubmitting") : t("auth.forgotSubmit")}
            </button>
            <p className="text-center text-sm text-slate-600">
              {t("auth.forgotRemembered")}{" "}
              <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
                {t("common.signIn")}
              </Link>
            </p>
          </form>
        )}
      </motion.div>
    </AuthShell>
    </>
  );
};

export default ForgotPasswordPage;
