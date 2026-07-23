"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { tableStyles } from "@/components/erp-ui";
import {
  generatePayoutsForInvoices,
  invoiceItemRevenueAmount,
  invoiceRevenueAmount
} from "@/lib/calculations";
import { money, monthKey, todayISO, usdWhole } from "@/lib/format";
import {
  currencyLabelParenthetical,
  invoiceCurrency,
  localCurrency,
  paymentModeLabels
} from "@/lib/settings";
import { useSystemSettings } from "@/lib/use-system-settings";
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
    title: string;
    eyebrow: string;
  }
> = {
  operations: {
    panel: "border-[#224770]/20 bg-white",
    header: "border-[#224770]/15 bg-[#224770]",
    title: "text-white",
    eyebrow: "bg-white/90"
  },
  performance: {
    panel: "border-[#84bc3f]/25 bg-white",
    header: "border-[#84bc3f]/15 bg-[#84bc3f]",
    title: "text-white",
    eyebrow: "bg-white/90"
  },
  services: {
    panel: "border-[#0eb6ef]/20 bg-white",
    header: "border-[#0eb6ef]/15 bg-[#0eb6ef]",
    title: "text-white",
    eyebrow: "bg-white/90"
  },
  season: {
    panel: "border-[#224770]/20 bg-white",
    header: "border-[#224770]/15 bg-[#224770]",
    title: "text-white",
    eyebrow: "bg-white/90"
  },
  yearly: {
    panel: "border-[#46484a]/20 bg-white",
    header: "border-[#46484a]/15 bg-[#46484a]",
    title: "text-white",
    eyebrow: "bg-white/90"
  },
  insights: {
    panel: "border-[#0eb6ef]/20 bg-white",
    header: "border-[#0eb6ef]/15 bg-[#0eb6ef]",
    title: "text-white",
    eyebrow: "bg-white/90"
  }
};

function SectionTitle({ title, tone }: { title: string; tone: SectionTone }) {
  const styles = sectionTones[tone];

  return (
    <div className={cn("border-b px-5 py-3.5", styles.header)}>
      <div className="flex items-center gap-3">
        <span className={cn("h-1.5 w-9 rounded-full", styles.eyebrow)} aria-hidden="true" />
        <h2 className={cn("text-sm font-semibold tracking-tight md:text-base", styles.title)}>
          {title}
        </h2>
      </div>
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
    <section className={cn("overflow-hidden rounded-xl border shadow-sm", sectionTones[tone].panel)}>
      <SectionTitle title={title} tone={tone} />
      {children}
    </section>
  );
}

type CardTone = "default" | "primary" | "info" | "success" | "warning";

const cardToneStyles: Record<
  CardTone,
  {
    border: string;
    value: string;
    badge: string;
  }
> = {
  default: {
    border: "border-[#efefef]",
    value: "text-[#224770]",
    badge: "bg-[#efefef] text-[#46484a]"
  },
  primary: {
    border: "border-[#224770]/22",
    value: "text-[#224770]",
    badge: "bg-[#224770] text-white"
  },
  info: {
    border: "border-[#0eb6ef]/28",
    value: "text-[#224770]",
    badge: "bg-[#0eb6ef] text-white"
  },
  success: {
    border: "border-[#84bc3f]/35",
    value: "text-[#224770]",
    badge: "bg-[#84bc3f] text-white"
  },
  warning: {
    border: "border-[#46484a]/25",
    value: "text-[#224770]",
    badge: "bg-[#efefef] text-[#46484a]"
  }
};

function DashboardCard({
  label,
  value,
  badge,
  helper,
  tone = "default",
  compact = false,
  className
}: {
  label: string;
  value: string;
  badge?: string;
  helper?: string;
  tone?: CardTone;
  compact?: boolean;
  className?: string;
}) {
  const styles = cardToneStyles[tone];

  return (
    <div
      className={cn(
        "flex min-h-[116px] flex-col justify-between rounded-lg border bg-white p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md md:p-5",
        compact && "min-h-[104px]",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="label text-[#46484a]">{label}</p>
        {badge ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
              styles.badge
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div>
        <p className={cn("mt-3 break-words text-2xl font-bold tracking-tight", styles.value)}>
          {value}
        </p>
        {helper ? <p className="mt-1 text-sm font-medium text-[#46484a]">{helper}</p> : null}
      </div>
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
    <div className="rounded-lg border border-[#efefef] bg-white p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md md:col-span-2 md:p-5 xl:col-span-3">
      <p className="label text-[#46484a]">Cash / Card / Insurance Distribution</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {rows.map((row) => {
          const percentage = total > 0 ? Math.round((row.amount / total) * 100) : 0;

          return (
            <div key={row.method} className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-3.5">
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
  const systemSettings = useSystemSettings();
  const activePaymentMode = systemSettings.operational.activePaymentMode;

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

    } catch {
      // Keep bundled demo data when local storage is unavailable.
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

    return generatePayoutsForInvoices(invoices, paymentSettings, activePaymentMode)
      .map((payout) => {
        const existing = existingPayoutsById.get(payout.id);

        return {
          ...payout,
          status: existing?.status ?? payout.status,
          voucherNo: existing?.voucherNo ?? payout.voucherNo
        };
      })
      .filter((payout) => payout.payoutMode !== "pending_shift");
  }, [activePaymentMode, invoices, paymentSettings, payouts]);

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
    <div className="space-y-5">
      <DashboardSection title="Operations" tone="operations">
        <div className="grid gap-4 p-4 md:grid-cols-[1.35fr_1fr_1fr] md:p-5">
          <DashboardCard
            label="Active Doctor Payment Mode"
            value={paymentModeLabels[activePaymentMode]}
            badge="Settings"
            tone="primary"
            compact
          />
          <DashboardCard
            label="Active Doctors"
            value={String(activeDoctors.length)}
            tone="default"
            compact
          />
          <DashboardCard
            label="Active Services"
            value={String(activeServices.length)}
            tone="success"
            compact
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Business Performance" tone="performance">
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-4">
          <DashboardCard
            label={currencyLabelParenthetical("Today's Revenue", invoiceCurrencyCode)}
            value={usdWhole(todayRevenue)}
            tone="info"
          />
          <DashboardCard label="Patients Seen Today" value={String(patientsSeenToday)} />
          <DashboardCard
            label={currencyLabelParenthetical("This Month Revenue", invoiceCurrencyCode)}
            value={usdWhole(monthlyRevenue)}
            tone="success"
          />
          <DashboardCard
            label={currencyLabelParenthetical("Current Season Revenue", invoiceCurrencyCode)}
            value={usdWhole(currentSeasonRevenue)}
            tone="primary"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Monthly Services Summary" tone="services">
        <div className="overflow-x-auto p-4 md:p-5">
          <div className="flex min-w-full gap-3 pb-1 md:gap-4">
            {monthlyServiceSummary.map((item) => (
              <div
                key={item.serviceName}
                className="flex min-h-[128px] w-full min-w-[190px] max-w-[240px] flex-col justify-between rounded-lg border border-[#efefef] bg-white p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="line-clamp-2 text-sm font-semibold leading-5 text-[#224770]">
                  {item.serviceName}
                </p>
                <div>
                  <p className="text-2xl font-bold text-[#224770]">{item.count}</p>
                  <p className="mt-1 text-sm font-medium text-[#46484a]">
                    Revenue {usdWhole(item.revenue)}
                  </p>
                </div>
              </div>
            ))}
            {!monthlyServiceSummary.length ? (
              <div className="w-full min-w-[260px] rounded-lg border border-[#efefef] bg-[#efefef] p-5 text-sm font-semibold text-[#46484a]">
                No services with recorded value this month.
              </div>
            ) : null}
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Current Season Summary" tone="season">
        <div className="grid gap-4 p-4 sm:grid-cols-2 md:p-5 xl:grid-cols-4">
          {currentSeasonSummary.map((item) => (
            <DashboardCard
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
        <div className="grid gap-4 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
          <DashboardCard
            label={currencyLabelParenthetical("Average Invoice Value", invoiceCurrencyCode)}
            value={usdWhole(averageInvoiceValue)}
          />
          <DashboardCard
            label={currencyLabelParenthetical("Pending Doctor Payouts", localCurrencyCode)}
            value={money(monthlyPendingPayouts)}
            tone={monthlyPendingPayouts > 0 ? "warning" : "default"}
          />
          <DashboardCard
            label={currencyLabelParenthetical(
              "Outstanding Insurance Receivables",
              invoiceCurrencyCode
            )}
            value={usdWhole(outstandingInsuranceReceivables)}
            tone={outstandingInsuranceReceivables > 0 ? "warning" : "default"}
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
