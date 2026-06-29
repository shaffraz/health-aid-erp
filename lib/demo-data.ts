import {
  calculateInvoiceTotals,
  generatePayoutsForInvoices
} from "@/lib/calculations";
import { defaultDoctorPaymentModel } from "@/lib/doctor-payment";
import { todayISO } from "@/lib/format";
import type {
  AuditLog,
  Doctor,
  DoctorPaymentRule,
  InsuranceReceivable,
  Invoice,
  InvoiceItem,
  PayoutVoucher,
  Service,
  WorkspaceData
} from "@/lib/types";

const today = todayISO();
const monthStart = `${today.slice(0, 7)}-01`;

export const demoSettings = {
  exchangeRateLkrPerUsd: 300
};

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
    notes: "Low season per-patient consultation model.",
    active: true
  },
  {
    id: "doc-samara",
    name: "Dr. Samara Wijesinghe",
    designation: "Procedures and wound care doctor",
    registrationNo: "SLMC 46702",
    phone: "+94 75 889 6440",
    notes: "Peak season shift model for evening procedure cover.",
    active: true
  }
];

export const demoServices: Service[] = [
  {
    id: "svc-consult",
    name: "General consultation",
    category: "Consultation",
    sellingPrice: 11.67,
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
    sellingPrice: 21.67,
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
    sellingPrice: 9.33,
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
    sellingPrice: 31.67,
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
    sellingPrice: 17.33,
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
    sellingPrice: 61.67,
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
    invoiceNo: "HA-ABAY-2026-0001",
    date: today,
    time: "10:25",
    patientName: "Mia Carter",
    passport: "P8942013",
    phone: "+61 412 300 771",
    nationality: "Australian",
    doctorId: "doc-ameer",
    items: [item("item-001-a", "svc-emergency-consult"), item("item-001-b", "svc-iv")],
    discount: 500,
    paymentMethod: "card",
    notes: "Traveller with dehydration symptoms. Paid by card.",
    createdBy: "demo-admin"
  }),
  invoice({
    id: "inv-002",
    invoiceNo: "HA-ABAY-2026-0002",
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
    invoiceNo: "HA-ABAY-2026-0003",
    date: monthStart,
    time: "23:15",
    patientName: "Chen Min",
    phone: "+86 155 9012 1188",
    nationality: "Chinese",
    doctorId: "doc-nadeesha",
    items: [item("item-003-a", "svc-consult"), item("item-003-b", "svc-cbc")],
    discount: 300,
    paymentMethod: "bank_transfer",
    notes: "Fever screen and basic labs.",
    createdBy: "demo-admin"
  })
];

const generatedPayouts = generatePayoutsForInvoices(demoInvoices, defaultDoctorPaymentModel);

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
    patients: ["Mia Carter", "Luka Weber"],
    invoices: ["HA-ABAY-2026-0001", "HA-ABAY-2026-0002"],
    billedDate: today,
    totalBilled: 920,
    paidAmount: 0,
    status: "Pending"
  },
  {
    id: "ins-rec-002",
    insuranceCompany: "NomadCare Insurance",
    patients: ["Amelia Brooks"],
    invoices: ["HA-ABAY-2026-0007"],
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
    invoices: ["HA-ABAY-2026-0003"],
    billedDate: monthStart,
    paidDate: today,
    totalBilled: 430,
    paidAmount: 430,
    status: "Paid"
  },
  {
    id: "ins-rec-004",
    insuranceCompany: "Island Rescue Claims",
    patients: ["Noah Jensen", "Sofia Lind"],
    invoices: ["HA-ABAY-2026-0008", "HA-ABAY-2026-0009"],
    billedDate: monthStart,
    totalBilled: 1180,
    paidAmount: 250,
    status: "Overdue"
  }
];

export const demoAuditLogs: AuditLog[] = [
  {
    id: "audit-001",
    actor: "Admin",
    action: "invoice.created",
    entityType: "invoice",
    entityId: "inv-001",
    timestamp: `${today}T08:25:00+05:30`,
    summary: "Created invoice HA-ABAY-2026-0001 and generated doctor payouts."
  },
  {
    id: "audit-002",
    actor: "Accountant",
    action: "voucher.status_changed",
    entityType: "payout_voucher",
    entityId: "voucher-001",
    timestamp: `${today}T12:40:00+05:30`,
    summary: "Marked voucher DPV-2026-0001 as paid with reference BANK-TRF-8841."
  }
];

export const demoWorkspaceData: WorkspaceData = {
  doctors: demoDoctors,
  services: demoServices,
  paymentRules: demoPaymentRules,
  invoices: demoInvoices,
  payouts: demoPayouts,
  vouchers: demoVouchers,
  insuranceReceivables: demoInsuranceReceivables,
  auditLogs: demoAuditLogs
};
