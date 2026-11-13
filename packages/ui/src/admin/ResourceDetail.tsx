"use client";
import type { ReactNode } from "react";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Divider } from "@astryxdesign/core/Divider";
import { Grid } from "@astryxdesign/core/Grid";
import { List, ListItem } from "@astryxdesign/core/List";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Section } from "@astryxdesign/core/Section";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Heading, Text } from "@astryxdesign/core/Text";
import { resourceValue, normalizeResourceRow } from "./ResourceList";
import { useLayout } from "../shared/design";
type Row = Record<string, any>;
const fields: Record<string, string[]> = { users: ["id", "name", "email", "emailVerified", "role", "banned", "createdAt", "updatedAt"], items: ["id", "title", "description", "category", "priceCents", "condition", "deliveryMethod", "status", "publisherId", "publisherName", "createdAt", "updatedAt"], rides: ["id", "origin", "destination", "departureTime", "timeZone", "feeCents", "feeDescription", "totalSeats", "availableSeats", "notes", "status", "publisherId", "createdAt"], reports: ["id", "targetType", "targetId", "reporterId", "reason", "details", "status", "note", "reviewedBy", "reviewedAt", "createdAt"], contact: ["id", "subject", "email", "message", "status", "note", "createdAt", "updatedAt"], conversations: ["id", "otherUser", "userA", "userB", "createdAt", "updatedAt"], "community-messages": ["id", "otherUser", "userA", "userB", "createdAt", "updatedAt"], audit: ["id", "actorId", "action", "targetId", "reason", "createdAt"] };
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, /password|token|secret|credential|authorization|cookie|session/i.test(key) ? "[REDACTED]" : redact(v)]));
  return value;
}
export interface ResourceDetailProps { resource: string; detail: Row; children?: ReactNode; english?: boolean; t?: (key: string) => string }
export default function ResourceDetail({ resource, detail: record, children, english = false, t = key => key }: ResourceDetailProps) {
  const detail = normalizeResourceRow(record);
  const { mobile } = useLayout();
  return (
    <Section variant="admin-detail"><VStack as="article" gap={6} className="admin-resource-detail" style={{ minWidth: 0 }} data-testid="admin-resource-detail">
      <VStack gap={5}><VStack gap={2}>
        <Text type="admin-eyebrow">{t(resource)}</Text>
        <Heading level={2}>{detail.title || detail.name || detail.subject || detail.action || detail.id}</Heading>
      </VStack><Divider /></VStack>
      <MetadataList columns={mobile ? 1 : 2} label={{ position: "top" }}>
        {(fields[resource] || ["id", "status", "createdAt"]).filter(key => detail[key] !== undefined && detail[key] !== null).map(key => (
          <MetadataListItem key={key} label={t(key)}>
            <Text style={{ whiteSpace: "pre-wrap" }}>{["status", "role", "category", "condition", "deliveryMethod", "targetType"].includes(key) ? t(String(detail[key])) : resourceValue(detail, key, english)}</Text>
          </MetadataListItem>
        ))}
      </MetadataList>
      {Array.isArray(detail.messages) && (
        <Section padding={0}>
          <VStack gap={3}>
            <Heading level={3}>{english ? "Messages" : "消息"}</Heading>
            {detail.messages.length === 0 ? <Text color="secondary">{english ? "No messages" : "暂无消息"}</Text> : (
              <List edge="flush" hasDividers>
                {detail.messages.map((message: Row, index: number) => (
                  <ListItem
                    key={message.id || index}
                    label={<HStack gap={3} hAlign="between" wrap="wrap"><Text type="label">{message.senderName || message.senderId}</Text><Text type="supporting">{resourceValue(message, "createdAt", english)}</Text></HStack>}
                    description={<Text as="p" style={{ whiteSpace: "pre-wrap" }}>{message.text || message.content}</Text>}
                  />
                ))}
              </List>
            )}
          </VStack>
        </Section>
      )}
      {resource === "audit" && (
        <Grid columns={mobile ? 1 : 2} gap={5} data-testid="admin-audit-comparison">
          {["before", "after"].map(key => {
            const value = detail[key + "Data"] ?? detail[key + "_data"] ?? detail[key];
            return <VStack key={key} gap={3} style={{ minWidth: 0 }}><Heading level={3}>{key === "before" ? (english ? "Before" : "变更前") : (english ? "After" : "变更后")}</Heading><CodeBlock code={JSON.stringify(redact(value ?? null), null, 2)} language="json" hasLanguageLabel={false} hasCopyButton={false} isWrapped width="100%" maxHeight="var(--lm-admin-audit-height)" /></VStack>;
          })}
        </Grid>
      )}
      {children && <Section padding={0} dividers={["top"]}><VStack gap={4} paddingBlockStart={5}>{children}</VStack></Section>}
    </VStack></Section>
  );
}
