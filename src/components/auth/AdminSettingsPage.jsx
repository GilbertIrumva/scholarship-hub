import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  KeyRound,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";

const buildAdminForm = (settings) => ({
  name: settings?.admin?.name || "",
  email: settings?.admin?.email || "",
  department: settings?.admin?.department || "",
  departmentCode: settings?.admin?.departmentCode || "",
  twoFactorCode: settings?.admin?.twoFactorCode || "",
  password: "",
});

const buildScholarForm = (settings) => ({
  name: settings?.scholar?.name || "",
  email: settings?.scholar?.email || "",
  password: "",
});

const ScholarRow = ({ scholar, onSave, onDelete, busy }) => {
  const [form, setForm] = useState({
    name: scholar.name || "",
    email: scholar.email || "",
    password: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    setForm({ name: scholar.name || "", email: scholar.email || "", password: "" });
  }, [scholar.id, scholar.name, scholar.email]);

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) return setError("Name is required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Valid email required.");
    if (form.password.trim() && form.password.trim().length < 8)
      return setError("Password must be ≥ 8 characters.");

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    };
    const result = await onSave(scholar.id, payload);
    if (result?.ok) setForm((c) => ({ ...c, password: "" }));
  };

  const handleDelete = () => {
    if (!window.confirm(`Remove scholar account for ${scholar.email}?`)) return;
    onDelete(scholar.id);
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">
                Scholar #{scholar.id}
              </p>
              <p className="text-sm font-bold text-ink">{scholar.name || "Unnamed"}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>New password (optional)</Label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
              placeholder="Leave empty to keep current password"
              className="mt-1.5"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <span>Application: {scholar.applicationId ? `#${scholar.applicationId}` : "Not linked"}</span>
          <Button size="sm" onClick={handleSave} disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const {
    sessionToken,
    adminDashboard,
    credentialSettings,
    settingsStatus,
    loadSettings,
    saveSettings,
    isSubmitting,
    scholarsList,
    scholarsStatus,
    loadScholars,
    updateScholarCredentials,
    removeScholar,
    signOut,
  } = useAuth();

  const [adminForm, setAdminForm] = useState(() => buildAdminForm(credentialSettings));
  const [scholarForm, setScholarForm] = useState(() => buildScholarForm(credentialSettings));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!sessionToken) return;
    if (!credentialSettings) loadSettings();
    loadScholars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  useEffect(() => {
    if (credentialSettings) {
      setAdminForm(buildAdminForm(credentialSettings));
      setScholarForm(buildScholarForm(credentialSettings));
    }
  }, [credentialSettings]);

  useEffect(() => {
    if (settingsStatus?.message && settingsStatus.type) {
      if (settingsStatus.type === "error") toast.error(settingsStatus.message);
      else if (settingsStatus.type === "success") toast.success(settingsStatus.message);
    }
  }, [settingsStatus]);

  if (!sessionToken) return <Navigate to="/login/admin" replace />;

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  const validate = () => {
    const e = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!adminForm.name.trim()) e.adminName = "Required.";
    if (!adminForm.email.trim()) e.adminEmail = "Required.";
    else if (!emailPattern.test(adminForm.email)) e.adminEmail = "Invalid email.";
    else if (!adminForm.email.endsWith("@schooladmin.com"))
      e.adminEmail = "Must end with @schooladmin.com";
    if (!adminForm.department.trim()) e.department = "Required.";
    if (!adminForm.departmentCode.trim()) e.departmentCode = "Required.";
    if (!adminForm.twoFactorCode.trim()) e.twoFactorCode = "Required.";
    if (adminForm.password && adminForm.password.length < 8)
      e.adminPassword = "≥ 8 characters.";
    if (!scholarForm.name.trim()) e.scholarName = "Required.";
    if (!scholarForm.email.trim()) e.scholarEmail = "Required.";
    else if (!emailPattern.test(scholarForm.email)) e.scholarEmail = "Invalid email.";
    if (scholarForm.password && scholarForm.password.length < 8)
      e.scholarPassword = "≥ 8 characters.";
    if (
      adminForm.email.trim().toLowerCase() === scholarForm.email.trim().toLowerCase() &&
      adminForm.email.trim()
    )
      e.scholarEmail = "Must differ from admin email.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error("Please fix the highlighted fields.");
      return;
    }
    await saveSettings({
      admin: {
        name: adminForm.name.trim(),
        email: adminForm.email.trim().toLowerCase(),
        department: adminForm.department.trim(),
        departmentCode: adminForm.departmentCode.trim(),
        twoFactorCode: adminForm.twoFactorCode.trim(),
        ...(adminForm.password.trim() ? { password: adminForm.password } : {}),
      },
      scholar: {
        name: scholarForm.name.trim(),
        email: scholarForm.email.trim().toLowerCase(),
        ...(scholarForm.password.trim() ? { password: scholarForm.password } : {}),
      },
    });
  };

  if (!credentialSettings) {
    return (
      <DashboardLayout
        role="admin"
        user={adminDashboard?.admin}
        title="Settings"
        onSignOut={handleSignOut}
      >
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted">Loading settings…</CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title="Settings"
      subtitle="Manage admin and scholar credentials"
      onSignOut={handleSignOut}
      actions={
        <Button variant="outline" size="sm" onClick={loadSettings} disabled={isSubmitting}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Admin */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Admin account</CardTitle>
                  <CardDescription>Protected administrator credentials</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm((c) => ({ ...c, name: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.adminName && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">{errors.adminName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="admin-email" className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((c) => ({ ...c, email: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.adminEmail && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">{errors.adminEmail}</p>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="admin-dept">Department</Label>
                  <Input
                    id="admin-dept"
                    value={adminForm.department}
                    onChange={(e) => setAdminForm((c) => ({ ...c, department: e.target.value }))}
                    className="mt-1.5"
                  />
                  {errors.department && (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{errors.department}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="admin-deptcode">Department code</Label>
                  <Input
                    id="admin-deptcode"
                    value={adminForm.departmentCode}
                    onChange={(e) => setAdminForm((c) => ({ ...c, departmentCode: e.target.value }))}
                    className="mt-1.5"
                  />
                  {errors.departmentCode && (
                    <p className="mt-1 text-xs font-semibold text-rose-600">{errors.departmentCode}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="admin-2fa">2FA code</Label>
                <Input
                  id="admin-2fa"
                  value={adminForm.twoFactorCode}
                  onChange={(e) => setAdminForm((c) => ({ ...c, twoFactorCode: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.twoFactorCode && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">{errors.twoFactorCode}</p>
                )}
              </div>
              <div>
                <Label htmlFor="admin-pw" className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> New password (optional)
                </Label>
                <PasswordInput
                  id="admin-pw"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((c) => ({ ...c, password: e.target.value }))}
                  placeholder="Leave empty to keep current"
                  error={errors.adminPassword}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>

          {/* Scholar */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Primary scholar account</CardTitle>
                  <CardDescription>Default student sign-in</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="scholar-name">Name</Label>
                <Input
                  id="scholar-name"
                  value={scholarForm.name}
                  onChange={(e) => setScholarForm((c) => ({ ...c, name: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.scholarName && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">{errors.scholarName}</p>
                )}
              </div>
              <div>
                <Label htmlFor="scholar-email" className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </Label>
                <Input
                  id="scholar-email"
                  type="email"
                  value={scholarForm.email}
                  onChange={(e) => setScholarForm((c) => ({ ...c, email: e.target.value }))}
                  className="mt-1.5"
                />
                {errors.scholarEmail && (
                  <p className="mt-1 text-xs font-semibold text-rose-600">{errors.scholarEmail}</p>
                )}
              </div>
              <div>
                <Label htmlFor="scholar-pw" className="inline-flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" /> New password (optional)
                </Label>
                <PasswordInput
                  id="scholar-pw"
                  value={scholarForm.password}
                  onChange={(e) => setScholarForm((c) => ({ ...c, password: e.target.value }))}
                  placeholder="Leave empty to keep current"
                  error={errors.scholarPassword}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            Changes write to the backend immediately and apply on the next sign-in.
          </p>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? "Saving…" : "Save credential changes"}
          </Button>
        </div>
      </form>

      <Separator className="my-10" />

      {/* All scholars */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">All scholar accounts</h2>
              <p className="text-sm text-muted">
                Inspect and update every registered scholar in your tenant.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadScholars} disabled={isSubmitting}>
            <RefreshCcw className="h-4 w-4" />
            Reload
          </Button>
        </div>

        {scholarsStatus?.message && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {scholarsStatus.message}
          </div>
        )}

        {scholarsList?.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {scholarsList.map((scholar) => (
              <ScholarRow
                key={scholar.id}
                scholar={scholar}
                onSave={updateScholarCredentials}
                onDelete={removeScholar}
                busy={isSubmitting}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center text-sm text-muted">
              No scholar accounts found yet.
            </CardContent>
          </Card>
        )}
      </section>
    </DashboardLayout>
  );
};

export default AdminSettingsPage;
