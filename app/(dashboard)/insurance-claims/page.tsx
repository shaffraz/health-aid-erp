import { AccessDenied } from "@/components/access-denied";
import { InsuranceClaimsDashboard } from "@/components/insurance-claims-dashboard";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasAnyPermission } from "@/lib/permissions";

export default async function InsuranceClaimsPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasAnyPermission(user, ["canViewInsurance", "canViewOwnCompanyInsurance"])) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Insurance"
      />

      <InsuranceClaimsDashboard
        invoices={data.invoices}
        insuranceReceivables={data.insuranceReceivables}
        currentUser={user}
      />
    </div>
  );
}
