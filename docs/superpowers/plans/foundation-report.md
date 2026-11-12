> 基础阶段历史记录；当前完整验收与范围限制见 `docs/acceptance.md`。

# 基础实施报告

已实现 npm workspace、TypeScript、精确域名策略、认证权限断言、SMTP 适配、Better Auth Node 服务、PostgreSQL 迁移入口和隔离 Compose。

验证：npm test 六项通过；npm run typecheck 和 npm run build 通过。安装审计零漏洞。测试覆盖域名、大小写、伪造后缀、封禁/未验证拒绝、空 SMTP 秘密安全错误、配置和已有会话权限重新加载。

限制：最初 red 因 tsx 尚未安装失败，没有记录原始 helper 的完整行为 red/green。真实 handler 尝试因 PostgreSQL 不可达失败，模拟连接未通过 Better Auth schema 检查，不将其视为集成验证。Docker 不存在，尚未运行真实数据库迁移、注册、验证、登录、重置或 SMTP 投递。无 OCI 操作或部署。

安全：创建会话检查数据库封禁与验证状态。requireMember 每次重新读取数据库，仅提供当前账户的基础权限断言，不代表完整社区成员体系。未来业务 API 必须使用该入口，不能信任客户端字段或原始 session 身份。空 SMTP 重置在 Node 请求入口和 Better Auth hook 均统一拒绝，不查询账号存在性。邮件错误不包含 transport 细节或令牌。来源明确，环境文件忽略，无默认管理员。依赖锁定，npmrc 避免无关 ORM peer 自动安装。
