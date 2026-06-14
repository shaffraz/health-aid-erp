import { AccessDenied } from "@/components/access-denied";
import { InvoicePosForm } from "@/components/invoice-pos-form";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function NewInvoicePage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "createInvoices")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Point of sale"
        title="Create invoice"
        description="Record patient details only inside the invoice, select the doctor who saw the patient, add services, and preview automatic doctor payouts before saving."
      />
      <InvoicePosForm
        doctors={data.doctors}
        services={data.services}
        paymentRules={data.paymentRules}
        initialInvoices={data.invoices}
        createdBy={user.id}
      />
    </div>
  );
}
