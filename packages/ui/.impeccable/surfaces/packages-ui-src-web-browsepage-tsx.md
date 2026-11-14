---
version: 1
slug: "packages-ui-src-web-browsepage-tsx"
primary_target: "packages/ui/src/web/BrowsePage.tsx"
related_targets: ["packages/ui/src/web/WebShell.tsx","packages/ui/src/web/ListingCard.tsx","packages/ui/src/admin/AdminShell.tsx"]
---

# LoopMart 校园交换站：已选设计方向

2026-11-14，用户选择「校园交换站：橙白配色，商品网格与宽行程卡」。本说明取代此前本轮精修中“保留蓝色／灰绿”的视觉约束；保留产品、数据、权限与现有操作能力。

## Direction contract

**THESIS:** 以校园物品交换为中心，搜索和商品发现直接进入首屏，拼车按一条完整行程浏览。避免把商品与行程压进同一组窄卡片。

**OWN-WORLD:** 清白页面 `#f8f8f6`、白色面板、炭绿正文 `#252b28`、橙色品牌与主操作。为满足小字号按钮的对比度，主橙取 `#cf3f23`，浅橙为 `#fff0e9`；14px 商品面板圆角、10px 控件圆角，系统中文／拉丁字体。所有值经 Astryx 主题编译。

**STORY:** 用户进入市场后搜索或切换分类，比较标题、价格、成色与发布者，再打开详情联系；切换拼车后比较出发时间、路线、座位和费用。后台延续同一套颜色与控件，保持紧凑表格。

**FIRST VIEWPORT:** 顶部为环形标记、LoopMart 字标、市场／拼车导航及收藏、消息、账号和发布入口；主内容全宽，标题与搜索明确分层，商品分类横排，其他筛选通过可关闭面板进入。商品为三列网格，中窄屏两列；拼车为一列宽卡。768–1023px 顶栏将搜索独立为第二行。手机保留五项底部导航和安全区域。

**FORM:** 已批准的交互稿「校园交换站」，来自候选序列第一项校园书店寄售台；direction seed `5d0b5897`，选择类型 pick。交互稿是方向与结构依据，不将演示数据、伪页面功能或虚构图片迁入产品。

**SIGNATURE:** 分类切换、筛选应用、收藏状态、详情联系与返回均给出直接反馈；布局不因按压而位移。使用简短颜色／状态过渡，尊重减少动画偏好，不添加装饰性入场动画。

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## 实现边界

- 继续使用 Next.js、React、Astryx；不新增依赖、CSS 文件、后端接口、数据库或配置设施。
- 复用已有 Web/Admin 外壳和页面职责；商品浏览取消桌面左筛选栏，使用横向分类和面板筛选，拼车改为宽行程卡。
- 搜索、分类、金额、成色、交付、路线、日期、排序和游标分页保持真实服务端查询。0价格、空筛选、迟到响应和返回缓存继续正确。
- 有图仍保留4:3；无图使用紧凑中性占位，不注入演示照片。收藏独立于主要详情点击区域。
- 详情、发布、聊天、账号及后台沿用现有业务与安全确认，用统一主题、价格强调和品牌连接整体设计。
- 中英文、320/390/768/1024/1440px、键盘、焦点、触摸尺寸、未加载及失败状态纳入验收。

## 已批准参考

`/Users/peterluo/.codex/visualizations/2026/11/14/01a1d7fe-b764-78e0-b538-05fb98b0f2ff/loopmart-design-directions.html` 中「校园交换站」。已查看对应桌面和手机截图；当前真实 API 无图片数据，不以样片制造上线后的错误预期。
