import { instanceConfig } from "../config/instance";

const currencyFormatter = new Intl.NumberFormat(instanceConfig.locale, {
  style: "currency",
  currency: instanceConfig.currency,
});

const dateTimeFormatter = new Intl.DateTimeFormat(instanceConfig.locale, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}
