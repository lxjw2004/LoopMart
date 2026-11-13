"""Shell geometry regressions with all API traffic intercepted by Fixture.

Run against the existing Web/Admin servers using the browser test environment:
  .venv/bin/python tests/browser/layout_stability.py
No request reaches an API server and no database is modified.
"""

import argparse
import copy
import os

from playwright.sync_api import expect, sync_playwright

from astryx_ui import ADMIN, WEB, Fixture, ITEM, MEMBER, capture_errors


GEOMETRY = """() => {
  const rect = selector => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map(n => Math.round(n * 100) / 100);
  };
  return {
    width: document.body.clientWidth,
    header: rect('.market-header'),
    row: rect('.header-row'),
    topbar: rect('.admin-topbar'),
    mobileNav: rect('.mobile-nav'),
    content: rect('[role=main]'),
  };
}"""


def settle(page):
    page.wait_for_load_state("networkidle")
    page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")


def open_route(page, base, route):
    page.goto(base + route, wait_until="networkidle")
    settle(page)


def assert_header_fits(page):
    result = page.evaluate("""() => {
      const inner = document.querySelector('.header-inner');
      const row = document.querySelector('.header-row');
      const r = inner.getBoundingClientRect(), h = row.getBoundingClientRect();
      const s = getComputedStyle(inner);
      return {left: h.left, right: h.right,
        start: r.left + parseFloat(s.paddingLeft),
        end: r.right - parseFloat(s.paddingRight)};
    }""")
    assert abs(result["left"] - result["start"]) <= 1 and abs(result["right"] - result["end"]) <= 1, result


def modal_geometry(page, admin, width):
    before = page.evaluate(GEOMETRY)
    if admin:
        if width >= 768:
            return
        toggle = page.get_by_role("banner").locator("button[aria-controls][aria-expanded]").filter(visible=True)
        toggle.click()
    else:
        page.locator(".school-trigger").click()
    expect(page.get_by_role("dialog").filter(visible=True)).to_be_visible()
    page.wait_for_timeout(250)
    assert page.evaluate(GEOMETRY) == before, "Opening a modal moved the page shell"
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog").filter(visible=True)).to_have_count(0)
    page.wait_for_timeout(300)
    assert page.evaluate(GEOMETRY) == before, "Closing a modal moved the page shell"


def select_admin_page(page, name, width):
    if width < 768:
        page.get_by_role("banner").locator("button[aria-controls][aria-expanded]").filter(visible=True).click()
        page.get_by_role("dialog").filter(visible=True).get_by_role("link", name=name, exact=True).click()
    else:
        page.locator(".admin-sidebar").get_by_role("link", name=name, exact=True).click()
    settle(page)


def gutter_geometry(page, fixture, admin, width):
    if admin:
        fixture.users = [{**copy.deepcopy(MEMBER), "id": f"member-{i}", "name": f"Member {i}"} for i in range(40)]
    else:
        fixture.items = [{**copy.deepcopy(ITEM), "id": f"item-{i}"} for i in range(40)]
    open_route(page, ADMIN if admin else WEB, "/admin/users" if admin else "/items")
    expect(page.locator(".admin-shell" if admin else ".web-shell")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollHeight > innerHeight"), "Long fixture must scroll"
    before = page.evaluate(GEOMETRY)
    if not admin:
        assert_header_fits(page)
    modal_geometry(page, admin, width)
    if admin:
        select_admin_page(page, "总览", width)
    else:
        page.locator('.site-footer a[href="/privacy"]').click()
        settle(page)
    after = page.evaluate(GEOMETRY)
    assert after["width"] == before["width"], f"Long/short navigation changed page width: {before} -> {after}"
    for key in ["header", "row", "topbar"]:
        if before[key]:
            # Sticky navigation may follow a restored scroll position, but its width cannot change.
            assert after[key][0] == before[key][0] and after[key][2:] == before[key][2:], (key, before, after)
    modal_geometry(page, admin, width)
    if not admin:
        assert_header_fits(page)
    print(f"PASS {'Admin' if admin else 'Web'} long/short/modal shell geometry at {width}")


def first_paint_geometry(page, admin, width):
    page.add_init_script("""window.__shellFrames = [];
      let count = 0;
      const sample = () => {
        const root = document.querySelector('.market-header,.admin-topbar');
        if (root) {
          const r = root.getBoundingClientRect();
          const frame = [r.x,r.y,r.width,r.height].map(n => Math.round(n * 100) / 100);
          const brand = document.querySelector('.brand,.astryx-app-shell-header a');
          if (brand) {
            const b = brand.getBoundingClientRect();
            frame.push(...[b.x,b.y,b.width,b.height].map(n => Math.round(n * 100) / 100));
          }
          if (JSON.stringify(frame) !== JSON.stringify(window.__shellFrames.at(-1)))
            window.__shellFrames.push(frame);
        }
        if (count++ < 180) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    """)
    open_route(page, ADMIN if admin else WEB, "/admin/overview" if admin else "/items")
    page.wait_for_timeout(300)
    frames = page.evaluate("window.__shellFrames")
    assert len(frames) == 1, f"{'Admin' if admin else 'Web'} {width} shell changed after first paint: {frames}"
    print(f"PASS {'Admin' if admin else 'Web'} first painted shell remains stable at {width}")


def mounted_detail(page, width):
    open_route(page, WEB, "/items")
    page.evaluate("""() => {
      window.__detailDirections = [];
      for (const method of ['appendChild', 'insertBefore']) {
        const original = Node.prototype[method];
        Node.prototype[method] = function (...args) {
          const result = original.apply(this, args), node = args[0];
          if (node.nodeType === 1 && node.isConnected)
            for (const element of [node, ...node.querySelectorAll('.detail-layout')])
              if (element.matches('.detail-layout'))
                window.__detailDirections.push(element.getAttribute('data-direction'));
          return result;
        };
      }
    }""")
    page.locator(".listing-card").first.click()
    expect(page.locator(".detail-layout")).to_be_visible()
    settle(page)
    directions = page.evaluate("window.__detailDirections")
    expected = "vertical" if width < 768 else "horizontal"
    assert directions and all(value == expected for value in directions), directions
    print(f"PASS newly mounted detail starts in {expected} layout at {width}")


def direct_chat(page, width):
    page.add_init_script("""window.__chatFrames = [];
      let count = 0;
      const sample = () => {
        const main = document.querySelector('.web-main');
        if (main) {
          const r = main.getBoundingClientRect();
          const visible = selector => Boolean(document.querySelector(selector)?.getBoundingClientRect().height);
          const frame = [r.x,r.y,r.width,r.height].map(n => Math.round(n * 100) / 100);
          frame.push(visible('.market-header'), visible('.mobile-nav'), visible('.site-footer'));
          if (JSON.stringify(frame) !== JSON.stringify(window.__chatFrames.at(-1)))
            window.__chatFrames.push(frame);
        }
        if (count++ < 180) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    """)
    open_route(page, WEB, "/messages/conversation-1")
    expect(page.locator(".chat-composer")).to_be_visible()
    page.wait_for_timeout(300)
    frames = page.evaluate("window.__chatFrames")
    if width < 768:
        expected = page.evaluate("[0,0,document.body.clientWidth,innerHeight,false,false,false]")
        assert frames and all(frame == expected for frame in frames), frames
    else:
        assert frames and all(frame[:3] == frames[0][:3] and frame[4] for frame in frames), frames
    print(f"PASS directly loaded chat shell remains stable at {width}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--case", choices=["all", "gutter", "first-paint", "mounts", "chat"], default="all")
    args = parser.parse_args()
    failures = []
    with sync_playwright() as playwright:
        for classic in [False, True]:
            launch = {"headless": True}
            if classic:
                launch.update(ignore_default_args=["--hide-scrollbars"], args=["--disable-features=OverlayScrollbar"])
            executable = os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
            if executable:
                launch["executable_path"] = executable
            browser = playwright.chromium.launch(**launch)
            try:
                for width in [390, 1024, 1440]:
                    for admin in [False, True]:
                        fixture = Fixture(admin=admin)
                        context = browser.new_context(viewport={"width": width, "height": 1000}, timezone_id="Asia/Shanghai")
                        fixture.install(context)
                        page = context.new_page()
                        capture_errors(page, fixture, failures)
                        if args.case in ["all", "first-paint"]:
                            first_paint_geometry(page, admin, width)
                        if args.case in ["all", "gutter"]:
                            gutter_geometry(page, fixture, admin, width)
                        if not admin and args.case in ["all", "mounts"]:
                            mounted_detail(page, width)
                        if not admin and args.case in ["all", "chat"]:
                            direct_chat(page, width)
                        assert not fixture.unexpected, fixture.unexpected
                        assert all(method == "PUT" and endpoint == "/conversations/conversation-1/read"
                                   for method, endpoint, _ in fixture.writes), fixture.writes
                        context.close()
                assert not failures, failures
            finally:
                browser.close()
    print("PASS all API requests intercepted; no database writes or browser errors")


if __name__ == "__main__":
    main()
