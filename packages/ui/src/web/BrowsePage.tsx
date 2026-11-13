"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {Section} from '@astryxdesign/core/Section';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Banner} from '@astryxdesign/core/Banner';
import {useLayout} from '../shared/design';
import ListingCard from './ListingCard';
import {dollarsToCents,centsToDollars} from '../money';
import RideLocationInput from '../shared/RideLocationInput';
type Row=Record<string,any>;
export default function BrowsePage({kind,rows,query,filters,cursor,busy,english,t,onApply,onMore,onOpen,onFavorite,favorites,simple=false}:{simple?:boolean;kind:string;rows:Row[];query:string;filters:Row;cursor:string|null;busy:boolean;english:boolean;t:(s:string)=>string;onApply:(v:Row)=>void;onMore:()=>void;onOpen:(r:Row)=>void;onFavorite?:(r:Row)=>void;favorites:Set<string>}){
 const ride=kind==='rides',{mobile,desktop}=useLayout();
 const formRef=useRef<HTMLElement>(null);
 const [values,setValues]=useState<Row>({q:query,...filters});
 const [min,setMin]=useState(''),[max,setMax]=useState(''),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const say=(zh:string,en:string)=>english?en:zh;
 useEffect(()=>{setValues({q:query,...filters})},[query,JSON.stringify(filters)]);
 useEffect(()=>{setMin(filters.minPriceCents!==undefined?centsToDollars(Number(filters.minPriceCents)):'');setMax(filters.maxPriceCents!==undefined?centsToDollars(Number(filters.maxPriceCents)):'')},[filters.minPriceCents,filters.maxPriceCents]);
 const change=(key:string,value:string)=>{const next={...values,[key]:value};setValues(next);if(desktop&&!ride&&['category','condition','deliveryMethod'].includes(key))onApply(next)};
 function apply(next=values){const invalid=formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], :invalid');if(invalid){invalid.focus();return}try{const result={...next};if(!ride){result.minPriceCents=min===''?'':dollarsToCents(min);result.maxPriceCents=max===''?'':dollarsToCents(max);if(min!==''&&max!==''&&result.minPriceCents>result.maxPriceCents)throw Error('Invalid range')}setError('');onApply(result);setOpen(false)}catch{setError(say('请输入有效价格范围，最多两位小数','Enter a valid price range with at most two decimal places'))}}
 const form=<VStack as="form" ref={formRef} className="filter-form" gap={5} onSubmit={event=>{event.preventDefault();apply()}}>
  <HStack hAlign="between" vAlign="center" gap={3}>{desktop?<Heading level={2} style={{fontSize:'var(--lm-card-title-size)'}}>{say('筛选','Filters')}</Heading>:<StackItem size="fill"/>}<Button variant="ghost" label={say('清空','Clear')} onClick={()=>{setValues({});setMin('');setMax('');setError('');onApply({});setOpen(false)}}/></HStack>
  {ride?<>{['origin','destination'].map(key=><RideLocationInput key={key} label={t(key)} value={values[key]||''} onChange={value=>change(key,value)}/>)}<DateInput label={t('date')} value={values.date||undefined} onChange={value=>change('date',value||'')} hasClear format="system_date" presentation="native"/></>:<>
   <Selector label={t('category')} value={values.category||''} onChange={value=>change('category',value)} options={[{value:'',label:say('全部分类','All categories')},...['clothing','books','furniture','electronics','daily','other'].map(value=>({value,label:t(value)}))]} width="100%"/>
   <VStack gap={2}><Text type="label">{say('价格（USD）','Price (USD)')}</Text><HStack gap={2}><TextInput label={say('最低价格','Minimum price')} isLabelHidden inputMode="decimal" placeholder="0" value={min} onChange={setMin}/><TextInput label={say('最高价格','Maximum price')} isLabelHidden inputMode="decimal" placeholder={say('不限','Any')} value={max} onChange={setMax}/></HStack></VStack>
   {(['condition','deliveryMethod'] as const).map(key=><Selector key={key} label={t(key)} value={values[key]||''} onChange={value=>change(key,value)} options={[{value:'',label:say('全部','All')},...(key==='condition'?['new','like_new','good','fair']:['pickup','meetup','delivery']).map(value=>({value,label:t(value)}))]} width="100%"/>)}</>}
  {error&&<Banner status="error" title={error} role="alert"/>}<Button type="submit" variant="primary" label={say('应用筛选','Apply filters')}/>
 </VStack>;
 const results=<VStack gap={5} role="region" aria-label={say(ride?'拼车列表':'商品列表',ride?'Ride listings':'Item listings')} aria-busy={busy}>
  <HStack gap={3} hAlign="between" vAlign="center" wrap="wrap"><Text type="supporting">{query?say('搜索：','Search: ')+query:say(ride?'最新行程':'最新发布',ride?'Upcoming rides':'Latest listings')}</Text><HStack gap={2} wrap="wrap" vAlign="center">{!simple&&!desktop&&<Button label={say('筛选','Filters')} onClick={()=>setOpen(true)}/>} {ride?<Selector label={t('sort')} isLabelHidden value={values.sort||'departure_asc'} onChange={sort=>{const next={...values,sort};setValues(next);apply(next)}} options={['departure_asc','departure_desc'].map(value=>({value,label:t(value)}))}/>:!mobile?<Text type="supporting">{say('最新发布','Newest first')}</Text>:null}</HStack></HStack>
  <Grid className={'card-grid'+(ride?' ride-grid':'')} columns={desktop?3:ride&&mobile?1:2} gap={mobile?3:5}>{busy&&!rows.length&&Array.from({length:desktop?3:ride&&mobile?1:2},(_,index)=><Skeleton key={'skeleton-'+index} height="calc(var(--spacing-12) * 4)" index={index}/>)}{rows.map(row=><ListingCard key={row.id} row={row} kind={kind} english={english} t={t} onOpen={()=>onOpen(row)} onFavorite={!ride&&onFavorite?()=>onFavorite(row):undefined} saved={favorites.has(row.id)}/>)}</Grid>
  {!busy&&!rows.length&&<EmptyState title={say(Object.values(filters).some(Boolean)||query?'没有匹配结果':'暂无内容',Object.values(filters).some(Boolean)||query?'No matching results':'No listings yet')}/>}{cursor&&<Button label={say('加载更多','Load more')} isDisabled={busy} onClick={onMore}/>}
 </VStack>;
 return <><HStack className="browse-layout" gap={6} vAlign="start" style={{minWidth:0}}>
  {!simple&&desktop&&<VStack className="browse-sidebar" gap={6} width="var(--lm-filter-width)" style={{flexShrink:0,position:'sticky',top:'calc(var(--_app-shell-header-height) + var(--spacing-6))',maxHeight:'calc(100dvh - var(--_app-shell-header-height) - var(--spacing-6) * 2)',overflowY:'auto'}}>
   <Heading level={1}>{t(kind)}</Heading>
   <Section className="filter-sidebar" padding={5} role="region" aria-label={say(ride?'拼车筛选':'商品筛选',ride?'Ride filters':'Item filters')} style={{flexShrink:0,background:'var(--color-background-surface)',border:'var(--border-width) solid var(--color-border)',borderRadius:'var(--radius-container)',overflow:'hidden'}}>{form}</Section>
  </VStack>}
  <StackItem size="fill" style={{paddingBlockStart:!simple&&desktop?'calc(var(--text-heading-1-size) * var(--text-heading-1-leading) + var(--spacing-6))':undefined}}>{results}</StackItem>
 </HStack>{mobile?<BottomSheet isOpen={open} onOpenChange={setOpen} label={say('筛选','Filters')} height="tall"><VStack gap={4}><DialogHeader title={say('筛选','Filters')} onOpenChange={setOpen}/>{form}</VStack></BottomSheet>:!desktop?<Dialog isOpen={open} onOpenChange={setOpen} width="calc(var(--spacing-12) * 10)" aria-label={say('筛选','Filters')}><VStack gap={4}><DialogHeader title={say('筛选','Filters')} onOpenChange={setOpen}/>{form}</VStack></Dialog>:null}</>;
}
