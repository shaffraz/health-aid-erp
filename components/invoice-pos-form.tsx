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
import { money, todayISO } from "@/lib/format";
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

export function InvoicePosForm({
  doctors,
  services,
  paymentRules,
  initialInvoices,
  createdBy
}: InvoicePosFormProps) {
  const [invoices, setInvoices] = useState(initialInvoices);
  const [payoutQueue, setPayoutQueue] = useState<DoctorPayout[]>(() =>
    initialInvoices
      .flatMap((invoice) => generatePayoutsForInvoice(invoice, services, paymentRules))
      .slice(0, 8)
  );
  const [patientName, setPatientName] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("cash");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { id: crypto.randomUUID(), serviceId: services[0]?.id ?? "", quantity: 1 }
  ]);
  const [savedInvoiceNo, setSavedInvoiceNo] = useState("");
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);

  const activeServices = services.filter((service) => service.active);
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const latestInvoiceNo = [...invoices.map((invoice) => invoice.invoiceNo)].sort().at(-1);
  const invoiceNo = nextInvoiceNumber(latestInvoiceNo);

  const items = useMemo<InvoiceItem[]>(
    () =>
      lines
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
    [lines, services]
  );

  const totals = calculateInvoiceTotals(items, discount);
  const draftInvoice = {
    id: "draft",
    invoiceNo,
    date: todayISO(),
    patientName: patientName || "Draft patient",
    passport: passport || undefined,
    phone: phone || undefined,
    nationality: nationality || undefined,
    doctorId,
    items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    paymentMethod,
    notes: notes || undefined,
    totalAmount: totals.totalAmount,
    createdBy
  } satisfies Invoice;
  const payoutPreview = generatePayoutsForInvoice(draftInvoice, services, paymentRules);

  function addLine() {
    setLines((current) => [
      ...current,
      { id: crypto.randomUUID(), serviceId: activeServices[0]?.id ?? "", quantity: 1 }
    ]);
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function removeLine(id: string) {
    setLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== id)));
  }

  function downloadInvoice(targetInvoice: Invoice) {
    const doctor = doctors.find((candidate) => candidate.id === targetInvoice.doctorId);
    const rows = targetInvoice.items
      .map(
        (item) => `
          <tr>
            <td>${item.serviceName}</td>
            <td>${item.quantity}</td>
            <td>${money(item.unitPrice)}</td>
            <td>${money(item.lineTotal)}</td>
          </tr>`
      )
      .join("");
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${targetInvoice.invoiceNo}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0b1726; margin: 32px; }
      h1 { margin-bottom: 4px; }
      table { border-collapse: collapse; width: 100%; margin-top: 24px; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .totals { margin-top: 24px; margin-left: auto; width: 280px; }
      .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand { font-weight: 700; font-size: 18px; border-top: 1px solid #dbe3ea; }
    </style>
  </head>
  <body>
    <h1>Health Aid Arugambay</h1>
    <p>Invoice ${targetInvoice.invoiceNo} - ${targetInvoice.date}</p>
    <p><strong>Patient:</strong> ${targetInvoice.patientName}</p>
    <p><strong>Doctor:</strong> ${doctor?.name ?? "Unassigned"}</p>
    <table>
      <thead>
        <tr><th>Service</th><th>Qty</th><th>Unit price</th><th>Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(targetInvoice.subtotal)}</span></div>
      <div><span>Discount</span><span>${money(targetInvoice.discount)}</span></div>
      <div class="grand"><span>Grand total</span><span>${money(targetInvoice.totalAmount)}</span></div>
    </div>
  </body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${targetInvoice.invoiceNo}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function saveInvoice() {
    if (!patientName.trim() || !doctorId || items.length === 0) {
      return;
    }

    const invoiceId = crypto.randomUUID();
    const invoiceItems = items.map((item) => ({ ...item, id: crypto.randomUUID() }));
    const createdInvoice: Invoice = {
      ...draftInvoice,
      id: invoiceId,
      patientName: patientName.trim(),
      items: invoiceItems
    };
    const createdPayouts = generatePayoutsForInvoice(createdInvoice, services, paymentRules);

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
    setLines([{ id: crypto.randomUUID(), serviceId: activeServices[0]?.id ?? "", quantity: 1 }]);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="label">Invoice POS</p>
            <h2 className="mt-2 text-xl font-bold text-ink">{invoiceNo}</h2>
            <p className="mt-1 text-sm text-slate-500">Date: {todayISO()}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
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
            Saved {savedInvoiceNo}. Doctor payout records were generated from the selected doctor and invoice items.
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
            <h3 className="font-semibold text-ink">Invoice items</h3>
            <button
              type="button"
              onClick={addLine}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <CirclePlus className="h-4 w-4" aria-hidden="true" />
              Add service
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {lines.map((line) => {
              const service = services.find((candidate) => candidate.id === line.serviceId);

              return (
                <div
                  key={line.id}
                  className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_120px_44px]"
                >
                  <div>
                    <p className="label mb-2">Service</p>
                    <select
                      value={line.serviceId}
                      onChange={(event) => updateLine(line.id, { serviceId: event.target.value })}
                      className="field"
                      aria-label="Service"
                    >
                      {activeServices.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.name} - {candidate.category}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="label mb-2">Quantity</p>
                    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <button
                        type="button"
                        className="focus-ring p-2 text-slate-500"
                        onClick={() => updateLine(line.id, { quantity: Math.max(1, line.quantity - 1) })}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <input
                        value={line.quantity}
                        min={1}
                        type="number"
                        onChange={(event) =>
                          updateLine(line.id, { quantity: Math.max(1, Number(event.target.value)) })
                        }
                        className="w-full border-0 bg-white px-2 py-2 text-center text-sm font-semibold outline-none"
                        aria-label="Quantity"
                      />
                      <button
                        type="button"
                        className="focus-ring p-2 text-slate-500"
                        onClick={() => updateLine(line.id, { quantity: line.quantity + 1 })}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="label mb-2">Unit price</p>
                    <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                      {money(service?.sellingPrice ?? 0)}
                    </div>
                  </div>
                  <div>
                    <p className="label mb-2">Subtotal</p>
                    <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-ink">
                      {money((service?.sellingPrice ?? 0) * line.quantity)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.id)}
                    className="focus-ring mt-6 flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-rose-600 md:mt-6"
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
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
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-ink">{money(totals.subtotal)}</span>
              </div>
              <div>
                <label className="label" htmlFor="discount">
                  Discount
                </label>
                <input
                  id="discount"
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(event) => setDiscount(Number(event.target.value))}
                  className="field mt-2"
                />
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                <span className="font-semibold text-ink">Grand total</span>
                <span className="font-bold text-lagoon-700">{money(totals.totalAmount)}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={saveInvoice}
              disabled={!patientName.trim() || !doctorId || items.length === 0}
              className={cn(
                "focus-ring mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                patientName.trim() && doctorId && items.length > 0
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
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-care-50 p-2 text-care-700">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-ink">Doctor payout preview</h3>
              <p className="text-sm text-slate-500">Calculated before saving</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {payoutPreview.length ? (
              payoutPreview.map((payout) => (
                <div key={payout.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{payout.serviceName}</p>
                    <p className="text-sm font-bold text-care-700">{money(payout.payoutAmount)}</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{payout.paymentReason}</p>
                </div>
              ))
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
                  <span className="text-sm font-bold text-ink">{money(invoice.totalAmount)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Payout queue</h3>
          <p className="mt-1 text-sm text-slate-500">Mock unpaid payouts created from saved invoices</p>
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
