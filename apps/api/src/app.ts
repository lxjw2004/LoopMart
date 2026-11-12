import { additionalFilters } from './filters.js';
import { administrativeSnapshot } from './audit.js';
import { allowContact } from './rate-limit.js';
import { events } from './events.js';
import { createAccount, replacePassword } from './admin-accounts.js';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import { requireMember } from '../../auth/src/member.js';
type Auth = Parameters<typeof requireMember>[0];
import { Failure, fail, str, validate, entity } from './validation.js';
function createHandler({ pool, auth, origin }: {
    pool: Pool;
    auth: Auth;
    origin?: string | string[];
}) {
    return async (req: IncomingMessage, res: ServerResponse) => {
        const publish = (event: any) => {
            const pending = (req as any).pendingEvents;
            if (pending)
                pending.push(event);
            else
                events.emit('change', event);
        };
        const send = (data: any, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify({ data })); };
        try {
            const url = new URL(req.url || '/', 'http://localhost');
            for (const [key, value] of [...url.searchParams])
                if (value === '')
                    url.searchParams.delete(key);
            const p = url.pathname.replace(/^\/api\/v1/, '').split('/').filter(Boolean);
            const method = req.method || 'GET';
            const write = !['GET', 'HEAD'].includes(method);
            if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].includes(method))
                fail(405, 'Method not allowed');
            if (write && req.headers.origin && origin && !(Array.isArray(origin) ? origin : [origin]).includes(req.headers.origin))
                fail(403, 'Origin rejected');
            let b: any = {};
            if (write) {
                let raw = '';
                for await (const part of req) {
                    raw += part;
                    if (raw.length > 100000)
                        fail(413, 'Body too large');
                }
                try {
                    b = raw ? JSON.parse(raw) : {};
                    if (!b || typeof b !== 'object' || Array.isArray(b))
                        fail(400, 'JSON object required');
                }
                catch {
                    fail(400, 'Invalid JSON');
                }
            }
            const headers = new Headers();
            for (const [k, v] of Object.entries(req.headers))
                if (typeof v === 'string')
                    headers.set(k, v);
            const session = await auth.api.getSession({ headers });
            let user: any = null;
            if (session) {
                user = (await pool.query('SELECT u.*,coalesce(m.role,\'member\') role,coalesce(m.community_id,\'purdue\') "communityId" FROM "user" u LEFT JOIN memberships m ON m.user_id=u.id WHERE u.id=$1', [session.user.id])).rows[0];
            }
            const member = async () => {
                if (!user)
                    fail(401, 'Authentication required');
                try {
                    await requireMember(auth, pool, headers);
                }
                catch {
                    fail(403, 'Verified active membership required');
                }
                await pool.query('INSERT INTO memberships(user_id) VALUES($1) ON CONFLICT DO NOTHING', [user.id]);
            };
            const admin = p[0] === 'admin';
            if (admin) {
                await member();
                if (user.role !== 'admin')
                    fail(403, 'Administrator required');
                if (write) {
                    str(b.reason, 2000);
                    (req as any).auditReason = b.reason;
                }
                p.shift();
            }
            else if (write && p[0] !== 'contact')
                await member();
            const id = p[1];
            if (p[0] === 'me' && !p[1]) {
                if (!user)
                    fail(401, 'Authentication required');
                if (method === 'PATCH') {
                    await pool.query('UPDATE "user" SET name=$1 WHERE id=$2', [str(b.name, 100), user.id]);
                    user.name = b.name;
                }
                return send({ id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified, role: user.role, banned: user.banned, communityId: user.communityId });
            }
            if (p[0] === 'profiles') {
                const r = (await pool.query('SELECT id,name FROM "user" WHERE id=$1', [id])).rows[0];
                if (!r)
                    fail(404, 'User not found');
                return send(r);
            }
            if (p[0] === 'public' && id === 'settings' || p[0] === 'settings') {
                const r = (await pool.query('SELECT data FROM settings WHERE id=true')).rows[0].data;
                if (write) {
                    if (!admin)
                        fail(403, 'Administrator required');
                    for (const key of ['allowAllEmailDomains', 'contactEnabled'])
                        if (b[key] !== undefined && typeof b[key] !== 'boolean')
                            fail(400, 'Invalid setting');
                    if (b.allowedEmailDomains !== undefined && (!Array.isArray(b.allowedEmailDomains) || b.allowedEmailDomains.some((d: any) => typeof d !== 'string' || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/.test(d))))
                        fail(400, 'Invalid domain policy');
                    for (const key of ['privacyPolicyZh', 'privacyPolicyEn'])
                        if (b[key] !== undefined && (typeof b[key] !== 'string' || b[key].length > 100000))
                            fail(400, 'Invalid privacy policy');
                    if (b.communityAdminUserId !== undefined && !(await pool.query("SELECT 1 FROM memberships WHERE user_id=$1 AND role='admin'", [b.communityAdminUserId])).rowCount)
                        fail(400, 'Community administrator must be an admin');
                    const allowed = ['allowedEmailDomains', 'allowAllEmailDomains', 'communityAdminUserId', 'privacyPolicyZh', 'privacyPolicyEn', 'contactEnabled'];
                    const patch = Object.fromEntries(Object.entries(b).filter(([k]) => allowed.includes(k)));
                    await pool.query('UPDATE settings SET data=data||$1::jsonb WHERE id=true', [JSON.stringify(patch)]);
                    return send({ ...r, ...patch });
                }
                return send(admin ? r : { communityAdminUserId: r.communityAdminUserId ?? null, privacyPolicyZh: r.privacyPolicyZh, privacyPolicyEn: r.privacyPolicyEn, contactEnabled: r.contactEnabled });
            }
            let resource = p[0];
            let mine = false;
            if (resource === 'me' && ['items', 'rides'].includes(id)) {
                if (method !== 'GET')
                    fail(405, 'Method not allowed');
                mine = true;
                resource = id;
                await member();
            }
            if (['items', 'rides'].includes(resource)) {
                if (!['GET', ...(id && !mine ? ['PATCH', 'DELETE'] : ['POST'])].includes(method))
                    fail(405, 'Method not allowed');
                const kind = resource === 'items' ? 'item' : 'ride';
                if (method === 'GET') {
                    if (id && !mine) {
                        const r = (await pool.query('SELECT e.*,u.name publisher_name FROM entities e JOIN "user" u ON u.id=e.publisher_id WHERE e.id=$1 AND e.kind=$2 AND (e.status=\'active\' OR $3::boolean OR e.publisher_id=$4)', [id, kind, admin, user?.id ?? null])).rows[0];
                        if (!r)
                            fail(404, 'Not found');
                        return send(entity(r));
                    }
                    const args: any[] = [kind, admin, mine ? user.id : null, url.searchParams.get('q') || '', url.searchParams.get('cursor') || null, url.searchParams.get('status'), url.searchParams.get('category'), url.searchParams.get('origin'), url.searchParams.get('destination'), url.searchParams.get('date')];
                    const extraEntity = additionalFilters(url.searchParams, resource, args, 'row_to_json(e)');
                    const filtered = (await pool.query(`SELECT e.*,u.name publisher_name FROM entities e JOIN "user" u ON u.id=e.publisher_id WHERE kind=$1 AND (status='active' OR $2 OR publisher_id=$3) AND ($3::text IS NULL OR publisher_id=$3) AND data::text ILIKE '%'||$4||'%' AND ($5::uuid IS NULL OR e.id>$5) AND ($6::text IS NULL OR status=$6) AND ($7::text IS NULL OR data->>'category'=$7) AND ($8::text IS NULL OR data->>'origin' ILIKE '%'||$8||'%') AND ($9::text IS NULL OR data->>'destination' ILIKE '%'||$9||'%') AND ($10::text IS NULL OR CASE WHEN kind='ride' THEN ((data->>'departureTime')::timestamptz AT TIME ZONE (data->>'timeZone'))::date::text=$10 ELSE false END) ${extraEntity} ORDER BY e.id LIMIT 51`, args)).rows;
                    res.writeHead(200, { 'content-type': 'application/json' });
                    return res.end(JSON.stringify({ data: filtered.slice(0, 50).map(entity), nextCursor: filtered.length > 50 ? filtered[49].id : null }));
                }
                let old: any;
                if (id) {
                    old = (await pool.query('SELECT * FROM entities WHERE id=$1 AND kind=$2', [id, kind])).rows[0];
                    if (!old)
                        fail(404, 'Not found');
                    if (!admin && old.publisher_id !== user.id)
                        fail(403, 'Owner required');
                    if (!admin && ['deactivated_violation', 'deleted'].includes(old.status))
                        fail(403, 'Moderated resource');
                }
                const status = method === 'DELETE' ? 'deleted' : b.status ?? old?.status ?? 'active';
                if (!['active', 'deactivated', 'reported', 'deactivated_violation', 'deleted'].includes(status) || !admin && !['active', 'deactivated', 'deleted'].includes(status))
                    fail(400, 'Invalid status');
                const fields = kind === 'item' ? ['title', 'description', 'category', 'priceCents', 'condition', 'deliveryMethod'] : ['origin', 'destination', 'departureTime', 'timeZone', 'feeCents', 'totalSeats', 'availableSeats', 'feeDescription', 'notes'];
                const data = { ...old?.data, ...Object.fromEntries(Object.entries(b).filter(([key]) => fields.includes(key))) };
                delete data.reason;
                delete data.status;
                if (method !== 'DELETE')
                    validate(kind, data);
                if (admin && b.publisherId !== undefined) {
                    str(b.publisherId, 200);
                    if (!(await pool.query('SELECT 1 FROM \"user\" WHERE id=$1', [b.publisherId])).rowCount)
                        fail(400, 'Publisher not found');
                }
                const result = await pool.query('INSERT INTO entities(id,kind,publisher_id,data,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET publisher_id=excluded.publisher_id,data=excluded.data,status=excluded.status,updated_at=now() RETURNING *', [id ?? randomUUID(), kind, admin && b.publisherId ? b.publisherId : old?.publisher_id ?? user.id, data, status]);
                return send(entity(result.rows[0]));
            }
            if (resource === 'favorites') {
                await member();
                if (!['GET', ...(id ? ['PUT', 'DELETE'] : [])].includes(method))
                    fail(405, 'Method not allowed');
                if (method === 'GET')
                    return send((await pool.query('SELECT e.* FROM favorites f JOIN entities e ON e.id=f.item_id WHERE f.user_id=$1 AND e.status=\'active\'', [user.id])).rows.map(entity));
                if (method === 'DELETE')
                    await pool.query('DELETE FROM favorites WHERE user_id=$1 AND item_id=$2', [user.id, id]);
                else {
                    if (!(await pool.query('SELECT 1 FROM entities WHERE id=$1 AND kind=\'item\' AND status=\'active\'', [id])).rowCount)
                        fail(404, 'Item not found');
                    await pool.query('INSERT INTO favorites VALUES($1,$2) ON CONFLICT DO NOTHING', [user.id, id]);
                }
                return send({ ok: true });
            }
            if (resource === 'conversations' || resource === 'community-messages') {
                await member();
                if (resource === 'community-messages' && !admin)
                    fail(403, 'Administrator required');
                if (id && !['messages', 'read'].includes(p[2] ?? '') && !(admin && method === 'GET' && !p[2]))
                    fail(404, 'Not found');
                if (method === 'POST' && !id) {
                    const other = str(b.otherUserId ?? b.userId, 200);
                    if (other === user.id)
                        fail(400, 'Cannot message yourself');
                    if (!(await pool.query('SELECT 1 FROM \"user\" WHERE id=$1 AND (\"emailVerified\"=true AND banned=false OR $2)', [other, admin])).rowCount)
                        fail(404, 'Recipient not found');
                    const pair = [user.id, other].sort();
                    const c = (await pool.query('INSERT INTO conversations(id,user_a,user_b) VALUES($1,$2,$3) ON CONFLICT(user_a,user_b) DO UPDATE SET user_a=excluded.user_a RETURNING *', [randomUUID(), ...pair])).rows[0];
                    if (resource === 'community-messages') {
                        const text = str(b.text, 10000);
                        await pool.query('INSERT INTO messages(id,conversation_id,sender_id,client_id,text) VALUES($1,$2,$3,$4,$5)', [randomUUID(), c.id, user.id, randomUUID(), text]);
                    }
                    publish({ users: pair, type: 'conversation', data: { id: c.id } });
                    return send({ id: c.id });
                }
                if (!id) {
                    const args: unknown[] = [user.id, admin, url.searchParams.get('q') ?? '', url.searchParams.get('cursor')];
                    const extra = additionalFilters(url.searchParams, resource, args);
                    const rows = (await pool.query(`SELECT * FROM (${'SELECT c.id,json_build_object(\'id\',u.id,\'name\',u.name) "otherUser",(SELECT row_to_json(m) FROM (SELECT id,text,created_at "createdAt",sender_id "senderId" FROM messages WHERE conversation_id=c.id ORDER BY seq DESC LIMIT 1)m) "lastMessage",(SELECT count(*)::int FROM messages m WHERE m.conversation_id=c.id AND m.sender_id<>$1 AND m.seq>coalesce(r.seq,0)) "unreadCount",(SELECT id FROM messages WHERE seq=r.seq) "readMessageId" FROM conversations c JOIN "user" u ON u.id=CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END LEFT JOIN reads r ON r.conversation_id=c.id AND r.user_id=$1 WHERE $2 OR c.user_a=$1 OR c.user_b=$1'}) t WHERE (row_to_json(t)::text ILIKE '%'||$3||'%') AND ($4::uuid IS NULL OR id>$4) ${extra} ORDER BY id LIMIT 101`, args)).rows;
                    res.writeHead(200, { 'content-type': 'application/json' });
                    return res.end(JSON.stringify({ data: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99].id : null }));
                }
                const c = (await pool.query('SELECT * FROM conversations WHERE id=$1', [id])).rows[0];
                if (!c)
                    fail(404, 'Conversation not found');
                if (!admin && ![c.user_a, c.user_b].includes(user.id))
                    fail(403, 'Participant required');
                if (write && ![c.user_a, c.user_b].includes(user.id))
                    fail(403, 'Participant required');
                if (p[2] === 'read') {
                    if (method !== 'PUT')
                        fail(405, 'Method not allowed');
                    const m = (await pool.query('SELECT seq FROM messages WHERE id=$1 AND conversation_id=$2', [b.messageId, id])).rows[0];
                    if (!m)
                        fail(400, 'Invalid message');
                    await pool.query('INSERT INTO reads VALUES($1,$2,$3) ON CONFLICT(conversation_id,user_id) DO UPDATE SET seq=greatest(reads.seq,excluded.seq)', [id, user.id, m.seq]);
                    publish({ users: [c.user_a, c.user_b], type: 'read', data: { conversationId: id, userId: user.id, messageId: b.messageId } });
                    return send({ ok: true });
                }
                const map = (m: any) => ({ id: m.id, conversationId: m.conversation_id, senderId: m.sender_id, text: m.text, reference: m.reference, createdAt: m.created_at });
                if (method === 'GET') {
                    const cursor = url.searchParams.get('cursor');
                    const rows = (await pool.query('SELECT * FROM messages WHERE conversation_id=$1 AND ($2::uuid IS NULL OR seq>(SELECT seq FROM messages WHERE id=$2 AND conversation_id=$1)) ORDER BY seq LIMIT 101', [id, cursor])).rows;
                    res.writeHead(200, { 'content-type': 'application/json' });
                    return res.end(JSON.stringify({ data: rows.slice(0, 100).map(map), nextCursor: rows.length > 100 ? rows[99].id : null }));
                }
                if (method !== 'POST' || p[2] !== 'messages')
                    fail(405, 'Method not allowed');
                let reference = null;
                if (b.reference) {
                    if (!['item', 'ride'].includes(b.reference.type))
                        fail(400, 'Invalid reference');
                    const e = (await pool.query('SELECT * FROM entities WHERE id=$1 AND kind=$2 AND (status=\'active\' OR publisher_id=$3 OR $4)', [b.reference.id, b.reference.type, user.id, admin])).rows[0];
                    if (!e)
                        fail(404, 'Reference not found');
                    reference = { type: e.kind, id: e.id, ...e.data };
                }
                const m = (await pool.query('INSERT INTO messages(id,conversation_id,sender_id,client_id,text,reference) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(conversation_id,sender_id,client_id) DO UPDATE SET client_id=excluded.client_id RETURNING *', [randomUUID(), id, user.id, str(b.clientId, 200), str(b.text, 10000), reference])).rows[0];
                if (m.text !== b.text.trim() || (m.reference?.id ?? null) !== (b.reference?.id ?? null) || (m.reference?.type ?? null) !== (b.reference?.type ?? null))
                    fail(409, 'Client message id already used with different content');
                publish({ users: [c.user_a, c.user_b], type: 'message', data: map(m) });
                return send(map(m));
            }
            if (resource === 'contact' && method === 'POST' && !admin) {
                if (!allowContact(req.socket.remoteAddress ?? 'unknown'))
                    fail(429, 'Too many contact requests');
                const settings = (await pool.query('SELECT data FROM settings')).rows[0].data;
                if (!settings.contactEnabled)
                    fail(403, 'Contact disabled');
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email))
                    fail(400, 'Invalid email');
                const r = (await pool.query('INSERT INTO contact(id,email,subject,message) VALUES($1,$2,$3,$4) RETURNING *', [randomUUID(), b.email, str(b.subject, 200), str(b.message, 10000)])).rows[0];
                return send(r, 201);
            }
            if (resource === 'reports' && method === 'POST') {
                if (!['item', 'ride', 'user', 'conversation'].includes(b.targetType))
                    fail(400, 'Invalid target');
                if (b.targetType === 'conversation' && !(await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND (user_a=$2 OR user_b=$2)', [b.targetId, user.id])).rowCount)
                    fail(404, 'Target not found');
                if (['item', 'ride'].includes(b.targetType) && !(await pool.query("SELECT 1 FROM entities WHERE id=$1 AND kind=$2 AND (status='active' OR publisher_id=$3)", [b.targetId, b.targetType, user.id])).rowCount)
                    fail(404, 'Target not found');
                const table = b.targetType === 'user' ? '"user"' : b.targetType === 'conversation' ? 'conversations' : 'entities';
                if (!(await pool.query(`SELECT id FROM ${table} WHERE id=$1`, [str(b.targetId, 200)])).rowCount)
                    fail(404, 'Target not found');
                return send((await pool.query('INSERT INTO reports(id,reporter_id,target_type,target_id,reason,details) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [randomUUID(), user.id, b.targetType, b.targetId, str(b.reason, 2000), b.details ?? ''])).rows[0], 201);
            }
            if (admin && resource === 'overview') {
                return send((await pool.query('SELECT (SELECT count(*) FROM "user") users,(SELECT count(*) FROM entities WHERE kind=\'item\') items,(SELECT count(*) FROM entities WHERE kind=\'ride\') rides,(SELECT count(*) FROM reports WHERE status=\'pending\') reports')).rows[0]);
            }
            if (admin && ['users', 'reports', 'audit', 'contact'].includes(resource)) {
                const table = resource === 'users' ? '"user"' : resource;
                const enrichUsers = async (rows: any[]) => {
                    if (resource !== 'users')
                        return rows;
                    const memberships = (await pool.query('SELECT user_id,role,community_id FROM memberships WHERE user_id=ANY($1::text[])', [rows.map(r => r.id)])).rows;
                    return rows.map(r => { const m = memberships.find(m => m.user_id === r.id); return { ...r, role: m?.role ?? 'member', communityId: m?.community_id ?? 'purdue' }; });
                };
                if (method === 'GET') {
                    if (id) {
                        const row = (await pool.query(`SELECT * FROM ${table} WHERE id=$1`, [id])).rows[0];
                        if (!row)
                            fail(404, 'Not found');
                        return send((await enrichUsers([row]))[0]);
                    }
                    const cursor = url.searchParams.get('cursor');
                    const filterArgs: unknown[] = [cursor, url.searchParams.get('q') ?? '', url.searchParams.get('status'), resource === 'users'];
                    const extra = additionalFilters(url.searchParams, resource, filterArgs);
                    const rows = (await pool.query(`SELECT t.* FROM ${table} t WHERE ($1::text IS NULL OR id::text>$1) AND row_to_json(t)::text ILIKE '%'||$2||'%' AND ($3::text IS NULL OR row_to_json(t)->>'status'=$3 OR ($4::boolean AND CASE WHEN coalesce(row_to_json(t)->>'banned','false')='true' THEN 'banned' ELSE 'active' END=$3)) ${extra} ORDER BY id LIMIT 101`, filterArgs)).rows;
                    res.writeHead(200, { 'content-type': 'application/json' });
                    return res.end(JSON.stringify({ data: await enrichUsers(rows.slice(0, 100)), nextCursor: rows.length > 100 ? rows[99].id : null }));
                }
                if (resource === 'contact' && method === 'PATCH') {
                    if (!['open', 'resolved'].includes(b.status) || typeof b.note !== 'string' || b.note.length > 10000)
                        fail(400, 'Invalid contact handling');
                    const result = await pool.query('UPDATE contact SET status=$1,note=$2,updated_at=now() WHERE id=$3 RETURNING *', [b.status, b.note, id]);
                    if (!result.rowCount)
                        fail(404, 'Contact not found');
                    return send(result.rows[0]);
                }
                if (resource === 'reports' && method === 'PATCH') {
                    if (!['reviewed', 'dismissed', 'violation_confirmed'].includes(b.status))
                        fail(400, 'Invalid report status');
                    await pool.query('UPDATE reports SET status=$1,note=$2 WHERE id=$3', [b.status, b.note ?? '', id]);
                    const report = (await pool.query('SELECT * FROM reports WHERE id=$1', [id])).rows[0];
                    if (!report)
                        fail(404, 'Report not found');
                    if (b.status === 'violation_confirmed') {
                        let recipient = report.target_id;
                        if (['item', 'ride'].includes(report.target_type)) {
                            const target = (await pool.query("UPDATE entities SET status='deactivated_violation',updated_at=now() WHERE id=$1 AND kind=$2 RETURNING publisher_id", [report.target_id, report.target_type])).rows[0];
                            recipient = target?.publisher_id;
                        }
                        if (recipient && report.target_type !== 'conversation')
                            await pool.query('INSERT INTO notification_jobs(id,payload) VALUES($1,$2)', [randomUUID(), { userId: recipient, text: 'A moderation decision was made concerning your content. ' + (b.note ?? '') }]);
                    }
                    return send({ ok: true });
                }
                if (resource === 'users' && method === 'POST') {
                    if (!id)
                        return send(await createAccount(pool, b), 201);
                    if (p[2] === 'password')
                        return send(await replacePassword(pool, id, b.password));
                    if (p[2] === 'reset-password') {
                        const target = (await pool.query('SELECT email FROM \"user\" WHERE id=$1', [id])).rows[0];
                        if (!target)
                            fail(404, 'User not found');
                        const api = auth.api as any;
                        if (!api.requestPasswordReset)
                            fail(503, 'Password reset unavailable');
                        await api.requestPasswordReset({ body: { email: target.email } });
                        return send({ ok: true });
                    }
                }
                if (resource === 'users' && method === 'PATCH') {
                    if (!id || !(await pool.query('SELECT 1 FROM \"user\" WHERE id=$1', [id])).rowCount)
                        fail(404, 'User not found');
                    if (b.name !== undefined)
                        await pool.query('UPDATE "user" SET name=$1 WHERE id=$2', [str(b.name, 100), id]);
                    if (b.banned !== undefined) {
                        if (typeof b.banned !== 'boolean')
                            fail(400, 'Invalid ban');
                        await pool.query('UPDATE "user" SET banned=$1 WHERE id=$2', [b.banned, id]);
                        await pool.query('DELETE FROM session WHERE "userId"=$1', [id]);
                    }
                    if (b.role !== undefined) {
                        if (!['admin', 'member'].includes(b.role))
                            fail(400, 'Invalid role');
                        await pool.query('INSERT INTO memberships(user_id,role) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET role=excluded.role', [id, b.role]);
                    }
                    return send({ ok: true });
                }
            }
            if (resource === 'events') {
                await member();
                res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', 'connection': 'keep-alive' });
                res.write(': connected\n\n');
                const listener = (event: any) => {
                    if (event.users.includes(user.id))
                        res.write('event: ' + event.type + '\ndata: ' + JSON.stringify(event.data) + '\n\n');
                };
                events.on('change', listener);
                const timer = setInterval(() => { void member().then(() => res.write(': heartbeat\n\n')).catch(() => res.end()); }, 20000);
                req.on('close', () => { clearInterval(timer); events.off('change', listener); });
                return;
            }
            fail(404, 'Not found');
        }
        catch (e) {
            const err = e as any;
            const status = typeof err.status === 'number' ? err.status : ['22P02', '22007', '22008', '23503', '23505', '23514'].includes(err.code) ? 400 : 500;
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { requestId: res.getHeader('x-request-id'), code: String(status), message: status === 500 ? 'Internal server error' : typeof err.code === 'string' && /^[0-9A-Z]{5}$/.test(err.code) ? 'Invalid request data' : err.message } }));
        }
    };
}
// Administrative mutations and their audit record share a single database transaction.
export function createApp(options: {
    pool: Pool;
    auth: Auth;
    origin?: string | string[];
}) {
    return async (req: IncomingMessage, res: ServerResponse) => {
        req.url = req.url ?? '/';
        const requestId = randomUUID();
        res.setHeader('x-request-id', requestId);
        const rawPath = (req.url ?? '/').split('?')[0];
        const canonicalPath = new URL(req.url ?? '/', 'http://localhost').pathname;
        if (rawPath !== canonicalPath || canonicalPath.includes('//') || !/^\/api\/v1(?:\/|$)/.test(canonicalPath)) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { code: '400', message: 'Invalid API path', requestId } }));
            return;
        }
        if (!canonicalPath.startsWith('/api/v1/admin/') || ['GET', 'HEAD'].includes(req.method ?? 'GET'))
            return createHandler(options)(req, res);
        let client;
        try {
            client = await options.pool.connect();
        }
        catch {
            res.writeHead(503, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ error: { requestId: res.getHeader('x-request-id'), code: '503', message: 'Database unavailable' } }));
            return;
        }
        const originalEnd = res.end.bind(res);
        const originalWriteHead = res.writeHead.bind(res);
        let output: any;
        let responseStatus = 200;
        res.writeHead = ((status: number, ..._args: any[]) => { responseStatus = status; return res; }) as any;
        res.end = ((chunk: any) => { output = chunk; return res; }) as any;
        try {
            await client.query('BEGIN');
            (req as any).pendingEvents = [];
            const before = await administrativeSnapshot(client, req.url);
            await createHandler({ ...options, pool: client as unknown as Pool })(req, res);
            if (responseStatus < 400) {
                const headers = new Headers();
                if (req.headers.cookie)
                    headers.set('cookie', req.headers.cookie);
                const session = await options.auth.api.getSession({ headers });
                if (!session)
                    throw new Error('Session expired');
                const createdId = (() => {
                    try {
                        return JSON.parse(String(output)).data?.id;
                    }
                    catch {
                        return undefined;
                    }
                })();
                const after = await administrativeSnapshot(client, req.url, createdId);
                await client.query('INSERT INTO audit(id,actor_id,action,target_id,reason,before_data,after_data,request_metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), session.user.id, req.method + ' ' + req.url, req.url.split('/')[5] ?? createdId ?? null, (req as any).auditReason, before, after, { method: req.method, path: req.url, remoteAddress: req.socket.remoteAddress }]);
                await client.query('COMMIT');
                for (const event of (req as any).pendingEvents)
                    events.emit('change', event);
            }
            else
                await client.query('ROLLBACK');
        }
        catch {
            await client.query('ROLLBACK');
            responseStatus = 500;
            output = JSON.stringify({ error: { requestId: res.getHeader('x-request-id'), code: '500', message: 'Administrative transaction failed' } });
        }
        finally {
            client.release();
            res.writeHead = originalWriteHead;
            res.end = originalEnd;
            res.writeHead(responseStatus, { 'content-type': 'application/json' });
            res.end(output);
        }
    };
}
