"use client";
import {useEffect,useRef,useState} from 'react';
import type {DisplayImage} from './media';
const EMPTY_IMAGES:DisplayImage[]=[];
export default function MediaGallery({images=EMPTY_IMAGES,title,english=false,compact=false}:{images?:DisplayImage[];title:string;english?:boolean;compact?:boolean}){
 const [index,setIndex]=useState(0),[failed,setFailed]=useState<Set<string>>(new Set());const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{setIndex(0);setFailed(new Set())},[images]);
 const shown=images[index];const placeholder=<span className="media-placeholder"><svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="9" width="34" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5"/><circle cx="17" cy="19" r="3" fill="none" stroke="currentColor"/><path d="m9 34 11-10 7 7 5-5 8 9" fill="none" stroke="currentColor"/></svg><span>{english?'No photo':'暂无图片'}</span></span>;
 const photo=shown&&!failed.has(shown.id)?<img src={shown.url} alt={shown.alt||title} loading={compact?'lazy':'eager'} onError={()=>setFailed(s=>new Set([...s,shown.id]))}/>:placeholder;
 return <div className={'media-gallery'+(compact?' compact':'')}>
 {compact?<div className="media-main">{photo}</div>:<button className="media-main" disabled={!shown||failed.has(shown.id)} aria-label={english?'View photo':'查看图片'} onClick={()=>dialog.current?.showModal()}>{photo}</button>}
 {!compact&&images.length>1&&<div className="media-thumbnails">{images.map((img,i)=><button key={img.id} aria-label={(english?'Photo ':'图片 ')+(i+1)} aria-pressed={index===i} onClick={()=>setIndex(i)}><img src={img.url} alt="" loading="lazy"/></button>)}</div>}
 {!compact&&<dialog ref={dialog} className="photo-dialog" aria-label={title} onKeyDown={e=>{if(e.key==='ArrowRight')setIndex(i=>(i+1)%images.length);if(e.key==='ArrowLeft')setIndex(i=>(i+images.length-1)%images.length)}}><button autoFocus className="photo-close" onClick={()=>dialog.current?.close()} aria-label={english?'Close':'关闭'}>×</button>{photo}</dialog>}
 </div>
}
