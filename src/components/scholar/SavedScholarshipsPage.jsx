import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart,
  Loader2,
  Calendar,
  DollarSign,
  MapPin,
  Tag,
  Compass,
} from "lucide-react";
import { useAuth } from "../../context/useAuth";
import { useSavedScholarships } from "../../context/useSavedScholarships";
import DashboardLayout from "../auth/DashboardLayout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { SkeletonCard } from "../ui/skeleton";
import { Seo } from "../seo/Seo";
import { listSavedScholarships } from "../../services/scholarship";
import { SaveButton } from "./SaveButton";

// Compact card mirroring the browse-page styling so the page feels familiar.
const SavedCard = ({ scholarship }) => {
  const id = scholarship._id || scholarship.id;
  const days = (() => {
    if (!scholarship.deadline) return null;
    const ms = new Date(scholarship.deadline).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  })();
  const isUrgent = days !== null && days >= 0 && days <= 14;
  const isClosed = days !== null && days < 0;
  const fmtAmount = (amount, currency) => {
    if (!amount) return "—";
    try {
      return new Intl.NumberFormat("en", {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 0,
      }).format(Number(amount));
    } catch {
      return `${currency || "$"}${amount}`;
    }
  };
  const fmtDeadline = (d) => {
    if (!d) return "Rolling";
    try {
      return new Date(d).toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-1.5 bg-gradient-to-r from-rose-400 to-rose-600" />
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug text-ink group-hover:text-primary-dark">
            {scholarship.title}
          </h3>
          {isUrgent && !isClosed && (
            <span className="shrink-0 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-dark">
              {days === 0 ? "Today" : `${days}d left`}
            </span>
          )}
          {isClosed && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Closed
            </span>
          )}
        </div>
        {scholarship.provider && (
          <p className="mt-1 text-sm font-semibold text-muted">
            {scholarship.provider}
          </p>
        )}
        {scholarship.description && (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
            {scholarship.description}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-ink">
              {fmtAmount(scholarship.amount, scholarship.currency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-ink">
              {fmtDeadline(scholarship.deadline)}
            </span>
          </div>
        </div>

        {(scholarship.fields?.length || scholarship.countries?.length) > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {scholarship.fields?.slice(0, 2).map((f) => (
              <span
                key={`f-${f}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary-dark"
              >
                <Tag className="h-2.5 w-2.5" /> {f}
              </span>
            ))}
            {scholarship.countries?.slice(0, 2).map((c) => (
              <span
                key={`c-${c}`}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600"
              >
                <MapPin className="h-2.5 w-2.5" /> {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5">
          <div className="flex items-center gap-2">
            <Button asChild className="flex-1">
              <Link to={`/scholar/scholarships/${id}`}>View details</Link>
            </Button>
            <SaveButton
              scholarshipId={id}
              scholarshipTitle={scholarship.title}
              size="md"
            />
          </div>
        </div>
      </div>
    </motion.article>
  );
};

const SavedScholarshipsPage = () => {
  const { sessionToken, scholarProfile, signOut } = useAuth();
  const { ids, refresh } = useSavedScholarships();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    listSavedScholarships(sessionToken)
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-fetch when the saved-ids set changes (e.g. user unsaves from this page).
  }, [sessionToken, ids]);

  if (!sessionToken || !scholarProfile) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout
      role="scholar"
      title="Saved scholarships"
      subtitle="Your bookmarked opportunities, all in one place."
      onLogout={signOut}
    >
      <Seo title="Saved scholarships" noindex />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 sm:p-12">
          <EmptyState
            icon={Heart}
            title="No saved scholarships yet"
            description="Bookmark scholarships you're interested in so you can find them quickly later. Click the heart icon on any scholarship card."
            action={
              <Button asChild>
                <Link to="/scholar/scholarships">
                  <Compass className="mr-2 h-4 w-4" />
                  Browse scholarships
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              You have{" "}
              <span className="font-semibold text-ink">{items.length}</span>{" "}
              saved {items.length === 1 ? "scholarship" : "scholarships"}.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="hidden sm:inline-flex"
            >
              <Loader2 className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((s) => (
              <SavedCard key={s._id || s.id} scholarship={s} />
            ))}
          </div>
        </>
      )}
    </DashboardLayout>
  );
};

export default SavedScholarshipsPage;
