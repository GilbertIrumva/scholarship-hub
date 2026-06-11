import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import {
  Archive,
  CheckCheck,
  Inbox,
  Mail,
  MailOpen,
  Reply,
  Search,
  Send,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MessagesIllustration } from "@/components/ui/empty-illustrations";
import {
  listAdminMessages,
  updateAdminMessage,
  deleteAdminMessage,
  replyToAdminMessage,
} from "../../services/adminAuth";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { key: "all", labelKey: "adminMessages.tabAll", icon: Inbox },
  { key: "new", labelKey: "adminMessages.tabNew", icon: Mail },
  { key: "read", labelKey: "adminMessages.tabRead", icon: MailOpen },
  { key: "replied", labelKey: "adminMessages.tabReplied", icon: Reply },
  { key: "archived", labelKey: "adminMessages.tabArchived", icon: Archive },
];

const STATUS_BADGE = {
  new: "bg-amber-100 text-amber-800",
  read: "bg-sky-100 text-sky-800",
  replied: "bg-primary/10 text-primary-dark",
  archived: "bg-slate-200 text-slate-700",
};

const STATUS_LABEL_KEY = {
  new: "adminMessages.statusNew",
  read: "adminMessages.statusRead",
  replied: "adminMessages.statusReplied",
  archived: "adminMessages.statusArchived",
};

const MAX_REPLY_LENGTH = 8000;

const formatDate = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const AdminMessagesPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionToken, adminDashboard, signOut } = useAuth();

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const data = await listAdminMessages(sessionToken);
      const list = Array.isArray(data?.messages) ? data.messages : [];
      setMessages(list);
      if (list.length && !selectedId) setSelectedId(list[0]._id || list[0].id);
    } catch {
      toast.error(t("adminMessages.couldNotLoad"));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, selectedId, t]);

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let list = messages;
    if (activeTab !== "all") list = list.filter((m) => (m.status || "new") === activeTab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((m) =>
        [m.name, m.email, m.subject, m.message]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q))
      );
    }
    return list;
  }, [messages, activeTab, search]);

  const selected = useMemo(
    () => filtered.find((m) => (m._id || m.id) === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  useEffect(() => {
    if (selected) {
      setNotesDraft(selected.notes || "");
      setReplyDraft("");
    }
  }, [selected?._id, selected?.id]);

  const counts = useMemo(() => {
    return {
      all: messages.length,
      new: messages.filter((m) => (m.status || "new") === "new").length,
      read: messages.filter((m) => m.status === "read").length,
      replied: messages.filter((m) => m.status === "replied").length,
      archived: messages.filter((m) => m.status === "archived").length,
    };
  }, [messages]);

  if (!sessionToken) return <Navigate to="/login/admin" replace />;

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const patchMessage = async (msgId, payload) => {
    setBusy(true);
    try {
      const data = await updateAdminMessage(sessionToken, msgId, payload);
      const updated = data?.message || data;
      setMessages((curr) =>
        curr.map((m) => ((m._id || m.id) === msgId ? { ...m, ...updated } : m))
      );
      toast.success(t("adminMessages.messageUpdated"));
    } catch {
      toast.error(t("adminMessages.updateFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = (status) => {
    if (!selected) return;
    patchMessage(selected._id || selected.id, { status });
  };

  const handleSaveNotes = () => {
    if (!selected) return;
    patchMessage(selected._id || selected.id, { notes: notesDraft });
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(t("adminMessages.deleteConfirm", { name: selected.name || selected.email })))
      return;
    setBusy(true);
    try {
      await deleteAdminMessage(sessionToken, selected._id || selected.id);
      setMessages((curr) => curr.filter((m) => (m._id || m.id) !== (selected._id || selected.id)));
      setSelectedId(null);
      toast.success(t("adminMessages.messageDeleted"));
    } catch {
      toast.error(t("adminMessages.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async () => {
    if (!selected || !replyDraft.trim()) return;
    setSending(true);
    try {
      const data = await replyToAdminMessage(
        sessionToken,
        selected._id || selected.id,
        replyDraft.trim()
      );
      const updated = data?.contactMessage;
      if (updated) {
        setMessages((curr) =>
          curr.map((m) =>
            (m._id || m.id) === (selected._id || selected.id) ? { ...m, ...updated } : m
          )
        );
      }
      setReplyDraft("");
      toast.success(data?.message || t("adminMessages.replySent"));
    } catch (err) {
      toast.error(err?.response?.data?.message || t("adminMessages.replyFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title={t("adminMessages.pageTitle")}
      subtitle={t("adminMessages.subtitle", { newCount: counts.new, total: counts.all })}
      onSignOut={handleSignOut}
      actions={
        <Button onClick={fetchMessages} disabled={loading} variant="outline" size="sm">
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          {t("common.refresh")}
        </Button>
      }
    >
      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* List pane */}
        <Card className="flex flex-col overflow-hidden">
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="search"
                placeholder={t("adminMessages.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {STATUS_TABS.map(({ key, labelKey, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                    activeTab === key
                      ? "bg-primary text-white shadow-sm"
                      : "bg-slate-100 text-muted hover:bg-slate-200"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(labelKey)}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-[10px] font-bold",
                      activeTab === key ? "bg-white/25" : "bg-white text-ink"
                    )}
                  >
                    {counts[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 divide-y divide-border overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex h-full items-center justify-center p-4">
                {loading ? (
                  <span className="text-sm text-muted">{t("common.loading")}</span>
                ) : (
                  <EmptyState
                    size="sm"
                    illustration={<MessagesIllustration className="h-24 w-auto text-primary" />}
                    title={t("adminMessages.noMessages")}
                  />
                )}
              </div>
            ) : (
              filtered.map((msg) => {
                const id = msg._id || msg.id;
                const isActive = id === (selected?._id || selected?.id);
                const status = msg.status || "new";
                return (
                  <button
                    key={id}
                    onClick={() => setSelectedId(id)}
                    className={cn(
                      "w-full text-left transition-colors",
                      isActive ? "bg-primary/5" : "hover:bg-slate-50"
                    )}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "truncate text-sm",
                            status === "new" ? "font-bold text-ink" : "font-semibold text-ink"
                          )}
                        >
                          {msg.name || msg.email || t("adminMessages.anonymous")}
                        </p>
                        <span className="shrink-0 text-[10px] text-muted">
                          {formatDate(msg.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{msg.subject || t("adminMessages.noSubject")}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted/80">{msg.message}</p>
                      <div className="mt-2">
                        <span
                          className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            STATUS_BADGE[status]
                          )}
                        >
                          {t(STATUS_LABEL_KEY[status] || "adminMessages.statusNew")}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Detail pane */}
        <Card className="flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="border-b border-border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-extrabold text-ink">
                      {selected.subject || t("adminMessages.noSubject")}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {t("adminMessages.fromPrefix")} <span className="font-semibold text-ink">{selected.name || "—"}</span> ·{" "}
                      <a
                        href={`mailto:${selected.email}`}
                        className="text-primary hover:text-primary-dark"
                      >
                        {selected.email}
                      </a>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{formatDate(selected.createdAt)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider",
                      STATUS_BADGE[selected.status || "new"]
                    )}
                  >
                    {t(STATUS_LABEL_KEY[selected.status || "new"] || "adminMessages.statusNew")}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleStatus("read")} disabled={busy}>
                    <CheckCheck className="h-3.5 w-3.5" />
                    {t("adminMessages.markRead")}
                  </Button>
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={() => handleStatus("replied")}
                    disabled={busy}
                  >
                    <Reply className="h-3.5 w-3.5" />
                    {t("adminMessages.replied")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatus("archived")}
                    disabled={busy}
                  >
                    <Archive className="h-3.5 w-3.5" />
                    {t("adminMessages.archive")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={busy}
                    className="ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t("adminMessages.delete")}
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* Original message */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                    {t("adminMessages.fromHeading", { name: selected.name || selected.email })}
                  </p>
                  <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-ink whitespace-pre-wrap">
                    {selected.message}
                  </div>
                </div>

                {/* Conversation thread */}
                {selected.replies?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                      {t("adminMessages.conversation")}
                    </h3>
                    {selected.replies.map((reply, i) => (
                      <div
                        key={reply._id || i}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-primary-dark">
                            {reply.sentByName || t("adminMessages.admin")}
                            {reply.sentByEmail && (
                              <span className="ml-1 font-normal text-muted">
                                · {reply.sentByEmail}
                              </span>
                            )}
                          </p>
                          <span className="text-[10px] text-muted">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ink">
                          {reply.body}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 font-bold",
                              reply.deliveryStatus === "sent" && reply.deliveredVia === "smtp"
                                ? "bg-emerald-100 text-emerald-800"
                                : reply.deliveryStatus === "sent" && reply.deliveredVia === "log"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            )}
                          >
                            {reply.deliveryStatus === "sent" && reply.deliveredVia === "smtp"
                              ? t("adminMessages.emailed")
                              : reply.deliveryStatus === "sent" && reply.deliveredVia === "log"
                              ? t("adminMessages.loggedNoSmtp")
                              : reply.deliveryStatus === "failed"
                              ? t("adminMessages.deliveryFailed")
                              : reply.deliveryStatus}
                          </span>
                          {reply.deliveryError && (
                            <span className="text-muted normal-case">{reply.deliveryError}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply composer */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    {t("adminMessages.composeReply")}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {t("adminMessages.sendsAnEmail")}{" "}
                    <span className="font-semibold text-ink">{selected.email}</span>{" "}
                    {t("adminMessages.andMarksReplied")}
                  </p>
                  <textarea
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    rows={6}
                    placeholder={t("adminMessages.replyPlaceholder", {
                      firstName: selected.name?.split(" ")[0] || t("adminMessages.replyDefaultName"),
                    })}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted">
                      {t("adminMessages.charCounter", { count: replyDraft.length, max: MAX_REPLY_LENGTH })}
                    </span>
                    <Button
                      onClick={handleSendReply}
                      disabled={sending || !replyDraft.trim() || replyDraft.length > MAX_REPLY_LENGTH}
                    >
                      <Send className="h-4 w-4" />
                      {sending ? t("adminMessages.sending") : t("adminMessages.sendReply")}
                    </Button>
                  </div>
                </div>

                {/* Internal notes */}
                <div className="border-t border-border pt-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
                    {t("adminMessages.internalNotes")}
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    {t("adminMessages.internalNotesHint")}
                  </p>
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={3}
                    placeholder={t("adminMessages.internalNotesPlaceholder")}
                    className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
                  />
                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSaveNotes}
                      disabled={busy || notesDraft === (selected.notes || "")}
                    >
                      {t("adminMessages.saveNotes")}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex h-full flex-col items-center justify-center text-center">
              <Mail className="h-14 w-14 text-muted/40" />
              <p className="mt-4 text-sm font-semibold text-ink">{t("adminMessages.selectPrompt")}</p>
            </CardContent>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminMessagesPage;
