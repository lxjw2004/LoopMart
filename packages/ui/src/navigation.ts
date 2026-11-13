export type UiRoute={area:'web'|'admin';page:string;id?:string;edit?:boolean;query:URLSearchParams};
const aliases:Record<string,string>={messages:'conversations',account:'profile','auth-settings':'settings','community-admin':'settings','privacy-policy':'settings','contact-form':'contact',profiles:'user'};
const webPages=new Set(['items','rides','publish','conversations','favorites','profile','user','login','privacy','contact']);
const adminPages=new Set(['overview','users','items','rides','conversations','reports','community-messages','contact','settings','audit','login']);
export function parseRoute(url:URL,admin:boolean):UiRoute{
 const segments=url.pathname.split('/').filter(Boolean); if(segments[0]==='admin')segments.shift();
 let page=aliases[segments[0]]||segments[0]||(admin?'overview':'items');
 if(url.searchParams.has('token')||url.searchParams.has('reset'))page='login';
 if(!(admin?adminPages:webPages).has(page))page='not-found';
 const id=segments[1]&&!(page==='profile'&&segments[1]==='listings')?decodeURIComponent(segments[1]):undefined;
 return {area:admin?'admin':'web',page,id,edit:segments[2]==='edit',query:new URLSearchParams(url.search)};
}
export function routeHref(page:string,admin=false,id?:string){
 const slug=admin?page:({conversations:'messages',profile:'account',user:'profiles'} as Record<string,string>)[page]||page;
 return (admin?'/admin/':'/')+slug+(id?'/'+encodeURIComponent(id):'');
}
export function legacyTarget(url:URL,admin:boolean):string|null{
 if(url.searchParams.has('token')||url.searchParams.has('reset'))return null;
 if(!url.hash)return null;
 const raw=url.hash.slice(1); const page=aliases[raw]||raw;
 return (admin?adminPages:webPages).has(page)?routeHref(page,admin)+url.search:null;
}
export function safeReturnTo(value:string){return value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'';}
