import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,legacyTarget,routeHref,safeReturnTo} from './navigation.js';
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
