import { AccessDenied } from "@/components/access-denied";
import { InvoicesDashboard } from "@/components/invoices-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function InvoicesPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user, "canViewAllInvoices")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Invoice Registry" />

      <InvoicesDashboard
        doctors={data.doctors}
        invoices={data.invoices}
      />
    </div>
  );
}
