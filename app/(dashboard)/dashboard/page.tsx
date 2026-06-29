import Link from "next/link";
import { DashboardOverview } from "@/components/dashboard-overview";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Command center"
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="A clean operational dashboard for setup, sales, service activity, and doctor payout exposure."
        action={
          hasPermission(user.role, "createInvoices") ? (
            <Link
              href="/invoices/new"
              className="focus-ring inline-flex items-center justify-center rounded-lg bg-lagoon-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-lagoon-700"
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
      />
    </div>
  );
}
