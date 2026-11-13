"use client";
import DataForm from "../DataForm";
import { departureInstant, departureLocal, formatDeparture } from "../time";
type Row = Record<string, any>;
export default function PublishPage({kind, id, ownerId, t, say, run, busy, initial, submit}: {
  kind: string; id?: string; ownerId?: string; t: (s: string) => string;
  say: (zh: string, en: string) => string; run: (f: () => Promise<any>) => Promise<any>;
  busy: boolean; initial?: Row; submit: (values: Row) => Promise<any>;
}) {
  const ride = kind === "rides";
  const fields: Record<string, string | string[]> = ride ? {
    origin:"text", destination:"text", departureTime:"datetime-local",
    timeZone:["America/Indiana/Indianapolis","America/Chicago"],
    feeCents:"number", feeDescription:"text", totalSeats:"number", availableSeats:"number", notes:"textarea",
  } : {
    title:"text",description:"textarea",category:["clothing","books","furniture","electronics","daily","other"],
    condition:["new","like_new","good","fair"],priceCents:"number",deliveryMethod:["pickup","meetup","delivery"],
  };
  return <DataForm key={`${ownerId || "anonymous"}-${kind}-${id || "new"}`} fields={fields} initial={initial || {timeZone:"America/Indiana/Indianapolis"}} submit={submit} draft={!id} saveDraft ownerId={ownerId} kind={kind} t={t} say={say} run={run} busy={busy}
    submitLabel={id ? say("保存修改","Save changes") : ride ? say("发布拼车","Publish ride") : say("发布商品","Publish item")}
    groups={ride ? [
      {title:say("行程","Trip"),fields:["origin","destination","departureTime","timeZone"]},
      {title:say("费用和座位","Fare and seats"),fields:["feeCents","feeDescription","totalSeats","availableSeats","notes"]},
    ] : [
      {title:say("商品信息","Item details"),fields:["title","description","category","condition"]},
      {title:say("价格和交付","Price and delivery"),fields:["priceCents","deliveryMethod"]},
    ]}
    renderSummary={values => {
      let departure = "";
      let repeated = false;
      let offset = "";
      if (ride && values.departureTime && values.timeZone) {
        try {
          const instant = departureInstant(values.departureTime,values.timeZone);
          departure = formatDeparture(instant,values.timeZone,say("zh","en") === "en");
          const time = new Date(instant).getTime();
          repeated = [-120,-60,-30,30,60,120].some(minutes => departureLocal(new Date(time + minutes * 60000).toISOString(),values.timeZone) === values.departureTime);
          offset = new Intl.DateTimeFormat("en-US",{timeZone:values.timeZone,timeZoneName:"longOffset"}).formatToParts(time).find(part => part.type === "timeZoneName")?.value || "";
        } catch {}
      }
      return <div className="publish-preview">
        <h2>{say("发布预览","Preview")}</h2>
        <h3>{ride ? `${values.origin || "—"} → ${values.destination || "—"}` : values.title || t("items")}</h3>
        {repeated && <label key={`${values.departureTime}-${values.timeZone}`}><input type="checkbox" required />{say("确认出发时间偏移", "Confirm departure offset")} {offset}</label>}
        <p className="price">USD {String(values[ride ? "feeCents" : "priceCents"] || "0")}</p>
        {ride ? <>{departure && <p>{departure}</p>}{values.timeZone && <p>{values.timeZone}</p>}{values.availableSeats !== undefined && <p>{t("availableSeats")}: {values.availableSeats}</p>}</> : <>{values.condition && <p>{t(values.condition)}</p>}{values.deliveryMethod && <p>{t(values.deliveryMethod)}</p>}</>}
      </div>;
    }} />;
}
