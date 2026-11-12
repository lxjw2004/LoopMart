import { RequestError } from "./errors.js";
export async function api(path: string, method = "GET", body?: unknown) {
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new RequestError(
      response.ok ? 500 : response.status,
      result?.error?.code || result?.code || "HTTP_ERROR",
      result?.error?.message || result?.message || "Request failed",
    );
  return result.nextCursor !== undefined ? result : (result.data ?? result);
}
export async function auth(path: string, body: unknown) {
  const response = await fetch("/api/auth/" + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new RequestError(
      response.ok ? 500 : response.status,
      result?.error?.code || result?.code || "HTTP_ERROR",
      result?.error?.message || result?.message || "Request failed",
    );
  return result;
}
export async function conversationMessages(path: string) {
  const rows: Record<string, any>[] = [];
  let cursor: string | null = null;
  const seen = new Set<string>();
  do {
    const page = await api(
      path + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
    );
    const batch = Array.isArray(page) ? page : page.data || [];
    for (const message of batch)
      if (!seen.has(message.id)) {
        rows.push(message);
        seen.add(message.id);
      }
    const next = page.nextCursor ?? null;
    if (next === cursor) break;
    cursor = next;
  } while (cursor);
  return rows;
}
