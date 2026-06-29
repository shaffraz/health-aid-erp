import { AccessDenied } from "@/components/access-denied";
import { InvoicesDashboard } from "@/components/invoices-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function InvoicesPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "viewInvoices")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Invoices"
        title="Invoice register"
      />

      <InvoicesDashboard
        doctors={data.doctors}
        invoices={data.invoices}
        insuranceReceivables={data.insuranceReceivables}
        currentRole={user.role}
      />
    </div>
  );
}
