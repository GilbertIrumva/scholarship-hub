import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  FileText,
  Loader2,
  Upload,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldCheck,
  FileImage,
  FileType2,
  Globe2,
  Calendar,
  X,
  Eye,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  CREDENTIAL_TYPES,
  listMyCredentials,
  uploadCredential,
  deleteCredential,
  downloadCredentialUrl,
} from "../../services/credentials";

const VERIFICATION_META = {
  unverified: { labelKey: "credentials.statusUnverified", chip: "bg-slate-100 text-slate-600", icon: Clock },
  pending: { labelKey: "credentials.statusPending", chip: "bg-amber-100 text-amber-800", icon: Clock },
  verified: { labelKey: "credentials.statusVerified", chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { labelKey: "credentials.statusRejected", chip: "bg-rose-100 text-rose-700", icon: AlertCircle },
};

const CRED_TYPE_LABEL_KEYS = {
  "secondary-certificate": "credentials.typeSecondaryCertificate",
  transcript: "credentials.typeTranscript",
  "national-id": "credentials.typeNationalId",
  passport: "credentials.typePassport",
  "language-test": "credentials.typeLanguageTest",
  "recommendation-letter": "credentials.typeRecommendationLetter",
  cv: "credentials.typeCv",
  other: "credentials.typeOther",
};

const credTypeLabel = (t, value, fallback) =>
  CRED_TYPE_LABEL_KEYS[value]
    ? t(CRED_TYPE_LABEL_KEYS[value])
    : fallback || value;

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
  const meta = VERIFICATION_META[status] || VERIFICATION_META.unverified;
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

const UploadForm = ({ sessionToken, onUploaded }) => {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [type, setType] = useState(CREDENTIAL_TYPES[0].value);
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [issuingBody, setIssuingBody] = useState("");
  const [issuedYear, setIssuedYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setCountry("");
    setIssuingBody("");
    setIssuedYear("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error(t("credentials.errorChooseFile"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("credentials.errorNeedTitle"));
      return;
    }
    setSubmitting(true);
    try {
      const { credential } = await uploadCredential(sessionToken, {
        file,
        type,
        title: title.trim(),
        country: country.trim().toUpperCase(),
        issuingBody: issuingBody.trim(),
        issuedYear: issuedYear || null,
      });
      toast.success(t("credentials.uploadedToast", { title: credential.title }));
      reset();
      onUploaded(credential);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("credentials.uploadFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-primary" />
          {t("credentials.uploadCardTitle")}
        </CardTitle>
        <p className="text-sm text-muted">
          {t("credentials.uploadCardHint")}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cred-file">{t("credentials.fileLabel")}</Label>
            <Input
              ref={fileRef}
              id="cred-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            {file && (
              <p className="text-xs text-muted">
                {file.name} — {formatBytes(file.size)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="cred-type">{t("credentials.typeLabel")}</Label>
              <select
                id="cred-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CREDENTIAL_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {credTypeLabel(t, ct.value, ct.label)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cred-title">{t("credentials.titleLabel")}</Label>
              <Input
                id="cred-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("credentials.titlePlaceholder")}
                maxLength={200}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="cred-country">{t("credentials.countryLabel")}</Label>
              <Input
                id="cred-country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 3))}
                placeholder={t("credentials.countryPlaceholder")}
                maxLength={3}
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="cred-body">{t("credentials.issuingBodyLabel")}</Label>
              <Input
                id="cred-body"
                value={issuingBody}
                onChange={(e) => setIssuingBody(e.target.value)}
                placeholder={t("credentials.issuingBodyPlaceholder")}
                maxLength={200}
              />
            </div>
          </div>

          <div className="grid gap-2 sm:max-w-[200px]">
            <Label htmlFor="cred-year">{t("credentials.yearLabel")}</Label>
            <Input
              id="cred-year"
              type="number"
              min={1950}
              max={2100}
              value={issuedYear}
              onChange={(e) => setIssuedYear(e.target.value)}
              placeholder={t("credentials.yearPlaceholder")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={reset}
              disabled={submitting}
            >
              {t("common.clear")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("common.uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {t("credentials.upload")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const CredentialCard = ({ credential, sessionToken, onDeleted }) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!window.confirm(t("credentials.deleteConfirm", { title: credential.title }))) return;
    setDeleting(true);
    try {
      await deleteCredential(sessionToken, credential.id);
      toast.success(t("credentials.deletedToast"));
      onDeleted(credential.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("credentials.deleteFailed"));
      setDeleting(false);
    }
  };

  const downloadUrl = downloadCredentialUrl(credential.id);
  const downloadWithAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = credential.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("credentials.downloadFailed"));
    }
  };

  const previewWithAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("Open failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      // Don't revoke immediately — let the new tab keep the URL.
    } catch {
      toast.error(t("credentials.openFailed"));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="overflow-hidden">
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
                    {credTypeLabel(t, credential.type, credential.type)}
                  </p>
                </div>
                <StatusChip status={credential.verificationStatus} />
              </div>

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
                    {t("credentials.gradeSnapshot")}
                  </span>{" "}
                  {t("credentials.gradeMapping", {
                    system: credential.gradeConversion.systemId,
                    input: credential.gradeConversion.input,
                    percent: credential.gradeConversion.percentage,
                    gpa: credential.gradeConversion.gpa4,
                  })}
                </div>
              )}

              {credential.verificationNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">{t("credentials.reviewerNote")}</span>{" "}
                  {credential.verificationNote}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {t("credentials.uploadedPrefix", { date: formatDate(credential.createdAt) })}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" onClick={previewWithAuth}>
                    <Eye className="h-3.5 w-3.5" /> {t("common.view")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={downloadWithAuth}>
                    <Download className="h-3.5 w-3.5" /> {t("common.download")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={onDelete}
                    disabled={deleting}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    {deleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const CredentialsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    listMyCredentials(sessionToken)
      .then((data) => {
        if (!cancelled) {
          setCredentials(Array.isArray(data?.credentials) ? data.credentials : []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || t("credentials.loadFailed"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionToken, t]);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  const handleUploaded = useCallback((created) => {
    setCredentials((prev) => [created, ...prev]);
  }, []);

  const handleDeleted = useCallback((id) => {
    setCredentials((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const counts = useMemo(() => {
    const acc = { all: credentials.length };
    for (const c of credentials) {
      acc[c.type] = (acc[c.type] || 0) + 1;
    }
    return acc;
  }, [credentials]);

  const filtered = useMemo(() => {
    if (filter === "all") return credentials;
    return credentials.filter((c) => c.type === filter);
  }, [credentials, filter]);

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("credentials.pageTitle")}
      subtitle={t("credentials.pageSubtitle")}
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        {/* Privacy notice */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-primary-dark">
                {t("credentials.privacyTitle")}
              </p>
              <p className="text-muted">
                {t("credentials.privacyBody")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Upload form */}
        <UploadForm sessionToken={sessionToken} onUploaded={handleUploaded} />

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === "all"
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {t("common.all")}
            <span
              className={[
                "rounded-full px-1.5 text-[10px] font-bold",
                filter === "all" ? "bg-white/20" : "bg-white text-slate-500",
              ].join(" ")}
            >
              {counts.all}
            </span>
          </button>
          {CREDENTIAL_TYPES.map((ct) => {
            const count = counts[ct.value] || 0;
            if (count === 0) return null;
            const active = filter === ct.value;
            return (
              <button
                key={ct.value}
                type="button"
                onClick={() => setFilter(ct.value)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                ].join(" ")}
              >
                {credTypeLabel(t, ct.value, ct.label)}
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

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : credentials.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
                <FileText className="h-8 w-8" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink">
                {t("credentials.emptyTitle")}
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted">
                {t("credentials.emptyDescription")}
              </p>
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <X className="h-8 w-8 text-muted/40" />
              <p className="mt-2 text-sm font-semibold text-muted">
                {t("credentials.filterEmpty")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((c) => (
              <CredentialCard
                key={c.id}
                credential={c}
                sessionToken={sessionToken}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CredentialsPage;
