import { useEffect, useState } from "react";
import {
  ArrowLeft,
  KeyRound,
  Mail,
  RefreshCcw,
  Save,
  ShieldCheck,
  Sparkles,
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

const ScholarRow = ({ scholar, onSave, onDelete, isSubmitting }) => {
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
      setRowError("Name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setRowError("Enter a valid email.");
      return;
    }
    if (password.trim() && password.trim().length < 8) {
      setRowError("Password must be at least 8 characters.");
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
    if (!window.confirm(`Remove scholar account for ${scholar.email}?`)) return;
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500">Scholar #{scholar.id}</p>
            <p className="text-sm font-semibold text-emerald-900">{scholar.name || "Unnamed"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={14} />
          Remove
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">Name</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
            <Mail size={12} /> Email
          </span>
          <input className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
            <KeyRound size={12} /> New Password
          </span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Leave empty to keep current password"
          />
        </label>
      </div>

      {rowError ? <p className="mt-3 text-sm text-emerald-600">{rowError}</p> : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-emerald-500">
        <span>Application: {scholar.applicationId ? `#${scholar.applicationId}` : "Not linked"}</span>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500 bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={14} />
          Save
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
  const [form, setForm] = useState(() => createFormState(settings));
  const [errors, setErrors] = useState({});

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

    if (!form.adminName.trim()) nextErrors.adminName = "Admin name is required.";
    if (!adminEmail) nextErrors.adminEmail = "Admin email is required.";
    else if (!emailPattern.test(adminEmail)) nextErrors.adminEmail = "Enter a valid admin email.";
    else if (!adminEmail.endsWith("@schooladmin.com"))
      nextErrors.adminEmail = "Admin email must use @schooladmin.com.";

    if (!form.adminDepartment.trim()) nextErrors.adminDepartment = "Department is required.";
    if (!form.adminDepartmentCode.trim()) nextErrors.adminDepartmentCode = "Department code is required.";
    if (!form.adminTwoFactorCode.trim()) nextErrors.adminTwoFactorCode = "2FA code is required.";
    if (form.adminPassword.trim() && form.adminPassword.trim().length < 8)
      nextErrors.adminPassword = "Use at least 8 characters.";

    if (!form.scholarName.trim()) nextErrors.scholarName = "Scholar name is required.";
    if (!scholarEmail) nextErrors.scholarEmail = "Scholar email is required.";
    else if (!emailPattern.test(scholarEmail)) nextErrors.scholarEmail = "Enter a valid scholar email.";

    if (form.scholarPassword.trim() && form.scholarPassword.trim().length < 8)
      nextErrors.scholarPassword = "Use at least 8 characters.";

    if (adminEmail && scholarEmail && adminEmail === scholarEmail)
      nextErrors.scholarEmail = "Scholar email must be different from the admin email.";

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
    "Update either account here. Leave password fields blank to keep the current passwords.";

  const scholarsStatusType = scholarsStatus?.type || "idle";

  return (
    <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden rounded-[36px] border border-emerald-950/10 bg-[#f4fcf5] text-emerald-900 shadow-[0_40px_120px_rgba(34,197,94,0.16)]">
      <div className="absolute inset-0 bg-emerald-100/70" />
      <div className="relative grid min-h-[calc(100vh-4rem)] lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-emerald-950/10 px-6 py-6 sm:px-8 lg:border-b-0 lg:border-r lg:px-7 lg:py-8">
          <div className="flex h-full flex-col">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/60 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-700 shadow-sm">
                <Sparkles size={14} />
                Protected settings
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-emerald-950">Credential Control</h2>
              <p className="mt-3 text-sm leading-6 text-emerald-600">
                Manage both admin and scholar access from one page without dropping back to the terminal.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              {[
                {
                  title: "Admin identity",
                  text: "Update the protected administrator account, department, and 2FA values.",
                  icon: <ShieldCheck size={16} className="text-emerald-600" />,
                },
                {
                  title: "Primary scholar",
                  text: "Control the default student sign-in account from the same interface.",
                  icon: <UserRound size={16} className="text-emerald-600" />,
                },
                {
                  title: "All scholars",
                  text: "Inspect and update every registered scholar account directly below.",
                  icon: <Users size={16} className="text-emerald-600" />,
                },
              ].map((item) => (
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
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Update behavior</p>
              <div className="mt-4 space-y-3 text-sm text-emerald-900/90">
                <p>Changes are written to the backend immediately after save.</p>
                <p>New passwords are hashed automatically before storage.</p>
                <p>Updated credentials apply on the next sign-in attempt.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <ArrowLeft size={16} />
              Back to Dashboard
            </button>
          </div>
        </aside>

        <div className="px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
          <header className="border-b border-emerald-950/10 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-700">Credential Management</p>
            <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-emerald-950 sm:text-5xl">
              Manage admin and scholar access
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-emerald-600 sm:text-lg">
              Update the live admin and scholar accounts here. Password fields are optional and only change the stored credentials when you enter a new value.
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
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-500">Admin Access</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-emerald-950">Protected administrator account</h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-emerald-700">Admin Name</span>
                    <input className={inputClass} name="adminName" value={form.adminName} onChange={handleChange} />
                    {errors.adminName ? <p className="mt-2 text-sm text-emerald-600">{errors.adminName}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <Mail size={14} />
                      Admin Email
                    </span>
                    <input className={inputClass} name="adminEmail" value={form.adminEmail} onChange={handleChange} />
                    {errors.adminEmail ? <p className="mt-2 text-sm text-emerald-600">{errors.adminEmail}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="text-sm font-semibold text-emerald-700">Department</span>
                    <input className={inputClass} name="adminDepartment" value={form.adminDepartment} onChange={handleChange} />
                    {errors.adminDepartment ? <p className="mt-2 text-sm text-emerald-600">{errors.adminDepartment}</p> : null}
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">Department Code</span>
                    <input className={inputClass} name="adminDepartmentCode" value={form.adminDepartmentCode} onChange={handleChange} />
                    {errors.adminDepartmentCode ? <p className="mt-2 text-sm text-emerald-600">{errors.adminDepartmentCode}</p> : null}
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">2FA Code</span>
                    <input className={inputClass} name="adminTwoFactorCode" value={form.adminTwoFactorCode} onChange={handleChange} />
                    {errors.adminTwoFactorCode ? <p className="mt-2 text-sm text-emerald-600">{errors.adminTwoFactorCode}</p> : null}
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <KeyRound size={14} />
                      New Admin Password
                    </span>
                    <input
                      className={inputClass}
                      name="adminPassword"
                      type="password"
                      value={form.adminPassword}
                      onChange={handleChange}
                      placeholder="Leave empty to keep the current password"
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
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-500">Scholar Access</p>
                    <h3 className="mt-1 text-2xl font-black tracking-tight text-emerald-950">Primary scholar sign-in account</h3>
                  </div>
                </div>

                <div className="mt-6 grid gap-4">
                  <label className="block">
                    <span className="text-sm font-semibold text-emerald-700">Scholar Name</span>
                    <input className={inputClass} name="scholarName" value={form.scholarName} onChange={handleChange} />
                    {errors.scholarName ? <p className="mt-2 text-sm text-emerald-600">{errors.scholarName}</p> : null}
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <Mail size={14} />
                      Scholar Email
                    </span>
                    <input className={inputClass} name="scholarEmail" value={form.scholarEmail} onChange={handleChange} />
                    {errors.scholarEmail ? <p className="mt-2 text-sm text-emerald-600">{errors.scholarEmail}</p> : null}
                  </label>

                  <label className="block">
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                      <KeyRound size={14} />
                      New Scholar Password
                    </span>
                    <input
                      className={inputClass}
                      name="scholarPassword"
                      type="password"
                      value={form.scholarPassword}
                      onChange={handleChange}
                      placeholder="Leave empty to keep the current password"
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
                Changes are written to the local backend immediately and apply to the next sign-in attempt.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {isSubmitting ? "Saving Changes..." : "Save Credential Changes"}
              </button>
            </div>
          </form>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-emerald-950/10 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.34em] text-emerald-700">All scholar accounts</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-emerald-950 sm:text-3xl">
                  Credential access for every scholar
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-600">
                  Update names, emails, or reset passwords for any scholar account. Removing an account revokes its sign-in access immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={onLoadScholars}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw size={14} />
                Refresh list
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
                  />
                ))
              ) : (
                <p className="rounded-3xl border border-emerald-200/70 bg-white p-5 text-sm text-emerald-600">
                  No scholar accounts found. Use the refresh button after registering scholars.
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
