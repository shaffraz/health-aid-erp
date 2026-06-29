import {
  isTimeInWindow,
  hoursBetween,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import {
  type Doctor,
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
  doctors: Doctor[]
): DoctorPayout[] {
  const doctor = doctors.find((candidate) => candidate.id === invoice.doctorId);

  if (!doctor) {
    return [];
  }

  const paymentModel = normalizeDoctorPaymentModel(doctor.paymentModel);
  const invoiceTime = invoice.time ?? "12:00";

  if (paymentModel.activeModel === "peak_season") {
    return [
      {
        id: `${invoice.id}-pending-shift`,
        doctorId: invoice.doctorId,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        time: invoiceTime,
        serviceName: "Peak season patient",
        paymentReason: "Pending shift calculation",
        payoutAmount: 0,
        status: "unpaid",
        payoutMode: "pending_shift",
        shiftStartTime: paymentModel.peakSeason.shiftStartTime,
        shiftEndTime: paymentModel.peakSeason.shiftEndTime,
        patientCount: 1
      }
    ];
  }

  const isNight = isTimeInWindow(
    invoiceTime,
    paymentModel.lowSeason.nightStartTime,
    paymentModel.lowSeason.nightEndTime
  );
  const payoutAmount = isNight
    ? paymentModel.lowSeason.nightConsultationPayout
    : paymentModel.lowSeason.dayConsultationPayout;

  return [
    {
      id: `${invoice.id}-consultation-payout`,
      doctorId: invoice.doctorId,
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      date: invoice.date,
      time: invoiceTime,
      serviceName: "Low season consultation",
      paymentReason: isNight
        ? `Night consultation payout (${invoiceTime})`
        : `Day consultation payout (${invoiceTime})`,
      payoutAmount,
      status: "unpaid",
      payoutMode: "invoice"
    }
  ];
}

export function generateShiftPayoutSummaries(invoices: Invoice[], doctors: Doctor[]) {
  const summaries: DoctorPayout[] = [];

  doctors.forEach((doctor) => {
    const paymentModel = normalizeDoctorPaymentModel(doctor.paymentModel);

    if (paymentModel.activeModel !== "peak_season") {
      return;
    }

    const shift = paymentModel.peakSeason;
    const shiftHours = hoursBetween(shift.shiftStartTime, shift.shiftEndTime);
    const basePay = Math.round(shiftHours * shift.hourlyRate);
    const invoicesByDate = new Map<string, Invoice[]>();

    invoices
      .filter(
        (invoice) =>
          invoice.doctorId === doctor.id &&
          isTimeInWindow(invoice.time ?? "12:00", shift.shiftStartTime, shift.shiftEndTime)
      )
      .forEach((invoice) => {
        const dateInvoices = invoicesByDate.get(invoice.date) ?? [];
        dateInvoices.push(invoice);
        invoicesByDate.set(invoice.date, dateInvoices);
      });

    invoicesByDate.forEach((shiftInvoices, date) => {
      const patientCount = shiftInvoices.length;
      const bonus =
        patientCount >= shift.bonusThresholdPatients
          ? patientCount * shift.bonusPerPatient
          : 0;
      const payoutAmount = basePay + bonus;

      summaries.push({
        id: `${doctor.id}-${date}-${shift.shiftStartTime}-${shift.shiftEndTime}-shift`,
        doctorId: doctor.id,
        invoiceId: `shift-${doctor.id}-${date}`,
        invoiceNo: `Shift ${shift.shiftStartTime}-${shift.shiftEndTime}`,
        date,
        time: shift.shiftEndTime,
        serviceName: "Peak season shift voucher",
        paymentReason:
          bonus > 0
            ? `${shiftHours}h base pay + ${patientCount} patient bonus`
            : `${shiftHours}h base pay; ${patientCount} patients below bonus threshold`,
        payoutAmount,
        status: "unpaid",
        payoutMode: "shift",
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: shift.shiftEndTime,
        patientCount
      });
    });
  });

  return summaries;
}

export function generatePayoutsForInvoices(
  invoices: Invoice[],
  doctors: Doctor[],
  options: { includePendingShiftRecords?: boolean } = {}
) {
  const invoicePayouts = invoices.flatMap((invoice) =>
    generatePayoutsForInvoice(invoice, doctors)
  );
  const visibleInvoicePayouts = options.includePendingShiftRecords
    ? invoicePayouts
    : invoicePayouts.filter((payout) => payout.payoutMode !== "pending_shift");

  return [...visibleInvoicePayouts, ...generateShiftPayoutSummaries(invoices, doctors)];
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
