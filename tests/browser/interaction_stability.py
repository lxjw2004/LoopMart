"""Check request-time layout stability with held API fixtures; no database writes.

Requires running Web/Admin servers, like astryx_ui.py. Samples animation frames
as well as the pending response so a brief jump cannot hide behind a fast API.
"""

import copy
import os
from urllib.parse import urlparse

from playwright.sync_api import expect, sync_playwright

from astryx_ui import Fixture, ITEM, WEB, ADMIN, capture_errors, open_page


class HeldFixture(Fixture):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.hold = None
        self.pending = []

    def route(self, route):
        request = route.request
        if (request.method, urlparse(request.url).path) == self.hold:
            self.pending.append(route)
        else:
            super().route(route)

    def release(self):
        self.hold = None
        pending, self.pending = self.pending, []
        for route in pending:
            super().route(route)


START_SAMPLING = """selectors => {
  const sample = () => Object.fromEntries(selectors.map(selector => {
    const node = document.querySelector(selector), box = node?.getBoundingClientRect();
    return [selector, box ? {x: box.x, y: box.y, width: box.width, height: box.height} : null];
  }).concat([['viewport', {scrollY, width: document.documentElement.clientWidth}]]));
  window.__stability = {frames: [sample()], sample, active: true};
  const tick = () => {
    if (!window.__stability.active) return;
    window.__stability.frames.push(sample());
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}"""


def finish_sampling(page, label, failures):
    frames = page.evaluate("""() => {
      const state = window.__stability;
      state.frames.push(state.sample());
      state.active = false;
      return state.frames;
    }""")
    baseline = frames[0]
    changes = {}
    for frame in frames[1:]:
        for selector, before in baseline.items():
            after = frame[selector]
            if before is None or after is None:
                failures.append(f"{label}: missing stability target {selector}")
                return
            for dimension, value in before.items():
                delta = abs(after[dimension] - value)
                if delta > 1:
                    key = f"{selector}.{dimension}"
                    changes[key] = max(changes.get(key, 0), delta)
    if changes:
        failures.append(f"{label}: layout moved {changes}")
    else:
        print(f"PASS {label}: stable across {len(frames)} frames", flush=True)


def request_check(page, fixture, label, action, method, path, selectors, failures):
    fixture.hold = (method, "/api/v1" + path)
    page.evaluate(START_SAMPLING, selectors)
    action()
    indicator = page.get_by_role("progressbar", name="加载中…", exact=True)
    expect(indicator).to_be_visible()
    assert fixture.pending, f"{label}: request was not held"
    # Exercise several painted frames while the operation is still pending.
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    fixture.release()
    expect(indicator).not_to_be_visible()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    finish_sampling(page, label, failures)


def public_checks(browser, width, failures):
    mobile = width < 768
    context = browser.new_context(viewport={"width": width, "height": 844 if mobile else 1000},
                                  is_mobile=mobile, has_touch=mobile)
    fixture = HeldFixture()
    fixture.items = [{**copy.deepcopy(ITEM), "id": f"item-{index}"} for index in range(12)]
    fixture.favorites = {"item-0"}
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/items")
    expect(page.locator(".listing-card")).to_have_count(12)
    selectors = [".market-header", ".browse-layout", ".card-grid", ".site-footer"]
    request_check(page, fixture, f"{width}: favorite", lambda: page.get_by_role("button", name="取消收藏", exact=True).first.click(),
                  "DELETE", "/favorites/item-0", selectors, failures)

    if not mobile:
        category = page.get_by_role("combobox", name="分类", exact=True)
        page.evaluate(START_SAMPLING, selectors)
        category.click()
        expect(page.get_by_role("option", name="书籍", exact=True)).to_be_visible()
        finish_sampling(page, f"{width}: open selector", failures)
        # CDP scrollIntoView on a top-layer option can scroll its underlying
        # document even though it is visible. Use a real pointer at its bounds.
        option = page.get_by_role("option", name="书籍", exact=True).bounding_box()
        request_check(page, fixture, f"{width}: select category", lambda: page.mouse.click(option["x"] + option["width"] / 2, option["y"] + option["height"] / 2),
                      "GET", "/items", selectors, failures)
        request_check(page, fixture, f"{width}: apply filters", lambda: page.get_by_role("button", name="应用筛选", exact=True).click(),
                      "GET", "/items", selectors, failures)
        request_check(page, fixture, f"{width}: clear filters", lambda: page.get_by_role("button", name="清空", exact=True).click(),
                      "GET", "/items", selectors, failures)

    page.evaluate("window.scrollTo(0, 180)")
    page.evaluate("() => new Promise(done => requestAnimationFrame(done))")
    # The second row stays below the sticky header; clicking an occluded first
    # row would make Playwright itself scroll the page before dispatching click.
    favorite = page.locator(".listing-card").nth(3).get_by_role("button", name="收藏", exact=True)
    favorite.scroll_into_view_if_needed()
    request_check(page, fixture, f"{width}: favorite while scrolled", favorite.click,
                  "PUT", "/favorites/item-3", selectors, failures)
    assert not fixture.unexpected, fixture.unexpected
    context.close()


def admin_checks(browser, failures):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    fixture = HeldFixture(admin=True)
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, ADMIN, "/admin/items")
    expect(page.get_by_test_id("admin-resource-list")).to_contain_text(ITEM["title"])
    request_check(page, fixture, "admin: search", lambda: page.get_by_role("button", name="搜索", exact=True).click(),
                  "GET", "/admin/items", [".admin-topbar", ".toolbar", '[data-testid="admin-resource-list"]'], failures)
    assert not fixture.unexpected, fixture.unexpected
    context.close()


def retry_checks(browser, width, failures):
    context = browser.new_context(viewport={"width": width, "height": 1000 if width >= 768 else 844})
    fixture = HeldFixture()
    fixture.expected_http_errors.add(WEB + "/api/v1/items")
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, WEB, "/items")

    def fail_pending():
        assert fixture.pending, "The failing request was not held"
        pending, fixture.pending = fixture.pending, []
        fixture.hold = None
        for route in pending:
            fixture.expected_http_errors.add(route.request.url)
            route.fulfill(status=503, json={"error": {"code": "UNAVAILABLE", "message": "Temporary fixture failure"}})

    fixture.hold = ("GET", "/api/v1/items")
    if width < 768:
        page.get_by_role("button", name="筛选", exact=True).click()
    page.get_by_role("button", name="应用筛选", exact=True).click()
    indicator = page.get_by_role("progressbar", name="加载中…", exact=True)
    expect(indicator).to_be_visible()
    fail_pending()
    banner = page.get_by_role("alert").filter(has_text="服务暂不可用，请稍后重试")
    expect(banner).to_be_visible()
    expect(indicator).not_to_be_visible()
    if width < 768:
        expect(page.get_by_role("dialog", name="筛选", exact=True)).not_to_be_visible()
        # The sheet can already be transparent while its modal exit still
        # owns pointer input and the document scroll lock.
        page.wait_for_function("!document.querySelector('dialog[open]') && getComputedStyle(document.documentElement).overflowY !== 'hidden'")

    fixture.hold = ("GET", "/api/v1/items")
    retry_button = page.get_by_role("button", name="重试", exact=True)
    retry_button.evaluate("node => node.scrollIntoView({block: 'center', behavior: 'instant'})")
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    retry = retry_button.bounding_box()
    page.evaluate(START_SAMPLING, [".browse-layout", ".site-footer"])
    page.mouse.click(retry["x"] + retry["width"] / 2, retry["y"] + retry["height"] / 2)
    expect(indicator).to_be_visible()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    fail_pending()
    expect(indicator).not_to_be_visible()
    expect(banner).to_be_visible()
    finish_sampling(page, f"{width}: repeated failure keeps the error banner in place", failures)
    page.get_by_role("button", name="重试", exact=True).click()
    expect(banner).not_to_be_visible()
    expect(page.locator(".listing-card")).to_have_count(1)
    context.close()


def main():
    failures = []
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**launch)
        try:
            for width in [1440, 390]:
                public_checks(browser, width, failures)
                retry_checks(browser, width, failures)
            admin_checks(browser, failures)
        finally:
            browser.close()
    assert not failures, "\n".join(failures)
    print("PASS click interactions preserve layout; all API requests mocked")


if __name__ == "__main__":
    main()
