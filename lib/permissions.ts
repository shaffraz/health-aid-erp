import type { Role } from "@/lib/types";

export const roleLabels: Record<Role, string> = {
  admin: "Admin",
  staff: "Staff",
  doctor: "Doctor",
  accountant: "Accountant"
};

export const permissions = {
  dashboard: ["admin", "staff", "accountant", "doctor"],
  createInvoices: ["admin", "staff"],
  viewInvoices: ["admin", "staff", "accountant"],
  manageServices: ["admin"],
  manageDoctors: ["admin"],
  doctorPortal: ["doctor"],
  managePayouts: ["admin", "accountant"],
  reports: ["admin", "accountant"],
  auditLogs: ["admin", "accountant"]
} satisfies Record<string, Role[]>;

export function hasPermission(role: Role, permission: keyof typeof permissions) {
  return (permissions[permission] as readonly Role[]).includes(role);
}
