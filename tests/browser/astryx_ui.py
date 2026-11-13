"""Deterministic Astryx UI smoke test; requires already-running Web/Admin servers.

Run: python3 tests/browser/astryx_ui.py
All API/auth traffic is fulfilled in the browser. This test never writes to a DB.
Override LOOPMART_WEB_URL, LOOPMART_ADMIN_URL or PLAYWRIGHT_CHROMIUM_EXECUTABLE
when the local servers/browser use non-default locations.
"""

import argparse
import copy
import json
import os
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".superpowers" / "e2e" / "astryx"
WEB = os.environ.get("LOOPMART_WEB_URL", "http://localhost:3000").rstrip("/")
ADMIN = os.environ.get("LOOPMART_ADMIN_URL", "http://localhost:3004").rstrip("/")
STAMP = "2026-11-13T09:00:00.000Z"
MEMBER = {
    "id": "member-1", "name": "Campus member", "email": "member@example.test",
    "emailVerified": True, "role": "member", "banned": False,
    "createdAt": STAMP, "updatedAt": STAMP,
}
ADMIN_USER = {**MEMBER, "id": "admin-1", "name": "Community admin", "role": "admin"}
SELLER = {**MEMBER, "id": "seller-1", "name": "Book seller"}
ITEM = {
    "id": "item-1", "title": "Campus calculus book", "description": "A clean campus textbook.",
    "category": "books", "condition": "good", "deliveryMethod": "pickup", "priceCents": 1234,
    "status": "active", "publisherId": SELLER["id"], "publisherName": SELLER["name"],
    "createdAt": STAMP, "updatedAt": STAMP,
}
RIDE = {
    "id": "ride-1", "origin": "Purdue campus", "destination": "Indianapolis airport",
    "departureTime": "2026-12-01T14:30:00.000Z", "timeZone": "America/Indiana/Indianapolis",
    "feeCents": 500, "feeDescription": "Shared fuel", "totalSeats": 3, "availableSeats": 2,
    "notes": "Meet near the library", "status": "active", "publisherId": SELLER["id"],
    "publisherName": SELLER["name"], "createdAt": STAMP, "updatedAt": STAMP,
}
MESSAGE = {"id": "message-1", "senderId": SELLER["id"], "text": "The book is available.", "createdAt": STAMP}
CONVERSATION = {
    "id": "conversation-1", "otherUser": SELLER, "userA": MEMBER["id"], "userB": SELLER["id"],
    "lastMessage": MESSAGE, "unreadCount": 1, "createdAt": STAMP, "updatedAt": STAMP,
}
SETTINGS = {
    "allowedEmailDomains": ["purdue.edu"], "allowAllEmailDomains": False,
    "communityAdminUserId": ADMIN_USER["id"], "contactEnabled": True,
    "privacyPolicyZh": "校园社区隐私政策。", "privacyPolicyEn": "Campus community privacy policy.",
}


class Fixture:
    def __init__(self, admin=False, signed_in=True):
        self.user = copy.deepcopy(ADMIN_USER if admin else MEMBER)
        self.signed_in = signed_in
        self.items = [copy.deepcopy(ITEM)]
        self.rides = [copy.deepcopy(RIDE)]
        self.users = [copy.deepcopy(SELLER), copy.deepcopy(MEMBER), copy.deepcopy(ADMIN_USER)]
        self.messages = [copy.deepcopy(MESSAGE)]
        self.favorites = {ITEM["id"]}
        self.writes = []
        self.unexpected = []
        self.fail_next_user_update = False
        self.expected_http_errors = set()
        self.reports = [{
            "id": "report-1", "targetType": "item", "targetId": ITEM["id"], "reporterId": MEMBER["id"],
            "reason": "spam", "details": "Please review this listing.", "status": "pending", "createdAt": STAMP,
        }]
        self.contact = [{
            "id": "contact-1", "subject": "Community question", "email": MEMBER["email"],
            "message": "Can I arrange a campus pickup?", "status": "open", "createdAt": STAMP,
        }]
        self.audit = [{
            "id": "audit-1", "actorId": ADMIN_USER["id"], "action": "update", "resource": "items",
            "resourceId": ITEM["id"], "targetId": ITEM["id"], "reason": "Reviewed listing",
            "beforeData": {"status": "reported"}, "afterData": {"status": "active"}, "createdAt": STAMP,
        }]

    def install(self, context):
        context.route("**/api/**", self.route)
        # Keep the event transport deterministic and avoid a persistent SSE request
        # preventing network-idle or leaking requests to an actual backend.
        context.add_init_script("""
          window.__loopmartFixtureEvents = [];
          window.EventSource = class extends EventTarget {
            constructor() { super(); this.readyState = 1; window.__loopmartFixtureEvents.push(this);
              this.timer = setTimeout(() => this.dispatchEvent(new Event('open')), 0); }
            close() { clearTimeout(this.timer); this.readyState = 2; }
          };
        """)

    def route(self, route):
        request = route.request
        parsed = urlparse(request.url)
        pathname = parsed.path
        method = request.method
        query = parse_qs(parsed.query)

        def reply(value, paged=False):
            payload = {"data": value, "nextCursor": None} if paged else {"data": value}
            route.fulfill(status=200, json=payload)

        if pathname.startswith("/api/auth/"):
            self.writes.append((method, pathname, request.post_data_json))
            self.signed_in = not pathname.endswith("sign-out")
            route.fulfill(status=200, json={"user": self.user, "success": True})
            return
        if not pathname.startswith("/api/v1/"):
            self.unexpected.append((method, pathname))
            route.fulfill(status=501, json={"error": {"code": "UNMOCKED", "message": "Unmocked API"}})
            return
        endpoint = pathname[len("/api/v1"):]
        if method == "GET" and endpoint == "/me":
            if self.signed_in:
                reply(self.user)
            else:
                route.fulfill(status=200, body="null", content_type="application/json")
            return
        if method == "GET" and endpoint in ["/public/settings", "/admin/settings"]:
            reply(SETTINGS)
            return
        if method == "GET" and endpoint == "/admin/overview":
            reply({"users": 3, "items": len(self.items), "rides": 1, "reports": 1, "conversations": 1})
            return
        if method == "GET" and endpoint.startswith("/profiles/"):
            reply({**SELLER, "items": self.items, "rides": self.rides})
            return
        if method == "GET" and endpoint == "/favorites":
            reply([item for item in self.items if item["id"] in self.favorites], True)
            return

        parts = endpoint.strip("/").split("/")
        if parts[0] in ["admin", "me"]:
            parts = parts[1:]
        resource = parts[0] if parts else ""
        record_id = parts[1] if len(parts) > 1 else None
        datasets = {
            "items": self.items, "rides": self.rides, "users": self.users,
            "reports": self.reports, "contact": self.contact, "audit": self.audit,
            "conversations": [CONVERSATION], "community-messages": [CONVERSATION],
        }
        if method == "GET" and resource in ["conversations", "community-messages"] and record_id:
            reply(self.messages, True)
            return
        if method == "GET" and resource in datasets:
            records = datasets[resource]
            if record_id:
                reply(next((row for row in records if row["id"] == record_id), records[0]))
            else:
                search = query.get("q", [""])[0].lower()
                reply([row for row in records if search in json.dumps(row).lower()], True)
            return

        if method in ["POST", "PUT", "PATCH", "DELETE"]:
            body = request.post_data_json if request.post_data else {}
            self.writes.append((method, endpoint, body))
            if self.fail_next_user_update and method == "PATCH" and endpoint.startswith("/admin/users/"):
                self.fail_next_user_update = False
                self.expected_http_errors.add(request.url)
                route.fulfill(status=503, json={"error": {"code": "UNAVAILABLE", "message": "Temporary fixture failure"}})
                return
            if endpoint.startswith("/favorites/"):
                favorite_id = endpoint.rsplit("/", 1)[-1]
                if method == "DELETE":
                    self.favorites.discard(favorite_id)
                else:
                    self.favorites.add(favorite_id)
                reply({"ok": True})
                return
            if resource in ["conversations", "community-messages"]:
                if endpoint.endswith("/messages") and method == "POST":
                    message = {**MESSAGE, **body, "id": "message-" + str(len(self.messages) + 1), "senderId": self.user["id"]}
                    self.messages.append(message)
                    reply(message)
                else:
                    reply(CONVERSATION)
                return
            if resource in datasets:
                records = datasets[resource]
                if method == "POST" and record_id is None:
                    record = {**(ITEM if resource == "items" else RIDE), **body,
                              "id": resource + "-new", "publisherId": self.user["id"]}
                    records.append(record)
                    reply(record)
                else:
                    record = next((row for row in records if row["id"] == record_id), records[0])
                    record.update(body)
                    reply(record)
                return
            if endpoint in ["/me", "/admin/settings"]:
                reply(self.user if endpoint == "/me" else SETTINGS)
                return
        self.unexpected.append((method, endpoint))
        route.fulfill(status=501, json={"error": {"code": "UNMOCKED", "message": "Unmocked API"}})


def open_page(page, base, path):
    page.goto(base + path, wait_until="networkidle")
    page.wait_for_function("document.readyState === 'complete'")


def assert_clean(page):
    alerts = [value for value in page.get_by_role("alert").all_inner_texts() if value.strip()]
    assert not alerts, (page.url, alerts)


def assert_width(page, width):
    page.set_viewport_size({"width": width, "height": 1000 if width > 390 else 844})
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
    dimensions = page.evaluate("({scroll: document.documentElement.scrollWidth, viewport: innerWidth})")
    assert dimensions["scroll"] <= dimensions["viewport"], f"Horizontal overflow at {width}: {page.url} {dimensions}"


def screenshot(page, name):
    page.screenshot(path=str(OUT / (name + ".png")), full_page=True)


def capture_errors(page, fixture, failures):
    page.on("pageerror", lambda error: failures.append(str(error)))

    def console(message):
        if message.type != "error":
            return
        if message.location.get("url") in fixture.expected_http_errors and "503" in message.text:
            return
        failures.append(message.text)

    page.on("console", console)


def select_option(page, label, value, option_name):
    field = page.get_by_role("combobox", name=label, exact=True)
    if field.evaluate("element => element.tagName") == "SELECT":
        field.select_option(value)
    else:
        field.click()
        page.get_by_role("option", name=option_name, exact=True).click()


def public_interactions(page, fixture):
    open_page(page, WEB, "/items")
    expect(page.get_by_role("navigation", name="主导航", exact=True)).to_be_visible()
    search = page.get_by_role("searchbox", name="搜索商品", exact=True)
    search.fill("Campus")
    search.press("Enter")
    expect(page).to_have_url(WEB + "/items?q=Campus")
    expect(page.get_by_role("heading", name=ITEM["title"], exact=True)).to_be_visible()
    page.get_by_role("navigation", name="主导航", exact=True).get_by_role("link", name="拼车", exact=True).click()
    expect(page).to_have_url(WEB + "/rides")
    expect(page.get_by_text("Indianapolis airport", exact=False).first).to_be_visible()
    page.go_back(wait_until="networkidle")
    expect(page).to_have_url(WEB + "/items?q=Campus")

    school = page.get_by_role("button", name=re.compile("^选择学校:"))
    school.click()
    school_dialog = page.get_by_role("dialog", name="选择学校", exact=True)
    expect(school_dialog.get_by_role("searchbox", name="搜索学校", exact=True)).to_be_focused()
    school_dialog.get_by_role("searchbox", name="搜索学校", exact=True).fill("PUWL")
    school_dialog.get_by_role("button", name="Purdue University - West Lafayette", exact=True).click()
    expect(school_dialog).not_to_be_visible()
    expect(school).to_be_focused()
    school.click()
    school_dialog.get_by_role("searchbox", name="搜索学校", exact=True).fill("no such campus")
    expect(school_dialog.get_by_text("未找到学校", exact=True)).to_be_visible()
    page.keyboard.press("Escape")
    expect(school_dialog).not_to_be_visible()
    expect(school).to_be_focused()

    open_page(page, WEB, "/publish?kind=items")
    before = len(fixture.writes)
    page.get_by_role("button", name="发布商品", exact=True).click()
    assert len(fixture.writes) == before, "Empty required fields must prevent submission"
    page.get_by_label("标题", exact=True).fill("Astryx published textbook")
    page.get_by_label("描述", exact=True).fill("Deterministic form smoke test")
    page.get_by_label("价格（美元）", exact=True).fill("12.34")
    page.get_by_role("button", name="发布商品", exact=True).click()
    expect(page.get_by_role("alert").filter(has_text="分类")).to_be_visible()
    assert len(fixture.writes) == before, "A missing required selector must prevent submission"
    expect(page.get_by_role("combobox", name="分类", exact=True)).to_be_focused()
    select_option(page, "分类", "books", "书籍")
    select_option(page, "成色", "good", "良好")
    select_option(page, "交付方式", "pickup", "自取")
    page.get_by_role("button", name="发布商品", exact=True).click()
    expect(page.get_by_role("heading", name="Astryx published textbook", exact=True)).to_be_visible()
    posted = [body for method, endpoint, body in fixture.writes if method == "POST" and endpoint == "/items"]
    assert posted and posted[-1]["priceCents"] == 1234, "Form must preserve dollar-to-cent conversion"

    open_page(page, WEB, "/messages/conversation-1")
    expect(page.get_by_role("region", name="聊天", exact=True).get_by_text(MESSAGE["text"], exact=True)).to_be_visible()
    page.get_by_label("消息内容", exact=True).fill("Is campus pickup possible?")
    page.get_by_role("button", name="发送", exact=True).click()
    expect(page.get_by_text("Is campus pickup possible?", exact=True)).to_be_visible()
    expect(page.get_by_label("消息内容", exact=True)).to_have_value("")
    assert_clean(page)

    open_page(page, WEB, "/items")
    assert_width(page, 390)
    page.get_by_role("button", name="筛选", exact=True).click()
    dialog = page.get_by_role("dialog")
    expect(dialog).to_be_visible()
    expect(dialog.get_by_label("最低价格", exact=True)).to_be_visible()
    dialog.get_by_label("最低价格", exact=True).fill("5.00")
    dialog.get_by_role("button", name="应用筛选", exact=True).click()
    expect(dialog).not_to_be_visible()
    assert "minPriceCents=500" in page.url
    assert_width(page, 320)
    screenshot(page, "web-mobile")
    print("PASS public search/history, school picker focus/search/select/Escape, required form fields, item publish, chat and mobile filters")


def admin_interactions(page, fixture):
    open_page(page, ADMIN, "/admin/users/seller-1")
    detail = page.get_by_test_id("admin-resource-detail")
    expect(detail.get_by_role("heading", name=SELLER["name"], exact=True)).to_be_visible()
    page.get_by_label("昵称", exact=True).fill("Reviewed seller")
    save = page.get_by_label("昵称", exact=True).locator("xpath=ancestor::form").get_by_role("button", name="保存", exact=True)
    save.click()
    dialog = page.get_by_role("dialog", name="确认操作", exact=True)
    reason = dialog.get_by_role("textbox", name=re.compile("^操作原因(?:\\s|$)"))
    expect(dialog).to_be_visible()
    expect(reason).to_be_focused()
    before = len(fixture.writes)
    expect(dialog.get_by_role("button", name="确认操作", exact=True)).to_be_disabled()
    reason.fill("   ")
    expect(dialog.get_by_role("button", name="确认操作", exact=True)).to_be_disabled()
    reason.fill("Reviewed the account details")
    expect(dialog.get_by_role("button", name="确认操作", exact=True)).to_be_enabled()
    screenshot(page, "admin-confirmation")
    dialog.get_by_role("button", name="取消", exact=True).click()
    expect(dialog).not_to_be_visible()
    assert len(fixture.writes) == before, "Cancel must not submit a mutation"
    expect(save).to_be_focused()
    save.click()
    reason.fill("Reviewed the account details")
    fixture.fail_next_user_update = True
    dialog.get_by_role("button", name="确认操作", exact=True).click()
    expect(dialog.get_by_role("alert")).to_be_visible()
    expect(reason).to_have_value("Reviewed the account details")
    expect(dialog.get_by_role("button", name="确认操作", exact=True)).to_be_enabled()
    dialog.get_by_role("button", name="确认操作", exact=True).click()
    expect(dialog).not_to_be_visible()
    expect(detail.get_by_role("heading", name="Reviewed seller", exact=True)).to_be_visible()
    writes = [body for method, endpoint, body in fixture.writes if method == "PATCH" and endpoint == "/admin/users/seller-1"]
    assert writes and writes[-1]["reason"] == "Reviewed the account details"
    assert_clean(page)
    open_page(page, ADMIN, "/admin/items")
    page.get_by_label("搜索", exact=True).fill("Campus")
    page.get_by_role("button", name="搜索", exact=True).click()
    expect(page.get_by_role("button", name="查看 " + ITEM["title"], exact=True)).to_be_visible()
    screenshot(page, "admin-desktop")
    print("PASS admin form, confirmation focus/required reason/cancel/failure/retry and list search")


def ride_interactions(page, fixture):
    open_page(page, WEB, "/publish?kind=rides")
    origin = page.get_by_role("textbox", name="出发地", exact=True)
    origin.fill("Campus library")
    origin.press("Tab")
    origin.click()
    origin.press("ControlOrMeta+A")
    origin.press("ArrowRight")
    origin.press_sequentially(" south entrance")
    origin.press("Tab")
    expect(origin).to_have_value("Campus library south entrance")
    destination = page.get_by_role("textbox", name="目的地", exact=True)
    destination.fill("Custom airport")
    page.get_by_role("button", name="常用地点：目的地", exact=True).click()
    page.get_by_role("menuitem", name="IND", exact=True).click()
    expect(destination).to_have_value("IND")

    date = page.locator("input[type=date]")
    time = page.locator("input[type=time]")
    expect(date).to_have_count(1)
    expect(time).to_have_count(1)
    date.fill("2026-12-01")
    date.press("Tab")
    time.fill("09:30")
    time.press("Tab")
    select_option(page, "时区", "America/Chicago", "中部时间（Chicago）")
    for label, value in [("费用（美元）", "5.25"), ("总座位", "3"), ("剩余座位", "2")]:
        page.get_by_label(label, exact=True).fill(value)

    before = len(fixture.writes)
    origin.fill("")
    page.get_by_role("button", name="发布拼车", exact=True).click()
    expect(page.get_by_role("alert").filter(has_text="出发地")).to_be_visible()
    assert len(fixture.writes) == before, "A missing location must prevent submission"
    expect(origin).to_be_focused()
    origin.fill("Campus library south entrance")

    # Clearing a committed date must not leave the old datetime in the payload.
    # Native date/time surfaces also keep impossible dates out of the model.
    before = len(fixture.writes)
    date.fill("")
    date.press("Tab")
    expect(date).to_have_value("")
    page.get_by_role("button", name="发布拼车", exact=True).click()
    page.wait_for_load_state("networkidle")
    assert len(fixture.writes) == before, "An empty visible date must not submit the last committed datetime"
    expect(page).to_have_url(WEB + "/publish?kind=rides")

    date.fill("2026-12-02")
    date.press("Tab")
    time.fill("09:30")
    time.press("Tab")
    # DateTimeInput uses the native platform calendar, so its date value is ISO
    # regardless of the visible locale or the browser's timezone.
    expect(date).to_have_value("2026-12-02")
    expect(time).to_have_value("09:30")
    page.get_by_role("button", name="发布拼车", exact=True).click()
    expect(page.get_by_role("heading", name="Campus library south entrance → IND", exact=True)).to_be_visible()
    posted = [body for method, endpoint, body in fixture.writes if method == "POST" and endpoint == "/rides"]
    assert posted, "Ride form did not send its payload"
    assert {key: posted[-1][key] for key in ["origin", "destination", "departureTime", "timeZone", "feeCents", "totalSeats", "availableSeats"]} == {
        "origin": "Campus library south entrance", "destination": "IND",
        "departureTime": "2026-12-02T15:30:00.000Z", "timeZone": "America/Chicago",
        "feeCents": 525, "totalSeats": 3, "availableSeats": 2,
    }, "Chicago wall-clock date/time must not drift with the browser's Asia/Shanghai timezone"
    assert_clean(page)
    print("PASS ride free-text editing/presets, native datetime, cleared-date guard and exact UTC/cents/seats")


def chat_history(page, fixture):
    previous = fixture.messages
    try:
        fixture.messages = [{**MESSAGE, "id": f"history-{index}", "text": f"History {index}: " + "Campus pickup details. " * 15} for index in range(45)]
        for width in [1440, 390]:
            assert_width(page, width)
            open_page(page, WEB, "/messages/conversation-1")
            expect(page.get_by_text(fixture.messages[-1]["text"], exact=True)).to_be_in_viewport()
            scroller = page.locator(".messages")
            scroller.evaluate("node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); }")
            incoming = {**MESSAGE, "id": f"incoming-{width}", "text": f"A new pickup message at width {width}"}
            fixture.messages.append(incoming)
            page.evaluate("window.__loopmartFixtureEvents.filter(source => source.readyState === 1).forEach(source => source.dispatchEvent(new Event('message')))")
            page.get_by_role("button", name="新消息", exact=True).click()
            expect(page.get_by_text(incoming["text"], exact=True)).to_be_in_viewport()
        screenshot(page, "messages-history")
        print("PASS 45-message chat initial bottom, scroll-away notification and return-to-bottom at desktop/mobile")
    finally:
        fixture.messages = previous


def route_matrix(page, admin=False):
    base = ADMIN if admin else WEB
    paths = (["/admin/" + path for path in [
        "overview", "users", "items", "rides", "reports", "conversations", "community-messages", "contact", "settings", "audit",
        "users/seller-1", "items/item-1", "rides/ride-1", "reports/report-1", "contact/contact-1", "audit/audit-1", "conversations/conversation-1",
    ]] if admin else [
        "/items", "/rides", "/items/item-1", "/rides/ride-1", "/publish?kind=items", "/publish?kind=rides",
        "/messages", "/messages/conversation-1", "/favorites", "/account", "/profiles/seller-1", "/contact", "/privacy", "/missing-page",
    ])
    for english in [False, True]:
        page.evaluate("language => localStorage.setItem('loopmart-language', language)", "en" if english else "zh")
        for path in paths:
            open_page(page, base, path)
            expect(page.locator("html")).to_have_attribute("lang", "en" if english else "zh")
            for width in [1440, 390, 320]:
                assert_width(page, width)
            assert_clean(page)
        if english:
            open_page(page, base, "/admin/items" if admin else "/items")
            expect(page.get_by_role("heading", name="Items" if admin else "Market", exact=True).first).to_be_visible()
            page.get_by_role("button", name="中文", exact=True).click()
            expect(page.locator("html")).to_have_attribute("lang", "zh")
    open_page(page, base, "/admin/items" if admin else "/items")
    assert_width(page, 1440)
    screenshot(page, "admin-desktop" if admin else "web-desktop")
    assert_width(page, 320)
    screenshot(page, "admin-mobile" if admin else "web-small-mobile")
    print(f"PASS {'admin' if admin else 'public'} {len(paths)} routes × 2 locales × 3 widths; no overflow or alerts")


def mobile_navigation(page, admin=False):
    base = ADMIN if admin else WEB
    for english in [False, True]:
        page.evaluate("language => localStorage.setItem('loopmart-language', language)", "en" if english else "zh")
        for width in [390, 320]:
            assert_width(page, width)
            open_page(page, base, "/admin/items" if admin else "/items")
            expect(page.get_by_role("link", name=re.compile("^LoopMart")).filter(visible=True).first).to_be_in_viewport()
            if not admin:
                navigation = page.get_by_role("navigation", name="Mobile navigation" if english else "移动导航", exact=True)
                expect(navigation).to_be_visible()
                expect(navigation.get_by_role("link", name="Market" if english else "市场", exact=True)).to_have_attribute("aria-current", "page")
                destinations = ["Market", "Rides", "Publish", "Messages", "Account"] if english else ["市场", "拼车", "发布", "消息", "我的"]
                for destination in destinations:
                    name = re.compile("^" + re.escape(destination) + r"(?:\s+\d+\+?)?$")
                    expect(navigation.get_by_role("link", name=name)).to_be_in_viewport()
                bounds = navigation.bounding_box()
                assert abs(bounds["y"] + bounds["height"] - page.viewport_size["height"]) <= 1
                if not english and width == 390:
                    screenshot(page, "web-mobile-navigation")
                navigation.get_by_role("link", name="Rides" if english else "拼车", exact=True).click()
                expect(page).to_have_url(base + "/rides")
                expect(navigation.get_by_role("link", name="Rides" if english else "拼车", exact=True)).to_have_attribute("aria-current", "page")
                assert_width(page, width)
                continue
            toggle = page.get_by_role("banner").locator("button[aria-controls][aria-expanded]").filter(visible=True)
            expect(toggle).to_have_count(1)
            expect(toggle).to_have_accessible_name(re.compile(".+"))
            expect(toggle).to_be_in_viewport()
            toggle.click()
            drawer = page.get_by_role("dialog").filter(visible=True)
            expect(drawer).to_be_visible()
            assert drawer.evaluate("node => node.matches(':modal') || node.getAttribute('aria-modal') === 'true'"), "Mobile navigation must be modal"
            current = "Items" if admin and english else "商品" if admin else "Market" if english else "市场"
            expect(drawer.get_by_role("link", name=current, exact=True)).to_have_attribute("aria-current", "page")
            destinations = (["Users", "Items", "Rides", "Reports", "Settings"] if english else ["用户", "商品", "拼车", "举报", "设置"]) if admin else (["Market", "Rides", "Saved", "Messages", "My listings"] if english else ["市场", "拼车", "收藏", "消息", "我的发布"])
            for destination in destinations:
                name = re.compile("^" + re.escape(destination) + r"(?:\s+\d+\+?)?$")
                expect(drawer.get_by_role("link", name=name)).to_be_visible()
            if not english and width == 390:
                screenshot(page, "admin-mobile-menu" if admin else "web-mobile-menu")
            drawer.get_by_role("link", name="Rides" if english else "拼车", exact=True).click()
            expect(page).to_have_url(base + ("/admin/rides" if admin else "/rides"))
            expect(drawer).not_to_be_visible()
            assert_width(page, width)
    print(f"PASS {'admin mobile menu/close' if admin else 'public fixed bottom navigation'} destinations/current selection/navigation in 2 locales at 320/390")


def assert_label_unclipped(button):
    clipped = button.evaluate("""button => {
      const failures = [], walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let text = walker.nextNode(); text; text = walker.nextNode()) {
        if (!text.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(text);
        const bounds = range.getBoundingClientRect();
        for (let element = text.parentElement; element && element !== button.parentElement; element = element.parentElement) {
          const style = getComputedStyle(element);
          if (element === button || ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
            const clip = element.getBoundingClientRect();
            if (bounds.left < clip.left - 1 || bounds.right > clip.right + 1)
              failures.push({text: text.textContent, textWidth: bounds.width, available: clip.width});
          }
        }
      }
      return failures;
    }""")
    assert not clipped, f"Button label is visually clipped: {clipped}"


def chat_composer_labels(page):
    for english in [False, True]:
        page.evaluate("language => localStorage.setItem('loopmart-language', language)", "en" if english else "zh")
        for width in [320, 390]:
            assert_width(page, width)
            open_page(page, WEB, "/messages/conversation-1")
            page.get_by_label("Message" if english else "消息内容", exact=True).fill("A short fixture message")
            send = page.get_by_role("button", name="Send" if english else "发送", exact=True)
            expect(send).to_be_enabled()
            expect(send).to_be_in_viewport()
            assert_label_unclipped(send)
            if width == 320:
                screenshot(page, "chat-en-320" if english else "chat-zh-320")
    print("PASS complete Chinese/English send labels at 320/390; no ellipsis or clipping")


def auth_interactions(browser, admin, failures):
    fixture = Fixture(admin=admin, signed_in=False)
    context = browser.new_context(viewport={"width": 390, "height": 844}, timezone_id="Asia/Shanghai")
    fixture.install(context)
    page = context.new_page()
    capture_errors(page, fixture, failures)
    open_page(page, ADMIN if admin else WEB, "/admin/login" if admin else "/login")
    expect(page.get_by_label("邮箱", exact=True)).to_be_visible()
    page.get_by_label("邮箱", exact=True).fill("member@example.test")
    page.get_by_label("密码", exact=True).fill("browser-fixture-password")
    page.get_by_label("邮箱", exact=True).locator("xpath=ancestor::form").locator("button[type=submit]").click()
    expect(page).to_have_url((ADMIN + "/admin/overview") if admin else (WEB + "/items"))
    assert_width(page, 320)
    assert not fixture.unexpected, fixture.unexpected
    context.close()
    print(f"PASS {'admin' if admin else 'public'} mocked sign-in")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "web", "admin"], default="all")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    with sync_playwright() as playwright:
        launch = {"headless": True}
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if executable:
            launch["executable_path"] = executable
        browser = playwright.chromium.launch(**launch)
        try:
            for admin in [False, True]:
                if args.case == ("web" if admin else "admin"):
                    continue
                fixture = Fixture(admin=admin)
                context = browser.new_context(viewport={"width": 1440, "height": 1000}, timezone_id="Asia/Shanghai")
                fixture.install(context)
                page = context.new_page()
                capture_errors(page, fixture, failures)
                try:
                    if admin:
                        admin_interactions(page, fixture)
                    else:
                        public_interactions(page, fixture)
                        ride_interactions(page, fixture)
                        chat_history(page, fixture)
                    route_matrix(page, admin)
                    mobile_navigation(page, admin)
                    if not admin:
                        chat_composer_labels(page)
                    assert not fixture.unexpected, fixture.unexpected
                except Exception:
                    screenshot(page, "failure-admin" if admin else "failure-web")
                    raise
                context.close()
                auth_interactions(browser, admin, failures)
            assert not failures, failures
            print("PASS no unhandled browser exceptions; all API requests mocked; no database writes")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
