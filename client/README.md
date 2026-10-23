# H5 客户端（CLIENT-001 ~ CLIENT-004）

技术栈与引擎备选说明见仓库根 [docs/client-engine.md](../docs/client-engine.md)（**当前**为 Vite + TS + Canvas 2D / DOM，非 Cocos）。

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：

**选服列表 → 登录/进服 → 拉城/建城 → 主城（内政/军事）→ 世界/私聊 → 军团 → 战力排行**

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

### 手动验收（M3：选服 / 聊天 / 军团 / 排行）

1. 连接 `make dev` 后打开 H5，选服列表应出现至少 `S1`（dev 服 1）。
2. 进入主城后点 **「聊天」**：世界频道发一条消息并点「刷新」应能看到记录；私聊需填对方 `player_id`。
3. 点 **「军团」**：输入名称「创建军团」，或填已有 `guild_id` 加入，再「刷新成员」。
4. 点 **「排行」**：「刷新战力榜」应列出榜单，并显示 **我的名次**（未上榜时显示战力与「未上榜」）。
5. M2 军事/内政仍可用：**「军事」**、**「升级农田」** 等。

### 手动验收（募兵 → 行军 → 战报）

1. 登录进入主城后，点 **「军事」** 打开面板。
2. **募兵**：选兵种（默认步兵）、数量（如 50），点「募兵」。HUD 会显示扣费后的资源；若返回 `queue_id` / `finish_at_ms`，需等到完成时间后再出征（服务端调度器在 `make dev` 中自动推进）。
3. **出征**：目标默认 **(5,5)**（M2 驻点），调整出征步兵数量后点「出征攻击」。状态栏与画布会显示行军阶段与预计到达时间。
4. 等待行军到达并完成战斗后（真实环境取决于距离与调度），点 **「刷新战报列表」**，点击某条战报查看回合/伤亡摘要（字段以服务端为准）。
5. 内政仍可用：**「升级农田」「刷新状态」**。

## 仅 mock 网关

`mock-server` 实现 `Login`、**选服/进服**、**聊天/军团/排行** 与军事路由的**即时**桩（募兵无队列）。另含最简建城/内政桩以便进主城；完整内政请连 `make dev`。

```bash
cd client && npm run mock:gateway   # ws://127.0.0.1:19090/ws
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 验证

```bash
cd client && npm test && npm run build
```

单测包含 `militaryFormat` 辅助函数与 `StartMarchRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、场景管理、占位 `AssetLoader`
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
