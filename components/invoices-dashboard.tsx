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

type PaymentTypeFilter = Extract<PaymentMethod, "cash" | "card" | "insurance"> | "all";

const paymentTypeLabels = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
} satisfies Record<PaymentMethod, string>;

const paymentTypeOptions: Array<{ value: PaymentTypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "insurance", label: "Insurance" }
];

const monthOptions = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" }
];

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
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentTypeFilter>("all");
  const [registrySearch, setRegistrySearch] = useState("");

  const yearOptions = useMemo(
    () =>
      [...new Set(invoices.map((invoice) => invoice.date.slice(0, 4)))]
        .sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

  const filteredInvoices = useMemo(() => {
    const searchTerm = registrySearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const searchableText = [
        invoice.invoiceNo,
        invoice.patientName,
        invoice.passport ?? ""
      ].join(" ").toLowerCase();

      if (yearFilter !== "all" && !invoice.date.startsWith(yearFilter)) {
        return false;
      }

      if (monthFilter !== "all" && invoice.date.slice(5, 7) !== monthFilter) {
        return false;
      }

      if (paymentTypeFilter !== "all" && invoice.paymentMethod !== paymentTypeFilter) {
        return false;
      }

      if (searchTerm && !searchableText.includes(searchTerm)) {
        return false;
      }

      return true;
    });
  }, [invoices, monthFilter, paymentTypeFilter, registrySearch, yearFilter]);

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

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_180px_220px_minmax(260px,1fr)]">
          <div>
            <label className="label" htmlFor="invoice-year-filter">
              Year
            </label>
            <select
              id="invoice-year-filter"
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="field mt-2"
            >
              <option value="all">All years</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="invoice-month-filter">
              Month
            </label>
            <select
              id="invoice-month-filter"
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="field mt-2"
            >
              <option value="all">All months</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="payment-type-filter">
              Payment Type
            </label>
            <select
              id="payment-type-filter"
              value={paymentTypeFilter}
              onChange={(event) => setPaymentTypeFilter(event.target.value as PaymentTypeFilter)}
              className="field mt-2"
            >
              {paymentTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="registry-search">
              Search
            </label>
            <input
              id="registry-search"
              value={registrySearch}
              onChange={(event) => setRegistrySearch(event.target.value)}
              className="field mt-2"
              placeholder="Invoice number, patient name, passport/ID"
            />
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">General Invoice Registry</h2>
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
                    No invoices match the selected filters.
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
