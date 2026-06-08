import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  GraduationCap,
  Tag,
  Calendar,
  DollarSign,
  Loader2,
  Compass,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  searchPublicScholarships,
  getPublicFilters,
} from "../../services/publicApi";

const formatAmount = (amount, currency = "USD") => {
  if (!amount) return "Amount on request";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

const formatDeadline = (deadline) => {
  if (!deadline) return "Rolling";
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return "Rolling";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const daysUntil = (deadline) => {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d - new Date()) / (1000 * 60 * 60 * 24));
  return diff;
};

const ScholarshipCard = ({ scholarship }) => {
  const days = daysUntil(scholarship.deadline);
  const isUrgent = days !== null && days >= 0 && days <= 14;
  const isClosed = days !== null && days < 0;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="h-1.5 bg-gradient-to-r from-primary to-emerald-700" />
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
          <p className="mt-1 text-sm font-semibold text-muted">{scholarship.provider}</p>
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
              {formatAmount(scholarship.amount, scholarship.currency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-muted">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-ink">
              {formatDeadline(scholarship.deadline)}
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
          <Button asChild className="w-full">
            <Link to={`/scholar/scholarships/${scholarship._id || scholarship.id}`}>
              View details
            </Link>
          </Button>
        </div>
      </div>
    </motion.article>
  );
};

const FilterChips = ({ label, options, value, onChange, icon: Icon }) => {
  if (!options || options.length === 0) return null;
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={[
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            !value
              ? "bg-primary text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200",
          ].join(" ")}
        >
          All
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt === value ? "" : opt)}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              value === opt
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            ].join(" ")}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const ScholarshipsPage = () => {
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ countries: [], grades: [], fields: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [grade, setGrade] = useState("");
  const [field, setField] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // debounce search input
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  // load filters once
  useEffect(() => {
    let cancelled = false;
    getPublicFilters()
      .then((data) => {
        if (!cancelled) setFilters(data || { countries: [], grades: [], fields: [] });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // fetch scholarships whenever query/filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (country) params.country = country;
    if (grade) params.grade = grade;
    if (field) params.field = field;
    params.limit = 50;

    searchPublicScholarships(params)
      .then((data) => {
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || "Failed to load scholarships.");
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, country, grade, field]);

  if (!sessionToken || !scholarProfile) {
    return <Navigate to="/login?role=scholar" replace />;
  }

  const scholar = scholarProfile.scholar;
  const hasActiveFilters = Boolean(query || country || grade || field);

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const clearAll = () => {
    setQuery("");
    setCountry("");
    setGrade("");
    setField("");
  };

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title="Browse scholarships"
      subtitle="Discover funding opportunities matched to your journey"
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        {/* Search + clear */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title, provider, or keyword..."
                  className="pl-9"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filter chips */}
        <Card>
          <CardContent className="p-5">
            <div className="grid gap-5 md:grid-cols-3">
              <FilterChips
                label="Country"
                icon={MapPin}
                options={filters.countries}
                value={country}
                onChange={setCountry}
              />
              <FilterChips
                label="Grade"
                icon={GraduationCap}
                options={filters.grades}
                value={grade}
                onChange={setGrade}
              />
              <FilterChips
                label="Field"
                icon={Tag}
                options={filters.fields}
                value={field}
                onChange={setField}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 text-center">
              <Compass className="h-12 w-12 text-muted/40" />
              <h3 className="mt-4 text-lg font-bold text-ink">No scholarships found</h3>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Try adjusting your search or clearing the filters to see more results.
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearAll} className="mt-4">
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">
              {items.length} {items.length === 1 ? "scholarship" : "scholarships"} found
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <ScholarshipCard key={s._id || s.id} scholarship={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ScholarshipsPage;
