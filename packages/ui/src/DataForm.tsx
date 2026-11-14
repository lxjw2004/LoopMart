"use client";
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { Section } from "@astryxdesign/core/Section";
import { Grid } from "@astryxdesign/core/Grid";
import { useLayout } from "./shared/design";
import { Banner } from "@astryxdesign/core/Banner";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Button } from "@astryxdesign/core/Button";
import { DateTimeInput, type ISODateTimeString } from "@astryxdesign/core/DateTimeInput";
import { FormLayout } from "@astryxdesign/core/FormLayout";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import RideLocationInput from "./shared/RideLocationInput";
import { centsToDollars } from "./money";
import { restoreDraft, formPayload } from "./publish-form";
type Row = Record<string, any>;
type Fields = Record<string, string | string[]>;
const money = (name: string) => name === "priceCents" || name === "feeCents";
const normalize = (data: Row) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, money(k) && v !== undefined && v !== null ? centsToDollars(Number(v)) : v]));
export default function DataForm({fields, initial = {}, submit, draft = false, t, say, run, busy, kind, ownerId, submitLabel, groups, renderSummary, saveDraft = false, submitFullWidth = false, embedded = false, successMessage, authMode}: {
  fields: Fields; initial?: Row; submit: (v: Row) => Promise<any>; draft?: boolean;
  t: (s: string) => string; say: (zh: string, en: string) => string;
  run: (f: () => Promise<any>) => Promise<any>; busy: boolean; kind: string; ownerId?: string;
  submitLabel?: string; groups?: {title: string; fields: string[]}[];
  renderSummary?: (values: Row) => ReactNode; saveDraft?: boolean; submitFullWidth?: boolean; embedded?: boolean; successMessage?: string; authMode?: string;
}) {
  const { mobile } = useLayout();
  const [notice, setNotice] = useState("");
  const sectionId = useId();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
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
    setValues(next); setError(""); setDiscardOpen(false);
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
  const discard = () => {
    if (disabled) return;
    try { if (key) localStorage.removeItem(key); }
    catch { setError(say("草稿清除失败", "Draft could not be cleared")); setNotice(""); setDiscardOpen(false); return; }
    setValues(normalize(initial)); setError(""); setNotice(""); setDiscardOpen(false);
  };
  const autoComplete = (name: string) => {
    if (!authMode) return undefined;
    if (name === "email" || name === "name") return name;
    if (name === "currentPassword" || (name === "password" && authMode === "sign-in/email")) return "current-password";
    if (name === "newPassword" || name === "password") return "new-password";
    return undefined;
  };
  const renderControl = (name: string) => {
    const type = fields[name];
    if (!type) return null;
    const optional = ["notes", "feeDescription", "details", "privacyPolicyZh", "privacyPolicyEn", "publisherId", "communityAdminUserId", "allowedEmailDomains"].includes(name);
    const common = { label: t(name), isRequired: !optional, isOptional: optional, width: "100%", isDisabled: disabled };
    if (Array.isArray(type)) return <Selector key={name} {...common} htmlName={name}
      value={String(values[name] ?? "")} placeholder="—"
      options={(name === "timeZone" && values[name] && !type.includes(values[name]) ? [...type, String(values[name])] : type).map(value => ({ value, label: t(value) }))}
      onChange={value => update(name, value)} />;
    if (type === "textarea") return <TextArea key={name} {...common} htmlName={name} value={String(values[name] ?? "")} onChange={value => update(name, value)} />;
    if (type === "datetime-local") return <DateTimeInput key={name} {...common}
      value={(values[name] ? String(values[name]).slice(0, 16) : undefined) as ISODateTimeString | undefined}
      presentation="native" onChange={value => update(name, value ?? "")} />;
    if (name === "origin" || name === "destination") return <RideLocationInput key={name} {...common}
      value={String(values[name] ?? "")} onChange={value => update(name, value)} />;
    return <TextInput key={name} {...common} htmlName={name}
      type={type === "number" ? "text" : type as "text" | "email" | "password"}
      autoComplete={autoComplete(name)}
      inputMode={money(name) ? "decimal" : type === "number" ? "numeric" : undefined}
      value={String(values[name] ?? "")} onChange={value => update(name, value)} />;
  };
  const renderField = (name: string) => <VStack key={name} data-field-name={name}>{renderControl(name)}</VStack>;
  const form = <VStack as="form" gap={6} width="100%" className={renderSummary ? "publish-layout" : undefined}
    style={{minWidth:0,paddingBottom:renderSummary && mobile ? "calc(var(--lm-publish-actions-height) + var(--spacing-6))" : undefined}} aria-busy={disabled} onSubmit={e => {
    e.preventDefault(); if (disabled || lock.current) return;
    const form = e.currentTarget as HTMLFormElement;
    const invalid = form.querySelector<HTMLElement>('[aria-invalid="true"], :invalid');
    if (invalid) { invalid.focus(); return; }
    const missing = Object.keys(fields).find(name => !["notes", "feeDescription", "details", "privacyPolicyZh", "privacyPolicyEn", "publisherId", "communityAdminUserId", "allowedEmailDomains"].includes(name) && (values[name] === undefined || values[name] === null || String(values[name]).trim() === ""));
    if (missing) {
      setError(say("请填写", "Please complete") + " " + t(missing));
      form.querySelector<HTMLElement>(`[data-field-name="${missing}"]`)
        ?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]')?.focus();
      return;
    }
    lock.current = true; setSubmitting(true); setError("");
    void run(async () => {
      try {
        let payload: Row;
        try { payload = formPayload(values); } catch {
          const message = say("请检查金额（最多两位小数）和座位数量", "Check amounts (at most two decimals) and seat counts");
          setError(message); form.querySelector<HTMLInputElement>('input[inputmode="decimal"], input[inputmode="numeric"]')?.focus(); throw new Error(message);
        }
        await submit(payload);
        if ("text" in fields || "message" in fields) setValues({});
        if (key) { try { localStorage.removeItem(key); } catch { setNotice(say("草稿清除失败", "Draft could not be cleared")); } }
        setNotice(successMessage || say("已保存", "Saved"));
      } catch (failure) { if(failure instanceof Error&&failure.name==="AbortError")return;setError(current => current || say("提交失败，请检查后重试", "Could not submit. Check and try again")); throw failure; }
    }).catch(() => {}).finally(() => {lock.current = false; setSubmitting(false);});
  }}>
    {error && <Banner status="error" title={error} role="alert" />}
    {notice && <Banner status="success" title={notice} role="status" />}
    <Grid gap={6} style={{gridTemplateColumns:renderSummary && !mobile ? "minmax(0, 1fr) var(--lm-publish-rail)" : "minmax(0, 1fr)"}}>
      <VStack gap={6} className={renderSummary ? "publish-form" : undefined} style={{minWidth:0}}>
        {groups ? groups.map((group, index) => <Section key={group.title} variant="form-group">
          <VStack as="fieldset" gap={4} className="form-section" aria-labelledby={`${sectionId}-${index}`} style={{border:0,margin:0,minWidth:0,padding:0}}>
            <Heading level={2} id={`${sectionId}-${index}`} style={{fontSize:"var(--lm-form-group-heading-size)"}}>{group.title}</Heading>
            <FormLayout defaultOptionality="required">{group.fields.map(renderField)}</FormLayout>
          </VStack>
        </Section>) : <FormLayout defaultOptionality="required">{Object.keys(fields).map(renderField)}</FormLayout>}
      </VStack>
      <VStack as="aside" gap={4} className={renderSummary ? "publish-summary" : undefined}
        style={renderSummary && !mobile ? {position:"sticky",top:"var(--spacing-6)",alignSelf:"start",minWidth:0} : {minWidth:0}}>
        {renderSummary && <Section variant="form-panel">{renderSummary(values)}</Section>}
        <HStack gap={2} wrap="wrap" className={renderSummary ? "publish-actions" : undefined}
          style={renderSummary && mobile ? {position:"fixed",insetInline:0,bottom:"calc(var(--lm-mobile-nav-height) + env(safe-area-inset-bottom))",zIndex:21,background:"var(--color-background-surface)",borderTop:"var(--border-width) solid var(--color-border)",padding:"var(--spacing-3) var(--lm-page-gutter)"} : undefined}>
          {draft && saveDraft && <Button label={say("保存草稿", "Save draft")} width={renderSummary && mobile ? "calc(50% - var(--spacing-1))" : undefined} isDisabled={disabled || !key} onClick={() => {if(store(values)) setNotice(say("草稿已保存", "Draft saved"));}} />}
          <Button label={submitLabel || t("save")} width={submitFullWidth || (renderSummary && mobile && !(draft && saveDraft)) ? "100%" : renderSummary && mobile ? "calc(50% - var(--spacing-1))" : undefined} className="form-submit" variant="primary" type="submit" isLoading={submitting} isDisabled={disabled} />
          {draft && <Button label={say("丢弃草稿", "Discard draft")} width={renderSummary && mobile ? "100%" : undefined} variant="ghost" size="sm" isDisabled={disabled} onClick={() => setDiscardOpen(true)} />}
        </HStack>
      </VStack>
    </Grid>
  </VStack>;
  return <>
    {renderSummary || embedded ? form : <Section variant="form-panel" width="100%" maxWidth="var(--lm-form-max)">{form}</Section>}
    {draft && <AlertDialog isOpen={discardOpen} onOpenChange={setDiscardOpen}
      title={say("丢弃草稿？", "Discard draft?")} description={say("此操作会清空当前草稿。", "This clears the current draft.")}
      actionLabel={say("丢弃", "Discard")} cancelLabel={say("取消", "Cancel")} onAction={discard} />}
  </>;
}
