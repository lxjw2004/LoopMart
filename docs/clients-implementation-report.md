# Web 与 Admin 实现与验证

## 实现

- Web 使用端口 3000，Admin 使用 3004。Next.js 同源代理分别访问业务 API 与认证服务；支持 `API_INTERNAL_URL`、`AUTH_INTERNAL_URL`，生成单仓库 standalone 产物。
- 中英切换、响应式文字卡片、键盘焦点、加载／空态／错误重试及身份访问状态。无媒体入口或演示数据。
- 市场和拼车支持筛选、分页、详情、发布、编辑、删除和状态切换；两类本机草稿独立保存。费用仅展示，拼车按所选 IANA 时区转换，拒绝不存在的夏令时时间。
- 收藏、个人发布分类与分页、昵称、邮箱修改、注册／登录／验证邮件／找回与重设密码／退出；公开资料展示其有效物品和拼车。
- 私聊按用户对合并，支持发布引用、发送重试去重、分页补齐、已读、未读及 SSE 查询恢复；四类举报、联系和双语隐私政策均有实际 API 入口。
- Admin 提供总览、用户搜索与创建、角色和封禁、密码设置／重置、物品和拼车创建／编辑／状态审核／删除、举报审核、会话消息、社区消息及接收人搜索、联系处理、认证域策略／社区管理员／政策设置、审计。管理写入必须填写原因并确认。

## 验证证据

- Web、Admin 严格 TypeScript 检查通过。
- 两个 Next.js webpack 生产构建通过，包含类型检查、页面生成及 standalone 跟踪。
- `npx tsx --test packages/ui/src/*.test.ts`：7 项通过，覆盖同源凭据与分页、错误传播、聊天分页边界去重、IANA 时区、夏令时缺口及美元小数的精确整数换算。
- 真实 PostgreSQL 测试环境与 Chromium：登录、物品发布／详情／收藏、拼车发布、四类举报、联系提交、私聊引用、持久化回复及不重新打开页面的实时回复、Admin 用户修改／创建／密码设置／封禁和解封、物品创建／编辑／删除／审核、举报审核、联系处理、设置和管理列表通过。
- 390px Web 和 Admin 均通过横向溢出检查；英文切换、公开资料实际发布列表和个人物品／拼车切换通过。美元输入、编辑显示和详情格式已切换到美元，API 仍传整数美分。截图位于忽略目录 `.superpowers/e2e/`。测试不输出密码。
- 可复现脚本：`tests/browser/e2e.py`、`tests/browser/admin_crud.py`；浏览器路径使用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 或 Playwright 默认路径，身份来自仅本地测试文件 `.superpowers/e2e/users.json`。

## 剩余边界

- SMTP 留空时无法完成真实邮箱投递链路；没有将接口入口或测试身份登录当作真实邮件投递成功。
- 浏览器测试覆盖上述关键流程，不表示穷尽每种网络故障、历史数据量及浏览器组合。超量列表与聊天分页同时有真实 API 集成及客户端游标／去重测试支持。

## 最终执行

- `npx tsc --noEmit -p apps/web/tsconfig.json`、Admin 对应命令：通过。
- `npm run build -w @loopmart/web`、`npm run build -w @loopmart/admin`：通过。
- `npx tsx --test packages/ui/src/*.test.ts`：7 项通过。
- 配置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 后，`/tmp/loopmart-browser-venv/bin/python tests/browser/e2e.py`：退出 0，全部场景通过，三名测试身份浏览器均无异常。
- 同一环境执行 `/tmp/loopmart-browser-venv/bin/python tests/browser/admin_crud.py`：退出 0，创建用户／设置密码／封禁解封／物品增改删／管理移动布局通过，无浏览器异常。
- 最终截图：`.superpowers/e2e/web-mobile.png`、`admin-mobile.png`、`admin-desktop.png`。这些测试产物与身份文件保持忽略，不提交凭据。
