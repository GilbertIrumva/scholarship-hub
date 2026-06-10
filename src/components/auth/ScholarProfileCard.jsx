import { Mail, Pencil, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const Field = ({ label, value, emptyLabel }) => (
  <div className="rounded-xl border border-border bg-slate-50/50 p-3">
    <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
    <p className="mt-1.5 break-words text-sm font-semibold text-ink">
      {value && String(value).trim() && value !== "Not supplied" ? value : emptyLabel}
    </p>
  </div>
);

const ScholarProfileCard = ({ application, email, onEdit }) => {
  const { t } = useTranslation();
  const hasProfile = !!application;
  const fallbackName = t("profile.avatarFallbackName");
  const emptyLabel = "—";
  const initials = (application?.name || email || "S")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <Card>
      <CardContent className="p-6">
        {/* Avatar + header */}
        <div className="flex flex-col gap-5 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-border bg-slate-50 shadow-sm">
              {application?.photo ? (
                <img
                  src={application.photo}
                  alt={t("profile.avatarAlt", { name: application.name || fallbackName })}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary to-emerald-700 text-white text-xl font-extrabold">
                  {initials || <UserRound className="h-7 w-7" />}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                {t("profile.cardEyebrow")}
              </p>
              <h3 className="mt-1 text-xl font-extrabold text-ink tracking-tight truncate">
                {application?.name || t("profile.addYourName")}
              </h3>
              <p className="mt-1 text-sm text-muted inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {email}
              </p>
            </div>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              {t("profile.editButton")}
            </Button>
          )}
        </div>

        {/* Fields */}
        {hasProfile ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("profile.fieldContact")} value={application.contact} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldAge")} value={application.age} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldGender")} value={application.gender} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldDateOfBirth")} value={application.dateOfBirth} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldNationality")} value={application.nationality} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldMaritalStatus")} value={application.status} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldEducation")} value={application.education} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldAddress")} value={application.address} emptyLabel={emptyLabel} />
            <Field label={t("profile.fieldApplicationId")} value={application.id ? `#${application.id}` : null} emptyLabel={emptyLabel} />
          </div>
        ) : (
          <div className="mt-5 rounded-xl border-2 border-dashed border-border bg-slate-50/40 p-6 text-center">
            <p className="text-sm font-semibold text-ink">{t("profile.noProfileTitle")}</p>
            <p className="mt-1 text-sm text-muted">
              {t("profile.noProfileBodyPrefix")}
              <span className="font-semibold text-ink">{t("profile.noProfileBodyAction")}</span>
              {t("profile.noProfileBodySuffix")}
            </p>
          </div>
        )}

        {/* Bio */}
        {application?.bio && (
          <div className="mt-4 rounded-xl border border-border bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">{t("profile.aboutSection")}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink">
              {application.bio}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScholarProfileCard;
