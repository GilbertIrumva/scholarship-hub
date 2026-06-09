import { useEffect, useState, useCallback, useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plane,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Calendar,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Globe2,
  Search,
  TrendingUp,
  AlertTriangle,
  Stamp,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "./DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  VISA_TYPES,
  WORKFLOW_STATUSES,
  MILESTONE_STATUSES,
  listAdminVisaWorkflows,
  getAdminVisaStats,
  updateAdminVisaWorkflow,
  updateAdminMilestone,
  addAdminVisaNote,
} from "../../services/visaWorkflow";

const STATUS_META = {
  "not-started": { chip: "bg-slate-100 text-slate-600", icon: Clock },
  "in-progress": { chip: "bg-sky-100 text-sky-700", icon: Clock },
  submitted: { chip: "bg-amber-100 text-amber-800", icon: Send },
  approved: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { chip: "bg-rose-100 text-rose-700", icon: XCircle },
  completed: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  "on-hold": { chip: "bg-amber-100 text-amber-800", icon: AlertCircle },
};

const MILESTONE_META = {
  pending: { chip: "bg-slate-100 text-slate-600", icon: Clock },
  "in-progress": { chip: "bg-sky-100 text-sky-700", icon: Clock },
  done: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  blocked: { chip: "bg-rose-100 text-rose-700", icon: AlertCircle },
  skipped: { chip: "bg-slate-100 text-slate-500", icon: XCircle },
};

const STATUS_LABEL = Object.fromEntries(WORKFLOW_STATUSES.map((s) => [s.value, s.label]));

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

const formatDateTime = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const StatusChip = ({ status }) => {
  const cfg = STATUS_META[status] || STATUS_META["not-started"];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.chip}`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status] || status}
    </span>
  );
};

const StatTile = ({ icon: Icon, label, value, accent = "bg-primary/10 text-primary" }) => (
  <Card>
    <CardContent className="flex items-center gap-3 p-4">
      <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
        <p className="text-xl font-extrabold text-ink">{value}</p>
      </div>
    </CardContent>
  </Card>
);

const MiniMilestone = ({ milestone, sessionToken, workflowId, onUpdated }) => {
  const [saving, setSaving] = useState(false);
  const cfg = MILESTONE_META[milestone.status] || MILESTONE_META.pending;
  const Icon = cfg.icon;

  const cycle = async () => {
    const order = ["pending", "in-progress", "done", "blocked"];
    const idx = order.indexOf(milestone.status);
    const next = order[(idx + 1) % order.length] || "pending";
    setSaving(true);
    try {
      const { workflow } = await updateAdminMilestone(
        sessionToken,
        workflowId,
        milestone.key,
        { status: next }
      );
      onUpdated(workflow);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update milestone.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={saving}
      className="flex w-full items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
      title="Click to cycle status"
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${cfg.chip}`}>
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
        {milestone.label}
      </span>
      {milestone.dueDate && (
        <span className="shrink-0 text-[10px] text-muted">
          {formatDate(milestone.dueDate)}
        </span>
      )}
    </button>
  );
};

const WorkflowExpanded = ({ workflow, sessionToken, onUpdated }) => {
  const [status, setStatus] = useState(workflow.status);
  const [savingStatus, setSavingStatus] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  useEffect(() => setStatus(workflow.status), [workflow.status]);

  const saveStatus = async (next) => {
    setStatus(next);
    setSavingStatus(true);
    try {
      const { workflow: updated } = await updateAdminVisaWorkflow(
        sessionToken,
        workflow.id,
        { status: next }
      );
      toast.success("Status updated.");
      onUpdated(updated);
    } catch (err) {
      setStatus(workflow.status);
      toast.error(err?.response?.data?.message || "Failed to update status.");
    } finally {
      setSavingStatus(false);
    }
  };

  const postNote = async () => {
    const trimmed = noteBody.trim();
    if (!trimmed) return;
    setPostingNote(true);
    try {
      const { workflow: updated } = await addAdminVisaNote(
        sessionToken,
        workflow.id,
        trimmed
      );
      onUpdated(updated);
      setNoteBody("");
      toast.success("Note added.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add note.");
    } finally {
      setPostingNote(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Status</Label>
          <select
            value={status}
            onChange={(e) => saveStatus(e.target.value)}
            disabled={savingStatus}
            className="h-9 rounded-md border border-border bg-white px-2 text-sm"
          >
            {WORKFLOW_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Destination</Label>
          <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-white px-2 text-sm">
            <Globe2 className="h-3.5 w-3.5 text-muted" />
            <span className="font-semibold text-ink">
              {workflow.destinationCountry || "—"}
            </span>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs">Visa type</Label>
          <div className="flex h-9 items-center rounded-md border border-border bg-white px-2 text-sm font-semibold text-ink">
            {VISA_TYPES.find((t) => t.value === workflow.visaType)?.label || workflow.visaType}
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Milestones ({workflow.milestones.filter((m) => m.status === "done").length}/{workflow.milestones.length})
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {workflow.milestones.map((m) => (
            <MiniMilestone
              key={m.key}
              milestone={m}
              workflowId={workflow.id}
              sessionToken={sessionToken}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
          Key dates
        </p>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
          {[
            ["Appointment", workflow.appointmentDate],
            ["Submitted", workflow.submittedAt],
            ["Decision", workflow.decisionAt],
            ["Issued", workflow.visaIssuedAt],
            ["Expiry", workflow.visaExpiry],
          ].map(([label, val]) => (
            <div key={label} className="rounded-md border border-border bg-white px-2 py-1.5">
              <p className="text-[10px] font-bold uppercase text-muted">{label}</p>
              <p className="font-semibold text-ink">{formatDate(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {(workflow.embassy?.country || workflow.embassy?.city || workflow.embassy?.contactEmail) && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
            Embassy / Consulate
          </p>
          <div className="rounded-md border border-border bg-white px-3 py-2 text-xs text-ink">
            {[workflow.embassy.city, workflow.embassy.country].filter(Boolean).join(", ") || "—"}
            {workflow.embassy.address && (
              <p className="text-muted">{workflow.embassy.address}</p>
            )}
            {workflow.embassy.contactEmail && (
              <p className="text-muted">{workflow.embassy.contactEmail}</p>
            )}
            {workflow.embassy.website && (
              <a
                href={workflow.embassy.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                {workflow.embassy.website}
              </a>
            )}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
          <MessageSquare className="h-3 w-3" />
          Timeline ({workflow.timeline.length})
        </p>
        <div className="grid gap-2">
          <div className="flex gap-2">
            <textarea
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value.slice(0, 1000))}
              placeholder="Reply to the scholar with guidance or a status update..."
              rows={2}
              className="flex-1 rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <Button size="sm" onClick={postNote} disabled={postingNote || !noteBody.trim()}>
              {postingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {workflow.timeline.length === 0 ? (
            <p className="rounded-md bg-white px-3 py-2 text-center text-xs text-muted">
              No notes yet on this workflow.
            </p>
          ) : (
            <ul className="max-h-60 space-y-1.5 overflow-y-auto">
              {workflow.timeline.slice().reverse().map((note) => (
                <li
                  key={note.id}
                  className={`rounded-md border px-2.5 py-1.5 text-xs ${
                    note.author === "admin"
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-muted">
                      {note.author === "admin" ? "Admin" : "Scholar"} · {note.authorName || ""}
                    </span>
                    <span className="text-[10px] text-muted">{formatDateTime(note.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-ink">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const WorkflowRow = ({ workflow, sessionToken, onUpdated, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const doneCount = workflow.milestones.filter((m) => m.status === "done").length;
  const pct = workflow.milestones.length > 0
    ? Math.round((doneCount / workflow.milestones.length) * 100)
    : 0;

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Plane className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-ink">
                {workflow.scholarship?.title || "Approved scholarship"}
              </p>
              <p className="truncate text-xs text-muted">
                <User className="mr-1 inline h-3 w-3" />
                {workflow.scholar?.name || "Unknown scholar"}
                {workflow.scholar?.email ? ` · ${workflow.scholar.email}` : ""}
                {workflow.destinationCountry && ` · ${workflow.destinationCountry}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={workflow.status} />
              {open ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
            </div>
          </div>
          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-muted">
              <span>Progress</span>
              <span>{doneCount} / {workflow.milestones.length} · {pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </button>
      {open && (
        <WorkflowExpanded
          workflow={workflow}
          sessionToken={sessionToken}
          onUpdated={onUpdated}
        />
      )}
    </Card>
  );
};

const AlertList = ({ icon: Icon, title, items, accent, empty, render }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${accent}`} />
        {title}
        <span className="ml-auto text-xs font-normal text-muted">{items.length}</span>
      </CardTitle>
    </CardHeader>
    <CardContent className="pt-0">
      {items.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-3 text-center text-xs text-muted">
          {empty}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.slice(0, 6).map((item, i) => (
            <li
              key={`${item.workflowId}-${i}`}
              className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs"
            >
              {render(item)}
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

const AdminVisaTrackerPage = () => {
  const navigate = useNavigate();
  const { sessionToken, adminDashboard, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const scholarFilter = searchParams.get("scholar") || "";
  const focusId = searchParams.get("workflow") || "";
  const [workflows, setWorkflows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchAll = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const params = {};
      if (scholarFilter) params.scholar = scholarFilter;
      const [list, summary] = await Promise.all([
        listAdminVisaWorkflows(sessionToken, params),
        getAdminVisaStats(sessionToken),
      ]);
      setWorkflows(Array.isArray(list?.workflows) ? list.workflows : []);
      setStats(summary || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load visa workflows.");
    } finally {
      setLoading(false);
    }
  }, [sessionToken, scholarFilter]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleUpdated = useCallback((updated) => {
    setWorkflows((p) => p.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
    fetchAll();
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return workflows.filter((w) => {
      if (statusFilter !== "all" && w.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (w.scholar?.name || "").toLowerCase().includes(q) ||
        (w.scholar?.email || "").toLowerCase().includes(q) ||
        (w.scholarship?.title || "").toLowerCase().includes(q) ||
        (w.destinationCountry || "").toLowerCase().includes(q)
      );
    });
  }, [workflows, statusFilter, search]);

  const clearScholarFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("scholar");
    next.delete("workflow");
    setSearchParams(next);
  };

  if (!sessionToken) return <Navigate to="/login" replace />;

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title="Visa workflows"
      subtitle="Monitor every approved scholar's visa journey"
      onSignOut={handleSignOut}
      actions={
        scholarFilter ? (
          <Button variant="outline" size="sm" onClick={clearScholarFilter}>
            Clear scholar filter
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Analytics */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={Plane}
                label="Workflows"
                value={stats.total}
              />
              <StatTile
                icon={TrendingUp}
                label="Milestones done"
                value={`${stats.milestones.completionRate}%`}
                accent="bg-emerald-100 text-emerald-700"
              />
              <StatTile
                icon={AlertTriangle}
                label="Overdue milestones"
                value={stats.overdueMilestones.length}
                accent="bg-rose-100 text-rose-700"
              />
              <StatTile
                icon={Calendar}
                label="Appointments ≤30d"
                value={stats.upcomingAppointments.length}
                accent="bg-amber-100 text-amber-700"
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">By status</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-1.5">
                    {WORKFLOW_STATUSES.map((s) => {
                      const count = stats.byStatus[s.value] || 0;
                      const pct = stats.total > 0
                        ? Math.round((count / stats.total) * 100)
                        : 0;
                      return (
                        <li key={s.value} className="flex items-center gap-2 text-xs">
                          <span className="w-24 shrink-0 font-semibold text-ink">{s.label}</span>
                          <div className="flex-1">
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="w-12 shrink-0 text-right font-bold text-ink">{count}</span>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top destinations</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.topDestinations.length === 0 ? (
                    <p className="rounded-md bg-slate-50 px-3 py-3 text-center text-xs text-muted">
                      No destination data yet.
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {stats.topDestinations.map((d) => (
                        <li
                          key={d.country}
                          className="flex items-center justify-between rounded-md border border-border bg-white px-3 py-1.5 text-xs"
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                            <Globe2 className="h-3 w-3 text-muted" />
                            {d.country}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                            {d.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Milestone breakdown</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="max-h-56 space-y-1 overflow-y-auto">
                    {stats.milestones.breakdown.map((m) => {
                      const total = MILESTONE_STATUSES.reduce(
                        (acc, s) => acc + (m[s.value] || 0),
                        0
                      );
                      const donePct = total > 0
                        ? Math.round(((m.done || 0) / total) * 100)
                        : 0;
                      return (
                        <li key={m.key} className="grid gap-0.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="truncate font-semibold text-ink">{m.label}</span>
                            <span className="shrink-0 text-muted">
                              {m.done || 0}/{total}
                            </span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${donePct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <AlertList
                icon={AlertTriangle}
                accent="text-rose-600"
                title="Overdue milestones"
                items={stats.overdueMilestones}
                empty="Nothing overdue — great work."
                render={(item) => (
                  <div className="grid gap-0.5">
                    <span className="font-bold text-ink">{item.milestoneLabel}</span>
                    <span className="text-muted">
                      {item.scholar?.name || "Scholar"} · {item.daysOverdue}d overdue
                    </span>
                  </div>
                )}
              />
              <AlertList
                icon={Calendar}
                accent="text-amber-600"
                title="Upcoming appointments"
                items={stats.upcomingAppointments}
                empty="No appointments in the next 30 days."
                render={(item) => (
                  <div className="grid gap-0.5">
                    <span className="font-bold text-ink">
                      {item.scholar?.name || "Scholar"}
                      {item.destinationCountry && ` → ${item.destinationCountry}`}
                    </span>
                    <span className="text-muted">
                      {formatDate(item.appointmentDate)} · in {item.daysUntil}d
                    </span>
                  </div>
                )}
              />
              <AlertList
                icon={Stamp}
                accent="text-sky-600"
                title="Visas expiring ≤90d"
                items={stats.expiringVisas}
                empty="No visas expiring soon."
                render={(item) => (
                  <div className="grid gap-0.5">
                    <span className="font-bold text-ink">
                      {item.scholar?.name || "Scholar"}
                    </span>
                    <span className="text-muted">
                      Expires {formatDate(item.visaExpiry)} · {item.daysUntil}d
                    </span>
                  </div>
                )}
              />
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scholar, scholarship, destination..."
                className="h-9 pl-8"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="all">All statuses</option>
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <span className="text-xs font-semibold text-muted">
              {filtered.length} / {workflows.length} workflow{workflows.length === 1 ? "" : "s"}
            </span>
          </CardContent>
        </Card>

        {/* Workflow list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Plane className="h-10 w-10 text-muted/40" />
              <h3 className="mt-3 text-lg font-bold text-ink">
                No matching visa workflows
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted">
                Workflows appear once a scholar starts tracking the visa journey
                for an approved scholarship.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((w) => (
              <WorkflowRow
                key={w.id}
                workflow={w}
                sessionToken={sessionToken}
                onUpdated={handleUpdated}
                defaultOpen={focusId === w.id}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminVisaTrackerPage;
