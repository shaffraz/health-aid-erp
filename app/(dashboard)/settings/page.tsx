import { AccessDenied } from "@/components/access-denied";
import { SectionHeader } from "@/components/section-header";
import { SettingsAdmin } from "@/components/settings-admin";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!hasPermission(user.role, "viewSettings")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" />
      <SettingsAdmin
        canEdit={hasPermission(user.role, "manageSettings")}
        currentUserName={user.name}
      />
    </div>
  );
}
