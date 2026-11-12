# 首版 API 契约

同源 `/api/v1`，认证转发 `/api/auth`。JSON 响应统一 `{data: ...}`，错误 `{error:{code,message}}`。分页 `{data:[],nextCursor:string|null}`。用户身份来自 Better Auth Cookie，绝不使用客户端用户头。当前用户 GET `/me` 返回 `{id,name,email,emailVerified,role,banned,communityId}`；无身份401。默认社区 purdue，服务端固定。

- GET /items?q=&category=&cursor= /items/:id；POST /items；PATCH /items/:id；DELETE /items/:id。字段 title,description,category(clothing/books/furniture/electronics/daily/other),priceCents(int),condition(new/like_new/good/fair),deliveryMethod(pickup/meetup/delivery),status(active/deactivated/reported/deactivated_violation)。响应 camelCase 加 id,publisherId,publisherName,createdAt,updatedAt。
- GET /rides?origin=&destination=&date=&cursor= /rides/:id；POST /rides；PATCH /rides/:id；DELETE /rides/:id。origin,destination,departureTime(ISO UTC),timeZone(IANA),feeCents,totalSeats,availableSeats,feeDescription,notes,status。
- GET /favorites；PUT /favorites/:itemId；DELETE /favorites/:itemId。
- GET /profiles/:id；PATCH /me (name)；GET /me/items?status=；GET /me/rides?status=。
- GET /conversations；POST /conversations {otherUserId} 按用户对合并；GET /conversations/:id/messages?cursor=；POST /conversations/:id/messages {clientId,text,reference?:{type:item|ride,id}}；PUT /conversations/:id/read {messageId}。消息返回 id,conversationId,senderId,text,reference,createdAt。会话返回 id,otherUser{id,name},lastMessage,unreadCount,readMessageId。
- GET /events 为受认证 SSE 事件流（message/conversation/read）；浏览器断开后重新查询数据补齐，若实现 WebSocket 则兼容相同事件载荷。
- POST /reports {targetType:item|ride|user|conversation,targetId,reason,details}；GET /public/settings；POST /contact {email,subject,message}。
- GET /admin/overview；GET /admin/users|items|rides|conversations|reports|audit|contact 支持 q,status,cursor。GET /admin/:resource/:id 返回详情。
- POST /admin/users {email,name,password,reason}；PATCH /admin/users/:id {role?,banned?,name?,reason}；POST /admin/users/:id/password {password,reason}；POST /admin/users/:id/reset-password {reason}。
- POST /admin/items|rides；PATCH /admin/items|rides/:id；DELETE /admin/items|rides/:id，管理写入 body 必带 reason。
- PATCH /admin/reports/:id {status:reviewed|dismissed|violation_confirmed,note,reason}。
- GET /admin/settings；PATCH /admin/settings {allowedEmailDomains?,allowAllEmailDomains?,communityAdminUserId?,privacyPolicyZh?,privacyPolicyEn?,contactEnabled?,reason}。
- POST /admin/community-messages {userId,text,reason}；GET /admin/community-messages 复用管理员会话列表。

管理员账号仅由显式本地 CLI 建立，无默认密码。商品收藏首版限定 item。所有用户写入需邮箱验证、未封禁、默认社区成员；所有管理接口需 admin。管理可读邮箱，公开资料不可读邮箱。时区日期筛选按每条路线 timeZone 解释。商品删除软删除，普通用户不能恢复违规下架状态。管理写入事务内写审计。费用只展示无订单。媒体接口禁用。SMTP 留空真实注册验证不可用，集成测试使用仅测试进程注入的收件箱适配器。

管理筛选：users(role,banned)，items(category,publisherId,from,to)，rides(origin,destination,publisherId,date,from,to)，conversations/community-messages(q,from,to)，reports(targetType,targetId,reason,reporterId,from,to)，audit(action,actorId,resource,resourceId,from,to)。from/to 为 YYYY-MM-DD，起止日期均包含。空筛选值忽略。管理创建/编辑商品或拼车支持 publisherId。

联系处理：PATCH /admin/contact/:id {status:open|resolved,note,reason}；事务内记录处理状态与审计。
