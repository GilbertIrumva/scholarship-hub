import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plane,
  Loader2,
  Upload,
  Trash2,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock,
  FileText,
  FileImage,
  FileType2,
  Globe2,
  Calendar,
  Eye,
  ShieldAlert,
  Award,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { EmptyState } from "../ui/empty-state";
import { TravelDocsIllustration } from "../ui/empty-illustrations";
import {
  TRAVEL_DOC_TYPES,
  listTravelDocs,
  uploadTravelDoc,
  deleteTravelDoc,
  travelDocDownloadUrl,
} from "../../services/travelDocs";
import { listMyApplications } from "../../services/applications";

const TRAVEL_TYPE_LABEL_KEYS = {
  passport: "travelDocs.typePassport",
  visa: "travelDocs.typeVisa",
  "travel-insurance": "travelDocs.typeTravelInsurance",
  vaccination: "travelDocs.typeVaccination",
  "other-travel": "travelDocs.typeOtherTravel",
};

const travelTypeLabel = (t, value, fallback) =>
  TRAVEL_TYPE_LABEL_KEYS[value]
    ? t(TRAVEL_TYPE_LABEL_KEYS[value])
    : fallback || value;

const STATUS_META = {
  unverified: { labelKey: "travelDocs.statusUnverified", chip: "bg-slate-100 text-slate-600", icon: Clock },
  pending: { labelKey: "travelDocs.statusPending", chip: "bg-amber-100 text-amber-800", icon: Clock },
  verified: { labelKey: "travelDocs.statusVerified", chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  rejected: { labelKey: "travelDocs.statusRejected", chip: "bg-rose-100 text-rose-700", icon: AlertCircle },
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

const daysUntil = (date) => {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
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

const UploadForm = ({ sessionToken, onUploaded }) => {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [type, setType] = useState(TRAVEL_DOC_TYPES[0].value);
  const [title, setTitle] = useState("");
  const [country, setCountry] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setTitle("");
    setCountry("");
    setDocumentNumber("");
    setIssuedDate("");
    setExpiryDate("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error(t("travelDocs.errorChooseFile"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("travelDocs.errorNeedTitle"));
      return;
    }
    setSubmitting(true);
    try {
      const { document } = await uploadTravelDoc(sessionToken, {
        file,
        type,
        title: title.trim(),
        country: country.trim().toUpperCase(),
        documentNumber: documentNumber.trim(),
        issuedDate: issuedDate || undefined,
        expiryDate: expiryDate || undefined,
      });
      toast.success(t("travelDocs.uploadedToast", { title: document.title }));
      reset();
      onUploaded(document);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("travelDocs.uploadFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5 text-primary" />
          {t("travelDocs.uploadCardTitle")}
        </CardTitle>
        <p className="text-sm text-muted">
          {t("travelDocs.uploadCardHint")}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="td-file">{t("travelDocs.fileLabel")}</Label>
            <Input
              ref={fileRef}
              id="td-file"
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
              <Label htmlFor="td-type">{t("travelDocs.typeLabel")}</Label>
              <select
                id="td-type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {TRAVEL_DOC_TYPES.map((tt) => (
                  <option key={tt.value} value={tt.value}>
                    {travelTypeLabel(t, tt.value, tt.label)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td-title">{t("travelDocs.titleLabel")}</Label>
              <Input
                id="td-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("travelDocs.titlePlaceholder")}
                maxLength={200}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="td-country">{t("travelDocs.countryLabel")}</Label>
              <Input
                id="td-country"
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 3))}
                placeholder={t("travelDocs.countryPlaceholder")}
                maxLength={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td-number">{t("travelDocs.documentNumberLabel")}</Label>
              <Input
                id="td-number"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={t("travelDocs.documentNumberPlaceholder")}
                maxLength={60}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="td-issued">{t("travelDocs.issuedDateLabel")}</Label>
              <Input
                id="td-issued"
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="td-expiry">{t("travelDocs.expiryDateLabel")}</Label>
              <Input
                id="td-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={reset} disabled={submitting}>
              {t("common.clear")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("common.uploading")}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> {t("travelDocs.upload")}
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const TravelDocCard = ({ doc, sessionToken, onDeleted }) => {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [revealNumber, setRevealNumber] = useState(false);
  const days = daysUntil(doc.expiryDate);

  const onDelete = async () => {
    if (!window.confirm(t("travelDocs.deleteConfirm", { title: doc.title }))) return;
    setDeleting(true);
    try {
      await deleteTravelDoc(sessionToken, doc.id);
      toast.success(t("travelDocs.deletedToast"));
      onDeleted(doc.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("travelDocs.deleteFailed"));
      setDeleting(false);
    }
  };

  const downloadWithAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(travelDocDownloadUrl(doc.id), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("travelDocs.downloadFailed"));
    }
  };

  const previewWithAuth = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(travelDocDownloadUrl(doc.id), {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error("Open failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error(t("travelDocs.openFailed"));
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <FileIcon mimeType={doc.mimeType} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-bold text-ink">{doc.title}</h3>
                  <p className="text-xs text-muted">{travelTypeLabel(t, doc.type, doc.type)}</p>
                </div>
                <StatusChip status={doc.verificationStatus} />
              </div>

              {doc.documentNumberLast4 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 text-xs">
                  <Lock className="h-3.5 w-3.5 text-muted" />
                  <span className="font-mono">
                    {revealNumber && doc.documentNumber
                      ? doc.documentNumber
                      : `••••••${doc.documentNumberLast4}`}
                  </span>
                  {doc.documentNumber && (
                    <button
                      type="button"
                      onClick={() => setRevealNumber((v) => !v)}
                      className="text-[10px] font-bold uppercase text-primary hover:underline"
                    >
                      {revealNumber ? t("common.hide") : t("common.reveal")}
                    </button>
                  )}
                </div>
              )}

              <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-3">
                {doc.country && (
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5" />
                    {doc.country}
                  </span>
                )}
                {doc.issuedDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("travelDocs.issuedPrefix", { date: formatDate(doc.issuedDate) })}
                  </span>
                )}
                {doc.expiryDate && (
                  <span
                    className={[
                      "inline-flex items-center gap-1",
                      days != null && days < 0 ? "text-rose-600 font-semibold" :
                        days != null && days < 180 ? "text-amber-700 font-semibold" : "",
                    ].join(" ")}
                  >
                    <Calendar className="h-3.5 w-3.5" />
                    {t("travelDocs.expiresPrefix", { date: formatDate(doc.expiryDate) })}
                    {days != null && days >= 0 && days < 180 && " " + t("travelDocs.expiresInDays", { count: days })}
                    {days != null && days < 0 && " " + t("travelDocs.expired")}
                  </span>
                )}
              </div>

              {doc.verificationNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">{t("travelDocs.reviewerNote")}</span> {doc.verificationNote}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted">
                  {t("travelDocs.uploadedMeta", {
                    name: doc.originalName,
                    size: formatBytes(doc.sizeBytes),
                    date: formatDate(doc.createdAt),
                  })}
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

const TravelDocsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasApproved, setHasApproved] = useState(null); // null | true | false

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      listTravelDocs(sessionToken),
      listMyApplications(sessionToken),
    ])
      .then(([dData, aData]) => {
        if (cancelled) return;
        setDocs(Array.isArray(dData?.documents) ? dData.documents : []);
        const apps = Array.isArray(aData?.applications) ? aData.applications : [];
        setHasApproved(apps.some((a) => a.status === "approved"));
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || t("travelDocs.loadFailed"));
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
    setDocs((prev) => [created, ...prev]);
  }, []);

  const handleDeleted = useCallback((id) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const counts = useMemo(() => {
    const acc = { total: docs.length };
    for (const d of docs) {
      acc[d.type] = (acc[d.type] || 0) + 1;
    }
    return acc;
  }, [docs]);

  if (!sessionToken || !scholarProfile) return <Navigate to="/login?role=scholar" replace />;
  const scholar = scholarProfile.scholar;

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("travelDocs.pageTitle")}
      subtitle={t("travelDocs.pageSubtitle")}
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        {/* Privacy + access notice */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-semibold text-primary-dark">
                {t("travelDocs.privacyTitle")}
              </p>
              <p className="text-muted">
                {t("travelDocs.privacyBodyPrefix")}
                <span className="font-semibold text-emerald-700">{t("travelDocs.privacyBodyApproved")}</span>
                {t("travelDocs.privacyBodySuffix")}
              </p>
            </div>
          </CardContent>
        </Card>

        {hasApproved === false && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-start gap-3 p-4">
              <Award className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900">
                  {t("travelDocs.noApprovedTitle")}
                </p>
                <p className="text-amber-800">
                  {t("travelDocs.noApprovedBody")}{" "}
                  <Link
                    to="/scholar/scholarships"
                    className="font-semibold text-amber-900 underline hover:no-underline"
                  >
                    {t("travelDocs.noApprovedBrowse")}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasApproved === true && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="text-sm">
                <p className="font-semibold text-emerald-900">
                  {t("travelDocs.approvedTitle")}
                </p>
                <p className="text-emerald-800">
                  {t("travelDocs.approvedBody")}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload */}
        <UploadForm sessionToken={sessionToken} onUploaded={handleUploaded} />

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : docs.length === 0 ? (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                illustration={<TravelDocsIllustration />}
                title={t("travelDocs.emptyTitle")}
                description={t("travelDocs.emptyDescription")}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-xs text-muted">
              {t("travelDocs.documentsCount", { count: counts.total })}
            </p>
            <div className="grid gap-3">
              {docs.map((d) => (
                <TravelDocCard
                  key={d.id}
                  doc={d}
                  sessionToken={sessionToken}
                  onDeleted={handleDeleted}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default TravelDocsPage;
