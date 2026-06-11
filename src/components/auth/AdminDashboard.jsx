import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  ArrowDownRight,
  BadgeCheck,
  ShieldCheck,
  Users,
  BarChart3,
  GraduationCap,
  Activity,
  TrendingUp,
  Eye,
  Check,
  Mail,
  MoreHorizontal,
  Minus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// -----------------------------------------------------------------------------
// Mini stat card with optional trend indicator + sparkline
// -----------------------------------------------------------------------------
const StatCard = ({ icon: Icon, label, value, note, accent = "bg-primary", trend, spark, sparkColor = "#059669" }) => {
  const sparkId = `spark-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            {trend != null && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${trend >= 0 ? "text-success" : "text-danger"}`}>
                <TrendingUp className={`h-3.5 w-3.5 ${trend < 0 ? "rotate-180" : ""}`} />
                {Math.abs(trend)}%
              </span>
            )}
          </div>
          <p className="mt-4 text-3xl font-extrabold text-ink tracking-tight">{value}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{label}</p>
          {Array.isArray(spark) && spark.length > 1 && (
            <div className="mt-3 h-10 -mx-1" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 0 }}>
                  <defs>
                    <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={sparkColor}
                    strokeWidth={1.75}
                    fill={`url(#${sparkId})`}
                    isAnimationActive={false}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
};

// -----------------------------------------------------------------------------
// Chart sample data — derive from dashboard.summary if available
// -----------------------------------------------------------------------------
const buildChartData = (summary, days) => {
  // Synthesize a simple weekly trend from current counts
  const total = summary?.totalApplicants ?? 0;
  const base = Math.max(1, Math.round(total / 14));
  return days.map((day, idx) => ({
    day,
    applicants: Math.max(0, Math.round(base * (1 + Math.sin(idx) * 0.6 + idx * 0.1))),
    reviewed: Math.max(0, Math.round(base * (0.4 + Math.cos(idx) * 0.3))),
  }));
};

const buildEducationData = (recent, unspecifiedLabel) => {
  const counts = {};
  (recent || []).forEach((a) => {
    const key = a.education || unspecifiedLabel;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

// Build a deterministic 7-day spark series from current value + trend %.
// Endpoint = current value; start derived from trend so the slope matches the badge.
const buildSparkSeries = (current, trend = 0, seed = 0) => {
  const end = Math.max(1, Number(current) || 1);
  const start = Math.max(1, end / (1 + trend / 100));
  return Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const base = start + (end - start) * t;
    const wobble = Math.sin((i + seed) * 1.3) * (end * 0.05);
    return { v: Math.max(0, Math.round(base + wobble)) };
  });
};

// =============================================================================
// MAIN DASHBOARD CONTENT
// =============================================================================
const AdminDashboard = ({ dashboard, isRefreshing, onOpenSettings, onRefresh }) => {
  const { t } = useTranslation();
  const applicantLoad = dashboard.summary.totalApplicants
    ? Math.min(Math.round((dashboard.summary.reviewQueue / dashboard.summary.totalApplicants) * 100), 100)
    : 0;

  // Synthesised "vs last week" delta — derive a plausible previous load from
  // the current queue trend stub (-5%). Swap for a real backend metric when available.
  const queueTrend = -5;
  const previousLoad = Math.max(0, Math.min(100, Math.round(applicantLoad / (1 + queueTrend / 100))));
  const loadDelta = applicantLoad - previousLoad;
  const loadStatus =
    applicantLoad >= 70
      ? { key: "overloaded", className: "bg-danger/10 text-danger" }
      : applicantLoad >= 30
      ? { key: "healthy", className: "bg-success/10 text-success" }
      : { key: "low", className: "bg-sky-100 text-sky-800" };

  const days = useMemo(
    () => [
      t("admin.dayMon"),
      t("admin.dayTue"),
      t("admin.dayWed"),
      t("admin.dayThu"),
      t("admin.dayFri"),
      t("admin.daySat"),
      t("admin.daySun"),
    ],
    [t]
  );
  const chartData = useMemo(() => buildChartData(dashboard.summary, days), [dashboard.summary, days]);
  const educationData = useMemo(
    () => buildEducationData(dashboard.recentApplicants, t("admin.unspecified")),
    [dashboard.recentApplicants, t]
  );

  const summaryCards = useMemo(
    () => [
      { icon: Users, label: t("admin.statTotalApplicants"), value: dashboard.summary.totalApplicants, note: t("admin.statTotalApplicantsNote"), accent: "bg-gradient-to-br from-primary to-emerald-700", trend: 12, sparkColor: "#059669", spark: buildSparkSeries(dashboard.summary.totalApplicants, 12, 0) },
      { icon: BadgeCheck, label: t("admin.statGraduateProfiles"), value: dashboard.summary.graduateApplicants, note: t("admin.statGraduateProfilesNote"), accent: "bg-gradient-to-br from-accent to-orange-600", trend: 8, sparkColor: "#f59e0b", spark: buildSparkSeries(dashboard.summary.graduateApplicants, 8, 1) },
      { icon: BarChart3, label: t("admin.statAverageAge"), value: dashboard.summary.averageAge, note: t("admin.statAverageAgeNote"), accent: "bg-gradient-to-br from-sky-500 to-indigo-600", sparkColor: "#0ea5e9", spark: buildSparkSeries(dashboard.summary.averageAge, 0, 2) },
      { icon: ShieldCheck, label: t("admin.statReviewQueue"), value: dashboard.summary.reviewQueue, note: t("admin.statReviewQueueNote", { percent: applicantLoad }), accent: "bg-gradient-to-br from-rose-500 to-red-600", trend: -5, sparkColor: "#ef4444", spark: buildSparkSeries(dashboard.summary.reviewQueue, -5, 3) },
    ],
    [t, dashboard.summary, applicantLoad]
  );

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("admin.welcomeBack")}
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            {dashboard.admin.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {dashboard.admin.department} · {dashboard.admin.role}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onOpenSettings}>
            {t("admin.credentialSettings")}
          </Button>
          <Button onClick={onRefresh} disabled={isRefreshing}>
            <Activity className="h-4 w-4" />
            {isRefreshing ? t("admin.refreshing") : t("admin.refreshData")}
          </Button>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">{t("admin.applicantActivity")}</CardTitle>
              <p className="mt-1 text-sm text-muted">{t("admin.applicantActivitySubtitle")}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {t("admin.live")}
            </span>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Line type="monotone" dataKey="applicants" stroke="#059669" strokeWidth={3} dot={{ r: 4, fill: "#059669" }} />
                  <Line type="monotone" dataKey="reviewed" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: "#f59e0b" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex gap-6 text-xs">
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> {t("admin.applicantsLegend")}</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> {t("admin.reviewedLegend")}</div>
            </div>
          </CardContent>
        </Card>

        {/* Queue pressure */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.queuePressure")}</CardTitle>
            <p className="text-sm text-muted">{t("admin.queuePressureSubtitle")}</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-4xl font-extrabold text-ink">{applicantLoad}%</span>
                <span className="text-xs font-semibold text-muted">{t("admin.reviewPending", { count: dashboard.summary.reviewQueue })}</span>
              </div>
              <Progress value={applicantLoad} />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${loadStatus.className}`}
                >
                  {t(`admin.queueStatus.${loadStatus.key}`)}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold ${
                    loadDelta > 0 ? "text-danger" : loadDelta < 0 ? "text-success" : "text-muted"
                  }`}
                  title={t("admin.queueVsLastWeek")}
                >
                  {loadDelta > 0 ? (
                    <ArrowUpRight className="h-3 w-3" />
                  ) : loadDelta < 0 ? (
                    <ArrowDownRight className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {loadDelta > 0 ? "+" : ""}
                  {loadDelta} {t("admin.queuePointsLabel")}
                </span>
                <span className="text-xs text-muted">{t("admin.queueVsLastWeek")}</span>
              </div>

              <p className="mt-3 text-xs text-muted">
                {t(`admin.queueGuidance.${loadStatus.key}`)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {t("admin.outOfTotal", { count: dashboard.summary.totalApplicants })}
              </p>
            </div>

            <div className="rounded-xl border border-border bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">{t("admin.session")}</p>
              <p className="mt-2 text-sm font-bold text-ink truncate">{dashboard.admin.email}</p>
              <p className="text-xs text-muted truncate">{dashboard.admin.department}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                <ShieldCheck className="h-3 w-3" /> {t("admin.verified")}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Education breakdown + Recent applicants */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent applicants table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">{t("admin.recentApplicants")}</CardTitle>
              <p className="mt-1 text-sm text-muted">{t("admin.recentApplicantsSubtitle")}</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/applicants">
                {t("admin.viewAll")} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 pr-4">{t("admin.thApplicant")}</th>
                    <th className="py-3 pr-4">{t("admin.thEducation")}</th>
                    <th className="py-3 pr-4">{t("admin.thStatus")}</th>
                    <th className="py-3 pr-4 text-right">{t("admin.thAge")}</th>
                    <th className="py-3 pl-2 text-right">
                      <span className="sr-only">{t("admin.thActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentApplicants.length > 0 ? (
                    dashboard.recentApplicants.map((applicant) => {
                      const initials = (applicant.name || "?")
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0].toUpperCase())
                        .join("") || "?";
                      const detailHref = `/admin/applicants/${applicant.id}`;
                      const mailHref = applicant.contact ? `mailto:${applicant.contact}` : null;
                      return (
                        <tr
                          key={applicant.id}
                          className="group border-b border-border last:border-0 hover:bg-emerald-50/40 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 pr-4">
                            <Link to={detailHref} className="flex items-center gap-3 group/name">
                              <Avatar className="h-9 w-9 shrink-0">
                                {applicant.photo && (
                                  <AvatarImage src={applicant.photo} alt={applicant.name} />
                                )}
                                <AvatarFallback className="bg-gradient-to-br from-primary to-emerald-700 text-white text-xs font-bold">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-semibold text-ink group-hover/name:text-primary truncate">{applicant.name}</p>
                                <p className="text-xs text-muted truncate">{applicant.contact}</p>
                              </div>
                            </Link>
                          </td>
                          <td className="py-3 pr-4 text-muted">{applicant.education}</td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary-dark">
                              {applicant.status}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-ink">{applicant.age}</td>
                          <td className="py-3 pl-2 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label={t("admin.applicantActionsAria", { name: applicant.name })}
                                  className="inline-grid h-8 w-8 place-items-center rounded-lg text-muted opacity-60 transition hover:bg-white hover:text-ink hover:shadow-sm group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link to={detailHref}>
                                    <Eye className="h-4 w-4" />
                                    {t("admin.actionView")}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link to={`${detailHref}?action=approve`}>
                                    <Check className="h-4 w-4" />
                                    {t("admin.actionApprove")}
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild disabled={!mailHref}>
                                  <a href={mailHref || "#"}>
                                    <Mail className="h-4 w-4" />
                                    {t("admin.actionMessage")}
                                  </a>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-sm text-muted">
                        {t("admin.noRecentApplicants")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Education breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("admin.educationBreakdown")}</CardTitle>
            <p className="text-sm text-muted">{t("admin.educationBreakdownSubtitle")}</p>
          </CardHeader>
          <CardContent>
            {educationData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={educationData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" stroke="#64748b" fontSize={11} />
                    <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={11} width={90} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar dataKey="value" fill="#059669" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="h-10 w-10 text-muted/40" />
                <p className="mt-3 text-sm text-muted">{t("admin.noData")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
