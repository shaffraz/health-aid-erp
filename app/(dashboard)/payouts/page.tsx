import { AccessDenied } from "@/components/access-denied";
import { PayoutManagement } from "@/components/payout-management";
import { SectionHeader } from "@/components/section-header";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function PayoutsPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "managePayouts")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Finance"
        title="Payout Management"
      />
      <PayoutManagement
        doctors={data.doctors}
        initialPayouts={data.payouts}
        initialVouchers={data.vouchers}
      />
    </div>
  );
}
