"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { money, shortDate } from "@/lib/format";
import { generateId } from "@/lib/id";
import { roleLabels } from "@/lib/permissions";
import {
  staffStorageKey,
  type ManagedUser,
  type StaffMember,
  type StaffSalaryRecord
} from "@/lib/types";

type StaffManagementProps = {
  initialStaff: StaffMember[];
  users: ManagedUser[];
  salaryRecords: StaffSalaryRecord[];
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
  mode: "view" | "edit";
};

const emptyStaffForm: StaffForm = {
  fullName: "",
  designation: "",
  mobileNumber: "",
  email: "",
  notes: "",
  joinDate: new Date().toISOString().slice(0, 10),
  status: "active",
  userId: "",
  mode: "edit"
};

const salaryStatusTones: Record<StaffSalaryRecord["status"], "green" | "amber" | "slate"> = {
  Pending: "amber",
  Approved: "green",
  Paid: "green"
};

function staffToForm(staff: StaffMember, mode: StaffForm["mode"]): StaffForm {
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
    mode
  };
}

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function StaffManagement({
  canEdit,
  canManageSalaries,
  initialStaff,
  salaryRecords,
  users
}: StaffManagementProps) {
  const [staffMembers, setStaffMembers] = useState(initialStaff);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<StaffForm | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const staffUsers = users.filter((user) => user.role === "staff");

  useEffect(() => {
    try {
      const storedStaff = window.localStorage.getItem(staffStorageKey);

      if (storedStaff) {
        const parsed = JSON.parse(storedStaff);

        if (Array.isArray(parsed)) {
          setStaffMembers(parsed as StaffMember[]);
        }
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(staffStorageKey, JSON.stringify(staffMembers));
    }
  }, [hydrated, staffMembers]);

  const filteredStaff = useMemo(() => {
    const search = query.trim().toLowerCase();

    return staffMembers.filter((staff) => {
      const linkedUser = staff.userId ? userById.get(staff.userId) : undefined;
      const haystack = [
        staff.fullName,
        staff.designation,
        staff.mobileNumber,
        staff.email,
        staff.status,
        linkedUser?.username
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !search || haystack.includes(search);
    });
  }, [query, staffMembers, userById]);

  const activeStaff = staffMembers.filter((staff) => staff.status === "active").length;
  const salaryPending = salaryRecords
    .filter((record) => record.status !== "Paid")
    .reduce((sum, record) => sum + record.netSalaryLkr, 0);
  const salaryPaid = salaryRecords
    .filter((record) => record.status === "Paid")
    .reduce((sum, record) => sum + record.netSalaryLkr, 0);

  function openAddForm() {
    if (!canEdit) {
      return;
    }

    setError("");
    setForm(emptyStaffForm);
  }

  function openStaff(staff: StaffMember, mode: StaffForm["mode"]) {
    setError("");
    setForm(staffToForm(staff, mode));
  }

  function closeForm() {
    setError("");
    setForm(null);
  }

  function saveStaff() {
    if (!canEdit || !form || form.mode === "view") {
      return;
    }

    if (!form.fullName.trim() || !form.designation.trim() || !form.mobileNumber.trim()) {
      setError("Full name, designation, and mobile number are required.");
      return;
    }

    const nextStaff: StaffMember = {
      id: form.id ?? generateId(),
      fullName: form.fullName.trim(),
      designation: form.designation.trim(),
      mobileNumber: form.mobileNumber.trim(),
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      joinDate: form.joinDate,
      status: form.status,
      userId: form.userId || undefined
    };

    setStaffMembers((current) =>
      form.id
        ? current.map((staff) => (staff.id === form.id ? nextStaff : staff))
        : [nextStaff, ...current]
    );
    closeForm();
  }

  function toggleStaffStatus(staffId: string) {
    if (!canEdit) {
      return;
    }

    setStaffMembers((current) =>
      current.map((staff) =>
        staff.id === staffId
          ? { ...staff, status: staff.status === "active" ? "inactive" : "active" }
          : staff
      )
    );
  }

  function deleteStaff(staff: StaffMember) {
    if (!canEdit || staff.userId || salaryRecords.some((record) => record.staffUserId === staff.userId)) {
      return;
    }

    setStaffMembers((current) => current.filter((candidate) => candidate.id !== staff.id));
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Staff" value={String(activeStaff)} tone="primary" />
        <KpiCard label="Inactive Staff" value={String(staffMembers.length - activeStaff)} />
        <KpiCard label="Pending Salary LKR" value={money(salaryPending)} tone="warning" />
        <KpiCard label="Paid Salary LKR" value={money(salaryPaid)} tone="success" />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field min-h-12 lg:max-w-sm"
            placeholder="Search staff"
          />
          {canEdit ? (
            <button
              type="button"
              onClick={openAddForm}
              className={buttonClass("secondary", "min-h-12 border-white bg-white text-[#224770] hover:border-white hover:bg-[#efefef] lg:ml-auto")}
            >
              Add Staff
            </button>
          ) : null}
        </div>

        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[860px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Full Name</th>
                <th className={tableStyles.headerCell}>Designation</th>
                <th className={tableStyles.headerCell}>Mobile Number</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>User Account</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredStaff.map((staff) => {
                const linkedUser = staff.userId ? userById.get(staff.userId) : undefined;
                const used = Boolean(staff.userId) || salaryRecords.some(
                  (record) => record.staffUserId === staff.userId
                );

                return (
                  <tr key={staff.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>
                      <p>{staff.fullName}</p>
                      {staff.email ? (
                        <p className="mt-1 text-xs font-normal text-[#46484a]">{staff.email}</p>
                      ) : null}
                    </td>
                    <td className={tableStyles.cell}>{staff.designation}</td>
                    <td className={tableStyles.cell}>{staff.mobileNumber}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={staff.status === "active" ? "green" : "slate"}>
                        {staff.status === "active" ? "Active" : "Inactive"}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      {linkedUser ? linkedUser.username : "Not linked"}
                    </td>
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
                                  label: used ? "Delete unavailable" : "Delete",
                                  disabled: used,
                                  onSelect: () => deleteStaff(staff)
                                }
                              ]
                            : [])
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {!filteredStaff.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={6}>
                    No staff records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] p-5">
          <h2 className="font-semibold text-white">
            {canManageSalaries ? "Salary Management" : "Salary Overview"}
          </h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[960px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Staff Member</th>
                <th className={tableStyles.headerCell}>Salary Period</th>
                <th className={tableStyles.numericHeaderCell}>Basic Salary</th>
                <th className={tableStyles.numericHeaderCell}>Additional Payments</th>
                <th className={tableStyles.numericHeaderCell}>Deductions</th>
                <th className={tableStyles.numericHeaderCell}>Net Salary</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {salaryRecords.map((record) => {
                const user = userById.get(record.staffUserId);

                return (
                  <tr key={record.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{user?.name ?? "Unlinked staff"}</td>
                    <td className={tableStyles.cell}>{periodLabel(record.salaryPeriod)}</td>
                    <td className={tableStyles.numericCell}>{money(record.baseSalaryLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.additionalPaymentLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.deductionLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.netSalaryLkr)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={salaryStatusTones[record.status]}>{record.status}</StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      {record.paidAt ? shortDate(record.paidAt) : "Not paid"}
                      {record.paymentReference ? (
                        <p className="mt-1 text-xs text-[#46484a]">{record.paymentReference}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {form ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="staff-form-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="staff-form-title" className="font-semibold text-[#224770]">
                {form.mode === "view" ? "Staff Profile" : form.id ? "Edit Staff" : "Add Staff"}
              </h2>
              <button
                type="button"
                onClick={closeForm}
                className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
                aria-label="Close staff form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {error ? (
                <div className="rounded-lg border border-[#46484a]/25 bg-[#efefef] p-3 text-sm font-semibold text-[#224770]">
                  {error}
                </div>
              ) : null}

              <div>
                <h3 className="font-semibold text-[#224770]">Personal Information</h3>
                <div className="form-grid mt-3 grid gap-4 md:grid-cols-2">
                  <StaffField
                    label="Full Name"
                    value={form.fullName}
                    readOnly={form.mode === "view"}
                    onChange={(fullName) => setForm((current) => current && { ...current, fullName })}
                  />
                  <StaffField
                    label="Designation"
                    value={form.designation}
                    readOnly={form.mode === "view"}
                    onChange={(designation) => setForm((current) => current && { ...current, designation })}
                  />
                  <StaffField
                    label="Mobile Number"
                    value={form.mobileNumber}
                    readOnly={form.mode === "view"}
                    onChange={(mobileNumber) => setForm((current) => current && { ...current, mobileNumber })}
                  />
                  <StaffField
                    label="Email"
                    value={form.email}
                    type="email"
                    readOnly={form.mode === "view"}
                    onChange={(email) => setForm((current) => current && { ...current, email })}
                  />
                  <label className="md:col-span-2">
                    <span className="label">Notes</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm((current) => current && { ...current, notes: event.target.value })
                      }
                      disabled={form.mode === "view"}
                      className="field mt-2 min-h-24 disabled:bg-slate-100"
                    />
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#224770]">Employment</h3>
                <div className="form-grid mt-3 grid gap-4 md:grid-cols-2">
                  <StaffField
                    label="Join Date"
                    value={form.joinDate}
                    type="date"
                    readOnly={form.mode === "view"}
                    onChange={(joinDate) => setForm((current) => current && { ...current, joinDate })}
                  />
                  <label>
                    <span className="label">Status</span>
                    <select
                      value={form.status}
                      onChange={(event) =>
                        setForm(
                          (current) =>
                            current && {
                              ...current,
                              status: event.target.value as StaffMember["status"]
                            }
                        )
                      }
                      disabled={form.mode === "view"}
                      className="field mt-2 min-h-12 disabled:bg-slate-100"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-[#224770]">User Account</h3>
                <div className="form-grid mt-3 grid gap-4 md:grid-cols-3">
                  <label>
                    <span className="label">Linked User</span>
                    <select
                      value={form.userId}
                      onChange={(event) =>
                        setForm((current) => current && { ...current, userId: event.target.value })
                      }
                      disabled={form.mode === "view"}
                      className="field mt-2 min-h-12 disabled:bg-slate-100"
                    >
                      <option value="">Not linked</option>
                      {staffUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <InfoBlock
                    label="Username"
                    value={form.userId ? userById.get(form.userId)?.username ?? "-" : "-"}
                  />
                  <InfoBlock
                    label="Role"
                    value={form.userId ? roleLabels[userById.get(form.userId)?.role ?? "staff"] : "-"}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeForm} className={buttonClass("secondary")}>
                {form.mode === "view" ? "Close" : "Cancel"}
              </button>
              {form.mode === "edit" ? (
                <button type="button" onClick={saveStaff} className={buttonClass("primary")}>
                  Save Staff
                </button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function StaffField({
  label,
  onChange,
  readOnly,
  type = "text",
  value
}: {
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
        className="field mt-2 min-h-12 disabled:bg-slate-100"
      />
    </label>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-[#f7f9fb] p-3">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}
