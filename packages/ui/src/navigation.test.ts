import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,legacyTarget,routeHref,safeReturnTo,accountTabFromUrl,accountLocationKey} from './navigation.js';
test('URLs preserve detail, editing and query while retaining legacy entry points',()=>{
 const r=parseRoute(new URL('http://localhost/items/a/edit?q=book'),false);
 assert.equal(r.page,'items'); assert.equal(r.id,'a'); assert.equal(r.edit,true); assert.equal(r.query.get('q'),'book');
 assert.equal(legacyTarget(new URL('http://localhost/#conversations'),false),'/messages');
 assert.equal(parseRoute(new URL('http://localhost/messages/c1'),false).page,'conversations');
 assert.equal(parseRoute(new URL('http://localhost/account/listings?kind=rides'),false).page,'profile');
 assert.equal(routeHref('profile',false),'/account');
 assert.equal(parseRoute(new URL('http://localhost/unknown'),false).page,'not-found');
});
test('auth callbacks and admin aliases survive normalization without unsafe return URLs',()=>{
 assert.equal(parseRoute(new URL('http://localhost/?token=secret'),false).page,'login');
 assert.equal(legacyTarget(new URL('http://localhost/?token=secret'),false),null);
 assert.equal(parseRoute(new URL('http://localhost/auth-settings'),true).page,'settings');
 assert.equal(routeHref('users',true,'u'),'/admin/users/u');
 assert.equal(safeReturnTo('//evil.com'),''); assert.equal(safeReturnTo('/\\evil.com'),'');
 assert.equal(safeReturnTo('/items?q=book'),'/items?q=book');
});
test('account panels preserve legacy entry defaults and reject unknown panel names',()=>{
 assert.equal(accountTabFromUrl(new URL('http://localhost/account')),'profile');
 assert.equal(accountTabFromUrl(new URL('http://localhost/account/listings?kind=rides')),'posts');
 for(const tab of ['profile','posts','favorites','change-password']){
  assert.equal(accountTabFromUrl(new URL('http://localhost/account/listings?tab='+tab)),tab);
 }
 assert.equal(accountTabFromUrl(new URL('http://localhost/account?tab=change-email')),'profile');
 assert.equal(accountTabFromUrl(new URL('http://localhost/account/listings?tab=change-email')),'profile');
 assert.equal(accountTabFromUrl(new URL('http://localhost/account?tab=logout')),'profile');
 assert.equal(accountTabFromUrl(new URL('http://localhost/account/listings?tab=unknown')),'posts');
});
test('only account panel changes preserve the applied route identity',()=>{
 const first=new URL('http://localhost/account/listings?kind=rides&q=airport&tab=posts');
 const panel=new URL('http://localhost/account/listings?tab=favorites&q=airport&kind=rides');
 assert.equal(accountLocationKey(first),accountLocationKey(panel));
 for(const changed of ['http://localhost/account?kind=rides&q=airport','http://localhost/account/listings?kind=items&q=airport','http://localhost/account/listings?kind=rides&q=campus']){
  assert.notEqual(accountLocationKey(first),accountLocationKey(new URL(changed)));
 }
});
