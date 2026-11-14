---
name: LoopMart
description: 校园交换站：橙白配色的校园市场与拼车界面。
colors:
  accent: '#cf3f23'
  accent-muted: '#fff0e9'
  text-accent: '#b9351d'
  canvas: '#f8f8f6'
  surface: '#ffffff'
  muted: '#f0f2ed'
  text-primary: '#252b28'
  text-secondary: '#626d65'
  border: '#e2e6df'
  border-emphasized: '#c5cdc3'
  error: '#b42318'
  success: '#137547'
typography:
  headline:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.3
  title:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 20px
    fontWeight: 650
  body:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 14px
    fontWeight: 500
  supporting:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  price:
    fontFamily: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.02em
rounded:
  inner: 4px
  element: 10px
  container: 14px
  admin-element: 8px
  admin-container: 12px
spacing:
  '2': 0.5rem
  '3': 0.75rem
  '4': 1rem
  '5': 1.25rem
  '6': 1.5rem
  '8': 2rem
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.surface}'
    rounded: '{rounded.element}'
    padding: 10px 16px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.element}'
    height: 40px
  category-selected:
    backgroundColor: '{colors.accent-muted}'
    textColor: '{colors.text-accent}'
    rounded: '{rounded.element}'
  navigation:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-secondary}'
  listing-card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text-primary}'
    rounded: '{rounded.container}'
    padding: 18px
---

# Design System: LoopMart

## Overview

**Creative North Star: "校园交换站"**

「校园交换站」是用户在 2026-11-14 选定的视觉方向。橙色品牌与操作、清白底色、白色面板及炭绿文字，服务于真实的浏览、比较、发布和联系。界面采用系统字体和清楚的信息层级，后台共享颜色但保持紧凑密度。

这是开发文档；方向名称、设计原则及演示数据不进入产品文案。产品边界见 [PRODUCT.md](PRODUCT.md)。

**Key Characteristics:**
- 橙白单主色，价格和主操作清楚可见。
- 白色平面、细边框和克制圆角。
- 系统字体、中英文与手机触摸共同约束布局。

提取依据：[foundation.ts](src/themes/foundation.ts)、[Web theme](src/themes/loopmart-web/loopmartWebTheme.ts)、[Admin theme](src/themes/loopmart-admin/loopmartAdminTheme.ts) 及对应生成 CSS；实际屏幕证据在 `.impeccable/review/`。前置方向记录不替代最终源码。

## Colors

### Primary

`accent` 是环形品牌标记、主按钮及当前导航的橙色；白字用于实心主操作。`text-accent` 用于价格，以及浅橙 `accent-muted` 上的选中分类和后台导航。信息状态沿用同一主色，不增加第二套品牌色。

### Neutral

`canvas` 承载页面，`surface` 承载面板，`muted` 承载无图占位和后台摘要。`text-primary` 与 `text-secondary` 建立阅读层级；`border` 分隔面板，`border-emphasized` 标识输入边界。错误与成功使用主题语义色并保留文字反馈。

## Typography

标题与正文共用前置系统字体栈；不加载品牌字体。前置 token 是桌面 Web 的默认角色。手机正文为 (16px)、一级标题为 (25px)、输入为 (16px)；商品标题从桌面 (16px) 变为手机 (14px)，价格从 (24px) 变为 (22px)。详情价格为桌面 (40px)、手机 (34px)。金额保留等宽数字。

后台正文为 (14px / 1.5)，标签和辅助文字为 (12px)，一级标题为 (25px / 650)，手机一级标题为 (23px)。后台控件字体为桌面 (13px)、手机 (16px)。字体语义见主题；商品价格细节见 [ListingCard.tsx](packages/ui/src/web/ListingCard.tsx)。

## Layout

全局桌面边界为 (1200px)，Web 内容最大宽度为 (1440px)。左右留白依次为宽屏 (32px)、低于桌面边界 (24px)、手机 (16px)。使用前置 spacing 的 Astryx 间距节奏，不新建独立 spacing 体系。

商品在 (1024px) 起三列，以下两列；拼车始终一列，手机将路线与费用区域上下排列。这里的有效 `lg` 是主题 adaptations 覆盖后的 (1024px)，不是 `breakpoints.ts` 的原始 (1050px)。

公共桌面头部为一行；(768–1023px) 搜索独占第二行；低于 (768px) 为品牌操作、搜索、导航三行，并显示五项底部导航和安全区域。对应头部高度预算为 (72px / 128px / 176px)，不是固定实际高度。手机打开具体会话时隐藏外壳并由聊天独占视口。见 [WebShell.tsx](packages/ui/src/web/WebShell.tsx) 与 [BrowsePage.tsx](packages/ui/src/web/BrowsePage.tsx)。

后台以侧栏和表格组织；手机隐藏侧栏，使用头部菜单和逐条记录摘要。不要把商品网格视为所有页面的通用模板。

## Elevation & Depth

商品、行程、表单和后台容器在静止时明确使用 `box-shadow: none`，依靠白底、色调分层和细边框区分。弹窗、浮层和按压继续使用 Astryx 原生行为，不能据此宣称全应用无阴影。没有额外的装饰性入场动画或卡片位移。

## Shapes

Web 控件使用 `element`，面板和聊天气泡使用 `container`；后台控件和面板分别收紧为 `admin-element` 与 `admin-container`。面板边框为 (1px)。圆形收藏按钮、头像和品牌环形标记保留其专用轮廓，不能一律替换为矩形。

## Components

### Buttons

主按钮为橙底白字，次按钮为白底正文色及细边框，ghost 为透明底辅助文字。Web 控件默认 (40px)，手机触摸控件至少 (44px)。后台按钮 padding 为 (7px 12px)，Web 见前置 token。

Hover / pressed 使用 Astryx 原生叠色，主题叠色分别为 `#252b2808` / `#252b2812`；`--lm-accent-hover` 虽有定义，并未被 Button 显式用作 hover 填色。键盘焦点使用主题橙色描边，Web 宽 (3px)、偏移 (3px)；后台描边宽 (2px)，沿用偏移。不要为示例添加深橙 hover 或位移动画。

### Inputs / Fields

白底、强调边框及控件圆角；保留标签、校验、清空和禁用语义。全局搜索是一个合并边框的输入与橙色图标按钮，不是两个分离控件。

### Chips

分类使用 ToggleButton，选中为浅橙底与深橙文字，并显式保留 `aria-pressed`。此样式在 BrowsePage 中明确赋值，不能只依赖 ghost 变体的主题状态。商品成色与交付方式继续使用 Token；Badge 只表示数量。

### Cards / Containers

商品无图占位高度为桌面 (160px)、手机 (112px)，真实图片为 (4:3)。正文 padding 为桌面 (18px)、手机 (12px)。标题、价格、元数据、发布者形成纵向层级；收藏独立于详情主链接。拼车宽卡以完整路线和出发时间为主，费用与发布者在桌面右侧、手机下方。见 [MediaGallery.tsx](packages/ui/src/shared/MediaGallery.tsx)。

### Navigation

当前市场／拼车入口为橙色和底线；底部导航以图标加标签呈现，保留 `aria-current`。后台选中导航为浅橙底与深橙字。品牌由环形 SVG 与 LoopMart 字标组成，见 [Brand.tsx](packages/ui/src/shared/Brand.tsx)。

## Do's and Don'ts

### Do:
- Do 复用 Astryx 主题、组件和既有状态语义。
- Do 将收藏与商品详情主链接保持为独立操作。
- Do 使用真实数据；无图时保留中性占位。

### Don't:
- Don't 将内部设计方向、slogan 或虚构运营数据写进产品。
- Don't 将宽行程信息压成商品窄卡，或将后台桌面表格改为商品卡网格。
- Don't 用颜色代替标签、焦点、aria-current 或 aria-pressed。
