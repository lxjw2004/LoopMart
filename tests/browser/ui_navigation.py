"""Keyboard navigation and recovery paths; API fixtures only, no database."""

import os
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import expect, sync_playwright
from astryx_ui import Fixture, ITEM, WEB, ADMIN, open_page, capture_errors


def header_search(browser):
    for signed_in in [True, False]:
        context = browser.new_context(viewport={"width": 768, "height": 1000})
        fixture = Fixture(signed_in=signed_in)
        fixture.install(context)
        page = context.new_page()
        errors = []
        capture_errors(page, fixture, errors)
        for english in [False, True]:
            for width in [768, 900, 1023, 1024, 1200]:
                page.set_viewport_size({"width": width, "height": 1000})
                open_page(page, WEB, "/items")
                if english and page.get_by_role("button", name="EN", exact=True).count():
                    page.get_by_role("button", name="EN", exact=True).click()
                form = page.locator(".global-search").filter(visible=True)
                expect(form).to_have_count(1)
                field = form.locator('input[type="search"]')
                expect(field).to_be_visible()
                assert field.bounding_box()["width"] >= 180, (width, english, signed_in, "Search textbox must remain readable", field.bounding_box())
                field.fill("campus textbook")
                field.press("End")
                field.press("1")
                expect(field).to_have_value("campus textbook1")
                assert field.evaluate("node => node.scrollWidth <= node.clientWidth"), (width, "Ordinary search query is clipped")
                form.get_by_role("button", name="Search" if english else "搜索", exact=True).click()
                page.wait_for_url(lambda url: urlsplit(url).path == "/items" and parse_qs(urlsplit(url).query).get("q") == ["campus textbook1"])
                assert parse_qs(urlsplit(page.url).query)["q"] == ["campus textbook1"]
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, "Header overflow")
                expect(page.get_by_role("link", name=("Account" if signed_in else "Sign in") if english else ("我的" if signed_in else "登录"), exact=True).filter(visible=True)).to_be_visible()
        assert not errors, errors
        assert not fixture.unexpected, fixture.unexpected
        assert not fixture.writes, fixture.writes
        context.close()
    print("PASS readable/editable header search and submit at 768/900/1023/1024/1200 in two locales and auth states")


def main():
    failures = []
    with sync_playwright() as playwright:
        options = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            options["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**options)
        try:
            header_search(browser)
            for admin, base, path in [(False, WEB, "/items"), (True, ADMIN, "/admin/items")]:
                fixture = Fixture(admin=admin)
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                fixture.install(context)
                page = context.new_page()
                errors = []
                capture_errors(page, fixture, errors)
                try:
                    open_page(page, base, path)
                    page.keyboard.press("Tab")
                    skip = page.get_by_role("link", name="跳至内容", exact=True)
                    expect(skip).to_be_focused(timeout=3000)
                    expect(skip).to_be_in_viewport()
                    page.keyboard.press("Enter")
                    expect(page.get_by_role("main")).to_be_focused()
                    current = urlsplit(page.url)
                    assert current.path == path and not current.query, "Skipping navigation must preserve the route"
                except Exception as failure:
                    failures.append(f"{'admin' if admin else 'web'} keyboard: {failure}")
                if not admin:
                    try:
                        fixture.items = []
                        open_page(page, WEB, "/items?q=unmatched")
                        expect(page.get_by_role("heading", name="没有匹配结果")).to_be_visible()
                        fixture.items = [dict(ITEM)]
                        page.get_by_role("region", name="商品列表", exact=True).get_by_role("button", name="清空筛选", exact=True).click(timeout=3000)
                        expect(page.locator(".listing-card")).to_have_count(1)
                        assert "q=" not in page.url, "Clearing filters must reset the URL"
                        page.get_by_role("button", name="筛选", exact=True).click()
                        page.get_by_role("textbox", name="最高价格", exact=True).fill("0")
                        fixture.items = []
                        page.get_by_role("button", name="应用筛选", exact=True).click()
                        expect(page.get_by_role("heading", name="没有匹配结果")).to_be_visible()
                        page.get_by_role("button", name="筛选", exact=True).click()
                        expect(page.get_by_role("textbox", name="最低价格", exact=True)).to_have_value("")
                        page.keyboard.press("Escape")
                        fixture.items = [dict(ITEM)]
                        page.get_by_role("button", name="清空筛选", exact=True).click()
                        expect(page.locator(".listing-card")).to_have_count(1)
                        assert "maxPriceCents" not in page.url, "Zero-price filters must remain clearable"
                        page.get_by_role("button", name="筛选", exact=True).click()
                        expect(page.get_by_role("textbox", name="最高价格", exact=True)).to_have_value("")
                        page.keyboard.press("Escape")
                    except Exception as failure:
                        failures.append(f"empty search recovery: {failure}")
                assert not errors, errors
                assert not fixture.unexpected, fixture.unexpected
                assert not fixture.writes, fixture.writes
                context.close()
        finally:
            browser.close()
    if failures:
        raise AssertionError("\n".join(failures))
    print("PASS keyboard skip links and search recovery on Web/Admin; all API mocked")


if __name__ == "__main__":
    main()
