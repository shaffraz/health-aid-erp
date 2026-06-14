import { AccessDenied } from "@/components/access-denied";
import { ReportsDashboard } from "@/components/reports-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function ReportsPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "reports")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Reports"
        title="Operational and finance reports"
        description="Daily sales, category income, invoices, doctor payout summaries, paid/unpaid status, and monthly doctor payment exports."
      />
      <ReportsDashboard doctors={data.doctors} invoices={data.invoices} payouts={data.payouts} />
    </div>
  );
}
