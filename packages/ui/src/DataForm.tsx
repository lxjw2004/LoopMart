"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { rideLocations } from "./ride-options";
import { centsToDollars } from "./money";
import { restoreDraft, formPayload } from "./publish-form";
type Row = Record<string, any>;
type Fields = Record<string, string | string[]>;
const money = (name: string) => name === "priceCents" || name === "feeCents";
const normalize = (data: Row) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, money(k) && v !== undefined && v !== null ? centsToDollars(Number(v)) : v]));
export default function DataForm({fields, initial = {}, submit, draft = false, t, say, run, busy, kind, ownerId, submitLabel, groups, renderSummary, saveDraft = false}: {
  fields: Fields; initial?: Row; submit: (v: Row) => Promise<any>; draft?: boolean;
  t: (s: string) => string; say: (zh: string, en: string) => string;
  run: (f: () => Promise<any>) => Promise<any>; busy: boolean; kind: string; ownerId?: string;
  submitLabel?: string; groups?: {title: string; fields: string[]}[];
  renderSummary?: (values: Row) => ReactNode; saveDraft?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const key = draft && ownerId ? "loopmart-draft-" + ownerId + "-" + kind : null;
  const [values, setValues] = useState<Row>(normalize(initial));
  const initialJSON = JSON.stringify(initial);
  useEffect(() => {
    const defaults = normalize(JSON.parse(initialJSON));
    let next = defaults;
    if (key) {
      try { next = restoreDraft(localStorage.getItem(key), fields, defaults); }
      catch { setNotice(say("草稿保存不可用", "Draft storage unavailable")); }
    }
    setValues(next); setError("");
  }, [key, kind, ownerId, initialJSON]);
  const store = (next: Row) => {
    if (!key) return false;
    try { localStorage.setItem(key, JSON.stringify(next)); return true; }
    catch { setNotice(say("草稿保存失败", "Draft could not be saved")); return false; }
  };
  const update = (name: string, value: any) => {
    const next = {...values, [name]:value}; setValues(next); setNotice(""); store(next);
  };
  const disabled = busy || submitting;
  const renderField = (name: string) => {
    const type = fields[name];
    if (!type) return null;
    const optional = ["notes", "feeDescription", "details", "privacyPolicyZh", "privacyPolicyEn", "publisherId", "communityAdminUserId", "allowedEmailDomains"].includes(name);
    return <label key={name}>{t(name)}{Array.isArray(type) ? <select aria-label={t(name)} required value={String(values[name] ?? "")} onChange={e => update(name,e.target.value)}><option value="">—</option>{(name === "timeZone" && values[name] && !type.includes(values[name]) ? [...type,String(values[name])] : type).map(x => <option key={x} value={x}>{t(x)}</option>)}</select> : type === "textarea" ? <textarea aria-label={t(name)} required={!optional} value={values[name] ?? ""} onChange={e => update(name,e.target.value)} /> : <input aria-label={t(name)} required={!optional} list={name === "origin" || name === "destination" ? "ride-locations" : undefined} type={type} step={money(name) ? "0.01" : type === "number" ? "1" : undefined} inputMode={money(name) ? "decimal" : undefined} min={type === "number" ? 0 : undefined} max={name === "availableSeats" && values.totalSeats !== "" ? values.totalSeats : undefined} value={type === "datetime-local" && values[name] ? String(values[name]).slice(0,16) : values[name] ?? ""} onChange={e => update(name,type === "number" && !money(name) && e.target.value !== "" ? Number(e.target.value) : e.target.value)} />}</label>;
  };
  return <form className={renderSummary ? "publish-layout" : undefined} aria-busy={disabled} onSubmit={e => {
    e.preventDefault(); if (disabled || lock.current) return;
    const form = e.currentTarget;
    lock.current = true; setSubmitting(true); setError("");
    void run(async () => {
      try {
        let payload: Row;
        try { payload = formPayload(values); } catch {
          const message = say("请检查金额（最多两位小数）和座位数量", "Check amounts (at most two decimals) and seat counts");
          setError(message); form.querySelector<HTMLInputElement>('input[type="number"]')?.focus(); throw new Error(message);
        }
        await submit(payload);
        if ("text" in fields || "message" in fields) setValues({});
        if (key) { try { localStorage.removeItem(key); } catch { setNotice(say("草稿清除失败", "Draft could not be cleared")); } }
        setNotice(say("已保存", "Saved"));
      } catch (failure) { if(failure instanceof Error&&failure.name==="AbortError")return;setError(current => current || say("提交失败，请检查后重试", "Could not submit. Check and try again")); throw failure; }
    }).catch(() => {}).finally(() => {lock.current = false; setSubmitting(false);});
  }}>
    <div className={renderSummary ? "publish-form" : undefined}>
      {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
      {groups ? groups.map(group => <fieldset className="form-section" key={group.title}><legend>{group.title}</legend>{group.fields.map(renderField)}</fieldset>) : Object.keys(fields).map(renderField)}
    </div>
    <datalist id="ride-locations">{rideLocations.map(location => <option key={location} value={location} />)}</datalist>
    <aside className={renderSummary ? "publish-summary" : undefined}>
      {renderSummary?.(values)}
      <div className={renderSummary ? "publish-actions" : undefined}>
        {draft && saveDraft && <button type="button" disabled={disabled || !key} onClick={() => {if(store(values)) setNotice(say("草稿已保存", "Draft saved"));}}>{say("保存草稿", "Save draft")}</button>}
        <button className="form-submit" type="submit" disabled={disabled}>{submitLabel || t("save")}</button>
        {draft && <button type="button" disabled={disabled} onClick={() => {if(key) {try {localStorage.removeItem(key);} catch {setNotice(say("草稿清除失败", "Draft could not be cleared"));}} setValues(normalize(initial));}}>{say("丢弃草稿", "Discard draft")}</button>}
      </div>
    </aside>
  </form>;
}
