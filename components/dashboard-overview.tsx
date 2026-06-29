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
import { money, monthKey, shortDate, todayISO, usd } from "@/lib/format";
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

type DashboardOverviewProps = {
  initialDoctors: Doctor[];
  initialServices: Service[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
};

type MetricTone = "lagoon" | "care" | "amber" | "ink";

const paymentModeLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "Low Season / Per Patient",
  peak_season: "Peak Season / Shift Based"
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

function currentYear() {
  return todayISO().slice(0, 4);
}

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "lagoon"
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: MetricTone;
}) {
  const tones: Record<MetricTone, string> = {
    lagoon: "bg-lagoon-50 text-lagoon-700",
    care: "bg-care-50 text-care-700",
    amber: "bg-amber-50 text-amber-700",
    ink: "bg-slate-100 text-ink"
  };

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
        </div>
        <span className={`rounded-lg p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </div>
  );
}

function SectionTitle({
  title,
  helper
}: {
  title: string;
  helper?: string;
}) {
  return (
    <div className="border-b border-slate-100 px-5 py-4">
      <h2 className="font-semibold text-ink">{title}</h2>
      {helper ? <p className="mt-1 text-sm text-slate-500">{helper}</p> : null}
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
        setPaymentSettings(normalizeDoctorPaymentModel(JSON.parse(storedPaymentSettings)));
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
  const selectedYear = currentYear();
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === selectedMonth);
  const todayInvoices = invoices.filter((invoice) => invoice.date === today);
  const yearlyInvoices = invoices.filter((invoice) => invoice.date.startsWith(selectedYear));

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
  const yearlyPayouts = visiblePayouts.filter((payout) => payout.date.startsWith(selectedYear));

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
  const yearlyItems = yearlyInvoices.flatMap((invoice) => invoice.items);
  const seasonConsultations = seasonItems
    .filter((item) => item.category === "Consultation")
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const seasonProcedures = seasonItems
    .filter(isProcedureItem)
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const seasonOtherServices = seasonItems
    .filter((item) => item.category !== "Consultation" && !isProcedureItem(item))
    .reduce((sum, item) => sum + itemQuantity(item), 0);

  const yearlySales = yearlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const yearlyConsultations = yearlyItems
    .filter((item) => item.category === "Consultation")
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const yearlyProcedures = yearlyItems
    .filter(isProcedureItem)
    .reduce((sum, item) => sum + itemQuantity(item), 0);
  const yearlyServices = yearlyItems.reduce((sum, item) => sum + itemQuantity(item), 0);
  const yearlyDoctorPayouts = yearlyPayouts.reduce(
    (sum, payout) => sum + payout.payoutAmount,
    0
  );

  const monthlyPaidPayouts = monthlyPayouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const monthlyPendingPayouts = monthlyPayouts
    .filter((payout) => payout.status === "unpaid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const pendingByDoctor = doctors
    .map((doctor) => {
      const pending = monthlyPayouts
        .filter((payout) => payout.doctorId === doctor.id && payout.status === "unpaid")
        .reduce((sum, payout) => sum + payout.payoutAmount, 0);

      return { doctor, pending };
    })
    .filter((item) => item.pending > 0)
    .sort((a, b) => b.pending - a.pending);

  function updatePaymentMode(activeModel: DoctorPaymentModelType) {
    setPaymentSettings((current) =>
      normalizeDoctorPaymentModel({
        ...current,
        activeModel
      })
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <SectionTitle
          title="Operations Setup"
          helper="Internal operating mode and active setup counts for the current mock workspace."
        />
        <div className="grid gap-4 p-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="label">Active payment mode</p>
                <h3 className="mt-2 text-xl font-bold text-ink">
                  {paymentModeLabels[paymentSettings.activeModel]}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Invoice POS uses this global setting for doctor payout generation.
                </p>
              </div>
              <div className="min-w-64">
                <label className="label" htmlFor="dashboard-payment-mode">
                  Change mode
                </label>
                <select
                  id="dashboard-payment-mode"
                  value={paymentSettings.activeModel}
                  onChange={(event) =>
                    updatePaymentMode(event.target.value as DoctorPaymentModelType)
                  }
                  className="field mt-2"
                >
                  <option value="low_season">{paymentModeLabels.low_season}</option>
                  <option value="peak_season">{paymentModeLabels.peak_season}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard
              label="Active doctors"
              value={String(activeDoctors.length)}
              helper={`${doctors.length} doctors in directory`}
              icon={UsersRound}
              tone="care"
            />
            <StatCard
              label="Active services"
              value={String(activeServices.length)}
              helper={`${services.length} services in catalog`}
              icon={Settings2}
              tone="lagoon"
            />
          </div>
        </div>
        <div className="border-t border-slate-100 px-5 pb-5">
          <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-4">
            {roleCounts.map((role) => (
              <div key={role.label} className="rounded-lg border border-slate-100 bg-white p-4">
                <p className="text-sm font-medium text-slate-500">{role.label}</p>
                <p className="mt-2 text-2xl font-bold text-ink">{role.count}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <StatCard
          label="Today's sales"
          value={usd(todaySales)}
          helper="Patient income, billed in USD"
          icon={DollarSign}
          tone="lagoon"
        />
        <StatCard
          label="New consultations today"
          value={String(consultationsToday)}
          helper={`${todayInvoices.length} invoices created today`}
          icon={CalendarDays}
          tone="care"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden">
          <SectionTitle
            title="Monthly Service Summary"
            helper={`Only non-zero service activity for ${selectedMonth}.`}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3 text-right">Count</th>
                  <th className="px-5 py-3 text-right">Sales USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlyServiceSummary.map((item) => (
                  <tr key={item.label}>
                    <td className="px-5 py-4 font-semibold text-ink">{item.label}</td>
                    <td className="px-5 py-4 text-right text-slate-600">{item.count}</td>
                    <td className="px-5 py-4 text-right font-bold text-lagoon-700">
                      {usd(item.value)}
                    </td>
                  </tr>
                ))}
                {!monthlyServiceSummary.length ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-500">
                      No non-zero service activity for this month.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel overflow-hidden">
          <SectionTitle title="Season Summary" helper="Current mock season activity." />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <StatCard
              label="New consultations"
              value={String(seasonConsultations)}
              icon={Stethoscope}
              tone="care"
            />
            <StatCard
              label="Total patients"
              value={String(invoices.length)}
              icon={UsersRound}
              tone="lagoon"
            />
            <StatCard
              label="Procedures"
              value={String(seasonProcedures)}
              icon={ClipboardList}
              tone="amber"
            />
            <StatCard
              label="Other services"
              value={String(seasonOtherServices)}
              icon={Settings2}
              tone="ink"
            />
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <SectionTitle title="Yearly Summary" helper={`Performance totals for ${selectedYear}.`} />
        <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total sales"
            value={usd(yearlySales)}
            helper="Patient income in USD"
            icon={DollarSign}
            tone="lagoon"
          />
          <StatCard
            label="Consultations"
            value={String(yearlyConsultations)}
            icon={Stethoscope}
            tone="care"
          />
          <StatCard
            label="Procedures"
            value={String(yearlyProcedures)}
            icon={ClipboardList}
            tone="amber"
          />
          <StatCard
            label="Total services"
            value={String(yearlyServices)}
            icon={Settings2}
            tone="ink"
          />
          <StatCard
            label="Doctor payouts"
            value={money(yearlyDoctorPayouts)}
            helper="Internal payout liability in LKR"
            icon={Banknote}
            tone="care"
          />
        </div>
      </section>

      <section className="panel overflow-hidden">
        <SectionTitle
          title="Doctor Payouts"
          helper="Monthly payout controls and unpaid doctor-wise exposure in LKR."
        />
        <div className="grid gap-4 p-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <StatCard
              label="Payouts done"
              value={money(monthlyPaidPayouts)}
              helper={`Paid in ${selectedMonth}`}
              icon={Banknote}
              tone="care"
            />
            <StatCard
              label="Pending payout"
              value={money(monthlyPendingPayouts)}
              helper="Unpaid doctor payout amount"
              icon={CalendarDays}
              tone="amber"
            />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <div className="bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">Pending payouts doctor-wise</h3>
            </div>
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-white text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Doctor</th>
                  <th className="px-4 py-3">Last payout date</th>
                  <th className="px-4 py-3 text-right">Pending LKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingByDoctor.map(({ doctor, pending }) => {
                  const lastPaid = visiblePayouts
                    .filter((payout) => payout.doctorId === doctor.id && payout.status === "paid")
                    .sort((a, b) => b.date.localeCompare(a.date))[0];

                  return (
                    <tr key={doctor.id}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink">{doctor.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{doctor.designation}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                        {lastPaid ? shortDate(lastPaid.date) : "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-amber-700">
                        {money(pending)}
                      </td>
                    </tr>
                  );
                })}
                {!pendingByDoctor.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                      No pending doctor payouts for this month.
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
