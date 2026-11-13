"""Admin CRUD regression checks against the seeded browser test environment."""
import os
from pathlib import Path
from e2e import sync_playwright, expect, U, TAG, EXE, fill, clean

ADMIN_URL = os.environ.get("LOOPMART_ADMIN_URL", "http://localhost:3004").rstrip("/")


def navigate(page, name):
    menu = page.get_by_role("button", name="菜单", exact=True)
    if menu.is_visible() and menu.get_attribute("aria-expanded") != "true":
        menu.click()
    page.get_by_role("navigation").get_by_role("button", name=name, exact=True).click()
    expect(page.get_by_role("heading", level=1)).to_be_visible()


def search_open(page, query):
    page.get_by_role("textbox", name="搜索", exact=True).fill(query)
    with page.expect_response(lambda response: "/api/v1/admin/" in response.url and response.request.method == "GET" and "q=" in response.url):
        page.get_by_role("button", name="搜索", exact=True).click()
    # Desktop records expose an explicit open action rather than a clickable row.
    with page.expect_response(lambda response: "/api/v1/admin/" in response.url and response.request.method == "GET" and "q=" not in response.url):
        page.get_by_role("table").get_by_role("button", name="查看 " + query, exact=True).click()
    expect(page.get_by_role("button", name="返回", exact=True)).to_be_visible()
    expect(page.locator("form").first.get_by_role("button", name="保存", exact=True)).to_be_enabled()


def confirm(page):
    dialog = page.get_by_role("dialog", name="确认操作", exact=True)
    expect(dialog).to_be_visible()
    submit = dialog.get_by_role("button", name="确认操作", exact=True)
    expect(submit).to_be_disabled()
    dialog.get_by_role("textbox", name="操作原因", exact=True).fill("  ")
    expect(submit).to_be_disabled()
    dialog.get_by_role("textbox", name="操作原因", exact=True).fill("UI audit " + TAG)
    with page.expect_response(lambda response: "/api/v1/admin/" in response.url and response.request.method in ("POST", "PATCH", "DELETE")) as mutation:
        submit.click()
    assert mutation.value.ok, f"Admin mutation returned {mutation.value.status}"
    body = mutation.value.request.post_data_json
    assert body["reason"] == "UI audit " + TAG, "Nonempty audit reason must accompany mutation"
    expect(dialog).not_to_be_visible()
    clean(page)


def save(page, form=None):
    (form or page).get_by_role("button", name="保存", exact=True).click()
    confirm(page)


def main():
    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=True, executable_path=EXE or pw.chromium.executable_path)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        native_dialogs = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("dialog", lambda dialog: (native_dialogs.append(dialog.type), dialog.dismiss()))
        page.goto(ADMIN_URL + "/login", wait_until="networkidle")
        page.get_by_label("邮箱", exact=True).fill(U[0]["email"])
        page.get_by_label("密码", exact=True).fill(U[0]["password"])
        page.get_by_role("button", name="保存", exact=True).click()
        expect(page.get_by_role("button", name="退出", exact=True)).to_be_visible(timeout=15000)

        navigate(page, "用户")
        page.get_by_text("创建用户", exact=True).click()
        create_form = page.locator("details form")
        create_form.get_by_label("邮箱", exact=True).fill(TAG.lower() + "@purdue.edu")
        create_form.get_by_label("昵称", exact=True).fill(TAG)
        create_form.get_by_label("密码", exact=True).fill("Only-test-" + TAG + "!9")
        save(page, create_form)
        search_open(page, TAG)
        expect(page.get_by_label("角色", exact=True)).to_be_visible()
        password = page.get_by_label("密码", exact=True)
        password.fill("Changed-only-test-" + TAG + "!9")
        save(page, page.locator("form").filter(has=password))
        print("PASS admin create user/set password")

        user_form = page.locator("form").filter(has=page.get_by_label("封禁", exact=True))
        page.get_by_label("封禁", exact=True).select_option("true")
        user_form.get_by_role("button", name="保存", exact=True).click()
        dialog = page.get_by_role("dialog", name="确认操作", exact=True)
        expect(dialog.get_by_role("button", name="确认操作", exact=True)).to_be_disabled()
        writes = []
        listener = lambda request: writes.append(request.url) if "/api/v1/admin/" in request.url and request.method in ("POST", "PATCH", "DELETE") else None
        page.on("request", listener)
        dialog.get_by_role("button", name="取消", exact=True).click()
        expect(dialog).not_to_be_visible()
        page.wait_for_timeout(150)
        page.remove_listener("request", listener)
        assert not writes, "Cancelling confirmation must not issue a write request"
        # Reopen the untouched server record to discard the cancelled form edit.
        navigate(page, "用户")
        search_open(page, TAG)
        expect(page.get_by_label("封禁", exact=True)).to_have_value("false")
        user_form = page.locator("form").filter(has=page.get_by_label("封禁", exact=True))
        page.get_by_label("封禁", exact=True).select_option("true")
        save(page, user_form)
        expect(page.get_by_label("封禁", exact=True)).to_have_value("true")
        page.get_by_label("封禁", exact=True).select_option("false")
        page.get_by_label("角色", exact=True).select_option("admin")
        save(page, user_form)
        expect(page.get_by_label("角色", exact=True)).to_have_value("admin")
        page.get_by_label("角色", exact=True).select_option("member")
        save(page, user_form)
        print("PASS admin cancel/ban/unban/role")

        # A failed write leaves the confirmation and reason available for retry.
        page.get_by_label("封禁", exact=True).select_option("true")
        user_form.get_by_role("button", name="保存", exact=True).click()
        dialog = page.get_by_role("dialog", name="确认操作", exact=True)
        dialog.get_by_role("textbox", name="操作原因", exact=True).fill("Retry audit " + TAG)
        def fail_update(route):
            if route.request.method == "PATCH":
                route.fulfill(status=503, content_type="application/json", body='{"error":{"message":"Temporary test failure"}}')
            else:
                route.continue_()
        page.route("**/api/v1/admin/users/*", fail_update)
        dialog.get_by_role("button", name="确认操作", exact=True).click()
        expect(dialog.get_by_role("alert")).to_be_visible()
        expect(dialog.get_by_role("textbox", name="操作原因", exact=True)).to_have_value("Retry audit " + TAG)
        page.unroute("**/api/v1/admin/users/*", fail_update)
        dialog.get_by_role("button", name="确认操作", exact=True).click()
        expect(dialog).not_to_be_visible()
        expect(page.get_by_label("封禁", exact=True)).to_have_value("true")
        page.get_by_label("封禁", exact=True).select_option("false")
        save(page, user_form)
        print("PASS admin failed confirmation retains reason and supports retry")

        navigate(page, "商品")
        page.get_by_role("button", name="创建", exact=True).click()
        fill(page, {"标题": TAG + "-admin", "描述": "Admin authored text", "价格（美元）": "9.99"})
        page.get_by_label("分类", exact=True).select_option("daily")
        page.get_by_label("成色", exact=True).select_option("new")
        page.get_by_label("交付方式", exact=True).select_option("meetup")
        save(page)
        search_open(page, TAG + "-admin")
        expect(page.get_by_role("heading", name=TAG + "-admin", exact=True).first).to_be_visible()
        page.get_by_role("button", name="编辑", exact=True).click()
        page.get_by_label("描述", exact=True).fill("Edited admin description")
        save(page)
        search_open(page, TAG + "-admin")
        expect(page.get_by_text("Edited admin description", exact=True)).to_be_visible()
        page.get_by_role("button", name="删除", exact=True).click()
        confirm(page)
        print("PASS admin item create/edit/delete")

        page.set_viewport_size({"width": 390, "height": 844})
        navigate(page, "用户")
        expect(page.locator(".admin-record-cards article").first).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), "Admin mobile overflow"
        Path(".superpowers/e2e").mkdir(parents=True, exist_ok=True)
        page.screenshot(path=".superpowers/e2e/admin-mobile.png", full_page=False)
        assert not native_dialogs, f"Unexpected native dialogs: {native_dialogs}"
        assert not errors, errors
        print("PASS admin mobile; no native dialogs or browser exceptions")
        browser.close()


if __name__ == "__main__":
    main()
