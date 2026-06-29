"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { money, usd } from "@/lib/format";
import {
  isPayoutEligibleCategory,
  serviceCategories,
  serviceStorageKey,
  type Invoice,
  type Service,
  type ServiceCategory
} from "@/lib/types";

type ServicesAdminProps = {
  initialServices: Service[];
  invoices: Invoice[];
  canEdit: boolean;
};

type ServiceForm = {
  id?: string;
  name: string;
  category: ServiceCategory;
  sellingPrice: string;
  payoutAmount: string;
};

const emptyForm: ServiceForm = {
  name: "",
  category: "Consultation",
  sellingPrice: "0",
  payoutAmount: "0"
};

function serviceToForm(service: Service): ServiceForm {
  return {
    id: service.id,
    name: service.name,
    category: service.category,
    sellingPrice: String(service.sellingPrice),
    payoutAmount: String(service.defaultPayoutValue)
  };
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

export function ServicesAdmin({ initialServices, invoices, canEdit }: ServicesAdminProps) {
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
          setServices((parsed as Service[]).map((service) => ({ ...service, active: true })));
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
        [service.name, service.category]
          .join(" ")
          .toLowerCase()
          .includes(search))
    );
  }, [categoryFilter, query, services]);

  const activeServices = services.filter((service) => service.active).length;
  const inactiveServices = services.length - activeServices;
  const serviceMetrics = useMemo(() => {
    const revenueByService = new Map<string, number>();
    const usageByService = new Map<string, number>();

    invoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        revenueByService.set(
          item.serviceId,
          (revenueByService.get(item.serviceId) ?? 0) + item.lineTotal
        );
        usageByService.set(
          item.serviceId,
          (usageByService.get(item.serviceId) ?? 0) + Math.max(1, item.quantity)
        );
      });
    });

    const highestRevenueService = services
      .map((service) => ({
        service,
        value: revenueByService.get(service.id) ?? 0
      }))
      .sort((a, b) => b.value - a.value)[0];
    const mostUsedService = services
      .map((service) => ({
        service,
        value: usageByService.get(service.id) ?? 0
      }))
      .sort((a, b) => b.value - a.value)[0];

    return {
      highestRevenueService:
        highestRevenueService && highestRevenueService.value > 0
          ? highestRevenueService
          : null,
      mostUsedService:
        mostUsedService && mostUsedService.value > 0 ? mostUsedService : null
    };
  }, [invoices, services]);

  const editing = Boolean(form.id);
  const categoryCanPayout = isPayoutEligibleCategory(form.category);

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
    const payoutAmount = categoryCanPayout ? Math.max(0, Number(form.payoutAmount)) : 0;
    const payoutEnabled = payoutAmount > 0;
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
      active: true
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

  function deleteService(serviceId: string) {
    if (!canEdit) {
      return;
    }

    setServices((current) => current.filter((candidate) => candidate.id !== serviceId));
  }

  function formatPayout(service: Service) {
    if (!service.payoutEnabled || service.defaultPayoutValue <= 0) {
      return "No payout";
    }

    return money(service.defaultPayoutValue);
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Services" value={String(activeServices)} tone="primary" />
        <KpiCard label="Inactive Services" value={String(inactiveServices)} />
        <KpiCard
          label="Highest Revenue Service"
          value={serviceMetrics.highestRevenueService?.service.name ?? "-"}
          helper={
            serviceMetrics.highestRevenueService
              ? usd(serviceMetrics.highestRevenueService.value)
              : "No invoice revenue"
          }
          tone="success"
        />
        <KpiCard
          label="Most Used Service"
          value={serviceMetrics.mostUsedService?.service.name ?? "-"}
          helper={
            serviceMetrics.mostUsedService
              ? `${serviceMetrics.mostUsedService.value} invoice item${
                  serviceMetrics.mostUsedService.value === 1 ? "" : "s"
                }`
              : "No service usage"
          }
          tone="info"
        />
      </div>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <label className="relative block w-full lg:max-w-sm">
            <span className="sr-only">Search services</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="field"
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
            className={buttonClass("primary", "lg:ml-auto")}
          >
            Add Service
          </button>
        </div>

        <div className={tableStyles.wrapper}>
          <table className={tableStyles.table}>
            <thead className={tableStyles.head}>
              <tr>
                <th className={tableStyles.headerCell}>Service name</th>
                <th className={tableStyles.headerCell}>Category</th>
                <th className={tableStyles.numericHeaderCell}>Selling price USD</th>
                <th className={tableStyles.numericHeaderCell}>Doctor payout amount LKR</th>
                <th className={tableStyles.numericHeaderCell}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efefef]">
              {filteredServices.map((service) => (
                <tr key={service.id} className={tableStyles.row}>
                  <td className={tableStyles.strongCell}>
                    <p>{service.name}</p>
                  </td>
                  <td className={tableStyles.cell}>
                    {service.category}
                  </td>
                  <td className={tableStyles.numericCell}>
                    {usd(service.sellingPrice)}
                  </td>
                  <td className={tableStyles.numericCell}>
                    {formatPayout(service)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => editService(service)}
                        disabled={!canEdit}
                        className={buttonClass("secondary", "px-3 py-2 text-xs")}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteService(service.id)}
                        disabled={!canEdit}
                        title="Delete service"
                        className={buttonClass("danger", "px-3 py-2 text-xs")}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredServices.length ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#46484a]">
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
                    Selling price USD
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
                    Doctor payout amount LKR
                  </label>
                  <input
                    id="payout-amount"
                    type="number"
                    min={0}
                    step="1"
                    value={categoryCanPayout ? form.payoutAmount : "0"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, payoutAmount: event.target.value }))
                    }
                    disabled={!canEdit || !categoryCanPayout}
                    className="field mt-2 disabled:bg-slate-100"
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
                onClick={saveService}
                disabled={!canEdit || !form.name.trim()}
                className={buttonClass(canEdit && form.name.trim() ? "primary" : "muted")}
              >
                {editing ? "Update service" : "Save service"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
