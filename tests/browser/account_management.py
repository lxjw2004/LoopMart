"""Account-center regression with intercepted API/auth traffic and no database.

Run against an already-running Web server:
LOOPMART_WEB_URL=http://localhost:3000 .venv/bin/python tests/browser/account_management.py
Use --case to run layout, state, actions, favorites, or posts independently.
"""

import argparse
import copy
import json
import os
from pathlib import Path
import re
from urllib.parse import parse_qs, urlparse

from playwright.sync_api import expect, sync_playwright

from astryx_ui import Fixture, ITEM, RIDE, SETTINGS, WEB, capture_errors, open_page
from design_language import panel_surface


OUT = Path(__file__).resolve().parents[2] / ".superpowers" / "e2e" / "account-management"
PANELS = {
    "profile": ".account-profile", "posts": ".account-posts",
    "favorites": ".account-favorites",
    "change-password": ".account-password",
}
LABELS = {
    "profile": ("个人资料", "Personal info"), "posts": ("我的发布", "My posts"),
    "favorites": ("收藏", "Saved items"),
    "change-password": ("修改密码", "Change password"), "logout": ("退出登录", "Sign out"),
}


class AccountFixture(Fixture):
    """Mutable profile, real favorites-array contract, and paginated owner lists."""

    def __init__(self):
        super().__init__()
        self.own_posts = {"items": [], "rides": []}
        self.reads = []
        self.page_size = None
        self.fail_next_favorites_read = False
        self.fail_next_favorite_delete = False

    def route(self, route):
        request = route.request
        url = urlparse(request.url)
        query = parse_qs(url.query)
        endpoint = url.path.removeprefix("/api/v1")
        if request.method == "GET" and url.path.startswith("/api/v1/"):
            self.reads.append((endpoint, query))
        if request.method == "PATCH" and endpoint == "/me":
            self.user.update(request.post_data_json)
            self.writes.append(("PATCH", "/me", request.post_data_json))
            route.fulfill(status=200, json={"data": self.user})
            return
        if request.method == "GET" and endpoint == "/favorites":
            if self.fail_next_favorites_read:
                self.fail_next_favorites_read = False
                self.expected_http_errors.add(request.url)
                route.fulfill(status=503, json={"error": {"code": "UNAVAILABLE", "message": "Favorite list unavailable"}})
            else:
                # The existing API returns all active item favorites as one array.
                route.fulfill(status=200, json={"data": [row for row in self.items if row["id"] in self.favorites and row["status"] == "active"]})
            return
        if request.method == "DELETE" and endpoint.startswith("/favorites/") and self.fail_next_favorite_delete:
            self.fail_next_favorite_delete = False
            self.writes.append(("DELETE", endpoint, None))
            self.expected_http_errors.add(request.url)
            route.fulfill(status=503, json={"error": {"code": "UNAVAILABLE", "message": "Favorite removal unavailable"}})
            return
        if request.method == "GET" and endpoint in ["/me/items", "/me/rides"]:
            rows = copy.deepcopy(self.own_posts[endpoint.rsplit("/", 1)[-1]])
            if query.get("q"):
                rows = [row for row in rows if query["q"][0].lower() in json.dumps(row).lower()]
            if query.get("status"):
                rows = [row for row in rows if row["status"] == query["status"][0]]
            next_cursor = None
            if self.page_size:
                offset = int(query.get("cursor", ["0"])[0])
                if offset + self.page_size < len(rows):
                    next_cursor = str(offset + self.page_size)
                rows = rows[offset:offset + self.page_size]
            route.fulfill(status=200, json={"data": rows, "nextCursor": next_cursor})
            return
        super().route(route)


def action(scope, name):
    return scope.get_by_role("button", name=name, exact=True).or_(scope.get_by_role("link", name=name, exact=True))


def no_overflow(page):
    dimensions = page.evaluate("({width:innerWidth,scroll:document.documentElement.scrollWidth})")
    assert dimensions["scroll"] <= dimensions["width"], (page.url, dimensions)


def account_page(page, path="/account/listings"):
    open_page(page, WEB, path)
    expect(page.locator(".account-layout")).to_be_visible()
    expect(page.get_by_role("heading", level=1)).to_have_count(1)


def assert_header(page, english=False, signed_in=True):
    tabs = page.locator(".subnav nav").get_by_role("link")
    expect(tabs).to_have_count(2)
    expect(tabs).to_have_text(["Market", "Rides"] if english else ["市场", "拼车"])
    account_label = ("Account" if english else "我的") if signed_in else ("Sign in" if english else "登录")
    expect(page.locator(".account-link")).to_have_text(account_label)


def assert_selected(control):
    expect(control).to_have_attribute("aria-current", re.compile(r"^(?:page|true|location)$"))
    expect(control).to_have_css("background-color", "rgb(237, 242, 255)")


def assert_panel(page, selected):
    for name, selector in PANELS.items():
        panel = page.locator(selector)
        expect(panel).to_have_count(1)
        if name == selected:
            expect(panel).to_be_visible()
        else:
            expect(panel).to_be_hidden()
            expect(panel).to_have_attribute("hidden", "")
            expect(panel).to_have_css("display", "none")
    email = page.locator(".account-email")
    expect(email).to_have_count(1)
    expect(page.locator(".account-profile .account-email")).to_have_count(1)
    if selected == "profile":
        expect(email).to_be_visible()
        expect(email.get_by_role("heading", level=3)).to_have_count(1)
    else:
        expect(email).to_be_hidden()
    assert page.locator(".account-content").evaluate("node => [...node.children].filter(child => getComputedStyle(child).display !== 'none').length") == 1, "Exactly one account panel may occupy the right content area"


def select_panel(page, selected, english=False, keyboard=False):
    current = urlparse(page.url)
    before = parse_qs(current.query)
    button = action(page.locator(".account-nav"), LABELS[selected][int(english)])
    if keyboard:
        button.focus()
        page.keyboard.press("Enter")
    else:
        button.click()
    expect(button).to_have_attribute("aria-current", re.compile(r"^(?:page|true|location)$"))
    assert_panel(page, selected)
    after = urlparse(page.url)
    assert after.path == current.path, ("Account tabs must not leave the account shell", current.path, after.path)
    query = parse_qs(after.query)
    assert query.get("tab") == [selected], (selected, page.url)
    for key, value in before.items():
        if key != "tab":
            assert query.get(key) == value, ("Account tab navigation dropped another URL parameter", key, value, query)
    assert_selected(button)


def assert_tab_panels(page):
    tabs = page.locator(".account-posts").get_by_role("tab")
    expect(tabs).to_have_count(2)
    for tab in tabs.all():
        assert tab.get_attribute("aria-controls") == "account-posts-panel"
        panel = page.locator('[id="account-posts-panel"]')
        expect(panel).to_have_count(1)
        expect(panel).to_have_attribute("role", "tabpanel")
        expect(panel).to_be_visible()
    selected = page.locator('.account-posts [role="tab"][aria-selected="true"]')
    expect(selected).to_have_count(1)
    expect(selected).to_have_css("color", "rgb(38, 89, 236)")


def select_status(page, value, label):
    field = page.locator(".account-posts").get_by_role("combobox", name="状态", exact=True)
    if field.evaluate("node => node.tagName") == "SELECT":
        field.select_option(value)
    else:
        field.click()
        page.get_by_role("option", name=label, exact=True).click()


def nav_rect(page):
    return page.locator(".account-nav").evaluate("node => {const r=node.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}}")


def assert_rect(actual, expected):
    assert all(abs(actual[key] - expected[key]) < 1 for key in expected), ("Account sidebar geometry changed between panels", expected, actual)


def layout(page, fixture):
    for english in [False, True]:
        for width in [1440, 1024, 768, 390, 320]:
            page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
            account_page(page)
            if english and page.get_by_role("button", name="EN", exact=True).count():
                page.get_by_role("button", name="EN", exact=True).click()
            expect(page.get_by_role("heading", level=1, name="My posts" if english else "我的发布", exact=True)).to_be_visible()
            assert_panel(page, "posts")
            assert_header(page, english=english)
            nav, content = page.locator(".account-nav"), page.locator(".account-content")
            page.evaluate("window.__accountNav = document.querySelector('.account-nav')")
            initial = nav_rect(page)
            for label in LABELS.values():
                expect(action(nav, label[int(english)])).to_have_count(1)
                expect(action(nav, label[int(english)])).to_be_visible()
            assert nav.locator("svg").count() >= len(LABELS)
            expect(action(nav, "Change email" if english else "修改邮箱")).to_have_count(0)
            nb, cb = nav.bounding_box(), content.bounding_box()
            if width >= 1200:
                assert nb["x"] + nb["width"] < cb["x"] and abs(nb["y"] - cb["y"]) < 2, (width, nb, cb)
            else:
                assert nb["y"] + nb["height"] <= cb["y"] + 1, (width, nb, cb)
            for selected in PANELS:
                select_panel(page, selected, english=english)
                assert page.evaluate("window.__accountNav === document.querySelector('.account-nav')"), "Account navigation DOM was replaced during a panel switch"
                assert_rect(nav_rect(page), initial)
                surface = panel_surface(page.locator(PANELS[selected]))
                assert surface["background"] == "rgb(255, 255, 255)" and float(str(surface["radius"]).removesuffix("px")) > 0, surface
                no_overflow(page)
                if selected == "posts":
                    assert_tab_panels(page)
                    expect(page.locator(".account-posts .astryx-empty-state")).to_be_visible()
                if selected == "profile" and english:
                    contact = page.locator(".account-profile").get_by_role("button", name="Contact admin", exact=True)
                    expect(contact).to_be_visible()
                    labels = contact.locator("*").evaluate_all("""nodes => nodes.filter(node => node.textContent.trim() === 'Contact admin').map(node => ({client:node.clientWidth,scroll:node.scrollWidth}))""")
                    assert labels and all(label["scroll"] <= label["client"] + 1 for label in labels), (width, "Contact label is clipped", labels)
            if width in [1440, 320]:
                page.screenshot(path=str(OUT / f"account-panels-{width}-{'en' if english else 'zh'}.png"), full_page=True)
            print(f"PASS four account panels with embedded profile email, stable sidebar DOM/geometry, header labels and responsive layout: {width}px {'English' if english else 'Chinese'}", flush=True)
    page.get_by_role("button", name="中文", exact=True).click()
    assert not fixture.writes, fixture.writes


def state(page, fixture):
    page.set_viewport_size({"width": 1440, "height": 1000})
    account_page(page, "/account")
    assert_panel(page, "profile")
    # Posts remain available in the account sidebar after leaving the public subnav.
    assert_header(page)
    select_panel(page, "posts")
    assert_panel(page, "posts")
    page.locator(".account-link").click()
    expect(page).to_have_url(WEB + "/account")
    assert_panel(page, "profile")
    account_page(page, "/account?kind=rides")
    profile = page.locator(".account-profile")
    nickname = profile.get_by_role("textbox", name="昵称", exact=True)
    nickname.fill("Unsaved nickname")
    page.evaluate("window.__accountNav = document.querySelector('.account-nav')")
    email = profile.locator(".account-email").get_by_label("邮箱", exact=True)
    email.fill("draft@example.test")
    select_panel(page, "change-password", keyboard=True)
    password = page.locator(".account-password")
    password.get_by_label("当前密码", exact=True).fill("ExistingPassword123!")
    password.get_by_label("新密码", exact=True).fill("ReplacementPassword456!")
    select_panel(page, "posts")
    posts = page.locator(".account-posts")
    posts.get_by_label("搜索", exact=True).fill("draft search")
    select_status(page, "active", "上架中")
    select_panel(page, "profile")
    expect(nickname).to_have_value("Unsaved nickname")
    for expected in ["posts", "change-password", "profile"]:
        page.go_back()
        assert_panel(page, expected)
        assert_selected(action(page.locator(".account-nav"), LABELS[expected][0]))
    expect(email).to_have_value("draft@example.test")
    for expected in ["change-password", "posts", "profile"]:
        page.go_forward()
        assert_panel(page, expected)
    select_panel(page, "change-password")
    expect(password.get_by_label("当前密码", exact=True)).to_have_value("ExistingPassword123!")
    expect(password.get_by_label("新密码", exact=True)).to_have_value("ReplacementPassword456!")
    select_panel(page, "posts")
    expect(posts.get_by_label("搜索", exact=True)).to_have_value("draft search")
    expect(posts.get_by_role("combobox", name="状态", exact=True)).to_have_text("上架中")
    posts.get_by_role("tab", name="市场", exact=True).click()
    expect(posts.get_by_role("tab", name="市场", exact=True)).to_have_attribute("aria-selected", "true")
    select_panel(page, "profile")
    expect(nickname).to_have_value("Unsaved nickname")
    expect(email).to_have_value("draft@example.test")
    select_panel(page, "change-password")
    expect(password.get_by_label("新密码", exact=True)).to_have_value("ReplacementPassword456!")
    assert page.evaluate("window.__accountNav === document.querySelector('.account-nav')")
    for _ in range(12):
        page.keyboard.press("Tab")
        assert page.evaluate("!document.activeElement.closest('[hidden]')"), "Hidden account panels remain in the keyboard focus order"
    for selected in PANELS:
        account_page(page, "/account?kind=rides&tab=" + selected)
        assert_panel(page, selected)
        assert parse_qs(urlparse(page.url).query)["kind"] == ["rides"]
    for path in ["/account?kind=rides&tab=change-email", "/account/listings?kind=rides&tab=change-email"]:
        account_page(page, path)
        assert_panel(page, "profile")
        assert_selected(action(page.locator(".account-nav"), "个人资料"))
        expect(page.locator(".account-profile .account-email").get_by_role("heading", level=3, name="修改邮箱", exact=True)).to_be_visible()
    fixture.signed_in = False
    open_page(page, WEB, "/items")
    assert_header(page, signed_in=False)
    page.get_by_role("button", name="EN", exact=True).click()
    assert_header(page, english=True, signed_in=False)
    page.locator(".account-link").click()
    expect(page).to_have_url(WEB + "/login")
    expect(page.get_by_label("Email", exact=True)).to_be_visible()
    assert not fixture.writes, fixture.writes
    print("PASS My/Account and anonymous header entry, sidebar posts, embedded email drafts/legacy URLs, keyboard, history and form/search state", flush=True)


def actions(page, fixture):
    page.set_viewport_size({"width": 1440, "height": 1000})
    account_page(page, "/account")
    profile = page.locator(".account-profile")
    nickname = profile.get_by_role("textbox", name="昵称", exact=True)
    nickname.fill("Updated campus nickname")
    profile.get_by_role("button", name=re.compile(r"^保存(?:修改)?$")).click()
    expect(nickname).to_have_value("Updated campus nickname")
    expect(profile.get_by_text("Updated campus nickname", exact=True)).to_be_visible()
    assert any(method == "PATCH" and endpoint == "/me" and body.get("name") == "Updated campus nickname" for method, endpoint, body in fixture.writes)
    reads = len([entry for entry in fixture.reads if entry[0] == "/me"])
    assert_header(page)
    email = profile.locator(".account-email")
    email.get_by_label("邮箱", exact=True).fill("changed@example.test")
    email.get_by_role("button", name="修改邮箱", exact=True).click()
    expect(email.get_by_role("status").filter(has_text="请求已提交")).to_be_visible()
    request = next(body for method, endpoint, body in reversed(fixture.writes) if method == "POST" and endpoint == "/api/auth/change-email")
    assert request == {"newEmail": "changed@example.test", "callbackURL": WEB}, request
    assert len([entry for entry in fixture.reads if entry[0] == "/me"]) > reads
    select_panel(page, "change-password")
    password = page.locator(".account-password")
    password.get_by_label("当前密码", exact=True).fill("ExistingPassword123!")
    password.get_by_label("新密码", exact=True).fill("ReplacementPassword456!")
    password.get_by_role("button", name="修改密码", exact=True).click()
    expect(password.get_by_role("status").filter(has_text="已保存")).to_be_visible()
    request = next(body for method, endpoint, body in reversed(fixture.writes) if method == "POST" and endpoint == "/api/auth/change-password")
    assert request == {"currentPassword": "ExistingPassword123!", "newPassword": "ReplacementPassword456!", "revokeOtherSessions": True}, request
    select_panel(page, "profile")
    action(profile, "联系社区管理员").click()
    expect(page).to_have_url(WEB + "/messages/conversation-1")
    assert ("POST", "/conversations", {"otherUserId": SETTINGS["communityAdminUserId"]}) in fixture.writes
    # Existing routes outside the account shell keep their prior behavior.
    open_page(page, WEB, "/favorites")
    expect(page).to_have_url(WEB + "/favorites")
    expect(page.locator(".account-layout")).to_have_count(0)
    fixture.signed_in = False
    open_page(page, WEB, "/login")
    expect(page.get_by_label("邮箱", exact=True)).to_be_visible()
    expect(page.get_by_label("密码", exact=True)).to_be_visible()
    fixture.signed_in = True
    account_page(page)
    action(page.locator(".account-posts"), "去发布").click()
    expect(page).to_have_url(re.compile(re.escape(WEB + "/publish") + r"(?:\?|$)"))
    account_page(page)
    action(page.locator(".account-nav"), "退出登录").click()
    expect(page).to_have_url(WEB + "/login")
    assert any(method == "POST" and path == "/api/auth/sign-out" for method, path, _ in fixture.writes)
    print("PASS profile save, embedded email/password API contracts, administrator contact, unchanged external routes, publish and logout", flush=True)


def favorites(page, fixture):
    page.set_viewport_size({"width": 1440, "height": 1000})
    fixture.items = [{**ITEM, "id": f"saved-item-{i}", "title": f"Saved textbook {i}"} for i in range(3)]
    fixture.favorites = {row["id"] for row in fixture.items}
    fixture.own_posts["rides"] = [{**RIDE, "publisherId": fixture.user["id"]}]
    account_page(page, "/account/listings?kind=rides")
    owner_posts = page.locator(".account-posts")
    owner_posts.get_by_label("搜索", exact=True).fill("Indianapolis")
    select_status(page, "active", "上架中")
    owner_posts.get_by_role("button", name="搜索", exact=True).click()
    expect(owner_posts.locator(".listing-card")).to_have_count(1)
    select_panel(page, "favorites")
    panel = page.locator(".account-favorites")
    expect(panel.locator(".listing-card")).to_have_count(3)
    assert any(path == "/favorites" and not query.get("cursor") for path, query in fixture.reads)
    expect(panel.get_by_role("button", name="加载更多", exact=True)).to_have_count(0)
    fixture.fail_next_favorite_delete = True
    panel.get_by_role("button", name="取消收藏", exact=True).first.click()
    expect(page.get_by_role("alert").filter(has_text=re.compile(r"\S")).filter(visible=True)).to_be_visible()
    expect(panel.locator(".listing-card")).to_have_count(3)
    panel.get_by_role("button", name="取消收藏", exact=True).first.click()
    expect(panel.locator(".listing-card")).to_have_count(2)
    assert any(method == "DELETE" and path == "/favorites/saved-item-0" for method, path, _ in fixture.writes)
    owner_reads = len([entry for entry in fixture.reads if entry[0] == "/me/rides"])
    panel.get_by_role("heading", name="Saved textbook 1", exact=True).click()
    expect(page).to_have_url(WEB + "/items/saved-item-1")
    page.get_by_role("button", name="返回市场", exact=True).click()
    assert_panel(page, "favorites")
    expect(panel.locator(".listing-card")).to_have_count(2)
    select_panel(page, "posts")
    expect(owner_posts.get_by_role("tab", name="拼车", exact=True)).to_have_attribute("aria-selected", "true")
    expect(owner_posts.get_by_label("搜索", exact=True)).to_have_value("Indianapolis")
    expect(owner_posts.get_by_role("combobox", name="状态", exact=True)).to_have_text("上架中")
    expect(owner_posts.locator(".listing-card")).to_have_count(1)
    expect(owner_posts.get_by_text(RIDE["origin"], exact=True)).to_be_visible()
    assert len([entry for entry in fixture.reads if entry[0] == "/me/rides"]) == owner_reads, "Returning from a favorite item detail must restore the cached owner ride list"
    select_panel(page, "favorites")
    for _ in range(2):
        panel.get_by_role("button", name="取消收藏", exact=True).first.click()
    expect(panel.locator(".listing-card")).to_have_count(0)
    expect(panel.locator(".astryx-empty-state")).to_be_visible()
    fixture.favorites = {"saved-item-1"}
    fixture.fail_next_favorites_read = True
    account_page(page)
    select_panel(page, "favorites")
    expect(panel.get_by_role("alert")).to_be_visible()
    action(panel, "重试").click()
    expect(panel.locator(".listing-card")).to_have_count(1)
    expect(panel.get_by_role("alert")).to_have_count(0)
    assert not any(query.get("cursor") for path, query in fixture.reads if path == "/favorites"), "Favorites must keep the existing non-paginated array API"
    print("PASS favorites array load/removal/empty/retry, item detail, and cached ride kind/query/status/rows after return", flush=True)


def posts(page, fixture):
    page.set_viewport_size({"width": 1440, "height": 1000})
    fixture.own_posts["items"] = [{**ITEM, "publisherId": fixture.user["id"]}]
    fixture.own_posts["rides"] = [{**RIDE, "publisherId": fixture.user["id"]}]
    account_page(page)
    panel = page.locator(".account-posts")
    expect(panel.get_by_role("heading", name=ITEM["title"], exact=True)).to_be_visible()
    panel.get_by_label("搜索", exact=True).fill("no-matching-title")
    panel.get_by_role("button", name="搜索", exact=True).click()
    expect(panel.get_by_role("heading", name="没有匹配的发布", exact=True)).to_be_visible()
    assert any(path == "/me/items" and query.get("q") == ["no-matching-title"] for path, query in fixture.reads)
    panel.get_by_label("搜索", exact=True).fill("")
    select_status(page, "active", "上架中")
    panel.get_by_role("button", name="搜索", exact=True).click()
    expect(panel.get_by_role("heading", name=ITEM["title"], exact=True)).to_be_visible()
    assert any(path == "/me/items" and query.get("status") == ["active"] for path, query in fixture.reads)
    select_panel(page, "favorites")
    select_panel(page, "posts")
    expect(panel.get_by_role("combobox", name="状态", exact=True)).to_have_text("上架中")
    expect(panel.get_by_role("heading", name=ITEM["title"], exact=True)).to_be_visible()
    panel.get_by_role("tab", name="拼车", exact=True).click()
    assert parse_qs(urlparse(page.url).query).get("kind") == ["rides"]
    assert_panel(page, "posts")
    assert_tab_panels(page)
    expect(panel.locator(".listing-card")).to_have_count(1)
    assert any(path == "/me/rides" for path, _ in fixture.reads)
    panel.locator(".listing-card").first.click()
    expect(page).to_have_url(WEB + "/rides/" + RIDE["id"])
    account_page(page)
    page.locator(".account-posts .listing-card").first.click()
    expect(page).to_have_url(WEB + "/items/" + ITEM["id"])
    fixture.page_size = 1
    fixture.own_posts["items"] = [{**ITEM, "id": f"account-item-{i}", "title": f"Account pagination book {i}", "publisherId": fixture.user["id"]} for i in range(3)]
    fixture.items = copy.deepcopy(fixture.own_posts["items"])
    account_page(page)
    expect(panel.locator(".listing-card")).to_have_count(1)
    for offset in [1, 2]:
        panel.get_by_role("button", name="加载更多", exact=True).click()
        expect(panel.locator(".listing-card")).to_have_count(offset + 1)
        assert any(path == "/me/items" and query.get("cursor") == [str(offset)] for path, query in fixture.reads)
    expect(panel.get_by_role("button", name="加载更多", exact=True)).to_have_count(0)
    owner_reads = len([entry for entry in fixture.reads if entry[0] == "/me/items"])
    panel.get_by_role("heading", name="Account pagination book 2", exact=True).click()
    expect(page).to_have_url(WEB + "/items/account-item-2")
    page.get_by_role("button", name="返回市场", exact=True).click()
    expect(page.locator(".account-posts .listing-card")).to_have_count(3)
    page.wait_for_load_state("networkidle")
    assert len([entry for entry in fixture.reads if entry[0] == "/me/items"]) == owner_reads
    assert_panel(page, "posts")
    print("PASS post search/status, cross-panel state, kind tabs, detail routes, owner pagination and return cache", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "layout", "state", "actions", "favorites", "posts"], default="all")
    options = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        browser = playwright.chromium.launch(headless=True, **({"executable_path": executable} if executable else {}))
        try:
            for name, test in [("layout", layout), ("state", state), ("actions", actions), ("favorites", favorites), ("posts", posts)]:
                if options.case not in ["all", name]:
                    continue
                context = browser.new_context()
                fixture = AccountFixture()
                fixture.install(context)
                page = context.new_page()
                failures = []
                capture_errors(page, fixture, failures)
                try:
                    test(page, fixture)
                    assert not failures, failures
                    assert not fixture.unexpected, fixture.unexpected
                except Exception:
                    page.screenshot(path=str(OUT / (name + "-failure.png")), full_page=True)
                    raise
                finally:
                    context.close()
        finally:
            browser.close()
    print("PASS account-center regression; all API/auth requests intercepted, no database writes")


if __name__ == "__main__":
    main()
