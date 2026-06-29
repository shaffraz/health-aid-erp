"use client";

import { useEffect, useMemo, useState } from "react";
import { generatePayoutsForInvoices } from "@/lib/calculations";
import {
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, todayISO, usd } from "@/lib/format";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  serviceStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type DoctorPaymentModelType,
  type DoctorPayout,
  type Invoice,
  type InvoiceItem,
  type Service,
  type ServiceCategory
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardOverviewProps = {
  initialDoctors: Doctor[];
  initialServices: Service[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
};

type CardVariant = "default" | "muted" | "blue" | "sky" | "green";

const paymentModeLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "Low Season",
  peak_season: "Peak Season"
};

const roleCountsBase = [
  { label: "Admin", count: 1 },
  { label: "Staff", count: 2 },
  { label: "Accountant", count: 1 }
];

const clinicalProcedureCategories: ServiceCategory[] = [
  "Procedures",
  "IV Therapy",
  "Wound Care",
  "Vaccines / ARV"
];

const monthlyServiceLabels = [
  "New consultations",
  "Reviews",
  "Day care admissions",
  "Suturing",
  "IV normal saline infusion",
  "ARV injections",
  "Wound dressing",
  "Lab services"
] as const;

type MonthlyServiceLabel = (typeof monthlyServiceLabels)[number];

const cardVariants: Record<
  CardVariant,
  {
    panel: string;
    label: string;
    value: string;
    detail: string;
  }
> = {
  default: {
    panel: "border-[#efefef] bg-white",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    detail: "text-[#46484a]"
  },
  muted: {
    panel: "border-[#efefef] bg-[#efefef]",
    label: "text-[#46484a]",
    value: "text-[#224770]",
    detail: "text-[#46484a]"
  },
  blue: {
    panel: "border-[#224770] bg-[#224770]",
    label: "text-white/80",
    value: "text-white",
    detail: "text-white/85"
  },
  sky: {
    panel: "border-[#0eb6ef] bg-[#0eb6ef]",
    label: "text-white/85",
    value: "text-white",
    detail: "text-white/90"
  },
  green: {
    panel: "border-[#84bc3f] bg-[#84bc3f]",
    label: "text-white/85",
    value: "text-white",
    detail: "text-white/90"
  }
};

function normalizeDoctor(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? ""
  };
}

function serviceMetricLabel(item: InvoiceItem): MonthlyServiceLabel | null {
  const serviceName = item.serviceName.toLowerCase();

  if (item.category === "Consultation") {
    return serviceName.includes("review") ? "Reviews" : "New consultations";
  }

  if (item.category === "Day Care Admissions") {
    return "Day care admissions";
  }

  if (serviceName.includes("sutur")) {
    return "Suturing";
  }

  if (item.category === "IV Therapy") {
    return "IV normal saline infusion";
  }

  if (item.category === "Vaccines / ARV") {
    return "ARV injections";
  }

  if (item.category === "Wound Care") {
    return "Wound dressing";
  }

  if (item.category === "Lab Services") {
    return "Lab services";
  }

  return null;
}

function isProcedureItem(item: InvoiceItem) {
  return clinicalProcedureCategories.includes(item.category);
}

function itemQuantity(item: InvoiceItem) {
  return Math.max(1, item.quantity);
}

function SummaryCard({
  label,
  value,
  detail,
  variant = "default"
}: {
  label: string;
  value: string;
  detail?: string;
  variant?: CardVariant;
}) {
  const styles = cardVariants[variant];

  return (
    <div
      className={cn(
        "group min-h-32 rounded-xl border p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md",
        styles.panel
      )}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <p className={cn("text-xs font-semibold uppercase tracking-[0.14em]", styles.label)}>
          {label}
        </p>
        <div>
          <p className={cn("text-2xl font-bold tracking-tight", styles.value)}>{value}</p>
          {detail ? (
            <p className={cn("mt-1 text-sm font-semibold", styles.detail)}>{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-b border-[#efefef] px-5 py-4">
      <h2 className="font-semibold text-[#224770]">{title}</h2>
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
  const teamDirectory = [
    { label: "Administrators", count: roleCountsBase[0].count },
    { label: "Doctors", count: doctors.length },
    { label: "Staff", count: roleCountsBase[1].count },
    { label: "Accountants", count: roleCountsBase[2].count }
  ];

  const todaySales = todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const consultationsToday = todayInvoices.reduce(
    (sum, invoice) =>
      sum +
      invoice.items
        .filter((item) => item.category === "Consultation")
        .reduce((itemSum, item) => itemSum + itemQuantity(item), 0),
    0
  );

  const monthlyServiceSummary = useMemo(() => {
    const totals = new Map<MonthlyServiceLabel, { count: number; value: number }>();

    monthlyInvoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        const label = serviceMetricLabel(item);

        if (!label || item.lineTotal <= 0) {
          return;
        }

        const current = totals.get(label) ?? { count: 0, value: 0 };
        current.count += itemQuantity(item);
        current.value += item.lineTotal;
        totals.set(label, current);
      });
    });

    return monthlyServiceLabels
      .map((label) => ({ label, ...(totals.get(label) ?? { count: 0, value: 0 }) }))
      .filter((item) => item.value > 0);
  }, [monthlyInvoices]);

  const seasonItems = invoices.flatMap((invoice) => invoice.items);
  const seasonConsultations = seasonItems
    .filter((item) => item.category === "Consultation")
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const seasonProcedures = seasonItems
    .filter(isProcedureItem)
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const seasonOtherServices = seasonItems
    .filter((item) => item.category !== "Consultation" && !isProcedureItem(item))
    .reduce((sum, item) => sum + itemQuantity(item), 0);

  const yearlyComparison = comparisonYears.map((year) => {
    const yearInvoices = invoices.filter((invoice) => invoice.date.startsWith(year));
    const yearItems = yearInvoices.flatMap((invoice) => invoice.items);
    const yearPayouts = visiblePayouts.filter((payout) => payout.date.startsWith(year));
    const consultations = yearItems
      .filter((item) => item.category === "Consultation")
      .reduce((sum, item) => sum + itemQuantity(item), 0);

    return {
      year,
      totalSales: yearInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      consultations,
      doctorPayouts: yearPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0)
    };
  });

  const monthlyPaidPayouts = monthlyPayouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const monthlyPendingPayouts = monthlyPayouts
    .filter((payout) => payout.status === "unpaid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const payoutsByDoctor = doctors
    .map((doctor) => {
      const doctorMonthlyPayouts = monthlyPayouts.filter(
        (payout) => payout.doctorId === doctor.id
      );
      const pending = doctorMonthlyPayouts
        .filter((payout) => payout.status === "unpaid")
        .reduce((sum, payout) => sum + payout.payoutAmount, 0);
      const paid = doctorMonthlyPayouts
        .filter((payout) => payout.status === "paid")
        .reduce((sum, payout) => sum + payout.payoutAmount, 0);

      return { doctor, pending, paid };
    })
    .filter((item) => item.pending > 0 || item.paid > 0)
    .sort((a, b) => b.pending + b.paid - (a.pending + a.paid));

  function savePaymentMode() {
    setPaymentSettings((current) =>
      normalizeDoctorPaymentModel({
        ...current,
        activeModel: draftPaymentMode
      })
    );
  }

  const paymentModeChanged = draftPaymentMode !== paymentSettings.activeModel;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Operating Control" />
        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)]">
            <div className="min-h-32 rounded-xl border border-[#224770] bg-[#224770] p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80">
                    Active Operating Mode
                  </p>
                  <h3 className="mt-2 text-2xl font-bold text-white">
                    {paymentModeLabels[paymentSettings.activeModel]}
                  </h3>
                </div>
                <div className="flex flex-col gap-2 sm:min-w-72 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      className="text-xs font-semibold uppercase tracking-[0.14em] text-white/80"
                      htmlFor="dashboard-payment-mode"
                    >
                      Select mode
                    </label>
                    <select
                      id="dashboard-payment-mode"
                      value={draftPaymentMode}
                      onChange={(event) =>
                        setDraftPaymentMode(event.target.value as DoctorPaymentModelType)
                      }
                      className="field mt-2 border-[#224770]/20 bg-white"
                    >
                      <option value="low_season">{paymentModeLabels.low_season}</option>
                      <option value="peak_season">{paymentModeLabels.peak_season}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={savePaymentMode}
                    disabled={!paymentModeChanged}
                    className={cn(
                      "focus-ring rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                      paymentModeChanged
                        ? "bg-white text-[#224770] hover:bg-[#efefef]"
                        : "bg-white/35 text-white/70"
                    )}
                  >
                    Save mode
                  </button>
                </div>
              </div>
            </div>

            <SummaryCard
              label="Active doctors"
              value={String(activeDoctors.length)}
            />
            <SummaryCard
              label="Active services"
              value={String(activeServices.length)}
            />
          </div>

          <div className="rounded-xl border border-[#efefef] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#46484a]">
              Team Directory
            </p>
            <div className="mt-4 space-y-3">
              {teamDirectory.map((memberGroup) => (
                <div key={memberGroup.label} className="flex items-center gap-3 text-sm">
                  <span className="font-medium text-[#46484a]">{memberGroup.label}</span>
                  <span className="min-w-4 flex-1 border-b border-dotted border-[#cfd3d6]" />
                  <span className="font-bold text-[#224770]">{memberGroup.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Today's Summary" />
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <SummaryCard
            label="Today's sales"
            value={usd(todaySales)}
            variant="sky"
          />
          <SummaryCard
            label="New consultations today"
            value={String(consultationsToday)}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden border-[#efefef] bg-white">
          <SectionTitle title="Monthly Services Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {monthlyServiceSummary.map((item) => (
              <SummaryCard
                key={item.label}
                label={item.label}
                value={String(item.count)}
                detail={usd(item.value)}
              />
            ))}
            {!monthlyServiceSummary.length ? (
              <div className="rounded-xl border border-[#efefef] bg-[#efefef] p-5 text-sm font-semibold text-[#46484a] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md">
                No services with recorded value this month.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel overflow-hidden border-[#efefef] bg-white">
          <SectionTitle title="Season Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <SummaryCard
              label="New consultations"
              value={String(seasonConsultations)}
            />
            <SummaryCard
              label="Total patients"
              value={String(invoices.length)}
            />
            <SummaryCard
              label="Procedures"
              value={String(seasonProcedures)}
            />
            <SummaryCard
              label="Other services"
              value={String(seasonOtherServices)}
            />
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Yearly Summary" />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#efefef] text-sm">
            <thead className="bg-[#efefef] text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a]">
              <tr>
                <th className="px-5 py-3">Year</th>
                <th className="px-5 py-3 text-right">New consultations</th>
                <th className="px-5 py-3 text-right">Total Sales (USD)</th>
                <th className="px-5 py-3 text-right">Total Doctor Payouts (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {yearlyComparison.map((item) => (
                <tr key={item.year}>
                  <td className="px-5 py-4 text-lg font-bold text-[#224770]">{item.year}</td>
                  <td className="px-5 py-4 text-right text-[#46484a]">{item.consultations}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#224770]">
                    {usd(item.totalSales)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#224770]">
                    {money(item.doctorPayouts)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Doctor Payout Summary" />
        <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <SummaryCard
              label="Monthly payouts paid"
              value={money(monthlyPaidPayouts)}
            />
            <SummaryCard
              label="Pending Doctor Payouts"
              value={money(monthlyPendingPayouts)}
              variant="green"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-[#efefef]">
            <div className="bg-[#efefef] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#224770]">Doctor Payout Summary</h3>
            </div>
            <table className="min-w-full divide-y divide-[#efefef] text-sm">
              <thead className="bg-white text-left text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a]">
                <tr>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3 text-right">Pending LKR</th>
                  <th className="px-4 py-3 text-right">Paid this month LKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {payoutsByDoctor.map(({ doctor, pending, paid }) => (
                  <tr key={doctor.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#224770]">{doctor.name}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-[#224770]">
                      {money(pending)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#46484a]">
                      {money(paid)}
                    </td>
                  </tr>
                ))}
                {!payoutsByDoctor.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm font-semibold text-[#46484a]">
                      No doctor payout records for this month.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
