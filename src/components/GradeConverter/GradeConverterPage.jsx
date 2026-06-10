import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  GraduationCap,
  Globe2,
  Info,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trophy,
  Award,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { listSystems, convertGrade } from "../../lib/gradeConversion";
import { Seo } from "../seo/Seo";

// ---------------------------------------------------------------------------
// Country fallback names (English defaults; translated copy lives in i18n)
// ---------------------------------------------------------------------------
const COUNTRY_NAMES = {
  NG: "Nigeria",
  GH: "Ghana",
  SL: "Sierra Leone",
  LR: "Liberia",
  GM: "Gambia",
  KE: "Kenya",
  UG: "Uganda",
  RW: "Rwanda",
  TZ: "Tanzania",
  ZA: "South Africa",
  ZW: "Zimbabwe",
  ZM: "Zambia",
  BW: "Botswana",
  ET: "Ethiopia",
  EG: "Egypt",
  GB: "United Kingdom",
  SG: "Singapore",
  MY: "Malaysia",
  US: "United States",
  FR: "France",
  SN: "Senegal",
  ML: "Mali",
  CI: "Côte d'Ivoire",
  BF: "Burkina Faso",
  CD: "DR Congo",
  CM: "Cameroon",
  BJ: "Benin",
  TG: "Togo",
  NE: "Niger",
  MA: "Morocco",
  DZ: "Algeria",
  TN: "Tunisia",
  INT: "International",
};

const TIER_META = {
  "top-tier": {
    icon: Trophy,
    accent: "from-primary to-primary-dark",
    chip: "bg-primary-light text-primary-dark",
  },
  competitive: {
    icon: Award,
    accent: "from-primary to-primary-dark",
    chip: "bg-primary-light text-primary-dark",
  },
  standard: {
    icon: TrendingUp,
    accent: "from-sky-500 to-indigo-600",
    chip: "bg-sky-100 text-sky-700",
  },
  developing: {
    icon: Info,
    accent: "from-amber-400 to-orange-500",
    chip: "bg-amber-100 text-amber-800",
  },
  "below-threshold": {
    icon: AlertCircle,
    accent: "from-rose-500 to-red-600",
    chip: "bg-rose-100 text-rose-700",
  },
};

const STAT_PRIMARY = (label, value, sub) => ({ label, value, sub });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const allSystems = listSystems();

// Unique country codes (sorted later inside the component once translated)
const ALL_COUNTRY_CODES = (() => {
  const codes = new Set();
  for (const sys of allSystems) {
    for (const c of sys.countries || []) codes.add(c);
  }
  return Array.from(codes);
})();

const systemsForCountry = (countryCode) => {
  if (!countryCode || countryCode === "ALL") return allSystems;
  return allSystems.filter((s) => (s.countries || []).includes(countryCode));
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const SystemCard = ({ system, selected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(system.id)}
    className={[
      "group flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition-all",
      "focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25",
      selected
        ? "border-primary bg-primary/5 shadow-sm"
        : "border-border bg-white hover:border-primary/40 hover:bg-slate-50",
    ].join(" ")}
  >
    <span
      className={[
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-extrabold",
        selected
          ? "bg-primary text-white"
          : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary",
      ].join(" ")}
    >
      {system.type === "discrete" ? "A" : "#"}
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-ink leading-snug">{system.name}</span>
      <span className="mt-0.5 block text-xs leading-snug text-muted">
        {system.description}
      </span>
    </span>
  </button>
);

const ResultMetric = ({ label, value, hint, accent }) => (
  <div className="rounded-xl border border-border bg-white p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
    <p
      className={[
        "mt-1 text-3xl font-extrabold leading-none tracking-tight",
        accent || "text-ink",
      ].join(" ")}
    >
      {value}
    </p>
    {hint && <p className="mt-1.5 text-[11px] text-muted">{hint}</p>}
  </div>
);

const ResultPanel = ({ result, error }) => {
  const { t } = useTranslation();
  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-ink">{t("gradeConverter.cannotConvert")}</p>
              <p className="mt-0.5 text-sm text-muted">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <Calculator className="h-7 w-7" />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink">{t("gradeConverter.emptyTitle")}</p>
          <p className="mt-1 max-w-xs text-xs text-muted">
            {t("gradeConverter.emptyHint")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const tier = TIER_META[result.tier] || TIER_META.standard;
  const TierIcon = tier.icon;
  const tierLabel = t(`gradeConverter.tiers.${result.tier}.label`, {
    defaultValue: result.tier,
  });
  const tierDescription = t(`gradeConverter.tiers.${result.tier}.description`, {
    defaultValue: "",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-4"
    >
      {/* Tier banner */}
      <Card className="overflow-hidden">
        <div className={`h-1.5 bg-gradient-to-r ${tier.accent}`} />
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <span
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${tier.accent} text-white shadow-sm`}
            >
              <TierIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-extrabold text-ink">{tierLabel}</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tier.chip}`}
                >
                  {result.interpretation}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted">{tierDescription}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ResultMetric
          label={t("gradeConverter.metricPercentage")}
          value={`${result.percentage}%`}
          accent="text-primary-dark"
        />
        <ResultMetric
          label={t("gradeConverter.metricGpa")}
          value={result.gpa4.toFixed(2)}
          hint={t("gradeConverter.metricGpaHint")}
        />
        <ResultMetric
          label={t("gradeConverter.metricUk")}
          value={result.ukClass}
          hint={t("gradeConverter.metricUkHint")}
        />
        <ResultMetric
          label={t("gradeConverter.metricEcts")}
          value={result.ects}
          hint={t("gradeConverter.metricEctsHint")}
        />
      </div>

      {/* System notes */}
      {result.notes?.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Info className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  {t("gradeConverter.aboutConversion")}
                </p>
                <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-slate-700">
                  {result.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const GradeConverterPage = () => {
  const { t } = useTranslation();
  const [country, setCountry] = useState("ALL");
  const [systemId, setSystemId] = useState(allSystems[0]?.id || "");
  const [input, setInput] = useState("");

  const allCountries = useMemo(() => {
    const list = ALL_COUNTRY_CODES.map((code) => ({
      code,
      name: t(`gradeConverter.countries.${code}`, {
        defaultValue: COUNTRY_NAMES[code] || code,
      }),
    }));
    list.sort((a, b) => {
      if (a.code === "INT") return 1;
      if (b.code === "INT") return -1;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [t]);

  const filteredSystems = useMemo(() => systemsForCountry(country), [country]);
  const system = useMemo(
    () => allSystems.find((s) => s.id === systemId) || null,
    [systemId]
  );

  // If the country filter excludes the currently-selected system,
  // auto-pick the first available system in that country.
  useEffect(() => {
    if (!filteredSystems.find((s) => s.id === systemId)) {
      setSystemId(filteredSystems[0]?.id || "");
      setInput("");
    }
  }, [country, filteredSystems, systemId]);

  // Reset input whenever the system changes (different shape entirely).
  useEffect(() => {
    setInput("");
  }, [systemId]);

  const { result, error } = useMemo(() => {
    if (!system || input === "" || input == null) return { result: null, error: null };
    try {
      return { result: convertGrade({ system: system.id, input }), error: null };
    } catch (err) {
      return { result: null, error: err.message };
    }
  }, [system, input]);

  return (
    <main className="min-h-screen bg-background">
      <Seo
        title={t("gradeConverter.seoTitle")}
        description={t("gradeConverter.seoDescription")}
        path="/grade-converter"
        keywords={t("gradeConverter.seoKeywords")}
      />
      {/* ====== Top bar ====== */}
      <header className="sticky top-3 z-40 mx-auto mt-3 flex max-w-7xl items-center justify-between gap-4 rounded-2xl border border-border bg-white/85 px-4 py-3 shadow-nav backdrop-blur-md sm:px-6">
        <Link to="/" className="flex shrink-0 items-center">
          <img
            src="/logo.png"
            alt={t("common.appName")}
            className="h-12 w-auto object-contain"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="h-4 w-4" /> {t("gradeConverter.navHome")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">
              {t("common.signUp")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* ====== Hero ====== */}
      <section className="mx-auto mt-8 max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-emerald-900 p-8 text-white shadow-modal sm:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wider backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                {t("gradeConverter.heroBadge")}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                {t("gradeConverter.heroTitle")}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
                {t("gradeConverter.heroSubtitle")}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href="#converter"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-ink shadow-sm transition-all hover:bg-accent-dark"
                >
                  {t("gradeConverter.heroCta")} <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  to="/scholar/scholarships"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  {t("gradeConverter.browseScholarships")}
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                STAT_PRIMARY(t("gradeConverter.statSystems"), `${allSystems.length}+`, t("gradeConverter.statSystemsSub")),
                STAT_PRIMARY(t("gradeConverter.statCountries"), `${allCountries.length - 1}+`, t("gradeConverter.statCountriesSub")),
                STAT_PRIMARY(t("gradeConverter.statOutputs"), "4", t("gradeConverter.statOutputsSub")),
                STAT_PRIMARY(t("gradeConverter.statCost"), t("gradeConverter.statCostValue"), t("gradeConverter.statCostSub")),
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm ring-1 ring-white/20"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    {s.label}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-white/70">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====== Converter ====== */}
      <section id="converter" className="mx-auto mt-10 max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT — input column */}
          <div className="space-y-5">
            {/* Country filter */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  <span className="inline-flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-primary" /> {t("gradeConverter.step1Title")}
                  </span>
                </CardTitle>
                <p className="text-sm text-muted">{t("gradeConverter.step1Hint")}</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  <Label htmlFor="country">{t("gradeConverter.countryLabel")}</Label>
                  <select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ALL">{t("gradeConverter.allCountries")}</option>
                    {allCountries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* System picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  <span className="inline-flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-primary" /> {t("gradeConverter.step2Title")}
                  </span>
                </CardTitle>
                <p className="text-sm text-muted">
                  {t("gradeConverter.systemsAvailable", { count: filteredSystems.length })}
                </p>
              </CardHeader>
              <CardContent>
                {filteredSystems.length === 0 ? (
                  <p className="text-sm text-muted">
                    {t("gradeConverter.noSystemsForCountry")}{" "}
                    <button
                      type="button"
                      onClick={() => setCountry("ALL")}
                      className="font-semibold text-primary hover:underline"
                    >
                      {t("gradeConverter.showAll")}
                    </button>
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {filteredSystems.map((s) => (
                      <SystemCard
                        key={s.id}
                        system={s}
                        selected={systemId === s.id}
                        onSelect={setSystemId}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grade input */}
            {system && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    <span className="inline-flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" /> {t("gradeConverter.step3Title")}
                    </span>
                  </CardTitle>
                  <p className="text-sm text-muted">{system.description}</p>
                </CardHeader>
                <CardContent>
                  {system.type === "discrete" ? (
                    <div>
                      <Label htmlFor="grade-discrete">{t("gradeConverter.gradeLabel")}</Label>
                      <select
                        id="grade-discrete"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="mt-1.5 flex h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-ink shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">{t("gradeConverter.selectGrade")}</option>
                        {system.grades.map((g) => (
                          <option key={g.code} value={g.code}>
                            {g.code} — {g.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="grade-numeric">
                        {t("gradeConverter.scoreLabel", {
                          min: system.range?.min ?? 0,
                          max: system.range?.max ?? 100,
                        })}
                      </Label>
                      <Input
                        id="grade-numeric"
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min={system.range?.min ?? 0}
                        max={system.range?.max ?? 100}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t("gradeConverter.examplePlaceholder", {
                          example:
                            system.id === "US_GPA"
                              ? "3.5"
                              : system.id === "IB"
                              ? "36"
                              : system.id === "BAC_20"
                              ? "14"
                              : "85",
                        })}
                        className="mt-1.5"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* RIGHT — result column (sticky on desktop) */}
          <div>
            <div className="lg:sticky lg:top-24 space-y-4">
              <AnimatePresence mode="wait">
                <ResultPanel key={`${systemId}-${input}`} result={result} error={error} />
              </AnimatePresence>

              {/* Disclaimer */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 shrink-0 text-muted mt-0.5" />
                    <p className="text-xs leading-relaxed text-muted">
                      <strong className="text-ink">{t("gradeConverter.disclaimerLead")}</strong>{" "}
                      {t("gradeConverter.disclaimerBody")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ====== Footer CTA ====== */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-dark to-emerald-900 p-8 text-center text-white shadow-modal sm:p-12">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            {t("gradeConverter.ctaTitle")}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/80 sm:text-base">
            {t("gradeConverter.ctaSubtitle")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link to="/signup">
                {t("gradeConverter.ctaCreate")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/40 bg-white/10 text-white hover:bg-white/20"
            >
              <Link to="/scholar/scholarships">{t("gradeConverter.browseScholarships")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
};

export default GradeConverterPage;
