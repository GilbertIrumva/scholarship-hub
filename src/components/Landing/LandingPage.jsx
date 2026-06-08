import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import heroImage from "../../assets/landing/hero.webp";
import impactImage from "../../assets/landing/impact.webp";
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

const NAV_SECTIONS = [
  { id: "home", label: "Home" },
  { id: "impact", label: "Impact" },
  { id: "search", label: "Find Scholarships" },
  { id: "how", label: "How It Works" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
];

const TRUST_SIGNALS = [
  {
    icon: ShieldCheck,
    title: "Verified opportunities",
    copy: "Every listing is reviewed before it reaches scholars, reducing dead links, expired calls, and low-quality submissions.",
  },
  {
    icon: Smartphone,
    title: "Built for low bandwidth",
    copy: "Lightweight, mobile-first, and designed to work reliably on slower connections and basic devices.",
  },
  {
    icon: Globe2,
    title: "Partner-ready workflows",
    copy: "Scholar support, scholarship intake, and applicant routing are structured so schools, NGOs, and sponsors can work at scale.",
  },
];

const HOW_STEPS = [
  {
    image: stepProfileImage,
    alt: "Student filling profile details on a mobile device",
    title: "Create your profile",
    copy: "A short, mobile-friendly form. Save your draft and continue whenever you have signal.",
  },
  {
    image: stepMatchImage,
    alt: "Students discussing opportunities around a laptop",
    title: "Get matched",
    copy: "We surface scholarships that fit your country, grade, and field — no scrolling through hundreds of irrelevant listings.",
  },
  {
    image: stepApplyImage,
    alt: "Student preparing documents for scholarship application",
    title: "Apply with one click",
    copy: "Reuse your profile across applications and track every deadline from a single dashboard.",
  },
];

const WHAT_WE_DO = [
  { icon: Search, title: "Curate", copy: "We hand-verify scholarships from foundations, NGOs, and universities so no one wastes time on dead links or scams." },
  { icon: Target, title: "Match", copy: "Smart filters surface scholarships that actually fit each scholar's country, grade level, and field of study." },
  { icon: Compass, title: "Guide", copy: "Step-by-step application support, deadline tracking, and mentor connections — built for low-bandwidth networks." },
  { icon: Heart, title: "Champion", copy: "We follow scholars from first application to first day on campus — and celebrate every placement, loudly." },
];

const WHY_US = [
  { num: "01", title: "Verified, not vague", copy: "Every listing is reviewed by a real human before it reaches your dashboard — no broken links, no expired calls." },
  { num: "02", title: "Designed for slow networks", copy: "The whole platform is engineered to work on a basic phone with a weak signal. Speed is access." },
  { num: "03", title: "Privacy by default", copy: "We collect only what is needed to support applications, and keep scholar data out of ad-tech and data resale workflows." },
  { num: "04", title: "Free for scholars, forever", copy: "No application fees. No premium tier. Funding is for students, not platforms." },
  { num: "05", title: "Local context first", copy: "Built with — not for — communities in Eastern Africa and beyond. Real stories shape every feature." },
  { num: "06", title: "Always learning", copy: "We treat every applicant's feedback as a roadmap, and ship improvements every single week." },
];

// =============================================================================
// HOOKS
// =============================================================================
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
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative rounded-2xl border border-border bg-white p-6 shadow-card hover:shadow-lg transition-shadow"
    >
      {Icon && (
        <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="text-4xl font-extrabold text-ink tracking-tight">
        {display.toLocaleString()}+
      </div>
      <div className="mt-1 text-sm font-medium text-muted">{label}</div>
      {live && (
        <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
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
      className="group rounded-xl border border-border bg-white p-5 shadow-card hover:border-primary hover:shadow-lg transition-all"
    >
      <h3 className="text-lg font-bold text-ink group-hover:text-primary transition-colors">
        {item.title}
      </h3>
      <div className="mt-1 text-sm font-semibold text-muted">{item.provider}</div>
      {item.description && (
        <p className="mt-3 text-sm text-slate-600 line-clamp-3">{item.description}</p>
      )}
      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <span
              key={c}
              className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary-dark"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
        <span className="text-muted">Deadline: <span className="font-semibold text-ink">{deadlineLabel}</span></span>
        {item.amount > 0 && (
          <span className="font-bold text-accent-dark">
            {item.currency || "USD"} {Number(item.amount).toLocaleString()}
          </span>
        )}
      </div>
    </motion.article>
  );
};

const SectionHeader = ({ eyebrow, title, subtitle, align = "center" }) => (
  <motion.header
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className={`mb-12 ${align === "center" ? "text-center max-w-2xl mx-auto" : ""}`}
  >
    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-dark">
      {eyebrow}
    </span>
    <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
      {title}
    </h2>
    {subtitle && (
      <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">{subtitle}</p>
    )}
  </motion.header>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================
const LandingPage = () => {
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
      toast.error("We couldn't reach the catalog. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const resultsLabel = useMemo(() => {
    if (loading) return "Searching…";
    if (!searched) return null;
    if (results.length === 0) return "No scholarships matched those filters.";
    return `${results.length} match${results.length === 1 ? "" : "es"} found`;
  }, [loading, searched, results.length]);

  const handleContactSubmit = async (event) => {
    event.preventDefault();
    const { name, email, message } = contact;
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in your name, email, and message.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("That email address doesn't look right.");
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
      toast.success("Thanks! We'll get back to you within one working day.");
      setContact({ name: "", email: "", topic: "general", message: "" });
    } catch {
      toast.error("Couldn't send your message. Please email hello@scholarshipzone.org.");
    } finally {
      setContactSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      {/* ===================== NAV ===================== */}
      <nav className="sticky top-3 z-50 mx-auto mt-3 flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-border bg-white/85 px-4 py-3 shadow-nav backdrop-blur-md sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2 font-extrabold text-ink">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white text-sm font-extrabold tracking-wider">
            SH
          </span>
          <span className="hidden sm:block text-base">ScholarshipZone</span>
        </Link>

        <ul className="hidden lg:flex flex-1 items-center justify-center gap-1">
          {NAV_SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  activeSection === section.id
                    ? "bg-primary/10 text-primary-dark"
                    : "text-muted hover:bg-slate-100 hover:text-ink"
                }`}
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex shrink-0 items-center gap-2">
          <Link to="/grade-converter" className="hidden md:inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-primary-dark hover:bg-primary/10 transition-colors">
            Grade converter
          </Link>
          <Link to="/login/admin" className="hidden md:block text-sm font-semibold text-muted hover:text-ink transition-colors px-2">
            Admin
          </Link>
          <Button asChild size="sm">
            <Link to="/login/scholar">Sign in</Link>
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-lg border border-border text-ink"
            aria-label="Toggle navigation"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden mx-auto mt-2 max-w-7xl overflow-hidden rounded-2xl border border-border bg-white shadow-nav"
          >
            <ul className="flex flex-col p-2">
              {NAV_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-ink hover:bg-slate-100"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
              <li className="md:hidden border-t border-border mt-2 pt-2">
                <Link to="/grade-converter" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary-dark hover:bg-primary/10">
                  Grade converter
                </Link>
                <Link to="/login/admin" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-muted hover:bg-slate-100">
                  Admin sign in
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== HERO ===================== */}
      <section id="home" className="relative mx-auto mt-6 max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl shadow-modal">
          <img
            src={heroImage}
            alt="Happy students laughing and collaborating"
            className="h-[560px] w-full object-cover sm:h-[640px]"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/75 via-black/55 to-black/30" />
          <div className="absolute inset-0 flex items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="max-w-3xl px-6 sm:px-12 lg:px-16"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" />
                The Gateway to Opportunity
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
                Your academic journey doesn't end at the{" "}
                <span className="bg-gradient-to-r from-accent to-yellow-300 bg-clip-text text-transparent">
                  campus gates
                </span>
                .
              </h1>
              <p className="mt-6 max-w-2xl text-base text-white/90 sm:text-lg leading-relaxed">
                ScholarshipZone connects displaced and underserved students to verified
                scholarships, mentors, and pathways — wherever you are, whatever your grade.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="shadow-lg">
                  <Link to="/signup/scholar">
                    Join the Hub <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 hover:text-white">
                  <a href="#search">Explore scholarships</a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ===================== TRUST SIGNALS ===================== */}
      <section className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {TRUST_SIGNALS.map((item, idx) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="rounded-2xl border border-border bg-white p-6 shadow-card hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{item.copy}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== IMPACT ===================== */}
      <section id="impact" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Our Impact"
          title="A community growing in real time"
          subtitle="Every number below updates from live applications and placements."
        />
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-3xl shadow-card"
          >
            <img src={impactPublicImage} alt="Students celebrating an academic milestone" className="h-full w-full object-cover" loading="lazy" />
          </motion.div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard value={stats.activeScholarships} label="Active Scholarships" live icon={Award} />
            <StatCard value={stats.studentsPlaced} label="Students Placed" icon={GraduationCap} />
            <StatCard value={stats.totalApplicants} label="Applicants Onboarded" icon={Users} />
            <StatCard value={45} label="Partner Organizations" icon={Globe2} />
          </div>
        </div>
      </section>

      {/* ===================== SEARCH ===================== */}
      <section id="search" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Quick Search"
          title="Find your match in 10 seconds"
          subtitle="Filter scholarships by where you're from, where you are in school, and what you want to study. No account needed."
        />

        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-5">
            <div className="lg:col-span-2 hidden lg:block">
              <img src={searchImage} alt="A student exploring scholarships" className="h-full w-full object-cover" loading="lazy" />
            </div>
            <form onSubmit={handleSubmit} className="lg:col-span-3 p-6 sm:p-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country of origin</Label>
                  <select
                    id="country"
                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={selection.country}
                    onChange={(e) => setSelection((s) => ({ ...s, country: e.target.value }))}
                  >
                    <option value="">Any country</option>
                    {filters.countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grade">Current grade</Label>
                  <select
                    id="grade"
                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={selection.grade}
                    onChange={(e) => setSelection((s) => ({ ...s, grade: e.target.value }))}
                  >
                    <option value="">Any level</option>
                    {filters.grades.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="field">Desired field</Label>
                  <select
                    id="field"
                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={selection.field}
                    onChange={(e) => setSelection((s) => ({ ...s, field: e.target.value }))}
                  >
                    <option value="">Any field</option>
                    {filters.fields.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Searching…" : <>Search scholarships <Search className="h-4 w-4" /></>}
              </Button>
            </form>
          </div>
        </Card>

        {/* RESULTS */}
        {(searched || loading) && (
          <div className="mt-8" aria-live="polite">
            {resultsLabel && (
              <div className="mb-4 text-sm font-semibold text-muted">{resultsLabel}</div>
            )}
            {results.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {results.map((item) => <ResultCard key={item._id || item.title} item={item} />)}
              </div>
            )}
            {!loading && searched && results.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-white p-8 text-center text-sm text-muted">
                Try widening your filters — many scholarships accept applicants from multiple countries and fields.
              </div>
            )}
          </div>
        )}
      </section>

      {/* ===================== HOW IT WORKS ===================== */}
      <section id="how" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="How It Works"
          title="Three steps to your next opportunity"
          subtitle="Built lean for slow networks: every step works on a basic phone."
        />
        <div className="grid gap-6 md:grid-cols-3">
          {HOW_STEPS.map((step, idx) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.15 }}
              className="group relative overflow-hidden rounded-2xl border border-border bg-white shadow-card hover:shadow-xl transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img src={step.image} alt={step.alt} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white font-extrabold">
                  {idx + 1}
                </span>
                <h3 className="mt-4 text-xl font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">{step.copy}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="About the Hub"
          title="Bridging brilliant minds with the opportunities they deserve"
          subtitle="ScholarshipZone was built for the students the world too often overlooks — and the institutions that want to find them."
        />

        {/* Mission + Vision */}
        <div className="grid gap-6 md:grid-cols-2 mb-16">
          {[
            { img: missionImage, tag: "Our Mission", icon: Target, title: "Turn potential into placement.", copy: "We exist to dismantle the barriers between displaced, low-income, and underserved students and the scholarships that can change their lives. Verified opportunities. Plain-language guidance. Zero gatekeeping." },
            { img: visionImage, tag: "Our Vision", icon: Eye, title: "A world where talent — not geography — decides who gets to study.", copy: "A future in which every refugee camp, rural school, and urban under-resourced classroom is one tap away from a fair shot at higher education." },
          ].map((item, idx) => (
            <motion.article
              key={item.tag}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: idx * 0.1 }}
              className="group overflow-hidden rounded-2xl border border-border bg-white shadow-card hover:shadow-xl transition-all"
            >
              <div className="aspect-[16/9] overflow-hidden">
                <img src={item.img} alt={item.tag} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-dark">{item.tag}</span>
                </div>
                <h3 className="mt-3 text-xl sm:text-2xl font-bold text-ink leading-tight">{item.title}</h3>
                <p className="mt-3 text-sm sm:text-base text-muted leading-relaxed">{item.copy}</p>
              </div>
            </motion.article>
          ))}
        </div>

        {/* What we do */}
        <div className="mb-16">
          <h3 className="mb-8 text-center text-2xl font-extrabold text-ink">Four moves, one outcome: students enrolled.</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHAT_WE_DO.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.08 }}
                className="rounded-xl border border-border bg-white p-5 shadow-card hover:shadow-lg hover:border-primary/50 transition-all"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <h4 className="mt-4 text-base font-bold text-ink">{item.title}</h4>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Why us */}
        <div>
          <h3 className="mb-8 text-center text-2xl font-extrabold text-ink">Built lean. Trusted by scholars. Loved by partners.</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_US.map((item, idx) => (
              <motion.div
                key={item.num}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                className="relative rounded-xl border border-border bg-white p-6 shadow-card hover:shadow-lg transition-all"
              >
                <span className="absolute top-4 right-4 text-3xl font-extrabold text-primary/10">{item.num}</span>
                <Check className="h-6 w-6 text-primary" />
                <h4 className="mt-3 text-base font-bold text-ink">{item.title}</h4>
                <p className="mt-2 text-sm text-muted leading-relaxed">{item.copy}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CONTACT ===================== */}
      <section id="contact" className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <SectionHeader
          eyebrow="Get in Touch"
          title="Questions, partnerships, or a scholarship to list?"
          subtitle="Tell us a little about you and we'll route your message to the right person. We reply within one working day."
        />

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Info */}
          <aside className="lg:col-span-2 space-y-4">
            <div className="overflow-hidden rounded-2xl shadow-card">
              <img src={contactImage} alt="Scholarship support team" className="h-48 w-full object-cover" loading="lazy" />
            </div>
            {[
              { icon: Mail, label: "Email", value: "hello@scholarshipzone.org", href: "mailto:hello@scholarshipzone.org" },
              { icon: Phone, label: "Partner support", value: "WhatsApp & direct support during onboarding" },
              { icon: MapPin, label: "Office", value: "Nairobi, Kenya · East Africa & global" },
              { icon: Clock, label: "Hours", value: "Mon — Fri, 09:00 — 17:00 EAT" },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 rounded-xl border border-border bg-white p-4 shadow-card">
                <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-ink">{item.label}</div>
                  {item.href ? (
                    <a href={item.href} className="text-sm text-primary hover:underline break-all">{item.value}</a>
                  ) : (
                    <div className="text-sm text-muted">{item.value}</div>
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
                    <Label htmlFor="contact-name">Your name</Label>
                    <Input
                      id="contact-name"
                      placeholder="Jane Doe"
                      value={contact.name}
                      onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contact-email">Email address</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="you@example.com"
                      value={contact.email}
                      onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-topic">I'm reaching out about</Label>
                  <select
                    id="contact-topic"
                    className="flex h-10 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    value={contact.topic}
                    onChange={(e) => setContact((c) => ({ ...c, topic: e.target.value }))}
                  >
                    <option value="general">General question</option>
                    <option value="scholar">I'm a scholar / applicant</option>
                    <option value="partner">Partnership or sponsorship</option>
                    <option value="listing">Listing a scholarship</option>
                    <option value="press">Press / media</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-message">Your message</Label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    placeholder="Tell us what's on your mind…"
                    className="flex w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary resize-none"
                    value={contact.message}
                    onChange={(e) => setContact((c) => ({ ...c, message: e.target.value }))}
                    required
                  />
                </div>
                <Button type="submit" size="lg" disabled={contactSending}>
                  {contactSending ? "Sending…" : <>Send message <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ===================== CTA BAND ===================== */}
      <section className="mx-auto mt-24 max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-green-900 p-10 sm:p-16 text-center shadow-modal"
        >
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 h-64 w-64 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-accent blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to take the next step?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-white/90 max-w-xl mx-auto">
              Create a free scholar profile to save matches, track deadlines, and apply with one click.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="accent">
                <Link to="/signup/scholar">Join the Hub <ArrowRight className="h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20 hover:text-white">
                <Link to="/login/scholar">I already have an account</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 pb-10">
        <div className="border-t border-border pt-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-white text-sm font-extrabold">SH</span>
              <span className="font-extrabold text-ink">ScholarshipZone</span>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              <Link to="/login/scholar" className="text-muted hover:text-primary font-medium">Scholar sign in</Link>
              <Link to="/login/admin" className="text-muted hover:text-primary font-medium">Admin sign in</Link>
              <Link to="/get-started" className="text-muted hover:text-primary font-medium">All portals</Link>
              <Link to="/privacy" className="text-muted hover:text-primary font-medium">Privacy</Link>
              <Link to="/terms" className="text-muted hover:text-primary font-medium">Terms</Link>
              <Link to="/accessibility" className="text-muted hover:text-primary font-medium">Accessibility</Link>
            </nav>
          </div>
          <div className="mt-8 text-center text-sm text-muted">
            © {new Date().getFullYear()} ScholarshipZone. Built with care for scholars everywhere.
          </div>
        </div>
      </footer>
    </main>
  );
};

export default LandingPage;
