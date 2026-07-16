"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeRole } from "@/lib/auth";
import { generateId } from "@/lib/id";
import { hasPermission, permissions } from "@/lib/permissions";
import { createSupabaseServerClient, isSupabaseConfigured } from "@/lib/supabase/server";
import {
  isAmountOnlyInvoiceServiceName,
  paymentMethods,
  serviceCategories,
  type Role
} from "@/lib/types";

type ActionSuccess<T> = [T] extends [undefined]
  ? { ok: true; demo?: boolean }
  : { ok: true; demo?: boolean; data: T };
type ActionResult<T = undefined> = ActionSuccess<T> | { ok: false; error: string };
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Permission = keyof typeof permissions;
type SupabaseActionContext =
  | { supabase: null; userId: string; role: Role; error?: never }
  | { supabase: SupabaseServerClient; userId: string; role: Role; error?: never }
  | { supabase: SupabaseServerClient; userId?: never; error: string };

const nonEmptyText = z.string().trim().min(1);
const optionalText = z.string().trim().optional();

const invoiceSchema = z.object({
  patientName: nonEmptyText.max(160),
  passport: optionalText,
  phone: optionalText,
  nationality: optionalText,
  doctorId: z.string().uuid().or(z.string().min(1)),
  discount: z.coerce.number().min(0).default(0),
  paymentMethod: z.enum(paymentMethods),
  notes: optionalText,
  items: z
    .array(
      z.object({
        serviceId: z.string().uuid().or(z.string().min(1)),
        quantity: z.coerce.number().int().positive(),
        unitPrice: z.coerce.number().min(0).optional()
      })
    )
    .min(1)
});

const serviceSchema = z.object({
  name: nonEmptyText.max(160),
  category: z.enum(serviceCategories),
  sellingPrice: z.coerce.number().min(0),
  defaultPayoutType: z.enum(["fixed", "percentage", "none"]),
  defaultPayoutValue: z.coerce.number().min(0),
  defaultPayoutReason: z.string().trim().max(240).default("No doctor payout configured")
});

const doctorSchema = z.object({
  name: nonEmptyText.max(160),
  specialty: optionalText,
  registrationNo: optionalText,
  phone: optionalText,
  email: optionalText
});

const doctorRuleSchema = z.object({
  doctorId: z.string().uuid().or(z.string().min(1)),
  serviceId: z.string().uuid().or(z.string().min(1)).optional(),
  category: z.enum(serviceCategories).optional(),
  type: z.enum(["fixed", "percentage", "none"]),
  value: z.coerce.number().min(0),
  reason: nonEmptyText.max(240),
  priority: z.coerce.number().int().min(0).max(1000).default(50)
});

const voucherSchema = z.object({
  doctorId: z.string().uuid().or(z.string().min(1)),
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

const voucherStatusSchema = z.object({
  voucherId: z.string().uuid().or(z.string().min(1)),
  status: z.enum(["paid", "unpaid"]),
  paymentReference: optionalText,
  paymentDate: optionalText,
  notes: optionalText
});

async function getSupabaseUser(): Promise<SupabaseActionContext> {
  if (!isSupabaseConfigured()) {
    return { supabase: null, userId: "demo-user", role: "administrator" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, error: "You must be signed in to perform this action." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { supabase, error: "Your user profile is missing. Please contact an administrator." };
  }

  return { supabase, userId: user.id, role: normalizeRole(profile.role) };
}

function emptyToNull(value?: string) {
  return value?.trim() ? value.trim() : null;
}

function requireActionPermission(auth: SupabaseActionContext, permission: Permission) {
  if ("error" in auth) {
    return auth.error;
  }

  if (!hasPermission(auth.role, permission)) {
    return "Your role does not have permission to perform this action.";
  }

  return null;
}

export async function createInvoiceAction(input: unknown): Promise<ActionResult<{ invoiceNo: string; invoiceId: string; date: string }>> {
  const parsed = invoiceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Please complete the required invoice fields." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "createInvoices");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return {
      ok: true,
      demo: true,
      data: { invoiceNo: "demo", invoiceId: generateId(), date: new Date().toISOString().slice(0, 10) }
    };
  }

  const serviceIds = [...new Set(parsed.data.items.map((item) => item.serviceId))];
  const { data: services, error: servicesError } = await auth.supabase
    .from("services")
    .select("id, name, category, selling_price")
    .in("id", serviceIds);

  if (servicesError || !services?.length) {
    return { ok: false, error: "Unable to load selected services." };
  }

  const serviceById = new Map(services.map((service) => [service.id, service]));
  let amountOnlyServiceMissingAmount = false;
  const itemRows = parsed.data.items.map((item) => {
    const service = serviceById.get(item.serviceId);

    if (!service) {
      throw new Error("A selected service no longer exists.");
    }

    const isAmountOnlyService = isAmountOnlyInvoiceServiceName(service.name);
    const unitPrice = isAmountOnlyService
      ? Number(item.unitPrice ?? 0)
      : Number(service.selling_price);

    if (isAmountOnlyService && unitPrice <= 0) {
      amountOnlyServiceMissingAmount = true;
    }

    return {
      service_id: service.id,
      service_name: service.name,
      category: service.category,
      quantity: isAmountOnlyService ? 1 : item.quantity,
      unit_price: unitPrice
    };
  });

  if (amountOnlyServiceMissingAmount) {
    return { ok: false, error: "Please enter an amount for the selected charge service." };
  }

  const subtotal = itemRows.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discount = Math.min(parsed.data.discount, subtotal);
  const totalAmount = subtotal - discount;

  const { data: invoice, error: invoiceError } = await auth.supabase
    .from("invoices")
    .insert({
      patient_name: parsed.data.patientName,
      passport: emptyToNull(parsed.data.passport),
      phone: emptyToNull(parsed.data.phone),
      nationality: emptyToNull(parsed.data.nationality),
      doctor_id: parsed.data.doctorId,
      subtotal,
      discount,
      payment_method: parsed.data.paymentMethod,
      notes: emptyToNull(parsed.data.notes),
      total_amount: totalAmount,
      created_by: auth.userId
    })
    .select("id, invoice_no, invoice_date")
    .single();

  if (invoiceError || !invoice) {
    return { ok: false, error: invoiceError?.message ?? "Unable to create invoice." };
  }

  const { error: itemsError } = await auth.supabase.from("invoice_items").insert(
    itemRows.map((item) => ({
      ...item,
      invoice_id: invoice.id
    }))
  );

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  revalidatePath("/dashboard");
  revalidatePath("/invoices");
  revalidatePath("/payouts");
  revalidatePath("/reports");
  revalidatePath("/doctor-portal");

  return {
    ok: true,
    data: {
      invoiceNo: invoice.invoice_no,
      invoiceId: invoice.id,
      date: invoice.invoice_date
    }
  };
}

export async function createServiceAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Please complete the service setup fields." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "manageServices");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return { ok: true, demo: true, data: { id: generateId() } };
  }

  const { data, error } = await auth.supabase
    .from("services")
    .insert({
      name: parsed.data.name,
      category: parsed.data.category,
      selling_price: parsed.data.sellingPrice,
      default_payout_type: parsed.data.defaultPayoutType,
      default_payout_value: parsed.data.defaultPayoutValue,
      default_payout_reason: parsed.data.defaultPayoutReason,
      created_by: auth.userId
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to create service." };
  }

  revalidatePath("/services");
  revalidatePath("/invoices/new");

  return { ok: true, data: { id: data.id } };
}

export async function createDoctorAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = doctorSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Please complete the doctor setup fields." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "manageDoctors");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return { ok: true, demo: true, data: { id: generateId() } };
  }

  const { data, error } = await auth.supabase
    .from("doctors")
    .insert({
      full_name: parsed.data.name,
      specialty: emptyToNull(parsed.data.specialty),
      registration_no: emptyToNull(parsed.data.registrationNo),
      phone: emptyToNull(parsed.data.phone),
      email: emptyToNull(parsed.data.email)
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to create doctor." };
  }

  revalidatePath("/doctors");
  revalidatePath("/invoices/new");

  return { ok: true, data: { id: data.id } };
}

export async function createDoctorPaymentRuleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = doctorRuleSchema.safeParse(input);

  if (!parsed.success || (!parsed.data.serviceId && !parsed.data.category)) {
    return { ok: false, error: "Please choose either a service or category for the rule." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "manageDoctors");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return { ok: true, demo: true, data: { id: generateId() } };
  }

  const { data, error } = await auth.supabase
    .from("doctor_payment_rules")
    .insert({
      doctor_id: parsed.data.doctorId,
      service_id: parsed.data.serviceId ?? null,
      category: parsed.data.category ?? null,
      rule_type: parsed.data.type,
      rule_value: parsed.data.value,
      reason: parsed.data.reason,
      priority: parsed.data.priority,
      created_by: auth.userId
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Unable to create payment rule." };
  }

  revalidatePath("/doctors");
  revalidatePath("/invoices/new");

  return { ok: true, data: { id: data.id } };
}

export async function generatePayoutVoucherAction(input: unknown): Promise<ActionResult<{ id: string; voucherNo: string; payoutIds: string[]; totalAmount: number }>> {
  const parsed = voucherSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Please choose a doctor and month." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "managePayouts");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return {
      ok: true,
      demo: true,
      data: { id: generateId(), voucherNo: "demo", payoutIds: [], totalAmount: 0 }
    };
  }

  const [year, selectedMonth] = parsed.data.month.split("-").map(Number);
  const periodStart = `${parsed.data.month}-01`;
  const periodEnd = new Date(Date.UTC(year, selectedMonth, 0)).toISOString().slice(0, 10);

  const { data: payouts, error: payoutError } = await auth.supabase
    .from("doctor_payouts")
    .select("id, payout_amount")
    .eq("doctor_id", parsed.data.doctorId)
    .eq("status", "unpaid")
    .is("voucher_id", null)
    .gte("invoice_date", periodStart)
    .lte("invoice_date", periodEnd);

  if (payoutError) {
    return { ok: false, error: payoutError.message };
  }

  if (!payouts?.length) {
    return { ok: false, error: "No unpaid payouts are available for this doctor and month." };
  }

  const totalAmount = payouts.reduce((sum, payout) => sum + Number(payout.payout_amount), 0);

  const { data: voucher, error: voucherError } = await auth.supabase
    .from("payout_vouchers")
    .insert({
      doctor_id: parsed.data.doctorId,
      period_start: periodStart,
      period_end: periodEnd,
      total_amount: totalAmount,
      generated_by: auth.userId
    })
    .select("id, voucher_no")
    .single();

  if (voucherError || !voucher) {
    return { ok: false, error: voucherError?.message ?? "Unable to generate voucher." };
  }

  const payoutIds = payouts.map((payout) => payout.id);
  const { error: itemError } = await auth.supabase.from("payout_voucher_items").insert(
    payoutIds.map((payoutId) => ({
      voucher_id: voucher.id,
      payout_id: payoutId
    }))
  );

  if (itemError) {
    return { ok: false, error: itemError.message };
  }

  const { error: updateError } = await auth.supabase
    .from("doctor_payouts")
    .update({
      voucher_id: voucher.id,
      voucher_no: voucher.voucher_no,
      edited_by: auth.userId
    })
    .in("id", payoutIds);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  revalidatePath("/payouts");
  revalidatePath("/reports");
  revalidatePath("/doctor-portal");

  return {
    ok: true,
    data: {
      id: voucher.id,
      voucherNo: voucher.voucher_no,
      payoutIds,
      totalAmount
    }
  };
}

export async function updateVoucherStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = voucherStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "Please complete voucher payment details." };
  }

  const auth = await getSupabaseUser();
  if (auth.error) {
    return { ok: false, error: auth.error };
  }
  const permissionError = requireActionPermission(auth, "managePayouts");
  if (permissionError) {
    return { ok: false, error: permissionError };
  }

  if (!auth.supabase) {
    return { ok: true, demo: true };
  }

  const { error: voucherError } = await auth.supabase
    .from("payout_vouchers")
    .update({
      status: parsed.data.status,
      payment_reference: parsed.data.status === "paid" ? emptyToNull(parsed.data.paymentReference) : null,
      payment_date: parsed.data.status === "paid" ? emptyToNull(parsed.data.paymentDate) : null,
      notes: emptyToNull(parsed.data.notes),
      paid_by: parsed.data.status === "paid" ? auth.userId : null
    })
    .eq("id", parsed.data.voucherId);

  if (voucherError) {
    return { ok: false, error: voucherError.message };
  }

  const { data: items, error: itemsError } = await auth.supabase
    .from("payout_voucher_items")
    .select("payout_id")
    .eq("voucher_id", parsed.data.voucherId);

  if (itemsError) {
    return { ok: false, error: itemsError.message };
  }

  const payoutIds = items?.map((item) => item.payout_id) ?? [];

  if (payoutIds.length) {
    const { error: payoutError } = await auth.supabase
      .from("doctor_payouts")
      .update({
        status: parsed.data.status,
        edited_by: auth.userId
      })
      .in("id", payoutIds);

    if (payoutError) {
      return { ok: false, error: payoutError.message };
    }
  }

  revalidatePath("/payouts");
  revalidatePath("/reports");
  revalidatePath("/doctor-portal");

  return { ok: true };
}
