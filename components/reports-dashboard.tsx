"use client";

import { useMemo, useState } from "react";
import { buttonClass, KpiCard, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { invoiceItemRevenueAmount, invoiceRevenueAmount } from "@/lib/calculations";
import { monthKey, todayISO, usdWhole } from "@/lib/format";
import type { Invoice, PaymentMethod, ServiceCategory } from "@/lib/types";

type ReportsDashboardProps = {
  invoices: Invoice[];
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
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

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function ReportsDashboard({ invoices }: ReportsDashboardProps) {
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const dailyInvoices = invoices.filter((invoice) => invoice.date === date);
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === month);
  const dailyRevenue = dailyInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const monthlyRevenue = monthlyInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const monthlyAverageInvoiceValue = average(
    monthlyInvoices.map((invoice) => invoiceRevenueAmount(invoice))
  );

  const categoryIncome = useMemo(() => {
    const totals = new Map<ServiceCategory, number>();

    monthlyInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        totals.set(
          item.category,
          (totals.get(item.category) ?? 0) + invoiceItemRevenueAmount(invoice, item)
        );
      });
    });

    return [...totals.entries()]
      .map(([category, total]) => ({ category, total }))
      .filter((item) => item.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [monthlyInvoices]);

  const maxCategoryIncome = Math.max(...categoryIncome.map((item) => item.total), 1);

  function exportMonthlyRevenue() {
    downloadCsv("monthly-revenue-report.csv", [
      ["Invoice", "Date", "Patient", "Payment Method", "Recognized Revenue USD"],
      ...monthlyInvoices.map((invoice) => [
        invoice.invoiceNo,
        invoice.date,
        invoice.patientName,
        paymentLabels[invoice.paymentMethod],
        String(invoiceRevenueAmount(invoice))
      ]),
      ["Total", month, "", "", String(monthlyRevenue)]
    ]);
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
          <div>
            <label className="label" htmlFor="report-date">
              Daily Report Date
            </label>
            <input
              id="report-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="field mt-2 min-h-12"
            />
          </div>
          <div>
            <label className="label" htmlFor="report-month">
              Monthly Report
            </label>
            <input
              id="report-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="field mt-2 min-h-12"
            />
          </div>
          <button
            type="button"
            onClick={exportMonthlyRevenue}
            className={buttonClass("primary", "min-h-12 px-5")}
          >
            Export Monthly CSV
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Daily Revenue USD" value={usdWhole(dailyRevenue)} tone="info" />
        <KpiCard label="Daily Invoices" value={String(dailyInvoices.length)} />
        <KpiCard label="Monthly Revenue USD" value={usdWhole(monthlyRevenue)} tone="success" />
        <KpiCard
          label="Average Invoice Value USD"
          value={usdWhole(monthlyAverageInvoiceValue)}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="panel p-5">
          <h2 className="font-semibold text-[#224770]">Income by Category</h2>
          <div className="mt-5 space-y-4">
            {categoryIncome.map((item) => (
              <div key={item.category}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#224770]">{item.category}</span>
                  <span className="font-semibold text-[#224770]">{usdWhole(item.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#efefef]">
                  <div
                    className="h-2 rounded-full bg-[#0eb6ef]"
                    style={{ width: `${Math.max(8, (item.total / maxCategoryIncome) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!categoryIncome.length ? (
              <p className="rounded-lg bg-[#efefef] p-4 text-sm font-semibold text-[#46484a]">
                No income recorded for the selected month.
              </p>
            ) : null}
          </div>
        </section>

        <section className="panel overflow-hidden">
          <div className="border-b border-[#efefef] p-5">
            <h2 className="font-semibold text-[#224770]">Daily Invoice List</h2>
          </div>
          <div className={tableStyles.wrapper}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Invoice</th>
                  <th className={tableStyles.headerCell}>Patient</th>
                  <th className={tableStyles.headerCell}>Payment</th>
                  <th className={tableStyles.numericHeaderCell}>Revenue USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {dailyInvoices.map((invoice) => (
                  <tr key={invoice.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>{invoice.invoiceNo}</td>
                    <td className={tableStyles.cell}>{invoice.patientName}</td>
                    <td className={tableStyles.cell}>
                      <StatusPill tone={invoice.paymentMethod === "insurance" ? "cyan" : "slate"}>
                        {paymentLabels[invoice.paymentMethod]}
                      </StatusPill>
                    </td>
                    <td className={tableStyles.numericCell}>
                      {usdWhole(invoiceRevenueAmount(invoice))}
                    </td>
                  </tr>
                ))}
                {!dailyInvoices.length ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={4}>
                      No invoices found for the selected date.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
