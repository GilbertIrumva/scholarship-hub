import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Cake,
  FolderArchive,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  RefreshCcw,
  UserRound,
  Users,
} from "lucide-react";
import DashboardLayout from "./DashboardLayout";
import { useAuth } from "../../context/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAdminApplicant } from "../../services/adminAuth";
import AdminTravelDocsSection from "./AdminTravelDocsSection";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800",
  "under-review": "bg-sky-100 text-sky-800",
  approved: "bg-primary/10 text-primary-dark",
  rejected: "bg-rose-100 text-rose-800",
};

const Field = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    {Icon && (
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-muted">
        <Icon className="h-4 w-4" />
      </div>
    )}
    <div className="min-w-0">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-ink">{value || "—"}</p>
    </div>
  </div>
);

const AdminApplicantDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { sessionToken, adminDashboard, signOut } = useAuth();

  const [applicant, setApplicant] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchApplicant = async () => {
    if (!sessionToken || !id) return;
    setLoading(true);
    try {
      const data = await getAdminApplicant(sessionToken, id);
      setApplicant(data?.applicant || data);
    } catch {
      toast.error("Could not load applicant.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicant();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, sessionToken]);

  if (!sessionToken) return <Navigate to="/login/admin" replace />;

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };

  return (
    <DashboardLayout
      role="admin"
      user={adminDashboard?.admin}
      title={applicant?.name || "Applicant detail"}
      subtitle={applicant ? `#${applicant.id || applicant.legacyId || id}` : "Loading…"}
      onSignOut={handleSignOut}
      actions={
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/applicants">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          {applicant?.scholarAccountId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/admin/credentials?scholar=${applicant.scholarAccountId}`}>
                <FolderArchive className="h-4 w-4" />
                Credentials
              </Link>
            </Button>
          )}
          <Button onClick={fetchApplicant} disabled={loading} size="sm">
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      }
    >
      {loading && !applicant ? (
        <Card>
          <CardContent className="p-16 text-center text-sm text-muted">
            Loading applicant…
          </CardContent>
        </Card>
      ) : !applicant ? (
        <Card>
          <CardContent className="p-16 text-center text-sm text-muted">
            Applicant not found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
          {/* Profile card */}
          <Card>
            <CardContent className="p-6 text-center">
              <div className="relative mx-auto h-32 w-32 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-md">
                {applicant.photo ? (
                  <img
                    src={applicant.photo}
                    alt={applicant.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted">
                    <UserRound className="h-16 w-16" />
                  </div>
                )}
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-ink">{applicant.name || "Unnamed"}</h2>
              <p className="text-sm text-muted">
                #{applicant.id || applicant.legacyId || id}
              </p>
              {applicant.reviewStatus && (
                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    STATUS_STYLES[applicant.reviewStatus] || "bg-slate-100 text-muted"
                  }`}
                >
                  {applicant.reviewStatus}
                </span>
              )}
              {applicant.status && applicant.status !== applicant.reviewStatus && (
                <p className="mt-2 text-xs text-muted">{applicant.status}</p>
              )}
            </CardContent>
            <Separator />
            <CardContent className="space-y-4 p-6">
              <Field icon={Mail} label="Contact" value={applicant.contact} />
              <Field icon={Phone} label="Phone" value={applicant.phone} />
              <Field icon={MapPin} label="Address" value={applicant.address} />
              <Field icon={MapPin} label="Nationality" value={applicant.nationality} />
            </CardContent>
          </Card>

          {/* Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field icon={Cake} label="Age" value={applicant.age ? `${applicant.age} years` : null} />
                  <Field icon={Cake} label="Date of birth" value={applicant.dateOfBirth} />
                  <Field icon={Users} label="Gender" value={applicant.gender} />
                  <Field icon={GraduationCap} label="Education" value={applicant.education} />
                </div>
              </CardContent>
            </Card>

            {applicant.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{applicant.bio}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Metadata</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Created"
                    value={
                      applicant.createdAt
                        ? new Date(applicant.createdAt).toLocaleString()
                        : null
                    }
                  />
                  <Field
                    label="Updated"
                    value={
                      applicant.updatedAt
                        ? new Date(applicant.updatedAt).toLocaleString()
                        : null
                    }
                  />
                  <Field label="Legacy ID" value={applicant.legacyId} />
                  <Field label="Scholarship" value={applicant.scholarship} />
                </div>
              </CardContent>
            </Card>

            {applicant.scholarAccountId && (
              <AdminTravelDocsSection
                sessionToken={sessionToken}
                scholarId={applicant.scholarAccountId}
              />
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default AdminApplicantDetailPage;
