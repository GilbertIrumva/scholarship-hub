import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailWarning, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import AuthShell from "./shared/AuthShell";
import { Seo } from "../seo/Seo";
import { verifyEmail, requestEmailVerification } from "../../services/scholarAccount";

const VerifyEmailPage = () => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState(token ? "verifying" : "idle");
  const [message, setMessage] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    setState("verifying");
    verifyEmail(token)
      .then(() => {
        setState("ok");
        setMessage(t("auth.verifyOkBody"));
      })
      .catch((err) => {
        setState("error");
        setMessage(
          err.response?.data?.message ||
            t("auth.verifyErrorDefault")
        );
      });
  }, [token, t]);

  const onResend = async (event) => {
    event.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      await requestEmailVerification(resendEmail);
      toast.success(t("auth.verifyToastSuccess"));
    } catch {
      toast.error(t("auth.verifyToastError"));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Seo title={t("auth.verifySeoTitle")} path="/verify-email" noindex />
      <AuthShell
      eyebrow={t("auth.verifyEyebrow")}
      headline={t("auth.verifyTitle")}
      subtitle={t("auth.verifySubtitle")}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6 text-slate-800"
      >
        {state === "verifying" && (
          <div className="flex items-center gap-3 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-900">{t("auth.verifying")}</p>
          </div>
        )}

        {state === "ok" && (
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-900">{t("auth.verifyOk")}</p>
              <p className="mt-1 text-sm text-emerald-800">{message}</p>
              <Link
                to="/scholar"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
              >
                {t("auth.verifyGoDashboard")}
              </Link>
            </div>
          </div>
        )}

        {(state === "error" || state === "idle") && (
          <div className="space-y-5">
            {state === "error" && (
              <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
                <MailWarning className="mt-0.5 h-5 w-5 text-rose-600" />
                <div>
                  <p className="font-semibold text-rose-900">{t("auth.verifyLinkRejected")}</p>
                  <p className="mt-1 text-sm text-rose-800">{message}</p>
                </div>
              </div>
            )}
            {!token && (
              <div className="rounded-2xl bg-emerald-50/60 p-4 text-sm ring-1 ring-emerald-100">
                <p className="font-semibold text-emerald-900">{t("auth.verifyNoTokenTitle")}</p>
                <p className="mt-1 text-emerald-800">
                  {t("auth.verifyNoTokenBody")}
                </p>
              </div>
            )}
            <form onSubmit={onResend} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="resend-email">
                {t("auth.verifyResendLabel")}
              </label>
              <input
                id="resend-email"
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder={t("auth.verifyResendPlaceholder")}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={resending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {resending ? t("auth.verifyResending") : t("auth.sendVerification")}
              </button>
            </form>
            <p className="text-center text-sm text-slate-600">
              {t("auth.verifyAlreadyVerified")}{" "}
              <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
                {t("common.signIn")}
              </Link>
            </p>
          </div>
        )}
      </motion.div>
    </AuthShell>
    </>
  );
};

export default VerifyEmailPage;
