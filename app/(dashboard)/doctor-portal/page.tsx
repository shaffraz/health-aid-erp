import { AccessDenied } from "@/components/access-denied";
import { DoctorPortal } from "@/components/doctor-portal";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function DoctorPortalPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "doctorPortal")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Private earnings"
        title="Doctor portal"
        description="Doctors only see their own earning records. Patient profile management is intentionally out of scope for this MVP."
      />
      <DoctorPortal user={user} doctors={data.doctors} payouts={data.payouts} />
    </div>
  );
}
