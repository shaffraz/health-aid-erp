import {
  calculateInvoiceTotals,
  generatePayoutsForInvoice
} from "@/lib/calculations";
import { todayISO } from "@/lib/format";
import type {
  AuditLog,
  Doctor,
  DoctorPaymentRule,
  Invoice,
  InvoiceItem,
  PayoutVoucher,
  Service,
  WorkspaceData
} from "@/lib/types";

const today = todayISO();
const monthStart = `${today.slice(0, 7)}-01`;

export const demoDoctors: Doctor[] = [
  {
    id: "doc-ameer",
    name: "Dr. Ameer Hassan",
    specialty: "Emergency and travel medicine",
    registrationNo: "SLMC 48291",
    phone: "+94 77 412 1098",
    email: "ameer@healthaid.lk",
    active: true
  },
  {
    id: "doc-nadeesha",
    name: "Dr. Nadeesha Perera",
    specialty: "General practice",
    registrationNo: "SLMC 51904",
    phone: "+94 76 203 7712",
    email: "nadeesha@healthaid.lk",
    active: true
  },
  {
    id: "doc-samara",
    name: "Dr. Samara Wijesinghe",
    specialty: "Procedures and wound care",
    registrationNo: "SLMC 46702",
    phone: "+94 75 889 6440",
    email: "samara@healthaid.lk",
    active: true
  }
];

export const demoServices: Service[] = [
  {
    id: "svc-consult",
    name: "General consultation",
    category: "Consultation",
    sellingPrice: 3500,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 1800,
    defaultPayoutReason: "Consultation professional fee",
    active: true
  },
  {
    id: "svc-emergency-consult",
    name: "Emergency consultation",
    category: "Consultation",
    sellingPrice: 6500,
    defaultPayoutType: "percentage",
    defaultPayoutValue: 55,
    defaultPayoutReason: "Emergency consultation share",
    active: true
  },
  {
    id: "svc-cbc",
    name: "CBC lab test",
    category: "Lab services",
    sellingPrice: 2800,
    defaultPayoutType: "none",
    defaultPayoutValue: 0,
    defaultPayoutReason: "No doctor payout for lab item",
    active: true
  },
  {
    id: "svc-iv",
    name: "IV rehydration therapy",
    category: "IV therapy",
    sellingPrice: 9500,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 2200,
    defaultPayoutReason: "IV therapy supervision",
    active: true
  },
  {
    id: "svc-wound",
    name: "Wound cleaning and dressing",
    category: "Wound care",
    sellingPrice: 5200,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 1600,
    defaultPayoutReason: "Wound care procedure fee",
    active: true
  },
  {
    id: "svc-rabies",
    name: "Rabies vaccine dose",
    category: "ARV / vaccines",
    sellingPrice: 7200,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 900,
    defaultPayoutReason: "Vaccine administration fee",
    active: true
  },
  {
    id: "svc-injection",
    name: "Injection administration",
    category: "Injections",
    sellingPrice: 1800,
    defaultPayoutType: "fixed",
    defaultPayoutValue: 600,
    defaultPayoutReason: "Injection administration fee",
    active: true
  },
  {
    id: "svc-daycare",
    name: "Day care admission package",
    category: "Day care admissions",
    sellingPrice: 18500,
    defaultPayoutType: "percentage",
    defaultPayoutValue: 20,
    defaultPayoutReason: "Day care admission clinical oversight",
    active: true
  }
];

export const demoPaymentRules: DoctorPaymentRule[] = [
  {
    id: "rule-ameer-emergency",
    doctorId: "doc-ameer",
    serviceId: "svc-emergency-consult",
    type: "percentage",
    value: 65,
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
    category: "Wound care",
    type: "percentage",
    value: 45,
    reason: "Procedure percentage for wound care",
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
    invoiceNo: "HA-2026-0001",
    date: today,
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
    invoiceNo: "HA-2026-0002",
    date: today,
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
    invoiceNo: "HA-2026-0003",
    date: monthStart,
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

const generatedPayouts = demoInvoices.flatMap((createdInvoice) =>
  generatePayoutsForInvoice(createdInvoice, demoServices, demoPaymentRules)
);

export const demoPayouts = generatedPayouts.map((payout, index) => ({
  ...payout,
  status: index === 2 ? ("paid" as const) : payout.status,
  voucherNo: index === 2 ? "DPV-2026-0001" : undefined
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

export const demoAuditLogs: AuditLog[] = [
  {
    id: "audit-001",
    actor: "Admin",
    action: "invoice.created",
    entityType: "invoice",
    entityId: "inv-001",
    timestamp: `${today}T08:25:00+05:30`,
    summary: "Created invoice HA-2026-0001 and generated doctor payouts."
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
  auditLogs: demoAuditLogs
};
