import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plane,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Calendar,
  Globe2,
  Building2,
  Mail,
  Link as LinkIcon,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  VISA_TYPES,
  WORKFLOW_STATUSES,
  MILESTONE_STATUSES,
  listVisaWorkflows,
  createVisaWorkflow,
  updateVisaWorkflow,
  updateMilestone,
  addVisaNote,
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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateInput = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
};

const StatusChip = ({ status, meta = STATUS_META }) => {
  const cfg = meta[status] || meta.pending || { chip: "bg-slate-100 text-slate-600", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.chip}`}>
      <Icon className="h-3 w-3" />
      {STATUS_LABEL[status] || status}
    </span>
  );
};

const MilestoneRow = ({ milestone, sessionToken, workflowId, onUpdated }) => {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(milestone.status);
  const [dueDate, setDueDate] = useState(toDateInput(milestone.dueDate));
  const [note, setNote] = useState(milestone.note || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStatus(milestone.status);
    setDueDate(toDateInput(milestone.dueDate));
    setNote(milestone.note || "");
  }, [milestone.status, milestone.dueDate, milestone.note]);

  const save = async () => {
    setSaving(true);
    try {
      const { workflow } = await updateMilestone(sessionToken, workflowId, milestone.key, {
        status, dueDate: dueDate || null, note,
      });
      toast.success("Milestone updated.");
      onUpdated(workflow);
      setExpanded(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const quickToggle = async () => {
    const next = milestone.status === "done" ? "pending" : "done";
    setSaving(true);
    try {
      const { workflow } = await updateMilestone(sessionToken, workflowId, milestone.key, { status: next });
      onUpdated(workflow);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update.");
    } finally {
      setSaving(false);
    }
  };

  const cfg = MILESTONE_META[milestone.status] || MILESTONE_META.pending;
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={quickToggle}
          disabled={saving}
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${cfg.chip}`}
          title={milestone.status === "done" ? "Mark as pending" : "Mark as done"}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`text-sm font-semibold ${milestone.status === "done" ? "text-muted line-through" : "text-ink"}`}>
              {milestone.label}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Details
            </Button>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
            {milestone.dueDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Due {formatDate(milestone.dueDate)}
              </span>
            )}
            {milestone.completedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Done {formatDate(milestone.completedAt)}
              </span>
            )}
            {milestone.note && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Note
              </span>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="h-9 rounded-md border border-border bg-white px-2 text-sm"
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Due date</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="mt-3 grid gap-1.5">
            <Label className="text-xs">Note</Label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              rows={2}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Optional note for this milestone"
            />
            <p className="text-right text-[10px] text-muted">{note.length}/500</p>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const WorkflowDetailsForm = ({ workflow, sessionToken, onUpdated }) => {
  const [form, setForm] = useState({
    visaType: workflow.visaType,
    status: workflow.status,
    destinationCountry: workflow.destinationCountry || "",
    visaReference: workflow.visaReference || "",
    appointmentDate: toDateInput(workflow.appointmentDate),
    submittedAt: toDateInput(workflow.submittedAt),
    decisionAt: toDateInput(workflow.decisionAt),
    visaIssuedAt: toDateInput(workflow.visaIssuedAt),
    visaExpiry: toDateInput(workflow.visaExpiry),
    embassy: {
      country: workflow.embassy?.country || "",
      city: workflow.embassy?.city || "",
      address: workflow.embassy?.address || "",
      website: workflow.embassy?.website || "",
      contactEmail: workflow.embassy?.contactEmail || "",
    },
  });
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((p) => ({ ...p, [key]: value }));
  const setEmbassy = (key, value) =>
    setForm((p) => ({ ...p, embassy: { ...p.embassy, [key]: value } }));

  const save = async () => {
    setSaving(true);
    try {
      const { workflow: updated } = await updateVisaWorkflow(sessionToken, workflow.id, form);
      toast.success("Saved.");
      onUpdated(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Workflow details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Visa type</Label>
            <select
              value={form.visaType}
              onChange={(e) => set("visaType", e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            >
              {VISA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Overall status</Label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
            >
              {WORKFLOW_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Destination country (ISO)</Label>
            <Input
              value={form.destinationCountry}
              onChange={(e) => set("destinationCountry", e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              placeholder="US, GB, DE..."
              className="h-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label className="text-xs">Visa reference number</Label>
            <Input
              value={form.visaReference}
              onChange={(e) => set("visaReference", e.target.value)}
              maxLength={100}
              placeholder="Visa application reference"
              className="h-9"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Embassy appointment</Label>
            <Input
              type="date"
              value={form.appointmentDate}
              onChange={(e) => set("appointmentDate", e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ["submittedAt", "Submitted"],
            ["decisionAt", "Decision date"],
            ["visaIssuedAt", "Visa issued"],
            ["visaExpiry", "Visa expiry"],
          ].map(([key, label]) => (
            <div className="grid gap-1.5" key={key}>
              <Label className="text-xs">{label}</Label>
              <Input
                type="date"
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="h-9"
              />
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
            <Building2 className="h-3.5 w-3.5" />
            Embassy / Consulate
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Embassy country</Label>
              <Input
                value={form.embassy.country}
                onChange={(e) => setEmbassy("country", e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                placeholder="US"
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">City</Label>
              <Input
                value={form.embassy.city}
                onChange={(e) => setEmbassy("city", e.target.value)}
                maxLength={100}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label className="text-xs">Address</Label>
              <Input
                value={form.embassy.address}
                onChange={(e) => setEmbassy("address", e.target.value)}
                maxLength={300}
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Website</Label>
              <Input
                value={form.embassy.website}
                onChange={(e) => setEmbassy("website", e.target.value)}
                maxLength={300}
                placeholder="https://..."
                className="h-9"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input
                type="email"
                value={form.embassy.contactEmail}
                onChange={(e) => setEmbassy("contactEmail", e.target.value)}
                maxLength={200}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const TimelineSection = ({ workflow, sessionToken, onUpdated }) => {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const post = async () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const { workflow: updated } = await addVisaNote(sessionToken, workflow.id, trimmed);
      onUpdated(updated);
      setBody("");
      toast.success("Note added.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to add note.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" />
          Timeline notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 1000))}
            rows={2}
            placeholder="Log a quick update for yourself and reviewers..."
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted">{body.length}/1000</span>
            <Button size="sm" onClick={post} disabled={posting || !body.trim()}>
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Add note
            </Button>
          </div>
        </div>

        {workflow.timeline.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-muted">
            No notes yet — add one above to start the timeline.
          </p>
        ) : (
          <ul className="space-y-2">
            {workflow.timeline.slice().reverse().map((note) => (
              <li
                key={note.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  note.author === "admin"
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted">
                    {note.author === "admin" ? "Reviewer" : "You"} · {note.authorName || ""}
                  </span>
                  <span className="text-[10px] text-muted">{formatDateTime(note.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

const WorkflowPanel = ({ workflow, sessionToken, onUpdated }) => {
  const doneCount = workflow.milestones.filter((m) => m.status === "done").length;
  const total = workflow.milestones.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Visa workflow
              </p>
              <h2 className="mt-1 text-xl font-extrabold text-ink">
                {workflow.scholarship?.title || "Approved scholarship"}
              </h2>
              <p className="text-sm text-muted">
                {workflow.scholarship?.provider || ""}
                {workflow.scholarship?.country && ` · ${workflow.scholarship.country}`}
              </p>
            </div>
            <StatusChip status={workflow.status} />
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Milestones progress</span>
              <span>{doneCount} / {total} · {pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Milestones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workflow.milestones.map((m) => (
            <MilestoneRow
              key={m.key}
              milestone={m}
              workflowId={workflow.id}
              sessionToken={sessionToken}
              onUpdated={onUpdated}
            />
          ))}
        </CardContent>
      </Card>

      <WorkflowDetailsForm
        workflow={workflow}
        sessionToken={sessionToken}
        onUpdated={onUpdated}
      />

      <TimelineSection
        workflow={workflow}
        sessionToken={sessionToken}
        onUpdated={onUpdated}
      />
    </motion.div>
  );
};

const CreateWorkflowForm = ({ eligibleApplications, sessionToken, onCreated }) => {
  const available = useMemo(
    () => eligibleApplications.filter((a) => !a.hasWorkflow),
    [eligibleApplications]
  );
  const [appId, setAppId] = useState(available[0]?.id || "");
  const [visaType, setVisaType] = useState("student");
  const [country, setCountry] = useState(available[0]?.scholarship?.country || "");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setAppId(available[0]?.id || "");
    setCountry(available[0]?.scholarship?.country || "");
  }, [available]);

  if (available.length === 0) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!appId) return;
    setCreating(true);
    try {
      const { workflow } = await createVisaWorkflow(sessionToken, {
        scholarshipApplicationId: appId,
        destinationCountry: country,
        visaType,
      });
      toast.success("Visa workflow created.");
      onCreated(workflow);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create workflow.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-primary" />
          Start a new visa workflow
        </CardTitle>
        <p className="text-xs text-muted">
          You have approved scholarships waiting for a visa tracker.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Approved scholarship</Label>
            <select
              value={appId}
              onChange={(e) => {
                setAppId(e.target.value);
                const next = available.find((a) => a.id === e.target.value);
                setCountry(next?.scholarship?.country || "");
              }}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
            >
              {available.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.scholarship?.title || "Scholarship"}
                  {a.scholarship?.country ? ` (${a.scholarship.country})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">Visa type</Label>
              <select
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
                className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              >
                {VISA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Destination country (ISO)</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 3))}
                maxLength={3}
                placeholder="US, GB, DE..."
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create workflow
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const VisaTrackerPage = () => {
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [workflows, setWorkflows] = useState([]);
  const [eligibleApps, setEligibleApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const data = await listVisaWorkflows(sessionToken);
      const wfs = Array.isArray(data?.workflows) ? data.workflows : [];
      setWorkflows(wfs);
      setEligibleApps(Array.isArray(data?.eligibleApplications) ? data.eligibleApplications : []);
      setActiveId((prev) => prev || wfs[0]?.id || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load visa workflows.");
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleCreated = useCallback((created) => {
    setWorkflows((p) => [created, ...p]);
    setEligibleApps((p) =>
      p.map((a) =>
        a.id === created.scholarshipApplicationId
          ? { ...a, hasWorkflow: true, workflowId: created.id }
          : a
      )
    );
    setActiveId(created.id);
  }, []);

  const handleUpdated = useCallback((updated) => {
    setWorkflows((p) => p.map((w) => (w.id === updated.id ? updated : w)));
  }, []);

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;
  const active = workflows.find((w) => w.id === activeId) || workflows[0] || null;
  const hasAnyEligible = eligibleApps.length > 0;

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title="Visa tracker"
      subtitle="Track every step of your visa application once a scholarship is approved"
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-primary-dark">
                Visa workflows are private to you.
              </p>
              <p className="text-muted">
                Only you and the admin team supporting your approved scholarship
                can see the milestones, embassy info, and notes here.
              </p>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !hasAnyEligible ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Plane className="h-8 w-8" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">
                No approved scholarships yet
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted">
                Visa tracking unlocks automatically once one of your scholarship
                applications is approved.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <CreateWorkflowForm
              eligibleApplications={eligibleApps}
              sessionToken={sessionToken}
              onCreated={handleCreated}
            />

            {workflows.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {workflows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveId(w.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      w.id === active?.id
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    <Plane className="h-3 w-3" />
                    {w.scholarship?.title || "Workflow"}
                  </button>
                ))}
              </div>
            )}

            {active ? (
              <WorkflowPanel
                workflow={active}
                sessionToken={sessionToken}
                onUpdated={handleUpdated}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Plane className="h-8 w-8 text-muted/40" />
                  <p className="mt-2 text-sm font-semibold text-muted">
                    Create your first visa workflow above to get started.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default VisaTrackerPage;
