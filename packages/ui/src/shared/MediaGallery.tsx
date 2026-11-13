"use client";
import {useEffect,useState,type SVGProps} from 'react';
import {AspectRatio} from '@astryxdesign/core/AspectRatio';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {HStack,VStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {Thumbnail} from '@astryxdesign/core/Thumbnail';
import {Lightbox} from '@astryxdesign/core/Lightbox';
import {useLayout} from './design';
import type {DisplayImage} from './media';
const EMPTY_IMAGES:DisplayImage[]=[];
function PhotoIcon(props:SVGProps<SVGSVGElement>){return <svg {...props} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="7" y="9" width="34" height="30" rx="4"/><circle cx="17" cy="19" r="3"/><path d="m9 34 11-10 7 7 5-5 8 9"/></svg>}
export default function MediaGallery({images=EMPTY_IMAGES,title,english=false,compact=false}:{images?:DisplayImage[];title:string;english?:boolean;compact?:boolean}){
 const {mobile}=useLayout();
 const [index,setIndex]=useState(0),[failed,setFailed]=useState<Set<string>>(new Set()),[open,setOpen]=useState(false);
 useEffect(()=>{setIndex(0);setFailed(new Set());setOpen(false)},[images]);
 const shown=images[index],hasPhoto=Boolean(shown&&!failed.has(shown.id));
 const photo=hasPhoto?<img src={shown.url} alt={shown.alt||title} loading={compact?'lazy':'eager'} onError={()=>setFailed(current=>new Set([...current,shown.id]))}/>:<VStack className="media-placeholder" width="100%" height="100%" gap={2} hAlign="center" vAlign="center" style={{background:'var(--lm-media-background)',color:'var(--color-text-secondary)'}}><Icon icon={PhotoIcon} style={{width:mobile?'var(--spacing-8)':'var(--spacing-12)',height:mobile?'var(--spacing-8)':'var(--spacing-12)'}}/><Text type="supporting" style={{fontSize:'var(--lm-publisher-size)'}}>{english?'No photo':'暂无图片'}</Text></VStack>;
 const frame=compact||hasPhoto?<AspectRatio className={compact?'media-main':undefined} ratio={4/3} fit="cover">{photo}</AspectRatio>:<VStack height="calc(var(--spacing-12) * 4)">{photo}</VStack>;
 return <VStack gap={3} className={'media-gallery'+(compact?' compact':'')}>
  {compact?frame:<><ClickableCard className="media-main" padding={0} width="100%" label={english?'View photo':'查看图片'} isDisabled={!hasPhoto} onClick={()=>setOpen(true)} style={{overflow:'hidden',borderRadius:'var(--radius-container)',border:0}}>{frame}</ClickableCard>
   {images.length>1&&<HStack className="media-thumbnails" gap={2} wrap="wrap">{images.map((img,i)=><Thumbnail key={img.id} src={img.url} alt={img.alt||title} label={(english?'Photo ':'图片 ')+(i+1)} aria-pressed={index===i} onClick={()=>setIndex(i)} style={{border:'var(--border-width) solid '+(index===i?'var(--color-accent)':'var(--color-border)'),borderRadius:'var(--radius-element)'}}/>)}</HStack>}
   <Lightbox isOpen={open} onOpenChange={setOpen} media={images.map(img=>({src:img.url,alt:img.alt||title}))} index={index} onIndexChange={setIndex} hasZoom/>
  </>}
 </VStack>;
}
