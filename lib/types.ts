export const roles = [
  "administrator",
  "director",
  "staff",
  "doctor",
  "assistance_company"
] as const;
export type Role = (typeof roles)[number];

export const serviceCategories = [
  "Consultation",
  "Procedures",
  "IV Therapy",
  "Wound Care",
  "Vaccines / ARV",
  "Lab Services",
  "Day Care Admissions",
  "Medication Charges",
  "Consumables Charges",
  "Hospital Charges",
  "Other Charges"
] as const;

export type ServiceCategory = (typeof serviceCategories)[number];

export const serviceStorageKey = "health-aid-services-v1";
export const doctorStorageKey = "health-aid-doctors-v1";
export const doctorPaymentSettingsStorageKey = "health-aid-doctor-payment-settings-v1";
export const assistanceCompanyStorageKey = "health-aid-assistance-companies-v1";
export const insuranceClaimStatusStorageKey = "health-aid-insurance-claim-status-v1";
export const userStorageKey = "health-aid-users-v1";

export const amountOnlyInvoiceServiceNames = [
  "Medication Charges",
  "Consumables Charges"
] as const;

export function isAmountOnlyInvoiceServiceName(name?: string) {
  return Boolean(
    name && (amountOnlyInvoiceServiceNames as readonly string[]).includes(name)
  );
}

export const payoutEligibleCategories: ServiceCategory[] = [
  "Consultation",
  "Procedures",
  "IV Therapy",
  "Wound Care",
  "Vaccines / ARV"
];

export function isPayoutEligibleCategory(category: ServiceCategory) {
  return payoutEligibleCategories.includes(category);
}

export function defaultPayoutEnabledForCategory(category: ServiceCategory) {
  return isPayoutEligibleCategory(category);
}

export const paymentMethods = ["cash", "card", "bank_transfer", "insurance", "other"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export type RuleType = "fixed" | "percentage" | "none";
export type PayoutStatus = "unpaid" | "paid";
export type VoucherStatus = "unpaid" | "paid";
export type InsuranceReceivableStatus = "Pending" | "Partially Paid" | "Paid" | "Overdue";
export type InsuranceClaimStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Paid"
  | "Rejected"
  | "Overdue";
export type DoctorPaymentModelType = "low_season" | "peak_season";
export type PayoutMode = "invoice" | "shift" | "pending_shift";

export type LowSeasonPaymentModel = {
  dayConsultationPayout: number;
  nightConsultationPayout: number;
  nightStartTime: string;
  nightEndTime: string;
};

export type PeakSeasonPaymentModel = {
  shiftStartTime: string;
  shiftEndTime: string;
  hourlyRate: number;
  bonusThresholdPatients: number;
  bonusPerPatient: number;
};

export type DoctorPaymentModel = {
  activeModel: DoctorPaymentModelType;
  lowSeason: LowSeasonPaymentModel;
  peakSeason: PeakSeasonPaymentModel;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  doctorId?: string;
  assistanceCompany?: string;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  username: string;
  password: string;
  role: Role;
  status: "active" | "inactive";
  doctorId?: string;
  assistanceCompanyId?: string;
  assistanceCompany?: string;
};

export type Doctor = {
  id: string;
  name: string;
  designation: string;
  registrationNo?: string;
  phone?: string;
  notes?: string;
  active: boolean;
};

export type Service = {
  id: string;
  name: string;
  category: ServiceCategory;
  sellingPrice: number;
  payoutEnabled: boolean;
  defaultPayoutType: RuleType;
  defaultPayoutValue: number;
  defaultPayoutReason: string;
  active: boolean;
};

export type AssistanceCompany = {
  id: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  defaultClaimPercentage: number;
  active: boolean;
  notes?: string;
};

export function isServicePayoutEnabled(service: Service) {
  return service.payoutEnabled && service.defaultPayoutType !== "none";
}

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
  time?: string;
  patientName: string;
  passport?: string;
  phone?: string;
  email?: string;
  nationality?: string;
  doctorId: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  paymentMethod: PaymentMethod;
  assistanceCompanyId?: string;
  assistanceCompanyName?: string;
  claimPercentage?: number;
  claimAmount?: number;
  claimStatus?: InsuranceClaimStatus;
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
  time?: string;
  serviceName: string;
  paymentReason: string;
  payoutAmount: number;
  status: PayoutStatus;
  payoutMode?: PayoutMode;
  shiftStartTime?: string;
  shiftEndTime?: string;
  patientCount?: number;
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

export type InsuranceReceivable = {
  id: string;
  insuranceCompany: string;
  patients: string[];
  invoices: string[];
  billedDate: string;
  paidDate?: string;
  totalBilled: number;
  paidAmount: number;
  status: InsuranceReceivableStatus;
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
  assistanceCompanies: AssistanceCompany[];
  insuranceReceivables: InsuranceReceivable[];
  users: ManagedUser[];
  auditLogs: AuditLog[];
};
