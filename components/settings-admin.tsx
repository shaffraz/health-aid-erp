"use client";

import { useEffect, useMemo, useState } from "react";
import { buttonClass } from "@/components/erp-ui";
import { generateId } from "@/lib/id";
import {
  defaultSystemSettings,
  loadSystemSettings,
  normalizeSystemSettings,
  paymentModeLabels,
  paymentModeValues,
  saveSystemSettings,
  type ClinicSettings,
  type InsuranceSettings,
  type InvoiceSettings,
  type OperationalSettings,
  type SeasonSettings,
  type SystemSettings
} from "@/lib/settings";
import type { DoctorPaymentModelType } from "@/lib/types";
import { cn } from "@/lib/utils";

type SettingsAdminProps = {
  canEdit: boolean;
  currentUserName: string;
};

type ActiveSectionKey =
  | "clinic"
  | "operational"
  | "seasons"
  | "invoice"
  | "doctorPayment"
  | "insurance";

type FutureSectionKey = "userSecurity" | "notifications" | "system";
type SectionKey = ActiveSectionKey | FutureSectionKey;

const sectionLabels: Record<SectionKey, string> = {
  clinic: "General",
  operational: "Operational",
  seasons: "Seasons",
  invoice: "Invoices",
  doctorPayment: "Doctor Payments",
  insurance: "Insurance",
  userSecurity: "Users & Security",
  notifications: "Notifications",
  system: "System"
};

const activeSections: ActiveSectionKey[] = [
  "clinic",
  "operational",
  "seasons",
  "invoice",
  "doctorPayment",
  "insurance"
];

const futureSections: FutureSectionKey[] = ["userSecurity", "notifications", "system"];

function toAmount(value: string | number, fallback = 0) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : fallback;
}

function toBoolean(value: string) {
  return value === "yes";
}

function sectionDirty<Key extends SectionKey>(
  saved: SystemSettings,
  draft: SystemSettings,
  section: Key
) {
  return JSON.stringify(saved[section]) !== JSON.stringify(draft[section]);
}

function displayDateTime(value: string) {
  if (!value) {
    return "Not changed yet";
  }

  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efefef] bg-white p-4">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value || "Not configured"}</p>
    </div>
  );
}

function FieldShell({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="field min-h-12 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min = 0
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  min?: number;
}) {
  return (
    <FieldShell label={label}>
      <input
        type="number"
        min={min}
        step="1"
        value={value}
        onChange={(event) => onChange(toAmount(event.target.value, value))}
        disabled={disabled}
        className="field min-h-12 disabled:bg-slate-100 disabled:text-slate-500"
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FieldShell label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="field min-h-12 disabled:bg-slate-100 disabled:text-slate-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function YesNoField({
  label,
  value,
  onChange,
  disabled
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
}) {
  return (
    <SelectField
      label={label}
      value={value ? "yes" : "no"}
      onChange={(nextValue) => onChange(toBoolean(nextValue))}
      disabled={disabled}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" }
      ]}
    />
  );
}

function SettingsSection({
  section,
  open,
  dirty,
  canEdit,
  future,
  onToggle,
  onSave,
  onCancel,
  children
}: {
  section: SectionKey;
  open: boolean;
  dirty: boolean;
  canEdit: boolean;
  future?: boolean;
  onToggle: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-sm transition",
        dirty ? "border-amber-300 ring-2 ring-amber-100" : "border-[#efefef]"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#efefef]/40"
      >
        <div>
          <h2 className="font-semibold text-[#224770]">{sectionLabels[section]}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {dirty ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Unsaved changes
              </span>
            ) : null}
            {future ? (
              <span className="rounded-full bg-[#efefef] px-3 py-1 text-xs font-semibold text-[#46484a]">
                Future section
              </span>
            ) : null}
            {!canEdit && !future ? (
              <span className="rounded-full bg-[#efefef] px-3 py-1 text-xs font-semibold text-[#46484a]">
                Read-only
              </span>
            ) : null}
          </div>
        </div>
        <span className="rounded-full bg-[#efefef] px-3 py-1 text-sm font-semibold text-[#224770]">
          {open ? "Close" : "Open"}
        </span>
      </button>

      {open ? (
        <div className="border-t border-[#efefef]">
          <div className="p-5">{children}</div>
          {!future ? (
            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] bg-[#fafafa] px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={!dirty}
                className={buttonClass("secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={!canEdit || !dirty}
                className={buttonClass(canEdit && dirty ? "primary" : "muted")}
              >
                Save Changes
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function SettingsAdmin({ canEdit, currentUserName }: SettingsAdminProps) {
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(
    normalizeSystemSettings(defaultSystemSettings)
  );
  const [draftSettings, setDraftSettings] = useState<SystemSettings>(
    normalizeSystemSettings(defaultSystemSettings)
  );
  const [openSections, setOpenSections] = useState<SectionKey[]>(["clinic"]);

  useEffect(() => {
    const settings = loadSystemSettings();
    setSavedSettings(settings);
    setDraftSettings(settings);
  }, []);

  const dirtySections = useMemo(
    () =>
      [...activeSections, ...futureSections].filter((section) =>
        sectionDirty(savedSettings, draftSettings, section)
      ),
    [draftSettings, savedSettings]
  );

  function updateClinic(patch: Partial<ClinicSettings>) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        clinic: { ...current.clinic, ...patch }
      })
    );
  }

  function updateOperational(patch: Partial<OperationalSettings>) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        operational: { ...current.operational, ...patch },
        doctorPayment: {
          ...current.doctorPayment,
          activeModel: patch.defaultOperatingMode ?? current.operational.defaultOperatingMode
        }
      })
    );
  }

  function updateInvoice(patch: Partial<InvoiceSettings>) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        invoice: { ...current.invoice, ...patch }
      })
    );
  }

  function updateInsurance(patch: Partial<InsuranceSettings>) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        insurance: { ...current.insurance, ...patch }
      })
    );
  }

  function updateSeason(id: string, patch: Partial<SeasonSettings>) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        seasons: current.seasons.map((season) =>
          season.id === id ? { ...season, ...patch } : season
        )
      })
    );
  }

  function addSeason() {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        seasons: [
          ...current.seasons,
          {
            id: generateId(),
            name: "New Season",
            startDate: "01-01",
            endDate: "12-31",
            active: true
          }
        ]
      })
    );
  }

  function removeSeason(id: string) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        seasons: current.seasons.filter((season) => season.id !== id)
      })
    );
  }

  function toggleSection(section: SectionKey) {
    setOpenSections((current) =>
      current.includes(section)
        ? current.filter((candidate) => candidate !== section)
        : [...current, section]
    );
  }

  function openSection(section: SectionKey) {
    setOpenSections((current) =>
      current.includes(section) ? current : [...current, section]
    );
  }

  function saveSection(section: ActiveSectionKey) {
    if (!canEdit) {
      return;
    }

    let nextSettings = normalizeSystemSettings({
      ...savedSettings,
      [section]: draftSettings[section]
    });

    if (section === "operational") {
      const modeChanged =
        savedSettings.operational.defaultOperatingMode !==
        draftSettings.operational.defaultOperatingMode;

      nextSettings = normalizeSystemSettings({
        ...nextSettings,
        operational: {
          ...nextSettings.operational,
          lastChangedBy: modeChanged
            ? currentUserName
            : nextSettings.operational.lastChangedBy,
          lastChangedAt: modeChanged ? new Date().toISOString() : nextSettings.operational.lastChangedAt
        },
        doctorPayment: {
          ...nextSettings.doctorPayment,
          activeModel: draftSettings.operational.defaultOperatingMode
        }
      });
    }

    if (section === "doctorPayment") {
      nextSettings = normalizeSystemSettings({
        ...nextSettings,
        doctorPayment: {
          ...draftSettings.doctorPayment,
          activeModel: savedSettings.operational.defaultOperatingMode
        }
      });
    }

    saveSystemSettings(nextSettings);
    setSavedSettings(nextSettings);
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        [section]: nextSettings[section],
        operational: nextSettings.operational,
        doctorPayment: nextSettings.doctorPayment
      })
    );
  }

  function cancelSection(section: ActiveSectionKey) {
    if (
      sectionDirty(savedSettings, draftSettings, section) &&
      !window.confirm("Discard unsaved changes in this section?")
    ) {
      return;
    }

    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        [section]: savedSettings[section],
        operational:
          section === "operational" ? savedSettings.operational : current.operational,
        doctorPayment:
          section === "operational" || section === "doctorPayment"
            ? savedSettings.doctorPayment
            : current.doctorPayment
      })
    );
  }

  const editable = canEdit;

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="panel h-fit p-3 xl:sticky xl:top-5">
        <nav className="space-y-1" aria-label="Settings sections">
          {[...activeSections, ...futureSections].map((section) => {
            const dirty = dirtySections.includes(section);

            return (
              <button
                key={section}
                type="button"
                onClick={() => openSection(section)}
                className={cn(
                  "focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition",
                  openSections.includes(section)
                    ? "bg-[#224770] text-white"
                    : "text-[#46484a] hover:bg-[#efefef]"
                )}
              >
                <span>{sectionLabels[section]}</span>
                {dirty ? <span className="h-2 w-2 rounded-full bg-amber-400" /> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-4">
        {!canEdit ? (
          <div className="rounded-xl border border-[#efefef] bg-white p-4 text-sm font-semibold text-[#46484a]">
            Director access is read-only in this phase.
          </div>
        ) : null}

        <SettingsSection
          section="clinic"
          open={openSections.includes("clinic")}
          dirty={sectionDirty(savedSettings, draftSettings, "clinic")}
          canEdit={editable}
          onToggle={() => toggleSection("clinic")}
          onSave={() => saveSection("clinic")}
          onCancel={() => cancelSection("clinic")}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Clinic Name"
              value={draftSettings.clinic.clinicName}
              onChange={(clinicName) => updateClinic({ clinicName })}
              disabled={!editable}
            />
            <TextField
              label="Brand Logo"
              value={draftSettings.clinic.brandLogo}
              onChange={(brandLogo) => updateClinic({ brandLogo })}
              disabled={!editable}
            />
            <TextField
              label="Address"
              value={draftSettings.clinic.address}
              onChange={(address) => updateClinic({ address })}
              disabled={!editable}
            />
            <TextField
              label="Phone Number"
              value={draftSettings.clinic.phoneNumber}
              onChange={(phoneNumber) => updateClinic({ phoneNumber })}
              disabled={!editable}
            />
            <TextField
              label="Email"
              value={draftSettings.clinic.email}
              onChange={(email) => updateClinic({ email })}
              disabled={!editable}
              type="email"
            />
            <TextField
              label="Website"
              value={draftSettings.clinic.website}
              onChange={(website) => updateClinic({ website })}
              disabled={!editable}
            />
            <TextField
              label="Tax Registration"
              value={draftSettings.clinic.taxRegistration}
              onChange={(taxRegistration) => updateClinic({ taxRegistration })}
              disabled={!editable}
              placeholder="Future"
            />
            <SelectField
              label="Time Zone"
              value={draftSettings.clinic.timeZone}
              onChange={(timeZone) => updateClinic({ timeZone })}
              disabled={!editable}
              options={[
                { value: "Asia/Colombo", label: "GMT+5:30" },
                { value: "UTC", label: "UTC" }
              ]}
            />
            <TextField
              label="Currency"
              value={draftSettings.clinic.currency}
              onChange={(currency) => updateClinic({ currency: currency.toUpperCase() })}
              disabled={!editable}
            />
            <TextField
              label="Local Currency"
              value={draftSettings.clinic.localCurrency}
              onChange={(localCurrency) =>
                updateClinic({ localCurrency: localCurrency.toUpperCase() })
              }
              disabled={!editable}
            />
            <TextField
              label="Date Format"
              value={draftSettings.clinic.dateFormat}
              onChange={(dateFormat) => updateClinic({ dateFormat })}
              disabled={!editable}
            />
            <TextField
              label="Time Format"
              value={draftSettings.clinic.timeFormat}
              onChange={(timeFormat) => updateClinic({ timeFormat })}
              disabled={!editable}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="operational"
          open={openSections.includes("operational")}
          dirty={sectionDirty(savedSettings, draftSettings, "operational")}
          canEdit={editable}
          onToggle={() => toggleSection("operational")}
          onSave={() => saveSection("operational")}
          onCancel={() => cancelSection("operational")}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <SelectField
              label="Default Operating Mode"
              value={draftSettings.operational.defaultOperatingMode}
              onChange={(defaultOperatingMode) =>
                updateOperational({
                  defaultOperatingMode: defaultOperatingMode as DoctorPaymentModelType
                })
              }
              disabled={!editable}
              options={[
                {
                  value: paymentModeValues.onCall,
                  label: paymentModeLabels[paymentModeValues.onCall]
                },
                {
                  value: paymentModeValues.clinicShift,
                  label: paymentModeLabels[paymentModeValues.clinicShift]
                }
              ]}
            />
            <InfoBox
              label="Last Changed By"
              value={draftSettings.operational.lastChangedBy}
            />
            <InfoBox
              label="Last Changed Date / Time"
              value={displayDateTime(draftSettings.operational.lastChangedAt)}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="seasons"
          open={openSections.includes("seasons")}
          dirty={sectionDirty(savedSettings, draftSettings, "seasons")}
          canEdit={editable}
          onToggle={() => toggleSection("seasons")}
          onSave={() => saveSection("seasons")}
          onCancel={() => cancelSection("seasons")}
        >
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addSeason}
                disabled={!editable}
                className={buttonClass("primary")}
              >
                Add Season
              </button>
            </div>
            {draftSettings.seasons.map((season) => (
              <div
                key={season.id}
                className="grid gap-4 rounded-xl border border-[#efefef] bg-[#fafafa] p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
              >
                <TextField
                  label="Season Name"
                  value={season.name}
                  onChange={(name) => updateSeason(season.id, { name })}
                  disabled={!editable}
                />
                <TextField
                  label="Start Date"
                  value={season.startDate}
                  onChange={(startDate) => updateSeason(season.id, { startDate })}
                  disabled={!editable}
                  placeholder="MM-DD"
                />
                <TextField
                  label="End Date"
                  value={season.endDate}
                  onChange={(endDate) => updateSeason(season.id, { endDate })}
                  disabled={!editable}
                  placeholder="MM-DD"
                />
                <YesNoField
                  label="Active"
                  value={season.active}
                  onChange={(active) => updateSeason(season.id, { active })}
                  disabled={!editable}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeSeason(season.id)}
                    disabled={!editable || draftSettings.seasons.length <= 1}
                    className={buttonClass("danger", "min-h-12 w-full")}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          section="invoice"
          open={openSections.includes("invoice")}
          dirty={sectionDirty(savedSettings, draftSettings, "invoice")}
          canEdit={editable}
          onToggle={() => toggleSection("invoice")}
          onSave={() => saveSection("invoice")}
          onCancel={() => cancelSection("invoice")}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Invoice Prefix"
              value={draftSettings.invoice.invoicePrefix}
              onChange={(invoicePrefix) => updateInvoice({ invoicePrefix: invoicePrefix.trim() })}
              disabled={!editable}
            />
            <TextField
              label="Invoice Number Format"
              value={draftSettings.invoice.invoiceNumberFormat}
              onChange={(invoiceNumberFormat) => updateInvoice({ invoiceNumberFormat })}
              disabled={!editable}
            />
            <YesNoField
              label="Automatic Time Stamp"
              value={draftSettings.invoice.automaticTimestamp}
              onChange={(automaticTimestamp) => updateInvoice({ automaticTimestamp })}
              disabled={!editable}
            />
            <TextField
              label="Default Currency"
              value={draftSettings.invoice.defaultCurrency}
              onChange={(defaultCurrency) =>
                updateInvoice({ defaultCurrency: defaultCurrency.toUpperCase() })
              }
              disabled={!editable}
            />
            <YesNoField
              label="Allow Invoice Editing"
              value={draftSettings.invoice.allowInvoiceEditing}
              onChange={(allowInvoiceEditing) => updateInvoice({ allowInvoiceEditing })}
              disabled={!editable}
            />
            <YesNoField
              label="Allow Invoice Voiding"
              value={draftSettings.invoice.allowInvoiceVoiding}
              onChange={(allowInvoiceVoiding) => updateInvoice({ allowInvoiceVoiding })}
              disabled={!editable}
            />
            <TextField
              label="Print Layout"
              value={draftSettings.invoice.printLayout}
              onChange={(printLayout) => updateInvoice({ printLayout })}
              disabled={!editable}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="doctorPayment"
          open={openSections.includes("doctorPayment")}
          dirty={sectionDirty(savedSettings, draftSettings, "doctorPayment")}
          canEdit={editable}
          onToggle={() => toggleSection("doctorPayment")}
          onSave={() => saveSection("doctorPayment")}
          onCancel={() => cancelSection("doctorPayment")}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-[#efefef] bg-[#fafafa] p-4">
              <h3 className="font-semibold text-[#224770]">
                {paymentModeLabels[paymentModeValues.onCall]}
              </h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-4">
                <NumberField
                  label="Day Consultation Rate"
                  value={draftSettings.doctorPayment.lowSeason.dayConsultationPayout}
                  onChange={(dayConsultationPayout) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          lowSeason: {
                            ...current.doctorPayment.lowSeason,
                            dayConsultationPayout
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <NumberField
                  label="Night Consultation Rate"
                  value={draftSettings.doctorPayment.lowSeason.nightConsultationPayout}
                  onChange={(nightConsultationPayout) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          lowSeason: {
                            ...current.doctorPayment.lowSeason,
                            nightConsultationPayout
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <TextField
                  label="Night Start Time"
                  type="time"
                  value={draftSettings.doctorPayment.lowSeason.nightStartTime}
                  onChange={(nightStartTime) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          lowSeason: {
                            ...current.doctorPayment.lowSeason,
                            nightStartTime
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <TextField
                  label="Night End Time"
                  type="time"
                  value={draftSettings.doctorPayment.lowSeason.nightEndTime}
                  onChange={(nightEndTime) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          lowSeason: {
                            ...current.doctorPayment.lowSeason,
                            nightEndTime
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
              </div>
            </div>

            <div className="rounded-xl border border-[#efefef] bg-[#fafafa] p-4">
              <h3 className="font-semibold text-[#224770]">
                {paymentModeLabels[paymentModeValues.clinicShift]}
              </h3>
              <div className="mt-4 grid gap-4 lg:grid-cols-5">
                <NumberField
                  label="Hourly Rate"
                  value={draftSettings.doctorPayment.peakSeason.hourlyRate}
                  onChange={(hourlyRate) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          peakSeason: {
                            ...current.doctorPayment.peakSeason,
                            hourlyRate
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <TextField
                  label="Shift Start"
                  type="time"
                  value={draftSettings.doctorPayment.peakSeason.shiftStartTime}
                  onChange={(shiftStartTime) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          peakSeason: {
                            ...current.doctorPayment.peakSeason,
                            shiftStartTime
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <TextField
                  label="Shift End"
                  type="time"
                  value={draftSettings.doctorPayment.peakSeason.shiftEndTime}
                  onChange={(shiftEndTime) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          peakSeason: {
                            ...current.doctorPayment.peakSeason,
                            shiftEndTime
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <NumberField
                  label="Patient Threshold"
                  value={draftSettings.doctorPayment.peakSeason.bonusThresholdPatients}
                  onChange={(bonusThresholdPatients) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          peakSeason: {
                            ...current.doctorPayment.peakSeason,
                            bonusThresholdPatients
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
                <NumberField
                  label="Per Patient Bonus"
                  value={draftSettings.doctorPayment.peakSeason.bonusPerPatient}
                  onChange={(bonusPerPatient) =>
                    setDraftSettings((current) =>
                      normalizeSystemSettings({
                        ...current,
                        doctorPayment: {
                          ...current.doctorPayment,
                          peakSeason: {
                            ...current.doctorPayment.peakSeason,
                            bonusPerPatient
                          }
                        }
                      })
                    )
                  }
                  disabled={!editable}
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          section="insurance"
          open={openSections.includes("insurance")}
          dirty={sectionDirty(savedSettings, draftSettings, "insurance")}
          canEdit={editable}
          onToggle={() => toggleSection("insurance")}
          onSave={() => saveSection("insurance")}
          onCancel={() => cancelSection("insurance")}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TextField
              label="Default Statement Format"
              value={draftSettings.insurance.defaultStatementFormat}
              onChange={(defaultStatementFormat) =>
                updateInsurance({ defaultStatementFormat })
              }
              disabled={!editable}
            />
            <TextField
              label="Default Statement Number Format"
              value={draftSettings.insurance.defaultStatementNumberFormat}
              onChange={(defaultStatementNumberFormat) =>
                updateInsurance({ defaultStatementNumberFormat })
              }
              disabled={!editable}
            />
            <NumberField
              label="Default Due Period (Days)"
              value={draftSettings.insurance.defaultDuePeriodDays}
              onChange={(defaultDuePeriodDays) =>
                updateInsurance({ defaultDuePeriodDays })
              }
              disabled={!editable}
            />
            <YesNoField
              label="Enable Partial Payments"
              value={draftSettings.insurance.enablePartialPayments}
              onChange={(enablePartialPayments) =>
                updateInsurance({ enablePartialPayments })
              }
              disabled={!editable}
            />
            <TextField
              label="Default Payment Reference Prefix"
              value={draftSettings.insurance.defaultPaymentReferencePrefix}
              onChange={(defaultPaymentReferencePrefix) =>
                updateInsurance({ defaultPaymentReferencePrefix })
              }
              disabled={!editable}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="userSecurity"
          open={openSections.includes("userSecurity")}
          dirty={false}
          canEdit={false}
          future
          onToggle={() => toggleSection("userSecurity")}
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoBox label="Password Policy" value={draftSettings.userSecurity.passwordPolicy} />
            <InfoBox
              label="Session Timeout"
              value={`${draftSettings.userSecurity.sessionTimeoutMinutes} minutes`}
            />
            <InfoBox
              label="Two-Factor Authentication"
              value={draftSettings.userSecurity.twoFactorAuthentication ? "Enabled" : "Disabled"}
            />
            <InfoBox
              label="Login Attempt Limit"
              value={String(draftSettings.userSecurity.loginAttemptLimit)}
            />
            <InfoBox
              label="Audit Logging"
              value={draftSettings.userSecurity.auditLoggingEnabled ? "Enabled" : "Disabled"}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="notifications"
          open={openSections.includes("notifications")}
          dirty={false}
          canEdit={false}
          future
          onToggle={() => toggleSection("notifications")}
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <InfoBox
              label="Email Notifications"
              value={draftSettings.notifications.emailNotifications ? "Enabled" : "Planned"}
            />
            <InfoBox
              label="Insurance Statement Notifications"
              value={
                draftSettings.notifications.insuranceStatementNotifications ? "Enabled" : "Planned"
              }
            />
            <InfoBox
              label="Doctor Payout Notifications"
              value={draftSettings.notifications.doctorPayoutNotifications ? "Enabled" : "Planned"}
            />
            <InfoBox
              label="Payment Received Notifications"
              value={draftSettings.notifications.paymentReceivedNotifications ? "Enabled" : "Planned"}
            />
          </div>
        </SettingsSection>

        <SettingsSection
          section="system"
          open={openSections.includes("system")}
          dirty={false}
          canEdit={false}
          future
          onToggle={() => toggleSection("system")}
        >
          <div className="grid gap-4 lg:grid-cols-4">
            <InfoBox label="Database Status" value={draftSettings.system.databaseStatus} />
            <InfoBox label="Last Backup" value={draftSettings.system.lastBackup} />
            <InfoBox label="Environment" value={draftSettings.system.environment} />
            <InfoBox label="Application Version" value={draftSettings.system.applicationVersion} />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
