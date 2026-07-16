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
import {
  hasAnyPermission,
  hasPermission,
  landingPathForRole,
  roleLabels,
  type Permission
} from "@/lib/permissions";
import { defaultSystemSettings } from "@/lib/settings";
import type { AppUser, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type AppShellProps = {
  user: AppUser;
  children: React.ReactNode;
};

type NavGroup = "Overview" | "Operations" | "Management" | "Finance" | "Administration";

const navGroups: NavGroup[] = [
  "Overview",
  "Operations",
  "Management",
  "Finance",
  "Administration"
];

const navItems: Array<{
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: NavGroup;
  permissions: Permission[];
}> = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "Overview",
    permissions: ["canViewDashboard"]
  },
  {
    href: "/invoices/new",
    label: "Invoice POS",
    icon: ReceiptText,
    group: "Operations",
    permissions: ["canUseInvoicePOS"]
  },
  {
    href: "/invoices",
    label: "Invoices",
    icon: ClipboardList,
    group: "Operations",
    permissions: ["canViewAllInvoices"]
  },
  {
    href: "/insurance-claims",
    label: "Insurance",
    icon: FileCheck2,
    group: "Operations",
    permissions: ["canViewInsurance"]
  },
  {
    href: "/insurance-claims",
    label: "Company Dashboard",
    icon: FileCheck2,
    group: "Overview",
    permissions: ["canViewOwnCompanyInsurance"]
  },
  {
    href: "/insurance-claims#invoices",
    label: "My Invoices",
    icon: ClipboardList,
    group: "Operations",
    permissions: ["canViewOwnCompanyInsurance"]
  },
  {
    href: "/insurance-claims#statements",
    label: "Monthly Statements",
    icon: FileCheck2,
    group: "Operations",
    permissions: ["canViewOwnCompanyInsurance"]
  },
  {
    href: "/insurance-claims#payments",
    label: "Payment Details",
    icon: CreditCard,
    group: "Finance",
    permissions: ["canViewOwnCompanyInsurance"]
  },
  {
    href: "/services",
    label: "Services",
    icon: ShieldCheck,
    group: "Management",
    permissions: ["canViewServices"]
  },
  {
    href: "/doctors",
    label: "Doctors",
    icon: UserRoundCog,
    group: "Management",
    permissions: ["canViewDoctors"]
  },
  {
    href: "/staff",
    label: "Staff",
    icon: UsersRound,
    group: "Management",
    permissions: ["canViewStaff"]
  },
  {
    href: "/users",
    label: "Users",
    icon: UsersRound,
    group: "Management",
    permissions: ["canViewUsers"]
  },
  {
    href: "/my-salary",
    label: "My Salary",
    icon: CreditCard,
    group: "Finance",
    permissions: ["canViewOwnSalary"]
  },
  {
    href: "/doctor-portal",
    label: "My Dashboard",
    icon: Stethoscope,
    group: "Overview",
    permissions: ["canViewOwnPayouts"]
  },
  {
    href: "/doctor-portal#payouts",
    label: "My Payouts",
    icon: CreditCard,
    group: "Finance",
    permissions: ["canViewOwnPayouts"]
  },
  {
    href: "/doctor-portal#payment-history",
    label: "Payment History",
    icon: ClipboardList,
    group: "Finance",
    permissions: ["canViewOwnPayouts"]
  },
  {
    href: "/my-profile",
    label: "My Profile",
    icon: UserRoundCog,
    group: "Management",
    permissions: ["canShowOwnProfileInSidebar"]
  },
  {
    href: "/payouts",
    label: "Payouts",
    icon: CreditCard,
    group: "Finance",
    permissions: ["canViewAllPayouts"]
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    group: "Finance",
    permissions: ["canViewReports"]
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    group: "Administration",
    permissions: ["canViewSettings"]
  },
  {
    href: "/my-profile",
    label: "Company Profile",
    icon: UserRoundCog,
    group: "Management",
    permissions: ["canViewOwnCompanyInsurance"]
  }
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
  const visibleNav = navItems.filter((item) => hasAnyPermission(user, item.permissions));
  const profileVisible = hasPermission(user, "canOpenOwnProfile");

  const groupedNav = navGroups
    .map((group) => ({
      group,
      items: visibleNav.filter((item) => item.group === group)
    }))
    .filter((group) => group.items.length > 0);

  const sidebar = (
    <aside className="flex h-full min-h-0 flex-col gap-5 rounded-2xl border border-[#efefef] bg-white p-4 text-[#224770] shadow-sm">
      <Link
        href={landingPathForRole(user.role)}
        className="focus-ring flex min-h-20 items-center justify-center rounded-xl px-2 py-3 transition hover:bg-[#efefef]/70"
      >
        <BrandLogo maxWidth={230} priority className="mx-auto" />
      </Link>

      <DemoRoleSwitcher activeRole={user.role} />

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1" aria-label="Main navigation">
        {groupedNav.map(({ group, items }) => (
          <div key={group} className="space-y-1.5">
            <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[#46484a]/55">
              {group}
            </p>
            {items.map((item) => {
              const Icon = item.icon;
              const itemPath = item.href.split("#")[0];
              const hashLink = item.href.includes("#");
              const isActive =
                !hashLink &&
                (pathname === itemPath ||
                  (itemPath !== "/invoices" && pathname.startsWith(`${itemPath}/`)));

              return (
                <Link
                  key={`${item.group}-${item.label}-${item.href}`}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-ring relative flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                    isActive
                      ? "bg-[#efefef] text-[#224770]"
                      : "text-[#46484a] hover:bg-[#efefef]/70 hover:text-[#224770]"
                  )}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#84BC3F]" />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 rounded-xl border border-[#efefef] bg-[#efefef]/55 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#224770]">{user.name}</p>
            <p className="truncate text-xs text-[#46484a]/70">{roleLabels[user.role]}</p>
          </div>
          <StatusPill tone={roleTone(user.role)}>{roleLabels[user.role]}</StatusPill>
        </div>
        {profileVisible ? (
          <Link
            href="/my-profile"
            onClick={() => setOpen(false)}
            className="focus-ring mt-3 flex min-h-10 items-center justify-center rounded-lg bg-[#224770] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0EB6EF]"
          >
            Profile
          </Link>
        ) : null}
        <Link
          href="/login"
          className="focus-ring mt-2 flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#dfe5ea] bg-white px-3 py-2 text-xs font-semibold text-[#46484a] transition hover:border-[#0EB6EF] hover:text-[#224770]"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </Link>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-[#efefef] bg-white px-4 py-3 text-[#224770] shadow-sm lg:hidden">
        <div className="flex items-center justify-between">
          <Link href={landingPathForRole(user.role)} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden">
              <BrandLogo variant="mark" priority className="h-10 w-10" />
            </span>
            <span className="font-semibold text-[#224770]">
              {defaultSystemSettings.clinic.clinicName}
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="focus-ring rounded-lg border border-[#dfe5ea] bg-white p-2 text-[#224770] shadow-sm"
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
          <div className="absolute inset-y-0 left-0 w-[min(88vw,340px)] bg-white p-4 shadow-2xl">
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="focus-ring rounded-lg border border-[#dfe5ea] bg-white p-2 text-[#224770] shadow-sm"
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
