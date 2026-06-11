import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronRight, RefreshCcw, Search, Users } from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ApplicantsIllustration, SearchEmptyIllustration } from "@/components/ui/empty-illustrations";

const AdminApplicantsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    sessionToken,
    adminDashboard,
    applicantsList,
    applicantsStatus,
    loadApplicants,
    isSubmitting,
    signOut,
  } = useAuth();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (sessionToken) loadApplicants();
  }, [sessionToken, loadApplicants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return applicantsList;
    return applicantsList.filter((a) =>
      [a.name, a.nationality, a.education, a.status, String(a.id)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  }, [applicantsList, query]);

  if (!sessionToken) return <Navigate to="/login/admin" replace />;

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title={t("adminApplicants.pageTitle")}
      subtitle={t("adminApplicants.totalProfiles", { count: applicantsList.length })}
      onSignOut={handleSignOut}
      actions={
        <Button onClick={loadApplicants} disabled={isSubmitting} variant="outline" size="sm">
          <RefreshCcw className="h-4 w-4" />
          {t("admin.refresh")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Search + summary */}
        <Card>
          <CardContent className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-white">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-ink">{filtered.length}</p>
                <p className="text-xs font-semibold text-muted">
                  {query ? t("adminApplicants.matchingApplicants") : t("adminApplicants.activeApplicants")}
                </p>
              </div>
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                type="search"
                placeholder={t("adminApplicants.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Status message */}
        {applicantsStatus?.message && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {applicantsStatus.message}
          </div>
        )}

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((applicant, idx) => (
              <motion.div
                key={applicant.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.03, 0.3) }}
              >
                <Link
                  to={`/admin/applicants/${applicant.id}`}
                  className="block h-full"
                >
                  <Card className="group h-full hover:shadow-lg hover:-translate-y-0.5 hover:border-primary transition-all">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border bg-slate-50">
                          {applicant.photo ? (
                            <img
                              src={applicant.photo}
                              alt={`${applicant.name} avatar`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <UserRound className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-bold text-ink group-hover:text-primary">
                            {applicant.name || t("adminApplicants.unnamed")}
                          </p>
                          <p className="text-xs text-muted truncate">
                            #{applicant.id} · {applicant.nationality || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-1.5 text-xs">
                        <p className="text-muted line-clamp-2">
                          <span className="font-semibold text-ink">{t("adminApplicants.educationLabel")}</span>{" "}
                          {applicant.education || t("adminApplicants.notSupplied")}
                        </p>
                        {applicant.status && (
                          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary-dark">
                            {applicant.status}
                          </span>
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-bold uppercase tracking-wider text-primary group-hover:gap-2 transition-all">
                        {t("adminApplicants.viewProfile")}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6">
              <EmptyState
                illustration={
                  query ? (
                    <SearchEmptyIllustration />
                  ) : (
                    <ApplicantsIllustration />
                  )
                }
                title={query ? t("adminApplicants.noMatchingSearch") : t("adminApplicants.noneFound")}
                action={
                  query ? (
                    <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                      {t("adminApplicants.clearSearch")}
                    </Button>
                  ) : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminApplicantsPage;
