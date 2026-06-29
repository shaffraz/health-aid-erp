"use client";

import { useEffect, useMemo, useState } from "react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { generatePayoutsForInvoices } from "@/lib/calculations";
import {
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, todayISO, usd } from "@/lib/format";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type DoctorPaymentModelType,
  type DoctorPayout,
  type Invoice,
  type InvoiceItem,
  type ServiceCategory
} from "@/lib/types";

type DashboardOverviewProps = {
  initialDoctors: Doctor[];
  invoices: Invoice[];
  payouts: DoctorPayout[];
};

const paymentModeLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "On-Call Mode",
  peak_season: "Clinic Shift Mode"
};

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

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="border-b border-[#efefef] px-5 py-4">
      <h2 className="font-semibold text-[#224770]">{title}</h2>
    </div>
  );
}

export function DashboardOverview({
  initialDoctors,
  invoices,
  payouts
}: DashboardOverviewProps) {
  const [doctors, setDoctors] = useState(() => initialDoctors.map(normalizeDoctor));
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
        <SectionTitle title="Operations Control" />
        <div className="p-6">
          <div className="rounded-xl border border-[#efefef] bg-white p-6 shadow-sm">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#46484a]">
                  Doctor Payment Mode
                </p>
                <p className="mt-3 text-4xl font-bold tracking-tight text-[#224770]">
                  {paymentModeLabels[paymentSettings.activeModel]}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  id="dashboard-payment-mode"
                  value={draftPaymentMode}
                  onChange={(event) =>
                    setDraftPaymentMode(event.target.value as DoctorPaymentModelType)
                  }
                  className="field min-h-11 flex-1 border-[#224770]/20 bg-white"
                  aria-label="Doctor payment mode"
                >
                  <option value="low_season">{paymentModeLabels.low_season}</option>
                  <option value="peak_season">{paymentModeLabels.peak_season}</option>
                </select>
                <button
                  type="button"
                  onClick={savePaymentMode}
                  disabled={!paymentModeChanged}
                  className={buttonClass(paymentModeChanged ? "primary" : "muted", "min-h-11")}
                >
                  Save Payment Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Business Performance" />
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Today's Sales (USD)" value={usd(todaySales)} tone="info" />
          <KpiCard label="New Consultations Today" value={String(consultationsToday)} />
          <KpiCard label="Active Doctors" value={String(activeDoctors.length)} tone="primary" />
          <KpiCard
            label="Pending Doctor Payouts (LKR)"
            value={money(monthlyPendingPayouts)}
            tone="danger"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden border-[#efefef] bg-white">
          <SectionTitle title="Monthly Services Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {monthlyServiceSummary.map((item) => (
              <KpiCard
                key={item.label}
                label={item.label}
                value={String(item.count)}
                helper={usd(item.value)}
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
          <SectionTitle title="Operational Summary" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <KpiCard
              label="New consultations"
              value={String(seasonConsultations)}
            />
            <KpiCard
              label="Total patients"
              value={String(invoices.length)}
            />
            <KpiCard
              label="Procedures"
              value={String(seasonProcedures)}
            />
            <KpiCard
              label="Other services"
              value={String(seasonOtherServices)}
            />
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden border-[#efefef] bg-white">
        <SectionTitle title="Yearly Summary" />
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Year</th>
                <th className={tableStyles.numericHeaderCell}>New consultations</th>
                <th className={tableStyles.numericHeaderCell}>Total Sales (USD)</th>
                <th className={tableStyles.numericHeaderCell}>Total Doctor Payouts (LKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {yearlyComparison.map((item) => (
                <tr key={item.year} className={tableStyles.row}>
                  <td className="px-5 py-4 text-lg font-bold text-[#224770]">{item.year}</td>
                  <td className="px-5 py-4 text-right text-[#46484a]">{item.consultations}</td>
                  <td className={tableStyles.numericCell}>
                    {usd(item.totalSales)}
                  </td>
                  <td className={tableStyles.numericCell}>
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
        <div className="p-5">
          <div className="overflow-hidden rounded-xl border border-[#efefef]">
            <div className="bg-[#efefef] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#224770]">Doctor Payout Summary</h3>
            </div>
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Doctor</th>
                  <th className={tableStyles.numericHeaderCell}>Pending LKR</th>
                  <th className={tableStyles.numericHeaderCell}>Paid this month LKR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {payoutsByDoctor.map(({ doctor, pending, paid }) => (
                  <tr key={doctor.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>
                      <p className="font-semibold text-[#224770]">{doctor.name}</p>
                    </td>
                    <td className={tableStyles.numericCell}>
                      {money(pending)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-[#46484a]">
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
