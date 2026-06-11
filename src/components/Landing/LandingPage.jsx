import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  GraduationCap,
  Users,
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
  Heart,
  Target,
  Eye,
  Compass,
  Award,
  Quote,
  BadgeCheck,
  Wifi,
  Lock,
  Gift,
  Rocket,
  HelpCircle,
  PlayCircle,
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

// "What we do" spot photography (Pexels, free license).
// Curate: Mikhail Nilov / Match: Mickael Ange Konan /
// Guide: Kampus Production / Champion: Chris Wade Ntezicimpa.
import whatWeDoCurateImage from "../../assets/landing/whatwedo/curate.jpg";
import whatWeDoMatchImage from "../../assets/landing/whatwedo/match.jpg";
import whatWeDoGuideImage from "../../assets/landing/whatwedo/guide.jpg";
import whatWeDoChampionImage from "../../assets/landing/whatwedo/champion.jpg";

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
    metricValue: "100%",
    metricLabel: t("landing.trustVerifiedMetric"),
  },
  {
    icon: Smartphone,
    title: t("landing.trustLowBwTitle"),
    copy: t("landing.trustLowBwCopy"),
    metricValue: "< 80 KB",
    metricLabel: t("landing.trustLowBwMetric"),
  },
  {
    icon: Globe2,
    title: t("landing.trustPartnerTitle"),
    copy: t("landing.trustPartnerCopy"),
    metricValue: "GDPR",
    metricLabel: t("landing.trustPartnerMetric"),
  },
];

// Partner / funder wordmarks for the social-proof strip.
// TODO: replace these placeholder names with real partner brand assets
// (SVG logos) once partnerships are formalised. Drop SVGs in
// `src/assets/landing/partners/` and switch this to {name, logo} objects.
const buildPartners = (t) => [
  {
    name: "Aspire Foundation",
    kind: t("landing.partnerKindFoundation"),
    Logo: AspireLogo,
  },
  {
    name: "Horizon Trust",
    kind: t("landing.partnerKindFunder"),
    Logo: HorizonLogo,
  },
  {
    name: "EduBridge Africa",
    kind: t("landing.partnerKindNgo"),
    Logo: EduBridgeLogo,
  },
  {
    name: "Pathways Initiative",
    kind: t("landing.partnerKindProgram"),
    Logo: PathwaysLogo,
  },
  {
    name: "OpenLearn Network",
    kind: t("landing.partnerKindNetwork"),
    Logo: OpenLearnLogo,
  },
  {
    name: "Beacon Scholars Fund",
    kind: t("landing.partnerKindFund"),
    Logo: BeaconLogo,
  },
];

// Placeholder partner logos: distinctive inline SVG monogram marks that
// inherit `currentColor`, so the existing greyscale-to-primary hover
// transition on the parent <li> drives their color. Replace with real
// brand SVGs (and swap the `Logo` field above) once partnerships are
// formalised.
const logoBaseProps = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const AspireLogo = (props) => (
  // Three ascending mountain peaks evoking "aspire".
  <svg {...logoBaseProps} {...props}>
    <path d="M6 36 L16 22 L22 30 L30 16 L42 36 Z" />
    <circle cx="32" cy="10" r="2.5" fill="currentColor" stroke="none" />
  </svg>
);

const HorizonLogo = (props) => (
  // Sun rising over a horizon line with two rays.
  <svg {...logoBaseProps} {...props}>
    <line x1="6" y1="34" x2="42" y2="34" />
    <path d="M14 34 A10 10 0 0 1 34 34" />
    <line x1="24" y1="10" x2="24" y2="16" />
    <line x1="10" y1="22" x2="14" y2="24" />
    <line x1="38" y1="22" x2="34" y2="24" />
  </svg>
);

const EduBridgeLogo = (props) => (
  // Stylised arch bridge with two pillars and a deck line.
  <svg {...logoBaseProps} {...props}>
    <path d="M8 32 A16 16 0 0 1 40 32" />
    <line x1="8" y1="32" x2="40" y2="32" />
    <line x1="16" y1="32" x2="16" y2="42" />
    <line x1="32" y1="32" x2="32" y2="42" />
    <line x1="6" y1="42" x2="42" y2="42" />
  </svg>
);

const PathwaysLogo = (props) => (
  // Winding zig-zag arrow path suggesting a journey forward.
  <svg {...logoBaseProps} {...props}>
    <path d="M8 36 L18 26 L24 32 L34 18" />
    <polyline points="28,18 34,18 34,24" />
    <circle cx="8" cy="36" r="2" fill="currentColor" stroke="none" />
  </svg>
);

const OpenLearnLogo = (props) => (
  // Open book with center spine.
  <svg {...logoBaseProps} {...props}>
    <path d="M6 14 C12 12 20 12 24 16 C28 12 36 12 42 14 L42 36 C36 34 28 34 24 38 C20 34 12 34 6 36 Z" />
    <line x1="24" y1="16" x2="24" y2="38" />
  </svg>
);

const BeaconLogo = (props) => (
  // Lighthouse silhouette with a beam dot above.
  <svg {...logoBaseProps} {...props}>
    <circle cx="24" cy="8" r="2.5" fill="currentColor" stroke="none" />
    <path d="M16 14 L32 14 L30 18 L18 18 Z" />
    <path d="M18 18 L20 38 L28 38 L30 18" />
    <line x1="14" y1="42" x2="34" y2="42" />
  </svg>
);

// WhatsApp brand glyph (lucide-react does not ship one).
const WhatsAppIcon = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    {...props}
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.36-.214-3.741.982 1-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.888 9.884zm8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
  </svg>
);

// Scholar testimonials shown between "What we do" and "Why us".
// TODO: drop real Pexels/Unsplash portraits in
// `src/assets/landing/testimonials/` (e.g. amani.webp, grace.webp, joseph.webp),
// import them at the top of this file, and assign to the `avatar` field below.
// Until then, the card renders a tasteful gradient initials avatar.
const buildTestimonials = (t) => [
  {
    id: "amani",
    name: t("landing.testimonial1Name"),
    country: t("landing.testimonial1Country"),
    scholarship: t("landing.testimonial1Scholarship"),
    quote: t("landing.testimonial1Quote"),
    initials: "AM",
    avatar: null,
    gradient: "from-primary/30 via-primary/15 to-accent/25",
  },
  {
    id: "grace",
    name: t("landing.testimonial2Name"),
    country: t("landing.testimonial2Country"),
    scholarship: t("landing.testimonial2Scholarship"),
    quote: t("landing.testimonial2Quote"),
    initials: "GN",
    avatar: null,
    gradient: "from-accent/25 via-primary/15 to-primary/30",
  },
  {
    id: "joseph",
    name: t("landing.testimonial3Name"),
    country: t("landing.testimonial3Country"),
    scholarship: t("landing.testimonial3Scholarship"),
    quote: t("landing.testimonial3Quote"),
    initials: "JK",
    avatar: null,
    gradient: "from-primary/25 via-accent/20 to-primary/15",
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
  {
    icon: Search,
    image: whatWeDoCurateImage,
    imageAlt: t("landing.whatWeDoCurateImageAlt"),
    title: t("landing.whatWeDoCurateTitle"),
    copy: t("landing.whatWeDoCurateCopy"),
  },
  {
    icon: Target,
    image: whatWeDoMatchImage,
    imageAlt: t("landing.whatWeDoMatchImageAlt"),
    title: t("landing.whatWeDoMatchTitle"),
    copy: t("landing.whatWeDoMatchCopy"),
  },
  {
    icon: Compass,
    image: whatWeDoGuideImage,
    imageAlt: t("landing.whatWeDoGuideImageAlt"),
    title: t("landing.whatWeDoGuideTitle"),
    copy: t("landing.whatWeDoGuideCopy"),
  },
  {
    icon: Heart,
    image: whatWeDoChampionImage,
    imageAlt: t("landing.whatWeDoChampionImageAlt"),
    title: t("landing.whatWeDoChampionTitle"),
    copy: t("landing.whatWeDoChampionCopy"),
  },
];

const buildWhyUs = (t) => [
  {
    num: "01",
    icon: BadgeCheck,
    tint: "from-primary/[0.06] via-transparent to-transparent",
    title: t("landing.whyUs01Title"),
    copy: t("landing.whyUs01Copy"),
  },
  {
    num: "02",
    icon: Wifi,
    tint: "from-accent/[0.07] via-transparent to-transparent",
    title: t("landing.whyUs02Title"),
    copy: t("landing.whyUs02Copy"),
  },
  {
    num: "03",
    icon: Lock,
    tint: "from-primary/[0.06] via-transparent to-transparent",
    title: t("landing.whyUs03Title"),
    copy: t("landing.whyUs03Copy"),
  },
  {
    num: "04",
    icon: Gift,
    tint: "from-accent/[0.07] via-transparent to-transparent",
    title: t("landing.whyUs04Title"),
    copy: t("landing.whyUs04Copy"),
  },
  {
    num: "05",
    icon: MapPin,
    tint: "from-primary/[0.06] via-transparent to-transparent",
    title: t("landing.whyUs05Title"),
    copy: t("landing.whyUs05Copy"),
  },
  {
    num: "06",
    icon: Rocket,
    tint: "from-accent/[0.07] via-transparent to-transparent",
    title: t("landing.whyUs06Title"),
    copy: t("landing.whyUs06Copy"),
  },
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

// =========================================================================
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

// Social-proof strip: greyscale partner wordmarks that animate to brand
// color on hover. Replace placeholder names with real partner SVG logos
// once partnerships are formalised (see buildPartners comment above).
const PartnersStrip = ({ partners, t }) => (
  <section
    aria-labelledby="partners-title"
    className="mx-auto section-mt w-[min(100%-1.5rem,80rem)]"
  >
    <div className="rounded-3xl border border-border bg-surface/60 px-6 py-10 shadow-elev-1 sm:px-10 sm:py-12">
      <div className="text-center">
        <span className="eyebrow">{t("landing.partnersEyebrow")}</span>
        <h2 id="partners-title" className="mt-3 text-h4 text-ink sm:text-h3">
          {t("landing.partnersTitle")}
        </h2>
      </div>
      <ul
        role="list"
        className="mt-8 grid grid-cols-2 items-center gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-6"
      >
        {partners.map((partner, idx) => {
          const Logo = partner.Logo;
          return (
            <motion.li
              key={partner.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.45, delay: idx * 0.06, ease: [0.25, 1, 0.5, 1] }}
              className="group flex flex-col items-center text-center text-muted/70 transition-colors duration-300 hover:text-primary"
              title={`${partner.name} — ${partner.kind}`}
            >
              {Logo && (
                <Logo className="mb-3 h-10 w-10 transition-transform duration-300 group-hover:scale-110" />
              )}
              <span
                aria-label={partner.name}
                className="select-none font-display text-base font-bold uppercase tracking-[0.18em] sm:text-[0.95rem]"
              >
                {partner.name}
              </span>
              <span className="mt-1 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-muted/50 transition-colors duration-300 group-hover:text-muted">
                {partner.kind}
              </span>
            </motion.li>
          );
        })}
      </ul>
      <p className="mt-8 text-center text-caption text-muted/70">
        {t("landing.partnersFootnote")}
      </p>
    </div>
  </section>
);

// Scholar testimonials: 3 cards with portrait (or initials fallback), quote,
// name, country, and scholarship awarded. Inserted inside the About section
// between "What we do" and "Why us".
const TestimonialsBlock = ({ testimonials, t }) => (
  <div className="mb-16" aria-labelledby="testimonials-title">
    <div className="mb-8 text-center">
      <span className="eyebrow">{t("landing.testimonialsEyebrow")}</span>
      <h3 id="testimonials-title" className="mt-3 text-h3 text-ink">
        {t("landing.testimonialsTitle")}
      </h3>
      <p className="mx-auto mt-3 max-w-2xl text-body text-muted">
        {t("landing.testimonialsSubtitle")}
      </p>
    </div>
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {testimonials.map((item, idx) => (
        <motion.figure
          key={item.id}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.5, delay: idx * 0.08, ease: [0.25, 1, 0.5, 1] }}
          className="hover-lift relative flex h-full flex-col rounded-2xl border border-border bg-surface p-6 shadow-elev-1 hover:border-primary/40 hover:shadow-elev-3"
        >
          <Quote
            className="absolute top-5 right-5 h-8 w-8 text-primary/15"
            aria-hidden="true"
          />
          <blockquote className="text-body italic text-ink">
            &ldquo;{item.quote}&rdquo;
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-4 border-t border-border pt-5">
            {item.avatar ? (
              <img
                src={item.avatar}
                alt={item.name}
                className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20"
                loading="lazy"
              />
            ) : (
              <div
                aria-hidden="true"
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.gradient} font-display text-small font-bold uppercase tracking-wider text-primary-dark ring-2 ring-primary/20`}
              >
                {item.initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-small font-bold text-ink">{item.name}</div>
              <div className="truncate text-caption text-muted">{item.country}</div>
              <div className="truncate text-caption font-medium text-primary-dark">
                {item.scholarship}
              </div>
            </div>
          </figcaption>
        </motion.figure>
      ))}
    </div>
  </div>
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
  const PARTNERS = useMemo(() => buildPartners(t), [t, i18n.language]);
  const TESTIMONIALS = useMemo(() => buildTestimonials(t), [t, i18n.language]);
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
  const [previewOpen, setPreviewOpen] = useState(false);

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
                <GraduationCap className="h-3 w-3" aria-hidden="true" />
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
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="group mt-5 inline-flex items-center gap-2.5 text-small font-medium text-white/85 transition-colors hover:text-white"
              >
                <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur-md transition-all duration-300 group-hover:bg-white/25 group-hover:ring-white/40">
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-white/20 opacity-60 group-hover:animate-ping"
                  />
                  <PlayCircle className="relative h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                </span>
                <span className="underline-offset-4 group-hover:underline">
                  {t("landing.heroWatchHowItWorks")}
                </span>
                <span className="text-caption text-white/60">
                  {t("landing.heroWatchDuration")}
                </span>
              </button>
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
              className="group hover-lift relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-elev-2 hover:border-primary/30 hover:shadow-elev-3"
            >
              {/* Top row: icon chip + metric pill */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-110">
                  <item.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="flex flex-col items-end text-right">
                  <span className="text-h4 font-extrabold leading-none text-primary">
                    {item.metricValue}
                  </span>
                  <span className="mt-1 text-caption font-medium text-muted">
                    {item.metricLabel}
                  </span>
                </div>
              </div>
              <h3 className="text-h4 text-ink">{item.title}</h3>
              <p className="mt-2 text-small text-muted">{item.copy}</p>
              {/* Bottom accent bar */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-primary via-primary/60 to-transparent transition-transform duration-500 group-hover:scale-x-100"
              />
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===================== PARTNERS / SOCIAL PROOF ===================== */}
      <PartnersStrip partners={PARTNERS} t={t} />

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
            <StatCard value={stats.activeScholarships} label={t("landing.statActiveScholarships")} icon={Award} />
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
                className="group hover-lift flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-elev-1 hover:border-primary/40 hover:shadow-elev-3"
              >
                <div className="relative aspect-[5/3] overflow-hidden bg-muted/10">
                  <img
                    src={item.image}
                    alt={item.imageAlt}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface/60 via-transparent to-transparent"
                  />
                  <div className="absolute bottom-3 left-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-surface/95 text-primary shadow-elev-2 ring-1 ring-primary/15 backdrop-blur transition-transform duration-300 group-hover:scale-110">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <h4 className="text-h5 text-ink">{item.title}</h4>
                  <p className="mt-2 text-small text-muted">{item.copy}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <TestimonialsBlock testimonials={TESTIMONIALS} t={t} />

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
                className="group hover-lift flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-elev-1 transition-colors hover:border-primary/40 hover:shadow-elev-3"
              >
                {/* Icon banner */}
                <div
                  className={`relative flex h-28 items-center justify-center overflow-hidden bg-gradient-to-br ${item.tint} bg-primary/5`}
                >
                  <span
                    className="pointer-events-none absolute top-2 right-4 text-h1 font-extrabold text-primary/15 select-none"
                    aria-hidden="true"
                  >
                    {item.num}
                  </span>
                  <div className="relative inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-primary shadow-elev-2 ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-3deg]">
                    <item.icon className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
                  </div>
                </div>
                {/* Body */}
                <div className="flex flex-1 flex-col p-6">
                  <h4 className="text-h5 text-ink">{item.title}</h4>
                  <p className="mt-2 text-small text-muted">{item.copy}</p>
                </div>
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
            {/* Photo */}
            <div className="relative overflow-hidden rounded-2xl shadow-elev-2">
              <img
                src={contactImage}
                alt={t("landing.contactImageAlt")}
                className="h-56 w-full object-cover"
                loading="lazy"
              />
            </div>

            {/* Response-time stats trio */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-4 shadow-elev-1">
              {[
                { value: "< 24h", label: t("landing.contactStatAvgReply") },
                { value: "98%",   label: t("landing.contactStatAnswered") },
                { value: "7 days", label: t("landing.contactStatHours") },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-h5 font-bold text-primary">{stat.value}</div>
                  <div className="mt-0.5 text-caption text-muted">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Info rows */}
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

            {/* Quick links: FAQ, Email, WhatsApp */}
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-elev-1">
              <div className="mb-3 flex items-center gap-2">
                <span className="eyebrow">{t("landing.contactQuickLinksEyebrow")}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    icon: HelpCircle,
                    label: t("landing.contactQuickFaq"),
                    href: "#how",
                    isExternal: false,
                  },
                  {
                    icon: Mail,
                    label: t("landing.contactQuickEmail"),
                    href: "mailto:hello@scholarshipzone.org",
                    isExternal: false,
                  },
                  {
                    icon: WhatsAppIcon,
                    label: t("landing.contactQuickWhatsApp"),
                    href: "https://wa.me/250000000000",
                    isExternal: true,
                  },
                ].map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    {...(link.isExternal
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group flex flex-col items-center gap-1.5 rounded-xl border border-border/70 bg-surface px-2 py-3 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.03] hover:shadow-elev-2"
                  >
                    <link.icon className="h-5 w-5 text-primary transition-transform group-hover:scale-110" aria-hidden="true" />
                    <span className="text-caption font-semibold text-ink">{link.label}</span>
                  </a>
                ))}
              </div>
            </div>
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

      {/* ===================== HOW-IT-WORKS PREVIEW MODAL ===================== */}
      <AnimatePresence>
        {previewOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
            onClick={() => setPreviewOpen(false)}
            onKeyDown={(e) => { if (e.key === "Escape") setPreviewOpen(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-surface shadow-elev-4"
            >
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="absolute top-3 right-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-ink shadow-elev-2 ring-1 ring-border backdrop-blur transition-colors hover:bg-surface hover:text-primary"
                aria-label={t("landing.previewClose")}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="relative aspect-video bg-black/80">
                <img
                  src={stepProfileImage}
                  alt=""
                  className="h-full w-full object-cover opacity-90"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-white">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-2 ring-white/40 backdrop-blur-md">
                    <PlayCircle className="h-12 w-12" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <p className="mt-6 text-h5 font-bold">{t("landing.previewComingSoonTitle")}</p>
                  <p className="mt-2 max-w-md text-small text-white/80">
                    {t("landing.previewComingSoonCopy")}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
                <div>
                  <div id="preview-title" className="text-h6 font-bold text-ink">
                    {t("landing.heroWatchHowItWorks")}
                  </div>
                  <div className="text-caption text-muted">
                    {t("landing.previewSubtitle")}
                  </div>
                </div>
                <Button
                  asChild
                  size="sm"
                  onClick={() => setPreviewOpen(false)}
                >
                  <a href="#how">{t("landing.previewJumpToSteps")}</a>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LandingPage;
