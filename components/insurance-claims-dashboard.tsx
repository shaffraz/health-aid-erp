"use client";

import { useMemo, useState } from "react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate, todayISO, usdWhole } from "@/lib/format";
import type { AppUser, InsuranceReceivable, Invoice } from "@/lib/types";

type ClaimStatus =
  | "Draft"
  | "Submitted"
  | "Under Review"
  | "Approved"
  | "Paid"
  | "Rejected"
  | "Overdue";

type InsuranceClaim = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  date: string;
  patientName: string;
  passport?: string;
  assistanceCompany: string;
  services: string[];
  invoiceTotal: number;
  deductionPercent: number;
  deductionAmount: number;
  claimAmount: number;
  status: ClaimStatus;
};

type StatementGroup = {
  key: string;
  assistanceCompany: string;
  period: string;
  claims: InsuranceClaim[];
  totalClaimAmount: number;
};

type InsuranceClaimsDashboardProps = {
  invoices: Invoice[];
  insuranceReceivables: InsuranceReceivable[];
  currentUser: AppUser;
};

const claimStatuses: ClaimStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Paid",
  "Rejected",
  "Overdue"
];

const partnerVisibleStatuses = new Set<ClaimStatus>([
  "Submitted",
  "Under Review",
  "Approved",
  "Paid",
  "Rejected"
]);

const claimStatusTones = {
  Draft: "slate",
  Submitted: "cyan",
  "Under Review": "amber",
  Approved: "green",
  Paid: "green",
  Rejected: "red",
  Overdue: "red"
} satisfies Record<ClaimStatus, "green" | "amber" | "cyan" | "red" | "slate">;

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

const deductionPercentByCompany: Record<string, number> = {
  "Global Travel Assist": 10,
  "NomadCare Insurance": 12,
  "Blue Ocean Travel Cover": 0,
  "Island Rescue Claims": 15
};

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

function claimStatusFromReceivable(status?: InsuranceReceivable["status"]): ClaimStatus {
  if (status === "Paid") {
    return "Paid";
  }

  if (status === "Partially Paid") {
    return "Under Review";
  }

  if (status === "Overdue") {
    return "Overdue";
  }

  if (status === "Pending") {
    return "Submitted";
  }

  return "Draft";
}

function buildClaims(
  invoices: Invoice[],
  insuranceReceivables: InsuranceReceivable[]
): InsuranceClaim[] {
  return invoices
    .filter((invoice) => invoice.paymentMethod === "insurance")
    .map((invoice) => {
      const receivable = insuranceReceivables.find((candidate) =>
        candidate.invoices.includes(invoice.invoiceNo)
      );
      const assistanceCompany = receivable?.insuranceCompany ?? "Unassigned assistance company";
      const invoiceTotal = Math.round(invoice.totalAmount);
      const deductionPercent = deductionPercentByCompany[assistanceCompany] ?? 5;
      const deductionAmount = Math.round((invoiceTotal * deductionPercent) / 100);
      const claimAmount = Math.max(0, invoiceTotal - deductionAmount);

      return {
        id: `claim-${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        patientName: invoice.patientName,
        passport: invoice.passport,
        assistanceCompany,
        services: invoice.items.map((item) => item.serviceName),
        invoiceTotal,
        deductionPercent,
        deductionAmount,
        claimAmount,
        status: claimStatusFromReceivable(receivable?.status)
      };
    });
}

function buildInvoiceDocument(claim: InsuranceClaim) {
  const rows = claim.services
    .map((service) => `<tr><td>${escapeHtml(service)}</td></tr>`)
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(claim.invoiceNo)}</title>
    <style>
      body { color: #0b1726; font-family: Arial, sans-serif; margin: 32px; }
      table { border-collapse: collapse; margin-top: 16px; width: 100%; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .meta { color: #46484a; margin: 4px 0; }
      .total { font-size: 18px; font-weight: 700; margin-top: 24px; text-align: right; }
    </style>
  </head>
  <body>
    <h1>Health Aid Arugambay</h1>
    <p class="meta">Invoice ${escapeHtml(claim.invoiceNo)}</p>
    <p class="meta">Patient: ${escapeHtml(claim.patientName)}</p>
    <p class="meta">Passport / ID: ${escapeHtml(claim.passport ?? "N/A")}</p>
    <p class="meta">Assistance company: ${escapeHtml(claim.assistanceCompany)}</p>
    <table>
      <thead><tr><th>Services</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Invoice total ${usdWhole(claim.invoiceTotal)}</p>
  </body>
</html>`;
}

function buildStatementDocument(statement: StatementGroup) {
  const rows = statement.claims
    .map(
      (claim) => `<tr>
        <td>${escapeHtml(claim.invoiceNo)}</td>
        <td>${escapeHtml(claim.patientName)}</td>
        <td>${escapeHtml(claim.passport ?? "N/A")}</td>
        <td>${escapeHtml(claim.services.join(", "))}</td>
        <td>${usdWhole(claim.invoiceTotal)}</td>
        <td>${usdWhole(claim.deductionAmount)}</td>
        <td>${usdWhole(claim.claimAmount)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(statement.assistanceCompany)} ${escapeHtml(statement.period)}</title>
    <style>
      body { color: #0b1726; font-family: Arial, sans-serif; margin: 32px; }
      h1 { margin: 0 0 6px; }
      .meta { color: #46484a; margin: 4px 0; }
      table { border-collapse: collapse; margin-top: 18px; width: 100%; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; }
      .total { font-size: 18px; font-weight: 700; margin-top: 24px; text-align: right; }
    </style>
  </head>
  <body>
    <h1>Health Aid Arugambay</h1>
    <p class="meta">Insurance Claim Statement</p>
    <p class="meta">Assistance company: ${escapeHtml(statement.assistanceCompany)}</p>
    <p class="meta">Statement period: ${escapeHtml(formatMonth(statement.period))}</p>
    <table>
      <thead>
        <tr>
          <th>Invoice number</th>
          <th>Patient name</th>
          <th>Passport / ID</th>
          <th>Services</th>
          <th>Invoice total USD</th>
          <th>Deduction amount USD</th>
          <th>Claim amount USD</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total claim amount ${usdWhole(statement.totalClaimAmount)}</p>
  </body>
</html>`;
}

function statementCsv(statement: StatementGroup) {
  const rows = [
    [
      "Assistance company name",
      "Statement period",
      "Invoice number",
      "Patient name",
      "Passport / ID",
      "Services",
      "Invoice total USD",
      "Deduction amount USD",
      "Claim amount USD"
    ],
    ...statement.claims.map((claim) => [
      statement.assistanceCompany,
      formatMonth(statement.period),
      claim.invoiceNo,
      claim.patientName,
      claim.passport ?? "N/A",
      claim.services.join("; "),
      String(claim.invoiceTotal),
      String(claim.deductionAmount),
      String(claim.claimAmount)
    ]),
    [
      statement.assistanceCompany,
      formatMonth(statement.period),
      "Total claim amount",
      "",
      "",
      "",
      "",
      "",
      String(statement.totalClaimAmount)
    ]
  ];

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

export function InsuranceClaimsDashboard({
  invoices,
  insuranceReceivables,
  currentUser
}: InsuranceClaimsDashboardProps) {
  const currentMonth = todayISO().slice(0, 7);
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | "all">("all");
  const [claimSearch, setClaimSearch] = useState("");
  const [selectedStatementKey, setSelectedStatementKey] = useState("");

  const allClaims = useMemo(
    () => buildClaims(invoices, insuranceReceivables),
    [insuranceReceivables, invoices]
  );

  const roleScopedClaims = useMemo(() => {
    if (currentUser.role !== "insurance_partner") {
      return allClaims;
    }

    return allClaims.filter(
      (claim) =>
        claim.assistanceCompany === currentUser.assistanceCompany &&
        partnerVisibleStatuses.has(claim.status)
    );
  }, [allClaims, currentUser.assistanceCompany, currentUser.role]);

  const companyOptions = useMemo(
    () =>
      [...new Set(roleScopedClaims.map((claim) => claim.assistanceCompany))]
        .sort((a, b) => a.localeCompare(b)),
    [roleScopedClaims]
  );

  const yearOptions = useMemo(
    () =>
      [...new Set(roleScopedClaims.map((claim) => claim.date.slice(0, 4)))]
        .sort((a, b) => b.localeCompare(a)),
    [roleScopedClaims]
  );

  const statusOptions = currentUser.role === "insurance_partner"
    ? claimStatuses.filter((status) => partnerVisibleStatuses.has(status))
    : claimStatuses;

  const filteredClaims = useMemo(() => {
    const searchTerm = claimSearch.trim().toLowerCase();

    return roleScopedClaims.filter((claim) => {
      const searchableText = [
        claim.invoiceNo,
        claim.patientName,
        claim.passport ?? ""
      ].join(" ").toLowerCase();

      if (yearFilter !== "all" && !claim.date.startsWith(yearFilter)) {
        return false;
      }

      if (monthFilter !== "all" && claim.date.slice(5, 7) !== monthFilter) {
        return false;
      }

      if (companyFilter !== "all" && claim.assistanceCompany !== companyFilter) {
        return false;
      }

      if (statusFilter !== "all" && claim.status !== statusFilter) {
        return false;
      }

      if (searchTerm && !searchableText.includes(searchTerm)) {
        return false;
      }

      return true;
    });
  }, [claimSearch, companyFilter, monthFilter, roleScopedClaims, statusFilter, yearFilter]);

  const currentMonthClaims = roleScopedClaims.filter((claim) =>
    claim.date.startsWith(currentMonth)
  );
  const claimsThisMonth = currentMonthClaims.length;
  const claimAmountThisMonth = currentMonthClaims.reduce(
    (sum, claim) => sum + claim.claimAmount,
    0
  );
  const paidClaims = currentMonthClaims
    .filter((claim) => claim.status === "Paid")
    .reduce((sum, claim) => sum + claim.claimAmount, 0);
  const outstandingClaims = currentMonthClaims
    .filter((claim) => !["Paid", "Rejected"].includes(claim.status))
    .reduce((sum, claim) => sum + claim.claimAmount, 0);
  const overdueClaims = currentMonthClaims
    .filter((claim) => claim.status === "Overdue")
    .reduce((sum, claim) => sum + claim.claimAmount, 0);

  const statementGroups = useMemo(() => {
    const groups = new Map<string, StatementGroup>();

    filteredClaims.forEach((claim) => {
      const period = claim.date.slice(0, 7);
      const key = `${claim.assistanceCompany}-${period}`;
      const existing = groups.get(key);

      if (existing) {
        existing.claims.push(claim);
        existing.totalClaimAmount += claim.claimAmount;
      } else {
        groups.set(key, {
          key,
          assistanceCompany: claim.assistanceCompany,
          period,
          claims: [claim],
          totalClaimAmount: claim.claimAmount
        });
      }
    });

    return [...groups.values()].sort(
      (a, b) => b.period.localeCompare(a.period) || a.assistanceCompany.localeCompare(b.assistanceCompany)
    );
  }, [filteredClaims]);

  const selectedStatement = statementGroups.find(
    (statement) => statement.key === selectedStatementKey
  );

  function downloadInvoicePdf(claim: InsuranceClaim) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      return;
    }

    printWindow.document.write(buildInvoiceDocument(claim));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function downloadStatementPdf(statement: StatementGroup) {
    const statementWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!statementWindow) {
      return;
    }

    statementWindow.document.write(buildStatementDocument(statement));
    statementWindow.document.close();
    statementWindow.focus();
    statementWindow.print();
  }

  function downloadStatementCsv(statement: StatementGroup) {
    downloadFile(
      `${statement.assistanceCompany}-${statement.period}-claims.csv`,
      statementCsv(statement),
      "text/csv;charset=utf-8"
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Claims This Month" value={String(claimsThisMonth)} tone="primary" />
        <KpiCard
          label="Claim Amount This Month USD"
          value={usdWhole(claimAmountThisMonth)}
          tone="info"
        />
        <KpiCard label="Paid Claims USD" value={usdWhole(paidClaims)} tone="success" />
        <KpiCard
          label="Outstanding Claims USD"
          value={usdWhole(outstandingClaims)}
          tone="warning"
        />
        <KpiCard label="Overdue Claims USD" value={usdWhole(overdueClaims)} tone="danger" />
      </div>

      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[150px_150px_220px_200px_minmax(260px,1fr)]">
          <div>
            <label className="label" htmlFor="claim-year-filter">
              Year
            </label>
            <select
              id="claim-year-filter"
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
            <label className="label" htmlFor="claim-month-filter">
              Month
            </label>
            <select
              id="claim-month-filter"
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
            <label className="label" htmlFor="assistance-company-filter">
              Assistance Company
            </label>
            <select
              id="assistance-company-filter"
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
              disabled={currentUser.role === "insurance_partner"}
              className="field mt-2"
            >
              <option value="all">All companies</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="claim-status-filter">
              Claim Status
            </label>
            <select
              id="claim-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ClaimStatus | "all")}
              className="field mt-2"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="claim-search">
              Search
            </label>
            <input
              id="claim-search"
              value={claimSearch}
              onChange={(event) => setClaimSearch(event.target.value)}
              className="field mt-2"
              placeholder="Invoice number, patient name, passport/ID"
            />
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">Insurance Claim Registry</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Invoice No.</th>
                <th className={tableStyles.headerCell}>Date</th>
                <th className={tableStyles.headerCell}>Patient</th>
                <th className={tableStyles.headerCell}>Passport / ID</th>
                <th className={tableStyles.headerCell}>Assistance Company</th>
                <th className={tableStyles.numericHeaderCell}>Invoice Total USD</th>
                <th className={tableStyles.numericHeaderCell}>Deduction %</th>
                <th className={tableStyles.numericHeaderCell}>Claim Amount USD</th>
                <th className={tableStyles.headerCell}>Claim Status</th>
                <th className={tableStyles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredClaims.map((claim) => (
                <tr key={claim.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{claim.invoiceNo}</td>
                  <td className={tableStyles.cell}>{shortDate(claim.date)}</td>
                  <td className={tableStyles.cell}>{claim.patientName}</td>
                  <td className={tableStyles.cell}>{claim.passport ?? "N/A"}</td>
                  <td className={tableStyles.cell}>{claim.assistanceCompany}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(claim.invoiceTotal)}</td>
                  <td className={tableStyles.numericCell}>{claim.deductionPercent}%</td>
                  <td className={tableStyles.numericCell}>{usdWhole(claim.claimAmount)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={claimStatusTones[claim.status]}>{claim.status}</StatusPill>
                  </td>
                  <td className={tableStyles.cell}>
                    <button
                      type="button"
                      onClick={() => downloadInvoicePdf(claim)}
                      className={buttonClass("secondary", "px-3 py-2 text-xs")}
                    >
                      Download Invoice PDF
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredClaims.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={10}>
                    No insurance claims match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">Assistance Company Statements</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Assistance Company</th>
                <th className={tableStyles.headerCell}>Statement Period</th>
                <th className={tableStyles.numericHeaderCell}>Invoices</th>
                <th className={tableStyles.numericHeaderCell}>Total Claim Amount USD</th>
                <th className={tableStyles.headerCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {statementGroups.map((statement) => (
                <tr key={statement.key} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{statement.assistanceCompany}</td>
                  <td className={tableStyles.cell}>{formatMonth(statement.period)}</td>
                  <td className={tableStyles.numericCell}>{statement.claims.length}</td>
                  <td className={tableStyles.numericCell}>
                    {usdWhole(statement.totalClaimAmount)}
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="flex min-w-[360px] flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedStatementKey(statement.key)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        View Statement
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadStatementPdf(statement)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        Download Statement PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadStatementCsv(statement)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        Download Statement CSV
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!statementGroups.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={5}>
                    No assistance company statements for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedStatement ? (
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="label">Statement Preview</p>
              <h2 className="mt-2 text-lg font-semibold text-[#224770]">
                {selectedStatement.assistanceCompany} - {formatMonth(selectedStatement.period)}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStatementKey("")}
              className={buttonClass("secondary", "px-3 py-2")}
            >
              Close
            </button>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#efefef]">
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Invoice number</th>
                  <th className={tableStyles.headerCell}>Patient name</th>
                  <th className={tableStyles.headerCell}>Passport / ID</th>
                  <th className={tableStyles.headerCell}>Services</th>
                  <th className={tableStyles.numericHeaderCell}>Invoice total USD</th>
                  <th className={tableStyles.numericHeaderCell}>Deduction amount USD</th>
                  <th className={tableStyles.numericHeaderCell}>Claim amount USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {selectedStatement.claims.map((claim) => (
                  <tr key={claim.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{claim.invoiceNo}</td>
                    <td className={tableStyles.cell}>{claim.patientName}</td>
                    <td className={tableStyles.cell}>{claim.passport ?? "N/A"}</td>
                    <td className={tableStyles.cell}>{claim.services.join(", ")}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(claim.invoiceTotal)}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(claim.deductionAmount)}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(claim.claimAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end text-base font-bold text-[#224770]">
            Total claim amount {usdWhole(selectedStatement.totalClaimAmount)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
