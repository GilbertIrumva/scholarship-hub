import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  GraduationCap,
  Tag,
  Calendar,
  DollarSign,
  Building2,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { SaveButton } from "./SaveButton";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { getPublicScholarshipById } from "../../services/publicApi";
import { listMyApplications } from "../../services/applications";

const formatAmount = (amount, currency = "USD", t) => {
  if (!amount) return t("scholarshipDetail.amountOnRequest");
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const formatDeadline = (deadline, t) => {
  if (!deadline) return t("scholarshipDetail.rollingNoDeadline");
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return t("catalog.rolling");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const daysUntil = (deadline) => {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
};

const InfoTile = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3 rounded-xl border border-border bg-white p-4">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
      <Icon className="h-4.5 w-4.5" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  </div>
);

const ScholarshipDetailPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [scholarship, setScholarship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [existingApp, setExistingApp] = useState(null);

  // Load scholarship
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getPublicScholarshipById(id)
      .then((data) => {
        if (!cancelled) setScholarship(data?.scholarship || null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || t("scholarshipDetail.notFound"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Check if scholar already applied (also picks up active drafts).
  useEffect(() => {
    let cancelled = false;
    if (!sessionToken || !id) return;
    listMyApplications(sessionToken)
      .then((data) => {
        if (cancelled) return;
        const found = (data?.applications || []).find(
          (a) => a.scholarshipId === id
        );
        if (found) setExistingApp(found);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionToken, id]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;

  if (loading) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("scholarshipDetail.fallbackTitle")}
        onSignOut={handleSignOut}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !scholarship) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("scholarshipDetail.fallbackTitle")}
        onSignOut={handleSignOut}
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-12 w-12 text-muted/40" />
            <h3 className="mt-4 text-lg font-bold text-ink">
              {error || t("scholarshipDetail.notFound")}
            </h3>
            <Button asChild variant="outline" className="mt-5">
              <Link to="/scholar/scholarships">
                <ArrowLeft className="h-4 w-4" /> {t("scholarshipDetail.backToBrowse")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const days = daysUntil(scholarship.deadline);
  const isClosed = days !== null && days < 0;

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={scholarship.title}
      subtitle={scholarship.provider || t("scholarshipDetail.fallbackSubtitle")}
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        <Link
          to="/scholar/scholarships"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> {t("scholarshipDetail.backToScholarships")}
        </Link>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-primary to-emerald-700" />
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">
                    {scholarship.title}
                  </h1>
                  {scholarship.provider && (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
                      <Building2 className="h-4 w-4" /> {scholarship.provider}
                    </p>
                  )}
                </div>
                {isClosed ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t("scholarshipDetail.closed")}
                  </span>
                ) : days !== null && days <= 14 ? (
                  <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-dark">
                    <Clock className="-mt-0.5 mr-1 inline h-3 w-3" />
                    {days === 0 ? t("scholarshipDetail.closesToday") : t("scholarshipDetail.daysLeft", { count: days })}
                  </span>
                ) : null}
                <SaveButton
                  scholarshipId={scholarship._id || scholarship.id}
                  scholarshipTitle={scholarship.title}
                  variant="pill"
                  size="md"
                />
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <InfoTile
                  icon={DollarSign}
                  label={t("scholarshipDetail.award")}
                  value={formatAmount(scholarship.amount, scholarship.currency, t)}
                />
                <InfoTile
                  icon={Calendar}
                  label={t("scholarshipDetail.deadline")}
                  value={formatDeadline(scholarship.deadline, t)}
                />
                <InfoTile
                  icon={GraduationCap}
                  label={t("scholarshipDetail.gradeLevel")}
                  value={scholarship.grades?.join(", ") || t("scholarshipDetail.allLevels")}
                />
              </div>

              {(scholarship.fields?.length || scholarship.countries?.length) > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {scholarship.fields?.map((f) => (
                    <span
                      key={`f-${f}`}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-dark"
                    >
                      <Tag className="h-3 w-3" /> {f}
                    </span>
                  ))}
                  {scholarship.countries?.map((c) => (
                    <span
                      key={`c-${c}`}
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                    >
                      <MapPin className="h-3 w-3" /> {c}
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Description + eligibility */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            {scholarship.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("scholarshipDetail.about")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {scholarship.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {scholarship.eligibility && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("scholarshipDetail.eligibility")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {scholarship.eligibility}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Apply panel (sticky on desktop) */}
          <div>
            <Card className="lg:sticky lg:top-6">
              <CardHeader>
                <CardTitle className="text-lg">
                  {existingApp && existingApp.status !== "draft"
                    ? t("scholarshipDetail.applicationSubmitted")
                    : existingApp && existingApp.status === "draft"
                      ? t("scholarshipDetail.draftInProgress")
                      : t("scholarshipDetail.applyNow")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {existingApp && existingApp.status !== "draft" ? (
                  <div className="flex flex-col items-center text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-7 w-7" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {t("scholarshipDetail.alreadyApplied")}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t("scholarshipDetail.statusPrefix")}{" "}
                      <span className="font-bold capitalize text-primary-dark">
                        {(existingApp?.status || "submitted").replace("-", " ")}
                      </span>
                    </p>
                    <Button asChild variant="outline" size="sm" className="mt-5">
                      <Link to="/scholar/applications">{t("scholarshipDetail.viewMyApplications")}</Link>
                    </Button>
                  </div>
                ) : isClosed ? (
                  <div className="flex flex-col items-center text-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
                      <Clock className="h-7 w-7" />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      {t("scholarshipDetail.applicationsClosed")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {existingApp?.status === "draft" && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
                        {t("scholarshipDetail.draftNotice")}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {t("scholarshipDetail.applyBlurb")}
                    </p>
                    <Button asChild className="w-full" size="lg">
                      <Link to={`/scholar/scholarships/${id}/apply`}>
                        <ShieldCheck className="h-4 w-4" />
                        {existingApp?.status === "draft"
                          ? t("scholarshipDetail.continueApplication")
                          : t("scholarshipDetail.startApplication")}
                      </Link>
                    </Button>
                    <p className="text-center text-[11px] leading-relaxed text-muted">
                      {t("scholarshipDetail.sharedWithReviewer")}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ScholarshipDetailPage;
