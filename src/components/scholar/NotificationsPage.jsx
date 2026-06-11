import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  CheckCheck,
  FileText,
  Inbox,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
  Star,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import {
  listScholarNotifications,
  markAllScholarNotificationsRead,
  markScholarNotificationRead,
} from "../../services/notifications";

const KIND_STYLES = {
  "application.status": {
    icon: FileText,
    chip: "bg-sky-100 text-sky-700",
    iconBg: "bg-sky-100 text-sky-600",
  },
  "message.reply": {
    icon: Mail,
    chip: "bg-violet-100 text-violet-700",
    iconBg: "bg-violet-100 text-violet-600",
  },
  "scholarship.new": {
    icon: Star,
    chip: "bg-emerald-100 text-emerald-700",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  "admin.audit.alert": {
    icon: ShieldAlert,
    chip: "bg-amber-100 text-amber-800",
    iconBg: "bg-amber-100 text-amber-600",
  },
};

const DEFAULT_STYLE = {
  icon: Bell,
  chip: "bg-slate-100 text-slate-600",
  iconBg: "bg-slate-100 text-slate-500",
};

const styleFor = (kind) => KIND_STYLES[kind] || DEFAULT_STYLE;

// Bucket notifications by Today / Yesterday / Earlier for visual scanning.
const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const groupNotifications = (items) => {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const buckets = { today: [], yesterday: [], earlier: [] };
  for (const n of items) {
    const ts = n.createdAt ? new Date(n.createdAt).getTime() : 0;
    if (ts >= today) buckets.today.push(n);
    else if (ts >= yesterday) buckets.yesterday.push(n);
    else buckets.earlier.push(n);
  }
  return buckets;
};

const formatStamp = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const NotificationRow = ({ notif, onClick }) => {
  const { t } = useTranslation();
  const style = styleFor(notif.kind);
  const Icon = style.icon;
  const unread = !notif.readAt;
  const interactive = Boolean(notif.url);
  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <button
        type="button"
        onClick={() => onClick(notif)}
        className={[
          "group flex w-full items-start gap-4 rounded-xl border border-border bg-white px-4 py-4 text-left transition-shadow",
          unread ? "shadow-sm" : "",
          interactive ? "hover:border-primary/40 hover:shadow-md" : "hover:bg-slate-50",
        ].join(" ")}
      >
        <span
          className={[
            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg",
            style.iconBg,
          ].join(" ")}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold text-ink">{notif.title}</p>
            {unread && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                {t("notifications.newBadge")}
              </span>
            )}
            {notif.kind && (
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  style.chip,
                ].join(" ")}
              >
                {t(`notifications.kind.${notif.kind}`, { defaultValue: notif.kind })}
              </span>
            )}
          </div>
          {notif.body && (
            <p className="mt-1 text-sm leading-snug text-muted">{notif.body}</p>
          )}
          <p className="mt-1.5 text-[11px] text-muted">{formatStamp(notif.createdAt)}</p>
        </div>
      </button>
    </motion.li>
  );
};

const NotificationsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  const fetchNotifs = useCallback(
    async ({ silent } = {}) => {
      if (!sessionToken) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const data = await listScholarNotifications(sessionToken, {
          limit: 100,
          unreadOnly: filter === "unread",
        });
        setItems(Array.isArray(data?.items) ? data.items : []);
        setUnread(Number(data?.unread) || 0);
      } catch (err) {
        if (!silent) {
          toast.error(err?.response?.data?.message || t("notifications.loadFailed"));
        }
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [sessionToken, filter, t]
  );

  useEffect(() => {
    let cancelled = false;
    if (!sessionToken) return undefined;
    setLoading(true);
    listScholarNotifications(sessionToken, {
      limit: 100,
      unreadOnly: filter === "unread",
    })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setUnread(Number(data?.unread) || 0);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || t("notifications.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const id = setInterval(() => fetchNotifs({ silent: true }), 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionToken, filter, fetchNotifs, t]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleRowClick = useCallback(
    async (notif) => {
      const id = notif._id || notif.id;
      if (!notif.readAt && sessionToken && id) {
        try {
          await markScholarNotificationRead(sessionToken, id);
          setItems((prev) =>
            prev.map((n) =>
              (n._id || n.id) === id ? { ...n, readAt: new Date().toISOString() } : n
            )
          );
          setUnread((u) => Math.max(0, u - 1));
        } catch {
          /* non-fatal — still let them navigate */
        }
      }
      if (notif.url) navigate(notif.url);
    },
    [sessionToken, navigate]
  );

  const handleMarkAll = useCallback(async () => {
    if (!sessionToken || unread === 0) return;
    setBusy(true);
    try {
      await markAllScholarNotificationsRead(sessionToken);
      const stamp = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: stamp })));
      setUnread(0);
      toast.success(t("notifications.markAllDone"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("notifications.markAllFailed"));
    } finally {
      setBusy(false);
    }
  }, [sessionToken, unread, t]);

  const grouped = useMemo(() => groupNotifications(items), [items]);

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;

  const filterTabs = [
    { id: "all", label: t("notifications.filterAll") },
    {
      id: "unread",
      label: t("notifications.filterUnread"),
      count: unread,
    },
  ];

  const renderGroup = (label, list) => {
    if (!list.length) return null;
    return (
      <section className="space-y-2" aria-label={label}>
        <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-muted">
          {label}
        </h2>
        <ul className="space-y-2">
          {list.map((n) => (
            <NotificationRow key={n._id || n.id} notif={n} onClick={handleRowClick} />
          ))}
        </ul>
      </section>
    );
  };

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("notifications.pageTitle")}
      subtitle={t("notifications.pageSubtitle")}
      onSignOut={handleSignOut}
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fetchNotifs({ silent: true })}
          disabled={refreshing || loading}
          className="hidden sm:inline-flex"
        >
          <RefreshCw
            className={["h-3.5 w-3.5", refreshing ? "animate-spin" : ""].join(" ")}
          />
          <span className="ml-1.5">{t("common.refresh")}</span>
        </Button>
      }
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {filterTabs.map((tab) => {
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
                    {typeof tab.count === "number" && tab.count > 0 && (
                      <span
                        className={[
                          "rounded-full px-1.5 text-[10px] font-bold",
                          active ? "bg-white/20" : "bg-white text-slate-500",
                        ].join(" ")}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={busy || unread === 0}
            >
              <CheckCheck className="h-4 w-4" />
              <span className="ml-1.5">{t("notifications.markAllRead")}</span>
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div
            className="flex items-center justify-center py-20"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <Inbox className="h-8 w-8" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">
                {filter === "unread"
                  ? t("notifications.noUnread")
                  : t("notifications.noneYet")}
              </h3>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {t("notifications.nonePrompt")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {renderGroup(t("notifications.groupToday"), grouped.today)}
            {renderGroup(t("notifications.groupYesterday"), grouped.yesterday)}
            {renderGroup(t("notifications.groupEarlier"), grouped.earlier)}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
