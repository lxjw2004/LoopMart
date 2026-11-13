export function shouldSendOnEnter(key: string, shift: boolean, composing: boolean, keyCode: number) {
  return key === "Enter" && !shift && !composing && keyCode !== 229;
}
export function filterConversations<T extends {otherUser?: {name?: string}; lastMessage?: {text?: string;createdAt?: string}}>(rows: T[], query: string): T[] {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(row => `${row.otherUser?.name || ""} ${row.lastMessage?.text || ""}`.toLocaleLowerCase().includes(search)).sort((a,b)=>(Date.parse(b.lastMessage?.createdAt||"")||0)-(Date.parse(a.lastMessage?.createdAt||"")||0));
}
