"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { shortDate } from "@/lib/format";
import {
  staffSalaryStorageKey,
  staffStorageKey,
  type AppUser,
  type StaffMember,
  type StaffSalaryRecord
} from "@/lib/types";

type MySalaryDashboardProps = {
  user: AppUser;
  staffMembers: StaffMember[];
  salaryRecords: StaffSalaryRecord[];
};

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonthValue() {
  return todayDate().slice(0, 7);
}

function moneyLkr(amount: number) {
  return `LKR ${Math.max(0, Math.round(amount)).toLocaleString("en-US")}`;
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

export function MySalaryDashboard({
  salaryRecords,
  staffMembers,
  user
}: MySalaryDashboardProps) {
  const [localStaffMembers, setLocalStaffMembers] = useState(staffMembers);
  const [localSalaryRecords, setLocalSalaryRecords] = useState(salaryRecords);
  const [selectedRecord, setSelectedRecord] = useState<StaffSalaryRecord | null>(null);

  useEffect(() => {
    try {
      const storedStaff = window.localStorage.getItem(staffStorageKey);
      const storedSalaryRecords = window.localStorage.getItem(staffSalaryStorageKey);

      if (storedStaff) {
        const parsed = JSON.parse(storedStaff);

        if (Array.isArray(parsed)) {
          setLocalStaffMembers(parsed as StaffMember[]);
        }
      }

      if (storedSalaryRecords) {
        const parsed = JSON.parse(storedSalaryRecords);

        if (Array.isArray(parsed)) {
          setLocalSalaryRecords(parsed as StaffSalaryRecord[]);
        }
      }
    } catch {
      setLocalStaffMembers(staffMembers);
      setLocalSalaryRecords(salaryRecords);
    }
  }, [salaryRecords, staffMembers]);

  const linkedStaff = useMemo(
    () => localStaffMembers.find((staff) => staff.userId === user.id),
    [localStaffMembers, user.id]
  );

  const ownRecords = useMemo(() => {
    if (!linkedStaff) {
      return [];
    }

    return localSalaryRecords
      .filter(
        (record) =>
          record.staffProfileId === linkedStaff.id ||
          (record.staffUserId && record.staffUserId === user.id)
      )
      .sort((a, b) => b.salaryPeriod.localeCompare(a.salaryPeriod));
  }, [linkedStaff, localSalaryRecords, user.id]);

  const currentPeriodRecord =
    ownRecords.find((record) => record.salaryPeriod === currentMonthValue()) ?? ownRecords[0];

  if (!linkedStaff) {
    return (
      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-[#224770]">Salary Access Not Configured</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#46484a]">
          Your login account is not linked to a staff profile yet. Please request the administrator
          to link your user account before salary records can be displayed.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] p-5">
          <h2 className="text-lg font-semibold text-white">Current Period</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <InfoBlock
            label="Month"
            value={currentPeriodRecord ? periodLabel(currentPeriodRecord.salaryPeriod) : "No record"}
          />
          <InfoBlock
            label="Salary Paid"
            value={currentPeriodRecord?.status === "Paid" ? "Paid" : "Not paid"}
          />
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#0eb6ef] bg-[#0eb6ef] p-5">
          <h2 className="text-lg font-semibold text-white">Salary History</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className="w-full min-w-[520px] divide-y divide-[#efefef] text-sm">
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Month</th>
                <th className={tableStyles.headerCell}>Salary Paid</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {ownRecords.map((record) => (
                <tr key={record.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>{periodLabel(record.salaryPeriod)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={record.status === "Paid" ? "green" : "amber"}>
                      {record.status === "Paid" ? "Paid" : "Not paid"}
                    </StatusPill>
                  </td>
                  <td className={tableStyles.actionCell}>
                    <button
                      type="button"
                      onClick={() => setSelectedRecord(record)}
                      className={buttonClass("secondary", "min-h-10 w-full")}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {!ownRecords.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={3}>
                    No salary records are available for your account.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRecord ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="salary-details-title"
        >
          <section className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#224770] bg-[#224770] px-5 py-4">
              <h2 id="salary-details-title" className="font-semibold text-white">
                Salary Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="focus-ring rounded-lg p-2 text-white transition hover:bg-white/10"
                aria-label="Close salary details"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-4 overflow-y-auto p-5 md:grid-cols-2">
              <InfoBlock label="Salary Period" value={periodLabel(selectedRecord.salaryPeriod)} />
              <InfoBlock label="Status" value={selectedRecord.status} />
              <InfoBlock label="Basic Salary" value={moneyLkr(selectedRecord.baseSalaryLkr)} />
              <InfoBlock
                label="Additional Payment"
                value={moneyLkr(selectedRecord.additionalPaymentLkr)}
              />
              <InfoBlock label="Deduction" value={moneyLkr(selectedRecord.deductionLkr)} />
              <InfoBlock label="Net Salary" value={moneyLkr(selectedRecord.netSalaryLkr)} />
              <InfoBlock
                label="Payment Date"
                value={
                  paymentDateFor(selectedRecord)
                    ? shortDate(paymentDateFor(selectedRecord) as string)
                    : "Pending"
                }
              />
              <InfoBlock
                label="Payment Reference"
                value={selectedRecord.paymentReference ?? "-"}
              />
              <div className="rounded-xl border border-[#efefef] bg-[#efefef]/45 p-3 md:col-span-2">
                <p className="label">Notes</p>
                <p className="mt-2 text-sm font-medium text-[#46484a]">
                  {selectedRecord.notes ?? "-"}
                </p>
              </div>
            </div>
            <div className="flex justify-end border-t border-[#efefef] px-5 py-4">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className={buttonClass("secondary")}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-white p-4 shadow-sm">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}
