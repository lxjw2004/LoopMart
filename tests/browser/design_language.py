"""Verify the approved orange/white campus exchange design in real browsers.

Requires running frontend servers, never a database. All API/auth requests are
fulfilled by the same deterministic fixtures as astryx_ui.py.
"""

import argparse
import copy
import os
import re

from playwright.sync_api import expect, sync_playwright

from astryx_ui import Fixture, ITEM, RIDE, OUT, open_page, capture_errors, chat_composer_labels


WEB = os.environ.get("LOOPMART_WEB_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("LOOPMART_ADMIN_URL", "http://localhost:3004").rstrip("/")
SHOTS = OUT / "design-language"


class Checks:
    def __init__(self):
        self.failures = []

    def check(self, value, message):
        if not value:
            self.failures.append(message)
            print("FAIL " + message, flush=True)

    def find(self, page, selector):
        found = page.locator(selector).filter(visible=True)
        self.check(found.count() > 0, f"{page.url}: missing visible {selector}")
        return found.first if found.count() else None


def css(element, property_name):
    return element.evaluate("(node, property) => getComputedStyle(node).getPropertyValue(property).trim()", property_name)


def near(value, target, tolerance=1):
    return abs(float(str(value).replace("px", "")) - target) <= tolerance


def background(element):
    return element.evaluate("""node => {
      for (let current = node; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
      }
      return 'rgb(255, 255, 255)';
    }""")


def painted_control(field):
    return field.evaluate("""node => {
      for (let current = node; current && current.tagName !== 'FORM'; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none') {
          return { radius: style.borderTopLeftRadius, height: current.getBoundingClientRect().height };
        }
      }
      const style = getComputedStyle(node);
      return { radius: style.borderTopLeftRadius, height: node.getBoundingClientRect().height };
    }""")


def panel_surface(panel):
    return panel.evaluate("""node => {
      const bounds = node.getBoundingClientRect();
      const surface = [node, ...node.querySelectorAll('*')].find(candidate => {
        const style = getComputedStyle(candidate), box = candidate.getBoundingClientRect();
        return parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== 'none'
          && Math.abs(box.width - bounds.width) <= 2 && Math.abs(box.height - bounds.height) <= 2;
      }) || node;
      const style = getComputedStyle(surface);
      return { background: style.backgroundColor, radius: style.borderTopLeftRadius };
    }""")


def font_checks(checks, element, label):
    family = css(element, "font-family")
    checks.check(not re.search("Figtree", family, re.I) and bool(re.search("system-ui|apple-system|BlinkMacSystemFont|Segoe UI", family)), f"{label}: system font stack, got {family}")


def columns(checks, page, expected):
    cards = page.locator(".listing-card").filter(visible=True)
    boxes = [card.bounding_box() for card in cards.all()]
    if not boxes:
        checks.check(False, f"{page.url}: fixture listing cards missing")
        return
    actual = sum(abs(box["y"] - boxes[0]["y"]) < 2 for box in boxes if box)
    checks.check(actual == expected, f"{page.url} width={page.viewport_size['width']}: {expected} columns, got {actual}")


CANVAS = "rgb(248, 248, 246)"
PRIMARY = "rgb(207, 63, 35)"


def settle_layout(page):
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")


def content_width(element):
    return element.evaluate("node => { const s = getComputedStyle(node); return node.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight); }")


def no_overflow(checks, page):
    dimensions = page.evaluate("({scroll: document.documentElement.scrollWidth, viewport: innerWidth})")
    checks.check(dimensions["scroll"] <= dimensions["viewport"], f"{page.url}: no horizontal page overflow, got {dimensions}")


def filters_panel(page, checks, ride=False):
    """Filters remain accessible at every width; closed panels take no space."""
    width = page.viewport_size["width"]
    checks.check(page.locator(".filter-sidebar, .browse-sidebar").filter(visible=True).count() == 0,
                 f"{page.url} {width}: filters do not consume a desktop sidebar")
    trigger = page.get_by_role("button", name="筛选", exact=True).filter(visible=True)
    checks.check(trigger.count() == 1, f"{page.url} {width}: one visible filter trigger")
    if trigger.count() != 1:
        return
    trigger.click()
    dialog = page.get_by_role("dialog", name="筛选", exact=True).filter(visible=True)
    # The same semantic contract covers Dialog and the mobile BottomSheet.
    try:
        dialog.wait_for(state="visible", timeout=5000)
    except Exception:
        checks.check(False, f"{page.url} {width}: filter trigger opens a labelled dialog")
        return
    labels = ["出发地", "目的地", "日期"] if ride else ["最低价格", "最高价格", "成色", "交付方式"]
    for label in labels:
        checks.check(dialog.get_by_label(label, exact=True).count() > 0, f"{page.url}: filter keeps business label {label}")
    checks.check(dialog.get_by_role("button", name="应用筛选", exact=True).count() == 1, "filter panel has apply action")
    checks.check(dialog.get_by_role("button", name="清空", exact=True).count() == 1, "filter panel has clear action")
    no_overflow(checks, page)
    page.keyboard.press("Escape")
    try:
        dialog.wait_for(state="hidden", timeout=5000)
    except Exception:
        checks.check(False, f"{page.url}: Escape closes filters")
    try:
        expect(trigger).to_be_focused(timeout=2000)
    except AssertionError:
        checks.check(False, f"{page.url} {width}: closing filters returns focus to trigger")


def listing_media(page, checks):
    media = checks.find(page, ".listing-card .media-main")
    if not media:
        return
    box = media.bounding_box()
    if media.locator("img").count():
        checks.check(abs(box["width"] / box["height"] - 4 / 3) < .02, f"listing photo retains 4:3, got {box}")
    else:
        height = 112 if page.viewport_size["width"] < 768 else 160
        checks.check(near(box["height"], height, 2), f"{page.viewport_size['width']}: no-photo preview is compact ({height}px), got {box['height']}")


def web_design(page, fixture, checks):
    fixture.items = [{**copy.deepcopy(ITEM), "id": f"item-{index}", "title": f"Campus textbook {index}"} for index in range(8)]
    fixture.rides = [{**copy.deepcopy(RIDE), "id": f"ride-{index}"} for index in range(5)]
    page.set_viewport_size({"width": 1440, "height": 1000})
    open_page(page, WEB, "/items")
    shell = checks.find(page, ".web-shell")
    canvas = shell or page.locator("body")
    checks.check(background(canvas) == CANVAS, f"public canvas: expected #f8f8f6, got {background(canvas)}")
    main = checks.find(page, ".web-main")
    if main:
        checks.check(background(main) == CANVAS, f"public main painted canvas: expected #f8f8f6, got {background(main)}")
    heading = page.get_by_role("heading", level=1)
    checks.check(heading.count() > 0, "public main heading renders")
    font_checks(checks, heading.first if heading.count() else canvas, "public")
    publish = page.get_by_role("link", name=re.compile("^(?:＋ )?发布$")).filter(visible=True).first
    if publish.count():
        checks.check(css(publish, "background-color") == PRIMARY, f"public primary action: expected #cf3f23, got {css(publish, 'background-color')}")
        checks.check(near(css(publish, "border-top-left-radius"), 10), "public primary action uses 10px control radius")
        checks.check(publish.bounding_box()["height"] >= 40, "public desktop publish is a usable control")
    else:
        checks.check(False, "public header publish action missing")
    checks.find(page, ".market-header")
    checks.find(page, ".global-search")
    card = checks.find(page, ".listing-card")
    if card:
        checks.check(near(css(card, "border-top-left-radius"), 14), "listing cards use approved 14px radius")
        checks.check(background(card) == "rgb(255, 255, 255)", "listing cards retain white surfaces")
        if main:
            checks.check(page.locator(".card-grid").bounding_box()["width"] >= content_width(main) * .9,
                         "product grid uses the available main content width")
    for width in [1440, 1200, 1024, 1023, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
        settle_layout(page)
        columns(checks, page, 3 if width >= 1024 else 2)
        categories = checks.find(page, ".category-nav")
        if categories:
            buttons = categories.get_by_role("button")
            checks.check(buttons.count() >= 7, f"{width}: all product categories remain available")
            selected = categories.get_by_role("button", pressed=True)
            checks.check(selected.count() == 1, f"{width}: one active category is announced")
            if selected.count() == 1:
                checks.check(css(selected, "background-color") == "rgb(255, 240, 233)", f"{width}: active category remains visually distinct")
            boxes = [button.bounding_box() for button in buttons.all()]
            checks.check(all(box and abs(box["y"] - boxes[0]["y"]) < 2 for box in boxes), f"{width}: product categories stay in one horizontal row")
        listing_media(page, checks)
        no_overflow(checks, page)
        if width in [1440, 768, 390, 320]:
            filters_panel(page, checks)
        if width < 768:
            nav = checks.find(page, ".mobile-nav")
            if nav:
                box = nav.bounding_box()
                checks.check(css(nav, "position") == "fixed" and abs(box["y"] + box["height"] - page.viewport_size["height"]) <= 1, f"{width}: mobile bottom navigation remains pinned")
                checks.check(nav.get_by_role("link").count() == 5, f"{width}: mobile navigation retains five destinations")
        if width in [1440, 390]:
            page.screenshot(path=str(SHOTS / ("public-desktop.png" if width == 1440 else "public-mobile.png")), full_page=True)

    open_page(page, WEB, "/rides")
    for width in [1440, 1024, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
        settle_layout(page)
        columns(checks, page, 1)
        first = page.locator(".listing-card").first
        content = page.locator(".web-main")
        if first.count() and content.count():
            checks.check(first.bounding_box()["width"] >= content_width(content) * .9,
                         f"{width}: itinerary card spans main content width")
        checks.check(page.locator(".filter-sidebar, .browse-sidebar").filter(visible=True).count() == 0, f"{width}: rides have no sidebar")
        no_overflow(checks, page)
        if width in [1440, 390]:
            filters_panel(page, checks, ride=True)
            page.screenshot(path=str(SHOTS / ("rides-desktop.png" if width == 1440 else "rides-mobile.png")), full_page=True)
    open_page(page, WEB, "/publish?kind=items")
    title = page.get_by_role("textbox", name="标题", exact=True)
    checks.check(title.count() > 0, "public publish title input renders")
    if title.count():
        control = painted_control(title)
        checks.check(near(control["radius"], 10) and control["height"] >= 44, f"public mobile field uses 10px radius and >=44px height, got {control}")
    submit = page.get_by_role("button", name="发布商品", exact=True)
    checks.check(submit.count() > 0, "public publish action renders")
    if submit.count():
        checks.check(css(submit, "background-color") == PRIMARY, "mobile publish uses brand orange")
        checks.check(near(css(submit, "border-top-left-radius"), 10) and submit.bounding_box()["height"] >= 44, "public mobile submit uses 10px radius and >=44px height")
    page.screenshot(path=str(SHOTS / "public-publish-mobile.png"), full_page=True)
    open_page(page, WEB, "/messages/conversation-1")
    chat = checks.find(page, ".messages-layout")
    if chat:
        box = chat.bounding_box()
        checks.check(near(box["y"], 0) and near(box["height"], page.viewport_size["height"]), f"mobile selected chat fills viewport, got {box}")
    for selector in [".market-header", ".subnav", ".site-footer", ".mobile-nav"]:
        checks.check(page.locator(selector).filter(visible=True).count() == 0, f"mobile selected chat hides {selector}")
    page.screenshot(path=str(SHOTS / "public-chat-mobile.png"), full_page=True)
    chat_composer_labels(page)


def admin_design(page, fixture, checks):
    page.set_viewport_size({"width": 1440, "height": 1000})
    open_page(page, ADMIN, "/admin/items")
    shell = checks.find(page, ".admin-shell")
    canvas = shell or page.locator("body")
    checks.check(background(canvas) == CANVAS, f"admin canvas: expected #f8f8f6, got {background(canvas)}")
    heading = page.get_by_role("heading", level=1)
    checks.check(heading.count() > 0, "admin main heading renders")
    font_checks(checks, heading.first if heading.count() else canvas, "admin")
    if heading.count():
        checks.check(background(heading.first) == CANVAS, f"admin main painted canvas: expected #f8f8f6, got {background(heading.first)}")
    sidebar = checks.find(page, ".admin-sidebar")
    brand = checks.find(page, ".admin-brand")
    if sidebar:
        checks.check(near(sidebar.bounding_box()["width"], 224), f"admin sidebar stays 224px, got {sidebar.bounding_box()['width']}")
    if brand:
        checks.check(brand.evaluate("node => Boolean(node.closest('.admin-sidebar'))"), "admin brand remains inside the workbench sidebar")
    panel = checks.find(page, ".admin-table-scroll")
    if panel:
        surface = panel_surface(panel)
        checks.check(surface["background"] == "rgb(255, 255, 255)", f"admin table retains a white panel, got {surface}")
        checks.check(near(surface["radius"], 12), f"admin table panel uses 12px radius, got {surface['radius']}")
    rows = page.get_by_role("row").filter(visible=True)
    checks.check(rows.count() > 1, "admin resource table has populated rows")
    for row in rows.all()[1:]:
        checks.check(row.bounding_box()["height"] <= 80, "admin resource rows remain compact rather than becoming cards")
    field = page.get_by_role("textbox", name="搜索", exact=True)
    checks.check(field.count() > 0, "admin search input renders")
    if field.count():
        control = painted_control(field)
        checks.check(near(control["radius"], 8) and control["height"] >= 38, f"admin field uses 8px radius and compact usable height, got {control}")
    page.screenshot(path=str(SHOTS / "admin-table-desktop.png"), full_page=True)
    open_page(page, ADMIN, "/admin/settings")
    submit = page.get_by_role("button", name="保存", exact=True).filter(visible=True).first
    checks.check(submit.count() > 0, "admin settings save control renders")
    if submit.count():
        checks.check(css(submit, "background-color") == PRIMARY, f"admin primary action: expected #cf3f23, got {css(submit, 'background-color')}")
        checks.check(near(css(submit, "border-top-left-radius"), 8) and 36 <= submit.bounding_box()["height"] <= 44, "admin submit uses 8px radius and compact height")
    open_page(page, ADMIN, "/admin/overview")
    metrics = page.locator(".admin-metric").filter(visible=True)
    checks.check(metrics.count() > 0, "admin overview retains discrete white metric cards")
    for metric in metrics.all():
        checks.check(background(metric) == "rgb(255, 255, 255)" and near(css(metric, "border-top-left-radius"), 12), "admin metric card uses white surface and 12px radius")
    page.screenshot(path=str(SHOTS / "admin-overview-desktop.png"), full_page=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "web", "admin"], default="all")
    args = parser.parse_args()
    SHOTS.mkdir(parents=True, exist_ok=True)
    checks = Checks()
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**launch)
        try:
            for admin in [False, True]:
                if args.case == ("web" if admin else "admin"):
                    continue
                fixture = Fixture(admin=admin)
                context = browser.new_context(viewport={"width": 1440, "height": 1000})
                fixture.install(context)
                page = context.new_page()
                errors = []
                capture_errors(page, fixture, errors)
                try:
                    (admin_design if admin else web_design)(page, fixture, checks)
                except Exception as failure:
                    checks.check(False, f"{'admin' if admin else 'public'} inspection failed: {failure}")
                    page.screenshot(path=str(SHOTS / ("admin-failure.png" if admin else "public-failure.png")), full_page=True)
                checks.check(not errors, f"{'admin' if admin else 'public'} browser errors: {errors}")
                checks.check(not fixture.unexpected, f"unmocked API calls: {fixture.unexpected}")
                mutations = [(method, path) for method, path, _ in fixture.writes if not (method == "PUT" and path.endswith("/read"))]
                checks.check(not mutations, f"design checks must not submit mutations: {mutations}")
                context.close()
        finally:
            browser.close()
    if checks.failures:
        raise SystemExit(f"{len(checks.failures)} design-language regressions; screenshots: {SHOTS}")
    print("PASS campus exchange orange/white design, full-width listings, panel filters and responsive geometry; all API mocked, no database writes")


if __name__ == "__main__":
    main()
