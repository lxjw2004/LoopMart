# LoopMart 认证基础

要求 Node.js 24、npm。本阶段仅认证与数据库基础，不是完整市场产品。

1. 执行 `npm ci`。
2. 复制 `.env.example` 为 `.env`，设置本地数据库密码及随机密钥（`openssl rand -base64 48`）。不要提交环境文件。
3. Docker 可用时执行 `docker compose --env-file .env -f infra/compose/local.yaml up -d postgres`。
4. 执行 `npm run build && npm run auth:migrate`，仅向已确认的本地数据库应用 Better Auth schema。
5. 配置可信且启用 TLS 的 SMTP_URL 与 MAIL_FROM，之后注册才开放；空 SMTP 不绕过验证或输出令牌。
6. 执行 `npm run auth`，服务绑定 127.0.0.1:3001，路径 `/api/auth/*`。

验证命令：`npm test`、`npm run typecheck`、`npm run build`。测试库使用独立服务 postgres-test，启动时添加 `--profile test`，端口 5433、临时存储；不得使用开发或生产数据运行集成测试。

ALLOWED_EMAIL_DOMAINS 默认 purdue.edu，只匹配完整域名、不包含子域；账户独立。未来业务授权应调用 apps/auth/src/member.ts 的 requireMember，每次重新读取账户状态。原始 session 仅表示身份。该函数是账户验证/封禁基础断言，完整社区成员体系尚未实现。无默认管理员。

采用官方 [Node 适配器](https://www.better-auth.com/docs/integrations/node)、[数据库迁移](https://www.better-auth.com/docs/concepts/database)、[邮件验证](https://www.better-auth.com/docs/concepts/email) 与 [pg Pool](https://node-postgres.com/features/pooling)。迁移脚本通过 getMigrations 应用同一认证配置。依赖锁定，npmrc 关闭无关 peer ORM 自动安装。未部署、未访问 OCI、未修改 Cardmaster。
