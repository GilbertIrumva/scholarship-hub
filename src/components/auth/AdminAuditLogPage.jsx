import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCcw,
  ScrollText,
  ShieldAlert,
  X,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchAuditLog } from "../../services/auditLog";

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const OUTCOMES = [
  { key: "", label: "All outcomes" },
  { key: "success", label: "Success" },
  { key: "failure", label: "Failure" },
];

const AdminAuditLogPage = () => {
  const { sessionToken, adminDashboard, signOut } = useAuth();

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filters, setFilters] = useState({ action: "", actorEmail: "", outcome: "" });
  const [pendingFilters, setPendingFilters] = useState(filters);

  const params = useMemo(() => {
    const out = { limit: 50 };
    if (filters.action) out.action = filters.action;
    if (filters.actorEmail) out.actorEmail = filters.actorEmail;
    if (filters.outcome) out.outcome = filters.outcome;
    return out;
  }, [filters]);

  const load = useCallback(
    async (mode = "replace") => {
      if (!sessionToken) return;
      const stateSetter = mode === "more" ? setLoadingMore : setLoading;
      stateSetter(true);
      try {
        const reqParams = { ...params };
        if (mode === "more" && nextCursor) reqParams.cursor = nextCursor;
        const data = await fetchAuditLog(sessionToken, reqParams);
        const entries = Array.isArray(data?.items) ? data.items : [];
        setItems((prev) => (mode === "more" ? [...prev, ...entries] : entries));
        setNextCursor(data?.nextCursor || null);
      } catch {
        toast.error("Could not load audit log.");
      } finally {
        stateSetter(false);
      }
    },
    [sessionToken, params, nextCursor]
  );

  useEffect(() => {
    if (sessionToken) load("replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, filters]);

  const onApplyFilters = (event) => {
    event.preventDefault();
    setFilters(pendingFilters);
  };

  const onClearFilters = () => {
    const cleared = { action: "", actorEmail: "", outcome: "" };
    setPendingFilters(cleared);
    setFilters(cleared);
  };

  if (!sessionToken || adminDashboard === null) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout
      role="admin"
      title="Audit log"
      subtitle="Every security-relevant action that touched the system."
      onSignOut={signOut}
    >
      <Card className="border-slate-200/80">
        <CardContent className="space-y-5 p-5">
          <form
            onSubmit={onApplyFilters}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:items-end"
          >
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="filter-action" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Action
              </label>
              <Input
                id="filter-action"
                placeholder="e.g. admin.sign-in"
                value={pendingFilters.action}
                onChange={(e) =>
                  setPendingFilters((p) => ({ ...p, action: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="filter-actor" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Actor email
              </label>
              <Input
                id="filter-actor"
                placeholder="admin@example.com"
                value={pendingFilters.actorEmail}
                onChange={(e) =>
                  setPendingFilters((p) => ({ ...p, actorEmail: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="filter-outcome" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Outcome
              </label>
              <select
                id="filter-outcome"
                value={pendingFilters.outcome}
                onChange={(e) =>
                  setPendingFilters((p) => ({ ...p, outcome: e.target.value }))
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
              >
                {OUTCOMES.map((o) => (
                  <option key={o.key || "all"} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-1">
              <Button type="submit" className="gap-1.5">
                <Filter className="h-4 w-4" />
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClearFilters}
                className="gap-1.5"
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => load("replace")}
                className="gap-1.5"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading entries…
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-500">
                <ScrollText className="h-8 w-8 text-slate-300" />
                No audit entries match these filters.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left">When</th>
                    <th className="px-3 py-2 text-left">Action</th>
                    <th className="px-3 py-2 text-left">Actor</th>
                    <th className="px-3 py-2 text-left">Target</th>
                    <th className="px-3 py-2 text-left">Outcome</th>
                    <th className="px-3 py-2 text-left">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((entry) => (
                    <tr key={entry._id} className="align-top hover:bg-slate-50">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-900">
                        {entry.action}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        <div className="font-semibold">{entry.actor?.email || "—"}</div>
                        <div className="text-xs text-slate-500">
                          {entry.actor?.kind || "anonymous"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {entry.target?.label || entry.target?.kind || "—"}
                      </td>
                      <td className="px-3 py-2">
                        {entry.outcome === "failure" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                            <ShieldAlert className="h-3 w-3" />
                            failure
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            success
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500">{entry.ip || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {nextCursor && !loading && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => load("more")}
                disabled={loadingMore}
                className="gap-1.5"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default AdminAuditLogPage;
