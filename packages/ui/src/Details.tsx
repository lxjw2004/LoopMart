import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { usd } from "./money";
type Props = { field?: string; value: unknown; t: (key: string) => string };
export default function Details({ value, t, field }: Props) {
  if (
    (field === "priceCents" || field === "feeCents") &&
    typeof value === "number"
  )
    return <Text>{usd(value)}</Text>;
  if (value === null || value === undefined) return <Text>—</Text>;
  if (typeof value === "boolean") return <Text>{t(String(value))}</Text>;
  if (typeof value !== "object") return <Text>{t(String(value))}</Text>;
  if (Array.isArray(value))
    return (
      <VStack gap={4} className="detail-list">
        {value.map((entry, index) => (
          <VStack as="article" gap={2} className="message" key={(entry as any)?.id || index}>
            <Details value={entry} t={t} />
          </VStack>
        ))}
      </VStack>
    );
  const row = value as Record<string, unknown>;
  if (row.text && row.senderId)
    return (
      <VStack as="article" gap={2}>
        <Text type="supporting">
          {String(row.senderId)} ·{" "}
          {new Date(String(row.createdAt)).toLocaleString()}
        </Text>
        <Text as="p" style={{ whiteSpace: "pre-wrap" }}>{String(row.text)}</Text>
        {row.reference != null && <Details value={row.reference} t={t} />}
      </VStack>
    );
  return (
    <MetadataList label={{ position: "top" }}>
      {Object.entries(row).map(([key, entry]) => (
        <MetadataListItem key={key} label={t(key)}>
            <Details field={key} value={entry} t={t} />
        </MetadataListItem>
      ))}
    </MetadataList>
  );
}
