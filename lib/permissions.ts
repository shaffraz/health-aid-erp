import type { Role } from "@/lib/types";

export const roleLabels: Record<Role, string> = {
  administrator: "Administrator",
  director: "Director",
  staff: "Staff",
  doctor: "Doctor",
  assistance_company: "Assistance Company"
};

export const permissions = {
  dashboard: ["administrator", "director", "staff"],
  createInvoices: ["administrator", "staff"],
  viewInvoices: ["administrator", "director", "staff"],
  deleteInvoices: ["administrator"],
  viewInsurance: ["administrator", "director", "staff", "assistance_company"],
  manageInsurance: ["administrator", "staff"],
  manageAssistanceCompanies: ["administrator"],
  viewServices: ["administrator", "staff"],
  manageServices: ["administrator"],
  viewDoctors: ["administrator", "director", "staff"],
  manageDoctors: ["administrator"],
  doctorPortal: ["doctor"],
  viewPayouts: ["administrator", "director"],
  managePayouts: ["administrator"],
  reports: ["administrator", "director"],
  manageUsers: ["administrator"],
  auditLogs: ["administrator", "director"]
} satisfies Record<string, Role[]>;

export function hasPermission(role: Role, permission: keyof typeof permissions) {
  return (permissions[permission] as readonly Role[]).includes(role);
}
