import { AccessDenied } from "@/components/access-denied";
import { DoctorsAdmin } from "@/components/doctors-admin";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function DoctorsPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "manageDoctors")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Admin setup"
        title="Doctors and payment rules"
        description="Create doctors and doctor-specific payout rules. Exact service rules override category rules, and both override service defaults."
      />
      <DoctorsAdmin
        initialDoctors={data.doctors}
        initialRules={data.paymentRules}
        services={data.services}
        canEdit={hasPermission(user.role, "manageDoctors")}
      />
    </div>
  );
}
