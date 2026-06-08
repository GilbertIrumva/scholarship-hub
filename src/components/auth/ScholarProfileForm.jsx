import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save, Trash2, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FIELDS = [
  { name: "name", label: "Full name", type: "text", required: true },
  { name: "contact", label: "Contact / phone", type: "text" },
  { name: "age", label: "Age", type: "number" },
  { name: "gender", label: "Gender", type: "text" },
  { name: "dateOfBirth", label: "Date of birth", type: "date" },
  { name: "nationality", label: "Nationality", type: "text" },
  { name: "status", label: "Marital status", type: "text" },
  { name: "education", label: "Education", type: "text" },
  { name: "address", label: "Address", type: "text", fullWidth: true },
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
  const [form, setForm] = useState(() => buildInitialState(application));
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

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
      setError("Photo must be smaller than 2 MB.");
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
      setError("Name is required.");
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
                    alt="Preview"
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
                  Edit profile
                </p>
                <h3 className="mt-1 text-xl font-extrabold text-ink tracking-tight">
                  Update your details
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-sm transition hover:bg-slate-50">
                    <Camera className="h-3.5 w-3.5" />
                    Upload photo
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
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
            {onCancel && (
              <Button variant="outline" size="sm" type="button" onClick={onCancel}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            )}
          </div>

          {/* Fields */}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div
                key={field.name}
                className={`space-y-1.5 ${field.fullWidth ? "sm:col-span-2" : ""}`}
              >
                <Label htmlFor={`pf-${field.name}`}>
                  {field.label}
                  {field.required && <span className="text-danger"> *</span>}
                </Label>
                <Input
                  id={`pf-${field.name}`}
                  name={field.name}
                  type={field.type}
                  value={form[field.name] ?? ""}
                  onChange={handleChange}
                  placeholder={field.label}
                />
              </div>
            ))}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pf-bio">About you</Label>
              <textarea
                id="pf-bio"
                name="bio"
                value={form.bio}
                onChange={handleChange}
                placeholder="Tell us a bit about yourself, your goals, and what you're studying…"
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
                Cancel
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save profile
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
