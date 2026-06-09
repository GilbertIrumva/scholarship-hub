import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import { Seo } from "../seo/Seo";

// User-facing copy for the error codes the backend redirects with.
const ERROR_COPY = {
  google_denied: "Google sign-in was cancelled. You can try again any time.",
  invalid_state:
    "Your sign-in link expired or was tampered with. Please start the sign-in again.",
  missing_code:
    "Google did not return an authorization code. Please start the sign-in again.",
  token_exchange_failed:
    "We could not exchange the Google authorization code for a session. Please try again.",
  userinfo_failed:
    "We could not load your Google profile. Please try again in a moment.",
  unverified_google_email:
    "Google reports that this email address is not verified. Please verify it with Google and try again.",
  account_conflict:
    "Another account is already linked to this email. Try signing in with your password first.",
};

const sanitizeReturnTo = (raw) => {
  if (typeof raw !== "string" || !raw) return "/scholar";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/scholar";
  return raw.slice(0, 200);
};

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { completeScholarOAuth } = useAuth();
  const [status, setStatus] = useState({ kind: "loading", message: "" });
  // useRef so React 19 / Strict-Mode double-invocation of effects does not
  // burn the one-shot token by calling completeScholarOAuth twice.
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    consumedRef.current = true;

    const error = params.get("error");
    const token = params.get("token");
    const returnTo = sanitizeReturnTo(params.get("returnTo"));
    const created = params.get("created") === "1";

    if (error) {
      setStatus({
        kind: "error",
        message: ERROR_COPY[error] || "Google sign-in failed. Please try again.",
      });
      return;
    }

    if (!token) {
      setStatus({
        kind: "error",
        message: ERROR_COPY.invalid_state,
      });
      return;
    }

    (async () => {
      const result = await completeScholarOAuth(token);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message: result.message || "Unable to complete Google sign-in.",
        });
        return;
      }
      toast.success(created ? "Welcome to ScholarshipZone!" : "Welcome back!");
      navigate(returnTo, { replace: true });
    })();
  }, [params, completeScholarOAuth, navigate]);

  return (
    <>
      <Seo title="Signing you in…" noindex path="/auth/google" />
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          {status.kind === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
              <h1 className="mt-4 text-lg font-semibold text-slate-900">
                Finishing your Google sign-in…
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Hang tight — we&apos;re setting up your session.
              </p>
            </>
          )}

          {status.kind === "error" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                <ShieldAlert className="h-6 w-6 text-rose-600" />
              </div>
              <h1 className="mt-4 text-lg font-semibold text-slate-900">
                Google sign-in failed
              </h1>
              <p className="mt-2 text-sm text-slate-600">{status.message}</p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/login", { replace: true })}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  Back to sign in
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Go home
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
};

export default OAuthCallbackPage;
