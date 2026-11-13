"use client";
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {ToggleButton} from '@astryxdesign/core/ToggleButton';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {HStack,VStack,StackItem} from '@astryxdesign/core/Stack';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Token} from '@astryxdesign/core/Token';
import {usd} from '../money';
import {useLayout} from '../shared/design';
import RideMeta from '../RideMeta';
import MediaGallery from '../shared/MediaGallery';
import type {DisplayImage} from '../shared/media';
type Row=Record<string,any>;
export default function ListingCard({row,kind,english,t,onOpen,onFavorite,saved,images=[]}:{row:Row;kind:string;english:boolean;t:(s:string)=>string;onOpen:()=>void;onFavorite?:()=>void;saved?:boolean;images?:DisplayImage[]}){
 const {mobile}=useLayout();
 const ride=kind==='rides',title=row.title||row.origin+' → '+row.destination;
 const publisher=row.publisherName||(english?'Member':'社区成员');
 return <ClickableCard padding={0} className={'listing-card listing-link'+(ride?' ride-card':'')} label={title} href={'/'+kind+'/'+encodeURIComponent(row.id)} style={{position:'relative',overflow:'hidden',borderRadius:'var(--radius-container)'}} onClick={event=>{if(!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpen()}}}>
  <VStack gap={0} height="100%">
   {!ride&&<MediaGallery compact images={images} title={title} english={english}/>}
   <VStack gap={3} className="listing-body" style={{padding:'var(--lm-card-body-padding)',flex:'1 1 auto',minWidth:0}}>
    {ride?<HStack className="route-endpoints" gap={3} vAlign="center"><Text weight="semibold" style={{fontSize:mobile?'var(--spacing-5)':'calc(var(--spacing-4) + var(--border-width))'}}>{row.origin}</Text><Text color="accent" aria-hidden="true">→</Text><Text weight="semibold" style={{fontSize:mobile?'var(--spacing-5)':'calc(var(--spacing-4) + var(--border-width))'}}>{row.destination}</Text></HStack>:<Heading level={2} maxLines={2} style={{fontSize:'var(--lm-card-title-size)',lineHeight:1.5,minHeight:mobile?'calc(var(--lm-card-title-size) * 3)':undefined}}>{title}</Heading>}
    {ride&&<RideMeta ride={row} english={english}/>}
    <HStack className="price-row" gap={1} vAlign="center"><Text className="listing-price" weight="bold" hasTabularNumbers style={{fontSize:mobile?'var(--lm-price-card-mobile)':'var(--lm-price-card)',lineHeight:1.3,letterSpacing:'calc(var(--border-width) * -0.8)'}}>{usd(row.priceCents??row.feeCents??0)}</Text>{ride&&<Text type="supporting">{english?'/ person':'/ 人'}</Text>}</HStack>
    {!ride&&<HStack className="chips" gap={1.5} wrap="wrap"><Token label={t(row.condition||'')} size="sm"/><Token label={t(row.deliveryMethod||'')} size="sm"/></HStack>}
    {ride&&row.notes&&<Text className="card-note" type="supporting" maxLines={1}>{row.notes}</Text>}
    <HStack className="publisher" gap={2} vAlign="center" style={{borderTop:'var(--border-width) solid var(--color-border)',paddingTop:'var(--spacing-3)',marginTop:'auto',minWidth:0}}><Avatar name={publisher} size="sm"/><StackItem size="fill"><Text type="supporting" maxLines={1} style={{fontSize:'var(--lm-publisher-size)'}}>{publisher}</Text></StackItem>{(!mobile||ride)&&<Text type="supporting" style={{fontSize:'var(--lm-publisher-size)',whiteSpace:'nowrap'}}>{row.createdAt&&<time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString(english?'en-US':'zh-CN')}</time>}</Text>}</HStack>
   </VStack>
  </VStack>
  {!ride&&onFavorite&&<ToggleButton className="favorite-button" size="sm" label={english?(saved?'Remove favorite':'Save item'):(saved?'取消收藏':'收藏')} isIconOnly icon={<Text color="inherit" size="xl">♡</Text>} pressedIcon={<Text color="inherit" size="xl">♥</Text>} isPressed={saved} onPressedChange={onFavorite} style={{position:'absolute',insetInlineEnd:mobile?'var(--spacing-2)':'var(--spacing-3)',top:mobile?'var(--spacing-2)':'var(--spacing-3)',borderRadius:'var(--radius-full)',background:'var(--color-background-surface)',color:saved?'var(--color-accent)':'var(--color-text-secondary)',border:'var(--border-width) solid var(--color-border)'}}/>}
 </ClickableCard>;
}
