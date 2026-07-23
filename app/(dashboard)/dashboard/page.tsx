import Link from "next/link";
import { AccessDenied } from "@/components/access-denied";
import { DashboardOverview } from "@/components/dashboard-overview";
import { buttonClass } from "@/components/erp-ui";
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
              className={buttonClass("primary", "min-h-11")}
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
