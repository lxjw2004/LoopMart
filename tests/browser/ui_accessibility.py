"""Theme accessibility regression; uses intercepted API fixtures, never a DB.

Run against the running frontends with .venv/bin/python tests/browser/ui_accessibility.py.
Checks actual painted contrast, keyboard focus, and compact-screen control sizes.
"""

import argparse
import os
import re

from playwright.sync_api import sync_playwright

from astryx_ui import Fixture, open_page, capture_errors
from design_language import Checks, css, background


WEB = os.environ.get("LOOPMART_WEB_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("LOOPMART_ADMIN_URL", "http://localhost:3004").rstrip("/")


def rgb(value):
    channels = [float(channel) for channel in re.findall(r"[\d.]+", value)]
    assert len(channels) in [3, 4], f"Unsupported browser color: {value}"
    return channels[:3]


def contrast(foreground, surface):
    def luminance(color):
        channels = [channel / 255 for channel in color]
        linear = [channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4 for channel in channels]
        return sum(channel * weight for channel, weight in zip(linear, [.2126, .7152, .0722]))

    light, dark = sorted([luminance(foreground), luminance(surface)], reverse=True)
    return (light + .05) / (dark + .05)


def check_text(checks, page, selector, label):
    nodes = page.locator(selector).filter(visible=True)
    checks.check(nodes.count() > 0, f"{label}: visible text exists")
    for node in nodes.all():
        color, surface = css(node, "color"), background(node)
        ratio = contrast(rgb(color), rgb(surface))
        checks.check(ratio >= 4.5, f"{label}: {node.inner_text()[:30]!r} contrast {ratio:.2f}:1 ({color} / {surface})")


def admin_contrast(page, fixture, checks):
    open_page(page, ADMIN, "/admin/items")
    for selector, label in [
        (".astryx-table-cell .astryx-text", "admin body"),
        ('.astryx-text[data-color="secondary"]', "admin secondary text"),
        (".astryx-table-header-cell", "admin table headings"),
        (".astryx-field-label", "admin form labels"),
        ('.astryx-token[data-color="admin-status"]', "admin status"),
        ('.astryx-token[data-color="admin-brand"]', "admin brand label"),
    ]:
        check_text(checks, page, selector, label)
    open_page(page, ADMIN, "/admin/items/item-1")
    check_text(checks, page, '.astryx-text[data-type="admin-eyebrow"]', "admin detail label")
    open_page(page, ADMIN, "/admin/settings")
    check_text(checks, page, ".astryx-field-label", "admin settings labels")
    page.get_by_role("button", name="保存", exact=True).click()
    summary = '.astryx-section[data-variant="admin-summary"]'
    page.locator(summary).wait_for(state="visible")
    check_text(checks, page, summary, "admin confirmation summary")
    page.get_by_role("button", name="取消", exact=True).click()


def keyboard_focus(page, fixture, checks, admin):
    open_page(page, ADMIN if admin else WEB, "/admin/items" if admin else "/items")
    page.keyboard.press("Tab")
    target = page.locator(":focus")
    checks.check(target.count() == 1, "keyboard: Tab reaches a control")
    if target.count():
        checks.check(target.evaluate("node => node.matches(':focus-visible')"), "keyboard: focused control has focus-visible")
        color, surface = css(target, "outline-color"), background(target)
        ratio = contrast(rgb(color), rgb(surface))
        checks.check(float(css(target, "outline-width").replace("px", "")) >= 2, "keyboard: visible outline has width")
        checks.check(ratio >= 3, f"{'admin' if admin else 'public'} focus contrast {ratio:.2f}:1 ({color} / {surface})")


def mobile_controls(page, fixture, checks, admin):
    base = ADMIN if admin else WEB
    paths = ["/admin/settings", "/admin/rides"] if admin else ["/publish?kind=items", "/publish?kind=rides", "/messages/conversation-1"]
    page.set_viewport_size({"width": 390, "height": 844})
    for path in paths:
        open_page(page, base, path)
        inputs = page.locator('input:not([type="hidden"]), textarea').filter(visible=True)
        checks.check(inputs.count() > 0, f"{path}: mobile inputs exist")
        for control in inputs.all():
            size = float(css(control, "font-size").replace("px", ""))
            checks.check(size >= 16, f"{path}: mobile input {control.get_attribute('name') or control.get_attribute('type')} is {size}px, expected >=16px")
            height = control.evaluate("""node => (node.closest('.astryx-text-input, .astryx-text-area, .astryx-date-input, .astryx-date-time-input') || node).getBoundingClientRect().height""")
            checks.check(height >= 44, f"{path}: mobile field height {height}, expected >=44px")
        for control in page.locator(".astryx-button, .astryx-selector").filter(visible=True).all():
            box = control.bounding_box()
            checks.check(box["width"] >= 44 and box["height"] >= 44, f"{path}: mobile action {(control.inner_text() or control.get_attribute('aria-label') or '')[:25]!r} is {box['width']}×{box['height']}, expected >=44×44")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "contrast", "focus", "mobile"], default="all")
    args = parser.parse_args()
    checks = Checks()
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**launch)
        try:
            for admin in [False, True]:
                fixture = Fixture(admin=admin)
                context = browser.new_context(viewport={"width": 1440, "height": 1000}, is_mobile=True, has_touch=True)
                fixture.install(context)
                page = context.new_page()
                errors = []
                capture_errors(page, fixture, errors)
                try:
                    if args.case in ["all", "contrast"] and admin:
                        admin_contrast(page, fixture, checks)
                    if args.case in ["all", "focus"]:
                        keyboard_focus(page, fixture, checks, admin)
                    if args.case in ["all", "mobile"]:
                        mobile_controls(page, fixture, checks, admin)
                except Exception as failure:
                    checks.check(False, f"{'admin' if admin else 'public'} accessibility inspection: {failure}")
                checks.check(not errors, f"browser errors: {errors}")
                checks.check(not fixture.unexpected, f"unmocked requests: {fixture.unexpected}")
                mutations = [(method, path) for method, path, _ in fixture.writes if not (method == "PUT" and path.endswith("/read"))]
                checks.check(not mutations, f"unexpected mutations: {mutations}")
                context.close()
        finally:
            browser.close()
    if checks.failures:
        raise SystemExit(f"{len(checks.failures)} accessibility checks failed")
    print("Theme accessibility checks passed (all API requests intercepted)")


if __name__ == "__main__":
    main()
