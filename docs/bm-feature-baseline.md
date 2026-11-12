# bm 有效功能基线

本清单来自只读静态调用链核查；不是运行验收。源根目录为 `/Users/peterluo/Documents/个人/小程序/BDS_MP`，下文路径均相对此根目录。未读取密钥或环境文件，未操作原系统。

## 冻结原则

- LoopMart 使用独立 PostgreSQL 与 Better Auth；原 Supabase/SwiftData/Edge Function 仅为行为证据，不构成迁移依赖。
- 首版纯文字、无图片及其他媒体；暂不开发 iOS，Web/Admin 中英双语。原图片字段、头像上传、S3、APNs 等不能直接当作首版必做项。
- 同一对用户合并一个会话是用户明确约束；商品/拼车只能形成上下文引用，不能因不同帖子拆会话。
- 下列勾选框为后续对齐验收项，不代表 LoopMart 已实现。

## 用户功能

| 对齐项 | 有效行为与证据 |
|---|---|
| [x] 账户 | 邮箱密码注册、登录、验证邮件重发、忘记密码、恢复密码、会话刷新、退出、昵称和邮箱修改、封禁检查。`BDSMarketPlace/BDSMarketPlace/ViewModels/AuthViewModel.swift` 的 register/login/requestPasswordReset/resendVerificationEmail/updateProfile/updateEmail/enforceProfileNotBanned；`Views/Auth/ResetPasswordView.swift` 与 `Services/SupabaseClient.swift` 的 updateUser(password:)。运行时邮箱域策略由 fetchAuthRuntimeConfig 加载，不能仅复制硬编码域名。 |
| [x] 个人页 | 我的发布支持物品/拼车及全部、上架中、被举报、用户下架、违规下架筛选；只有 active/deactivated 可由本人切换上下架。`ViewModels/ProfileViewModel.swift`。公开资料和资料编辑见 `Views/Profile/UserPublicProfileView.swift`、`ProfileEditView.swift`。 |
| [x] 物品 | 浏览、详情、发布、编辑、删除、收藏/取消收藏；字段包含标题、描述、分类、价格、成色、交付方式、发布者与时间。`Models/SecondHandItem.swift`、`Views/SecondHand/PublishSecondHandView.swift`、`Views/Profile/EditSecondHandItemView.swift`、`Services/SupabaseClient.swift` 的 fetch/create/update/deleteItem 与 favorite 方法。 |
| [x] 交付方式语义 | 模型 location 注释写“地点”，但发布表单实际将交付方式选项写入 location（`PublishSecondHandView.swift:406`）。冻结为交付方式，不能擅自新增地理位置字段来替代。 |
| [x] 拼车 | 出发地、目的地、出发时间、出发时区、费用（展示用）、费用说明、总座位、剩余座位、备注、发布者与时间；浏览、详情、发布、编辑、删除、上下架。`Models/Ride.swift`、`Views/Profile/EditRideView.swift`、`Services/SupabaseClient.swift` 的 fetch/create/update/deleteRide。没有订单/支付验收项。 |
| [x] 状态 | 模型注释仅 active/deactivated 已过时；个人页还处理 reported、deactivated_violation。违规状态不能通过本人上下架绕过。证据 `ViewModels/ProfileViewModel.swift`，以服务端状态检查及管理动作共同验收。 |
| [x] 聊天 | 当前链为 ChatRepository → findOrCreateConversation(otherUserId:) / fetchConversations / fetchMessages / sendMessageNew / markConversationRead；分页、未读、实时连接与 clientGeneratedId 去重应按当前 ChatStore/ConversationsStore 验收。旧 ChatSession、旧 sendMessage 方法仍存在，不能当成有效分帖会话架构。证据 `Chat/ChatRepository.swift`、`Chat/ChatStore.swift`、`Chat/ConversationsStore.swift`、`Services/SupabaseClient.swift`。 |
| [x] 社区管理员 | 拉取管理员身份、确保与管理员的会话，管理员消息作为会话消息呈现。`Chat/ChatRepository.swift` 的 fetchCommunityAdminUserId/ensureCommunityAdminConversation。 |
| [x] 举报 | 商品、拼车、用户与会话均需覆盖；原因编码、原因文案、补充说明及目标 ID 随提交保存。`Services/SupabaseClient.swift` 的 submitContentReport；`supabase/migrations/20260406154713*` 含会话举报支持。不能因旧枚举或早期文档遗漏 conversation。 |
| [x] 草稿 | 物品与拼车分别恢复、实时暂存、提交保存、丢弃；UserDefaults 本机存储，原图片另存本机文件。不是服务端跨设备草稿。首版只保留文字。证据 `ViewModels/PublishDraftStore.swift`。 |
| [x] 联系与政策 | 联系表单配置读取及提交、隐私政策链接；启动页内容读取属于 iOS 暂缓项。`Services/SupabaseClient.swift` 的 fetchPublicContactFormConfig/submitContactForm/fetchPrivacyPolicyLinks/fetchSplashScreenContent；`Views/Profile/ContactUsView.swift`。 |

## Admin 路由及动作清单

证据目录 `BDSMarketPlace_Admin/src/app/admin`（页面）→ `src/components/admin`（表单）→ `src/lib/admin/functions.ts` → `supabase/functions`（管理端授权及写操作）。登录与角色访问控制见 `src/app/login/page.tsx`、`src/lib/supabase/middleware.ts`。管理行为需在新系统服务端重新授权，不能仅隐藏按钮。

| 路由 | 对齐动作 |
|---|---|
| [x] `/login`、`/forbidden` | 登录、拒绝非管理员访问、退出 |
| [x] `/admin` | 总览指标 |
| [x] `/admin/users`、`/admin/users/[id]` | 搜索（邮箱/ID/昵称）、角色及封禁过滤、创建用户、查看详情、角色修改、封禁/解封、发送密码重置、设置密码；对应 admin-create-user/set-role/ban-user/send-password-reset/set-user-password |
| [x] `/admin/items`、`/admin/items/[id]` | 标题/分类/状态/发布者/时间筛选、创建、详情、修改、审核与强制删除；对应 admin-create-item/update-item/moderate-item/force-delete-item。具体按钮以 item-admin-forms 及 items-table 为准，函数存在本身不能证明入口可达 |
| [x] `/admin/rides`、`/admin/rides/[id]` | 状态/发布者/出发地/目的地/时间筛选、创建、详情、修改、强制删除；对应 admin-create-ride/update-ride/force-delete-ride |
| [x] `/admin/conversations`、`/admin/conversations/[id]` | 会话列表、最新文字与时间过滤、成员及消息详情 |
| [x] `/admin/reports`、`/admin/reports/[id]` | 状态/目标类型/原因编码/目标ID/举报人/时间筛选、详情、审核处理；对应 admin-review-content-report；处理导致的内容状态与通知应一起验收 |
| [x] `/admin/community-messages`、`/admin/community-messages/[id]` | 社区管理员会话列表、用户搜索、详情、发送消息；对应 admin-send-community-admin-message |
| [x] `/admin/community-admin` | 读取和设置社区管理员身份，admin-get/set-community-admin-settings |
| [x] `/admin/contact-form` | 联系表单配置、提交记录面板，admin-get-contact-form-dashboard / admin-set-contact-form-settings |
| [x] `/admin/auth-settings` | 邮箱认证策略读取和修改，admin-get/set-auth-settings |
| [x] `/admin/privacy-policy` | 政策链接读取和修改，admin-get/set-privacy-policy-settings |
| 不适用 `/admin/splash-screen` | 启动页配置读取和修改，admin-get/set-splash-screen-settings；此 iOS 专属配置明确暂缓，不计入首版交付 |
| [x] `/admin/audit` | 按动作、资源、操作者、日期查看审计；写端公共证据 supabase/functions/_shared/audit.ts |

## 冲突与验收边界

1. 旧模型注释、旧聊天 API、历史 PRD 不能覆盖当前调用链或用户明确取舍。
2. 原项目界面含中英文混用，不等于已满足 LoopMart 完整双语要求；需独立逐页验收。
3. 以上是代码存在性和调用关系核查，未连接原数据库验证权限策略、外部邮件、推送、运行时数据或部署状态；不能据此声称端到端通过。
4. 账户注销、订单、支付、评价、地理搜索、服务端草稿等未在本核查中确认，不作为推测功能加入。

## 本地实现验收对应

以上标记表示首版适用功能已实现并由源代码、真实 PostgreSQL 测试及浏览器关键路径共同核对，不代表穷尽所有历史 bm 场景。最终实际命令、已知边界和截图位置见 `docs/acceptance.md`。真实 SMTP、iOS 启动页和媒体能力不标记为已验收。
