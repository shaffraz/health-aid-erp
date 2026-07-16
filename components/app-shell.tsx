"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileCheck2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  ShieldCheck,
  Stethoscope,
  UsersRound,
  UserRoundCog,
  X
} from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { DemoRoleSwitcher } from "@/components/demo-role-switcher";
import { StatusPill } from "@/components/status-pill";
import { hasPermission, roleLabels } from "@/lib/permissions";
import { defaultSystemSettings } from "@/lib/settings";
import type { AppUser, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: AppUser;
  children: React.ReactNode;
};

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Parameters<typeof hasPermission>[1];
}> = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { href: "/invoices/new", label: "Invoice POS", icon: ReceiptText, permission: "createInvoices" },
  { href: "/invoices", label: "Invoices", icon: ClipboardList, permission: "viewInvoices" },
  { href: "/insurance-claims", label: "Insurance", icon: FileCheck2, permission: "viewInsurance" },
  { href: "/services", label: "Services", icon: ShieldCheck, permission: "viewServices" },
  { href: "/doctors", label: "Doctors", icon: UserRoundCog, permission: "viewDoctors" },
  { href: "/users", label: "Users", icon: UsersRound, permission: "manageUsers" },
  { href: "/doctor-portal", label: "My Earnings", icon: Stethoscope, permission: "doctorPortal" },
  { href: "/payouts", label: "Payouts", icon: CreditCard, permission: "viewPayouts" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "viewSettings" }
];

function roleTone(role: Role) {
  if (role === "administrator") {
    return "cyan" as const;
  }
  if (role === "doctor") {
    return "green" as const;
  }
  if (role === "director") {
    return "amber" as const;
  }
  if (role === "assistance_company") {
    return "cyan" as const;
  }
  return "slate" as const;
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNav = navItems.filter((item) => hasPermission(user.role, item.permission));

  const sidebar = (
    <aside className="flex h-full flex-col gap-5">
      <div className="px-3 py-1">
        <BrandLogo className="mx-auto max-w-[250px]" maxWidth={250} priority />
      </div>

      <DemoRoleSwitcher activeRole={user.role} />

      <nav className="space-y-1" aria-label="Main navigation">
        {visibleNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/invoices" && pathname.startsWith(`${item.href}/`));

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={cn(
                "focus-ring flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
                isActive
                  ? "bg-lagoon-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white hover:text-ink"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <StatusPill tone={roleTone(user.role)}>{roleLabels[user.role]}</StatusPill>
        </div>
        <Link
          href="/login"
          className="focus-ring mt-3 flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <BrandLogo variant="mark" priority className="h-10 w-10" />
            </span>
            <span className="font-semibold text-ink">
              {defaultSystemSettings.clinic.clinicName} ERP
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="focus-ring rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1500px] gap-6 px-4 py-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-6">
        <div className="sticky top-5 hidden h-[calc(100vh-2.5rem)] lg:block">{sidebar}</div>
        <main className="min-w-0 pb-12">{children}</main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(86vw,320px)] bg-slate-50 p-4 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-lg border border-slate-200 bg-white p-2 text-slate-600"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}
    </div>
  );
}
