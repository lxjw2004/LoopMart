"""Route/race, layout and responsive regression tests for the redesign."""
from playwright.sync_api import sync_playwright, expect
from pathlib import Path
from ui_controls import labelled_control
from e2e import U,EXE,login,WEB_URL
import argparse,time

OUT=Path('.superpowers/ui-redesign')
def shell(page):
 page.goto(WEB_URL+'/items',wait_until='networkidle')
 expect(page.get_by_role('navigation',name='主导航',exact=True)).to_be_visible();expect(page.get_by_role('searchbox',name='搜索商品',exact=True)).to_be_visible()
 page.get_by_role('navigation',name='主导航',exact=True).get_by_role('link',name='拼车',exact=True).click();expect(page).to_have_url(WEB_URL+'/rides')
 sidebar=page.get_by_role('region',name='拼车筛选',exact=True).bounding_box();grid=page.get_by_role('region',name='拼车列表',exact=True).bounding_box()
 assert sidebar['x']+sidebar['width']<=grid['x'],'rides must use left/right layout'
 page.go_back();expect(page).to_have_url(WEB_URL+'/items')
 page.goto(WEB_URL+'/#rides',wait_until='networkidle');expect(page).to_have_url(WEB_URL+'/rides')
 print('PASS real history, legacy bookmark and desktop left/right ride layout')

def wait_held(page,held):
 for _ in range(100):
  if held:return
  page.wait_for_timeout(50)
 raise AssertionError('Expected a held detail request')

def routes(page):
 login(page,U[1]);tag='route-'+str(time.time_ns())
 response=page.request.post(WEB_URL+'/api/v1/items',data={'title':tag,'description':'Route regression fixture','category':'books','condition':'good','priceCents':1234,'deliveryMethod':'pickup'})
 assert response.ok,response.status
 record=response.json()['data'];url=WEB_URL+'/items/'+record['id'];pattern='**/api/v1/items/'+record['id']
 held=[];page.route(pattern,lambda route:held.append(route))
 page.goto(url+'/edit',wait_until='domcontentloaded');wait_held(page,held)
 expect(page.get_by_role('button',name='发布商品',exact=True)).not_to_be_visible();expect(labelled_control(page,'标题')).not_to_be_visible()
 held.pop().fulfill(status=200,json={'data':record});expect(labelled_control(page,'标题')).to_have_value(tag);expect(page.get_by_role('button',name='保存修改',exact=True)).to_be_visible();page.unroute(pattern)
 page.goto(WEB_URL+'/items?q='+tag,wait_until='networkidle');expect(page.locator('.listing-card h2')).to_have_text(tag)
 page.get_by_role('link',name=tag,exact=True).click();expect(page.locator('.listing-summary h2')).to_have_text(tag);page.get_by_role('button',name='返回市场',exact=False).click();expect(page).to_have_url(WEB_URL+'/items?q='+tag);expect(page.locator('.listing-card h2')).to_have_text(tag)
 held=[];page.route(pattern,lambda route:held.append(route));page.goto(url,wait_until='domcontentloaded');wait_held(page,held)
 page.get_by_role('navigation',name='主导航',exact=True).get_by_role('link',name='拼车',exact=True).click();expect(page).to_have_url(WEB_URL+'/rides')
 held.pop().fulfill(status=404,json={'error':{'code':'NOT_FOUND','message':'Not found'}});page.wait_for_timeout(200);assert not [x for x in page.get_by_role('alert').all_inner_texts() if x.strip()],page.get_by_role('alert').all_inner_texts();page.unroute(pattern)
 print('PASS direct edit loading gate, filtered return and stale failure isolation')
 return url

def responsive(page,url):
 paths=['/items','/rides','/publish?kind=items','/publish?kind=rides','/account','/favorites',url.replace(WEB_URL,'')]
 for path in paths:
  page.goto(WEB_URL+path,wait_until='networkidle')
  for width in [1440,1024,768,390,320]:
   page.set_viewport_size({'width':width,'height':900});page.wait_for_timeout(50)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow {width} {path}'
  assert page.locator('input[type=file]').count()==0
  page.set_viewport_size({'width':1440,'height':1000});page.screenshot(path=str(OUT/(path.split('?')[0].replace('/','-').strip('-')+'-desktop.png')),full_page=True)
 page.goto(WEB_URL+'/items',wait_until='networkidle');page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(OUT/'market-mobile.png'),full_page=True)
 print('PASS five widths across market/rides/publishing/account/favorites/details; no upload controls')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--case',choices=['all','shell','route','responsive'],default='all');args=parser.parse_args();OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path=EXE or pw.chromium.executable_path);page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  if args.case in ['all','shell']:shell(page)
  if args.case in ['all','route','responsive']:
   url=routes(page)
   if args.case in ['all','responsive']:responsive(page,url)
  assert not errors,errors;browser.close();print('PASS no unhandled browser exceptions')
if __name__=='__main__':main()
