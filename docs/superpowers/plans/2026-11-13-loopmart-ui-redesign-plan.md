# LoopMart UI 重设计 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有功能完整迁入已认可的现代市场 Web 和独立 Admin 界面，交付桌面及移动浏览器可用的真实交互。

**Architecture:** 保留 Next.js catchall、同源代理、Better Auth 与业务 API，逐步从 `Client.tsx` 提取路由、Web页面和Admin页面，不整体重写服务层。共享基础视觉和可靠的金额/时区/请求函数，Web与Admin拥有独立Shell。按基础→用户浏览→发布/消息→管理端→回归顺序交付，每步均能独立检查。

**Tech Stack:** Node.js ≥24、现有锁定版本的 Next.js/React/TypeScript、CSS、PostgreSQL、node:test/tsx、Python Playwright；不新增运行时依赖。

## Global Constraints

- 依据：`docs/superpowers/specs/2026-11-13-loopmart-ui-redesign-design.md`。
- 桌面拼车列表和商品一致：左侧筛选、右侧卡片网格；拼车详情为左侧行程信息、右侧费用和联系操作。
- 当前发布页隐藏文件选择、上传、封面排序和视频入口。
- 使用“加载更多”延续不透明游标；没有真实总数时不显示虚构总量或1/2/3页码。
- 真实图片数据尚不可用，不以占位照片伪装真实商品。
- 不升级主要依赖、不迁移数据库、不修改生产配置和 OCI；Cardmaster 不受影响。
- 单一 Purdue 社区；商品收藏；聊天按用户对合并；管理写入原因、二次确认、事务审计保持。
- 不添加支付、订单、预订、拼车收藏、媒体消息、批量管理操作或原生iOS。
- 中英文及全部原有认证流程保留；SMTP留空，不实现生产验证绕过。
- 不把内部方向、范围、取舍写成产品理念、banner或帮助段落。

---

## 0. 执行方式、环境与文件责任

本计划的任务是未来执行清单，未勾选不代表已有实现。本次只交付文档。实施时先读取现有文件与测试，保存基线结果，再做下面的增量；不以原型HTML替换真实业务应用。工作区若存在用户改动不得覆盖。Git提交按任务列出的文件精确暂存，不使用 `git add .`。

工作根目录：`/Users/peterluo/Documents/个人/小程序/LoopMart`。所有相对路径均基于此目录。

| 文件/目录 | 责任与处理方式 |
|---|---|
| `packages/ui/src/Client.tsx` | 当前总入口；逐步退为Web/Admin分发，不一次删掉原逻辑 |
| `packages/ui/src/navigation.ts`、`navigation.test.ts` | 新建纯URL解析/旧入口转换，禁止业务请求 |
| `packages/ui/src/useNavigation.tsx` | 新建Next router桥接与历史状态；不引入路由库 |
| `packages/ui/src/shared/{Primitives,Feedback,MediaGallery}.tsx` | 新建公共控件、状态及只读图片展示 |
| `packages/ui/src/shared/media.ts`、`packages/ui/src/media.test.ts` | 新建空媒体适配器和可信展示数据边界 |
| `packages/ui/src/web/{WebShell,MarketPage,ItemDetail,RidesPage,RideDetail}.tsx` | 新建用户导航与浏览页面 |
| `packages/ui/src/web/{PublishPage,MessagesPage,AccountPages}.tsx` | 新建发布、消息和账号辅助页面 |
| `packages/ui/src/admin/{AdminShell,ResourceList,ResourceDetail,AdminForms}.tsx` | 新建管理工作台与结构化详情/表单 |
| `packages/ui/src/style.css`、`tokens.css`、`web.css`、`admin.css` | 保留全局入口；新增变量与以shell类名限定的页面规则 |
| `packages/ui/src/DataForm.tsx` | 提取时保留精确金额、草稿与提交语义；添加分组/具名操作支持 |
| `packages/ui/src/{Details,ProfileListings,RideMeta}.tsx` | 替换公共界面的原始字段展示；未被使用前不删 |
| `packages/ui/src/{api,money,time,errors,ride-options}.ts` | 复用现有导出，避免重写；仅针对性扩展 |
| `packages/i18n/src/index.ts` | 新控件和状态的双语标签 |
| `apps/{web,admin}/app/{page.tsx,[...path]/page.tsx,layout.tsx}` | 保留现有入口/代理，按需要接入新shell和metadata |
| `apps/api/src/item-filters.ts`、`item-filters.test.ts` | 新建商品增量筛选解析与参数化条件 |
| `apps/api/src/app.ts` | 只接入商品只读过滤；不改鉴权/数据写入 |
| `tests/api.integration.test.ts` | 增补真实分页前筛选场景 |
| `tests/browser/ui_redesign.py` | 新建视觉结构、路由、响应式和键盘回归 |
| `tests/browser/{e2e,admin_crud,errors_and_rides}.py` | 更新语义定位器，保留现有业务断言 |
| `docs/api/contract.md`、`docs/acceptance.md` | 筛选参数契约与本轮真实验收结果 |

接口公共约定（实现文件在各任务中定义）：

```ts
// navigation.ts：URL仅负责页面定位，业务API名称不受此类型改名影响。
export type UiRoute = {
  area: "web" | "admin";
  page: string;
  id?: string;
  edit?: boolean;
  query: URLSearchParams;
};
export function parseRoute(url: URL, admin: boolean): UiRoute;
export function legacyTarget(url: URL, admin: boolean): string | null;

// useNavigation.tsx：navigate允许保留浏览器back；只对旧地址规范化使用replace。
export type Navigation = {
  route: UiRoute;
  navigate: (href: string, replace?: boolean) => void;
};
export function useNavigation(admin: boolean): Navigation;

// shared/media.ts：只允许调用方通过受信适配器提供图片。
export type DisplayImage = { id: string; url: string; alt: string };
export type DisplayMediaResolver = (recordId: string) => Promise<DisplayImage[]>;
export const noMedia: DisplayMediaResolver = async () => [];
```

现有 `api(path, method?, body?)` 返回业务数据或游标页，`auth(path, body)`负责认证；保持签名。现有 `dollarsToCents`、`centsToDollars`、`departureInstant`、`departureLocal`、`formatDeparture`继续作为唯一转换入口。

测试环境遵循 `docs/operations/local-development.md`：只向本机隔离的 `loopmart_test` 写入测试数据。先确认测试库容器可用；不清空开发库。

```sh
npm test
npm run typecheck
npm run test:integration
node --env-file=.env.test --import tsx tests/browser/seed.ts
LOOPMART_ENV_FILE=.env.test LOOPMART_MODE=production npm run dev
```

最后一条在单独终端保持运行；production模式前执行 `npm run build`。服务端口仍为Web3000、Admin3004、API3002、Auth3001。浏览器执行器使用已有 `.venv/bin/python`；缺环境时按上述本地开发文档安装既有锁定Playwright版本。

## 任务1：可返回的真实路由和兼容入口

**Files:** 新建 `packages/ui/src/navigation.ts`、`packages/ui/src/navigation.test.ts`、`packages/ui/src/useNavigation.tsx`；修改 `packages/ui/src/Client.tsx` 和 `apps/web/app/page.tsx`、`apps/web/app/[...path]/page.tsx`、`apps/admin/app/page.tsx`、`apps/admin/app/[...path]/page.tsx`；新增 `tests/browser/ui_redesign.py` 的route场景。

**Interfaces:** 消费 `URL`、Next `useRouter/usePathname/useSearchParams`；产出上面的 `UiRoute`、`Navigation`。现有catchall继续渲染Client；静态导入导航hook但必须在客户端挂载后处理legacy URL。

- [ ] 在 `navigation.test.ts` 添加以下可执行断言，并覆盖 `/rides/r1/edit`、管理旧别名、未知路径、token回调和不安全returnTo：

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRoute, legacyTarget } from "./navigation.js";
test("detail URLs preserve query and old conversation bookmarks resolve", () => {
  const r = parseRoute(new URL("http://localhost/items/a?q=book"), false);
  assert.equal(r.page, "items");
  assert.equal(r.id, "a");
  assert.equal(r.query.get("q"), "book");
  assert.equal(legacyTarget(new URL("http://localhost/#conversations"), false), "/messages");
  assert.equal(legacyTarget(new URL("http://localhost/?token=secret"), false), null);
  assert.equal(parseRoute(new URL("http://localhost/?token=secret"), false).page, "login");
});
```

- [ ] 运行 `node --import tsx --test packages/ui/src/navigation.test.ts`，新增模块前应失败。实现纯解析，页面白名单覆盖设计§3；未知页返回not-found；只允许同源且以单个`/`起始的returnTo。
- [ ] 在现有 `go()` 调用点接入 `router.push(href)`，旧入口用 `router.replace`。查询写入URL，刷新从URL恢复；认证token、reset=true与已有回调模式优先于普通页面解析。四个App入口为使用useSearchParams的Client增加React Suspense边界，Web保留`<Client />`、Admin保留`<Client admin />`，fallback使用加载状态，避免静态构建失败。`messages`映射现有API `conversations`，`account/listings`映射 `me/items|rides`，不改API路径。
- [ ] 增加列表恢复缓存：键为规范pathname+query（不含cursor），值为已加载行/nextCursor/scrollY；存于当前页面会话内存，不把私聊和管理数据长期存localStorage。写入后使相应缓存失效。测试列表→详情→back、前进、直达刷新；token参数原样保留。
- [ ] 运行单测及 `npm run typecheck`；route浏览器断言检查真实地址和back结果。提交：`feat(ui): add navigable routes and legacy URL compatibility`，只暂存本任务文件。

## 任务2：视觉基础、公共状态与两个独立Shell

**Files:** `shared/Primitives.tsx`、`shared/Feedback.tsx`、`tokens.css`、`web.css`、`admin.css`、`style.css`、`web/WebShell.tsx`、`admin/AdminShell.tsx`、i18n、Client、浏览器脚本。

**Interfaces:** `WebShell({children}: {children: React.ReactNode})`、`AdminShell`同签名；消费任务1导航。`Dialog({open,title,onClose,children})`、`Sheet`同签名；产出统一focus/close行为。

- [ ] 新浏览器脚本采用`argparse --case shell`选择场景；先加入无嵌套交互、主导航链接和移动溢出断言。首次对旧UI运行，应因预期shell/链接不存在失败。

```python
for width in [1440, 1024, 768, 390, 320]:
    page.set_viewport_size({"width": width, "height": 900})
    page.goto("http://localhost:3000/items")
    expect(page.get_by_role("navigation", name="主导航")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
```

- [ ] 将设计§4变量写入 `tokens.css` 并由style入口引入；基础布局规则以 `.web-shell`、`.admin-shell` 限定，避免后台样式覆盖用户端。核心布局使用：

```css
.web-shell .browse-layout { display:grid; grid-template-columns:232px minmax(0,1fr); gap:24px; }
.web-shell .card-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:20px; }
.web-shell .detail-layout { display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:24px; }
@media(max-width:1199px) {
  .web-shell .browse-layout { grid-template-columns:minmax(0,1fr); }
  .web-shell .card-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
}
@media(max-width:767px) {
  .web-shell .detail-layout { grid-template-columns:minmax(0,1fr); }
  .web-shell .ride-grid { grid-template-columns:minmax(0,1fr); }
}
```

- [ ] 实现设计§3导航、Admin侧栏和手机菜单；新Shell接入时移除旧入口的重复header/nav，但尚未迁移的页面内容仍在对应Shell内可用；`main`保留唯一页面h1。实现Dialog/Sheet原生`dialog`打开/关闭、标题关联、Esc、关闭后归还焦点。骨架aria-busy，错误role=alert，成功role=status；文案进i18n。
- [ ] 为登录/未验证/封禁/403/加载失败分别接入真实状态；移动用户端五项底部导航，消息详情不显示底部导航。
- [ ] 运行 `.venv/bin/python tests/browser/ui_redesign.py --case shell`、`npm run typecheck`；检查键盘开关菜单和焦点恢复、两种语言。提交：`feat(ui): establish marketplace and admin shells`。

## 任务3：商品筛选服务端最小扩展

**Files:** 新建 `apps/api/src/item-filters.ts`、`apps/api/src/item-filters.test.ts`；修改 `apps/api/src/app.ts`、`tests/api.integration.test.ts`、`package.json`、`docs/api/contract.md`。

**Interfaces:** `itemFilterClauses(params: URLSearchParams, args: unknown[], rowAlias?: string): string`；默认alias为`e`，只返回以` AND `开头的参数化SQL片段，并将参数追加到args；空值返回空串。仅用于item查询。

- [ ] 写边界测试，验证0、包含边界、枚举、非法负数/小数/反向范围均返回400，不拼接用户文本。最小成功样例：

```ts
const args: unknown[] = [];
const sql = itemFilterClauses(new URLSearchParams("minPriceCents=0&maxPriceCents=1200&condition=good"), args);
assert.deepEqual(args, [0, 1200, "good"]);
assert.match(sql, /\$1/);
assert.match(sql, /\$2/);
assert.match(sql, /\$3/);
```

- [ ] 运行 `node --import tsx --test apps/api/src/item-filters.test.ts`，确认新测试失败。实现安全整数非负参数和既有枚举校验，默认alias固定，禁止由HTTP参数传入alias。金额比较使用`(e.data->>'priceCents')::bigint`，condition/deliveryMethod使用等值参数。
- [ ] 在 `app.ts` 构造实体args后、执行SELECT前调用函数；筛选条件放入WHERE和LIMIT前，保留原有所有权/状态/社区与游标条件。`kind=ride`时不应用商品过滤。
- [ ] 集成测试创建不同金额/成色/交付的52条商品，匹配集超过一页，遍历游标断言无漏项/重复且全部匹配；补非法组合400、与q/category叠加、其他发布者可见性、默认顺序不变。更新契约新增四个参数；在package.json的test命令末尾追加`apps/api/src/item-filters.test.ts`，确保后续`npm test`持续覆盖新增校验。
- [ ] 运行新增单测、`npm run test:integration`，无跳过/失败；提交：`feat(api): support paginated item attribute filters`。不创建迁移文件。

## 任务4：只读媒体展示与市场浏览详情

**Files:** `packages/ui/src/shared/media.ts`、`packages/ui/src/media.test.ts`、`packages/ui/src/shared/MediaGallery.tsx`、`web/MarketPage.tsx`、`web/ItemDetail.tsx`、`web.css`、Client、i18n、浏览器脚本。

**Interfaces:** `DisplayImage`、`noMedia`见§0；`MediaGallery({images,title}: {images:DisplayImage[];title:string})`。`MarketPage({mediaResolver}: {mediaResolver?:DisplayMediaResolver})`默认noMedia；`ItemDetail({id,mediaResolver}: {id:string;mediaResolver?:DisplayMediaResolver})`。

- [ ] 在顶层media.test.ts从`./shared/media.js`导入noMedia，添加单测：`assert.deepEqual(await noMedia("item-id"), [])`，使现有npm test通配符能发现测试。浏览器使用隔离fixture从浏览器测试注入展示组件的数据，不将外部图URL写入业务商品。先断言商品详情地址、左筛选右网格、应用条件改变真实请求和无文件选择入口。
- [ ] 运行 `node --import tsx --test packages/ui/src/media.test.ts` 与浏览器 `--case market`，确认新增组件前失败。实现图片4:3、缩略切换、查看器、无图/坏图；不在应用里注册供生产访问的demo路由。
- [ ] 将既有市场查询和收藏操作接入新页面：URL筛选、`dollarsToCents`、加载更多、请求序列防旧响应、追加失败重试。商品卡详情使用链接、收藏使用相邻按钮，不能嵌套。价格排序只显示已支持的最新发布。
- [ ] 详情只渲染设计§6白名单字段，使用真实publisher资料，联系进入已有用户对会话并保留引用。API无可信图片时传空数组；本人隐藏联系自己。404/403/下架清晰降级。
- [ ] 浏览器测试0价格筛选、组合过滤、重置、返回滚动、收藏失败回滚、多/单/无/坏图、Esc与焦点、手机无溢出。运行 `--case market`、`npm run typecheck`，提交：`feat(web): redesign marketplace browsing and item details`。

## 任务5：与商品一致的拼车左右布局

**Files:** `web/RidesPage.tsx`、`web/RideDetail.tsx`、`RideMeta.tsx`、web.css、Client、i18n、浏览器脚本。

**Interfaces:** `RidesPage()`；`RideDetail({id}: {id:string})`；消费现有GET `/rides`、`formatDeparture(value,timeZone,english)`；产出任务1路由下的列表/详情。

- [ ] 用浏览器1440px边界矩形断言布局，不能仅截图比对。先记录失败：

```python
sidebar = page.get_by_role("region", name="拼车筛选").bounding_box()
grid = page.get_by_role("region", name="拼车列表").bounding_box()
assert sidebar["x"] + sidebar["width"] <= grid["x"]
assert abs(sidebar["y"] - grid["y"]) < 80
```

- [ ] 使用任务2的browse-layout/card-grid和detail-layout；列表左侧地点/日期过滤，右侧departure_asc/desc+卡片。新查询清游标；不修改既有按行程时区过滤语义。
- [ ] 详情左行程右费用/联系；全部时间用存储时区格式化并显示命名时区；余座0不伪装可预订。删除/不可见引用降级，无收藏/扣座/付款按钮。
- [ ] `--case rides`覆盖排序游标、芝加哥与印第安纳跨日、手机单列/过滤Sheet、详情联系引用、本人入口。运行现有time测试和 `npm run typecheck`；提交：`feat(web): align ride browsing with marketplace layout`。

## 任务6：分组发布、编辑和可靠草稿

**Files:** `web/PublishPage.tsx`、`DataForm.tsx`、web.css、Client、i18n、`tests/browser/errors_and_rides.py`、ui_redesign.py。

**Interfaces:** `PublishPage({kind,id}: {kind:"items"|"rides";id?:string})`；继续调用DataForm既有submit/ownerId/kind和金额函数。仅增加可选`submitLabel?:string`、`groups?:{title:string;fields:string[]}[]`以复用表单。

- [ ] 先增失败场景：两账号不同类型草稿互不覆盖，编辑不覆盖草稿，失败不清输入，双击提交只有一次创建，准确12.34美元；检查无file input。
- [ ] 实现设计§8两种分组表单、桌面摘要/动作与移动固定动作；具体标签发布商品/发布拼车/保存修改。自动草稿沿用原key，显式保存写同一key，存储异常局部提示且不阻塞提交。
- [ ] 使用现有 `departureInstant` 转换UTC。夏令时gap保持拒绝；提交摘要列出转换后实际日期/时间/时区和UTC偏移，重复时刻必须先确认再提交，不静默选时间。编辑保留未知但合法时区选项。
- [ ] 提交统一busy锁；失败保留values；成功仅清本账号本类型新建草稿，导航到真实返回ID详情。无授权编辑返回403，不自行改publisherId绕过。
- [ ] 运行 `--case publish`、`.venv/bin/python tests/browser/errors_and_rides.py`、`npm test`、`npm run typecheck`。提交：`feat(web): redesign publishing and preserve scoped drafts`。

## 任务7：消息双栏、手机分屏与实时状态

**Files:** `web/MessagesPage.tsx`、web.css、Client、api.ts（只在必要时扩展）、i18n、ui_redesign.py、e2e.py。

**Interfaces:** `MessagesPage({id}: {id?:string})`；复用 `/conversations`、`conversationMessages(path)`、EventSource(`/api/v1/events`)；引用仍为`{type:"item"|"ride",id:string}`，clientId失败重试不变。

- [ ] 增加双浏览器用户场景，先验证桌面双栏/手机详情独立地址、Enter/Shift+Enter和输入法事件。输入法保护的发送条件必须包含：

```tsx
if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
  event.preventDefault();
  formRef.current?.requestSubmit();
}
```

- [ ] 提取会话状态到MessagesPage，保留API鉴权、同一用户对合并、引用、SSE断线重查和clientId幂等。切会话清理旧订阅与忽略迟到请求；发送中切换后不能向新会话发送旧正文。
- [ ] 按设计§9实现名单筛选、未读、引用卡片、失败重试和聊天滚动。已读写入需同时满足选中会话、document可见、消息已展示；新消息在阅读旧历史时显示可点击入口而非强制跳动。
- [ ] 手机列表→详情→返回恢复名单位置，键盘不遮挡发送框；桌面未选择会话用短空状态。禁止添加虚构presence/typing。
- [ ] `--case messages`覆盖双用户实时、断网重连/重试同clientId、商品和拼车进入同会话、旧历史滚动、隐藏标签页未读、中英文、IME。运行 `npm test` 和 `npm run typecheck`；提交：`feat(web): redesign conversations across desktop and mobile`。

## 任务8：账号、收藏及所有辅助流程接入

**Files:** `web/AccountPages.tsx`、ProfileListings.tsx、Client、i18n、web.css、e2e.py、ui_redesign.py。

**Interfaces:** `AccountPages({page,id}: {page:string;id?:string})`；消费原auth()/api()与当前me；复用MarketPage的卡片呈现（提取 `web/ItemCard.tsx`、`web/RideCard.tsx`，同页面数据契约，不另写转换）。

- [ ] 列出并加入浏览器场景：账号设置、我的发布两类/状态、公开资料、收藏、四类举报、联系开关、双语隐私和认证页面状态。保留原集成测试的真实认证验证断言。
- [ ] 从Client提取表单与写入操作，不改变Better Auth请求。菜单切换语言写入现有loopmart-language，更新document.lang。登录返回只接受任务1的同源安全路径。
- [ ] 用结构化资料替换公开原始Details；只展示API公开字段。本人内容提供编辑/下架/删除的正确确认；违规状态不可恢复。联系关闭时不发送无效POST。
- [ ] 认证邮件类操作以服务返回状态为准；SMTP未配置仍准确失败。四类举报保持目标ID内部传递但不作为正文展示。
- [ ] 运行 `--case account`、e2e.py、`npm run test:integration`、`npm run typecheck`；提交：`feat(web): complete account favorites and support flows`。

## 任务9：Admin列表、筛选与只读详情

**Files:** `admin/ResourceList.tsx`、`admin/ResourceDetail.tsx`、AdminShell、admin.css、Client、Details.tsx、i18n、ui_redesign.py。

**Interfaces:** `ResourceList({resource}: {resource:string})`、`ResourceDetail({resource,id}: {resource:string;id:string})`；resource限定设计§3.2管理页面白名单；使用 `/admin/:resource`，不由任意用户输入拼接资源名。

- [ ] 在管理角色浏览器先测试每个模块有明确h1、工具栏和真实API数据；普通成员直达返回403。检查从表格打开抽屉后地址与刷新结果。
- [ ] 依设计§11建立各资源列定义/筛选配置，仅把API已支持字段连到URL；列表使用已有不透明游标。总览只有真实计数，无虚构趋势/交易额；不添加选择框或批量按钮。
- [ ] 结构化渲染用户、商品、拼车、举报、联系、会话、审计详情。管理可见邮箱，公开端不可见。审计before/after字段只读比较，嵌套对象格式化，密码/token等敏感字段始终遮蔽。
- [ ] 手机侧栏Sheet、记录卡片/关键列、全宽详情；底部主要动作可见且不遮挡正文。Table内部可滚动但整页不可溢出。
- [ ] `--case admin-read`覆盖users(role/banned)、items(category/publisher/date)、rides(route/date)、reports(target/reason/reporter)、audit(actor/action/resource/date)、conversations/community-messages日期、contact状态。运行typecheck；提交：`feat(admin): redesign resource browsing and audit details`。

## 任务10：Admin写入表单、原因与二次确认

**Files:** `admin/AdminForms.tsx`、ResourceDetail、shared/Primitives、Client、i18n、admin_crud.py、ui_redesign.py。

**Interfaces:** `ConfirmAction({title,summary,onConfirm,onClose}: {title:string;summary:string;onConfirm:(reason:string)=>Promise<void>;onClose:()=>void})`；消费Dialog；成功后使管理列表/详情缓存失效。

- [ ] 更新admin_crud.py，先用新语义断言用户创建/角色/封禁/密码、商品/拼车增删改、举报、联系、设置、社区消息。断言空原因不能提交、取消不发请求、确认失败保留内容。移除系统dialog接受器，替换为界面弹窗操作。
- [ ] 实现结构化字段表单；所有写请求携带trim后的非空reason，危险操作显示目标与变更摘要再确认。POST密码不回显、不缓存；发重置邮件保留真实失败状态。
- [ ] 举报处理使用现有三种状态；联系处理使用open/resolved；设置分认证/官方身份/联系/隐私四组，保持原API事务行为。社区消息发送前确认实际发送身份与收件人，身份与操作人不混淆。
- [ ] 服务端失败不提前关闭表单/假改列表；角色变化后重新拉me，权限由服务器裁决。Dialog焦点限制/取消/返回焦点与手机触达一起验证。
- [ ] 运行 `--case admin-write`、`.venv/bin/python tests/browser/admin_crud.py`、`npm run test:integration`、`npm run typecheck`。核对数据库审计新增且拒绝/失败无脏更新；提交：`feat(admin): preserve confirmed audited management actions`。

## 任务11：完整回归、清理与交付

**Files:** ui_redesign.py、现有三个浏览器脚本、Client/Details仅删除已无引用旧分支、`docs/acceptance.md`、`docs/operations/local-development.md`。

**Interfaces:** 浏览器新脚本支持 `--case route|shell|market|rides|publish|messages|account|admin-read|admin-write|all`，默认all；每个case可独立运行，错误非零退出。fixture读取既有 `.superpowers/e2e/users.json`，不将凭据写入截图或日志。

- [ ] 用`rg`检查旧分支/样图/上传控件/通用JSON详情是否仍被用户路径引用。只删除已被迁移且无调用者的代码；API/数据库/媒体契约不因UI迁移删除。
- [ ] 运行下列全套验证，失败则定位最小原因修复后重跑受影响项。数据库集成与浏览器写入测试串行，禁止并发重置同一fixture。

```sh
npm test
npm run test:integration
npm run typecheck
npm run build
node --env-file=.env.test --import tsx tests/browser/seed.ts
```

- [ ] 在另一终端按§0启动本轮生产构建，再依次运行：

```sh
.venv/bin/python tests/browser/ui_redesign.py --case all
.venv/bin/python tests/browser/e2e.py
.venv/bin/python tests/browser/admin_crud.py
.venv/bin/python tests/browser/errors_and_rides.py
```

预期：全部命令exit0、无跳过掩盖业务断言、无未处理pageerror。单测数可能随新增而增加，不沿用首版20项当成本轮证明。

- [ ] 保存1440/390px市场、商品详情、拼车列表/详情、发布、消息、Admin截图到忽略目录 `.superpowers/ui-redesign/`。另外逐个检查1024/768/320px、英文长文、200%缩放、键盘导航、低动态偏好、坏图、空状态、401/403/404/网络错误。手机输入法/键盘需人工浏览器检查，不以桌面viewport模拟当作真实iPhone验收。
- [ ] 在acceptance新增独立“UI重设计验收”记录：命令/实际结果、截图位置、未验证项；不要改写首版历史结果。更新本地开发文档的新浏览器入口。使用 `git diff --check` 和 `git diff --stat` 检查范围，提交：`test(ui): verify redesigned web and admin workflows`。

## 需求覆盖与完成判定

| 设计说明 | 实施任务 | 关键验收 |
|---|---|---|
| §1–2范围/保留能力 | 全部、11 | 无云端/Schema/上传/支付扩散 |
| §3导航 | 1、2 | 旧书签、直达刷新、返回、token回调 |
| §4视觉/移动 | 2、11 | 五档宽度、独立Shell、无全页溢出 |
| §5市场 | 3、4 | 分页前真实筛选、精确金额、无假页码 |
| §6详情/图片 | 4 | 左右结构、多单无坏图、无真实上传入口 |
| §7拼车 | 5、6 | 左筛选右网格、左行程右费用、时区/排序 |
| §8发布 | 6 | 两类草稿、失败保留、编辑与新建隔离 |
| §9消息 | 7 | 用户对合并、引用、SSE、幂等、IME与手机返回 |
| §10账号/辅助 | 8 | 全认证、收藏、四类举报、联系开关、隐私 |
| §11管理 | 9、10 | 全资源/有效筛选、权限、原因/确认/审计 |
| §12状态/可访问 | 2及各页面、11 | 中英文、焦点、键盘、错误/加载/空态 |
| §13技术与验收 | 11 | 单元/集成/类型/双应用构建/浏览器证据 |

任务1–8完成后用户端可以单独验收；任务9–10完成后管理端可以单独验收；任务11为合并交付门槛。任何尚未跑过的验证必须如实标记；没有真实SMTP、媒体存储、Safari/真机测试时不能宣称这些已验收。真实上传/存储、生产部署或基础设施变更必须单独授权，不因完成此计划自动执行。
