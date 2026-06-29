"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { KpiCard, buttonClass } from "@/components/erp-ui";
import {
  calculateInvoiceTotals,
  generatePayoutsForInvoice,
  nextInvoiceNumber
} from "@/lib/calculations";
import {
  currentTimeHHMM,
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, todayISO, usdWhole } from "@/lib/format";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  isAmountOnlyInvoiceServiceName,
  paymentMethods,
  serviceStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type Invoice,
  type InvoiceItem,
  type Service
} from "@/lib/types";

type DraftLine = {
  id: string;
  serviceId: string;
  quantity: number;
  amountUsd: number;
};

type InvoicePosFormProps = {
  doctors: Doctor[];
  services: Service[];
  initialInvoices: Invoice[];
  createdBy: string;
};

const paymentLabels: Record<(typeof paymentMethods)[number], string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
};

const paymentModelLabels = {
  low_season: "Low Season",
  peak_season: "Peak Season"
} satisfies Record<DoctorPaymentModel["activeModel"], string>;

function roundUsd(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function makeId() {
  return crypto.randomUUID();
}

function normalizeDoctorCatalog(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? ""
  };
}

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function InvoicePosForm({
  doctors,
  services,
  initialInvoices,
  createdBy
}: InvoicePosFormProps) {
  const [doctorCatalog, setDoctorCatalog] = useState(() =>
    doctors.map(normalizeDoctorCatalog)
  );
  const [catalogServices, setCatalogServices] = useState(services);
  const activeDoctors = useMemo(
    () => doctorCatalog.filter((doctor) => doctor.active),
    [doctorCatalog]
  );
  const invoiceServices = useMemo(() => catalogServices, [catalogServices]);
  const serviceOptions = useMemo(
    () => invoiceServices.filter((service) => service.active),
    [invoiceServices]
  );
  const clinicalServiceOptions = useMemo(
    () =>
      serviceOptions.filter((service) => !isAmountOnlyInvoiceServiceName(service.name)),
    [serviceOptions]
  );
  const additionalChargeOptions = useMemo(
    () => serviceOptions.filter((service) => isAmountOnlyInvoiceServiceName(service.name)),
    [serviceOptions]
  );

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [paymentSettings, setPaymentSettings] = useState<DoctorPaymentModel>(
    defaultDoctorPaymentModel
  );
  const [invoiceDate, setInvoiceDate] = useState(() => todayISO());
  const [invoiceTime, setInvoiceTime] = useState(() => currentTimeHHMM());
  const [patientName, setPatientName] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");
  const [nationality, setNationality] = useState("");
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof paymentMethods)[number]>("cash");
  const [notes, setNotes] = useState("");
  const [serviceLines, setServiceLines] = useState<DraftLine[]>([
    { id: makeId(), serviceId: clinicalServiceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
  ]);
  const [chargeLines, setChargeLines] = useState<DraftLine[]>(() =>
    additionalChargeOptions.map((service) => ({
      id: makeId(),
      serviceId: service.id,
      quantity: 1,
      amountUsd: 0
    }))
  );
  const [savedInvoiceNo, setSavedInvoiceNo] = useState("");
  const [lastSavedInvoice, setLastSavedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    try {
      const storedDoctors = window.localStorage.getItem(doctorStorageKey);
      if (!storedDoctors) {
        return;
      }

      const parsed = JSON.parse(storedDoctors);
      if (Array.isArray(parsed)) {
        setDoctorCatalog((parsed as Doctor[]).map(normalizeDoctorCatalog));
      }
    } catch {
      setDoctorCatalog(doctors.map(normalizeDoctorCatalog));
    }
  }, [doctors]);

  useEffect(() => {
    if (!activeDoctors.length) {
      setDoctorId("");
      return;
    }

    if (!activeDoctors.some((doctor) => doctor.id === doctorId)) {
      setDoctorId(activeDoctors[0].id);
    }
  }, [activeDoctors, doctorId]);

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(serviceStorageKey);
      if (!storedServices) {
        return;
      }

      const parsed = JSON.parse(storedServices);
      if (Array.isArray(parsed)) {
        setCatalogServices(parsed as Service[]);
      }
    } catch {
      setCatalogServices(services);
    }
  }, [services]);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(doctorPaymentSettingsStorageKey);
      if (storedSettings) {
        setPaymentSettings(normalizeDoctorPaymentModel(JSON.parse(storedSettings)));
      }
    } catch {
      setPaymentSettings(defaultDoctorPaymentModel);
    }
  }, []);

  useEffect(() => {
    setServiceLines((current) => {
      const validLines = current.filter((line) =>
        clinicalServiceOptions.some((service) => service.id === line.serviceId)
      );

      if (validLines.length) {
        return validLines;
      }

      return clinicalServiceOptions[0]
        ? [
            {
              id: makeId(),
              serviceId: clinicalServiceOptions[0].id,
              quantity: 1,
              amountUsd: 0
            }
          ]
        : [];
    });

    setChargeLines((current) =>
      additionalChargeOptions.map((service) => {
        const existing = current.find((line) => line.serviceId === service.id);

        return (
          existing ?? {
            id: makeId(),
            serviceId: service.id,
            quantity: 1,
            amountUsd: 0
          }
        );
      })
    );
  }, [additionalChargeOptions, clinicalServiceOptions]);

  const currentDate = todayISO();
  const currentMonth = currentDate.slice(0, 7);
  const todayInvoices = invoices.filter((invoice) => invoice.date === currentDate);
  const monthlyInvoices = invoices.filter((invoice) => monthKey(invoice.date) === currentMonth);
  const todayRevenue = todayInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const monthlyRevenue = monthlyInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const averageInvoiceValue = monthlyInvoices.length
    ? monthlyRevenue / monthlyInvoices.length
    : 0;
  const latestInvoiceNo = [...invoices.map((invoice) => invoice.invoiceNo)].sort().at(-1);
  const invoiceNo = nextInvoiceNumber(latestInvoiceNo);

  const serviceItemsUsd = useMemo<InvoiceItem[]>(
    () =>
      [...serviceLines, ...chargeLines]
        .map((line) => {
          const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);

          if (!service) {
            return null;
          }

          const isAmountOnlyService = isAmountOnlyInvoiceServiceName(service.name);
          const quantity = isAmountOnlyService ? 1 : line.quantity;
          const unitPrice = roundUsd(isAmountOnlyService ? line.amountUsd : service.sellingPrice);

          if (isAmountOnlyService && unitPrice <= 0) {
            return null;
          }

          return {
            id: line.id,
            serviceId: service.id,
            serviceName: service.name,
            category: service.category,
            quantity,
            unitPrice,
            lineTotal: unitPrice * quantity
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [chargeLines, invoiceServices, serviceLines]
  );

  const invoiceItems = serviceItemsUsd;
  const totals = calculateInvoiceTotals(invoiceItems, discount);
  const formReady =
    Boolean(patientName.trim()) &&
    Boolean(passport.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(nationality.trim()) &&
    Boolean(doctorId) &&
    invoiceItems.length > 0;
  const draftInvoice = {
    id: "draft",
    invoiceNo,
    date: invoiceDate,
    time: invoiceTime,
    patientName: patientName || "Draft patient",
    passport: passport || undefined,
    phone: phone || undefined,
    nationality: nationality || undefined,
    doctorId,
    items: invoiceItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    paymentMethod,
    notes: notes || undefined,
    totalAmount: totals.totalAmount,
    createdBy
  } satisfies Invoice;
  const payoutPreview = generatePayoutsForInvoice(draftInvoice, paymentSettings);
  const payoutPreviewTotal = payoutPreview.reduce((sum, payout) => sum + payout.payoutAmount, 0);

  function addServiceLine() {
    setServiceLines((current) => [
      ...current,
      { id: makeId(), serviceId: clinicalServiceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
    ]);
  }

  function updateServiceSelection(id: string, serviceId: string) {
    setServiceLines((current) =>
      current.map((line) =>
        line.id === id ? { ...line, serviceId } : line
      )
    );
  }

  function updateServiceLine(id: string, patch: Partial<DraftLine>) {
    setServiceLines((current) =>
      current.map((line) => (line.id === id ? { ...line, ...patch } : line))
    );
  }

  function removeServiceLine(id: string) {
    setServiceLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.id !== id)
    );
  }

  function buildInvoiceHtml(targetInvoice: Invoice) {
    const invoiceDoctor = doctorCatalog.find((doctor) => doctor.id === targetInvoice.doctorId);
    const itemRows = targetInvoice.items
      .map(
        (item) =>
          isAmountOnlyInvoiceServiceName(item.serviceName)
            ? `
          <tr>
            <td colspan="4">${escapeHtml(item.serviceName)} - USD</td>
            <td>${usdWhole(item.lineTotal)}</td>
          </tr>`
            : `
          <tr>
            <td>${escapeHtml(item.serviceName)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${item.quantity}</td>
            <td>${usdWhole(item.unitPrice)}</td>
            <td>${usdWhole(item.lineTotal)}</td>
          </tr>`
      )
      .join("");

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(targetInvoice.invoiceNo)}</title>
    <style>
      body { font-family: Arial, sans-serif; color: #0b1726; margin: 32px; }
      h1 { margin-bottom: 4px; }
      h2 { margin-top: 28px; font-size: 16px; }
      table { border-collapse: collapse; width: 100%; margin-top: 12px; }
      th, td { border-bottom: 1px solid #dbe3ea; padding: 10px; text-align: left; }
      th { background: #f1f5f9; }
      .totals { margin-top: 24px; margin-left: auto; width: 280px; }
      .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
      .grand { font-weight: 700; font-size: 18px; border-top: 1px solid #dbe3ea; }
    </style>
  </head>
  <body>
    <h1>Health Aid Arugambay</h1>
    <p>Invoice ${escapeHtml(targetInvoice.invoiceNo)} - ${escapeHtml(targetInvoice.date)} ${escapeHtml(targetInvoice.time)}</p>
    <p><strong>Patient:</strong> ${escapeHtml(targetInvoice.patientName)}</p>
    <p><strong>Doctor:</strong> ${escapeHtml(invoiceDoctor?.name ?? "Unassigned")}</p>
    <h2>Invoice items</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit price (USD)</th><th>Subtotal (USD)</th></tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="5">No invoice items</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${usdWhole(targetInvoice.subtotal)}</span></div>
      <div><span>Discount</span><span>${usdWhole(targetInvoice.discount)}</span></div>
      <div class="grand"><span>Grand total</span><span>${usdWhole(targetInvoice.totalAmount)}</span></div>
    </div>
  </body>
</html>`;
  }

  function downloadInvoice(targetInvoice: Invoice) {
    const blob = new Blob([buildInvoiceHtml(targetInvoice)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${targetInvoice.invoiceNo}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function printInvoice(targetInvoice: Invoice) {
    const printWindow = window.open("", "_blank", "noopener,noreferrer");

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(buildInvoiceHtml(targetInvoice));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function saveInvoice() {
    if (!formReady) {
      return;
    }

    const invoiceId = makeId();
    const createdInvoice: Invoice = {
      ...draftInvoice,
      id: invoiceId,
      patientName: patientName.trim(),
      passport: passport.trim(),
      phone: phone.trim(),
      nationality: nationality.trim(),
      items: invoiceItems.map((item) => ({ ...item, id: makeId() }))
    };
    const nextInvoices = [createdInvoice, ...invoices];

    setInvoices(nextInvoices);
    setSavedInvoiceNo(createdInvoice.invoiceNo);
    setLastSavedInvoice(createdInvoice);
    setInvoiceDate(todayISO());
    setInvoiceTime(currentTimeHHMM());
    setPatientName("");
    setPassport("");
    setPhone("");
    setNationality("");
    setDiscount(0);
    setPaymentMethod("cash");
    setNotes("");
    setServiceLines([
      { id: makeId(), serviceId: clinicalServiceOptions[0]?.id ?? "", quantity: 1, amountUsd: 0 }
    ]);
    setChargeLines(
      additionalChargeOptions.map((service) => ({
        id: makeId(),
        serviceId: service.id,
        quantity: 1,
        amountUsd: 0
      }))
    );
  }

  function updateChargeLine(serviceId: string, amountUsd: number) {
    setChargeLines((current) =>
      current.map((line) =>
        line.serviceId === serviceId ? { ...line, amountUsd: roundUsd(amountUsd) } : line
      )
    );
  }

  function SectionHeading({ title }: { title: string }) {
    return (
      <div className="border-b border-[#efefef] pb-3">
        <h3 className="font-semibold text-[#224770]">{title}</h3>
      </div>
    );
  }

  function FieldShell({ children }: { children: ReactNode }) {
    return <div>{children}</div>;
  }

  function AdditionalChargeInput({ service }: { service: Service }) {
    const line = chargeLines.find((chargeLine) => chargeLine.serviceId === service.id);

    return (
      <FieldShell>
        <label className="label" htmlFor={`charge-${service.id}`}>
          {service.name} USD
        </label>
        <input
          id={`charge-${service.id}`}
          type="number"
          min={0}
          step="1"
          value={line?.amountUsd ?? 0}
          onChange={(event) => updateChargeLine(service.id, Number(event.target.value))}
          className="field mt-2 text-right font-semibold"
          placeholder="0.00"
        />
      </FieldShell>
    );
  }

  function InvoiceTimestampFields() {
    return (
      <>
        <FieldShell>
          <label className="label" htmlFor="invoice-date">
            Invoice date
          </label>
          <input
            id="invoice-date"
            type="date"
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
            className="field mt-2"
          />
        </FieldShell>
        <FieldShell>
          <label className="label" htmlFor="invoice-time">
            Invoice time
          </label>
          <input
            id="invoice-time"
            type="time"
            value={invoiceTime}
            onChange={(event) => setInvoiceTime(event.target.value)}
            className="field mt-2"
          />
        </FieldShell>
      </>
    );
  }

  function PatientInformationFields() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell>
          <label className="label" htmlFor="patientName">
            Patient name
          </label>
          <input
            id="patientName"
            value={patientName}
            onChange={(event) => setPatientName(event.target.value)}
            className="field mt-2"
            placeholder="Patient full name"
            required
          />
        </FieldShell>
        <FieldShell>
          <label className="label" htmlFor="passport">
            Passport / ID
          </label>
          <input
            id="passport"
            value={passport}
            onChange={(event) => setPassport(event.target.value)}
            className="field mt-2"
            placeholder="Required"
            required
          />
        </FieldShell>
        <FieldShell>
          <label className="label" htmlFor="phone">
            Mobile Number
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="field mt-2"
            placeholder="Required"
            required
          />
        </FieldShell>
        <FieldShell>
          <label className="label" htmlFor="nationality">
            Nationality
          </label>
          <input
            id="nationality"
            value={nationality}
            onChange={(event) => setNationality(event.target.value)}
            className="field mt-2"
            placeholder="Required"
            required
          />
        </FieldShell>
      </div>
    );
  }

  function ClinicalInformationFields() {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <FieldShell>
          <label className="label" htmlFor="doctor">
            Doctor
          </label>
          <select
            id="doctor"
            value={doctorId}
            onChange={(event) => setDoctorId(event.target.value)}
            className="field mt-2"
          >
            {activeDoctors.length ? (
              activeDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))
            ) : (
              <option value="">No active doctors</option>
            )}
          </select>
        </FieldShell>
        <FieldShell>
          <label className="label" htmlFor="paymentMethod">
            Payment method
          </label>
          <select
            id="paymentMethod"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)}
            className="field mt-2"
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {paymentLabels[method]}
              </option>
            ))}
          </select>
        </FieldShell>
      </div>
    );
  }

  function AdditionalChargesSection() {
    return (
      <div className="space-y-4">
        <SectionHeading title="Additional Charges" />
        {additionalChargeOptions.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {additionalChargeOptions.map((service) => (
              <AdditionalChargeInput key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-[#efefef] bg-[#efefef] p-4 text-sm text-[#46484a]">
            No amount-only charge services are active.
          </p>
        )}
      </div>
    );
  }

  function InvoiceServicesSection() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-[#efefef] pb-3">
          <h3 className="font-semibold text-[#224770]">Invoice Services</h3>
          <button
            type="button"
            onClick={addServiceLine}
            disabled={!clinicalServiceOptions.length}
            className={buttonClass(clinicalServiceOptions.length ? "primary" : "muted", "px-3 py-2")}
          >
            Add service
          </button>
        </div>

        <div className="space-y-3">
          {serviceLines.map((line) => {
            const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);
            const unitPriceUsd = roundUsd(service?.sellingPrice ?? 0);
            const lineTotalUsd = unitPriceUsd * line.quantity;

            return (
              <div
                key={line.id}
                className="grid gap-3 rounded-xl border border-[#efefef] bg-[#efefef]/50 p-3 2xl:grid-cols-[minmax(180px,1fr)_120px_120px_120px_88px]"
              >
                <FieldShell>
                  <p className="label mb-2">Service</p>
                  <select
                    value={line.serviceId}
                    onChange={(event) => updateServiceSelection(line.id, event.target.value)}
                    className="field"
                    aria-label="Doctor service"
                  >
                    {clinicalServiceOptions.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} - {candidate.category}
                      </option>
                    ))}
                  </select>
                </FieldShell>
                <FieldShell>
                  <p className="label mb-2">Quantity</p>
                  <QuantityControl
                    value={line.quantity}
                    onChange={(quantity) => updateServiceLine(line.id, { quantity })}
                  />
                </FieldShell>
                <FieldShell>
                  <p className="label mb-2">Unit price USD</p>
                  <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#224770]">
                    {usdWhole(unitPriceUsd)}
                  </div>
                </FieldShell>
                <FieldShell>
                  <p className="label mb-2">Subtotal USD</p>
                  <div className="flex h-10 items-center justify-end rounded-lg bg-white px-3 py-2 text-sm font-semibold text-[#224770]">
                    {usdWhole(lineTotalUsd)}
                  </div>
                </FieldShell>
                <button
                  type="button"
                  onClick={() => removeServiceLine(line.id)}
                  className={buttonClass("danger", "mt-6 h-10 px-3 py-0 text-xs")}
                  aria-label="Remove service line"
                >
                  Remove
                </button>
              </div>
            );
          })}
          {!serviceLines.length ? (
            <p className="rounded-xl border border-[#efefef] bg-[#efefef] p-4 text-sm text-[#46484a]">
              No active clinical services are available.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  function NotesSection() {
    return (
      <div className="space-y-4">
        <SectionHeading title="Notes" />
        <textarea
          id="notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="field min-h-28"
          placeholder="Clinical or billing notes for the invoice"
        />
      </div>
    );
  }

  function TotalsPanel() {
    return (
      <div className="rounded-xl border border-[#efefef] bg-[#efefef]/50 p-4">
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[#46484a]">Subtotal USD</span>
            <span className="font-semibold text-[#224770]">{usdWhole(totals.subtotal)}</span>
          </div>
          <div>
            <label className="label" htmlFor="discount">
              Discount USD
            </label>
            <input
              id="discount"
              type="number"
              min={0}
              step="1"
              value={discount}
              onChange={(event) => setDiscount(roundUsd(Number(event.target.value)))}
              className="field mt-2"
            />
          </div>
          <div className="flex justify-between border-t border-[#efefef] pt-3 text-base">
            <span className="font-semibold text-[#224770]">Grand total USD</span>
            <span className="font-bold text-[#0eb6ef]">{usdWhole(totals.totalAmount)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={saveInvoice}
          disabled={!formReady}
          className={buttonClass(
            formReady ? "primary" : "muted",
            "mt-4 w-full"
          )}
        >
          Save invoice
        </button>
      </div>
    );
  }

  function InvoiceHeader() {
    return (
      <div className="flex flex-col gap-5 border-b border-[#efefef] pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="label">Invoice POS</p>
          <h2 className="mt-2 whitespace-nowrap text-lg font-bold tracking-tight text-[#224770] sm:text-xl lg:text-2xl">
            {invoiceNo}
          </h2>
          <p className="mt-1 whitespace-nowrap text-sm text-[#46484a]">
            {invoiceDate} at {invoiceTime}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(140px,1fr)_minmax(120px,0.8fr)_auto_auto] sm:items-end xl:min-w-[560px]">
          <InvoiceTimestampFields />
          <button
            type="button"
            onClick={() => printInvoice(lastSavedInvoice ?? draftInvoice)}
            className={buttonClass("secondary", "h-10 px-3 py-2")}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => downloadInvoice(lastSavedInvoice ?? draftInvoice)}
            disabled={!formReady && !lastSavedInvoice}
            className={buttonClass(
              formReady || lastSavedInvoice ? "secondary" : "muted",
              "h-10 px-3 py-2"
            )}
          >
            Download
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Today's Invoices" value={String(todayInvoices.length)} tone="primary" />
        <KpiCard label="Today's Revenue USD" value={usdWhole(todayRevenue)} tone="info" />
        <KpiCard label="Monthly Revenue USD" value={usdWhole(monthlyRevenue)} tone="success" />
        <KpiCard label="Average Invoice Value USD" value={usdWhole(averageInvoiceValue)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="panel p-5">
          <InvoiceHeader />

          {savedInvoiceNo ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Saved {savedInvoiceNo}. Recent invoices were updated locally.
            </div>
          ) : null}

          <div className="mt-6 space-y-7">
            <div className="space-y-4">
              <SectionHeading title="Patient Information" />
              <PatientInformationFields />
            </div>

            <div className="space-y-4">
              <SectionHeading title="Clinical Information" />
              <ClinicalInformationFields />
            </div>

            <InvoiceServicesSection />
            <AdditionalChargesSection />

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <NotesSection />
              <TotalsPanel />
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="panel p-5">
            <h3 className="font-semibold text-[#224770]">Invoice Preview</h3>
            <p className="mt-1 text-sm text-[#46484a]">Patient invoice amounts remain in USD.</p>
            <div className="mt-4 space-y-4">
              <PreviewGroup title="Invoice items" items={invoiceItems} />
              <div className="rounded-lg border border-[#efefef] bg-[#efefef]/50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#46484a]">Discount USD</span>
                  <span className="font-semibold text-[#224770]">{usdWhole(totals.discount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-[#efefef] pt-2 text-base">
                  <span className="font-semibold text-[#224770]">Grand total USD</span>
                  <span className="font-bold text-[#0eb6ef]">{usdWhole(totals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="font-semibold text-[#224770]">Doctor Payout Preview</h3>
            <div className="mt-3 rounded-lg border border-[#efefef] bg-[#efefef]/50 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#46484a]">Active payment model</span>
                <span className="font-semibold text-[#224770]">
                  {paymentModelLabels[paymentSettings.activeModel]}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {payoutPreview.length ? (
                <>
                  {payoutPreview.map((payout) => (
                    <div key={payout.id} className="rounded-lg border border-[#efefef] bg-[#efefef]/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[#224770]">{payout.serviceName}</p>
                        <p className="text-sm font-bold text-[#84bc3f]">{money(payout.payoutAmount)}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#46484a]">{payout.paymentReason}</p>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-lg bg-[#84bc3f]/10 px-3 py-2 text-sm font-semibold text-[#4f7f22]">
                    <span>Estimated total payout LKR</span>
                    <span>{money(payoutPreviewTotal)}</span>
                  </div>
                </>
              ) : (
                <p className="rounded-lg bg-[#efefef] p-3 text-sm text-[#46484a]">
                  No doctor payout is estimated for the current invoice.
                </p>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <h3 className="font-semibold text-[#224770]">Recent Invoices</h3>
            <div className="mt-4 space-y-3">
              {invoices.slice(0, 5).map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-[#efefef] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#224770]">{invoice.invoiceNo}</p>
                      <p className="text-xs text-[#46484a]">{invoice.patientName}</p>
                      <p className="text-xs text-[#46484a]">
                        {invoice.date} {invoice.time ?? ""}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-[#224770]">{usdWhole(invoice.totalAmount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function QuantityControl({
  value,
  onChange
}: {
  value: number;
  onChange: (quantity: number) => void;
}) {
  return (
    <div className="flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        className="focus-ring p-2 text-slate-500"
        onClick={() => onChange(Math.max(1, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        value={value}
        min={1}
        type="number"
        onChange={(event) => onChange(Math.max(1, Number(event.target.value)))}
        className="w-full border-0 bg-white px-2 py-2 text-center text-sm font-semibold outline-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        className="focus-ring p-2 text-slate-500"
        onClick={() => onChange(value + 1)}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function PreviewGroup({ title, items }: { title: string; items: InvoiceItem[] }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm font-bold text-ink">
          {usdWhole(items.reduce((sum, item) => sum + item.lineTotal, 0))}
        </p>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-xs text-slate-500">
              <span>
                {isAmountOnlyInvoiceServiceName(item.serviceName)
                  ? `${item.serviceName} - USD`
                  : `${item.serviceName} - ${item.category} x ${item.quantity}`}
              </span>
              <span className="font-semibold text-slate-700">{usdWhole(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No items added.</p>
      )}
    </div>
  );
}
