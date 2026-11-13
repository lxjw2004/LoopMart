"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Button} from '@astryxdesign/core/Button';
import {TextInput} from '@astryxdesign/core/TextInput';
import {TextArea} from '@astryxdesign/core/TextArea';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack} from '@astryxdesign/core/HStack';
import {VStack} from '@astryxdesign/core/VStack';
import {StackItem} from '@astryxdesign/core/Stack';
import {List,ListItem} from '@astryxdesign/core/List';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Banner} from '@astryxdesign/core/Banner';
import {ClickableCard} from '@astryxdesign/core/ClickableCard';
import {Card} from '@astryxdesign/core/Card';
import {ChatMessageList,ChatMessage,ChatMessageBubble,ChatMessageMetadata} from '@astryxdesign/core/Chat';
import {useLayout} from '../shared/design';
import {api} from '../api';
import {usd} from '../money';
import {filterConversations,shouldSendOnEnter} from '../chat-composer';
type Row=Record<string,any>;
type Reference={type:string;id:string;title?:string;origin?:string;destination?:string;priceCents?:number;feeCents?:number};
export function ReferenceCard({reference,english,onOpen}:{reference:Reference;english:boolean;onOpen?:(type:string,id:string)=>void}){
 const [record,setRecord]=useState<Row|null>(null),[unavailable,setUnavailable]=useState(false);
 const resource=reference.type==='item'||reference.type==='items'?'items':reference.type==='ride'||reference.type==='rides'?'rides':null;
 useEffect(()=>{let active=true;setRecord(null);setUnavailable(false);if(!resource){setUnavailable(true);return}api(`/${resource}/${encodeURIComponent(reference.id)}`).then(value=>{if(active)setRecord(value)}).catch(()=>{if(active)setUnavailable(true)});return()=>{active=false}},[resource,reference.id]);
 const title=record?.title||(record?.origin?`${record.origin} → ${record.destination}`:english?'Referenced listing':'引用内容');
 if(unavailable)return <Card className="reference-card reference-unavailable" variant="muted" maxWidth="calc(var(--spacing-12) * 6 + var(--spacing-8))"><VStack gap={2}>{(reference.title||reference.origin)&&<Text weight="semibold">{reference.title||`${reference.origin} → ${reference.destination||''}`}</Text>}{Number.isSafeInteger(reference.priceCents??reference.feeCents)&&<Text hasTabularNumbers>{usd((reference.priceCents??reference.feeCents)!)}</Text>}<Text type="supporting">{english?'Listing unavailable':'内容已不可用'}</Text></VStack></Card>;
 if(!record||!resource)return <Text className="reference-card" aria-busy="true" type="supporting">{english?'Loading listing…':'正在加载内容…'}</Text>;
 return <ClickableCard className="reference-card" maxWidth="calc(var(--spacing-12) * 6 + var(--spacing-8))" label={title} href={`/${resource}/${encodeURIComponent(reference.id)}`} onClick={event=>{if(onOpen&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey){event.preventDefault();onOpen(resource,reference.id)}}}><VStack gap={2}><Text weight="semibold">{title}</Text>{Number.isSafeInteger(record.priceCents??record.feeCents)&&<Text hasTabularNumbers>{usd(record.priceCents??record.feeCents)}</Text>}</VStack></ClickableCard>;
}
export default function MessagesPage({rows,detail,messages,me,english,onOpen,onBack,onSend,reference,onClearReference,onProfile,report,onReferenceOpen,connectionState,loading=false}:{loading?:boolean;connectionState?:'open'|'retrying';rows:Row[];detail:Row|null;messages:Row[];me:Row|null;english:boolean;onOpen:(row:Row)=>void;onBack:()=>void;onSend:(text:string)=>Promise<void>;reference?:Reference|null;onClearReference:()=>void;onProfile:(id:string)=>void;report?:ReactNode;onReferenceOpen?:(type:string,id:string)=>void}){
 const say=(zh:string,en:string)=>english?en:zh;
 const {mobile}=useLayout();
 const [search,setSearch]=useState(''),[drafts,setDrafts]=useState<Record<string,string>>({}),[sending,setSending]=useState(false),[error,setError]=useState(''),[newMessages,setNewMessages]=useState(false);
 const viewport=useRef<HTMLElement>(null),bottom=useRef(true),sendingLock=useRef(false),composing=useRef(false);
 useEffect(()=>{setDrafts({});setError('')},[me?.id]);
 const id=detail?.id,activeId=useRef(id);activeId.current=id;
 const text=id?drafts[id]||'':'';
 const scrollBottom=()=>{const node=viewport.current;if(node)node.scrollTop=node.scrollHeight;bottom.current=true;setNewMessages(false)};
 useEffect(()=>{setError('');bottom.current=true;setNewMessages(false);scrollBottom()},[id]);
 useEffect(()=>{if(bottom.current)scrollBottom();else setNewMessages(true)},[id,messages.length,messages.at(-1)?.id]);
 const send=async()=>{if(!id||!text.trim()||sendingLock.current)return;const conversation=id,value=text;sendingLock.current=true;setSending(true);setError('');try{await onSend(value);setDrafts(current=>current[conversation]===value?{...current,[conversation]:''}:current);if(activeId.current===conversation)scrollBottom()}catch{if(activeId.current===conversation)setError(say('发送失败，请重试','Could not send. Try again'))}finally{sendingLock.current=false;setSending(false)}};
 const conversations=<VStack gap={4} padding={3} className="conversation-list" as="section" height="100%" isScrollable aria-label={say('会话','Conversations')}>
  <Heading level={2}>{say('消息','Messages')}</Heading><TextInput type="search" label={say('搜索会话','Search conversations')} isLabelHidden placeholder={say('搜索会话','Search conversations')} value={search} onChange={setSearch}/>
  <List>{filterConversations(rows,search).map(row=><ListItem className="conversation-row" key={row.id} label={row.otherUser?.name||say('用户','User')} isSelected={row.id===id} onClick={()=>onOpen(row)} startContent={<Avatar name={row.otherUser?.name||say('用户','User')}/>} endContent={row.unreadCount>0?<Badge label={row.unreadCount}/>:undefined} description={<VStack gap={1}><Text type="supporting" maxLines={1}>{row.lastMessage?.text}</Text>{row.lastMessage?.createdAt&&<Text type="supporting"><time dateTime={row.lastMessage.createdAt}>{new Date(row.lastMessage.createdAt).toLocaleDateString(english?'en-US':'zh-CN')}</time></Text>}</VStack>}/>)}</List>
  {loading&&!rows.length&&<VStack gap={3} aria-busy="true">{[0,1,2].map(index=><Skeleton key={index} height="var(--spacing-12)" index={index}/>)}</VStack>}
  {!loading&&!filterConversations(rows,search).length&&<Text type="supporting">{say('暂无会话','No conversations')}</Text>}
 </VStack>;
 const chat=<VStack as="section" className="chat-panel" aria-label={say('聊天','Chat')} height="100%" minHeight={0} gap={0} style={{overflow:'hidden',background:'var(--color-background-surface)'}}>
  {connectionState==='retrying'&&<Banner status="warning" title={say('连接已断开，正在重连','Connection lost. Reconnecting')} role="status"/>}
  {detail?<><HStack as="header" className="chat-header" gap={3} padding={4} wrap="wrap" vAlign="center" style={{borderBottom:'var(--border-width) solid var(--color-border)'}}>{mobile&&<Button className="chat-back" variant="ghost" label={say('返回','Back')} onClick={onBack}/>}<Button variant="ghost" label={detail.otherUser?.name||say('用户','User')} onClick={()=>detail.otherUser?.id&&onProfile(detail.otherUser.id)}/>{report}</HStack>
   <StackItem size="fill" isScrollable className="messages" ref={viewport} style={{padding:mobile?'var(--spacing-4)':'var(--spacing-6)',background:'var(--lm-chat-background)'}} onScroll={()=>{const node=viewport.current;if(node){bottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<64;if(bottom.current)setNewMessages(false)}}}>
    <ChatMessageList align="top" density="balanced">{messages.map(message=><ChatMessage className={'message'+(message.senderId===me?.id?' message-own':'')} key={message.id} sender={message.senderId===me?.id?'user':'assistant'}><ChatMessageBubble name={message.senderId===me?.id?say('我','You'):detail.otherUser?.name} metadata={<ChatMessageMetadata timestamp={<time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(english?'en-US':'zh-CN')}</time>} footer={message.id===detail.readMessageId?say('已读至此','Read through here'):undefined}/>}><VStack gap={3}><Text as="p" color="inherit" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{message.text}</Text>{message.reference&&<ReferenceCard reference={message.reference} english={english} onOpen={onReferenceOpen}/>}</VStack></ChatMessageBubble></ChatMessage>)}</ChatMessageList>
   </StackItem>
   {newMessages&&<Button className="new-messages" label={say('新消息','New messages')} onClick={scrollBottom}/>}
   <VStack as="form" className="chat-composer" gap={3} padding={4} style={{borderTop:'var(--border-width) solid var(--color-border)',paddingBottom:mobile?'calc(var(--spacing-3) + env(safe-area-inset-bottom))':'var(--spacing-4)'}} onSubmit={event=>{event.preventDefault();void send()}}>
    {reference&&<HStack className="pending-reference" gap={2} vAlign="start"><StackItem size="fill"><ReferenceCard reference={reference} english={english} onOpen={onReferenceOpen}/></StackItem><Button variant="ghost" label={say('移除引用','Remove reference')} onClick={onClearReference}/></HStack>}
    {error&&<Banner status="error" title={error} role="alert"/>}
    <HStack gap={3} vAlign="end"><StackItem size="fill"><TextArea label={say('消息内容','Message')} isLabelHidden value={text} rows={2} width="100%" onChange={value=>setDrafts(current=>({...current,[id]:value}))} onCompositionStart={()=>{composing.current=true}} onCompositionEnd={()=>{composing.current=false}} onKeyDown={event=>{if(shouldSendOnEnter(event.key,event.shiftKey,composing.current||event.nativeEvent.isComposing,event.keyCode)){event.preventDefault();void send()}}}/></StackItem><StackItem><Button type="submit" variant="primary" label={say('发送','Send')} isDisabled={sending||!text.trim()} isLoading={sending}/></StackItem></HStack>
   </VStack>
  </>:<Text type="supporting">{say('选择会话','Select a conversation')}</Text>}
 </VStack>;
 const frameStyle={height:mobile&&detail?'100dvh':mobile?'calc(100dvh - var(--lm-chat-chrome-height) - var(--lm-mobile-nav-height))':'calc(100dvh - var(--lm-chat-chrome-height))',minHeight:mobile&&detail?0:'calc(var(--spacing-12) * 8)',overflow:'hidden',background:'var(--color-background-surface)',border:mobile&&detail?0:'var(--border-width) solid var(--color-border)',borderRadius:mobile&&detail?0:'var(--radius-container)'} as const;
 return mobile?<VStack className={'messages-layout'+(detail?' chat-has-detail':'')} gap={0} style={frameStyle}>{detail?chat:conversations}</VStack>:<HStack className={'messages-layout'+(detail?' chat-has-detail':'')} gap={0} vAlign="stretch" style={frameStyle}><StackItem style={{width:'var(--lm-chat-sidebar-width)',height:'100%',borderInlineEnd:'var(--border-width) solid var(--color-border)'}}>{conversations}</StackItem><StackItem size="fill">{chat}</StackItem></HStack>;
}
