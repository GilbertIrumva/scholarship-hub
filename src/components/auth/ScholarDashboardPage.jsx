import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/useAuth";
import ScholarDashboard from "./ScholarDashboard";
import DashboardLayout from "./DashboardLayout";

const ScholarDashboardPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    scholarProfile,
    sessionToken,
    signOut,
    updateScholarProfileDetails,
    isSubmitting,
    profileStatus,
  } = useAuth();

  if (!sessionToken || !scholarProfile) {
    return <Navigate to="/login?role=scholar" replace />;
  }

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const scholar = scholarProfile.scholar;

  return (
    <DashboardLayout
      role="scholar"
      user={{ name: scholar.name, email: scholar.email, role: scholar.role }}
      title={t("layout.welcomeShort", { firstName: scholar.name.split(" ")[0] })}
      subtitle={t("layout.scholarSubtitle")}
      onSignOut={handleSignOut}
    >
      <ScholarDashboard
        profile={scholarProfile}
        onSaveProfile={updateScholarProfileDetails}
        isSubmitting={isSubmitting}
        profileStatus={profileStatus}
        sessionToken={sessionToken}
      />
    </DashboardLayout>
  );
};

export default ScholarDashboardPage;
