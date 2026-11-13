"use client";
import {useRef,useState} from 'react';
import {matchesSchool,schools} from '../schools';

export default function SchoolSelector({english}:{english:boolean}){
 const dialog=useRef<HTMLDialogElement>(null);
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState(schools[0]);
 const say=(zh:string,en:string)=>english?en:zh;
 const results=schools.filter(school=>matchesSchool(school,query));
 return <>
 <button type="button" className="text-button school-trigger" aria-label={say('选择学校','Select university')+': '+selected.name} aria-haspopup="dialog" onClick={()=>{setQuery('');dialog.current?.showModal()}}><span>{selected.name}</span><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg></button>
 <dialog ref={dialog} className="school-dialog" aria-label={say('选择学校','Select university')} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.current?.close()}}}>
 <div className="school-dialog-heading"><h2>{say('选择学校','Select university')}</h2><button type="button" className="text-button school-close" aria-label={say('关闭','Close')} onClick={()=>dialog.current?.close()}>×</button></div>
 <input autoFocus type="search" aria-label={say('搜索学校','Search universities')} placeholder={say('搜索学校','Search universities')} value={query} onChange={e=>setQuery(e.target.value)}/>
 <div className="school-results">{results.map(school=><button key={school.id} type="button" className="school-option" aria-pressed={selected.id===school.id} onClick={()=>{setSelected(school);dialog.current?.close()}}><span>{school.name}</span>{selected.id===school.id&&<span aria-hidden="true">✓</span>}</button>)}{results.length===0&&<p role="status">{say('未找到学校','No universities found')}</p>}</div>
 </dialog>
 </>;
}
