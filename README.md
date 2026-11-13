# LoopMart

面向校园社区的二手市场与拼车产品，提供用户 Web 和管理后台。支持独立 Better Auth、PostgreSQL、文字私聊、收藏、举报、社区管理消息、审计及中英文界面。无支付、媒体上传和 iOS 客户端。

## 本地运行

要求 Node.js24、npm、Docker Desktop。源码在当前仓库，数据库由项目独立 Docker 资源管理。

```sh
export PATH="$HOME/.docker/bin:$PATH"
npm ci
node scripts/setup-local-env.mjs
docker compose --env-file .env -f infra/compose/local.yaml --profile test up -d
npm run db:migrate
npm run dev
```

已经有 `.env` 和 `.env.test` 时不要重建配置；生成脚本会拒绝覆盖。启动后访问 [用户端](http://localhost:3000) 和 [管理端](http://localhost:3004)。认证和业务服务分别监听本机3001、3002。

SMTP 当前留空，因此真实用户注册验证和密码找回暂不可用；不会自动验证账号或暴露验证链接。发信凭据由你后续配置。管理员通过 `npm run admin:create` 显式建立，无默认账号密码，仍需邮箱验证。

## 验证

```sh
npm test
npm run test:integration
npm run typecheck
npm run build
```

集成测试只使用 `.env.test` 中的本地隔离 PostgreSQL，测试收件箱仅由测试代码注入。浏览器测试种子和过程见[本地开发说明](docs/operations/local-development.md)。不要将测试身份或测试配置用于生产。

## 源码结构

用户 Web 和管理后台统一使用 Astryx 0.7.15 组件，共享入口是 `packages/ui/src/DesignSystem.tsx`。`src/themes/foundation.ts` 集中定义组件规则，用户端蓝色主题与后台灰绿主题保留原有设计语言。运行 `npm run theme:build` 编译主题，`npm run theme:check` 检查生成文件是否同步；完整构建会自动编译主题。`npm test` 检查组件覆盖和主题边界。

```text
apps/web          用户 Web（Next.js）
apps/admin        管理后台（Next.js）
apps/api          业务 API、实时消息、权限与后台任务
apps/auth         LoopMart 独立 Better Auth
packages/database PostgreSQL 业务迁移
packages/ui       Web／Admin 界面、请求封装与本地化
packages/contracts 共享权限与邮箱策略
packages/integrations SMTP 适配边界
infra             本地数据库与部署模板
scripts           本地启动、迁移、管理员初始化
tests             基础、真实数据库和浏览器测试
docs              设计、API、验收与运维文档
```

未来 iOS 工程放在 `apps/ios`，首版不创建空工程。服务器认证部署目录规划为 `/data/better-auth/loopmart`，Cardmaster 原目录不动。当前没有执行 OCI 部署。

- [已批准设计](docs/superpowers/specs/2026-11-12-loopmart-design.md)
- [实施计划](docs/superpowers/plans/2026-11-12-loopmart-implementation.md)
- [bm 功能基线](docs/bm-feature-baseline.md)
- [API 契约](docs/api/contract.md)
- [部署与恢复](docs/operations/deployment.md)
