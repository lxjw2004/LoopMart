import { events } from './events.js';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
// Row locks permit multiple workers; a failed delivery is durably retried with bounded backoff.
export async function processNotificationJobs(pool: Pool) {
    const client = await pool.connect();
    const pending: any[] = [];
    try {
        await client.query('BEGIN');
        const jobs = (await client.query('SELECT * FROM notification_jobs WHERE completed_at IS NULL AND next_attempt_at<=now() ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 20')).rows;
        for (const job of jobs) {
            try {
                await client.query('SAVEPOINT notification');
                const p = job.payload;
                const settings = (await client.query('SELECT data FROM settings WHERE id=true')).rows[0].data;
                const sender = settings.communityAdminUserId;
                if (!sender)
                    throw new Error('Community administrator not configured');
                const pair = [sender, p.userId].sort();
                if (pair[0] === pair[1])
                    throw new Error('Invalid notification recipient');
                const c = (await client.query('INSERT INTO conversations(id,user_a,user_b) VALUES($1,$2,$3) ON CONFLICT(user_a,user_b) DO UPDATE SET user_a=excluded.user_a RETURNING id', [randomUUID(), ...pair])).rows[0];
                await client.query('INSERT INTO messages(id,conversation_id,sender_id,client_id,text) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', [randomUUID(), c.id, sender, 'notification:' + job.id, p.text]);
                await client.query('UPDATE notification_jobs SET completed_at=now() WHERE id=$1', [job.id]);
                await client.query('RELEASE SAVEPOINT notification');
                pending.push({ users: pair, type: 'conversation', data: { id: c.id } });
            }
            catch {
                await client.query('ROLLBACK TO SAVEPOINT notification');
                await client.query("UPDATE notification_jobs SET last_error='Delivery failed; check community administrator configuration',attempts=attempts+1,next_attempt_at=now()+least(3600,power(2,least(attempts,12))) * interval '1 second' WHERE id=$1", [job.id]);
            }
        }
        await client.query('COMMIT');
        for (const event of pending)
            events.emit('change', event);
        return jobs.length;
    }
    catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
    finally {
        client.release();
    }
}
