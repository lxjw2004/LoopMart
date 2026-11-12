export const WRITE_LIMITS = { message: 60, publish: 10, report: 10, edit: 30 } as const;
export function createWriteLimiter(clock: () => number = Date.now, maxEntries = 10000) { const windows = new Map<string, {
    count: number;
    until: number;
}>(); return (actor: string, action: keyof typeof WRITE_LIMITS) => { const now = clock(); for (const [key, value] of windows)
    if (value.until <= now)
        windows.delete(key); const key = action + ':' + actor; let entry = windows.get(key); if (!entry) {
    if (windows.size >= maxEntries)
        return false;
    entry = { count: 0, until: now + 60000 };
    windows.set(key, entry);
} return ++entry.count <= WRITE_LIMITS[action]; }; }
export const allowWrite = createWriteLimiter();
const contactWindows = new Map<string, {
    count: number;
    until: number;
}>();
export function allowContact(address: string) { const now = Date.now(); for (const [key, value] of contactWindows)
    if (value.until <= now)
        contactWindows.delete(key); let entry = contactWindows.get(address); if (!entry) {
    if (contactWindows.size >= 10000)
        return false;
    entry = { count: 0, until: now + 3600000 };
    contactWindows.set(address, entry);
} return ++entry.count <= 10; }
