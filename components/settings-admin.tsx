"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/erp-ui";
import { generateId } from "@/lib/id";
import {
  defaultSystemSettings,
  loadSystemSettings,
  normalizeSystemSettings,
  paymentModeLabels,
  paymentModeValues,
  saveActivePaymentMode,
  saveSystemSettings,
  type ClinicSettings,
  type InsuranceSettings,
  type InvoiceSettings,
  type OperationalSettings,
  type SeasonSettings,
  type SystemSettings
} from "@/lib/settings";
import type { DoctorPaymentModelType } from "@/lib/types";
import { useSystemSettings } from "@/lib/use-system-settings";
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

type SeasonModalState = {
  mode: "add" | "edit";
  season: SeasonSettings;
};

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
const allSections: SectionKey[] = [...activeSections, ...futureSections];

function toAmount(value: string | number, fallback = 0) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : fallback;
}

function isActiveSection(section: SectionKey): section is ActiveSectionKey {
  return (activeSections as SectionKey[]).includes(section);
}

function comparableSection(settings: SystemSettings, section: SectionKey) {
  if (section === "doctorPayment") {
    return {
      lowSeason: settings.doctorPayment.lowSeason,
      peakSeason: settings.doctorPayment.peakSeason
    };
  }

  return settings[section];
}

function sectionDirty<Key extends SectionKey>(
  saved: SystemSettings,
  draft: SystemSettings,
  section: Key
) {
  return (
    JSON.stringify(comparableSection(saved, section)) !==
    JSON.stringify(comparableSection(draft, section))
  );
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

function dateInputFromMonthDay(value: string) {
  return value ? `2026-${value}` : "";
}

function monthDayFromDateInput(value: string) {
  return value.slice(5) || value;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#dfe4e7] bg-white p-4">
      <p className="label">{label}</p>
      <p className="mt-2 font-semibold text-[#224770]">{value || "Not configured"}</p>
    </div>
  );
}

function FieldShell({
  label,
  helper,
  children
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-stack min-w-0">
      <label className="label">{label}</label>
      <div className="mt-2">{children}</div>
      {helper ? <p className="mt-1.5 text-xs font-medium text-[#46484a]/70">{helper}</p> : null}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  placeholder,
  readOnly,
  helper
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  helper?: string;
}) {
  return (
    <FieldShell label={label} helper={helper}>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        readOnly={readOnly}
        placeholder={placeholder}
        className="field min-h-12 disabled:bg-[#efefef] disabled:text-[#46484a]/65 read-only:bg-[#efefef]"
      />
    </FieldShell>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label}>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        rows={4}
        className="field min-h-28 resize-y disabled:bg-[#efefef] disabled:text-[#46484a]/65"
      />
    </FieldShell>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  suffix,
  helper
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  min?: number;
  suffix?: string;
  helper?: string;
}) {
  return (
    <FieldShell label={label} helper={helper}>
      <div className="relative">
        <input
          type="number"
          min={min}
          step="1"
          value={value}
          onChange={(event) => onChange(toAmount(event.target.value, value))}
          disabled={disabled}
          className={cn(
            "field min-h-12 disabled:bg-[#efefef] disabled:text-[#46484a]/65",
            suffix ? "pr-12" : ""
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-[#46484a]/70">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  );
}

function SelectField({
  label,
  value,
  onChange,
  disabled,
  options,
  helper
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
  helper?: string;
}) {
  return (
    <FieldShell label={label} helper={helper}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="field min-h-12 disabled:bg-[#efefef] disabled:text-[#46484a]/65"
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

function SwitchField({
  label,
  checked,
  onChange,
  disabled,
  helper
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled: boolean;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-[#dfe4e7] bg-white p-4">
      <div className="flex min-h-12 items-center justify-between gap-4">
        <div>
          <p className="label">{label}</p>
          {helper ? <p className="mt-1 text-sm font-medium text-[#46484a]/70">{helper}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={cn(
            "focus-ring relative h-8 w-14 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
            checked ? "bg-[#84bc3f]" : "bg-[#d9d9d9]"
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition",
              checked ? "left-7" : "left-1"
            )}
          />
          <span className="sr-only">{checked ? "On" : "Off"}</span>
        </button>
      </div>
    </div>
  );
}

function SegmentedControl({
  value,
  onChange,
  disabled,
  options
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="grid gap-2 rounded-xl bg-[#efefef] p-1 sm:grid-cols-2">
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={cn(
              "focus-ring min-h-12 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed",
              selected
                ? "bg-white text-[#224770] shadow-sm"
                : "text-[#46484a] hover:bg-white/70"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsCard({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-[#dfe4e7] bg-white p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

function FutureBadge() {
  return (
    <span className="rounded-full bg-[#efefef] px-3 py-1 text-xs font-semibold text-[#46484a]">
      Future
    </span>
  );
}

function SectionFooter({
  dirty,
  canEdit,
  onSave,
  onCancel,
  future
}: {
  dirty: boolean;
  canEdit: boolean;
  onSave: () => void;
  onCancel: () => void;
  future: boolean;
}) {
  if (future) {
    return null;
  }

  return (
    <div className="sticky bottom-0 mt-6 rounded-lg border border-[#dfe4e7] bg-white/95 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#224770]">
            {dirty ? "Unsaved changes" : "No unsaved changes"}
          </p>
          <p className="text-xs font-medium text-[#46484a]/70">
            Save changes to apply them across the ERP.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" onClick={onCancel} disabled={!dirty} variant="secondary">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={!canEdit || !dirty}
            variant={canEdit && dirty ? "primary" : "muted"}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function UnsavedChangesDialog({
  onKeepEditing,
  onDiscard
}: {
  onKeepEditing: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#224770]/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-[#dfe4e7] bg-white p-6 shadow-xl">
        <h2 className="text-xl font-bold text-[#224770]">Unsaved changes</h2>
        <p className="mt-3 text-sm font-medium leading-6 text-[#46484a]">
          You have unsaved changes. Discard them and continue?
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onKeepEditing}>
            Keep Editing
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Discard Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function SeasonEditorModal({
  state,
  canEdit,
  onClose,
  onSave
}: {
  state: SeasonModalState;
  canEdit: boolean;
  onClose: () => void;
  onSave: (season: SeasonSettings) => void;
}) {
  const [season, setSeason] = useState<SeasonSettings>(state.season);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#224770]/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-[#dfe4e7] bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#224770]">
              {state.mode === "add" ? "Add Season" : "Edit Season"}
            </h2>
            <p className="mt-1 text-sm font-medium text-[#46484a]/70">
              Configure a business season used by dashboard and report calculations.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg border border-[#dfe4e7] px-3 py-2 text-sm font-semibold text-[#46484a] transition hover:bg-[#efefef]"
          >
            Close
          </button>
        </div>

        <div className="form-grid mt-6 grid gap-4 sm:grid-cols-2">
          <TextField
            label="Season Name"
            value={season.name}
            onChange={(name) => setSeason((current) => ({ ...current, name }))}
            disabled={!canEdit}
          />
          <SwitchField
            label="Status"
            checked={season.active}
            onChange={(active) => setSeason((current) => ({ ...current, active }))}
            disabled={!canEdit}
            helper={season.active ? "Active" : "Inactive"}
          />
          <TextField
            label="Start Date"
            type="date"
            value={dateInputFromMonthDay(season.startDate)}
            onChange={(startDate) =>
              setSeason((current) => ({ ...current, startDate: monthDayFromDateInput(startDate) }))
            }
            disabled={!canEdit}
          />
          <TextField
            label="End Date"
            type="date"
            value={dateInputFromMonthDay(season.endDate)}
            onChange={(endDate) =>
              setSeason((current) => ({ ...current, endDate: monthDayFromDateInput(endDate) }))
            }
            disabled={!canEdit}
          />
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => onSave(season)} disabled={!canEdit}>
            Save Season
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SettingsAdmin({ canEdit, currentUserName }: SettingsAdminProps) {
  const liveSettings = useSystemSettings();
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(
    normalizeSystemSettings(defaultSystemSettings)
  );
  const [draftSettings, setDraftSettings] = useState<SystemSettings>(
    normalizeSystemSettings(defaultSystemSettings)
  );
  const [activeSection, setActiveSection] = useState<SectionKey>("clinic");
  const [pendingSection, setPendingSection] = useState<SectionKey | null>(null);
  const [seasonModal, setSeasonModal] = useState<SeasonModalState | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const dirtySections = useMemo(
    () => allSections.filter((section) => sectionDirty(savedSettings, draftSettings, section)),
    [draftSettings, savedSettings]
  );

  useEffect(() => {
    const hasUnsavedChanges = allSections.some((section) =>
      sectionDirty(savedSettings, draftSettings, section)
    );

    setSavedSettings(liveSettings);

    if (!hasUnsavedChanges) {
      setDraftSettings(liveSettings);
    }
  }, [draftSettings, liveSettings, savedSettings]);

  const activeDirty = sectionDirty(savedSettings, draftSettings, activeSection);
  const activeFuture = !isActiveSection(activeSection);
  const editable = canEdit && !activeFuture;

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
        operational: { ...current.operational, ...patch }
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

  function removeSeason(id: string) {
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        seasons: current.seasons.filter((season) => season.id !== id)
      })
    );
  }

  function selectSection(section: SectionKey) {
    if (section === activeSection) {
      return;
    }

    if (activeDirty && isActiveSection(activeSection)) {
      setPendingSection(section);
      return;
    }

    setStatusMessage("");
    setActiveSection(section);
  }

  function discardAndSwitch() {
    if (!pendingSection || !isActiveSection(activeSection)) {
      setPendingSection(null);
      return;
    }

    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        [activeSection]: savedSettings[activeSection],
        operational:
          activeSection === "operational" ? savedSettings.operational : current.operational,
        doctorPayment:
          activeSection === "operational" || activeSection === "doctorPayment"
            ? savedSettings.doctorPayment
            : current.doctorPayment
      })
    );
    setStatusMessage("");
    setActiveSection(pendingSection);
    setPendingSection(null);
  }

  function saveSection(section: ActiveSectionKey) {
    if (!canEdit) {
      return;
    }

    const latestSettings = loadSystemSettings();
    let nextSettings = normalizeSystemSettings({
      ...latestSettings,
      [section]: draftSettings[section]
    });

    if (section === "operational") {
      const modeChanged =
        latestSettings.operational.activePaymentMode !==
        draftSettings.operational.activePaymentMode;

      nextSettings = modeChanged
        ? saveActivePaymentMode(
            draftSettings.operational.activePaymentMode,
            currentUserName
          )
        : normalizeSystemSettings({
            ...latestSettings,
            operational: draftSettings.operational
          });
    }

    if (section === "doctorPayment") {
      nextSettings = normalizeSystemSettings({
        ...nextSettings,
        doctorPayment: draftSettings.doctorPayment
      });
    }

    if (section !== "operational") {
      saveSystemSettings(nextSettings);
    }
    setSavedSettings(nextSettings);
    setDraftSettings((current) =>
      normalizeSystemSettings({
        ...current,
        [section]: nextSettings[section],
        operational: nextSettings.operational,
        doctorPayment: nextSettings.doctorPayment
      })
    );
    setStatusMessage(
      section === "operational"
        ? `Operating mode updated to ${paymentModeLabels[nextSettings.operational.activePaymentMode]}.`
        : `${sectionLabels[section]} settings saved.`
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
    setStatusMessage("");
  }

  function openAddSeason() {
    setSeasonModal({
      mode: "add",
      season: {
        id: generateId(),
        name: "",
        startDate: "01-01",
        endDate: "12-31",
        active: true
      }
    });
  }

  function saveSeasonFromModal(season: SeasonSettings) {
    if (seasonModal?.mode === "add") {
      setDraftSettings((current) =>
        normalizeSystemSettings({
          ...current,
          seasons: [...current.seasons, season]
        })
      );
    } else {
      updateSeason(season.id, season);
    }

    setSeasonModal(null);
  }

  function renderContent() {
    if (activeSection === "clinic") {
      return (
        <SettingsCard>
          <div className="form-grid grid gap-5 lg:grid-cols-2">
            <TextField
              label="Clinic Name"
              value={draftSettings.clinic.clinicName}
              onChange={(clinicName) => updateClinic({ clinicName })}
              disabled={!editable}
            />
            <FieldShell label="Logo" helper="Logo upload will be connected in a later phase.">
              <div className="flex min-h-12 flex-col gap-3 rounded-lg border border-[#efefef] bg-[#efefef]/55 p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="break-all text-sm font-semibold text-[#224770]">
                  {draftSettings.clinic.brandLogo}
                </span>
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-[#efefef] px-3 py-2 text-sm font-semibold text-[#46484a]/55"
                >
                  Upload Logo
                </button>
              </div>
            </FieldShell>
            <div className="lg:col-span-2">
              <TextareaField
                label="Address"
                value={draftSettings.clinic.address}
                onChange={(address) => updateClinic({ address })}
                disabled={!editable}
              />
            </div>
            <TextField
              label="Phone"
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
              label="Invoice Currency"
              value={draftSettings.clinic.currency}
              onChange={(currency) => updateClinic({ currency: currency.toUpperCase() })}
              disabled={!editable}
              readOnly
              helper="Patient-facing invoice currency."
            />
            <TextField
              label="Payout Currency"
              value={draftSettings.clinic.localCurrency}
              onChange={(localCurrency) =>
                updateClinic({ localCurrency: localCurrency.toUpperCase() })
              }
              disabled={!editable}
              readOnly
              helper="Internal doctor payout currency."
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
        </SettingsCard>
      );
    }

    if (activeSection === "operational") {
      return (
        <div className="space-y-5">
          <SettingsCard>
            <div className="form-grid grid gap-5 lg:grid-cols-[1.2fr_1fr_1fr]">
              <div>
                <p className="label">Current Doctor Payment Mode</p>
                <p className="mt-3 text-2xl font-bold text-[#224770]">
                  {paymentModeLabels[draftSettings.operational.activePaymentMode]}
                </p>
                <div className="mt-5">
                  <SegmentedControl
                    value={draftSettings.operational.activePaymentMode}
                    onChange={(activePaymentMode) =>
                      updateOperational({
                        activePaymentMode: activePaymentMode as DoctorPaymentModelType
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
                </div>
              </div>
              <InfoBox label="Last Changed By" value={draftSettings.operational.lastChangedBy} />
              <InfoBox
                label="Last Changed Date / Time"
                value={displayDateTime(draftSettings.operational.lastChangedAt)}
              />
            </div>
          </SettingsCard>
        </div>
      );
    }

    if (activeSection === "seasons") {
      return (
        <SettingsCard>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#224770]">Configured Seasons</h2>
              <p className="mt-1 text-sm font-medium text-[#46484a]/70">
                Compact season list used by current season reporting.
              </p>
            </div>
            <Button type="button" variant="primary" onClick={openAddSeason} disabled={!editable}>
              Add Season
            </Button>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-[#dfe4e7]">
            <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_180px] gap-4 bg-[#efefef] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#46484a] lg:grid">
              <span>Season Name</span>
              <span>Start Date</span>
              <span>End Date</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            {draftSettings.seasons.map((season) => (
              <div
                key={season.id}
                className="grid gap-3 border-t border-[#dfe4e7] px-4 py-4 first:border-t-0 lg:grid-cols-[1.3fr_1fr_1fr_1fr_180px] lg:items-center"
              >
                <div>
                  <p className="font-semibold text-[#224770]">{season.name}</p>
                  <p className="text-sm font-medium text-[#46484a]/70 lg:hidden">
                    {season.startDate} to {season.endDate}
                  </p>
                </div>
                <p className="hidden text-sm font-semibold text-[#46484a] lg:block">
                  {season.startDate}
                </p>
                <p className="hidden text-sm font-semibold text-[#46484a] lg:block">
                  {season.endDate}
                </p>
                <span
                  className={cn(
                    "w-fit rounded-full px-3 py-1 text-xs font-semibold",
                    season.active
                      ? "bg-[#84bc3f]/15 text-[#224770]"
                      : "bg-[#efefef] text-[#46484a]"
                  )}
                >
                  {season.active ? "Active" : "Inactive"}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setSeasonModal({ mode: "edit", season })}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeSeason(season.id)}
                    disabled={!editable || draftSettings.seasons.length <= 1}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "invoice") {
      return (
        <SettingsCard>
          <div className="form-grid grid gap-5 lg:grid-cols-2">
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
            <SwitchField
              label="Automatic Timestamp"
              checked={draftSettings.invoice.automaticTimestamp}
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
              readOnly
            />
            <SwitchField
              label="Allow Invoice Editing"
              checked={draftSettings.invoice.allowInvoiceEditing}
              onChange={(allowInvoiceEditing) => updateInvoice({ allowInvoiceEditing })}
              disabled={!editable}
            />
            <SwitchField
              label="Allow Invoice Voiding"
              checked={draftSettings.invoice.allowInvoiceVoiding}
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
        </SettingsCard>
      );
    }

    if (activeSection === "doctorPayment") {
      return (
        <div className="space-y-5">
          <SettingsCard>
            <h2 className="text-lg font-bold text-[#224770]">
              {paymentModeLabels[paymentModeValues.onCall]}
            </h2>
            <div className="form-grid mt-5 grid items-start gap-5 lg:grid-cols-4">
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
                label="Night Start"
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
                label="Night End"
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
          </SettingsCard>

          <SettingsCard>
            <h2 className="text-lg font-bold text-[#224770]">
              {paymentModeLabels[paymentModeValues.clinicShift]}
            </h2>
            <div className="form-grid mt-5 grid items-start gap-5 lg:grid-cols-5">
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
                label="Per-Patient Bonus"
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
          </SettingsCard>
        </div>
      );
    }

    if (activeSection === "insurance") {
      return (
        <SettingsCard>
          <div className="form-grid grid gap-5 lg:grid-cols-2">
            <TextField
              label="Statement Format"
              value={draftSettings.insurance.defaultStatementFormat}
              onChange={(defaultStatementFormat) => updateInsurance({ defaultStatementFormat })}
              disabled={!editable}
            />
            <TextField
              label="Statement Number Format"
              value={draftSettings.insurance.defaultStatementNumberFormat}
              onChange={(defaultStatementNumberFormat) =>
                updateInsurance({ defaultStatementNumberFormat })
              }
              disabled={!editable}
            />
            <NumberField
              label="Default Due Period"
              value={draftSettings.insurance.defaultDuePeriodDays}
              onChange={(defaultDuePeriodDays) => updateInsurance({ defaultDuePeriodDays })}
              disabled={!editable}
              suffix="days"
            />
            <SwitchField
              label="Enable Partial Payments"
              checked={draftSettings.insurance.enablePartialPayments}
              onChange={(enablePartialPayments) => updateInsurance({ enablePartialPayments })}
              disabled={!editable}
            />
            <TextField
              label="Payment Reference Prefix"
              value={draftSettings.insurance.defaultPaymentReferencePrefix}
              onChange={(defaultPaymentReferencePrefix) =>
                updateInsurance({ defaultPaymentReferencePrefix })
              }
              disabled={!editable}
            />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "userSecurity") {
      return (
        <SettingsCard>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#224770]">User & Security Controls</h2>
            <FutureBadge />
          </div>
          <div className="form-grid grid gap-5 lg:grid-cols-3">
            <InfoBox label="Password Policy" value={draftSettings.userSecurity.passwordPolicy} />
            <InfoBox
              label="Session Timeout"
              value={`${draftSettings.userSecurity.sessionTimeoutMinutes} minutes`}
            />
            <InfoBox
              label="Login Attempt Limit"
              value={String(draftSettings.userSecurity.loginAttemptLimit)}
            />
            <SwitchField
              label="Audit Logging"
              checked={draftSettings.userSecurity.auditLoggingEnabled}
              onChange={() => undefined}
              disabled
            />
            <SwitchField
              label="Two-Factor Authentication"
              checked={draftSettings.userSecurity.twoFactorAuthentication}
              onChange={() => undefined}
              disabled
              helper="Future"
            />
          </div>
        </SettingsCard>
      );
    }

    if (activeSection === "notifications") {
      return (
        <SettingsCard>
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-[#224770]">Notification Preferences</h2>
            <FutureBadge />
          </div>
          <div className="form-grid grid gap-5 lg:grid-cols-2">
            <SwitchField
              label="Email Notifications"
              checked={draftSettings.notifications.emailNotifications}
              onChange={() => undefined}
              disabled
              helper="Future"
            />
            <SwitchField
              label="Insurance Statement Notifications"
              checked={draftSettings.notifications.insuranceStatementNotifications}
              onChange={() => undefined}
              disabled
              helper="Future"
            />
            <SwitchField
              label="Doctor Payout Notifications"
              checked={draftSettings.notifications.doctorPayoutNotifications}
              onChange={() => undefined}
              disabled
              helper="Future"
            />
            <SwitchField
              label="Payment Received Notifications"
              checked={draftSettings.notifications.paymentReceivedNotifications}
              onChange={() => undefined}
              disabled
              helper="Future"
            />
          </div>
        </SettingsCard>
      );
    }

    return (
      <SettingsCard>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-[#224770]">System Status</h2>
          <FutureBadge />
        </div>
        <div className="form-grid grid gap-5 lg:grid-cols-4">
          <InfoBox label="Application Version" value={draftSettings.system.applicationVersion} />
          <InfoBox label="Environment" value={draftSettings.system.environment} />
          <InfoBox label="Database Status" value={draftSettings.system.databaseStatus} />
          <InfoBox label="Last Backup" value={draftSettings.system.lastBackup} />
        </div>
      </SettingsCard>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="hidden h-fit rounded-lg border border-[#dfe4e7] bg-white p-2 shadow-sm lg:sticky lg:top-5 lg:block">
        <nav className="space-y-1" aria-label="Settings sections">
          {allSections.map((section) => {
            const dirty = dirtySections.includes(section);
            const selected = activeSection === section;

            return (
              <button
                key={section}
                type="button"
                onClick={() => selectSection(section)}
                className={cn(
                  "focus-ring relative flex min-h-12 w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm font-semibold transition",
                  selected
                    ? "bg-[#0eb6ef]/10 text-[#224770]"
                    : "text-[#46484a] hover:bg-[#efefef]/70"
                )}
              >
                {selected ? (
                  <span className="absolute left-0 top-2 h-8 w-1 rounded-r-full bg-[#224770]" />
                ) : null}
                <span>{sectionLabels[section]}</span>
                {dirty ? <span className="h-2 w-2 rounded-full bg-[#84bc3f]" /> : null}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="space-y-5">
        <div className="rounded-lg border border-[#dfe4e7] bg-white p-3 shadow-sm lg:hidden">
          <SelectField
            label="Settings Category"
            value={activeSection}
            onChange={(section) => selectSection(section as SectionKey)}
            disabled={false}
            options={allSections.map((section) => ({
              value: section,
              label: sectionLabels[section]
            }))}
          />
        </div>

        {!canEdit ? (
          <div className="rounded-xl border border-[#efefef] bg-white p-4 text-sm font-semibold text-[#46484a]">
            Company Director access is read-only in this phase.
          </div>
        ) : null}

        {statusMessage ? (
          <div className="rounded-xl border border-[#84bc3f]/35 bg-[#84bc3f]/10 p-4 text-sm font-semibold text-[#224770]">
            {statusMessage}
          </div>
        ) : null}

        <section>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#224770]">
                {sectionLabels[activeSection]}
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeDirty ? (
                <span className="rounded-full bg-[#efefef] px-3 py-1.5 text-xs font-semibold text-[#46484a]">
                  Unsaved changes
                </span>
              ) : null}
              {activeFuture ? <FutureBadge /> : null}
              {!canEdit && !activeFuture ? (
                <span className="rounded-full bg-[#efefef] px-3 py-1.5 text-xs font-semibold text-[#46484a]">
                  Read-only
                </span>
              ) : null}
            </div>
          </div>

          {renderContent()}

          <SectionFooter
            dirty={activeDirty}
            canEdit={canEdit}
            future={activeFuture}
            onSave={() => {
              if (isActiveSection(activeSection)) {
                saveSection(activeSection);
              }
            }}
            onCancel={() => {
              if (isActiveSection(activeSection)) {
                cancelSection(activeSection);
              }
            }}
          />
        </section>
      </div>

      {pendingSection ? (
        <UnsavedChangesDialog
          onKeepEditing={() => setPendingSection(null)}
          onDiscard={discardAndSwitch}
        />
      ) : null}

      {seasonModal ? (
        <SeasonEditorModal
          state={seasonModal}
          canEdit={editable}
          onClose={() => setSeasonModal(null)}
          onSave={saveSeasonFromModal}
        />
      ) : null}
    </div>
  );
}
