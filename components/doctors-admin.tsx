"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
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
        <div className="border-b border-[#224770] bg-[#224770] p-5">
          <h2 className="font-semibold text-white">Pending Payouts by Doctor</h2>
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
                <p className="mt-3 text-lg font-bold text-[#224770]">{money(pending)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] p-4 sm:flex-row sm:items-center sm:justify-between">
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

        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Name</th>
                <th className={tableStyles.headerCell}>Designation</th>
                <th className={tableStyles.headerCell}>Phone</th>
                <th className={tableStyles.headerCell}>Status</th>
                <th className={tableStyles.numericHeaderCell}>
                  Pending payout {localCurrencyCode}
                </th>
                {canEdit ? <th className={tableStyles.actionHeaderCell}>Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {doctors.map((doctor) => {
                const summary = payoutSummaryByDoctor.get(doctor.id);
                const doctorIsUsed =
                  initialInvoices.some((invoice) => invoice.doctorId === doctor.id) ||
                  visiblePayouts.some((payout) => payout.doctorId === doctor.id);

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
                          doctor.active ? "text-[#84bc3f]" : "text-[#46484a]"
                        )}
                      >
                        {doctor.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={tableStyles.numericCell}>
                      {money(summary?.pending ?? 0)}
                    </td>
                    {canEdit ? (
                      <td className={tableStyles.actionCell}>
                        <ActionSelect
                          ariaLabel={`Actions for ${doctor.name}`}
                          actions={[
                            {
                              value: "edit",
                              label: "Edit",
                              onSelect: () => editDoctor(doctor)
                            },
                            {
                              value: "toggle",
                              label: doctor.active ? "Deactivate" : "Reactivate",
                              onSelect: () => toggleDoctorActive(doctor.id)
                            },
                            {
                              value: "delete",
                              label: doctorIsUsed ? "Delete unavailable" : "Delete",
                              disabled: doctorIsUsed,
                              onSelect: () => deleteDoctor(doctor.id)
                            }
                          ]}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
              {!doctors.length ? (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-5 py-10 text-center text-sm text-[#46484a]">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-form-title"
        >
          <section className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
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

            <div className="space-y-4 p-5">
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
