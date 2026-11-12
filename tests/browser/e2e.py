from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,time,os
U=json.loads(Path('.superpowers/e2e/users.json').read_text());TAG='UI-'+str(int(time.time()))
EXE=os.environ.get('PLAYWRIGHT_CHROMIUM_EXECUTABLE')
def nav(p,name):p.locator('nav').get_by_role('button',name=name,exact=True).click();p.wait_for_timeout(350)
def login(p,u,port=3000):
 p.goto(f'http://localhost:{port}',wait_until='networkidle');p.locator('header').get_by_role('button',name='登录',exact=True).click();p.locator('input[type=email]').fill(u['email']);p.locator('input[type=password]').fill(u['password']);p.get_by_role('button',name='保存',exact=True).click();expect(p.get_by_role('button',name='退出',exact=True)).to_be_visible(timeout=15000)
def fill(p,vals):
 for k,v in vals.items():p.get_by_label(k,exact=True).fill(str(v))
def save(p):p.get_by_role('button',name='保存',exact=True).click();p.wait_for_timeout(700)
def report(p):
 p.get_by_text('举报',exact=True).click();p.get_by_label('原因',exact=True).select_option('spam');p.get_by_label('补充说明',exact=True).fill(TAG);p.locator('details').get_by_role('button',name='保存',exact=True).click();p.wait_for_timeout(300);clean(p)
def clean(p):
 alerts=[text for text in p.locator('[role=alert]').all_inner_texts() if text.strip()];assert not alerts,alerts
def main():
 with sync_playwright() as pw:
  b=pw.chromium.launch(headless=True,executable_path=EXE or pw.chromium.executable_path);c=b.new_context(viewport={'width':1440,'height':1000});p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  login(p,U[1]);nav(p,'发布');fill(p,{'标题':TAG,'描述':'A useful campus book','价格（美分）':1200});p.get_by_label('分类',exact=True).select_option('books');p.get_by_label('成色',exact=True).select_option('good');p.get_by_label('交付方式',exact=True).select_option('pickup');save(p);clean(p);nav(p,'市场');p.get_by_role('textbox',name='搜索',exact=True).fill(TAG);p.get_by_role('button',name='搜索',exact=True).click();expect(p.get_by_role('button').filter(has_text=TAG).first).to_be_visible();p.get_by_role('button').filter(has_text=TAG).first.click();expect(p.get_by_role('heading',name=TAG,exact=True)).to_be_visible();p.get_by_role('button',name='收藏',exact=True).last.click();clean(p);nav(p,'收藏');expect(p.get_by_role('button').filter(has_text=TAG).first).to_be_visible();print('PASS publish/detail/favorite')
  # second member contacts publisher with item reference
  c2=b.new_context();q=c2.new_page();login(q,U[2]);nav(q,'市场');q.get_by_role('textbox',name='搜索',exact=True).fill(TAG);q.get_by_role('button',name='搜索',exact=True).click();q.get_by_role('button').filter(has_text=TAG).first.click();report(q);q.get_by_role('button',name='发布者资料',exact=True).click();report(q);nav(q,'市场');q.get_by_role('textbox',name='搜索',exact=True).fill(TAG);q.get_by_role('button',name='搜索',exact=True).click();q.get_by_role('button').filter(has_text=TAG).first.click();expect(q.get_by_role('heading',name=TAG,exact=True)).to_be_visible();q.locator('main').get_by_role('button',name='消息',exact=True).click();q.get_by_label('消息',exact=True).fill('Hello '+TAG);save(q);clean(q)
  nav(p,'消息');p.locator('.chat section').first.get_by_role('button').first.click();expect(p.get_by_text('Hello '+TAG,exact=True)).to_be_visible();p.get_by_label('消息',exact=True).fill('Reply '+TAG);save(p);expect(q.get_by_text('Reply '+TAG,exact=True)).to_be_visible(timeout=15000);print('PASS pair chat/reference/realtime reply')
  # public reports all target types through detail/profile/conversation
  report(q);print('PASS conversation report')
  nav(p,'发布');p.get_by_role('button',name='拼车',exact=True).last.click();fill(p,{'出发地':'Campus '+TAG,'目的地':'Airport','出发时间':'2026-12-01T09:30','时区':'America/Indiana/Indianapolis','费用（美分）':500,'总座位':3,'剩余座位':2,'费用说明':'Shared fuel','备注':'Meet at library'});save(p);clean(p);nav(p,'拼车');p.get_by_role('textbox',name='搜索',exact=True).fill(TAG);p.get_by_role('button',name='搜索',exact=True).click();expect(p.get_by_role('button').filter(has_text='Campus '+TAG).first).to_be_visible();p.get_by_role('button').filter(has_text='Campus '+TAG).first.click();report(p);print('PASS ride publish; four target reports')
  nav(p,'联系');fill(p,{'邮箱':U[1]['email'],'主题':TAG,'内容':'Please review '+TAG});save(p);clean(p);print('PASS contact submit')
  # mobile and English
  p.set_viewport_size({'width':390,'height':844});nav(p,'市场');p.get_by_role('button',name='EN',exact=True).click();expect(p.get_by_role('heading',name='Market',exact=True)).to_be_visible();assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'), 'mobile overflow';p.screenshot(path='.superpowers/e2e/web-mobile.png',full_page=True);print('PASS language/mobile')
  # admin operations
  ca=b.new_context(viewport={'width':1440,'height':1000});a=ca.new_page();login(a,U[0],3004);a.on('dialog',lambda d:d.accept('UI audit '+TAG) if d.type=='prompt' else d.accept());nav(a,'用户');a.get_by_role('button').filter(has_text=U[1]['email']).first.click();expect(a.get_by_label('角色',exact=True)).to_be_visible();a.get_by_label('角色',exact=True).select_option('member');a.get_by_label('封禁',exact=True).select_option('false');a.locator('form').first.get_by_role('button',name='保存',exact=True).click();a.wait_for_timeout(500);clean(a);print('PASS admin user update')
  nav(a,'市场');a.get_by_role('textbox',name='搜索',exact=True).fill(TAG);a.get_by_role('button',name='搜索',exact=True).click();a.get_by_role('button').filter(has_text=TAG).first.click();a.get_by_label('状态',exact=True).select_option('deactivated');a.get_by_role('button',name='保存',exact=True).click();a.wait_for_timeout(500);clean(a);print('PASS admin moderation')
  nav(a,'举报');a.get_by_role('textbox',name='搜索',exact=True).fill(TAG);a.get_by_role('button',name='搜索',exact=True).click();a.wait_for_timeout(350);a.locator('.grid button').first.click();a.get_by_label('状态',exact=True).select_option('reviewed');a.get_by_label('审核说明',exact=True).fill(TAG);save(a);clean(a);print('PASS admin report review')
  nav(a,'联系');a.get_by_role('textbox',name='搜索',exact=True).fill(TAG);a.get_by_role('button',name='搜索',exact=True).click();a.get_by_role('button').filter(has_text=TAG).first.click();a.get_by_label('状态',exact=True).select_option('resolved');a.get_by_label('审核说明',exact=True).fill(TAG);save(a);clean(a);print('PASS admin contact resolution')
  nav(a,'设置');expect(a.get_by_label('允许所有邮箱',exact=True)).to_be_visible();a.get_by_label('中文隐私政策',exact=True).fill('隐私 '+TAG);a.get_by_label('英文隐私政策',exact=True).fill('Privacy '+TAG);save(a);clean(a);print('PASS admin settings')
  for name in ['总览','审计','消息','社区消息']:
   nav(a,name);clean(a)
  a.screenshot(path='.superpowers/e2e/admin-desktop.png',full_page=True);assert not errors,errors;print('PASS admin views; no browser exceptions');b.close()

if __name__=='__main__':main()
