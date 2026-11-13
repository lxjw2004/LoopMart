"use client";
import {usd} from '../money';
import RideMeta from '../RideMeta';
import MediaGallery from '../shared/MediaGallery';
import type {DisplayImage} from '../shared/media';
type Row=Record<string,any>;
export default function ListingCard({row,kind,english,t,onOpen,onFavorite,saved,images=[]}:{row:Row;kind:string;english:boolean;t:(s:string)=>string;onOpen:()=>void;onFavorite?:()=>void;saved?:boolean;images?:DisplayImage[]}){
 const ride=kind==='rides';const title=row.title||row.origin+' → '+row.destination;
 return <article className={'listing-card'+(ride?' ride-card':'')}>
 <a className="listing-link" href={'/'+kind+'/'+encodeURIComponent(row.id)} onClick={e=>{if(!e.metaKey&&!e.ctrlKey){e.preventDefault();onOpen()}}}>
 {!ride&&<MediaGallery compact images={images} title={title} english={english}/>}
 <div className="listing-body">{ride?<><span className="route-endpoints"><strong>{row.origin}</strong><span className="route-arrow">→</span><strong>{row.destination}</strong></span><RideMeta ride={row} english={english}/></>:<h2>{title}</h2>}
 <div className="price-row"><strong className="listing-price">{usd(row.priceCents??row.feeCents??0)}</strong>{ride&&<small>{english?'/ person':'/ 人'}</small>}</div>
 {!ride&&<div className="chips"><span>{t(row.condition||'')}</span><span>{t(row.deliveryMethod||'')}</span></div>}
 {ride&&row.notes&&<p className="card-note">{row.notes}</p>}
 <div className="publisher"><span className="avatar">{String(row.publisherName||'L').slice(0,1)}</span><span>{row.publisherName|| (english?'Member':'社区成员')}</span><time>{row.createdAt?new Date(row.createdAt).toLocaleDateString(english?'en-US':'zh-CN'):''}</time></div></div></a>
 {!ride&&onFavorite&&<button className="favorite-button" aria-label={english?(saved?'Remove favorite':'Save item'):(saved?'取消收藏':'收藏')} aria-pressed={saved} onClick={onFavorite}>{saved?'♥':'♡'}</button>}
 </article>
}
