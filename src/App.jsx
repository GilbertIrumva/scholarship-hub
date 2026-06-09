import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./components/Landing/LandingPage";

// Keep Landing eager (first paint).
// Lazy-load everything else so each route group ships as its own chunk.
const RoleLandingPage = lazy(() => import("./components/auth/RoleLandingPage"));
const GradeConverterPage = lazy(() => import("./components/GradeConverter/GradeConverterPage"));
const LegalPage = lazy(() => import("./components/LegalPage"));

// Auth
const LoginPage = lazy(() => import("./components/auth/LoginPage"));
const SignupPage = lazy(() => import("./components/auth/SignupPage"));
const VerifyEmailPage = lazy(() => import("./components/auth/VerifyEmailPage"));
const ForgotPasswordPage = lazy(() => import("./components/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./components/auth/ResetPasswordPage"));

// Admin
const AdminDashboardPage = lazy(() => import("./components/auth/AdminDashboardPage"));
const AdminSettingsPage = lazy(() => import("./components/auth/AdminSettingsPage"));
const AdminApplicantsPage = lazy(() => import("./components/auth/AdminApplicantsPage"));
const AdminApplicantDetailPage = lazy(() => import("./components/auth/AdminApplicantDetailPage"));
const AdminMessagesPage = lazy(() => import("./components/auth/AdminMessagesPage"));
const AdminAuditLogPage = lazy(() => import("./components/auth/AdminAuditLogPage"));
const AdminCredentialsPage = lazy(() => import("./components/auth/AdminCredentialsPage"));
const AdminVisaTrackerPage = lazy(() => import("./components/auth/AdminVisaTrackerPage"));

// Scholar
const ScholarDashboardPage = lazy(() => import("./components/auth/ScholarDashboardPage"));
const ScholarshipsPage = lazy(() => import("./components/scholar/ScholarshipsPage"));
const ScholarshipDetailPage = lazy(() => import("./components/scholar/ScholarshipDetailPage"));
const MyApplicationsPage = lazy(() => import("./components/scholar/MyApplicationsPage"));
const CredentialsPage = lazy(() => import("./components/scholar/CredentialsPage"));
const TravelDocsPage = lazy(() => import("./components/scholar/TravelDocsPage"));
const VisaTrackerPage = lazy(() => import("./components/scholar/VisaTrackerPage"));

const RouteFallback = () => (
  <div
    role="status"
    aria-live="polite"
    className="flex min-h-screen items-center justify-center bg-white"
  >
    <div className="flex flex-col items-center gap-3 text-emerald-700">
      <span className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
      <span className="text-sm font-semibold tracking-wide">Loading…</span>
    </div>
  </div>
);

const App = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/get-started" element={<RoleLandingPage />} />
        <Route path="/grade-converter" element={<GradeConverterPage />} />

        {/* Unified auth */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Backward-compatible redirects to the unified pages */}
        <Route path="/login/scholar" element={<Navigate to="/login" replace />} />
        <Route path="/login/admin" element={<Navigate to="/login" replace />} />
        <Route path="/login/admin/verify" element={<Navigate to="/login" replace />} />
        <Route path="/signup/scholar" element={<Navigate to="/signup" replace />} />
        <Route path="/signup/admin" element={<Navigate to="/signup" replace />} />

        <Route path="/scholar" element={<ScholarDashboardPage />} />
        <Route path="/scholar/scholarships" element={<ScholarshipsPage />} />
        <Route path="/scholar/scholarships/:id" element={<ScholarshipDetailPage />} />
        <Route path="/scholar/applications" element={<MyApplicationsPage />} />
        <Route path="/scholar/credentials" element={<CredentialsPage />} />
        <Route path="/scholar/travel-docs" element={<TravelDocsPage />} />
        <Route path="/scholar/visa-tracker" element={<VisaTrackerPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/applicants" element={<AdminApplicantsPage />} />
        <Route path="/admin/applicants/:id" element={<AdminApplicantDetailPage />} />
        <Route path="/admin/messages" element={<AdminMessagesPage />} />
        <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
        <Route path="/admin/credentials" element={<AdminCredentialsPage />} />
        <Route path="/admin/visa-tracker" element={<AdminVisaTrackerPage />} />
        <Route path="/admin/settings" element={<AdminSettingsPage />} />
        <Route path="/privacy" element={<LegalPage variant="privacy" />} />
        <Route path="/terms" element={<LegalPage variant="terms" />} />
        <Route path="/accessibility" element={<LegalPage variant="accessibility" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
