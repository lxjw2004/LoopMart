import { dollarsToCents } from "./money.js";
type Row = Record<string, any>;
type Fields = Record<string, string | string[]>;
const money = (name: string) => name === "priceCents" || name === "feeCents";
export function restoreDraft(raw: string | null, fields: Fields, initial: Row): Row {
  try {
    const data = JSON.parse(raw || "{}");
    if (!data || typeof data !== "object" || Array.isArray(data)) return initial;
    return {...initial, ...Object.fromEntries(Object.entries(data).filter(([key, value]) => key in fields && (typeof value === "string" || typeof value === "number")))};
  } catch { return initial; }
}
export function formPayload(values: Row): Row {
  values = { ...values };
  for (const field of ["totalSeats", "availableSeats"]) {
    if (values[field] === undefined) continue;
    const raw = String(values[field]);
    const seats = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(seats)) throw new Error("Invalid seat count");
    values[field] = seats;
  }
  if (values.availableSeats !== undefined && values.totalSeats !== undefined && (Number(values.availableSeats) < 0 || Number(values.availableSeats) > Number(values.totalSeats))) throw new Error("Available seats must be between zero and total seats");
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, money(k) ? dollarsToCents(String(v)) : v]));
}
