"""Draft confirmation and autocomplete regression; API fixtures only, no database."""

import argparse
import os

from playwright.sync_api import expect, sync_playwright

from astryx_ui import Fixture, WEB, capture_errors, open_page


def drafts(browser):
    context = browser.new_context(viewport={"width": 1440, "height": 1000})
    fixture = Fixture()
    fixture.install(context)
    page = context.new_page()
    errors = []
    capture_errors(page, fixture, errors)
    try:
        open_page(page, WEB, "/publish?kind=items")
        title = page.get_by_label("标题", exact=True)
        value = "Preserve this campus book draft"
        title.fill(value)
        key = "loopmart-draft-" + fixture.user["id"] + "-items"
        saved = page.evaluate("key => localStorage.getItem(key)", key)
        assert saved and value in saved
        trigger = page.get_by_role("button", name="丢弃草稿", exact=True)
        trigger.click()
        expect(title).to_have_value(value)
        assert page.evaluate("key => localStorage.getItem(key)", key) == saved
        dialog = page.get_by_role("alertdialog", name="丢弃草稿？", exact=True)
        expect(dialog).to_be_visible()
        cancel = dialog.get_by_role("button", name="取消", exact=True)
        expect(cancel).to_be_focused()
        cancel.click()
        expect(dialog).not_to_be_visible()
        expect(trigger).to_be_focused()
        expect(title).to_have_value(value)
        assert page.evaluate("key => localStorage.getItem(key)", key) == saved

        trigger.click()
        dialog.get_by_role("button", name="丢弃", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(title).to_have_value("")
        assert page.evaluate("key => localStorage.getItem(key)", key) is None

        title.fill(value)
        saved = page.evaluate("key => localStorage.getItem(key)", key)
        page.evaluate("""key => {
          const remove = Storage.prototype.removeItem;
          Storage.prototype.removeItem = function(name) {
            if (name === key) throw new DOMException('Fixture storage failure', 'SecurityError');
            return remove.call(this, name);
          };
        }""", key)
        trigger.click()
        dialog.get_by_role("button", name="丢弃", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(page.get_by_role("alert").filter(has_text="草稿清除失败")).to_be_visible()
        expect(title).to_have_value(value)
        assert page.evaluate("key => localStorage.getItem(key)", key) == saved
        assert not fixture.writes, fixture.writes
        assert not fixture.unexpected, fixture.unexpected
        assert not errors, errors
    finally:
        context.close()
    print("PASS draft opening/cancel preserve input and storage; confirm clears; storage failure preserves input")


def autocomplete(browser):
    for signed_in in [False, True]:
        context = browser.new_context(viewport={"width": 1440, "height": 1000})
        fixture = Fixture(signed_in=signed_in)
        fixture.install(context)
        page = context.new_page()
        errors = []
        capture_errors(page, fixture, errors)
        try:
            if not signed_in:
                open_page(page, WEB, "/login")
                form = page.locator(".auth-page")
                expect(form.locator('input[name="email"]')).to_have_attribute("autocomplete", "email")
                expect(form.locator('input[name="password"]')).to_have_attribute("autocomplete", "current-password")
                page.locator(".auth-modes").get_by_role("button", name="注册", exact=True).click()
                expect(form.locator('input[name="name"]')).to_have_attribute("autocomplete", "name")
                expect(form.locator('input[name="email"]')).to_have_attribute("autocomplete", "email")
                expect(form.locator('input[name="password"]')).to_have_attribute("autocomplete", "new-password")
                page.locator(".auth-modes").get_by_role("button", name="重设密码", exact=True).click()
                expect(form.locator('input[name="password"]')).to_have_attribute("autocomplete", "new-password")
            else:
                open_page(page, WEB, "/account?tab=change-password")
                form = page.locator(".account-password")
                expect(form.locator('input[name="currentPassword"]')).to_have_attribute("autocomplete", "current-password")
                expect(form.locator('input[name="newPassword"]')).to_have_attribute("autocomplete", "new-password")
                expect(page.locator('.account-profile input[name="email"]')).to_have_attribute("autocomplete", "email")
            assert not fixture.writes, fixture.writes
            assert not fixture.unexpected, fixture.unexpected
            assert not errors, errors
        finally:
            context.close()
    print("PASS login/register/reset/change-password autocomplete DOM semantics; no auth submissions")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "drafts", "autocomplete"], default="all")
    options = parser.parse_args()
    with sync_playwright() as playwright:
        launch = {"headless": True}
        if os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM_EXECUTABLE"]
        browser = playwright.chromium.launch(**launch)
        try:
            if options.case in ["all", "drafts"]:
                drafts(browser)
            if options.case in ["all", "autocomplete"]:
                autocomplete(browser)
        finally:
            browser.close()
    print("PASS form regression; all API/auth intercepted, no database writes")


if __name__ == "__main__":
    main()
