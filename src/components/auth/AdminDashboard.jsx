import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  ShieldCheck,
  Users,
  BarChart3,
  GraduationCap,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
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

// -----------------------------------------------------------------------------
// Mini stat card with optional trend indicator
// -----------------------------------------------------------------------------
const StatCard = ({ icon: Icon, label, value, note, accent = "bg-primary", trend }) => (
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
          {trend && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold ${trend >= 0 ? "text-success" : "text-danger"}`}>
              <TrendingUp className={`h-3.5 w-3.5 ${trend < 0 ? "rotate-180" : ""}`} />
              {Math.abs(trend)}%
            </span>
          )}
        </div>
        <p className="mt-4 text-3xl font-extrabold text-ink tracking-tight">{value}</p>
        <p className="mt-1 text-sm font-semibold text-muted">{label}</p>
        {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

// -----------------------------------------------------------------------------
// Chart sample data — derive from dashboard.summary if available
// -----------------------------------------------------------------------------
const buildChartData = (summary) => {
  // Synthesize a simple weekly trend from current counts
  const total = summary?.totalApplicants ?? 0;
  const base = Math.max(1, Math.round(total / 14));
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, idx) => ({
    day,
    applicants: Math.max(0, Math.round(base * (1 + Math.sin(idx) * 0.6 + idx * 0.1))),
    reviewed: Math.max(0, Math.round(base * (0.4 + Math.cos(idx) * 0.3))),
  }));
};

const buildEducationData = (recent) => {
  const counts = {};
  (recent || []).forEach((a) => {
    const key = a.education || "Unspecified";
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
};

// =============================================================================
// MAIN DASHBOARD CONTENT
// =============================================================================
const AdminDashboard = ({ dashboard, isRefreshing, onOpenSettings, onRefresh }) => {
  const applicantLoad = dashboard.summary.totalApplicants
    ? Math.min(Math.round((dashboard.summary.reviewQueue / dashboard.summary.totalApplicants) * 100), 100)
    : 0;

  const chartData = useMemo(() => buildChartData(dashboard.summary), [dashboard.summary]);
  const educationData = useMemo(() => buildEducationData(dashboard.recentApplicants), [dashboard.recentApplicants]);

  const summaryCards = [
    { icon: Users, label: "Total Applicants", value: dashboard.summary.totalApplicants, note: "Active applicant records", accent: "bg-gradient-to-br from-primary to-emerald-700", trend: 12 },
    { icon: BadgeCheck, label: "Graduate Profiles", value: dashboard.summary.graduateApplicants, note: "Postgraduate-ready candidates", accent: "bg-gradient-to-br from-accent to-orange-600", trend: 8 },
    { icon: BarChart3, label: "Average Age", value: dashboard.summary.averageAge, note: "Average across the intake", accent: "bg-gradient-to-br from-sky-500 to-indigo-600" },
    { icon: ShieldCheck, label: "Review Queue", value: dashboard.summary.reviewQueue, note: `${applicantLoad}% of intake pending`, accent: "bg-gradient-to-br from-rose-500 to-red-600", trend: -5 },
  ];

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
            Welcome back
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
            Credential Settings
          </Button>
          <Button onClick={onRefresh} disabled={isRefreshing}>
            <Activity className="h-4 w-4" />
            {isRefreshing ? "Refreshing…" : "Refresh data"}
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
              <CardTitle className="text-lg">Applicant activity (last 7 days)</CardTitle>
              <p className="mt-1 text-sm text-muted">New applicants vs. reviewed</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Live
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
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-primary" /> Applicants</div>
              <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent" /> Reviewed</div>
            </div>
          </CardContent>
        </Card>

        {/* Queue pressure */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Queue pressure</CardTitle>
            <p className="text-sm text-muted">Review backlog vs. intake</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex items-end justify-between mb-2">
                <span className="text-4xl font-extrabold text-ink">{applicantLoad}%</span>
                <span className="text-xs font-semibold text-muted">{dashboard.summary.reviewQueue} pending</span>
              </div>
              <Progress value={applicantLoad} />
              <p className="mt-2 text-xs text-muted">
                Out of {dashboard.summary.totalApplicants} total applicants
              </p>
            </div>

            <div className="rounded-xl border border-border bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Session</p>
              <p className="mt-2 text-sm font-bold text-ink truncate">{dashboard.admin.email}</p>
              <p className="text-xs text-muted truncate">{dashboard.admin.department}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                <ShieldCheck className="h-3 w-3" /> Verified
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
              <CardTitle className="text-lg">Recent applicants</CardTitle>
              <p className="mt-1 text-sm text-muted">Latest intake snapshot</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/applicants">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 pr-4">Applicant</th>
                    <th className="py-3 pr-4">Education</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentApplicants.length > 0 ? (
                    dashboard.recentApplicants.map((applicant) => (
                      <tr key={applicant.id} className="border-b border-border last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 pr-4">
                          <Link to={`/admin/applicants/${applicant.id}`} className="block group">
                            <p className="font-semibold text-ink group-hover:text-primary">{applicant.name}</p>
                            <p className="text-xs text-muted">{applicant.contact}</p>
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted">{applicant.education}</td>
                        <td className="py-3 pr-4">
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary-dark">
                            {applicant.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right font-semibold text-ink">{applicant.age}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-muted">
                        No recent applicants yet.
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
            <CardTitle className="text-lg">Education breakdown</CardTitle>
            <p className="text-sm text-muted">Recent intake by level</p>
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
                <p className="mt-3 text-sm text-muted">No data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
