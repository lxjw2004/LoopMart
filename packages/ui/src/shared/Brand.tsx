import type {MouseEventHandler, SVGProps} from 'react';
import {Icon} from '@astryxdesign/core/Icon';
import {Link} from '@astryxdesign/core/Link';
import {HStack} from '@astryxdesign/core/Stack';
import {Text} from '@astryxdesign/core/Text';

function RingMark(props:SVGProps<SVGSVGElement>){
 return <svg {...props} viewBox="0 0 26 26" fill="none"><circle cx="13" cy="13" r="10.5" stroke="currentColor" strokeWidth="3"/><circle cx="13" cy="13" r="3.5" fill="currentColor"/></svg>;
}
export function BrandMark(){
 return <Icon icon={RingMark} color="accent" size="lg" style={{width:'var(--lm-brand-mark-size)',height:'var(--lm-brand-mark-size)',flexShrink:0}}/>;
}
export default function Brand({href,onClick,compact=false}:{href:string;onClick?:MouseEventHandler<HTMLAnchorElement>;compact?:boolean}){
 return <Link className="brand" href={href} aria-label="LoopMart" type="inherit" color="primary" onClick={onClick} style={{whiteSpace:'nowrap'}}><HStack as="span" gap={2} vAlign="center"><BrandMark/><Text as="span" type="inherit" weight="bold" style={{fontWeight:800,fontSize:compact?'var(--text-heading-3-size)':'var(--lm-header-brand-size)',letterSpacing:'-0.03em'}}>LoopMart</Text></HStack></Link>;
}
