import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";
import AdminVisaSnapshot from "./AdminVisaSnapshot";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";

const AdminDashboardPage = () => {
  const navigate = useNavigate();
  const {
    adminDashboard,
    isSubmitting,
    refreshAdminDashboard,
    loadSettings,
    signOut,
    sessionToken,
  } = useAuth();

  useEffect(() => {
    if (!sessionToken || adminDashboard) return;
    refreshAdminDashboard();
  }, [sessionToken, adminDashboard, refreshAdminDashboard]);

  if (!sessionToken || !adminDashboard) {
    return <Navigate to="/login/admin" replace />;
  }

  const handleOpenSettings = async () => {
    const result = await loadSettings();
    if (result.ok) navigate("/admin/settings");
  };

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard.admin}
      title="Dashboard Overview"
      subtitle="Operations console for admissions"
      onSignOut={handleSignOut}
    >
      <AdminDashboard
        dashboard={adminDashboard}
        isRefreshing={isSubmitting}
        onOpenSettings={handleOpenSettings}
        onRefresh={refreshAdminDashboard}
      />
      <div className="mt-6">
        <AdminVisaSnapshot sessionToken={sessionToken} />
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboardPage;
