import {Fragment} from 'react';
import {usd} from './money';
type Props={field?:string;value:unknown;t:(key:string)=>string};
export default function Details({value,t,field}:Props){
 if((field==='priceCents'||field==='feeCents')&&typeof value==='number')return <span>{usd(value)}</span>;
 if(value===null||value===undefined)return <span>—</span>;
 if(typeof value==='boolean')return <span>{t(String(value))}</span>;
 if(typeof value!=='object')return <span>{t(String(value))}</span>;
 if(Array.isArray(value))return <div className="detail-list">{value.map((entry,index)=><article className="message" key={(entry as any)?.id||index}><Details value={entry} t={t}/></article>)}</div>;
 const row=value as Record<string,unknown>;
 if(row.text&&row.senderId)return <article><small>{String(row.senderId)} · {new Date(String(row.createdAt)).toLocaleString()}</small><p>{String(row.text)}</p>{row.reference!=null&&<Details value={row.reference} t={t}/>}</article>;
 return <dl>{Object.entries(row).map(([key,entry])=><Fragment key={key}><dt>{t(key)}</dt><dd><Details field={key} value={entry} t={t}/></dd></Fragment>)}</dl>;
}
