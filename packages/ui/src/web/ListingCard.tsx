"use client";
import type {CSSProperties,MouseEvent} from 'react';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {ToggleButton} from '@astryxdesign/core/ToggleButton';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {HStack,VStack,StackItem} from '@astryxdesign/core/Stack';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Token} from '@astryxdesign/core/Token';
import {Icon} from '@astryxdesign/core/Icon';
import {usd} from '../money';
import RideMeta from '../RideMeta';
import MediaGallery from '../shared/MediaGallery';
import type {DisplayImage} from '../shared/media';
import NavigationIcon from '../shared/NavigationIcon';
type Row=Record<string,any>;
const EMPTY_IMAGES:DisplayImage[]=[];
export default function ListingCard({row,kind,english,t,onOpen,onFavorite,saved,images=EMPTY_IMAGES}:{row:Row;kind:string;english:boolean;t:(s:string)=>string;onOpen:()=>void;onFavorite?:()=>void;saved?:boolean;images?:DisplayImage[]}){
 const ride=kind==='rides',title=row.title||row.origin+' → '+row.destination;
 const publisher=row.publisherName||(english?'Member':'社区成员');
 const open=(event:MouseEvent)=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpen()}};
 if(ride)return <ClickableCard padding={0} className="listing-card listing-link ride-card" label={title} href={'/rides/'+encodeURIComponent(row.id)} onClick={open}>
  <HStack gap={5} width="100%" style={{padding:'var(--lm-card-body-padding)',flexDirection:'var(--lm-ride-direction)' as CSSProperties['flexDirection'],minWidth:0}}>
   <HStack gap={4} vAlign="center" style={{flex:'1 1 auto',minWidth:0}}>
    <VStack hAlign="center" vAlign="center" width="var(--spacing-12)" height="var(--spacing-12)" style={{display:'var(--lm-ride-icon-display)',flexShrink:0,background:'var(--color-accent-muted)',color:'var(--color-text-accent)',borderRadius:'var(--radius-full)'}}><NavigationIcon name="rides"/></VStack>
    <VStack gap={2} style={{minWidth:0}}>
     <Heading level={2} className="route-endpoints" style={{fontSize:'var(--text-heading-2-size)',lineHeight:1.4,overflowWrap:'anywhere'}}>{row.origin+' → '+row.destination}</Heading>
     <RideMeta ride={row} english={english}/>
     {row.notes&&<Text className="card-note" type="supporting" maxLines={1}>{row.notes}</Text>}
    </VStack>
   </HStack>
   <VStack gap={3} width="var(--lm-ride-rail-width)" style={{flexShrink:0,flexDirection:'var(--lm-ride-rail-direction)' as CSSProperties['flexDirection'],justifyContent:'space-between'}}>
    <HStack className="price-row" gap={1} hAlign="end" style={{alignItems:'baseline'}}><Text className="listing-price" color="accent" weight="bold" hasTabularNumbers style={{fontSize:'var(--lm-price-card)',lineHeight:1.3,letterSpacing:'-0.02em'}}>{usd(row.feeCents??0)}</Text><Text type="supporting" style={{whiteSpace:'nowrap'}}>{english?'/ person':'/ 人'}</Text></HStack>
    <HStack className="publisher" gap={2} hAlign="end" vAlign="center" style={{minWidth:0}}><Avatar name={publisher} size="sm"/><Text type="supporting" maxLines={1} style={{fontSize:'var(--lm-publisher-size)'}}>{publisher}</Text><Icon icon="chevronRight" size="sm"/></HStack>
   </VStack>
  </HStack>
 </ClickableCard>;
 return <ClickableCard padding={0} className="listing-card listing-link" label={title} href={'/items/'+encodeURIComponent(row.id)} style={{position:'relative',overflow:'hidden',borderRadius:'var(--radius-container)'}} onClick={open}>
  <VStack gap={0} height="100%">
   <MediaGallery compact images={images} title={title} english={english}/>
   <VStack gap={3} className="listing-body" style={{padding:'var(--lm-card-body-padding)',flex:'1 1 auto',minWidth:0}}>
    <Heading level={2} maxLines={2} style={{fontSize:'var(--lm-card-title-size)',lineHeight:1.5,minHeight:'calc(var(--lm-card-title-size) * 3)'}}>{title}</Heading>
    <HStack className="price-row" gap={1} vAlign="center"><Text className="listing-price" color="accent" weight="bold" hasTabularNumbers style={{fontSize:'var(--lm-price-card)',lineHeight:1.3,letterSpacing:'-0.02em'}}>{usd(row.priceCents??0)}</Text></HStack>
    <HStack className="chips" gap={1.5} wrap="wrap"><Token label={t(row.condition||'')} size="sm"/><Token label={t(row.deliveryMethod||'')} size="sm"/></HStack>
    <HStack className="publisher" gap={2} vAlign="center" style={{borderTop:'var(--border-width) solid var(--color-border)',paddingTop:'var(--spacing-3)',marginTop:'auto',minWidth:0}}><Avatar name={publisher} size="sm"/><StackItem size="fill"><Text type="supporting" maxLines={1} style={{fontSize:'var(--lm-publisher-size)'}}>{publisher}</Text></StackItem><Text type="supporting" style={{fontSize:'var(--lm-publisher-size)',whiteSpace:'nowrap',display:'var(--lm-nonmobile-display)'}}>{row.createdAt&&<time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleDateString(english?'en-US':'zh-CN')}</time>}</Text></HStack>
   </VStack>
  </VStack>
  {onFavorite&&<ToggleButton className="favorite-button" size="sm" label={english?(saved?'Remove favorite':'Save item'):(saved?'取消收藏':'收藏')} isIconOnly icon={<NavigationIcon name="favorites"/>} pressedIcon={<NavigationIcon name="favorites" filled/>} isPressed={saved} onPressedChange={onFavorite} style={{position:'absolute',insetInlineEnd:'var(--spacing-3)',top:'var(--spacing-3)',borderRadius:'var(--radius-full)',background:'var(--color-background-surface)',color:saved?'var(--color-text-accent)':'var(--color-text-secondary)',border:'var(--border-width) solid var(--color-border)'}}/>}
 </ClickableCard>;
}
