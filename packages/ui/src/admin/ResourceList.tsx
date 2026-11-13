"use client";
import { Button } from "@astryxdesign/core/Button";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Card } from "@astryxdesign/core/Card";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Section } from "@astryxdesign/core/Section";
import { VStack } from "@astryxdesign/core/Stack";
import { Table, proportional, type TableColumn } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { useLayout } from "../shared/design";
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
  const { mobile } = useLayout();
  const fields = resourceColumns[resource] || ["id", "status", "createdAt"];
  const cell = (row: Row, key: string) => {
    const value = ["status", "role", "category", "targetType", "reason"].includes(key) && row[key] ? t(String(row[key])) : resourceValue(row, key, english);
    return key === "status" || key === "role" ? <Token color="admin-status" size="sm" label={value} /> : <Text type="supporting" color="primary" maxLines={mobile ? 0 : 1} hasTabularNumbers={key.endsWith("Cents") || key.endsWith("At")}>{value}</Text>;
  };
  const columns: TableColumn<Row>[] = fields.map(key => ({
    key,
    header: t(key),
    width: proportional(key === "email" || key === "lastMessage" ? 2 : 1),
    renderCell: row => cell(row, key),
  }));
  columns.push({
    key: "open",
    header: english ? "Open" : "查看",
    width: proportional(1),
    renderCell: row => <Button variant="ghost" size="sm" label={english ? "View" : "查看"} aria-label={(english ? "Open " : "查看 ") + (row.title || row.name || row.subject || (row.origin && row.destination ? row.origin + " → " + row.destination : row.id))} onClick={() => onOpen(row)} />,
  });

  return (
    <VStack as="section" aria-busy={busy} style={{ minWidth: 0 }} data-testid="admin-resource-list">
      {rows.length ? mobile ? <VStack gap={3} className="admin-record-cards">{rows.map(row => <Card key={row.id} variant="admin-record"><VStack as="article" gap={5}>
        <MetadataList label={{ position: "start", width: "var(--lm-admin-record-label-width)" }}>{fields.map(key => <MetadataListItem key={key} label={t(key)}>{cell(row, key)}</MetadataListItem>)}</MetadataList>
        <Button variant="ghost" width="fit-content" label={english ? "View record" : "查看记录"} onClick={() => onOpen(row)} />
      </VStack></Card>)}</VStack> : <Section variant="admin-table" className="admin-table-scroll"><Table data={rows} columns={columns} idKey="id" density="balanced" hasHover textOverflow="truncate" aria-label={t(resource)} /></Section> : <Section variant="admin-table"><VStack role="status"><EmptyState title={busy ? (english ? "Loading…" : "加载中…") : (english ? "No records" : "暂无记录")} isCompact headingLevel={2} /></VStack></Section>}
    </VStack>
  );
}
