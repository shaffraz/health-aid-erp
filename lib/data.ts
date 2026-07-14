import { demoWorkspaceData } from "@/lib/demo-data";
import { withSupabaseTimeout } from "@/lib/supabase/config";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  Doctor,
  DoctorPaymentRule,
  DoctorPayout,
  Invoice,
  PayoutVoucher,
  Service,
  WorkspaceData
} from "@/lib/types";

type DatabaseInvoice = {
  id: string;
  invoice_no: string;
  invoice_date: string;
  invoice_time?: string | null;
  patient_name: string;
  passport: string | null;
  phone: string | null;
  nationality: string | null;
  doctor_id: string;
  subtotal: number;
  discount: number;
  payment_method: Invoice["paymentMethod"];
  notes: string | null;
  total_amount: number;
  created_by: string;
  invoice_items: Array<{
    id: string;
    service_id: string;
    service_name: string;
    category: Service["category"];
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
};

export async function getWorkspaceData(): Promise<WorkspaceData> {
  if (!isSupabaseConfigured()) {
    return demoWorkspaceData;
  }

  const supabase = await createSupabaseServerClient();

  const workspaceResult = await withSupabaseTimeout(
    Promise.all([
      supabase.from("doctors").select("*").order("full_name"),
      supabase.from("services").select("*").order("category").order("name"),
      supabase.from("doctor_payment_rules").select("*").order("priority", { ascending: false }),
      supabase
        .from("invoices")
        .select("*, invoice_items(*)")
        .order("invoice_date", { ascending: false })
        .order("invoice_no", { ascending: false }),
      supabase.from("doctor_payouts").select("*").order("invoice_date", { ascending: false }),
      supabase
        .from("payout_vouchers")
        .select("*, payout_voucher_items(payout_id)")
        .order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(50)
    ]),
    "Supabase workspace data"
  ).catch((error) => {
    console.warn("Supabase workspace data unavailable; using demo/local data.", error);
    return null;
  });

  if (!workspaceResult) {
    return demoWorkspaceData;
  }

  const [doctors, services, paymentRules, invoices, payouts, vouchers, auditLogs] =
    workspaceResult;

  if (
    doctors.error ||
    services.error ||
    paymentRules.error ||
    invoices.error ||
    payouts.error ||
    vouchers.error ||
    auditLogs.error
  ) {
    return demoWorkspaceData;
  }

  return {
    doctors: (doctors.data ?? []).map((doctor) => ({
      id: doctor.id,
      name: doctor.full_name,
      designation: doctor.specialty ?? "General practice",
      registrationNo: doctor.registration_no ?? undefined,
      phone: doctor.phone ?? undefined,
      notes: undefined,
      active: doctor.active
    })) satisfies Doctor[],
    services: (services.data ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      sellingPrice: Number(service.selling_price),
      payoutEnabled: service.default_payout_type !== "none",
      defaultPayoutType: service.default_payout_type,
      defaultPayoutValue: Number(service.default_payout_value),
      defaultPayoutReason: service.default_payout_reason,
      active: service.active
    })) satisfies Service[],
    paymentRules: (paymentRules.data ?? []).map((rule) => ({
      id: rule.id,
      doctorId: rule.doctor_id,
      serviceId: rule.service_id ?? undefined,
      category: rule.category ?? undefined,
      type: rule.rule_type,
      value: Number(rule.rule_value),
      reason: rule.reason,
      priority: rule.priority
    })) satisfies DoctorPaymentRule[],
    invoices: ((invoices.data ?? []) as DatabaseInvoice[]).map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoice_no,
      date: invoice.invoice_date,
      time: invoice.invoice_time ?? undefined,
      patientName: invoice.patient_name,
      passport: invoice.passport ?? undefined,
      phone: invoice.phone ?? undefined,
      nationality: invoice.nationality ?? undefined,
      doctorId: invoice.doctor_id,
      items: invoice.invoice_items.map((item) => ({
        id: item.id,
        serviceId: item.service_id,
        serviceName: item.service_name,
        category: item.category,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        lineTotal: Number(item.line_total)
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      paymentMethod: invoice.payment_method,
      notes: invoice.notes ?? undefined,
      totalAmount: Number(invoice.total_amount),
      createdBy: invoice.created_by
    })) satisfies Invoice[],
    payouts: (payouts.data ?? []).map((payout) => ({
      id: payout.id,
      doctorId: payout.doctor_id,
      invoiceId: payout.invoice_id,
      invoiceNo: payout.invoice_no,
      date: payout.invoice_date,
      time: undefined,
      serviceName: payout.service_name,
      paymentReason: payout.payment_reason,
      payoutAmount: Number(payout.payout_amount),
      status: payout.status,
      payoutMode: "invoice",
      voucherNo: payout.voucher_no ?? undefined
    })) satisfies DoctorPayout[],
    vouchers: (vouchers.data ?? []).map((voucher) => ({
      id: voucher.id,
      voucherNo: voucher.voucher_no,
      doctorId: voucher.doctor_id,
      periodStart: voucher.period_start,
      periodEnd: voucher.period_end,
      payoutIds: voucher.payout_voucher_items?.map((item: { payout_id: string }) => item.payout_id) ?? [],
      totalAmount: Number(voucher.total_amount),
      status: voucher.status,
      paymentReference: voucher.payment_reference ?? undefined,
      paymentDate: voucher.payment_date ?? undefined,
      notes: voucher.notes ?? undefined
    })) satisfies PayoutVoucher[],
    assistanceCompanies: demoWorkspaceData.assistanceCompanies,
    insuranceReceivables: [],
    users: demoWorkspaceData.users,
    auditLogs: (auditLogs.data ?? []).map((log) => ({
      id: log.id,
      actor: log.actor_name ?? "System",
      action: log.action,
      entityType: log.entity_type,
      entityId: log.entity_id,
      timestamp: log.created_at,
      summary: log.summary
    }))
  };
}
