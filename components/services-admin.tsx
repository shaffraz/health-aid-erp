"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ActionSelect } from "@/components/action-select";
import { KpiCard, buttonClass, tableStyles } from "@/components/erp-ui";
import { StatusPill } from "@/components/status-pill";
import { invoiceItemRevenueAmount } from "@/lib/calculations";
import { money, usdWhole } from "@/lib/format";
import { generateId } from "@/lib/id";
import { useSystemSettings } from "@/lib/use-system-settings";
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

const serviceGroups: Array<{
  title: string;
  categories: ServiceCategory[];
}> = [
  { title: "Consultations", categories: ["Consultation"] },
  { title: "Procedures", categories: ["Procedures", "Wound Care"] },
  { title: "Day Care", categories: ["IV Therapy", "Day Care Admissions"] },
  { title: "Laboratory", categories: ["Lab Services"] },
  { title: "Vaccinations", categories: ["Vaccines / ARV"] },
  { title: "Medication", categories: ["Medication Charges", "Consumables Charges"] },
  { title: "Other Charges", categories: ["Hospital Charges", "Other Charges"] }
];

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

function normalizeService(service: Service): Service {
  return {
    ...service,
    sellingPrice: Math.max(0, Math.round(service.sellingPrice)),
    defaultPayoutValue: Math.max(0, Math.round(service.defaultPayoutValue)),
    active: service.active ?? true
  };
}

function groupTitleForCategory(category: ServiceCategory) {
  return serviceGroups.find((group) => group.categories.includes(category))?.title ?? serviceGroups[0].title;
}

export function ServicesAdmin({ initialServices, invoices, canEdit }: ServicesAdminProps) {
  const [services, setServices] = useState(initialServices);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceCategory>("all");
  const [error, setError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const systemSettings = useSystemSettings();
  const invoiceCurrencyCode = systemSettings.clinic.currency;
  const localCurrencyCode = systemSettings.clinic.localCurrency;
  const [selectedGroupTitle, setSelectedGroupTitle] = useState(serviceGroups[0]?.title ?? "");

  useEffect(() => {
    try {
      const storedServices = window.localStorage.getItem(serviceStorageKey);
      if (storedServices) {
        const parsed = JSON.parse(storedServices);
        if (Array.isArray(parsed)) {
          setServices((parsed as Service[]).map(normalizeService));
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
          (revenueByService.get(item.serviceId) ?? 0) + invoiceItemRevenueAmount(invoice, item)
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

  const usageCountByService = useMemo(() => {
    const usage = new Map<string, number>();

    invoices.forEach((invoice) => {
      invoice.items.forEach((item) => {
        usage.set(item.serviceId, (usage.get(item.serviceId) ?? 0) + 1);
      });
    });

    return usage;
  }, [invoices]);

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

    const sellingPrice = Math.max(0, Math.round(Number(form.sellingPrice)));
    const payoutAmount = categoryCanPayout ? Math.max(0, Math.round(Number(form.payoutAmount))) : 0;
    const payoutEnabled = payoutAmount > 0;
    const nextService: Service = {
      id: form.id ?? generateId(),
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

  const selectedGroup = serviceGroups.find((group) => group.title === selectedGroupTitle) ?? serviceGroups[0];
  const selectedGroupServices = selectedGroup
    ? filteredServices.filter((service) => selectedGroup.categories.includes(service.category))
    : filteredServices;

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
              ? usdWhole(serviceMetrics.highestRevenueService.value)
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
        <div className="flex flex-col gap-3 border-b border-[#224770] bg-[#224770] px-4 py-3 lg:flex-row lg:items-center">
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
            onChange={(event) => {
              const nextCategory = event.target.value as "all" | ServiceCategory;
              setCategoryFilter(nextCategory);
              if (nextCategory !== "all") {
                setSelectedGroupTitle(groupTitleForCategory(nextCategory));
              }
            }}
            className="field lg:max-w-xs"
          >
            <option value="all">All categories</option>
            {serviceCategories.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
          {canEdit ? (
            <button
              type="button"
              onClick={openAddForm}
              className={buttonClass("secondary", "border-white bg-white text-[#224770] hover:border-white hover:bg-[#efefef] lg:ml-auto")}
            >
              Add Service
            </button>
          ) : null}
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {serviceGroups.map((group) => {
              const groupServices = filteredServices.filter((service) =>
                group.categories.includes(service.category)
              );
              const active = selectedGroupTitle === group.title;

              return (
                <button
                  key={group.title}
                  type="button"
                  onClick={() => setSelectedGroupTitle(group.title)}
                  className={`focus-ring min-h-20 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                    active
                      ? "border-[#224770] bg-[#224770] text-white"
                      : "border-[#efefef] bg-white text-[#224770] hover:border-[#0eb6ef]/45"
                  }`}
                >
                  <span className="block font-semibold">{group.title}</span>
                  <span className={`mt-2 block text-sm font-medium ${active ? "text-white/80" : "text-[#46484a]"}`}>
                    {groupServices.length} service{groupServices.length === 1 ? "" : "s"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="overflow-hidden rounded-xl border border-[#efefef] bg-white">
            <div className="flex flex-col gap-1 border-b border-[#efefef] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-semibold text-[#224770]">{selectedGroup?.title ?? "Services"}</h3>
              <span className="text-sm font-semibold text-[#46484a]">
                {selectedGroupServices.length} service{selectedGroupServices.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className={tableStyles.wrapper}>
              <table className={tableStyles.table}>
                <thead className={tableStyles.head}>
                  <tr>
                    <th className={tableStyles.headerCell}>Service Name</th>
                    <th className={tableStyles.numericHeaderCell}>
                      Price {invoiceCurrencyCode}
                    </th>
                    <th className={tableStyles.numericHeaderCell}>
                      Doctor Payout {localCurrencyCode}
                    </th>
                    <th className={tableStyles.headerCell}>Status</th>
                    {canEdit ? <th className={tableStyles.actionHeaderCell}>Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efefef]">
                  {selectedGroupServices.map((service) => {
                    const serviceIsUsed = (usageCountByService.get(service.id) ?? 0) > 0;

                    return (
                      <tr key={service.id} className={tableStyles.row}>
                        <td className={tableStyles.strongCell}>
                          <p>{service.name}</p>
                          <p className="mt-1 text-xs font-normal text-[#46484a]">
                            {service.category}
                          </p>
                        </td>
                        <td className={tableStyles.numericCell}>
                          {usdWhole(service.sellingPrice)}
                        </td>
                        <td className={tableStyles.numericCell}>{formatPayout(service)}</td>
                        <td className={tableStyles.cell}>
                          <StatusPill tone={service.active ? "green" : "slate"}>
                            {service.active ? "Active" : "Inactive"}
                          </StatusPill>
                        </td>
                        {canEdit ? (
                          <td className={tableStyles.actionCell}>
                            <ActionSelect
                              ariaLabel={`Actions for ${service.name}`}
                              actions={[
                                {
                                  value: "edit",
                                  label: "Edit",
                                  onSelect: () => editService(service)
                                },
                                {
                                  value: "toggle",
                                  label: service.active ? "Deactivate" : "Activate",
                                  onSelect: () => toggleServiceActive(service.id)
                                },
                                !serviceIsUsed
                                  ? {
                                      value: "delete",
                                      label: "Delete",
                                      onSelect: () => deleteService(service.id)
                                    }
                                  : null
                              ].filter((action): action is {
                                value: string;
                                label: string;
                                onSelect: () => void;
                              } => Boolean(action))}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {!selectedGroupServices.length ? (
                    <tr>
                      <td
                        colSpan={canEdit ? 5 : 4}
                        className="px-5 py-8 text-center text-sm text-[#46484a]"
                      >
                        No services found for this category.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-form-title"
        >
          <section className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#efefef] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#efefef] px-5 py-4">
              <h2 id="service-form-title" className="font-semibold text-[#224770]">
                {editing ? "Edit service" : "Add service"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="focus-ring rounded-lg p-2 text-[#46484a]/65 transition hover:bg-[#efefef] hover:text-[#224770]"
                aria-label="Close service form"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {!canEdit ? (
                <div className="rounded-lg border border-[#d9d9d9] bg-[#efefef] p-3 text-sm font-semibold text-[#46484a]">
                  This role can review services but cannot change setup rules.
                </div>
              ) : null}

              {error ? (
                <div className="rounded-lg border border-[#46484a]/25 bg-[#efefef] p-3 text-sm font-semibold text-[#224770]">
                  {error}
                </div>
              ) : null}

              <div className="form-grid grid gap-4 md:grid-cols-2">
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
                    Selling price {invoiceCurrencyCode}
                  </label>
                  <input
                    id="selling-price"
                    type="number"
                    min={0}
                    step="1"
                    value={form.sellingPrice}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sellingPrice: event.target.value }))
                    }
                    disabled={!canEdit}
                    className="field mt-2 disabled:bg-[#efefef]"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="payout-amount">
                    Doctor payout amount {localCurrencyCode}
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
                    className="field mt-2 disabled:bg-[#efefef]"
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
