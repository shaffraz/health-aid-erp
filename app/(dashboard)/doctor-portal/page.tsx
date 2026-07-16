import { AccessDenied } from "@/components/access-denied";
import { DoctorPortal } from "@/components/doctor-portal";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function DoctorPortalPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewOwnPayouts")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Doctor Portal"
      />
      <DoctorPortal user={user} doctors={data.doctors} payouts={data.payouts} />
    </div>
  );
}
