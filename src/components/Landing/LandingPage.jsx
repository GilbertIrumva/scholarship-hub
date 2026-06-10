import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  GraduationCap,
  Users,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Globe2,
  Mail,
  Phone,
  MapPin,
  Clock,
  ArrowRight,
  Menu,
  X,
  Check,
  Heart,
  Target,
  Eye,
  Compass,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getPublicFilters,
  getPublicStats,
  searchPublicScholarships,
} from "../../services/publicApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import LanguageSwitcher from "../common/LanguageSwitcher";
import { ThemeToggle } from "../ui/theme-toggle";
import { Seo } from "../seo/Seo";
import {
  EducationalOrganizationSchema,
  FAQSchema,
  WebSiteSchema,
} from "../seo/structured-data";
import heroImage from "../../assets/landing/hero.webp";
const impactPublicImage = "/pexels-mikhail-nilov-9158761.jpg";
import searchImage from "../../assets/landing/search.webp";
import contactImage from "../../assets/landing/contact.webp";
import stepProfileImage from "../../assets/landing/step-profile.webp";
import stepMatchImage from "../../assets/landing/step-match.webp";
import stepApplyImage from "../../assets/landing/step-apply.webp";
import missionImage from "../../assets/landing/mission.webp";
import visionImage from "../../assets/landing/vision.webp";

// =============================================================================
// CONSTANTS
// =============================================================================
const FALLBACK_STATS = {
  activeScholarships: 12,
  studentsPlaced: 248,
  totalApplicants: 1240,
};

const FALLBACK_FILTERS = {
  countries: ["DRC", "Kenya", "Rwanda", "Uganda", "Tanzania", "South Sudan"],
  grades: ["High School", "Diploma", "Undergraduate", "Graduate", "PhD"],
  fields: [
    "Engineering",
    "Computer Science",
    "Business",
    "Public Health",
    "Education",
    "Agriculture",
  ],
};

// =============================================================================
// I18N BUILDERS
// -----------------------------------------------------------------------------
// Constants below are *built* from the active i18n `t()` function so a language
// switch re-runs them through useMemo and re-renders translated strings.
// =============================================================================
const buildNavSections = (t) => [
  { id: "home", label: t("landing.navHome") },
  { id: "impact", label: t("landing.navImpact") },
  { id: "search", label: t("landing.navSearch") },
  { id: "how", label: t("landing.navHow") },
  { id: "about", label: t("landing.navAbout") },
  { id: "contact", label: t("landing.navContact") },
];

const buildTrustSignals = (t) => [
  {
    icon: ShieldCheck,
    title: t("landing.trustVerifiedTitle"),
    copy: t("landing.trustVerifiedCopy"),
  },
  {
    icon: Smartphone,
    title: t("landing.trustLowBwTitle"),
    copy: t("landing.trustLowBwCopy"),
  },
  {
    icon: Globe2,
    title: t("landing.trustPartnerTitle"),
    copy: t("landing.trustPartnerCopy"),
  },
];

const buildHowSteps = (t) => [
  {
    image: stepProfileImage,
    alt: t("landing.howStep1Alt"),
    title: t("landing.howStep1Title"),
    copy: t("landing.howStep1Copy"),
  },
  {
    image: stepMatchImage,
    alt: t("landing.howStep2Alt"),
    title: t("landing.howStep2Title"),
    copy: t("landing.howStep2Copy"),
  },
  {
    image: stepApplyImage,
    alt: t("landing.howStep3Alt"),
    title: t("landing.howStep3Title"),
    copy: t("landing.howStep3Copy"),
  },
];

const buildWhatWeDo = (t) => [
  { icon: Search,  title: t("landing.whatWeDoCurateTitle"),   copy: t("landing.whatWeDoCurateCopy") },
  { icon: Target,  title: t("landing.whatWeDoMatchTitle"),    copy: t("landing.whatWeDoMatchCopy") },
  { icon: Compass, title: t("landing.whatWeDoGuideTitle"),    copy: t("landing.whatWeDoGuideCopy") },
  { icon: Heart,   title: t("landing.whatWeDoChampionTitle"), copy: t("landing.whatWeDoChampionCopy") },
];

const buildWhyUs = (t) => [
  { num: "01", title: t("landing.whyUs01Title"), copy: t("landing.whyUs01Copy") },
  { num: "02", title: t("landing.whyUs02Title"), copy: t("landing.whyUs02Copy") },
  { num: "03", title: t("landing.whyUs03Title"), copy: t("landing.whyUs03Copy") },
  { num: "04", title: t("landing.whyUs04Title"), copy: t("landing.whyUs04Copy") },
  { num: "05", title: t("landing.whyUs05Title"), copy: t("landing.whyUs05Copy") },
  { num: "06", title: t("landing.whyUs06Title"), copy: t("landing.whyUs06Copy") },
];

// FAQ surfaced only as JSON-LD (no visible component on landing).
// Kept in English because Google's structured-data guidelines expect a single
// language per document; if/when we add hreflang variants we can translate.
const LANDING_FAQ = [
  {
    q: "Who can apply for scholarships on ScholarshipZone?",
    a: "Any student in our supported regions (currently Eastern Africa, with more on the way) can create a free profile and apply. We focus on underserved scholars but the platform is open to all.",
  },
  {
    q: "Does ScholarshipZone charge fees?",
    a: "No. The platform is free for scholars — there are no application fees and no premium tier. Funders and partner institutions support our work.",
  },
  {
    q: "How do you verify scholarships?",
    a: "Every listing is reviewed by a human before it goes live. We confirm the funder, the application deadline, eligibility, and award amount with primary sources.",
  },
  {
    q: "What if I have a slow internet connection?",
    a: "The whole platform is built mobile-first and tuned for low bandwidth. Application drafts auto-save, images are optimised, and pages work on basic Android devices.",
  },
  {
    q: "How is my personal data handled?",
    a: "We collect only what is needed to support your applications. We never sell scholar data and follow strict privacy and security practices — see our Privacy page for details.",
  },
];

// =============================================================================
// HOOKS
// =============================================================================
// Shared class for native <select> — surface-aware (works in dark mode),
// crisp 1px border, refined focus ring matching the design system.
const SELECT_CLS =
  "flex h-10 w-full rounded-lg border border-border bg-surface px-3 py-2 text-small text-ink shadow-elev-1 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40";

const useCountUp = (target, durationMs = 1200) => {
  const [value, setValue] = useState(0);
  const frame = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const to = Number(target) || 0;
    const step = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(to * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [target, durationMs]);
  return value;
};

const useScrollSpy = (ids, offset = 120) => {
  const [active, setActive] = useState(ids[0] || "");
  useEffect(() => {
    const handler = () => {
      const scrollY = window.scrollY + offset;
      let current = ids[0] || "";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= scrollY) current = id;
      }
      setActive(current);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [ids, offset]);
  return active;
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================
const StatCard = ({ value, label, live, icon: Icon }) => {
  const display = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1] }}
      className="hover-lift relative rounded-2xl border border-border bg-surface p-6 shadow-elev-2 hover:shadow-elev-3"
    >
      {Icon && (
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="text-h2 text-ink">
        {display.toLocaleString()}
        <span className="text-primary">+</span>
      </div>
      <div className="mt-1 text-small font-medium text-muted">{label}</div>
      {live && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-caption font-semibold uppercase tracking-wider text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          Live
        </span>
      )}
    </motion.div>
  );
};

const ResultCard = ({ item }) => {
  const deadline = item.deadline ? new Date(item.deadline) : null;
  const deadlineLabel = deadline
    ? deadline.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Rolling";
  const chips = [...(item.grades || []).slice(0, 2), ...(item.fields || []).slice(0, 2)];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="group hover-lift rounded-2xl border border-border bg-surface p-5 shadow-elev-1 hover:border-primary/40 hover:shadow-elev-3"
    >
      <h3 className="text-h4 text-ink group-hover:text-primary transition-colors">
        {item.title}
      </h3>
      <div className="mt-1 text-small font-semibold text-muted">{item.provider}</div>
      {item.description && (
        <p className="mt-3 text-small text-muted line-clamp-3">{item.description}</p>
      )}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-caption font-semibold uppercase tracking-wider text-primary-dark"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-small">
        <span className="text-muted">Deadline · <span className="font-semibold text-ink">{deadlineLabel}</span></span>
        {item.amount > 0 && (
          <span className="font-bold text-accent-dark tracking-tight">
            {item.currency || "USD"} {Number(item.amount).toLocaleString()}
          </span>
        )}
      </div>
    </motion.article>
  );
};

const SectionHeader = ({ eyebrow, title, subtitle, align = "center" }) => (
  <motion.header
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.55, ease: [0.25, 1, 0.5, 1] }}
    className={`mb-12 sm:mb-14 ${align === "center" ? "text-center max-w-2xl mx-auto" : "max-w-3xl"}`}
  >
    {eyebrow && <span className="eyebrow">{eyebrow}</span>}
    <h2 className="mt-5 text-h2 text-ink">{title}</h2>
    {subtitle && <p className="mt-4 text-lead">{subtitle}</p>}
  </motion.header>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const LandingPage = () => {
  const { t, i18n } = useTranslation();

  // Memoised, translated content sets. Re-built whenever the active i18n
  // language changes, which is exactly what causes the page to switch
  // languages on the fly.
  const NAV_SECTIONS = useMemo(() => buildNavSections(t), [t, i18n.language]);
  const TRUST_SIGNALS = useMemo(() => buildTrustSignals(t), [t, i18n.language]);
  const HOW_STEPS = useMemo(() => buildHowSteps(t), [t, i18n.language]);
  const WHAT_WE_DO = useMemo(() => buildWhatWeDo(t), [t, i18n.language]);
  const WHY_US = useMemo(() => buildWhyUs(t), [t, i18n.language]);

  const [stats, setStats] = useState(FALLBACK_STATS);
  const [filters, setFilters] = useState(FALLBACK_FILTERS);
  const [selection, setSelection] = useState({ country: "", grade: "", field: "" });
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const activeSection = useScrollSpy(NAV_SECTIONS.map((s) => s.id));

  const [contact, setContact] = useState({ name: "", email: "", topic: "general", message: "" });
  const [contactSending, setContactSending] = useState(false);

  // Load stats + filters
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getPublicStats(), getPublicFilters()]).then(
      ([statsRes, filtersRes]) => {
        if (cancelled) return;
        if (statsRes.status === "fulfilled") setStats(statsRes.value);
        if (filtersRes.status === "fulfilled") {
          const next = filtersRes.value || {};
          setFilters({
            countries: next.countries?.length ? next.countries : FALLBACK_FILTERS.countries,
            grades: next.grades?.length ? next.grades : FALLBACK_FILTERS.grades,
            fields: next.fields?.length ? next.fields : FALLBACK_FILTERS.fields,
          });
        }
      }
    );
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSearched(true);
    try {
      const data = await searchPublicScholarships(selection);
      setResults(data.items || []);
    } catch {
      toast.error(t("landing.catalogError"));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const resultsLabel = useMemo(() => {
    if (loading) return t("landing.searching");
    if (!searched) return null;
    if (results.length === 0) return t("landing.searchNoMatches");
    return t("landing.searchMatches", { count: results.length });
  }, [loading, searched, results.length, t]);

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const { name, email, message } = contact;
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error(t("landing.contactErrorFields"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error(t("landing.contactErrorEmail"));
      return;
    }

    setContactSending(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...contact, name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      if (!res.ok) throw new Error("Bad response");
      toast.success(t("landing.contactSuccess"));
      setContact({ name: "", email: "", topic: "general", message: "" });
    } catch {
      toast.error(t("landing.contactErrorNetwork"));
    } finally {
      setContactSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-ink antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-elev-3"
      >
        {t("landing.skipToMain")}
      </a>
      <Seo
        title={t("landing.seoTitle")}
        description={t("landing.seoDescription")}
        path="/"
        keywords={t("landing.seoKeywords")}
      />
      <EducationalOrganizationSchema />
      <WebSiteSchema />
      <FAQSchema items={LANDING_FAQ} />

      {/* ===================== NAV ===================== */}
      <nav
        aria-label={t("landing.navPrimaryAria")}
        className="sticky top-3 z-50 mx-auto mt-3 flex w-[min(100%-1.5rem,80rem)] items-center justify-between gap-4 rounded-2xl border border-border/80 bg-surface/80 px-4 py-2.5 shadow-nav backdrop-blur-xl supports-[backdrop-filter]:bg-surface/65 sm:px-6"
      >
        <Link to="/" className="flex shrink-0 items-center font-extrabold text-ink" aria-label={t("landing.navHomeAria")}>
          <img
            src="/logo.png"
            alt=""
            className="h-14 w-auto shrink-0 object-contain sm:h-16"
          />
          <span className="sr-only">ScholarshipZone</span>
        </Link>

        <ul className="hidden lg:flex flex-1 items-center justify-center gap-0.5">
          {NAV_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                aria-current={activeSection === section.id ? "true" : undefined}
                className={`rounded-lg px-3 py-2 text-small font-semibold tracking-tight transition-colors duration-200 ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary-dark"
                    : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-1.5">
          <Link
            to="/grade-converter"
            className="hidden md:inline-flex items-center gap-1 rounded-lg px-3 py-2 text-small font-semibold text-primary-dark hover:bg-primary/10 transition-colors"
          >
            {t("landing.navGradeConverter")}
          </Link>
          <Link
            to="/login/admin"
            className="hidden md:inline-flex text-small font-semibold text-muted hover:text-ink transition-colors px-2"
          >
            {t("landing.navAdmin")}
          </Link>
          <LanguageSwitcher variant="compact" className="hidden md:inline-flex" />
          <ThemeToggle variant="icon" className="hidden md:inline-flex" />
          <Button asChild size="sm">
            <Link to="/login/scholar">{t('common.signIn')}</Link>
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-lg border border-border text-ink transition-colors hover:bg-surface-2"
            aria-label={menuOpen ? t("landing.navClose") : t("landing.navOpen")}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="lg:hidden mx-auto mt-2 w-[min(100%-1.5rem,80rem)] overflow-hidden rounded-2xl border border-border bg-surface shadow-nav"
          >
            <ul className="flex flex-col p-2">
              {NAV_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-small font-semibold text-ink transition-colors hover:bg-surface-2"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
              <li className="md:hidden border-t border-border mt-2 pt-2">
                <Link
                  to="/grade-converter"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-small font-semibold text-primary-dark hover:bg-primary/10"
                >
                  {t("landing.navGradeConverter")}
                </Link>
                <Link
                  to="/login/admin"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-small font-semibold text-muted hover:bg-surface-2"
                >
                  {t("landing.navAdminSignIn")}
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <main id="main" className="focus:outline-none" tabIndex={-1}>

      {/* ===================== HERO ===================== */}
      <section id="home" aria-labelledby="hero-title" className="relative mx-auto mt-6 w-[min(100%-1.5rem,80rem)]">
        <div className="relative overflow-hidden rounded-3xl shadow-modal">
          <img
            src={heroImage}
            alt=""
            className="h-[clamp(28rem,75vh,44rem)] w-full object-cover"
            loading="eager"
            decoding="async"
            fetchpriority="high"
          />
          {/* Layered, refined gradient — deeper at the bottom-left, lifts content cleanly. */}
          <div className="absolute inset-0 bg-gradient-to-tr from-black/85 via-black/55 to-black/20" aria-hidden="true" />
          <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_100%,rgba(5,150,105,0.35),transparent_55%)]" aria-hidden="true" />
          <div className="absolute inset-0 flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="w-full px-4 sm:px-8 lg:px-16"
            >
              <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur-md">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {t("landing.heroEyebrow")}
              </span>
              {/*
                Two-line headline: first clause on line 1, gradient
                accent phrase on line 2. Each line is `nowrap` so words
                inside a line never break, but the explicit <br /> forces
                the visual line break between the two clauses.
                Font auto-scales so the longer of the two lines always fits.
              */}
              <h1
                id="hero-title"
                className="mt-5 font-display font-extrabold text-white"
                style={{
                  color: "#ffffff",
                  fontSize: "clamp(1.1rem, calc(4vw - 0.25rem), 3.5rem)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.04em",
                  textShadow: "0 2px 28px rgba(0,0,0,0.4)",
                }}
              >
                <span style={{ display: "block", whiteSpace: "nowrap" }}>
                  {t("landing.heroTitle")}
                </span>
                <span
                  className="bg-gradient-to-r from-accent to-yellow-300 bg-clip-text text-transparent"
                  style={{ display: "block", whiteSpace: "nowrap" }}
                >
                  {t("landing.heroTitleAccent")}
                </span>
              </h1>
              <p
                className="mt-5 max-w-[80ch] text-white/85"
                style={{
                  fontSize: "clamp(0.875rem, 0.8rem + 0.4vw, 1.125rem)",
                  lineHeight: 1.55,
                  textWrap: "pretty",
                }}
              >
                {t("landing.heroSubtitle")}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-elev-3">
                  <Link to="/signup/scholar">
                    {t("landing.heroCtaPrimary")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-white/10 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/20 hover:text-white"
                >
                  <a href="#search">{t("landing.heroCtaSecondary")}</a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===================== TRUST SIGNALS ===================== */}
      <section aria-label={t("landing.trustAria")} className="mx-auto mt-16 w-[min(100%-1.5rem,80rem)]">
        <div className="grid gap-5 md:grid-cols-3">
          {TRUST_SIGNALS.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.25, 1, 0.5, 1] }}
              className="hover-lift rounded-2xl border border-border bg-surface p-6 shadow-elev-2 hover:border-primary/30 hover:shadow-elev-3"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-h4 text-ink">{item.title}</h3>
              <p className="mt-2 text-small text-muted">{item.copy}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== IMPACT ===================== */}
      <section id="impact" aria-labelledby="impact-title" className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <SectionHeader
          eyebrow={t("landing.impactEyebrow")}
          title={t("landing.impactTitle")}
          subtitle={t("landing.impactSubtitle")}
        />
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl shadow-card"
          >
            <img src={impactPublicImage} alt={t("landing.impactImageAlt")} className="h-full w-full object-cover" loading="lazy" />
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard value={stats.activeScholarships} label={t("landing.statActiveScholarships")} live icon={Award} />
            <StatCard value={stats.studentsPlaced} label={t("landing.statStudentsPlaced")} icon={GraduationCap} />
            <StatCard value={stats.totalApplicants} label={t("landing.statApplicants")} icon={Users} />
            <StatCard value={45} label={t("landing.statPartners")} icon={Globe2} />
          </div>
        </div>
      </section>

      {/* ===================== SEARCH ===================== */}
      <section id="search" aria-labelledby="search-title" className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <SectionHeader
          eyebrow={t("landing.searchEyebrow")}
          title={t("landing.searchTitle")}
          subtitle={t("landing.searchSubtitle")}
        />

        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-5">
            <div className="relative lg:col-span-2 hidden lg:block">
              <img
                src={searchImage}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-surface/40" aria-hidden="true" />
            </div>
            <form onSubmit={handleSubmit} className="lg:col-span-3 p-6 sm:p-8 space-y-5" aria-labelledby="search-title">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country">{t("landing.searchCountryLabel")}</Label>
                  <select
                    id="country"
                    className={SELECT_CLS}
                    value={selection.country}
                    onChange={(e) => setSelection((s) => ({ ...s, country: e.target.value }))}
                  >
                    <option value="">{t("landing.searchCountryAny")}</option>
                    {filters.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grade">{t("landing.searchGradeLabel")}</Label>
                  <select
                    id="grade"
                    className={SELECT_CLS}
                    value={selection.grade}
                    onChange={(e) => setSelection((s) => ({ ...s, grade: e.target.value }))}
                  >
                    <option value="">{t("landing.searchGradeAny")}</option>
                    {filters.grades.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="field">{t("landing.searchFieldLabel")}</Label>
                  <select
                    id="field"
                    className={SELECT_CLS}
                    value={selection.field}
                    onChange={(e) => setSelection((s) => ({ ...s, field: e.target.value }))}
                  >
                    <option value="">{t("landing.searchFieldAny")}</option>
                    {filters.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
                {loading ? t("landing.searching") : <>{t("landing.searchSubmit")} <Search className="h-4 w-4" aria-hidden="true" /></>}
              </Button>
            </form>
          </div>
        </Card>

        {/* RESULTS */}
        {(searched || loading) && (
          <div className="mt-8" aria-live="polite">
            {resultsLabel && (
              <div className="mb-4 text-small font-semibold text-muted">{resultsLabel}</div>
            )}
            {results.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => <ResultCard key={item._id || item.title} item={item} />)}
              </div>
            )}
            {!loading && searched && results.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-small text-muted shadow-elev-1">
                {t("landing.searchEmpty")}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" aria-labelledby="how-title" className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <SectionHeader
          eyebrow={t("landing.howEyebrow")}
          title={t("landing.howTitle")}
          subtitle={t("landing.howSubtitle")}
        />
        <div className="grid gap-6 md:grid-cols-3">
          {HOW_STEPS.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: idx * 0.12, ease: [0.25, 1, 0.5, 1] }}
              className="group hover-lift relative overflow-hidden rounded-2xl border border-border bg-surface shadow-elev-2 hover:border-primary/30 hover:shadow-elev-3"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img
                  src={step.image}
                  alt={step.alt}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  loading="lazy"
                />
              </div>
              <div className="p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-extrabold tracking-tight ring-4 ring-primary/15">
                  {idx + 1}
                </span>
                <h3 className="mt-4 text-h4 text-ink">{step.title}</h3>
                <p className="mt-2 text-small text-muted">{step.copy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" aria-labelledby="about-title" className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <SectionHeader
          eyebrow={t("landing.aboutEyebrow")}
          title={t("landing.aboutTitle")}
          subtitle={t("landing.aboutSubtitle")}
        />

        {/* Mission + Vision */}
        <div className="grid gap-6 md:grid-cols-2 mb-16">
          {[
            { img: missionImage, tag: t("landing.missionTag"), icon: Target, title: t("landing.missionTitle"), copy: t("landing.missionCopy") },
            { img: visionImage,  tag: t("landing.visionTag"),  icon: Eye,    title: t("landing.visionTitle"),  copy: t("landing.visionCopy") },
          ].map((item, idx) => (
            <motion.article
              key={item.tag}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: idx * 0.08, ease: [0.25, 1, 0.5, 1] }}
              className="group hover-lift overflow-hidden rounded-2xl border border-border bg-surface shadow-elev-2 hover:border-primary/30 hover:shadow-elev-3"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img src={item.img} alt="" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" loading="lazy" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  <span className="text-caption font-bold uppercase tracking-widest text-primary-dark">{item.tag}</span>
                </div>
                <h3 className="mt-3 text-h3 text-ink">{item.title}</h3>
                <p className="mt-3 text-body text-muted">{item.copy}</p>
              </div>
            </motion.article>
          ))}
        </div>

        {/* What we do */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-h3 text-ink">{t("landing.whatWeDoHeading")}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_DO.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.06, ease: [0.25, 1, 0.5, 1] }}
                className="hover-lift rounded-2xl border border-border bg-surface p-5 shadow-elev-1 hover:border-primary/40 hover:shadow-elev-3"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h4 className="mt-4 text-h5 text-ink">{item.title}</h4>
                <p className="mt-2 text-small text-muted">{item.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Why us */}
        <div>
          <h3 className="mb-8 text-center text-h3 text-ink">{t("landing.whyUsHeading")}</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_US.map((item, idx) => (
              <motion.div
                key={item.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: idx * 0.04, ease: [0.25, 1, 0.5, 1] }}
                className="hover-lift relative rounded-2xl border border-border bg-surface p-6 shadow-elev-1 hover:border-primary/40 hover:shadow-elev-3"
              >
                <span className="pointer-events-none absolute top-4 right-5 text-h2 font-extrabold text-primary/10 select-none" aria-hidden="true">{item.num}</span>
                <Check className="h-6 w-6 text-primary" aria-hidden="true" />
                <h4 className="mt-3 text-h5 text-ink">{item.title}</h4>
                <p className="mt-2 text-small text-muted">{item.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CONTACT ===================== */}
      <section id="contact" aria-labelledby="contact-title" className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <SectionHeader
          eyebrow={t("landing.contactEyebrow")}
          title={t("landing.contactTitle")}
          subtitle={t("landing.contactSubtitle")}
        />

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Info */}
          <aside className="lg:col-span-2 space-y-4">
            <div className="overflow-hidden rounded-2xl shadow-elev-2">
              <img src={contactImage} alt="" className="h-48 w-full object-cover" loading="lazy" />
            </div>
            {[
              { icon: Mail,  label: t("landing.contactEmailLabel"),   value: "hello@scholarshipzone.org", href: "mailto:hello@scholarshipzone.org" },
              { icon: Phone, label: t("landing.contactPartnerLabel"), value: t("landing.contactPartnerValue") },
              { icon: MapPin, label: t("landing.contactOfficeLabel"), value: t("landing.contactOfficeValue") },
              { icon: Clock, label: t("landing.contactHoursLabel"),   value: t("landing.contactHoursValue") },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-elev-1">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <item.icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-small font-bold text-ink">{item.label}</div>
                  {item.href ? (
                    <a href={item.href} className="text-small text-primary hover:underline break-all">{item.value}</a>
                  ) : (
                    <div className="text-small text-muted">{item.value}</div>
                  )}
                </div>
              </div>
            ))}
          </aside>

          {/* Form */}
          <Card className="lg:col-span-3">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleContactSubmit} className="space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-name">{t("landing.contactNameLabel")}</Label>
                    <Input
                      id="contact-name"
                      placeholder={t("landing.contactNamePlaceholder")}
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">{t("landing.contactEmailFieldLabel")}</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder={t("landing.contactEmailPlaceholder")}
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-topic">{t("landing.contactTopicLabel")}</Label>
                  <select
                    id="contact-topic"
                    className={SELECT_CLS}
                    value={contact.topic}
                    onChange={(e) => setContact((c) => ({ ...c, topic: e.target.value }))}
                  >
                    <option value="general">{t("landing.contactTopicGeneral")}</option>
                    <option value="scholar">{t("landing.contactTopicScholar")}</option>
                    <option value="partner">{t("landing.contactTopicPartner")}</option>
                    <option value="listing">{t("landing.contactTopicListing")}</option>
                    <option value="press">{t("landing.contactTopicPress")}</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message">{t("landing.contactMessageLabel")}</Label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    placeholder={t("landing.contactMessagePlaceholder")}
                    className="flex w-full rounded-lg border border-border bg-surface px-3 py-2 text-small text-ink placeholder:text-muted shadow-elev-1 transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 resize-none"
                    value={contact.message}
                    onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" size="lg" disabled={contactSending}>
                  {contactSending ? t("landing.contactSending") : <>{t("landing.contactSend")} <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===================== CTA BAND ===================== */}
      <section aria-label={t("landing.ctaAria")} className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-emerald-900 p-10 sm:p-16 text-center shadow-modal"
        >
          <div className="absolute inset-0 opacity-10" aria-hidden="true">
            <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-h1 text-white" style={{ textShadow: "0 2px 24px rgba(0,0,0,0.25)" }}>
              {t("landing.ctaTitle")}
            </h2>
            <p
              className="mx-auto mt-4 max-w-[55ch] bg-gradient-to-r from-accent to-yellow-300 bg-clip-text font-semibold"
              style={{
                color: "transparent",
                WebkitTextFillColor: "transparent",
                fontSize: "var(--text-lead)",
                lineHeight: 1.55,
              }}
            >
              {t("landing.ctaCopy")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="accent">
                <Link to="/signup/scholar">{t("landing.ctaPrimary")} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-white/10 text-white backdrop-blur-md hover:border-white/40 hover:bg-white/20 hover:text-white"
              >
                <Link to="/login/scholar">{t("landing.ctaSecondary")}</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>
      </main>

      {/* ===================== FOOTER ===================== */}
      <footer className="mx-auto mt-20 w-[min(100%-1.5rem,80rem)] pb-10">
        <div className="border-t border-border pt-10">
          <nav aria-label={t("landing.footerNavAria")} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-small">
            <Link to="/login/scholar" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerScholar")}</Link>
            <Link to="/login/admin" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerAdmin")}</Link>
            <Link to="/get-started" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerPortals")}</Link>
            <Link to="/privacy" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerPrivacy")}</Link>
            <Link to="/terms" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerTerms")}</Link>
            <Link to="/accessibility" className="text-muted hover:text-primary font-medium transition-colors">{t("landing.footerAccessibility")}</Link>
          </nav>
          <div className="mt-8 text-center text-small text-muted">
            {t("landing.footerCopy", { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
