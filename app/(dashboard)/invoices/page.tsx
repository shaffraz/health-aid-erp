import { AccessDenied } from "@/components/access-denied";
import { SectionHeader } from "@/components/section-header";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth";
import { getWorkspaceData } from "@/lib/data";
import { money, shortDate } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";

export default async function InvoicesPage() {
  const [user, data] = await Promise.all([getCurrentUser(), getWorkspaceData()]);

  if (!hasPermission(user.role, "viewInvoices")) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Invoices"
        title="Invoice register"
        description="Back-office invoice list for sales review. Patient information remains invoice-scoped in this MVP."
      />

      <section className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Doctor</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.invoices.map((invoice) => {
                const doctor = data.doctors.find((candidate) => candidate.id === invoice.doctorId);

                return (
                  <tr key={invoice.id}>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">{invoice.invoiceNo}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">{shortDate(invoice.date)}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-ink">{invoice.patientName}</p>
                      <p className="text-xs text-slate-500">
                        {[invoice.passport, invoice.phone, invoice.nationality].filter(Boolean).join(" / ") || "No optional details"}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{doctor?.name ?? "Unassigned"}</td>
                    <td className="px-5 py-4">
                      <StatusPill tone="cyan">{invoice.paymentMethod.replace("_", " ")}</StatusPill>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-ink">
                      {money(invoice.totalAmount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
