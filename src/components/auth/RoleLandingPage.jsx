import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  ShieldCheck,
  Users,
  Sparkles,
} from "lucide-react";
import { Seo } from "../seo/Seo";

// -----------------------------------------------------------------------------
// Role definitions (built per render so they pick up the active locale)
// -----------------------------------------------------------------------------
const buildRoles = (t) => [
  {
    id: "student",
    to: "/login?role=scholar",
    icon: GraduationCap,
    title: t("roleLanding.roleStudentTitle"),
    description: t("roleLanding.roleStudentDescription"),
    available: true,
  },
  {
    id: "admin",
    to: "/login?role=admin",
    icon: ShieldCheck,
    title: t("roleLanding.roleAdminTitle"),
    description: t("roleLanding.roleAdminDescription"),
    available: true,
  },
  {
    id: "mentor",
    to: null,
    icon: Users,
    title: t("roleLanding.roleMentorTitle"),
    description: t("roleLanding.roleMentorDescription"),
    available: false,
  },
];

// -----------------------------------------------------------------------------
// Reusable role card
// -----------------------------------------------------------------------------
const RoleCard = ({ role, selected, onSelect, onActivate, index }) => {
  const { t } = useTranslation();
  const Icon = role.icon;
  const disabled = !role.available;

  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        onSelect(role.id);
      }}
      onDoubleClick={() => {
        if (disabled) return;
        onActivate(role);
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (selected) {
            onActivate(role);
          } else {
            onSelect(role.id);
          }
        }
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.08 }}
      whileHover={disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={[
        "group relative flex w-full items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-200",
        "min-h-[85px] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30",
        disabled
          ? "cursor-not-allowed bg-slate-100 text-slate-400 ring-1 ring-slate-200"
          : selected
          ? "cursor-pointer bg-[#059669] text-white shadow-xl ring-2 ring-[#047857] ring-offset-2 ring-offset-[#F5F6F8]"
          : "cursor-pointer bg-[#059669] text-white shadow-md hover:shadow-lg hover:bg-[#047857]",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors",
          disabled
            ? "bg-slate-200 text-slate-400"
            : "bg-white/20 text-white backdrop-blur-sm group-hover:bg-white/25",
        ].join(" ")}
      >
        <Icon className="h-6 w-6" />
      </span>

      <span className="flex-1 min-w-0">
        <span
          className={[
            "block text-base font-bold leading-tight",
            disabled ? "text-slate-500" : "text-white",
          ].join(" ")}
        >
          {role.title}
        </span>
        <span
          className={[
            "mt-1 block text-sm font-medium leading-snug",
            disabled ? "text-slate-400" : "text-white/85",
          ].join(" ")}
        >
          {role.description}
        </span>
      </span>

      {!disabled && (
        <ArrowRight
          className={[
            "h-5 w-5 shrink-0 transition-transform",
            selected ? "translate-x-1 text-white" : "text-white/70 group-hover:translate-x-1",
          ].join(" ")}
        />
      )}

      {disabled && (
        <span className="shrink-0 rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {t("roleLanding.soonBadge")}
        </span>
      )}
    </motion.button>
  );
};

// -----------------------------------------------------------------------------
// Hero illustration (inline SVG — modern, no external asset needed)
// -----------------------------------------------------------------------------
const HeroIllustration = () => {
  const { t } = useTranslation();
  return (
  <motion.svg
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.7, ease: "easeOut" }}
    viewBox="0 0 480 360"
    className="w-full max-w-[460px] drop-shadow-2xl"
    role="img"
    aria-label={t("roleLanding.heroImageAlt")}
  >
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.15" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#E8F1FB" />
      </linearGradient>
    </defs>

    {/* Background blob */}
    <ellipse cx="240" cy="200" rx="220" ry="140" fill="url(#bgGrad)" />

    {/* Floating cards */}
    <g>
      <motion.rect
        x="60"
        y="80"
        width="120"
        height="80"
        rx="14"
        fill="url(#cardGrad)"
        animate={{ y: [80, 72, 80] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />
      <rect x="74" y="98" width="60" height="8" rx="4" fill="#059669" opacity="0.8" />
      <rect x="74" y="114" width="92" height="6" rx="3" fill="#94B8D9" />
      <rect x="74" y="126" width="70" height="6" rx="3" fill="#94B8D9" />
      <circle cx="160" cy="142" r="8" fill="#FFB547" />
    </g>

    <g>
      <motion.rect
        x="300"
        y="60"
        width="120"
        height="80"
        rx="14"
        fill="url(#cardGrad)"
        animate={{ y: [60, 52, 60] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />
      <circle cx="320" cy="82" r="10" fill="#059669" />
      <rect x="338" y="76" width="60" height="6" rx="3" fill="#94B8D9" />
      <rect x="338" y="88" width="40" height="6" rx="3" fill="#CBDDF0" />
      <rect x="314" y="108" width="92" height="24" rx="8" fill="#059669" opacity="0.15" />
      <rect x="324" y="116" width="50" height="8" rx="4" fill="#059669" />
    </g>

    {/* Central character group — abstract students */}
    <g transform="translate(160 170)">
      {/* Person 1 */}
      <circle cx="40" cy="40" r="26" fill="#FFD7B5" />
      <path d="M14 96 Q40 60 66 96 Z" fill="#FFB547" />
      <rect x="20" y="86" width="40" height="50" rx="10" fill="#047857" />
      <circle cx="32" cy="38" r="3" fill="#3B2E2A" />
      <circle cx="48" cy="38" r="3" fill="#3B2E2A" />
      <path d="M32 50 Q40 56 48 50" stroke="#3B2E2A" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Graduation cap */}
      <path d="M14 22 L40 12 L66 22 L40 32 Z" fill="#1E293B" />
      <rect x="38" y="22" width="4" height="10" fill="#FFB547" />

      {/* Person 2 */}
      <g transform="translate(110 10)">
        <circle cx="30" cy="35" r="22" fill="#E8B89A" />
        <path d="M8 88 Q30 56 52 88 Z" fill="#10B981" />
        <rect x="14" y="80" width="32" height="44" rx="9" fill="#10B981" />
        <circle cx="22" cy="34" r="2.5" fill="#3B2E2A" />
        <circle cx="38" cy="34" r="2.5" fill="#3B2E2A" />
        <path d="M22 44 Q30 50 38 44" stroke="#3B2E2A" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Hair */}
        <path d="M10 28 Q30 6 50 28 L50 36 Q40 22 30 22 Q20 22 10 36 Z" fill="#3B2E2A" />
      </g>
    </g>

    {/* Floating sparkles */}
    <motion.g
      animate={{ rotate: [0, 360] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "240px 200px" }}
    >
      <circle cx="100" cy="240" r="4" fill="#FFB547" />
      <circle cx="400" cy="260" r="5" fill="#10B981" />
      <circle cx="420" cy="180" r="3" fill="#ffffff" />
      <circle cx="80" cy="180" r="3" fill="#ffffff" />
    </motion.g>
  </motion.svg>
  );
};

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------
const RoleLandingPage = () => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState(null);
  const navigate = useNavigate();
  const roles = useMemo(() => buildRoles(t), [t]);

  const handleActivate = (role) => {
    if (role.available && role.to) {
      navigate(role.to);
    }
  };

  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      <Seo
        title={t("roleLanding.seoTitle")}
        description={t("roleLanding.seoDescription")}
        path="/get-started"
      />
      {/* ============================ LEFT: HERO ============================ */}
      <section className="relative flex w-full flex-col overflow-hidden bg-[#059669] text-white lg:w-[55%]">
        {/* Decorative shapes */}
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

        {/* Header / Logo */}
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
            to="/"
            className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/20 sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("roleLanding.backHome")}
          </Link>
        </header>

        {/* Hero centerpiece */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-12 text-center sm:px-10">
          <HeroIllustration />

          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("roleLanding.eyebrow")}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-5 max-w-xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-[48px]"
          >
            {t("roleLanding.heroTitle")}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-5 max-w-[500px] text-base leading-relaxed text-white/85 sm:text-lg"
          >
            {t("roleLanding.heroSubtitle")}
          </motion.p>
        </div>
      </section>

      {/* ============================ RIGHT: CARD ============================ */}
      <section className="flex w-full items-center justify-center bg-[#F5F6F8] px-4 py-12 sm:px-6 lg:w-[45%] lg:px-8 lg:py-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-[450px] rounded-[20px] bg-white p-8 shadow-[0_10px_40px_-12px_rgba(15,23,42,0.15)] sm:p-10"
        >
          {/* Mobile back link */}
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-900 lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("roleLanding.backHome")}
          </Link>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {t("roleLanding.panelTitle")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {t("roleLanding.panelSubtitle")}
          </p>

          {/* Role cards */}
          <div
            role="radiogroup"
            aria-label={t("roleLanding.chooseRoleAria")}
            className="mt-7 flex flex-col gap-4"
          >
            {roles.map((role, idx) => (
              <RoleCard
                key={role.id}
                role={role}
                index={idx}
                selected={selectedId === role.id}
                onSelect={setSelectedId}
                onActivate={handleActivate}
              />
            ))}
          </div>

          {/* Continue button (only when something selected) */}
          <motion.button
            type="button"
            onClick={() => {
              const role = roles.find((r) => r.id === selectedId);
              if (role) handleActivate(role);
            }}
            disabled={!selectedId}
            initial={false}
            animate={{ opacity: selectedId ? 1 : 0.5 }}
            whileHover={selectedId ? { scale: 1.01 } : undefined}
            whileTap={selectedId ? { scale: 0.99 } : undefined}
            className={[
              "mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-sm font-bold transition-all",
              "focus:outline-none focus-visible:ring-4 focus-visible:ring-[#059669]/30",
              selectedId
                ? "bg-slate-900 text-white shadow-md hover:bg-slate-800"
                : "cursor-not-allowed bg-slate-100 text-slate-400",
            ].join(" ")}
          >
            {t("roleLanding.continue")} <ArrowRight className="h-4 w-4" />
          </motion.button>

          {/* Existing-account footer */}
          <p className="mt-6 text-center text-sm text-slate-500">
            {t("roleLanding.existingAccount")}{" "}
            <Link
              to="/login/scholar"
              className="font-semibold text-[#059669] hover:text-[#047857]"
            >
              {t("common.signIn")}
            </Link>
          </p>
        </motion.div>
      </section>
    </main>
  );
};

export default RoleLandingPage;
