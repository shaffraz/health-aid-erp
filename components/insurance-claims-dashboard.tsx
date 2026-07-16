"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ActionSelect, type ActionSelectOption } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { openEmailDraft } from "@/lib/email";
import { demoAssistanceCompanies } from "@/lib/demo-data";
import { shortDate, todayISO, usdWhole } from "@/lib/format";
import { generateId } from "@/lib/id";
import { hasPermission } from "@/lib/permissions";
import type { SystemSettings } from "@/lib/settings";
import { useSystemSettings } from "@/lib/use-system-settings";
import {
  assistanceCompanyStorageKey,
  type AppUser,
  type AssistanceCompany,
  type InsuranceClaimStatus,
  type InsuranceReceivable,
  type Invoice
} from "@/lib/types";

type InsuranceClaim = {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  date: string;
  patientName: string;
  passport?: string;
  assistanceCompanyId?: string;
  assistanceCompany: string;
  invoiceTotal: number;
  claimPercentage: number;
  claimAmount: number;
  status: InsuranceClaimStatus;
};

type MonthlyStatementStatus =
  | "Draft"
  | "Confirmed"
  | "Submitted"
  | "Partially Paid"
  | "Paid"
  | "Overdue";

type StatementPayment = {
  id: string;
  paymentDate: string;
  amountReceived: number;
  reference: string;
  notes: string;
};

type MonthlyStatementRecord = {
  id: string;
  assistanceCompany: string;
  assistanceCompanyId?: string;
  month: string;
  invoiceIds: string[];
  invoiceNos: string[];
  status: MonthlyStatementStatus;
  confirmedDate?: string;
  submittedDate?: string;
  payments: StatementPayment[];
};

type MonthlyStatement = {
  id: string;
  assistanceCompany: string;
  assistanceCompanyId?: string;
  month: string;
  claims: InsuranceClaim[];
  insurancePatients: number;
  invoiceCount: number;
  fullInvoiceTotal: number;
  claimAmount: number;
  amountReceived: number;
  outstanding: number;
  status: MonthlyStatementStatus;
  confirmedDate?: string;
  submittedDate?: string;
  payments: StatementPayment[];
};

type SeasonalConfirmation = {
  id: string;
  assistanceCompany: string;
  fromDate: string;
  toDate: string;
  confirmationDate: string;
  notes: string;
  totalPatients: number;
  totalInvoices: number;
  totalInvoiceAmount: number;
  totalClaimAmount: number;
  totalReceived: number;
  totalOutstanding: number;
};

type CompanyForm = {
  id?: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  defaultClaimPercentage: number;
  active: boolean;
  notes: string;
};

type PaymentForm = {
  paymentDate: string;
  amountReceived: string;
  reference: string;
  notes: string;
};

type SeasonalForm = {
  assistanceCompany: string;
  fromDate: string;
  toDate: string;
  confirmationDate: string;
  notes: string;
};

type InsuranceClaimsDashboardProps = {
  invoices: Invoice[];
  insuranceReceivables: InsuranceReceivable[];
  currentUser: AppUser;
};

const monthlyStatementStorageKey = "health-aid-insurance-monthly-statements-v1";
const seasonalConfirmationStorageKey =
  "health-aid-insurance-seasonal-confirmations-v1";

const statementStatusTones = {
  Draft: "slate",
  Confirmed: "cyan",
  Submitted: "cyan",
  "Partially Paid": "amber",
  Paid: "green",
  Overdue: "red"
} satisfies Record<MonthlyStatementStatus, "green" | "amber" | "cyan" | "red" | "slate">;

const emptyCompanyForm: CompanyForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  defaultClaimPercentage: 80,
  active: true,
  notes: ""
};

const emptyPaymentForm: PaymentForm = {
  paymentDate: "",
  amountReceived: "",
  reference: "",
  notes: ""
};

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

function roundUsd(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function roundPercentage(value: number) {
  return Math.min(100, roundUsd(value));
}

function currentMonthDateRange() {
  const today = todayISO();
  const [year, month] = today.slice(0, 7).split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    fromDate: `${today.slice(0, 7)}-01`,
    toDate: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`
  };
}

function defaultSeasonalForm(company = ""): SeasonalForm {
  const range = currentMonthDateRange();

  return {
    assistanceCompany: company,
    ...range,
    confirmationDate: todayISO(),
    notes: ""
  };
}

function dateRangeIsValid(fromDate: string, toDate: string) {
  return Boolean(fromDate && toDate && toDate >= fromDate);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });
}

function statementIdFor(assistanceCompany: string, month: string) {
  return `${month}-${assistanceCompany.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function paymentsTotal(payments: StatementPayment[]) {
  return payments.reduce((sum, payment) => sum + roundUsd(payment.amountReceived), 0);
}

function claimStatusFromReceivable(status?: InsuranceReceivable["status"]): InsuranceClaimStatus {
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

function companyToForm(company: AssistanceCompany): CompanyForm {
  return {
    id: company.id,
    name: company.name,
    contactPerson: company.contactPerson ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    defaultClaimPercentage: company.defaultClaimPercentage,
    active: company.active,
    notes: company.notes ?? ""
  };
}

function formToCompany(form: CompanyForm): AssistanceCompany {
  return {
    id: form.id ?? generateId(),
    name: form.name.trim(),
    contactPerson: form.contactPerson.trim() || undefined,
    email: form.email.trim() || undefined,
    phone: form.phone.trim() || undefined,
    defaultClaimPercentage: roundPercentage(form.defaultClaimPercentage),
    active: form.active,
    notes: form.notes.trim() || undefined
  };
}

function claimMatchesCompany(claim: InsuranceClaim, company: AssistanceCompany) {
  return claim.assistanceCompanyId === company.id || claim.assistanceCompany === company.name;
}

function buildClaims(
  invoices: Invoice[],
  insuranceReceivables: InsuranceReceivable[],
  companies: AssistanceCompany[]
): InsuranceClaim[] {
  return invoices
    .filter((invoice) => invoice.paymentMethod === "insurance")
    .map((invoice) => {
      const receivable = insuranceReceivables.find((candidate) =>
        candidate.invoices.includes(invoice.invoiceNo)
      );
      const company =
        companies.find((candidate) => candidate.id === invoice.assistanceCompanyId) ??
        companies.find((candidate) => candidate.name === invoice.assistanceCompanyName) ??
        companies.find((candidate) => candidate.name === receivable?.insuranceCompany);
      const assistanceCompany =
        invoice.assistanceCompanyName ??
        company?.name ??
        receivable?.insuranceCompany ??
        "Unassigned assistance company";
      const invoiceTotal = roundUsd(invoice.totalAmount);
      const claimPercentage = roundPercentage(
        invoice.claimPercentage ?? company?.defaultClaimPercentage ?? 80
      );
      const claimAmount = roundUsd(invoice.claimAmount ?? (invoiceTotal * claimPercentage) / 100);

      return {
        id: `claim-${invoice.id}`,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        patientName: invoice.patientName,
        passport: invoice.passport,
        assistanceCompanyId: invoice.assistanceCompanyId ?? company?.id,
        assistanceCompany,
        invoiceTotal,
        claimPercentage,
        claimAmount,
        status: invoice.claimStatus ?? claimStatusFromReceivable(receivable?.status)
      };
    });
}

function buildStatementDocument(statement: MonthlyStatement, settings: SystemSettings) {
  const clinicName = settings.clinic.clinicName;
  const statementTitle = settings.insurance.defaultStatementFormat;
  const rows = statement.claims
    .map(
      (claim) => `<tr>
        <td>${escapeHtml(claim.invoiceNo)}</td>
        <td>${escapeHtml(claim.date)}</td>
        <td>${escapeHtml(claim.patientName)}</td>
        <td>${escapeHtml(claim.passport ?? "N/A")}</td>
        <td>${usdWhole(claim.invoiceTotal)}</td>
        <td>${escapeHtml(claim.claimPercentage)}%</td>
        <td>${usdWhole(claim.claimAmount)}</td>
        <td>${escapeHtml(statement.status)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(statement.assistanceCompany)} ${escapeHtml(monthLabel(statement.month))}</title>
    <style>
      body { color: #224770; font-family: Arial, sans-serif; margin: 32px; }
      h1 { margin: 0 0 6px; }
      h2 { margin: 0 0 18px; font-size: 18px; }
      .meta { color: #46484a; margin: 4px 0; }
      table { border-collapse: collapse; margin-top: 18px; width: 100%; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; }
      .summary { margin-top: 22px; margin-left: auto; width: 360px; }
      .summary div { display: flex; justify-content: space-between; padding: 6px 0; }
      .summary strong { color: #224770; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(clinicName)}</h1>
    <h2>${escapeHtml(statementTitle)}</h2>
    <p class="meta">Assistance company: ${escapeHtml(statement.assistanceCompany)}</p>
    <p class="meta">Statement month: ${escapeHtml(monthLabel(statement.month))}</p>
    <p class="meta">Statement status: ${escapeHtml(statement.status)}</p>
    <p class="meta">Statement generation date: ${escapeHtml(todayISO())}</p>
    <table>
      <thead>
        <tr>
          <th>Invoice number</th>
          <th>Invoice date</th>
          <th>Patient name</th>
          <th>Passport / ID</th>
          <th>Full invoice amount</th>
          <th>Claim percentage used</th>
          <th>Claim amount</th>
          <th>Payment status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div><span>Insurance patients</span><strong>${escapeHtml(statement.insurancePatients)}</strong></div>
      <div><span>Number of invoices</span><strong>${escapeHtml(statement.invoiceCount)}</strong></div>
      <div><span>Full invoice total</span><strong>${usdWhole(statement.fullInvoiceTotal)}</strong></div>
      <div><span>Claim amount</span><strong>${usdWhole(statement.claimAmount)}</strong></div>
      <div><span>Amount received</span><strong>${usdWhole(statement.amountReceived)}</strong></div>
      <div><span>Outstanding</span><strong>${usdWhole(statement.outstanding)}</strong></div>
    </div>
  </body>
</html>`;
}

function statementCsv(statement: MonthlyStatement, settings: SystemSettings) {
  const clinicName = settings.clinic.clinicName;

  const rows = [
    [
      clinicName,
      "Assistance company",
      "Statement month",
      "Statement status",
      "Invoice number",
      "Invoice date",
      "Patient name",
      "Passport / ID",
      `Full invoice amount ${settings.clinic.currency}`,
      "Claim percentage used",
      `Claim amount ${settings.clinic.currency}`,
      "Payment status"
    ],
    ...statement.claims.map((claim) => [
      clinicName,
      statement.assistanceCompany,
      monthLabel(statement.month),
      statement.status,
      claim.invoiceNo,
      claim.date,
      claim.patientName,
      claim.passport ?? "N/A",
      String(claim.invoiceTotal),
      `${claim.claimPercentage}%`,
      String(claim.claimAmount),
      statement.status
    ]),
    [
      clinicName,
      statement.assistanceCompany,
      monthLabel(statement.month),
      statement.status,
      "Summary",
      "",
      `Insurance patients: ${statement.insurancePatients}`,
      `Invoices: ${statement.invoiceCount}`,
      `Full invoice total: ${statement.fullInvoiceTotal}`,
      "",
      `Claim amount: ${statement.claimAmount}`,
      `Amount received: ${statement.amountReceived}; Outstanding: ${statement.outstanding}`
    ]
  ];

  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function CompanyDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-white p-3">
      <span className="label">{label}</span>
      <p className="mt-1 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}

function CompanyFormModal({
  companyForm,
  companyError,
  onCompanyFormChange,
  onCancel,
  onSave
}: {
  companyForm: CompanyForm;
  companyError: string;
  onCompanyFormChange: (form: CompanyForm) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const title = companyForm.id ? "Edit Company" : "Add Company";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">{title}</h2>
        </div>
        <div className="form-grid grid gap-4 p-5 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="company-name">
              Company Name
            </label>
            <input
              id="company-name"
              value={companyForm.name}
              onChange={(event) =>
                onCompanyFormChange({ ...companyForm, name: event.target.value })
              }
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="company-contact">
              Contact Person
            </label>
            <input
              id="company-contact"
              value={companyForm.contactPerson}
              onChange={(event) =>
                onCompanyFormChange({ ...companyForm, contactPerson: event.target.value })
              }
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="company-email">
              Email
            </label>
            <input
              id="company-email"
              type="email"
              value={companyForm.email}
              onChange={(event) =>
                onCompanyFormChange({ ...companyForm, email: event.target.value })
              }
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="company-phone">
              Phone
            </label>
            <input
              id="company-phone"
              value={companyForm.phone}
              onChange={(event) =>
                onCompanyFormChange({ ...companyForm, phone: event.target.value })
              }
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="company-claim-percent">
              Default Claim Percentage
            </label>
            <input
              id="company-claim-percent"
              type="number"
              min={0}
              max={100}
              step="1"
              value={companyForm.defaultClaimPercentage}
              onChange={(event) =>
                onCompanyFormChange({
                  ...companyForm,
                  defaultClaimPercentage: roundPercentage(Number(event.target.value))
                })
              }
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="company-active">
              Status
            </label>
            <select
              id="company-active"
              value={companyForm.active ? "active" : "inactive"}
              onChange={(event) =>
                onCompanyFormChange({
                  ...companyForm,
                  active: event.target.value === "active"
                })
              }
              className="field mt-2 min-h-12"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="company-notes">
              Notes
            </label>
            <textarea
              id="company-notes"
              value={companyForm.notes}
              onChange={(event) =>
                onCompanyFormChange({ ...companyForm, notes: event.target.value })
              }
              className="field mt-2 min-h-28"
            />
          </div>
          {companyError ? (
            <p className="rounded-lg bg-[#efefef] px-3 py-2 text-sm font-semibold text-[#224770] md:col-span-2">
              {companyError}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-[#efefef] p-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass("secondary", "min-h-12 px-6")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className={buttonClass("primary", "min-h-12 px-6")}
          >
            Save Company
          </button>
        </div>
      </div>
    </div>
  );
}

function StatementActions({
  canConfirm,
  canRecordPayment,
  canSubmit,
  onConfirm,
  onDownloadCsv,
  onDownloadPdf,
  onEmail,
  onRecordPayment,
  onSubmit,
  onView,
  showView = true,
  statement
}: {
  canConfirm: boolean;
  canRecordPayment: boolean;
  canSubmit: boolean;
  onConfirm: () => void;
  onDownloadCsv: () => void;
  onDownloadPdf: () => void;
  onEmail: () => void;
  onRecordPayment: () => void;
  onSubmit: () => void;
  onView: () => void;
  showView?: boolean;
  statement: MonthlyStatement;
}) {
  const actions = [
    showView
      ? {
          value: "view",
          label: "View",
          onSelect: onView
        }
      : null,
    {
      value: "pdf",
      label: "Print / Save PDF",
      onSelect: onDownloadPdf
    },
    {
      value: "csv",
      label: "Download CSV",
      onSelect: onDownloadCsv
    },
    {
      value: "email",
      label: "Email Statement",
      onSelect: onEmail
    },
    statement.status === "Draft" && canConfirm
      ? {
          value: "confirm",
          label: "Confirm Statement",
          onSelect: onConfirm
        }
      : null,
    statement.status === "Confirmed" && canSubmit
      ? {
          value: "submit",
          label: "Mark Submitted",
          onSelect: onSubmit
        }
      : null,
    ["Submitted", "Partially Paid", "Overdue"].includes(statement.status) && canRecordPayment
      ? {
          value: "payment",
          label: statement.outstanding > 0 ? "Record Payment" : "Payment unavailable",
          disabled: statement.outstanding <= 0,
          onSelect: onRecordPayment
        }
      : null
  ].filter((action): action is ActionSelectOption => Boolean(action));

  return (
    <ActionSelect
      ariaLabel={`Actions for ${statement.assistanceCompany} ${monthLabel(statement.month)} statement`}
      actions={actions}
    />
  );
}

function StatementDetailsModal({
  canConfirm,
  canRecordPayment,
  canSubmit,
  onClose,
  onConfirm,
  onDownloadCsv,
  onDownloadPdf,
  onEmail,
  onRecordPayment,
  onSubmit,
  invoiceCurrencyCode,
  statement
}: {
  canConfirm: boolean;
  canRecordPayment: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onDownloadCsv: () => void;
  onDownloadPdf: () => void;
  onEmail: () => void;
  onRecordPayment: () => void;
  onSubmit: () => void;
  invoiceCurrencyCode: string;
  statement: MonthlyStatement;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-5"
      role="dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="flex flex-col gap-3 border-b border-[#efefef] p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="label">Assistance Company</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#224770]">
              {statement.assistanceCompany}
            </h2>
            <p className="mt-2 text-sm font-semibold text-[#46484a]">
              {monthLabel(statement.month)}
            </p>
          </div>
          <StatusPill tone={statementStatusTones[statement.status]}>
            {statement.status}
          </StatusPill>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[#efefef]/45 p-5">
          <section>
            <h3 className="mb-3 font-semibold text-[#224770]">Summary</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <CompanyDetail
                label="Insurance Patients"
                value={String(statement.insurancePatients)}
              />
              <CompanyDetail label="Number of Invoices" value={String(statement.invoiceCount)} />
              <CompanyDetail
                label={`Full Invoice Total ${invoiceCurrencyCode}`}
                value={usdWhole(statement.fullInvoiceTotal)}
              />
              <CompanyDetail
                label={`Claim Amount ${invoiceCurrencyCode}`}
                value={usdWhole(statement.claimAmount)}
              />
              <CompanyDetail
                label={`Amount Received ${invoiceCurrencyCode}`}
                value={usdWhole(statement.amountReceived)}
              />
              <CompanyDetail
                label={`Outstanding ${invoiceCurrencyCode}`}
                value={usdWhole(statement.outstanding)}
              />
            </div>
          </section>

          <section className="rounded-xl border border-[#efefef] bg-white">
            <div className="border-b border-[#efefef] px-4 py-3">
              <h3 className="font-semibold text-[#224770]">Invoice List</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#efefef] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a]">
                  <tr>
                    <th className="px-4 py-3">Invoice Number</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Patient Name</th>
                    <th className="px-4 py-3">Passport / ID</th>
                    <th className="px-4 py-3 text-right">
                      Full Invoice Amount {invoiceCurrencyCode}
                    </th>
                    <th className="px-4 py-3 text-right">Claim Percentage Used</th>
                    <th className="px-4 py-3 text-right">
                      Claim Amount {invoiceCurrencyCode}
                    </th>
                    <th className="px-4 py-3">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efefef]">
                  {statement.claims.map((claim) => (
                    <tr key={claim.id}>
                      <td className="px-4 py-3 font-semibold text-[#224770]">
                        {claim.invoiceNo}
                      </td>
                      <td className="px-4 py-3 text-[#46484a]">{shortDate(claim.date)}</td>
                      <td className="px-4 py-3 text-[#46484a]">{claim.patientName}</td>
                      <td className="px-4 py-3 text-[#46484a]">{claim.passport ?? "N/A"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#224770]">
                        {usdWhole(claim.invoiceTotal)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#224770]">
                        {claim.claimPercentage}%
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#224770]">
                        {usdWhole(claim.claimAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={statementStatusTones[statement.status]}>
                          {statement.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#efefef] bg-white p-4">
          <div className="overflow-x-auto">
            <StatementActions
              canConfirm={canConfirm}
              canRecordPayment={canRecordPayment}
              canSubmit={canSubmit}
              onConfirm={onConfirm}
              onDownloadCsv={onDownloadCsv}
              onDownloadPdf={onDownloadPdf}
              onEmail={onEmail}
              onRecordPayment={onRecordPayment}
              onSubmit={onSubmit}
              onView={() => undefined}
              showView={false}
              statement={statement}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className={buttonClass("secondary", "min-h-12 px-6")}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InsuranceClaimsDashboard({
  invoices,
  insuranceReceivables,
  currentUser
}: InsuranceClaimsDashboardProps) {
  const currentMonth = todayISO().slice(0, 7);
  const isCompanyPortal = hasPermission(currentUser, "canViewOwnCompanyInsurance");
  const partnerCompanyId = isCompanyPortal ? currentUser.assistanceCompanyId ?? "" : "";
  const partnerCompany = isCompanyPortal ? currentUser.assistanceCompany ?? "" : "";
  const [companies, setCompanies] = useState<AssistanceCompany[]>(demoAssistanceCompanies);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [statementRecords, setStatementRecords] = useState<MonthlyStatementRecord[]>([]);
  const [seasonalConfirmations, setSeasonalConfirmations] = useState<SeasonalConfirmation[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState("");
  const [paymentStatementId, setPaymentStatementId] = useState("");
  const [paymentForm, setPaymentForm] = useState<PaymentForm>(emptyPaymentForm);
  const [paymentError, setPaymentError] = useState("");
  const systemSettings = useSystemSettings();
  const [seasonalModalOpen, setSeasonalModalOpen] = useState(false);
  const [seasonalForm, setSeasonalForm] = useState<SeasonalForm>(() =>
    defaultSeasonalForm(partnerCompany)
  );
  const [seasonalError, setSeasonalError] = useState("");

  const canManageCompanies = hasPermission(currentUser, "canManageAssistanceCompanies");
  const canConfirmStatements = hasPermission(currentUser, "canManageInsurance");
  const canSubmitStatements = hasPermission(currentUser, "canManageInsurance");
  const canRecordPayments = hasPermission(currentUser, "canManageInsurance");
  const canConfirmSeasonalSummary = hasPermission(currentUser, "canManageInsurance");

  useEffect(() => {
    try {
      const storedCompanies = window.localStorage.getItem(assistanceCompanyStorageKey);
      if (storedCompanies) {
        const parsed = JSON.parse(storedCompanies);
        if (Array.isArray(parsed)) {
          setCompanies(parsed as AssistanceCompany[]);
        }
      }

      const storedStatements = window.localStorage.getItem(monthlyStatementStorageKey);
      if (storedStatements) {
        const parsed = JSON.parse(storedStatements);
        if (Array.isArray(parsed)) {
          setStatementRecords(parsed as MonthlyStatementRecord[]);
        }
      }

      const storedSeasonalConfirmations = window.localStorage.getItem(
        seasonalConfirmationStorageKey
      );
      if (storedSeasonalConfirmations) {
        const parsed = JSON.parse(storedSeasonalConfirmations);
        if (Array.isArray(parsed)) {
          setSeasonalConfirmations(parsed as SeasonalConfirmation[]);
        }
      }

    } catch {
      setCompanies(demoAssistanceCompanies);
      setStatementRecords([]);
      setSeasonalConfirmations([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(assistanceCompanyStorageKey, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    window.localStorage.setItem(monthlyStatementStorageKey, JSON.stringify(statementRecords));
  }, [statementRecords]);

  useEffect(() => {
    window.localStorage.setItem(
      seasonalConfirmationStorageKey,
      JSON.stringify(seasonalConfirmations)
    );
  }, [seasonalConfirmations]);

  const allClaims = useMemo(
    () => buildClaims(invoices, insuranceReceivables, companies),
    [companies, insuranceReceivables, invoices]
  );

  const roleScopedClaims = useMemo(() => {
    if (!isCompanyPortal) {
      return allClaims;
    }

    return allClaims.filter((claim) =>
      partnerCompanyId
        ? claim.assistanceCompanyId === partnerCompanyId
        : claim.assistanceCompany === partnerCompany
    );
  }, [allClaims, isCompanyPortal, partnerCompany, partnerCompanyId]);

  const companyOptions = useMemo(() => {
    if (isCompanyPortal && partnerCompany) {
      return [partnerCompany];
    }

    return [
      ...new Set([
        ...companies.map((company) => company.name),
        ...roleScopedClaims.map((claim) => claim.assistanceCompany)
      ])
    ].sort((a, b) => a.localeCompare(b));
  }, [companies, isCompanyPortal, partnerCompany, roleScopedClaims]);

  const monthlyStatements = useMemo<MonthlyStatement[]>(() => {
    const claimsByStatement = new Map<
      string,
      {
        assistanceCompany: string;
        assistanceCompanyId?: string;
        month: string;
        claims: InsuranceClaim[];
      }
    >();

    roleScopedClaims
      .filter((claim) => claim.status !== "Rejected")
      .forEach((claim) => {
        const month = monthKey(claim.date);
        const id = statementIdFor(claim.assistanceCompany, month);
        const existing = claimsByStatement.get(id);

        if (existing) {
          existing.claims.push(claim);
          return;
        }

        claimsByStatement.set(id, {
          assistanceCompany: claim.assistanceCompany,
          assistanceCompanyId: claim.assistanceCompanyId,
          month,
          claims: [claim]
        });
      });

    const visibleRecordIds = new Set<string>();

    statementRecords.forEach((record) => {
      if (
        isCompanyPortal &&
        (partnerCompanyId
          ? record.assistanceCompanyId !== partnerCompanyId
          : record.assistanceCompany !== partnerCompany)
      ) {
        return;
      }

      visibleRecordIds.add(record.id);
      if (!claimsByStatement.has(record.id)) {
        claimsByStatement.set(record.id, {
          assistanceCompany: record.assistanceCompany,
          assistanceCompanyId: record.assistanceCompanyId,
          month: record.month,
          claims: []
        });
      }
    });

    return [...claimsByStatement.entries()]
      .map(([id, group]) => {
        const record = statementRecords.find((candidate) => candidate.id === id);
        const frozenClaims =
          record && record.status !== "Draft"
            ? roleScopedClaims.filter((claim) => record.invoiceIds.includes(claim.invoiceId))
            : group.claims;
        const claims = frozenClaims.sort((a, b) => a.date.localeCompare(b.date));
        const payments = record?.payments ?? [];
        const amountReceived = paymentsTotal(payments);
        const fullInvoiceTotal = claims.reduce((sum, claim) => sum + claim.invoiceTotal, 0);
        const claimAmount = claims.reduce((sum, claim) => sum + claim.claimAmount, 0);
        const status =
          amountReceived >= claimAmount && claimAmount > 0
            ? "Paid"
            : amountReceived > 0
              ? "Partially Paid"
              : record?.status ?? "Draft";

        return {
          id,
          assistanceCompany: record?.assistanceCompany ?? group.assistanceCompany,
          assistanceCompanyId: record?.assistanceCompanyId ?? group.assistanceCompanyId,
          month: record?.month ?? group.month,
          claims,
          insurancePatients: new Set(
            claims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
          ).size,
          invoiceCount: claims.length,
          fullInvoiceTotal,
          claimAmount,
          amountReceived,
          outstanding: Math.max(0, claimAmount - amountReceived),
          status,
          confirmedDate: record?.confirmedDate,
          submittedDate: record?.submittedDate,
          payments
        };
      })
      .filter((statement) => visibleRecordIds.has(statement.id) || statement.invoiceCount > 0)
      .sort((a, b) => b.month.localeCompare(a.month) || a.assistanceCompany.localeCompare(b.assistanceCompany));
  }, [isCompanyPortal, partnerCompany, partnerCompanyId, roleScopedClaims, statementRecords]);

  const currentMonthClaims = roleScopedClaims.filter((claim) => claim.date.startsWith(currentMonth));
  const insurancePatientsThisMonth = new Set(
    currentMonthClaims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
  ).size;
  const insurancePatientsThisSeason = new Set(
    roleScopedClaims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
  ).size;
  const paidClaims = monthlyStatements.reduce(
    (sum, statement) => sum + Math.min(statement.amountReceived, statement.claimAmount),
    0
  );
  const outstandingClaims = monthlyStatements.reduce((sum, statement) => sum + statement.outstanding, 0);
  const overdueClaims = monthlyStatements
    .filter((statement) => statement.status === "Overdue")
    .reduce((sum, statement) => sum + statement.outstanding, 0);
  const submittedClaimAmount = monthlyStatements
    .filter((statement) =>
      ["Submitted", "Partially Paid", "Paid", "Overdue"].includes(statement.status)
    )
    .reduce((sum, statement) => sum + statement.claimAmount, 0);

  const companyStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        patientCount: number;
        outstandingReceivables: number;
        paidClaims: number;
        lastInvoiceDate: string;
      }
    >();

    companies.forEach((company) => {
      const companyClaims = allClaims.filter((claim) => claimMatchesCompany(claim, company));
      const companyStatements = monthlyStatements.filter(
        (statement) => statement.assistanceCompany === company.name
      );
      const patientCount = new Set(
        companyClaims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
      ).size;
      const totalClaims = companyClaims
        .filter((claim) => claim.status !== "Rejected")
        .reduce((sum, claim) => sum + claim.claimAmount, 0);
      const paid = companyStatements.reduce(
        (sum, statement) => sum + Math.min(statement.amountReceived, statement.claimAmount),
        0
      );
      const lastInvoiceDate =
        companyClaims.map((claim) => claim.date).sort((a, b) => b.localeCompare(a))[0] ?? "";

      stats.set(company.id, {
        patientCount,
        outstandingReceivables: Math.max(0, totalClaims - paid),
        paidClaims: paid,
        lastInvoiceDate
      });
    });

    return stats;
  }, [allClaims, companies, monthlyStatements]);

  const selectedStatement = monthlyStatements.find(
    (statement) => statement.id === selectedStatementId
  );
  const paymentStatement = monthlyStatements.find(
    (statement) => statement.id === paymentStatementId
  );
  const partnerPaymentHistory = monthlyStatements
    .flatMap((statement) =>
      statement.payments.map((payment) => ({
        ...payment,
        statementMonth: statement.month,
        assistanceCompany: statement.assistanceCompany
      }))
    )
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));

  function companyHasClaims(company: AssistanceCompany) {
    return allClaims.some((claim) => claimMatchesCompany(claim, company));
  }

  function resetCompanyForm() {
    setCompanyForm(emptyCompanyForm);
    setCompanyError("");
  }

  function openAddCompanyModal() {
    if (!canManageCompanies) {
      return;
    }

    resetCompanyForm();
    setCompanyModalOpen(true);
  }

  function closeCompanyModal() {
    setCompanyModalOpen(false);
    resetCompanyForm();
  }

  function saveCompany() {
    if (!canManageCompanies) {
      return;
    }

    const nextCompany = formToCompany(companyForm);

    if (!nextCompany.name) {
      setCompanyError("Company name is required.");
      return;
    }

    setCompanies((current) =>
      companyForm.id
        ? current.map((company) => (company.id === companyForm.id ? nextCompany : company))
        : [nextCompany, ...current]
    );
    closeCompanyModal();
  }

  function editCompany(company: AssistanceCompany) {
    if (!canManageCompanies) {
      return;
    }

    setCompanyForm(companyToForm(company));
    setCompanyModalOpen(true);
    setCompanyError("");
  }

  function toggleCompanyActive(companyId: string) {
    if (!canManageCompanies) {
      return;
    }

    setCompanies((current) =>
      current.map((company) =>
        company.id === companyId ? { ...company, active: !company.active } : company
      )
    );
  }

  function deleteCompany(company: AssistanceCompany) {
    if (!canManageCompanies || companyHasClaims(company)) {
      return;
    }

    setCompanies((current) => current.filter((candidate) => candidate.id !== company.id));
    if (companyForm.id === company.id) {
      resetCompanyForm();
      setCompanyModalOpen(false);
    }
  }

  function downloadStatementPdf(statement: MonthlyStatement) {
    const statementWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!statementWindow) {
      return;
    }

    statementWindow.document.write(buildStatementDocument(statement, systemSettings));
    statementWindow.document.close();
    statementWindow.focus();
    statementWindow.print();
  }

  function downloadStatementCsv(statement: MonthlyStatement) {
    downloadFile(
      `${statement.assistanceCompany}-${statement.month}-insurance-statement.csv`,
      statementCsv(statement, systemSettings),
      "text/csv;charset=utf-8"
    );
  }

  function emailStatement(statement: MonthlyStatement) {
    const company = companies.find((candidate) => candidate.id === statement.assistanceCompanyId);

    openEmailDraft({
      to: company?.email,
      subject: `${systemSettings.clinic.clinicName} insurance statement - ${statement.assistanceCompany} ${monthLabel(statement.month)}`,
      body: [
        systemSettings.clinic.clinicName,
        "",
        systemSettings.insurance.defaultStatementFormat,
        `Assistance company: ${statement.assistanceCompany}`,
        `Statement month: ${monthLabel(statement.month)}`,
        `Status: ${statement.status}`,
        `Insurance patients: ${statement.insurancePatients}`,
        `Invoices: ${statement.invoiceCount}`,
        `Full invoice total: ${usdWhole(statement.fullInvoiceTotal)}`,
        `Claim amount: ${usdWhole(statement.claimAmount)}`,
        `Amount received: ${usdWhole(statement.amountReceived)}`,
        `Outstanding: ${usdWhole(statement.outstanding)}`,
        "",
        "Please review the statement summary above."
      ].join("\n")
    });
  }

  function upsertStatementRecord(
    statement: MonthlyStatement,
    update: Partial<MonthlyStatementRecord>
  ) {
    setStatementRecords((current) => {
      const existing = current.find((record) => record.id === statement.id);
      const base: MonthlyStatementRecord = existing ?? {
        id: statement.id,
        assistanceCompany: statement.assistanceCompany,
        assistanceCompanyId: statement.assistanceCompanyId,
        month: statement.month,
        invoiceIds: statement.claims.map((claim) => claim.invoiceId),
        invoiceNos: statement.claims.map((claim) => claim.invoiceNo),
        status: "Draft",
        payments: []
      };
      const nextRecord: MonthlyStatementRecord = {
        ...base,
        ...update,
        invoiceIds:
          update.status && update.status !== "Draft"
            ? statement.claims.map((claim) => claim.invoiceId)
            : update.invoiceIds ?? base.invoiceIds,
        invoiceNos:
          update.status && update.status !== "Draft"
            ? statement.claims.map((claim) => claim.invoiceNo)
            : update.invoiceNos ?? base.invoiceNos,
        payments: update.payments ?? base.payments
      };

      return existing
        ? current.map((record) => (record.id === statement.id ? nextRecord : record))
        : [nextRecord, ...current];
    });
  }

  function confirmStatement(statement: MonthlyStatement) {
    if (!canConfirmStatements || statement.status !== "Draft") {
      return;
    }

    upsertStatementRecord(statement, {
      status: "Confirmed",
      confirmedDate: todayISO()
    });
  }

  function submitStatement(statement: MonthlyStatement) {
    if (!canSubmitStatements || statement.status !== "Confirmed") {
      return;
    }

    upsertStatementRecord(statement, {
      status: "Submitted",
      submittedDate: todayISO()
    });
  }

  function openPaymentModal(statement: MonthlyStatement) {
    if (!canRecordPayments || statement.outstanding <= 0) {
      return;
    }

    setPaymentStatementId(statement.id);
    setPaymentForm({
      paymentDate: todayISO(),
      amountReceived: String(statement.outstanding),
      reference: `${systemSettings.insurance.defaultPaymentReferencePrefix}-${statement.month.replace("-", "")}`,
      notes: ""
    });
    setPaymentError("");
  }

  function closePaymentModal() {
    setPaymentStatementId("");
    setPaymentForm(emptyPaymentForm);
    setPaymentError("");
  }

  function savePayment() {
    if (!paymentStatement || !canRecordPayments) {
      return;
    }

    const receivedNow = roundUsd(Number(paymentForm.amountReceived));

    if (receivedNow <= 0) {
      setPaymentError("Amount received is required.");
      return;
    }

    if (!systemSettings.insurance.enablePartialPayments && receivedNow < paymentStatement.outstanding) {
      setPaymentError("Partial payments are disabled in Insurance Settings.");
      return;
    }

    if (receivedNow > paymentStatement.outstanding) {
      if (!hasPermission(currentUser, "canManageInsurance")) {
        setPaymentError("Amount received cannot exceed the outstanding amount.");
        return;
      }

      const confirmed = window.confirm(
        "Amount received is higher than the outstanding amount. Continue with administrator override?"
      );

      if (!confirmed) {
        return;
      }
    }

    const nextPayment: StatementPayment = {
      id: generateId(),
      paymentDate: paymentForm.paymentDate || todayISO(),
      amountReceived: receivedNow,
      reference: paymentForm.reference.trim(),
      notes: paymentForm.notes.trim()
    };
    const nextPayments = [...paymentStatement.payments, nextPayment];
    const nextReceived = paymentsTotal(nextPayments);
    const nextStatus: MonthlyStatementStatus =
      nextReceived >= paymentStatement.claimAmount ? "Paid" : "Partially Paid";

    upsertStatementRecord(paymentStatement, {
      status: nextStatus,
      payments: nextPayments
    });
    closePaymentModal();
  }

  function openSeasonalModal() {
    if (!canConfirmSeasonalSummary) {
      return;
    }

    setSeasonalForm(defaultSeasonalForm(partnerCompany));
    setSeasonalError("");
    setSeasonalModalOpen(true);
  }

  function closeSeasonalModal() {
    setSeasonalModalOpen(false);
    setSeasonalError("");
  }

  const seasonalDateRangeValid = dateRangeIsValid(seasonalForm.fromDate, seasonalForm.toDate);
  const seasonalClaims = useMemo(() => {
    if (!seasonalDateRangeValid || !seasonalForm.assistanceCompany) {
      return [];
    }

    return allClaims.filter(
      (claim) =>
        claim.assistanceCompany === seasonalForm.assistanceCompany &&
        claim.status !== "Rejected" &&
        claim.date >= seasonalForm.fromDate &&
        claim.date <= seasonalForm.toDate
    );
  }, [
    allClaims,
    seasonalDateRangeValid,
    seasonalForm.assistanceCompany,
    seasonalForm.fromDate,
    seasonalForm.toDate
  ]);
  const seasonalStatementPayments = monthlyStatements
    .filter(
      (statement) =>
        statement.assistanceCompany === seasonalForm.assistanceCompany &&
        statement.claims.some(
          (claim) => claim.date >= seasonalForm.fromDate && claim.date <= seasonalForm.toDate
        )
    )
    .reduce((sum, statement) => sum + statement.amountReceived, 0);
  const seasonalInvoiceTotal = seasonalClaims.reduce((sum, claim) => sum + claim.invoiceTotal, 0);
  const seasonalClaimTotal = seasonalClaims.reduce((sum, claim) => sum + claim.claimAmount, 0);
  const seasonalReceived = Math.min(seasonalClaimTotal, seasonalStatementPayments);
  const seasonalOutstanding = Math.max(0, seasonalClaimTotal - seasonalReceived);

  function saveSeasonalConfirmation() {
    if (!canConfirmSeasonalSummary) {
      return;
    }

    if (!seasonalForm.assistanceCompany || !seasonalDateRangeValid) {
      setSeasonalError("Assistance company and valid dates are required.");
      return;
    }

    if (!seasonalClaims.length) {
      setSeasonalError("No insurance invoices exist for this company and period.");
      return;
    }

    setSeasonalConfirmations((current) => [
      {
        id: generateId(),
        assistanceCompany: seasonalForm.assistanceCompany,
        fromDate: seasonalForm.fromDate,
        toDate: seasonalForm.toDate,
        confirmationDate: seasonalForm.confirmationDate || todayISO(),
        notes: seasonalForm.notes.trim(),
        totalPatients: new Set(
          seasonalClaims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
        ).size,
        totalInvoices: seasonalClaims.length,
        totalInvoiceAmount: seasonalInvoiceTotal,
        totalClaimAmount: seasonalClaimTotal,
        totalReceived: seasonalReceived,
        totalOutstanding: seasonalOutstanding
      },
      ...current
    ]);
    closeSeasonalModal();
  }

  const renderStatementActions = (statement: MonthlyStatement) => (
    <StatementActions
      canConfirm={canConfirmStatements}
      canRecordPayment={canRecordPayments}
      canSubmit={canSubmitStatements}
      onConfirm={() => confirmStatement(statement)}
      onDownloadCsv={() => downloadStatementCsv(statement)}
      onDownloadPdf={() => downloadStatementPdf(statement)}
      onEmail={() => emailStatement(statement)}
      onRecordPayment={() => openPaymentModal(statement)}
      onSubmit={() => submitStatement(statement)}
      onView={() => setSelectedStatementId(statement.id)}
      statement={statement}
    />
  );

  return (
    <div className="space-y-6">
      {isCompanyPortal ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Insurance Patients This Month"
            value={String(insurancePatientsThisMonth)}
            tone="primary"
          />
          <KpiCard
            label="Insurance Patients This Season"
            value={String(insurancePatientsThisSeason)}
          />
          <KpiCard label="Submitted Claim Amount" value={usdWhole(submittedClaimAmount)} />
          <KpiCard
            label="Outstanding Amount"
            value={usdWhole(outstandingClaims)}
            tone={outstandingClaims > 0 ? "warning" : "default"}
          />
          <KpiCard label="Paid Amount" value={usdWhole(paidClaims)} tone="success" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Insurance Patients This Month"
            value={String(insurancePatientsThisMonth)}
            tone="primary"
          />
          <KpiCard
            label="Insurance Patients This Season"
            value={String(insurancePatientsThisSeason)}
          />
          <KpiCard
            label={`Outstanding Claims (${systemSettings.clinic.currency})`}
            value={usdWhole(outstandingClaims)}
            tone={outstandingClaims > 0 ? "warning" : "default"}
          />
          <KpiCard
            label={`Overdue Claims (${systemSettings.clinic.currency})`}
            value={usdWhole(overdueClaims)}
            tone={overdueClaims > 0 ? "danger" : "default"}
          />
        </div>
      )}

      {!isCompanyPortal ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-white">Assistance Companies</h2>
            {canManageCompanies ? (
              <button
                type="button"
                onClick={openAddCompanyModal}
                className={buttonClass("secondary", "min-h-12 border-white bg-white px-5 text-[#224770] hover:border-white hover:bg-[#efefef]")}
              >
                Add Company
              </button>
            ) : null}
          </div>
          <div className={tableStyles.wrapper}>
            <table className="w-full min-w-[860px] divide-y divide-[#efefef] text-sm">
              <thead className={tableStyles.head}>
                <tr>
                  <th className="w-[38%] px-4 py-3">Company Name</th>
                  <th className="w-[18%] px-4 py-3 text-right">Default Claim %</th>
                  <th className="w-[16%] px-4 py-3">Status</th>
                  <th className={tableStyles.actionHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {companies.map((company) => {
                  const used = companyHasClaims(company);
                  const isExpanded = expandedCompanyId === company.id;
                  const stats = companyStats.get(company.id) ?? {
                    patientCount: 0,
                    outstandingReceivables: 0,
                    paidClaims: 0,
                    lastInvoiceDate: ""
                  };

                  return (
                    <Fragment key={company.id}>
                      <tr className={tableStyles.row}>
                        <td className="px-4 py-3 font-semibold text-[#224770]">
                          {company.name}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#224770]">
                          {company.defaultClaimPercentage}%
                        </td>
                        <td className={tableStyles.cell}>
                          <StatusPill tone={company.active ? "green" : "slate"}>
                            {company.active ? "Active" : "Inactive"}
                          </StatusPill>
                        </td>
                        <td className={tableStyles.actionCell}>
                          <ActionSelect
                            ariaLabel={`Actions for ${company.name}`}
                            actions={[
                              {
                                value: "details",
                                label: isExpanded ? "Hide Details" : "View Details",
                                onSelect: () => setExpandedCompanyId(isExpanded ? "" : company.id)
                              },
                              ...(canManageCompanies
                                ? [
                                    {
                                      value: "edit",
                                      label: "Edit",
                                      onSelect: () => editCompany(company)
                                    },
                                    {
                                      value: "toggle",
                                      label: company.active ? "Deactivate" : "Activate",
                                      onSelect: () => toggleCompanyActive(company.id)
                                    },
                                    {
                                      value: "delete",
                                      label: used ? "Delete unavailable" : "Delete",
                                      disabled: used,
                                      onSelect: () => deleteCompany(company)
                                    }
                                  ]
                                : [])
                            ]}
                          />
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td className="bg-[#efefef]/35 px-5 py-5" colSpan={4}>
                            <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                              <CompanyDetail label="Company Name" value={company.name} />
                              <CompanyDetail
                                label="Contact Person"
                                value={company.contactPerson ?? "N/A"}
                              />
                              <CompanyDetail label="Email" value={company.email ?? "N/A"} />
                              <CompanyDetail label="Phone" value={company.phone ?? "N/A"} />
                              <CompanyDetail
                                label="Default Claim Percentage"
                                value={`${company.defaultClaimPercentage}%`}
                              />
                              <CompanyDetail
                                label="Status"
                                value={company.active ? "Active" : "Inactive"}
                              />
                              <CompanyDetail
                                label="Insurance Patients"
                                value={String(stats.patientCount)}
                              />
                              <CompanyDetail
                                label="Outstanding Receivables"
                                value={usdWhole(stats.outstandingReceivables)}
                              />
                              <CompanyDetail
                                label="Paid Claims"
                                value={usdWhole(stats.paidClaims)}
                              />
                              <CompanyDetail
                                label="Last Invoice Date"
                                value={stats.lastInvoiceDate ? shortDate(stats.lastInvoiceDate) : "N/A"}
                              />
                              <div className="rounded-lg border border-[#efefef] bg-white p-3 md:col-span-2">
                                <span className="label">Notes</span>
                                <p className="mt-1 font-semibold text-[#224770]">
                                  {company.notes ?? "N/A"}
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-white">Monthly Insurance Statements</h2>
            {seasonalConfirmations.length ? (
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">
                {seasonalConfirmations.length} seasonal confirmations recorded
              </p>
            ) : null}
          </div>
          {canConfirmSeasonalSummary ? (
            <button
              type="button"
              onClick={openSeasonalModal}
              className={buttonClass("secondary", "min-h-12 border-white bg-white px-5 text-[#224770] hover:border-white hover:bg-[#efefef]")}
            >
              Confirm Seasonal Summary
            </button>
          ) : null}
        </div>
        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[1180px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Month</th>
                {!isCompanyPortal ? (
                  <th className={tableStyles.headerCell}>Assistance Company</th>
                ) : null}
                <th className={tableStyles.numericHeaderCell}>Insurance Patients</th>
                <th className={tableStyles.numericHeaderCell}>Number of Invoices</th>
                <th className={tableStyles.numericHeaderCell}>
                  Full Invoice Total {systemSettings.clinic.currency}
                </th>
                <th className={tableStyles.numericHeaderCell}>
                  Claim Amount {systemSettings.clinic.currency}
                </th>
                <th className={tableStyles.numericHeaderCell}>
                  Amount Received {systemSettings.clinic.currency}
                </th>
                <th className={tableStyles.numericHeaderCell}>
                  Outstanding {systemSettings.clinic.currency}
                </th>
                <th className={tableStyles.headerCell}>Statement Status</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {monthlyStatements.map((statement) => (
                <tr key={statement.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{monthLabel(statement.month)}</td>
                  {!isCompanyPortal ? (
                    <td className={tableStyles.cell}>{statement.assistanceCompany}</td>
                  ) : null}
                  <td className={tableStyles.numericCell}>{statement.insurancePatients}</td>
                  <td className={tableStyles.numericCell}>{statement.invoiceCount}</td>
                  <td className={tableStyles.numericCell}>
                    {usdWhole(statement.fullInvoiceTotal)}
                  </td>
                  <td className={tableStyles.numericCell}>{usdWhole(statement.claimAmount)}</td>
                  <td className={tableStyles.numericCell}>
                    {usdWhole(statement.amountReceived)}
                  </td>
                  <td className={tableStyles.numericCell}>
                    <span
                      className={
                        statement.outstanding > 0 ? "font-bold text-[#224770]" : undefined
                      }
                    >
                      {usdWhole(statement.outstanding)}
                    </span>
                  </td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={statementStatusTones[statement.status]}>
                      {statement.status}
                    </StatusPill>
                  </td>
                  <td className={tableStyles.actionCell}>
                    {renderStatementActions(statement)}
                  </td>
                </tr>
              ))}
              {!monthlyStatements.length ? (
                <tr>
                  <td
                    className="px-5 py-8 text-center text-sm text-[#46484a]"
                    colSpan={isCompanyPortal ? 9 : 10}
                  >
                    No monthly insurance statements found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isCompanyPortal ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[#224770] bg-[#224770] p-5">
            <h2 className="text-lg font-semibold text-white">Payment History</h2>
          </div>
          <div className={tableStyles.wrapper}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Statement Month</th>
                  <th className={tableStyles.headerCell}>Payment Date</th>
                  <th className={tableStyles.numericHeaderCell}>
                    Amount Received {systemSettings.clinic.currency}
                  </th>
                  <th className={tableStyles.headerCell}>Reference</th>
                  <th className={tableStyles.headerCell}>Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {partnerPaymentHistory.map((payment) => (
                  <tr key={payment.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{monthLabel(payment.statementMonth)}</td>
                    <td className={tableStyles.cell}>{shortDate(payment.paymentDate)}</td>
                    <td className={tableStyles.numericCell}>
                      {usdWhole(payment.amountReceived)}
                    </td>
                    <td className={tableStyles.cell}>{payment.reference || "N/A"}</td>
                    <td className={tableStyles.cell}>{payment.notes || "N/A"}</td>
                  </tr>
                ))}
                {!partnerPaymentHistory.length ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={5}>
                      No payment history recorded.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedStatement ? (
        <StatementDetailsModal
          canConfirm={canConfirmStatements}
          canRecordPayment={canRecordPayments}
          canSubmit={canSubmitStatements}
          onClose={() => setSelectedStatementId("")}
          onConfirm={() => confirmStatement(selectedStatement)}
          onDownloadCsv={() => downloadStatementCsv(selectedStatement)}
          onDownloadPdf={() => downloadStatementPdf(selectedStatement)}
          onEmail={() => emailStatement(selectedStatement)}
          onRecordPayment={() => openPaymentModal(selectedStatement)}
          onSubmit={() => submitStatement(selectedStatement)}
          invoiceCurrencyCode={systemSettings.clinic.currency}
          statement={selectedStatement}
        />
      ) : null}

      {paymentStatement ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="border-b border-[#efefef] p-5">
              <h2 className="text-lg font-semibold text-[#224770]">Record Payment</h2>
              <p className="mt-1 text-sm font-semibold text-[#46484a]">
                {paymentStatement.assistanceCompany} - {monthLabel(paymentStatement.month)}
              </p>
            </div>
            <div className="form-grid grid gap-4 p-5 sm:grid-cols-2">
              <CompanyDetail
                label={`Outstanding ${systemSettings.clinic.currency}`}
                value={usdWhole(paymentStatement.outstanding)}
              />
              <CompanyDetail
                label={`Claim Amount ${systemSettings.clinic.currency}`}
                value={usdWhole(paymentStatement.claimAmount)}
              />
              <div>
                <label className="label" htmlFor="statement-payment-date">
                  Payment Date
                </label>
                <input
                  id="statement-payment-date"
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      paymentDate: event.target.value
                    }))
                  }
                  className="field mt-2 min-h-12"
                />
              </div>
              <div>
                <label className="label" htmlFor="statement-amount-received">
                  Amount Received {systemSettings.clinic.currency}
                </label>
                <input
                  id="statement-amount-received"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentForm.amountReceived}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amountReceived: event.target.value
                    }))
                  }
                  className="field mt-2 min-h-12"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="statement-payment-reference">
                  Payment Reference
                </label>
                <input
                  id="statement-payment-reference"
                  value={paymentForm.reference}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      reference: event.target.value
                    }))
                  }
                  className="field mt-2 min-h-12"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="statement-payment-notes">
                  Notes
                </label>
                <textarea
                  id="statement-payment-notes"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value
                    }))
                  }
                  className="field mt-2 min-h-24"
                />
              </div>
              {paymentError ? (
                <p className="rounded-lg bg-[#efefef] px-3 py-2 text-sm font-semibold text-[#224770] sm:col-span-2">
                  {paymentError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 border-t border-[#efefef] p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePaymentModal}
                className={buttonClass("secondary", "min-h-12")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePayment}
                disabled={roundUsd(Number(paymentForm.amountReceived)) <= 0}
                className={buttonClass(
                  roundUsd(Number(paymentForm.amountReceived)) > 0 ? "primary" : "muted",
                  "min-h-12"
                )}
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {seasonalModalOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
        >
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="border-b border-[#efefef] p-5">
              <h2 className="text-lg font-semibold text-[#224770]">
                Confirm Seasonal Summary
              </h2>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto bg-[#efefef]/45 p-5">
              <div className="form-grid grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="seasonal-company">
                    Assistance Company
                  </label>
                  <select
                    id="seasonal-company"
                    value={seasonalForm.assistanceCompany}
                    onChange={(event) =>
                      setSeasonalForm((current) => ({
                        ...current,
                        assistanceCompany: event.target.value
                      }))
                    }
                    className="field mt-2 min-h-12"
                  >
                    <option value="">Select company</option>
                    {companyOptions.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="seasonal-confirmation-date">
                    Confirmation Date
                  </label>
                  <input
                    id="seasonal-confirmation-date"
                    type="date"
                    value={seasonalForm.confirmationDate}
                    onChange={(event) =>
                      setSeasonalForm((current) => ({
                        ...current,
                        confirmationDate: event.target.value
                      }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="seasonal-from-date">
                    From Date
                  </label>
                  <input
                    id="seasonal-from-date"
                    type="date"
                    value={seasonalForm.fromDate}
                    onChange={(event) =>
                      setSeasonalForm((current) => ({
                        ...current,
                        fromDate: event.target.value,
                        toDate:
                          current.toDate && event.target.value && current.toDate < event.target.value
                            ? event.target.value
                            : current.toDate
                      }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="seasonal-to-date">
                    To Date
                  </label>
                  <input
                    id="seasonal-to-date"
                    type="date"
                    min={seasonalForm.fromDate || undefined}
                    value={seasonalForm.toDate}
                    onChange={(event) =>
                      setSeasonalForm((current) => ({
                        ...current,
                        toDate:
                          current.fromDate && event.target.value < current.fromDate
                            ? current.fromDate
                            : event.target.value
                      }))
                    }
                    className="field mt-2 min-h-12"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="label" htmlFor="seasonal-notes">
                    Notes
                  </label>
                  <textarea
                    id="seasonal-notes"
                    value={seasonalForm.notes}
                    onChange={(event) =>
                      setSeasonalForm((current) => ({
                        ...current,
                        notes: event.target.value
                      }))
                    }
                    className="field mt-2 min-h-24"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <CompanyDetail
                  label="Total Insurance Patients"
                  value={String(
                    new Set(
                      seasonalClaims.map((claim) => `${claim.patientName}-${claim.passport ?? ""}`)
                    ).size
                  )}
                />
                <CompanyDetail label="Total Invoices" value={String(seasonalClaims.length)} />
                <CompanyDetail
                  label={`Total Full Invoice Amount ${systemSettings.clinic.currency}`}
                  value={usdWhole(seasonalInvoiceTotal)}
                />
                <CompanyDetail
                  label={`Total Claim Amount ${systemSettings.clinic.currency}`}
                  value={usdWhole(seasonalClaimTotal)}
                />
                <CompanyDetail
                  label={`Total Received ${systemSettings.clinic.currency}`}
                  value={usdWhole(seasonalReceived)}
                />
                <CompanyDetail
                  label={`Total Outstanding ${systemSettings.clinic.currency}`}
                  value={usdWhole(seasonalOutstanding)}
                />
              </div>

              {seasonalError ? (
                <p className="rounded-lg bg-[#efefef] px-3 py-2 text-sm font-semibold text-[#224770]">
                  {seasonalError}
                </p>
              ) : null}
              {!seasonalDateRangeValid ? (
                <p className="rounded-lg bg-[#efefef] px-3 py-2 text-sm font-semibold text-[#224770]">
                  To Date cannot be earlier than From Date.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 border-t border-[#efefef] bg-white p-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeSeasonalModal}
                className={buttonClass("secondary", "min-h-12")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSeasonalConfirmation}
                className={buttonClass("primary", "min-h-12")}
              >
                Confirm Summary
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {companyModalOpen ? (
        <CompanyFormModal
          companyForm={companyForm}
          companyError={companyError}
          onCompanyFormChange={setCompanyForm}
          onCancel={closeCompanyModal}
          onSave={saveCompany}
        />
      ) : null}
    </div>
  );
}
