import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search,
  MapPin,
  GraduationCap,
  Tag,
  Calendar,
  DollarSign,
  Compass,
  X,
  SlidersHorizontal,
  ArrowDownUp,
  ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { SaveButton } from "./SaveButton";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { SkeletonCard } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
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
          <div className="flex items-center gap-2">
            <Button asChild className="flex-1">
              <Link to={`/scholar/scholarships/${scholarship._id || scholarship.id}`}>
                View details
              </Link>
            </Button>
            <SaveButton
              scholarshipId={scholarship._id || scholarship.id}
              scholarshipTitle={scholarship.title}
              size="md"
            />
          </div>
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
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
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
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            ].join(" ")}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const SORT_OPTIONS = [
  { value: "deadline-asc", label: "Deadline (soonest)" },
  { value: "deadline-desc", label: "Deadline (latest)" },
  { value: "amount-desc", label: "Award (highest)" },
  { value: "amount-asc", label: "Award (lowest)" },
  { value: "newest", label: "Recently added" },
  { value: "title-asc", label: "Title (A–Z)" },
];

const DEADLINE_WINDOWS = [
  { value: "", label: "Any time" },
  { value: "7", label: "Next 7 days" },
  { value: "30", label: "Next 30 days" },
  { value: "90", label: "Next 90 days" },
  { value: "180", label: "Next 6 months" },
];

const DEFAULT_SORT = "deadline-asc";

// Helpers to read params from URLSearchParams with safe defaults.
const readParam = (params, key, fallback = "") => params.get(key) || fallback;

const ScholarshipsPage = () => {
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Pull filter state from URL search params (single source of truth).
  const query = readParam(searchParams, "q");
  const country = readParam(searchParams, "country");
  const grade = readParam(searchParams, "grade");
  const field = readParam(searchParams, "field");
  const minAmount = readParam(searchParams, "minAmount");
  const maxAmount = readParam(searchParams, "maxAmount");
  const deadlineWithin = readParam(searchParams, "deadlineWithin");
  const openOnly = readParam(searchParams, "openOnly") === "true";
  const sort = readParam(searchParams, "sort", DEFAULT_SORT);

  // Local-only mirror so the search input stays snappy while we debounce
  // pushing the URL update.
  const [queryDraft, setQueryDraft] = useState(query);
  const [minDraft, setMinDraft] = useState(minAmount);
  const [maxDraft, setMaxDraft] = useState(maxAmount);

  // Resync drafts if URL changes externally (e.g. back/forward).
  useEffect(() => setQueryDraft(query), [query]);
  useEffect(() => setMinDraft(minAmount), [minAmount]);
  useEffect(() => setMaxDraft(maxAmount), [maxAmount]);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState({
    countries: [],
    grades: [],
    fields: [],
  });
  const [loading, setLoading] = useState(true);

  // Patch the URLSearchParams without losing other keys.
  const patchParams = (patches) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patches).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    setSearchParams(next, { replace: true });
  };

  const setParam = (key, value) => patchParams({ [key]: value });

  // Debounced search-query → URL sync.
  useEffect(() => {
    if (queryDraft === query) return;
    const id = setTimeout(() => setParam("q", queryDraft.trim()), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDraft]);

  // Debounced amount range → URL sync (commits when user pauses typing).
  useEffect(() => {
    if (minDraft === minAmount && maxDraft === maxAmount) return;
    const id = setTimeout(() => {
      patchParams({ minAmount: minDraft.trim(), maxAmount: maxDraft.trim() });
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDraft, maxDraft]);

  // Load facet options once.
  useEffect(() => {
    let cancelled = false;
    getPublicFilters()
      .then((data) => {
        if (!cancelled) {
          setFilterOptions(data || { countries: [], grades: [], fields: [] });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch scholarships whenever any committed URL param changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { limit: 50, sort: sort || DEFAULT_SORT };
    if (query) params.q = query;
    if (country) params.country = country;
    if (grade) params.grade = grade;
    if (field) params.field = field;
    if (minAmount) params.minAmount = minAmount;
    if (maxAmount) params.maxAmount = maxAmount;
    if (openOnly) params.openOnly = "true";
    if (deadlineWithin) {
      const days = Number(deadlineWithin);
      if (Number.isFinite(days) && days > 0) {
        const before = new Date();
        before.setDate(before.getDate() + days);
        params.deadlineBefore = before.toISOString();
      }
    }

    searchPublicScholarships(params)
      .then((data) => {
        if (cancelled) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setTotal(typeof data?.total === "number" ? data.total : data?.items?.length || 0);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || "Failed to load scholarships.");
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, country, grade, field, minAmount, maxAmount, deadlineWithin, openOnly, sort]);

  // Compose a list of "active filter" pills shown above the results.
  const activeChips = useMemo(() => {
    const chips = [];
    if (country) chips.push({ key: "country", label: country, icon: MapPin });
    if (grade) chips.push({ key: "grade", label: grade, icon: GraduationCap });
    if (field) chips.push({ key: "field", label: field, icon: Tag });
    if (minAmount || maxAmount) {
      const lo = minAmount ? `$${Number(minAmount).toLocaleString()}` : "$0";
      const hi = maxAmount ? `$${Number(maxAmount).toLocaleString()}` : "any";
      chips.push({
        key: "amount-range",
        label: `${lo} – ${hi}`,
        icon: DollarSign,
        onRemove: () => patchParams({ minAmount: "", maxAmount: "" }),
      });
    }
    if (deadlineWithin) {
      const opt = DEADLINE_WINDOWS.find((d) => d.value === deadlineWithin);
      chips.push({
        key: "deadlineWithin",
        label: opt?.label || `Within ${deadlineWithin} days`,
        icon: Calendar,
      });
    }
    if (openOnly) {
      chips.push({ key: "openOnly", label: "Open only", icon: Calendar });
    }
    return chips;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, grade, field, minAmount, maxAmount, deadlineWithin, openOnly]);

  if (!sessionToken || !scholarProfile) {
    return <Navigate to="/login?role=scholar" replace />;
  }

  const scholar = scholarProfile.scholar;
  const hasActiveFilters =
    Boolean(query) ||
    activeChips.length > 0 ||
    (sort && sort !== DEFAULT_SORT);

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const clearAll = () => {
    setQueryDraft("");
    setMinDraft("");
    setMaxDraft("");
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  const removeChip = (chip) => {
    if (chip.onRemove) {
      chip.onRemove();
      return;
    }
    setParam(chip.key, "");
  };

  const sortLabel =
    SORT_OPTIONS.find((s) => s.value === (sort || DEFAULT_SORT))?.label || "Sort";

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title="Browse scholarships"
      subtitle="Discover funding opportunities matched to your journey"
      onSignOut={handleSignOut}
    >
      <div className="space-y-6">
        {/* Search bar + sort + more filters */}
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={queryDraft}
                  onChange={(e) => setQueryDraft(e.target.value)}
                  placeholder="Search by title, provider, or keyword..."
                  className="pl-9"
                  aria-label="Search scholarships"
                />
                {queryDraft && (
                  <button
                    type="button"
                    onClick={() => setQueryDraft("")}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Sort dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ArrowDownUp className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{sortLabel}</span>
                      <span className="sm:hidden">Sort</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[14rem]">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={sort || DEFAULT_SORT}
                      onValueChange={(v) =>
                        setParam("sort", v === DEFAULT_SORT ? "" : v)
                      }
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* More filters dropdown (amount + deadline + open-only) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      More filters
                      {(minAmount || maxAmount || deadlineWithin || openOnly) && (
                        <Badge variant="default" className="ml-1 h-4 px-1.5 text-[10px]">
                          {[
                            minAmount || maxAmount,
                            deadlineWithin,
                            openOnly,
                          ].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[20rem] p-4"
                    onCloseAutoFocus={(e) => e.preventDefault()}
                  >
                    <DropdownMenuLabel className="px-0 pb-2">
                      Award amount
                    </DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Min"
                        value={minDraft}
                        onChange={(e) => setMinDraft(e.target.value)}
                        aria-label="Minimum award amount"
                      />
                      <span className="text-xs text-muted">to</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder="Max"
                        value={maxDraft}
                        onChange={(e) => setMaxDraft(e.target.value)}
                        aria-label="Maximum award amount"
                      />
                    </div>

                    <DropdownMenuSeparator className="my-3" />

                    <DropdownMenuLabel className="px-0 pb-2">
                      Deadline window
                    </DropdownMenuLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {DEADLINE_WINDOWS.map((opt) => {
                        const active = (deadlineWithin || "") === opt.value;
                        return (
                          <button
                            key={opt.value || "any"}
                            type="button"
                            onClick={() => setParam("deadlineWithin", opt.value)}
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                              active
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
                            ].join(" ")}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>

                    <DropdownMenuSeparator className="my-3" />

                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={openOnly}
                        onChange={(e) =>
                          setParam("openOnly", e.target.checked ? "true" : "")
                        }
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      Only show open scholarships
                    </label>
                  </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" /> Clear all
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facet chips */}
        <Card>
          <CardContent className="p-5">
            <div className="grid gap-5 md:grid-cols-3">
              <FilterChips
                label="Country"
                icon={MapPin}
                options={filterOptions.countries}
                value={country}
                onChange={(v) => setParam("country", v)}
              />
              <FilterChips
                label="Grade"
                icon={GraduationCap}
                options={filterOptions.grades}
                value={grade}
                onChange={(v) => setParam("grade", v)}
              />
              <FilterChips
                label="Field"
                icon={Tag}
                options={filterOptions.fields}
                value={field}
                onChange={(v) => setParam("field", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Active filter chips strip */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Active:
            </span>
            {activeChips.map((chip) => {
              const Icon = chip.icon;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => removeChip(chip)}
                  className="group inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  <span>{chip.label}</span>
                  <X className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}

        {/* Results header + grid */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Compass}
            title="No scholarships found"
            description="Try adjusting your search or clearing the filters to see more results."
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={clearAll}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-muted">
                Showing <span className="text-ink">{items.length}</span>
                {total > items.length ? <> of {total}</> : null}{" "}
                {total === 1 ? "scholarship" : "scholarships"}
              </p>
              {sort && sort !== DEFAULT_SORT && (
                <p className="text-xs text-muted">
                  Sorted by <span className="font-semibold text-ink">{sortLabel}</span>
                </p>
              )}
            </div>
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
