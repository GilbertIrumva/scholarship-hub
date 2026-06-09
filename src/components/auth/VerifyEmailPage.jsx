import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailWarning, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import AuthShell from "./shared/AuthShell";
import { Seo } from "../seo/Seo";
import { verifyEmail, requestEmailVerification } from "../../services/scholarAccount";

const VerifyEmailPage = () => {
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
        setMessage("Your email is confirmed. You can close this tab and continue using ScholarshipZone.");
      })
      .catch((err) => {
        setState("error");
        setMessage(
          err.response?.data?.message ||
            "This link is invalid or has expired. Request a new verification email below."
        );
      });
  }, [token]);

  const onResend = async (event) => {
    event.preventDefault();
    if (!resendEmail) return;
    setResending(true);
    try {
      await requestEmailVerification(resendEmail);
      toast.success("If the account exists, a new verification email is on its way.");
    } catch {
      toast.error("Could not send a new verification email. Try again later.");
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <Seo title="Verify your email" path="/verify-email" noindex />
      <AuthShell
      eyebrow="Verify your email"
      headline="Confirm your address"
      subtitle="One last step to unlock every scholar feature."
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
            <p className="text-sm font-semibold text-emerald-900">Confirming your link…</p>
          </div>
        )}

        {state === "ok" && (
          <div className="flex items-start gap-3 rounded-2xl bg-emerald-50/60 p-4 ring-1 ring-emerald-100">
            <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-600" />
            <div>
              <p className="font-bold text-emerald-900">Email verified</p>
              <p className="mt-1 text-sm text-emerald-800">{message}</p>
              <Link
                to="/scholar"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 underline-offset-4 hover:underline"
              >
                Go to dashboard
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
                  <p className="font-semibold text-rose-900">Link not accepted</p>
                  <p className="mt-1 text-sm text-rose-800">{message}</p>
                </div>
              </div>
            )}
            {!token && (
              <div className="rounded-2xl bg-emerald-50/60 p-4 text-sm ring-1 ring-emerald-100">
                <p className="font-semibold text-emerald-900">No token in the link?</p>
                <p className="mt-1 text-emerald-800">
                  Use the form below to send yourself a fresh verification email.
                </p>
              </div>
            )}
            <form onSubmit={onResend} className="space-y-3">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="resend-email">
                Send a new link to
              </label>
              <input
                id="resend-email"
                type="email"
                required
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="you@school.edu"
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              />
              <button
                type="submit"
                disabled={resending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-60"
              >
                {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {resending ? "Sending…" : "Send verification email"}
              </button>
            </form>
            <p className="text-center text-sm text-slate-600">
              Already verified?{" "}
              <Link to="/login" className="font-semibold text-emerald-700 hover:underline">
                Sign in
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
