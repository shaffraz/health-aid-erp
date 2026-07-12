"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { demoAssistanceCompanies } from "@/lib/demo-data";
import { shortDate, todayISO, usdWhole } from "@/lib/format";
import { generateId } from "@/lib/id";
import {
  assistanceCompanyStorageKey,
  insuranceClaimStatusStorageKey,
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
  services: string[];
  invoiceTotal: number;
  claimPercentage: number;
  claimAmount: number;
  status: InsuranceClaimStatus;
};

type StatementGroup = {
  key: string;
  assistanceCompany: string;
  period: string;
  claims: InsuranceClaim[];
  totalClaimAmount: number;
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

const claimStatuses: InsuranceClaimStatus[] = [
  "Draft",
  "Submitted",
  "Under Review",
  "Approved",
  "Paid",
  "Rejected",
  "Overdue"
];

const partnerVisibleStatuses = new Set<InsuranceClaimStatus>([
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
} satisfies Record<InsuranceClaimStatus, "green" | "amber" | "cyan" | "red" | "slate">;

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

const emptyCompanyForm: CompanyForm = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  defaultClaimPercentage: 80,
  active: true,
  notes: ""
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

function roundUsd(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function roundPercentage(value: number) {
  return Math.min(100, roundUsd(value));
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

function buildClaims(
  invoices: Invoice[],
  insuranceReceivables: InsuranceReceivable[],
  companies: AssistanceCompany[],
  statusOverrides: Record<string, InsuranceClaimStatus>
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
      const id = `claim-${invoice.id}`;

      return {
        id,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        date: invoice.date,
        patientName: invoice.patientName,
        passport: invoice.passport,
        assistanceCompanyId: invoice.assistanceCompanyId ?? company?.id,
        assistanceCompany,
        services: invoice.items.map((item) => item.serviceName),
        invoiceTotal,
        claimPercentage,
        claimAmount,
        status:
          statusOverrides[id] ??
          invoice.claimStatus ??
          claimStatusFromReceivable(receivable?.status)
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
    <p class="meta">Date: ${escapeHtml(claim.date)}</p>
    <p class="meta">Patient: ${escapeHtml(claim.patientName)}</p>
    <p class="meta">Passport / ID: ${escapeHtml(claim.passport ?? "N/A")}</p>
    <p class="meta">Assistance company: ${escapeHtml(claim.assistanceCompany)}</p>
    <p class="meta">Claim percentage: ${escapeHtml(claim.claimPercentage)}%</p>
    <table>
      <thead><tr><th>Services</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Invoice total ${usdWhole(claim.invoiceTotal)}</p>
    <p class="total">Claim amount ${usdWhole(claim.claimAmount)}</p>
  </body>
</html>`;
}

function buildStatementDocument(statement: StatementGroup) {
  const rows = statement.claims
    .map(
      (claim) => `<tr>
        <td>${escapeHtml(claim.invoiceNo)}</td>
        <td>${escapeHtml(claim.date)}</td>
        <td>${escapeHtml(claim.patientName)}</td>
        <td>${escapeHtml(claim.passport ?? "N/A")}</td>
        <td>${escapeHtml(claim.services.join(", "))}</td>
        <td>${usdWhole(claim.invoiceTotal)}</td>
        <td>${escapeHtml(claim.claimPercentage)}%</td>
        <td>${usdWhole(claim.claimAmount)}</td>
        <td>${escapeHtml(claim.status)}</td>
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
    <p class="meta">Assistance company: ${escapeHtml(statement.assistanceCompany)}</p>
    <p class="meta">Statement period: ${escapeHtml(formatMonth(statement.period))}</p>
    <table>
      <thead>
        <tr>
          <th>Invoice number</th>
          <th>Invoice date</th>
          <th>Patient name</th>
          <th>Passport / ID</th>
          <th>Services provided</th>
          <th>Invoice total USD</th>
          <th>Claim percentage</th>
          <th>Claim amount USD</th>
          <th>Claim status</th>
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
      "Health Aid Arugambay",
      "Assistance company",
      "Statement period",
      "Invoice number",
      "Invoice date",
      "Patient name",
      "Passport / ID",
      "Services provided",
      "Invoice total USD",
      "Claim percentage",
      "Claim amount USD",
      "Claim status"
    ],
    ...statement.claims.map((claim) => [
      "Health Aid Arugambay",
      statement.assistanceCompany,
      formatMonth(statement.period),
      claim.invoiceNo,
      claim.date,
      claim.patientName,
      claim.passport ?? "N/A",
      claim.services.join("; "),
      String(claim.invoiceTotal),
      `${claim.claimPercentage}%`,
      String(claim.claimAmount),
      claim.status
    ]),
    [
      "Health Aid Arugambay",
      statement.assistanceCompany,
      formatMonth(statement.period),
      "Total claim amount USD",
      "",
      "",
      "",
      "",
      "",
      "",
      String(statement.totalClaimAmount),
      ""
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1726]/45 p-4"
      role="dialog"
    >
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="text-lg font-semibold text-[#224770]">{title}</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
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
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2">
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

export function InsuranceClaimsDashboard({
  invoices,
  insuranceReceivables,
  currentUser
}: InsuranceClaimsDashboardProps) {
  const currentMonth = todayISO().slice(0, 7);
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<InsuranceClaimStatus | "all">("all");
  const [claimSearch, setClaimSearch] = useState("");
  const [selectedStatementKey, setSelectedStatementKey] = useState("");
  const [selectedClaim, setSelectedClaim] = useState<InsuranceClaim | null>(null);
  const [companies, setCompanies] = useState<AssistanceCompany[]>(demoAssistanceCompanies);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(emptyCompanyForm);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [expandedCompanyId, setExpandedCompanyId] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [claimStatusOverrides, setClaimStatusOverrides] = useState<
    Record<string, InsuranceClaimStatus>
  >({});

  const canManageCompanies = currentUser.role === "admin";
  const canUpdateStatus = currentUser.role === "admin" || currentUser.role === "accountant";

  useEffect(() => {
    try {
      const storedCompanies = window.localStorage.getItem(assistanceCompanyStorageKey);
      if (storedCompanies) {
        const parsed = JSON.parse(storedCompanies);
        if (Array.isArray(parsed)) {
          setCompanies(parsed as AssistanceCompany[]);
        }
      }

      const storedStatuses = window.localStorage.getItem(insuranceClaimStatusStorageKey);
      if (storedStatuses) {
        setClaimStatusOverrides(JSON.parse(storedStatuses));
      }
    } catch {
      setCompanies(demoAssistanceCompanies);
      setClaimStatusOverrides({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(assistanceCompanyStorageKey, JSON.stringify(companies));
  }, [companies]);

  useEffect(() => {
    window.localStorage.setItem(
      insuranceClaimStatusStorageKey,
      JSON.stringify(claimStatusOverrides)
    );
  }, [claimStatusOverrides]);

  const allClaims = useMemo(
    () => buildClaims(invoices, insuranceReceivables, companies, claimStatusOverrides),
    [claimStatusOverrides, companies, insuranceReceivables, invoices]
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

  const statusOptions =
    currentUser.role === "insurance_partner"
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

      return !searchTerm || searchableText.includes(searchTerm);
    });
  }, [claimSearch, companyFilter, monthFilter, roleScopedClaims, statusFilter, yearFilter]);

  const currentMonthClaims = roleScopedClaims.filter((claim) =>
    claim.date.startsWith(currentMonth)
  );
  const insurancePatientsThisMonth = new Set(
    currentMonthClaims.map((claim) => claim.patientName)
  ).size;
  const insurancePatientsThisSeason = new Set(
    roleScopedClaims.map((claim) => claim.patientName)
  ).size;
  const outstandingClaims = roleScopedClaims
    .filter((claim) => !["Paid", "Rejected"].includes(claim.status))
    .reduce((sum, claim) => sum + claim.claimAmount, 0);
  const overdueClaims = roleScopedClaims
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
      (a, b) =>
        b.period.localeCompare(a.period) ||
        a.assistanceCompany.localeCompare(b.assistanceCompany)
    );
  }, [filteredClaims]);

  const selectedStatement = statementGroups.find(
    (statement) => statement.key === selectedStatementKey
  );

  const companyStats = useMemo(() => {
    const stats = new Map<
      string,
      {
        patientCount: number;
        outstandingClaims: number;
        paidClaims: number;
        lastClaimDate: string;
      }
    >();

    companies.forEach((company) => {
      const companyClaims = allClaims.filter((claim) => claimMatchesCompany(claim, company));
      const patientCount = new Set(companyClaims.map((claim) => claim.patientName)).size;
      const outstandingClaims = companyClaims
        .filter((claim) => !["Paid", "Rejected"].includes(claim.status))
        .reduce((sum, claim) => sum + claim.claimAmount, 0);
      const paidClaims = companyClaims
        .filter((claim) => claim.status === "Paid")
        .reduce((sum, claim) => sum + claim.claimAmount, 0);
      const lastClaimDate =
        companyClaims
          .map((claim) => claim.date)
          .sort((a, b) => b.localeCompare(a))[0] ?? "";

      stats.set(company.id, {
        patientCount,
        outstandingClaims,
        paidClaims,
        lastClaimDate
      });
    });

    return stats;
  }, [allClaims, companies]);

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

  function updateClaimStatus(claimId: string, status: InsuranceClaimStatus) {
    if (!canUpdateStatus) {
      return;
    }

    setClaimStatusOverrides((current) => ({ ...current, [claimId]: status }));
  }

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
          label="Outstanding Claims (USD)"
          value={usdWhole(outstandingClaims)}
          tone={outstandingClaims > 0 ? "warning" : "default"}
        />
        <KpiCard
          label="Overdue Claims (USD)"
          value={usdWhole(overdueClaims)}
          tone={overdueClaims > 0 ? "danger" : "default"}
        />
      </div>

      {currentUser.role !== "insurance_partner" ? (
        <section className="panel overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#efefef] p-5 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-[#224770]">Assistance Companies</h2>
            {canManageCompanies ? (
              <button
                type="button"
                onClick={openAddCompanyModal}
                className={buttonClass("primary", "min-h-12 px-5")}
              >
                Add Company
              </button>
            ) : null}
          </div>
          <div className={tableStyles.wrapper}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Company Name</th>
                  <th className={tableStyles.numericHeaderCell}>Default Claim %</th>
                  <th className={tableStyles.headerCell}>Status</th>
                  <th className={tableStyles.headerCell}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {companies.map((company) => {
                  const used = companyHasClaims(company);
                  const isExpanded = expandedCompanyId === company.id;
                  const stats = companyStats.get(company.id) ?? {
                    patientCount: 0,
                    outstandingClaims: 0,
                    paidClaims: 0,
                    lastClaimDate: ""
                  };

                  return (
                    <Fragment key={company.id}>
                      <tr className={tableStyles.row}>
                        <td className={tableStyles.strongCell}>{company.name}</td>
                        <td className={tableStyles.numericCell}>
                          {company.defaultClaimPercentage}%
                        </td>
                        <td className={tableStyles.cell}>
                          <StatusPill tone={company.active ? "green" : "slate"}>
                            {company.active ? "Active" : "Inactive"}
                          </StatusPill>
                        </td>
                        <td className={tableStyles.cell}>
                          <div className="flex min-w-[420px] flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCompanyId(isExpanded ? "" : company.id)
                              }
                              className={buttonClass("secondary", "px-3 py-2 text-xs")}
                            >
                              {isExpanded ? "Hide Details" : "View Details"}
                            </button>
                            <button
                              type="button"
                              onClick={() => editCompany(company)}
                              disabled={!canManageCompanies}
                              className={buttonClass("secondary", "px-3 py-2 text-xs")}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleCompanyActive(company.id)}
                              disabled={!canManageCompanies}
                              className={buttonClass("secondary", "px-3 py-2 text-xs")}
                            >
                              {company.active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCompany(company)}
                              disabled={!canManageCompanies || used}
                              className={buttonClass(
                                !used ? "danger" : "muted",
                                "px-3 py-2 text-xs"
                              )}
                            >
                              Delete
                            </button>
                          </div>
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
                                label="Outstanding Claims USD"
                                value={usdWhole(stats.outstandingClaims)}
                              />
                              <CompanyDetail
                                label="Paid Claims USD"
                                value={usdWhole(stats.paidClaims)}
                              />
                              <CompanyDetail
                                label="Last Claim Date"
                                value={stats.lastClaimDate ? shortDate(stats.lastClaimDate) : "N/A"}
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
              onChange={(event) =>
                setStatusFilter(event.target.value as InsuranceClaimStatus | "all")
              }
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
                <th className={tableStyles.numericHeaderCell}>Claim %</th>
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
                  <td className={tableStyles.numericCell}>{claim.claimPercentage}%</td>
                  <td className={tableStyles.numericCell}>{usdWhole(claim.claimAmount)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={claimStatusTones[claim.status]}>{claim.status}</StatusPill>
                  </td>
                  <td className={tableStyles.cell}>
                    <div className="flex min-w-[360px] flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedClaim(claim)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadInvoicePdf(claim)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        Download Invoice PDF
                      </button>
                      <select
                        value={claim.status}
                        onChange={(event) =>
                          updateClaimStatus(
                            claim.id,
                            event.target.value as InsuranceClaimStatus
                          )
                        }
                        disabled={!canUpdateStatus}
                        className="field h-9 w-40 py-1 text-xs disabled:bg-slate-100"
                        aria-label={`Update status for ${claim.invoiceNo}`}
                      >
                        {claimStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    <div className="flex min-w-[380px] flex-wrap gap-2">
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
                        Download Monthly Statement PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadStatementCsv(statement)}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        Download Monthly Statement CSV
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

      {selectedClaim ? (
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#224770]">{selectedClaim.invoiceNo}</h2>
            <button
              type="button"
              onClick={() => setSelectedClaim(null)}
              className={buttonClass("secondary", "px-3 py-2")}
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-[#efefef]/60 p-3">
              <span className="label">Patient</span>
              <p className="mt-1 font-semibold text-[#224770]">{selectedClaim.patientName}</p>
            </div>
            <div className="rounded-lg bg-[#efefef]/60 p-3">
              <span className="label">Assistance Company</span>
              <p className="mt-1 font-semibold text-[#224770]">
                {selectedClaim.assistanceCompany}
              </p>
            </div>
            <div className="rounded-lg bg-[#efefef]/60 p-3">
              <span className="label">Claim %</span>
              <p className="mt-1 font-semibold text-[#224770]">
                {selectedClaim.claimPercentage}%
              </p>
            </div>
            <div className="rounded-lg bg-[#efefef]/60 p-3">
              <span className="label">Claim Amount</span>
              <p className="mt-1 font-semibold text-[#224770]">
                {usdWhole(selectedClaim.claimAmount)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-[#efefef] p-3 text-sm text-[#46484a]">
            {selectedClaim.services.join(", ")}
          </div>
        </section>
      ) : null}

      {selectedStatement ? (
        <section className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#224770]">
              {selectedStatement.assistanceCompany} - {formatMonth(selectedStatement.period)}
            </h2>
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
                  <th className={tableStyles.headerCell}>Invoice date</th>
                  <th className={tableStyles.headerCell}>Patient name</th>
                  <th className={tableStyles.headerCell}>Passport / ID</th>
                  <th className={tableStyles.headerCell}>Services provided</th>
                  <th className={tableStyles.numericHeaderCell}>Invoice total USD</th>
                  <th className={tableStyles.numericHeaderCell}>Claim %</th>
                  <th className={tableStyles.numericHeaderCell}>Claim amount USD</th>
                  <th className={tableStyles.headerCell}>Claim status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {selectedStatement.claims.map((claim) => (
                  <tr key={claim.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{claim.invoiceNo}</td>
                    <td className={tableStyles.cell}>{shortDate(claim.date)}</td>
                    <td className={tableStyles.cell}>{claim.patientName}</td>
                    <td className={tableStyles.cell}>{claim.passport ?? "N/A"}</td>
                    <td className={tableStyles.cell}>{claim.services.join(", ")}</td>
                    <td className={tableStyles.numericCell}>{usdWhole(claim.invoiceTotal)}</td>
                    <td className={tableStyles.numericCell}>{claim.claimPercentage}%</td>
                    <td className={tableStyles.numericCell}>{usdWhole(claim.claimAmount)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={claimStatusTones[claim.status]}>{claim.status}</StatusPill>
                    </td>
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
