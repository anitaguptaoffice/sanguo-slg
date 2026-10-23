# H5 客户端（CLIENT-001 ~ CLIENT-007）

技术栈与引擎备选说明见仓库根 [docs/client-engine.md](../docs/client-engine.md)（**当前**为 Vite + TS + Canvas 2D / DOM，非 Cocos）。

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：

**选服列表 → 登录/进服 → 拉城/建城 → 主城（内政/军事/战报/任务/背包/商城/将领/邮件）→ 世界/私聊 → 军团 → 战力排行**

## 网关地址

| 环境 | 变量 / 地址 |
|------|-------------|
| 本地 `make dev`（**默认**） | `ws://127.0.0.1:8080/ws` |
| 本地 mock（登录 + 军事桩） | `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws` |
| 其他环境 | 构建前设置 `VITE_GATEWAY_WS_URL` |

配置见 `src/config.ts`。军事消息定义在 `spec/proto/sanguo/military/v1/military.proto`（客户端通过 `loadProto` 加载 spec + `client/proto` 扩展，不修改 `spec/`）。

## 联调真实后端（推荐）

```bash
# 仓库根目录：Postgres + Redis + Go 网关（INTG-002 战斗闭环）
make dev

# 另一终端：H5
cd client && npm install && npm run dev
# 浏览器 http://localhost:5173
```

默认账号：`demo` / `demo123`。启动后先在 **选服界面** 点选服务器再「进入游戏」。

布局基线见仓库根 [`docs/art/layout-landscape.md`](../docs/art/layout-landscape.md)（**1600×900** 外框、舞台 **1600×788**、HUD/底栏各 **56px**）。实现入口：`src/engine/layoutViewport.ts`、`src/engine/mainCitySlots.ts`、`GameApp` 全屏 letterbox。

### 手动验收（横屏布局 CLIENT-007）

1. `cd client && npm run dev`，浏览器打开 H5；窗口可任意比例，页面背景为 `#1a1410`，中间为等比缩放的 **16:9 游戏外框**（非 16:9 时出现上下或左右黑边）。
2. 开发者工具将视口设为 **1600×900**：画布外框应贴满窗口；主城 **HUD** 占顶栏 56px（`#hud` 叠在画布上缘），**底栏** 按钮行占底部 56px（`.layout-toolbar`），中间为舞台。
3. 视口 **1280×720**：外框缩放至 1280×720（`uiScale=0.8`，见 `layoutViewport.test.ts`）；`mc.bg.plateau.v1` 仍铺满舞台 y∈[56,844)，`hall`/`farm` 样件与槽位对齐（可对照 `docs/art/maincity-slots.md`）。
4. 视口 **400×900**（窄屏）：左右贴边、上下 letterbox；点击农田槽位仍可触发升级（hit 区域随 `uiScale` 缩放）。
5. 选服界面面板居中落在舞台区域内（顶底各留 56px 带）。

### 手动验收（M3：选服 / 聊天 / 军团 / 排行）

1. 连接 `make dev` 后打开 H5，选服列表应出现至少 `S1`（dev 服 1）。
2. 进入主城后点 **「聊天」**：世界频道发一条消息并点「刷新」应能看到记录；私聊需填对方 `player_id`；**军团**频道需先在「军团」面板创建/加入军团，再选「军团」频道收发（`chat.v1` + `guild_id`，WIRE-001 真实网关与 mock 均支持）。
3. 点 **「军团」**：输入名称「创建军团」，或填已有 `guild_id` 加入，再「刷新成员」。
4. 点 **「排行」**：「刷新战力榜」应列出榜单，并显示 **我的名次**（未上榜时显示战力与「未上榜」）。
5. M2 军事/内政仍可用：**「军事」**、**「升级农田」** 等。

### 手动验收（M4：任务 / 背包 / 商城，对齐 INTG-004）

与 `tools/smoke/README.md` 中 `TestM4ContentSmokePath` 同路径（教程任务 1001、商城 offer 1001、道具 2001）。

1. `make dev` 启动后进入主城，HUD 显示 **币**（`player_wallet.gold`，商城银币价映射到 gold 字段）。
2. **任务**：打开「任务」→「接取」→「上报进度(绝对值2)」→「领奖」。背包应出现谷袋·初备（2001）；HUD 粮/币随奖励变化。
3. **商城**：打开「商城」→「刷新货架」→ 选择 offer 1001 →「购买×1」。余额不足时状态栏显示服务端错误；成功时 HUD **币** 减少且背包数量增加（`wallet_after` 真扣费，无 spent overlay）。
4. **背包**：「刷新背包」调用 `content.v1.ListPlayerBag` 拉服务端持久化全量并覆盖会话背包展示；「使用道具」调用 `content.v1.UseConsumable`（与 `internal/api/content_handlers.go` 一致）。资源包(2001)/加速符(2003) 使用成功后 HUD 粮/币或状态栏效果摘要应更新。

### 手动验收（日常 chain 400，CLIENT-009）

与 `tools/smoke/README.md` / INTG-007 中 `daily_food_1`（`quest_cfg_id=1012`，`chain_id=400`）一致；进度由服务端 QUEST-002 自动挂钩，客户端**无**手填上报。

1. `make dev` 进入主城（君主等级须满足 cfg 解锁，dev 账号通常已够）。
2. 底栏点 **「日常」**（与教程 **「任务」** 面板分离）。列表应经 `quest.v1.ListPlayerQuests` + `chain_id=400` 展示 `daily_food_1` 等行：cfg code、状态文案、`current/target` 进度。
3. 选中 `daily_food_1` → **接取** → 通过内政收粮或等待资源累积使进度达标（真实服自动推进）→ **领奖**。HUD **粮/木/铁/石/币** 与状态栏背包摘要应更新（`ListPlayerBag` + 领奖 `granted_rewards` 合并，同 ContentPanels）。
4. 视口 **1600×900**：底栏含「日常」且单行不撑破 56px 底栏；面板落在顶底 56px 带之间、可滚动。

mock 网关（chain 400 默认列出 1012）：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（M4：将领 / 邮件，CLIENT-008）

与 `internal/api/hero_handlers.go`、`internal/api/mail_handlers.go` 网关路由一致（`make dev` 真实 PG）。

1. 进入主城后点 **「将领」** →「刷新列表」。新号应为空列表提示；若已有将领，点击列表项加载 `hero.v1.GetHeroDetail` 详情（属性/忠诚）。
2. **招募模板**：点「刷新招募模板」调用 `hero.v1.ListRecruitTemplates`；下拉或列表行展示模板名、稀有度、资源+道具消耗预览（与 HERO-003 / `make dev` 目录一致）。选择模板后「招募」使用所选 `template_cfg_id` 与预览中的 `item_cfg_id`（及 `pool`），不再手填 1001/2004。
3. **招募**：成功时列表出现新将领，状态栏显示 `hero_id`；道具/资源不足时显示服务端 `code` 与 `msg`。
4. 点 **「邮件」** →「刷新收件箱」。可用 `cmd/gm send-mail`（见 `docs/ops`）向当前角色发带附件邮件。
5. 选中邮件 ID →「标为已读」调用 `content.v1.MarkPlayerMailRead`；「领取附件」调用 `content.v1.ClaimMailAttachments`，HUD 资源/背包应更新（`wallet_after` / `bag_items`）。
6. 面板落在 1600×900 外框内（与 CLIENT-007 一致）：顶底各 56px，内容区可滚动、不撑破外框。

mock 网关预置 1 封欢迎邮件与 2 本名册，便于离线点领：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

```bash
# 仓库根
make dev
cd client && npm install && npm run dev
```

### 手动验收（募兵 → 行军 → 战报）

1. 登录进入主城后，点 **「军事」** 打开面板。
2. **募兵**：选兵种（默认步兵）、数量（如 50），点「募兵」。HUD 会显示扣费后的资源；若返回 `queue_id` / `finish_at_ms`，需等到完成时间后再出征（服务端调度器在 `make dev` 中自动推进）。
3. **出征**：目标默认 **(5,5)**（M2 驻点），调整出征步兵数量后点「出征攻击」。状态栏与画布会显示行军阶段与预计到达时间。
4. 等待行军到达并完成战斗后（真实环境取决于距离与调度），点底栏 **「战报」** → **「刷新列表」**，点击某条战报查看回合/伤亡摘要（字段以服务端为准）。
5. 内政仍可用：**「升级农田」「刷新状态」**。

## 仅 mock 网关

`mock-server` 实现 `Login`、**选服/进服**、**聊天（含军团频道）/军团/排行**、**quest/shop/content.v1 背包** 与军事路由的**即时**桩（募兵无队列）。另含最简建城/内政桩以便进主城；完整内政与持久化请连 `make dev`。

```bash
cd client && npm run mock:gateway   # ws://127.0.0.1:19090/ws
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 验证

```bash
cd client && npm test && npm run build
```

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`militaryFormat`、`bagState`（网关背包合并）、`BattleReportPanel`（空列表/加载失败/列表行）、`dailyQuestState` / `DailyQuestPanels`（chain 400 列表与领奖合并）、`heroMailState`（招募模板解析/空列表、邮件领取）/ `HeroMailPanels` 与 `StartMarchRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
