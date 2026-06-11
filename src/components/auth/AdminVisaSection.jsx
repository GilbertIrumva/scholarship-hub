import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plane,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Send,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InlineEmptyMark } from "@/components/ui/empty-illustrations";
import { listAdminVisaWorkflows } from "../../services/visaWorkflow";

const STATUS_META = {
  "not-started": { chip: "bg-slate-100 text-slate-600", icon: Clock },
  "in-progress": { chip: "bg-sky-100 text-sky-700", icon: Clock },
  submitted: { chip: "bg-amber-100 text-amber-800", icon: Send },
  approved: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { chip: "bg-rose-100 text-rose-700", icon: XCircle },
  completed: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  "on-hold": { chip: "bg-amber-100 text-amber-800", icon: AlertCircle },
};

const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const StatusChip = ({ status }) => {
  const { t } = useTranslation();
  const cfg = STATUS_META[status] || STATUS_META["not-started"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.chip}`}>
      <Icon className="h-2.5 w-2.5" />
      {t(`visa.workflowStatuses.${status}`, { defaultValue: status })}
    </span>
  );
};

const AdminVisaSection = ({ sessionToken, scholarId }) => {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!sessionToken || !scholarId) return;
    setLoading(true);
    try {
      const { workflows: wfs } = await listAdminVisaWorkflows(sessionToken, {
        scholar: scholarId,
      });
      setWorkflows(Array.isArray(wfs) ? wfs : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("adminVisa.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, scholarId, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plane className="h-4 w-4 text-primary" />
          {t("adminVisa.workflowsTitle")}
          {workflows.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {workflows.length}
            </span>
          )}
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link to={`/admin/visa-tracker?scholar=${scholarId}`}>
            {t("adminVisa.manage")} <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-md bg-slate-50 px-3 py-4">
            <InlineEmptyMark className="h-10 w-auto text-primary" />
            <p className="text-center text-xs text-muted">{t("adminVisa.noWorkflowsForScholar")}</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {workflows.map((w) => {
              const doneCount = w.milestones.filter((m) => m.status === "done").length;
              const pct = w.milestones.length > 0
                ? Math.round((doneCount / w.milestones.length) * 100)
                : 0;
              return (
                <li key={w.id}>
                  <Link
                    to={`/admin/visa-tracker?scholar=${scholarId}&workflow=${w.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-border bg-white p-3 transition-colors hover:border-primary"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                      <Plane className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-bold text-ink group-hover:text-primary">
                          {w.scholarship?.title || t("adminVisa.approvedScholarship")}
                        </p>
                        <StatusChip status={w.status} />
                      </div>
                      <p className="text-xs text-muted">
                        {w.destinationCountry || "—"}
                        {w.appointmentDate && ` · ${t("adminVisa.appointmentLabel")} ${formatDate(w.appointmentDate)}`}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-muted">
                          {doneCount}/{w.milestones.length}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminVisaSection;
