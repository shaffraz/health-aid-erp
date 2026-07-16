import { defaultSystemSettings } from "@/lib/settings";

export const currencyFormatter = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: defaultSystemSettings.clinic.localCurrency,
  maximumFractionDigits: 0
});

export const usdCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: defaultSystemSettings.clinic.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const wholeUsdCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: defaultSystemSettings.clinic.currency,
  maximumFractionDigits: 0
});

export function money(value: number) {
  return currencyFormatter.format(value);
}

export function usd(value: number) {
  return usdCurrencyFormatter.format(value);
}

export function usdWhole(value: number) {
  return wholeUsdCurrencyFormatter.format(Math.round(value));
}

export function convertLkrToUsd(value: number, exchangeRate: number) {
  return Number((value / exchangeRate).toFixed(2));
}

export function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function monthKey(value: string | Date) {
  return new Date(value).toISOString().slice(0, 7);
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: defaultSystemSettings.clinic.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}
