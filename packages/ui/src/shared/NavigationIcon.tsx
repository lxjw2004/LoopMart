import type {ReactNode, SVGProps} from 'react';
import {Icon} from '@astryxdesign/core/Icon';

// A single stroke and viewbox keep navigation and listing actions consistent.
function glyph(content: ReactNode) {
 return function Glyph(props: SVGProps<SVGSVGElement>) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">{content}</svg>;
 };
}

export const navigationIcons = {
 items: glyph(<><path d="m3 10 2-6h14l2 6M4 10v10h16V10M9 20v-6h6v6M3 10a3 3 0 0 0 5 2 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 5-2"/></>),
 rides: glyph(<><path d="m5 9 2-5h10l2 5M4 9h16v9H4zM6 18v2M18 18v2M7 13h1M16 13h1"/></>),
 publish: glyph(<path d="M12 5v14M5 12h14"/>),
 conversations: glyph(<path d="M20 11a8 8 0 0 1-8 8H4l1-4a8 8 0 1 1 15-4ZM8 10h8M8 14h5"/>),
 profile: glyph(<><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>),
 favorites: glyph(<path d="M20 5c-2-2-5-2-8 1C9 3 6 3 4 5s-2 5 0 7l8 8 8-8c2-2 2-5 0-7Z"/>),
 overview: glyph(<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>),
 users: glyph(<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v2"/></>),
 reports: glyph(<path d="M5 21V4c5-4 9 4 14 0v11c-5 4-9-4-14 0"/>),
 'community-messages': glyph(<><path d="m3 10 16-6v15L3 13v-3ZM6 14l2 6h4l-2-5M19 8l2-1M19 15l2 1"/></>),
 contact: glyph(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>),
 settings: glyph(<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--color-background-surface)"/><circle cx="15" cy="17" r="3" fill="var(--color-background-surface)"/></>),
 audit: glyph(<><path d="M15 3H5v18h14V7l-4-4ZM15 3v5h4M8 12h8M8 16h6"/></>),
};
const savedIcon = glyph(<path fill="currentColor" d="M20 5c-2-2-5-2-8 1C9 3 6 3 4 5s-2 5 0 7l8 8 8-8c2-2 2-5 0-7Z"/>);

export default function NavigationIcon({name, filled=false}: {name: keyof typeof navigationIcons; filled?: boolean}) {
 return <Icon icon={filled && name==='favorites' ? savedIcon : navigationIcons[name]} size="md"/>;
}
