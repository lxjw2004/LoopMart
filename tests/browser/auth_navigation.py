"""Login regression: real cookie/session navigation plus session-load failure visibility."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect


def submit(page):
    page.locator('form button[type=submit]').click()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base', default='http://localhost:3004')
    args = parser.parse_args()
    users = json.loads(Path('.superpowers/e2e/users.json').read_text())
    admin = users[0]
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.base + '/login', wait_until='networkidle')
        expect(page.get_by_role('alert').filter(has_text='请先登录后再继续')).not_to_be_visible()
        page.get_by_label('邮箱', exact=True).fill(admin['email'])
        page.get_by_label('密码', exact=True).fill('wrong-password-for-regression')
        submit(page)
        expect(page.get_by_role('alert').first).to_be_visible()
        expect(page).to_have_url(args.base + '/login')
        page.get_by_label('密码', exact=True).fill(admin['password'])
        submit(page)
        expect(page).to_have_url(args.base + '/admin/overview', timeout=15000)
        expect(page.get_by_role('heading', name='总览', exact=True)).to_be_visible()
        page.reload(wait_until='networkidle')
        expect(page.locator('.admin-sidebar-user strong')).to_have_text(admin.get('name', '测试管理员'))
        page.goto(args.base + '/login', wait_until='networkidle')
        expect(page).to_have_url(args.base + '/admin/overview')
        page.goto(args.base + '/login?token=expired-test-token', wait_until='networkidle')
        expect(page.get_by_label('密码', exact=True)).to_be_visible()
        expect(page.get_by_label('邮箱', exact=True)).not_to_be_visible()
        print('PASS login redirects, persists across reload, redirects existing sessions and preserves reset callbacks')
        page.locator('.admin-sidebar-user button').click()
        expect(page).to_have_url(args.base + '/admin/login')
        page.route('**/api/v1/me', lambda route: route.fulfill(status=503, json={'error': {'message': 'Session temporarily unavailable'}}))
        page.get_by_label('邮箱', exact=True).fill(admin['email'])
        page.get_by_label('密码', exact=True).fill(admin['password'])
        submit(page)
        expect(page.get_by_role('alert').filter(has_text='服务暂不可用，请稍后重试')).to_be_visible()
        expect(page).to_have_url(args.base + '/admin/login')
        print('PASS failed session refresh is visible and never claims successful navigation')
        member_page = browser.new_page()
        protected_requests = []
        member_page.on('request', lambda request: protected_requests.append(request.url) if '/api/v1/admin/' in request.url else None)
        member_page.goto(args.base + '/login', wait_until='networkidle')
        member_page.get_by_label('邮箱', exact=True).fill(users[1]['email'])
        member_page.get_by_label('密码', exact=True).fill(users[1]['password'])
        submit(member_page)
        expect(member_page).to_have_url(args.base + '/admin/overview')
        expect(member_page.get_by_text('需要管理员权限', exact=False)).to_be_visible()
        assert not protected_requests, 'Member login must not request protected admin resources'
        print('PASS member sessions cannot load admin resources')
        assert not errors, errors
        browser.close()


if __name__ == '__main__':
    main()
