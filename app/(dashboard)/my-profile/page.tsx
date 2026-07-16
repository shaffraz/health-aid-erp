import { AccessDenied } from "@/components/access-denied";
import { MyProfileDashboard } from "@/components/my-profile-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function MyProfilePage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canOpenOwnProfile")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="My Profile" />
      <MyProfileDashboard
        user={user}
        doctors={data.doctors}
        assistanceCompanies={data.assistanceCompanies}
      />
    </div>
  );
}
