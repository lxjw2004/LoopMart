import test from 'node:test';
import assert from 'node:assert/strict';
import {api,auth,conversationMessages} from './api.js';
test('preserves pagination and credentials through same-origin requests',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async(input,options)=>{assert.equal(input,'/api/v1/items');assert.equal(options?.credentials,'include');return new Response(JSON.stringify({data:[{id:'one'}],nextCursor:'two'}),{status:200})};assert.deepEqual(await api('/items'),{data:[{id:'one'}],nextCursor:'two'})}finally{globalThis.fetch=original}
});
test('surfaces API and authentication failures without treating them as success',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:'Email verification required'}}),{status:403});await assert.rejects(api('/items','POST',{}),/Email verification required/);await assert.rejects(auth('sign-in/email',{}),/Email verification required/)}finally{globalThis.fetch=original}
});

test('chat reconnect catches up cursor pages without duplicating boundary messages',async()=>{
 const original=globalThis.fetch;let calls=0;try{globalThis.fetch=async(input)=>{calls++;if(calls===1)return new Response(JSON.stringify({data:[{id:'a'},{id:'b'}],nextCursor:'b'}));assert.equal(input,'/api/v1/conversations/c/messages?cursor=b');return new Response(JSON.stringify({data:[{id:'b'},{id:'c'}],nextCursor:null}))};assert.deepEqual((await conversationMessages('/conversations/c/messages')).map(x=>x.id),['a','b','c']);assert.equal(calls,2)}finally{globalThis.fetch=original}
});
