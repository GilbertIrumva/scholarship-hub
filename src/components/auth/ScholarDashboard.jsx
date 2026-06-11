import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Calculator,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Compass,
  FolderArchive,
  GraduationCap,
  Info,
  Mail,
  PartyPopper,
  Pencil,
  Plane,
  Settings2,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ScholarProfileCard from "./ScholarProfileCard";
import ScholarProfileForm from "./ScholarProfileForm";
import RecommendedRail from "./RecommendedRail";
import TwoFactorAndSessionsPanel from "./shared/TwoFactorAndSessionsPanel";

// -----------------------------------------------------------------------------
// Stat card
// -----------------------------------------------------------------------------
const StatCard = ({ icon: Icon, label, value, note, accent = "bg-primary" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className={`grid h-11 w-11 place-items-center rounded-xl text-white ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-4 text-3xl font-extrabold text-ink tracking-tight">{value}</p>
        <p className="mt-1 text-sm font-semibold text-muted">{label}</p>
        {note && <p className="mt-2 text-xs text-slate-500">{note}</p>}
      </CardContent>
    </Card>
  </motion.div>
);

// -----------------------------------------------------------------------------
// Profile completeness — derived from filled fields
// -----------------------------------------------------------------------------
const calculateCompleteness = (application) => {
  if (!application) return 10;
  const required = [
    "name",
    "contact",
    "age",
    "gender",
    "dateOfBirth",
    "nationality",
    "education",
    "address",
    "bio",
    "photo",
  ];
  const filled = required.filter((key) => {
    const v = application[key];
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v.trim().length > 0 && v !== "Not supplied";
    return true;
  }).length;
  return Math.round((filled / required.length) * 100);
};

// =============================================================================
// MAIN
// =============================================================================
const ScholarDashboard = ({ profile, onSaveProfile, isSubmitting, profileStatus, sessionToken }) => {
  const { t } = useTranslation();
  const application = profile.application;
  const scholar = profile.scholar;
  const [isEditing, setIsEditing] = useState(false);

  const completeness = useMemo(() => calculateCompleteness(application), [application]);

  const statCards = useMemo(() => [
    {
      icon: ClipboardList,
      label: t("profile.statApplicationStatus"),
      value: application?.status || t("profile.statApplicationNotLinked"),
      note: application
        ? t("profile.statApplicationNoteLinked")
        : t("profile.statApplicationNoteUnlinked"),
      accent: "bg-gradient-to-br from-primary to-emerald-700",
    },
    {
      icon: GraduationCap,
      label: t("profile.statEducation"),
      value: application?.education || t("profile.statEducationValueEmpty"),
      note: t("profile.statEducationNote"),
      accent: "bg-gradient-to-br from-primary to-emerald-700",
    },
    {
      icon: UserRound,
      label: t("profile.statProfileCompleteness"),
      value: `${completeness}%`,
      note: completeness >= 80
        ? t("profile.profileCompletenessGreat")
        : t("profile.profileCompletenessAdd"),
      accent: "bg-gradient-to-br from-emerald-500 to-emerald-800",
    },
  ], [application, completeness, t]);

  // Mock-derived journey steps (real progress would come from backend)
  const journey = useMemo(() => [
    { label: t("profile.journeyStepAccount"), done: true },
    { label: t("profile.journeyStepProfile"), done: !!application?.name },
    { label: t("profile.journeyStepEducation"), done: !!application?.education && application?.education !== "Not supplied" },
    { label: t("profile.journeyStepPhoto"), done: !!application?.photo },
    { label: t("profile.journeyStepApplication"), done: application?.status === "submitted" || application?.status === "reviewed" },
  ], [application, t]);
  const journeyDone = journey.filter((s) => s.done).length;

  const tips = useMemo(() => [
    { icon: BookOpen, text: t("profile.tipCompleteProfile") },
    { icon: CalendarDays, text: t("profile.tipCheckCatalog") },
    { icon: Award, text: t("profile.tipAddBioPhoto") },
  ], [t]);

  const nextActions = useMemo(() => [
    {
      group: "apply",
      title: completeness < 100
        ? t("profile.actionFinishProfileTitle")
        : t("profile.actionPolishBioTitle"),
      description: completeness < 100
        ? t("profile.actionFinishProfileDescription", { percent: completeness })
        : t("profile.actionPolishBioDescription"),
      action: () => setIsEditing(true),
      icon: UserRound,
    },
    {
      group: "apply",
      title: t("profile.actionBrowseTitle"),
      description: t("profile.actionBrowseDescription"),
      href: "/scholar/scholarships",
      icon: BookOpen,
    },
    {
      group: "apply",
      title: t("profile.actionConvertGradesTitle"),
      description: t("profile.actionConvertGradesDescription"),
      href: "/grade-converter",
      icon: Calculator,
    },
    {
      group: "track",
      title: t("profile.actionTrackTitle"),
      description: application
        ? t("profile.actionTrackDescription", { id: application.id, status: application.status })
        : t("profile.actionTrackDescriptionEmpty"),
      href: "/scholar/applications",
      icon: ClipboardList,
    },
    {
      group: "track",
      title: t("profile.actionVisaTitle"),
      description: t("profile.actionVisaDescription"),
      href: "/scholar/visa-tracker",
      icon: ClipboardCheck,
    },
    {
      group: "settings",
      title: t("profile.actionUploadCredentialsTitle"),
      description: t("profile.actionUploadCredentialsDescription"),
      href: "/scholar/credentials",
      icon: FolderArchive,
    },
    {
      group: "settings",
      title: t("profile.actionTravelDocsTitle"),
      description: t("profile.actionTravelDocsDescription"),
      href: "/scholar/travel-docs",
      icon: Plane,
    },
  ], [application, completeness, t]);

  const actionGroups = useMemo(() => {
    const groups = [
      {
        key: "apply",
        label: t("profile.actionGroupApplyLabel"),
        description: t("profile.actionGroupApplyDescription"),
        icon: Compass,
        accent: "text-primary",
        accentRing: "ring-emerald-200",
      },
      {
        key: "track",
        label: t("profile.actionGroupTrackLabel"),
        description: t("profile.actionGroupTrackDescription"),
        icon: ClipboardCheck,
        accent: "text-sky-700",
        accentRing: "ring-sky-200",
      },
      {
        key: "settings",
        label: t("profile.actionGroupSettingsLabel"),
        description: t("profile.actionGroupSettingsDescription"),
        icon: Settings2,
        accent: "text-primary",
        accentRing: "ring-emerald-200",
      },
    ];
    return groups
      .map((g) => ({ ...g, items: nextActions.filter((a) => a.group === g.key) }))
      .filter((g) => g.items.length > 0);
  }, [nextActions, t]);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {profileStatus?.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            profileStatus.type === "success"
              ? "border-success/30 bg-success/10 text-success"
              : profileStatus.type === "error"
              ? "border-danger/30 bg-danger/10 text-danger"
              : "border-border bg-slate-50 text-ink"
          }`}
        >
          {profileStatus.message}
        </div>
      )}

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("profile.workspaceEyebrow")}
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            {scholar.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            <Mail className="inline h-3.5 w-3.5 -mt-0.5 mr-1" />
            {scholar.email}
          </p>
        </div>
        <Button onClick={() => setIsEditing((v) => !v)} variant={isEditing ? "outline" : "default"}>
          <Pencil className="h-4 w-4" />
          {isEditing ? t("profile.cancelEdit") : t("profile.editProfile")}
        </Button>
      </motion.div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      {/* Recommended scholarships rail */}
      {sessionToken && <RecommendedRail sessionToken={sessionToken} />}

      {/* Two-column row: profile (left), journey + tips (right) */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isEditing ? (
            <ScholarProfileForm
              application={application}
              isSubmitting={isSubmitting}
              onCancel={() => setIsEditing(false)}
              onSave={async (payload) => {
                const result = await onSaveProfile(payload);
                if (result?.ok) setIsEditing(false);
                return result;
              }}
            />
          ) : (
            <ScholarProfileCard
              application={application}
              email={scholar.email}
              onEdit={() => setIsEditing(true)}
              onPhotoChange={(photo) => onSaveProfile({ ...(application || {}), photo })}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Journey */}
          <Card className="overflow-hidden border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-amber-50/40 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-surface dark:to-amber-950/20">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> {t("profile.journeyTitle")}
                  </CardTitle>
                  <p className="mt-0.5 text-sm text-muted">
                    {t("profile.journeyProgress", { done: journeyDone, total: journey.length })}
                  </p>
                </div>
                <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-extrabold text-primary shadow-sm ring-1 ring-emerald-200 dark:bg-surface-2/80 dark:ring-emerald-800/50">
                  {Math.round((journeyDone / journey.length) * 100)}%
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(journeyDone / journey.length) * 100} />

              {journeyDone === journey.length && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-white/70 px-3 py-2.5 text-sm font-semibold text-emerald-800 dark:border-emerald-800/60 dark:bg-surface-2/60 dark:text-emerald-300"
                >
                  <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {t("profile.journeyAllDone")}
                </motion.div>
              )}

              <ul className="space-y-2">
                {journey.map((step, idx) => {
                  const isActive = !step.done && idx === journey.findIndex((s) => !s.done);
                  return (
                    <li
                      key={step.label}
                      className={
                        "group flex items-center gap-3 rounded-xl border px-3 py-2 transition-all " +
                        (step.done
                          ? "border-emerald-200/70 bg-white/70 dark:border-emerald-800/40 dark:bg-surface-2/60"
                          : isActive
                          ? "border-emerald-300 bg-white shadow-sm ring-2 ring-emerald-300/40 dark:border-emerald-700/60 dark:bg-surface dark:ring-emerald-700/30"
                          : "border-transparent bg-white/40 dark:bg-surface-2/30")
                      }
                    >
                      <span
                        className={
                          "relative grid h-7 w-7 shrink-0 place-items-center rounded-full text-white shadow-sm " +
                          (step.done
                            ? "bg-gradient-to-br from-primary to-emerald-700"
                            : isActive
                            ? "bg-white text-primary ring-2 ring-primary dark:bg-surface"
                            : "bg-slate-200 text-slate-400 dark:bg-slate-800 dark:text-slate-500")
                        }
                      >
                        {step.done ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <span className="text-[11px] font-extrabold">{idx + 1}</span>
                        )}
                      </span>

                      <span
                        className={
                          "flex-1 text-sm leading-snug " +
                          (step.done
                            ? "font-semibold text-ink"
                            : isActive
                            ? "font-semibold text-ink"
                            : "text-muted")
                        }
                      >
                        {step.label}
                      </span>

                      {isActive && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                          {t("profile.journeyNextLabel")}
                        </span>
                      )}
                      {step.done && (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700/70 dark:text-emerald-400/70">
                          {t("profile.journeyDoneLabel")}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> {t("profile.tipsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tips.map((tip) => (
                <div
                  key={tip.text}
                  className="flex items-start gap-3 rounded-xl border border-border bg-slate-50/60 p-3"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white border border-border">
                    <tip.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm text-ink leading-relaxed">{tip.text}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick links / next actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("profile.nextActionsTitle")}</CardTitle>
          <p className="text-sm text-muted">{t("profile.nextActionsSubtitle")}</p>
        </CardHeader>
        <CardContent className="space-y-7">
          {actionGroups.map((group, groupIdx) => {
            const GroupIcon = group.icon;
            return (
              <section key={group.key} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white shadow-sm ring-1 ${group.accentRing} ${group.accent}`}
                  >
                    <GroupIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-extrabold uppercase tracking-[0.18em] ${group.accent}`}>
                      {group.label}
                    </p>
                    <p className="text-xs text-muted leading-snug">{group.description}</p>
                  </div>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-muted">
                    {group.items.length}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={item.action || (() => item.href && (window.location.href = item.href))}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-white p-4 text-left transition-all hover:border-primary hover:shadow-md"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-sm text-muted leading-snug">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
                {groupIdx < actionGroups.length - 1 && (
                  <div className="pt-1">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent" />
                  </div>
                )}
              </section>
            );
          })}
        </CardContent>
      </Card>

      {/* T3.4 — Security: 2FA + device sessions */}
      {sessionToken && (
        <section className="space-y-3">
          <header>
            <h2 className="text-xl font-extrabold tracking-tight text-ink">{t("profile.securityHeading")}</h2>
            <p className="text-sm text-muted">
              {t("profile.securitySubtitle")}
            </p>
          </header>
          <TwoFactorAndSessionsPanel sessionToken={sessionToken} principalKind="scholar" />
        </section>
      )}
    </div>
  );
};

export default ScholarDashboard;
