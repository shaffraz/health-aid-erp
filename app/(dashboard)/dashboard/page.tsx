import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  ReceiptText,
  Stethoscope
} from "lucide-react";
import Link from "next/link";
import { MetricCard } from "@/components/metric-card";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { demoSettings } from "@/lib/demo-data";
import { convertLkrToUsd, money, todayISO, usd } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";

export default async function DashboardPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);
  const today = todayISO();
  const visiblePayouts =
    user.role === "doctor"
      ? data.payouts.filter((payout) => payout.doctorId === user.doctorId)
      : data.payouts;
  const todayInvoices = user.role === "doctor" ? [] : data.invoices.filter((invoice) => invoice.date === today);
  const todaySales = todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const todayDoctorEarnings = visiblePayouts
    .filter((payout) => payout.date === today)
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const unpaidPayouts = visiblePayouts
    .filter((payout) => payout.status === "unpaid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const paidPayouts = visiblePayouts
    .filter((payout) => payout.status === "paid")
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);

  const recentInvoices = user.role === "doctor" ? [] : data.invoices.slice(0, 5);
  const recentPayouts = visiblePayouts.slice(0, 5);
  const invoiceUsd = (value: number) =>
    usd(convertLkrToUsd(value, demoSettings.exchangeRateLkrPerUsd));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Command center"
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="A secure operational snapshot for Health Aid Arugambay, covering POS sales, doctor payout exposure, and today's clinical revenue."
        action={
          hasPermission(user.role, "createInvoices") ? (
            <Link
              href="/invoices/new"
              className="focus-ring inline-flex items-center justify-center rounded-lg bg-lagoon-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-lagoon-700"
            >
              New invoice
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={user.role === "doctor" ? "Today's earnings" : "Today's sales"}
          value={user.role === "doctor" ? money(todayDoctorEarnings) : invoiceUsd(todaySales)}
          helper={
            user.role === "doctor"
              ? "Private earning records generated from invoices"
              : `${todayInvoices.length} invoices created today`
          }
          icon={CalendarDays}
          tone="lagoon"
        />
        <MetricCard
          label="Open doctor payouts"
          value={money(unpaidPayouts)}
          helper="Generated automatically from invoice services"
          icon={Stethoscope}
          tone="care"
        />
        <MetricCard
          label="Paid doctor payouts"
          value={money(paidPayouts)}
          helper="Voucher controlled disbursements"
          icon={CreditCard}
          tone="amber"
        />
        <MetricCard
          label="Active services"
          value={String(data.services.filter((service) => service.active).length)}
          helper={`${data.doctors.filter((doctor) => doctor.active).length} active doctors configured`}
          icon={ClipboardCheck}
          tone="ink"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-base font-semibold text-ink">
              {user.role === "doctor" ? "Privacy mode" : "Recent invoices"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {user.role === "doctor"
                ? "Doctors use the earnings portal and do not receive patient invoice registers."
                : "Patient details stay invoice-scoped in this MVP."}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Patient</th>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.length ? recentInvoices.map((invoice) => {
                  const doctor = data.doctors.find((candidate) => candidate.id === invoice.doctorId);

                  return (
                    <tr key={invoice.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">{invoice.invoiceNo}</td>
                      <td className="px-5 py-4 text-slate-600">{invoice.patientName}</td>
                      <td className="px-5 py-4 text-slate-600">{doctor?.name ?? "Unassigned"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                        {invoiceUsd(invoice.totalAmount)}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td className="px-5 py-8 text-center text-sm text-slate-500" colSpan={4}>
                      No invoice register is visible for this role.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-ink">Payout queue</h2>
              <p className="mt-1 text-sm text-slate-500">Invoice-wise doctor earnings generated by rule priority.</p>
            </div>
            <Banknote className="h-5 w-5 text-care-600" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {recentPayouts.map((payout) => {
              const doctor = data.doctors.find((candidate) => candidate.id === payout.doctorId);

              return (
                <div key={payout.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{payout.serviceName}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {doctor?.name} - {payout.invoiceNo}
                      </p>
                    </div>
                    <StatusPill tone={payout.status === "paid" ? "green" : "amber"}>
                      {payout.status}
                    </StatusPill>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">{payout.paymentReason}</span>
                    <span className="font-bold text-ink">{money(payout.payoutAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-care-50 p-2 text-care-700">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">Security posture</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Role-based navigation is mirrored by PostgreSQL RLS. Doctors are restricted to their own payout rows,
              staff can create invoices, accountants can report and settle vouchers, and admins control setup.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
