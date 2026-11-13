import { fail } from "./validation.js";

export function itemFilterClauses(
  params: URLSearchParams,
  args: unknown[],
  rowAlias = "e",
): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(rowAlias))
    throw new Error("Invalid item filter row alias");
  const value = (key: string) => {
    if (params.getAll(key).length > 1) fail(400, `Invalid ${key} filter`);
    return params.get(key) || null;
  };
  const price = (key: string) => {
    const raw = value(key);
    if (raw === null) return null;
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      fail(400, `Invalid ${key} filter`);
    return Number(raw);
  };
  const min = price("minPriceCents");
  const max = price("maxPriceCents");
  if (min !== null && max !== null && min > max)
    fail(400, "Invalid price range");
  const condition = value("condition");
  const delivery = value("deliveryMethod");
  if (condition !== null && !["new", "like_new", "good", "fair"].includes(condition))
    fail(400, "Invalid condition filter");
  if (delivery !== null && !["pickup", "meetup", "delivery"].includes(delivery))
    fail(400, "Invalid deliveryMethod filter");
  const clauses: string[] = [];
  const bind = (value: unknown) => {
    args.push(value);
    return "$" + args.length;
  };
  if (min !== null) clauses.push(`(${rowAlias}.data->>'priceCents')::bigint >= ${bind(min)}`);
  if (max !== null) clauses.push(`(${rowAlias}.data->>'priceCents')::bigint <= ${bind(max)}`);
  if (condition !== null) clauses.push(`${rowAlias}.data->>'condition' = ${bind(condition)}`);
  if (delivery !== null) clauses.push(`${rowAlias}.data->>'deliveryMethod' = ${bind(delivery)}`);
  return clauses.length ? " AND " + clauses.join(" AND ") : "";
}
