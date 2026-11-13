from e2e import sync_playwright, expect, U, EXE


def nav(page, name):
    target = {'市场': '/items', '拼车': '/rides', '发布': '/publish', '我的发布': '/account/listings'}[name]
    page.locator(f'a[href="{target}"]:visible').first.click()
    page.wait_for_url(lambda url: target in url)


def login(page, user):
    page.goto('http://localhost:3000', wait_until='networkidle')
    page.locator('header').get_by_role('link', name='登录', exact=True).click()
    page.get_by_label('邮箱', exact=True).fill(user['email'])
    page.get_by_label('密码', exact=True).fill(user['password'])
    page.get_by_role('button', name='保存', exact=True).click()
    expect(page.locator('header .account-link')).to_have_attribute('href', '/account', timeout=15000)


def logout(page):
    page.locator('header .account-link').click()
    page.get_by_role('button', name='退出', exact=True).click()
    expect(page.locator('header').get_by_role('link', name='登录', exact=True)).to_be_visible()


with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, executable_path=EXE or pw.chromium.executable_path)
    context = browser.new_context(timezone_id='Asia/Shanghai')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:3000', wait_until='networkidle')
    page.locator('header').get_by_role('link', name='登录', exact=True).click()
    page.get_by_label('邮箱', exact=True).fill(U[1]['email'])
    page.get_by_label('密码', exact=True).fill('Wrong-only-test-password-001!')
    page.get_by_role('button', name='保存', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='邮箱或密码不正确')).to_be_visible()
    page.get_by_role('button', name='EN', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='Email or password is incorrect.')).to_be_visible()
    print('PASS real bad credentials in Chinese and English')

    page.get_by_role('button', name='Forgot password', exact=True).click()
    page.get_by_label('Email', exact=True).fill(U[1]['email'])
    page.get_by_role('button', name='Save', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='Email service is unavailable. Try again later.')).to_be_visible()
    page.get_by_role('button', name='中文', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='邮件服务暂不可用，请稍后重试')).to_be_visible()
    print('PASS actual SMTP-unavailable response in both languages')

    def deny(route):
        route.fulfill(status=403, content_type='application/json', body='{"error":{"code":"FORBIDDEN","message":"Administrator required; internal detail"}}')

    page.route('**/api/v1/items**', deny)
    nav(page, '市场')
    expect(page.get_by_role('alert').filter(has_text='没有权限执行此操作')).to_be_visible()
    page.get_by_role('button', name='EN', exact=True).click()
    expect(page.get_by_role('alert').filter(has_text='You do not have permission to perform this action.')).to_be_visible()
    assert 'internal detail' not in page.locator('body').inner_text()
    page.unroute('**/api/v1/items**', deny)
    print('PASS forbidden response localized with server internals hidden')

    second_context = browser.new_context(timezone_id='Asia/Shanghai')
    ride_page = second_context.new_page()
    ride_page.on('pageerror', lambda error: errors.append(str(error)))
    login(ride_page, U[1])
    nav(ride_page, '发布')
    ride_page.locator('.publish-tabs').get_by_role('button', name='拼车', exact=True).click()
    expect(ride_page.get_by_role('button', name='发布拼车', exact=True)).to_be_visible()
    expect(ride_page.get_by_label('时区', exact=True)).to_have_value('America/Indiana/Indianapolis')
    expect(ride_page.get_by_label('时区', exact=True).locator('option')).to_contain_text(['—', '东部时间（Purdue／Indy）', '中部时间（Chicago）'])
    ride_page.get_by_label('时区', exact=True).select_option('America/Chicago')
    ride_page.get_by_label('出发地', exact=True).fill('Custom campus')
    expect(ride_page.get_by_label('出发地', exact=True)).to_have_value('Custom campus')
    assert ride_page.locator('#ride-locations option').evaluate_all('(xs)=>xs.map(x=>x.value)') == ['Purdue', 'Indy', 'IND', 'Chicago', 'ORD', 'MDW', 'UIUC']
    ride_page.screenshot(path='.superpowers/e2e/ride-presets.png', full_page=True)
    print('PASS timezone presets/default independent of browser timezone; BM locations and free text')

    nav(ride_page, '拼车')
    expect(ride_page.locator('.ride-grid .listing-card').first).to_be_visible()
    for sort in ['departure_desc', 'departure_asc']:
        with ride_page.expect_response(lambda response: '/api/v1/rides?' in response.url and response.request.method == 'GET') as reply:
            ride_page.get_by_label('排序', exact=True).select_option(sort, timeout=10000)
        response = reply.value
        assert response.ok
        assert 'sort=' + sort in response.url
        dates = [row['departureTime'] for row in response.json()['data']]
        assert dates == sorted(dates, reverse=sort == 'departure_desc')
    print('PASS ride sort dropdown requests actual earliest/latest order')
    row = response.json()['data'][0]
    card = ride_page.locator('.ride-grid .listing-card').first
    expect(card.locator('time').first).to_be_visible()
    expect(card).to_contain_text('剩余 ' + str(row['availableSeats']) + ' 个座位')
    assert 'GMT+8' not in card.locator('time').first.inner_text()
    card.get_by_role('link').click()
    expect(ride_page.locator('.journey-panel time.departure-date')).to_be_visible()
    combined = ride_page.locator('.detail-layout').inner_text()
    assert row['id'] not in combined
    assert row.get('publisherId', 'not-a-real-id') not in combined
    assert '社区' not in ride_page.locator('.journey-panel').inner_text()
    ride_page.screenshot(path='.superpowers/e2e/ride-public-detail.png', full_page=True)
    print('PASS ride card seats and chosen-zone time; public detail excludes internal identifiers')

    # Same browser storage, distinct accounts: preserve A's own draft without restoring it for B.
    nav(ride_page, '发布')
    ride_page.locator('.publish-tabs').get_by_role('button', name='市场', exact=True).click()
    expect(ride_page.get_by_role('button', name='发布商品', exact=True)).to_be_visible()
    ride_page.get_by_label('标题', exact=True).fill('Private-A-draft')
    ride_page.evaluate("localStorage.setItem('loopmart-draft-items', JSON.stringify({title:'Legacy-global-draft'}))")
    logout(ride_page)
    login(ride_page, U[2])
    nav(ride_page, '发布')
    expect(ride_page.get_by_label('标题', exact=True)).to_have_value('')
    ride_page.get_by_label('标题', exact=True).fill('Private-B-draft')
    logout(ride_page)
    login(ride_page, U[1])
    nav(ride_page, '发布')
    expect(ride_page.get_by_label('标题', exact=True)).to_have_value('Private-A-draft')
    ride_page.get_by_role('button', name='丢弃草稿', exact=True).click()
    expect(ride_page.get_by_label('标题', exact=True)).to_have_value('')
    print('PASS account-isolated draft restore and discard in shared browser storage')
    assert not errors, errors
    browser.close()
