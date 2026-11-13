"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api } from "../api";
import { usd } from "../money";
import { filterConversations, shouldSendOnEnter } from "../chat-composer";
type Row = Record<string, any>;
type Reference = {type: string; id: string};
export function ReferenceCard({reference, english, onOpen}: {reference: Reference; english: boolean; onOpen?: (type: string,id: string) => void}) {
  const [record, setRecord] = useState<Row | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const resource = reference.type === "item" || reference.type === "items" ? "items" : reference.type === "ride" || reference.type === "rides" ? "rides" : null;
  useEffect(() => {
    let active = true;
    setRecord(null);setUnavailable(false);
    if (!resource) {setUnavailable(true); return;}
    api(`/${resource}/${encodeURIComponent(reference.id)}`).then(value => {if(active) setRecord(value);}).catch(() => {if(active) setUnavailable(true);});
    return () => {active = false;};
  },[resource,reference.id]);
  const title = record?.title || (record?.origin ? `${record.origin} → ${record.destination}` : english ? "Referenced listing" : "引用内容");
  if (unavailable) return <div className="reference-card reference-unavailable">{english ? "Listing unavailable" : "内容已不可用"}</div>;
  if (!record || !resource) return <div className="reference-card" aria-busy="true">{english ? "Loading listing…" : "正在加载内容…"}</div>;
  return <a className="reference-card" href={`/${resource}/${encodeURIComponent(reference.id)}`} onClick={event => {if(onOpen && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {event.preventDefault();onOpen(resource,reference.id);}}}><strong>{title}</strong>{Number.isSafeInteger(record.priceCents ?? record.feeCents) && <span>{usd(record.priceCents ?? record.feeCents)}</span>}</a>;
}
export default function MessagesPage({rows, detail, messages, me, english, onOpen, onBack, onSend, reference, onClearReference, onProfile, report, onReferenceOpen}: {
  rows: Row[]; detail: Row | null; messages: Row[]; me: Row | null; english: boolean;
  onOpen: (row: Row) => void; onBack: () => void; onSend: (text: string) => Promise<void>;
  reference?: Reference | null; onClearReference: () => void; onProfile: (id: string) => void; report?: ReactNode;
  onReferenceOpen?: (type: string,id: string) => void;
}) {
  const say = (zh: string,en: string) => english ? en : zh;
  const [search,setSearch] = useState("");
  const [drafts,setDrafts] = useState<Record<string,string>>({});
  const [sending,setSending] = useState(false);
  const [error,setError] = useState("");
  const [newMessages,setNewMessages] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const bottom = useRef(true);
  const sendingLock = useRef(false);
  const composing = useRef(false);
  useEffect(() => {setDrafts({});setError("");}, [me?.id]);
  const id = detail?.id;
  const activeId = useRef(id); activeId.current = id;
  const text = id ? drafts[id] || "" : "";
  const scrollBottom = () => {const node = viewport.current;if(node) node.scrollTop = node.scrollHeight;bottom.current = true;setNewMessages(false);};
  useEffect(() => {setError("");bottom.current = true;setNewMessages(false);scrollBottom();},[id]);
  useEffect(() => {if(bottom.current) {scrollBottom();} else setNewMessages(true);},[id,messages.length,messages.at(-1)?.id]);
  const send = async () => {
    if(!id || !text.trim() || sendingLock.current) return;
    const conversation = id;
    const value = text;
    sendingLock.current = true;setSending(true);setError("");
    try {
      await onSend(value);
      setDrafts(current => current[conversation] === value ? {...current,[conversation]:""} : current);
      if(activeId.current === conversation) {scrollBottom();}
    } catch {if(activeId.current === conversation) setError(say("发送失败，请重试","Could not send. Try again"));}
    finally {sendingLock.current = false;setSending(false);}
  };
  return <div className={`chat messages-layout${detail ? " chat-has-detail" : ""}`}>
    <section className="conversation-list" aria-label={say("会话","Conversations")}>
      <h1>{say("消息","Messages")}</h1>
      <input type="search" aria-label={say("搜索会话","Search conversations")} placeholder={say("搜索会话","Search conversations")} value={search} onChange={event => setSearch(event.target.value)} />
      {filterConversations(rows,search).map(row => <button key={row.id} className="conversation-row" aria-current={row.id === id ? "page" : undefined} onClick={() => onOpen(row)}><strong>{row.otherUser?.name || say("用户","User")}</strong>{row.unreadCount > 0 && <span className="badge">{row.unreadCount}</span>}<span>{row.lastMessage?.text}</span>{row.lastMessage?.createdAt && <time dateTime={row.lastMessage.createdAt}>{new Date(row.lastMessage.createdAt).toLocaleDateString(english ? "en-US" : "zh-CN")}</time>}</button>)}
      {!filterConversations(rows,search).length && <p>{say("暂无会话","No conversations")}</p>}
    </section>
    <section className="chat-panel panel" aria-label={say("聊天","Chat")}>
      {detail ? <>
        <header className="chat-header"><button className="chat-back" onClick={onBack}>{say("返回","Back")}</button><button onClick={() => detail.otherUser?.id && onProfile(detail.otherUser.id)}>{detail.otherUser?.name || say("用户","User")}</button>{report}</header>
        <div className="messages" ref={viewport} onScroll={() => {const node = viewport.current;if(node) {bottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64;if(bottom.current) setNewMessages(false);}}}>
          {messages.map(message => <article className={`message${message.senderId === me?.id ? " message-own" : ""}`} key={message.id}>
            <small>{message.senderId === me?.id ? say("我","You") : detail.otherUser?.name} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(english ? "en-US" : "zh-CN")}</time></small>
            <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{message.text}</p>
            {message.id === detail.readMessageId && <small>{say("已读至此","Read through here")}</small>}
            {message.reference && <ReferenceCard reference={message.reference} english={english} onOpen={onReferenceOpen} />}
          </article>)}
        </div>
        {newMessages && <button className="new-messages" onClick={scrollBottom}>{say("新消息","New messages")}</button>}
        <form className="chat-composer" onSubmit={event => {event.preventDefault();void send();}}>
          {reference && <div className="pending-reference"><ReferenceCard reference={reference} english={english} onOpen={onReferenceOpen}/><button type="button" aria-label={say("移除引用","Remove reference")} onClick={onClearReference}>×</button></div>}
          {error && <p role="alert">{error}</p>}
          <textarea aria-label={say("消息内容","Message")} value={text} onChange={event => {const value = event.target.value;setDrafts(current => ({...current,[id]:value}));}} onCompositionStart={() => {composing.current = true;}} onCompositionEnd={() => {composing.current = false;}} onKeyDown={event => {if(shouldSendOnEnter(event.key,event.shiftKey,composing.current || event.nativeEvent.isComposing,event.keyCode)) {event.preventDefault();void send();}}} />
          <button type="submit" disabled={sending || !text.trim()}>{say("发送","Send")}</button>
        </form>
      </> : <p>{say("选择会话","Select a conversation")}</p>}
    </section>
  </div>;
}
