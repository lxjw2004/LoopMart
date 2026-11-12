import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../apps/auth/src/auth.js';
import { loadConfig } from '../apps/auth/src/config.js';
test('PostgreSQL registration verifies email and blocks unverified login', {skip: !process.env.TEST_DATABASE_URL}, async () => {
 const pool = new Pool({connectionString:process.env.TEST_DATABASE_URL});
 const created: string[] = [];
 const inbox: {to:string;text:string}[] = [];
 const config = loadConfig({DATABASE_URL:process.env.TEST_DATABASE_URL,BETTER_AUTH_SECRET:'integration-test-secret-at-least-32-characters',BETTER_AUTH_URL:'http://localhost:3001'});
 const auth=createAuth(config,pool,async message=>{inbox.push(message)});
 try {
  await (await getMigrations(auth.options)).runMigrations();
  await pool.query('CREATE TABLE IF NOT EXISTS settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),data jsonb NOT NULL)');
  let email=`integration-${Date.now()}@purdue.edu`;
  created.push(email);
  const request=async(path:string,body?:unknown)=>auth.handler(new Request(`http://localhost:3001/api/auth/${path}`,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined}));
  const signup=await request('sign-up/email',{name:'Integration',email,password:'Strong-password-123!'});
  assert.equal(signup.status,200);assert.equal(inbox.length,1);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,403);
  assert.equal((await auth.handler(new Request(inbox[0]!.text))).status,302);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,200);
  const signed=await request('sign-in/email',{email,password:'Strong-password-123!'});
  const cookie=signed.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  assert.ok(cookie);
  const bad=await request('sign-up/email',{name:'Blocked',email:`blocked-${Date.now()}@example.com`,password:'Strong-password-123!'});
  assert.equal(bad.status,200); // Better Auth intentionally hides rejected registration.
  assert.equal((await pool.query('SELECT 1 FROM "user" WHERE email LIKE $1',[`blocked-%@example.com`])).rowCount,0);
  await pool.query('UPDATE "user" SET banned=true WHERE email=$1',[email]);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,403);
  await pool.query('UPDATE "user" SET banned=false WHERE email=$1',[email]);
  const change=await auth.handler(new Request('http://localhost:3001/api/auth/change-email',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3001',cookie},body:JSON.stringify({newEmail:`changed-${Date.now()}@example.com`})}));
  assert.equal(change.status,403);
  const newEmail=`integration-changed-${Date.now()}@purdue.edu`;
  created.push(newEmail);
  const changed=await auth.handler(new Request('http://localhost:3001/api/auth/change-email',{method:'POST',headers:{'content-type':'application/json',origin:'http://localhost:3001',cookie},body:JSON.stringify({newEmail})}));
  assert.equal(changed.status,200);
  assert.equal((await pool.query('SELECT 1 FROM "user" WHERE email=$1',[newEmail])).rowCount,0);
  assert.equal(inbox.at(-1)!.to,newEmail);
  assert.equal((await auth.handler(new Request(inbox.at(-1)!.text))).status,302);
  email=newEmail;
  assert.equal((await pool.query('SELECT "emailVerified" FROM "user" WHERE email=$1',[email])).rows[0].emailVerified,true);
  await request('request-password-reset' ,{email,redirectTo:'http://localhost:3001/reset'});
  const resetURL=new URL(inbox.at(-1)!.text);
  const token=resetURL.pathname.split('/').at(-1)!;
  assert.equal((await request('reset-password',{token,newPassword:'New-strong-password-456!'})).status,200);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,401);
  const oldSession=await auth.handler(new Request('http://localhost:3001/api/auth/get-session',{headers:{cookie}}));
  assert.equal(await oldSession.json(),null);
  const fresh=await request('sign-in/email',{email,password:'New-strong-password-456!'});
  assert.equal(fresh.status,200);
  const freshCookie=fresh.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
  assert.equal((await auth.handler(new Request('http://localhost:3001/api/auth/sign-out',{method:'POST',headers:{origin:'http://localhost:3001',cookie:freshCookie}}))).status,200);
  assert.equal(await (await auth.handler(new Request('http://localhost:3001/api/auth/get-session',{headers:{origin:'http://localhost:3001',cookie:freshCookie}}))).json(),null);
  const noMail=createAuth(config,pool);
  for(const candidate of [email,'missing@purdue.edu']) {
   const response=await noMail.handler(new Request('http://localhost:3001/api/auth/request-password-reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:candidate})}));
   assert.equal(response.status,503);
  }
  await pool.query('DELETE FROM "user" WHERE email=$1',[email]);
 } finally {await pool.query('DELETE FROM "user" WHERE email=ANY($1::text[])',[created]);await pool.end()}
});

test('managed provisioning rolls back with failed audit and password changes revoke sessions', {skip: !process.env.TEST_DATABASE_URL}, async () => {
 const {createManagedAccount,setManagedPassword}=await import('../apps/auth/src/admin.js');
 const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
 const client=await pool.connect();
 const email=`managed-${Date.now()}@example.com`;
 try {
  await client.query('BEGIN');
  const user=await createManagedAccount(client,{email,name:'Managed',password:'Managed-password-123!'});
  assert.equal((await client.query('SELECT 1 FROM "user" WHERE id=$1',[user.id])).rowCount,1);
  await assert.rejects(client.query("INSERT INTO audit(id,actor_id,action,reason) VALUES('not-a-uuid','missing','test','failure')"));
  await client.query('ROLLBACK');
  assert.equal((await pool.query('SELECT 1 FROM "user" WHERE email=$1',[email])).rowCount,0);
  await client.query('BEGIN');
  const active=await createManagedAccount(client,{email,name:'Managed',password:'Managed-password-123!'});
  await client.query(`INSERT INTO session(id,token,"userId","expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,now()+interval '1 day',now(),now())`,[`managed-session-${Date.now()}`,`managed-token-${Date.now()}`,active.id]);
  await setManagedPassword(client,active.id,'Replacement-password-456!');
  assert.equal((await client.query('SELECT 1 FROM session WHERE "userId"=$1',[active.id])).rowCount,0);
  const {verifyPassword}=await import('better-auth/crypto');
  const credential=(await client.query('SELECT password FROM account WHERE "userId"=$1',[active.id])).rows[0];
  assert.equal(await verifyPassword({hash:credential.password,password:'Replacement-password-456!'}),true);
  await client.query('ROLLBACK');
 } finally {await client.query('ROLLBACK');client.release();await pool.end()}
});
