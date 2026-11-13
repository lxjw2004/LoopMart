"use client";
import { useEffect, useLayoutEffect, useState, useRef, type ComponentProps } from "react";
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
import RideLocationInput from "./shared/RideLocationInput";
import { errorText, RequestError } from "./errors";
import ProfileListings from "./ProfileListings";
import { departureInstant, departureLocal, formatDeparture } from "./time";
import { api, auth, conversationMessages } from "./api";
import { labels } from "../../i18n/src";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Avatar } from "@astryxdesign/core/Avatar";
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { DateInput } from "@astryxdesign/core/DateInput";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import zhCN from "@astryxdesign/core/locales/zh-CN.generated.js";
import { Selector } from "@astryxdesign/core/Selector";
import { Section } from "@astryxdesign/core/Section";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useLayout } from "./shared/design";
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
export default function Client({ admin = false, initialLocation = "/" }: { admin?: boolean; initialLocation?: string }) {
  const { mobile, desktop } = useLayout();
  const [initialRoute] = useState(() => parseRoute(new URL(initialLocation, "http://loopmart.local"), admin));
  const [routeId, setRouteId] = useState(initialRoute.id);
  const [routeLoading, setRouteLoading] = useState(!["login", "publish", "not-found"].includes(initialRoute.page));
  const [en, setEn] = useState(false),
    [page, setPage] = useState(initialRoute.page),
    [rows, setRows] = useState<Row[]>([]),
    [detail, setDetail] = useState<Row | null>(null),
    [me, setMe] = useState<Row | null>(null),
    [sessionLoaded, setSessionLoaded] = useState(false),
    [actionBusy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(initialRoute.query.get("q") || ""),
    [status, setStatus] = useState(initialRoute.query.get("status") || ""),
    [cursor, setCursor] = useState<string | null>(null),
    [editing, setEditing] = useState(Boolean(initialRoute.edit)),
    [kind, setKind] = useState(initialRoute.page === "rides" || initialRoute.query.get("kind") === "rides" ? "rides" : "items"),
    [messages, setMessages] = useState<Row[]>([]),
    [refresh, setRefresh] = useState(0),
    [mode, setMode] = useState(initialRoute.query.has("token") ? "reset-password" : "sign-in/email"),
    [filters, setFilters] = useState<Row>(Object.fromEntries([...initialRoute.query].filter(([key]) => !["q", "status", "kind", "cursor"].includes(key)))),
    [reference, setReference] = useState<Row | null>(null),
    [recipientQuery, setRecipientQuery] = useState(""),
    [recipientResults, setRecipientResults] = useState<Row[]>([]),
    [recipient, setRecipient] = useState<Row | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const [requestedEdit,setRequestedEdit]=useState(Boolean(initialRoute.edit));
  const busy = actionBusy || routeLoading;
  const [officialSender,setOfficialSender]=useState<Row|null>(null);
  const [unreadCount,setUnreadCount]=useState(0);
  const [chatConnection,setChatConnection]=useState<"open"|"retrying">("open");
  const pendingRuns=useRef(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<{summary:string;confirm:(reason:string)=>Promise<void>;cancel:()=>void}|null>(null);
  const [deleteAction, setDeleteAction] = useState<(() => Promise<void>) | null>(null);
  const listCache = useRef(new Map<string, {rows:Row[];cursor:string|null;query:string;filters:Row;scroll:number}>());
  const restoring = useRef(false);
  const selectionSeq=useRef(0);
  const pendingScroll = useRef<{selection: number; top: number} | null>(null);
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
    const token=selectionSeq.current, previousError=error;pendingRuns.current++;setBusy(true);setNotice('');
    try{
      const result=await action();
      if(token===selectionSeq.current)setError((current: unknown)=>current===previousError?'':current);
      return result;
    }catch(e){if(token===selectionSeq.current&&!(e instanceof Error&&e.name==='AbortError'))setError(e)}finally{if(token===selectionSeq.current){pendingRuns.current--;setBusy(pendingRuns.current>0)}}
  }
  const base = admin ? "/admin/" : "/";
  useEffect(() => {
    document.documentElement.lang = en ? "en" : "zh";
  }, [en]);
  function go(next: string) {
    const target = routeHref(next, admin);
    const current = parseRoute(new URL(location.href), admin);
    if (current.page === next && !current.id && !current.edit && !current.query.size && !editing) return;
    history.pushState(null, "", target);
    if(next === "login") setMode("sign-in/email");
    syncLocation();
  }
  function syncLocation(seed?: Row, initial = false) {
    const legacy = legacyTarget(new URL(location.href), admin);
    if (legacy) history.replaceState(null, "", legacy);
    const route = parseRoute(new URL(location.href), admin);
    loadSeq.current++;selectionSeq.current++;pendingRuns.current=0;setBusy(false);
    setPage(route.page);setRouteId(route.id);setMessages([]);setReference(null);setRequestedEdit(Boolean(route.edit));setRows(seed && route.page === page ? rows : []); setEditing(Boolean(route.edit)); setDetail(seed || null);setError("");setNotice("");
    setQuery(route.query.get("q") || "");setStatus(route.query.get("status")||"");
    const values=Object.fromEntries([...route.query].filter(([k])=>!["q","status","kind","cursor"].includes(k)));
    setFilters(values);setCursor(null);
    if(route.page==='publish'||route.edit||route.page==='profile')setKind(route.page==='rides'?'rides':route.query.get('kind')==='rides'?'rides':'items');
    if(route.page==='login'&&route.query.has('token'))setMode('reset-password');
    const cache = !route.id && listCache.current.get(location.pathname+location.search);
    restoring.current=Boolean(cache);
    if(cache){setRows(cache.rows);setCursor(cache.cursor);setQuery(cache.query);setFilters(cache.filters);}
    setRouteLoading(!cache && !["login", "publish", "not-found"].includes(route.page));
    pendingScroll.current={selection:selectionSeq.current,top:cache ? cache.scroll : initial ? window.scrollY : 0};
    setRouteTick(v=>v+1);
  }
  useLayoutEffect(() => {
    const pending = pendingScroll.current;
    if (pending && pending.selection === selectionSeq.current) {
      window.scrollTo({top: pending.top, behavior: "instant"});
      pendingScroll.current = null;
    }
  }, [routeTick]);
  useEffect(() => {
    syncLocation(undefined, true);
    const popstate = () => syncLocation();
    window.addEventListener('popstate',popstate);
    try {setEn(localStorage.getItem("loopmart-language")==="en");}catch{}
    api("/me").then(setMe).catch(()=>setMe(null)).finally(()=>setSessionLoaded(true));
    return()=>window.removeEventListener('popstate',popstate);
  }, []);
  useEffect(() => {
    if (sessionLoaded && me && page === "login" && mode === "sign-in/email" && !new URLSearchParams(location.search).has("token")) {
      go(admin ? "overview" : "items");
    }
  }, [sessionLoaded, me?.id, page, mode]);
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
    const route = parseRoute(new URL(location.href), admin);
    // A detail URL has a detail layout from the start; never load a list into it.
    if (route.page === page && route.id) {
      const id = encodeURIComponent(route.id);
      try {
        if (page === "conversations" && !admin) {
          const [conversations, list] = await Promise.all([
            conversationMessages("/conversations"),
            conversationMessages("/conversations/" + id + "/messages"),
          ]);
          if (seq !== loadSeq.current) return;
          const conversation = conversations.find((row: Row) => row.id === route.id);
          if (!conversation) throw new RequestError(404, "NOT_FOUND", "Conversation unavailable");
          setRows(conversations);setDetail(conversation);setMessages(list);
          if (document.visibilityState === "visible" && list.length) {
            await api("/conversations/" + id + "/read", "PUT", {messageId: list.at(-1)!.id});
            readIds.current[route.id] = list.at(-1)!.id;
          }
        } else if (admin && ["conversations", "community-messages"].includes(page)) {
          const [conversations, messages] = await Promise.all([
            conversationMessages(base + page), conversationMessages(base + page + "/" + id),
          ]);
          if (seq !== loadSeq.current) return;
          setRows(conversations);setDetail({...conversations.find((row: Row) => row.id === route.id), id: route.id, messages});
        } else {
          const record = await api(page === "user" ? "/profiles/" + id : base + page + "/" + id);
          if (seq !== loadSeq.current) return;
          setDetail(record);
        }
      } catch (failure) {
        if (seq === loadSeq.current && failure instanceof RequestError && [401, 403, 404].includes(failure.status)) {
          setDetail(null);listCache.current.clear();
        }
        throw failure;
      }
      return;
    }
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
  }
  useEffect(() => {
    if (!sessionLoaded) return;
    if ((admin && (!me || me.role !== "admin")) || (!admin && !me && ["publish", "conversations", "favorites", "profile"].includes(page))
      || ["login", "publish", "not-found"].includes(page)) { setRouteLoading(false);return; }
    if(restoring.current){restoring.current=false;setRouteLoading(false);return;}
    const selection = selectionSeq.current;
    run(() => load()).finally(() => {if (selection === selectionSeq.current) setRouteLoading(false);});
  }, [page, refresh, routeTick, sessionLoaded, me?.id, me?.role, page === "profile" ? kind : null]);
  useEffect(() => {
    if(admin||!me)return;
    const events=new EventSource('/api/v1/events');events.addEventListener('open',()=>setChatConnection('open'));events.addEventListener('error',()=>setChatConnection('retrying'));let active=true;const selected=page==='conversations'?detail?.id:null;let updateSeq=0;
    const update=async()=>{const seq=++updateSeq;try{const conversations=await conversationMessages('/conversations');if(!active||seq!==updateSeq)return;setUnreadCount(conversations.reduce((n,r)=>n+(r.unreadCount||0),0));if(page==='conversations')setRows(conversations);if(selected){const list=await conversationMessages('/conversations/'+selected+'/messages');if(!active||seq!==updateSeq)return;setMessages(list);const latest=conversations.find(r=>r.id===selected);if(latest)setDetail(latest);if(document.visibilityState==='visible'&&list.length&&readIds.current[selected]!==list.at(-1)!.id){await api('/conversations/'+selected+'/read','PUT',{messageId:list.at(-1)!.id});readIds.current[selected]=list.at(-1)!.id}}}catch{}};
    ['message','conversation','read','open'].forEach(name=>events.addEventListener(name,update));
    document.addEventListener('visibilitychange',update);
    return()=>{active=false;events.close();document.removeEventListener('visibilitychange',update)};
  },[admin,page,me?.id,detail?.id]);
  async function open(row:Row){
    if (!routeId) {
      listCache.current.set(location.pathname+location.search,{rows,cursor,query,filters,scroll:window.scrollY});
      previousList.current=location.pathname+location.search;
    }
    const resource=page==='favorites'?'items':page==='profile'?kind:page;
    history.pushState(null,'',routeHref(resource,admin,row.id));syncLocation(row);
  }
  function backToList(){
    if(previousList.current){history.pushState(null,'',previousList.current);previousList.current=null;syncLocation();}
    else go(page==='rides'?'rides':'items');
  }
  async function performWrite(path:string,method:string,value:Row,selection=selectionSeq.current){
    const result=await api(path,method,value);
    listCache.current.clear();
    if (selection !== selectionSeq.current) return result;
    if(detail?.id&&method==='PATCH'){
      const record = await api(path);
      if (selection !== selectionSeq.current) return result;
      setDetail(record);
    }
    if(method==='DELETE'){setDetail(null);setRouteId(undefined);history.replaceState(null,'',routeHref(page,admin));}
    setRefresh(x=>x+1);setEditing(false);return result;
  }
  async function write(path:string,method:string,value:Row):Promise<any>{
    if(!admin)return performWrite(path,method,value);
    const selection = selectionSeq.current;
    return new Promise((resolve,reject)=>setConfirmation({
      summary: `${page==='community-messages'?say('发送身份','Sender')+': '+(officialSender?.name||say('未配置','Not configured'))+' · '+say('收件人','Recipient')+': '+(recipient?.name||say('未选择','Not selected'))+'\n':''}${t(page)} · ${detail?.title||detail?.name||detail?.subject||say('新记录','New record')} · ${method==='DELETE'?say('删除','Delete'):path.endsWith('/password')?say('修改密码','Change password'):say('保存更改','Save changes')}\n${Object.entries(value).filter(([k])=>!/(password|token|secret|userId)/i.test(k)).map(([k,v])=>t(k)+': '+String(Array.isArray(v)?v.join(', '):v).slice(0,160)).join('\n')}`,
      confirm:async(reason)=>{const result=await performWrite(path,method,{...value,reason},selection);setConfirmation(null);resolve(result)},
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
    history.pushState(null,'',routeHref('conversations',false,c.id));
    syncLocation({...c,otherUser:{id:listing.publisherId,name:listing.publisherName}});
    setReference({type:listingKind,id:listing.id});
  }
  const stickyBrowseTitle=!admin&&desktop&&sessionLoaded&&!routeId&&!editing&&['items','rides'].includes(page);
  const Shell=admin?AdminShell:WebShell;
  const reportProps = {t, say, run, busy, kind};
  return (
    <InternationalizationProvider locale={en ? "en" : "zh-CN"} messages={{ "zh-CN": zhCN }}>
    <Shell page={page} me={me} english={en} unreadCount={unreadCount} chatActive={!admin && page === "conversations" && Boolean(routeId || detail)} onNavigate={go} onLanguageChange={language}
      onLogout={()=>run(async()=>{await auth('sign-out',{});setMe(null);go('login')})}
      onSearch={(q:string)=>{history.pushState(null,'','/items?q='+encodeURIComponent(q));syncLocation()}}>
      {confirmation&&<ConfirmAction title={say('确认操作','Confirm action')} summary={confirmation.summary} onConfirm={confirmation.confirm} onClose={confirmation.cancel} english={en}/>}
      <AlertDialog isOpen={Boolean(deleteAction)} onOpenChange={open => { if (!open && !busy) setDeleteAction(null); }}
        title={say("删除发布", "Delete listing")} description={say("确认删除此发布？", "Delete this listing?")}
        actionLabel={say("删除", "Delete")} cancelLabel={say("取消", "Cancel")} isActionLoading={busy}
        onAction={() => run(async () => { await deleteAction?.(); setDeleteAction(null); })} />
      <VStack gap={6} width="100%" style={{position: "relative", minWidth: 0, flexGrow: admin ? undefined : 1, height: !admin && page === "conversations" && (routeId || detail) ? "var(--lm-chat-content-height)" : undefined}} className={admin?'admin-page-content':'web-page-content'}>
        {!stickyBrowseTitle && !(!admin && mobile && page === "conversations" && (routeId || detail)) && <Heading level={1} style={admin && page === "login" ? {maxWidth:"var(--lm-auth-width)",width:"100%",marginInline:"auto",marginBlockStart:"5vh"} : !admin && page === "conversations" && (routeId || detail) ? {display:"var(--lm-chat-heading-display)"} : undefined}>{admin?({items:say('商品','Items'),conversations:say('会话','Conversations'),contact:say('联系表单','Contact'),audit:say('审计日志','Audit log')} as Row)[page]||t(page):t(page)}</Heading>}
        {me?.banned && <Banner status="error" title={say("账号已封禁", "Account suspended")} role="alert" />}
        {me && !me.emailVerified && (
          <Banner status="warning" title={say("请验证邮箱以继续", "Verify your email to continue")}
            endContent={<Button label={say("重发验证邮件", "Resend verification")}
              onClick={() =>
                run(() =>
                  auth("send-verification-email", {
                    email: me.email,
                    callbackURL: location.origin,
                  }),
                )
              }
            />} />
        )}
        {Boolean(error) && (
          <Banner status="error" title={errorText(error, en)} role="alert"
            endContent={!["login", "publish"].includes(page) && !editing && (
              <Button label={say("重试", "Retry")} onClick={() => setRefresh((x) => x + 1)} />
            )} />
        )}
        {notice && <Banner status="success" title={notice} role="status" />}
        {/* Request feedback must not add a row or gap to the page layout. */}
        {busy && <VStack style={{position: "absolute", insetBlockStart: 0, insetInlineEnd: 0, pointerEvents: "none", zIndex: 1}}>
          <Spinner aria-label={t("loading")} />
        </VStack>}
        {page === "not-found" ? <EmptyState headingLevel={2} title={say("页面不存在","Page not found")} actions={<Button width="fit-content" label={t("back")} onClick={()=>go(admin?"overview":"items")} />} /> : page === "login" ? (
          <VStack gap={6} className="auth-page" width="100%" maxWidth={admin ? "var(--lm-auth-width)" : undefined} style={{marginInline: admin ? "auto" : undefined}}>
            <HStack gap={3} wrap="wrap" vAlign="center" className="toolbar auth-modes">
              {[
                "sign-in/email",
                ...(!admin ? ["sign-up/email"] : []),
                "request-password-reset",
                "reset-password",
                "send-verification-email",
                ...(me?["change-email", "change-password"]:[]),
              ].map((x) => (
                <ToggleButton label={(
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
                    )[x]} key={x} isPressed={mode === x} onPressedChange={() => {setMode(x);setError("");setNotice("")}}>
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
                </ToggleButton>
              ))}
            </HStack>
            <DataForm
              submitFullWidth
              key={mode}
              submitLabel={({
                "sign-in/email": say("登录", "Sign in"),
                "sign-up/email": say("注册", "Register"),
                "request-password-reset": say("发送重置邮件", "Send reset email"),
                "reset-password": say("重设密码", "Reset password"),
                "send-verification-email": say("重发验证邮件", "Resend verification"),
                "change-email": say("修改邮箱", "Change email"),
                "change-password": say("修改密码", "Change password"),
              } as Row)[mode]}
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
                const selection = selectionSeq.current;
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
                if (mode === "sign-in/email") {
                  const user = await api("/me");
                  setMe(user);
                  if (selection === selectionSeq.current) go(admin ? "overview" : "items");
                } else if (mode === "change-password" || mode === "change-email") {
                  setMe(await api("/me"));
                }
                if (selection === selectionSeq.current && ["sign-up/email", "request-password-reset", "send-verification-email", "change-email"].includes(mode)) {
                  setNotice(say("请求已提交，请检查邮箱", "Request submitted. Check your email"));
                }
              }}
            />
          </VStack>
        ) : !sessionLoaded ? (
          <Text as="p" role="status">{t("loading")}</Text>
        ) : admin && (!me || me.role !== "admin") ? (
          <VStack gap={4} className="panel">
            <Text>{say("需要管理员权限", "Administrator access required")}</Text>
            <Button label={t("login")} onClick={() => go("login")} />
          </VStack>
        ) : !admin &&
          !me &&
          ["publish", "conversations", "favorites", "profile"].includes(
            page,
          ) ? (
          <VStack gap={4} className="panel">
            <Button label={t("login")} onClick={() => go("login")} />
          </VStack>
        ) : (routeId && !detail) || (routeLoading && !detail && !["items", "rides", "favorites", "conversations"].includes(page)) ? (
          error ? <EmptyState headingLevel={2} title={say("内容不可用", "Content unavailable")} /> :
          <VStack className="route-loading" aria-busy="true" gap={5} minHeight="60vh">
            <Skeleton height="calc(var(--spacing-12) * 4)" />
            <Skeleton height="var(--spacing-8)" />
          </VStack>
        ) : editing && !detail && (requestedEdit || !admin) ? <Text as="p" role="status">{error?say('内容不可用','Listing unavailable'):t('loading')}</Text>
        : editing && !admin && detail?.publisherId!==me?.id ? <Text as="p" role="alert">{say('无权编辑此内容','You cannot edit this listing')}</Text>
        : !admin && (page === "publish" || editing) ? (
          <><HStack gap={3} wrap="wrap" vAlign="center" className="publish-tabs actions">{!editing&&['items','rides'].map(k=><ToggleButton label={t(k)} key={k} isPressed={kind===k} onPressedChange={()=>{if(kind===k)return;history.replaceState(null,'','/publish?kind='+k);syncLocation(undefined,true)}}>{t(k)}</ToggleButton>)}</HStack>
          <PublishPage kind={kind} id={editing?detail?.id:undefined} ownerId={me?.id} t={t} say={say} run={run} busy={busy}
          initial={editing?(detail?.departureTime?{...detail,departureTime:departureLocal(detail.departureTime,detail.timeZone)}:detail||{}):undefined}
          submit={async(v)=>{
            const resource=kind, selection=selectionSeq.current;
            const result=await write('/'+resource+(editing&&detail?.id?'/'+detail.id:''),editing&&detail?.id?'PATCH':'POST',resource==='rides'?{...v,departureTime:departureInstant(v.departureTime,v.timeZone)}:v);
            if (selection !== selectionSeq.current) return;
            if(result?.id){history.pushState(null,'',routeHref(resource,false,result.id));syncLocation(result)}else go(resource);
          }} /></>
        ) : page === "publish" || editing ? (
          <>
            <HStack gap={3} wrap="wrap" vAlign="center" className="toolbar">
              {!editing &&
                ["items", "rides"].map((x) => (
                  <Button label={t(x)} key={x} onClick={() => setKind(x)} />
                ))}
            </HStack>
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
                const selection = selectionSeq.current;
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
                if (selection === selectionSeq.current) go(kind);
              }}
            />
          </>
        ) : page === "contact" && !admin && detail?.contactEnabled === false ? (
          <Text as="p">{say("联系表单暂不可用", "Contact form unavailable")}</Text>
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
          <Section variant="form-panel" className="panel"><VStack as="article" gap={4}>
            <Text as="p" style={{ whiteSpace: "pre-wrap" }}>{detail?.[en ? "privacyPolicyEn" : "privacyPolicyZh"] ||
              say("暂无政策", "Policy unavailable")}</Text>
          </VStack></Section>
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
          <MessagesPage loading={routeLoading} connectionState={chatConnection} rows={rows} detail={detail} messages={messages} me={me} english={en} onOpen={open} onBack={()=>go('conversations')}
            reference={reference as {type:string;id:string}|null} onClearReference={()=>setReference(null)}
            onProfile={(id)=>{history.pushState(null,'',routeHref('user',false,id));syncLocation()}}
            onReferenceOpen={(type,id)=>{history.pushState(null,'',routeHref(type==='rides'||type==='ride'?'rides':'items',false,id));syncLocation()}}
            report={detail?<Report key={detail.id} {...reportProps} type="conversation" id={detail.id}/>:null}
            onSend={async(text)=>{const conversationId=detail!.id;const token=selectionSeq.current;const key=JSON.stringify([conversationId,text]);let pending=pendingMessages.current.get(key);if(!pending){pending={id:crypto.randomUUID(),reference};pendingMessages.current.set(key,pending)}await api('/conversations/'+conversationId+'/messages','POST',{text,clientId:pending.id,...(pending.reference?{reference:pending.reference}:{})});pendingMessages.current.delete(key);if(token===selectionSeq.current)setReference(null);try{const list=await conversationMessages('/conversations/'+conversationId+'/messages');if(token===selectionSeq.current)setMessages(list)}catch{/* The acknowledged send succeeds; SSE/reconnect catches up the display. */}}} />
        ) : !admin && detail && ['items','rides','favorites'].includes(page) ? (
          <ListingDetail row={detail} kind={page==='rides'?'rides':'items'} english={en} t={t} onBack={backToList}
          onProfile={()=>{history.pushState(null,'',routeHref('user',false,detail.publisherId));syncLocation()}}
          report={<Report key={detail.id} {...reportProps} type={page==='rides'?'ride':'item'} id={detail.id}/>}
          actions={<>{detail.publisherId===me?.id?<><Button label={say('编辑','Edit')} onClick={()=>{setKind(page==='rides'?'rides':'items');setEditing(true);history.pushState(null,'',routeHref(page==='rides'?'rides':'items',false,detail.id)+'/edit')}} /><Button label={detail.status==='active'?say('下架','Deactivate'):say('上架','Activate')} className="secondary" onClick={()=>run(()=>write('/'+(page==='rides'?'rides':'items')+'/'+detail.id,'PATCH',{status:detail.status==='active'?'deactivated':'active'}))} isDisabled={!['active','deactivated'].includes(detail.status)} /><Button label={say('删除','Delete')} className="text-button danger" variant="destructive" onClick={()=>{const path="/"+(page==="rides"?"rides":"items")+"/"+detail.id;setDeleteAction(()=>async()=>{await write(path,"DELETE",{});})}} /></>:<Button variant="primary" label={say(page==='rides'?'联系车主':'联系卖家',page==='rides'?'Contact driver':'Contact seller')} className="listing-contact" width={mobile ? "calc(100% - var(--lm-page-gutter) * 2)" : "100%"} style={mobile ? {position:"fixed",insetInline:"var(--lm-page-gutter)",bottom:"calc(var(--lm-mobile-nav-height) + var(--spacing-2) + env(safe-area-inset-bottom))",zIndex:19} : undefined} onClick={()=>run(contactListing)} isDisabled={detail.status!=='active'} />}{page!=='rides'&&<Button label={favoriteIds.has(detail.id)?say('取消收藏','Remove favorite'):say('收藏','Save item')} className="secondary" onClick={()=>run(()=>toggleFavorite(detail))} />}</>}/>
        ) : !admin && !detail && ['items','rides','favorites'].includes(page) ? (
          <BrowsePage simple={page==='favorites'} kind={page==='rides'?'rides':'items'} rows={rows} query={query} filters={filters} cursor={cursor} busy={busy} english={en} t={t} onApply={applyBrowse} onMore={()=>run(()=>load(true))} onOpen={open} onFavorite={(row)=>run(()=>toggleFavorite(row))} favorites={favoriteIds}/>
        ) : detail &&
          page !== "overview" &&
          !(page === "profile" && !detail.id) ? (
          <Section variant={admin ? "transparent" : "form-panel"} padding={admin ? 0 : undefined} className="panel"><VStack gap={6}>
            <Button width="fit-content" label={t("back")} onClick={()=>{history.pushState(null,'',routeHref(page,admin));syncLocation()}} />
            {admin ? <ResourceDetail resource={page} detail={detail} english={en} t={t}/> : <HStack gap={3} wrap="wrap" vAlign="center" className="profile-heading"><Avatar name={String(detail.name||"L")} /><Heading level={2}>{detail.name}</Heading></HStack>}
            {page === "user" && (
              <ProfileListings
                english={en}
                userId={detail.id}
                t={t}
                onOpen={(type,row)=>{history.pushState(null,'',routeHref(type,false,row.id));syncLocation()}}
              />
            )}
            <HStack gap={3} wrap="wrap" vAlign="center" className="actions">
              {["items", "rides", "favorites", "profile"].includes(page) &&
                (admin || detail.publisherId === me?.id) && (
                  <>
                    <Button label={say("编辑", "Edit")}
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
                     />
                    <Button label={say("删除", "Delete")}
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
                     />
                    {(admin || detail.publisherId === me?.id) &&
                      ["active", "deactivated"].includes(detail.status) && (
                        <Button label={say("切换上下架", "Toggle listing")}
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
                         />
                      )}
                  </>
                )}
              {!admin && ["items", "rides"].includes(page) && (
                <>
                  <Button label={t("conversations")}
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
                   />
                  {page === "items" && (
                    <>
                      <Button label={t("favorites")}
                        onClick={() =>
                          run(() => api("/favorites/" + detail.id, "PUT"))
                        }
                       />
                      <Button label={say("取消收藏", "Remove favorite")}
                        onClick={() =>
                          run(() => api("/favorites/" + detail.id, "DELETE"))
                        }
                       />
                    </>
                  )}
                  <Button label={say("发布者资料", "Publisher profile")}
                    onClick={() =>
                      run(async () => {
                        setDetail(await api("/profiles/" + detail.publisherId));
                        setPage("user");
                      })
                    }
                   />
                </>
              )}
            </HStack>
            {!admin && (
              <Report
                key={detail.id}
                {...reportProps}
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
                <Button label={say("发送密码重置", "Send password reset")}
                  onClick={() =>
                    run(() =>
                      write(
                        "/admin/users/" + detail.id + "/reset-password",
                        "POST",
                        {},
                      ),
                    )
                  }
                 />
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
          </VStack></Section>
        ) : (
          <>
            {page === "profile" && (
              <>
                <HStack gap={3} wrap="wrap" vAlign="center" className="actions"><Button label={say('收藏','Saved items')} className="secondary" onClick={()=>go('favorites')} /><Button label={say('修改邮箱','Change email')} className="secondary" onClick={()=>{go('login');setMode('change-email')}} /><Button label={say('修改密码','Change password')} className="secondary" onClick={()=>{go('login');setMode('change-password')}} /><Button variant="ghost" label={say('退出','Sign out')} className="text-button" onClick={()=>run(async()=>{await auth('sign-out',{});setMe(null);go('login')})} /></HStack>
                <Button label={say("联系社区管理员", "Contact community administrator")}
                  onClick={() =>
                    run(async () => {
                      const selection = selectionSeq.current;
                      const settings = await api("/public/settings");
                      if (!settings.communityAdminUserId)
                        throw new Error(
                          say(
                            "未设置社区管理员",
                            "Community administrator unavailable",
                          ),
                        );
                      const [c, otherUser] = await Promise.all([
                        api("/conversations", "POST", {otherUserId: settings.communityAdminUserId}),
                        api("/profiles/" + settings.communityAdminUserId),
                      ]);
                      if (selection !== selectionSeq.current) return;
                      history.pushState(null,'',routeHref('conversations',false,c.id));
                      syncLocation({...c, otherUser});
                    })
                  }
                 />
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
                <HStack gap={3} wrap="wrap" vAlign="center" className="actions">
                  <ToggleButton label={t("items")}
                    isPressed={kind === "items"}
                    onPressedChange={() => {
                      if (kind === "items") return;
                      history.replaceState(null,'','/account/listings?kind=items');syncLocation(undefined,true);
                    }}
                  >
                    {t("items")}
                  </ToggleButton>
                  <ToggleButton label={t("rides")}
                    isPressed={kind === "rides"}
                    onPressedChange={() => {
                      if (kind === "rides") return;
                      history.replaceState(null,'','/account/listings?kind=rides');syncLocation(undefined,true);
                    }}
                  >
                    {t("rides")}
                  </ToggleButton>
                </HStack>
              </>
            )}
            {page === "overview" ? (
              <Grid columns={{minWidth: 240, max: 4}} gap={5} className="grid admin-metrics">
                {Object.entries(detail || {}).map(([k, v]) => (
                  <Card className="admin-metric" data-testid="admin-metric" key={k}><VStack gap={4}>
                    <Text type="supporting">{t(k)}</Text>
                    <Text type="display-3" hasTabularNumbers>{String(v)}</Text></VStack>
                  </Card>
                ))}
              </Grid>
            ) : (
              <>
                <HStack as="form" gap={3} wrap="wrap" vAlign="end" className="toolbar" style={admin ? {padding: "var(--lm-admin-filter-padding)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius-container)", background: "var(--color-background-surface)"} : undefined}
                  onSubmit={e => { e.preventDefault(); const invalid = e.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"], :invalid'); if (invalid) { invalid.focus(); return; } run(() => load()); }}>
                  <TextInput label={t("search")} placeholder={t("search")} value={query} onChange={setQuery} />
                  {(admin || page === "profile") && <Selector label={t("status")} value={status}
                    onChange={setStatus} options={(page === "contact" ? ["", "open", "resolved"]
                      : page === "users" ? ["", "active", "banned"]
                      : page === "reports" ? ["", "pending", "reviewed", "dismissed", "violation_confirmed"]
                      : ["", "active", "deactivated", "reported", "deactivated_violation"])
                      .map(value => ({ value, label: value ? t(value) : say("全部", "All") }))} />}
                  {(admin ? page === "users" ? ["role", "banned"]
                    : page === "reports" ? ["targetType", "reason", "targetId", "reporterId", "from", "to"]
                    : page === "audit" ? ["action", "actorId", "resource", "resourceId", "from", "to"]
                    : page === "items" ? ["category", "publisherId", "from", "to"]
                    : page === "rides" ? ["origin", "destination", "publisherId", "date", "from", "to"]
                    : ["conversations", "community-messages"].includes(page) ? ["from", "to"] : []
                    : page === "items" ? ["category"] : page === "rides" ? ["origin", "destination", "date"] : [])
                    .map(field => {
                      const options = ({ category: itemFields.category, role: ["member", "admin"], banned: ["true", "false"], targetType: ["item", "ride", "user", "conversation"] } as Record<string, string[]>)[field];
                      return options ? <Selector key={field} label={t(field)} value={filters[field] || ""}
                        onChange={value => setFilters({ ...filters, [field]: value })}
                        options={[{ value: "", label: say("全部", "All") }, ...options.map(value => ({ value, label: t(value) }))]} />
                        : ["date", "from", "to"].includes(field) ? <DateInput key={field} label={t(field)}
                          value={filters[field] || undefined} hasClear presentation="native"
                          onChange={value => setFilters({ ...filters, [field]: value || "" })} />
                        : ["origin", "destination"].includes(field) ? <RideLocationInput key={field} label={t(field)}
                          value={filters[field] || ""} onChange={value => setFilters({ ...filters, [field]: value })} />
                        : <TextInput key={field} label={t(field)} placeholder={t(field)}
                          value={filters[field] || ""} onChange={value => setFilters({ ...filters, [field]: value })} />;
                    })}
                  {page === "rides" && <>
                    <Selector label={t("sort")} value={filters.sort || "departure_asc"}
                      options={["departure_asc", "departure_desc"].map(value => ({ value, label: t(value) }))}
                      onChange={value => { setCursor(null); setFilters({ ...filters, sort: value }); }} />
                  </>}
                  <Button label={t("search")} type="submit" variant="primary" isLoading={busy} />
                </HStack>
                {admin && ["items", "rides"].includes(page) && (
                  <Button width="fit-content" label={say("创建", "Create")}
                    onClick={() => {
                      setKind(page);
                      setDetail(null);
                      setEditing(true);
                    }}
                   />
                )}
                {admin && page === "users" && (
                  <Collapsible defaultIsOpen={false} trigger={say("创建用户", "Create user")}>

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
                  </Collapsible>
                )}
                {admin && page === "community-messages" && (
                  <VStack gap={6} className="panel">
                    <Text as="p">{say('发送身份','Sender')}: <Text type="label">{officialSender?.name||say('未配置','Not configured')}</Text></Text>
                    <HStack gap={3} wrap="wrap" vAlign="center" className="toolbar">
                      <TextInput
                        label={say("搜索用户", "Search users")}
                        placeholder={say("搜索用户", "Search users")}
                        value={recipientQuery}
                        onChange={setRecipientQuery}
                      />
                      <Button label={t("search")}
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
                       />
                    </HStack>
                    <HStack gap={3} wrap="wrap" vAlign="center" className="actions">
                      {recipientResults.map((r) => (
                        <Button label={[r.name,"·",r.email].join(" ")} key={r.id} onClick={() => setRecipient(r)} />
                      ))}
                    </HStack>
                    {recipient && (
                      <Text as="p">
                        {recipient.name} · {recipient.email}
                      </Text>
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
                  </VStack>
                )}
                {admin ? <ResourceList resource={page} rows={rows} onOpen={open} english={en} t={t} busy={busy}/> : <Grid columns={mobile ? (kind === "rides" ? 1 : 2) : desktop ? 3 : 2} gap={mobile ? 3 : 5} className="grid">
                  {rows.map((r) => (
                    <ListingCard key={r.id} row={r} kind={kind} english={en} t={t} onOpen={()=>open(r)}/>

                  ))}
                </Grid>}
                {!busy && !rows.length && <Text as="p">{t("empty")}</Text>}
                {cursor && (
                  <Button label={say("加载更多", "Load more")} onClick={() => run(() => load(true))} />
                )}
              </>
            )}
          </>
        )}
      </VStack>
    </Shell>
    </InternationalizationProvider>
  );
}

function Report({ type, id, t, say, run, busy, kind }: { type: string; id: string } & Pick<ComponentProps<typeof DataForm>, "t" | "say" | "run" | "busy" | "kind">) {
    return (
      <Collapsible defaultIsOpen={false} trigger={say("举报", "Report")}>

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
      </Collapsible>
    );
}
