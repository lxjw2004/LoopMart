# LoopMart 基础能力实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立可以独立测试的本地认证与数据库基础，为 Web、Admin、市场、拼车及聊天提供接入点。

**Architecture:** TypeScript 单仓库；独立 Better Auth 进程与业务 API；PostgreSQL 本地持久化。业务权限由服务器校验，不信任客户端用户信息。

**Tech Stack:** Node.js 24、TypeScript、npm workspaces、Better Auth、PostgreSQL、Node 测试运行器。

## Global Constraints

- OCI 仅只读；不修改 Cardmaster，不部署。
- 默认允许 purdue.edu，SMTP 留空，不绕过邮箱验证。
- 按用户对合并聊天，未来 iOS 复用 API。
- 不做支付、媒体上传、生产数据迁移。

## Task 1：单仓库与认证基础

文件：根 package.json、tsconfig.json、.gitignore、.env.example、README.md；apps/auth/src/{config,server}.ts；packages/contracts/src/{email-policy,permissions}.ts；packages/integrations/src/mail.ts；infra/compose/local.yaml；tests/foundation.test.ts。

接口：emailAllowed(email, policy): boolean；assertMember(actor): void；createMailSender(config)；createAuth(config)。认证使用 Better Auth 的官方 Node 适配器，真实用户存储 PostgreSQL。

- [ ] 先检查官方 Better Auth Node、pg、邮件接口与迁移用法；将实际选型和命令写入 README。
- [ ] 配置 npm workspaces、TypeScript 和测试脚本；不添加空业务页面假装已完成产品。
- [ ] 先写测试：purdue.edu 可注册、伪造后缀和子域拒绝、大小写规范、非验证及封禁成员拒绝、空 SMTP 不投递且不输出令牌。
- [ ] 执行 `npm test`，确认新行为缺失时失败，再实现域名策略、权限与邮件适配接口。
- [ ] 配置 Better Auth 邮箱密码、验证与重置回调、禁用未验证登录、安全来源和环境变量校验。禁止自动创建默认密码管理员。
- [ ] 提供独立命名的本地 PostgreSQL Compose 配置：开发持久化卷、测试独立数据库；不映射公网地址、不包含真实密码；根目录不加入 node_modules 或 .env。
- [ ] 执行 `npm test`、`npm run typecheck`、`npm run build`；未有 Docker 时记录真实数据库集成测试尚未执行。
- [ ] 独立审查认证、隔离与秘密处理，修复后记录检查结果。

## 后续子计划顺序

基础验收后分别编写市场与拼车、实时聊天、Admin 和响应式 Web 的逐任务计划。各自先核对 bm 有效实现与 API 契约，再测试、实现、审查。完整首版验收标准沿用设计文档第 13 节；本基础计划完成不等于完整首版完成。
