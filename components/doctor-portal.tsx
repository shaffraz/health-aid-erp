"use client";

import { useMemo, useState } from "react";
import { KpiCard, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { money, monthKey, shortDate, todayISO } from "@/lib/format";
import type { AppUser, Doctor, DoctorPayout } from "@/lib/types";

type DoctorPortalProps = {
  user: AppUser;
  doctors: Doctor[];
  payouts: DoctorPayout[];
};

export function DoctorPortal({ user, doctors, payouts }: DoctorPortalProps) {
  const [selectedMonth, setSelectedMonth] = useState(todayISO().slice(0, 7));
  const doctor = doctors.find((candidate) => candidate.id === user.doctorId);
  const scopedPayouts = useMemo(
    () =>
      payouts.filter(
        (payout) => payout.doctorId === user.doctorId && payout.payoutMode !== "pending_shift"
      ),
    [payouts, user.doctorId]
  );
  const todaysPayouts = scopedPayouts.filter((payout) => payout.date === todayISO());
  const monthlyPayouts = scopedPayouts.filter((payout) => monthKey(payout.date) === selectedMonth);
  const paid = scopedPayouts.filter((payout) => payout.status === "paid");
  const unpaid = scopedPayouts.filter((payout) => payout.status === "unpaid");

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="label">Doctor portal</p>
            <h2 className="mt-2 text-2xl font-bold text-[#224770]">{doctor?.name ?? user.name}</h2>
            <p className="mt-1 text-sm font-medium text-[#46484a]">
              {doctor?.designation ?? "Clinical earnings"}
            </p>
          </div>
          <div>
            <label className="label" htmlFor="portal-month">
              Month
            </label>
            <input
              id="portal-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="field mt-2 w-full md:w-48"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Today's Earnings"
          value={money(todaysPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${todaysPayouts.length} payout records`}
          tone="info"
        />
        <KpiCard
          label="Monthly Earnings"
          value={money(monthlyPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${monthlyPayouts.length} payout records`}
          tone="success"
        />
        <KpiCard
          label="Paid Amount"
          value={money(paid.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${paid.length} records paid`}
          tone="primary"
        />
        <KpiCard
          label="Unpaid Amount"
          value={money(unpaid.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${unpaid.length} records awaiting payment`}
          tone="warning"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="font-semibold text-white">Earnings breakdown</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Date</th>
                <th className={tableStyles.headerCell}>Invoice / Shift</th>
                <th className={tableStyles.headerCell}>Type</th>
                <th className={tableStyles.headerCell}>Payment Reason</th>
                <th className={tableStyles.numericHeaderCell}>Amount</th>
                <th className={tableStyles.headerCell}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {monthlyPayouts.map((payout) => (
                <tr key={payout.id} className={tableStyles.row}>
                  <td className={tableStyles.cell}>{shortDate(payout.date)}</td>
                  <td className={tableStyles.strongCell}>{payout.invoiceNo}</td>
                  <td className={tableStyles.cell}>
                    {payout.payoutMode === "shift" ? "Clinic Shift Voucher" : "Invoice payout"}
                  </td>
                  <td className={tableStyles.cell}>{payout.paymentReason}</td>
                  <td className={tableStyles.numericCell}>
                    {money(payout.payoutAmount)}
                  </td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={payout.status === "paid" ? "green" : "amber"}>
                      {payout.status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
              {!monthlyPayouts.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={6}>
                    No payout records found for the selected month.
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
