# 本地开发与验证

## 目录及资源

源码保存在当前 LoopMart 仓库。Docker Desktop 位于 `/Applications/Docker.app`；用户命令入口在 `~/.docker/bin`。Docker 镜像与卷位于 Docker 管理的虚拟磁盘，不挂载个人资料目录。

本项目 Docker 资源使用 `loopmart-local` 前缀。开发 PostgreSQL 为 `127.0.0.1:5432`，持久卷 `loopmart-local_loopmart-data`；测试库为 `127.0.0.1:5433`，使用 tmpfs，重建容器后清空。两者各限制 1 核、768 MB。测试数据不能指向开发或远端数据库。

## 初次启动

```sh
export PATH="$HOME/.docker/bin:$PATH"
npm ci
node scripts/setup-local-env.mjs
docker compose --env-file .env -f infra/compose/local.yaml --profile test up -d
npm run db:migrate
npm run dev
```

已存在环境文件时，生成脚本拒绝覆盖。凭据不提交、不输出；SMTP 保持空值。Web 使用 http://localhost:3000，Admin 使用 http://localhost:3004。开发进程监听回环地址，不对局域网开放。

## 验证

```sh
npm test
npm run test:integration
npm run typecheck
npm run build
```

真实认证测试使用代码注入的隔离测试收件箱，执行实际验证链接，不增加公网测试接口、不关闭邮箱验证。浏览器测试种子也只允许本机名为 `loopmart_test` 的数据库：

```sh
node --env-file=.env.test --import tsx tests/browser/seed.ts
LOOPMART_ENV_FILE=.env.test npm run dev
```

测试身份凭据仅保存在被忽略的 `.superpowers/e2e/users.json`。Playwright 运行说明和实际证据见验收报告；不要复制测试注入到生产配置。

## 管理员与邮件

无默认管理员或默认密码。先迁移数据库，再显式提供 `ADMIN_EMAIL`、`ADMIN_NAME`、`ADMIN_PASSWORD`，运行 `npm run admin:create`。凭据通过本地私有环境或秘密管理工具提供，避免写进命令历史。创建的管理员仍需邮箱验证；未配置 SMTP 时不能完成真实邮件验证。不要手工修改数据库的验证状态作为产品注册流程。

## 停止、备份与清理

Ctrl+C 停止 Web／API／认证进程。`docker compose --env-file .env -f infra/compose/local.yaml stop` 停止数据库并保留开发卷。不要执行 `down -v` 或 Docker 全局清理来“重启项目”，这会删除持久数据。

```sh
mkdir -p backups
chmod 700 backups
docker compose --env-file .env -f infra/compose/local.yaml exec -T postgres pg_dump -U loopmart -Fc loopmart > backups/loopmart.dump
```

备份包含用户资料、消息及认证数据，保持私有，勿提交 Git。恢复应先在新的隔离数据库演练，再对目标进行授权操作。

## 浏览器端到端验收

使用独立 Python 虚拟环境安装测试依赖，不修改系统 Python：

```sh
python3 -m venv .venv
.venv/bin/pip install -r tests/browser/requirements.txt
.venv/bin/python -m playwright install chromium --no-shell
node --env-file=.env.test --import tsx tests/browser/seed.ts
LOOPMART_ENV_FILE=.env.test LOOPMART_MODE=production npm run dev
# 在另一个终端执行：
.venv/bin/python tests/browser/e2e.py
.venv/bin/python tests/browser/admin_crud.py
```

生产模式启动前需执行 `npm run build`（包含 standalone 静态资源整理）。测试执行时不要同时运行会修改运行配置的数据库集成测试。浏览器脚本使用真实 API 与隔离测试账号，生成的截图位于被忽略的 `.superpowers/e2e`。可用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 指定已安装的测试 Chromium；默认使用 Playwright 管理的浏览器。

Astryx 界面还有独立的浏览器回归，使用拦截的 API 数据，不访问数据库。先构建并启动两个 Web 应用，再运行 `.venv/bin/python tests/browser/astryx_ui.py`；可通过 `LOOPMART_WEB_URL`、`LOOPMART_ADMIN_URL` 指定测试地址。它检查中英文页面、移动布局、发布、聊天和管理确认操作。再运行 `.venv/bin/python tests/browser/design_language.py` 检查原设计的主题、导航、卡片比例、响应断点和后台密度；截图保存在 `.superpowers/e2e/astryx`。

修改 `src/themes` 中的主题定义后运行 `npm run theme:build`，由 Astryx 生成 CSS 和类型文件；不要手动编辑生成文件。`npm run theme:check` 可验证其是否同步。用户端与后台通过同一主题基础继承各自的原有配色，页面内使用组件属性和主题 token。

截图和报告不构成真实 SMTP 投递或 iOS 验收，本项目首版明确不包括这两项。

集成测试入口会核验目标是本机 5433 端口的 `loopmart_test`，拒绝远程、开发库及可覆盖连接参数的查询字符串，校验通过前不会迁移或写入。
