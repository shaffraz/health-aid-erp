"use client";

import { useMemo, useState } from "react";
import { Download, FileCheck2, Filter, ReceiptText, RotateCcw } from "lucide-react";
import { generatePayoutVoucherAction, updateVoucherStatusAction } from "@/lib/actions";
import { MetricCard } from "@/components/metric-card";
import { StatusPill } from "@/components/status-pill";
import { money, monthKey, shortDate, todayISO } from "@/lib/format";
import type { Doctor, DoctorPayout, PayoutVoucher } from "@/lib/types";
import { cn } from "@/lib/utils";

type PayoutManagementProps = {
  doctors: Doctor[];
  initialPayouts: DoctorPayout[];
  initialVouchers: PayoutVoucher[];
};

export function PayoutManagement({
  doctors,
  initialPayouts,
  initialVouchers
}: PayoutManagementProps) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [doctorId, setDoctorId] = useState("all");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [selectedVoucherId, setSelectedVoucherId] = useState(initialVouchers[0]?.id ?? "");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const filteredPayouts = useMemo(
    () =>
      payouts.filter((payout) => {
        const doctorMatches = doctorId === "all" || payout.doctorId === doctorId;
        const monthMatches = !month || monthKey(payout.date) === month;
        const statusMatches = status === "all" || payout.status === status;

        return doctorMatches && monthMatches && statusMatches && payout.payoutMode !== "pending_shift";
      }),
    [doctorId, month, payouts, status]
  );

  const unpaidFiltered = filteredPayouts.filter((payout) => payout.status === "unpaid");
  const selectedVoucher = vouchers.find((voucher) => voucher.id === selectedVoucherId);

  async function generateVoucher() {
    const eligible = unpaidFiltered.filter((payout) => doctorId !== "all" && payout.doctorId === doctorId);

    if (!eligible.length || doctorId === "all") {
      return;
    }

    setError("");
    setPending(true);

    const result = await generatePayoutVoucherAction({ doctorId, month });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const localVoucherNo = `DPV-${new Date().getFullYear()}-${String(vouchers.length + 1).padStart(4, "0")}`;
    const voucherNo = result.demo ? localVoucherNo : result.data.voucherNo;
    const payoutIds = result.demo ? eligible.map((payout) => payout.id) : result.data.payoutIds;
    const totalAmount = result.demo
      ? eligible.reduce((sum, payout) => sum + payout.payoutAmount, 0)
      : result.data.totalAmount;
    const voucher: PayoutVoucher = {
      id: result.demo ? crypto.randomUUID() : result.data.id,
      voucherNo,
      doctorId,
      periodStart: `${month}-01`,
      periodEnd: todayISO(),
      payoutIds,
      totalAmount,
      status: "unpaid",
      notes: "Generated from filtered unpaid payout records."
    };

    setVouchers((current) => [voucher, ...current]);
    setPayouts((current) =>
      current.map((payout) =>
        payoutIds.includes(payout.id)
          ? { ...payout, voucherNo }
          : payout
      )
    );
    setSelectedVoucherId(voucher.id);
  }

  async function markVoucher(nextStatus: "paid" | "unpaid") {
    if (!selectedVoucher) {
      return;
    }

    setError("");
    setPending(true);

    const result = await updateVoucherStatusAction({
      voucherId: selectedVoucher.id,
      status: nextStatus,
      paymentReference,
      paymentDate,
      notes
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setVouchers((current) =>
      current.map((voucher) =>
        voucher.id === selectedVoucher.id
          ? {
              ...voucher,
              status: nextStatus,
              paymentReference: nextStatus === "paid" ? paymentReference || voucher.paymentReference : undefined,
              paymentDate: nextStatus === "paid" ? paymentDate : undefined,
              notes: notes || voucher.notes
            }
          : voucher
      )
    );
    setPayouts((current) =>
      current.map((payout) =>
        selectedVoucher.payoutIds.includes(payout.id)
          ? { ...payout, status: nextStatus, voucherNo: selectedVoucher.voucherNo }
          : payout
      )
    );
  }

  function pdfEscape(value: string) {
    return value
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  function lkr(value: number) {
    return `LKR ${Math.round(value).toLocaleString("en-US")}`;
  }

  function buildSimplePdf(lines: string[]) {
    const commands = lines
      .slice(0, 42)
      .map((line, index) => {
        const size = index === 0 ? 16 : index < 6 ? 11 : 9;
        const y = 760 - index * 16;
        return `BT /F1 ${size} Tf 1 0 0 1 50 ${y} Tm (${pdfEscape(line)}) Tj ET`;
      })
      .join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return pdf;
  }

  function downloadVoucherPdf() {
    if (!selectedVoucher) {
      return;
    }

    const doctor = doctors.find((candidate) => candidate.id === selectedVoucher.doctorId);
    const voucherPayouts = payouts.filter((payout) => selectedVoucher.payoutIds.includes(payout.id));
    const lines = [
      "Health Aid Arugambay",
      `Doctor payout voucher: ${selectedVoucher.voucherNo}`,
      `Doctor: ${doctor?.name ?? "Unknown doctor"}`,
      `Period: ${selectedVoucher.periodStart} to ${selectedVoucher.periodEnd}`,
      `Status: ${selectedVoucher.status}`,
      `Total: ${lkr(selectedVoucher.totalAmount)}`,
      " ",
      "Invoice/Shift | Type | Reason | Amount",
      ...voucherPayouts.map(
        (payout) =>
          `${payout.invoiceNo} | ${payout.payoutMode === "shift" ? "Shift voucher" : "Invoice payout"} | ${payout.paymentReason} | ${lkr(payout.payoutAmount)}`
      )
    ];
    const blob = new Blob([buildSimplePdf(lines)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedVoucher.voucherNo}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Filtered payouts"
          value={money(filteredPayouts.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper={`${filteredPayouts.length} records in current filter`}
          icon={Filter}
          tone="lagoon"
        />
        <MetricCard
          label="Unpaid in filter"
          value={money(unpaidFiltered.reduce((sum, payout) => sum + payout.payoutAmount, 0))}
          helper="Available for voucher generation"
          icon={ReceiptText}
          tone="amber"
        />
        <MetricCard
          label="Vouchers"
          value={String(vouchers.length)}
          helper="Generated doctor payment batches"
          icon={FileCheck2}
          tone="care"
        />
        <MetricCard
          label="Paid vouchers"
          value={money(vouchers.filter((voucher) => voucher.status === "paid").reduce((sum, voucher) => sum + voucher.totalAmount, 0))}
          helper="Settled by admin or accountant"
          icon={Download}
          tone="ink"
        />
      </div>

      <section className="panel p-5">
        {error ? (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="label" htmlFor="payout-doctor">
              Doctor
            </label>
            <select
              id="payout-doctor"
              value={doctorId}
              onChange={(event) => setDoctorId(event.target.value)}
              className="field mt-2"
            >
              <option value="all">All doctors</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="payout-month">
              Month
            </label>
            <input
              id="payout-month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="field mt-2"
            />
          </div>
          <div>
            <label className="label" htmlFor="payout-status">
              Status
            </label>
            <select
              id="payout-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="field mt-2"
            >
              <option value="all">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={generateVoucher}
              disabled={pending || doctorId === "all" || unpaidFiltered.length === 0}
              className={cn(
                "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                !pending && doctorId !== "all" && unpaidFiltered.length
                  ? "bg-lagoon-600 hover:bg-lagoon-700"
                  : "bg-slate-300"
              )}
            >
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              {pending ? "Working..." : "Generate voucher"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-ink">Doctor payout records</h2>
            <p className="mt-1 text-sm text-slate-500">
              Low season appears as invoice-based payouts. Peak season appears as shift-based vouchers.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Doctor</th>
                  <th className="px-5 py-3">Invoice / Shift</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayouts.map((payout) => {
                  const doctor = doctors.find((candidate) => candidate.id === payout.doctorId);

                  return (
                    <tr key={payout.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">{doctor?.name}</td>
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-ink">
                        <p>{payout.invoiceNo}</p>
                        <p className="text-xs font-normal text-slate-500">{shortDate(payout.date)}</p>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {payout.payoutMode === "shift" ? "Shift voucher" : "Invoice payout"}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{payout.paymentReason}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-bold text-ink">
                        {money(payout.payoutAmount)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusPill tone={payout.status === "paid" ? "green" : "amber"}>
                          {payout.status}
                        </StatusPill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold text-ink">Voucher management</h2>
          <p className="mt-1 text-sm text-slate-500">
            Mark vouchers as paid or unpaid, record reference data, and export a PDF voucher.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="voucher">
                Voucher
              </label>
              <select
                id="voucher"
                value={selectedVoucherId}
                onChange={(event) => setSelectedVoucherId(event.target.value)}
                className="field mt-2"
              >
                <option value="">Select voucher</option>
                {vouchers.map((voucher) => (
                  <option key={voucher.id} value={voucher.id}>
                    {voucher.voucherNo} - {money(voucher.totalAmount)}
                  </option>
                ))}
              </select>
            </div>

            {selectedVoucher ? (
              <>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{selectedVoucher.voucherNo}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {shortDate(selectedVoucher.periodStart)} to {shortDate(selectedVoucher.periodEnd)}
                      </p>
                    </div>
                    <StatusPill tone={selectedVoucher.status === "paid" ? "green" : "amber"}>
                      {selectedVoucher.status}
                    </StatusPill>
                  </div>
                  <p className="mt-4 text-2xl font-bold text-ink">{money(selectedVoucher.totalAmount)}</p>
                </div>
                <div>
                  <label className="label" htmlFor="payment-ref">
                    Payment reference
                  </label>
                  <input
                    id="payment-ref"
                    value={paymentReference}
                    onChange={(event) => setPaymentReference(event.target.value)}
                    className="field mt-2"
                    placeholder={selectedVoucher.paymentReference ?? "Bank transfer reference"}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="payment-date">
                    Payment date
                  </label>
                  <input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(event) => setPaymentDate(event.target.value)}
                    className="field mt-2"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="voucher-notes">
                    Notes
                  </label>
                  <textarea
                    id="voucher-notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="field mt-2 min-h-24"
                    placeholder={selectedVoucher.notes ?? "Payment notes"}
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => markVoucher("paid")}
                    disabled={pending}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-care-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-care-700"
                  >
                    <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => markVoucher("unpaid")}
                    disabled={pending}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    Unpaid
                  </button>
                  <button
                    type="button"
                    onClick={downloadVoucherPdf}
                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    PDF
                  </button>
                </div>
              </>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                Generate or select a voucher to manage payment status.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
