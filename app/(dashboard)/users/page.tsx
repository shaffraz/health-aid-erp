import { AccessDenied } from "@/components/access-denied";
import { SectionHeader } from "@/components/section-header";
import { UsersAdmin } from "@/components/users-admin";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function UsersPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewUsers")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="User Management" />
      <UsersAdmin
        initialUsers={data.users}
        doctors={data.doctors}
        assistanceCompanies={data.assistanceCompanies}
        canEdit={hasPermission(user, "canManageUsers")}
      />
    </div>
  );
}
