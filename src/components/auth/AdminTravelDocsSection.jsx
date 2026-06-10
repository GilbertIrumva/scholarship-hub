import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Plane,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Download,
  Eye,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Globe2,
  Calendar,
  FileText,
  FileImage,
  FileType2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  listAdminTravelDocs,
  checkTravelDocEligibility,
  reviewAdminTravelDoc,
  adminTravelDocDownloadUrl,
} from "../../services/travelDocs";

// Map service API values → i18n keys (under `travelDocs.type*`).
const TYPE_KEY = {
  passport: "travelDocs.typePassport",
  visa: "travelDocs.typeVisa",
  "travel-insurance": "travelDocs.typeTravelInsurance",
  vaccination: "travelDocs.typeVaccination",
  "other-travel": "travelDocs.typeOtherTravel",
};

const STATUS_META = {
  unverified: { chip: "bg-slate-100 text-slate-600", icon: Clock, labelKey: "travelDocs.statusUnverified" },
  pending: { chip: "bg-amber-100 text-amber-800", icon: Clock, labelKey: "travelDocs.statusPending" },
  verified: { chip: "bg-emerald-100 text-emerald-800", icon: CheckCircle2, labelKey: "travelDocs.statusVerified" },
  rejected: { chip: "bg-rose-100 text-rose-700", icon: AlertCircle, labelKey: "travelDocs.statusRejected" },
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

const ReviewPanel = ({ doc, sessionToken, onReviewed }) => {
  const { t } = useTranslation();
  const [note, setNote] = useState(doc.verificationNote || "");
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    setNote(doc.verificationNote || "");
  }, [doc.id, doc.verificationNote]);

  const submit = async (status) => {
    if (status === "rejected" && !note.trim()) {
      toast.error(t("admin.errRejectReason"));
      return;
    }
    setPending(status);
    setSubmitting(true);
    try {
      const { document: updated } = await reviewAdminTravelDoc(sessionToken, doc.id, {
        verificationStatus: status,
        verificationNote: note.trim(),
      });
      toast.success(
        status === "verified"
          ? t("adminTravelDocs.toastVerified")
          : status === "rejected"
            ? t("adminTravelDocs.toastRejected")
            : t("adminTravelDocs.toastStatusUpdated")
      );
      onReviewed(updated);
    } catch (err) {
      toast.error(err?.response?.data?.message || t("adminTravelDocs.failedUpdate"));
    } finally {
      setPending(null);
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-border bg-slate-50 p-4">
      <Label className="text-xs font-bold uppercase tracking-wider text-muted">
        {t("common.reviewerNote")}
      </Label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder={t("admin.notePlaceholderReview")}
        className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => submit("verified")}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {submitting && pending === "verified" ? (
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
          {submitting && pending === "pending" ? (
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
          {submitting && pending === "rejected" ? (
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

const TravelDocRow = ({ doc, sessionToken, onReviewed }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [revealNumber, setRevealNumber] = useState(false);

  const fetchBlob = async () => {
    const res = await fetch(adminTravelDocDownloadUrl(doc.id), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) throw new Error("Request failed");
    return res.blob();
  };

  const previewFile = async () => {
    try {
      const blob = await fetchBlob();
      window.open(URL.createObjectURL(blob), "_blank", "noopener");
    } catch {
      toast.error(t("adminTravelDocs.couldNotOpen"));
    }
  };

  const downloadFile = async () => {
    try {
      const blob = await fetchBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("adminTravelDocs.couldNotDownload"));
    }
  };

  const typeKey = TYPE_KEY[doc.type];
  const typeLabel = typeKey ? t(typeKey) : doc.type;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <FileIcon mimeType={doc.mimeType} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-bold text-ink">{doc.title}</h4>
                  <p className="text-xs text-muted">{typeLabel}</p>
                </div>
                <StatusChip status={doc.verificationStatus} />
              </div>

              {(doc.documentNumber || doc.documentNumberLast4) && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 text-xs">
                  <Lock className="h-3.5 w-3.5 text-muted" />
                  <span className="font-mono">
                    {revealNumber
                      ? doc.documentNumber
                      : `••••••${doc.documentNumberLast4 || ""}`}
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

              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                {doc.country && (
                  <span className="inline-flex items-center gap-1">
                    <Globe2 className="h-3.5 w-3.5" />
                    {doc.country}
                  </span>
                )}
                {doc.issuedDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("adminTravelDocs.issuedPrefix", { date: formatDate(doc.issuedDate) })}
                  </span>
                )}
                {doc.expiryDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t("adminTravelDocs.expiresPrefix", { date: formatDate(doc.expiryDate) })}
                  </span>
                )}
                <span>
                  {doc.originalName} · {formatBytes(doc.sizeBytes)}
                </span>
              </div>

              {doc.verificationNote && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  <span className="font-semibold">{t("admin.notePrefix")}</span> {doc.verificationNote}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
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
                  {expanded ? t("adminTravelDocs.close") : t("admin.review")}
                </Button>
              </div>

              {expanded && (
                <ReviewPanel
                  doc={doc}
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

/**
 * Embedded section: shows travel documents for one scholar, but only if
 * that scholar has an approved scholarship. Otherwise renders a notice.
 */
const AdminTravelDocsSection = ({ sessionToken, scholarId }) => {
  const { t } = useTranslation();
  const [docs, setDocs] = useState([]);
  const [eligibility, setEligibility] = useState(null); // { eligible, approvedCount }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!sessionToken || !scholarId) return;
    setLoading(true);
    setError("");
    try {
      const elig = await checkTravelDocEligibility(sessionToken, scholarId);
      setEligibility(elig);
      if (elig.eligible) {
        const data = await listAdminTravelDocs(sessionToken, { scholar: scholarId });
        setDocs(Array.isArray(data?.documents) ? data.documents : []);
      } else {
        setDocs([]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || t("adminTravelDocs.failedLoad"));
    } finally {
      setLoading(false);
    }
  }, [sessionToken, scholarId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReviewed = useCallback((updated) => {
    setDocs((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-primary" />
          {t("adminTravelDocs.title")}
        </CardTitle>
        <p className="text-xs text-muted">
          {t("adminTravelDocs.subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : !eligibility?.eligible ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-amber-900">{t("adminTravelDocs.locked")}</p>
              <p className="text-amber-800">
                {t("adminTravelDocs.lockedBodyPrefix")}
                <span className="font-semibold">{t("adminTravelDocs.approved")}</span>
                {t("adminTravelDocs.lockedBodySuffix")}
              </p>
            </div>
          </div>
        ) : docs.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-muted">
            {t("adminTravelDocs.empty")}
          </p>
        ) : (
          <div className="grid gap-3">
            {docs.map((d) => (
              <TravelDocRow
                key={d.id}
                doc={d}
                sessionToken={sessionToken}
                onReviewed={handleReviewed}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminTravelDocsSection;
