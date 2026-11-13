"use client";
import {useState,type ReactNode} from 'react';
import {routeHref} from '../navigation';
import SchoolSelector from './SchoolSelector';
type Props={unreadCount?:number;children:ReactNode;page:string;me:Record<string,any>|null;english:boolean;onNavigate:(page:string)=>void;onLanguageChange:()=>void;onSearch:(q:string)=>void};
export default function WebShell({children,page,me,english,onNavigate,onLanguageChange,onSearch,unreadCount=0}:Props){
 const [search,setSearch]=useState('');const say=(zh:string,en:string)=>english?en:zh;
 const link=(p:string,label:string,cls='')=><a className={cls} href={routeHref(p)} aria-label={p==='conversations'&&unreadCount>0?label+say('，未读 ','; unread ')+unreadCount:label} aria-current={page===p?'page':undefined} onClick={e=>{if(!e.metaKey&&!e.ctrlKey){e.preventDefault();onNavigate(p)}}}>{label}{p==='conversations'&&unreadCount>0&&<span className="unread-badge" aria-hidden="true">{unreadCount>99?'99+':unreadCount}</span>}</a>;
 return <div className={'web-shell'+(page==='conversations'?' messages-shell':'')}>
 <header className="market-header"><div className="header-inner">{link('items','LoopMart','brand')}
 <form role="search" className="global-search" onSubmit={e=>{e.preventDefault();onSearch(search)}}><input type="search" aria-label={say('搜索商品','Search items')} placeholder={say('搜索你需要的物品','Search items')} value={search} onChange={e=>setSearch(e.target.value)}/><button aria-label={say('搜索','Search')}>⌕</button></form>
 <div className="header-actions"><SchoolSelector english={english}/>{link('favorites',say('收藏','Saved'),'favorites-link')}{link('conversations',say('消息','Messages'))}<button className="text-button language" onClick={onLanguageChange}>{english?'中文':'EN'}</button>{link(me?'profile':'login',me?.name||say('登录','Sign in'),'account-link')}{link('publish',say('＋ 发布','＋ Publish'),'button primary publish-link')}</div></div></header>
 <div className="subnav"><nav aria-label={say('主导航','Main navigation')}>{link('items',say('市场','Market'))}{link('rides',say('拼车','Rides'))}<a href="/account/listings" aria-current={page==='profile'?'page':undefined} onClick={e=>{if(!e.metaKey&&!e.ctrlKey){e.preventDefault();onNavigate('profile');history.replaceState(null,'','/account/listings')}}}>{say('我的发布','My listings')}</a></nav></div>
 {children}
 <footer className="site-footer"><span>LoopMart</span>{link('contact',say('联系','Contact'))}{link('privacy',say('隐私','Privacy'))}</footer>
 <nav className="mobile-nav" aria-label={say('移动导航','Mobile navigation')}>{link('items',say('市场','Market'))}{link('rides',say('拼车','Rides'))}{link('publish',say('发布','Publish'))}{link('conversations',say('消息','Messages'))}{link('profile',say('我的','Account'))}</nav>
 </div>
}
