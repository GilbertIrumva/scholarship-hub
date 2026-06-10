import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  FileText,
  GraduationCap,
  Loader2,
  Send,
  ShieldCheck,
  User,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import DashboardLayout from "../auth/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Progress } from "../ui/progress";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { getPublicScholarshipById } from "../../services/publicApi";
import {
  getApplicationDraft,
  saveApplicationDraft,
  submitApplicationWizard,
} from "../../services/applications";
import { listMyCredentials } from "../../services/credentials";

const MOTIVATION_MAX = 2000;
const AUTOSAVE_DEBOUNCE_MS = 800;

const STEP_DEFS = [
  { id: "personal", titleKey: "wizard.stepPersonal", icon: User },
  { id: "academic", titleKey: "wizard.stepAcademic", icon: GraduationCap },
  { id: "documents", titleKey: "wizard.stepDocuments", icon: FileText },
  { id: "review", titleKey: "wizard.stepReview", icon: ShieldCheck },
];
const STEP_COUNT = STEP_DEFS.length;

const emptyDraft = {
  motivation: "",
  personalInfo: {
    fullName: "",
    phone: "",
    dateOfBirth: "",
    nationality: "",
    country: "",
    address: "",
  },
  academicInfo: {
    currentLevel: "",
    institution: "",
    fieldOfStudy: "",
    gradePoint: "",
    expectedCompletion: "",
  },
  documents: [],
  lastStep: 0,
};

// Reducer keeps step transitions and field updates predictable so the
// autosave effect can rely on referential equality of `state.form`.
const reducer = (state, action) => {
  switch (action.type) {
    case "hydrate":
      return { ...state, form: action.form, step: action.step ?? state.step, dirty: false };
    case "setStep":
      return { ...state, step: action.step, dirty: true };
    case "field": {
      const { section, name, value } = action;
      if (!section) {
        return { ...state, form: { ...state.form, [name]: value }, dirty: true };
      }
      return {
        ...state,
        form: {
          ...state.form,
          [section]: { ...state.form[section], [name]: value },
        },
        dirty: true,
      };
    }
    case "toggleDocument": {
      const exists = state.form.documents.some(
        (d) => d.credentialId === action.credential.credentialId
      );
      const documents = exists
        ? state.form.documents.filter(
            (d) => d.credentialId !== action.credential.credentialId
          )
        : [...state.form.documents, action.credential];
      return { ...state, form: { ...state.form, documents }, dirty: true };
    }
    case "markSaved":
      return { ...state, dirty: false, lastSavedAt: action.at };
    default:
      return state;
  }
};

const initialState = {
  form: emptyDraft,
  step: 0,
  dirty: false,
  lastSavedAt: null,
};

const Field = ({ label, hint, required, error, children }) => (
  <div>
    <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
      {label}
      {required && <span className="text-rose-500">*</span>}
      {hint && <span className="text-xs font-normal text-muted">{hint}</span>}
    </Label>
    {children}
    {error && <p className="mt-1 text-xs font-semibold text-rose-600">{error}</p>}
  </div>
);

const StepIndicator = ({ current, total, onJump, completed, steps }) => {
  const { t } = useTranslation();
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div className="space-y-3">
      <Progress
        value={pct}
        aria-label={t("wizard.stepIndicatorAria", { current: current + 1, total })}
      />
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === current;
          const isDone = completed.has(i) || i < current;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={!isDone && !isActive && i > current}
                className={[
                  "group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : isDone
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-border bg-surface text-muted",
                ].join(" ")}
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={[
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px]",
                    isActive
                      ? "bg-primary text-white"
                      : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
                  ].join(" ")}
                >
                  {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </span>
                <span className="truncate">
                  <span className="hidden sm:inline">
                    {t("wizard.stepPrefix", { number: i + 1 })}{" "}
                  </span>
                  {s.title}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const AutosaveBadge = ({ saving, dirty, lastSavedAt }) => {
  const { t } = useTranslation();
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        {t("wizard.savingBadge")}
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <CloudUpload className="h-3.5 w-3.5" />
        {t("wizard.unsavedChanges")}
      </span>
    );
  }
  if (lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {t("wizard.savedAt", { time: new Date(lastSavedAt).toLocaleTimeString() })}
      </span>
    );
  }
  return null;
};

const ApplicationWizardPage = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const { scholarProfile, sessionToken, signOut } = useAuth();

  const [state, dispatch] = useReducer(reducer, initialState);
  const [scholarship, setScholarship] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [credentials, setCredentials] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const STEPS = useMemo(
    () => STEP_DEFS.map((s) => ({ ...s, title: t(s.titleKey) })),
    [t]
  );

  // Track which steps the user has at least visited — useful for the
  // indicator + jump-back behaviour.
  const visitedSteps = useRef(new Set([0]));
  visitedSteps.current.add(state.step);

  const handleSignOut = useCallback(() => {
    signOut();
    navigate("/");
  }, [signOut, navigate]);

  // 1. Load scholarship + draft + credentials in parallel.
  useEffect(() => {
    if (!sessionToken || !id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    Promise.all([
      getPublicScholarshipById(id).catch(() => null),
      getApplicationDraft(sessionToken, id).catch(() => ({ application: null })),
      listMyCredentials(sessionToken).catch(() => ({ credentials: [] })),
    ])
      .then(([sData, dData, cData]) => {
        if (cancelled) return;
        const sch = sData?.scholarship || null;
        if (!sch) {
          setLoadError(t("wizard.scholarshipNotFoundOrInactive"));
          setLoading(false);
          return;
        }
        setScholarship(sch);
        setCredentials(Array.isArray(cData?.credentials) ? cData.credentials : []);

        const existing = dData?.application;
        if (existing && existing.status !== "draft") {
          setAlreadySubmitted(true);
        }

        // Hydrate form from existing draft or scholar profile defaults.
        const profileApp = scholarProfile?.application || {};
        const seeded = existing
          ? {
              motivation: existing.motivation || "",
              personalInfo: { ...emptyDraft.personalInfo, ...(existing.personalInfo || {}) },
              academicInfo: { ...emptyDraft.academicInfo, ...(existing.academicInfo || {}) },
              documents: Array.isArray(existing.documents) ? existing.documents : [],
              lastStep: existing.lastStep || 0,
            }
          : {
              ...emptyDraft,
              personalInfo: {
                ...emptyDraft.personalInfo,
                fullName: scholarProfile?.scholar?.name || profileApp.name || "",
                phone: profileApp.contact || "",
                nationality: profileApp.nationality || "",
                dateOfBirth: profileApp.dateOfBirth || "",
                address: profileApp.address || "",
              },
            };

        dispatch({
          type: "hydrate",
          form: seeded,
          step: Math.min(seeded.lastStep || 0, STEP_COUNT - 1),
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(t("wizard.loadFailed"));
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken, id, scholarProfile, t]);

  // 2. Autosave whenever the form becomes dirty. Debounced.
  useEffect(() => {
    if (!state.dirty || alreadySubmitted || !sessionToken || !id || loading) return;
    const handle = setTimeout(async () => {
      setSaving(true);
      try {
        const data = await saveApplicationDraft(sessionToken, id, {
          ...state.form,
          lastStep: state.step,
        });
        if (data?.application?.status && data.application.status !== "draft") {
          setAlreadySubmitted(true);
        }
        dispatch({ type: "markSaved", at: new Date().toISOString() });
      } catch (err) {
        // Stay dirty so the next change retries — but tell the user.
        toast.error(err?.response?.data?.message || t("wizard.autosaveFailed"));
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [state.dirty, state.form, state.step, sessionToken, id, alreadySubmitted, loading, t]);

  // Field helpers ----------------------------------------------------------
  const setField = (section, name) => (e) => {
    const value = e && e.target ? e.target.value : e;
    dispatch({ type: "field", section, name, value });
  };

  const validateStep = (stepIndex) => {
    const errors = {};
    if (stepIndex === 0) {
      if (!state.form.personalInfo.fullName.trim()) {
        errors["personalInfo.fullName"] = t("wizard.fullNameRequired");
      }
    }
    // Other steps stay friendly — optional fields throughout.
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(state.step);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error(t("auth.fixHighlightedFields"));
      return;
    }
    setValidationErrors({});
    dispatch({ type: "setStep", step: Math.min(state.step + 1, STEP_COUNT - 1) });
  };

  const goBack = () => {
    setValidationErrors({});
    dispatch({ type: "setStep", step: Math.max(state.step - 1, 0) });
  };

  const jumpTo = (i) => {
    if (i <= state.step || visitedSteps.current.has(i)) {
      setValidationErrors({});
      dispatch({ type: "setStep", step: i });
    }
  };

  const handleSubmit = async () => {
    const errors = validateStep(0);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      dispatch({ type: "setStep", step: 0 });
      toast.error(t("wizard.fixRequiredBeforeSubmit"));
      return;
    }
    setSubmitting(true);
    try {
      await submitApplicationWizard(sessionToken, id, {
        ...state.form,
        lastStep: STEP_COUNT - 1,
      });
      toast.success(t("wizard.submittedToast"));
      navigate("/scholar/applications", { replace: true });
    } catch (err) {
      toast.error(
        err?.response?.data?.message || t("wizard.submitFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Render guards ----------------------------------------------------------
  const isClosed = useMemo(() => {
    if (!scholarship?.deadline) return false;
    const d = new Date(scholarship.deadline);
    return !Number.isNaN(d.getTime()) && d < new Date();
  }, [scholarship]);

  if (!sessionToken || !scholarProfile) {
    return <Navigate to="/login?role=scholar" replace />;
  }
  const scholar = scholarProfile.scholar;

  if (loading) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("wizard.fallbackTitle")}
        onSignOut={handleSignOut}
      >
        <div className="space-y-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (loadError) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("wizard.fallbackTitle")}
        onSignOut={handleSignOut}
      >
        <Alert variant="danger">
          <AlertTitle>{t("common.somethingWentWrong")}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/scholar/scholarships">
              <ArrowLeft className="h-4 w-4" /> {t("scholarshipDetail.backToScholarships")}
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (alreadySubmitted) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("wizard.alreadySubmittedTitle")}
        onSignOut={handleSignOut}
      >
        <Card>
          <CardContent className="flex flex-col items-center text-center py-12">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink">
              {t("wizard.alreadySubmittedHeading")}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {t("wizard.trackFromMyApplications")}
            </p>
            <div className="mt-6 flex gap-2">
              <Button asChild variant="outline">
                <Link to={`/scholar/scholarships/${id}`}>{t("wizard.viewScholarship")}</Link>
              </Button>
              <Button asChild>
                <Link to="/scholar/applications">{t("wizard.myApplications")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  if (isClosed) {
    return (
      <DashboardLayout
        role="scholar"
        user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
        title={t("wizard.scholarshipClosedTitle")}
        onSignOut={handleSignOut}
      >
        <Alert variant="warning">
          <AlertTitle>{t("wizard.applicationsClosedTitle")}</AlertTitle>
          <AlertDescription>
            {t("wizard.applicationsClosedBody")}
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to={`/scholar/scholarships/${id}`}>
              <ArrowLeft className="h-4 w-4" /> {t("wizard.backToScholarshipShort")}
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("wizard.applyTitle", { title: scholarship.title })}
      subtitle={scholarship.provider || t("wizard.multiStepSubtitle")}
      onSignOut={handleSignOut}
    >
      <div className="space-y-5">
        <Link
          to={`/scholar/scholarships/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> {t("wizard.backToScholarship")}
        </Link>

        <Card>
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-ink">
                {STEPS[state.step].title}
              </h2>
              <AutosaveBadge
                saving={saving}
                dirty={state.dirty}
                lastSavedAt={state.lastSavedAt}
              />
            </div>
            <StepIndicator
              current={state.step}
              total={STEP_COUNT}
              onJump={jumpTo}
              completed={visitedSteps.current}
              steps={STEPS}
            />
          </CardContent>
        </Card>

        <motion.div
          key={state.step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {(() => {
                  const Icon = STEPS[state.step].icon;
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                {STEPS[state.step].title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {state.step === 0 && (
                <StepPersonal
                  form={state.form.personalInfo}
                  setField={(name) => setField("personalInfo", name)}
                  errors={validationErrors}
                />
              )}
              {state.step === 1 && (
                <StepAcademic
                  form={state.form.academicInfo}
                  setField={(name) => setField("academicInfo", name)}
                />
              )}
              {state.step === 2 && (
                <StepDocuments
                  motivation={state.form.motivation}
                  setMotivation={setField(null, "motivation")}
                  selected={state.form.documents}
                  credentials={credentials}
                  onToggle={(cred) =>
                    dispatch({ type: "toggleDocument", credential: cred })
                  }
                />
              )}
              {state.step === 3 && (
                <StepReview form={state.form} scholarship={scholarship} />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={state.step === 0}
            className="gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </Button>

          <AutosaveBadge saving={saving} dirty={state.dirty} lastSavedAt={state.lastSavedAt} />

          {state.step < STEP_COUNT - 1 ? (
            <Button type="button" onClick={goNext} className="gap-1.5">
              {t("common.next")} <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="gap-1.5"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("wizard.submitting")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> {t("wizard.submit")}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

// ---------------------------------------------------------------------------
// Step bodies
// ---------------------------------------------------------------------------

const StepPersonal = ({ form, setField, errors }) => {
  const { t } = useTranslation();
  return (
  <div className="grid gap-4 sm:grid-cols-2">
    <Field label={t("wizard.fullName")} required error={errors["personalInfo.fullName"]}>
      <Input
        value={form.fullName}
        onChange={setField("fullName")}
        placeholder={t("wizard.fullNamePlaceholder")}
        autoComplete="name"
      />
    </Field>
    <Field label={t("wizard.phone")}>
      <Input
        type="tel"
        value={form.phone}
        onChange={setField("phone")}
        placeholder={t("wizard.phonePlaceholder")}
        autoComplete="tel"
      />
    </Field>
    <Field label={t("wizard.dob")}>
      <Input
        type="date"
        value={form.dateOfBirth}
        onChange={setField("dateOfBirth")}
      />
    </Field>
    <Field label={t("wizard.nationality")}>
      <Input
        value={form.nationality}
        onChange={setField("nationality")}
        placeholder={t("wizard.nationalityPlaceholder")}
      />
    </Field>
    <Field label={t("wizard.countryOfResidence")}>
      <Input
        value={form.country}
        onChange={setField("country")}
        placeholder={t("wizard.countryPlaceholder")}
        autoComplete="country-name"
      />
    </Field>
    <Field label={t("wizard.address")}>
      <Input
        value={form.address}
        onChange={setField("address")}
        placeholder={t("wizard.addressPlaceholder")}
        autoComplete="street-address"
      />
    </Field>
  </div>
  );
};

const StepAcademic = ({ form, setField }) => {
  const { t } = useTranslation();
  return (
  <div className="grid gap-4 sm:grid-cols-2">
    <Field label={t("wizard.currentLevel")}>
      <Input
        value={form.currentLevel}
        onChange={setField("currentLevel")}
        placeholder={t("wizard.currentLevelPlaceholder")}
      />
    </Field>
    <Field label={t("wizard.institution")}>
      <Input
        value={form.institution}
        onChange={setField("institution")}
        placeholder={t("wizard.institutionPlaceholder")}
      />
    </Field>
    <Field label={t("wizard.fieldOfStudy")}>
      <Input
        value={form.fieldOfStudy}
        onChange={setField("fieldOfStudy")}
        placeholder={t("wizard.fieldOfStudyPlaceholder")}
      />
    </Field>
    <Field label={t("wizard.gradePoint")}>
      <Input
        value={form.gradePoint}
        onChange={setField("gradePoint")}
        placeholder={t("wizard.gradePointPlaceholder")}
      />
    </Field>
    <Field
      label={t("wizard.expectedCompletion")}
      hint={t("wizard.expectedCompletionHint")}
    >
      <Input
        value={form.expectedCompletion}
        onChange={setField("expectedCompletion")}
        placeholder={t("wizard.expectedCompletionPlaceholder")}
      />
    </Field>
  </div>
  );
};

const StepDocuments = ({ motivation, setMotivation, selected, credentials, onToggle }) => {
  const { t } = useTranslation();
  const selectedIds = new Set(selected.map((d) => d.credentialId));
  return (
    <div className="space-y-5">
      <Field
        label={t("wizard.motivationLabel")}
        hint={t("wizard.motivationHint", { max: MOTIVATION_MAX })}
      >
        <textarea
          rows={8}
          maxLength={MOTIVATION_MAX}
          value={motivation}
          onChange={setMotivation}
          placeholder={t("wizard.motivationPlaceholder")}
          className="block w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-right text-[11px] text-muted">
          {motivation.length} / {MOTIVATION_MAX}
        </p>
      </Field>

      <div>
        <Label className="mb-1.5 block text-sm">
          {t("wizard.supportingDocuments")}{" "}
          <span className="text-xs font-normal text-muted">
            {t("wizard.supportingDocumentsHint")}
          </span>
        </Label>
        {credentials.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">
            {t("wizard.noCredentialsYet")}{" "}
            <Link
              to="/scholar/credentials"
              className="font-semibold text-primary hover:underline"
            >
              {t("wizard.uploadOneHere")}
            </Link>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {credentials.map((c) => {
              const cid = c.id || c._id;
              const checked = selectedIds.has(cid);
              return (
                <li key={cid}>
                  <label
                    className={[
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border bg-surface hover:border-primary/40",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onToggle({
                          credentialId: cid,
                          title: c.title || c.originalName || t("wizard.credentialFallbackTitle"),
                          type: c.type || "other",
                        })
                      }
                      className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {c.title || c.originalName}
                      </span>
                      <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                        {c.type ? t(`credentials.type${c.type.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")}`, { defaultValue: c.type.replace(/-/g, " ") }) : ""}
                        {c.verificationStatus && (
                          <Badge
                            variant={
                              c.verificationStatus === "verified"
                                ? "success"
                                : c.verificationStatus === "rejected"
                                  ? "danger"
                                  : "outline"
                            }
                            className="ml-1 px-1.5 py-0 text-[10px]"
                          >
                            {t(`credentials.status${c.verificationStatus.charAt(0).toUpperCase() + c.verificationStatus.slice(1)}`, { defaultValue: c.verificationStatus })}
                          </Badge>
                        )}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

const ReviewRow = ({ label, value }) => {
  const { t } = useTranslation();
  return (
  <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
    <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
    <span className="text-right text-sm font-semibold text-ink">
      {value || <em className="font-normal text-muted">{t("common.notProvided")}</em>}
    </span>
  </div>
  );
};

const StepReview = ({ form, scholarship }) => {
  const { t } = useTranslation();
  return (
  <div className="space-y-5">
    <Alert variant="info">
      <AlertTitle>{t("wizard.finalCheckTitle")}</AlertTitle>
      <AlertDescription>
        {t("wizard.finalCheckBody")}
      </AlertDescription>
    </Alert>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{t("wizard.sectionScholarship")}</h3>
      <ReviewRow label={t("wizard.reviewTitle")} value={scholarship.title} />
      <ReviewRow label={t("wizard.reviewProvider")} value={scholarship.provider} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{t("wizard.sectionPersonal")}</h3>
      <ReviewRow label={t("wizard.fullName")} value={form.personalInfo.fullName} />
      <ReviewRow label={t("wizard.reviewPhone")} value={form.personalInfo.phone} />
      <ReviewRow label={t("wizard.dob")} value={form.personalInfo.dateOfBirth} />
      <ReviewRow label={t("wizard.nationality")} value={form.personalInfo.nationality} />
      <ReviewRow label={t("wizard.reviewCountry")} value={form.personalInfo.country} />
      <ReviewRow label={t("wizard.address")} value={form.personalInfo.address} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{t("wizard.sectionAcademic")}</h3>
      <ReviewRow label={t("wizard.reviewLevel")} value={form.academicInfo.currentLevel} />
      <ReviewRow label={t("wizard.institution")} value={form.academicInfo.institution} />
      <ReviewRow label={t("wizard.reviewField")} value={form.academicInfo.fieldOfStudy} />
      <ReviewRow label={t("wizard.reviewGrade")} value={form.academicInfo.gradePoint} />
      <ReviewRow label={t("wizard.expectedCompletion")} value={form.academicInfo.expectedCompletion} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{t("wizard.sectionMotivation")}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {form.motivation || (
          <em className="text-muted">{t("wizard.noMotivation")}</em>
        )}
      </p>
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">{t("wizard.sectionDocuments")}</h3>
      {form.documents.length === 0 ? (
        <p className="text-sm text-muted">{t("wizard.noDocuments")}</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {form.documents.map((d) => (
            <li
              key={d.credentialId}
              className="flex items-center gap-2 text-ink"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="font-semibold">{d.title}</span>
              <span className="text-xs text-muted">
                ({d.type ? t(`credentials.type${d.type.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")}`, { defaultValue: d.type.replace(/-/g, " ") }) : ""})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
  );
};

export default ApplicationWizardPage;
