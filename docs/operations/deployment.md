# OCI 部署准备与恢复

## 当前边界

本文件和配置是待审核的部署材料，没有在 OCI 执行安装、建库、迁移、代理变更或部署。Cardmaster 的 `/data/better-auth/compose.yaml`、service、数据库和密钥均保持原样。

## 部署布局

- `/data/loopmart/`：业务 Compose、私有环境、备份说明。
- `/data/better-auth/loopmart/`：独立认证 Compose 与私有认证环境。
- 同一个可追踪版本的仓库构建镜像供独立进程使用，避免维护两份源码。
- Compose 项目分别为 `loopmart` 和 `loopmart-auth`，与 Cardmaster 的 `better-auth` 项目隔离。
- 只有 LoopMart 服务加入 `loopmart-internal` 网络；Cardmaster 不加入该网络。

## 镜像构建

在本地或经批准的构建环境执行，发布镜像或推送仓库需另外授权：

```sh
docker build --platform linux/arm64 -f infra/docker/Dockerfile -t loopmart:REVIEWED_COMMIT .
```

默认内网 API 地址 `http://api:3002`、认证 `http://auth:3001`。两个客户端构建时固定这些代理目的地；实际公开域名通过各自反向代理 Host 保留。运行时 `BETTER_AUTH_URL` 使用审核后的 HTTPS 公共认证地址，`TRUSTED_ORIGINS` 显式列出用户端与管理端地址。

认证在两个客户端的同源 `/api/auth` 路由提供会话 Cookie。默认 Cookie 不向父域扩散，Web 和 Admin 各自登录，账号共用 LoopMart 身份。生产须验证域名、Secure Cookie、回跳与邮件链接，不能直接把开发 localhost 设置复制上线。

## 上线前审核清单

核对空闲端口、磁盘、内存、独立 PostgreSQL 用户、秘密文件0600、域名证书与备份。业务 DATABASE_URL 使用网络内 `postgres:5432`，不是本机回环；SMTP 可继续留空，此时真实注册与找回不可用。指定不可变镜像标签 `LOOPMART_IMAGE_TAG`，不要引用 Cardmaster 变量或密钥。

部署时先创建业务网络并完成数据库健康检查和迁移，再启动认证，然后启动 Web、Admin、API。对应模板：`infra/compose/deployment.yaml` 与 `infra/compose/auth.deployment.yaml`。命令必须显式指定文件和项目路径，不在 `/data/better-auth` 父目录运行无参数 Compose。

`infra/proxy/loopmart.conf.example` 是待替换域名的 HTTP 路由示例，不能直接作为公网最终配置；正式配置需 HTTPS 证书、HTTP重定向与受控代理。SSE 路由禁用缓冲并保留长连接，不把数据库端口暴露公网。

## 备份与恢复

使用 PostgreSQL `pg_dump -Fc` 生成一致备份，保存为私有文件；认证和业务表在同一 LoopMart 数据库中一起备份。生产应明确保留周期、外部副本和恢复演练方式后上线。不能把 Docker 数据盘快照视为已验证的逻辑备份。

恢复到新的隔离数据库，用 `pg_restore --no-owner` 导入，再执行数据完整性检查、实际登录、列表与消息读取验证。恢复或覆盖现有数据库属于需另外批准的操作。本轮只对本地隔离测试数据执行演练。

## 发布与回滚

发布前备份并保存镜像标签、迁移版本和配置版本。应用镜像可回退，但数据库 schema 不保证自动可逆；有破坏性迁移时应采用向前兼容分阶段策略。不要未经审核执行逆向 SQL 或删除数据卷。操作后检查用户端、管理端、邮件状态、长连接、后台通知重试及审计。
