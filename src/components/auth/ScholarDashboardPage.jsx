import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import ScholarDashboard from "./ScholarDashboard";
import DashboardLayout from "./DashboardLayout";

const ScholarDashboardPage = () => {
  const navigate = useNavigate();
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
      title={`Welcome, ${scholar.name.split(" ")[0]}`}
      subtitle="Your scholarship workspace"
      onSignOut={handleSignOut}
    >
      <ScholarDashboard
        profile={scholarProfile}
        onSaveProfile={updateScholarProfileDetails}
        isSubmitting={isSubmitting}
        profileStatus={profileStatus}
      />
    </DashboardLayout>
  );
};

export default ScholarDashboardPage;
