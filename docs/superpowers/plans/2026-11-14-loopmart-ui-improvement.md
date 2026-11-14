# LoopMart UI Improvement Implementation Plan

> 本文记录第一轮实施与验证。后续整体设计改由 [校园交换站计划](2026-11-14-loopmart-campus-exchange.md) 接续。

**Goal:** 在保留 v0.1 业务和视觉身份的前提下完成用户端／后台整体精修。

**Architecture:** 在现有 Astryx 共享组件与主题上做最小修改。页面按需加载，不改变 Client 的路由状态和数据流程。

**Tech Stack:** Next.js 16.4.6、React 19.3.1、Astryx 0.7.15、TypeScript、现有 Python Playwright。

## Global Constraints

- 沿用用户端蓝色和后台灰绿色；保留系统字体、现有布局断点和圆角。
- 不新增依赖，不更改 API、数据库、鉴权、部署、配置或权限。
- 使用 Astryx 组件与主题 token，不新增原生布局标签或独立 CSS。
- 只使用浏览器 fixture，不写真实数据库；不提交或推送未经用户要求的代码。
- 在已按用户要求创建的 `v0.1-ui-improvement` 分支直接实现。

## Task 1: Navigation and browsing

Files: `packages/ui/src/web/WebShell.tsx`, `packages/ui/src/web/ListingCard.tsx`, `packages/ui/src/web/BrowsePage.tsx`, `packages/ui/src/admin/AdminShell.tsx`, `packages/ui/src/shared/NavigationIcon.tsx`, `tests/browser/ui_navigation.py`.

- [x] 用现有 Fixture 增加键盘跳过导航与无结果恢复的浏览器回归，先确认旧版失败。
- [x] 保留 AppShell 已有 skip link 和唯一 main landmark，验证其键盘行为，不重复实现。
- [x] 用 Astryx Icon 包裹统一 SVG，替换收藏字符、发布加号和后台无序数字装饰；底栏保留文字。
- [x] 移除列表重复“最新发布”；无匹配时提供“清空筛选”，清理本地输入、错误及 URL 条件；保留已有查询语义。
- [x] 运行新回归和现有 `astryx_ui.py`，保留全部既有业务断言。
- [x] 修复恢复测试揭示的旧查询回退：清空筛选时向 `load` 显式传入空 `q`，避免回退到状态更新前的查询。

## Task 2: Theme readability and touch

Files: `src/themes/foundation.ts`, `src/themes/loopmart-admin/loopmartAdminTheme.ts`, 主题编译产物、`tests/browser/ui_accessibility.py`.

- [x] 在浏览器计算现有后台文字对比度、移动输入字号和触摸控件尺寸，先复现缺陷。
- [x] 仅在主题层修正文字／焦点颜色和手机控件尺度；正文及标签对比度至少 4.5:1，焦点至少 3:1。
- [x] `npm run theme:build` 与 `npm run theme:check`；运行新可访问性回归及既有设计语言回归。

## Task 3: Initial loading and final verification

Files: `packages/ui/src/Client.tsx`；不重写现有业务分支。

- [x] 记录已有生产 client manifest 的首屏 JS 体积，作为静态产物对比基线。
- [x] 对次要页面和 DataForm 使用顶层 `next/dynamic`，默认 SSR；骨架 fallback 使用已有 Astryx 组件。
- [x] 使用现有 AlertDialog 保护丢弃草稿，取消保留输入及存储；根据认证模式设置 autoComplete；修正账户标题及重复后台空状态。
- [x] 运行 `npm test`, `npm run typecheck`, `npm run theme:check`, `npm run build`。
- [x] 运行 fixture 浏览器回归，覆盖浏览、详情、发布、账号、消息、后台和响应布局。
- [x] 查看一批桌面／手机截图，集中修复后最多再确认一次；运行 Impeccable detect 和 Astryx doctor。
- [x] 复核 diff 和构建产物，报告验证及未验证范围，保留本地分支供用户审查。


## Verification record — 2026-11-14

- `npm test`: 39/39 passed.
- `npm run typecheck`: root, Web and Admin passed; final production builds also completed their TypeScript checks.
- `npm run theme:check`: both generated themes synchronized.
- `npm run build`: theme compilation, server compilation, both Next.js production builds and standalone assets passed.
- Production servers on isolated ports 3100/3104: `astryx_ui.py --case all` passed 14 public and 17 admin routes in two languages at three widths, plus publish, chat, forms, confirmation and mobile navigation.
- `navigation_stability.py --case navigation`: passed navigation races, history, scroll restoration, failures, chat and pre-hydration headings including Admin with JavaScript disabled.
- `ui_navigation.py`: passed skip links, search reset and numeric-zero price-filter recovery; empty price fields remain empty.
- `ui_forms.py`: passed draft cancel/confirm/storage failure and authentication autocomplete without real auth submissions.
- `ui_accessibility.py`: passed rendered contrast, focus and mobile control checks.
- `account_management.py --case all`: passed four panels, Chinese/English at 320/390/768/1024/1440px, form state, saved items and posts.
- `design_language.py`: passed original blue/green themes, geometry, layout breakpoints and mobile chat.
- Astryx doctor: 0 failures, 3 warnings about existing local-theme management and source-style conventions. No dependency/theme-management migration was introduced.
- Impeccable detector: no findings in changed UI/theme source. Source review finished without unresolved findings.
- Final baseline JS references: 1,879,976 → 1,656,850 uncompressed bytes, reduction 223,126 bytes (11.9%). Browser Network verified nine secondary modules were deferred and account/chat modules loaded when visited. This is an artifact-size comparison, not a real-user speed measurement.

All browser API/auth traffic was intercepted by fixtures. No real database writes or deployment occurred. Physical iOS Safari, real SMTP and live SSE reconnection were not tested; those integrations were not changed. Work remains uncommitted on `v0.1-ui-improvement`.
