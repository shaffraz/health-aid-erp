"use client";

import { useMemo, useState } from "react";
import { ActionSelect } from "@/components/action-select";
import { buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { openEmailDraft } from "@/lib/email";
import { shortDate, usdWhole } from "@/lib/format";
import { useSystemSettings } from "@/lib/use-system-settings";
import {
  isAmountOnlyInvoiceServiceName,
  type Doctor,
  type Invoice,
  type InvoiceItem,
  type PaymentMethod
} from "@/lib/types";

type InvoicesDashboardProps = {
  doctors: Doctor[];
  invoices: Invoice[];
};

const paymentTypeLabels = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
} satisfies Record<PaymentMethod, string>;

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildInvoiceDocument(invoice: Invoice, doctorName: string, clinicName: string) {
  const clinicalTotal = totalForItems(clinicalItems(invoice));
  const medicationTotal = totalForItems(medicationItems(invoice));
  const consumableTotal = totalForItems(consumableItems(invoice));
  const isInsurance = invoice.paymentMethod === "insurance";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(invoice.invoiceNo)}</title>
    <style>
      body { color: #0b1726; font-family: Arial, sans-serif; margin: 32px; }
      h1 { margin: 0 0 8px; }
      table { border-collapse: collapse; margin-top: 16px; width: 100%; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .meta { color: #46484a; margin: 4px 0; }
      .total { font-size: 18px; font-weight: 700; margin-top: 24px; text-align: right; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(clinicName)}</h1>
    <h2>Invoice Information</h2>
    <p class="meta">Invoice number: ${escapeHtml(invoice.invoiceNo)}</p>
    <p class="meta">Date: ${escapeHtml(invoice.date)}</p>
    <p class="meta">Time: ${escapeHtml(invoice.time ?? "N/A")}</p>
    <p class="meta">Invoice status: ${escapeHtml(invoiceStatus(invoice))}</p>
    <h2>Patient Information</h2>
    <p class="meta">Patient: ${escapeHtml(invoice.patientName)}</p>
    <p class="meta">Passport / ID: ${escapeHtml(invoice.passport ?? "N/A")}</p>
    <p class="meta">Mobile: ${escapeHtml(invoice.phone ?? "N/A")}</p>
    <p class="meta">Nationality: ${escapeHtml(invoice.nationality ?? "N/A")}</p>
    ${invoice.email ? `<p class="meta">Email: ${escapeHtml(invoice.email)}</p>` : ""}
    <h2>Billing Information</h2>
    <p class="meta">Doctor: ${escapeHtml(doctorName)}</p>
    <p class="meta">Payment method: ${escapeHtml(paymentTypeLabels[invoice.paymentMethod])}</p>
    ${
      isInsurance
        ? `<p class="meta">Assistance company: ${escapeHtml(invoice.assistanceCompanyName ?? "N/A")}</p>`
        : ""
    }
    <table>
      <thead><tr><th>Invoice Summary</th><th>Amount</th></tr></thead>
      <tbody>
        <tr><td>Clinical Services Total</td><td>${usdWhole(clinicalTotal)}</td></tr>
        <tr><td>Medication Charges</td><td>${usdWhole(medicationTotal)}</td></tr>
        <tr><td>Consumable Charges</td><td>${usdWhole(consumableTotal)}</td></tr>
        <tr><td>Discount</td><td>${usdWhole(invoice.discount)}</td></tr>
        <tr><td><strong>Invoice Total</strong></td><td><strong>${usdWhole(invoice.totalAmount)}</strong></td></tr>
        ${
          isInsurance
            ? `<tr><td>Claim Percentage</td><td>${escapeHtml(invoice.claimPercentage ?? 0)}%</td></tr>
               <tr><td><strong>Claim Amount</strong></td><td><strong>${usdWhole(invoice.claimAmount ?? 0)}</strong></td></tr>`
            : ""
        }
      </tbody>
    </table>
  </body>
</html>`;
}

function buildInvoiceEmail(invoice: Invoice, doctorName: string, clinicName: string) {
  const isInsurance = invoice.paymentMethod === "insurance";

  return [
    clinicName,
    "",
    `Invoice: ${invoice.invoiceNo}`,
    `Date: ${invoice.date}${invoice.time ? ` ${invoice.time}` : ""}`,
    `Patient: ${invoice.patientName}`,
    `Passport / ID: ${invoice.passport ?? "N/A"}`,
    `Doctor: ${doctorName}`,
    `Payment method: ${paymentTypeLabels[invoice.paymentMethod]}`,
    isInsurance ? `Assistance company: ${invoice.assistanceCompanyName ?? "N/A"}` : "",
    `Invoice total: ${usdWhole(invoice.totalAmount)}`,
    isInsurance ? `Claim amount: ${usdWhole(invoice.claimAmount ?? 0)}` : "",
    "",
    "Please find the invoice details above."
  ]
    .filter(Boolean)
    .join("\n");
}

function clinicalItems(invoice: Invoice) {
  return invoice.items.filter((item) => !isAmountOnlyInvoiceServiceName(item.serviceName));
}

function medicationItems(invoice: Invoice) {
  return invoice.items.filter((item) => item.serviceName.toLowerCase().includes("medication"));
}

function consumableItems(invoice: Invoice) {
  return invoice.items.filter((item) => item.serviceName.toLowerCase().includes("consumable"));
}

function totalForItems(items: InvoiceItem[]) {
  return items.reduce((sum, item) => sum + item.lineTotal, 0);
}

function invoiceStatus(invoice: Invoice) {
  return invoice.paymentMethod === "insurance" ? (invoice.claimStatus ?? "Draft") : "Issued";
}

function InvoiceDetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-3">
      <p className="label">{label}</p>
      <p className="mt-1 font-semibold text-[#224770]">{value || "N/A"}</p>
    </div>
  );
}

function InvoiceDetailsModal({
  doctorName,
  invoice,
  onClose,
  onDownload,
  onEmail,
  onPrint
}: {
  doctorName: string;
  invoice: Invoice;
  onClose: () => void;
  onDownload: () => void;
  onEmail: () => void;
  onPrint: () => void;
}) {
  const clinicalTotal = totalForItems(clinicalItems(invoice));
  const medicationTotal = totalForItems(medicationItems(invoice));
  const consumableTotal = totalForItems(consumableItems(invoice));
  const isInsurance = invoice.paymentMethod === "insurance";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1726]/45 p-3 sm:p-5"
      role="dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="border-b border-[#efefef] p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="label">Invoice Number</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#224770]">
                {invoice.invoiceNo}
              </h2>
              <p className="mt-2 text-sm font-semibold text-[#46484a]">
                {shortDate(invoice.date)} {invoice.time ?? ""}
              </p>
            </div>
            <StatusPill tone={isInsurance ? "cyan" : "green"}>
              {invoiceStatus(invoice)}
            </StatusPill>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[#efefef]/45 p-5">
          <section>
            <h3 className="mb-3 font-semibold text-[#224770]">Invoice Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <InvoiceDetailBlock label="Invoice Number" value={invoice.invoiceNo} />
              <InvoiceDetailBlock label="Date" value={shortDate(invoice.date)} />
              <InvoiceDetailBlock label="Time" value={invoice.time ?? "N/A"} />
              <InvoiceDetailBlock label="Invoice Status" value={invoiceStatus(invoice)} />
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-[#224770]">Patient Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InvoiceDetailBlock label="Patient Name" value={invoice.patientName} />
              <InvoiceDetailBlock label="Passport / ID" value={invoice.passport ?? "N/A"} />
              <InvoiceDetailBlock label="Mobile Number" value={invoice.phone ?? "N/A"} />
              <InvoiceDetailBlock label="Nationality" value={invoice.nationality ?? "N/A"} />
              {invoice.email ? <InvoiceDetailBlock label="Email" value={invoice.email} /> : null}
            </div>
          </section>

          <section>
            <h3 className="mb-3 font-semibold text-[#224770]">Billing Information</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InvoiceDetailBlock label="Doctor" value={doctorName} />
              <InvoiceDetailBlock
                label="Payment Method"
                value={paymentTypeLabels[invoice.paymentMethod]}
              />
              {isInsurance ? (
                <InvoiceDetailBlock
                  label="Assistance Company"
                  value={invoice.assistanceCompanyName ?? "N/A"}
                />
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-[#efefef] bg-white p-4">
            <h3 className="font-semibold text-[#224770]">Invoice Summary</h3>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <div className="flex justify-between rounded-lg bg-[#efefef]/55 px-3 py-2">
                <span className="text-[#46484a]">Clinical Services Total</span>
                <span className="font-semibold text-[#224770]">{usdWhole(clinicalTotal)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#efefef]/55 px-3 py-2">
                <span className="text-[#46484a]">Medication Charges</span>
                <span className="font-semibold text-[#224770]">{usdWhole(medicationTotal)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#efefef]/55 px-3 py-2">
                <span className="text-[#46484a]">Consumable Charges</span>
                <span className="font-semibold text-[#224770]">{usdWhole(consumableTotal)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#efefef]/55 px-3 py-2">
                <span className="text-[#46484a]">Discount</span>
                <span className="font-semibold text-[#224770]">{usdWhole(invoice.discount)}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#224770] px-3 py-2 text-white">
                <span className="font-semibold">Invoice Total</span>
                <span className="font-bold">{usdWhole(invoice.totalAmount)}</span>
              </div>
              {isInsurance ? (
                <>
                  <div className="flex justify-between rounded-lg bg-[#efefef]/55 px-3 py-2">
                    <span className="text-[#46484a]">Claim Percentage</span>
                    <span className="font-semibold text-[#224770]">
                      {invoice.claimPercentage ?? 0}%
                    </span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-[#84bc3f]/15 px-3 py-2">
                    <span className="font-semibold text-[#4f7f22]">Claim Amount</span>
                    <span className="font-bold text-[#4f7f22]">
                      {usdWhole(invoice.claimAmount ?? 0)}
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#efefef] bg-white p-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onPrint} className={buttonClass("secondary", "min-h-12")}>
            Print
          </button>
          <button type="button" onClick={onDownload} className={buttonClass("primary", "min-h-12")}>
            Print / Save PDF
          </button>
          <button type="button" onClick={onEmail} className={buttonClass("secondary", "min-h-12")}>
            Email Invoice
          </button>
          <button type="button" onClick={onClose} className={buttonClass("secondary", "min-h-12")}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function InvoicesDashboard({ doctors, invoices }: InvoicesDashboardProps) {
  const [invoiceDateFilter, setInvoiceDateFilter] = useState("");
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState("");
  const [patientNameSearch, setPatientNameSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const systemSettings = useSystemSettings();

  const filteredInvoices = useMemo(() => {
    const invoiceNumberTerm = invoiceNumberSearch.trim().toLowerCase();
    const patientNameTerm = patientNameSearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      if (invoiceDateFilter && invoice.date !== invoiceDateFilter) {
        return false;
      }

      if (invoiceNumberTerm && !invoice.invoiceNo.toLowerCase().includes(invoiceNumberTerm)) {
        return false;
      }

      if (patientNameTerm && !invoice.patientName.toLowerCase().includes(patientNameTerm)) {
        return false;
      }

      return true;
    });
  }, [invoiceDateFilter, invoiceNumberSearch, invoices, patientNameSearch]);

  const hasActiveFilters =
    Boolean(invoiceDateFilter) ||
    Boolean(invoiceNumberSearch.trim()) ||
    Boolean(patientNameSearch.trim());

  function doctorNameForInvoice(invoice: Invoice) {
    return doctors.find((candidate) => candidate.id === invoice.doctorId)?.name ?? "Unassigned";
  }

  function printInvoiceDocument(invoice: Invoice) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(
      buildInvoiceDocument(invoice, doctorNameForInvoice(invoice), systemSettings.clinic.clinicName)
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function emailInvoice(invoice: Invoice) {
    openEmailDraft({
      to: invoice.email,
      subject: `${systemSettings.clinic.clinicName} invoice ${invoice.invoiceNo}`,
      body: buildInvoiceEmail(
        invoice,
        doctorNameForInvoice(invoice),
        systemSettings.clinic.clinicName
      )
    });
  }

  function clearFilters() {
    setInvoiceDateFilter("");
    setInvoiceNumberSearch("");
    setPatientNameSearch("");
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[220px_minmax(220px,1fr)_minmax(220px,1fr)_160px] xl:items-end">
          <div>
            <label className="label" htmlFor="invoice-date-filter">
              Invoice Date
            </label>
            <input
              id="invoice-date-filter"
              type="date"
              value={invoiceDateFilter}
              onChange={(event) => setInvoiceDateFilter(event.target.value)}
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="invoice-number-search">
              Invoice Number
            </label>
            <input
              id="invoice-number-search"
              value={invoiceNumberSearch}
              onChange={(event) => setInvoiceNumberSearch(event.target.value)}
              className="field mt-2 min-h-12"
              placeholder="Search invoice no."
            />
          </div>
          <div>
            <label className="label" htmlFor="patient-name-search">
              Patient Name
            </label>
            <input
              id="patient-name-search"
              value={patientNameSearch}
              onChange={(event) => setPatientNameSearch(event.target.value)}
              className="field mt-2 min-h-12"
              placeholder="Search patient name"
            />
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className={buttonClass(
              hasActiveFilters ? "secondary" : "muted",
              "min-h-12 w-full px-4 py-3"
            )}
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">Invoice Registry</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Invoice No.</th>
                <th className={tableStyles.headerCell}>Date</th>
                <th className={tableStyles.headerCell}>Patient Name</th>
                <th className={tableStyles.headerCell}>Passport / ID</th>
                <th className={tableStyles.headerCell}>Doctor</th>
                <th className={tableStyles.headerCell}>Payment Type</th>
                <th className={tableStyles.numericHeaderCell}>
                  Total {systemSettings.clinic.currency}
                </th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(invoice)}
                      className="font-semibold text-[#224770] underline-offset-4 hover:underline"
                    >
                      {invoice.invoiceNo}
                    </button>
                  </td>
                  <td className={tableStyles.cell}>{shortDate(invoice.date)}</td>
                  <td className={tableStyles.cell}>{invoice.patientName}</td>
                  <td className={tableStyles.cell}>{invoice.passport ?? "N/A"}</td>
                  <td className={tableStyles.cell}>{doctorNameForInvoice(invoice)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={invoice.paymentMethod === "insurance" ? "cyan" : "slate"}>
                      {paymentTypeLabels[invoice.paymentMethod]}
                    </StatusPill>
                  </td>
                  <td className={tableStyles.numericCell}>{usdWhole(invoice.totalAmount)}</td>
                  <td className={tableStyles.actionCell}>
                    <ActionSelect
                      ariaLabel={`Actions for invoice ${invoice.invoiceNo}`}
                      actions={[
                        {
                          value: "view",
                          label: "View",
                          onSelect: () => setSelectedInvoice(invoice)
                        },
                        {
                          value: "print",
                          label: "Print / Save PDF",
                          onSelect: () => printInvoiceDocument(invoice)
                        },
                        {
                          value: "email",
                          label: "Email Invoice",
                          onSelect: () => emailInvoice(invoice)
                        }
                      ]}
                    />
                  </td>
                </tr>
              ))}
              {!filteredInvoices.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={8}>
                    No invoices found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice ? (
        <InvoiceDetailsModal
          invoice={selectedInvoice}
          doctorName={doctorNameForInvoice(selectedInvoice)}
          onClose={() => setSelectedInvoice(null)}
          onDownload={() => printInvoiceDocument(selectedInvoice)}
          onEmail={() => emailInvoice(selectedInvoice)}
          onPrint={() => printInvoiceDocument(selectedInvoice)}
        />
      ) : null}
    </div>
  );
}
