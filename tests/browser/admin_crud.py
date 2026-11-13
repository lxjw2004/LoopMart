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


def search_open(page, query, *, open_name=None, has_form=True):
    page.get_by_role("textbox", name="搜索", exact=True).fill(query)
    with page.expect_response(lambda response: "/api/v1/admin/" in response.url and response.request.method == "GET" and "q=" in response.url):
        page.get_by_role("button", name="搜索", exact=True).click()
    # Desktop records expose an explicit open action rather than a clickable row.
    with page.expect_response(lambda response: "/api/v1/admin/" in response.url and response.request.method == "GET" and "q=" not in response.url):
        page.get_by_role("table").get_by_role("button", name="查看 " + (open_name or query), exact=True).click()
    expect(page.get_by_role("button", name="返回", exact=True)).to_be_visible()
    if has_form:
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


def api_data(page, path, method="GET", data=None):
    response = page.request.fetch(ADMIN_URL + "/api/v1" + path, method=method, data=data)
    assert response.ok, f"Fixture/read {method} {path}: {response.status}"
    result = response.json()
    return result.get("data", result)


def settings_fields(page, settings):
    page.get_by_label("允许邮箱后缀（逗号分隔）", exact=True).fill(",".join(settings.get("allowedEmailDomains", [])))
    page.get_by_label("允许所有邮箱", exact=True).select_option(str(settings.get("allowAllEmailDomains", False)).lower())
    page.get_by_label("社区管理员 ID", exact=True).fill(settings.get("communityAdminUserId") or "")
    page.get_by_label("中文隐私政策", exact=True).fill(settings.get("privacyPolicyZh") or "")
    page.get_by_label("英文隐私政策", exact=True).fill(settings.get("privacyPolicyEn") or "")
    page.get_by_label("开放联系表单", exact=True).select_option(str(settings.get("contactEnabled", False)).lower())


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
        recipient_id = page.url.rstrip("/").split("/")[-1]
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

        navigate(page, "拼车")
        page.get_by_role("button", name="创建", exact=True).click()
        origin = "Campus " + TAG
        fill(page, {"出发地": origin, "目的地": "Airport", "出发时间": "2026-12-15T09:30", "时区": "America/Indiana/Indianapolis", "费用（美元）": "5.25", "总座位": 3, "剩余座位": 2, "费用说明": "Shared fuel", "备注": "Meet at library"})
        save(page)
        search_open(page, TAG, open_name=origin + " → Airport")
        expect(page.get_by_text("Meet at library", exact=True)).to_be_visible()
        page.get_by_role("button", name="编辑", exact=True).click()
        page.get_by_label("剩余座位", exact=True).fill("1")
        page.get_by_label("备注", exact=True).fill("Updated pickup " + TAG)
        save(page)
        search_open(page, TAG, open_name=origin + " → Airport")
        expect(page.get_by_text("Updated pickup " + TAG, exact=True)).to_be_visible()
        page.get_by_role("button", name="删除", exact=True).click()
        confirm(page)
        print("PASS admin ride create/edit/delete")

        # Fixture writes target only the isolated user created in this run.
        report_ids = []
        for index in range(2):
            report = api_data(page, "/reports", "POST", {"targetType": "user", "targetId": recipient_id, "reason": "spam", "details": TAG + "-report-" + str(index)})
            report_ids.append(report["id"])
        for index, status in enumerate(("reviewed", "dismissed")):
            navigate(page, "举报")
            search_open(page, TAG + "-report-" + str(index), open_name=report_ids[index])
            page.get_by_label("状态", exact=True).select_option(status)
            page.get_by_label("审核说明", exact=True).fill(TAG + " " + status)
            save(page)
            expect(page.get_by_role("article").get_by_text(TAG + " " + status, exact=True)).to_be_visible()
            assert api_data(page, "/admin/reports/" + report_ids[index])["status"] == status
        print("PASS admin report reviewed/dismissed")

        original_settings = api_data(page, "/admin/settings")
        operator = api_data(page, "/me")
        changed_settings = {**original_settings, "communityAdminUserId": original_settings.get("communityAdminUserId") or operator["id"], "contactEnabled": True, "privacyPolicyZh": "隐私 " + TAG, "privacyPolicyEn": "Privacy " + TAG}
        try:
            navigate(page, "设置")
            expect(page.get_by_label("允许所有邮箱", exact=True)).to_be_visible()
            for group in ("认证", "社区身份", "联系", "隐私"):
                expect(page.get_by_role("group", name=group, exact=True)).to_be_visible()
            settings_fields(page, changed_settings)
            save(page)
            current = api_data(page, "/admin/settings")
            for key in ("privacyPolicyZh", "privacyPolicyEn", "contactEnabled", "communityAdminUserId"):
                assert current[key] == changed_settings[key], key
            print("PASS admin settings save")

            contact = api_data(page, "/contact", "POST", {"email": TAG.lower() + "@purdue.edu", "subject": TAG + "-contact", "message": "Please review " + TAG})
            navigate(page, "联系表单")
            search_open(page, TAG + "-contact")
            page.get_by_label("状态", exact=True).select_option("resolved")
            page.get_by_label("审核说明", exact=True).fill("Resolved " + TAG)
            save(page)
            expect(page.get_by_role("article").get_by_text("Resolved " + TAG, exact=True)).to_be_visible()
            assert api_data(page, "/admin/contact/" + contact["id"])["status"] == "resolved"
            print("PASS admin contact resolution")

            navigate(page, "社区消息")
            recipient_search = page.get_by_role("textbox", name="搜索用户", exact=True)
            recipient_search.fill(TAG.lower() + "@purdue.edu")
            recipient_search.locator("..").get_by_role("button", name="搜索", exact=True).click()
            page.get_by_role("button", name=TAG + " · " + TAG.lower() + "@purdue.edu", exact=True).click()
            official_name = api_data(page, "/admin/users/" + changed_settings["communityAdminUserId"])["name"]
            expect(page.get_by_text("发送身份: " + official_name, exact=True)).to_be_visible()
            page.get_by_label("消息", exact=True).fill("Official message " + TAG)
            page.get_by_role("button", name="保存", exact=True).click()
            expect(page.get_by_role("dialog")).to_contain_text("发送身份: " + official_name + " · 收件人: " + TAG)
            confirm(page)
            conversations = api_data(page, "/admin/community-messages?q=" + TAG)
            assert conversations, "Official conversation must exist"
            conversation = next(row for row in conversations if row.get("otherUser", {}).get("id") == recipient_id)
            messages = api_data(page, "/admin/community-messages/" + conversation["id"] + "/messages")
            sent = next(row for row in messages if row["text"] == "Official message " + TAG)
            assert sent.get("senderId", sent.get("sender_id")) == changed_settings["communityAdminUserId"], "Official identity must be actual sender"
            print("PASS admin configured community message identity/recipient")
        finally:
            # Restore exact prior shared settings even when a later assertion fails.
            restored = api_data(page, "/admin/settings", "PATCH", {**original_settings, "reason": "Restore browser test settings " + TAG})
            for key, value in original_settings.items():
                assert restored.get(key) == value, "Settings restoration: " + key

        navigate(page, "总览")
        expect(page.get_by_role("heading", name="总览", exact=True)).to_be_visible()
        counts = api_data(page, "/admin/overview")
        for key in ("users", "items", "rides", "reports"):
            assert int(counts[key]) >= 0
        clean(page)
        navigate(page, "审计日志")
        audit_rows = api_data(page, "/admin/audit?q=" + TAG)
        assert audit_rows, "Audited writes must create records"
        audit = next(row for row in audit_rows if row.get("before_data") or row.get("beforeData"))
        search_open(page, audit["id"], has_form=False)
        expect(page.get_by_role("heading", name="变更前", exact=True)).to_be_visible()
        expect(page.get_by_role("heading", name="变更后", exact=True)).to_be_visible()
        assert "Only-test-" + TAG not in page.locator("main").inner_text()
        assert "Changed-only-test-" + TAG not in page.locator("main").inner_text()
        print("PASS admin overview/audit structured read")

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
