"use client";

import { useMemo, useState } from "react";
import { buttonClass, KpiCard } from "@/components/erp-ui";
import { invoiceItemRevenueAmount, invoiceRevenueAmount } from "@/lib/calculations";
import { monthKey, todayISO, usdWhole } from "@/lib/format";
import { currentOperatingSeason, isWithinSeason } from "@/lib/season";
import { currencyLabel } from "@/lib/settings";
import { useSystemSettings } from "@/lib/use-system-settings";
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

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openReportPdf(title: string, rows: string[][]) {
  const reportWindow = window.open("", "_blank", "noopener,noreferrer");

  if (!reportWindow) {
    return;
  }

  const [header = [], ...bodyRows] = rows;
  const headerHtml = header
    .map((cell) => `<th>${escapeHtml(cell)}</th>`)
    .join("");
  const bodyHtml = bodyRows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
    )
    .join("");

  reportWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { color: #224770; font-family: Arial, sans-serif; margin: 32px; }
      h1 { margin: 0 0 18px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border-bottom: 1px solid #dfe4e7; padding: 10px; text-align: left; vertical-align: top; }
      th { background: #efefef; color: #46484a; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; }
      td { color: #224770; font-size: 13px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <thead><tr>${headerHtml}</tr></thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  </body>
</html>`);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
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
  const systemSettings = useSystemSettings();

  const dailyInvoices = invoices.filter((invoice) => invoice.date === date);
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === month);
  const invoiceCurrencyCode = systemSettings.clinic.currency;
  const currentSeason = currentOperatingSeason(todayISO(), systemSettings.seasons);
  const currentSeasonInvoices = invoices.filter((invoice) =>
    isWithinSeason(invoice.date, currentSeason)
  );
  const dailyRevenue = dailyInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const monthlyRevenue = monthlyInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const currentSeasonRevenue = currentSeasonInvoices.reduce(
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
  const paymentSummary = useMemo(() => {
    return Object.entries(paymentLabels)
      .map(([method, label]) => ({
        method: method as PaymentMethod,
        label,
        total: monthlyInvoices
          .filter((invoice) => invoice.paymentMethod === method)
          .reduce((sum, invoice) => sum + invoiceRevenueAmount(invoice), 0)
      }))
      .filter((item) => item.total > 0);
  }, [monthlyInvoices]);
  const maxPaymentTotal = Math.max(...paymentSummary.map((item) => item.total), 1);

  function exportMonthlyRevenuePdf() {
    openReportPdf("Monthly Revenue Report", [
      ["Invoice", "Date", "Patient", "Payment Method", currencyLabel("Recognized Revenue", invoiceCurrencyCode)],
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

  function exportCategoryIncomePdf() {
    openReportPdf("Category Income Report", [
      ["Category", currencyLabel("Revenue", invoiceCurrencyCode)],
      ...categoryIncome.map((item) => [item.category, String(item.total)]),
      ["Total", String(monthlyRevenue)]
    ]);
  }

  function exportPaymentSummaryPdf() {
    openReportPdf("Payment Summary Report", [
      ["Payment Method", currencyLabel("Revenue", invoiceCurrencyCode)],
      ...paymentSummary.map((item) => [item.label, String(item.total)]),
      ["Total", String(monthlyRevenue)]
    ]);
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="form-grid grid gap-4 md:grid-cols-2">
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
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label={currencyLabel("Daily Revenue", invoiceCurrencyCode)}
          value={usdWhole(dailyRevenue)}
          tone="info"
        />
        <KpiCard label="Daily Invoices" value={String(dailyInvoices.length)} />
        <KpiCard
          label={currencyLabel("Monthly Revenue", invoiceCurrencyCode)}
          value={usdWhole(monthlyRevenue)}
          tone="success"
        />
        <KpiCard
          label={currencyLabel("Current Season Revenue", invoiceCurrencyCode)}
          value={usdWhole(currentSeasonRevenue)}
          helper={currentSeason.label}
          tone="primary"
        />
        <KpiCard
          label={currencyLabel("Average Invoice Value", invoiceCurrencyCode)}
          value={usdWhole(monthlyAverageInvoiceValue)}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
            <h2 className="font-semibold text-white">Income by Category</h2>
          </div>
          <div className="space-y-4 p-5">
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
          <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
            <h2 className="font-semibold text-white">Payment Summary</h2>
          </div>
          <div className="space-y-4 p-5">
            {paymentSummary.map((item) => (
              <div key={item.method}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[#224770]">{item.label}</span>
                  <span className="font-semibold text-[#224770]">{usdWhole(item.total)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#efefef]">
                  <div
                    className="h-2 rounded-full bg-[#84bc3f]"
                    style={{ width: `${Math.max(8, (item.total / maxPaymentTotal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {!paymentSummary.length ? (
              <p className="rounded-lg bg-[#efefef] p-4 text-sm font-semibold text-[#46484a]">
                No payment revenue recorded for the selected month.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="font-semibold text-white">Important Reports</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-3">
          <button
            type="button"
            onClick={exportMonthlyRevenuePdf}
            className={buttonClass("secondary", "min-h-12")}
          >
            Monthly Revenue PDF
          </button>
          <button
            type="button"
            onClick={exportCategoryIncomePdf}
            className={buttonClass("secondary", "min-h-12")}
          >
            Category Income PDF
          </button>
          <button
            type="button"
            onClick={exportPaymentSummaryPdf}
            className={buttonClass("secondary", "min-h-12")}
          >
            Payment Summary PDF
          </button>
        </div>
      </section>
    </div>
  );
}
