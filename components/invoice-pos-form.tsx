"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { KpiCard, buttonClass } from "@/components/erp-ui";
import {
  calculateInvoiceTotals,
  generatePayoutsForInvoice,
  generatePayoutsForInvoices,
  nextInvoiceNumber
} from "@/lib/calculations";
import {
  currentTimeHHMM,
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, todayISO, usd } from "@/lib/format";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  isAmountOnlyInvoiceServiceName,
  paymentMethods,
  serviceStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type DoctorPayout,
  type Invoice,
  type InvoiceItem,
  type Service
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftLine = {
  id: string;
  serviceId: string;
  quantity: number;
  amountUsd: number;
};

type InvoicePosFormProps = {
  doctors: Doctor[];
  services: Service[];
  initialInvoices: Invoice[];
  createdBy: string;
};

const paymentLabels: Record<(typeof paymentMethods)[number], string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
};

function makeId() {
  return crypto.randomUUID();
}

function normalizeDoctorCatalog(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? ""
  };
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function InvoicePosForm({
  doctors,
  services,
  initialInvoices,
  createdBy
}: InvoicePosFormProps) {
  const [doctorCatalog, setDoctorCatalog] = useState(() =>
    doctors.map(normalizeDoctorCatalog)
  );
  const [catalogServices, setCatalogServices] = useState(services);
  const activeDoctors = useMemo(
    () => doctorCatalog.filter((doctor) => doctor.active),
    [doctorCatalog]
  );
  const invoiceServices = useMemo(() => catalogServices, [catalogServices]);
  const serviceOptions = invoiceServices.filter((service) => service.active);

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [paymentSettings, setPaymentSettings] = useState<DoctorPaymentModel>(
    defaultDoctorPaymentModel
  );
  const [payoutQueue, setPayoutQueue] = useState<DoctorPayout[]>(() =>
    generatePayoutsForInvoices(initialInvoices, defaultDoctorPaymentModel, {
      includePendingShiftRecords: true
    }).slice(0, 8)
  );
  const [patientName, setPatientName] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("cash");
  const [notes, setNotes] = useState("");
  const [serviceLines, setServiceLines] = useState<DraftLine[]>([
    { id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
  ]);
  const [savedInvoiceNo, setSavedInvoiceNo] = useState("");
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    try {
      const storedDoctors = window.localStorage.getItem(doctorStorageKey);
      if (!storedDoctors) {
        return;
      }

      const parsed = JSON.parse(storedDoctors);
      if (Array.isArray(parsed)) {
        setDoctorCatalog((parsed as Doctor[]).map(normalizeDoctorCatalog));
      }
    } catch {
      setDoctorCatalog(doctors.map(normalizeDoctorCatalog));
    }
  }, [doctors]);

  useEffect(() => {
    if (!activeDoctors.length) {
      setDoctorId("");
      return;
    }

    if (!activeDoctors.some((doctor) => doctor.id === doctorId)) {
      setDoctorId(activeDoctors[0].id);
    }
  }, [activeDoctors, doctorId]);

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(serviceStorageKey);
      if (!storedServices) {
        return;
      }

      const parsed = JSON.parse(storedServices);
      if (Array.isArray(parsed)) {
        setCatalogServices(parsed as Service[]);
      }
    } catch {
      setCatalogServices(services);
    }
  }, [services]);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(doctorPaymentSettingsStorageKey);
      if (storedSettings) {
        setPaymentSettings(normalizeDoctorPaymentModel(JSON.parse(storedSettings)));
      }
    } catch {
      setPaymentSettings(defaultDoctorPaymentModel);
    }
  }, []);

  useEffect(() => {
    setPayoutQueue(
      generatePayoutsForInvoices(invoices, paymentSettings, {
        includePendingShiftRecords: true
      }).slice(0, 8)
    );
  }, [invoices, paymentSettings]);

  const currentDate = todayISO();
  const currentMonth = currentDate.slice(0, 7);
  const todayInvoices = invoices.filter((invoice) => invoice.date === currentDate);
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === currentMonth);
  const todayRevenue = todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const averageInvoiceValue = monthlyInvoices.length
    ? monthlyRevenue / monthlyInvoices.length
    : 0;
  const latestInvoiceNo = [...invoices.map((invoice) => invoice.invoiceNo)].sort().at(-1);
  const invoiceNo = nextInvoiceNumber(latestInvoiceNo);
  const selectedDoctor = doctorCatalog.find((doctor) => doctor.id === doctorId);

  const serviceItemsUsd = useMemo<InvoiceItem[]>(
    () =>
      serviceLines
        .map((line) => {
          const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);

          if (!service) {
            return null;
          }

          const isAmountOnlyService = isAmountOnlyInvoiceServiceName(service.name);
          const quantity = isAmountOnlyService ? 1 : line.quantity;
          const unitPrice = isAmountOnlyService ? line.amountUsd : service.sellingPrice;

          if (isAmountOnlyService && unitPrice <= 0) {
            return null;
          }

          return {
            id: line.id,
            serviceId: service.id,
            serviceName: service.name,
            category: service.category,
            quantity,
            unitPrice,
            lineTotal: Number((unitPrice * quantity).toFixed(2))
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [invoiceServices, serviceLines]
  );

  const invoiceItems = serviceItemsUsd;
  const totals = calculateInvoiceTotals(invoiceItems, discount);
  const invoiceTime = currentTimeHHMM();
  const draftInvoice = {
    id: "draft",
    invoiceNo,
    date: currentDate,
    time: invoiceTime,
    patientName: patientName || "Draft patient",
    passport: passport || undefined,
    phone: phone || undefined,
    nationality: nationality || undefined,
    doctorId,
    items: invoiceItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    paymentMethod,
    notes: notes || undefined,
    totalAmount: totals.totalAmount,
    createdBy
  } satisfies Invoice;
  const payoutPreview = generatePayoutsForInvoice(draftInvoice, paymentSettings);
  const payoutPreviewTotal = payoutPreview.reduce((sum, payout) => sum + payout.payoutAmount, 0);

  function addServiceLine() {
    setServiceLines((current) => [
      ...current,
      { id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
    ]);
  }

  function updateServiceSelection(id: string, serviceId: string) {
    const selectedService = invoiceServices.find((service) => service.id === serviceId);
    const isAmountOnlyService = isAmountOnlyInvoiceServiceName(selectedService?.name);

    setServiceLines((current) =>
      current.map((line) =>
        line.id === id
          ? { ...line, serviceId, quantity: isAmountOnlyService ? 1 : line.quantity }
          : line
      )
    );
  }

  function updateServiceLine(id: string, patch: Partial<DraftLine>) {
    setServiceLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function removeServiceLine(id: string) {
    setServiceLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id)
    );
  }

  function buildInvoiceHtml(targetInvoice: Invoice) {
    const itemRows = targetInvoice.items
      .map(
        (item) =>
          isAmountOnlyInvoiceServiceName(item.serviceName)
            ? `
          <tr>
            <td colspan="4">${escapeHtml(item.serviceName)} - USD</td>
            <td>${usd(item.lineTotal)}</td>
          </tr>`
            : `
          <tr>
            <td>${escapeHtml(item.serviceName)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${item.quantity}</td>
            <td>${usd(item.unitPrice)}</td>
            <td>${usd(item.lineTotal)}</td>
          </tr>`
      )
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(targetInvoice.invoiceNo)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0b1726; margin: 32px; }
      h1 { margin-bottom: 4px; }
      h2 { margin-top: 28px; font-size: 16px; }
      table { border-collapse: collapse; width: 100%; margin-top: 12px; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .totals { margin-top: 24px; margin-left: auto; width: 280px; }
      .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand { font-weight: 700; font-size: 18px; border-top: 1px solid #dbe3ea; }
    </style>
  </head>
  <body>
    <h1>Health Aid Arugambay</h1>
    <p>Invoice ${escapeHtml(targetInvoice.invoiceNo)} - ${escapeHtml(targetInvoice.date)} ${escapeHtml(targetInvoice.time)}</p>
    <p><strong>Patient:</strong> ${escapeHtml(targetInvoice.patientName)}</p>
    <p><strong>Doctor:</strong> ${escapeHtml(selectedDoctor?.name ?? "Unassigned")}</p>
    <h2>Invoice items</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit price (USD)</th><th>Subtotal (USD)</th></tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="5">No invoice items</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${usd(targetInvoice.subtotal)}</span></div>
      <div><span>Discount</span><span>${usd(targetInvoice.discount)}</span></div>
      <div class="grand"><span>Grand total</span><span>${usd(targetInvoice.totalAmount)}</span></div>
    </div>
  </body>
</html>`;
  }

  function downloadInvoice(targetInvoice: Invoice) {
    const blob = new Blob([buildInvoiceHtml(targetInvoice)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${targetInvoice.invoiceNo}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printInvoice(targetInvoice: Invoice) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(buildInvoiceHtml(targetInvoice));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function saveInvoice() {
    if (!patientName.trim() || !doctorId || invoiceItems.length === 0) {
      return;
    }

    const invoiceId = makeId();
    const createdInvoice: Invoice = {
      ...draftInvoice,
      id: invoiceId,
      patientName: patientName.trim(),
      items: invoiceItems.map((item) => ({ ...item, id: makeId() }))
    };
    const nextInvoices = [createdInvoice, ...invoices];
    const nextPayouts = generatePayoutsForInvoices(nextInvoices, paymentSettings, {
      includePendingShiftRecords: true
    });

    setInvoices(nextInvoices);
    setPayoutQueue(nextPayouts.slice(0, 8));
    setSavedInvoiceNo(createdInvoice.invoiceNo);
    setLastSavedInvoice(createdInvoice);
    setPatientName("");
    setPassport("");
    setPhone("");
    setNationality("");
    setDiscount(0);
    setPaymentMethod("cash");
    setNotes("");
    setServiceLines([
      { id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's Invoices" value={String(todayInvoices.length)} tone="primary" />
        <KpiCard label="Today's Revenue USD" value={usd(todayRevenue)} tone="info" />
        <KpiCard label="Monthly Revenue USD" value={usd(monthlyRevenue)} tone="success" />
        <KpiCard label="Average Invoice Value USD" value={usd(averageInvoiceValue)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel p-5">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="label">Invoice POS</p>
            <h2 className="mt-2 text-xl font-bold text-ink">{invoiceNo}</h2>
            <p className="mt-1 text-sm text-slate-500">Date: {currentDate}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printInvoice(lastSavedInvoice ?? draftInvoice)}
              className={buttonClass("secondary", "px-3 py-2")}
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => downloadInvoice(lastSavedInvoice ?? draftInvoice)}
              disabled={!patientName.trim() && !lastSavedInvoice}
              className={buttonClass(patientName.trim() || lastSavedInvoice ? "secondary" : "muted", "px-3 py-2")}
            >
              Download
            </button>
          </div>
        </div>

        {savedInvoiceNo ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Saved {savedInvoiceNo}. Mock recent invoices and payout queue were updated locally.
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="patientName">
              Patient name
            </label>
            <input
              id="patientName"
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              className="field mt-2"
              placeholder="Patient full name"
            />
          </div>
          <div>
            <label className="label" htmlFor="doctor">
              Doctor who saw patient
            </label>
            <select
              id="doctor"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              className="field mt-2"
            >
              {activeDoctors.length ? (
                activeDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))
              ) : (
                <option value="">No active doctors</option>
              )}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="passport">
              Passport
            </label>
            <input
              id="passport"
              value={passport}
              onChange={(event) => setPassport(event.target.value)}
              className="field mt-2"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="field mt-2"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label" htmlFor="nationality">
              Nationality
            </label>
            <input
              id="nationality"
              value={nationality}
              onChange={(event) => setNationality(event.target.value)}
              className="field mt-2"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="label" htmlFor="paymentMethod">
              Payment method
            </label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
              className="field mt-2"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method}>
                  {paymentLabels[method]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Invoice services</h3>
              <p className="mt-1 text-sm text-slate-500">
                Select catalog services. Clinical services can generate doctor payout in LKR when payout rules apply.
              </p>
            </div>
            <button
              type="button"
              onClick={addServiceLine}
              className={buttonClass("primary", "px-3 py-2")}
            >
              Add service
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {serviceLines.map((line) => {
              const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);
              const isAmountOnlyService = isAmountOnlyInvoiceServiceName(service?.name);
              const unitPriceUsd = isAmountOnlyService
                ? line.amountUsd
                : service?.sellingPrice ?? 0;
              const lineTotalUsd = isAmountOnlyService
                ? line.amountUsd
                : unitPriceUsd * line.quantity;

              return (
                <div
                  key={line.id}
                  className={cn(
                    "grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3",
                    isAmountOnlyService
                      ? "2xl:grid-cols-[minmax(180px,1fr)_160px_88px]"
                      : "2xl:grid-cols-[minmax(180px,1fr)_120px_120px_120px_88px]"
                  )}
                >
                  <div>
                    <p className="label mb-2">Service</p>
                    <select
                      value={line.serviceId}
                      onChange={(event) => updateServiceSelection(line.id, event.target.value)}
                      className="field"
                      aria-label="Doctor service"
                    >
                      {serviceOptions.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} - {candidate.category}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isAmountOnlyService ? (
                    <div>
                      <label className="label mb-2 block" htmlFor={`amount-${line.id}`}>
                        Amount USD
                      </label>
                      <input
                        id={`amount-${line.id}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.amountUsd}
                        onChange={(event) =>
                          updateServiceLine(line.id, {
                            amountUsd: Math.max(0, Number(event.target.value))
                          })
                        }
                        className="field text-right font-semibold"
                        aria-label="Amount USD"
                        placeholder="0.00"
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="label mb-2">Quantity</p>
                        <QuantityControl
                          value={line.quantity}
                          onChange={(quantity) => updateServiceLine(line.id, { quantity })}
                        />
                      </div>
                      <div>
                        <p className="label mb-2">Unit price USD</p>
                        <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                          {usd(unitPriceUsd)}
                        </div>
                      </div>
                      <div>
                        <p className="label mb-2">Subtotal USD</p>
                        <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                          {usd(lineTotalUsd)}
                        </div>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => removeServiceLine(line.id)}
                    className={buttonClass("danger", "mt-6 h-10 px-3 py-0 text-xs")}
                    aria-label="Remove service line"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_260px]">
          <div>
            <label className="label" htmlFor="notes">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="field mt-2 min-h-28"
              placeholder="Clinical or billing notes for the invoice"
            />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal USD</span>
                <span className="font-semibold text-ink">{usd(totals.subtotal)}</span>
              </div>
              <div>
                <label className="label" htmlFor="discount">
                  Discount USD
                </label>
                <input
                  id="discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discount}
                  onChange={(event) => setDiscount(Number(event.target.value))}
                  className="field mt-2"
                />
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-ink">Grand total USD</span>
                <span className="font-bold text-lagoon-700">{usd(totals.totalAmount)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={saveInvoice}
              disabled={!patientName.trim() || !doctorId || invoiceItems.length === 0}
              className={buttonClass(
                patientName.trim() && doctorId && invoiceItems.length > 0 ? "primary" : "muted",
                "mt-4 w-full"
              )}
            >
              Save invoice
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Invoice preview</h3>
          <p className="mt-1 text-sm text-slate-500">Patient invoice remains USD only.</p>
          <div className="mt-4 space-y-4">
            <PreviewGroup title="Invoice items" items={invoiceItems} />
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Discount USD</span>
                <span className="font-semibold text-ink">{usd(totals.discount)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-semibold text-ink">Grand total USD</span>
                <span className="font-bold text-lagoon-700">{usd(totals.totalAmount)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <div>
            <h3 className="font-semibold text-ink">Doctor payout preview</h3>
            <p className="text-sm text-slate-500">Internal payout in LKR</p>
          </div>
          <div className="mt-4 space-y-3">
            {payoutPreview.length ? (
              <>
                {payoutPreview.map((payout) => (
                  <div key={payout.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-ink">{payout.serviceName}</p>
                      <p className="text-sm font-bold text-care-700">{money(payout.payoutAmount)}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{payout.paymentReason}</p>
                  </div>
                ))}
                <div className="flex justify-between rounded-lg bg-care-50 px-3 py-2 text-sm font-semibold text-care-700">
                  <span>Total payout</span>
                  <span>{money(payoutPreviewTotal)}</span>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                No payout will be generated for the current service mix.
              </p>
            )}
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Recent invoices</h3>
          <div className="mt-4 space-y-3">
            {invoices.slice(0, 5).map((invoice) => (
              <div key={invoice.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{invoice.invoiceNo}</p>
                    <p className="text-xs text-slate-500">{invoice.patientName}</p>
                  </div>
                  <span className="text-sm font-bold text-ink">{usd(invoice.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Payout queue</h3>
          <p className="mt-1 text-sm text-slate-500">Mock unpaid payouts in LKR</p>
          <div className="mt-4 space-y-3">
            {payoutQueue.map((payout) => {
              const doctor = doctorCatalog.find((candidate) => candidate.id === payout.doctorId);

              return (
                <div key={payout.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{payout.serviceName}</p>
                      <p className="text-xs text-slate-500">
                        {payout.invoiceNo} - {doctor?.name ?? "Unassigned"}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-care-700">{money(payout.payoutAmount)}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{payout.paymentReason}</p>
                </div>
              );
            })}
          </div>
        </section>
      </aside>
      </div>
    </div>
  );
}

function QuantityControl({
  value,
  onChange
}: {
  value: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="focus-ring p-2 text-slate-500"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        value={value}
        min={1}
        type="number"
        onChange={(event) => onChange(Math.max(1, Number(event.target.value)))}
        className="w-full border-0 bg-white px-2 py-2 text-center text-sm font-semibold outline-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        className="focus-ring p-2 text-slate-500"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function PreviewGroup({ title, items }: { title: string; items: InvoiceItem[] }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm font-bold text-ink">
          {usd(items.reduce((sum, item) => sum + item.lineTotal, 0))}
        </p>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-xs text-slate-500">
              <span>
                {isAmountOnlyInvoiceServiceName(item.serviceName)
                  ? `${item.serviceName} - USD`
                  : `${item.serviceName} - ${item.category} x ${item.quantity}`}
              </span>
              <span className="font-semibold text-slate-700">{usd(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No items added.</p>
      )}
    </div>
  );
}
