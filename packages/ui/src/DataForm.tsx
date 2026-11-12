'use client';
import { useState, useEffect } from 'react';
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
}) { const [notice,setNotice]=useState(''); const key = 'loopmart-draft-' + kind; const [values, setValues] = useState<Row>(initial); useEffect(()=>{if(!draft)setValues(initial)},[JSON.stringify(initial)]); useEffect(() => { if (draft) {
    try {
        setValues({...initial,...JSON.parse(localStorage.getItem(key) || '{}')});
    }
    catch { }
} }, []); return <form onSubmit={e => { e.preventDefault(); run(async () => { await submit(values);if('text' in fields||'message' in fields)setValues({}); if (draft)
    localStorage.removeItem(key); setNotice(say('已保存', 'Saved')); }); }}>{notice&&<p role="status">{notice}</p>}{Object.entries(fields).map(([name, type]) => <label key={name}>{t(name)}{Array.isArray(type) ? <select required value={String(values[name] ?? '')} onChange={e => { const next = { ...values, [name]: e.target.value }; setValues(next); if (draft)
    localStorage.setItem(key, JSON.stringify(next)); }}><option value="">—</option>{type.map(x => <option key={x} value={x}>{t(x)}</option>)}</select> : type === 'textarea' ? <textarea required={!['notes','feeDescription','details','privacyPolicyZh','privacyPolicyEn'].includes(name)} value={values[name] ?? ''} onChange={e => { const v = { ...values, [name]: e.target.value }; setValues(v); if (draft)
    localStorage.setItem(key, JSON.stringify(v)); }}/> : <input required={!['publisherId','communityAdminUserId','allowedEmailDomains'].includes(name)} type={type} min={type === 'number' ? 0 : undefined} value={type==='datetime-local'&&values[name]?String(values[name]).slice(0,16):values[name] ?? ''} onChange={e => { const v = { ...values, [name]: type === 'number' ? Number(e.target.value) : e.target.value }; setValues(v); if (draft)
    localStorage.setItem(key, JSON.stringify(v)); }}/>}</label>)}<button disabled={busy}>{t('save')}</button>{draft && <button type="button" onClick={() => { localStorage.removeItem(key); setValues({}); }}>{say('丢弃草稿', 'Discard draft')}</button>}</form>; }
