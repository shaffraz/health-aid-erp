import { AccessDenied } from "@/components/access-denied";
import { SectionHeader } from "@/components/section-header";
import { StaffManagement } from "@/components/staff-management";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function StaffPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewStaff")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Staff" />
      <StaffManagement
        auditLogs={data.auditLogs}
        currentUserName={user.name}
        initialStaff={data.staffMembers}
        invoices={data.invoices}
        users={data.users}
        salaryRecords={data.staffSalaryRecords}
        canEdit={hasPermission(user, "canManageStaff")}
        canManageSalaries={hasPermission(user, "canManageSalaries")}
      />
    </div>
  );
}
