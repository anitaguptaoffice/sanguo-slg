# 首城 V2 本地可玩冒烟

**边界**：真实 `make dev` 栈（Go 网关 + PG + Vite），非 mock peer。证明注册 → 无城登录 → Discover → Submit（遇 pending 自动一次 Continue；传输失败则 Discover 再 Continue）→ 进主城。

## 前置

1. `make dev-up`
2. 根目录：`go run ./cmd/server`（`:8080/ws`）
3. `client`：`VITE_GATEWAY_WS_URL=ws://127.0.0.1:8080/ws npx vite --host 127.0.0.1 --port 5273 --strictPort`

## 命令

```bash
# 系统 Chromium，避免 Playwright 下载
export CHROMIUM_PATH=/usr/lib/chromium/chromium
cd client && node qa/firstCityPlayable.browser.mjs
# 可选：共享 dev 图上避开占用格
# QA_FC_X=45 QA_FC_Y=72 node qa/firstCityPlayable.browser.mjs
```

成功：`report.json` 中 `passed: true`，步骤含 `main-city`；截图 `/tmp/first-city-playable/main-city.png`。

**注意**：Discover/Submit 每次会清空密码框，操作前需重新填写密码（与 `ServerSelectScene` 一致）。

## Go 快速校验（秒级）

```bash
DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable' \
  go test ./internal/api -run 'TestFirstCityV2|TestFirstCityPG' -count=1
```

## SPEC #2579 ACK-loss（PG17 隔离 schema，非 WebSocket）

```bash
make dev-up
ALLOW_OWNED_PG17_TEST=1 make test-spec-fc-ack-loss
# 或：ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable' \
#   go test ./internal/api -run TestSpecFirstCityLedgerAckLossHarness -count=1
```