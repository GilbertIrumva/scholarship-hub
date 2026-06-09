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

const STEPS = [
  { id: "personal", title: "Personal info", icon: User },
  { id: "academic", title: "Academic background", icon: GraduationCap },
  { id: "documents", title: "Motivation & documents", icon: FileText },
  { id: "review", title: "Review & submit", icon: ShieldCheck },
];

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

const StepIndicator = ({ current, total, onJump, completed }) => {
  const pct = Math.round(((current + 1) / total) * 100);
  return (
    <div className="space-y-3">
      <Progress value={pct} aria-label={`Step ${current + 1} of ${total}`} />
      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((s, i) => {
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
                  <span className="hidden sm:inline">Step {i + 1}: </span>
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
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
        <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
        Saving…
      </span>
    );
  }
  if (dirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <CloudUpload className="h-3.5 w-3.5" />
        Unsaved changes
      </span>
    );
  }
  if (lastSavedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Saved {new Date(lastSavedAt).toLocaleTimeString()}
      </span>
    );
  }
  return null;
};

const ApplicationWizardPage = () => {
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
          setLoadError("Scholarship not found or no longer active.");
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
          step: Math.min(seeded.lastStep || 0, STEPS.length - 1),
        });
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Failed to load application.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionToken, id, scholarProfile]);

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
        toast.error(err?.response?.data?.message || "Could not auto-save draft.");
      } finally {
        setSaving(false);
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [state.dirty, state.form, state.step, sessionToken, id, alreadySubmitted, loading]);

  // Field helpers ----------------------------------------------------------
  const setField = (section, name) => (e) => {
    const value = e && e.target ? e.target.value : e;
    dispatch({ type: "field", section, name, value });
  };

  const validateStep = (stepIndex) => {
    const errors = {};
    if (stepIndex === 0) {
      if (!state.form.personalInfo.fullName.trim()) {
        errors["personalInfo.fullName"] = "Full name is required.";
      }
    }
    // Other steps stay friendly — optional fields throughout.
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(state.step);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      toast.error("Please correct the highlighted fields.");
      return;
    }
    setValidationErrors({});
    dispatch({ type: "setStep", step: Math.min(state.step + 1, STEPS.length - 1) });
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
      toast.error("Please complete the required fields before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      await submitApplicationWizard(sessionToken, id, {
        ...state.form,
        lastStep: STEPS.length - 1,
      });
      toast.success("Application submitted!");
      navigate("/scholar/applications", { replace: true });
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Could not submit application."
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
        title="Application"
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
        title="Application"
        onSignOut={handleSignOut}
      >
        <Alert variant="danger">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to="/scholar/scholarships">
              <ArrowLeft className="h-4 w-4" /> Back to scholarships
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
        title="Already submitted"
        onSignOut={handleSignOut}
      >
        <Card>
          <CardContent className="flex flex-col items-center text-center py-12">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-bold text-ink">
              Your application has already been submitted.
            </h2>
            <p className="mt-1 text-sm text-muted">
              You can track its status from "My applications".
            </p>
            <div className="mt-6 flex gap-2">
              <Button asChild variant="outline">
                <Link to={`/scholar/scholarships/${id}`}>View scholarship</Link>
              </Button>
              <Button asChild>
                <Link to="/scholar/applications">My applications</Link>
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
        title="Scholarship closed"
        onSignOut={handleSignOut}
      >
        <Alert variant="warning">
          <AlertTitle>Applications are closed</AlertTitle>
          <AlertDescription>
            The deadline for this scholarship has already passed.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link to={`/scholar/scholarships/${id}`}>
              <ArrowLeft className="h-4 w-4" /> Back to scholarship
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
      title={`Apply: ${scholarship.title}`}
      subtitle={scholarship.provider || "Multi-step application"}
      onSignOut={handleSignOut}
    >
      <div className="space-y-5">
        <Link
          to={`/scholar/scholarships/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to scholarship details
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
              total={STEPS.length}
              onJump={jumpTo}
              completed={visitedSteps.current}
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
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          <AutosaveBadge saving={saving} dirty={state.dirty} lastSavedAt={state.lastSavedAt} />

          {state.step < STEPS.length - 1 ? (
            <Button type="button" onClick={goNext} className="gap-1.5">
              Next <ArrowRight className="h-4 w-4" />
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Submit application
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

const StepPersonal = ({ form, setField, errors }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <Field label="Full name" required error={errors["personalInfo.fullName"]}>
      <Input
        value={form.fullName}
        onChange={setField("fullName")}
        placeholder="As it appears on your ID"
        autoComplete="name"
      />
    </Field>
    <Field label="Phone number">
      <Input
        type="tel"
        value={form.phone}
        onChange={setField("phone")}
        placeholder="+250 700 000 000"
        autoComplete="tel"
      />
    </Field>
    <Field label="Date of birth">
      <Input
        type="date"
        value={form.dateOfBirth}
        onChange={setField("dateOfBirth")}
      />
    </Field>
    <Field label="Nationality">
      <Input
        value={form.nationality}
        onChange={setField("nationality")}
        placeholder="Rwandan"
      />
    </Field>
    <Field label="Country of residence">
      <Input
        value={form.country}
        onChange={setField("country")}
        placeholder="Rwanda"
        autoComplete="country-name"
      />
    </Field>
    <Field label="Address">
      <Input
        value={form.address}
        onChange={setField("address")}
        placeholder="City, neighborhood"
        autoComplete="street-address"
      />
    </Field>
  </div>
);

const StepAcademic = ({ form, setField }) => (
  <div className="grid gap-4 sm:grid-cols-2">
    <Field label="Current level">
      <Input
        value={form.currentLevel}
        onChange={setField("currentLevel")}
        placeholder="Undergraduate, Masters, PhD…"
      />
    </Field>
    <Field label="Institution">
      <Input
        value={form.institution}
        onChange={setField("institution")}
        placeholder="University of …"
      />
    </Field>
    <Field label="Field of study">
      <Input
        value={form.fieldOfStudy}
        onChange={setField("fieldOfStudy")}
        placeholder="Computer Science"
      />
    </Field>
    <Field label="Grade / GPA">
      <Input
        value={form.gradePoint}
        onChange={setField("gradePoint")}
        placeholder="e.g. 3.8 / 4.0"
      />
    </Field>
    <Field
      label="Expected completion"
      hint="Year or month/year"
    >
      <Input
        value={form.expectedCompletion}
        onChange={setField("expectedCompletion")}
        placeholder="2027 or Jun 2027"
      />
    </Field>
  </div>
);

const StepDocuments = ({ motivation, setMotivation, selected, credentials, onToggle }) => {
  const selectedIds = new Set(selected.map((d) => d.credentialId));
  return (
    <div className="space-y-5">
      <Field
        label="Why are you a great fit?"
        hint={`up to ${MOTIVATION_MAX} characters`}
      >
        <textarea
          rows={8}
          maxLength={MOTIVATION_MAX}
          value={motivation}
          onChange={setMotivation}
          placeholder="Tell the reviewer about your goals, achievements, and why this scholarship matters to you."
          className="block w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1 text-right text-[11px] text-muted">
          {motivation.length} / {MOTIVATION_MAX}
        </p>
      </Field>

      <div>
        <Label className="mb-1.5 block text-sm">
          Supporting documents{" "}
          <span className="text-xs font-normal text-muted">
            (optional — pick from your saved credentials)
          </span>
        </Label>
        {credentials.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted">
            You haven't uploaded any credentials yet.{" "}
            <Link
              to="/scholar/credentials"
              className="font-semibold text-primary hover:underline"
            >
              Upload one here →
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
                          title: c.title || c.originalName || "Credential",
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
                        {c.type?.replace(/-/g, " ")}
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
                            {c.verificationStatus}
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

const ReviewRow = ({ label, value }) => (
  <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-b-0">
    <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
    <span className="text-right text-sm font-semibold text-ink">
      {value || <em className="font-normal text-muted">Not provided</em>}
    </span>
  </div>
);

const StepReview = ({ form, scholarship }) => (
  <div className="space-y-5">
    <Alert variant="info">
      <AlertTitle>Final check</AlertTitle>
      <AlertDescription>
        Once submitted, you won't be able to edit this application. Drafts are
        auto-saved as you go.
      </AlertDescription>
    </Alert>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">Scholarship</h3>
      <ReviewRow label="Title" value={scholarship.title} />
      <ReviewRow label="Provider" value={scholarship.provider} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">Personal info</h3>
      <ReviewRow label="Full name" value={form.personalInfo.fullName} />
      <ReviewRow label="Phone" value={form.personalInfo.phone} />
      <ReviewRow label="Date of birth" value={form.personalInfo.dateOfBirth} />
      <ReviewRow label="Nationality" value={form.personalInfo.nationality} />
      <ReviewRow label="Country" value={form.personalInfo.country} />
      <ReviewRow label="Address" value={form.personalInfo.address} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">Academic background</h3>
      <ReviewRow label="Level" value={form.academicInfo.currentLevel} />
      <ReviewRow label="Institution" value={form.academicInfo.institution} />
      <ReviewRow label="Field" value={form.academicInfo.fieldOfStudy} />
      <ReviewRow label="Grade" value={form.academicInfo.gradePoint} />
      <ReviewRow label="Expected completion" value={form.academicInfo.expectedCompletion} />
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">Motivation</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {form.motivation || (
          <em className="text-muted">No motivation statement provided.</em>
        )}
      </p>
    </div>

    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm font-bold text-ink">Selected documents</h3>
      {form.documents.length === 0 ? (
        <p className="text-sm text-muted">No documents attached.</p>
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
                ({d.type?.replace(/-/g, " ")})
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);

export default ApplicationWizardPage;
