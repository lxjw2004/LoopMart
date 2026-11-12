import test from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { createAuth } from '../apps/auth/src/auth.js';
import { loadConfig } from '../apps/auth/src/config.js';
test('PostgreSQL registration verifies email and blocks unverified login', {skip: !process.env.TEST_DATABASE_URL}, async () => {
 const pool = new Pool({connectionString:process.env.TEST_DATABASE_URL});
 const inbox: {to:string;text:string}[] = [];
 const config = loadConfig({DATABASE_URL:process.env.TEST_DATABASE_URL,BETTER_AUTH_SECRET:'integration-test-secret-at-least-32-characters',BETTER_AUTH_URL:'http://localhost:3001'});
 const auth=createAuth(config,pool,async message=>{inbox.push(message)});
 try {
  await (await getMigrations(auth.options)).runMigrations();
  await pool.query('CREATE TABLE IF NOT EXISTS settings(id boolean PRIMARY KEY DEFAULT true CHECK(id),data jsonb NOT NULL)');
  const email=`integration-${Date.now()}@purdue.edu`;
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
  assert.equal(bad.status,403);
  await pool.query('UPDATE "user" SET banned=true WHERE email=$1',[email]);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,403);
  await pool.query('UPDATE "user" SET banned=false WHERE email=$1',[email]);
  const change=await auth.handler(new Request('http://localhost:3001/api/auth/change-email',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({newEmail:`changed-${Date.now()}@example.com`})}));
  assert.equal(change.status,403);
  await request('request-password-reset',{email,redirectTo:'http://localhost:3001/reset'});
  const resetURL=new URL(inbox.at(-1)!.text);
  const token=resetURL.pathname.split('/').at(-1)!;
  assert.equal((await request('reset-password',{token,newPassword:'New-strong-password-456!'})).status,200);
  assert.equal((await request('sign-in/email',{email,password:'Strong-password-123!'})).status,401);
  assert.equal((await request('sign-in/email',{email,password:'New-strong-password-456!'})).status,200);
  const noMail=createAuth(config,pool);
  for(const candidate of [email,'missing@purdue.edu']) {
   const response=await noMail.handler(new Request('http://localhost:3001/api/auth/request-password-reset',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:candidate})}));
   assert.equal(response.status,503);
  }
  await pool.query('DELETE FROM "user" WHERE email=$1',[email]);
 } finally {await pool.end()}
});
