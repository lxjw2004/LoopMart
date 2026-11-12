import { fail } from "./validation.js";
export function additionalFilters(
  params: URLSearchParams,
  resource: string,
  args: unknown[],
  row = "row_to_json(t)",
) {
  const clauses: string[] = [];
  const bind = (value: string) => {
    args.push(value);
    return "$" + args.length;
  };
  const equal = (query: string, field: string) => {
    const value = params.get(query);
    if (value) clauses.push(`${row}->>'${field}'=${bind(value)}`);
  };
  if (resource === "users") {
    if (params.get("role"))
      clauses.push(
        `coalesce((SELECT role FROM memberships WHERE user_id=t.id),'member')=${bind(params.get("role")!)}`,
      );
    if (params.get("banned")) {
      if (!["true", "false"].includes(params.get("banned")!))
        fail(400, "Invalid banned filter");
      clauses.push(`${row}->>'banned'=${bind(params.get("banned")!)}`);
    }
  }
  if (["items", "rides"].includes(resource))
    equal("publisherId", "publisher_id");
  if (resource === "reports") {
    for (const [a, b] of [
      ["targetType", "target_type"],
      ["targetId", "target_id"],
      ["reason", "reason"],
      ["reporterId", "reporter_id"],
      ["reporter", "reporter_id"],
    ])
      equal(a, b);
  }
  if (resource === "audit") {
    equal("actorId", "actor_id");
    equal("actor", "actor_id");
    equal("resourceId", "target_id");
    if (params.get("action"))
      clauses.push(
        `${row}->>'action' ILIKE '%'||${bind(params.get("action")!)}||'%'`,
      );
    if (params.get("resource"))
      clauses.push(
        `${row}->>'action' ILIKE '%'||${bind("/admin/" + params.get("resource")!)}||'%'`,
      );
  }
  const created = ["conversations", "community-messages"].includes(resource)
    ? `${row}->'lastMessage'->>'createdAt'`
    : resource === "users"
      ? `${row}->>'createdAt'`
      : `${row}->>'created_at'`;
  for (const key of ["from", "to"]) {
    const value = params.get(key);
    if (value) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value))
      )
        fail(400, "Invalid date filter");
      clauses.push(
        `(${created})::timestamptz ${key === "from" ? ">=" : "<"} ${bind(value)}::date${key === "to" ? " + interval '1 day'" : ""}`,
      );
    }
  }
  return clauses.length ? " AND " + clauses.join(" AND ") : "";
}
