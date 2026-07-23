"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect, type ActionSelectOption } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
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
  | "Unpaid"
  | "Paid";

type StoredMonthlyStatementStatus =
  | MonthlyStatementStatus
  | "Draft"
  | "Confirmed"
  | "Submitted"
  | "Partially Paid"
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
  status: StoredMonthlyStatementStatus;
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
  payments: StatementPayment[];
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

type InsuranceClaimsDashboardProps = {
  invoices: Invoice[];
  insuranceReceivables: InsuranceReceivable[];
  currentUser: AppUser;
};

const monthlyStatementStorageKey = "health-aid-insurance-monthly-statements-v1";

const statementStatusTones = {
  Unpaid: "amber",
  Paid: "green",
} satisfies Record<MonthlyStatementStatus, "green" | "amber">;

const emptyCompanyForm: CompanyForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  defaultClaimPercentage: 80,
  active: true,
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

function roundUsd(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function roundPercentage(value: number) {
  return Math.min(100, roundUsd(value));
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
      th, td { border-bottom: 1px solid #dfe4e7; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #efefef; }
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

function CompanyDetailsModal({
  canDelete,
  canManage,
  company,
  onDelete,
  onEdit,
  onClose,
  onToggleStatus,
  stats
}: {
  canDelete: boolean;
  canManage: boolean;
  company: AssistanceCompany;
  onDelete: () => void;
  onEdit: () => void;
  onClose: () => void;
  onToggleStatus: () => void;
  stats: {
    patientCount: number;
    outstandingReceivables: number;
    paidClaims: number;
    lastInvoiceDate: string;
  };
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
          <h2 className="text-lg font-semibold text-[#224770]">Assistance Company Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
            aria-label="Close assistance company details"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <CompanyDetail label="Company Name" value={company.name} />
            <CompanyDetail label="Contact Person" value={company.contactPerson ?? "N/A"} />
            <CompanyDetail label="Email" value={company.email ?? "N/A"} />
            <CompanyDetail label="Phone" value={company.phone ?? "N/A"} />
            <CompanyDetail
              label="Default Claim Percentage"
              value={`${company.defaultClaimPercentage}%`}
            />
            <CompanyDetail label="Status" value={company.active ? "Active" : "Inactive"} />
            <CompanyDetail label="Insurance Patients" value={String(stats.patientCount)} />
            <CompanyDetail
              label="Outstanding Receivables"
              value={usdWhole(stats.outstandingReceivables)}
            />
            <CompanyDetail label="Paid Claims" value={usdWhole(stats.paidClaims)} />
            <CompanyDetail
              label="Last Invoice Date"
              value={stats.lastInvoiceDate ? shortDate(stats.lastInvoiceDate) : "N/A"}
            />
            <div className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-3 md:col-span-2">
              <span className="label">Notes</span>
              <p className="mt-1 font-semibold text-[#224770]">{company.notes ?? "N/A"}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            Close
          </button>
          {canManage ? (
            <>
              {canDelete ? (
                <button type="button" onClick={onDelete} className={buttonClass("danger")}>
                  Delete
                </button>
              ) : null}
              <button type="button" onClick={onToggleStatus} className={buttonClass("secondary")}>
                {company.active ? "Deactivate" : "Activate"}
              </button>
              <button type="button" onClick={onEdit} className={buttonClass("primary")}>
                Edit Company
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatementActions({
  canManage,
  onDownloadPdf,
  onMarkPaid,
  onMarkUnpaid,
  onView,
  statement
}: {
  canManage: boolean;
  onDownloadPdf: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onView: () => void;
  statement: MonthlyStatement;
}) {
  const actions = [
    {
      value: "view",
      label: "View",
      onSelect: onView
    },
    {
      value: "pdf",
      label: "Download PDF",
      onSelect: onDownloadPdf
    },
    canManage && statement.status === "Unpaid"
      ? {
          value: "paid",
          label: "Mark Paid",
          onSelect: onMarkPaid
        }
      : null,
    canManage && statement.status === "Paid"
      ? {
          value: "unpaid",
          label: "Mark Unpaid",
          onSelect: onMarkUnpaid
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
  canManage,
  onClose,
  onDownloadPdf,
  onMarkPaid,
  onMarkUnpaid,
  invoiceCurrencyCode,
  statement
}: {
  canManage: boolean;
  onClose: () => void;
  onDownloadPdf: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
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
            <div className="divide-y divide-[#efefef] lg:hidden">
              {statement.claims.map((claim) => (
                <div key={claim.id} className="space-y-3 p-4">
                  <div>
                    <p className="font-semibold text-[#224770]">{claim.invoiceNo}</p>
                    <p className="mt-1 text-sm font-medium text-[#46484a]">
                      {shortDate(claim.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#224770]">{claim.patientName}</p>
                    <p className="mt-1 text-sm text-[#46484a]">{claim.passport ?? "N/A"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#efefef]/45 p-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#46484a]/70">
                        Invoice
                      </p>
                      <p className="font-bold text-[#224770]">
                        {usdWhole(claim.invoiceTotal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#46484a]/70">
                        Claim
                      </p>
                      <p className="font-bold text-[#224770]">
                        {usdWhole(claim.claimAmount)}
                      </p>
                      <p className="text-xs font-semibold text-[#46484a]">
                        {claim.claimPercentage}%
                      </p>
                    </div>
                  </div>
                  <StatusPill tone={statementStatusTones[statement.status]}>
                    {statement.status}
                  </StatusPill>
                </div>
              ))}
            </div>
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead className={tableStyles.head}>
                  <tr>
                    <th className={tableStyles.headerCell}>Invoice</th>
                    <th className={tableStyles.headerCell}>Patient</th>
                    <th className={tableStyles.numericHeaderCell}>
                      Invoice {invoiceCurrencyCode}
                    </th>
                    <th className={tableStyles.numericHeaderCell}>
                      Claim {invoiceCurrencyCode}
                    </th>
                    <th className={tableStyles.headerCell}>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efefef]">
                  {statement.claims.map((claim) => (
                    <tr key={claim.id} className={tableStyles.row}>
                      <td className={tableStyles.strongCell}>
                        <p>{claim.invoiceNo}</p>
                        <p className="mt-1 text-xs font-normal text-[#46484a]">
                          {shortDate(claim.date)}
                        </p>
                      </td>
                      <td className={tableStyles.cell}>
                        <p className="font-semibold text-[#224770]">{claim.patientName}</p>
                        <p className="mt-1 text-xs">{claim.passport ?? "N/A"}</p>
                      </td>
                      <td className={tableStyles.numericCell}>
                        {usdWhole(claim.invoiceTotal)}
                      </td>
                      <td className={tableStyles.numericCell}>
                        <p>{usdWhole(claim.claimAmount)}</p>
                        <p className="mt-1 text-xs font-semibold text-[#46484a]">
                          {claim.claimPercentage}%
                        </p>
                      </td>
                      <td className={tableStyles.cell}>
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

        <div className="flex flex-col-reverse gap-3 border-t border-[#efefef] bg-white p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("secondary", "min-h-12 px-6")}
          >
            Close
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className={buttonClass("secondary", "min-h-12 px-6")}
          >
            Download PDF
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={statement.status === "Paid" ? onMarkUnpaid : onMarkPaid}
              className={buttonClass(statement.status === "Paid" ? "secondary" : "primary", "min-h-12 px-6")}
            >
              {statement.status === "Paid" ? "Mark Unpaid" : "Mark Paid"}
            </button>
          ) : null}
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
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [statementRecords, setStatementRecords] = useState<MonthlyStatementRecord[]>([]);
  const [selectedStatementId, setSelectedStatementId] = useState("");
  const systemSettings = useSystemSettings();

  const canManageCompanies = hasPermission(currentUser, "canManageAssistanceCompanies");
  const canManageStatements = hasPermission(currentUser, "canManageInsurance");

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

    } catch {
      setCompanies(demoAssistanceCompanies);
      setStatementRecords([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(assistanceCompanyStorageKey, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    window.localStorage.setItem(monthlyStatementStorageKey, JSON.stringify(statementRecords));
  }, [statementRecords]);

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
          record && record.status === "Paid"
            ? roleScopedClaims.filter((claim) => record.invoiceIds.includes(claim.invoiceId))
            : group.claims;
        const claims = frozenClaims.sort((a, b) => a.date.localeCompare(b.date));
        const payments = record?.payments ?? [];
        const fullInvoiceTotal = claims.reduce((sum, claim) => sum + claim.invoiceTotal, 0);
        const claimAmount = claims.reduce((sum, claim) => sum + claim.claimAmount, 0);
        const storedReceived = paymentsTotal(payments);
        const amountReceived =
          record?.status === "Paid" && storedReceived === 0 ? claimAmount : storedReceived;
        const status: MonthlyStatementStatus =
          amountReceived >= claimAmount && claimAmount > 0 ? "Paid" : "Unpaid";

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
  const overdueClaims = roleScopedClaims
    .filter((claim) => claim.status === "Overdue")
    .reduce((sum, claim) => sum + claim.claimAmount, 0);
  const totalStatementClaimAmount = monthlyStatements.reduce(
    (sum, statement) => sum + statement.claimAmount,
    0
  );

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
  const selectedCompany = companies.find((company) => company.id === selectedCompanyId);
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
        status: "Unpaid",
        payments: []
      };
      const nextRecord: MonthlyStatementRecord = {
        ...base,
        ...update,
        invoiceIds:
          update.status === "Paid"
            ? statement.claims.map((claim) => claim.invoiceId)
            : update.invoiceIds ?? base.invoiceIds,
        invoiceNos:
          update.status === "Paid"
            ? statement.claims.map((claim) => claim.invoiceNo)
            : update.invoiceNos ?? base.invoiceNos,
        payments: update.payments ?? base.payments
      };

      return existing
        ? current.map((record) => (record.id === statement.id ? nextRecord : record))
        : [nextRecord, ...current];
    });
  }

  function markStatementPaid(statement: MonthlyStatement) {
    if (!canManageStatements) {
      return;
    }

    const payment: StatementPayment = {
      id: generateId(),
      paymentDate: todayISO(),
      amountReceived: statement.claimAmount,
      reference: `${systemSettings.insurance.defaultPaymentReferencePrefix}-${statement.month.replace("-", "")}`,
      notes: "Marked paid from monthly insurance statement."
    };

    upsertStatementRecord(statement, {
      status: "Paid",
      payments: [payment]
    });
  }

  function markStatementUnpaid(statement: MonthlyStatement) {
    if (!canManageStatements) {
      return;
    }

    upsertStatementRecord(statement, {
      status: "Unpaid",
      payments: []
    });
  }

  const renderStatementActions = (statement: MonthlyStatement) => (
    <StatementActions
      canManage={canManageStatements}
      onDownloadPdf={() => downloadStatementPdf(statement)}
      onMarkPaid={() => markStatementPaid(statement)}
      onMarkUnpaid={() => markStatementUnpaid(statement)}
      onView={() => setSelectedStatementId(statement.id)}
      statement={statement}
    />
  );
  const statementGridClass = isCompanyPortal
    ? "grid gap-4 lg:grid-cols-[1.15fr_1fr_0.85fr_144px] lg:items-center"
    : "grid gap-4 lg:grid-cols-[1fr_1.35fr_1fr_0.85fr_144px] lg:items-center";

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
          <KpiCard label="Statement Claim Amount" value={usdWhole(totalStatementClaimAmount)} />
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
          <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-white">Assistance Companies</h2>
            {canManageCompanies ? (
              <button
                type="button"
                onClick={openAddCompanyModal}
                className={buttonClass("secondary", "border-white bg-white px-4 text-[#224770] hover:border-white hover:bg-[#efefef]")}
              >
                Add Company
              </button>
            ) : null}
          </div>
          <div className="grid gap-3 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
            {companies.map((company) => {
              const stats = companyStats.get(company.id) ?? {
                patientCount: 0,
                outstandingReceivables: 0,
                paidClaims: 0,
                lastInvoiceDate: ""
              };

              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => setSelectedCompanyId(company.id)}
                  className="focus-ring min-h-36 rounded-xl border border-[#efefef] bg-white p-4 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#0eb6ef]/45 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-[#224770]">
                        {company.name}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-[#46484a]">
                        {company.contactPerson || "No contact person"}
                      </p>
                    </div>
                    <StatusPill tone={company.active ? "green" : "slate"}>
                      {company.active ? "Active" : "Inactive"}
                    </StatusPill>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div>
                      <span className="label">Claim</span>
                      <p className="mt-1 text-lg font-bold text-[#224770]">
                        {company.defaultClaimPercentage}%
                      </p>
                    </div>
                    <div>
                      <span className="label">Outstanding</span>
                      <p className="mt-1 text-lg font-bold text-[#224770]">
                        {usdWhole(stats.outstandingReceivables)}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
            {!companies.length ? (
              <div className="rounded-xl border border-dashed border-[#d9d9d9] bg-[#efefef]/35 p-6 text-center text-sm text-[#46484a] sm:col-span-2 xl:col-span-4">
                No assistance companies have been added yet.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="text-lg font-semibold text-white">Monthly Insurance Statements</h2>
        </div>
        <div className="divide-y divide-[#efefef]">
          <div
            className={`${statementGridClass} hidden bg-[#efefef] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a] lg:grid`}
          >
            <span>Month</span>
            {!isCompanyPortal ? <span>Company</span> : null}
            <span>Claim Amount</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {monthlyStatements.map((statement) => (
            <div key={statement.id} className="p-4 transition hover:bg-[#efefef]/45">
              <div className={statementGridClass}>
                <div>
                  <p className="label lg:hidden">Month</p>
                  <p className="font-semibold text-[#224770]">{monthLabel(statement.month)}</p>
                  {!isCompanyPortal ? (
                    <p className="mt-1 text-sm font-medium text-[#46484a] lg:hidden">
                      {statement.assistanceCompany}
                    </p>
                  ) : null}
                </div>

                {!isCompanyPortal ? (
                  <div className="hidden text-sm font-medium text-[#46484a] lg:block">
                    {statement.assistanceCompany}
                  </div>
                ) : null}

                <div>
                  <p className="label lg:hidden">Claim Amount</p>
                  <p className="font-semibold text-[#224770]">
                    {usdWhole(statement.claimAmount)}
                  </p>
                </div>

                <div>
                  <p className="label mb-2 lg:hidden">Status</p>
                  <StatusPill tone={statementStatusTones[statement.status]}>
                    {statement.status}
                  </StatusPill>
                </div>

                <div>{renderStatementActions(statement)}</div>
              </div>
            </div>
          ))}

          {!monthlyStatements.length ? (
            <div className="px-5 py-8 text-center text-sm text-[#46484a]">
              No monthly insurance statements found.
            </div>
          ) : null}
        </div>
      </section>

      {isCompanyPortal ? (
        <section className="panel overflow-hidden">
          <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
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
          canManage={canManageStatements}
          onClose={() => setSelectedStatementId("")}
          onDownloadPdf={() => downloadStatementPdf(selectedStatement)}
          onMarkPaid={() => markStatementPaid(selectedStatement)}
          onMarkUnpaid={() => markStatementUnpaid(selectedStatement)}
          invoiceCurrencyCode={systemSettings.clinic.currency}
          statement={selectedStatement}
        />
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

      {selectedCompany ? (
        <CompanyDetailsModal
          canDelete={!companyHasClaims(selectedCompany)}
          canManage={canManageCompanies}
          company={selectedCompany}
          onDelete={() => {
            deleteCompany(selectedCompany);
            setSelectedCompanyId("");
          }}
          onEdit={() => {
            editCompany(selectedCompany);
            setSelectedCompanyId("");
          }}
          onClose={() => setSelectedCompanyId("")}
          onToggleStatus={() => toggleCompanyActive(selectedCompany.id)}
          stats={
            companyStats.get(selectedCompany.id) ?? {
              patientCount: 0,
              outstandingReceivables: 0,
              paidClaims: 0,
              lastInvoiceDate: ""
            }
          }
        />
      ) : null}
    </div>
  );
}
