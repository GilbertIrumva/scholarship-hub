import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * AuthShell — split-screen wrapper for unified Login / Signup
 *
 * Left: solid blue hero with logo, illustration placeholder, headline & subtitle.
 * Right: light gray bg with centered white auth card (children).
 *
 * Props:
 *   headline:    string – large hero headline
 *   subtitle:    string – hero subtitle
 *   eyebrow:     string – small label above headline (optional)
 *   heroImage:   string – URL of illustration (defaults to placeholder)
 *   children:    react node – right-side auth card content
 */
const DEFAULT_HERO = "/pexels-ai25studioai-5306455.jpg";

const AuthShell = ({
  headline,
  subtitle,
  eyebrow,
  heroImage = DEFAULT_HERO,
  children,
}) => {
  const { t } = useTranslation();
  const resolvedEyebrow = eyebrow ?? t("auth.shellEyebrowDefault");

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* ===================== LEFT: EMERALD HERO ===================== */}
      <section className="relative flex w-full flex-col overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-800 text-white lg:w-[55%]">
        {/* decorative shapes */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-white/5 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Top logo */}
        <header className="relative z-10 flex items-center justify-between p-8 sm:p-10 lg:p-12">
          <Link
            to="/"
            className="group inline-flex items-center font-extrabold text-white"
          >
            <img
              src="/logo.png"
              alt="ScholarshipZone"
              className="h-20 w-auto object-contain drop-shadow-lg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </Link>

          <Link
            to="/get-started"
            className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/20 sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("auth.shellChooseRole")}
          </Link>
        </header>

        {/* Hero content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center sm:px-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative w-full max-w-[480px]"
          >
            {/* Glow halo behind image */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-white/15 blur-2xl" />
            <img
              src={heroImage}
              alt={t("auth.shellHeroAlt")}
              className="w-full rounded-[28px] object-cover shadow-2xl ring-1 ring-white/20"
              style={{ aspectRatio: "4 / 3" }}
            />
          </motion.div>

          {resolvedEyebrow && (
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {resolvedEyebrow}
            </motion.span>
          )}

          <motion.h1
            key={headline}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[48px]"
          >
            {headline}
          </motion.h1>

          <motion.p
            key={subtitle}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="mt-5 max-w-[500px] text-base leading-relaxed text-white/85 sm:text-lg"
          >
            {subtitle}
          </motion.p>
        </div>
      </section>

      {/* ===================== RIGHT: AUTH CARD ===================== */}
      <section className="flex w-full items-center justify-center bg-[#F5F6F8] px-4 py-12 sm:px-6 lg:w-[45%] lg:px-8 lg:py-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[500px] rounded-[20px] bg-white p-8 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.15)] sm:p-10"
        >
          {/* Mobile back link */}
          <Link
            to="/get-started"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("auth.shellChooseRole")}
          </Link>

          {children}
        </motion.div>
      </section>
    </main>
  );
};

export default AuthShell;
