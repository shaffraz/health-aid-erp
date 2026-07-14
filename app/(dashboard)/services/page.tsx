import { AccessDenied } from "@/components/access-denied";
import { SectionHeader } from "@/components/section-header";
import { ServicesAdmin } from "@/components/services-admin";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { hasPermission } from "@/lib/permissions";

export default async function ServicesPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "viewServices")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Services Management"
      />
      <ServicesAdmin
        initialServices={data.services}
        invoices={data.invoices}
        canEdit={hasPermission(user.role, "manageServices")}
      />
    </div>
  );
}
