"""Navigation must not paint an unrelated page or move persistent page chrome.

Uses held fixture responses; never connects to or writes to a database.
"""

import argparse
import copy
import os
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

from astryx_ui import WEB, ADMIN, ITEM, Fixture, capture_errors, open_page
from interaction_stability import HeldFixture
from ui_controls import fill_fields


class NavigationFixture(HeldFixture):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.requests = []

    def route(self, route):
        self.requests.append((route.request.method, urlparse(route.request.url).path))
        super().route(route)


PROBE = """() => {
  const visible = selector => { const n = document.querySelector(selector); return !!n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== 'none'; };
  const sample = () => ({
    path: location.pathname, scroll: scrollY,
    browse: !!document.querySelector('.browse-layout'),
    detail: !!document.querySelector('.detail-layout'),
    heading: document.querySelector('h1')?.textContent,
    mainTop: document.querySelector('.web-page-content')?.getBoundingClientRect().y,
    mobileNav: visible('.mobile-nav'),
    header: visible('.market-header'),
    empty: !!document.querySelector('.astryx-empty-state'),
    columns: document.querySelector('.card-grid') && getComputedStyle(document.querySelector('.card-grid')).gridTemplateColumns,
  });
  const state = window.__navigationProbe = {frames: [], active: true};
  const tick = () => { if (state.active) { state.frames.push(sample()); requestAnimationFrame(tick); } };
  tick();
}"""


def frames(page):
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    return page.evaluate("() => { window.__navigationProbe.active = false; return window.__navigationProbe.frames; }")


def check(condition, description, failures):
    if condition:
        print("PASS " + description, flush=True)
    else:
        failures.append(description)
        print("FAIL " + description, flush=True)


def public_navigation(browser, width, failures):
    context = browser.new_context(viewport={"width": width, "height": 844 if width < 768 else 1000})
    fixture = NavigationFixture()
    fixture.items = [{**copy.deepcopy(ITEM), "id": f"item-{index}"} for index in range(15)]
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/items")
    expect(page.locator(".listing-card")).to_have_count(15)
    nav = page.get_by_role("navigation", name="主导航", exact=True)

    before = len(fixture.requests)
    page.evaluate(PROBE)
    nav.get_by_role("link", name="市场", exact=True).click()
    duplicate = frames(page)
    check(not any(frame["empty"] for frame in duplicate) and len(fixture.requests) == before,
          f"{width}: selecting current page preserves content without reloading", failures)
    expect(page.locator(".listing-card")).to_have_count(15)

    fixture.hold = ("GET", "/api/v1/items/item-0")
    page.evaluate(PROBE)
    page.locator(".listing-card").first.click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    fixture.release()
    expect(page.locator(".detail-layout")).to_be_visible()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()
    detail_frames = [frame for frame in frames(page) if frame["path"] == "/items/item-0"]
    check(detail_frames and not any(frame["browse"] for frame in detail_frames),
          f"{width}: item route never flashes a browse page", failures)
    check(len({frame["mainTop"] for frame in detail_frames}) == 1,
          f"{width}: detail heading position stays fixed while loading", failures)

    report = page.get_by_role("button", name="举报", exact=True)
    report.click()
    details = page.get_by_role("textbox", name="详情", exact=False)
    # DataForm's label is translated by the project's existing dictionary.
    if not details.count():
        details = page.locator('.detail-layout textarea').first
    expect(details).to_be_visible()
    details.fill("Keep this report draft")
    fixture.hold = ("PUT", "/api/v1/favorites/item-0")
    page.get_by_role("button", name="收藏", exact=True).click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    check(details.is_visible() and details.input_value() == "Keep this report draft",
          f"{width}: unrelated request preserves expanded report and its draft", failures)
    fixture.release()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()

    nav.get_by_role("link", name="市场", exact=True).click()
    expect(page.locator(".listing-card")).to_have_count(15)
    page.evaluate("window.scrollTo(0, 250)")
    card = page.locator(".listing-card").nth(3)
    card.scroll_into_view_if_needed()
    saved_scroll = page.evaluate("scrollY")
    card.click()
    expect(page.locator(".detail-layout")).to_be_visible()
    check(page.evaluate("scrollY") == 0, f"{width}: entering detail resets scroll after page commit", failures)
    page.get_by_role("button", name="返回市场", exact=True).click()
    expect(page.locator(".listing-card")).to_have_count(15)
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    check(abs(page.evaluate("scrollY") - saved_scroll) <= 1,
          f"{width}: returning to cached list restores scroll", failures)

    open_page(page, WEB, "/messages")
    fixture.hold = ("GET", "/api/v1/conversations/conversation-1/messages")
    page.evaluate(PROBE)
    page.locator(".conversation-row").first.click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    fixture.release()
    expect(page.locator(".chat-composer")).to_be_visible()
    selected_frames = [frame for frame in frames(page) if frame["path"] == "/messages/conversation-1"]
    if width < 768:
        check(selected_frames and not any(frame["header"] or frame["mobileNav"] for frame in selected_frames),
              f"{width}: conversation route keeps full-screen chat during loading", failures)

    assert not fixture.unexpected, fixture.unexpected
    context.close()


def server_routes(browser, failures):
    context = browser.new_context(java_script_enabled=False)
    page = context.new_page()
    for base, path, title in [(WEB, "/rides", "拼车"), (WEB, "/privacy", "隐私政策"),
                              (WEB, "/login?token=test", "登录"), (ADMIN, "/admin/users", "用户")]:
        page.goto(base + path, wait_until="networkidle")
        check(page.get_by_role("heading", level=1).first.inner_text() == title,
              f"SSR {path}: renders the requested route before hydration", failures)
    context.close()


def navigation_races(browser, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    fixture = NavigationFixture()
    fixture.install(context)
    page = context.new_page()
    page.on("pageerror", lambda error: failures.append(str(error)))
    page.on("console", lambda message: failures.append(message.text) if message.type == "error" and not (
        message.location.get("url") in fixture.expected_http_errors and "404" in message.text) else None)
    open_page(page, WEB, "/items")
    fixture.hold = ("GET", "/api/v1/items/item-1")
    page.locator(".listing-card").first.click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    page.get_by_role("navigation", name="主导航", exact=True).get_by_role("link", name="拼车", exact=True).click()
    expect(page.locator(".ride-card")).to_have_count(1)
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()
    fixture.release()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    check(page.url.endswith("/rides") and page.locator(".ride-card").count() == 1
          and page.locator(".detail-layout").count() == 0,
          "rapid navigation: late detail response cannot replace the new page or keep it busy", failures)

    fixture.hold = ("GET", "/api/v1/items/item-1")
    page.goto(WEB + "/items/item-1", wait_until="domcontentloaded")
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    page.wait_for_function("document.querySelector('.route-loading') !== null || document.querySelector('.browse-layout') !== null")
    check(page.locator(".browse-layout").count() == 0,
          "direct detail: pending response never exposes listing filters", failures)
    fixture.expected_http_errors.add(WEB + "/api/v1/items/item-1")
    for route in fixture.pending:
        route.fulfill(status=404, json={"error": {"code": "NOT_FOUND", "message": "Not found"}})
    fixture.hold = None
    fixture.pending = []
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()
    check(page.locator(".browse-layout").count() == 0 and page.get_by_role("heading", name="内容不可用", exact=True).is_visible(),
          "failed detail: stays on the requested page with a completed loading state", failures)

    open_page(page, WEB, "/items")
    page.locator(".listing-card").first.click()
    expect(page.locator(".detail-layout")).to_be_visible()
    page.go_back(wait_until="networkidle")
    expect(page.locator(".browse-layout")).to_be_visible()
    page.go_forward(wait_until="networkidle")
    expect(page.locator(".detail-layout")).to_be_visible()
    check(page.url.endswith("/items/item-1"), "browser back/forward restores the correct page type", failures)
    page.go_back(wait_until="networkidle")
    fixture.hold = ("GET", "/api/v1/items/item-1")
    page.locator(".listing-card").first.click()
    expect(page.locator(".detail-layout")).to_be_visible()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    for route in fixture.pending:
        route.fulfill(status=404, json={"error": {"code": "NOT_FOUND", "message": "Not found"}})
    fixture.hold = None
    fixture.pending = []
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()
    check(page.locator(".detail-layout").count() == 0,
          "deleted detail: an invalid cached preview cannot remain actionable", failures)
    assert not fixture.unexpected, fixture.unexpected
    context.close()


def short_page_footer(browser, width, failures):
    context = browser.new_context(viewport={"width": width, "height": 1000 if width >= 768 else 844})
    fixture = NavigationFixture()
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/items")
    fixture.hold = ("GET", "/api/v1/rides")
    page.get_by_role("navigation", name="主导航", exact=True).get_by_role("link", name="拼车", exact=True).click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    before = page.locator(".site-footer").bounding_box()
    fixture.release()
    expect(page.locator(".ride-card")).to_have_count(1)
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).not_to_be_visible()
    after = page.locator(".site-footer").bounding_box()
    check(abs(before["y"] - after["y"]) <= 1,
          f"{width}: short-page footer stays fixed when loading completes", failures)
    context.close()


def pending_write_navigation(browser, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    fixture = NavigationFixture()
    fixture.items[0]["publisherId"] = fixture.user["id"]
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/items/item-1")
    fixture.hold = ("PATCH", "/api/v1/items/item-1")
    page.get_by_role("button", name="下架", exact=True).click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    page.get_by_role("navigation", name="主导航", exact=True).get_by_role("link", name="拼车", exact=True).click()
    expect(page.locator(".ride-card")).to_have_count(1)
    fixture.release()
    page.wait_for_load_state("networkidle")
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    check(page.url.endswith("/rides") and page.locator(".ride-card").count() == 1
          and not page.locator(".detail-layout").count(),
          "pending write: late completion cannot overwrite a different page", failures)
    open_page(page, WEB, "/publish")
    fill_fields(page, {"标题": "Pending publish", "描述": "A fixture listing", "分类": "books",
                       "成色": "good", "价格（美元）": "12.34", "交付方式": "pickup"})
    fixture.hold = ("POST", "/api/v1/items")
    page.get_by_role("button", name="发布商品", exact=True).click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    page.get_by_role("navigation", name="主导航", exact=True).get_by_role("link", name="拼车", exact=True).click()
    expect(page.locator(".ride-card")).to_have_count(1)
    with page.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/api/v1/items")):
        fixture.release()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    check(page.url.endswith("/rides") and page.locator(".ride-card").count() == 1,
          "pending publish: late completion cannot navigate away from the new page", failures)
    open_page(page, WEB, "/publish")
    fill_fields(page, {"标题": "Another pending publish", "描述": "A fixture listing", "分类": "books",
                       "成色": "good", "价格（美元）": "12.34", "交付方式": "pickup"})
    fixture.hold = ("POST", "/api/v1/items")
    page.get_by_role("button", name="发布商品", exact=True).click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    page.get_by_role("button", name="拼车", exact=True).click()
    with page.expect_response(lambda response: response.request.method == "POST" and response.url.endswith("/api/v1/items")):
        fixture.release()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    check(page.url.endswith("/publish?kind=rides"),
          "pending publish: switching form kind invalidates the previous form navigation", failures)
    assert not fixture.unexpected, fixture.unexpected
    context.close()


def conversation_sidebar(browser, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    fixture = NavigationFixture()
    fixture.install(context)
    # Keep the snapshot test independent of an SSE update refilling the list.
    context.add_init_script("window.EventSource = class extends EventTarget { close() {} };")
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/messages")
    fixture.hold = ("GET", "/api/v1/conversations/conversation-1/messages")
    page.locator(".conversation-row").first.click()
    expect(page.get_by_role("progressbar", name="加载中…", exact=True)).to_be_visible()
    assert fixture.pending
    check(page.locator(".conversation-row").count() == 1,
          "desktop chat: existing conversation sidebar stays mounted while loading messages", failures)
    fixture.release()
    expect(page.locator(".chat-composer")).to_be_visible()
    context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "navigation", "writes", "footer"], default="all")
    args = parser.parse_args()
    failures = []
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**launch)
        try:
            if args.case in ["all", "navigation"]:
                for width in [1440, 390]:
                    public_navigation(browser, width, failures)
                server_routes(browser, failures)
                navigation_races(browser, failures)
                conversation_sidebar(browser, failures)
            if args.case in ["all", "writes"]:
                pending_write_navigation(browser, failures)
            if args.case in ["all", "footer"]:
                for width in [1440, 390]:
                    short_page_footer(browser, width, failures)
        finally:
            browser.close()
    assert not failures, "\n".join(failures)
    print("PASS navigation stability; all API requests mocked")


if __name__ == "__main__":
    main()
