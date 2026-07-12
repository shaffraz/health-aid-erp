"use client";

import { useMemo, useState } from "react";
import { buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate, usdWhole } from "@/lib/format";
import type { Doctor, Invoice, PaymentMethod } from "@/lib/types";

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

function buildInvoiceDocument(invoice: Invoice, doctorName: string) {
  const rows = invoice.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.serviceName)}</td>
        <td>${usdWhole(item.lineTotal)}</td>
      </tr>`
    )
    .join("");

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
    <h1>Health Aid Arugambay</h1>
    <p class="meta">Invoice ${escapeHtml(invoice.invoiceNo)}</p>
    <p class="meta">${escapeHtml(invoice.date)} ${escapeHtml(invoice.time)}</p>
    <p class="meta">Patient: ${escapeHtml(invoice.patientName)}</p>
    <p class="meta">Passport / ID: ${escapeHtml(invoice.passport ?? "N/A")}</p>
    <p class="meta">Doctor: ${escapeHtml(doctorName)}</p>
    <table>
      <thead><tr><th>Service / charge</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total ${usdWhole(invoice.totalAmount)}</p>
  </body>
</html>`;
}

export function InvoicesDashboard({ doctors, invoices }: InvoicesDashboardProps) {
  const [invoiceDateFilter, setInvoiceDateFilter] = useState("");
  const [invoiceNumberSearch, setInvoiceNumberSearch] = useState("");
  const [patientNameSearch, setPatientNameSearch] = useState("");

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

  function downloadInvoicePdf(invoice: Invoice) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(buildInvoiceDocument(invoice, doctorNameForInvoice(invoice)));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
                <th className={tableStyles.numericHeaderCell}>Total USD</th>
                <th className={tableStyles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{invoice.invoiceNo}</td>
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
                  <td className={tableStyles.cell}>
                    <button
                      type="button"
                      onClick={() => downloadInvoicePdf(invoice)}
                      className={buttonClass("secondary", "px-3 py-2 text-xs")}
                    >
                      Download PDF
                    </button>
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
    </div>
  );
}
