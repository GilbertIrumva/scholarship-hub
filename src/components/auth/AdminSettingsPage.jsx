import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import TwoFactorAndSessionsPanel from "./shared/TwoFactorAndSessionsPanel";
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
  const { t } = useTranslation();
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
    if (!form.name.trim()) return setError(t("adminSettings.errNameReq"));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError(t("adminSettings.errValidEmail"));
    if (form.password.trim() && form.password.trim().length < 8)
      return setError(t("adminSettings.errPasswordMin"));

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    };
    const result = await onSave(scholar.id, payload);
    if (result?.ok) setForm((c) => ({ ...c, password: "" }));
  };

  const handleDelete = () => {
    if (!window.confirm(t("adminSettings.removeConfirm", { email: scholar.email }))) return;
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
                {t("adminSettings.scholarNumber", { id: scholar.id })}
              </p>
              <p className="text-sm font-bold text-ink">{scholar.name || t("adminSettings.unnamed")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleDelete} disabled={busy}>
            <Trash2 className="h-3.5 w-3.5" />
            {t("adminSettings.removeScholar")}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("adminSettings.fieldName")}</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>{t("adminSettings.fieldEmail")}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label>{t("adminSettings.labelNewPasswordOptional")}</Label>
            <PasswordInput
              value={form.password}
              onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
              placeholder={t("adminSettings.scholarPasswordPlaceholder")}
              className="mt-1.5"
            />
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>}
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
          <span>{t("adminSettings.applicationLine", { value: scholar.applicationId ? `#${scholar.applicationId}` : t("adminSettings.applicationNotLinked") })}</span>
          <Button size="sm" onClick={handleSave} disabled={busy}>
            <Save className="h-3.5 w-3.5" />
            {t("adminSettings.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const AdminSettingsPage = () => {
  const { t } = useTranslation();
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
    if (!adminForm.name.trim()) e.adminName = t("adminSettings.errRequired");
    if (!adminForm.email.trim()) e.adminEmail = t("adminSettings.errRequired");
    else if (!emailPattern.test(adminForm.email)) e.adminEmail = t("adminSettings.errInvalidEmail");
    else if (!adminForm.email.endsWith("@schooladmin.com"))
      e.adminEmail = t("adminSettings.errAdminDomain");
    if (!adminForm.department.trim()) e.department = t("adminSettings.errRequired");
    if (!adminForm.departmentCode.trim()) e.departmentCode = t("adminSettings.errRequired");
    if (!adminForm.twoFactorCode.trim()) e.twoFactorCode = t("adminSettings.errRequired");
    if (adminForm.password && adminForm.password.length < 8)
      e.adminPassword = t("adminSettings.err8Chars");
    if (!scholarForm.name.trim()) e.scholarName = t("adminSettings.errRequired");
    if (!scholarForm.email.trim()) e.scholarEmail = t("adminSettings.errRequired");
    else if (!emailPattern.test(scholarForm.email)) e.scholarEmail = t("adminSettings.errInvalidEmail");
    if (scholarForm.password && scholarForm.password.length < 8)
      e.scholarPassword = t("adminSettings.err8Chars");
    if (
      adminForm.email.trim().toLowerCase() === scholarForm.email.trim().toLowerCase() &&
      adminForm.email.trim()
    )
      e.scholarEmail = t("adminSettings.errDifferFromAdmin");
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) {
      toast.error(t("adminSettings.errFixHighlighted"));
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
        title={t("adminSettings.pageTitle")}
        onSignOut={handleSignOut}
      >
        <Card>
          <CardContent className="p-12 text-center text-sm text-muted">{t("adminSettings.loadingSettings")}</CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title={t("adminSettings.pageTitle")}
      subtitle={t("adminSettings.subtitle")}
      onSignOut={handleSignOut}
      actions={
        <Button variant="outline" size="sm" onClick={loadSettings} disabled={isSubmitting}>
          <RefreshCcw className="h-4 w-4" />
          {t("common.refresh")}
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
                  <CardTitle>{t("adminSettings.adminAccount")}</CardTitle>
                  <CardDescription>{t("adminSettings.adminAccountDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="admin-name">{t("adminSettings.fieldName")}</Label>
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
                  <Mail className="h-3.5 w-3.5" /> {t("adminSettings.fieldEmail")}
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
                  <Label htmlFor="admin-dept">{t("adminSettings.fieldDepartment")}</Label>
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
                  <Label htmlFor="admin-deptcode">{t("adminSettings.fieldDepartmentCode")}</Label>
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
                <Label htmlFor="admin-2fa">{t("adminSettings.field2fa")}</Label>
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
                  <KeyRound className="h-3.5 w-3.5" /> {t("adminSettings.fieldNewPasswordOptional")}
                </Label>
                <PasswordInput
                  id="admin-pw"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((c) => ({ ...c, password: e.target.value }))}
                  placeholder={t("adminSettings.passwordKeepCurrent")}
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
                  <CardTitle>{t("adminSettings.scholarAccount")}</CardTitle>
                  <CardDescription>{t("adminSettings.scholarAccountDesc")}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="scholar-name">{t("adminSettings.fieldName")}</Label>
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
                  <Mail className="h-3.5 w-3.5" /> {t("adminSettings.fieldEmail")}
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
                  <KeyRound className="h-3.5 w-3.5" /> {t("adminSettings.fieldNewPasswordOptional")}
                </Label>
                <PasswordInput
                  id="scholar-pw"
                  value={scholarForm.password}
                  onChange={(e) => setScholarForm((c) => ({ ...c, password: e.target.value }))}
                  placeholder={t("adminSettings.passwordKeepCurrent")}
                  error={errors.scholarPassword}
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {t("adminSettings.changesApply")}
          </p>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            <Save className="h-4 w-4" />
            {isSubmitting ? t("adminSettings.savingChanges") : t("adminSettings.saveChanges")}
          </Button>
        </div>
      </form>

      <Separator className="my-10" />

      {/* T3.4 — Security: 2FA + active sessions */}
      <section>
        <div className="flex items-center gap-3 pb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t("adminSettings.security")}</h2>
            <p className="text-sm text-muted">
              {t("adminSettings.securityDesc")}
            </p>
          </div>
        </div>
        <TwoFactorAndSessionsPanel sessionToken={sessionToken} principalKind="admin" />
      </section>

      <Separator className="my-10" />

      {/* All scholars */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">{t("adminSettings.allScholars")}</h2>
              <p className="text-sm text-muted">
                {t("adminSettings.allScholarsDesc")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={loadScholars} disabled={isSubmitting}>
            <RefreshCcw className="h-4 w-4" />
            {t("admin.reload")}
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
              {t("adminSettings.noScholars")}
            </CardContent>
          </Card>
        )}
      </section>
    </DashboardLayout>
  );
};

export default AdminSettingsPage;
