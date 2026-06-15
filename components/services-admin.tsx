"use client";

import { useState } from "react";
import { CirclePlus, Save, ShieldCheck } from "lucide-react";
import { createServiceAction } from "@/lib/actions";
import { demoSettings } from "@/lib/demo-data";
import { convertLkrToUsd, money, usd } from "@/lib/format";
import {
  serviceCategories,
  type RuleType,
  type Service,
  type ServiceCategory
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ServicesAdminProps = {
  initialServices: Service[];
  canEdit: boolean;
};

const ruleTypeLabels: Record<RuleType, string> = {
  fixed: "Fixed",
  percentage: "Percentage",
  none: "None"
};

export function ServicesAdmin({ initialServices, canEdit }: ServicesAdminProps) {
  const [services, setServices] = useState(initialServices);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("Consultation");
  const [sellingPrice, setSellingPrice] = useState(0);
  const [payoutType, setPayoutType] = useState<RuleType>("none");
  const [payoutValue, setPayoutValue] = useState(0);
  const [payoutReason, setPayoutReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const serviceUsd = (value: number) =>
    usd(convertLkrToUsd(value, demoSettings.exchangeRateLkrPerUsd));

  async function addService() {
    if (!canEdit || !name.trim()) {
      return;
    }

    setError("");
    setPending(true);

    const result = await createServiceAction({
      name,
      category,
      sellingPrice,
      defaultPayoutType: payoutType,
      defaultPayoutValue: payoutValue,
      defaultPayoutReason: payoutReason.trim() || "No doctor payout configured"
    });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const service: Service = {
      id: result.data.id,
      name: name.trim(),
      category,
      sellingPrice: Math.max(0, sellingPrice),
      defaultPayoutType: payoutType,
      defaultPayoutValue: Math.max(0, payoutValue),
      defaultPayoutReason: payoutReason.trim() || "Default doctor payout",
      active: true
    };

    setServices((current) => [service, ...current]);
    setName("");
    setSellingPrice(0);
    setPayoutType("none");
    setPayoutValue(0);
    setPayoutReason("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="panel p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-lagoon-50 p-2 text-lagoon-700">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-ink">Create service</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Services define price and default doctor payment behavior.
            </p>
          </div>
        </div>

        {!canEdit ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            This role can review services but cannot change setup rules.
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="service-name">
              Service name
            </label>
            <input
              id="service-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              className="field mt-2 disabled:bg-slate-100"
              placeholder="Eg. Travel consultation"
            />
          </div>
          <div>
            <label className="label" htmlFor="service-category">
              Category
            </label>
            <select
              id="service-category"
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
          <div>
            <label className="label" htmlFor="selling-price">
              Selling price
            </label>
            <input
              id="selling-price"
              type="number"
              min={0}
              value={sellingPrice}
              onChange={(event) => setSellingPrice(Number(event.target.value))}
              disabled={!canEdit}
              className="field mt-2 disabled:bg-slate-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="payout-type">
                Doctor payout
              </label>
              <select
                id="payout-type"
                value={payoutType}
                onChange={(event) => setPayoutType(event.target.value as RuleType)}
                disabled={!canEdit}
                className="field mt-2 disabled:bg-slate-100"
              >
                <option value="none">None</option>
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="payout-value">
                Value
              </label>
              <input
                id="payout-value"
                type="number"
                min={0}
                value={payoutValue}
                onChange={(event) => setPayoutValue(Number(event.target.value))}
                disabled={!canEdit || payoutType === "none"}
                className="field mt-2 disabled:bg-slate-100"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="payout-reason">
              Payment reason
            </label>
            <input
              id="payout-reason"
              value={payoutReason}
              onChange={(event) => setPayoutReason(event.target.value)}
              disabled={!canEdit || payoutType === "none"}
              className="field mt-2 disabled:bg-slate-100"
              placeholder="Eg. Consultation professional fee"
            />
          </div>
          <button
            type="button"
            onClick={addService}
            disabled={pending || !canEdit || !name.trim()}
            className={cn(
              "focus-ring inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
              !pending && canEdit && name.trim() ? "bg-lagoon-600 hover:bg-lagoon-700" : "bg-slate-300"
            )}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            {pending ? "Saving..." : "Save service"}
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="font-semibold text-ink">Service catalog</h2>
            <p className="mt-1 text-sm text-slate-500">{services.length} configured services</p>
          </div>
          <CirclePlus className="h-5 w-5 text-care-600" aria-hidden="true" />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Price</th>
                <th className="px-5 py-3">Default doctor payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((service) => (
                <tr key={service.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{service.name}</p>
                    <p className="text-xs text-slate-500">{service.active ? "Active" : "Inactive"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{service.category}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                    {serviceUsd(service.sellingPrice)}
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    <p className="font-medium text-ink">
                      {ruleTypeLabels[service.defaultPayoutType]}{" "}
                      {service.defaultPayoutType === "percentage"
                        ? `${service.defaultPayoutValue}%`
                        : service.defaultPayoutType === "fixed"
                          ? money(service.defaultPayoutValue)
                          : ""}
                    </p>
                    <p className="text-xs text-slate-500">{service.defaultPayoutReason}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
