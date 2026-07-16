import {
  calculateInvoiceTotals,
  generatePayoutsForInvoices
} from "@/lib/calculations";
import { defaultDoctorPaymentModel } from "@/lib/doctor-payment";
import { defaultSystemSettings } from "@/lib/settings";
import { todayISO } from "@/lib/format";
import type {
  AssistanceCompany,
  AuditLog,
  Doctor,
  DoctorPaymentRule,
  InsuranceReceivable,
  Invoice,
  InvoiceItem,
  ManagedUser,
  PayoutVoucher,
  Service,
  StaffMember,
  StaffSalaryRecord,
  WorkspaceData
} from "@/lib/types";

const today = todayISO();
const monthStart = `${today.slice(0, 7)}-01`;
const demoInvoicePrefix = defaultSystemSettings.invoice.invoicePrefix;

export const demoSettings = {
  exchangeRateLkrPerUsd: 300
};

export const demoAssistanceCompanies: AssistanceCompany[] = [
  {
    id: "assist-global-travel",
    name: "Global Travel Assist",
    contactPerson: "Maya Fernando",
    email: "claims@globaltravel.example",
    phone: "+94 77 420 1188",
    defaultClaimPercentage: 80,
    active: true,
    notes: "Primary travel assistance partner for tourist claims."
  },
  {
    id: "assist-nomadcare",
    name: "NomadCare Insurance",
    contactPerson: "Jonas Meyer",
    email: "support@nomadcare.example",
    phone: "+49 30 2210 7711",
    defaultClaimPercentage: 75,
    active: true,
    notes: "Requires monthly summary statement."
  },
  {
    id: "assist-blue-ocean",
    name: "Blue Ocean Travel Cover",
    contactPerson: "Priya Raman",
    email: "claims@blueocean.example",
    phone: "+65 6220 7721",
    defaultClaimPercentage: 100,
    active: true,
    notes: "Full claim coverage for approved outpatient services."
  },
  {
    id: "assist-island-rescue",
    name: "Island Rescue Claims",
    contactPerson: "Sofia Lind",
    email: "accounts@islandrescue.example",
    phone: "+46 8 555 1200",
    defaultClaimPercentage: 85,
    active: false,
    notes: "Inactive pending updated contract."
  }
];

export const demoUsers: ManagedUser[] = [
  {
    id: "user-administrator",
    name: "Demo Administrator",
    email: "administrator@healthaid.local",
    phone: "+94 77 100 1000",
    username: "administrator",
    password: "demo-password",
    role: "administrator",
    administratorPrivileges: true,
    status: "active"
  },
  {
    id: "user-director",
    name: "Demo Company Director",
    email: "director@healthaid.local",
    phone: "+94 77 100 1001",
    username: "director",
    password: "demo-password",
    role: "director",
    administratorPrivileges: false,
    status: "active"
  },
  {
    id: "user-staff",
    name: "Demo Staff",
    email: "staff@healthaid.local",
    phone: "+94 77 100 1002",
    username: "staff",
    password: "demo-password",
    role: "staff",
    administratorPrivileges: false,
    status: "active"
  },
  {
    id: "user-doctor",
    name: "Dr. Ameer Hassan",
    email: "doctor@healthaid.local",
    phone: "+94 77 412 1098",
    username: "doctor",
    password: "demo-password",
    role: "doctor",
    administratorPrivileges: false,
    status: "active",
    doctorId: "doc-ameer"
  },
  {
    id: "user-assistance-company",
    name: "Global Travel Assist",
    email: "assistance@healthaid.local",
    phone: "+94 77 420 1188",
    username: "global-travel",
    password: "demo-password",
    role: "assistance_company",
    administratorPrivileges: false,
    status: "active",
    assistanceCompanyId: "assist-global-travel",
    assistanceCompany: "Global Travel Assist"
  }
];

export const demoStaffMembers: StaffMember[] = [
  {
    id: "staff-demo-reception",
    fullName: "Demo Staff",
    designation: "Reception and billing",
    mobileNumber: "+94 77 100 1002",
    email: "staff@healthaid.local",
    notes: "Handles invoice creation and front desk coordination.",
    joinDate: "2026-01-10",
    status: "active",
    userId: "user-staff"
  },
  {
    id: "staff-clinic-assistant",
    fullName: "Nimali Perera",
    designation: "Clinic assistant",
    mobileNumber: "+94 77 155 2201",
    email: "nimali@healthaid.local",
    notes: "Assists with day care admissions and consumables.",
    joinDate: "2026-03-01",
    status: "active"
  }
];

export const demoDoctors: Doctor[] = [
  {
    id: "doc-ameer",
    name: "Dr. Ameer Hassan",
    designation: "Emergency physician",
    registrationNo: "SLMC 48291",
    phone: "+94 77 412 1098",
    notes: "Handles urgent travel medicine consultations.",
    active: true
  },
  {
    id: "doc-nadeesha",
    name: "Dr. Nadeesha Perera",
    designation: "General practitioner",
    registrationNo: "SLMC 51904",
    phone: "+94 76 203 7712",
    notes: "On-Call per-patient consultation model.",
    active: true
  },
  {
    id: "doc-samara",
    name: "Dr. Samara Wijesinghe",
    designation: "Procedures and wound care doctor",
    registrationNo: "SLMC 46702",
    phone: "+94 75 889 6440",
    notes: "Clinic Shift model for evening procedure cover.",
    active: true
  }
];

export const demoServices: Service[] = [
  {
    id: "svc-consult",
    name: "General consultation",
    category: "Consultation",
    sellingPrice: 12,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 1800,
    defaultPayoutReason: "Consultation professional fee",
    active: true
  },
  {
    id: "svc-emergency-consult",
    name: "Emergency consultation",
    category: "Consultation",
    sellingPrice: 22,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 3500,
    defaultPayoutReason: "Emergency consultation share",
    active: true
  },
  {
    id: "svc-cbc",
    name: "CBC lab test",
    category: "Lab Services",
    sellingPrice: 9,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "No doctor payout for lab item",
    active: true
  },
  {
    id: "svc-iv",
    name: "IV rehydration therapy",
    category: "IV Therapy",
    sellingPrice: 32,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 2200,
    defaultPayoutReason: "IV therapy supervision",
    active: true
  },
  {
    id: "svc-wound",
    name: "Wound cleaning and dressing",
    category: "Wound Care",
    sellingPrice: 17,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 1600,
    defaultPayoutReason: "Wound care procedure fee",
    active: true
  },
  {
    id: "svc-rabies",
    name: "Rabies vaccine dose",
    category: "Vaccines / ARV",
    sellingPrice: 24,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 900,
    defaultPayoutReason: "Vaccine administration fee",
    active: true
  },
  {
    id: "svc-injection",
    name: "Injection administration",
    category: "Procedures",
    sellingPrice: 6,
    payoutEnabled: true,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 600,
    defaultPayoutReason: "Injection administration fee",
    active: true
  },
  {
    id: "svc-medication-charges",
    name: "Medication Charges",
    category: "Medication Charges",
    sellingPrice: 0,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "Medication charges do not generate doctor payout",
    active: true
  },
  {
    id: "svc-consumables-charges",
    name: "Consumables Charges",
    category: "Consumables Charges",
    sellingPrice: 0,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "Consumables charges do not generate doctor payout",
    active: true
  },
  {
    id: "svc-daycare",
    name: "Day care admission package",
    category: "Day Care Admissions",
    sellingPrice: 62,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "No doctor payout for day care admission charge",
    active: true
  },
  {
    id: "svc-hospital",
    name: "Hospital facility charge",
    category: "Hospital Charges",
    sellingPrice: 15,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "No doctor payout for hospital charge",
    active: true
  },
  {
    id: "svc-other",
    name: "Other medical charge",
    category: "Other Charges",
    sellingPrice: 5,
    payoutEnabled: false,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "No doctor payout for other charge",
    active: true
  }
];

export const demoPaymentRules: DoctorPaymentRule[] = [
  {
    id: "rule-ameer-emergency",
    doctorId: "doc-ameer",
    serviceId: "svc-emergency-consult",
    type: "fixed",
    value: 3800,
    reason: "Emergency consultation senior doctor share",
    priority: 100
  },
  {
    id: "rule-nadeesha-consult",
    doctorId: "doc-nadeesha",
    category: "Consultation",
    type: "fixed",
    value: 2000,
    reason: "Consultation session fee",
    priority: 80
  },
  {
    id: "rule-samara-wound",
    doctorId: "doc-samara",
    category: "Wound Care",
    type: "fixed",
    value: 1800,
    reason: "Wound care doctor payout",
    priority: 90
  }
];

function item(id: string, serviceId: string, quantity = 1): InvoiceItem {
  const service = demoServices.find((candidate) => candidate.id === serviceId);

  if (!service) {
    throw new Error(`Missing demo service ${serviceId}`);
  }

  return {
    id,
    serviceId,
    serviceName: service.name,
    category: service.category,
    quantity,
    unitPrice: service.sellingPrice,
    lineTotal: service.sellingPrice * quantity
  };
}

function invoice(seed: Omit<Invoice, "subtotal" | "totalAmount">): Invoice {
  const totals = calculateInvoiceTotals(seed.items, seed.discount);
  return {
    ...seed,
    subtotal: totals.subtotal,
    discount: totals.discount,
    totalAmount: totals.totalAmount
  };
}

export const demoInvoices: Invoice[] = [
  invoice({
    id: "inv-001",
    invoiceNo: `${demoInvoicePrefix}-2026-0001`,
    date: today,
    time: "10:25",
    patientName: "Mia Carter",
    passport: "P8942013",
    phone: "+61 412 300 771",
    nationality: "Australian",
    doctorId: "doc-ameer",
    items: [item("item-001-a", "svc-emergency-consult"), item("item-001-b", "svc-iv")],
    discount: 0,
    paymentMethod: "insurance",
    assistanceCompanyId: "assist-global-travel",
    assistanceCompanyName: "Global Travel Assist",
    claimPercentage: 80,
    claimAmount: 43,
    claimStatus: "Submitted",
    notes: "Traveller with dehydration symptoms. Billed to insurance.",
    createdBy: "demo-administrator"
  }),
  invoice({
    id: "inv-002",
    invoiceNo: `${demoInvoicePrefix}-2026-0002`,
    date: today,
    time: "17:30",
    patientName: "Luka Weber",
    passport: "C1029831",
    phone: "+49 176 555 0192",
    nationality: "German",
    doctorId: "doc-samara",
    items: [item("item-002-a", "svc-wound"), item("item-002-b", "svc-rabies")],
    discount: 0,
    paymentMethod: "cash",
    notes: "Surfboard cut and vaccine counselling.",
    createdBy: "demo-staff"
  }),
  invoice({
    id: "inv-003",
    invoiceNo: `${demoInvoicePrefix}-2026-0003`,
    date: monthStart,
    time: "23:15",
    patientName: "Chen Min",
    phone: "+86 155 9012 1188",
    nationality: "Chinese",
    doctorId: "doc-nadeesha",
    items: [item("item-003-a", "svc-consult"), item("item-003-b", "svc-cbc")],
    discount: 0,
    paymentMethod: "insurance",
    assistanceCompanyId: "assist-blue-ocean",
    assistanceCompanyName: "Blue Ocean Travel Cover",
    claimPercentage: 100,
    claimAmount: 21,
    claimStatus: "Paid",
    notes: "Fever screen and basic labs.",
    createdBy: "demo-administrator"
  })
];

const generatedPayouts = generatePayoutsForInvoices(
  demoInvoices,
  defaultDoctorPaymentModel,
  defaultSystemSettings.operational.activePaymentMode
);

export const demoPayouts = generatedPayouts.map((payout, index) => ({
  ...payout,
  status: index === 1 ? ("paid" as const) : payout.status,
  voucherNo: index === 1 ? "DPV-2026-0001" : undefined
}));

export const demoVouchers: PayoutVoucher[] = [
  {
    id: "voucher-001",
    voucherNo: "DPV-2026-0001",
    doctorId: "doc-nadeesha",
    periodStart: monthStart,
    periodEnd: today,
    payoutIds: demoPayouts.filter((payout) => payout.voucherNo === "DPV-2026-0001").map((payout) => payout.id),
    totalAmount: demoPayouts
      .filter((payout) => payout.voucherNo === "DPV-2026-0001")
      .reduce((sum, payout) => sum + payout.payoutAmount, 0),
    status: "paid",
    paymentReference: "BANK-TRF-8841",
    paymentDate: today,
    notes: "Paid after monthly reconciliation."
  }
];

export const demoInsuranceReceivables: InsuranceReceivable[] = [
  {
    id: "ins-rec-001",
    insuranceCompany: "Global Travel Assist",
    patients: ["Mia Carter"],
    invoices: [`${demoInvoicePrefix}-2026-0001`],
    billedDate: today,
    totalBilled: 54,
    paidAmount: 0,
    status: "Pending"
  },
  {
    id: "ins-rec-002",
    insuranceCompany: "NomadCare Insurance",
    patients: ["Amelia Brooks"],
    invoices: [`${demoInvoicePrefix}-2026-0007`],
    billedDate: today,
    paidDate: today,
    totalBilled: 640,
    paidAmount: 280,
    status: "Partially Paid"
  },
  {
    id: "ins-rec-003",
    insuranceCompany: "Blue Ocean Travel Cover",
    patients: ["Chen Min"],
    invoices: [`${demoInvoicePrefix}-2026-0003`],
    billedDate: monthStart,
    paidDate: today,
    totalBilled: 21,
    paidAmount: 21,
    status: "Paid"
  },
  {
    id: "ins-rec-004",
    insuranceCompany: "Island Rescue Claims",
    patients: ["Noah Jensen", "Sofia Lind"],
    invoices: [`${demoInvoicePrefix}-2026-0008`, `${demoInvoicePrefix}-2026-0009`],
    billedDate: monthStart,
    totalBilled: 1180,
    paidAmount: 250,
    status: "Overdue"
  }
];

export const demoAuditLogs: AuditLog[] = [
  {
    id: "audit-001",
    actor: "Administrator",
    action: "invoice.created",
    entityType: "invoice",
    entityId: "inv-001",
    timestamp: `${today}T08:25:00+05:30`,
    summary: `Created invoice ${demoInvoicePrefix}-2026-0001 and generated doctor payouts.`
  },
  {
    id: "audit-002",
    actor: "Company Director",
    action: "voucher.status_changed",
    entityType: "payout_voucher",
    entityId: "voucher-001",
    timestamp: `${today}T12:40:00+05:30`,
    summary: "Marked voucher DPV-2026-0001 as paid with reference BANK-TRF-8841."
  }
];

export const demoStaffSalaryRecords: StaffSalaryRecord[] = [
  {
    id: "salary-staff-july-2026",
    staffUserId: "user-staff",
    salaryPeriod: today.slice(0, 7),
    baseSalaryLkr: 90000,
    additionalPaymentLkr: 10000,
    deductionLkr: 0,
    netSalaryLkr: 100000,
    status: "Approved",
    notes: "Operational staff salary for the current period.",
    createdAt: `${monthStart}T09:00:00+05:30`,
    updatedAt: `${today}T09:00:00+05:30`
  },
  {
    id: "salary-staff-june-2026",
    staffUserId: "user-staff",
    salaryPeriod: "2026-06",
    baseSalaryLkr: 90000,
    additionalPaymentLkr: 5000,
    deductionLkr: 0,
    netSalaryLkr: 95000,
    status: "Paid",
    paidAt: "2026-06-30",
    paymentReference: "SAL-202606-001",
    notes: "Paid by bank transfer.",
    createdAt: "2026-06-01T09:00:00+05:30",
    updatedAt: "2026-06-30T15:00:00+05:30"
  }
];

export const demoWorkspaceData: WorkspaceData = {
  doctors: demoDoctors,
  services: demoServices,
  paymentRules: demoPaymentRules,
  invoices: demoInvoices,
  payouts: demoPayouts,
  vouchers: demoVouchers,
  assistanceCompanies: demoAssistanceCompanies,
  insuranceReceivables: demoInsuranceReceivables,
  users: demoUsers,
  staffMembers: demoStaffMembers,
  staffSalaryRecords: demoStaffSalaryRecords,
  auditLogs: demoAuditLogs
};
