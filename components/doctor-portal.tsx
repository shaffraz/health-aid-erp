"use client";

import { useMemo, useState } from "react";
import { Banknote, CalendarDays, CheckCircle2, Clock3 } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
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
    () => payouts.filter((payout) => payout.doctorId === user.doctorId),
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
            <h2 className="mt-2 text-2xl font-bold text-ink">{doctor?.name ?? user.name}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {doctor?.specialty ?? "Clinical earnings"} - private earning view only
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
        <MetricCard
          label="Today's earnings"
          value={money(todaysPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${todaysPayouts.length} payout records today`}
          icon={CalendarDays}
          tone="lagoon"
        />
        <MetricCard
          label="Monthly earnings"
          value={money(monthlyPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${monthlyPayouts.length} payout records in selected month`}
          icon={Banknote}
          tone="care"
        />
        <MetricCard
          label="Paid amount"
          value={money(paid.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${paid.length} records paid`}
          icon={CheckCircle2}
          tone="ink"
        />
        <MetricCard
          label="Unpaid amount"
          value={money(unpaid.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${unpaid.length} records awaiting voucher payment`}
          icon={Clock3}
          tone="amber"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-ink">Invoice-wise breakdown</h2>
          <p className="mt-1 text-sm text-slate-500">
            Doctors see service, invoice number, reason, amount, and payment status only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Payment reason</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyPayouts.map((payout) => (
                <tr key={payout.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">{shortDate(payout.date)}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">{payout.invoiceNo}</td>
                  <td className="px-5 py-4 text-slate-600">{payout.serviceName}</td>
                  <td className="px-5 py-4 text-slate-600">{payout.paymentReason}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-ink">
                    {money(payout.payoutAmount)}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={payout.status === "paid" ? "green" : "amber"}>
                      {payout.status}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
