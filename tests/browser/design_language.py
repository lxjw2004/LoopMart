"""Preserve LoopMart's original public blue and admin green design languages.

Requires running frontend servers, never a database. All API/auth requests are
fulfilled by the same deterministic fixtures as astryx_ui.py.
"""

import argparse
import copy
import os
import re

from playwright.sync_api import sync_playwright

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
    checks.check(not re.search("Figtree", family, re.I) and bool(re.search("system-ui|apple-system|BlinkMacSystemFont|Segoe UI", family)), f"{label}: original system font stack, got {family}")


def columns(checks, page, expected):
    cards = page.locator(".listing-card").filter(visible=True)
    boxes = [card.bounding_box() for card in cards.all()]
    if not boxes:
        checks.check(False, f"{page.url}: fixture listing cards missing")
        return
    actual = sum(abs(box["y"] - boxes[0]["y"]) < 2 for box in boxes if box)
    checks.check(actual == expected, f"{page.url} width={page.viewport_size['width']}: {expected} columns, got {actual}")


def web_design(page, fixture, checks):
    fixture.items = [{**copy.deepcopy(ITEM), "id": f"item-{index}", "title": f"Campus textbook {index}"} for index in range(8)]
    fixture.rides = [{**copy.deepcopy(RIDE), "id": f"ride-{index}"} for index in range(5)]
    page.set_viewport_size({"width": 1440, "height": 1000})
    open_page(page, WEB, "/items")
    shell = checks.find(page, ".web-shell")
    canvas = shell or page.locator("body")
    checks.check(background(canvas) == "rgb(245, 247, 251)", f"public canvas: expected #f5f7fb, got {background(canvas)}")
    main = checks.find(page, ".web-main")
    if main:
        checks.check(background(main) == "rgb(245, 247, 251)", f"public main painted canvas: expected #f5f7fb, got {background(main)}")
    heading = page.get_by_role("heading", level=1)
    checks.check(heading.count() > 0, "public main heading renders")
    font_checks(checks, heading.first if heading.count() else canvas, "public")
    publish = page.get_by_role("link", name=re.compile("^(?:＋ )?发布$")).filter(visible=True).first
    if publish.count():
        checks.check(css(publish, "background-color") == "rgb(38, 89, 236)", f"public primary action: expected #2659ec, got {css(publish, 'background-color')}")
        checks.check(near(css(publish, "border-top-left-radius"), 8), f"public primary action: original 8px radius, got {css(publish, 'border-top-left-radius')}")
        checks.check(40 <= publish.bounding_box()["height"] <= 47, f"public primary action: original 40px minimum control height, got {publish.bounding_box()['height']}")
    else:
        checks.check(False, "public header publish action missing")

    header = checks.find(page, ".market-header")
    search = checks.find(page, ".global-search")
    subnav = checks.find(page, ".subnav")
    if header and search:
        checks.check(search.evaluate("node => Boolean(node.closest('.market-header'))"), "public search must stay inside the main header")
        checks.check(near(css(search, "border-top-left-radius"), 8), "header search keeps its 8px painted radius")
    if header and subnav:
        primary_row = checks.find(page, ".header-inner")
        h, n = (primary_row or header).bounding_box(), subnav.bounding_box()
        checks.check(n["y"] >= h["y"] + h["height"] - 1, "public primary header and separate secondary navigation retain their hierarchy")
        checks.check(background(subnav) == "rgb(245, 247, 251)", f"public secondary navigation keeps the gray canvas, got {background(subnav)}")

    card = checks.find(page, ".listing-card")
    if card:
        checks.check(near(css(card, "border-top-left-radius"), 12), "listing cards keep the original 12px radius")
        media = checks.find(page, ".listing-card .media-main")
        if media:
            bounds = media.bounding_box()
            checks.check(abs(bounds["width"] / bounds["height"] - 4 / 3) < .02, f"listing image/placeholder keeps 4:3, got {bounds}")
        title = card.get_by_role("heading").first
        checks.check(near(css(title, "font-size"), 16), f"desktop listing title remains 16px, got {css(title, 'font-size')}")
        price = checks.find(page, ".listing-card .listing-price")
        if price:
            checks.check(near(css(price, "font-size"), 25), f"desktop listing price remains 25px, got {css(price, 'font-size')}")
    columns(checks, page, 3)
    page.screenshot(path=str(SHOTS / "public-desktop.png"), full_page=True)

    for width in [1200, 1199, 1024, 768, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
        page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        columns(checks, page, 3 if width >= 1200 else 2)
        sidebar_visible = page.locator(".filter-sidebar").filter(visible=True).count() > 0
        checks.check(sidebar_visible == (width >= 1200), f"public filters at {width}: sidebar visible only from 1200px, got {sidebar_visible}")
        if width < 768:
            nav = checks.find(page, ".mobile-nav")
            if nav:
                box = nav.bounding_box()
                checks.check(css(nav, "position") == "fixed" and abs(box["y"] + box["height"] - page.viewport_size["height"]) <= 1, f"{width}: original mobile bottom navigation remains pinned")
            price = page.locator(".listing-card .listing-price").first
            if price.count():
                checks.check(near(css(price, "font-size"), 22), f"{width}: mobile listing price remains 22px")
    page.screenshot(path=str(SHOTS / "public-mobile.png"), full_page=True)

    open_page(page, WEB, "/rides")
    for width in [1440, 1024, 390, 320]:
        page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
        page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
        columns(checks, page, 3 if width >= 1200 else 2 if width >= 768 else 1)
        sidebar_visible = page.locator(".filter-sidebar").filter(visible=True).count() > 0
        checks.check(sidebar_visible == (width >= 1200), f"ride filters at {width}: sidebar visible only from 1200px, got {sidebar_visible}")
    open_page(page, WEB, "/publish?kind=items")
    title = page.get_by_role("textbox", name="标题", exact=True)
    checks.check(title.count() > 0, "public publish title input renders")
    if title.count():
        control = painted_control(title)
        checks.check(near(control["radius"], 8) and control["height"] >= 44, f"public mobile field keeps 8px radius and 44px minimum height, got {control}")
    submit = page.get_by_role("button", name="发布商品", exact=True)
    checks.check(submit.count() > 0, "public publish action renders")
    if submit.count():
        checks.check(near(css(submit, "border-top-left-radius"), 8) and submit.bounding_box()["height"] >= 44, f"public mobile submit keeps 8px radius and 44px minimum height, got {css(submit, 'border-top-left-radius')}/{submit.bounding_box()['height']}")
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
    checks.check(background(canvas) == "rgb(247, 248, 245)", f"admin canvas: expected #f7f8f5, got {background(canvas)}")
    heading = page.get_by_role("heading", level=1)
    checks.check(heading.count() > 0, "admin main heading renders")
    font_checks(checks, heading.first if heading.count() else canvas, "admin")
    if heading.count():
        checks.check(background(heading.first) == "rgb(247, 248, 245)", f"admin main painted canvas: expected #f7f8f5, got {background(heading.first)}")
    sidebar = checks.find(page, ".admin-sidebar")
    brand = checks.find(page, ".admin-brand")
    if sidebar:
        checks.check(near(sidebar.bounding_box()["width"], 224), f"admin sidebar stays 224px, got {sidebar.bounding_box()['width']}")
    if brand:
        checks.check(brand.evaluate("node => Boolean(node.closest('.admin-sidebar'))"), "admin brand remains inside the workbench sidebar")
    panel = checks.find(page, ".admin-table-scroll")
    if panel:
        surface = panel_surface(panel)
        checks.check(surface["background"] == "rgb(255, 255, 255)", f"admin resource table retains a white panel, got {surface}")
        checks.check(near(surface["radius"], 9), f"admin table panel keeps 9px radius, got {surface['radius']}")
    field = page.get_by_role("textbox", name="搜索", exact=True)
    checks.check(field.count() > 0, "admin search input renders")
    if field.count():
        control = painted_control(field)
        checks.check(near(control["radius"], 6) and control["height"] >= 38, f"admin field keeps 6px radius and 38px minimum height, got {control}")
    page.screenshot(path=str(SHOTS / "admin-table-desktop.png"), full_page=True)
    open_page(page, ADMIN, "/admin/settings")
    submit = page.get_by_role("button", name="保存", exact=True).filter(visible=True).first
    checks.check(submit.count() > 0, "admin settings save control renders")
    if submit.count():
        checks.check(css(submit, "background-color") == "rgb(61, 96, 88)", f"admin primary action: expected #3d6058, got {css(submit, 'background-color')}")
        checks.check(near(css(submit, "border-top-left-radius"), 6) and 36 <= submit.bounding_box()["height"] <= 40, f"admin submit keeps 6px radius and compact 36px height, got {css(submit, 'border-top-left-radius')}/{submit.bounding_box()['height']}")
    open_page(page, ADMIN, "/admin/overview")
    metrics = page.locator(".admin-metric").filter(visible=True)
    checks.check(metrics.count() > 0, "admin overview retains discrete white metric cards")
    for metric in metrics.all():
        checks.check(background(metric) == "rgb(255, 255, 255)" and near(css(metric, "border-top-left-radius"), 9), "admin metric card retains white surface and 9px radius")
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
    print("PASS original public blue/admin green visual language, geometry and responsive layout; all API mocked, no database writes")


if __name__ == "__main__":
    main()
