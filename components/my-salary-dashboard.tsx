"use client";

import { KpiCard, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { money, shortDate } from "@/lib/format";
import type { AppUser, StaffSalaryRecord } from "@/lib/types";

type MySalaryDashboardProps = {
  user: AppUser;
  salaryRecords: StaffSalaryRecord[];
};

const salaryStatusTones: Record<StaffSalaryRecord["status"], "green" | "amber" | "slate"> = {
  Pending: "amber",
  Approved: "green",
  Paid: "green"
};

function periodLabel(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function MySalaryDashboard({ salaryRecords, user }: MySalaryDashboardProps) {
  const ownRecords = salaryRecords.filter((record) => record.staffUserId === user.id);
  const latestRecord = ownRecords[0];
  const paidTotal = ownRecords
    .filter((record) => record.status === "Paid")
    .reduce((sum, record) => sum + record.netSalaryLkr, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Current Salary Status"
          value={latestRecord?.status ?? "No record"}
          tone={latestRecord?.status === "Paid" ? "success" : "warning"}
        />
        <KpiCard
          label="Current Net Salary LKR"
          value={latestRecord ? money(latestRecord.netSalaryLkr) : money(0)}
          tone="primary"
        />
        <KpiCard
          label="Last Payment Date"
          value={latestRecord?.paidAt ? shortDate(latestRecord.paidAt) : "Pending"}
        />
        <KpiCard label="Paid Salary LKR" value={money(paidTotal)} tone="success" />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#efefef] p-5">
          <h2 className="font-semibold text-[#224770]">My Salary Records</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className="min-w-[780px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Period</th>
                <th className={tableStyles.numericHeaderCell}>Base Salary LKR</th>
                <th className={tableStyles.numericHeaderCell}>Additional LKR</th>
                <th className={tableStyles.numericHeaderCell}>Deduction LKR</th>
                <th className={tableStyles.numericHeaderCell}>Net Salary LKR</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.headerCell}>Payment Date</th>
                <th className={tableStyles.headerCell}>Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {ownRecords.map((record) => (
                <tr key={record.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{periodLabel(record.salaryPeriod)}</td>
                  <td className={tableStyles.numericCell}>{money(record.baseSalaryLkr)}</td>
                  <td className={tableStyles.numericCell}>{money(record.additionalPaymentLkr)}</td>
                  <td className={tableStyles.numericCell}>{money(record.deductionLkr)}</td>
                  <td className={tableStyles.numericCell}>{money(record.netSalaryLkr)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={salaryStatusTones[record.status]}>{record.status}</StatusPill>
                  </td>
                  <td className={tableStyles.cell}>
                    {record.paidAt ? shortDate(record.paidAt) : "Pending"}
                  </td>
                  <td className={tableStyles.cell}>{record.paymentReference ?? "-"}</td>
                </tr>
              ))}
              {!ownRecords.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={8}>
                    No salary records are available for your account.
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
