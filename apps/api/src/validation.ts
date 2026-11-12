export class Failure extends Error {
    constructor(public status: number, message: string) { super(message); }
}
export const fail = (status: number, message: string): never => { throw new Failure(status, message); };
export const str = (v: unknown, max = 2000) => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : fail(400, 'Invalid text');
export function validate(kind: string, b: any) {
    if (kind === 'item') {
        str(b.title, 150);
        str(b.description, 10000);
        if (!['clothing', 'books', 'furniture', 'electronics', 'daily', 'other'].includes(b.category) || !['new', 'like_new', 'good', 'fair'].includes(b.condition) || !['pickup', 'meetup', 'delivery'].includes(b.deliveryMethod))
            fail(400, 'Invalid item');
    }
    else {
        str(b.origin, 200);
        str(b.destination, 200);
        if (typeof b.departureTime !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(b.departureTime) || !Number.isFinite(Date.parse(b.departureTime)))
            fail(400, 'Invalid departure');
        str(b.timeZone, 100);
        for (const field of ['feeDescription', 'notes'])
            if (b[field] !== undefined && (typeof b[field] !== 'string' || b[field].length > 10000))
                fail(400, 'Invalid ride text');
        try {
            new Intl.DateTimeFormat('en', { timeZone: b.timeZone }).format();
        }
        catch {
            fail(400, 'Invalid timezone');
        }
        if (!Number.isInteger(b.totalSeats) || b.totalSeats < 1 || b.totalSeats > 50 || !Number.isInteger(b.availableSeats) || b.availableSeats < 0 || b.availableSeats > b.totalSeats)
            fail(400, 'Invalid seats');
    }
    const n = kind === 'item' ? b.priceCents : b.feeCents;
    if (!Number.isSafeInteger(n) || n < 0)
        fail(400, 'Invalid amount');
}
export const entity = (r: any) => ({ ...r.data, id: r.id, communityId: r.community_id, publisherId: r.publisher_id, publisherName: r.publisher_name, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at });
