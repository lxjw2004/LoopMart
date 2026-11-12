# LoopMart 首版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成已批准的首版范围并在本地真实 PostgreSQL 与浏览器验证。
**Architecture:** 单仓库独立认证，业务 API 管理所有数据和授权，两个 Next.js 客户端经同源代理访问 API。契约见 docs/api/contract.md。
**Tech Stack:** Node.js24、TypeScript、PostgreSQL17、Better Auth、Next.js/React。

## Global Constraints

- OCI 仅只读，不部署、不修改 Cardmaster。
- 无媒体、支付、iOS。中英文。SMTP 留空且不绕过验证。
- 本地测试与开发数据库隔离，测试邮件仅测试注入。
- 服务器固定默认社区，聊天按用户对合并。

## Task 1：Docker、真实数据库与认证验证
- [x] 安装 Docker Desktop，限制本机端口，启动本地独立 PostgreSQL。
- [x] 测试库执行认证及业务迁移；通过真实注册、验证、登录、退出、重置、封禁测试；开发配置不包含测试邮件入口。

## Task 2：业务 API 与数据库
文件：apps/api/src/{server,app,auth,items,rides,chat,admin,settings}.ts；packages/database/{src,migrations}；tests/api.integration.test.ts。
- [x] 按 docs/api/contract.md 先写真实数据库测试：游客读、验证后写、他人编辑403、状态限制、金额整数、座位上限、合并会话幂等及非参与者拒绝。
- [x] 实现 PostgreSQL schema、版本化事务迁移、运行配置、角色、社区成员和审计；所有查询参数化。
- [x] 实现市场、拼车、收藏、个人中心、联系表单和四类举报。
- [x] 实现合并私聊、客户端消息幂等、引用快照、已读单调、实时事件重连及未读。
- [x] 实现全部适用 Admin 路由、管理员密码接口、审核事务与持久化通知重试。
- [x] 完成类型检查、集成测试、独立安全审查。

## Task 3：Web 与 Admin
文件：apps/web、apps/admin、packages/ui、packages/i18n。
- [x] 按 API 契约实现同源代理、认证界面、中英切换与响应式框架；无假数据和无效按钮。
- [x] 实现市场、拼车、发布编辑与本地草稿、收藏、个人中心、资料修改、邮箱修改。
- [x] 实现消息双栏、移动会话导航、引用、未读、已读、断线恢复。
- [x] 实现举报、联系与隐私政策；所有管理页面及适用操作。
- [x] 测试键盘访问、表单边界、错误状态、中英文和移动布局；截图与浏览器真实端到端验证。

## Task 4：完整验收与部署准备
- [x] 对照 docs/bm-feature-baseline.md 逐项标记证据，不将未验证功能标成完成。
- [x] 添加 ARM64 镜像、独立 Compose、备份恢复与部署文档；不执行云端部署。
- [x] 执行全测试、类型检查、生产构建和浏览器回归；代码审查后修复全部重要发现。

实际验证与范围限制见 `docs/acceptance.md`；部署仅准备材料，没有执行 OCI 变更。
