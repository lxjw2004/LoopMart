"use client";
import { useEffect, useState, useRef } from "react";
import DataForm from "./DataForm";
import { parseRoute, legacyTarget, routeHref } from "./navigation";
import WebShell from "./web/WebShell";
import BrowsePage from "./web/BrowsePage";
import ListingDetail from "./web/ListingDetail";
import ListingCard from "./web/ListingCard";
import PublishPage from "./web/PublishPage";
import MessagesPage from "./web/MessagesPage";
import AdminShell from "./admin/AdminShell";
import ResourceList from "./admin/ResourceList";
import ResourceDetail from "./admin/ResourceDetail";
import ConfirmAction from "./admin/AdminForms";
import Details from "./Details";
import RideMeta from "./RideMeta";
import { rideLocations } from "./ride-options";
import { errorText } from "./errors";
import ProfileListings from "./ProfileListings";
import { departureInstant, departureLocal, formatDeparture } from "./time";
import { api, auth, conversationMessages } from "./api";
import { labels } from "../../i18n/src";
type Row = Record<string, any>;
const itemFields = {
  title: "text",
  description: "textarea",
  category: ["clothing", "books", "furniture", "electronics", "daily", "other"],
  priceCents: "number",
  condition: ["new", "like_new", "good", "fair"],
  deliveryMethod: ["pickup", "meetup", "delivery"],
};
const rideFields = {
  origin: "text",
  destination: "text",
  departureTime: "datetime-local",
  timeZone: ["America/Indiana/Indianapolis", "America/Chicago"],
  feeCents: "number",
  totalSeats: "number",
  availableSeats: "number",
  feeDescription: "text",
  notes: "textarea",
};
export default function Client({ admin = false }: { admin?: boolean }) {
  const [en, setEn] = useState(false),
    [page, setPage] = useState(admin ? "overview" : "items"),
    [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Row | null>(null),
    [me, setMe] = useState<Row | null>(null),
    [sessionLoaded, setSessionLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [cursor, setCursor] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [kind, setKind] = useState("items"),
    [messages, setMessages] = useState<Row[]>([]),
    [refresh, setRefresh] = useState(0),
    [mode, setMode] = useState("sign-in/email"),
    [filters, setFilters] = useState<Row>({}),
    [reference, setReference] = useState<Row | null>(null),
    [recipientQuery, setRecipientQuery] = useState(""),
    [recipientResults, setRecipientResults] = useState<Row[]>([]),
    [recipient, setRecipient] = useState<Row | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const [requestedEdit,setRequestedEdit]=useState(false);
  const [officialSender,setOfficialSender]=useState<Row|null>(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const [chatConnection,setChatConnection]=useState<"open"|"retrying">("open");
  const pendingRuns=useRef(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<{summary:string;confirm:(reason:string)=>Promise<void>;cancel:()=>void}|null>(null);
  const listCache = useRef(new Map<string, {rows:Row[];cursor:string|null;query:string;filters:Row;scroll:number}>());
  const restoring = useRef(false);
  const selectionSeq=useRef(0);
  const previousList=useRef<string|null>(null);
  const loadSeq = useRef(0);
  const readIds = useRef<Record<string, string>>({});
  const pendingMessages = useRef(new Map<string,{id:string;reference:Row|null}>());
  const t = (key: string) =>
    labels[key]?.[en ? 1 : 0] ||
    labels[key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())]?.[
      en ? 1 : 0
    ] ||
    key.replace(/_/g, " ");
  const say = (zh: string, english: string) => (en ? english : zh);
  async function run(action: () => Promise<any>) {
    const token=selectionSeq.current;pendingRuns.current++;setBusy(true);setError('');setNotice('');
    try{return await action()}catch(e){if(token===selectionSeq.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e)}finally{pendingRuns.current--;setBusy(pendingRuns.current>0)}
  }
  const base = admin ? "/admin/" : "/";
  useEffect(() => {
    document.documentElement.lang = en ? "en" : "zh";
  }, [en]);
  function go(next: string) {
    loadSeq.current++;selectionSeq.current++;
    history.pushState(null, "", routeHref(next, admin));
    setPage(next);setMessages([]);setReference(null);setRequestedEdit(false); setRows([]);setDetail(null); setEditing(false); setQuery("");setStatus("");setFilters({});setCursor(null);setError("");setNotice("");
    window.scrollTo(0,0); setRouteTick(v=>v+1);
  }
  function syncLocation() {
    const legacy = legacyTarget(new URL(location.href), admin);
    if (legacy) history.replaceState(null, "", legacy);
    const route = parseRoute(new URL(location.href), admin);
    loadSeq.current++;selectionSeq.current++;
    setPage(route.page);setMessages([]);setReference(null);setRequestedEdit(Boolean(route.edit));setRows([]); setEditing(Boolean(route.edit)); setDetail(null);setError("");setNotice("");
    setQuery(route.query.get("q") || "");setStatus(route.query.get("status")||"");
    const values=Object.fromEntries([...route.query].filter(([k])=>!["q","status","kind","cursor"].includes(k)));
    setFilters(values);setCursor(null);
    if(route.page==='publish'||route.edit||route.page==='profile')setKind(route.page==='rides'?'rides':route.query.get('kind')==='rides'?'rides':'items');
    if(route.page==='login'&&route.query.has('token'))setMode('reset-password');
    const cache = !route.id && listCache.current.get(location.pathname+location.search);
    if(cache){setRows(cache.rows);setCursor(cache.cursor);setQuery(cache.query);setFilters(cache.filters);restoring.current=true;requestAnimationFrame(()=>window.scrollTo(0,cache.scroll));}
    if(route.page==='user'&&route.id){const token=selectionSeq.current;api('/profiles/'+encodeURIComponent(route.id)).then(r=>{if(token===selectionSeq.current)setDetail(r)}).catch(e=>{if(token===selectionSeq.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e)});}
    setRouteTick(v=>v+1);
  }
  useEffect(() => {
    syncLocation();
    window.addEventListener('popstate',syncLocation);
    try {setEn(localStorage.getItem("loopmart-language")==="en");}catch{}
    api("/me").then(setMe).catch(()=>setMe(null)).finally(()=>setSessionLoaded(true));
    return()=>window.removeEventListener('popstate',syncLocation);
  }, []);
  useEffect(()=>{readIds.current={};pendingMessages.current.clear();setFavoriteIds(new Set());listCache.current.clear();if(!me){setUnreadCount(0);return;}let active=true;api('/favorites').then(result=>{if(!active)return;const list=Array.isArray(result)?result:result.data||[];setFavoriteIds(new Set(list.map((r:Row)=>r.id)))}).catch(()=>{});return()=>{active=false}},[me?.id]);
  useEffect(()=>{if(!admin||page!=='community-messages')return;let active=true;setOfficialSender(null);api('/admin/settings').then(async settings=>settings.communityAdminUserId?api('/admin/users/'+settings.communityAdminUserId):null).then(row=>{if(active)setOfficialSender(row)}).catch(()=>{});return()=>{active=false}},[admin,page,refresh]);
  async function toggleFavorite(row:Row){
    if(!me){go('login');return;}
    const saved=favoriteIds.has(row.id);
    await api('/favorites/'+row.id,saved?'DELETE':'PUT');
    setFavoriteIds(old=>{const next=new Set(old);saved?next.delete(row.id):next.add(row.id);return next;});
    listCache.current.clear();if(page==='favorites')setRefresh(v=>v+1);
  }
  async function load(append = false, override?: Row) {
    const seq = ++loadSeq.current;
    const result = page === "conversations" && !admin ? await conversationMessages("/conversations") : await api(
      base +
        (page === "profile"
          ? "me/" + kind
          : page === "privacy"
            ? "public/settings"
            : page === "contact" && !admin
              ? "public/settings"
              : page) +
        ("?" +
          new URLSearchParams(
            Object.fromEntries(
              Object.entries({
                q: override?.q ?? query,
                status,
                ...(override ? Object.fromEntries(Object.entries(override).filter(([k])=>k!=="q")) : filters),
                ...(append && cursor ? { cursor } : {}),
              }).filter(([, v]) => String(v).length > 0),
            ),
          ).toString()),
    );
    if (seq !== loadSeq.current) return;
    if (Array.isArray(result)) {
      setRows((old) => (append ? [...old, ...result] : result));
      setCursor(null);
    } else if (Array.isArray(result.data)) {
      setRows((old) => (append ? [...old, ...result.data] : result.data));
      setCursor(result.nextCursor);
    } else {
      setDetail(result);
      setRows([]);
    }
    const route=parseRoute(new URL(location.href),admin);
    if(route.page===page&&route.id){
      if(page==='conversations'&&!admin){const conversation=(Array.isArray(result)?result:result.data||[]).find((r:Row)=>r.id===route.id);if(!conversation)throw new Error(say('会话不可用','Conversation unavailable'));const list=await conversationMessages('/conversations/'+route.id+'/messages');if(seq!==loadSeq.current)return;setDetail(conversation);setMessages(list);if(document.visibilityState==='visible'&&list.length)await api('/conversations/'+route.id+'/read','PUT',{messageId:list.at(-1)!.id});}
      else {const chat=admin&&['conversations','community-messages'].includes(page);const record=chat?await conversationMessages(base+page+'/'+encodeURIComponent(route.id)):await api(base+page+'/'+encodeURIComponent(route.id)); if(seq!==loadSeq.current)return;setDetail(chat?{...(Array.isArray(result)?result:result.data||[]).find((r:Row)=>r.id===route.id),id:route.id,messages:record}:record);}
    }
  }
  useEffect(() => {
    if (["login", "publish", "user", "not-found"].includes(page)) return;
    if(restoring.current){restoring.current=false;return;}
    run(() => load());
  }, [page, refresh, routeTick, page === "profile" ? kind : null]);
  useEffect(() => {
    if(admin||!me)return;
    const events=new EventSource('/api/v1/events');events.addEventListener('open',()=>setChatConnection('open'));events.addEventListener('error',()=>setChatConnection('retrying'));let active=true;const selected=page==='conversations'?detail?.id:null;let updateSeq=0;
    const update=async()=>{const seq=++updateSeq;try{const conversations=await conversationMessages('/conversations');if(!active||seq!==updateSeq)return;setUnreadCount(conversations.reduce((n,r)=>n+(r.unreadCount||0),0));if(page==='conversations')setRows(conversations);if(selected){const list=await conversationMessages('/conversations/'+selected+'/messages');if(!active||seq!==updateSeq)return;setMessages(list);const latest=conversations.find(r=>r.id===selected);if(latest)setDetail(latest);if(document.visibilityState==='visible'&&list.length&&readIds.current[selected]!==list.at(-1)!.id){await api('/conversations/'+selected+'/read','PUT',{messageId:list.at(-1)!.id});readIds.current[selected]=list.at(-1)!.id}}}catch{}};
    ['message','conversation','read','open'].forEach(name=>events.addEventListener(name,update));
    document.addEventListener('visibilitychange',update);
    return()=>{active=false;events.close();document.removeEventListener('visibilitychange',update)};
  },[admin,page,me?.id,detail?.id]);
  async function open(row:Row){
    listCache.current.set(location.pathname+location.search,{rows,cursor,query,filters,scroll:window.scrollY});
    previousList.current=location.pathname+location.search;
    const resource=page==='favorites'?'items':page==='profile'?kind:page;
    history.pushState(null,'',routeHref(resource,admin,row.id));syncLocation();
  }
  function backToList(){
    if(previousList.current){history.pushState(null,'',previousList.current);previousList.current=null;syncLocation();}
    else go(page==='rides'?'rides':'items');
  }
  async function performWrite(path:string,method:string,value:Row){
    const result=await api(path,method,value);
    listCache.current.clear();
    if(detail?.id&&method==='PATCH')setDetail(await api(path));
    if(method==='DELETE'){setDetail(null);history.replaceState(null,'',routeHref(page,admin));}
    setRefresh(x=>x+1);setEditing(false);return result;
  }
  async function write(path:string,method:string,value:Row):Promise<any>{
    if(!admin)return performWrite(path,method,value);
    return new Promise((resolve,reject)=>setConfirmation({
      summary: `${page==='community-messages'?say('发送身份','Sender')+': '+(officialSender?.name||say('未配置','Not configured'))+' · '+say('收件人','Recipient')+': '+(recipient?.name||say('未选择','Not selected'))+'\n':''}${t(page)} · ${detail?.title||detail?.name||detail?.subject||say('新记录','New record')} · ${method==='DELETE'?say('删除','Delete'):path.endsWith('/password')?say('修改密码','Change password'):say('保存更改','Save changes')}\n${Object.entries(value).filter(([k])=>!/(password|token|secret|userId)/i.test(k)).map(([k,v])=>t(k)+': '+String(Array.isArray(v)?v.join(', '):v).slice(0,160)).join('\n')}`,
      confirm:async(reason)=>{const result=await performWrite(path,method,{...value,reason});setConfirmation(null);resolve(result)},
      cancel:()=>{setConfirmation(null);reject(new DOMException('Action cancelled','AbortError'))}
    }));
  }
  function language(){setEn(!en);try{localStorage.setItem('loopmart-language',en?'zh':'en')}catch{}}
  function applyBrowse(values:Row){const {q='',...next}=values;setQuery(q);setFilters(next);setCursor(null);const params=new URLSearchParams(Object.entries(values).filter(([,v])=>String(v)!=='').map(([k,v])=>[k,String(v)]));history.pushState(null,'',routeHref(page,admin)+(params.size?'?'+params:''));run(()=>load(false,values));}
  async function contactListing(){
    const listing=detail!;const token=selectionSeq.current;if(!me){go('login');return;}
    const c=await api('/conversations','POST',{otherUserId:listing.publisherId});
    if(token!==selectionSeq.current)return;
    const listingKind=page==='rides'?'ride':'item';
    go('conversations');history.replaceState(null,'',routeHref('conversations',false,c.id));
    setReference({type:listingKind,id:listing.id});setDetail({...c,otherUser:{id:listing.publisherId,name:listing.publisherName}});
    const chatToken=selectionSeq.current;const list=await conversationMessages('/conversations/'+c.id+'/messages');if(chatToken===selectionSeq.current)setMessages(list);
  }
  const Shell=admin?AdminShell:WebShell;
  return (
    <Shell page={page} me={me} english={en} unreadCount={unreadCount} onNavigate={go} onLanguageChange={language}
      onLogout={()=>run(async()=>{await auth('sign-out',{});setMe(null);go('login')})}
      onSearch={(q:string)=>{go('items');setQuery(q);history.replaceState(null,'','/items?q='+encodeURIComponent(q));setRouteTick(v=>v+1)}}>
      {confirmation&&<ConfirmAction title={say('确认操作','Confirm action')} summary={confirmation.summary} onConfirm={confirmation.confirm} onClose={confirmation.cancel} english={en}/>}
      <main className={admin?'admin-page-content':'web-main'}>
        <h1>{admin?({items:say('商品','Items'),conversations:say('会话','Conversations'),contact:say('联系表单','Contact'),audit:say('审计日志','Audit log')} as Row)[page]||t(page):t(page)}</h1>
        {me?.banned && (
          <p role="alert" className="error">
            {say("账号已封禁", "Account suspended")}
          </p>
        )}
        {me && !me.emailVerified && (
          <div className="panel">
            {say("请验证邮箱以继续", "Verify your email to continue")}{" "}
            <button
              onClick={() =>
                run(() =>
                  auth("send-verification-email", {
                    email: me.email,
                    callbackURL: location.origin,
                  }),
                )
              }
            >
              {say("重发验证邮件", "Resend verification")}
            </button>
          </div>
        )}
        {Boolean(error) && (
          <div role="alert" className="error">
            {errorText(error, en)}
            {!["login", "publish"].includes(page) && !editing && (
              <button onClick={() => setRefresh((x) => x + 1)}>
                {say("重试", "Retry")}
              </button>
            )}
          </div>
        )}
        {notice && <p role="status">{notice}</p>}
        {busy && <p role="status">{t("loading")}</p>}
        {page === "not-found" ? <div className="empty-state">{say("页面不存在","Page not found")}<button onClick={()=>go(admin?"overview":"items")}>{t("back")}</button></div> : page === "login" ? (
          <>
            <div className="toolbar">
              {[
                "sign-in/email",
                "sign-up/email",
                "request-password-reset",
                "reset-password",
                "send-verification-email",
                "change-email",
                ...(me?["change-password"]:[]),
              ].map((x) => (
                <button key={x} onClick={() => setMode(x)}>
                  {
                    (
                      {
                        "sign-in/email": say("登录", "Sign in"),
                        "sign-up/email": say("注册", "Register"),
                        "request-password-reset": say(
                          "忘记密码",
                          "Forgot password",
                        ),
                        "reset-password": say("重设密码", "Reset password"),
                        "send-verification-email": say(
                          "重发验证邮件",
                          "Resend verification",
                        ),
                        "change-email": say("修改邮箱", "Change email"),
                        "change-password":say("修改密码","Change password"),
                      } as Row
                    )[x]
                  }
                </button>
              ))}
            </div>
            <DataForm
              t={t}
              say={say}
              run={run}
              busy={busy}
              kind={kind}
              fields={
                mode === "change-password" ? {currentPassword:"password",newPassword:"password"} : mode === "reset-password"
                  ? { password: "password" }
                  : mode === "request-password-reset" ||
                      mode === "send-verification-email" ||
                      mode === "change-email"
                    ? { email: "email" }
                    : mode === "sign-up/email"
                      ? { name: "text", email: "email", password: "password" }
                      : { email: "email", password: "password" }
              }
              submit={async (v) => {
                await auth(
                  mode,
                  mode === "change-password" ? {...v,revokeOtherSessions:true} : mode === "reset-password"
                    ? {
                        newPassword: v.password,
                        token: new URLSearchParams(location.search).get(
                          "token",
                        ),
                      }
                    : mode === "change-email"
                      ? { newEmail: v.email, callbackURL: location.origin }
                      : {
                          ...v,
                          callbackURL: location.origin,
                          redirectTo: location.origin + "?reset=true",
                        },
                );
                api("/me")
                  .then(setMe)
                  .catch(() => {});
              }}
            />
            {me && (
              <button
                onClick={() =>
                  run(async () => {
                    await auth("sign-out", {});
                    setMe(null);
                  })
                }
              >
                {say("退出", "Sign out")}
              </button>
            )}
          </>
        ) : !sessionLoaded ? (
          <p role="status">{t("loading")}</p>
        ) : admin && (!me || me.role !== "admin") ? (
          <div className="panel">
            {say("需要管理员权限", "Administrator access required")}{" "}
            <button onClick={() => go("login")}>{t("login")}</button>
          </div>
        ) : !admin &&
          !me &&
          ["publish", "conversations", "favorites", "profile"].includes(
            page,
          ) ? (
          <div className="panel">
            <button onClick={() => go("login")}>{t("login")}</button>
          </div>
        ) : editing && !detail && (requestedEdit || !admin) ? <p role="status">{error?say('内容不可用','Listing unavailable'):t('loading')}</p>
        : editing && !admin && detail?.publisherId!==me?.id ? <p role="alert">{say('无权编辑此内容','You cannot edit this listing')}</p>
        : !admin && (page === "publish" || editing) ? (
          <><div className="publish-tabs actions">{!editing&&['items','rides'].map(k=><button key={k} aria-pressed={kind===k} onClick={()=>{setKind(k);history.replaceState(null,'','/publish?kind='+k)}}>{t(k)}</button>)}</div>
          <PublishPage kind={kind} id={editing?detail?.id:undefined} ownerId={me?.id} t={t} say={say} run={run} busy={busy}
          initial={editing?(detail?.departureTime?{...detail,departureTime:departureLocal(detail.departureTime,detail.timeZone)}:detail||{}):undefined}
          submit={async(v)=>{const resource=kind;const result=await write('/'+resource+(editing&&detail?.id?'/'+detail.id:''),editing&&detail?.id?'PATCH':'POST',resource==='rides'?{...v,departureTime:departureInstant(v.departureTime,v.timeZone)}:v);go(resource);if(result?.id){history.replaceState(null,'',routeHref(resource,false,result.id));setDetail(result)} }} /></>
        ) : page === "publish" || editing ? (
          <>
            <div className="toolbar">
              {!editing &&
                ["items", "rides"].map((x) => (
                  <button key={x} onClick={() => setKind(x)}>
                    {t(x)}
                  </button>
                ))}
            </div>
            <DataForm
              t={t}
              say={say}
              run={run}
              busy={busy}
              kind={kind}
              key={kind + (detail?.id || "new") + me?.id}
              ownerId={me?.id}
              fields={{
                ...(kind === "items" ? itemFields : rideFields),
                ...(admin ? { publisherId: "text" } : {}),
              }}
              initial={
                editing
                  ? detail?.departureTime
                    ? {
                        ...detail,
                        departureTime: departureLocal(
                          detail.departureTime,
                          detail.timeZone,
                        ),
                      }
                    : detail || {}
                  : {
                      timeZone: "America/Indiana/Indianapolis",
                    }
              }
              draft={!editing && !admin}
              submit={async (v) => {
                await write(
                  base + kind + (editing && detail?.id ? "/" + detail.id : ""),
                  editing && detail?.id ? "PATCH" : "POST",
                  kind === "rides"
                    ? {
                        ...v,
                        departureTime: departureInstant(
                          v.departureTime,
                          v.timeZone,
                        ),
                      }
                    : v,
                );
                go(kind);
              }}
            />
          </>
        ) : page === "contact" && !admin && detail?.contactEnabled === false ? (
          <p>{say("联系表单暂不可用", "Contact form unavailable")}</p>
        ) : page === "contact" && !admin ? (
          <DataForm
            t={t}
            say={say}
            run={run}
            busy={busy}
            kind={kind}
            fields={{ email: "email", subject: "text", message: "textarea" }}
            submit={(v) => api("/contact", "POST", v)}
          />
        ) : page === "privacy" ? (
          <article className="panel">
            {detail?.[en ? "privacyPolicyEn" : "privacyPolicyZh"] ||
              say("暂无政策", "Policy unavailable")}
          </article>
        ) : page === "settings" && admin ? (
          <DataForm
            t={t}
            say={say}
            run={run}
            busy={busy}
            kind={kind}
            initial={detail || {}}
            groups={[
              {title:say('认证','Authentication'),fields:['allowedEmailDomains','allowAllEmailDomains']},
              {title:say('社区身份','Community identity'),fields:['communityAdminUserId']},
              {title:say('联系','Contact'),fields:['contactEnabled']},
              {title:say('隐私','Privacy'),fields:['privacyPolicyZh','privacyPolicyEn']}
            ]}
            fields={{
              allowedEmailDomains: "text",
              allowAllEmailDomains: ["true", "false"],
              communityAdminUserId: "text",
              privacyPolicyZh: "textarea",
              privacyPolicyEn: "textarea",
              contactEnabled: ["true", "false"],
            }}
            submit={(v) =>
              write("/admin/settings", "PATCH", {
                ...Object.fromEntries(
                  Object.entries(v).filter(
                    ([k, value]) =>
                      k !== "communityAdminUserId" || Boolean(value),
                  ),
                ),
                allowedEmailDomains: String(v.allowedEmailDomains ?? "")
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
                allowAllEmailDomains: String(v.allowAllEmailDomains) === "true",
                contactEnabled: String(v.contactEnabled) === "true",
              })
            }
          />
        ) : page === "conversations" && !admin ? (
          <MessagesPage connectionState={chatConnection} rows={rows} detail={detail} messages={messages} me={me} english={en} onOpen={open} onBack={()=>go('conversations')}
            reference={reference as {type:string;id:string}|null} onClearReference={()=>setReference(null)}
            onProfile={(id)=>{history.pushState(null,'',routeHref('user',false,id));syncLocation()}}
            onReferenceOpen={(type,id)=>{history.pushState(null,'',routeHref(type==='rides'||type==='ride'?'rides':'items',false,id));syncLocation()}}
            report={detail?<Report type="conversation" id={detail.id}/>:null}
            onSend={async(text)=>{const conversationId=detail!.id;const token=selectionSeq.current;const key=JSON.stringify([conversationId,text]);let pending=pendingMessages.current.get(key);if(!pending){pending={id:crypto.randomUUID(),reference};pendingMessages.current.set(key,pending)}await api('/conversations/'+conversationId+'/messages','POST',{text,clientId:pending.id,...(pending.reference?{reference:pending.reference}:{})});pendingMessages.current.delete(key);if(token===selectionSeq.current)setReference(null);try{const list=await conversationMessages('/conversations/'+conversationId+'/messages');if(token===selectionSeq.current)setMessages(list)}catch{/* The acknowledged send succeeds; SSE/reconnect catches up the display. */}}} />
        ) : !admin && detail && ['items','rides','favorites'].includes(page) ? (
          <ListingDetail row={detail} kind={page==='rides'?'rides':'items'} english={en} t={t} onBack={backToList}
          onProfile={()=>{history.pushState(null,'',routeHref('user',false,detail.publisherId));syncLocation()}}
          report={<Report type={page==='rides'?'ride':'item'} id={detail.id}/>}
          actions={<>{detail.publisherId===me?.id?<><button onClick={()=>{setKind(page==='rides'?'rides':'items');setEditing(true);history.pushState(null,'',routeHref(page==='rides'?'rides':'items',false,detail.id)+'/edit')}}>{say('编辑','Edit')}</button><button className="secondary" onClick={()=>run(()=>write('/'+(page==='rides'?'rides':'items')+'/'+detail.id,'PATCH',{status:detail.status==='active'?'deactivated':'active'}))} disabled={!['active','deactivated'].includes(detail.status)}>{detail.status==='active'?say('下架','Deactivate'):say('上架','Activate')}</button><button className="text-button danger" onClick={()=>{if(confirm(say('确认删除此发布？','Delete this listing?')))run(()=>write('/'+(page==='rides'?'rides':'items')+'/'+detail.id,'DELETE',{}))}}>{say('删除','Delete')}</button></>:<button className="listing-contact" onClick={()=>run(contactListing)} disabled={detail.status!=='active'}>{say(page==='rides'?'联系车主':'联系卖家',page==='rides'?'Contact driver':'Contact seller')}</button>}{page!=='rides'&&<button className="secondary" onClick={()=>run(()=>toggleFavorite(detail))}>{favoriteIds.has(detail.id)?say('取消收藏','Remove favorite'):say('收藏','Save item')}</button>}</>}/>
        ) : !admin && !detail && ['items','rides','favorites'].includes(page) ? (
          <BrowsePage simple={page==='favorites'} kind={page==='rides'?'rides':'items'} rows={rows} query={query} filters={filters} cursor={cursor} busy={busy} english={en} t={t} onApply={applyBrowse} onMore={()=>run(()=>load(true))} onOpen={open} onFavorite={(row)=>run(()=>toggleFavorite(row))} favorites={favoriteIds}/>
        ) : detail &&
          page !== "overview" &&
          !(page === "profile" && !detail.id) ? (
          <section className="panel">
            <button onClick={()=>{history.pushState(null,'',routeHref(page,admin));syncLocation()}}>{t("back")}</button>
            <h2 hidden={admin}>
              {detail.title ||
                detail.name ||
                [detail.origin, detail.destination]
                  .filter(Boolean)
                  .join(" → ") ||
                detail.id}
            </h2>
            {admin ? <ResourceDetail resource={page} detail={detail} english={en} t={t}/> : <div className="profile-heading"><span className="avatar">{String(detail.name||'L')[0]}</span><h2>{detail.name}</h2></div>}
            {page === "user" && (
              <ProfileListings
                english={en}
                userId={detail.id}
                t={t}
                onOpen={(type,row)=>{history.pushState(null,'',routeHref(type,false,row.id));syncLocation()}}
              />
            )}
            <div className="actions">
              {["items", "rides", "favorites", "profile"].includes(page) &&
                (admin || detail.publisherId === me?.id) && (
                  <>
                    <button
                      onClick={() => {
                        setKind(
                          page === "favorites"
                            ? "items"
                            : page === "profile"
                              ? kind
                              : page,
                        );
                        setEditing(true);
                      }}
                    >
                      {say("编辑", "Edit")}
                    </button>
                    <button
                      onClick={() =>
                        run(() =>
                          write(
                            base +
                              (page === "favorites"
                                ? "items"
                                : page === "profile"
                                  ? kind
                                  : page) +
                              "/" +
                              detail.id,
                            "DELETE",
                            {},
                          ),
                        )
                      }
                    >
                      {say("删除", "Delete")}
                    </button>
                    {(admin || detail.publisherId === me?.id) &&
                      ["active", "deactivated"].includes(detail.status) && (
                        <button
                          onClick={() =>
                            run(() =>
                              write(
                                base +
                                  (page === "favorites"
                                    ? "items"
                                    : page === "profile"
                                      ? kind
                                      : page) +
                                  "/" +
                                  detail.id,
                                "PATCH",
                                {
                                  status:
                                    detail.status === "active"
                                      ? "deactivated"
                                      : "active",
                                },
                              ),
                            )
                          }
                        >
                          {say("切换上下架", "Toggle listing")}
                        </button>
                      )}
                  </>
                )}
              {!admin && ["items", "rides"].includes(page) && (
                <>
                  <button
                    onClick={() =>
                      run(async () => {
                        const c = await api("/conversations", "POST", {
                          otherUserId: detail.publisherId,
                        });
                        setReference({
                          type: page === "items" ? "item" : "ride",
                          id: detail.id,
                        });
                        go("conversations");
                        setDetail({
                          ...c,
                          otherUser: {
                            id: detail.publisherId,
                            name: detail.publisherName,
                          },
                        });
                        const ms = await conversationMessages(
                          "/conversations/" + c.id + "/messages",
                        );
                        setMessages(ms);
                      })
                    }
                  >
                    {t("conversations")}
                  </button>
                  {page === "items" && (
                    <>
                      <button
                        onClick={() =>
                          run(() => api("/favorites/" + detail.id, "PUT"))
                        }
                      >
                        {t("favorites")}
                      </button>
                      <button
                        onClick={() =>
                          run(() => api("/favorites/" + detail.id, "DELETE"))
                        }
                      >
                        {say("取消收藏", "Remove favorite")}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() =>
                      run(async () => {
                        setDetail(await api("/profiles/" + detail.publisherId));
                        setPage("user");
                      })
                    }
                  >
                    {say("发布者资料", "Publisher profile")}
                  </button>
                </>
              )}
            </div>
            {!admin && (
              <Report
                type={
                  page === "user"
                    ? "user"
                    : page === "rides" ||
                        (page === "profile" && kind === "rides")
                      ? "ride"
                      : "item"
                }
                id={detail.id}
              />
            )}
            {admin && ["items", "rides"].includes(page) && (
              <DataForm
                t={t}
                say={say}
                run={run}
                busy={busy}
                kind={kind}
                initial={{ status: detail.status }}
                fields={{
                  status: [
                    "active",
                    "deactivated",
                    "reported",
                    "deactivated_violation",
                  ],
                }}
                submit={(v) =>
                  write("/admin/" + page + "/" + detail.id, "PATCH", v)
                }
              />
            )}
            {admin && page === "users" && (
              <>
                <DataForm
                  t={t}
                  say={say}
                  run={run}
                  busy={busy}
                  kind={kind}
                  initial={detail}
                  fields={{
                    name: "text",
                    role: ["member", "admin"],
                    banned: ["true", "false"],
                  }}
                  submit={(v) =>
                    write("/admin/users/" + detail.id, "PATCH", {
                      ...v,
                      banned: String(v.banned) === "true",
                    })
                  }
                />
                <DataForm
                  t={t}
                  say={say}
                  run={run}
                  busy={busy}
                  kind={kind}
                  fields={{ password: "password" }}
                  submit={(v) =>
                    write("/admin/users/" + detail.id + "/password", "POST", v)
                  }
                />
                <button
                  onClick={() =>
                    run(() =>
                      write(
                        "/admin/users/" + detail.id + "/reset-password",
                        "POST",
                        {},
                      ),
                    )
                  }
                >
                  {say("发送密码重置", "Send password reset")}
                </button>
              </>
            )}
            {admin && page === "contact" && (
              <DataForm
                t={t}
                say={say}
                run={run}
                busy={busy}
                kind={kind}
                initial={{
                  status: detail.status || "open",
                  note: detail.note || "",
                }}
                fields={{ status: ["open", "resolved"], note: "textarea" }}
                submit={(v) => write("/admin/contact/" + detail.id, "PATCH", v)}
              />
            )}
            {admin && page === "reports" && (
              <DataForm
                t={t}
                say={say}
                run={run}
                busy={busy}
                kind={kind}
                fields={{
                  status: ["reviewed", "dismissed", "violation_confirmed"],
                  note: "textarea",
                }}
                submit={(v) => write("/admin/reports/" + detail.id, "PATCH", v)}
              />
            )}
          </section>
        ) : (
          <>
            {page === "profile" && (
              <>
                <div className="actions"><button className="secondary" onClick={()=>go('favorites')}>{say('收藏','Saved items')}</button><button className="secondary" onClick={()=>{go('login');setMode('change-email')}}>{say('修改邮箱','Change email')}</button><button className="secondary" onClick={()=>{go('login');setMode('change-password')}}>{say('修改密码','Change password')}</button><button className="text-button" onClick={()=>run(async()=>{await auth('sign-out',{});setMe(null);go('login')})}>{say('退出','Sign out')}</button></div>
                <button
                  onClick={() =>
                    run(async () => {
                      const settings = await api("/public/settings");
                      if (!settings.communityAdminUserId)
                        throw new Error(
                          say(
                            "未设置社区管理员",
                            "Community administrator unavailable",
                          ),
                        );
                      const c = await api("/conversations", "POST", {
                        otherUserId: settings.communityAdminUserId,
                      });
                      go("conversations");history.replaceState(null,'',routeHref('conversations',false,c.id));
                      setDetail({
                        ...c,
                        otherUser: await api(
                          "/profiles/" + settings.communityAdminUserId,
                        ),
                      });
                      setMessages(
                        await conversationMessages(
                          "/conversations/" + c.id + "/messages",
                        ),
                      );
                    })
                  }
                >
                  {say("联系社区管理员", "Contact community administrator")}
                </button>
                <DataForm
                  t={t}
                  say={say}
                  run={run}
                  busy={busy}
                  kind={kind}
                  initial={me || {}}
                  fields={{ name: "text" }}
                  submit={async (v) => {
                    await api("/me", "PATCH", v);
                    setMe(await api("/me"));
                  }}
                />
                <div className="actions">
                  <button
                    aria-pressed={kind === "items"}
                    onClick={() => {
                      setRows([]);setKind("items");history.replaceState(null,'','/account/listings?kind=items');
                      setCursor(null);
                      setDetail(null);
                    }}
                  >
                    {t("items")}
                  </button>
                  <button
                    aria-pressed={kind === "rides"}
                    onClick={() => {
                      setRows([]);setKind("rides");history.replaceState(null,'','/account/listings?kind=rides');
                      setCursor(null);
                      setDetail(null);
                    }}
                  >
                    {t("rides")}
                  </button>
                </div>
              </>
            )}
            {page === "overview" ? (
              <section className="grid">
                {Object.entries(detail || {}).map(([k, v]) => (
                  <article className="card" key={k}>
                    <small>{t(k)}</small>
                    <b>{String(v)}</b>
                  </article>
                ))}
              </section>
            ) : (
              <>
                <form
                  className="toolbar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => load());
                  }}
                >
                  <input
                    aria-label={t("search")}
                    placeholder={t("search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {(admin || page === "profile") && (
                    <select
                      aria-label={t("status")}
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                    >
                      {(page === "contact"
                        ? ["", "open", "resolved"]
                        : page === "users"
                          ? ["", "active", "banned"]
                          : page === "reports"
                            ? [
                                "",
                                "pending",
                                "reviewed",
                                "dismissed",
                                "violation_confirmed",
                              ]
                            : [
                                "",
                                "active",
                                "deactivated",
                                "reported",
                                "deactivated_violation",
                              ]
                      ).map((x) => (
                        <option key={x} value={x}>
                          {x ? t(x) : say("全部", "All")}
                        </option>
                      ))}
                    </select>
                  )}
                  {(admin
                    ? page === "users"
                      ? ["role", "banned"]
                      : page === "reports"
                        ? [
                            "targetType",
                            "reason",
                            "targetId",
                            "reporterId",
                            "from",
                            "to",
                          ]
                        : page === "audit"
                          ? [
                              "action",
                              "actorId",
                              "resource",
                              "resourceId",
                              "from",
                              "to",
                            ]
                          : page === "items"
                            ? ["category", "publisherId", "from", "to"]
                            : page === "rides"
                              ? [
                                  "origin",
                                  "destination",
                                  "publisherId",
                                  "date",
                                  "from",
                                  "to",
                                ]
                              : page === "conversations" ||
                                  page === "community-messages"
                                ? ["from", "to"]
                                : []
                    : page === "items"
                      ? ["category"]
                      : page === "rides"
                        ? ["origin", "destination", "date"]
                        : []
                  ).map((k) => {
                    const options = (
                      {
                        category: itemFields.category,
                        role: ["member", "admin"],
                        banned: ["true", "false"],
                        targetType: ["item", "ride", "user", "conversation"],
                      } as Record<string, string[]>
                    )[k];
                    return options ? (
                      <select
                        key={k}
                        aria-label={t(k)}
                        value={filters[k] || ""}
                        onChange={(e) =>
                          setFilters({ ...filters, [k]: e.target.value })
                        }
                      >
                        <option value="">{t(k)}</option>
                        {options.map((x) => (
                          <option value={x} key={x}>
                            {t(x)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        key={k}
                        list={
                          k === "origin" || k === "destination"
                            ? "filter-ride-locations"
                            : undefined
                        }
                        aria-label={t(k)}
                        placeholder={t(k)}
                        type={
                          k === "date" || k === "from" || k === "to"
                            ? "date"
                            : "text"
                        }
                        value={filters[k] || ""}
                        onChange={(e) =>
                          setFilters({ ...filters, [k]: e.target.value })
                        }
                      />
                    );
                  })}
                  {page === "rides" && (
                    <>
                      <datalist id="filter-ride-locations">
                        {rideLocations.map((location) => (
                          <option key={location} value={location} />
                        ))}
                      </datalist>
                      <select
                        aria-label={t("sort")}
                        value={filters.sort || "departure_asc"}
                        onChange={(e) => {
                          setCursor(null);
                          setFilters({ ...filters, sort: e.target.value });
                        }}
                      >
                        <option value="departure_asc">
                          {t("departure_asc")}
                        </option>
                        <option value="departure_desc">
                          {t("departure_desc")}
                        </option>
                      </select>
                    </>
                  )}
                  <button>{t("search")}</button>
                </form>
                {admin && ["items", "rides"].includes(page) && (
                  <button
                    onClick={() => {
                      setKind(page);
                      setDetail(null);
                      setEditing(true);
                    }}
                  >
                    {say("创建", "Create")}
                  </button>
                )}
                {admin && page === "users" && (
                  <details>
                    <summary>{say("创建用户", "Create user")}</summary>
                    <DataForm
                      t={t}
                      say={say}
                      run={run}
                      busy={busy}
                      kind={kind}
                      fields={{
                        email: "email",
                        name: "text",
                        password: "password",
                      }}
                      submit={(v) => write("/admin/users", "POST", v)}
                    />
                  </details>
                )}
                {admin && page === "community-messages" && (
                  <section className="panel">
                    <p>{say('发送身份','Sender')}: <strong>{officialSender?.name||say('未配置','Not configured')}</strong></p>
                    <div className="toolbar">
                      <input
                        aria-label={say("搜索用户", "Search users")}
                        placeholder={say("搜索用户", "Search users")}
                        value={recipientQuery}
                        onChange={(e) => setRecipientQuery(e.target.value)}
                      />
                      <button
                        onClick={() =>
                          run(async () => {
                            const result = await api(
                              "/admin/users?q=" +
                                encodeURIComponent(recipientQuery),
                            );
                            setRecipientResults(
                              Array.isArray(result)
                                ? result
                                : result.data || [],
                            );
                          })
                        }
                      >
                        {t("search")}
                      </button>
                    </div>
                    <div className="actions">
                      {recipientResults.map((r) => (
                        <button key={r.id} onClick={() => setRecipient(r)}>
                          {r.name} · {r.email}
                        </button>
                      ))}
                    </div>
                    {recipient && (
                      <p>
                        {recipient.name} · {recipient.email}
                      </p>
                    )}
                    <DataForm
                      t={t}
                      say={say}
                      run={run}
                      busy={busy}
                      kind={kind}
                      initial={{ userId: recipient?.id || "" }}
                      fields={{ text: "textarea" }}
                      submit={(v) => {if(!recipient)throw new Error(say('请选择收件人','Select a recipient'));return write("/admin/community-messages", "POST", {...v,userId:recipient.id})}}
                    />
                  </section>
                )}
                {admin ? <ResourceList resource={page} rows={rows} onOpen={open} english={en} t={t} busy={busy}/> : <section className="grid">
                  {rows.map((r) => (
                    <ListingCard key={r.id} row={r} kind={kind} english={en} t={t} onOpen={()=>open(r)}/>

                  ))}
                </section>}
                {!busy && !rows.length && <p>{t("empty")}</p>}
                {cursor && (
                  <button onClick={() => run(() => load(true))}>
                    {say("加载更多", "Load more")}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </main>
    </Shell>
  );
  function Report({ type, id }: { type: string; id: string }) {
    return (
      <details>
        <summary>{say("举报", "Report")}</summary>
        <DataForm
          t={t}
          say={say}
          run={run}
          busy={busy}
          kind={kind}
          fields={{
            reason: ["spam", "fraud", "inappropriate", "other"],
            details: "textarea",
          }}
          submit={(v) =>
            api("/reports", "POST", { ...v, targetType: type, targetId: id })
          }
        />
      </details>
    );
  }
}
