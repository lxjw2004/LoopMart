export function shouldSendOnEnter(key: string, shift: boolean, composing: boolean, keyCode: number) {
  return key === "Enter" && !shift && !composing && keyCode !== 229;
}
export function filterConversations<T extends {otherUser?: {name?: string}; lastMessage?: {text?: string}}>(rows: T[], query: string): T[] {
  const search = query.trim().toLocaleLowerCase();
  return rows.filter(row => `${row.otherUser?.name || ""} ${row.lastMessage?.text || ""}`.toLocaleLowerCase().includes(search));
}
