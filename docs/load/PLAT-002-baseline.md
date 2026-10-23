# PLAT-002 网关 WebSocket 压测基准（LOAD-001）

对照任务卡 **PLAT-002** 验收项「单机 3000 连接压测通过」。实现逻辑与 `internal/platform/gateway/server_test.go` 中 `TestStress3000Connections` 一致，抽到 `tools/load/wsstress` 以便重复执行与对外部网关压测。

## 通过标准

- 并发 **≥ 3000** 条 WebSocket 连接完成握手。
- 每条连接发送 `gateway.v1.Ping`（二进制 proto `ClientPacket`），并收到一条服务端响应。
- 全程无 dial / 读写错误（`Run` 返回 `failed == 0`）。

## 环境变量

| 变量 | 含义 | 默认 |
|------|------|------|
| `LOAD_WS_URL` | 目标 WebSocket URL（如 `ws://127.0.0.1:8080/ws`） | 空（外部压测必填） |
| `LOAD_CONCURRENCY` | 并发连接数 | `3000` |
| `LOAD_HANDSHAKE_TIMEOUT` | 握手超时 | `30s` |
| `LOAD_DIAL_PARALLELISM` | 同时拨号 goroutine 上限 | `200` |

## 一键命令

**内嵌网关**（`httptest`，`MaxConnections=4000`）：`make load-ws`

**外部网关**：`export LOAD_WS_URL='ws://127.0.0.1:8080/ws'` 后 `make load-ws-external`

**CLI**：`go run ./tools/load/cmd/loadws`（同样依赖 `LOAD_WS_URL`）

## CI

`-short` 跳过 3000 压测；PR 仍跑 `TestRunSmallConcurrency` 等轻量用例。

## 最近一次跑数

| 项目 | 值 |
|------|-----|
| 日期 | 2026-10-23（UTC） |
| 场景 | `TestStress3000Embedded`（内嵌网关） |
| 机器 | Linux x86_64，`nproc=4`，约 15 GiB RAM（Cursor Cloud Agent 运行环境） |
| Go | 1.23.4 |
| 并发 | 3000 |
| 耗时 | **约 215 ms**（`elapsed=214.768431ms`） |
| 结果 | **通过** |

复现：

```bash
go test ./tools/load/wsstress -run TestStress3000Embedded -count=1 -timeout 15m -v
```

对外部网关的结果因部署与网络而异，请在目标环境执行 `make load-ws-external` 后自行更新上表。
