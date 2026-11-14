"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import ListingCard from "./web/ListingCard";
import {VStack} from "@astryxdesign/core/VStack";
import {Grid} from "@astryxdesign/core/Grid";
import {Heading} from "@astryxdesign/core/Heading";
import {Text} from "@astryxdesign/core/Text";
import {Button} from "@astryxdesign/core/Button";
import {Banner} from "@astryxdesign/core/Banner";
import {Skeleton} from "@astryxdesign/core/Skeleton";
import {Spinner} from "@astryxdesign/core/Spinner";
import { errorText } from "./errors";
import {useLayout} from "./shared/design";
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
  const {mobile,desktop}=useLayout();
  const [rows, setRows] = useState<Row[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(true);
  const loadSeq = useRef(0);
  async function load(more = false) {
    const seq = ++loadSeq.current;
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
      if (seq !== loadSeq.current) return;
      const batch = Array.isArray(result) ? result : result.data || [];
      setRows((old) => (more ? [...old, ...batch] : batch));
      setCursor(result.nextCursor || null);
    } catch (e) {
      if (seq === loadSeq.current) setError(e);
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  }
  useEffect(() => {
    load();
    return () => { loadSeq.current++; };
  }, [userId, kind]);
  return <VStack as="section" gap={5} aria-label={t(kind)} aria-busy={busy} style={{position:"relative"}}>
    <Heading level={2}>{t(kind)}</Heading>
    {busy && rows.length > 0 && <VStack style={{position:"absolute",insetBlockStart:0,insetInlineEnd:0,pointerEvents:"none"}}>
      <Spinner aria-label={t("loading")}/>
    </VStack>}
    {Boolean(error) && <Banner status="error" role="alert" title={errorText(error,english)} endContent={<Button label={t("retry")} onClick={()=>load()}/>}/>}
    <Grid columns={kind==="rides"?1:desktop?3:2} gap={mobile?3:5}>
      {busy&&!rows.length&&Array.from({length:desktop?3:kind==="rides"&&mobile?1:2},(_,index)=><Skeleton key={"skeleton-"+index} height="calc(var(--spacing-12) * 4)" index={index}/>)}
      {rows.map(row=><ListingCard key={row.id} row={row} kind={kind} english={english} t={t} onOpen={()=>onOpen(kind,row)}/>)}
    </Grid>
    {!busy&&!error&&!rows.length&&<Text type="supporting">{t("empty")}</Text>}
    {cursor&&<Button label={t("more")} isDisabled={busy} onClick={()=>load(true)}/>}
  </VStack>;
}
export default function ProfileListings(props: {
  english: boolean;
  userId: string;
  t: (s: string) => string;
  onOpen: (kind: string, row: Row) => void;
}) {
  return (
    <>
      <Posts {...props} key={props.userId+":items"} kind="items" />
      <Posts {...props} key={props.userId+":rides"} kind="rides" />
    </>
  );
}
