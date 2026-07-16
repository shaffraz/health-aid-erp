import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { DashboardOverview } from "@/components/dashboard-overview";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewDashboard")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Operations Dashboard"
        action={
          hasPermission(user, "canUseInvoicePOS") ? (
            <Link
              href="/invoices/new"
              className="focus-ring inline-flex items-center justify-center rounded-lg bg-[#224770] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0eb6ef]"
            >
              New invoice
            </Link>
          ) : null
        }
      />

      <DashboardOverview
        initialDoctors={data.doctors}
        initialServices={data.services}
        invoices={data.invoices}
        payouts={data.payouts}
        insuranceReceivables={data.insuranceReceivables}
      />
    </div>
  );
}
