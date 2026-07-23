import { AccessDenied } from "@/components/access-denied";
import { MySalaryDashboard } from "@/components/my-salary-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function MySalaryPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewOwnSalary")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="My Salary" />
      <MySalaryDashboard
        user={user}
        staffMembers={data.staffMembers}
        salaryRecords={data.staffSalaryRecords}
      />
    </div>
  );
}
