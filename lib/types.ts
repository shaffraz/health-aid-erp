export const roles = ["admin", "staff", "doctor", "accountant"] as const;
export type Role = (typeof roles)[number];

export const serviceCategories = [
  "Consultation",
  "Consumables",
  "Hospital charges",
  "Lab services",
  "Procedures",
  "Other"
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export const amountOnlyInvoiceServiceNames = [
  "Medication Charges",
  "Consumables Charges"
] as const;

export function isAmountOnlyInvoiceServiceName(name?: string) {
  return Boolean(
    name && (amountOnlyInvoiceServiceNames as readonly string[]).includes(name)
  );
}

export const paymentMethods = ["cash", "card", "bank_transfer", "insurance", "other"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type RuleType = "fixed" | "percentage" | "none";
export type PayoutStatus = "unpaid" | "paid";
export type VoucherStatus = "unpaid" | "paid";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  doctorId?: string;
};

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  registrationNo?: string;
  phone?: string;
  email?: string;
  active: boolean;
};

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  sellingPrice: number;
  defaultPayoutType: RuleType;
  defaultPayoutValue: number;
  defaultPayoutReason: string;
  active: boolean;
};

export type DoctorPaymentRule = {
  id: string;
  doctorId: string;
  serviceId?: string;
  category?: ServiceCategory;
  type: RuleType;
  value: number;
  reason: string;
  priority: number;
};

export type InvoiceItem = {
  id: string;
  serviceId: string;
  serviceName: string;
  category: ServiceCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type Invoice = {
  id: string;
  invoiceNo: string;
  date: string;
  patientName: string;
  passport?: string;
  phone?: string;
  nationality?: string;
  doctorId: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  totalAmount: number;
  createdBy: string;
};

export type DoctorPayout = {
  id: string;
  doctorId: string;
  invoiceId: string;
  invoiceNo: string;
  date: string;
  serviceName: string;
  paymentReason: string;
  payoutAmount: number;
  status: PayoutStatus;
  voucherNo?: string;
};

export type PayoutVoucher = {
  id: string;
  voucherNo: string;
  doctorId: string;
  periodStart: string;
  periodEnd: string;
  payoutIds: string[];
  totalAmount: number;
  status: VoucherStatus;
  paymentReference?: string;
  paymentDate?: string;
  notes?: string;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  summary: string;
};

export type WorkspaceData = {
  doctors: Doctor[];
  services: Service[];
  paymentRules: DoctorPaymentRule[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
  vouchers: PayoutVoucher[];
  auditLogs: AuditLog[];
};
