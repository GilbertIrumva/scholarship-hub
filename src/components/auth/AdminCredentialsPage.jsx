import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  FileText,
  FileImage,
  FileType2,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  ShieldCheck,
  Filter,
  Calendar,
  Globe2,
  ArrowLeft,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listAdminCredentials,
  reviewAdminCredential,
  adminCredentialDownloadUrl,
} from "../../services/adminAuth";
import { CREDENTIAL_TYPES } from "../../services/credentials";

// Map service API values → i18n keys (`credentials.type*`).
const CREDENTIAL_TYPE_KEY = {
  "secondary-certificate": "credentials.typeSecondaryCertificate",
  transcript: "credentials.typeTranscript",
  "national-id": "credentials.typeNationalId",
  passport: "credentials.typePassport",
  "language-test": "credentials.typeLanguageTest",
  "recommendation-letter": "credentials.typeRecommendationLetter",
  cv: "credentials.typeCv",
  other: "credentials.typeOther",
};

const STATUS_META = {
  unverified: {
    labelKey: "credentials.statusUnverified",
    chip: "bg-slate-100 text-slate-600",
    icon: Clock,
  },
  pending: {
    labelKey: "credentials.statusPending",
    chip: "bg-amber-100 text-amber-800",
    icon: Clock,
  },
  verified: {
    labelKey: "credentials.statusVerified",
    chip: "bg-emerald-100 text-emerald-800",
    icon: CheckCircle2,
  },
  rejected: {
    labelKey: "credentials.statusRejected",
    chip: "bg-rose-100 text-rose-700",
    icon: AlertCircle,
  },
};

const STATUS_TAB_IDS = ["all", "unverified", "pending", "verified", "rejected"];
const STATUS_TAB_KEY = {
  all: "common.all",
  unverified: "credentials.statusUnverified",
  pending: "credentials.statusPending",
  verified: "credentials.statusVerified",
  rejected: "credentials.statusRejected",
};

const formatBytes = (n) => {
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
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

const FileIcon = ({ mimeType }) => {
  if (mimeType?.startsWith("image/")) return <FileImage className="h-5 w-5" />;
  if (mimeType === "application/pdf") return <FileType2 className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
};

const StatusChip = ({ status }) => {
  const { t } = useTranslation();
  const meta = STATUS_META[status] || STATUS_META.unverified;
  const Icon = meta.icon;
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        meta.chip,
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {t(meta.labelKey)}
    </span>
  );
};

const fetchWithAuth = async (url, sessionToken) => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!res.ok) throw new Error("Request failed");
  return res.blob();
};

const ReviewPanel = ({ credential, sessionToken, onReviewed }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState(credential.verificationNote || "");
  const [submitting, setSubmitting] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);

  useEffect(() => {
    setNote(credential.verificationNote || "");
  }, [credential.id, credential.verificationNote]);

  const submit = async (status) => {
    if (status === "rejected" && !note.trim()) {
      toast.error(t("admin.errRejectReason"));
      return;
    }
    setPendingStatus(status);
    setSubmitting(true);
    try {
      const { credential: updated } = await reviewAdminCredential(
        sessionToken,
        credential.id,
        { verificationStatus: status, verificationNote: note.trim() }
      );
      toast.success(
        status === "verified"
          ? t("adminCredentials.toastVerified")
          : status === "rejected"
            ? t("adminCredentials.toastRejected")
            : t("adminCredentials.toastStatusUpdated")
      );
      onReviewed(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("adminCredentials.failedUpdate"));
    } finally {
      setSubmitting(false);
      setPendingStatus(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
      <div className="grid gap-2">
        <Label htmlFor={`note-${credential.id}`} className="text-xs font-bold uppercase tracking-wider text-muted">
          {t("common.reviewerNote")}
        </Label>
        <textarea
          id={`note-${credential.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 1000))}
          rows={2}
          placeholder={t("admin.notePlaceholderReview")}
          className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-[10px] text-muted text-right">{note.length}/1000</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => submit("verified")}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {submitting && pendingStatus === "verified" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {t("admin.verify")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("pending")}
          disabled={submitting}
        >
          {submitting && pendingStatus === "pending" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          {t("admin.markPending")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => submit("rejected")}
          disabled={submitting}
          className="border-rose-200 text-rose-700 hover:bg-rose-50"
        >
          {submitting && pendingStatus === "rejected" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <XCircle className="h-3.5 w-3.5" />
          )}
          {t("admin.reject")}
        </Button>
      </div>
    </div>
  );
};

const CredentialRow = ({ credential, sessionToken, onReviewed }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const downloadFile = async (e) => {
    e.preventDefault();
    try {
      const blob = await fetchWithAuth(
        adminCredentialDownloadUrl(credential.id),
        sessionToken
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = credential.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("adminCredentials.couldNotDownload"));
    }
  };

  const previewFile = async (e) => {
    e.preventDefault();
    try {
      const blob = await fetchWithAuth(
        adminCredentialDownloadUrl(credential.id),
        sessionToken
      );
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("adminCredentials.couldNotOpen"));
    }
  };

  const typeKey = CREDENTIAL_TYPE_KEY[credential.type];
  const typeLabel = typeKey ? t(typeKey) : credential.type;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileIcon mimeType={credential.mimeType} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-ink">
                    {credential.title}
                  </h3>
                  <p className="text-xs text-muted">
                    {typeLabel}
                  </p>
                </div>
                <StatusChip status={credential.verificationStatus} />
              </div>

              {credential.scholar && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs">
                  <User className="h-3.5 w-3.5 text-muted" />
                  <span className="font-semibold text-ink">
                    {credential.scholar.name || t("adminCredentials.unknownScholar")}
                  </span>
                  {credential.scholar.email && (
                    <span className="text-muted">· {credential.scholar.email}</span>
                  )}
                </div>
              )}

              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                {credential.country && (
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5" />
                    {credential.country}
                    {credential.issuingBody && ` · ${credential.issuingBody}`}
                  </span>
                )}
                {credential.issuedYear && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("credentials.issuedPrefix", { year: credential.issuedYear })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {credential.originalName} · {formatBytes(credential.sizeBytes)}
                </span>
              </div>

              {credential.gradeConversion && (
                <div className="mt-3 rounded-lg bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-semibold text-primary-dark">
                    {t("adminCredentials.gradeSnapshotPrefix")}
                  </span>{" "}
                  {credential.gradeConversion.systemId} grade{" "}
                  <span className="font-bold">{credential.gradeConversion.input}</span>{" "}
                  → {credential.gradeConversion.percentage}% (GPA{" "}
                  {credential.gradeConversion.gpa4})
                </div>
              )}

              {credential.verificationNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">{t("admin.notePrefix")}</span> {credential.verificationNote}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {t("adminCredentials.uploadedDate", { date: formatDate(credential.createdAt) })}
                  {credential.verifiedAt && (
                    <> · {t("adminCredentials.reviewedDate", { date: formatDate(credential.verifiedAt) })}</>
                  )}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={previewFile}>
                    <Eye className="h-3.5 w-3.5" /> {t("common.view")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={downloadFile}>
                    <Download className="h-3.5 w-3.5" /> {t("common.download")}
                  </Button>
                  <Button
                    size="sm"
                    variant={expanded ? "default" : "outline"}
                    onClick={() => setExpanded((v) => !v)}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {expanded ? t("admin.closeReview") : t("admin.review")}
                  </Button>
                </div>
              </div>

              {expanded && (
                <ReviewPanel
                  credential={credential}
                  sessionToken={sessionToken}
                  onReviewed={(updated) => {
                    onReviewed(updated);
                    setExpanded(false);
                  }}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const AdminCredentialsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionToken, adminDashboard, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const scholarFilter = searchParams.get("scholar") || "";
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchAll = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const params = {};
      if (scholarFilter) params.scholar = scholarFilter;
      const data = await listAdminCredentials(sessionToken, params);
      setCredentials(Array.isArray(data?.credentials) ? data.credentials : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("adminCredentials.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, scholarFilter, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const handleReviewed = useCallback((updated) => {
    setCredentials((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const counts = useMemo(() => {
    const acc = { all: credentials.length };
    for (const c of credentials) {
      acc[c.verificationStatus] = (acc[c.verificationStatus] || 0) + 1;
    }
    return acc;
  }, [credentials]);

  const filtered = useMemo(() => {
    return credentials.filter((c) => {
      if (statusFilter !== "all" && c.verificationStatus !== statusFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      return true;
    });
  }, [credentials, statusFilter, typeFilter]);

  const clearScholarFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("scholar");
    setSearchParams(next);
  };

  if (!sessionToken) return <Navigate to="/login" replace />;

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title={t("adminCredentials.pageTitle")}
      subtitle={t("adminCredentials.pageSubtitle")}
      onSignOut={handleSignOut}
      actions={
        scholarFilter ? (
          <Button variant="outline" size="sm" onClick={clearScholarFilter}>
            <ArrowLeft className="h-4 w-4" /> {t("adminCredentials.clearScholarFilter")}
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {scholarFilter && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-start gap-3 p-4">
              <User className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold text-primary-dark">
                  {t("adminCredentials.filteredByScholar")}
                </p>
                <p className="text-muted">
                  {t("adminCredentials.filteredByScholarBody")}{" "}
                  <code className="rounded bg-white px-1.5 py-0.5 text-xs">
                    {scholarFilter}
                  </code>
                  .{" "}
                  <Link
                    to={`/admin/applicants/${scholarFilter}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {t("adminCredentials.viewApplicant")}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {t("admin.statusLabel")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_TAB_IDS.map((id) => {
                const count = id === "all" ? counts.all : counts[id] || 0;
                const active = statusFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setStatusFilter(id)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                  >
                    {t(STATUS_TAB_KEY[id])}
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

            <div className="flex items-center gap-2 pt-2">
              <Filter className="h-4 w-4 text-muted" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted">
                {t("admin.documentType")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTypeFilter("all")}
                className={[
                  "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  typeFilter === "all"
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {t("common.all")}
              </button>
              {CREDENTIAL_TYPES.map((type) => {
                const active = typeFilter === type.value;
                const k = CREDENTIAL_TYPE_KEY[type.value];
                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setTypeFilter(type.value)}
                    className={[
                      "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                  >
                    {k ? t(k) : type.label}
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
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <ShieldCheck className="h-8 w-8" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">
                {t("adminCredentials.emptyTitle")}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted">
                {t("adminCredentials.emptyBody")}
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Filter className="h-8 w-8 text-muted/40" />
              <p className="mt-2 text-sm font-semibold text-muted">
                {t("adminCredentials.filterEmpty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => (
              <CredentialRow
                key={c.id}
                credential={c}
                sessionToken={sessionToken}
                onReviewed={handleReviewed}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminCredentialsPage;
