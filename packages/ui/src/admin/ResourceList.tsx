"use client";
type Row = Record<string, any>;
export const resourceColumns: Record<string, string[]> = { users: ["name", "email", "role", "banned", "createdAt"], items: ["title", "category", "priceCents", "status", "publisherName", "createdAt"], rides: ["route", "departureTime", "availableSeats", "feeCents", "status"], reports: ["targetType", "targetId", "reason", "status", "createdAt"], contact: ["subject", "email", "status", "createdAt"], conversations: ["id", "otherUser", "lastMessage", "unreadCount"], "community-messages": ["id", "otherUser", "lastMessage", "unreadCount"], audit: ["action", "actorId", "targetId", "reason", "createdAt"] };
export function normalizeResourceRow(row: Row): Row {
  return {...row, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]))};
}
export function resourceValue(input: Row, key: string, english = false): string {
  const row = normalizeResourceRow(input);
  if (key === "route") return [row.origin, row.destination].filter(Boolean).join(" → ");
  if (key === "otherUser") return row.otherUser?.name || row.otherUser?.id || "—";
  if (key === "lastMessage") return row.lastMessage?.text || "—";
  const value = row[key];
  if (value === undefined || value === null || value === "") return "—";
  if (key.endsWith("Cents")) return new Intl.NumberFormat(english ? "en-US" : "zh-CN", { style: "currency", currency: "USD" }).format(Number(value) / 100);
  if (typeof value === "boolean") return value ? (english ? "Yes" : "是") : (english ? "No" : "否");
  if (key.endsWith("At") || key === "departureTime") { const date = new Date(value); if (!Number.isNaN(date.valueOf())) return date.toLocaleString(english ? "en-US" : "zh-CN", row.timeZone ? { timeZone: row.timeZone } : undefined); }
  return typeof value === "object" ? "—" : String(value);
}
export interface ResourceListProps { resource: string; rows: Row[]; onOpen: (row: Row) => void; english?: boolean; t?: (key: string) => string; busy?: boolean }
export default function ResourceList({ resource, rows: records, onOpen, english = false, t = key => key, busy }: ResourceListProps) {
  const rows = records.map(normalizeResourceRow);
  const columns = resourceColumns[resource] || ["id", "status", "createdAt"];
  const cell = (row: Row, key: string) => <span className={key === "status" || key === "role" ? "admin-status" : undefined}>{["status", "role", "category", "targetType", "reason"].includes(key) && row[key] ? t(String(row[key])) : resourceValue(row, key, english)}</span>;
  if (!rows.length) return <div className="admin-empty" role="status">{busy ? (english ? "Loading…" : "加载中…") : (english ? "No records" : "暂无记录")}</div>;
  return <section className="admin-resource-list" aria-busy={busy}><div className="admin-table-scroll"><table><thead><tr>{columns.map(key => <th scope="col" key={key}>{t(key)}</th>)}<th scope="col"><span className="admin-sr-only">{english ? "Open" : "查看"}</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(key => <td key={key}>{cell(row, key)}</td>)}<td><button className="admin-open" onClick={() => onOpen(row)} aria-label={(english ? "Open " : "查看 ") + (row.title || row.name || row.subject || (row.origin && row.destination ? row.origin + " → " + row.destination : row.id))}>{english ? "View" : "查看"}<span aria-hidden="true"> ↗</span></button></td></tr>)}</tbody></table></div><div className="admin-record-cards">{rows.map(row => <article key={row.id}><dl>{columns.map(key => <div key={key}><dt>{t(key)}</dt><dd>{cell(row, key)}</dd></div>)}</dl><button onClick={() => onOpen(row)}>{english ? "View record" : "查看记录"} ↗</button></article>)}</div></section>;
}
