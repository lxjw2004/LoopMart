// Local deployment uses a single API process; no client-provided forwarding header is trusted.
const windows = new Map<string, {
    count: number;
    until: number;
}>();
export function allowContact(address: string) { const now = Date.now(); for (const [key, value] of windows)
    if (value.until <= now)
        windows.delete(key); let entry = windows.get(address); if (!entry) {
    if (windows.size >= 10000)
        return false;
    entry = { count: 0, until: now + 3600000 };
    windows.set(address, entry);
} return ++entry.count <= 10; }
