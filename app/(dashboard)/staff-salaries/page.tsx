import { AccessDenied } from "@/components/access-denied";
import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/section-header";
import { StaffSalaryDashboard } from "@/components/staff-salary-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function StaffSalariesPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewAllSalaries")) {
    return <AccessDenied />;
  }

  if (hasPermission(user, "canViewStaff")) {
    redirect("/staff");
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Staff / Salaries" />
      <StaffSalaryDashboard
        users={data.users}
        salaryRecords={data.staffSalaryRecords}
        canManage={hasPermission(user, "canManageSalaries")}
      />
    </div>
  );
}
