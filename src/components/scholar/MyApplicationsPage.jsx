import { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Loader2,
  ExternalLink,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Search,
  Compass,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { EmptyState } from "../ui/empty-state";
import { ApplicationsIllustration, SearchEmptyIllustration } from "../ui/empty-illustrations";
import { listMyApplications } from "../../services/applications";

const STATUS_STYLES = {
  submitted: {
    labelKey: "applications.statusSubmitted",
    icon: Clock,
    chip: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
  },
  "under-review": {
    labelKey: "applications.statusUnderReview",
    icon: Search,
    chip: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  approved: {
    labelKey: "applications.statusApproved",
    icon: CheckCircle2,
    chip: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  rejected: {
    labelKey: "applications.statusRejected",
    icon: XCircle,
    chip: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
  },
  withdrawn: {
    labelKey: "applications.statusWithdrawn",
    icon: AlertCircle,
    chip: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
};

const formatAmount = (amount, currency = "USD") => {
  if (!amount) return "—";
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

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const StatusChip = ({ status }) => {
  const { t } = useTranslation();
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.submitted;
  const Icon = cfg.icon;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        cfg.chip,
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {t(cfg.labelKey)}
    </span>
  );
};

const ApplicationCard = ({ application }) => {
  const { t } = useTranslation();
  const s = application.scholarship;
  const status = application.status;
  const cfg = STATUS_STYLES[status] || STATUS_STYLES.submitted;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden transition-all hover:shadow-lg">
        <div className={["h-1.5", cfg.dot].join(" ")} />
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold leading-snug text-ink">
                {s?.title || t("applications.scholarshipFallback")}
              </h3>
              {s?.provider && (
                <p className="mt-0.5 text-sm font-semibold text-muted">{s.provider}</p>
              )}
            </div>
            <StatusChip status={status} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">{t("applications.award")}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-ink">
                <DollarSign className="h-3 w-3 text-primary" />
                {formatAmount(s?.amount, s?.currency)}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">{t("applications.deadline")}</p>
              <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-ink">
                <Calendar className="h-3 w-3 text-primary" />
                {formatDate(s?.deadline)}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">{t("applications.submittedAt")}</p>
              <p className="mt-0.5 font-semibold text-ink">
                {formatDate(application.submittedAt)}
              </p>
            </div>
            <div>
              <p className="font-bold uppercase tracking-wider text-muted">{t("applications.updatedAt")}</p>
              <p className="mt-0.5 font-semibold text-ink">
                {formatDate(application.updatedAt)}
              </p>
            </div>
          </div>

          {application.decisionNote && (
            <div className="mt-4 rounded-lg border border-border bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              <p className="font-bold uppercase tracking-wider text-muted">
                {t("applications.reviewerNote")}
              </p>
              <p className="mt-1">{application.decisionNote}</p>
            </div>
          )}

          {s?.id && (
            <div className="mt-4 flex justify-end">
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to={`/scholar/scholarships/${s.id}`}>
                  {t("applications.viewScholarship")} <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

const MyApplicationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    listMyApplications(sessionToken)
      .then((data) => {
        if (!cancelled) {
          setApplications(Array.isArray(data?.applications) ? data.applications : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || t("applications.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  const TABS = useMemo(
    () => [
      { id: "all", label: t("applications.tabAll") },
      { id: "submitted", label: t("applications.statusSubmitted") },
      { id: "under-review", label: t("applications.statusUnderReview") },
      { id: "approved", label: t("applications.statusApproved") },
      { id: "rejected", label: t("applications.statusRejected") },
    ],
    [t]
  );

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;

  const counts = applications.reduce(
    (acc, a) => {
      acc.all += 1;
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    },
    { all: 0 }
  );

  const filtered = applications.filter((a) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (query) {
      const q = query.toLowerCase();
      const title = (a.scholarship?.title || "").toLowerCase();
      const provider = (a.scholarship?.provider || "").toLowerCase();
      if (!title.includes(q) && !provider.includes(q)) return false;
    }
    return true;
  });

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("applications.pageTitle")}
      subtitle={t("applications.pageSubtitle")}
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        {/* Search + tabs */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("applications.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const count = tab.id === "all" ? counts.all : counts[tab.id] || 0;
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFilter(tab.id)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span
                      className={[
                        "rounded-full px-1.5 text-[10px] font-bold",
                        active ? "bg-white/20" : "bg-white text-slate-500",
                      ].join(" ")}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <Card className="p-8 sm:p-12">
            <EmptyState
              illustration={<ApplicationsIllustration />}
              title={t("applications.noneTitle")}
              description={t("applications.noneDescription")}
              action={
                <Button asChild>
                  <Link to="/scholar/scholarships">
                    <Compass className="h-4 w-4" /> {t("applications.browseScholarships")}
                  </Link>
                </Button>
              }
            />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-4">
              <EmptyState
                size="sm"
                illustration={<SearchEmptyIllustration className="h-24 w-auto text-primary" />}
                title={t("applications.filterNoMatch")}
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filtered.map((a) => (
              <ApplicationCard key={a.id} application={a} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyApplicationsPage;
