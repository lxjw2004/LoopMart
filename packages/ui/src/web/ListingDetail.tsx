"use client";
import type {ReactNode} from 'react';
import {usd} from '../money';
import {formatDeparture} from '../time';
import MediaGallery from '../shared/MediaGallery';
type Row=Record<string,any>;
export default function ListingDetail({row,kind,english,t,onBack,actions,report,onProfile}:{row:Row;kind:string;english:boolean;t:(s:string)=>string;onBack:()=>void;actions:ReactNode;report:ReactNode;onProfile:()=>void}){
 const ride=kind==='rides';const say=(zh:string,en:string)=>english?en:zh;
 return <><button className="back-link text-button" onClick={onBack}>← {say(ride?'返回拼车':'返回市场',ride?'Back to rides':'Back to market')}</button><div className={'detail-layout '+(ride?'ride-detail':'item-detail')}>
 <section className="detail-content">{ride?<article className="panel journey-panel"><span className="eyebrow">{say('行程','Journey')}</span><div className="journey-route"><div><span className="route-dot"/><strong>{row.origin}</strong></div><span className="journey-line"/><div><span className="route-dot destination"/><strong>{row.destination}</strong></div></div><time className="departure-date">{formatDeparture(row.departureTime,row.timeZone,english)}</time><p className="muted">{row.timeZone}</p><div className="ride-seats"><strong>{row.availableSeats}</strong> {say('剩余座位','seats remaining')}<span>{say('共','of')} {row.totalSeats}</span></div></article>:<MediaGallery title={row.title} english={english}/>}
 <article className="panel description-panel"><h2>{say(ride?'行程说明':'物品描述',ride?'Journey details':'Description')}</h2><p className="preserve-text">{ride?row.notes||'—':row.description||'—'}</p>{ride&&row.feeDescription&&<><h3>{t('feeDescription')}</h3><p>{row.feeDescription}</p></>}</article>
 </section>
 <aside className="listing-summary panel"><span className="eyebrow">{ride?say('拼车','Ride'):t(row.category||'')}</span><h2>{ride?row.origin+' → '+row.destination:row.title}</h2><div className="detail-price">{usd(row.priceCents??row.feeCents??0)}{ride&&<small>{say('/ 人','/ person')}</small>}</div>
 {!ride&&<div className="chips"><span>{t(row.condition||'')}</span><span>{t(row.deliveryMethod||'')}</span></div>}
 {row.status!=='active'&&<p className="status-badge">{t(row.status)}</p>}<div className="detail-actions">{actions}</div><div className="seller-summary"><span className="avatar">{String(row.publisherName||'L')[0]}</span><div><strong>{row.publisherName||say('社区成员','Member')}</strong><button className="text-button" onClick={onProfile}>{say('发布者资料','Publisher profile')}</button></div></div>{report}
 </aside></div></>
}
