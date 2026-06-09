import { useState } from "react";
import { Loader2 } from "lucide-react";
import { buildGoogleStartUrl } from "../../../services/oauth";

// Official Google "G" mark — vendored as an inline SVG so we do not pull in
// another icon dependency. Colours from Google's brand guidelines.
const GoogleGlyph = ({ className = "h-5 w-5" }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M21.6 12.227c0-.71-.064-1.392-.182-2.045H12v3.868h5.385a4.603 4.603 0 0 1-1.997 3.022v2.51h3.232c1.892-1.742 2.98-4.31 2.98-7.355z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.7 0 4.964-.895 6.62-2.418l-3.232-2.51c-.896.6-2.042.955-3.388.955-2.605 0-4.81-1.76-5.598-4.123H3.064v2.59A9.997 9.997 0 0 0 12 22z"
    />
    <path
      fill="#FBBC05"
      d="M6.402 13.904a5.997 5.997 0 0 1 0-3.81V7.504H3.064a10.003 10.003 0 0 0 0 8.99l3.338-2.59z"
    />
    <path
      fill="#EA4335"
      d="M12 5.967c1.469 0 2.786.506 3.823 1.498l2.867-2.867C16.96 2.99 14.696 2 12 2A9.997 9.997 0 0 0 3.064 7.503l3.338 2.59C7.19 7.727 9.395 5.967 12 5.967z"
    />
  </svg>
);

/**
 * GoogleButton — "Continue with Google" CTA.
 *
 * Performs a full top-level navigation to /api/auth/google/start (NOT an XHR)
 * so the browser can follow Google's OAuth consent + redirect chain.
 *
 * Props:
 *   - label?: custom button label (defaults to "Continue with Google")
 *   - returnTo?: relative path the SPA should navigate to after success
 *   - className?: extra classes appended to the base button styles
 *   - disabled?: bool — externally lock the button (e.g. while another flow is mid-flight)
 */
const GoogleButton = ({
  label = "Continue with Google",
  returnTo = "/scholar",
  className = "",
  disabled = false,
}) => {
  const [redirecting, setRedirecting] = useState(false);

  const handleClick = () => {
    if (disabled || redirecting) return;
    setRedirecting(true);
    window.location.assign(buildGoogleStartUrl(returnTo));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || redirecting}
      className={[
        "inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all",
        "hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/20",
        "disabled:cursor-not-allowed disabled:opacity-70",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
    >
      {redirecting ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting…
        </>
      ) : (
        <>
          <GoogleGlyph className="h-5 w-5" />
          {label}
        </>
      )}
    </button>
  );
};

export default GoogleButton;
