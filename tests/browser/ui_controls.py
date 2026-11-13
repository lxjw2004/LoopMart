"""Semantic controls shared by the real-API Astryx browser regressions."""
from datetime import datetime
import re
from playwright.sync_api import expect


OPTION_LABELS = {
    "clothing": ("服饰", "Clothing"), "books": ("书籍", "Books"),
    "furniture": ("家具", "Furniture"), "electronics": ("电子产品", "Electronics"),
    "daily": ("日用品", "Daily essentials"), "other": ("其他", "Other"),
    "new": ("全新", "New"), "like_new": ("近新", "Like new"),
    "good": ("良好", "Good"), "fair": ("一般", "Fair"),
    "pickup": ("自取", "Pickup"), "meetup": ("当面交付", "Meetup"),
    "delivery": ("配送", "Delivery"), "active": ("上架中", "Active"),
    "deactivated": ("已下架", "Deactivated"), "reported": ("被举报", "Reported"),
    "deactivated_violation": ("违规下架", "Violation removed"),
    "pending": ("待审核", "Pending"), "reviewed": ("已审核", "Reviewed"),
    "dismissed": ("已驳回", "Dismissed"), "violation_confirmed": ("确认违规", "Violation confirmed"),
    "user": ("用户", "User"), "admin": ("管理员", "Administrator"),
    "member": ("成员", "Member"), "true": ("是", "Yes"), "false": ("否", "No"),
    "spam": ("垃圾信息", "Spam"), "fraud": ("欺诈", "Fraud"),
    "inappropriate": ("不当内容", "Inappropriate"), "item": ("物品", "Item"),
    "ride": ("拼车", "Ride"), "conversation": ("会话", "Conversation"),
    "open": ("待处理", "Open"), "resolved": ("已处理", "Resolved"),
    "departure_asc": ("出发时间正序", "Earliest departure"),
    "departure_desc": ("出发时间倒序", "Latest departure"),
    "America/Indiana/Indianapolis": ("东部时间（Purdue／Indy）", "Eastern (Purdue / Indy)"),
    "America/Chicago": ("中部时间（Chicago）", "Central (Chicago)"),
}
SELECT_LABELS = {
    "分类", "成色", "交付方式", "时区", "排序", "状态", "原因", "角色", "封禁",
    "允许所有邮箱", "开放联系表单", "目标类型", "Category", "Condition", "Delivery",
    "Time zone", "Sort", "Status", "Reason", "Role", "Banned", "Allow all email domains",
    "Enable contact form", "Target type",
}
DATETIME_LABELS = {"出发时间", "Departure time"}


def english(page):
    return page.locator("html").get_attribute("lang") == "en"


def option_label(page, value):
    return OPTION_LABELS.get(str(value), (str(value), str(value)))[int(english(page))]


def select_value(page, label, value, *, scope=None):
    """Choose by stored enum while exercising the rendered option and its label."""
    field = (scope if scope is not None else page).get_by_role("combobox", name=label, exact=True)
    if field.evaluate("element => element.tagName") == "SELECT":
        field.select_option(str(value))
        return
    if field.get_attribute("aria-expanded") != "true":
        field.click()
    page.get_by_role("option", name=option_label(page, value), exact=True).click()


def expect_selected(page, label, value):
    field = page.get_by_role("combobox", name=label, exact=True)
    if field.evaluate("element => element.tagName") == "SELECT":
        expect(field).to_have_value(str(value))
    else:
        expect(field).to_contain_text(option_label(page, value))


def labelled_control(page, label):
    # Composite fields may also label a surrounding group or popup.
    name = re.compile(r"^" + re.escape(label) + r"(?:\s*[∙·]?\s*(?:可选|Optional))?$", re.IGNORECASE)
    return page.get_by_label(name).and_(page.locator("input, textarea, select, button"))


def set_datetime(page, label, value):
    """Commit the Astryx date and time segments without changing the local zone."""
    date = labelled_control(page, label)
    if date.get_attribute("type") == "datetime-local":
        date.fill(value)
        return
    parsed = datetime.fromisoformat(value)
    date.fill(parsed.strftime("%Y-%m-%d"))
    date.press("Tab")
    time_label = label + (" time" if english(page) else "时间")
    time = labelled_control(page, time_label)
    time.fill(parsed.strftime("%H:%M"))
    time.press("Tab")


def fill_fields(page, values):
    for label, value in values.items():
        if label in DATETIME_LABELS:
            set_datetime(page, label, str(value))
        elif label in SELECT_LABELS:
            select_value(page, label, value)
        else:
            labelled_control(page, label).fill(str(value))


def form_for(page, label):
    return labelled_control(page, label).locator("xpath=ancestor::form")


def admin_navigate(page, name):
    # Let AppShell finish swapping its regions after a viewport change.
    page.evaluate("() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)))")
    link = page.get_by_role("navigation", name="Administration" if english(page) else "管理导航", exact=True).get_by_role("link", name=name, exact=True)
    if not link.is_visible():
        drawer = page.get_by_role("dialog", name="Navigation" if english(page) else "导航", exact=True)
        if not drawer.is_visible():
            menu = page.get_by_role("banner").locator("button[aria-controls][aria-expanded]").filter(visible=True)
            expect(menu).to_have_count(1)
            if menu.get_attribute("aria-expanded") != "true":
                menu.click()
        link = drawer.get_by_role("link", name=name, exact=True)
    link.click()
    expect(page.get_by_role("heading", level=1)).to_be_visible()
