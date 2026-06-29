"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CirclePlus,
  Edit3,
  Save,
  Trash2,
  UserCheck,
  UserX,
  X
} from "lucide-react";
import {
  defaultDoctorPaymentModel,
  normalizeDoctorPaymentModel
} from "@/lib/doctor-payment";
import { money } from "@/lib/format";
import {
  doctorStorageKey,
  type Doctor,
  type DoctorPaymentModelType,
  type DoctorPayout
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DoctorsAdminProps = {
  initialDoctors: Doctor[];
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
  activeModel: DoctorPaymentModelType;
  dayConsultationPayout: string;
  nightConsultationPayout: string;
  nightStartTime: string;
  nightEndTime: string;
  shiftStartTime: string;
  shiftEndTime: string;
  hourlyRate: string;
  bonusThresholdPatients: string;
  bonusPerPatient: string;
};

const emptyForm: DoctorForm = {
  name: "",
  designation: "",
  phone: "",
  active: true,
  notes: "",
  activeModel: defaultDoctorPaymentModel.activeModel,
  dayConsultationPayout: String(defaultDoctorPaymentModel.lowSeason.dayConsultationPayout),
  nightConsultationPayout: String(defaultDoctorPaymentModel.lowSeason.nightConsultationPayout),
  nightStartTime: defaultDoctorPaymentModel.lowSeason.nightStartTime,
  nightEndTime: defaultDoctorPaymentModel.lowSeason.nightEndTime,
  shiftStartTime: defaultDoctorPaymentModel.peakSeason.shiftStartTime,
  shiftEndTime: defaultDoctorPaymentModel.peakSeason.shiftEndTime,
  hourlyRate: String(defaultDoctorPaymentModel.peakSeason.hourlyRate),
  bonusThresholdPatients: String(defaultDoctorPaymentModel.peakSeason.bonusThresholdPatients),
  bonusPerPatient: String(defaultDoctorPaymentModel.peakSeason.bonusPerPatient)
};

const modelLabels: Record<DoctorPaymentModelType, string> = {
  low_season: "Low Season / Per Patient",
  peak_season: "Peak Season / Shift Based"
};

function toAmount(value: string, fallback: number) {
  const amount = Number(value);

  return Number.isFinite(amount) ? Math.max(0, amount) : fallback;
}

function normalizeDoctor(doctor: Doctor): Doctor {
  const legacyDoctor = doctor as Doctor & { specialty?: string };

  return {
    ...doctor,
    designation: doctor.designation ?? legacyDoctor.specialty ?? "General practice",
    notes: doctor.notes ?? "",
    paymentModel: normalizeDoctorPaymentModel(doctor.paymentModel)
  };
}

function doctorToForm(doctor: Doctor): DoctorForm {
  const normalized = normalizeDoctor(doctor);
  const paymentModel = normalizeDoctorPaymentModel(normalized.paymentModel);

  return {
    id: normalized.id,
    name: normalized.name,
    designation: normalized.designation,
    phone: normalized.phone ?? "",
    active: normalized.active,
    notes: normalized.notes ?? "",
    activeModel: paymentModel.activeModel,
    dayConsultationPayout: String(paymentModel.lowSeason.dayConsultationPayout),
    nightConsultationPayout: String(paymentModel.lowSeason.nightConsultationPayout),
    nightStartTime: paymentModel.lowSeason.nightStartTime,
    nightEndTime: paymentModel.lowSeason.nightEndTime,
    shiftStartTime: paymentModel.peakSeason.shiftStartTime,
    shiftEndTime: paymentModel.peakSeason.shiftEndTime,
    hourlyRate: String(paymentModel.peakSeason.hourlyRate),
    bonusThresholdPatients: String(paymentModel.peakSeason.bonusThresholdPatients),
    bonusPerPatient: String(paymentModel.peakSeason.bonusPerPatient)
  };
}

function formToDoctor(form: DoctorForm): Doctor {
  return {
    id: form.id ?? crypto.randomUUID(),
    name: form.name.trim(),
    designation: form.designation.trim() || "General practice",
    phone: form.phone.trim() || undefined,
    notes: form.notes.trim() || undefined,
    active: form.active,
    paymentModel: {
      activeModel: form.activeModel,
      lowSeason: {
        dayConsultationPayout: toAmount(
          form.dayConsultationPayout,
          defaultDoctorPaymentModel.lowSeason.dayConsultationPayout
        ),
        nightConsultationPayout: toAmount(
          form.nightConsultationPayout,
          defaultDoctorPaymentModel.lowSeason.nightConsultationPayout
        ),
        nightStartTime: form.nightStartTime || defaultDoctorPaymentModel.lowSeason.nightStartTime,
        nightEndTime: form.nightEndTime || defaultDoctorPaymentModel.lowSeason.nightEndTime
      },
      peakSeason: {
        shiftStartTime: form.shiftStartTime || defaultDoctorPaymentModel.peakSeason.shiftStartTime,
        shiftEndTime: form.shiftEndTime || defaultDoctorPaymentModel.peakSeason.shiftEndTime,
        hourlyRate: toAmount(form.hourlyRate, defaultDoctorPaymentModel.peakSeason.hourlyRate),
        bonusThresholdPatients: toAmount(
          form.bonusThresholdPatients,
          defaultDoctorPaymentModel.peakSeason.bonusThresholdPatients
        ),
        bonusPerPatient: toAmount(
          form.bonusPerPatient,
          defaultDoctorPaymentModel.peakSeason.bonusPerPatient
        )
      }
    }
  };
}

export function DoctorsAdmin({ initialDoctors, payouts, canEdit }: DoctorsAdminProps) {
  const [doctors, setDoctors] = useState(() => initialDoctors.map(normalizeDoctor));
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
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(doctorStorageKey, JSON.stringify(doctors));
    }
  }, [doctors, hydrated]);

  const unpaidPayoutByDoctor = useMemo(() => {
    return payouts.reduce<Map<string, number>>((totals, payout) => {
      if (payout.status === "unpaid" && payout.payoutMode !== "pending_shift") {
        totals.set(payout.doctorId, (totals.get(payout.doctorId) ?? 0) + payout.payoutAmount);
      }

      return totals;
    }, new Map());
  }, [payouts]);

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

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink">Doctors</h2>
            <p className="mt-1 text-sm text-slate-500">
              {doctors.length} doctors in the mock directory
            </p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            disabled={!canEdit}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-lagoon-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-lagoon-700 disabled:bg-slate-300"
          >
            <CirclePlus className="h-4 w-4" aria-hidden="true" />
            Add Doctor
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Doctor name</th>
                <th className="px-5 py-3">Designation</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Active status</th>
                <th className="px-5 py-3">Active model</th>
                <th className="px-5 py-3 text-right">Total unpaid payout LKR</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {doctors.map((doctor) => (
                <tr
                  key={doctor.id}
                  className={cn(
                    "border-l-4",
                    doctor.active ? "border-l-emerald-500" : "border-l-rose-500"
                  )}
                >
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{doctor.name}</p>
                    {doctor.notes ? (
                      <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                        {doctor.notes}
                      </p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {doctor.designation}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
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
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {modelLabels[normalizeDoctorPaymentModel(doctor.paymentModel).activeModel]}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                    {money(unpaidPayoutByDoctor.get(doctor.id) ?? 0)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => editDoctor(doctor)}
                        disabled={!canEdit}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDoctorActive(doctor.id)}
                        disabled={!canEdit}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {doctor.active ? (
                          <UserX className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {doctor.active ? "Deactivate" : "Reactivate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDoctor(doctor.id)}
                        disabled={!canEdit}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
          <section className="w-full max-w-3xl rounded-xl bg-white shadow-xl">
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

            <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
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

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <h3 className="font-semibold text-ink">Doctor Payment Model</h3>
                <div className="mt-4">
                  <label className="label" htmlFor="active-payment-model">
                    Active model
                  </label>
                  <select
                    id="active-payment-model"
                    value={form.activeModel}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        activeModel: event.target.value as DoctorPaymentModelType
                      }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  >
                    <option value="low_season">{modelLabels.low_season}</option>
                    <option value="peak_season">{modelLabels.peak_season}</option>
                  </select>
                </div>

                {form.activeModel === "low_season" ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="day-payout">
                        Day consultation payout LKR
                      </label>
                      <input
                        id="day-payout"
                        type="number"
                        min={0}
                        step="1"
                        value={form.dayConsultationPayout}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            dayConsultationPayout: event.target.value
                          }))
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
                        value={form.nightConsultationPayout}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            nightConsultationPayout: event.target.value
                          }))
                        }
                        disabled={!canEdit}
                        className="field mt-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="night-start">
                        Night start time
                      </label>
                      <input
                        id="night-start"
                        type="time"
                        value={form.nightStartTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, nightStartTime: event.target.value }))
                        }
                        disabled={!canEdit}
                        className="field mt-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="night-end">
                        Night end time
                      </label>
                      <input
                        id="night-end"
                        type="time"
                        value={form.nightEndTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, nightEndTime: event.target.value }))
                        }
                        disabled={!canEdit}
                        className="field mt-2 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="shift-start">
                        Shift start time
                      </label>
                      <input
                        id="shift-start"
                        type="time"
                        value={form.shiftStartTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, shiftStartTime: event.target.value }))
                        }
                        disabled={!canEdit}
                        className="field mt-2 disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="shift-end">
                        Shift end time
                      </label>
                      <input
                        id="shift-end"
                        type="time"
                        value={form.shiftEndTime}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, shiftEndTime: event.target.value }))
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
                        value={form.hourlyRate}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, hourlyRate: event.target.value }))
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
                        value={form.bonusThresholdPatients}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            bonusThresholdPatients: event.target.value
                          }))
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
                        value={form.bonusPerPatient}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            bonusPerPatient: event.target.value
                          }))
                        }
                        disabled={!canEdit}
                        className="field mt-2 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDoctor}
                disabled={!canEdit || !form.name.trim()}
                className={cn(
                  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                  canEdit && form.name.trim()
                    ? "bg-lagoon-600 hover:bg-lagoon-700"
                    : "bg-slate-300"
                )}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {editing ? "Update doctor" : "Save doctor"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
