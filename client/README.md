# H5 客户端骨架（CLIENT-001）

Cocos Creator 目标工程；当前用 **Vite + TypeScript** 跑通引擎初始化、场景切换、占位资源加载与 **WebSocket + Protobuf** 登录 → 主城链路，便于在网关未就绪时联调。

## 网关地址

| 环境 | 变量 / 地址 |
|------|-------------|
| 本地 mock（默认） | `ws://127.0.0.1:19090/ws` |
| 真实 Gateway（PLAT-002） | 构建前设置 `VITE_GATEWAY_WS_URL`，例如 `wss://gateway.example.com/ws` |

配置见 `src/config.ts`。协议形状只读 `../spec/proto/`（SPEC-002），客户端通过 Vite 引用 proto 文件，**不修改** `spec/`。

## 快速验证

```bash
# 终端 1：本地 mock 网关
cd client && npm install && npm run mock:gateway

# 终端 2：H5 预览
cd client && npm run dev
# 浏览器打开 http://localhost:5173 — 自动连接 mock、demo/demo123 登录并进入主城占位画面
```

单测：`npm test`

## 目录

- `src/engine/` — `GameApp`、场景管理、占位 `AssetLoader`（后续迁到 Cocos 资源管线）
- `src/net/` — `GatewayClient`、proto 加载
- `src/scenes/` — 登录、主城
- `mock-server/` — 可演示用的 WebSocket mock

## Mock 账号

- 登录名 `demo`，密码 `demo123`，`server_id` 任意（客户端默认 `1`）
