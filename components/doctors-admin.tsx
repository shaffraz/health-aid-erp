"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { generatePayoutsForInvoices } from "@/lib/calculations";
import {
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money, monthKey, shortDate, todayISO } from "@/lib/format";
import { generateId } from "@/lib/id";
import {
  doctorPaymentSettingsStorageKey,
  doctorStorageKey,
  type Doctor,
  type DoctorPaymentModel,
  type DoctorPaymentModelType,
  type DoctorPayout,
  type Invoice
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DoctorsAdminProps = {
  initialDoctors: Doctor[];
  initialInvoices: Invoice[];
  payouts: DoctorPayout[];
  canEdit: boolean;
};

type DoctorForm = {
  id?: string;
  name: string;
  designation: string;
  phone: string;
  active: boolean;
  notes: string;
};

const emptyForm: DoctorForm = {
  name: "",
  designation: "",
  phone: "",
  active: true,
  notes: ""
};

const modelLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "On-Call Mode / Per Patient",
  peak_season: "Clinic Shift Mode / Shift Based"
};

function toAmount(value: string | number, fallback: number) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.max(0, amount) : fallback;
}

function normalizeDoctor(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? ""
  };
}

function doctorToForm(doctor: Doctor): DoctorForm {
  const normalized = normalizeDoctor(doctor);

  return {
    id: normalized.id,
    name: normalized.name,
    designation: normalized.designation,
    phone: normalized.phone ?? "",
    active: normalized.active,
    notes: normalized.notes ?? ""
  };
}

function formToDoctor(form: DoctorForm): Doctor {
  return {
    id: form.id ?? generateId(),
    name: form.name.trim(),
    designation: form.designation.trim() || "General practice",
    phone: form.phone.trim() || undefined,
    notes: form.notes.trim() || undefined,
    active: form.active
  };
}

export function DoctorsAdmin({
  initialDoctors,
  initialInvoices,
  payouts,
  canEdit
}: DoctorsAdminProps) {
  const [doctors, setDoctors] = useState(() => initialDoctors.map(normalizeDoctor));
  const [paymentSettings, setPaymentSettings] = useState<DoctorPaymentModel>(
    defaultDoctorPaymentModel
  );
  const [paymentModeDraft, setPaymentModeDraft] = useState<DoctorPaymentModelType>(
    defaultDoctorPaymentModel.activeModel
  );
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
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

      const storedSettings = window.localStorage.getItem(doctorPaymentSettingsStorageKey);
      if (storedSettings) {
        const normalizedSettings = normalizeDoctorPaymentModel(JSON.parse(storedSettings));
        setPaymentSettings(normalizedSettings);
        setPaymentModeDraft(normalizedSettings.activeModel);
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(doctorStorageKey, JSON.stringify(doctors));
      window.localStorage.setItem(
        doctorPaymentSettingsStorageKey,
        JSON.stringify(paymentSettings)
      );
    }
  }, [doctors, hydrated, paymentSettings]);

  const visiblePayouts = useMemo(() => {
    const existingPayoutsById = new Map(payouts.map((payout) => [payout.id, payout]));

    return generatePayoutsForInvoices(initialInvoices, paymentSettings)
      .map((payout) => {
        const existing = existingPayoutsById.get(payout.id);

        return {
          ...payout,
          status: existing?.status ?? payout.status,
          voucherNo: existing?.voucherNo ?? payout.voucherNo
        };
      })
      .filter((payout) => payout.payoutMode !== "pending_shift");
  }, [initialInvoices, paymentSettings, payouts]);

  const payoutSummaryByDoctor = useMemo(() => {
    return visiblePayouts.reduce<
      Map<string, { pending: number; lastPaidDate?: string }>
    >((totals, payout) => {
      const summary = totals.get(payout.doctorId) ?? { pending: 0 };

      if (payout.status === "unpaid") {
        summary.pending += payout.payoutAmount;
      }

      if (
        payout.status === "paid" &&
        (!summary.lastPaidDate || payout.date > summary.lastPaidDate)
      ) {
        summary.lastPaidDate = payout.date;
      }

      totals.set(payout.doctorId, summary);
      return totals;
    }, new Map());
  }, [visiblePayouts]);

  const activeCount = doctors.filter((doctor) => doctor.active).length;
  const inactiveCount = doctors.length - activeCount;
  const totalPending = [...payoutSummaryByDoctor.values()].reduce(
    (sum, summary) => sum + summary.pending,
    0
  );
  const currentMonth = todayISO().slice(0, 7);
  const paidThisMonth = visiblePayouts
    .filter((payout) => payout.status === "paid" && monthKey(payout.date) === currentMonth)
    .reduce((sum, payout) => sum + payout.payoutAmount, 0);
  const editing = Boolean(form.id);

  function resetForm() {
    setForm(emptyForm);
    setFormOpen(false);
    setError("");
  }

  function openAddForm() {
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function editDoctor(doctor: Doctor) {
    setForm(doctorToForm(doctor));
    setError("");
    setFormOpen(true);
  }

  function saveDoctor() {
    if (!canEdit) {
      return;
    }

    if (!form.name.trim()) {
      setError("Doctor name is required.");
      return;
    }

    const nextDoctor = formToDoctor(form);

    setDoctors((current) =>
      form.id
        ? current.map((doctor) => (doctor.id === form.id ? nextDoctor : doctor))
        : [nextDoctor, ...current]
    );
    resetForm();
  }

  function toggleDoctorActive(doctorId: string) {
    if (!canEdit) {
      return;
    }

    setDoctors((current) =>
      current.map((doctor) =>
        doctor.id === doctorId ? { ...doctor, active: !doctor.active } : doctor
      )
    );
  }

  function deleteDoctor(doctorId: string) {
    if (!canEdit) {
      return;
    }

    setDoctors((current) => current.filter((doctor) => doctor.id !== doctorId));
    if (form.id === doctorId) {
      resetForm();
    }
  }

  function updatePaymentSettings(patch: Partial<DoctorPaymentModel>) {
    setPaymentSettings((current) => normalizeDoctorPaymentModel({ ...current, ...patch }));
  }

  function savePaymentMode() {
    if (!canEdit) {
      return;
    }

    updatePaymentSettings({ activeModel: paymentModeDraft });
  }

  const paymentModeChanged = paymentModeDraft !== paymentSettings.activeModel;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Doctors" value={String(activeCount)} tone="primary" />
        <KpiCard label="Inactive Doctors" value={String(inactiveCount)} />
        <KpiCard
          label="Pending Doctor Payouts LKR"
          value={money(totalPending)}
          tone="danger"
        />
        <KpiCard
          label="Paid This Month LKR"
          value={money(paidThisMonth)}
          tone="success"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-[#224770]">Pending Payouts by Doctor</h2>
        </div>
        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => {
            const pending = payoutSummaryByDoctor.get(doctor.id)?.pending ?? 0;

            return (
              <div
                key={doctor.id}
                className="rounded-xl border border-[#efefef] bg-white p-4 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="font-semibold text-[#224770]">{doctor.name}</p>
                <p className="mt-1 text-sm text-[#46484a]">{doctor.designation}</p>
                <p className="mt-3 text-lg font-bold text-rose-700">{money(pending)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-[#224770]">Doctor Payment Settings</h2>
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-[#efefef] bg-white p-4 shadow-sm xl:col-span-3">
            <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr] lg:items-end">
              <div>
                <p className="label">Current Payment Mode</p>
                <p className="mt-2 text-xl font-bold text-[#224770]">
                  {modelLabels[paymentSettings.activeModel]}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <label className="label" htmlFor="global-payment-model">
                    Switch Payment Mode
                  </label>
                  <select
                    id="global-payment-model"
                    value={paymentModeDraft}
                    onChange={(event) =>
                      setPaymentModeDraft(event.target.value as DoctorPaymentModelType)
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  >
                    <option value="low_season">{modelLabels.low_season}</option>
                    <option value="peak_season">{modelLabels.peak_season}</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={savePaymentMode}
                  disabled={!canEdit || !paymentModeChanged}
                  className={buttonClass(
                    paymentModeChanged ? "primary" : "muted",
                    "min-h-11 whitespace-nowrap"
                  )}
                >
                  Save Mode
                </button>
              </div>
            </div>
          </div>

          {paymentModeDraft === "low_season" ? (
            <>
              <div>
                <label className="label" htmlFor="day-payout">
                  Day consultation payout LKR
                </label>
                <input
                  id="day-payout"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentSettings.lowSeason.dayConsultationPayout}
                  onChange={(event) =>
                    updatePaymentSettings({
                      lowSeason: {
                        ...paymentSettings.lowSeason,
                        dayConsultationPayout: toAmount(event.target.value, 2500)
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="night-payout">
                  Night consultation payout LKR
                </label>
                <input
                  id="night-payout"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentSettings.lowSeason.nightConsultationPayout}
                  onChange={(event) =>
                    updatePaymentSettings({
                      lowSeason: {
                        ...paymentSettings.lowSeason,
                        nightConsultationPayout: toAmount(event.target.value, 3500)
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="night-start">
                  Night start
                </label>
                <input
                  id="night-start"
                  type="time"
                  value={paymentSettings.lowSeason.nightStartTime}
                  onChange={(event) =>
                    updatePaymentSettings({
                      lowSeason: {
                        ...paymentSettings.lowSeason,
                        nightStartTime: event.target.value
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="night-end">
                  Night end
                </label>
                <input
                  id="night-end"
                  type="time"
                  value={paymentSettings.lowSeason.nightEndTime}
                  onChange={(event) =>
                    updatePaymentSettings({
                      lowSeason: {
                        ...paymentSettings.lowSeason,
                        nightEndTime: event.target.value
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="shift-start">
                  Shift start
                </label>
                <input
                  id="shift-start"
                  type="time"
                  value={paymentSettings.peakSeason.shiftStartTime}
                  onChange={(event) =>
                    updatePaymentSettings({
                      peakSeason: {
                        ...paymentSettings.peakSeason,
                        shiftStartTime: event.target.value
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="shift-end">
                  Shift end
                </label>
                <input
                  id="shift-end"
                  type="time"
                  value={paymentSettings.peakSeason.shiftEndTime}
                  onChange={(event) =>
                    updatePaymentSettings({
                      peakSeason: {
                        ...paymentSettings.peakSeason,
                        shiftEndTime: event.target.value
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="hourly-rate">
                  Hourly rate LKR
                </label>
                <input
                  id="hourly-rate"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentSettings.peakSeason.hourlyRate}
                  onChange={(event) =>
                    updatePaymentSettings({
                      peakSeason: {
                        ...paymentSettings.peakSeason,
                        hourlyRate: toAmount(event.target.value, 1000)
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="bonus-threshold">
                  Bonus threshold patients
                </label>
                <input
                  id="bonus-threshold"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentSettings.peakSeason.bonusThresholdPatients}
                  onChange={(event) =>
                    updatePaymentSettings({
                      peakSeason: {
                        ...paymentSettings.peakSeason,
                        bonusThresholdPatients: toAmount(event.target.value, 5)
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="bonus-per-patient">
                  Bonus per patient LKR
                </label>
                <input
                  id="bonus-per-patient"
                  type="number"
                  min={0}
                  step="1"
                  value={paymentSettings.peakSeason.bonusPerPatient}
                  onChange={(event) =>
                    updatePaymentSettings({
                      peakSeason: {
                        ...paymentSettings.peakSeason,
                        bonusPerPatient: toAmount(event.target.value, 1000)
                      }
                    })
                  }
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-[#224770]">Doctor Directory</h2>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            disabled={!canEdit}
            className={buttonClass("primary")}
          >
            Add Doctor
          </button>
        </div>

        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Name</th>
                <th className={tableStyles.headerCell}>Designation</th>
                <th className={tableStyles.headerCell}>Phone</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.numericHeaderCell}>Pending payout LKR</th>
                <th className={tableStyles.headerCell}>Last payout date</th>
                <th className={tableStyles.numericHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {doctors.map((doctor) => {
                const summary = payoutSummaryByDoctor.get(doctor.id);

                return (
                  <tr key={doctor.id} className={tableStyles.row}>
                    <td className={tableStyles.strongCell}>
                      <p>{doctor.name}</p>
                      {doctor.notes ? (
                        <p className="mt-1 max-w-xs text-xs leading-5 text-[#46484a]">
                          {doctor.notes}
                        </p>
                      ) : null}
                    </td>
                    <td className={tableStyles.cell}>
                      {doctor.designation}
                    </td>
                    <td className={tableStyles.cell}>
                      {doctor.phone ?? "-"}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "font-semibold",
                          doctor.active ? "text-emerald-700" : "text-rose-700"
                        )}
                      >
                        {doctor.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={tableStyles.numericCell}>
                      {money(summary?.pending ?? 0)}
                    </td>
                    <td className={tableStyles.cell}>
                      {summary?.lastPaidDate ? shortDate(summary.lastPaidDate) : "-"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editDoctor(doctor)}
                          disabled={!canEdit}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleDoctorActive(doctor.id)}
                          disabled={!canEdit}
                          className={buttonClass("secondary", "px-3 py-2 text-xs")}
                        >
                          {doctor.active ? "Deactivate" : "Reactivate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDoctor(doctor.id)}
                          disabled={!canEdit}
                          className={buttonClass("danger", "px-3 py-2 text-xs")}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!doctors.length ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-slate-500">
                    No doctors have been added yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-form-title"
        >
          <section className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 id="doctor-form-title" className="font-semibold text-ink">
                {editing ? "Edit doctor" : "Add doctor"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close doctor form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {!canEdit ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  Doctor setup is admin-only.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="doctor-name">
                    Full name
                  </label>
                  <input
                    id="doctor-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                    placeholder="Doctor full name"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="doctor-designation">
                    Designation
                  </label>
                  <input
                    id="doctor-designation"
                    value={form.designation}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, designation: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                    placeholder="Eg. Medical officer"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="doctor-phone">
                    Phone
                  </label>
                  <input
                    id="doctor-phone"
                    value={form.phone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, phone: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="doctor-active">
                    Active
                  </label>
                  <select
                    id="doctor-active"
                    value={form.active ? "yes" : "no"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.value === "yes" }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label" htmlFor="doctor-notes">
                    Notes
                  </label>
                  <textarea
                    id="doctor-notes"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 min-h-24 disabled:bg-slate-100"
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className={buttonClass("secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDoctor}
                disabled={!canEdit || !form.name.trim()}
                className={buttonClass(canEdit && form.name.trim() ? "primary" : "muted")}
              >
                {editing ? "Update doctor" : "Save doctor"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
