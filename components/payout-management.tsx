"use client";

import { useMemo, useState } from "react";
import { generatePayoutVoucherAction, updateVoucherStatusAction } from "@/lib/actions";
import { ActionSelect } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { openEmailDraft } from "@/lib/email";
import { money, monthKey, shortDate, todayISO } from "@/lib/format";
import { generateId } from "@/lib/id";
import { useSystemSettings } from "@/lib/use-system-settings";
import type { Doctor, DoctorPayout, PayoutVoucher } from "@/lib/types";

type PayoutManagementProps = {
  doctors: Doctor[];
  initialPayouts: DoctorPayout[];
  initialVouchers: PayoutVoucher[];
  canEdit: boolean;
};

function monthLabel(monthValue: string) {
  const [year, monthNumber] = monthValue.split("-").map(Number);

  if (!year || !monthNumber) {
    return monthValue;
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric"
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function monthRange(monthValue: string) {
  const [year, monthNumber] = monthValue.split("-").map(Number);
  const safeMonth = year && monthNumber ? monthValue : todayISO().slice(0, 7);
  const [safeYear, safeMonthNumber] = safeMonth.split("-").map(Number);
  const lastDay = new Date(safeYear, safeMonthNumber, 0).getDate();

  return {
    start: `${safeMonth}-01`,
    end: `${safeMonth}-${String(lastDay).padStart(2, "0")}`
  };
}

export function PayoutManagement({
  canEdit,
  doctors,
  initialPayouts,
  initialVouchers
}: PayoutManagementProps) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const [vouchers, setVouchers] = useState(initialVouchers);
  const [doctorId, setDoctorId] = useState("all");
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [status, setStatus] = useState<"all" | "paid" | "unpaid">("all");
  const [selectedVoucherId, setSelectedVoucherId] = useState("");
  const [paymentVoucherId, setPaymentVoucherId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const systemSettings = useSystemSettings();
  const currentMonth = todayISO().slice(0, 7);

  const visiblePayouts = useMemo(
    () => payouts.filter((payout) => payout.payoutMode !== "pending_shift"),
    [payouts]
  );
  const voucherEligiblePayouts = useMemo(
    () =>
      visiblePayouts.filter((payout) => {
        const doctorMatches = doctorId === "all" || payout.doctorId === doctorId;
        const monthMatches = !month || monthKey(payout.date) === month;

        return doctorMatches && monthMatches && payout.status === "unpaid" && !payout.voucherNo;
      }),
    [doctorId, month, visiblePayouts]
  );
  const filteredVouchers = useMemo(
    () =>
      vouchers.filter((voucher) => {
        const doctorMatches = doctorId === "all" || voucher.doctorId === doctorId;
        const monthMatches = !month || monthKey(voucher.periodStart) === month;
        const statusMatches = status === "all" || voucher.status === status;

        return doctorMatches && monthMatches && statusMatches;
      }),
    [doctorId, month, status, vouchers]
  );

  const selectedVoucher = vouchers.find((voucher) => voucher.id === selectedVoucherId);
  const paymentVoucher = vouchers.find((voucher) => voucher.id === paymentVoucherId);
  const unpaidPayouts = visiblePayouts.filter((payout) => payout.status === "unpaid");
  const pendingPayoutAmount = unpaidPayouts.reduce(
    (sum, payout) => sum + payout.payoutAmount,
    0
  );
  const paidThisMonth = visiblePayouts
    .filter((payout) => payout.status === "paid" && monthKey(payout.date) === currentMonth)
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const doctorsAwaitingPayout = new Set(unpaidPayouts.map((payout) => payout.doctorId)).size;
  const selectedDoctor = doctors.find((doctor) => doctor.id === doctorId);
  const eligibleVoucherTotal = voucherEligiblePayouts.reduce(
    (sum, payout) => sum + payout.payoutAmount,
    0
  );

  async function generateVoucher() {
    if (!canEdit) {
      return;
    }

    const eligible = voucherEligiblePayouts.filter(
      (payout) => doctorId !== "all" && payout.doctorId === doctorId
    );

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
    const range = monthRange(month);
    const voucher: PayoutVoucher = {
      id: result.demo ? generateId() : result.data.id,
      voucherNo,
      doctorId,
      periodStart: range.start,
      periodEnd: range.end,
      payoutIds,
      totalAmount,
      status: "unpaid",
      notes: "Generated before doctor payment."
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

  function doctorName(doctorIdValue: string) {
    return doctors.find((doctor) => doctor.id === doctorIdValue)?.name ?? "Unknown doctor";
  }

  function openPaymentModal(voucher: PayoutVoucher) {
    setPaymentVoucherId(voucher.id);
    setPaymentReference(voucher.paymentReference ?? "");
    setPaymentDate(voucher.paymentDate ?? todayISO());
    setNotes(voucher.notes ?? "");
  }

  function closePaymentModal() {
    setPaymentVoucherId("");
    setPaymentReference("");
    setPaymentDate(todayISO());
    setNotes("");
  }

  async function markVoucher(voucher: PayoutVoucher, nextStatus: "paid" | "unpaid") {
    if (!canEdit) {
      return;
    }

    setError("");
    setPending(true);

    const result = await updateVoucherStatusAction({
      voucherId: voucher.id,
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
      current.map((candidate) =>
        candidate.id === voucher.id
          ? {
              ...candidate,
              status: nextStatus,
              paymentReference: nextStatus === "paid" ? paymentReference || candidate.paymentReference : undefined,
              paymentDate: nextStatus === "paid" ? paymentDate : undefined,
              notes: notes || candidate.notes
            }
          : candidate
      )
    );
      setPayouts((current) =>
        current.map((payout) =>
          voucher.payoutIds.includes(payout.id)
          ? { ...payout, status: nextStatus, voucherNo: voucher.voucherNo }
          : payout
      )
    );
    closePaymentModal();
  }

  function pdfEscape(value: string) {
    return value
      .replaceAll("\\", "\\\\")
      .replaceAll("(", "\\(")
      .replaceAll(")", "\\)")
      .replace(/[^\x20-\x7E]/g, "?");
  }

  function lkr(value: number) {
    return `${systemSettings.clinic.localCurrency} ${Math.round(value).toLocaleString("en-US")}`;
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

  function downloadVoucherPdf(voucher = selectedVoucher) {
    if (!voucher) {
      return;
    }

    const voucherPayouts = payouts.filter((payout) => voucher.payoutIds.includes(payout.id));
    const lines = [
      systemSettings.clinic.clinicName,
      `Doctor payout voucher: ${voucher.voucherNo}`,
      `Doctor: ${doctorName(voucher.doctorId)}`,
      `Period: ${voucher.periodStart} to ${voucher.periodEnd}`,
      `Status: ${voucher.status}`,
      `Total: ${lkr(voucher.totalAmount)}`,
      " ",
      "Invoice/Clinic Shift | Type | Reason | Amount",
      ...voucherPayouts.map(
        (payout) =>
          `${payout.invoiceNo} | ${payout.payoutMode === "shift" ? "Clinic Shift Voucher" : "Invoice payout"} | ${payout.paymentReason} | ${lkr(payout.payoutAmount)}`
      )
    ];
    const blob = new Blob([buildSimplePdf(lines)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${voucher.voucherNo}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function emailVoucher(voucher = selectedVoucher) {
    if (!voucher) {
      return;
    }

    const voucherPayouts = payouts.filter((payout) => voucher.payoutIds.includes(payout.id));

    openEmailDraft({
      subject: `${systemSettings.clinic.clinicName} payout voucher ${voucher.voucherNo}`,
      body: [
        systemSettings.clinic.clinicName,
        "",
        `Doctor payout voucher: ${voucher.voucherNo}`,
        `Doctor: ${doctorName(voucher.doctorId)}`,
        `Period: ${voucher.periodStart} to ${voucher.periodEnd}`,
        `Status: ${voucher.status}`,
        `Total: ${lkr(voucher.totalAmount)}`,
        "",
        "Payout records:",
        ...voucherPayouts.map(
          (payout) =>
            `${payout.invoiceNo} | ${payout.paymentReason} | ${lkr(payout.payoutAmount)}`
        )
      ].join("\n")
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`Pending Payout Amount ${systemSettings.clinic.localCurrency}`}
          value={money(pendingPayoutAmount)}
          tone="danger"
        />
        <KpiCard
          label={`Paid This Month ${systemSettings.clinic.localCurrency}`}
          value={money(paidThisMonth)}
          tone="success"
        />
        <KpiCard
          label="Doctors Awaiting Payout"
          value={String(doctorsAwaitingPayout)}
          tone="warning"
        />
        <KpiCard label="Generated Vouchers" value={String(vouchers.length)} tone="primary" />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="font-semibold text-white">Monthly Voucher Generation</h2>
        </div>
        {error ? (
          <div className="mx-4 mt-4 rounded-lg border border-[#46484a]/25 bg-[#efefef] p-3 text-sm font-semibold text-[#224770]">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="form-grid grid gap-4 md:grid-cols-3">
            <div>
              <label className="label" htmlFor="payout-doctor">
                Doctor
              </label>
              <select
                id="payout-doctor"
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                className="field mt-2 min-h-12"
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
                className="field mt-2 min-h-12"
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
                className="field mt-2 min-h-12"
              >
                <option value="all">All</option>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="rounded-xl border border-[#efefef] bg-[#efefef]/45 p-4">
            <p className="label">Generate Monthly Voucher</p>
            <p className="mt-2 text-sm font-semibold text-[#224770]">
              {selectedDoctor ? selectedDoctor.name : "Select one doctor"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[#46484a]">Awaiting voucher</p>
                <p className="font-bold text-[#224770]">{voucherEligiblePayouts.length}</p>
              </div>
              <div>
                <p className="text-[#46484a]">Total</p>
                <p className="font-bold text-[#224770]">{money(eligibleVoucherTotal)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={generateVoucher}
              disabled={!canEdit || pending || doctorId === "all" || voucherEligiblePayouts.length === 0}
              className={buttonClass(
                canEdit && !pending && doctorId !== "all" && voucherEligiblePayouts.length ? "primary" : "muted",
                "mt-4 min-h-12 w-full"
              )}
            >
              {pending ? "Working..." : "Generate Voucher"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="font-semibold text-white">Voucher Registry</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Voucher</th>
                <th className={tableStyles.headerCell}>Doctor</th>
                <th className={tableStyles.headerCell}>Month</th>
                <th className={tableStyles.numericHeaderCell}>
                  Amount {systemSettings.clinic.localCurrency}
                </th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.actionHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>
                    <button
                      type="button"
                      onClick={() => setSelectedVoucherId(voucher.id)}
                      className="text-left font-semibold text-[#224770] underline-offset-4 hover:underline"
                    >
                      {voucher.voucherNo}
                    </button>
                  </td>
                  <td className={tableStyles.cell}>{doctorName(voucher.doctorId)}</td>
                  <td className={tableStyles.cell}>
                    {monthLabel(monthKey(voucher.periodStart))}
                  </td>
                  <td className={tableStyles.numericCell}>{money(voucher.totalAmount)}</td>
                  <td className={tableStyles.cell}>
                    <StatusPill tone={voucher.status === "paid" ? "green" : "amber"}>
                      {voucher.status === "paid" ? "Paid" : "Unpaid"}
                    </StatusPill>
                  </td>
                  <td className={tableStyles.actionCell}>
                    <ActionSelect
                      ariaLabel={`Actions for voucher ${voucher.voucherNo}`}
                      actions={[
                        {
                          value: "view",
                          label: "View",
                          onSelect: () => setSelectedVoucherId(voucher.id)
                        },
                        voucher.status === "unpaid" && canEdit
                          ? {
                              value: "paid",
                              label: "Record Payment",
                              onSelect: () => openPaymentModal(voucher)
                            }
                          : null,
                        voucher.status === "paid"
                          ? {
                              value: "pdf",
                              label: "Download PDF",
                              onSelect: () => downloadVoucherPdf(voucher)
                            }
                          : null,
                        voucher.status === "paid"
                          ? {
                              value: "email",
                              label: "Email Voucher",
                              onSelect: () => emailVoucher(voucher)
                            }
                          : null
                      ].filter((action): action is {
                        value: string;
                        label: string;
                        onSelect: () => void;
                      } => Boolean(action))}
                    />
                  </td>
                </tr>
              ))}
              {!filteredVouchers.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={6}>
                    No payout vouchers match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-[#224770] bg-[#224770] px-4 py-3">
          <h2 className="font-semibold text-white">Payout Records Awaiting Voucher</h2>
        </div>
        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Doctor</th>
                <th className={tableStyles.headerCell}>Invoice / Shift</th>
                <th className={tableStyles.headerCell}>Reason</th>
                <th className={tableStyles.numericHeaderCell}>
                  Amount {systemSettings.clinic.localCurrency}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {voucherEligiblePayouts.map((payout) => (
                <tr key={payout.id} className={tableStyles.row}>
                  <td className={tableStyles.cell}>{doctorName(payout.doctorId)}</td>
                  <td className={tableStyles.strongCell}>
                    <p>{payout.invoiceNo}</p>
                    <p className="text-xs font-normal text-[#46484a]">{shortDate(payout.date)}</p>
                  </td>
                  <td className={tableStyles.cell}>{payout.paymentReason}</td>
                  <td className={tableStyles.numericCell}>{money(payout.payoutAmount)}</td>
                </tr>
              ))}
              {!voucherEligiblePayouts.length ? (
                <tr>
                  <td className="px-5 py-8 text-center text-sm text-[#46484a]" colSpan={4}>
                    No payout records are waiting for voucher generation.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {selectedVoucher ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voucher-details-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="voucher-details-title" className="font-semibold text-[#224770]">
                Voucher Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedVoucherId("")}
                className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
                aria-label="Close voucher details"
              >
                ×
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <VoucherDetail label="Voucher No." value={selectedVoucher.voucherNo} />
                <VoucherDetail label="Doctor" value={doctorName(selectedVoucher.doctorId)} />
                <VoucherDetail
                  label="Month"
                  value={monthLabel(monthKey(selectedVoucher.periodStart))}
                />
                <VoucherDetail label="Total Amount" value={money(selectedVoucher.totalAmount)} />
                <VoucherDetail
                  label="Status"
                  value={selectedVoucher.status === "paid" ? "Paid" : "Unpaid"}
                />
                <VoucherDetail
                  label="Payment Reference"
                  value={selectedVoucher.paymentReference ?? "N/A"}
                />
                <VoucherDetail
                  label="Payment Date"
                  value={selectedVoucher.paymentDate ? shortDate(selectedVoucher.paymentDate) : "N/A"}
                />
              </div>
              <div className="rounded-xl border border-[#efefef] bg-white">
                <div className="border-b border-[#efefef] px-4 py-3">
                  <h3 className="font-semibold text-[#224770]">Included Payout Records</h3>
                </div>
                <div className={tableStyles.wrapper}>
                  <table className={tableStyles.table}>
                    <thead className={tableStyles.head}>
                      <tr>
                        <th className={tableStyles.headerCell}>Invoice / Shift</th>
                        <th className={tableStyles.headerCell}>Reason</th>
                        <th className={tableStyles.numericHeaderCell}>Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#efefef]">
                      {payouts
                        .filter((payout) => selectedVoucher.payoutIds.includes(payout.id))
                        .map((payout) => (
                          <tr key={payout.id} className={tableStyles.row}>
                            <td className={tableStyles.strongCell}>{payout.invoiceNo}</td>
                            <td className={tableStyles.cell}>{payout.paymentReason}</td>
                            <td className={tableStyles.numericCell}>{money(payout.payoutAmount)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
              {selectedVoucher.status === "paid" ? (
                <>
                  <button
                    type="button"
                    onClick={() => emailVoucher(selectedVoucher)}
                    className={buttonClass("secondary")}
                  >
                    Email Voucher
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadVoucherPdf(selectedVoucher)}
                    className={buttonClass("secondary")}
                  >
                    Download PDF
                  </button>
                </>
              ) : null}
              {canEdit && selectedVoucher.status === "unpaid" ? (
                <button
                  type="button"
                  onClick={() => openPaymentModal(selectedVoucher)}
                  className={buttonClass("primary")}
                >
                  Record Payment
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setSelectedVoucherId("")}
                className={buttonClass("secondary")}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {paymentVoucher ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voucher-payment-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="border-b border-[#efefef] px-5 py-4">
              <h2 id="voucher-payment-title" className="font-semibold text-[#224770]">
                Record Voucher Payment
              </h2>
              <p className="mt-1 text-sm font-semibold text-[#46484a]">
                {paymentVoucher.voucherNo} - {money(paymentVoucher.totalAmount)}
              </p>
            </div>
            <div className="grid flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="payment-ref">
                  Payment reference
                </label>
                <input
                  id="payment-ref"
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  disabled={!canEdit}
                  className="field mt-2 min-h-12"
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
                  disabled={!canEdit}
                  className="field mt-2 min-h-12"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="voucher-notes">
                  Notes
                </label>
                <textarea
                  id="voucher-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={!canEdit}
                  className="field mt-2 min-h-24"
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
              <button type="button" onClick={closePaymentModal} className={buttonClass("secondary")}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => markVoucher(paymentVoucher, "paid")}
                disabled={!canEdit || pending}
                className={buttonClass(canEdit && !pending ? "primary" : "muted")}
              >
                {pending ? "Saving..." : "Mark Paid"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function VoucherDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-3">
      <span className="label">{label}</span>
      <p className="mt-1 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}
