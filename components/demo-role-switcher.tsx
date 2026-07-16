"use client";

import { RefreshCcw } from "lucide-react";
import { landingPathForRole, roleLabels } from "@/lib/permissions";
import { roles, type Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type DemoRoleSwitcherProps = {
  activeRole: Role;
};

export function DemoRoleSwitcher({ activeRole }: DemoRoleSwitcherProps) {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== "true"
  ) {
    return null;
  }

  function switchRole(role: Role) {
    document.cookie = `demo_role=${role}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.assign(landingPathForRole(role));
  }

  return (
    <div className="rounded-xl border border-dashed border-[#0eb6ef]/35 bg-[#efefef]/70 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#224770]">
        <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
        Demo role
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => switchRole(role)}
            className={cn(
              "focus-ring rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
              activeRole === role
                ? "border-[#0eb6ef] bg-white text-[#224770] shadow-sm"
                : "border-transparent bg-white/70 text-[#46484a] hover:border-[#0eb6ef]/35"
            )}
          >
            {roleLabels[role]}
          </button>
        ))}
      </div>
    </div>
  );
}
