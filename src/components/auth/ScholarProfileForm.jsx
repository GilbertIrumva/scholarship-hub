import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, Loader2, Save, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MARITAL_OPTIONS = [
  { value: "single", labelKey: "profile.maritalSingle" },
  { value: "married", labelKey: "profile.maritalMarried" },
  { value: "divorced", labelKey: "profile.maritalDivorced" },
  { value: "widowed", labelKey: "profile.maritalWidowed" },
  { value: "prefer-not-to-say", labelKey: "profile.maritalPreferNotToSay" },
];

const FIELD_DEFS = [
  { name: "name", labelKey: "profile.formFieldFullName", type: "text", required: true },
  { name: "contact", labelKey: "profile.formFieldContact", type: "text" },
  { name: "age", labelKey: "profile.formFieldAge", type: "number" },
  { name: "gender", labelKey: "profile.formFieldGender", type: "text" },
  { name: "dateOfBirth", labelKey: "profile.formFieldDateOfBirth", type: "date" },
  { name: "nationality", labelKey: "profile.formFieldNationality", type: "text" },
  {
    name: "status",
    labelKey: "profile.formFieldMaritalStatus",
    type: "select",
    helpKey: "profile.maritalStatusHelp",
    options: MARITAL_OPTIONS,
    placeholderKey: "profile.maritalStatusPlaceholder",
  },
  { name: "education", labelKey: "profile.formFieldEducation", type: "text" },
  { name: "address", labelKey: "profile.formFieldAddress", type: "text", fullWidth: true },
];

const buildInitialState = (application) => ({
  name: application?.name || "",
  contact: application?.contact || "",
  age: application?.age ?? "",
  gender: application?.gender || "",
  dateOfBirth: application?.dateOfBirth || "",
  nationality: application?.nationality || "",
  status: application?.status || "",
  education:
    application?.education === "Not supplied" ? "" : application?.education || "",
  address: application?.address || "",
  bio: application?.bio || "",
  photo: application?.photo || "",
});

const ScholarProfileForm = ({ application, onCancel, onSave, isSubmitting }) => {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => buildInitialState(application));
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const fields = useMemo(
    () => FIELD_DEFS.map((f) => ({ ...f, label: t(f.labelKey) })),
    [t]
  );

  useEffect(() => {
    setForm(buildInitialState(application));
  }, [application]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const handlePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(t("profile.errorPhotoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, photo: String(reader.result || "") }));
    };
    reader.readAsDataURL(file);
  };

  const handleClearPhoto = () => {
    setForm((current) => ({ ...current, photo: "" }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError(t("profile.errorNameRequired"));
      return;
    }
    const payload = {
      ...form,
      name: form.name.trim(),
      age: form.age === "" ? null : Number(form.age),
    };
    await onSave(payload);
  };

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6">
          {/* Avatar + actions */}
          <div className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-sm">
                {form.photo ? (
                  <img
                    src={form.photo}
                    alt={t("profile.photoPreviewAlt")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-slate-400">
                    <Camera className="h-7 w-7" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {t("profile.formEyebrow")}
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-ink tracking-tight">
                  {t("profile.formHeading")}
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50">
                    <Camera className="h-3.5 w-3.5" />
                    {t("profile.uploadPhoto")}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhoto}
                    />
                  </label>
                  {form.photo && (
                    <button
                      type="button"
                      onClick={handleClearPhoto}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-danger shadow-sm transition hover:bg-danger/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {t("profile.removePhoto")}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {onCancel && (
              <Button variant="outline" size="sm" type="button" onClick={onCancel}>
                <X className="h-3.5 w-3.5" />
                {t("profile.cancelButton")}
              </Button>
            )}
          </div>

          {/* Fields */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div
                key={field.name}
                className={`space-y-1.5 ${field.fullWidth ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={`pf-${field.name}`}>
                  {field.label}
                  {field.required && <span className="text-danger"> *</span>}
                </Label>
                {field.type === "select" ? (
                  <select
                    id={`pf-${field.name}`}
                    name={field.name}
                    value={form[field.name] ?? ""}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {field.placeholderKey ? t(field.placeholderKey) : field.label}
                    </option>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.labelKey)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`pf-${field.name}`}
                    name={field.name}
                    type={field.type}
                    value={form[field.name] ?? ""}
                    onChange={handleChange}
                    placeholder={field.label}
                  />
                )}
                {field.helpKey && (
                  <p className="text-xs text-muted">{t(field.helpKey)}</p>
                )}
              </div>
            ))}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-bio">{t("profile.formFieldAbout")}</Label>
              <textarea
                id="pf-bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                placeholder={t("profile.aboutPlaceholder")}
                className="flex min-h-[110px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
            {onCancel && (
              <Button variant="outline" type="button" onClick={onCancel}>
                {t("profile.cancelButton")}
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("profile.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("profile.saveProfile")}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
};

export default ScholarProfileForm;
