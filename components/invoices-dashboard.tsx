"use client";

import { useMemo, useState } from "react";
import { buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate, usdWhole } from "@/lib/format";
import type { Doctor, InsuranceReceivable, Invoice, PaymentMethod } from "@/lib/types";

type InvoicesDashboardProps = {
  doctors: Doctor[];
  invoices: Invoice[];
  insuranceReceivables: InsuranceReceivable[];
};

type InvoiceStatus = "Active" | "Void";
type PaymentFilter = Extract<PaymentMethod, "cash" | "card" | "insurance"> | "all";

const paymentMethodLabels = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
} satisfies Record<PaymentMethod, string>;

const paymentFilterOptions: Array<{ value: PaymentFilter; label: string }> = [
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

const invoiceStatusTones = {
  Active: "green",
  Void: "red"
} satisfies Record<InvoiceStatus, "green" | "red">;

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}-01T00:00:00`));
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsv(value: string | number | undefined) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function invoiceStatus(): InvoiceStatus {
  return "Active";
}

function insuranceCompanyForInvoice(
  invoiceNo: string,
  receivables: InsuranceReceivable[]
) {
  return receivables.find((receivable) => receivable.invoices.includes(invoiceNo))
    ?.insuranceCompany;
}

function statementPeriodForInvoice(invoice: Invoice) {
  return formatMonth(invoice.date.slice(0, 7));
}

function buildInvoiceDocument(
  invoice: Invoice,
  doctorName: string,
  insuranceCompany?: string
) {
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
    ${insuranceCompany ? `<p class="meta">Insurance: ${escapeHtml(insuranceCompany)}</p>` : ""}
    <table>
      <thead><tr><th>Service / charge</th><th>Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total ${usdWhole(invoice.totalAmount)}</p>
  </body>
</html>`;
}

function buildInsuranceStatementDocument(invoice: Invoice, insuranceCompany: string) {
  const serviceRows = invoice.items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.serviceName)}</td>
        <td>${usdWhole(item.lineTotal)}</td>
      </tr>`
    )
    .join("");
  const statementPeriod = statementPeriodForInvoice(invoice);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Insurance Statement ${escapeHtml(invoice.invoiceNo)}</title>
    <style>
      body { color: #0b1726; font-family: Arial, sans-serif; margin: 32px; }
      h1 { margin: 0 0 18px; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 24px; margin-bottom: 22px; }
      .label { color: #46484a; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .value { font-size: 14px; font-weight: 700; margin-top: 4px; }
      table { border-collapse: collapse; margin-top: 16px; width: 100%; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .total { font-size: 18px; font-weight: 700; margin-top: 24px; text-align: right; }
    </style>
  </head>
  <body>
    <h1>Detailed Insurance Statement</h1>
    <div class="meta-grid">
      <div><div class="label">Insurance company</div><div class="value">${escapeHtml(insuranceCompany)}</div></div>
      <div><div class="label">Statement period</div><div class="value">${escapeHtml(statementPeriod)}</div></div>
      <div><div class="label">Invoice number</div><div class="value">${escapeHtml(invoice.invoiceNo)}</div></div>
      <div><div class="label">Date</div><div class="value">${escapeHtml(invoice.date)}</div></div>
      <div><div class="label">Patient name</div><div class="value">${escapeHtml(invoice.patientName)}</div></div>
      <div><div class="label">Passport / ID</div><div class="value">${escapeHtml(invoice.passport ?? "N/A")}</div></div>
    </div>
    <table>
      <thead><tr><th>Services provided</th><th>Total invoice amount USD</th></tr></thead>
      <tbody>${serviceRows}</tbody>
    </table>
    <p class="total">Total amount for the statement ${usdWhole(invoice.totalAmount)}</p>
  </body>
</html>`;
}

export function InvoicesDashboard({
  doctors,
  invoices,
  insuranceReceivables
}: InvoicesDashboardProps) {
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");
  const [insuranceCompanyFilter, setInsuranceCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [registrySearch, setRegistrySearch] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const invoiceCompanyByNo = useMemo(() => {
    const map = new Map<string, string>();
    insuranceReceivables.forEach((receivable) => {
      receivable.invoices.forEach((invoiceNo) => {
        map.set(invoiceNo, receivable.insuranceCompany);
      });
    });
    return map;
  }, [insuranceReceivables]);

  const insuranceCompanies = useMemo(
    () =>
      [...new Set(insuranceReceivables.map((receivable) => receivable.insuranceCompany))]
        .sort((a, b) => a.localeCompare(b)),
    [insuranceReceivables]
  );

  const yearOptions = useMemo(
    () => [...new Set(invoices.map((invoice) => invoice.date.slice(0, 4)))]
      .sort((a, b) => b.localeCompare(a)),
    [invoices]
  );

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);

  const filteredInvoices = useMemo(() => {
    const searchTerm = registrySearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status = invoiceStatus();
      const insuranceCompany = invoiceCompanyByNo.get(invoice.invoiceNo) ?? "";
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

      if (paymentFilter !== "all" && invoice.paymentMethod !== paymentFilter) {
        return false;
      }

      if (insuranceCompanyFilter !== "all" && insuranceCompany !== insuranceCompanyFilter) {
        return false;
      }

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (searchTerm && !searchableText.includes(searchTerm)) {
        return false;
      }

      return true;
    });
  }, [
    insuranceCompanyFilter,
    invoiceCompanyByNo,
    invoices,
    monthFilter,
    paymentFilter,
    registrySearch,
    statusFilter,
    yearFilter
  ]);

  function doctorNameForInvoice(invoice: Invoice) {
    return doctors.find((candidate) => candidate.id === invoice.doctorId)?.name ?? "Unassigned";
  }

  function printInvoice(invoice: Invoice) {
    const company = insuranceCompanyForInvoice(invoice.invoiceNo, insuranceReceivables);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(
      buildInvoiceDocument(invoice, doctorNameForInvoice(invoice), company)
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function downloadInvoicePdf(invoice: Invoice) {
    printInvoice(invoice);
  }

  function downloadInsuranceStatementPdf(invoice: Invoice) {
    const company =
      insuranceCompanyForInvoice(invoice.invoiceNo, insuranceReceivables) ??
      "Unassigned insurance company";
    const statementWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!statementWindow) {
      return;
    }

    statementWindow.document.write(buildInsuranceStatementDocument(invoice, company));
    statementWindow.document.close();
    statementWindow.focus();
    statementWindow.print();
  }

  function downloadInsuranceStatementCsv(invoice: Invoice) {
    const company =
      insuranceCompanyForInvoice(invoice.invoiceNo, insuranceReceivables) ??
      "Unassigned insurance company";
    const servicesProvided = invoice.items.map((item) => item.serviceName).join("; ");
    const rows = [
      [
        "Statement title",
        "Insurance company",
        "Statement period",
        "Invoice number",
        "Date",
        "Patient name",
        "Passport / ID",
        "Services provided",
        "Total invoice amount USD",
        "Total amount for the statement"
      ],
      [
        "Detailed Insurance Statement",
        company,
        statementPeriodForInvoice(invoice),
        invoice.invoiceNo,
        invoice.date,
        invoice.patientName,
        invoice.passport ?? "N/A",
        servicesProvided,
        String(invoice.totalAmount),
        String(invoice.totalAmount)
      ]
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    downloadFile(
      `${invoice.invoiceNo}-insurance-statement.csv`,
      csv,
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
            <label className="label" htmlFor="payment-filter">
              Payment Method
            </label>
            <select
              id="payment-filter"
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value as PaymentFilter)}
              className="field mt-2"
            >
              {paymentFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="insurance-company-filter">
              Insurance Company
            </label>
            <select
              id="insurance-company-filter"
              value={insuranceCompanyFilter}
              onChange={(event) => setInsuranceCompanyFilter(event.target.value)}
              className="field mt-2"
            >
              <option value="all">All companies</option>
              {insuranceCompanies.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="status-filter">
              Invoice status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as InvoiceStatus | "all")}
              className="field mt-2"
            >
              <option value="all">All statuses</option>
              <option value="Active">Active</option>
              <option value="Void">Void</option>
            </select>
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <label className="label" htmlFor="registry-search">
              Search
            </label>
            <input
              id="registry-search"
              value={registrySearch}
              onChange={(event) => setRegistrySearch(event.target.value)}
              className="field mt-2"
              placeholder="Invoice, patient, passport/ID"
            />
          </div>
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
                <th className={tableStyles.headerCell}>Payment Method</th>
                <th className={tableStyles.headerCell}>Insurance Company</th>
                <th className={tableStyles.numericHeaderCell}>Total USD</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredInvoices.map((invoice) => {
                const insuranceCompany = invoiceCompanyByNo.get(invoice.invoiceNo);
                const status = invoiceStatus();
                const isInsuranceInvoice = invoice.paymentMethod === "insurance";

                return (
                  <tr key={invoice.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{invoice.invoiceNo}</td>
                    <td className={tableStyles.cell}>{shortDate(invoice.date)}</td>
                    <td className={tableStyles.cell}>{invoice.patientName}</td>
                    <td className={tableStyles.cell}>{invoice.passport ?? "N/A"}</td>
                    <td className={tableStyles.cell}>{doctorNameForInvoice(invoice)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={isInsuranceInvoice ? "cyan" : "slate"}>
                        {paymentMethodLabels[invoice.paymentMethod]}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      {insuranceCompany ?? (isInsuranceInvoice ? "Not assigned" : "N/A")}
                    </td>
                    <td className={tableStyles.numericCell}>{usdWhole(invoice.totalAmount)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={invoiceStatusTones[status]}>{status}</StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      <div className="flex min-w-[420px] flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => printInvoice(invoice)}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          Print
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadInvoicePdf(invoice)}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          Download Invoice PDF
                        </button>
                        {isInsuranceInvoice ? (
                          <>
                            <button
                              type="button"
                              onClick={() => downloadInsuranceStatementPdf(invoice)}
                              className={buttonClass("secondary", "px-3 py-2 text-xs")}
                            >
                              Download Detailed Statement
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadInsuranceStatementCsv(invoice)}
                              className={buttonClass("secondary", "px-3 py-2 text-xs")}
                            >
                              Statement CSV
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredInvoices.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={10}>
                    No invoices match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice ? (
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#224770]">Invoice Details</h2>
            <button
              type="button"
              onClick={() => setSelectedInvoiceId("")}
              className={buttonClass("secondary", "px-3 py-2")}
            >
              Close
            </button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="label">Invoice No.</p>
              <p className="mt-2 font-semibold text-[#224770]">{selectedInvoice.invoiceNo}</p>
            </div>
            <div>
              <p className="label">Date</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {shortDate(selectedInvoice.date)}
              </p>
            </div>
            <div>
              <p className="label">Patient Name</p>
              <p className="mt-2 font-semibold text-[#224770]">{selectedInvoice.patientName}</p>
            </div>
            <div>
              <p className="label">Passport / ID</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {selectedInvoice.passport ?? "N/A"}
              </p>
            </div>
            <div>
              <p className="label">Doctor</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {doctorNameForInvoice(selectedInvoice)}
              </p>
            </div>
            <div>
              <p className="label">Payment Method</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {paymentMethodLabels[selectedInvoice.paymentMethod]}
              </p>
            </div>
            <div>
              <p className="label">Insurance Company</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {invoiceCompanyByNo.get(selectedInvoice.invoiceNo) ??
                  (selectedInvoice.paymentMethod === "insurance" ? "Not assigned" : "N/A")}
              </p>
            </div>
            <div>
              <p className="label">Total USD</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {usdWhole(selectedInvoice.totalAmount)}
              </p>
            </div>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#efefef]">
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Service provided</th>
                  <th className={tableStyles.numericHeaderCell}>Amount USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {selectedInvoice.items.map((item) => (
                  <tr key={item.id} className={tableStyles.row}>
                    <td className={tableStyles.cell}>{item.serviceName}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
