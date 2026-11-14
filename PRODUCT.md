# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

校园社区内浏览、发布二手物品及寻找拼车的用户；维护内容与处理举报的社区管理员。

## Product Purpose

LoopMart 提供商品与拼车信息浏览、发布、收藏及文字私聊。用户通过发布者沟通完成后续安排。管理后台承担内容、成员与社区管理。

## Capabilities and Constraints

- 用户端与独立管理后台已有实现，支持中英文与手机浏览器。
- 保留现有业务、认证、权限与数据能力；本轮重新确定整体视觉方向及页面组织。
- 不包含支付、订单、预订、扣座、媒体上传或原生客户端。
- 图片展示组件存在，当前生产 API 不提供真实图片；设计演示内容必须明确与生产数据区分。
- Next.js 16.4.6、React 19.3.1、Astryx 0.7.15；复用现有组件和主题机制。

## Brand Commitments

产品名称沿用 LoopMart。用户在 2026-11-14 允许调整整体设计，并在评审可交互方案后选择橙白「校园交换站」方向；原蓝色及后台灰绿配色已由这一选择取代。设计强调商品浏览和完整行程的信息层级。

## Evidence on Hand

既有业务约束见 `docs/superpowers/specs/2026-11-12-loopmart-design.md`；页面与交互约束见 `docs/superpowers/specs/2026-11-13-loopmart-ui-redesign-design.md`。用户可见文案不使用内部设计原则、slogan 或虚构运营数据。

## Product Principles

- 通过清楚的信息层级，让浏览、比较、发布与联系入口容易找到。
- 商品与拼车保留各自真实的数据与操作能力。
- 管理员操作清晰、可确认，保留服务端鉴权和审计。
- 设计决策记录在开发文档中，不转写为产品宣传文案。

## Accessibility & Inclusion

保持键盘可用、清晰焦点、可读对比度、中英文布局及移动端触摸目标；不禁用浏览器缩放。
