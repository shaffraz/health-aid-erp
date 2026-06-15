"use client";

import { useMemo, useState } from "react";
import {
  CirclePlus,
  Download,
  FileCheck2,
  Minus,
  Plus,
  Printer,
  ReceiptText,
  Trash2
} from "lucide-react";
import {
  calculateInvoiceTotals,
  generatePayoutsForInvoice,
  nextInvoiceNumber
} from "@/lib/calculations";
import { demoSettings } from "@/lib/demo-data";
import { money, todayISO, usd } from "@/lib/format";
import {
  paymentMethods,
  type Doctor,
  type DoctorPaymentRule,
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
};

type MedicationLine = DraftLine & {
  unitPriceUsd: number;
};

type InvoicePosFormProps = {
  doctors: Doctor[];
  services: Service[];
  paymentRules: DoctorPaymentRule[];
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

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lkrToUsd(value: number) {
  return Number((value / demoSettings.exchangeRateLkrPerUsd).toFixed(2));
}

export function InvoicePosForm({
  doctors,
  services,
  paymentRules,
  initialInvoices,
  createdBy
}: InvoicePosFormProps) {
  const exchangeRate = demoSettings.exchangeRateLkrPerUsd;
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const serviceOptions = services.filter(
    (service) => service.active && service.category !== "Consumables"
  );
  const medicationOptions = services.filter(
    (service) => service.active && service.category === "Consumables"
  );

  function invoiceInUsd(invoice: Invoice): Invoice {
    const items = invoice.items.map((item) => ({
      ...item,
      unitPrice: lkrToUsd(item.unitPrice),
      lineTotal: lkrToUsd(item.lineTotal)
    }));
    const totals = calculateInvoiceTotals(items, lkrToUsd(invoice.discount));

    return {
      ...invoice,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      totalAmount: totals.totalAmount
    };
  }

  const [invoices, setInvoices] = useState<Invoice[]>(() =>
    initialInvoices.map((invoice) => invoiceInUsd(invoice))
  );
  const [payoutQueue, setPayoutQueue] = useState<DoctorPayout[]>(() =>
    initialInvoices
      .flatMap((invoice) => generatePayoutsForInvoice(invoice, services, paymentRules))
      .slice(0, 8)
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
    { id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1 }
  ]);
  const [medicationLines, setMedicationLines] = useState<MedicationLine[]>([]);
  const [savedInvoiceNo, setSavedInvoiceNo] = useState("");
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);

  const latestInvoiceNo = [...invoices.map((invoice) => invoice.invoiceNo)].sort().at(-1);
  const invoiceNo = nextInvoiceNumber(latestInvoiceNo);
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);

  const serviceItemsUsd = useMemo<InvoiceItem[]>(
    () =>
      serviceLines
        .map((line) => {
          const service = services.find((candidate) => candidate.id === line.serviceId);

          if (!service) {
            return null;
          }

          const unitPrice = lkrToUsd(service.sellingPrice);

          return {
            id: line.id,
            serviceId: service.id,
            serviceName: service.name,
            category: service.category,
            quantity: line.quantity,
            unitPrice,
            lineTotal: Number((unitPrice * line.quantity).toFixed(2))
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [serviceLines, services]
  );

  const serviceItemsLkr = useMemo<InvoiceItem[]>(
    () =>
      serviceLines
        .map((line) => {
          const service = services.find((candidate) => candidate.id === line.serviceId);

          if (!service) {
            return null;
          }

          return {
            id: line.id,
            serviceId: service.id,
            serviceName: service.name,
            category: service.category,
            quantity: line.quantity,
            unitPrice: service.sellingPrice,
            lineTotal: service.sellingPrice * line.quantity
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [serviceLines, services]
  );

  const medicationItemsUsd = useMemo<InvoiceItem[]>(
    () =>
      medicationLines
        .map((line) => {
          const medication = services.find((candidate) => candidate.id === line.serviceId);

          if (!medication) {
            return null;
          }

          return {
            id: line.id,
            serviceId: medication.id,
            serviceName: medication.name,
            category: medication.category,
            quantity: line.quantity,
            unitPrice: line.unitPriceUsd,
            lineTotal: Number((line.unitPriceUsd * line.quantity).toFixed(2))
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [medicationLines, services]
  );

  const invoiceItems = useMemo(
    () => [...serviceItemsUsd, ...medicationItemsUsd],
    [medicationItemsUsd, serviceItemsUsd]
  );
  const totals = calculateInvoiceTotals(invoiceItems, discount);
  const draftInvoice = {
    id: "draft",
    invoiceNo,
    date: todayISO(),
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
  const payoutInvoice = {
    ...draftInvoice,
    items: serviceItemsLkr
  } satisfies Invoice;
  const payoutPreview = generatePayoutsForInvoice(payoutInvoice, services, paymentRules);
  const payoutPreviewTotal = payoutPreview.reduce((sum, payout) => sum + payout.payoutAmount, 0);

  function suggestedMedicationUsd(serviceId: string) {
    const service = services.find((candidate) => candidate.id === serviceId);
    return service ? lkrToUsd(service.sellingPrice) : 0;
  }

  function addServiceLine() {
    setServiceLines((current) => [
      ...current,
      { id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1 }
    ]);
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

  function addMedicationLine() {
    const serviceId = medicationOptions[0]?.id ?? "";

    if (!serviceId) {
      return;
    }

    setMedicationLines((current) => [
      ...current,
      {
        id: makeId(),
        serviceId,
        quantity: 1,
        unitPriceUsd: suggestedMedicationUsd(serviceId)
      }
    ]);
  }

  function updateMedicationLine(id: string, patch: Partial<MedicationLine>) {
    setMedicationLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function updateMedicationService(id: string, serviceId: string) {
    updateMedicationLine(id, {
      serviceId,
      unitPriceUsd: suggestedMedicationUsd(serviceId)
    });
  }

  function removeMedicationLine(id: string) {
    setMedicationLines((current) => current.filter((line) => line.id !== id));
  }

  function buildInvoiceHtml(targetInvoice: Invoice) {
    const serviceRows = targetInvoice.items
      .filter((item) => item.category !== "Consumables")
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.serviceName)}</td>
            <td>${item.quantity}</td>
            <td>${usd(item.unitPrice)}</td>
            <td>${usd(item.lineTotal)}</td>
          </tr>`
      )
      .join("");
    const medicationRows = targetInvoice.items
      .filter((item) => item.category === "Consumables")
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.serviceName)}</td>
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
    <p>Invoice ${escapeHtml(targetInvoice.invoiceNo)} - ${escapeHtml(targetInvoice.date)}</p>
    <p><strong>Patient:</strong> ${escapeHtml(targetInvoice.patientName)}</p>
    <p><strong>Doctor:</strong> ${escapeHtml(selectedDoctor?.name ?? "Unassigned")}</p>
    <h2>Services</h2>
    <table>
      <thead>
        <tr><th>Service</th><th>Qty</th><th>Unit price (USD)</th><th>Subtotal (USD)</th></tr>
      </thead>
      <tbody>${serviceRows || '<tr><td colspan="4">No service charges</td></tr>'}</tbody>
    </table>
    <h2>Medication charges</h2>
    <table>
      <thead>
        <tr><th>Medication</th><th>Qty</th><th>Unit price (USD)</th><th>Subtotal (USD)</th></tr>
      </thead>
      <tbody>${medicationRows || '<tr><td colspan="4">No medication charges</td></tr>'}</tbody>
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
    const createdPayouts = generatePayoutsForInvoice(
      {
        ...createdInvoice,
        items: serviceItemsLkr.map((item) => ({ ...item, id: makeId() }))
      },
      services,
      paymentRules
    );

    setInvoices((current) => [createdInvoice, ...current]);
    setPayoutQueue((current) => [...createdPayouts, ...current].slice(0, 8));
    setSavedInvoiceNo(createdInvoice.invoiceNo);
    setLastSavedInvoice(createdInvoice);
    setPatientName("");
    setPassport("");
    setPhone("");
    setNationality("");
    setDiscount(0);
    setPaymentMethod("cash");
    setNotes("");
    setServiceLines([{ id: makeId(), serviceId: serviceOptions[0]?.id ?? "", quantity: 1 }]);
    setMedicationLines([]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="label">Invoice POS</p>
            <h2 className="mt-2 text-xl font-bold text-ink">{invoiceNo}</h2>
            <p className="mt-1 text-sm text-slate-500">Date: {todayISO()}</p>
            <p className="mt-1 text-sm font-semibold text-lagoon-700">
              Current exchange rate: 1 USD = {money(exchangeRate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => printInvoice(lastSavedInvoice ?? draftInvoice)}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              Print
            </button>
            <button
              type="button"
              onClick={() => downloadInvoice(lastSavedInvoice ?? draftInvoice)}
              disabled={!patientName.trim() && !lastSavedInvoice}
              className={cn(
                "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
                patientName.trim() || lastSavedInvoice
                  ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  : "border-slate-200 bg-slate-100 text-slate-400"
              )}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
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
              {activeDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
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
              <h3 className="font-semibold text-ink">Services</h3>
              <p className="mt-1 text-sm text-slate-500">
                Patient invoice prices are shown in USD. Doctor payout rules use the LKR base internally.
              </p>
            </div>
            <button
              type="button"
              onClick={addServiceLine}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CirclePlus className="h-4 w-4" aria-hidden="true" />
              Add service
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {serviceLines.map((line) => {
              const service = services.find((candidate) => candidate.id === line.serviceId);
              const unitPriceUsd = lkrToUsd(service?.sellingPrice ?? 0);

              return (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_44px]"
                >
                  <div>
                    <p className="label mb-2">Service</p>
                    <select
                      value={line.serviceId}
                      onChange={(event) => updateServiceLine(line.id, { serviceId: event.target.value })}
                      className="field"
                      aria-label="Service"
                    >
                      {serviceOptions.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} - {candidate.category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="label mb-2">Quantity</p>
                    <QuantityControl
                      value={line.quantity}
                      onChange={(quantity) => updateServiceLine(line.id, { quantity })}
                    />
                  </div>
                  <div>
                    <p className="label mb-2">Unit price</p>
                    <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                      {usd(unitPriceUsd)}
                    </div>
                  </div>
                  <div>
                    <p className="label mb-2">Subtotal</p>
                    <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                      {usd(unitPriceUsd * line.quantity)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeServiceLine(line.id)}
                    className="focus-ring mt-6 flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-rose-600"
                    aria-label="Remove service line"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-ink">Medication charges</h3>
              <p className="mt-1 text-sm text-slate-500">
                Select medication from the service list and enter the unit price manually in USD. Medication does not create doctor payout by default.
              </p>
            </div>
            <button
              type="button"
              onClick={addMedicationLine}
              disabled={!medicationOptions.length}
              className={cn(
                "focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                medicationOptions.length
                  ? "bg-ink text-white hover:bg-slate-800"
                  : "bg-slate-200 text-slate-500"
              )}
            >
              <CirclePlus className="h-4 w-4" aria-hidden="true" />
              Add medication
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {medicationLines.length ? (
              medicationLines.map((line) => (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_120px_140px_120px_44px]"
                >
                  <div>
                    <p className="label mb-2">Medication</p>
                    <select
                      value={line.serviceId}
                      onChange={(event) => updateMedicationService(line.id, event.target.value)}
                      className="field"
                      aria-label="Medication"
                    >
                      {medicationOptions.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="label mb-2">Quantity</p>
                    <QuantityControl
                      value={line.quantity}
                      onChange={(quantity) => updateMedicationLine(line.id, { quantity })}
                    />
                  </div>
                  <div>
                    <label className="label mb-2 block" htmlFor={`med-price-${line.id}`}>
                      Unit price USD
                    </label>
                    <input
                      id={`med-price-${line.id}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.unitPriceUsd}
                      onChange={(event) =>
                        updateMedicationLine(line.id, {
                          unitPriceUsd: Math.max(0, Number(event.target.value))
                        })
                      }
                      className="field"
                    />
                  </div>
                  <div>
                    <p className="label mb-2">Subtotal</p>
                    <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                      {usd(line.unitPriceUsd * line.quantity)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMedicationLine(line.id)}
                    className="focus-ring mt-6 flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-rose-600"
                    aria-label="Remove medication line"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                No medication charges added.
              </p>
            )}
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
                <span className="text-slate-500">Subtotal</span>
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
                <span className="font-semibold text-ink">Grand total</span>
                <span className="font-bold text-lagoon-700">{usd(totals.totalAmount)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={saveInvoice}
              disabled={!patientName.trim() || !doctorId || invoiceItems.length === 0}
              className={cn(
                "focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                patientName.trim() && doctorId && invoiceItems.length > 0
                  ? "bg-lagoon-600 hover:bg-lagoon-700"
                  : "bg-slate-300"
              )}
            >
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
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
            <PreviewGroup title="Services" items={serviceItemsUsd} />
            <PreviewGroup title="Medication charges" items={medicationItemsUsd} />
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Discount</span>
                <span className="font-semibold text-ink">{usd(totals.discount)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base">
                <span className="font-semibold text-ink">Grand total</span>
                <span className="font-bold text-lagoon-700">{usd(totals.totalAmount)}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-care-50 p-2 text-care-700">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">Doctor payout preview</h3>
              <p className="text-sm text-slate-500">Internal payout in LKR</p>
            </div>
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
              const doctor = doctors.find((candidate) => candidate.id === payout.doctorId);

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
                {item.serviceName} x {item.quantity}
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
