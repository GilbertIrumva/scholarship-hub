import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Award,
  BookOpen,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FolderArchive,
  GraduationCap,
  Mail,
  Pencil,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import ScholarProfileCard from "./ScholarProfileCard";
import ScholarProfileForm from "./ScholarProfileForm";

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
const ScholarDashboard = ({ profile, onSaveProfile, isSubmitting, profileStatus }) => {
  const application = profile.application;
  const scholar = profile.scholar;
  const [isEditing, setIsEditing] = useState(false);

  const completeness = useMemo(() => calculateCompleteness(application), [application]);

  const statCards = [
    {
      icon: ClipboardList,
      label: "Application status",
      value: application?.status || "Not linked",
      note: application ? "Latest status on record" : "Link an application to begin",
      accent: "bg-gradient-to-br from-primary to-emerald-700",
    },
    {
      icon: GraduationCap,
      label: "Education",
      value: application?.education || "—",
      note: "Latest academic level",
      accent: "bg-gradient-to-br from-sky-500 to-indigo-600",
    },
    {
      icon: UserRound,
      label: "Profile completeness",
      value: `${completeness}%`,
      note: completeness >= 80 ? "Looking great" : "Add more details to stand out",
      accent: "bg-gradient-to-br from-accent to-orange-600",
    },
  ];

  // Mock-derived journey steps (real progress would come from backend)
  const journey = [
    { label: "Account created", done: true },
    { label: "Profile started", done: !!application?.name },
    { label: "Education added", done: !!application?.education && application?.education !== "Not supplied" },
    { label: "Photo uploaded", done: !!application?.photo },
    { label: "Application submitted", done: application?.status === "submitted" || application?.status === "reviewed" },
  ];
  const journeyDone = journey.filter((s) => s.done).length;

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
            Scholar workspace
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
          {isEditing ? "Cancel edit" : "Edit profile"}
        </Button>
      </motion.div>

      {/* Stat row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

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
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Journey */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Your journey
              </CardTitle>
              <p className="text-sm text-muted">
                {journeyDone} of {journey.length} steps completed
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={(journeyDone / journey.length) * 100} />
              <ul className="space-y-2.5">
                {journey.map((step) => (
                  <li
                    key={step.label}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        step.done ? "text-primary" : "text-slate-300"
                      }`}
                    />
                    <span className={step.done ? "text-ink font-medium" : "text-muted"}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" /> Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                {
                  icon: BookOpen,
                  text: "Complete your profile to unlock more scholarship matches.",
                },
                {
                  icon: CalendarDays,
                  text: "Check the catalog regularly — new opportunities open weekly.",
                },
                {
                  icon: Award,
                  text: "Add a clear bio and photo — verified profiles get reviewed faster.",
                },
              ].map((tip) => (
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
          <CardTitle className="text-lg">Next actions</CardTitle>
          <p className="text-sm text-muted">Keep moving forward.</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: completeness < 100 ? "Finish your profile" : "Polish your bio",
                description:
                  completeness < 100
                    ? `Your profile is ${completeness}% complete. Add the missing details.`
                    : "Refresh your bio so reviewers see the latest you.",
                action: () => setIsEditing(true),
                icon: UserRound,
              },
              {
                title: "Browse opportunities",
                description: "Explore the catalog and shortlist scholarships you qualify for.",
                href: "/scholar/scholarships",
                icon: BookOpen,
              },
              {
                title: "Track your application",
                description: application
                  ? `Application #${application.id} is currently ${application.status}.`
                  : "Submit your first application to start tracking progress.",
                href: "/scholar/applications",
                icon: ClipboardList,
              },
              {
                title: "Convert your grades",
                description: "See how your certificate maps to US GPA, UK class, and ECTS.",
                href: "/grade-converter",
                icon: Calculator,
              },
              {
                title: "Upload credentials",
                description: "Add certificates, transcripts, and ID documents to speed up applications.",
                href: "/scholar/credentials",
                icon: FolderArchive,
              },
            ].map((item) => (
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
        </CardContent>
      </Card>
    </div>
  );
};

export default ScholarDashboard;
