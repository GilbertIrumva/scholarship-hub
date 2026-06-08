import { Navigate, Route, Routes } from "react-router-dom";
import LandingPage from "./components/Landing/LandingPage";
import RoleLandingPage from "./components/auth/RoleLandingPage";
import LoginPage from "./components/auth/LoginPage";
import SignupPage from "./components/auth/SignupPage";
import AdminDashboardPage from "./components/auth/AdminDashboardPage";
import AdminSettingsPage from "./components/auth/AdminSettingsPage";
import AdminApplicantsPage from "./components/auth/AdminApplicantsPage";
import AdminApplicantDetailPage from "./components/auth/AdminApplicantDetailPage";
import AdminMessagesPage from "./components/auth/AdminMessagesPage";
import ScholarDashboardPage from "./components/auth/ScholarDashboardPage";
import ScholarshipsPage from "./components/scholar/ScholarshipsPage";
import ScholarshipDetailPage from "./components/scholar/ScholarshipDetailPage";
import MyApplicationsPage from "./components/scholar/MyApplicationsPage";
import GradeConverterPage from "./components/GradeConverter/GradeConverterPage";
import LegalPage from "./components/LegalPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/get-started" element={<RoleLandingPage />} />
      <Route path="/grade-converter" element={<GradeConverterPage />} />

      {/* Unified auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

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
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/admin/applicants" element={<AdminApplicantsPage />} />
      <Route path="/admin/applicants/:id" element={<AdminApplicantDetailPage />} />
      <Route path="/admin/messages" element={<AdminMessagesPage />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/privacy" element={<LegalPage variant="privacy" />} />
      <Route path="/terms" element={<LegalPage variant="terms" />} />
      <Route path="/accessibility" element={<LegalPage variant="accessibility" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
