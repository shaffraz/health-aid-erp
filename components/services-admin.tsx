"use client";

import { useEffect, useMemo, useState } from "react";
import { CirclePlus, Edit3, Save, Search, X } from "lucide-react";
import { money, usd } from "@/lib/format";
import {
  defaultPayoutEnabledForCategory,
  isPayoutEligibleCategory,
  serviceCategories,
  serviceStorageKey,
  type Service,
  type ServiceCategory
} from "@/lib/types";
import { cn } from "@/lib/utils";

type ServicesAdminProps = {
  initialServices: Service[];
  canEdit: boolean;
};

type ServiceForm = {
  id?: string;
  name: string;
  category: ServiceCategory;
  sellingPrice: string;
  payoutEnabled: boolean;
  payoutAmount: string;
  active: boolean;
};

const emptyForm: ServiceForm = {
  name: "",
  category: "Consultation",
  sellingPrice: "0",
  payoutEnabled: true,
  payoutAmount: "0",
  active: true
};

function serviceToForm(service: Service): ServiceForm {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    sellingPrice: String(service.sellingPrice),
    payoutEnabled: service.payoutEnabled,
    payoutAmount: String(service.defaultPayoutValue),
    active: service.active
  };
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function ServicesAdmin({ initialServices, canEdit }: ServicesAdminProps) {
  const [services, setServices] = useState(initialServices);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceCategory>("all");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(serviceStorageKey);
      if (storedServices) {
        const parsed = JSON.parse(storedServices);
        if (Array.isArray(parsed)) {
          setServices(parsed as Service[]);
        }
      }
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(serviceStorageKey, JSON.stringify(services));
    }
  }, [hydrated, services]);

  const filteredServices = useMemo(() => {
    const search = normalizeSearch(query);

    return services.filter((service) =>
      (categoryFilter === "all" || service.category === categoryFilter) &&
      (!search ||
        [service.name, service.category, service.active ? "active" : "inactive"]
          .join(" ")
          .toLowerCase()
          .includes(search))
    );
  }, [categoryFilter, query, services]);

  const editing = Boolean(form.id);
  const categoryCanPayout = isPayoutEligibleCategory(form.category);
  const effectivePayoutEnabled = categoryCanPayout && form.payoutEnabled;

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

  function updateCategory(category: ServiceCategory) {
    setForm((current) => ({
      ...current,
      category,
      payoutEnabled: current.id
        ? isPayoutEligibleCategory(category) && current.payoutEnabled
        : defaultPayoutEnabledForCategory(category),
      payoutAmount: isPayoutEligibleCategory(category) ? current.payoutAmount : "0"
    }));
  }

  function saveService() {
    if (!canEdit) {
      return;
    }

    const name = form.name.trim();
    if (!name) {
      setError("Service name is required.");
      return;
    }

    const sellingPrice = Math.max(0, Number(form.sellingPrice));
    const payoutEnabled = isPayoutEligibleCategory(form.category) && form.payoutEnabled;
    const payoutAmount = payoutEnabled ? Math.max(0, Number(form.payoutAmount)) : 0;
    const nextService: Service = {
      id: form.id ?? crypto.randomUUID(),
      name,
      category: form.category,
      sellingPrice,
      payoutEnabled,
      defaultPayoutType: payoutEnabled ? "fixed" : "none",
      defaultPayoutValue: payoutAmount,
      defaultPayoutReason: payoutEnabled
        ? `${name} doctor payout`
        : "No doctor payout configured",
      active: form.active
    };

    setServices((current) =>
      form.id
        ? current.map((service) => (service.id === form.id ? nextService : service))
        : [nextService, ...current]
    );
    resetForm();
  }

  function editService(service: Service) {
    setForm(serviceToForm(service));
    setError("");
    setFormOpen(true);
  }

  function toggleServiceActive(serviceId: string) {
    if (!canEdit) {
      return;
    }

    setServices((current) =>
      current.map((service) =>
        service.id === serviceId ? { ...service, active: !service.active } : service
      )
    );
  }

  function formatPayout(service: Service) {
    if (!service.payoutEnabled || service.defaultPayoutValue <= 0) {
      return "No payout";
    }

    return money(service.defaultPayoutValue);
  }

  return (
    <>
      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Search services</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field pl-9"
              placeholder="Search services"
            />
          </label>
          <select
            aria-label="Filter services by category"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value as "all" | ServiceCategory)}
            className="field lg:max-w-xs"
          >
            <option value="all">All categories</option>
            {serviceCategories.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={openAddForm}
            disabled={!canEdit}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-lagoon-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-lagoon-700 disabled:bg-slate-300 lg:ml-auto"
          >
            <CirclePlus className="h-4 w-4" aria-hidden="true" />
            Add Service
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Service name</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Price USD</th>
                <th className="px-5 py-3 text-right">Doctor payout LKR</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredServices.map((service) => (
                <tr key={service.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-ink">{service.name}</p>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                    {service.category}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                    {usd(service.sellingPrice)}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-ink">
                    {formatPayout(service)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "font-semibold",
                        service.active ? "text-emerald-700" : "text-slate-500"
                      )}
                    >
                      {service.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => editService(service)}
                        disabled={!canEdit}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleServiceActive(service.id)}
                        disabled={!canEdit}
                        className="focus-ring inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        {service.active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredServices.length ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-500">
                    No services match your search.
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
          aria-labelledby="service-form-title"
        >
          <section className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 id="service-form-title" className="font-semibold text-ink">
                {editing ? "Edit service" : "Add service"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                aria-label="Close service form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              {!canEdit ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  This role can review services but cannot change setup rules.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label" htmlFor="service-name">
                    Service name
                  </label>
                  <input
                    id="service-name"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
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
                    value={form.category}
                    onChange={(event) => updateCategory(event.target.value as ServiceCategory)}
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
                    Price USD
                  </label>
                  <input
                    id="selling-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sellingPrice: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="payout-amount">
                    Doctor payout LKR
                  </label>
                  <input
                    id="payout-amount"
                    type="number"
                    min={0}
                    step="1"
                    value={effectivePayoutEnabled ? form.payoutAmount : "0"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payoutAmount: event.target.value }))
                    }
                    disabled={!canEdit || !effectivePayoutEnabled}
                    className="field mt-2 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="payout-enabled">
                    Payout
                  </label>
                  <select
                    id="payout-enabled"
                    value={effectivePayoutEnabled ? "yes" : "no"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        payoutEnabled: event.target.value === "yes"
                      }))
                    }
                    disabled={!canEdit || !categoryCanPayout}
                    className="field mt-2 disabled:bg-slate-100"
                  >
                    <option value="yes">Enabled</option>
                    <option value="no">Disabled</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="service-active">
                    Status
                  </label>
                  <select
                    id="service-active"
                    value={form.active ? "yes" : "no"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, active: event.target.value === "yes" }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-slate-100"
                  >
                    <option value="yes">Active</option>
                    <option value="no">Inactive</option>
                  </select>
                </div>
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
                onClick={saveService}
                disabled={!canEdit || !form.name.trim()}
                className={cn(
                  "focus-ring inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition",
                  canEdit && form.name.trim()
                    ? "bg-lagoon-600 hover:bg-lagoon-700"
                    : "bg-slate-300"
                )}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {editing ? "Update service" : "Save service"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
