"use client";

import { useMemo, useState } from "react";
import { generatePayoutVoucherAction, updateVoucherStatusAction } from "@/lib/actions";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { money, monthKey, shortDate, todayISO } from "@/lib/format";
import type { Doctor, DoctorPayout, PayoutVoucher } from "@/lib/types";

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
  const currentMonth = todayISO().slice(0, 7);

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
  const visiblePayouts = payouts.filter((payout) => payout.payoutMode !== "pending_shift");
  const unpaidPayouts = visiblePayouts.filter((payout) => payout.status === "unpaid");
  const pendingPayoutAmount = unpaidPayouts.reduce(
    (sum, payout) => sum + payout.payoutAmount,
    0
  );
  const paidThisMonth = visiblePayouts
    .filter((payout) => payout.status === "paid" && monthKey(payout.date) === currentMonth)
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const doctorsAwaitingPayout = new Set(unpaidPayouts.map((payout) => payout.doctorId)).size;

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
        <KpiCard
          label="Pending Payout Amount LKR"
          value={money(pendingPayoutAmount)}
          tone="danger"
        />
        <KpiCard label="Paid This Month LKR" value={money(paidThisMonth)} tone="success" />
        <KpiCard
          label="Doctors Awaiting Payout"
          value={String(doctorsAwaitingPayout)}
          tone="warning"
        />
        <KpiCard label="Generated Vouchers" value={String(vouchers.length)} tone="primary" />
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 font-semibold text-[#224770]">Payout Filters</h2>
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
              className={buttonClass(
                !pending && doctorId !== "all" && unpaidFiltered.length ? "primary" : "muted",
                "w-full"
              )}
            >
              {pending ? "Working..." : "Generate voucher"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-semibold text-[#224770]">Doctor Payout Records</h2>
          </div>
          <div className={tableStyles.wrapper}>
            <table className={tableStyles.table}>
              <thead className={tableStyles.head}>
                <tr>
                  <th className={tableStyles.headerCell}>Doctor</th>
                  <th className={tableStyles.headerCell}>Invoice / Shift</th>
                  <th className={tableStyles.headerCell}>Type</th>
                  <th className={tableStyles.headerCell}>Reason</th>
                  <th className={tableStyles.numericHeaderCell}>Amount LKR</th>
                  <th className={tableStyles.headerCell}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efefef]">
                {filteredPayouts.map((payout) => {
                  const doctor = doctors.find((candidate) => candidate.id === payout.doctorId);

                  return (
                    <tr key={payout.id} className={tableStyles.row}>
                      <td className={tableStyles.cell}>{doctor?.name}</td>
                      <td className={tableStyles.strongCell}>
                        <p>{payout.invoiceNo}</p>
                        <p className="text-xs font-normal text-slate-500">{shortDate(payout.date)}</p>
                      </td>
                      <td className={tableStyles.cell}>
                        {payout.payoutMode === "shift" ? "Shift voucher" : "Invoice payout"}
                      </td>
                      <td className={tableStyles.cell}>{payout.paymentReason}</td>
                      <td className={tableStyles.numericCell}>
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
          <h2 className="font-semibold text-[#224770]">Voucher Management</h2>

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
                    className={buttonClass("success", "px-3 py-2")}
                  >
                    Paid
                  </button>
                  <button
                    type="button"
                    onClick={() => markVoucher("unpaid")}
                    disabled={pending}
                    className={buttonClass("secondary", "px-3 py-2")}
                  >
                    Unpaid
                  </button>
                  <button
                    type="button"
                    onClick={downloadVoucherPdf}
                    className={buttonClass("primary", "px-3 py-2")}
                  >
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
