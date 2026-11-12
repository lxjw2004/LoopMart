'use client';
import { useState, useEffect } from 'react';
import {dollarsToCents,centsToDollars} from './money';
const money=(name:string)=>name==='priceCents'||name==='feeCents';
const normalize=(data:Record<string,any>)=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,money(k)&&v!==undefined&&v!==null?centsToDollars(Number(v)):v]));
type Row = Record<string, any>;
export default function DataForm({ fields, initial = {}, submit, draft = false, t, say, run, busy, kind }: {
    fields: Record<string, string | string[]>;
    initial?: Row;
    submit: (v: Row) => Promise<any>;
    draft?: boolean;
    t: (s: string) => string;
    say: (zh: string, en: string) => string;
    run: (f: () => Promise<any>) => Promise<any>;
    busy: boolean;
    kind: string;
}) { const [notice,setNotice]=useState(''); const key = 'loopmart-draft-' + kind; const [values, setValues] = useState<Row>(normalize(initial)); useEffect(()=>{if(!draft)setValues(normalize(initial))},[JSON.stringify(initial)]); useEffect(() => { if (draft) {
    try {
        setValues({...normalize(initial),...JSON.parse(localStorage.getItem(key) || '{}')});
    }
    catch { }
} }, []); return <form onSubmit={e => { e.preventDefault(); run(async () => { await submit(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,money(k)?(()=>{try{return dollarsToCents(String(v))}catch{throw new Error(say('请输入有效美元金额，最多两位小数','Enter a valid USD amount with at most two decimal places'))}})():v])));if('text' in fields||'message' in fields)setValues({}); if (draft)
    localStorage.removeItem(key); setNotice(say('已保存', 'Saved')); }); }}>{notice&&<p role="status">{notice}</p>}{Object.entries(fields).map(([name, type]) => <label key={name}>{t(name)}{Array.isArray(type) ? <select aria-label={t(name)} required value={String(values[name] ?? '')} onChange={e => { const next = { ...values, [name]: e.target.value }; setValues(next); if (draft)
    localStorage.setItem(key, JSON.stringify(next)); }}><option value="">—</option>{type.map(x => <option key={x} value={x}>{t(x)}</option>)}</select> : type === 'textarea' ? <textarea aria-label={t(name)} required={!['notes','feeDescription','details','privacyPolicyZh','privacyPolicyEn'].includes(name)} value={values[name] ?? ''} onChange={e => { const v = { ...values, [name]: e.target.value }; setValues(v); if (draft)
    localStorage.setItem(key, JSON.stringify(v)); }}/> : <input aria-label={t(name)} required={!['publisherId','communityAdminUserId','allowedEmailDomains'].includes(name)} type={type} step={money(name)?'0.01':undefined} inputMode={money(name)?'decimal':undefined} min={type === 'number' ? 0 : undefined} value={type==='datetime-local'&&values[name]?String(values[name]).slice(0,16):values[name] ?? ''} onChange={e => { const v = { ...values, [name]: type === 'number'&&!money(name) ? Number(e.target.value) : e.target.value }; setValues(v); if (draft)
    localStorage.setItem(key, JSON.stringify(v)); }}/>}</label>)}<button disabled={busy}>{t('save')}</button>{draft && <button type="button" onClick={() => { localStorage.removeItem(key); setValues({}); }}>{say('丢弃草稿', 'Discard draft')}</button>}</form>; }
