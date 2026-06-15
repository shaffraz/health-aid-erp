"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Download, ReceiptText, Stethoscope } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { demoSettings } from "@/lib/demo-data";
import { convertLkrToUsd, money, monthKey, shortDate, todayISO, usd } from "@/lib/format";
import type { Doctor, DoctorPayout, Invoice, ServiceCategory } from "@/lib/types";

type ReportsDashboardProps = {
  doctors: Doctor[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
};

function downloadCsv(fileName: string, rows: string[][]) {
  const csv = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsDashboard({ doctors, invoices, payouts }: ReportsDashboardProps) {
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const invoiceUsd = (value: number) =>
    usd(convertLkrToUsd(value, demoSettings.exchangeRateLkrPerUsd));

  const dailyInvoices = invoices.filter((invoice) => invoice.date === date);
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === month);
  const monthlyPayouts = payouts.filter((payout) => monthKey(payout.date) === month);

  const categoryIncome = useMemo(() => {
    const totals = new Map<ServiceCategory, number>();
    monthlyInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        totals.set(item.category, (totals.get(item.category) ?? 0) + item.lineTotal);
      });
    });

    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [monthlyInvoices]);

  const doctorSummary = useMemo(
    () =>
      doctors.map((doctor) => {
        const doctorPayouts = monthlyPayouts.filter((payout) => payout.doctorId === doctor.id);
        const paid = doctorPayouts
          .filter((payout) => payout.status === "paid")
          .reduce((sum, payout) => sum + payout.payoutAmount, 0);
        const unpaid = doctorPayouts
          .filter((payout) => payout.status === "unpaid")
          .reduce((sum, payout) => sum + payout.payoutAmount, 0);

        return {
          doctor,
          total: paid + unpaid,
          paid,
          unpaid,
          count: doctorPayouts.length
        };
      }),
    [doctors, monthlyPayouts]
  );

  const dailySales = dailyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const monthlySales = monthlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const monthlyPaid = monthlyPayouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const monthlyUnpaid = monthlyPayouts
    .filter((payout) => payout.status === "unpaid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const maxCategory = Math.max(...categoryIncome.map((item) => item.total), 1);

  function exportMonthlyDoctorPayments() {
    downloadCsv("monthly-doctor-payment-report.csv", [
      ["Doctor", "Month", "Records", "Paid", "Unpaid", "Total"],
      ...doctorSummary.map((summary) => [
        summary.doctor.name,
        month,
        String(summary.count),
        String(summary.paid),
        String(summary.unpaid),
        String(summary.total)
      ])
    ]);
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label" htmlFor="report-date">
              Daily report date
            </label>
            <input
              id="report-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="field mt-2"
            />
          </div>
          <div>
            <label className="label" htmlFor="report-month">
              Monthly report
            </label>
            <input
              id="report-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="field mt-2"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={exportMonthlyDoctorPayments}
              className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export monthly CSV
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Daily sales"
          value={invoiceUsd(dailySales)}
          helper={`${dailyInvoices.length} invoices on ${shortDate(date)}`}
          icon={CalendarDays}
          tone="lagoon"
        />
        <MetricCard
          label="Monthly sales"
          value={invoiceUsd(monthlySales)}
          helper={`${monthlyInvoices.length} invoices in selected month`}
          icon={ReceiptText}
          tone="care"
        />
        <MetricCard
          label="Paid payouts"
          value={money(monthlyPaid)}
          helper="Paid doctor earnings this month"
          icon={Stethoscope}
          tone="ink"
        />
        <MetricCard
          label="Unpaid payouts"
          value={money(monthlyUnpaid)}
          helper="Outstanding doctor payout liability"
          icon={BarChart3}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="font-semibold text-ink">Income by category</h2>
          <p className="mt-1 text-sm text-slate-500">Based on monthly invoice line items.</p>
          <div className="mt-5 space-y-4">
            {categoryIncome.map((item) => (
              <div key={item.category}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-ink">{item.category}</span>
                  <span className="font-semibold text-lagoon-700">{invoiceUsd(item.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-lagoon-600"
                    style={{ width: `${Math.max(8, (item.total / maxCategory) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-ink">Daily invoice list</h2>
            <p className="mt-1 text-sm text-slate-500">Sales for the selected day.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Payment</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">{invoice.invoiceNo}</td>
                    <td className="px-5 py-4 text-slate-600">{invoice.patientName}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone="cyan">{invoice.paymentMethod.replace("_", " ")}</StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-ink">
                      {invoiceUsd(invoice.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-ink">Doctor payout summary</h2>
          <p className="mt-1 text-sm text-slate-500">Paid, unpaid, and monthly doctor payment totals.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3 text-right">Records</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3 text-right">Unpaid</th>
                <th className="px-5 py-3 text-right">Monthly total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctorSummary.map((summary) => (
                <tr key={summary.doctor.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{summary.doctor.name}</p>
                    <p className="text-xs text-slate-500">{summary.doctor.specialty}</p>
                  </td>
                  <td className="px-5 py-4 text-right text-slate-600">{summary.count}</td>
                  <td className="px-5 py-4 text-right font-semibold text-care-700">{money(summary.paid)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-amber-700">{money(summary.unpaid)}</td>
                  <td className="px-5 py-4 text-right font-bold text-ink">{money(summary.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-ink">Paid and unpaid payout report</h2>
          <p className="mt-1 text-sm text-slate-500">Invoice-wise payout status for the selected month.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyPayouts.map((payout) => {
                const doctor = doctors.find((candidate) => candidate.id === payout.doctorId);

                return (
                  <tr key={payout.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{shortDate(payout.date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">{payout.invoiceNo}</td>
                    <td className="px-5 py-4 text-slate-600">{doctor?.name}</td>
                    <td className="px-5 py-4 text-slate-600">{payout.serviceName}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-ink">
                      {money(payout.payoutAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill tone={payout.status === "paid" ? "green" : "amber"}>
                        {payout.status}
                      </StatusPill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
