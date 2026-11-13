"use client";
import { useEffect, useState } from "react";
import { api } from "./api";
import ListingCard from "./web/ListingCard";
import { errorText } from "./errors";
type Row = Record<string, any>;
function Posts({
  english,
  userId,
  kind,
  t,
  onOpen,
}: {
  english: boolean;
  userId: string;
  kind: string;
  t: (s: string) => string;
  onOpen: (kind: string, row: Row) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  async function load(more = false) {
    setBusy(true);
    setError("");
    try {
      const result = await api(
        "/" +
          kind +
          "?publisherId=" +
          encodeURIComponent(userId) +
          (more && cursor ? "&cursor=" + encodeURIComponent(cursor) : ""),
      );
      const batch = Array.isArray(result) ? result : result.data || [];
      setRows((old) => (more ? [...old, ...batch] : batch));
      setCursor(result.nextCursor || null);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    load();
  }, [userId, kind]);
  return (
    <section>
      <h2>{t(kind)}</h2>
      {busy && <p role="status">{t("loading")}</p>}
      {Boolean(error) && (
        <p role="alert">
          {errorText(error, english)}
          <button onClick={() => load()}>{t("retry")}</button>
        </p>
      )}
      <div className="grid">
        {rows.map((row) => (
          <ListingCard key={row.id} row={row} kind={kind} english={english} t={t} onOpen={()=>onOpen(kind,row)}/>
        ))}
      </div>
      {!busy && !error && !rows.length && <p>{t("empty")}</p>}
      {cursor && (
        <button disabled={busy} onClick={() => load(true)}>
          {t("more")}
        </button>
      )}
    </section>
  );
}
export default function ProfileListings(props: {
  english: boolean;
  userId: string;
  t: (s: string) => string;
  onOpen: (kind: string, row: Row) => void;
}) {
  return (
    <>
      <Posts {...props} kind="items" />
      <Posts {...props} kind="rides" />
    </>
  );
}
