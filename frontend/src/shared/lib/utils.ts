import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
export const number = (value: number | null | undefined, digits = 0) =>
  value === null || value === undefined
    ? "—"
    : new Intl.NumberFormat("en-PH", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      }).format(value);
export const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(new Date(value)) + " UTC"
    : "No successful import";
export const label = (value: string) =>
  value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
