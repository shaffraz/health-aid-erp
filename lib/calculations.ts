import {
  isAmountOnlyInvoiceServiceName,
  isServicePayoutEnabled,
  type DoctorPaymentRule,
  type DoctorPayout,
  type Invoice,
  type InvoiceItem,
  type RuleType,
  type Service
} from "@/lib/types";

export function calculateInvoiceTotals(items: InvoiceItem[], discount: number) {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const safeDiscount = Math.min(Math.max(discount, 0), subtotal);

  return {
    subtotal,
    discount: safeDiscount,
    totalAmount: subtotal - safeDiscount
  };
}

export function resolvePayoutRule(
  doctorId: string,
  service: Service,
  rules: DoctorPaymentRule[]
) {
  const ordered = [...rules]
    .filter((rule) => rule.doctorId === doctorId)
    .sort((a, b) => b.priority - a.priority);

  const exact = ordered.find((rule) => rule.serviceId === service.id);
  const category = ordered.find((rule) => rule.category === service.category);

  if (exact) {
    return exact;
  }

  if (category) {
    return category;
  }

  return {
    id: `default-${service.id}`,
    doctorId,
    serviceId: service.id,
    type: service.defaultPayoutType,
    value: service.defaultPayoutValue,
    reason: service.defaultPayoutReason,
    priority: 0
  } satisfies DoctorPaymentRule;
}

export function calculatePayoutAmount(
  ruleType: RuleType,
  ruleValue: number,
  lineTotal: number,
  quantity: number
) {
  if (ruleType === "none") {
    return 0;
  }

  if (ruleType === "percentage") {
    return Math.round((lineTotal * ruleValue) / 100);
  }

  return Math.round(ruleValue * quantity);
}

export function generatePayoutsForInvoice(
  invoice: Invoice,
  services: Service[],
  rules: DoctorPaymentRule[]
): DoctorPayout[] {
  const payouts: DoctorPayout[] = [];

  invoice.items.forEach((item) => {
    const service = services.find((candidate) => candidate.id === item.serviceId);

    if (!service) {
      return;
    }

    if (isAmountOnlyInvoiceServiceName(service.name) || !isServicePayoutEnabled(service)) {
      return;
    }

    const rule = resolvePayoutRule(invoice.doctorId, service, rules);
    const payoutAmount = calculatePayoutAmount(
      rule.type,
      rule.value,
      item.lineTotal,
      item.quantity
    );

    if (payoutAmount <= 0) {
      return;
    }

    payouts.push({
      id: `${invoice.id}-${item.id}`,
      doctorId: invoice.doctorId,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      serviceName: item.serviceName,
      paymentReason: rule.reason,
      payoutAmount,
      status: "unpaid"
    });
  });

  return payouts;
}

export function nextInvoiceNumber(lastInvoiceNo?: string) {
  const currentYear = new Date().getFullYear();
  const fallback = `HA-${currentYear}-0001`;

  if (!lastInvoiceNo) {
    return fallback;
  }

  const match = lastInvoiceNo.match(/(\d+)$/);
  if (!match) {
    return fallback;
  }

  return lastInvoiceNo.replace(/\d+$/, (value) => String(Number(value) + 1).padStart(value.length, "0"));
}
