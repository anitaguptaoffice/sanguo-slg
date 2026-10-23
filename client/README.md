# H5 客户端（CLIENT-001 / CLIENT-002）

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：**注册/登录 → 拉城/建城 → 主城建筑与资源 → 建造/升级**。

## 网关地址

| 环境 | 变量 / 地址 |
|------|-------------|
| 本地 `make dev`（**默认**） | `ws://127.0.0.1:8080/ws` |
| 本地 mock（仅登录演示） | `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws` |
| 其他环境 | 构建前设置 `VITE_GATEWAY_WS_URL` |

配置见 `src/config.ts`。`spec/proto/` 为只读契约；M1 的 `CreateCity` / `GetCityState` / `Register` 消息定义在 `client/proto/`（与 `internal/api` 对齐，不修改 `spec/`）。

## 联调真实后端（推荐）

```bash
# 仓库根目录：Postgres + Redis + Go 网关
make dev

# 另一终端：H5
cd client && npm install && npm run dev
# 浏览器 http://localhost:5173
# 自动：连接 :8080 → demo/demo123（无账号则注册）→ 无城则建城 → 主城展示建筑/资源
# 页面按钮：「升级农田」「刷新状态」
```

默认账号：`demo` / `demo123`，`server_id=1`。

## 仅 mock 网关（CLIENT-001 兼容）

mock 只实现 `account.v1.Login`，**无法**建城/升级；用于离线演示登录 UI。

```bash
cd client && npm run mock:gateway   # ws://127.0.0.1:19090/ws
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 验证

- 单测：`cd client && npm test`
- 手动：见上「联调真实后端」

## 目录

- `src/engine/` — `GameApp`、场景管理、占位 `AssetLoader`
- `src/net/` — `GatewayClient`、`bootstrapSession`、proto 加载
- `src/scenes/` — 登录、主城
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 仅 Login 的 WebSocket mock
