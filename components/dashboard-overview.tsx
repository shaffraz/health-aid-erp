"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { KpiCard, tableStyles } from "@/components/erp-ui";
import {
  generatePayoutsForInvoices,
  invoiceItemRevenueAmount,
  invoiceRevenueAmount
} from "@/lib/calculations";
import { money, monthKey, todayISO, usdWhole } from "@/lib/format";
import {
  currencyLabelParenthetical,
  invoiceCurrency,
  loadSystemSettings,
  localCurrency,
  normalizeSystemSettings,
  paymentModeLabels,
  paymentModeValues,
  type SystemSettings
} from "@/lib/settings";
import {
  doctorStorageKey,
  serviceStorageKey,
  type Doctor,
  type DoctorPayout,
  type InsuranceReceivable,
  type Invoice,
  type InvoiceItem,
  type PaymentMethod,
  type Service,
  type ServiceCategory
} from "@/lib/types";
import { currentOperatingSeason, isWithinSeason } from "@/lib/season";
import { cn } from "@/lib/utils";

type DashboardOverviewProps = {
  initialDoctors: Doctor[];
  initialServices: Service[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
  insuranceReceivables: InsuranceReceivable[];
};

type PeriodCategory =
  | "New Consultations"
  | "Review Consultations"
  | "Procedures"
  | "Day Care Admissions"
  | "Laboratory"
  | "Medication Charges"
  | "Consumable Charges";

const paymentMethodLabels: Record<Extract<PaymentMethod, "cash" | "card" | "insurance">, string> = {
  cash: "Cash",
  card: "Card",
  insurance: "Insurance"
};

const paymentDistributionColors = {
  cash: "#224770",
  card: "#0eb6ef",
  insurance: "#84bc3f"
} satisfies Record<Extract<PaymentMethod, "cash" | "card" | "insurance">, string>;

const periodCategories: PeriodCategory[] = [
  "New Consultations",
  "Review Consultations",
  "Procedures",
  "Day Care Admissions",
  "Laboratory",
  "Medication Charges",
  "Consumable Charges"
];

const procedureCategories: ServiceCategory[] = [
  "Procedures",
  "IV Therapy",
  "Wound Care",
  "Vaccines / ARV"
];

function normalizeDoctor(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? ""
  };
}

function itemQuantity(item: InvoiceItem) {
  return Math.max(1, item.quantity);
}

function isReviewConsultation(item: InvoiceItem) {
  return item.category === "Consultation" && item.serviceName.toLowerCase().includes("review");
}

function isNewConsultation(item: InvoiceItem) {
  return item.category === "Consultation" && !isReviewConsultation(item);
}

function periodCategoryForItem(item: InvoiceItem): PeriodCategory | null {
  if (isNewConsultation(item)) {
    return "New Consultations";
  }

  if (isReviewConsultation(item)) {
    return "Review Consultations";
  }

  if (procedureCategories.includes(item.category)) {
    return "Procedures";
  }

  if (item.category === "Day Care Admissions") {
    return "Day Care Admissions";
  }

  if (item.category === "Lab Services") {
    return "Laboratory";
  }

  if (item.category === "Medication Charges") {
    return "Medication Charges";
  }

  if (item.category === "Consumables Charges") {
    return "Consumable Charges";
  }

  return null;
}

type SectionTone = "operations" | "performance" | "services" | "season" | "yearly" | "insights";

const sectionTones: Record<
  SectionTone,
  {
    panel: string;
    header: string;
    accent: string;
    title: string;
  }
> = {
  operations: {
    panel: "border-[#224770] bg-[#224770]",
    header: "border-white/25",
    accent: "bg-white",
    title: "text-white"
  },
  performance: {
    panel: "border-[#84bc3f] bg-[#84bc3f]",
    header: "border-white/25",
    accent: "bg-white",
    title: "text-white"
  },
  services: {
    panel: "bg-white",
    header: "border-[#efefef]",
    accent: "bg-[#84bc3f]",
    title: "text-[#3f6f18]"
  },
  season: {
    panel: "bg-white",
    header: "border-[#efefef]",
    accent: "bg-[#224770]",
    title: "text-[#224770]"
  },
  yearly: {
    panel: "bg-white",
    header: "border-[#efefef]",
    accent: "bg-[#46484a]",
    title: "text-[#46484a]"
  },
  insights: {
    panel: "bg-white",
    header: "border-[#efefef]",
    accent: "bg-[#0eb6ef]",
    title: "text-[#224770]"
  }
};

function SectionTitle({ title, tone }: { title: string; tone: SectionTone }) {
  const styles = sectionTones[tone];

  return (
    <div className={cn("border-b px-5 py-4", styles.header)}>
      <div className={cn("mb-3 h-1 w-12 rounded-full", styles.accent)} />
      <h2 className={cn("font-semibold", styles.title)}>{title}</h2>
    </div>
  );
}

function DashboardSection({
  title,
  tone,
  children
}: {
  title: string;
  tone: SectionTone;
  children: ReactNode;
}) {
  return (
    <section className={cn("panel overflow-hidden", sectionTones[tone].panel)}>
      <SectionTitle title={title} tone={tone} />
      {children}
    </section>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  warning = false
}: {
  label: string;
  value: string;
  helper?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        warning ? "border-rose-200 bg-rose-50/60" : "border-[#efefef] bg-white"
      ].join(" ")}
    >
      <p className={warning ? "label text-rose-700" : "label text-[#46484a]"}>{label}</p>
      <p className={warning ? "mt-3 break-words text-xl font-bold text-rose-700" : "mt-3 break-words text-xl font-bold text-[#224770]"}>
        {value}
      </p>
      {helper ? <p className="mt-1 text-sm font-medium text-[#46484a]">{helper}</p> : null}
    </div>
  );
}

function PaymentDistributionPanel({
  rows,
  total
}: {
  rows: Array<{
    method: Extract<PaymentMethod, "cash" | "card" | "insurance">;
    amount: number;
  }>;
  total: number;
}) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md md:col-span-2 xl:col-span-3">
      <p className="label text-[#46484a]">Cash / Card / Insurance Distribution</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {rows.map((row) => {
          const percentage = total > 0 ? Math.round((row.amount / total) * 100) : 0;

          return (
            <div key={row.method} className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#224770]">
                  {paymentMethodLabels[row.method]}
                </span>
                <span className="text-sm font-bold text-[#224770]">
                  {usdWhole(row.amount)}
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: paymentDistributionColors[row.method]
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-[#46484a]">{percentage}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardOverview({
  initialDoctors,
  initialServices,
  invoices,
  payouts
}: DashboardOverviewProps) {
  const [doctors, setDoctors] = useState(() => initialDoctors.map(normalizeDoctor));
  const [services, setServices] = useState(initialServices);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(() =>
    normalizeSystemSettings()
  );

  useEffect(() => {
    try {
      const storedDoctors = window.localStorage.getItem(doctorStorageKey);
      if (storedDoctors) {
        const parsed = JSON.parse(storedDoctors);
        if (Array.isArray(parsed)) {
          setDoctors((parsed as Doctor[]).map(normalizeDoctor));
        }
      }

      const storedServices = window.localStorage.getItem(serviceStorageKey);
      if (storedServices) {
        const parsed = JSON.parse(storedServices);
        if (Array.isArray(parsed)) {
          setServices(parsed as Service[]);
        }
      }

      setSystemSettings(loadSystemSettings());
    } catch {
      setSystemSettings(normalizeSystemSettings());
    }
  }, []);

  const today = todayISO();
  const selectedMonth = today.slice(0, 7);
  const paymentSettings = systemSettings.doctorPayment;
  const invoiceCurrencyCode = invoiceCurrency(systemSettings);
  const localCurrencyCode = localCurrency(systemSettings);
  const currentSeason = currentOperatingSeason(today, systemSettings.seasons);
  const comparisonYears = ["2025", "2026"];
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === selectedMonth);
  const todayInvoices = invoices.filter((invoice) => invoice.date === today);
  const currentSeasonInvoices = invoices.filter((invoice) =>
    isWithinSeason(invoice.date, currentSeason)
  );

  const visiblePayouts = useMemo(() => {
    const existingPayoutsById = new Map(payouts.map((payout) => [payout.id, payout]));

    return generatePayoutsForInvoices(invoices, paymentSettings)
      .map((payout) => {
        const existing = existingPayoutsById.get(payout.id);

        return {
          ...payout,
          status: existing?.status ?? payout.status,
          voucherNo: existing?.voucherNo ?? payout.voucherNo
        };
      })
      .filter((payout) => payout.payoutMode !== "pending_shift");
  }, [invoices, paymentSettings, payouts]);

  const monthlyPayouts = visiblePayouts.filter(
    (payout) => monthKey(payout.date) === selectedMonth
  );
  const activeDoctors = doctors.filter((doctor) => doctor.active);
  const activeServices = services.filter((service) => service.active);
  const todayRevenue = todayInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const patientsSeenToday = todayInvoices.length;
  const monthlyRevenue = monthlyInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const currentSeasonRevenue = currentSeasonInvoices.reduce(
    (sum, invoice) => sum + invoiceRevenueAmount(invoice),
    0
  );
  const monthlyPendingPayouts = monthlyPayouts
    .filter((payout) => payout.status === "unpaid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);

  const monthlyServiceSummary = useMemo(() => {
    const totals = new Map<string, { serviceName: string; count: number; revenue: number }>();

    monthlyInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        if (item.lineTotal <= 0) {
          return;
        }

        const current = totals.get(item.serviceName) ?? {
          serviceName: item.serviceName,
          count: 0,
          revenue: 0
        };
        current.count += itemQuantity(item);
        current.revenue += invoiceItemRevenueAmount(invoice, item);
        totals.set(item.serviceName, current);
      });
    });

    return [...totals.values()].sort(
      (a, b) => b.count - a.count || b.revenue - a.revenue
    );
  }, [monthlyInvoices]);

  const currentSeasonSummary = useMemo(() => {
    const totals = new Map<PeriodCategory, { cases: number; revenue: number }>();

    periodCategories.forEach((category) => {
      totals.set(category, { cases: 0, revenue: 0 });
    });

    currentSeasonInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        if (item.lineTotal <= 0) {
          return;
        }

        const category = periodCategoryForItem(item);
        if (!category) {
          return;
        }

        const current = totals.get(category) ?? { cases: 0, revenue: 0 };
        current.cases += itemQuantity(item);
        current.revenue += invoiceItemRevenueAmount(invoice, item);
        totals.set(category, current);
      });
    });

    return periodCategories.map((category) => ({
      category,
      ...(totals.get(category) ?? { cases: 0, revenue: 0 })
    }));
  }, [currentSeasonInvoices]);

  const yearlyComparison = comparisonYears.map((year) => {
    const yearInvoices = invoices.filter((invoice) => invoice.date.startsWith(year));
    const yearItems = yearInvoices.flatMap((invoice) => invoice.items);
    const yearPayouts = visiblePayouts.filter((payout) => payout.date.startsWith(year));

    return {
      year,
      revenue: yearInvoices.reduce((sum, invoice) => sum + invoiceRevenueAmount(invoice), 0),
      newConsultations: yearItems
        .filter(isNewConsultation)
        .reduce((sum, item) => sum + itemQuantity(item), 0),
      doctorPayouts: yearPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0)
    };
  });

  function paymentTotal(method: Extract<PaymentMethod, "cash" | "card" | "insurance">) {
    return monthlyInvoices
      .filter((invoice) => invoice.paymentMethod === method)
      .reduce((sum, invoice) => sum + invoiceRevenueAmount(invoice), 0);
  }

  const averageInvoiceValue = monthlyInvoices.length
    ? monthlyRevenue / monthlyInvoices.length
    : 0;
  const outstandingInsuranceReceivables = invoices
    .filter((invoice) => invoice.paymentMethod === "insurance" && invoice.claimStatus !== "Paid")
    .reduce((sum, invoice) => sum + invoiceRevenueAmount(invoice), 0);
  const paymentDistributionRows = (["cash", "card", "insurance"] as const).map((method) => ({
    method,
    amount: paymentTotal(method)
  }));
  const paymentDistributionTotal = paymentDistributionRows.reduce(
    (sum, row) => sum + row.amount,
    0
  );

  return (
    <div className="space-y-6">
      <DashboardSection title="Operations" tone="operations">
        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="label">Current Payment Mode</p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-[#224770]">
              {paymentModeLabels[paymentSettings.activeModel]}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span
                className={cn(
                  "rounded-full px-3 py-1",
                  paymentSettings.activeModel === paymentModeValues.onCall
                    ? "bg-[#224770] text-white"
                    : "bg-[#efefef] text-[#46484a]"
                )}
              >
                {paymentModeLabels[paymentModeValues.onCall]}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1",
                  paymentSettings.activeModel === paymentModeValues.clinicShift
                    ? "bg-[#224770] text-white"
                    : "bg-[#efefef] text-[#46484a]"
                )}
              >
                {paymentModeLabels[paymentModeValues.clinicShift]}
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold text-[#46484a]">Active system mode</p>
          </div>
          <KpiCard
            label="Active Doctors"
            value={String(activeDoctors.length)}
            tone="primary"
            className="min-h-full"
          />
          <KpiCard
            label="Active Services"
            value={String(activeServices.length)}
            tone="success"
            className="min-h-full"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Business Performance" tone="performance">
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label={currencyLabelParenthetical("Today's Revenue", invoiceCurrencyCode)}
            value={usdWhole(todayRevenue)}
            tone="info"
          />
          <KpiCard label="Patients Seen Today" value={String(patientsSeenToday)} />
          <KpiCard
            label={currencyLabelParenthetical("This Month Revenue", invoiceCurrencyCode)}
            value={usdWhole(monthlyRevenue)}
            tone="success"
          />
          <KpiCard
            label={currencyLabelParenthetical("Current Season Revenue", invoiceCurrencyCode)}
            value={usdWhole(currentSeasonRevenue)}
            helper={`${currentSeason.label}: ${currentSeason.fromDate} to ${currentSeason.toDate}`}
            tone="primary"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Monthly Services Summary" tone="services">
        <div className="overflow-x-auto p-5">
          <div className="flex min-w-full gap-4 pb-1">
            {monthlyServiceSummary.map((item) => (
              <div
                key={item.serviceName}
                className="min-w-[220px] rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-[#224770]">{item.serviceName}</p>
                <p className="mt-4 text-2xl font-bold text-[#224770]">{item.count}</p>
                <p className="mt-3 text-sm font-medium text-[#46484a]">
                  Revenue {usdWhole(item.revenue)}
                </p>
              </div>
            ))}
            {!monthlyServiceSummary.length ? (
              <div className="min-w-[260px] rounded-xl border border-[#efefef] bg-[#efefef] p-5 text-sm font-semibold text-[#46484a]">
                No services with recorded value this month.
              </div>
            ) : null}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Current Season Summary" tone="season">
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {currentSeasonSummary.map((item) => (
            <SummaryCard
              key={item.category}
              label={item.category}
              value={`${item.cases} cases`}
              helper={`Revenue ${usdWhole(item.revenue)}`}
            />
          ))}
        </div>
      </DashboardSection>

      <DashboardSection title="Yearly Summary" tone="yearly">
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Year</th>
                <th className={tableStyles.numericHeaderCell}>
                  {currencyLabelParenthetical("Revenue", invoiceCurrencyCode)}
                </th>
                <th className={tableStyles.numericHeaderCell}>New Consultations</th>
                <th className={tableStyles.numericHeaderCell}>
                  {currencyLabelParenthetical("Doctor Payouts", localCurrencyCode)}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {yearlyComparison.map((item) => (
                <tr key={item.year} className={tableStyles.row}>
                  <td className="px-5 py-4 text-lg font-bold text-[#224770]">{item.year}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(item.revenue)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-[#224770]">
                    {item.newConsultations}
                  </td>
                  <td className={tableStyles.numericCell}>{money(item.doctorPayouts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection title="Business Insights" tone="insights">
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label={currencyLabelParenthetical("Average Invoice Value", invoiceCurrencyCode)}
            value={usdWhole(averageInvoiceValue)}
          />
          <SummaryCard
            label={currencyLabelParenthetical("Pending Doctor Payouts", localCurrencyCode)}
            value={money(monthlyPendingPayouts)}
            warning={monthlyPendingPayouts > 0}
          />
          <SummaryCard
            label={currencyLabelParenthetical(
              "Outstanding Insurance Receivables",
              invoiceCurrencyCode
            )}
            value={usdWhole(outstandingInsuranceReceivables)}
            warning={outstandingInsuranceReceivables > 0}
          />
          <PaymentDistributionPanel
            rows={paymentDistributionRows}
            total={paymentDistributionTotal}
          />
        </div>
      </DashboardSection>
    </div>
  );
}
