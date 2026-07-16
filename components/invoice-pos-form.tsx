"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/erp-ui";
import {
  calculateInvoiceTotals,
  generatePayoutsForInvoice,
  nextInvoiceNumber
} from "@/lib/calculations";
import { currentTimeHHMM } from "@/lib/doctor-payment";
import { demoAssistanceCompanies } from "@/lib/demo-data";
import { openEmailDraft } from "@/lib/email";
import { money, todayISO, usdWhole } from "@/lib/format";
import { generateId } from "@/lib/id";
import {
  paymentModeLabels,
} from "@/lib/settings";
import { useSystemSettings } from "@/lib/use-system-settings";
import {
  assistanceCompanyStorageKey,
  doctorStorageKey,
  isAmountOnlyInvoiceServiceName,
  isPayoutEligibleCategory,
  paymentMethods,
  serviceStorageKey,
  type AssistanceCompany,
  type Doctor,
  type Invoice,
  type InvoiceItem,
  type Service
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftLine = {
  id: string;
  serviceId: string;
  amountUsd: number;
};

type PaymentMethod = (typeof paymentMethods)[number];
type InvoiceTotals = ReturnType<typeof calculateInvoiceTotals>;

type InvoicePosFormProps = {
  doctors: Doctor[];
  services: Service[];
  initialInvoices: Invoice[];
  createdBy: string;
};

const paymentLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank transfer",
  insurance: "Insurance",
  other: "Other"
};

const invoicePaymentMethods = ["cash", "card", "insurance"] as const satisfies readonly PaymentMethod[];

function roundUsd(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

function roundPercentage(value: number) {
  return Math.min(100, roundUsd(value));
}

function makeId() {
  return generateId();
}

type InvoiceSectionTone =
  | "invoice"
  | "patient"
  | "billing"
  | "insurance"
  | "services"
  | "charges"
  | "notes"
  | "totals"
  | "preview"
  | "payout";

const invoiceSectionColors = {
  invoice: "#224770",
  patient: "#0eb6ef",
  billing: "#84bc3f",
  insurance: "#224770",
  services: "#224770",
  charges: "#0eb6ef",
  notes: "#46484a",
  totals: "#84bc3f",
  preview: "#224770",
  payout: "#84bc3f"
} satisfies Record<InvoiceSectionTone, string>;

function WorkflowSection({
  title,
  tone,
  children,
  className
}: {
  title: string;
  tone: InvoiceSectionTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-[#dfe4e7] bg-white p-4 shadow-sm",
        className
      )}
    >
      <SectionHeading title={title} tone={tone} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SidePanel({
  title,
  tone,
  children
}: {
  title: string;
  tone: InvoiceSectionTone;
  children: ReactNode;
}) {
  return (
    <section
      className="panel bg-white p-4"
    >
      <SectionHeading title={title} tone={tone} />
      <div className="mt-4">{children}</div>
    </section>
  );
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
  const [assistanceCompanies, setAssistanceCompanies] = useState<AssistanceCompany[]>(
    demoAssistanceCompanies
  );
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
  const activeAssistanceCompanies = useMemo(
    () => assistanceCompanies.filter((company) => company.active),
    [assistanceCompanies]
  );

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const systemSettings = useSystemSettings();
  const [invoiceDate, setInvoiceDate] = useState(() => todayISO());
  const [invoiceTime, setInvoiceTime] = useState(() => currentTimeHHMM());
  const [patientName, setPatientName] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [nationality, setNationality] = useState("");
  const [doctorId, setDoctorId] = useState(activeDoctors[0]?.id ?? "");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [assistanceCompanyId, setAssistanceCompanyId] = useState("");
  const [claimPercentage, setClaimPercentage] = useState(0);
  const [notes, setNotes] = useState("");
  const [serviceLines, setServiceLines] = useState<DraftLine[]>([]);
  const [chargeLines, setChargeLines] = useState<DraftLine[]>(() =>
    additionalChargeOptions.map((service) => ({
      id: makeId(),
      serviceId: service.id,
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
        setCatalogServices(
          (parsed as Service[]).map((service) => ({
            ...service,
            sellingPrice: Math.max(0, Math.round(service.sellingPrice)),
            defaultPayoutValue: Math.max(0, Math.round(service.defaultPayoutValue)),
            active: service.active ?? true
          }))
        );
      }
    } catch {
      setCatalogServices(services);
    }
  }, [services]);

  useEffect(() => {
    try {
      const storedCompanies = window.localStorage.getItem(assistanceCompanyStorageKey);
      if (!storedCompanies) {
        return;
      }

      const parsed = JSON.parse(storedCompanies);
      if (Array.isArray(parsed)) {
        setAssistanceCompanies(parsed as AssistanceCompany[]);
      }
    } catch {
      setAssistanceCompanies(demoAssistanceCompanies);
    }
  }, []);

  useEffect(() => {
    if (paymentMethod !== "insurance") {
      return;
    }

    if (!activeAssistanceCompanies.length) {
      setAssistanceCompanyId("");
      setClaimPercentage(0);
      return;
    }

    const selectedCompany = activeAssistanceCompanies.find(
      (company) => company.id === assistanceCompanyId
    );

    if (assistanceCompanyId && !selectedCompany) {
      setAssistanceCompanyId("");
      setClaimPercentage(0);
      return;
    }

    if (selectedCompany) {
      setClaimPercentage(roundPercentage(selectedCompany.defaultClaimPercentage));
    }
  }, [activeAssistanceCompanies, assistanceCompanyId, paymentMethod]);

  useEffect(() => {
    setServiceLines((current) => {
      return current.filter((line) =>
        clinicalServiceOptions.some((service) => service.id === line.serviceId)
      );
    });

    setChargeLines((current) =>
      additionalChargeOptions.map((service) => {
        const existing = current.find((line) => line.serviceId === service.id);

        return (
          existing ?? {
            id: makeId(),
            serviceId: service.id,
            amountUsd: 0
          }
        );
      })
    );
  }, [additionalChargeOptions, clinicalServiceOptions]);

  const medicationChargeService = additionalChargeOptions.find((service) =>
    service.name.toLowerCase().includes("medication")
  );
  const consumableChargeService = additionalChargeOptions.find((service) =>
    service.name.toLowerCase().includes("consumable")
  );
  const latestInvoiceNo = [...invoices.map((invoice) => invoice.invoiceNo)].sort().at(-1);
  const invoiceNo = nextInvoiceNumber(latestInvoiceNo, {
    prefix: systemSettings.invoice.invoicePrefix,
    timeZone: systemSettings.clinic.timeZone
  });
  const paymentSettings = systemSettings.doctorPayment;
  const activePaymentMode = systemSettings.operational.activePaymentMode;

  const serviceItemsUsd = useMemo<InvoiceItem[]>(
    () =>
      [...serviceLines, ...chargeLines]
        .map((line) => {
          const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);

          if (!service) {
            return null;
          }

          const isAmountOnlyService = isAmountOnlyInvoiceServiceName(service.name);
          const lineAmount = roundUsd(isAmountOnlyService ? line.amountUsd : service.sellingPrice);

          if (isAmountOnlyService && lineAmount <= 0) {
            return null;
          }

          return {
            id: line.id,
            serviceId: service.id,
            serviceName: service.name,
            category: service.category,
            quantity: 1,
            unitPrice: lineAmount,
            lineTotal: lineAmount
          } satisfies InvoiceItem;
        })
        .filter((item): item is InvoiceItem => Boolean(item)),
    [chargeLines, invoiceServices, serviceLines]
  );

  const invoiceItems = serviceItemsUsd;
  const clinicalInvoiceItems = invoiceItems.filter(
    (item) => !isAmountOnlyInvoiceServiceName(item.serviceName)
  );
  const medicationChargeItem = invoiceItems.find((item) =>
    item.serviceName.toLowerCase().includes("medication")
  );
  const consumableChargeItem = invoiceItems.find((item) =>
    item.serviceName.toLowerCase().includes("consumable")
  );
  const payoutEligibleItems = clinicalInvoiceItems.filter((item) =>
    isPayoutEligibleCategory(item.category)
  );
  const totals = calculateInvoiceTotals(invoiceItems, discount);
  const selectedAssistanceCompany = activeAssistanceCompanies.find(
    (company) => company.id === assistanceCompanyId
  );
  const claimAmount =
    paymentMethod === "insurance"
      ? roundUsd((totals.totalAmount * roundPercentage(claimPercentage)) / 100)
      : 0;
  const formReady =
    Boolean(patientName.trim()) &&
    Boolean(passport.trim()) &&
    Boolean(phone.trim()) &&
    Boolean(nationality.trim()) &&
    Boolean(doctorId) &&
    (paymentMethod !== "insurance" || Boolean(selectedAssistanceCompany)) &&
    invoiceItems.length > 0;
  const draftInvoice = {
    id: "draft",
    invoiceNo,
    date: invoiceDate,
    time: invoiceTime,
    patientName: patientName || "Draft patient",
    passport: passport || undefined,
    phone: phone || undefined,
    email: email || undefined,
    nationality: nationality || undefined,
    doctorId,
    items: invoiceItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    paymentMethod,
    assistanceCompanyId:
      paymentMethod === "insurance" ? selectedAssistanceCompany?.id : undefined,
    assistanceCompanyName:
      paymentMethod === "insurance" ? selectedAssistanceCompany?.name : undefined,
    claimPercentage: paymentMethod === "insurance" ? roundPercentage(claimPercentage) : undefined,
    claimAmount: paymentMethod === "insurance" ? claimAmount : undefined,
    claimStatus: paymentMethod === "insurance" ? "Draft" : undefined,
    notes: notes || undefined,
    totalAmount: totals.totalAmount,
    createdBy
  } satisfies Invoice;
  const payoutInvoice = {
    ...draftInvoice,
    items: payoutEligibleItems
  } satisfies Invoice;
  const payoutPreview = payoutEligibleItems.length
    ? generatePayoutsForInvoice(payoutInvoice, paymentSettings, activePaymentMode)
    : [];
  const payoutPreviewTotal = payoutPreview.reduce((sum, payout) => sum + payout.payoutAmount, 0);

  function addSelectedService(serviceId: string) {
    if (!serviceId) {
      return;
    }

    setServiceLines((current) => [
      ...current,
      { id: makeId(), serviceId, amountUsd: 0 }
    ]);
  }

  function removeServiceLine(id: string) {
    setServiceLines((current) => current.filter((line) => line.id !== id));
  }

  function buildInvoiceHtml(targetInvoice: Invoice) {
    const invoiceDoctor = doctorCatalog.find((doctor) => doctor.id === targetInvoice.doctorId);
    const itemRows = targetInvoice.items
      .map(
        (item) =>
          `<tr>
            <td>${escapeHtml(item.serviceName)}</td>
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
    <h1>${escapeHtml(systemSettings.clinic.clinicName)}</h1>
    <p>Invoice ${escapeHtml(targetInvoice.invoiceNo)} - ${escapeHtml(targetInvoice.date)} ${escapeHtml(targetInvoice.time)}</p>
    <p><strong>Patient:</strong> ${escapeHtml(targetInvoice.patientName)}</p>
    ${targetInvoice.email ? `<p><strong>Email:</strong> ${escapeHtml(targetInvoice.email)}</p>` : ""}
    <p><strong>Doctor:</strong> ${escapeHtml(invoiceDoctor?.name ?? "Unassigned")}</p>
    ${
      targetInvoice.paymentMethod === "insurance"
        ? `<p><strong>Assistance company:</strong> ${escapeHtml(targetInvoice.assistanceCompanyName ?? "Unassigned")}</p>`
        : ""
    }
    <h2>Services and charges</h2>
    <table>
      <thead>
        <tr><th>Item</th><th>Amount</th></tr>
      </thead>
      <tbody>${itemRows || '<tr><td colspan="2">No invoice items</td></tr>'}</tbody>
    </table>
    <div class="totals">
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

  function emailInvoice(targetInvoice: Invoice) {
    const invoiceDoctor = doctorCatalog.find((doctor) => doctor.id === targetInvoice.doctorId);

    openEmailDraft({
      to: targetInvoice.email,
      subject: `${systemSettings.clinic.clinicName} invoice ${targetInvoice.invoiceNo}`,
      body: [
        systemSettings.clinic.clinicName,
        "",
        `Invoice: ${targetInvoice.invoiceNo}`,
        `Date: ${targetInvoice.date} ${targetInvoice.time ?? ""}`.trim(),
        `Patient: ${targetInvoice.patientName}`,
        `Passport / ID: ${targetInvoice.passport ?? "N/A"}`,
        `Doctor: ${invoiceDoctor?.name ?? "Unassigned"}`,
        `Payment method: ${paymentLabels[targetInvoice.paymentMethod]}`,
        targetInvoice.paymentMethod === "insurance"
          ? `Assistance company: ${targetInvoice.assistanceCompanyName ?? "N/A"}`
          : "",
        `Invoice total: ${usdWhole(targetInvoice.totalAmount)}`,
        targetInvoice.paymentMethod === "insurance"
          ? `Claim amount: ${usdWhole(targetInvoice.claimAmount ?? 0)}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    });
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
      email: email.trim() || undefined,
      nationality: nationality.trim(),
      items: invoiceItems.map((item) => ({ ...item, id: makeId() }))
    };
    const nextInvoices = [createdInvoice, ...invoices];

    setInvoices(nextInvoices);
    setSavedInvoiceNo(createdInvoice.invoiceNo);
    setLastSavedInvoice(createdInvoice);
    if (systemSettings.invoice.automaticTimestamp) {
      setInvoiceDate(todayISO());
      setInvoiceTime(currentTimeHHMM(systemSettings.clinic.timeZone));
    }
    setPatientName("");
    setPassport("");
    setPhone("");
    setEmail("");
    setNationality("");
    setDiscount(0);
    setPaymentMethod("cash");
    setAssistanceCompanyId("");
    setClaimPercentage(0);
    setNotes("");
    setServiceLines([]);
    setChargeLines(
      additionalChargeOptions.map((service) => ({
        id: makeId(),
        serviceId: service.id,
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

  function selectAssistanceCompany(companyId: string) {
    setAssistanceCompanyId(companyId);
    const company = activeAssistanceCompanies.find((candidate) => candidate.id === companyId);
    setClaimPercentage(roundPercentage(company?.defaultClaimPercentage ?? 0));
  }

  function selectPaymentMethod(method: (typeof invoicePaymentMethods)[number]) {
    if (method === paymentMethod) {
      return;
    }

    setPaymentMethod(method);

    if (method !== "insurance") {
      setAssistanceCompanyId("");
      setClaimPercentage(0);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <WorkflowSection title="Invoice Information" tone="invoice">
          <InvoiceHeader
            invoiceNo={invoiceNo}
            invoiceDate={invoiceDate}
            invoiceTime={invoiceTime}
            formReady={formReady}
            lastSavedInvoice={lastSavedInvoice}
            draftInvoice={draftInvoice}
            onInvoiceDateChange={setInvoiceDate}
            onInvoiceTimeChange={setInvoiceTime}
            onPrintInvoice={printInvoice}
            onDownloadInvoice={downloadInvoice}
            onEmailInvoice={emailInvoice}
          />

          {savedInvoiceNo ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Saved {savedInvoiceNo}. The invoice is available in the local registry.
            </div>
          ) : null}
          </WorkflowSection>

          <div className="space-y-4">
            <WorkflowSection title="Patient Information" tone="patient">
              <PatientInformationFields
                patientName={patientName}
                passport={passport}
                phone={phone}
                email={email}
                nationality={nationality}
                onPatientNameChange={setPatientName}
                onPassportChange={setPassport}
                onPhoneChange={setPhone}
                onEmailChange={setEmail}
                onNationalityChange={setNationality}
              />
            </WorkflowSection>

            <WorkflowSection title="Billing Information" tone="billing">
              <BillingDetailsFields
                activeDoctors={activeDoctors}
                assistanceCompanies={activeAssistanceCompanies}
                doctorId={doctorId}
                paymentMethod={paymentMethod}
                assistanceCompanyId={assistanceCompanyId}
                onDoctorIdChange={setDoctorId}
                onPaymentMethodChange={selectPaymentMethod}
                onAssistanceCompanyChange={selectAssistanceCompany}
              />
            </WorkflowSection>

            <InvoiceServicesSection
              clinicalServiceOptions={clinicalServiceOptions}
              serviceLines={serviceLines}
              invoiceServices={invoiceServices}
              onServiceSelect={addSelectedService}
              onRemoveServiceLine={removeServiceLine}
            />
            <AdditionalChargesSection
              medicationChargeService={medicationChargeService}
              consumableChargeService={consumableChargeService}
              chargeLines={chargeLines}
              onChargeLineChange={updateChargeLine}
            />

            <div className="grid gap-4 md:grid-cols-[1fr_260px]">
              <NotesSection notes={notes} onNotesChange={setNotes} />
              <TotalsPanel
                discount={discount}
                totals={totals}
                formReady={formReady}
                onDiscountChange={(value) => setDiscount(roundUsd(value))}
                onSaveInvoice={saveInvoice}
              />
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <SidePanel title="Invoice Preview" tone="preview">
            <div className="space-y-4">
              <PreviewGroup title="Clinical Services" items={clinicalInvoiceItems} />
              <div className="rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#46484a]">Medication Charges</span>
                  <span className="font-semibold text-[#224770]">
                    {usdWhole(medicationChargeItem?.lineTotal ?? 0)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-[#46484a]">Consumable Charges</span>
                  <span className="font-semibold text-[#224770]">
                    {usdWhole(consumableChargeItem?.lineTotal ?? 0)}
                  </span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-[#46484a]">Discount</span>
                  <span className="font-semibold text-[#224770]">{usdWhole(totals.discount)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-[#efefef] pt-2 text-base">
                  <span className="font-semibold text-[#224770]">Grand Total</span>
                  <span className="font-bold text-[#0eb6ef]">{usdWhole(totals.totalAmount)}</span>
                </div>
              </div>
            </div>
          </SidePanel>

          <SidePanel title="Doctor Payout Preview" tone="payout">
            <div className="rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#46484a]">Current Payment Mode</span>
                <span className="font-semibold text-[#224770]">
                  {paymentModeLabels[activePaymentMode]}
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {payoutPreview.length ? (
                <>
                  {payoutPreview.map((payout) => (
                    <div key={payout.id} className="rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-[#224770]">{payout.serviceName}</p>
                        <p className="text-sm font-bold text-[#84bc3f]">{money(payout.payoutAmount)}</p>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#46484a]">{payout.paymentReason}</p>
                    </div>
                  ))}
                  <div className="flex justify-between rounded-md bg-[#84bc3f]/12 px-3 py-2 text-sm font-semibold text-[#4f7f22]">
                    <span>Estimated total payout {systemSettings.clinic.localCurrency}</span>
                    <span>{money(payoutPreviewTotal)}</span>
                  </div>
                </>
              ) : (
                <p className="rounded-md bg-[#efefef] p-3 text-sm text-[#46484a]">
                  No doctor payout is estimated for the current invoice.
                </p>
              )}
            </div>
          </SidePanel>

        </aside>
    </div>
  );
}

function SectionHeading({ title, tone = "invoice" }: { title: string; tone?: InvoiceSectionTone }) {
  return (
    <div className="flex items-center gap-3 border-b border-[#efefef] pb-3">
      <span
        className="h-1.5 w-8 rounded-full"
        style={{ backgroundColor: invoiceSectionColors[tone] }}
        aria-hidden="true"
      />
      <h3 className="font-semibold text-[#224770]">{title}</h3>
    </div>
  );
}

function FieldShell({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

function InvoiceTimestampFields({
  invoiceDate,
  invoiceTime,
  onInvoiceDateChange,
  onInvoiceTimeChange
}: {
  invoiceDate: string;
  invoiceTime: string;
  onInvoiceDateChange: (value: string) => void;
  onInvoiceTimeChange: (value: string) => void;
}) {
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
          onChange={(event) => onInvoiceDateChange(event.target.value)}
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
          onChange={(event) => onInvoiceTimeChange(event.target.value)}
          className="field mt-2"
        />
      </FieldShell>
    </>
  );
}

function InvoiceHeader({
  invoiceNo,
  invoiceDate,
  invoiceTime,
  formReady,
  lastSavedInvoice,
  draftInvoice,
  onInvoiceDateChange,
  onInvoiceTimeChange,
  onPrintInvoice,
  onDownloadInvoice,
  onEmailInvoice
}: {
  invoiceNo: string;
  invoiceDate: string;
  invoiceTime: string;
  formReady: boolean;
  lastSavedInvoice: Invoice | null;
  draftInvoice: Invoice;
  onInvoiceDateChange: (value: string) => void;
  onInvoiceTimeChange: (value: string) => void;
  onPrintInvoice: (invoice: Invoice) => void;
  onDownloadInvoice: (invoice: Invoice) => void;
  onEmailInvoice: (invoice: Invoice) => void;
}) {
  return (
    <div>
      <div className="grid gap-4 2xl:grid-cols-[minmax(260px,0.9fr)_minmax(360px,1fr)_auto] 2xl:items-end">
        <div className="min-w-0 rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-4">
          <p className="label">Invoice No.</p>
          <h2 className="mt-2 overflow-x-auto whitespace-nowrap text-base font-bold tracking-tight text-[#224770] sm:text-lg">
            {invoiceNo}
          </h2>
          <p className="mt-1 whitespace-nowrap text-sm text-[#46484a]">
            {invoiceDate} at {invoiceTime}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <InvoiceTimestampFields
            invoiceDate={invoiceDate}
            invoiceTime={invoiceTime}
            onInvoiceDateChange={onInvoiceDateChange}
            onInvoiceTimeChange={onInvoiceTimeChange}
          />
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onPrintInvoice(lastSavedInvoice ?? draftInvoice)}
            disabled={!formReady && !lastSavedInvoice}
            className={buttonClass(
              formReady || lastSavedInvoice ? "secondary" : "muted",
              "min-h-11 px-3 py-2"
            )}
          >
            Print
          </button>
          <button
            type="button"
            onClick={() => onDownloadInvoice(lastSavedInvoice ?? draftInvoice)}
            disabled={!formReady && !lastSavedInvoice}
            className={buttonClass(
              formReady || lastSavedInvoice ? "secondary" : "muted",
              "min-h-11 px-3 py-2"
            )}
          >
            Download HTML
          </button>
          <button
            type="button"
            onClick={() => onEmailInvoice(lastSavedInvoice ?? draftInvoice)}
            disabled={!formReady && !lastSavedInvoice}
            className={buttonClass(
              formReady || lastSavedInvoice ? "secondary" : "muted",
              "min-h-11 px-3 py-2"
            )}
          >
            Email
          </button>
        </div>
      </div>
    </div>
  );
}

function PatientInformationFields({
  patientName,
  passport,
  phone,
  email,
  nationality,
  onPatientNameChange,
  onPassportChange,
  onPhoneChange,
  onEmailChange,
  onNationalityChange
}: {
  patientName: string;
  passport: string;
  phone: string;
  email: string;
  nationality: string;
  onPatientNameChange: (value: string) => void;
  onPassportChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onNationalityChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FieldShell>
        <label className="label" htmlFor="patientName">
          Patient name
        </label>
        <input
          id="patientName"
          value={patientName}
          onChange={(event) => onPatientNameChange(event.target.value)}
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
          onChange={(event) => onPassportChange(event.target.value)}
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
          onChange={(event) => onPhoneChange(event.target.value)}
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
          onChange={(event) => onNationalityChange(event.target.value)}
          className="field mt-2"
          placeholder="Required"
          required
        />
      </FieldShell>
      <div className="md:col-span-2">
        <label className="label" htmlFor="email">
          Email (optional)
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          className="field mt-2"
          placeholder="Optional"
        />
      </div>
    </div>
  );
}

function BillingDetailsFields({
  activeDoctors,
  assistanceCompanies,
  doctorId,
  paymentMethod,
  assistanceCompanyId,
  onDoctorIdChange,
  onPaymentMethodChange,
  onAssistanceCompanyChange
}: {
  activeDoctors: Doctor[];
  assistanceCompanies: AssistanceCompany[];
  doctorId: string;
  paymentMethod: PaymentMethod;
  assistanceCompanyId: string;
  onDoctorIdChange: (value: string) => void;
  onPaymentMethodChange: (value: (typeof invoicePaymentMethods)[number]) => void;
  onAssistanceCompanyChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)] lg:items-start">
      <FieldShell>
        <label className="label" htmlFor="doctor">
          Doctor
        </label>
        <select
          id="doctor"
          value={doctorId}
          onChange={(event) => onDoctorIdChange(event.target.value)}
          className="field mt-2 min-h-12"
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
      <div className="space-y-4">
        <PaymentMethodButtons
          paymentMethod={paymentMethod}
          onPaymentMethodChange={onPaymentMethodChange}
        />
      </div>

      {paymentMethod === "insurance" ? (
        <div className="lg:col-span-2">
          <InsuranceClaimFields
            assistanceCompanies={assistanceCompanies}
            assistanceCompanyId={assistanceCompanyId}
            onAssistanceCompanyChange={onAssistanceCompanyChange}
          />
        </div>
      ) : null}
    </div>
  );
}

function PaymentMethodButtons({
  paymentMethod,
  onPaymentMethodChange
}: {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (value: (typeof invoicePaymentMethods)[number]) => void;
}) {
  return (
    <div>
      <p className="label" id="payment-method-label">
        Payment Method
      </p>
      <div
        aria-labelledby="payment-method-label"
        className="mt-2 grid gap-3 sm:grid-cols-3"
        role="radiogroup"
      >
        {invoicePaymentMethods.map((method) => {
          const isSelected = paymentMethod === method;

          return (
            <button
              key={method}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onPaymentMethodChange(method)}
              className={cn(
                "focus-ring min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition duration-200 ease-out",
                isSelected
                  ? "border-[#84BC3F] bg-[#84BC3F] text-white shadow-sm"
                  : "border-[#dfe4e7] bg-[#efefef]/45 text-[#46484a] hover:border-[#0eb6ef] hover:bg-white hover:text-[#224770]"
              )}
            >
              {paymentLabels[method]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InsuranceClaimFields({
  assistanceCompanies,
  assistanceCompanyId,
  onAssistanceCompanyChange
}: {
  assistanceCompanies: AssistanceCompany[];
  assistanceCompanyId: string;
  onAssistanceCompanyChange: (value: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[#dfe4e7] bg-[#efefef]/45 p-3">
      <FieldShell>
        <label className="label" htmlFor="assistance-company">
          Assistance Company
        </label>
        <select
          id="assistance-company"
          value={assistanceCompanyId}
          onChange={(event) => onAssistanceCompanyChange(event.target.value)}
          disabled={!assistanceCompanies.length}
          className="field mt-2 min-h-12"
          required
        >
          <option value="">
            {assistanceCompanies.length ? "Select assistance company" : "No active companies"}
          </option>
          {assistanceCompanies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </FieldShell>
    </div>
  );
}

function InvoiceServicesSection({
  clinicalServiceOptions,
  serviceLines,
  invoiceServices,
  onServiceSelect,
  onRemoveServiceLine
}: {
  clinicalServiceOptions: Service[];
  serviceLines: DraftLine[];
  invoiceServices: Service[];
  onServiceSelect: (serviceId: string) => void;
  onRemoveServiceLine: (id: string) => void;
}) {
  return (
    <WorkflowSection title="Clinical Services" tone="services">
      {clinicalServiceOptions.length ? (
        <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {clinicalServiceOptions.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onServiceSelect(candidate.id)}
              className="focus-ring flex min-h-24 flex-col justify-between rounded-md bg-[#224770] p-3 text-left text-white shadow-sm transition duration-150 hover:-translate-y-0.5 hover:bg-[#0EB6EF] active:translate-y-0"
            >
              <span className="text-sm font-semibold leading-5">{candidate.name}</span>
              <span className="mt-3 inline-flex w-fit rounded bg-white/15 px-2 py-1 text-sm font-bold">
                {usdWhole(roundUsd(candidate.sellingPrice))}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4 space-y-2">
        {serviceLines.map((line) => {
          const service = invoiceServices.find((candidate) => candidate.id === line.serviceId);
          const lineTotalUsd = roundUsd(service?.sellingPrice ?? 0);

          return (
            <div
              key={line.id}
              className="flex flex-col gap-3 rounded-md border border-[#dfe4e7] bg-white p-3 sm:flex-row sm:items-center"
            >
              <p className="min-w-0 flex-1 text-sm font-semibold text-[#224770]">
                {service?.name ?? "Unknown service"}
              </p>
              <span className="text-sm font-bold text-[#224770]">{usdWhole(lineTotalUsd)}</span>
              <button
                type="button"
                onClick={() => onRemoveServiceLine(line.id)}
                className={buttonClass("danger", "h-10 px-3 py-0 text-xs")}
                aria-label="Remove service line"
              >
                Remove
              </button>
            </div>
          );
        })}
        {!serviceLines.length ? (
          <p className="rounded-md border border-dashed border-[#dfe4e7] bg-[#efefef]/55 p-4 text-sm text-[#46484a]">
            {clinicalServiceOptions.length
              ? "Tap a service tile to add it to the invoice."
              : "No active clinical services are available."}
          </p>
        ) : null}
      </div>
    </WorkflowSection>
  );
}

function AdditionalChargeInput({
  label,
  service,
  chargeLines,
  onAmountChange
}: {
  label: string;
  service?: Service;
  chargeLines: DraftLine[];
  onAmountChange: (serviceId: string, amountUsd: number) => void;
}) {
  if (!service) {
    return (
      <p className="rounded-xl border border-[#efefef] bg-[#efefef] p-4 text-sm text-[#46484a]">
        Charge service is not active.
      </p>
    );
  }

  const line = chargeLines.find((chargeLine) => chargeLine.serviceId === service.id);

  return (
    <div className="grid gap-3 rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-3 sm:grid-cols-[minmax(0,1fr)_180px] sm:items-center">
      <label className="text-sm font-semibold text-[#224770]" htmlFor={`charge-${service.id}`}>
        {label}
      </label>
      <div className="flex items-center overflow-hidden rounded-lg border border-[#dbe3ea] bg-white focus-within:ring-2 focus-within:ring-[#0eb6ef]/20">
        <span className="px-3 text-sm font-semibold text-[#46484a]">$</span>
        <input
          id={`charge-${service.id}`}
          type="number"
          min={0}
          step="1"
          value={line?.amountUsd ?? 0}
          onChange={(event) => onAmountChange(service.id, Number(event.target.value))}
          className="h-10 w-full border-0 bg-transparent px-3 py-2 text-right text-sm font-semibold text-[#224770] outline-none"
          placeholder="0"
        />
      </div>
    </div>
  );
}

function AdditionalChargesSection({
  medicationChargeService,
  consumableChargeService,
  chargeLines,
  onChargeLineChange
}: {
  medicationChargeService?: Service;
  consumableChargeService?: Service;
  chargeLines: DraftLine[];
  onChargeLineChange: (serviceId: string, amountUsd: number) => void;
}) {
  return (
    <WorkflowSection title="Additional Charges" tone="charges">
      <div className="grid gap-3">
        <AdditionalChargeInput
          label="Medication Charges"
          service={medicationChargeService}
          chargeLines={chargeLines}
          onAmountChange={onChargeLineChange}
        />
        <AdditionalChargeInput
          label="Consumable Charges"
          service={consumableChargeService}
          chargeLines={chargeLines}
          onAmountChange={onChargeLineChange}
        />
      </div>
    </WorkflowSection>
  );
}

function NotesSection({
  notes,
  onNotesChange
}: {
  notes: string;
  onNotesChange: (value: string) => void;
}) {
  return (
    <WorkflowSection title="Notes" tone="notes">
      <textarea
        id="notes"
        value={notes}
        onChange={(event) => onNotesChange(event.target.value)}
        className="field min-h-28"
        placeholder="Clinical or billing notes for the invoice"
      />
    </WorkflowSection>
  );
}

function TotalsPanel({
  discount,
  totals,
  formReady,
  onDiscountChange,
  onSaveInvoice
}: {
  discount: number;
  totals: InvoiceTotals;
  formReady: boolean;
  onDiscountChange: (value: number) => void;
  onSaveInvoice: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-[#dfe4e7] bg-white p-4 shadow-sm"
    >
      <SectionHeading title="Invoice Total" tone="totals" />
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <label className="label" htmlFor="discount">
            Discount
          </label>
          <input
            id="discount"
            type="number"
            min={0}
            step="1"
            value={discount}
            onChange={(event) => onDiscountChange(Number(event.target.value))}
            className="field mt-2"
          />
        </div>
        <div className="flex justify-between border-t border-[#efefef] pt-3 text-base">
          <span className="font-semibold text-[#224770]">Grand Total</span>
          <span className="font-bold text-[#0eb6ef]">{usdWhole(totals.totalAmount)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSaveInvoice}
        disabled={!formReady}
        className={buttonClass(
          formReady ? "success" : "muted",
          "mt-4 min-h-12 w-full"
        )}
      >
        Save invoice
      </button>
    </div>
  );
}

function PreviewGroup({ title, items }: { title: string; items: InvoiceItem[] }) {
  return (
    <div className="rounded-md border border-[#dfe4e7] bg-[#efefef]/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#224770]">{title}</p>
        <p className="text-sm font-bold text-[#224770]">
          {usdWhole(items.reduce((sum, item) => sum + item.lineTotal, 0))}
        </p>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-3 text-xs text-[#46484a]">
              <span>
                {item.serviceName}
              </span>
              <span className="font-semibold text-[#224770]">{usdWhole(item.lineTotal)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#46484a]">No items added.</p>
      )}
    </div>
  );
}
