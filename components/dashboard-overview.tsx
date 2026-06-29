"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Settings2,
  Stethoscope,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

type MetricTone = "blue" | "sky" | "green" | "dark";

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

const metricTones: Record<
  MetricTone,
  {
    panel: string;
    icon: string;
    value: string;
  }
> = {
  blue: {
    panel: "border-[#224770]/15 bg-white",
    icon: "bg-[#224770] text-white",
    value: "text-[#224770]"
  },
  sky: {
    panel: "border-[#0eb6ef]/20 bg-white",
    icon: "bg-[#0eb6ef] text-white",
    value: "text-[#224770]"
  },
  green: {
    panel: "border-[#84bc3f]/25 bg-white",
    icon: "bg-[#84bc3f] text-white",
    value: "text-[#224770]"
  },
  dark: {
    panel: "border-[#46484a]/15 bg-white",
    icon: "bg-[#46484a] text-white",
    value: "text-[#46484a]"
  }
};

const serviceCardTones = [
  "border-[#224770]/15 bg-[#224770] text-white",
  "border-[#0eb6ef]/20 bg-white text-[#224770]",
  "border-[#84bc3f]/25 bg-white text-[#224770]",
  "border-[#46484a]/15 bg-[#efefef] text-[#46484a]"
];

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

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "blue"
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  const toneClasses = metricTones[tone];

  return (
    <div className={cn("rounded-xl border p-4 shadow-sm", toneClasses.panel)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#46484a]">
            {label}
          </p>
          <p className={cn("mt-2 text-2xl font-bold tracking-tight", toneClasses.value)}>
            {value}
          </p>
        </div>
        <span className={cn("rounded-lg p-2.5", toneClasses.icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
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
  const roleCounts = [
    ...roleCountsBase.slice(0, 2),
    { label: "Doctor", count: doctors.length },
    roleCountsBase[2]
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
    const procedures = yearItems
      .filter(isProcedureItem)
      .reduce((sum, item) => sum + itemQuantity(item), 0);
    const otherServices = yearItems
      .filter((item) => item.category !== "Consultation" && !isProcedureItem(item))
      .reduce((sum, item) => sum + itemQuantity(item), 0);

    return {
      year,
      totalSales: yearInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0),
      consultations,
      procedures,
      otherServices,
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
        <SectionTitle title="Operations Setup" />
        <div className="grid gap-4 p-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-[#224770]/15 bg-[#efefef] p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#46484a]">
                  Active Doctor Payment Mode
                </p>
                <h3 className="mt-2 text-2xl font-bold text-[#224770]">
                  {paymentModeLabels[paymentSettings.activeModel]}
                </h3>
              </div>
              <div className="flex flex-col gap-2 sm:min-w-72 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    className="text-xs font-semibold uppercase tracking-[0.14em] text-[#46484a]"
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
                    "focus-ring rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition",
                    paymentModeChanged
                      ? "bg-[#224770] hover:bg-[#0eb6ef]"
                      : "bg-[#46484a]/35"
                  )}
                >
                  Save mode
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Active doctors"
              value={String(activeDoctors.length)}
              icon={UsersRound}
              tone="green"
            />
            <StatCard
              label="Active services"
              value={String(activeServices.length)}
              icon={Settings2}
              tone="sky"
            />
          </div>
        </div>
        <div className="border-t border-[#efefef] px-5 pb-5">
          <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {roleCounts.map((role) => (
              <div key={role.label} className="rounded-lg border border-[#efefef] bg-white p-4">
                <p className="text-sm font-semibold text-[#46484a]">{role.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#224770]">{role.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Today's sales"
          value={usd(todaySales)}
          icon={DollarSign}
          tone="sky"
        />
        <StatCard
          label="New consultations today"
          value={String(consultationsToday)}
          icon={CalendarDays}
          tone="green"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden border-[#efefef] bg-white">
          <SectionTitle title="Monthly Services Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {monthlyServiceSummary.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border p-4 shadow-sm",
                  serviceCardTones[index % serviceCardTones.length]
                )}
              >
                <p className="text-sm font-semibold">{item.label}</p>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <p className="text-3xl font-bold">{item.count}</p>
                  <p className="text-sm font-semibold">{usd(item.value)}</p>
                </div>
              </div>
            ))}
            {!monthlyServiceSummary.length ? (
              <div className="rounded-xl border border-[#efefef] bg-[#efefef] p-5 text-sm font-semibold text-[#46484a]">
                No services with recorded value this month.
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel overflow-hidden border-[#efefef] bg-white">
          <SectionTitle title="Season Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <StatCard
              label="New consultations"
              value={String(seasonConsultations)}
              icon={Stethoscope}
              tone="green"
            />
            <StatCard
              label="Total patients"
              value={String(invoices.length)}
              icon={UsersRound}
              tone="sky"
            />
            <StatCard
              label="Procedures"
              value={String(seasonProcedures)}
              icon={ClipboardList}
              tone="blue"
            />
            <StatCard
              label="Other services"
              value={String(seasonOtherServices)}
              icon={Settings2}
              tone="dark"
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
                <th className="px-5 py-3 text-right">Total sales USD</th>
                <th className="px-5 py-3 text-right">New consultations</th>
                <th className="px-5 py-3 text-right">Procedures</th>
                <th className="px-5 py-3 text-right">Other services</th>
                <th className="px-5 py-3 text-right">Doctor payouts LKR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {yearlyComparison.map((item) => (
                <tr key={item.year}>
                  <td className="px-5 py-4 text-lg font-bold text-[#224770]">{item.year}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#224770]">
                    {usd(item.totalSales)}
                  </td>
                  <td className="px-5 py-4 text-right text-[#46484a]">{item.consultations}</td>
                  <td className="px-5 py-4 text-right text-[#46484a]">{item.procedures}</td>
                  <td className="px-5 py-4 text-right text-[#46484a]">{item.otherServices}</td>
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
        <SectionTitle title="Doctor Payouts" />
        <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Monthly payouts paid"
              value={money(monthlyPaidPayouts)}
              icon={Banknote}
              tone="green"
            />
            <StatCard
              label="Pending payouts"
              value={money(monthlyPendingPayouts)}
              icon={CalendarDays}
              tone="blue"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-[#efefef]">
            <div className="bg-[#efefef] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#224770]">Doctor-wise payouts</h3>
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
