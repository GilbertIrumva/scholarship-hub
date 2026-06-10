import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Plane,
  Loader2,
  ArrowUpRight,
  AlertTriangle,
  Calendar,
  TrendingUp,
  Stamp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAdminVisaStats } from "../../services/visaWorkflow";

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const Tile = ({ icon: Icon, label, value, accent }) => (
  <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${accent}`}>
      <Icon className="h-4 w-4" />
    </div>
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="text-lg font-extrabold text-ink">{value}</p>
    </div>
  </div>
);

const AdminVisaSnapshot = ({ sessionToken }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let alive = true;
    setLoading(true);
    getAdminVisaStats(sessionToken)
      .then((data) => alive && setStats(data))
      .catch(() => alive && setStats(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sessionToken]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plane className="h-5 w-5 text-primary" />
            {t("adminVisa.workflowsTitle")}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/visa-tracker">
              {t("adminVisa.openTracker")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-muted">
            {t("adminVisa.noVisaWorkflows")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plane className="h-5 w-5 text-primary" />
              {t("adminVisa.workflowsTitle")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              {t("adminVisa.snapshotSubtitle")}
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/visa-tracker">
              {t("adminVisa.openTracker")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Tile
              icon={Plane}
              label={t("adminVisa.tileActive")}
              value={stats.total}
              accent="bg-primary/10 text-primary"
            />
            <Tile
              icon={TrendingUp}
              label={t("adminVisa.tileMilestonesDone")}
              value={`${stats.milestones.completionRate}%`}
              accent="bg-emerald-100 text-emerald-700"
            />
            <Tile
              icon={AlertTriangle}
              label={t("adminVisa.tileOverdue")}
              value={stats.overdueMilestones.length}
              accent="bg-rose-100 text-rose-700"
            />
            <Tile
              icon={Calendar}
              label={t("adminVisa.tileUpcomingAppts")}
              value={stats.upcomingAppointments.length}
              accent="bg-amber-100 text-amber-700"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <AlertTriangle className="h-3 w-3 text-rose-500" />
                {t("adminVisa.overdueMilestones")}
              </p>
              {stats.overdueMilestones.length === 0 ? (
                <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-muted">
                  {t("adminVisa.nothingOverdue")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {stats.overdueMilestones.slice(0, 4).map((item, i) => (
                    <li
                      key={`${item.workflowId}-${i}`}
                      className="rounded-md bg-rose-50/60 px-2 py-1 text-xs"
                    >
                      <p className="truncate font-bold text-ink">
                        {item.milestoneLabel}
                      </p>
                      <p className="truncate text-muted">
                        {item.scholar?.name || t("adminVisa.scholar")} · {t("adminVisa.daysShort", { count: item.daysOverdue })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <Calendar className="h-3 w-3 text-amber-500" />
                {t("adminVisa.upcomingAppts")}
              </p>
              {stats.upcomingAppointments.length === 0 ? (
                <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-muted">
                  {t("adminVisa.none30Days")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {stats.upcomingAppointments.slice(0, 4).map((item, i) => (
                    <li
                      key={`${item.workflowId}-${i}`}
                      className="rounded-md bg-amber-50/60 px-2 py-1 text-xs"
                    >
                      <p className="truncate font-bold text-ink">
                        {item.scholar?.name || t("adminVisa.scholar")}
                        {item.destinationCountry && ` → ${item.destinationCountry}`}
                      </p>
                      <p className="truncate text-muted">
                        {formatDate(item.appointmentDate)} · {t("adminVisa.inDays", { count: item.daysUntil })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-white p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
                <Stamp className="h-3 w-3 text-sky-500" />
                {t("adminVisa.visasExpiring")}
              </p>
              {stats.expiringVisas.length === 0 ? (
                <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-muted">
                  {t("adminVisa.noneExpiring")}
                </p>
              ) : (
                <ul className="space-y-1">
                  {stats.expiringVisas.slice(0, 4).map((item, i) => (
                    <li
                      key={`${item.workflowId}-${i}`}
                      className="rounded-md bg-sky-50/60 px-2 py-1 text-xs"
                    >
                      <p className="truncate font-bold text-ink">
                        {item.scholar?.name || t("adminVisa.scholar")}
                      </p>
                      <p className="truncate text-muted">
                        {formatDate(item.visaExpiry)} · {t("adminVisa.daysLeft", { count: item.daysUntil })}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default AdminVisaSnapshot;
