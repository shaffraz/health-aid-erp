"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect } from "@/components/action-select";
import { buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate } from "@/lib/format";
import { generateId } from "@/lib/id";
import {
  staffSalaryStorageKey,
  staffStorageKey,
  type AuditLog,
  type Invoice,
  type ManagedUser,
  type StaffMember,
  type StaffSalaryRecord,
  type StaffSalaryStatus
} from "@/lib/types";

type StaffManagementProps = {
  initialStaff: StaffMember[];
  users: ManagedUser[];
  salaryRecords: StaffSalaryRecord[];
  invoices: Invoice[];
  auditLogs: AuditLog[];
  currentUserName: string;
  canEdit: boolean;
  canManageSalaries: boolean;
};

type StaffForm = {
  id?: string;
  fullName: string;
  designation: string;
  mobileNumber: string;
  email: string;
  notes: string;
  joinDate: string;
  status: StaffMember["status"];
  userId: string;
  currentBasicSalaryLkr: number;
  salaryEffectiveFrom: string;
};

type StaffModalState = {
  mode: "view" | "edit";
  staffId?: string;
  form: StaffForm;
};

type SalaryForm = {
  id?: string;
  staffProfileId: string;
  salaryPeriod: string;
  baseSalaryLkr: number;
  additionalPaymentLkr: number;
  deductionLkr: number;
  status: StaffSalaryStatus;
  paymentDate: string;
  paymentReference: string;
  notes: string;
};

type SalaryModalState = {
  mode: "view" | "edit" | "markPaid";
  recordId?: string;
  form: SalaryForm;
};

type FieldErrors = Record<string, string>;

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  return todayDate().slice(0, 7);
}

function wholeNumber(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function moneyLkr(amount: number) {
  return `LKR ${wholeNumber(amount).toLocaleString("en-US")}`;
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);

  if (!year || !month) {
    return period;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function paymentDateFor(record: StaffSalaryRecord) {
  return record.paymentDate ?? record.paidAt;
}

function emptyStaffForm(): StaffForm {
  const today = todayDate();

  return {
    fullName: "",
    designation: "",
    mobileNumber: "",
    email: "",
    notes: "",
    joinDate: today,
    status: "active",
    userId: "",
    currentBasicSalaryLkr: 0,
    salaryEffectiveFrom: today
  };
}

function staffToForm(staff: StaffMember): StaffForm {
  return {
    id: staff.id,
    fullName: staff.fullName,
    designation: staff.designation,
    mobileNumber: staff.mobileNumber,
    email: staff.email ?? "",
    notes: staff.notes ?? "",
    joinDate: staff.joinDate,
    status: staff.status,
    userId: staff.userId ?? "",
    currentBasicSalaryLkr: staff.currentBasicSalaryLkr ?? 0,
    salaryEffectiveFrom: staff.salaryEffectiveFrom ?? staff.joinDate
  };
}

function emptySalaryForm(staff?: StaffMember): SalaryForm {
  return {
    staffProfileId: staff?.id ?? "",
    salaryPeriod: currentMonthValue(),
    baseSalaryLkr: staff?.currentBasicSalaryLkr ?? 0,
    additionalPaymentLkr: 0,
    deductionLkr: 0,
    status: "Pending",
    paymentDate: "",
    paymentReference: "",
    notes: ""
  };
}

function salaryToForm(record: StaffSalaryRecord): SalaryForm {
  return {
    id: record.id,
    staffProfileId: record.staffProfileId,
    salaryPeriod: record.salaryPeriod,
    baseSalaryLkr: record.baseSalaryLkr,
    additionalPaymentLkr: record.additionalPaymentLkr,
    deductionLkr: record.deductionLkr,
    status: record.status,
    paymentDate: paymentDateFor(record) ?? "",
    paymentReference: record.paymentReference ?? "",
    notes: record.notes ?? ""
  };
}

function statusLabel(status: StaffMember["status"]) {
  return status === "active" ? "Active" : "Inactive";
}

export function StaffManagement({
  auditLogs,
  canEdit,
  canManageSalaries,
  currentUserName,
  initialStaff,
  invoices,
  salaryRecords,
  users
}: StaffManagementProps) {
  const [staffMembers, setStaffMembers] = useState(initialStaff);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState<"all" | StaffMember["status"]>("all");
  const [localSalaryRecords, setLocalSalaryRecords] = useState(salaryRecords);
  const [staffModal, setStaffModal] = useState<StaffModalState | null>(null);
  const [salaryModal, setSalaryModal] = useState<SalaryModalState | null>(null);
  const [staffErrors, setStaffErrors] = useState<FieldErrors>({});
  const [salaryErrors, setSalaryErrors] = useState<FieldErrors>({});
  const [hydrated, setHydrated] = useState(false);

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const staffById = useMemo(
    () => new Map(staffMembers.map((staff) => [staff.id, staff])),
    [staffMembers]
  );

  const staffUsers = useMemo(() => users.filter((user) => user.role === "staff"), [users]);

  useEffect(() => {
    try {
      const storedStaff = window.localStorage.getItem(staffStorageKey);
      const storedSalaryRecords = window.localStorage.getItem(staffSalaryStorageKey);

      if (storedStaff) {
        const parsed = JSON.parse(storedStaff);

        if (Array.isArray(parsed)) {
          setStaffMembers(parsed as StaffMember[]);
        }
      }

      if (storedSalaryRecords) {
        const parsed = JSON.parse(storedSalaryRecords);

        if (Array.isArray(parsed)) {
          setLocalSalaryRecords(parsed as StaffSalaryRecord[]);
        }
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(staffStorageKey, JSON.stringify(staffMembers));
  }, [hydrated, staffMembers]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(staffSalaryStorageKey, JSON.stringify(localSalaryRecords));
  }, [hydrated, localSalaryRecords]);

  const staffIdForSalary = useCallback((record: StaffSalaryRecord) => {
    if (record.staffProfileId) {
      return record.staffProfileId;
    }

    return staffMembers.find((staff) => staff.userId === record.staffUserId)?.id ?? "";
  }, [staffMembers]);

  function salaryRecordsForStaff(staffId: string) {
    return localSalaryRecords.filter((record) => staffIdForSalary(record) === staffId);
  }

  function latestSalaryForStaff(staffId: string) {
    return [...salaryRecordsForStaff(staffId)].sort((a, b) =>
      b.salaryPeriod.localeCompare(a.salaryPeriod)
    )[0];
  }

  function lastPaidSalaryForStaff(staffId: string) {
    return [...salaryRecordsForStaff(staffId)]
      .filter((record) => record.status === "Paid")
      .sort((a, b) => {
        const aDate = paymentDateFor(a) ?? "";
        const bDate = paymentDateFor(b) ?? "";
        return bDate.localeCompare(aDate);
      })[0];
  }

  function deleteBlockReason(staff: StaffMember) {
    if (salaryRecordsForStaff(staff.id).length) {
      return "Salary records exist for this staff member.";
    }

    if (
      staff.userId &&
      invoices.some((invoice) => invoice.createdBy === staff.userId || invoice.createdBy === staff.fullName)
    ) {
      return "This staff member is referenced by invoice records.";
    }

    if (
      auditLogs.some(
        (log) =>
          log.entityId === staff.id ||
          log.actor === staff.fullName ||
          (staff.userId && log.actor === userById.get(staff.userId)?.name)
      )
    ) {
      return "This staff member is referenced by audit logs.";
    }

    return "";
  }

  const filteredStaff = useMemo(() => {
    const search = staffQuery.trim().toLowerCase();

    return staffMembers.filter((staff) => {
      const linkedUser = staff.userId ? userById.get(staff.userId) : undefined;
      const matchesStatus = staffStatusFilter === "all" || staff.status === staffStatusFilter;
      const haystack = [
        staff.fullName,
        staff.designation,
        staff.mobileNumber,
        staff.email,
        linkedUser?.name,
        linkedUser?.username,
        linkedUser?.email
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return matchesStatus && (!search || haystack.includes(search));
    });
  }, [staffMembers, staffQuery, staffStatusFilter, userById]);

  const filteredSalaryRecords = useMemo(() => {
    return [...localSalaryRecords].sort((a, b) => b.salaryPeriod.localeCompare(a.salaryPeriod));
  }, [localSalaryRecords]);

  function availableStaffUsers(currentStaffId?: string) {
    const linkedUserIds = new Set(
      staffMembers
        .filter((staff) => staff.id !== currentStaffId)
        .map((staff) => staff.userId)
        .filter(Boolean)
    );

    return staffUsers.filter((user) => !linkedUserIds.has(user.id));
  }

  function openAddStaff() {
    if (!canEdit) {
      return;
    }

    setStaffErrors({});
    setStaffModal({ mode: "edit", form: emptyStaffForm() });
  }

  function openStaff(staff: StaffMember, mode: StaffModalState["mode"]) {
    setStaffErrors({});
    setStaffModal({ mode, staffId: staff.id, form: staffToForm(staff) });
  }

  function updateStaffForm<K extends keyof StaffForm>(field: K, value: StaffForm[K]) {
    setStaffModal((current) =>
      current
        ? {
            ...current,
            form: {
              ...current.form,
              [field]: value
            }
          }
        : current
    );
  }

  function validateStaffForm(form: StaffForm) {
    const errors: FieldErrors = {};

    if (!form.fullName.trim()) {
      errors.fullName = "Full name is required.";
    }
    if (!form.designation.trim()) {
      errors.designation = "Designation is required.";
    }
    if (!form.mobileNumber.trim()) {
      errors.mobileNumber = "Mobile number is required.";
    }
    if (!form.joinDate) {
      errors.joinDate = "Join date is required.";
    }
    if (form.currentBasicSalaryLkr < 0) {
      errors.currentBasicSalaryLkr = "Basic salary cannot be negative.";
    }
    if (!form.salaryEffectiveFrom) {
      errors.salaryEffectiveFrom = "Salary effective date is required.";
    }

    const duplicateUser = form.userId
      ? staffMembers.find((staff) => staff.userId === form.userId && staff.id !== form.id)
      : undefined;

    if (duplicateUser) {
      errors.userId = "This user account is already linked to another staff profile.";
    }

    return errors;
  }

  function saveStaff() {
    if (!canEdit || !staffModal || staffModal.mode === "view") {
      return;
    }

    const errors = validateStaffForm(staffModal.form);
    setStaffErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    const now = new Date().toISOString();
    const nextStaff: StaffMember = {
      id: staffModal.form.id ?? generateId(),
      fullName: staffModal.form.fullName.trim(),
      designation: staffModal.form.designation.trim(),
      mobileNumber: staffModal.form.mobileNumber.trim(),
      email: staffModal.form.email.trim() || undefined,
      notes: staffModal.form.notes.trim() || undefined,
      joinDate: staffModal.form.joinDate,
      status: staffModal.form.status,
      userId: staffModal.form.userId || undefined,
      currentBasicSalaryLkr: wholeNumber(staffModal.form.currentBasicSalaryLkr),
      salaryEffectiveFrom: staffModal.form.salaryEffectiveFrom,
      createdAt:
        staffMembers.find((staff) => staff.id === staffModal.form.id)?.createdAt ?? now,
      updatedAt: now
    };

    setStaffMembers((current) =>
      staffModal.form.id
        ? current.map((staff) => (staff.id === staffModal.form.id ? nextStaff : staff))
        : [nextStaff, ...current]
    );
    setStaffModal(null);
  }

  function toggleStaffStatus(staffId: string) {
    if (!canEdit) {
      return;
    }

    setStaffMembers((current) =>
      current.map((staff) =>
        staff.id === staffId
          ? {
              ...staff,
              status: staff.status === "active" ? "inactive" : "active",
              updatedAt: new Date().toISOString()
            }
          : staff
      )
    );
  }

  function deleteStaff(staff: StaffMember) {
    if (!canEdit || deleteBlockReason(staff)) {
      return;
    }

    setStaffMembers((current) => current.filter((candidate) => candidate.id !== staff.id));
  }

  function openAddSalary(staff?: StaffMember) {
    if (!canManageSalaries) {
      return;
    }

    setSalaryErrors({});
    setSalaryModal({ mode: "edit", form: emptySalaryForm(staff) });
  }

  function openSalary(record: StaffSalaryRecord, mode: SalaryModalState["mode"]) {
    if (mode !== "view" && !canManageSalaries) {
      return;
    }

    setSalaryErrors({});
    const form = salaryToForm(record);

    setSalaryModal({
      mode,
      recordId: record.id,
      form:
        mode === "markPaid"
          ? {
              ...form,
              status: "Paid",
              paymentDate: form.paymentDate || todayDate()
            }
          : form
    });
  }

  function updateSalaryForm<K extends keyof SalaryForm>(field: K, value: SalaryForm[K]) {
    setSalaryModal((current) =>
      current
        ? {
            ...current,
            form: {
              ...current.form,
              [field]: value
            }
          }
        : current
    );
  }

  function validateSalaryForm(form: SalaryForm, mode: SalaryModalState["mode"]) {
    const errors: FieldErrors = {};
    const netSalary =
      wholeNumber(form.baseSalaryLkr) +
      wholeNumber(form.additionalPaymentLkr) -
      wholeNumber(form.deductionLkr);

    if (!form.staffProfileId) {
      errors.staffProfileId = "Staff member is required.";
    }
    if (!form.salaryPeriod) {
      errors.salaryPeriod = "Salary period is required.";
    }
    if (form.baseSalaryLkr < 0) {
      errors.baseSalaryLkr = "Basic salary cannot be negative.";
    }
    if (form.additionalPaymentLkr < 0) {
      errors.additionalPaymentLkr = "Additional payment cannot be negative.";
    }
    if (form.deductionLkr < 0) {
      errors.deductionLkr = "Deduction cannot be negative.";
    }
    if (netSalary < 0) {
      errors.netSalaryLkr = "Net salary cannot be negative.";
    }
    if (
      localSalaryRecords.some(
        (record) =>
          record.id !== form.id &&
          staffIdForSalary(record) === form.staffProfileId &&
          record.salaryPeriod === form.salaryPeriod
      )
    ) {
      errors.salaryPeriod = "A salary record already exists for this staff member and period.";
    }
    if (mode === "markPaid" || form.status === "Paid") {
      if (!form.paymentDate) {
        errors.paymentDate = "Payment date is required when marking salary as paid.";
      }
      if (!form.paymentReference.trim()) {
        errors.paymentReference = "Payment reference is required when marking salary as paid.";
      }
    }

    return errors;
  }

  function saveSalary() {
    if (!canManageSalaries || !salaryModal || salaryModal.mode === "view") {
      return;
    }

    const currentRecord = salaryModal.recordId
      ? localSalaryRecords.find((record) => record.id === salaryModal.recordId)
      : undefined;

    if (currentRecord?.status === "Paid" && salaryModal.mode !== "markPaid") {
      setSalaryErrors({ form: "Paid salary records cannot be edited." });
      return;
    }

    if (currentRecord?.status === "Paid" && salaryModal.mode === "markPaid") {
      setSalaryErrors({ form: "This salary record has already been marked as paid." });
      return;
    }

    const errors = validateSalaryForm(salaryModal.form, salaryModal.mode);
    setSalaryErrors(errors);

    if (Object.keys(errors).length) {
      return;
    }

    const staff = staffById.get(salaryModal.form.staffProfileId);
    const now = new Date().toISOString();
    const nextStatus =
      salaryModal.mode === "markPaid" ? "Paid" : salaryModal.form.status;
    const netSalary =
      wholeNumber(salaryModal.form.baseSalaryLkr) +
      wholeNumber(salaryModal.form.additionalPaymentLkr) -
      wholeNumber(salaryModal.form.deductionLkr);

    const nextRecord: StaffSalaryRecord = {
      id: salaryModal.form.id ?? generateId(),
      staffProfileId: salaryModal.form.staffProfileId,
      staffUserId: staff?.userId,
      salaryPeriod: salaryModal.form.salaryPeriod,
      baseSalaryLkr: wholeNumber(salaryModal.form.baseSalaryLkr),
      additionalPaymentLkr: wholeNumber(salaryModal.form.additionalPaymentLkr),
      deductionLkr: wholeNumber(salaryModal.form.deductionLkr),
      netSalaryLkr: netSalary,
      status: nextStatus,
      paymentDate:
        nextStatus === "Paid" ? salaryModal.form.paymentDate : salaryModal.form.paymentDate || undefined,
      paidAt:
        nextStatus === "Paid" ? salaryModal.form.paymentDate : salaryModal.form.paymentDate || undefined,
      paymentReference: salaryModal.form.paymentReference.trim() || undefined,
      notes: salaryModal.form.notes.trim() || undefined,
      createdBy: currentRecord?.createdBy ?? currentUserName,
      createdAt: currentRecord?.createdAt ?? now,
      updatedAt: now
    };

    setLocalSalaryRecords((current) =>
      salaryModal.form.id
        ? current.map((record) => (record.id === salaryModal.form.id ? nextRecord : record))
        : [nextRecord, ...current]
    );
    setSalaryModal(null);
  }

  function approveSalary(record: StaffSalaryRecord) {
    if (!canManageSalaries || record.status === "Paid") {
      return;
    }

    setLocalSalaryRecords((current) =>
      current.map((salaryRecord) =>
        salaryRecord.id === record.id
          ? { ...salaryRecord, status: "Approved", updatedAt: new Date().toISOString() }
          : salaryRecord
      )
    );
  }

  const selectedStaffForView = staffModal?.staffId ? staffById.get(staffModal.staffId) : undefined;
  const selectedStaffSalary = selectedStaffForView
    ? latestSalaryForStaff(selectedStaffForView.id)
    : undefined;
  const selectedStaffPaidSalary = selectedStaffForView
    ? lastPaidSalaryForStaff(selectedStaffForView.id)
    : undefined;
  const salaryNetPreview = salaryModal
    ? wholeNumber(salaryModal.form.baseSalaryLkr) +
      wholeNumber(salaryModal.form.additionalPaymentLkr) -
      wholeNumber(salaryModal.form.deductionLkr)
    : 0;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-white">Staff Directory</h2>
          {canEdit ? (
            <button
              type="button"
              onClick={openAddStaff}
              className={buttonClass("secondary", "min-h-12 border-white bg-white text-[#224770] hover:bg-[#efefef]")}
            >
              Add Staff
            </button>
          ) : null}
        </div>
        <div className="grid gap-3 border-b border-[#efefef] bg-white p-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <label>
            <span className="label">Search</span>
            <input
              value={staffQuery}
              onChange={(event) => setStaffQuery(event.target.value)}
              className="field mt-2 min-h-12"
              placeholder="Name, designation, mobile or account"
            />
          </label>
          <label>
            <span className="label">Employment Status</span>
            <select
              value={staffStatusFilter}
              onChange={(event) =>
                setStaffStatusFilter(event.target.value as "all" | StaffMember["status"])
              }
              className="field mt-2 min-h-12"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
        </div>

        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[980px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Staff Name</th>
                <th className={tableStyles.headerCell}>Designation</th>
                <th className={tableStyles.headerCell}>Mobile Number</th>
                <th className={tableStyles.headerCell}>Join Date</th>
                <th className={tableStyles.headerCell}>Salary Paid</th>
                <th className={tableStyles.headerCell}>Employment Status</th>
                <th className={tableStyles.headerCell}>Linked User Account</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredStaff.map((staff) => {
                const linkedUser = staff.userId ? userById.get(staff.userId) : undefined;
                const latestSalary = latestSalaryForStaff(staff.id);
                const deleteReason = deleteBlockReason(staff);

                return (
                  <tr key={staff.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{staff.fullName}</td>
                    <td className={tableStyles.cell}>{staff.designation}</td>
                    <td className={tableStyles.cell}>{staff.mobileNumber}</td>
                    <td className={tableStyles.cell}>{shortDate(staff.joinDate)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={latestSalary?.status === "Paid" ? "green" : "amber"}>
                        {latestSalary?.status === "Paid" ? "Paid" : "Not paid"}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={staff.status === "active" ? "green" : "slate"}>
                        {statusLabel(staff.status)}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>{linkedUser?.username ?? "Not linked"}</td>
                    <td className={tableStyles.actionCell}>
                      <ActionSelect
                        ariaLabel={`Actions for ${staff.fullName}`}
                        actions={[
                          {
                            value: "view",
                            label: "View",
                            onSelect: () => openStaff(staff, "view")
                          },
                          ...(canEdit
                            ? [
                                {
                                  value: "edit",
                                  label: "Edit",
                                  onSelect: () => openStaff(staff, "edit" as const)
                                },
                                {
                                  value: "toggle",
                                  label: staff.status === "active" ? "Deactivate" : "Activate",
                                  onSelect: () => toggleStaffStatus(staff.id)
                                },
                                {
                                  value: "delete",
                                  label: deleteReason ? "Delete unavailable" : "Delete",
                                  disabled: Boolean(deleteReason),
                                  onSelect: () => deleteStaff(staff)
                                }
                              ]
                            : [])
                        ]}
                      />
                      {deleteReason ? (
                        <p className="mt-2 text-xs font-medium text-[#46484a]/70">{deleteReason}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!filteredStaff.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={8}>
                    No staff records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#0eb6ef] bg-[#0eb6ef] p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-white">Salary Records</h2>
          {canManageSalaries ? (
            <button
              type="button"
              onClick={() => openAddSalary()}
              className={buttonClass("secondary", "min-h-12 border-white bg-white text-[#224770] hover:bg-[#efefef]")}
            >
              Add Salary Record
            </button>
          ) : null}
        </div>
        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[680px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Staff Member</th>
                <th className={tableStyles.headerCell}>Month</th>
                <th className={tableStyles.headerCell}>Salary Paid</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredSalaryRecords.map((record) => {
                const staff = staffById.get(staffIdForSalary(record));
                const canEditRecord =
                  canManageSalaries && (record.status === "Pending" || record.status === "On Hold");
                const canApproveRecord =
                  canManageSalaries && (record.status === "Pending" || record.status === "On Hold");
                const canMarkPaid = canManageSalaries && record.status === "Approved";

                return (
                  <tr key={record.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{staff?.fullName ?? "Unlinked staff"}</td>
                    <td className={tableStyles.cell}>{periodLabel(record.salaryPeriod)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={record.status === "Paid" ? "green" : "amber"}>
                        {record.status === "Paid" ? "Paid" : "Not paid"}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.actionCell}>
                      <ActionSelect
                        ariaLabel={`Salary actions for ${staff?.fullName ?? "staff member"}`}
                        actions={[
                          {
                            value: "view",
                            label: "View",
                            onSelect: () => openSalary(record, "view")
                          },
                          ...(canManageSalaries
                            ? [
                                {
                                  value: "edit",
                                  label: canEditRecord ? "Edit" : "Edit unavailable",
                                  disabled: !canEditRecord,
                                  onSelect: () => openSalary(record, "edit" as const)
                                },
                                {
                                  value: "approve",
                                  label: canApproveRecord ? "Approve" : "Approve unavailable",
                                  disabled: !canApproveRecord,
                                  onSelect: () => approveSalary(record)
                                },
                                {
                                  value: "mark-paid",
                                  label: canMarkPaid ? "Mark Paid" : "Already paid",
                                  disabled: !canMarkPaid,
                                  onSelect: () => openSalary(record, "markPaid" as const)
                                }
                              ]
                            : [])
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {!filteredSalaryRecords.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={4}>
                    No salary records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {staffModal ? (
        <StaffModal
          availableUsers={availableStaffUsers(staffModal.staffId)}
          canEdit={canEdit}
          errors={staffErrors}
          form={staffModal.form}
          latestSalary={selectedStaffSalary}
          lastPaidSalary={selectedStaffPaidSalary}
          mode={staffModal.mode}
          onAddSalary={() => selectedStaffForView && openAddSalary(selectedStaffForView)}
          onClose={() => setStaffModal(null)}
          onEdit={() =>
            selectedStaffForView &&
            setStaffModal({
              mode: "edit",
              staffId: selectedStaffForView.id,
              form: staffToForm(selectedStaffForView)
            })
          }
          onSave={saveStaff}
          onToggleStatus={() => selectedStaffForView && toggleStaffStatus(selectedStaffForView.id)}
          onUpdate={updateStaffForm}
          selectedStaff={selectedStaffForView}
          userById={userById}
        />
      ) : null}

      {salaryModal ? (
        <SalaryModal
          canManage={canManageSalaries}
          errors={salaryErrors}
          form={salaryModal.form}
          mode={salaryModal.mode}
          netSalary={salaryNetPreview}
          onClose={() => setSalaryModal(null)}
          onSave={saveSalary}
          onUpdate={updateSalaryForm}
          staffMembers={staffMembers}
        />
      ) : null}
    </div>
  );
}

function StaffModal({
  availableUsers,
  canEdit,
  errors,
  form,
  latestSalary,
  lastPaidSalary,
  mode,
  onAddSalary,
  onClose,
  onEdit,
  onSave,
  onToggleStatus,
  onUpdate,
  selectedStaff,
  userById
}: {
  availableUsers: ManagedUser[];
  canEdit: boolean;
  errors: FieldErrors;
  form: StaffForm;
  latestSalary?: StaffSalaryRecord;
  lastPaidSalary?: StaffSalaryRecord;
  mode: StaffModalState["mode"];
  onAddSalary: () => void;
  onClose: () => void;
  onEdit: () => void;
  onSave: () => void;
  onToggleStatus: () => void;
  onUpdate: <K extends keyof StaffForm>(field: K, value: StaffForm[K]) => void;
  selectedStaff?: StaffMember;
  userById: Map<string, ManagedUser>;
}) {
  const readOnly = mode === "view";
  const linkedUser = form.userId ? userById.get(form.userId) : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-form-title"
    >
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#224770] bg-[#224770] px-5 py-4">
          <h2 id="staff-form-title" className="font-semibold text-white">
            {mode === "view" ? "Staff Profile" : form.id ? "Edit Staff" : "Add Staff"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-2 text-white transition hover:bg-white/10"
            aria-label="Close staff form"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {errors.form ? (
            <AlertMessage>{errors.form}</AlertMessage>
          ) : null}

          <FormSection title="Profile">
            <div className="form-grid grid gap-4 md:grid-cols-2">
              <StaffInput
                error={errors.fullName}
                label="Full Name"
                value={form.fullName}
                readOnly={readOnly}
                onChange={(fullName) => onUpdate("fullName", fullName)}
              />
              <StaffInput
                error={errors.designation}
                label="Designation"
                value={form.designation}
                readOnly={readOnly}
                onChange={(designation) => onUpdate("designation", designation)}
              />
              <StaffInput
                error={errors.mobileNumber}
                label="Mobile Number"
                value={form.mobileNumber}
                readOnly={readOnly}
                onChange={(mobileNumber) => onUpdate("mobileNumber", mobileNumber)}
              />
              <StaffInput
                label="Email"
                value={form.email}
                type="email"
                readOnly={readOnly}
                onChange={(email) => onUpdate("email", email)}
              />
              <StaffInput
                error={errors.joinDate}
                label="Join Date"
                value={form.joinDate}
                type="date"
                readOnly={readOnly}
                onChange={(joinDate) => onUpdate("joinDate", joinDate)}
              />
              <label>
                <span className="label">Employment Status</span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    onUpdate("status", event.target.value as StaffMember["status"])
                  }
                  disabled={readOnly}
                  className="field mt-2 min-h-12 disabled:bg-[#efefef]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="label">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => onUpdate("notes", event.target.value)}
                  disabled={readOnly}
                  className="field mt-2 min-h-24 disabled:bg-[#efefef]"
                />
              </label>
            </div>
          </FormSection>

          <FormSection title="Salary Setup">
            <div className="form-grid grid gap-4 md:grid-cols-2">
              <StaffNumberInput
                error={errors.currentBasicSalaryLkr}
                label="Basic Monthly Salary LKR"
                value={form.currentBasicSalaryLkr}
                readOnly={readOnly}
                onChange={(currentBasicSalaryLkr) =>
                  onUpdate("currentBasicSalaryLkr", currentBasicSalaryLkr)
                }
              />
              <StaffInput
                error={errors.salaryEffectiveFrom}
                label="Salary Effective From"
                value={form.salaryEffectiveFrom}
                type="date"
                readOnly={readOnly}
                onChange={(salaryEffectiveFrom) =>
                  onUpdate("salaryEffectiveFrom", salaryEffectiveFrom)
                }
              />
            </div>
          </FormSection>

          <FormSection title="Account">
            <div className="form-grid grid gap-4 md:grid-cols-3">
              <label>
                <span className="label">Linked User Account</span>
                <select
                  value={form.userId}
                  onChange={(event) => onUpdate("userId", event.target.value)}
                  disabled={readOnly}
                  className="field mt-2 min-h-12 disabled:bg-[#efefef]"
                >
                  <option value="">Not linked</option>
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <FieldError>{errors.userId}</FieldError>
              </label>
              <InfoBlock label="Username" value={linkedUser?.username ?? "-"} />
              <InfoBlock
                label="Account Status"
                value={linkedUser ? statusLabel(linkedUser.status) : "Not linked"}
              />
              {!readOnly && !form.userId ? (
                <div className="md:col-span-3">
                  <Link href="/users" className={buttonClass("secondary", "min-h-12")}>
                    Create User Account
                  </Link>
                </div>
              ) : null}
            </div>
          </FormSection>

          {mode === "view" ? (
            <>
              <FormSection title="Salary Summary">
                <div className="grid gap-3 md:grid-cols-4">
                  <InfoBlock
                    label="Current Basic Salary"
                    value={moneyLkr(selectedStaff?.currentBasicSalaryLkr ?? 0)}
                  />
                  <InfoBlock
                    label="Current Salary Status"
                    value={latestSalary?.status ?? "No record"}
                  />
                  <InfoBlock
                    label="Last Paid Period"
                    value={lastPaidSalary ? periodLabel(lastPaidSalary.salaryPeriod) : "-"}
                  />
                  <InfoBlock
                    label="Last Payment Date"
                    value={
                      lastPaidSalary && paymentDateFor(lastPaidSalary)
                        ? shortDate(paymentDateFor(lastPaidSalary) as string)
                        : "-"
                    }
                  />
                </div>
              </FormSection>
              <FormSection title="Account Summary">
                <div className="grid gap-3 md:grid-cols-3">
                  <InfoBlock label="Linked User" value={linkedUser?.name ?? "Not linked"} />
                  <InfoBlock
                    label="Account Status"
                    value={linkedUser ? statusLabel(linkedUser.status) : "Not linked"}
                  />
                  <InfoBlock label="Last Login" value="Not available in mock data" />
                </div>
              </FormSection>
            </>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            {mode === "view" ? "Close" : "Cancel"}
          </button>
          {mode === "view" && canEdit ? (
            <>
              <button type="button" onClick={onAddSalary} className={buttonClass("secondary")}>
                Add Salary Record
              </button>
              <button type="button" onClick={onToggleStatus} className={buttonClass("secondary")}>
                {form.status === "active" ? "Deactivate" : "Activate"}
              </button>
              <button type="button" onClick={onEdit} className={buttonClass("primary")}>
                Edit Profile
              </button>
            </>
          ) : null}
          {mode === "edit" ? (
            <button type="button" onClick={onSave} className={buttonClass("primary")}>
              Save Staff
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SalaryModal({
  canManage,
  errors,
  form,
  mode,
  netSalary,
  onClose,
  onSave,
  onUpdate,
  staffMembers
}: {
  canManage: boolean;
  errors: FieldErrors;
  form: SalaryForm;
  mode: SalaryModalState["mode"];
  netSalary: number;
  onClose: () => void;
  onSave: () => void;
  onUpdate: <K extends keyof SalaryForm>(field: K, value: SalaryForm[K]) => void;
  staffMembers: StaffMember[];
}) {
  const readOnly = mode === "view";
  const financialLocked = readOnly || mode === "markPaid" || form.status === "Paid";
  const canEditFinancial = canManage && !financialLocked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="salary-form-title"
    >
      <section className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#0eb6ef] bg-[#0eb6ef] px-5 py-4">
          <h2 id="salary-form-title" className="font-semibold text-white">
            {mode === "view" ? "Salary Record" : mode === "markPaid" ? "Mark Salary Paid" : form.id ? "Edit Salary Record" : "Add Salary Record"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-2 text-white transition hover:bg-white/10"
            aria-label="Close salary form"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {errors.form ? <AlertMessage>{errors.form}</AlertMessage> : null}

          <div className="form-grid grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Staff Member</span>
              <select
                value={form.staffProfileId}
                onChange={(event) => {
                  const staff = staffMembers.find((candidate) => candidate.id === event.target.value);
                  onUpdate("staffProfileId", event.target.value);
                  if (!form.id && staff) {
                    onUpdate("baseSalaryLkr", staff.currentBasicSalaryLkr ?? 0);
                  }
                }}
                disabled={readOnly || Boolean(form.id)}
                className="field mt-2 min-h-12 disabled:bg-[#efefef]"
              >
                <option value="">Select staff member</option>
                {staffMembers.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.fullName}
                  </option>
                ))}
              </select>
              <FieldError>{errors.staffProfileId}</FieldError>
            </label>
            <StaffInput
              error={errors.salaryPeriod}
              label="Salary Period"
              value={form.salaryPeriod}
              type="month"
              readOnly={readOnly || Boolean(form.id)}
              onChange={(salaryPeriod) => onUpdate("salaryPeriod", salaryPeriod)}
            />
            <StaffNumberInput
              error={errors.baseSalaryLkr}
              label="Basic Salary LKR"
              value={form.baseSalaryLkr}
              readOnly={!canEditFinancial}
              onChange={(baseSalaryLkr) => onUpdate("baseSalaryLkr", baseSalaryLkr)}
            />
            <StaffNumberInput
              error={errors.additionalPaymentLkr}
              label="Additional Payment LKR"
              value={form.additionalPaymentLkr}
              readOnly={!canEditFinancial}
              onChange={(additionalPaymentLkr) =>
                onUpdate("additionalPaymentLkr", additionalPaymentLkr)
              }
            />
            <StaffNumberInput
              error={errors.deductionLkr}
              label="Deduction LKR"
              value={form.deductionLkr}
              readOnly={!canEditFinancial}
              onChange={(deductionLkr) => onUpdate("deductionLkr", deductionLkr)}
            />
            <InfoBlock label="Net Salary" value={netSalary < 0 ? "Invalid" : moneyLkr(netSalary)} />
            {errors.netSalaryLkr ? <AlertMessage>{errors.netSalaryLkr}</AlertMessage> : null}
            <label>
              <span className="label">Status</span>
              <select
                value={form.status}
                onChange={(event) => onUpdate("status", event.target.value as StaffSalaryStatus)}
                disabled={readOnly || mode === "markPaid" || form.status === "Paid"}
                className="field mt-2 min-h-12 disabled:bg-[#efefef]"
              >
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Paid">Paid</option>
                <option value="On Hold">On Hold</option>
              </select>
            </label>
            <StaffInput
              error={errors.paymentDate}
              label="Payment Date"
              value={form.paymentDate}
              type="date"
              readOnly={readOnly || (form.status !== "Paid" && mode !== "markPaid")}
              onChange={(paymentDate) => onUpdate("paymentDate", paymentDate)}
            />
            <StaffInput
              error={errors.paymentReference}
              label="Payment Reference"
              value={form.paymentReference}
              readOnly={readOnly || (form.status !== "Paid" && mode !== "markPaid")}
              onChange={(paymentReference) => onUpdate("paymentReference", paymentReference)}
            />
            <label className="md:col-span-2">
              <span className="label">Notes</span>
              <textarea
                value={form.notes}
                onChange={(event) => onUpdate("notes", event.target.value)}
                disabled={readOnly}
                className="field mt-2 min-h-24 disabled:bg-[#efefef]"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            {mode === "view" ? "Close" : "Cancel"}
          </button>
          {mode !== "view" ? (
            <button type="button" onClick={onSave} className={buttonClass("primary")}>
              {mode === "markPaid" ? "Save Payment" : "Save Salary Record"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FormSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[#efefef] bg-white p-4">
      <h3 className="mb-4 text-base font-semibold text-[#224770]">{title}</h3>
      {children}
    </section>
  );
}

function StaffInput({
  error,
  label,
  onChange,
  readOnly,
  type = "text",
  value
}: {
  error?: string;
  label: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={readOnly}
        className="field mt-2 min-h-12 disabled:bg-[#efefef]"
      />
      <FieldError>{error}</FieldError>
    </label>
  );
}

function StaffNumberInput({
  error,
  label,
  onChange,
  readOnly,
  value
}: {
  error?: string;
  label: string;
  onChange: (value: number) => void;
  readOnly: boolean;
  value: number;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(event) => onChange(wholeNumber(Number(event.target.value)))}
        disabled={readOnly}
        className="field mt-2 min-h-12 disabled:bg-[#efefef]"
      />
      <FieldError>{error}</FieldError>
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-[#efefef]/45 p-3">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return <p className="mt-1 text-xs font-semibold text-[#46484a]">{children}</p>;
}

function AlertMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#46484a]/25 bg-[#efefef] p-3 text-sm font-semibold text-[#224770]">
      {children}
    </div>
  );
}
