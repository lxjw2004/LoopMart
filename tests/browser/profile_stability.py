"""Publisher listing loading regressions; all API responses are browser fixtures.

Requires the running Web server used by astryx_ui.py. Never writes to a DB.
"""

import copy
import os
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

from astryx_ui import ITEM, SELLER, WEB, capture_errors
from interaction_stability import HeldFixture, START_SAMPLING, finish_sampling


class ProfileFixture(HeldFixture):
    def __init__(self, page_size):
        super().__init__()
        self.page_size = page_size
        self.items = [{**copy.deepcopy(ITEM), "id": f"profile-item-{index}"}
                      for index in range(page_size * 2)]

    def route(self, route):
        request = route.request
        parsed = urlparse(request.url)
        query = parse_qs(parsed.query)
        if request.method == "GET" and parsed.path in ["/api/v1/items", "/api/v1/rides"] and "publisherId" in query:
            if (request.method, parsed.path) == self.hold:
                self.pending.append(route)
                return
            records = self.items if parsed.path.endswith("/items") else self.rides
            more = "cursor" in query
            batch = records[self.page_size:] if more else records[:self.page_size]
            cursor = "page-2" if not more and len(records) > self.page_size else None
            route.fulfill(status=200, json={"data": batch, "nextCursor": cursor})
            return
        super().route(route)

    def release(self):
        self.hold = None
        pending, self.pending = self.pending, []
        for route in pending:
            self.route(route)


def sections(page):
    items = page.locator("section").filter(has=page.get_by_role("heading", name="市场", exact=True)).last
    rides = page.locator("section").filter(has=page.get_by_role("heading", name="拼车", exact=True)).last
    items.evaluate("node => node.dataset.profileTest = 'items'")
    rides.evaluate("node => node.dataset.profileTest = 'rides'")
    return items, rides


def profile_checks(browser, width, failures):
    mobile = width < 768
    context = browser.new_context(viewport={"width": width, "height": 844 if mobile else 1000},
                                  is_mobile=mobile, has_touch=mobile)
    fixture = ProfileFixture(page_size=2 if mobile else 3)
    fixture.hold = ("GET", "/api/v1/items")
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    page.add_init_script("""
      window.__profileInitial = {frames: [], active: true};
      const sample = () => {
        const posts = [...document.querySelectorAll('section')].find(section =>
          [...section.children].some(child => child.tagName === 'H2' && child.textContent === '市场'));
        if (posts) window.__profileInitial.frames.push({empty: posts.textContent.includes('暂无内容')});
        if (window.__profileInitial.active) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    """)
    page.goto(WEB + "/profiles/" + SELLER["id"], wait_until="domcontentloaded")
    expect(page.get_by_role("heading", name=SELLER["name"], exact=True)).to_be_visible()
    items, rides = sections(page)
    page.wait_for_function("document.querySelector('[data-profile-test=items]') !== null")
    # Wait on the response being held instead of relying on a fast fixture API.
    expect(items.locator('[role="status"], [aria-busy="true"], .astryx-skeleton').first).to_be_visible()
    assert fixture.pending, "Initial publisher listing request was not held"
    expect(items.get_by_text("暂无内容", exact=True)).not_to_be_visible()
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    initial_frames = page.evaluate("() => { window.__profileInitial.active = false; return window.__profileInitial.frames; }")
    assert initial_frames, "Initial publisher loading frames were not sampled"
    assert not any(frame["empty"] for frame in initial_frames), f"{width}: publisher listings flashed an empty state"
    if not items.locator(".astryx-skeleton").count():
        failures.append(f"{width}: initial publisher listings have no content placeholder")
    fixture.release()
    expect(items.locator(".listing-card")).to_have_count(fixture.page_size)
    expect(rides.locator(".listing-card")).to_have_count(1)

    more = items.get_by_role("button", name="加载更多", exact=True)
    # Center above the fixed mobile navigation before sampling; otherwise the
    # browser automation scrolls the button itself while attempting the click.
    more.evaluate("node => node.scrollIntoView({block: 'center', behavior: 'instant'})")
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    selectors = ["[data-profile-test=items] .listing-card", "[data-profile-test=items] button",
                 "[data-profile-test=rides]"]
    fixture.hold = ("GET", "/api/v1/items")
    page.evaluate(START_SAMPLING, selectors)
    more.click()
    expect(more).to_be_disabled()
    expect(items.locator('[role="status"], [role="progressbar"]').first).to_be_visible()
    assert fixture.pending, "Publisher pagination request was not held"
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    finish_sampling(page, f"{width}: publisher load more pending", failures)
    fixture.release()
    expect(items.locator(".listing-card")).to_have_count(fixture.page_size * 2)
    expect(more).not_to_be_visible()
    expect(items.locator('[role="status"], [role="progressbar"]')).to_have_count(0)

    # A late publisher response must not overwrite or reactivate the next page.
    page.reload(wait_until="networkidle")
    items, _ = sections(page)
    fixture.hold = ("GET", "/api/v1/items")
    items.get_by_role("button", name="加载更多", exact=True).click()
    expect(items.get_by_role("button", name="加载更多", exact=True)).to_be_disabled()
    assert fixture.pending, "Request to the old publisher page was not held"
    navigation = page.get_by_role("navigation", name="主导航", exact=True)
    navigation.get_by_role("link", name="市场", exact=True).click()
    expect(page).to_have_url(WEB + "/items")
    fixture.release()
    expect(page.locator(".browse-layout .listing-card")).to_have_count(fixture.page_size * 2)
    expect(page.get_by_role("heading", name=SELLER["name"], exact=True)).not_to_be_visible()
    assert not fixture.writes, fixture.writes
    assert not fixture.unexpected, fixture.unexpected
    print(f"PASS {width}: publisher pagination and late response checks; all API requests mocked", flush=True)
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
                profile_checks(browser, width, failures)
        finally:
            browser.close()
    assert not failures, "\n".join(failures)
    print("PASS publisher listing loading preserves existing layout")


if __name__ == "__main__":
    main()
