"use client";

import { useMemo, useState } from "react";
import { CirclePlus, Save, Stethoscope } from "lucide-react";
import { createDoctorAction, createDoctorPaymentRuleAction } from "@/lib/actions";
import { money } from "@/lib/format";
import {
  serviceCategories,
  type Doctor,
  type DoctorPaymentRule,
  type RuleType,
  type Service,
  type ServiceCategory
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DoctorsAdminProps = {
  initialDoctors: Doctor[];
  initialRules: DoctorPaymentRule[];
  services: Service[];
  canEdit: boolean;
};

type RuleScope = "service" | "category";

export function DoctorsAdmin({
  initialDoctors,
  initialRules,
  services,
  canEdit
}: DoctorsAdminProps) {
  const [doctors, setDoctors] = useState(initialDoctors);
  const [rules, setRules] = useState(initialRules);
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState(initialDoctors[0]?.id ?? "");
  const [scope, setScope] = useState<RuleScope>("service");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [category, setCategory] = useState<ServiceCategory>("Consultation");
  const [ruleType, setRuleType] = useState<RuleType>("fixed");
  const [ruleValue, setRuleValue] = useState(0);
  const [reason, setReason] = useState("");
  const [doctorPending, setDoctorPending] = useState(false);
  const [rulePending, setRulePending] = useState(false);
  const [error, setError] = useState("");

  const selectedDoctorRules = useMemo(
    () =>
      rules
        .filter((rule) => rule.doctorId === selectedDoctor)
        .sort((a, b) => b.priority - a.priority),
    [rules, selectedDoctor]
  );

  async function addDoctor() {
    if (!canEdit || !name.trim()) {
      return;
    }

    setError("");
    setDoctorPending(true);

    const result = await createDoctorAction({
      name,
      specialty,
      registrationNo,
      phone,
      email
    });

    setDoctorPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const doctor: Doctor = {
      id: result.data.id,
      name: name.trim(),
      specialty: specialty.trim() || "General practice",
      registrationNo: registrationNo.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      active: true
    };

    setDoctors((current) => [doctor, ...current]);
    setSelectedDoctor(doctor.id);
    setName("");
    setSpecialty("");
    setRegistrationNo("");
    setEmail("");
    setPhone("");
  }

  async function addRule() {
    if (!canEdit || !selectedDoctor || !reason.trim()) {
      return;
    }

    setError("");
    setRulePending(true);

    const payload = {
      doctorId: selectedDoctor,
      serviceId: scope === "service" ? serviceId : undefined,
      category: scope === "category" ? category : undefined,
      type: ruleType,
      value: ruleValue,
      reason,
      priority: scope === "service" ? 100 : 80
    };
    const result = await createDoctorPaymentRuleAction(payload);

    setRulePending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const rule: DoctorPaymentRule = {
      id: result.data.id,
      doctorId: selectedDoctor,
      serviceId: scope === "service" ? serviceId : undefined,
      category: scope === "category" ? category : undefined,
      type: ruleType,
      value: Math.max(0, ruleValue),
      reason: reason.trim(),
      priority: scope === "service" ? 100 : 80
    };

    setRules((current) => [rule, ...current]);
    setRuleValue(0);
    setReason("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="panel p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-care-50 p-2 text-care-700">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-ink">Create doctor</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Link doctor users to these records through profile doctor_id.
              </p>
            </div>
          </div>

          {!canEdit ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              Doctor setup is admin-only.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="doctor-name">
                Doctor name
              </label>
              <input
                id="doctor-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="label" htmlFor="specialty">
                Specialty
              </label>
              <input
                id="specialty"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="registration">
                  Registration
                </label>
                <input
                  id="registration"
                  value={registrationNo}
                  onChange={(event) => setRegistrationNo(event.target.value)}
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
              <div>
                <label className="label" htmlFor="phone">
                  Phone
                </label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={addDoctor}
              disabled={doctorPending || !canEdit || !name.trim()}
              className={cn(
                "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                !doctorPending && canEdit && name.trim()
                  ? "bg-lagoon-600 hover:bg-lagoon-700"
                  : "bg-slate-300"
              )}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {doctorPending ? "Saving..." : "Save doctor"}
            </button>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-semibold text-ink">Doctor payment rule</h2>
          <p className="mt-1 text-sm text-slate-500">Exact service rules outrank category rules.</p>
          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="selected-doctor">
                Doctor
              </label>
              <select
                id="selected-doctor"
                value={selectedDoctor}
                onChange={(event) => setSelectedDoctor(event.target.value)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
              >
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(["service", "category"] as RuleScope[]).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setScope(candidate)}
                  disabled={!canEdit}
                  className={cn(
                    "focus-ring rounded-lg border px-3 py-2 text-sm font-semibold capitalize",
                    scope === candidate
                      ? "border-lagoon-600 bg-lagoon-50 text-lagoon-700"
                      : "border-slate-200 bg-white text-slate-600"
                  )}
                >
                  {candidate}
                </button>
              ))}
            </div>
            {scope === "service" ? (
              <div>
                <label className="label" htmlFor="rule-service">
                  Service
                </label>
                <select
                  id="rule-service"
                  value={serviceId}
                  onChange={(event) => setServiceId(event.target.value)}
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                >
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="rule-category">
                  Category
                </label>
                <select
                  id="rule-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as ServiceCategory)}
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                >
                  {serviceCategories.map((candidate) => (
                    <option key={candidate} value={candidate}>
                      {candidate}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="rule-type">
                  Rule type
                </label>
                <select
                  id="rule-type"
                  value={ruleType}
                  onChange={(event) => setRuleType(event.target.value as RuleType)}
                  disabled={!canEdit}
                  className="field mt-2 disabled:bg-slate-100"
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="rule-value">
                  Value
                </label>
                <input
                  id="rule-value"
                  type="number"
                  value={ruleValue}
                  onChange={(event) => setRuleValue(Number(event.target.value))}
                  disabled={!canEdit || ruleType === "none"}
                  className="field mt-2 disabled:bg-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="rule-reason">
                Payment reason
              </label>
              <input
                id="rule-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
                placeholder="Eg. Senior doctor procedure share"
              />
            </div>
            <button
              type="button"
              onClick={addRule}
              disabled={rulePending || !canEdit || !selectedDoctor || !reason.trim()}
              className={cn(
                "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                !rulePending && canEdit && selectedDoctor && reason.trim()
                  ? "bg-lagoon-600 hover:bg-lagoon-700"
                  : "bg-slate-300"
              )}
            >
              <CirclePlus className="h-4 w-4" aria-hidden="true" />
              {rulePending ? "Adding..." : "Add payment rule"}
            </button>
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-semibold text-ink">Doctors and payout rules</h2>
          <p className="mt-1 text-sm text-slate-500">Doctor-specific payment rules are applied when POS invoices are saved.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {doctors.map((doctor) => {
            const doctorRules = rules.filter((rule) => rule.doctorId === doctor.id);

            return (
              <article key={doctor.id} className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{doctor.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {doctor.specialty} {doctor.registrationNo ? `- ${doctor.registrationNo}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[doctor.email, doctor.phone].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                  <span className="rounded-full bg-care-50 px-2.5 py-1 text-xs font-semibold text-care-700">
                    {doctor.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {doctorRules.length ? (
                    doctorRules.map((rule) => {
                      const service = services.find((candidate) => candidate.id === rule.serviceId);
                      const scopeLabel = service?.name ?? rule.category ?? "Rule";

                      return (
                        <div key={rule.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-ink">{scopeLabel}</p>
                            <p className="text-sm font-bold text-lagoon-700">
                              {rule.type === "percentage"
                                ? `${rule.value}%`
                                : rule.type === "fixed"
                                  ? money(rule.value)
                                  : "No payout"}
                            </p>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{rule.reason}</p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                      Uses service defaults unless a doctor-specific rule is created.
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel p-5 xl:col-start-2">
        <h2 className="font-semibold text-ink">Selected doctor rule order</h2>
        <div className="mt-3 space-y-2">
          {selectedDoctorRules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-600">
                {services.find((service) => service.id === rule.serviceId)?.name ?? rule.category}
              </span>
              <span className="font-semibold text-ink">Priority {rule.priority}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
