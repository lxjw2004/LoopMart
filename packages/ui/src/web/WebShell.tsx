"use client";
import {useState,type ReactNode,type MouseEvent} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {TopNav} from '@astryxdesign/core/TopNav';
import {Button} from '@astryxdesign/core/Button';
import {Link} from '@astryxdesign/core/Link';
import {Badge} from '@astryxdesign/core/Badge';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {HStack,VStack,StackItem} from '@astryxdesign/core/Stack';
import {Icon} from '@astryxdesign/core/Icon';
import {routeHref} from '../navigation';
import {schools} from '../schools';
import SchoolSelector from './SchoolSelector';

type Props={unreadCount?:number;chatActive?:boolean;children:ReactNode;page:string;me:Record<string,any>|null;english:boolean;onNavigate:(page:string)=>void;onLanguageChange:()=>void;onSearch:(query:string)=>void};
export default function WebShell({children,page,me,english,onNavigate,onLanguageChange,onSearch,unreadCount=0,chatActive=false}:Props){
 const [search,setSearch]=useState(''),[school,setSchool]=useState(schools[0]);
 const say=(zh:string,en:string)=>english?en:zh;
 const navigate=(event:MouseEvent,next:string)=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&event.button===0){event.preventDefault();onNavigate(next)}};
 const unread=unreadCount>0?<Badge className="unread-badge" label={unreadCount>99?'99+':unreadCount}/>:undefined;
 const account=<Link className="account-link" href={routeHref(me?'profile':'login')} maxLines={1} style={{maxWidth:'var(--lm-account-max-width)'}} onClick={event=>navigate(event,me?'profile':'login')}>{me?.name||say('登录','Sign in')}</Link>;
 const searchForm=<HStack as="form" role="search" className="global-search" gap={0} width="100%" style={{minWidth:0,background:'var(--color-background-body)',border:'var(--border-width) solid var(--color-border)',borderRadius:'var(--radius-element)',overflow:'hidden'}} onSubmit={event=>{event.preventDefault();onSearch(search)}}>
  <StackItem size="fill"><TextInput type="search" label={say('搜索商品','Search items')} isLabelHidden placeholder={say('搜索你需要的物品','Search items')} value={search} onChange={setSearch} width="100%" controlStyle={{border:0,borderRadius:0,background:'transparent'}}/></StackItem>
  <Button type="submit" label={say('搜索','Search')} isIconOnly variant="primary" icon={<Icon icon="search"/>} style={{borderRadius:0,alignSelf:'stretch'}}/>
 </HStack>;
 const subnav=<HStack className="subnav" width="100%" maxWidth="var(--lm-page-max)" hAlign="between" vAlign="center" gap={3} style={{marginInline:'auto',paddingInline:'var(--lm-page-gutter)'}}>
  <HStack as="nav" aria-label={say('主导航','Main navigation')} vAlign="center" style={{gap:'var(--lm-subnav-gap)'}}>
   {['items','rides','profile'].map(destination=><Link key={destination} href={destination==='profile'?'/account/listings':routeHref(destination)} aria-current={page===destination?'page':undefined} color={page===destination?'accent':'secondary'} weight={page===destination?'semibold':'normal'} style={{background:'transparent',paddingBlock:'var(--lm-subnav-padding)',borderBottom:'calc(var(--border-width) * 2) solid '+(page===destination?'var(--color-accent)':'transparent'),whiteSpace:'nowrap'}} onClick={event=>{navigate(event,destination);if(destination==='profile'&&event.defaultPrevented)history.replaceState(null,'','/account/listings')}}>{destination==='items'?say('市场','Market'):destination==='rides'?say('拼车','Rides'):say('我的发布','My listings')}</Link>)}
  </HStack>
  <SchoolSelector english={english} selection={school} onSelect={setSchool}/>
 </HStack>;
 const headerActions=<HStack vAlign="center" className="header-actions" style={{gap:'var(--lm-header-actions-gap)'}}><Link href="/favorites" color="secondary" style={{display:'var(--lm-wide-display)'}} onClick={event=>navigate(event,'favorites')}>{say('收藏','Saved')}</Link><Link href="/messages" color="secondary" style={{display:'var(--lm-nonmobile-display)'}} onClick={event=>navigate(event,'conversations')}><HStack as="span" gap={1} vAlign="center">{say('消息','Messages')}{unread}</HStack></Link><Button label={english?'中文':'EN'} variant="ghost" size="sm" onClick={onLanguageChange}/>{account}<Button label={say('＋ 发布','＋ Publish')} href="/publish" variant="primary" style={{display:'var(--lm-nonmobile-display)'}} onClick={event=>navigate(event,'publish')}/></HStack>;
 const headerRow=<HStack className="header-row" width="100cqw" vAlign="center" gap={0}>
  <StackItem><Link href="/items" className="brand" type="inherit" color="accent" style={{fontWeight:800,fontSize:'var(--lm-header-brand-size)',letterSpacing:'calc(var(--border-width) * -1)',whiteSpace:'nowrap'}} onClick={event=>navigate(event,'items')}>LoopMart</Link></StackItem>
  <StackItem size="fill" style={{display:'var(--lm-nonmobile-display)',minWidth:0,maxWidth:'calc(var(--spacing-12) * 12 + var(--spacing-1))',marginInline:'var(--lm-header-search-gap)'}}>{searchForm}</StackItem>
  <StackItem style={{marginInlineStart:'auto'}}>{headerActions}</StackItem>
 </HStack>;
 const header=<VStack gap={0} className="market-header" style={{display:chatActive?'var(--lm-nonmobile-display)':undefined,background:'var(--color-background-body)'}}>
  <VStack gap={0} style={{background:'var(--color-background-surface)'}}>
   <TopNav label={say('账户导航','Account navigation')} className="header-inner" style={{containerType:'inline-size',width:'100%',maxWidth:'var(--lm-page-max)',marginInline:'auto',paddingInline:'var(--lm-page-gutter)',paddingBlockStart:'var(--lm-header-padding-top)',paddingBlockEnd:'var(--spacing-3)'}} heading={headerRow}/>
   <VStack paddingBlockEnd={2} style={{display:'var(--lm-mobile-display)',paddingInline:'var(--lm-page-gutter)'}}>{searchForm}</VStack>
  </VStack>
  <VStack gap={0} className="subnav-section" style={{borderBottom:'var(--border-width) solid var(--color-border)',marginBottom:'calc(var(--border-width) * -1)'}}>{subnav}</VStack>
 </VStack>;
 // The chat owns its viewport and message scrolling; keep the shell's scroll mode stable through hydration.
 return <AppShell className={'web-shell'+(page==='conversations'?' messages-shell':'')} height="auto" variant="surface" contentPadding={0} mobileNav={false} topNav={header}>
  <VStack className="web-main" gap={0} width="100%" maxWidth={chatActive?'var(--lm-chat-page-max)':'var(--lm-page-max)'} style={{marginInline:'auto',minHeight:chatActive?'var(--lm-chat-page-min-height)':'calc(100dvh - var(--lm-page-header-height))',paddingInline:chatActive?'calc(var(--lm-page-gutter) * var(--lm-chat-page-inset))':'var(--lm-page-gutter)',paddingTop:chatActive?'calc(var(--lm-page-padding-top) * var(--lm-chat-page-inset))':page==='items'?'var(--spacing-6)':'var(--lm-page-padding-top)',paddingBottom:chatActive?'calc(var(--lm-page-bottom) * var(--lm-chat-page-inset))':'var(--lm-page-bottom)'}}>
   {children}
   <HStack as="footer" className="site-footer" gap={6} paddingBlock={6} vAlign="center" style={{display:chatActive?'var(--lm-nonmobile-display)':undefined,marginTop:'var(--spacing-10)',borderTop:'var(--border-width) solid var(--color-border)'}}><StackItem size="fill"><Text type="supporting">LoopMart</Text></StackItem><Link href="/contact" color="secondary" type="supporting" onClick={event=>navigate(event,'contact')}>{say('联系','Contact')}</Link><Link href="/privacy" color="secondary" type="supporting" onClick={event=>navigate(event,'privacy')}>{say('隐私','Privacy')}</Link></HStack>
  </VStack>
  <HStack as="nav" className="mobile-nav" aria-label={say('移动导航','Mobile navigation')} hAlign="between" vAlign="center" gap={0} style={{display:chatActive?'none':'var(--lm-mobile-display)',position:'fixed',insetInline:0,bottom:0,zIndex:20,minHeight:'calc(var(--lm-mobile-nav-height) + env(safe-area-inset-bottom))',paddingBottom:'env(safe-area-inset-bottom)',background:'var(--color-background-surface)',borderTop:'var(--border-width) solid var(--color-border)'}}>{['items','rides','publish','conversations','profile'].map(destination=><Link key={destination} href={routeHref(destination)} color={page===destination?'accent':'secondary'} weight={page===destination?'semibold':'normal'} aria-current={page===destination?'page':undefined} style={{flex:'1 1 0',minWidth:0,textAlign:'center',paddingBlock:'var(--spacing-3)',borderRadius:'var(--radius-element)',background:page===destination?'var(--color-accent-muted)':'transparent',fontSize:'var(--lm-publisher-size)'}} onClick={event=>navigate(event,destination)}>{destination==='items'?say('市场','Market'):destination==='rides'?say('拼车','Rides'):destination==='publish'?say('发布','Publish'):destination==='conversations'?say('消息','Messages'):say('我的','Account')}{destination==='conversations'&&unread}</Link>)}</HStack>
 </AppShell>;
}
