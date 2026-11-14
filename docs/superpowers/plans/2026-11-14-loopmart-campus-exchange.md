# LoopMart Campus Exchange Implementation Plan

**Goal:** 将用户已选的橙白「校园交换站」整体设计落实到用户端和后台。

**Architecture:** 保留现有页面、路由、鉴权、API与状态管理；在 Astryx 主题、共享品牌、导航、商品网格与宽行程卡层实现设计替换。此前已修复的草稿、筛选和自动填充行为不回退。

**Tech Stack:** Next.js 16.4.6 / React 19.3.1 / Astryx 0.7.15 / TypeScript / 现有 Playwright。

## Global Constraints

- 当前工作在用户指定的 `v0.1-ui-improvement` 分支，不重置既有未提交修改，不提交／推送。
- 用户已批准橙白整体设计；原蓝色／后台灰绿和桌面左筛选不再是固定约束。
- 不新增依赖，不改 API、数据库、鉴权、部署或权限。
- 使用 Astryx 组件与主题 token；不添加原生布局标签或独立 CSS。
- 演示数据只在浏览器 fixture 中存在，不迁入生产界面。
- 使用默认 SSR；关键导航框架不能被异步骨架替换。保留之前的次要页面按需加载。
- 设计说明只写开发文档，不增加 slogan、理念、教学或说明段落。

## Task 1: Theme family

Owner boundary: `src/themes/foundation.ts`, `src/themes/loopmart-web/loopmartWebTheme.ts`, `src/themes/loopmart-admin/loopmartAdminTheme.ts` 及编译产物。

- [x] 将品牌／主操作改为 `#cf3f23`、强调文字 `#b9351d`、浅橙 `#fff0e9`；页面 `#f8f8f6`、白色面板、正文 `#252b28`、次级文字 `#626d65`、边界 `#e2e6df`。
- [x] 使用控件10px／面板14px圆角；后台控件8px、面板12px，保持紧凑表格。
- [x] 导出共享局部token：`--lm-brand-mark-size` 26px（手机24px），`--lm-media-empty-height` 160px（手机112px），`--lm-catalog-columns` 3（宽度低于1024为2）；行程token `--lm-ride-direction` row／手机column，`--lm-ride-rail-width` 160px／手机100%，`--lm-ride-rail-direction` column／手机row，`--lm-ride-icon-display` flex／手机none。
- [x] 完整替换后台灰绿覆盖，继承新的品牌主题；文字对比度≥4.5:1，焦点≥3:1，手机输入≥16px、控件≥44px。
- [x] 运行 `npm run theme:build` 与 `npm run theme:check`；不得并行运行完整生产构建。

## Task 2: Brand, navigation and connected surfaces

Owner boundary: 新建 `packages/ui/src/shared/Brand.tsx`，修改 `web/WebShell.tsx`, `admin/AdminShell.tsx`, `web/ListingDetail.tsx`, `web/PublishPage.tsx`；不修改 Client、Browse 或主题源。

- [x] 使用 Icon 包裹环形标记，字标使用既有名称和主题颜色；标记本身装饰性隐藏，品牌链接名称保持 LoopMart。
- [x] 用户端桌面采用单层横向导航，768–1023px 搜索独占第二行；保留商品搜索、收藏、消息未读、语言、账号和发布；社区学校选择保持已有行为。
- [x] 手机使用品牌／动作、搜索、市场／拼车与学校上下文，以及五项底部导航；聊天独占手机视口的行为保持。
- [x] 后台品牌沿用新标记，保留全部模块、账户、退出、语言和手机菜单。详情与发布页用主题强调价格，不增新文案。
- [x] 运行类型检查和相关静态UI约束；报告修改和可验证范围。

## Task 3: Full-width browsing and wide rides

Owner boundary: `web/BrowsePage.tsx`, `web/ListingCard.tsx`, `shared/MediaGallery.tsx`, `Client.tsx` 标题，必要的 `AccountPage.tsx` / `ProfileListings.tsx` 网格。

- [x] 让 Client 在所有宽度渲染浏览页唯一 h1，去除仅为左筛选设计的 stickyBrowseTitle 分支。
- [x] 市场全宽网格，横向分类；完整筛选在 Dialog／手机 BottomSheet 中提供，应用后保持 URL 和原有服务端查询。
- [x] 为新筛选入口保留关联 label、错误焦点、清空、空结果恢复、加载与游标追加反馈，价格0合法。
- [x] 拼车列表一列宽卡：路线和日期／时区为主信息，右侧费用／每人与发布者；手机堆叠，保持可读时区和座位信息。
- [x] 商品卡价格用主橙、两行标题对齐，独立收藏；有图4:3，无图紧凑占位。账号和公开资料中的拼车列表同步一列，避免宽卡被塞回窄网格。

## Task 4: Regression, review and documentation

Owner boundary: 浏览器回归、文档与只读审查，不改后端测试。

- [x] 新设计语言回归先验证旧版不满足新方向：橙色、14px商品圆角、全宽网格、筛选在面板、拼车一列宽卡。
- [x] 将旧视觉断言更新到用户已批准的新结构；保留搜索、金额、时区、收藏、导航缓存、聊天与管理确认业务断言。
- [x] 运行 `npm test`, `npm run typecheck`, `npm run theme:check`, `npm run build`；使用独立生产端口和现有fixture进行浏览器回归，不写真实数据库。
- [x] 批量捕获桌面与手机主要页面，查看有效截图，集中修正后最多再确认一轮；运行 Astryx doctor 和一次 Impeccable detector。
- [x] 独立审查功能与视觉，修复实际问题；从最终实现编写 DESIGN.md 和 `.impeccable/design.json`。
- [x] 保留本地分支供审查，报告通过项及未测试边界。

## Verification record

- `npm test`: 39/39 passed after the final header correction.
- `npm run typecheck`, `npm run theme:check`, `npm run build`: passed after the final correction; both generated themes are synchronized.
- Browser fixtures: public 14 routes and admin 17 routes × 2 locales × 3 widths; forms, chat, navigation, management confirmation and account behavior passed. Account layout also covered 1440/1024/768/390/320px in both locales.
- Final `design_language.py`: passed theme, column/card geometry, category selected state, filter dialogs/focus and responsive chat checks.
- Final `ui_navigation.py`: passed search readability/editing/submission at 768/900/1023/1024/1200px × both locales × signed-in/out; existing keyboard and query/zero-price clear recovery passed. The new width assertion failed against the pre-fix header, then passed after the dedicated tablet search row.
- `ui_accessibility.py`, `ui_forms.py` and `interaction_stability.py`: passed their targeted contrast/focus/form/retry checks. They are UI-fixture verification, not a live backend or all-states accessibility certification.
- Independent finish review: one material finding (F1, narrow tablet search), corrected in one batch; verdict pass 1 **ship, F1 resolved**. All 14 review screenshots were recaptured and validated. No further cosmetic changes were added after the verdict.
- Astryx doctor: 11 pass, 3 warnings, 0 failures. Warnings concern stock-theme package discovery, existing custom-theme management descriptors, and source style/icon advisories; no theme-management migration or dependency addition was performed.
- Impeccable detector: no findings on the integrated changed targets; no second detector during the reviewer correction round.
- Browser API/auth requests were intercepted; no real database writes, backend changes, deployments, commits or pushes. Local review screenshots are ignored generated evidence.

Final design documentation: root `DESIGN.md` and `.impeccable/design.json` were extracted from the shipped tokens/components. YAML/JSON syntax, component references and narrative synchronization were checked. Five preview snippets are documentation equivalents and were not browser-rendered. No source changes followed the reviewed header correction.
