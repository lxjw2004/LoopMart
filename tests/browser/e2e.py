from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,time,os
from ui_controls import fill_fields, form_for, select_value, labelled_control
U=json.loads(Path('.superpowers/e2e/users.json').read_text());TAG='UI-'+str(int(time.time()))
EXE=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
WEB_URL=os.environ.get('LOOPMART_WEB_URL','http://localhost:3000').rstrip('/')
ADMIN_URL=os.environ.get('LOOPMART_ADMIN_URL','http://localhost:3004').rstrip('/')
def nav(p,name):
 targets={'市场':'/items','拼车':'/rides','发布':'/publish','消息':'/messages','收藏':'/favorites','我的':'/account','联系':'/contact','隐私政策':'/privacy'}
 p.goto(WEB_URL+targets[name],wait_until='networkidle')
def login(p,u,port=3000):
 p.goto((WEB_URL if port==3000 else ADMIN_URL)+'/login',wait_until='networkidle');labelled_control(p,'邮箱').fill(u['email']);labelled_control(p,'密码').fill(u['password']);form_for(p,'密码').get_by_role('button',name='登录',exact=True).click()
 if port==3000:expect(p.get_by_role('navigation',name='账户导航',exact=True).locator('.account-link')).to_have_attribute('href','/account',timeout=15000)
 else:expect(p.get_by_test_id('admin-account').get_by_text(u.get('name','测试管理员'),exact=True)).to_be_visible(timeout=15000)
def fill(p,vals):fill_fields(p,vals)
def save(p):p.get_by_role('button',name='保存',exact=True).click();p.wait_for_timeout(300)
def report(p):
 p.get_by_role('button',name='举报',exact=True).click();select_value(p,'原因','spam');labelled_control(p,'补充说明').fill(TAG);form_for(p,'补充说明').get_by_role('button',name='保存',exact=True).click();p.wait_for_timeout(300);clean(p)
def clean(p):
 alerts=[text for text in p.locator('[role=alert]').all_inner_texts() if text.strip()];assert not alerts,alerts

def main():
 Path('.superpowers/ui-redesign').mkdir(parents=True,exist_ok=True)
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=EXE or pw.chromium.executable_path);c=b.new_context(viewport={'width':1440,'height':1000});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  login(p,U[1]);nav(p,'发布');fill(p,{'标题':TAG,'描述':'A useful campus book','价格（美元）':'12.34','分类':'books','成色':'good','交付方式':'pickup'});p.get_by_role('button',name='发布商品',exact=True).click();expect(p.locator('.listing-summary h2')).to_have_text(TAG);clean(p);item_url=p.url
  p.reload(wait_until='networkidle');expect(p.locator('.listing-summary h2')).to_have_text(TAG);p.get_by_role('button',name='收藏',exact=True).click();expect(p.get_by_role('button',name='取消收藏',exact=True)).to_be_visible();nav(p,'收藏');expect(p.get_by_role('heading',name=TAG,exact=True)).to_be_visible();print('PASS publish/detail direct refresh/favorite')
  c2=b.new_context(viewport={'width':1440,'height':1000});q=c2.new_page();q.on('pageerror',lambda e:errors.append(str(e)));login(q,U[2]);q.goto(item_url,wait_until='networkidle');report(q);q.get_by_role('button',name='发布者资料',exact=True).click();expect(q.get_by_role('heading',name='市场',exact=True)).to_be_visible();expect(q.get_by_role('heading',name='拼车',exact=True)).to_be_visible();report(q)
  q.goto(item_url,wait_until='networkidle');q.get_by_role('button',name='联系卖家',exact=True).click();expect(labelled_control(q,'消息内容')).to_be_visible();labelled_control(q,'消息内容').fill('Hello '+TAG);q.get_by_role('button',name='发送',exact=True).click();expect(q.locator('.messages').get_by_text('Hello '+TAG,exact=True)).to_be_visible();conversation_url=q.url
  expect(p.get_by_role('navigation',name='账户导航',exact=True).locator('a[href="/messages"]').locator('.unread-badge')).to_be_visible(timeout=15000)
  nav(p,'消息');p.locator('.conversation-row').first.click();expect(p.locator('.messages').get_by_text('Hello '+TAG,exact=True)).to_be_visible();labelled_control(p,'消息内容').fill('Reply '+TAG);p.get_by_role('button',name='发送',exact=True).click();expect(q.locator('.messages').get_by_text('Reply '+TAG,exact=True)).to_be_visible(timeout=15000);report(q);print('PASS pair chat/reference/realtime reply/conversation report')
  retry_text='Retry '+TAG;sent_ids=[]
  def uncertain_send(route):
   if route.request.method=='POST' and route.request.post_data_json.get('text')==retry_text:
    sent_ids.append(route.request.post_data_json['clientId']);result=route.fetch();assert result.ok;route.fulfill(status=503,json={'error':{'code':'UNAVAILABLE','message':'Temporary failure'}})
   else:route.continue_()
  q.route('**/api/v1/conversations/*/messages',uncertain_send);labelled_control(q,'消息内容').fill(retry_text);q.get_by_role('button',name='发送',exact=True).click();expect(q.locator('.chat-composer').get_by_role('alert')).to_be_visible();expect(labelled_control(q,'消息内容')).to_have_value(retry_text);q.unroute('**/api/v1/conversations/*/messages',uncertain_send)
  with q.expect_request(lambda r:r.method=='POST' and '/messages' in r.url) as retried:q.get_by_role('button',name='发送',exact=True).click()
  assert retried.value.post_data_json['clientId']==sent_ids[0];expect(labelled_control(q,'消息内容')).to_have_value('');expect(q.locator('.messages').get_by_text(retry_text,exact=True)).to_have_count(1);print('PASS uncertain-send retry reuses clientId without duplicate')
  q.screenshot(path='.superpowers/ui-redesign/messages-desktop.png',full_page=True);q.set_viewport_size({'width':390,'height':844});q.screenshot(path='.superpowers/ui-redesign/messages-mobile.png',full_page=True);assert q.evaluate('document.documentElement.scrollWidth<=innerWidth');q.set_viewport_size({'width':1440,'height':1000})
  nav(p,'发布');p.locator('.publish-tabs').get_by_role('button',name='拼车',exact=True).click();fill(p,{'出发地':'Campus '+TAG,'目的地':'Airport','出发时间':'2026-12-01T09:30','时区':'America/Indiana/Indianapolis','费用（美元）':'5.00','总座位':3,'剩余座位':2,'费用说明':'Shared fuel','备注':'Meet at library'});p.get_by_role('button',name='发布拼车',exact=True).click();expect(p.locator('.listing-summary h2')).to_contain_text('Campus '+TAG);ride_url=p.url;report(p);clean(p)
  q.goto(ride_url,wait_until='networkidle');q.get_by_role('button',name='联系车主',exact=True).click();expect(labelled_control(q,'消息内容')).to_be_visible();assert q.url==conversation_url,'same user pair must reuse conversation';labelled_control(q,'消息内容').fill('Ride '+TAG);q.get_by_role('button',name='发送',exact=True).click();expect(q.locator('.messages').get_by_text('Ride '+TAG,exact=True)).to_be_visible();print('PASS ride publish/detail and merged conversation')
  nav(p,'我的');p.locator('.actions').get_by_role('button',name='拼车',exact=True).last.click();expect(p.get_by_role('button',name='拼车',exact=True).last).to_have_attribute('aria-pressed','true');p.locator('.actions').get_by_role('button',name='市场',exact=True).last.click();expect(p.get_by_role('button',name='市场',exact=True).last).to_have_attribute('aria-pressed','true')
  nav(p,'联系');fill(p,{'邮箱':U[1]['email'],'主题':TAG,'内容':'Please review '+TAG});save(p);clean(p);print('PASS own listings and contact')
  nav(p,'市场');p.get_by_role('button',name='EN',exact=True).click();expect(p.get_by_role('heading',name='Market',exact=True)).to_be_visible();p.get_by_role('button',name='中文',exact=True).click()
  for width in [1440,1024,768,390,320]:
   p.set_viewport_size({'width':width,'height':900});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'mobile overflow {width}'
  Path('.superpowers/ui-redesign').mkdir(parents=True,exist_ok=True);p.screenshot(path='.superpowers/ui-redesign/web-mobile.png',full_page=True);assert not errors,errors;print('PASS language/responsive/no browser exceptions');b.close()
if __name__=='__main__':main()
