"use client";
import {useEffect,useRef,useState} from 'react';
import ListingCard from './ListingCard';
import {dollarsToCents,centsToDollars} from '../money';
import {rideLocations} from '../ride-options';
type Row=Record<string,any>;
export default function BrowsePage({kind,rows,query,filters,cursor,busy,english,t,onApply,onMore,onOpen,onFavorite,favorites,simple=false}:{simple?:boolean;kind:string;rows:Row[];query:string;filters:Row;cursor:string|null;busy:boolean;english:boolean;t:(s:string)=>string;onApply:(v:Row)=>void;onMore:()=>void;onOpen:(r:Row)=>void;onFavorite?:(r:Row)=>void;favorites:Set<string>}){
 const ride=kind==='rides';const [values,setValues]=useState<Row>({q:query,...filters});const [min,setMin]=useState(''),[max,setMax]=useState(''),[error,setError]=useState('');const sheet=useRef<HTMLDialogElement>(null);const say=(zh:string,en:string)=>english?en:zh;
 useEffect(()=>{setValues({q:query,...filters})},[query,JSON.stringify(filters)]);
 useEffect(()=>{setMin(filters.minPriceCents!==undefined?centsToDollars(Number(filters.minPriceCents)):'');setMax(filters.maxPriceCents!==undefined?centsToDollars(Number(filters.maxPriceCents)):'')},[filters.minPriceCents,filters.maxPriceCents]);
 const change=(k:string,v:string)=>{const next={...values,[k]:v};setValues(next);if(!mobile&&!ride&&['category','condition','deliveryMethod'].includes(k))onApply(next)};
 function apply(next=values){try{const result={...next};if(!ride){result.minPriceCents=min===''?'':dollarsToCents(min);result.maxPriceCents=max===''?'':dollarsToCents(max);if(min!==''&&max!==''&&result.minPriceCents>result.maxPriceCents)throw Error(say('最低价格不能超过最高价格','Minimum price must not exceed maximum'));}setError('');onApply(result);sheet.current?.close()}catch{setError(say('请输入有效价格范围，最多两位小数','Enter a valid price range with at most two decimal places'))}}
 const form=<form className="filter-form" onSubmit={e=>{e.preventDefault();apply()}}>
 <div className="filter-heading"><h2>{say('筛选','Filters')}</h2><button type="button" className="text-button" onClick={()=>{setValues({});setMin('');setMax('');setError('');onApply({});sheet.current?.close()}}>{say('清空','Clear')}</button></div>
 {ride?<>{['origin','destination'].map(k=><label key={k}>{t(k)}<input list="ride-place-options" value={values[k]||''} onChange={e=>change(k,e.target.value)}/></label>)}<datalist id="ride-place-options">{rideLocations.map(l=><option key={l} value={l}/>)}</datalist><label>{t('date')}<input type="date" value={values.date||''} onChange={e=>change('date',e.target.value)}/></label></>:<>
 <label>{t('category')}<select value={values.category||''} onChange={e=>change('category',e.target.value)}><option value="">{say('全部分类','All categories')}</option>{['clothing','books','furniture','electronics','daily','other'].map(k=><option key={k} value={k}>{t(k)}</option>)}</select></label>
 <fieldset className="price-filter"><legend>{say('价格（USD）','Price (USD)')}</legend><input inputMode="decimal" aria-label={say('最低价格','Minimum price')} placeholder="0" value={min} onChange={e=>setMin(e.target.value)}/><span>—</span><input inputMode="decimal" aria-label={say('最高价格','Maximum price')} placeholder={say('不限','Any')} value={max} onChange={e=>setMax(e.target.value)}/></fieldset>
 {(['condition','deliveryMethod'] as const).map(k=><label key={k}>{t(k)}<select value={values[k]||''} onChange={e=>change(k,e.target.value)}><option value="">{say('全部','All')}</option>{(k==='condition'?['new','like_new','good','fair']:['pickup','meetup','delivery']).map(v=><option key={v} value={v}>{t(v)}</option>)}</select></label>)}
 </>}{error&&<p role="alert" className="field-error">{error}</p>}<button className="filter-apply">{say('应用筛选','Apply filters')}</button></form>;
 const [mobile,setMobile]=useState(false);useEffect(()=>{const m=matchMedia('(max-width:1199px)');const update=()=>setMobile(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update)},[]);
 return <div className={simple?"browse-layout saved-browse":"browse-layout"}>
 {!simple&&<aside className="filter-sidebar" role="region" aria-label={say(ride?'拼车筛选':'商品筛选',ride?'Ride filters':'Item filters')}>{!mobile&&form}</aside>}
 <section className="browse-results" role="region" aria-label={say(ride?'拼车列表':'商品列表',ride?'Ride listings':'Item listings')} aria-busy={busy}>
 <div className="results-toolbar"><span>{query?say('搜索：','Search: ')+query:say(ride?'最新行程':'最新发布',ride?'Upcoming rides':'Latest listings')}</span><div>{!simple&&<button className="filter-trigger secondary" onClick={()=>sheet.current?.showModal()}>{say('筛选','Filters')}</button>}{ride?<select aria-label={t('sort')} value={values.sort||'departure_asc'} onChange={e=>{const next={...values,sort:e.target.value};setValues(next);onApply(next)}}><option value="departure_asc">{t('departure_asc')}</option><option value="departure_desc">{t('departure_desc')}</option></select>:<span className="sort-label">{say('最新发布','Newest first')}</span>}</div></div>
 <div className={'card-grid'+(ride?' ride-grid':'')}>{busy&&!rows.length&&Array.from({length:6},(_,i)=><div className="skeleton-card" key={'skeleton-'+i} aria-hidden="true"><div/><span/><span/></div>)}{rows.map(r=><ListingCard key={r.id} row={r} kind={kind} english={english} t={t} onOpen={()=>onOpen(r)} onFavorite={!ride&&onFavorite?()=>onFavorite(r):undefined} saved={favorites.has(r.id)}/>)}</div>
 {!busy&&!rows.length&&<div className="empty-state">{say(Object.values(filters).some(Boolean)||query?'没有匹配结果':'暂无内容',Object.values(filters).some(Boolean)||query?'No matching results':'No listings yet')}</div>}
 {cursor&&<button className="load-more secondary" disabled={busy} onClick={onMore}>{say('加载更多','Load more')}</button>}
 </section><dialog ref={sheet} className="filter-sheet" aria-label={say('筛选','Filters')}><button className="sheet-close text-button" onClick={()=>sheet.current?.close()} aria-label={say('关闭','Close')}>×</button>{mobile&&form}</dialog>
 </div>
}
