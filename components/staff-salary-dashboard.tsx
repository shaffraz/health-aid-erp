"use client";

import { useMemo, useState } from "react";
import { KpiCard, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { money, shortDate } from "@/lib/format";
import { roleLabels } from "@/lib/permissions";
import type { ManagedUser, StaffSalaryRecord } from "@/lib/types";

type StaffSalaryDashboardProps = {
  users: ManagedUser[];
  salaryRecords: StaffSalaryRecord[];
  canManage: boolean;
};

const salaryStatusTones: Record<StaffSalaryRecord["status"], "green" | "amber" | "slate"> = {
  Pending: "amber",
  Approved: "green",
  Paid: "green",
  "On Hold": "slate"
};

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function StaffSalaryDashboard({
  canManage,
  salaryRecords,
  users
}: StaffSalaryDashboardProps) {
  const [query, setQuery] = useState("");
  const staffUsers = users.filter((user) => user.role === "staff");
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const pendingTotal = salaryRecords
    .filter((record) => record.status !== "Paid")
    .reduce((sum, record) => sum + record.netSalaryLkr, 0);
  const paidTotal = salaryRecords
    .filter((record) => record.status === "Paid")
    .reduce((sum, record) => sum + record.netSalaryLkr, 0);

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();

    return salaryRecords.filter((record) => {
      const user = record.staffUserId ? userById.get(record.staffUserId) : undefined;
      const haystack = [
        user?.name,
        user?.email,
        user?.username,
        record.salaryPeriod,
        record.status,
        record.paymentReference
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !search || haystack.includes(search);
    });
  }, [query, salaryRecords, userById]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Staff Members" value={String(staffUsers.length)} tone="primary" />
        <KpiCard label="Salary Records" value={String(salaryRecords.length)} />
        <KpiCard label="Pending Salary LKR" value={money(pendingTotal)} tone="warning" />
        <KpiCard label="Paid Salary LKR" value={money(paidTotal)} tone="success" />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-4 lg:flex-row lg:items-center">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="field min-h-12 lg:max-w-sm"
            placeholder="Search staff salaries"
          />
          <p className="text-sm font-medium text-white/85 lg:ml-auto">
            {canManage ? "Administrator salary management" : "Read-only salary overview"}
          </p>
        </div>

        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[980px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Staff Member</th>
                <th className={tableStyles.headerCell}>Role</th>
                <th className={tableStyles.headerCell}>Period</th>
                <th className={tableStyles.numericHeaderCell}>Base Salary LKR</th>
                <th className={tableStyles.numericHeaderCell}>Additional LKR</th>
                <th className={tableStyles.numericHeaderCell}>Deduction LKR</th>
                <th className={tableStyles.numericHeaderCell}>Net Salary LKR</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredRecords.map((record) => {
                const user = record.staffUserId ? userById.get(record.staffUserId) : undefined;

                return (
                  <tr key={record.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>
                      <p>{user?.name ?? "Unlinked staff member"}</p>
                      {user?.email ? (
                        <p className="mt-1 text-xs font-normal text-[#46484a]">{user.email}</p>
                      ) : null}
                    </td>
                    <td className={tableStyles.cell}>
                      {user ? roleLabels[user.role] : "Staff"}
                    </td>
                    <td className={tableStyles.cell}>{periodLabel(record.salaryPeriod)}</td>
                    <td className={tableStyles.numericCell}>{money(record.baseSalaryLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.additionalPaymentLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.deductionLkr)}</td>
                    <td className={tableStyles.numericCell}>{money(record.netSalaryLkr)}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={salaryStatusTones[record.status]}>
                        {record.status}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.cell}>
                      {record.paymentDate || record.paidAt ? shortDate((record.paymentDate ?? record.paidAt) as string) : "Not paid"}
                      {record.paymentReference ? (
                        <p className="mt-1 text-xs text-[#46484a]">{record.paymentReference}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
              {!filteredRecords.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={9}>
                    No salary records found.
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
