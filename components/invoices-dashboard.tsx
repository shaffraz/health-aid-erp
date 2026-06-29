"use client";

import { useMemo, useState } from "react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate, todayISO, usdWhole } from "@/lib/format";
import type {
  Doctor,
  InsuranceReceivable,
  Invoice,
  PaymentMethod,
  Role
} from "@/lib/types";

type InvoicesDashboardProps = {
  doctors: Doctor[];
  invoices: Invoice[];
  insuranceReceivables: InsuranceReceivable[];
  currentRole: Role;
};

type InvoiceStatus = "Active" | "Void";

const paymentMethodLabels = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
} satisfies Record<PaymentMethod, string>;

const receivableStatusTones = {
  Pending: "amber",
  "Partially Paid": "cyan",
  Paid: "green",
  Overdue: "red"
} satisfies Record<InsuranceReceivable["status"], "green" | "amber" | "cyan" | "red">;

function receivableOutstanding(receivable: InsuranceReceivable) {
  return Math.max(0, receivable.totalBilled - receivable.paidAmount);
}

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

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function insuranceCompanyForInvoice(
  invoiceNo: string,
  receivables: InsuranceReceivable[]
) {
  return receivables.find((receivable) => receivable.invoices.includes(invoiceNo))
    ?.insuranceCompany;
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

export function InvoicesDashboard({
  doctors,
  invoices,
  insuranceReceivables,
  currentRole
}: InvoicesDashboardProps) {
  const today = todayISO();
  const currentMonth = today.slice(0, 7);
  const [insuranceMonth, setInsuranceMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentMethod | "all">("all");
  const [insuranceCompanyFilter, setInsuranceCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
  const [patientSearch, setPatientSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [voidedInvoiceIds, setVoidedInvoiceIds] = useState<string[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedAction, setSelectedAction] = useState<"View" | "Edit">("View");

  const canVoidInvoices = currentRole === "admin";
  const selectedInsuranceMonth = insuranceMonth || currentMonth;
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

  const activeInvoices = invoices.filter((invoice) => !voidedInvoiceIds.includes(invoice.id));
  const todayInvoices = activeInvoices.filter((invoice) => invoice.date === today);
  const monthlyInvoices = activeInvoices.filter((invoice) =>
    invoice.date.startsWith(currentMonth)
  );
  const insurancePayments = insuranceReceivables.filter((receivable) =>
    receivable.billedDate.startsWith(selectedInsuranceMonth)
  );

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedInvoiceId);

  const filteredInvoices = useMemo(() => {
    const patientTerm = patientSearch.trim().toLowerCase();
    const invoiceTerm = invoiceSearch.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const status: InvoiceStatus = voidedInvoiceIds.includes(invoice.id) ? "Void" : "Active";
      const insuranceCompany = invoiceCompanyByNo.get(invoice.invoiceNo) ?? "";

      if (startDate && invoice.date < startDate) {
        return false;
      }

      if (endDate && invoice.date > endDate) {
        return false;
      }

      if (doctorFilter !== "all" && invoice.doctorId !== doctorFilter) {
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

      if (patientTerm && !invoice.patientName.toLowerCase().includes(patientTerm)) {
        return false;
      }

      if (invoiceTerm && !invoice.invoiceNo.toLowerCase().includes(invoiceTerm)) {
        return false;
      }

      return true;
    });
  }, [
    doctorFilter,
    endDate,
    insuranceCompanyFilter,
    invoiceCompanyByNo,
    invoiceSearch,
    invoices,
    patientSearch,
    paymentFilter,
    startDate,
    statusFilter,
    voidedInvoiceIds
  ]);

  function paymentTotal(source: Invoice[], method: PaymentMethod) {
    return source
      .filter((invoice) => invoice.paymentMethod === method)
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  }

  const monthlyRevenue = monthlyInvoices.reduce(
    (sum, invoice) => sum + invoice.totalAmount,
    0
  );
  const insuranceBilledThisMonth = insurancePayments.reduce(
    (sum, receivable) => sum + receivable.totalBilled,
    0
  );
  const insurancePaidThisMonth = insurancePayments.reduce(
    (sum, receivable) => sum + receivable.paidAmount,
    0
  );
  const insuranceOutstanding = insurancePayments.reduce(
    (sum, receivable) => sum + receivableOutstanding(receivable),
    0
  );
  const overdueInsuranceReceivables = insurancePayments
    .filter((receivable) => receivable.status === "Overdue")
    .reduce((sum, receivable) => sum + receivableOutstanding(receivable), 0);

  function exportInsuranceExcel() {
    const rows = [
      [
        "Insurance Company",
        "Number of Patients",
        "Number of Invoices",
        "Total Amount USD",
        "Paid Amount USD",
        "Outstanding Amount USD",
        "Payment Status"
      ],
      ...insurancePayments.map((receivable) => [
        receivable.insuranceCompany,
        String(receivable.patients.length),
        String(receivable.invoices.length),
        String(receivable.totalBilled),
        String(receivable.paidAmount),
        String(receivableOutstanding(receivable)),
        receivable.status
      ])
    ];
    const table = `<table>${rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
      )
      .join("")}</table>`;

    downloadFile(
      `insurance-payments-${selectedInsuranceMonth}.xls`,
      table,
      "application/vnd.ms-excel;charset=utf-8"
    );
  }

  function exportInsurancePdf() {
    const rows = insurancePayments
      .map(
        (receivable) => `<tr>
          <td>${escapeHtml(receivable.insuranceCompany)}</td>
          <td>${receivable.patients.length}</td>
          <td>${receivable.invoices.length}</td>
          <td>${usdWhole(receivable.totalBilled)}</td>
          <td>${usdWhole(receivable.paidAmount)}</td>
          <td>${usdWhole(receivableOutstanding(receivable))}</td>
          <td>${escapeHtml(receivable.status)}</td>
        </tr>`
      )
      .join("");
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!reportWindow) {
      return;
    }

    reportWindow.document.write(`<!doctype html>
      <html>
        <head>
          <title>Insurance payments ${escapeHtml(selectedInsuranceMonth)}</title>
          <style>
            body { color: #0b1726; font-family: Arial, sans-serif; margin: 32px; }
            h1 { margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
            th { background: #f1f5f9; }
          </style>
        </head>
        <body>
          <h1>Insurance Payments - ${escapeHtml(formatMonth(selectedInsuranceMonth))}</h1>
          <table>
            <thead>
              <tr>
                <th>Insurance Company</th><th>Patients</th><th>Invoices</th>
                <th>Total</th><th>Paid</th><th>Outstanding</th><th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>`);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  }

  function printInvoice(invoice: Invoice) {
    const doctor = doctors.find((candidate) => candidate.id === invoice.doctorId);
    const company = insuranceCompanyForInvoice(invoice.invoiceNo, insuranceReceivables);
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(
      buildInvoiceDocument(invoice, doctor?.name ?? "Unassigned", company)
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function downloadInvoicePdf(invoice: Invoice) {
    printInvoice(invoice);
  }

  function voidInvoice(invoiceId: string) {
    setVoidedInvoiceIds((current) =>
      current.includes(invoiceId) ? current : [...current, invoiceId]
    );
  }

  function paymentStatusCell(status: InsuranceReceivable["status"]) {
    return <StatusPill tone={receivableStatusTones[status]}>{status}</StatusPill>;
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#224770]">Today&apos;s Breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Cash (USD)" value={usdWhole(paymentTotal(todayInvoices, "cash"))} />
          <KpiCard label="Card (USD)" value={usdWhole(paymentTotal(todayInvoices, "card"))} />
          <KpiCard
            label="Insurance (USD)"
            value={usdWhole(paymentTotal(todayInvoices, "insurance"))}
            tone="info"
          />
          <KpiCard label="Total Invoices" value={String(todayInvoices.length)} tone="primary" />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#224770]">Monthly Breakdown</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Cash (USD)" value={usdWhole(paymentTotal(monthlyInvoices, "cash"))} />
          <KpiCard label="Card (USD)" value={usdWhole(paymentTotal(monthlyInvoices, "card"))} />
          <KpiCard
            label="Insurance (USD)"
            value={usdWhole(paymentTotal(monthlyInvoices, "insurance"))}
            tone="info"
          />
          <KpiCard label="Monthly Revenue (USD)" value={usdWhole(monthlyRevenue)} tone="success" />
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[#efefef] p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#224770]">Insurance Payments</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_180px_auto_auto] sm:items-end">
            <div>
              <p className="label">Current Month</p>
              <p className="mt-2 rounded-lg border border-[#efefef] bg-[#efefef]/50 px-3 py-2 text-sm font-semibold text-[#224770]">
                {formatMonth(currentMonth)}
              </p>
            </div>
            <div>
              <label className="label" htmlFor="insurance-month">
                Filter by Month
              </label>
              <input
                id="insurance-month"
                type="month"
                value={insuranceMonth}
                onChange={(event) => setInsuranceMonth(event.target.value)}
                className="field mt-2"
              />
            </div>
            <button
              type="button"
              onClick={exportInsuranceExcel}
              className={buttonClass("secondary", "h-10 px-3 py-2")}
            >
              Export to Excel
            </button>
            <button
              type="button"
              onClick={exportInsurancePdf}
              className={buttonClass("secondary", "h-10 px-3 py-2")}
            >
              Export to PDF
            </button>
          </div>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Insurance Company</th>
                <th className={tableStyles.numericHeaderCell}>Number of Patients</th>
                <th className={tableStyles.numericHeaderCell}>Number of Invoices</th>
                <th className={tableStyles.numericHeaderCell}>Total Amount (USD)</th>
                <th className={tableStyles.numericHeaderCell}>Paid Amount</th>
                <th className={tableStyles.numericHeaderCell}>Outstanding Amount</th>
                <th className={tableStyles.headerCell}>Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {insurancePayments.map((receivable) => (
                <tr key={receivable.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{receivable.insuranceCompany}</td>
                  <td className={tableStyles.numericCell}>{receivable.patients.length}</td>
                  <td className={tableStyles.numericCell}>{receivable.invoices.length}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(receivable.totalBilled)}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(receivable.paidAmount)}</td>
                  <td className={tableStyles.numericCell}>
                    {usdWhole(receivableOutstanding(receivable))}
                  </td>
                  <td className={tableStyles.cell}>{paymentStatusCell(receivable.status)}</td>
                </tr>
              ))}
              {!insurancePayments.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={7}>
                    No insurance payments for the selected month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">Insurance Outstanding Receivables</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Insurance Billed This Month"
            value={usdWhole(insuranceBilledThisMonth)}
            tone="info"
            className="min-h-28"
          />
          <KpiCard
            label="Insurance Paid This Month"
            value={usdWhole(insurancePaidThisMonth)}
            tone="success"
            className="min-h-28"
          />
          <KpiCard
            label="Insurance Outstanding"
            value={usdWhole(insuranceOutstanding)}
            tone="warning"
            className="min-h-28"
          />
          <KpiCard
            label="Overdue Insurance Receivables"
            value={usdWhole(overdueInsuranceReceivables)}
            tone="danger"
            className="min-h-28"
          />
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Insurance company</th>
                <th className={tableStyles.headerCell}>Patients</th>
                <th className={tableStyles.headerCell}>Invoices</th>
                <th className={tableStyles.numericHeaderCell}>Total billed USD</th>
                <th className={tableStyles.numericHeaderCell}>Paid amount USD</th>
                <th className={tableStyles.numericHeaderCell}>Outstanding amount USD</th>
                <th className={tableStyles.headerCell}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {insurancePayments.map((receivable) => (
                <tr key={receivable.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{receivable.insuranceCompany}</td>
                  <td className={tableStyles.cell}>{receivable.patients.join(", ")}</td>
                  <td className={tableStyles.cell}>{receivable.invoices.join(", ")}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(receivable.totalBilled)}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(receivable.paidAmount)}</td>
                  <td className={tableStyles.numericCell}>
                    {usdWhole(receivableOutstanding(receivable))}
                  </td>
                  <td className={tableStyles.cell}>{paymentStatusCell(receivable.status)}</td>
                </tr>
              ))}
              {!insurancePayments.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={7}>
                    No insurance receivables for the selected month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-lg font-semibold text-[#224770]">Invoice Filters</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="label" htmlFor="invoice-start-date">
              Date Range Start
            </label>
            <input
              id="invoice-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="field mt-2"
            />
          </div>
          <div>
            <label className="label" htmlFor="invoice-end-date">
              Date Range End
            </label>
            <input
              id="invoice-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="field mt-2"
            />
          </div>
          <div>
            <label className="label" htmlFor="doctor-filter">
              Doctor
            </label>
            <select
              id="doctor-filter"
              value={doctorFilter}
              onChange={(event) => setDoctorFilter(event.target.value)}
              className="field mt-2"
            >
              <option value="all">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
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
              onChange={(event) => setPaymentFilter(event.target.value as PaymentMethod | "all")}
              className="field mt-2"
            >
              <option value="all">All methods</option>
              {Object.entries(paymentMethodLabels).map(([method, label]) => (
                <option key={method} value={method}>
                  {label}
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
              Status
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
          <div>
            <label className="label" htmlFor="patient-search">
              Patient Search
            </label>
            <input
              id="patient-search"
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              className="field mt-2"
              placeholder="Patient name"
            />
          </div>
          <div>
            <label className="label" htmlFor="invoice-search">
              Invoice Number Search
            </label>
            <input
              id="invoice-search"
              value={invoiceSearch}
              onChange={(event) => setInvoiceSearch(event.target.value)}
              className="field mt-2"
              placeholder="HA-ABAY"
            />
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">Invoice List</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Invoice No.</th>
                <th className={tableStyles.headerCell}>Date</th>
                <th className={tableStyles.headerCell}>Time</th>
                <th className={tableStyles.headerCell}>Patient</th>
                <th className={tableStyles.headerCell}>Passport / ID</th>
                <th className={tableStyles.headerCell}>Doctor</th>
                <th className={tableStyles.headerCell}>Payment Method</th>
                <th className={tableStyles.headerCell}>Insurance Company</th>
                <th className={tableStyles.numericHeaderCell}>Amount (USD)</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredInvoices.map((invoice) => {
                const doctor = doctors.find((candidate) => candidate.id === invoice.doctorId);
                const insuranceCompany = invoiceCompanyByNo.get(invoice.invoiceNo);
                const status: InvoiceStatus = voidedInvoiceIds.includes(invoice.id)
                  ? "Void"
                  : "Active";

                return (
                  <tr key={invoice.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{invoice.invoiceNo}</td>
                    <td className={tableStyles.cell}>{shortDate(invoice.date)}</td>
                    <td className={tableStyles.cell}>{invoice.time ?? "N/A"}</td>
                    <td className={tableStyles.cell}>{invoice.patientName}</td>
                    <td className={tableStyles.cell}>{invoice.passport ?? "N/A"}</td>
                    <td className={tableStyles.cell}>{doctor?.name ?? "Unassigned"}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={invoice.paymentMethod === "insurance" ? "cyan" : "slate"}>
                        {paymentMethodLabels[invoice.paymentMethod]}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>{insuranceCompany ?? "N/A"}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(invoice.totalAmount)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={status === "Active" ? "green" : "red"}>{status}</StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      <div className="flex min-w-[360px] flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceId(invoice.id);
                            setSelectedAction("View");
                          }}
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
                          Download PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedInvoiceId(invoice.id);
                            setSelectedAction("Edit");
                          }}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          Edit
                        </button>
                        {canVoidInvoices ? (
                          <button
                            type="button"
                            onClick={() => voidInvoice(invoice.id)}
                            disabled={status === "Void"}
                            className={buttonClass(
                              status === "Void" ? "muted" : "danger",
                              "px-3 py-2 text-xs"
                            )}
                          >
                            Void Invoice
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredInvoices.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={11}>
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
            <h2 className="text-lg font-semibold text-[#224770]">
              {selectedAction === "Edit" ? "Edit Invoice" : "Invoice Details"}
            </h2>
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
              <p className="label">Patient</p>
              <p className="mt-2 font-semibold text-[#224770]">{selectedInvoice.patientName}</p>
            </div>
            <div>
              <p className="label">Payment Method</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {paymentMethodLabels[selectedInvoice.paymentMethod]}
              </p>
            </div>
            <div>
              <p className="label">Amount</p>
              <p className="mt-2 font-semibold text-[#224770]">
                {usdWhole(selectedInvoice.totalAmount)}
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
