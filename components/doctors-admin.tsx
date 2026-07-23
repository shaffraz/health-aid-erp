"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { KpiCard, buttonClass } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { generatePayoutsForInvoices } from "@/lib/calculations";
import { money, monthKey, todayISO } from "@/lib/format";
import { generateId } from "@/lib/id";
import { useSystemSettings } from "@/lib/use-system-settings";
import {
  doctorStorageKey,
  type Doctor,
  type DoctorPayout,
  type Invoice
} from "@/lib/types";

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
  const systemSettings = useSystemSettings();
  const paymentSettings = systemSettings.doctorPayment;
  const activePaymentMode = systemSettings.operational.activePaymentMode;
  const localCurrencyCode = systemSettings.clinic.localCurrency;
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
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

  const visiblePayouts = useMemo(() => {
    const existingPayoutsById = new Map(payouts.map((payout) => [payout.id, payout]));

    return generatePayoutsForInvoices(initialInvoices, paymentSettings, activePaymentMode)
      .map((payout) => {
        const existing = existingPayoutsById.get(payout.id);

        return {
          ...payout,
          status: existing?.status ?? payout.status,
          voucherNo: existing?.voucherNo ?? payout.voucherNo
        };
      })
      .filter((payout) => payout.payoutMode !== "pending_shift");
  }, [activePaymentMode, initialInvoices, paymentSettings, payouts]);

  const payoutSummaryByDoctor = useMemo(() => {
    return visiblePayouts.reduce<Map<string, { pending: number }>>((totals, payout) => {
      const summary = totals.get(payout.doctorId) ?? { pending: 0 };

      if (payout.status === "unpaid") {
        summary.pending += payout.payoutAmount;
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
  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId);
  const selectedDoctorPending = selectedDoctor
    ? payoutSummaryByDoctor.get(selectedDoctor.id)?.pending ?? 0
    : 0;
  const selectedDoctorIsUsed = selectedDoctor
    ? initialInvoices.some((invoice) => invoice.doctorId === selectedDoctor.id) ||
      visiblePayouts.some((payout) => payout.doctorId === selectedDoctor.id)
    : false;

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
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Doctors" value={String(activeCount)} tone="primary" />
        <KpiCard label="Inactive Doctors" value={String(inactiveCount)} />
        <KpiCard
          label={`Pending Doctor Payouts ${localCurrencyCode}`}
          value={money(totalPending)}
          tone="danger"
        />
        <KpiCard
          label={`Paid This Month ${localCurrencyCode}`}
          value={money(paidThisMonth)}
          tone="success"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-white">Doctor Directory</h2>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={openAddForm}
              className={buttonClass("secondary", "border-white bg-white text-[#224770] hover:border-white hover:bg-[#efefef]")}
            >
              Add Doctor
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
          {doctors.map((doctor) => {
            const pending = payoutSummaryByDoctor.get(doctor.id)?.pending ?? 0;

            return (
              <button
                key={doctor.id}
                type="button"
                onClick={() => setSelectedDoctorId(doctor.id)}
                className="focus-ring min-h-36 rounded-xl border border-[#efefef] bg-white p-4 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-[#0eb6ef]/45 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[#224770]">
                      {doctor.name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-[#46484a]">
                      {doctor.designation}
                    </p>
                  </div>
                  <StatusPill tone={doctor.active ? "green" : "slate"}>
                    {doctor.active ? "Active" : "Inactive"}
                  </StatusPill>
                </div>
                <div className="mt-5">
                  <span className="label">Pending Payout</span>
                  <p className="mt-1 text-lg font-bold text-[#224770]">{money(pending)}</p>
                </div>
              </button>
            );
          })}
          {!doctors.length ? (
            <div className="rounded-xl border border-dashed border-[#d9d9d9] bg-[#efefef]/35 p-6 text-center text-sm text-[#46484a] sm:col-span-2 xl:col-span-4">
              No doctors have been added yet.
            </div>
          ) : null}
        </div>
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-form-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="doctor-form-title" className="font-semibold text-[#224770]">
                {editing ? "Edit doctor" : "Add doctor"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
                aria-label="Close doctor form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {!canEdit ? (
                <div className="rounded-lg border border-[#d9d9d9] bg-[#efefef] p-3 text-sm font-semibold text-[#46484a]">
                  Doctor setup is administrator-only.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-[#46484a]/25 bg-[#efefef] p-3 text-sm font-semibold text-[#224770]">
                  {error}
                </div>
              ) : null}

              <div className="form-grid grid gap-4 md:grid-cols-2">
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    className="field mt-2 min-h-24 disabled:bg-[#efefef]"
                    placeholder="Optional internal notes"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] bg-white px-5 py-4 sm:flex-row sm:justify-end">
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

      {selectedDoctor ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-details-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="doctor-details-title" className="font-semibold text-[#224770]">
                Doctor Details
              </h2>
              <button
                type="button"
                onClick={() => setSelectedDoctorId("")}
                className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
                aria-label="Close doctor details"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Detail label="Full Name" value={selectedDoctor.name} />
                <Detail label="Designation" value={selectedDoctor.designation} />
                <Detail label="Phone" value={selectedDoctor.phone ?? "N/A"} />
                <Detail label="Status" value={selectedDoctor.active ? "Active" : "Inactive"} />
                <Detail label={`Pending Payout ${localCurrencyCode}`} value={money(selectedDoctorPending)} />
                <div className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-3 sm:col-span-2">
                  <span className="label">Notes</span>
                  <p className="mt-1 font-semibold text-[#224770]">
                    {selectedDoctor.notes ?? "N/A"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-[#efefef] px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedDoctorId("")}
                className={buttonClass("secondary")}
              >
                Close
              </button>
              {canEdit ? (
                <>
                  {!selectedDoctorIsUsed ? (
                    <button
                      type="button"
                      onClick={() => {
                        deleteDoctor(selectedDoctor.id);
                        setSelectedDoctorId("");
                      }}
                      className={buttonClass("danger")}
                    >
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggleDoctorActive(selectedDoctor.id)}
                    className={buttonClass("secondary")}
                  >
                    {selectedDoctor.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      editDoctor(selectedDoctor);
                      setSelectedDoctorId("");
                    }}
                    className={buttonClass("primary")}
                  >
                    Edit Doctor
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efefef] bg-[#efefef]/35 p-3">
      <span className="label">{label}</span>
      <p className="mt-1 font-semibold text-[#224770]">{value}</p>
    </div>
  );
}
