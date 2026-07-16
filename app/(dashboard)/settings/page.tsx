import { redirect } from "next/navigation";
import { SectionHeader } from "@/components/section-header";
import { SettingsAdmin } from "@/components/settings-admin";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!hasPermission(user, "canViewSettings")) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Settings" />
      <SettingsAdmin
        canEdit={hasPermission(user, "canManageSettings")}
        currentUserName={user.name}
      />
    </div>
  );
}
