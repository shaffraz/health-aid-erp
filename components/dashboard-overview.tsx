"use client";

import { useEffect, useMemo, useState } from "react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { generatePayoutsForInvoices } from "@/lib/calculations";
import {
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, todayISO, usdWhole } from "@/lib/format";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  serviceStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type DoctorPaymentModelType,
  type DoctorPayout,
  type InsuranceReceivable,
  type Invoice,
  type InvoiceItem,
  type PaymentMethod,
  type Service,
  type ServiceCategory
} from "@/lib/types";

type DashboardOverviewProps = {
  initialDoctors: Doctor[];
  initialServices: Service[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
  insuranceReceivables: InsuranceReceivable[];
};

type PeriodCategory =
  | "Consultations"
  | "Procedures"
  | "Day Care"
  | "Laboratory"
  | "Vaccinations"
  | "Home / Hotel Visits"
  | "Other Services";

const paymentModeLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "On-Call Mode",
  peak_season: "Clinic Shift Mode"
};

const paymentMethodLabels: Record<Extract<PaymentMethod, "cash" | "card" | "insurance">, string> = {
  cash: "Cash",
  card: "Card",
  insurance: "Insurance"
};

const periodCategories: PeriodCategory[] = [
  "Consultations",
  "Procedures",
  "Day Care",
  "Laboratory",
  "Vaccinations",
  "Home / Hotel Visits",
  "Other Services"
];

const procedureCategories: ServiceCategory[] = [
  "Procedures",
  "IV Therapy",
  "Wound Care"
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

function periodCategoryForItem(item: InvoiceItem): PeriodCategory {
  const serviceName = item.serviceName.toLowerCase();

  if (item.category === "Consultation") {
    return "Consultations";
  }

  if (procedureCategories.includes(item.category)) {
    return "Procedures";
  }

  if (item.category === "Day Care Admissions") {
    return "Day Care";
  }

  if (item.category === "Lab Services") {
    return "Laboratory";
  }

  if (item.category === "Vaccines / ARV") {
    return "Vaccinations";
  }

  if (serviceName.includes("home") || serviceName.includes("hotel") || serviceName.includes("visit")) {
    return "Home / Hotel Visits";
  }

  return "Other Services";
}

function receivableOutstanding(receivable: InsuranceReceivable) {
  return Math.max(0, receivable.totalBilled - receivable.paidAmount);
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-b border-[#efefef] px-5 py-4">
      <h2 className="font-semibold text-[#224770]">{title}</h2>
    </div>
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

export function DashboardOverview({
  initialDoctors,
  initialServices,
  invoices,
  payouts,
  insuranceReceivables
}: DashboardOverviewProps) {
  const [doctors, setDoctors] = useState(() => initialDoctors.map(normalizeDoctor));
  const [services, setServices] = useState(initialServices);
  const [paymentSettings, setPaymentSettings] = useState<DoctorPaymentModel>(
    defaultDoctorPaymentModel
  );
  const [draftPaymentMode, setDraftPaymentMode] = useState<DoctorPaymentModelType>(
    defaultDoctorPaymentModel.activeModel
  );
  const [hydrated, setHydrated] = useState(false);

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

      const storedPaymentSettings = window.localStorage.getItem(
        doctorPaymentSettingsStorageKey
      );
      if (storedPaymentSettings) {
        const normalizedSettings = normalizeDoctorPaymentModel(JSON.parse(storedPaymentSettings));
        setPaymentSettings(normalizedSettings);
        setDraftPaymentMode(normalizedSettings.activeModel);
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    window.localStorage.setItem(
      doctorPaymentSettingsStorageKey,
      JSON.stringify(paymentSettings)
    );
  }, [hydrated, paymentSettings]);

  const today = todayISO();
  const selectedMonth = today.slice(0, 7);
  const comparisonYears = ["2025", "2026"];
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === selectedMonth);
  const todayInvoices = invoices.filter((invoice) => invoice.date === today);

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
  const todayRevenue = todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const patientsSeenToday = todayInvoices.length;
  const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
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
        current.revenue += item.lineTotal;
        totals.set(item.serviceName, current);
      });
    });

    return [...totals.values()].sort(
      (a, b) => b.count - a.count || b.revenue - a.revenue
    );
  }, [monthlyInvoices]);

  const currentPeriodSummary = useMemo(() => {
    const totals = new Map<PeriodCategory, { cases: number; revenue: number }>();

    periodCategories.forEach((category) => {
      totals.set(category, { cases: 0, revenue: 0 });
    });

    monthlyInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        if (item.lineTotal <= 0) {
          return;
        }

        const category = periodCategoryForItem(item);
        const current = totals.get(category) ?? { cases: 0, revenue: 0 };
        current.cases += itemQuantity(item);
        current.revenue += item.lineTotal;
        totals.set(category, current);
      });
    });

    return periodCategories.map((category) => ({
      category,
      ...(totals.get(category) ?? { cases: 0, revenue: 0 })
    }));
  }, [monthlyInvoices]);

  const yearlyComparison = comparisonYears.map((year) => {
    const yearInvoices = invoices.filter((invoice) => invoice.date.startsWith(year));
    const yearPayouts = visiblePayouts.filter((payout) => payout.date.startsWith(year));

    return {
      year,
      revenue: yearInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      patients: yearInvoices.length,
      doctorPayouts: yearPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0)
    };
  });

  function savePaymentMode() {
    setPaymentSettings((current) =>
      normalizeDoctorPaymentModel({
        ...current,
        activeModel: draftPaymentMode
      })
    );
  }

  function paymentTotal(method: Extract<PaymentMethod, "cash" | "card" | "insurance">) {
    return monthlyInvoices
      .filter((invoice) => invoice.paymentMethod === method)
      .reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  }

  const paymentModeChanged = draftPaymentMode !== paymentSettings.activeModel;
  const highestRevenueService = [...monthlyServiceSummary].sort(
    (a, b) => b.revenue - a.revenue
  )[0];
  const mostUsedService = monthlyServiceSummary[0];
  const averageRevenuePerPatient = monthlyInvoices.length
    ? monthlyRevenue / monthlyInvoices.length
    : 0;
  const insuranceRevenue = paymentTotal("insurance");
  const insuranceShare = monthlyRevenue
    ? Math.round((insuranceRevenue / monthlyRevenue) * 100)
    : 0;
  const outstandingInsuranceReceivables = insuranceReceivables
    .filter((receivable) => receivable.status !== "Paid")
    .reduce((sum, receivable) => sum + receivableOutstanding(receivable), 0);
  const paymentDistribution = (["cash", "card", "insurance"] as const)
    .map((method) => `${paymentMethodLabels[method]} ${usdWhole(paymentTotal(method))}`)
    .join(" / ");

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Operations" />
        <div className="grid gap-4 p-5 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr]">
          <div className="rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <p className="label">Current Payment Mode</p>
            <p className="mt-3 text-2xl font-bold tracking-tight text-[#224770]">
              {paymentModeLabels[paymentSettings.activeModel]}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-[#efefef] px-3 py-1 text-[#46484a]">
                On-Call Mode
              </span>
              <span className="rounded-full bg-[#efefef] px-3 py-1 text-[#46484a]">
                Clinic Shift Mode
              </span>
            </div>
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
          <div className="rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
            <label className="label" htmlFor="dashboard-payment-mode">
              Payment Mode
            </label>
            <select
              id="dashboard-payment-mode"
              value={draftPaymentMode}
              onChange={(event) =>
                setDraftPaymentMode(event.target.value as DoctorPaymentModelType)
              }
              className="field mt-3 min-h-11 border-[#224770]/20 bg-white"
              aria-label="Doctor payment mode"
            >
              <option value="low_season">{paymentModeLabels.low_season}</option>
              <option value="peak_season">{paymentModeLabels.peak_season}</option>
            </select>
            <button
              type="button"
              onClick={savePaymentMode}
              disabled={!paymentModeChanged}
              className={buttonClass(paymentModeChanged ? "primary" : "muted", "mt-3 w-full min-h-11")}
            >
              Save Mode
            </button>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Business Performance" />
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Today's Revenue (USD)" value={usdWhole(todayRevenue)} tone="info" />
          <KpiCard label="Patients Seen Today" value={String(patientsSeenToday)} />
          <KpiCard label="Active Doctors" value={String(activeDoctors.length)} tone="primary" />
          <KpiCard
            label="Pending Doctor Payouts (LKR)"
            value={money(monthlyPendingPayouts)}
            tone="danger"
          />
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Monthly Services Summary" />
        <div className="overflow-x-auto p-5">
          <div className="flex min-w-full gap-4 pb-1">
            {monthlyServiceSummary.map((item) => (
              <div
                key={item.serviceName}
                className="min-w-[220px] rounded-xl border border-[#efefef] bg-white p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm font-semibold text-[#224770]">{item.serviceName}</p>
                <p className="mt-4 text-2xl font-bold text-[#224770]">{item.count}</p>
                <p className="mt-1 text-sm font-medium text-[#46484a]">
                  {usdWhole(item.revenue)}
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
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Current Period Summary" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          {currentPeriodSummary.map((item) => (
            <SummaryCard
              key={item.category}
              label={item.category}
              value={String(item.cases)}
              helper={usdWhole(item.revenue)}
            />
          ))}
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Yearly Performance" />
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Year</th>
                <th className={tableStyles.numericHeaderCell}>Revenue (USD)</th>
                <th className={tableStyles.numericHeaderCell}>Patients</th>
                <th className={tableStyles.numericHeaderCell}>Doctor Payouts (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {yearlyComparison.map((item) => (
                <tr key={item.year} className={tableStyles.row}>
                  <td className="px-5 py-4 text-lg font-bold text-[#224770]">{item.year}</td>
                  <td className={tableStyles.numericCell}>{usdWhole(item.revenue)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-[#224770]">
                    {item.patients}
                  </td>
                  <td className={tableStyles.numericCell}>{money(item.doctorPayouts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Business Insights" />
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            label="Highest Revenue Service This Month"
            value={highestRevenueService?.serviceName ?? "N/A"}
            helper={highestRevenueService ? usdWhole(highestRevenueService.revenue) : undefined}
          />
          <SummaryCard
            label="Most Used Service This Month"
            value={mostUsedService?.serviceName ?? "N/A"}
            helper={mostUsedService ? `${mostUsedService.count} cases` : undefined}
          />
          <SummaryCard
            label="Average Revenue Per Patient"
            value={usdWhole(averageRevenuePerPatient)}
          />
          <SummaryCard
            label="Insurance Share of Revenue"
            value={`${insuranceShare}%`}
            helper={usdWhole(insuranceRevenue)}
          />
          <SummaryCard
            label="Cash / Card / Insurance Distribution"
            value={paymentDistribution}
          />
          <SummaryCard
            label="Outstanding Insurance Receivables"
            value={usdWhole(outstandingInsuranceReceivables)}
            warning={outstandingInsuranceReceivables > 0}
          />
        </div>
      </section>
    </div>
  );
}
