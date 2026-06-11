import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CalendarDays,
  Loader2,
  Target,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RecommendationsIllustration } from "@/components/ui/empty-illustrations";
import { SaveButton } from "../scholar/SaveButton";
import { fetchRecommendations } from "../../services/scholarship";

const formatDeadline = (deadline, t) => {
  if (!deadline) return t("recommendations.rollingDeadline");
  try {
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) return t("recommendations.open");
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return t("recommendations.open");
  }
};

const matchTone = (percent) => {
  if (percent >= 70) return "bg-emerald-100 text-emerald-800";
  if (percent >= 40) return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
};

const RecommendedRail = ({ sessionToken }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [personalised, setPersonalised] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRecommendations(sessionToken, { limit: 6 })
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPersonalised(Boolean(data?.personalised));
      })
      .catch(() => {
        if (cancelled) return;
        setError(t("recommendations.errorLoad"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [sessionToken, nonce]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-4 w-4 text-primary" /> {t("recommendations.title")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted">
              {personalised
                ? t("recommendations.personalisedSubtitle")
                : t("recommendations.genericSubtitle")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading}
            aria-label={t("recommendations.refresh")}
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("recommendations.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            {t("recommendations.findingFits")}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-800">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            illustration={<RecommendationsIllustration />}
            title={t("recommendations.noneTitle")}
            description={t("recommendations.none")}
            action={
              <Button asChild size="sm">
                <Link to="/scholar/scholarships">
                  {t("recommendations.browseAll")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            }
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((entry) => {
              const s = entry.scholarship || {};
              const id = s._id || s.id;
              return (
                <div
                  key={id || s.title}
                  className="group relative rounded-xl border border-border bg-white transition-shadow hover:shadow-md"
                >
                  {id && (
                    <SaveButton
                      scholarshipId={id}
                      scholarshipTitle={s.title}
                      size="sm"
                      className="absolute right-2 top-2 z-10"
                    />
                  )}
                  <Link
                    to={id ? `/scholar/scholarships/${id}` : "/scholar/scholarships"}
                    className="flex flex-col gap-2 p-4 pr-12"
                  >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-ink leading-snug line-clamp-2">
                      {s.title || t("recommendations.untitledScholarship")}
                    </h4>
                    {entry.matchPercent > 0 && (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${matchTone(
                          entry.matchPercent
                        )}`}
                      >
                        {entry.matchPercent}% {t("recommendations.match")}
                      </span>
                    )}
                  </div>
                  {s.provider && (
                    <p className="text-xs font-medium text-muted line-clamp-1">{s.provider}</p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDeadline(s.deadline, t)}
                  </div>
                  {Array.isArray(entry.reasons) && entry.reasons.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {entry.reasons.slice(0, 3).map((reason) => (
                        <span
                          key={reason}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                        >
                          <Target className="h-3 w-3" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                  <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
                    {t("recommendations.viewDetails")} <ArrowRight className="h-3 w-3" />
                  </span>
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="mt-4 text-center">
            <Link
              to="/scholar/scholarships"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              {t("recommendations.browseAll")} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecommendedRail;
