import type { Role } from "@/lib/types";

export const roleLabels: Record<Role, string> = {
  administrator: "Administrator",
  director: "Company Director",
  staff: "Staff",
  doctor: "Doctor",
  assistance_company: "Assistance Company"
};

export const permissions = {
  canViewDashboard: ["administrator", "director"],
  canUseInvoicePOS: ["administrator", "staff"],
  canCreateInvoice: ["administrator", "staff"],
  canViewAllInvoices: ["administrator", "director", "staff"],
  canViewOwnInvoices: ["staff", "assistance_company"],
  canEditInvoice: ["administrator"],
  canVoidInvoice: ["administrator"],
  canManageInsurance: ["administrator"],
  canViewInsurance: ["administrator", "director"],
  canViewAssistanceCompanies: ["administrator", "director"],
  canViewOwnCompanyInsurance: ["assistance_company"],
  canManageAssistanceCompanies: ["administrator"],
  canViewServices: ["administrator", "director"],
  canManageServices: ["administrator"],
  canViewDoctors: ["administrator", "director"],
  canManageDoctors: ["administrator"],
  canViewStaff: ["administrator", "director"],
  canManageStaff: ["administrator"],
  canViewUsers: ["administrator", "director"],
  canManageUsers: ["administrator"],
  canViewAllSalaries: ["administrator", "director"],
  canViewOwnSalary: ["staff"],
  canManageSalaries: ["administrator"],
  canViewAllPayouts: ["administrator", "director"],
  canViewOwnPayouts: ["doctor"],
  canManagePayouts: ["administrator"],
  canViewReports: ["administrator", "director"],
  canExportReports: ["administrator", "director"],
  canViewSettings: ["administrator"],
  canManageSettings: ["administrator"],
  canChangeOperatingMode: ["administrator"],
  canViewAudit: ["administrator"],
  canOpenOwnProfile: ["administrator", "director", "staff", "doctor", "assistance_company"],
  canShowOwnProfileInSidebar: ["staff", "doctor"],
  canViewOwnProfile: ["staff", "doctor", "assistance_company"],

  dashboard: ["administrator", "director"],
  createInvoices: ["administrator", "staff"],
  viewInvoices: ["administrator", "director", "staff"],
  deleteInvoices: ["administrator"],
  viewInsurance: ["administrator", "director", "assistance_company"],
  manageInsurance: ["administrator"],
  manageAssistanceCompanies: ["administrator"],
  viewServices: ["administrator", "director"],
  manageServices: ["administrator"],
  viewDoctors: ["administrator", "director"],
  manageDoctors: ["administrator"],
  doctorPortal: ["doctor"],
  viewPayouts: ["administrator", "director"],
  managePayouts: ["administrator"],
  reports: ["administrator", "director"],
  manageUsers: ["administrator"],
  viewSettings: ["administrator"],
  manageSettings: ["administrator"],
  auditLogs: ["administrator"]
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof permissions;

export type PermissionActor = Role | {
  role: Role;
  administratorPrivileges?: boolean;
};

function actorRole(actor: PermissionActor) {
  return typeof actor === "string" ? actor : actor.role;
}

function actorHasAdministratorPrivileges(actor: PermissionActor) {
  return typeof actor !== "string" && Boolean(actor.administratorPrivileges);
}

export function getEffectivePermissions(actor: PermissionActor) {
  const role = actorRole(actor);
  const adminEquivalent =
    role === "administrator" || (role === "director" && actorHasAdministratorPrivileges(actor));

  return new Set(
    (Object.keys(permissions) as Permission[]).filter((permission) => {
      const allowedRoles = permissions[permission] as readonly Role[];

      return adminEquivalent
        ? allowedRoles.includes("administrator")
        : allowedRoles.includes(role);
    })
  );
}

export function hasPermission(actor: PermissionActor, permission: Permission) {
  return getEffectivePermissions(actor).has(permission);
}

export function hasAnyPermission(actor: PermissionActor, permissionList: readonly Permission[]) {
  const effectivePermissions = getEffectivePermissions(actor);

  return permissionList.some((permission) => effectivePermissions.has(permission));
}

export function landingPathForRole(role: Role) {
  if (role === "staff") {
    return "/invoices/new";
  }

  if (role === "doctor") {
    return "/doctor-portal";
  }

  if (role === "assistance_company") {
    return "/insurance-claims";
  }

  return "/dashboard";
}
