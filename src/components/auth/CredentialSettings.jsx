import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  FileCheck2,
  KeyRound,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";

const inputClass =
  "mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 outline-none transition placeholder:text-emerald-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

const createFormState = (settings) => ({
  adminName: settings?.admin?.name || "",
  adminEmail: settings?.admin?.email || "",
  adminDepartment: settings?.admin?.department || "",
  adminDepartmentCode: settings?.admin?.departmentCode || "",
  adminTwoFactorCode: settings?.admin?.twoFactorCode || "",
  adminPassword: "",
  scholarName: settings?.scholar?.name || "",
  scholarEmail: settings?.scholar?.email || "",
  scholarPassword: "",
});

const statusStyles = {
  error: "border-emerald-200 bg-emerald-50 text-emerald-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  idle: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

const ScholarRow = ({ scholar, onSave, onDelete, isSubmitting, t }) => {
  const [name, setName] = useState(scholar.name || "");
  const [email, setEmail] = useState(scholar.email || "");
  const [password, setPassword] = useState("");
  const [rowError, setRowError] = useState("");

  useEffect(() => {
    setName(scholar.name || "");
    setEmail(scholar.email || "");
    setPassword("");
  }, [scholar.id, scholar.name, scholar.email]);

  const handleSave = async () => {
    setRowError("");
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) {
      setRowError(t("settings.errRowName"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setRowError(t("settings.errRowEmailInvalid"));
      return;
    }
    if (password.trim() && password.trim().length < 8) {
      setRowError(t("settings.errRowPasswordMin"));
      return;
    }

    const payload = {
      name: trimmedName,
      email: trimmedEmail,
      ...(password.trim() ? { password: password.trim() } : {}),
    };
    const result = await onSave(scholar.id, payload);
    if (result?.ok) setPassword("");
  };

  const handleDelete = async () => {
    if (!window.confirm(t("settings.removeConfirm", { email: scholar.email }))) return;
    await onDelete(scholar.id);
  };

  return (
    <article className="rounded-3xl border border-emerald-200/70 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-700">
            <UserRound size={18} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">{t("settings.scholarRowEyebrow", { id: scholar.id })}</p>
            <p className="text-sm font-semibold text-emerald-900">{scholar.name || t("settings.scholarRowUnnamed")}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={14} />
          {t("settings.removeScholar")}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">{t("settings.rowFieldName")}</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
            <Mail size={12} /> {t("settings.rowFieldEmail")}
          </span>
          <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
            <KeyRound size={12} /> {t("settings.rowFieldNewPassword")}
          </span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("settings.rowPasswordKeep")}
          />
        </label>
      </div>

      {rowError ? <p className="mt-3 text-sm text-emerald-600">{rowError}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-500">
        <span>
          {t("settings.rowApplicationPrefix")}
          {scholar.applicationId ? `#${scholar.applicationId}` : t("settings.rowApplicationNotLinked")}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500 bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={14} />
          {t("settings.saveButton")}
        </button>
      </div>
    </article>
  );
};

const CredentialSettings = ({
  isSubmitting,
  onBack,
  onSave,
  settings,
  status,
  scholars,
  scholarsStatus,
  onLoadScholars,
  onUpdateScholar,
  onDeleteScholar,
}) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => createFormState(settings));
  const [errors, setErrors] = useState({});

  const featureCards = useMemo(() => [
    {
      title: t("settings.featureAdminTitle"),
      text: t("settings.featureAdminText"),
      icon: <ShieldCheck size={16} className="text-emerald-600" />,
    },
    {
      title: t("settings.featurePrimaryScholarTitle"),
      text: t("settings.featurePrimaryScholarText"),
      icon: <UserRound size={16} className="text-emerald-600" />,
    },
    {
      title: t("settings.featureAllScholarsTitle"),
      text: t("settings.featureAllScholarsText"),
      icon: <Users size={16} className="text-emerald-600" />,
    },
  ], [t]);

  useEffect(() => {
    if (onLoadScholars) onLoadScholars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
  };

  const validate = () => {
    const nextErrors = {};
    const adminEmail = form.adminEmail.trim().toLowerCase();
    const scholarEmail = form.scholarEmail.trim().toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.adminName.trim()) nextErrors.adminName = t("settings.errAdminNameRequired");
    if (!adminEmail) nextErrors.adminEmail = t("settings.errAdminEmailRequired");
    else if (!emailPattern.test(adminEmail)) nextErrors.adminEmail = t("settings.errAdminEmailInvalid");
    else if (!adminEmail.endsWith("@schooladmin.com"))
      nextErrors.adminEmail = t("settings.errAdminEmailDomain");

    if (!form.adminDepartment.trim()) nextErrors.adminDepartment = t("settings.errDepartmentRequired");
    if (!form.adminDepartmentCode.trim()) nextErrors.adminDepartmentCode = t("settings.errDepartmentCodeRequired");
    if (!form.adminTwoFactorCode.trim()) nextErrors.adminTwoFactorCode = t("settings.err2faRequired");
    if (form.adminPassword.trim() && form.adminPassword.trim().length < 8)
      nextErrors.adminPassword = t("settings.errPasswordMin");

    if (!form.scholarName.trim()) nextErrors.scholarName = t("settings.errScholarNameRequired");
    if (!scholarEmail) nextErrors.scholarEmail = t("settings.errScholarEmailRequired");
    else if (!emailPattern.test(scholarEmail)) nextErrors.scholarEmail = t("settings.errScholarEmailInvalid");

    if (form.scholarPassword.trim() && form.scholarPassword.trim().length < 8)
      nextErrors.scholarPassword = t("settings.errPasswordMin");

    if (adminEmail && scholarEmail && adminEmail === scholarEmail)
      nextErrors.scholarEmail = t("settings.errScholarEmailDuplicate");

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const nextSettings = await onSave({
      admin: {
        name: form.adminName.trim(),
        email: form.adminEmail.trim().toLowerCase(),
        department: form.adminDepartment.trim(),
        departmentCode: form.adminDepartmentCode.trim(),
        twoFactorCode: form.adminTwoFactorCode.trim(),
        ...(form.adminPassword.trim() ? { password: form.adminPassword } : {}),
      },
      scholar: {
        name: form.scholarName.trim(),
        email: form.scholarEmail.trim().toLowerCase(),
        ...(form.scholarPassword.trim() ? { password: form.scholarPassword } : {}),
      },
    });

    if (nextSettings) {
      setForm(createFormState(nextSettings));
      setErrors({});
    }
  };

  if (!settings) return null;

  const statusType = status?.type || "idle";
  const statusMessage =
    status?.message ||
    t("settings.statusIdleMessage");

  const scholarsStatusType = scholarsStatus?.type || "idle";

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-[36px] border border-emerald-950/10 bg-[#f4fcf5] text-emerald-900 shadow-[0_40px_120px_rgba(34,197,94,0.16)]">
      <div className="absolute inset-0 bg-emerald-100/70" />
      <div className="relative grid min-h-[calc(100vh-4rem)] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-emerald-950/10 px-6 py-6 sm:px-8 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
          <div className="flex h-full flex-col">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 shadow-sm">
                <FileCheck2 size={14} />
                {t("settings.credEyebrow")}
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-emerald-950">{t("settings.credTitle")}</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-600">
                {t("settings.credSubtitle")}
              </p>
            </div>

            <div className="mt-8 space-y-3">
              {featureCards.map((item) => (
                <article key={item.title} className="rounded-3xl border border-emerald-200/70 bg-white/80 p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    {item.icon}
                    {item.title}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-emerald-600">{item.text}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-[28px] border border-emerald-300/50 bg-emerald-50 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t("settings.updateBehaviorTitle")}</p>
              <div className="mt-4 space-y-3 text-sm text-emerald-900/90">
                <p>{t("settings.updateBehavior1")}</p>
                <p>{t("settings.updateBehavior2")}</p>
                <p>{t("settings.updateBehavior3")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <ArrowLeft size={16} />
              {t("settings.backToDashboard")}
            </button>
          </div>
        </aside>

        <div className="px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
          <header className="border-b border-emerald-950/10 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-700">{t("settings.credManagementEyebrow")}</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
              {t("settings.credManagementTitle")}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-600 sm:text-lg">
              {t("settings.credManagementSubtitle")}
            </p>
          </header>

          <form className="space-y-6 pt-6" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-6 xl:grid-cols-2">
              <article className="rounded-[32px] border border-emerald-200/70 bg-white/85 p-6 shadow-[0_22px_60px_rgba(34,197,94,0.12)] sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-500 p-3 text-white shadow-sm">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-500">{t("settings.adminAccessEyebrow")}</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-emerald-950">{t("settings.adminAccessTitle")}</h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-emerald-700">{t("settings.fieldAdminName")}</span>
                    <input className={inputClass} name="adminName" value={form.adminName} onChange={handleChange} />
                    {errors.adminName ? <p className="mt-2 text-sm text-emerald-600">{errors.adminName}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <Mail size={14} />
                      {t("settings.fieldAdminEmail")}
                    </span>
                    <input className={inputClass} name="adminEmail" value={form.adminEmail} onChange={handleChange} />
                    {errors.adminEmail ? <p className="mt-2 text-sm text-emerald-600">{errors.adminEmail}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-emerald-700">{t("settings.fieldDepartment")}</span>
                    <input className={inputClass} name="adminDepartment" value={form.adminDepartment} onChange={handleChange} />
                    {errors.adminDepartment ? <p className="mt-2 text-sm text-emerald-600">{errors.adminDepartment}</p> : null}
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">{t("settings.fieldDepartmentCode")}</span>
                    <input className={inputClass} name="adminDepartmentCode" value={form.adminDepartmentCode} onChange={handleChange} />
                    {errors.adminDepartmentCode ? <p className="mt-2 text-sm text-emerald-600">{errors.adminDepartmentCode}</p> : null}
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">{t("settings.fieldTwoFactorCode")}</span>
                    <input className={inputClass} name="adminTwoFactorCode" value={form.adminTwoFactorCode} onChange={handleChange} />
                    {errors.adminTwoFactorCode ? <p className="mt-2 text-sm text-emerald-600">{errors.adminTwoFactorCode}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <KeyRound size={14} />
                      {t("settings.fieldNewAdminPassword")}
                    </span>
                    <input
                      className={inputClass}
                      name="adminPassword"
                      type="password"
                      value={form.adminPassword}
                      onChange={handleChange}
                      placeholder={t("settings.passwordKeepCurrent")}
                    />
                    {errors.adminPassword ? <p className="mt-2 text-sm text-emerald-600">{errors.adminPassword}</p> : null}
                  </label>
                </div>
              </article>

              <article className="rounded-[32px] border border-emerald-200/70 bg-white/85 p-6 shadow-[0_22px_60px_rgba(34,197,94,0.12)] sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl border border-emerald-300 bg-emerald-500 p-3 text-white shadow-sm">
                    <UserRound size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-500">{t("settings.scholarAccessEyebrow")}</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-emerald-950">{t("settings.scholarAccessTitle")}</h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">{t("settings.fieldScholarName")}</span>
                    <input className={inputClass} name="scholarName" value={form.scholarName} onChange={handleChange} />
                    {errors.scholarName ? <p className="mt-2 text-sm text-emerald-600">{errors.scholarName}</p> : null}
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <Mail size={14} />
                      {t("settings.fieldScholarEmail")}
                    </span>
                    <input className={inputClass} name="scholarEmail" value={form.scholarEmail} onChange={handleChange} />
                    {errors.scholarEmail ? <p className="mt-2 text-sm text-emerald-600">{errors.scholarEmail}</p> : null}
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <KeyRound size={14} />
                      {t("settings.fieldNewScholarPassword")}
                    </span>
                    <input
                      className={inputClass}
                      name="scholarPassword"
                      type="password"
                      value={form.scholarPassword}
                      onChange={handleChange}
                      placeholder={t("settings.passwordKeepCurrent")}
                    />
                    {errors.scholarPassword ? <p className="mt-2 text-sm text-emerald-600">{errors.scholarPassword}</p> : null}
                  </label>
                </div>
              </article>
            </div>

            <div className={`rounded-3xl border px-5 py-4 text-sm ${statusStyles[statusType] || statusStyles.idle}`}>
              {statusMessage}
            </div>

            <div className="flex flex-col gap-3 border-t border-emerald-950/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-500">
                {t("settings.footerNote")}
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {isSubmitting ? t("settings.savingChanges") : t("settings.saveCredentialChanges")}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-emerald-950/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-700">{t("settings.allScholarsEyebrow")}</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-emerald-950 sm:text-3xl">
                  {t("settings.allScholarsTitle")}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-600">
                  {t("settings.allScholarsSubtitle")}
                </p>
              </div>
              <button
                type="button"
                onClick={onLoadScholars}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw size={14} />
                {t("settings.refreshList")}
              </button>
            </div>

            {scholarsStatus?.message ? (
              <div
                className={`mt-4 rounded-3xl border px-5 py-4 text-sm ${statusStyles[scholarsStatusType] || statusStyles.idle}`}
              >
                {scholarsStatus.message}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {scholars && scholars.length > 0 ? (
                scholars.map((scholar) => (
                  <ScholarRow
                    key={scholar.id}
                    scholar={scholar}
                    onSave={onUpdateScholar}
                    onDelete={onDeleteScholar}
                    isSubmitting={isSubmitting}
                    t={t}
                  />
                ))
              ) : (
                <p className="rounded-3xl border border-emerald-200/70 bg-white p-5 text-sm text-emerald-600">
                  {t("settings.noScholars")}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};

export default CredentialSettings;
