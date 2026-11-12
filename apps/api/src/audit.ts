import type { PoolClient } from 'pg';
export async function administrativeSnapshot(client: PoolClient, path: string, id?: string) { const resource = path.split('/')[4]; const target = id ?? path.split('/')[5]; const tables: Record<string, string> = { items: 'entities', rides: 'entities', users: '"user"', reports: 'reports', settings: 'settings', conversations: 'conversations' }; const table = tables[resource]; if (!table)
    return null; if (resource === 'settings')
    return (await client.query('SELECT data FROM settings WHERE id=true')).rows[0]?.data ?? null; if (!target)
    return null; return (await client.query(`SELECT row_to_json(t) data FROM ${table} t WHERE id=$1`, [target])).rows[0]?.data ?? null; }
