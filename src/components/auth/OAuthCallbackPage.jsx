import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import { Seo } from "../seo/Seo";

// Maps backend error codes → translation keys under `auth`.
const ERROR_KEYS = {
  google_denied: "auth.oauthErrorGoogleDenied",
  invalid_state: "auth.oauthErrorInvalidState",
  missing_code: "auth.oauthErrorMissingCode",
  token_exchange_failed: "auth.oauthErrorTokenExchange",
  userinfo_failed: "auth.oauthErrorUserInfo",
  unverified_google_email: "auth.oauthErrorUnverified",
  account_conflict: "auth.oauthErrorAccountConflict",
};

const sanitizeReturnTo = (raw) => {
  if (typeof raw !== "string" || !raw) return "/scholar";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/scholar";
  return raw.slice(0, 200);
};

const OAuthCallbackPage = () => {
  const { t } = useTranslation();
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
        message: ERROR_KEYS[error]
          ? t(ERROR_KEYS[error])
          : t("auth.oauthErrorFallback"),
      });
      return;
    }

    if (!token) {
      setStatus({
        kind: "error",
        message: t("auth.oauthErrorInvalidState"),
      });
      return;
    }

    (async () => {
      const result = await completeScholarOAuth(token);
      if (!result.ok) {
        setStatus({
          kind: "error",
          message: result.message || t("auth.oauthErrorGeneric"),
        });
        return;
      }
      toast.success(
        created
          ? t("auth.oauthToastWelcomeNew")
          : t("auth.oauthToastWelcomeBack"),
      );
      navigate(returnTo, { replace: true });
    })();
  }, [params, completeScholarOAuth, navigate, t]);

  return (
    <>
      <Seo title={t("auth.oauthSeoTitle")} noindex path="/auth/google" />
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          {status.kind === "loading" && (
            <>
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-emerald-600" />
              <h1 className="mt-4 text-lg font-semibold text-slate-900">
                {t("auth.oauthLoadingTitle")}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {t("auth.oauthLoadingBody")}
              </p>
            </>
          )}

          {status.kind === "error" && (
            <>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                <ShieldAlert className="h-6 w-6 text-rose-600" />
              </div>
              <h1 className="mt-4 text-lg font-semibold text-slate-900">
                {t("auth.oauthErrorTitle")}
              </h1>
              <p className="mt-2 text-sm text-slate-600">{status.message}</p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/login", { replace: true })}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  {t("auth.backToSignIn")}
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/", { replace: true })}
                  className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {t("auth.oauthGoHome")}
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
