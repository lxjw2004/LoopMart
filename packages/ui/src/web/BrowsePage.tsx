"use client";
import {useEffect,useRef,useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {ToggleButton} from '@astryxdesign/core/ToggleButton';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {DateInput} from '@astryxdesign/core/DateInput';
import {Selector} from '@astryxdesign/core/Selector';
import {Dialog,DialogHeader} from '@astryxdesign/core/Dialog';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack,VStack,StackItem} from '@astryxdesign/core/Stack';
import {BottomSheet} from '@astryxdesign/core/BottomSheet';
import {ScrollableArea} from '@astryxdesign/core/ScrollableArea';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Banner} from '@astryxdesign/core/Banner';
import {Icon} from '@astryxdesign/core/Icon';
import {useLayout} from '../shared/design';
import ListingCard from './ListingCard';
import {dollarsToCents,centsToDollars} from '../money';
import RideLocationInput from '../shared/RideLocationInput';

type Row=Record<string,any>;
const categories=['clothing','books','furniture','electronics','daily','other'];
const priceValue=(value:unknown)=>value!=null&&value!==''?centsToDollars(Number(value)):'';

export default function BrowsePage({kind,rows,query,filters,cursor,busy,english,t,onApply,onMore,onOpen,onFavorite,favorites,simple=false}:{simple?:boolean;kind:string;rows:Row[];query:string;filters:Row;cursor:string|null;busy:boolean;english:boolean;t:(s:string)=>string;onApply:(v:Row)=>void;onMore:()=>void;onOpen:(r:Row)=>void;onFavorite?:(r:Row)=>void;favorites:Set<string>}){
 const ride=kind==='rides',{mobile}=useLayout();
 const formRef=useRef<HTMLElement>(null),filterTrigger=useRef<HTMLButtonElement>(null);
 const [values,setValues]=useState<Row>({q:query,...filters});
 const [min,setMin]=useState(''),[max,setMax]=useState(''),[error,setError]=useState(''),[open,setOpen]=useState(false);
 const say=(zh:string,en:string)=>english?en:zh;
 const hasFilters=Boolean(query||Object.entries(filters).some(([key,value])=>key!=='sort'&&value!==''&&value!=null));
 useEffect(()=>{setValues({q:query,...filters})},[query,JSON.stringify(filters)]);
 useEffect(()=>{setMin(priceValue(filters.minPriceCents));setMax(priceValue(filters.maxPriceCents))},[filters.minPriceCents,filters.maxPriceCents]);
 function changeOpen(next:boolean){
  if(!next){
   // Native close runs after the sheet's exit; the page is no longer inert then.
   const dialog=formRef.current?.closest('dialog');
   const restore=()=>filterTrigger.current?.focus({preventScroll:true});
   if(dialog?.open)dialog.addEventListener('close',restore,{once:true});else restore();
  }
  setOpen(next);
 }
 function showFilters(){
  setValues({q:query,...filters});setMin(priceValue(filters.minPriceCents));setMax(priceValue(filters.maxPriceCents));setError('');
  filterTrigger.current?.focus({preventScroll:true});setOpen(true);
 }
 function clear(){setValues({});setMin('');setMax('');setError('');onApply({});changeOpen(false)}
 const change=(key:string,value:string)=>setValues(current=>({...current,[key]:value}));
 function apply(next=values){
  const invalid=formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], :invalid');
  if(invalid){invalid.focus();return}
  try{
   const result={...next};
   if(!ride){result.minPriceCents=min===''?'':dollarsToCents(min);result.maxPriceCents=max===''?'':dollarsToCents(max);if(min!==''&&max!==''&&result.minPriceCents>result.maxPriceCents)throw Error('Invalid range')}
   setError('');onApply(result);changeOpen(false);
  }catch{
   setError(say('请输入有效价格范围，最多两位小数','Enter a valid price range with at most two decimal places'));
   formRef.current?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus();
  }
 }
 const form=<VStack as="form" ref={formRef} className="filter-form" gap={5} onSubmit={event=>{event.preventDefault();apply()}}>
  <HStack hAlign="end"><Button variant="ghost" label={say('清空','Clear')} onClick={clear}/></HStack>
  {ride?<>
   {['origin','destination'].map(key=><RideLocationInput key={key} label={t(key)} value={values[key]||''} onChange={value=>change(key,value)}/>)}
   <DateInput label={t('date')} value={values.date||undefined} onChange={value=>change('date',value||'')} hasClear format="system_date" presentation="native"/>
  </>:<>
   <Selector label={t('category')} value={values.category||''} onChange={value=>change('category',value)} options={[{value:'',label:say('全部分类','All categories')},...categories.map(value=>({value,label:t(value)}))]} width="100%"/>
   <VStack gap={2}><Text type="label">{say('价格（USD）','Price (USD)')}</Text><HStack gap={2}>
    <TextInput label={say('最低价格','Minimum price')} isLabelHidden inputMode="decimal" placeholder="0" value={min} onChange={setMin}/>
    <TextInput label={say('最高价格','Maximum price')} isLabelHidden inputMode="decimal" placeholder={say('不限','Any')} value={max} onChange={setMax}/>
   </HStack></VStack>
   {(['condition','deliveryMethod'] as const).map(key=><Selector key={key} label={t(key)} value={values[key]||''} onChange={value=>change(key,value)} options={[{value:'',label:say('全部','All')},...(key==='condition'?['new','like_new','good','fair']:['pickup','meetup','delivery']).map(value=>({value,label:t(value)}))]} width="100%"/>)}
  </>}
  {error&&<Banner status="error" title={error} role="alert"/>}
  <Button type="submit" variant="primary" label={say('应用筛选','Apply filters')}/>
 </VStack>;
 const toolbar=<HStack className="browse-toolbar" gap={3} vAlign="center" width="100%" style={{minWidth:0}}>
  <StackItem size="fill" style={{minWidth:0}}>
   {!ride&&!simple?<ScrollableArea axis="inline" label={say('商品分类','Item categories')} padding={1.5} width="100%" maxWidth="100%">
    <HStack className="category-nav" gap={1}>
     {['',...categories].map(category=>{const selected=(filters.category||'')===category;return <ToggleButton key={category} label={category?t(category):say('全部','All')} size="sm" isPressed={selected} onPressedChange={()=>{if(selected)return;const next={q:query,...filters,category};setValues(next);onApply(next)}} style={{flexShrink:0,background:selected?'var(--color-accent-muted)':'transparent',color:selected?'var(--color-text-accent)':'var(--color-text-secondary)',fontWeight:selected?'var(--lm-button-weight)':'normal'}}/>})}
    </HStack>
   </ScrollableArea>:<Text type="supporting" style={{overflowWrap:'anywhere'}}>{say(ride?'最新行程':'最新发布',ride?'Upcoming rides':'Latest listings')}</Text>}
  </StackItem>
  <HStack gap={2} vAlign="center" style={{flexShrink:0}}>
   {ride&&<Selector label={t('sort')} isLabelHidden value={filters.sort||'departure_asc'} onChange={sort=>onApply({q:query,...filters,sort})} options={['departure_asc','departure_desc'].map(value=>({value,label:t(value)}))}/>}
   {!simple&&<Button ref={filterTrigger} label={say('筛选','Filters')} icon={<Icon icon="funnel"/>} aria-expanded={open} onClick={showFilters}/>}
  </HStack>
 </HStack>;
 return <>
  <VStack className="browse-layout" gap={5} width="100%" style={{minWidth:0}}>
   {toolbar}
   {query&&<HStack gap={2} vAlign="center" wrap="wrap"><Text type="supporting" style={{overflowWrap:'anywhere'}}>{say('搜索：','Search: ')+query}</Text><Button label={say('清空筛选','Clear filters')} variant="ghost" size="sm" onClick={clear}/></HStack>}
   <VStack role="region" aria-label={say(ride?'拼车列表':'商品列表',ride?'Ride listings':'Item listings')} aria-busy={busy} gap={5}>
    <Grid className={'card-grid'+(ride?' ride-grid':'')} columns={ride?1:2} gap={mobile?3:5} style={ride?undefined:{gridTemplateColumns:'repeat(var(--lm-catalog-columns), minmax(0, 1fr))'}}>
     {busy&&!rows.length&&Array.from({length:ride?2:3},(_,index)=><Skeleton key={'skeleton-'+index} height={ride?'calc(var(--spacing-12) * 3)':'calc(var(--lm-media-empty-height) + var(--spacing-12) * 4)'} index={index}/>)}
     {rows.map(row=><ListingCard key={row.id} row={row} kind={kind} english={english} t={t} onOpen={()=>onOpen(row)} onFavorite={!ride&&onFavorite?()=>onFavorite(row):undefined} saved={favorites.has(row.id)}/>)}
    </Grid>
    {!busy&&!rows.length&&<EmptyState headingLevel={2} title={say(hasFilters?'没有匹配结果':'暂无内容',hasFilters?'No matching results':'No listings yet')} actions={hasFilters?<Button label={say('清空筛选','Clear filters')} onClick={clear}/>:undefined}/>}
    {cursor&&<Button label={say('加载更多','Load more')} isLoading={busy} isDisabled={busy} onClick={onMore}/>}
   </VStack>
  </VStack>
  {mobile?<BottomSheet isOpen={open} onOpenChange={changeOpen} label={say('筛选','Filters')} height="tall"><VStack gap={4}><DialogHeader title={say('筛选','Filters')} onOpenChange={changeOpen}/>{form}</VStack></BottomSheet>:<Dialog isOpen={open} onOpenChange={changeOpen} width="calc(var(--spacing-12) * 11)" aria-label={say('筛选','Filters')}><VStack gap={4}><DialogHeader title={say('筛选','Filters')} onOpenChange={changeOpen}/>{form}</VStack></Dialog>}
 </>;
}
