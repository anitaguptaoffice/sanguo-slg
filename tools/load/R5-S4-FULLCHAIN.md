# R5-S4 全链路压测记录（2026-11-23）

环境：AMD Ryzen 9 9950X / 32 线程，PostgreSQL 16 + Redis 单实例，
`cmd/server` 监听 `:8080`，数据库 `sanguo_loadfull`。

## 工具

`tools/load/fullchain` 做三件事：

1. 预置账号与玩家（bcrypt cost 4，仅为压测账号）。
2. 建立 N 条 WebSocket 连接，逐条执行 `account.v1.Login` 与 `account.v1.EnterGameServer`，保持连接。
3. 在连接保持期间，并发执行战斗模拟、读取 PostgreSQL 玩家数据并写入 `battle_report`。

## 运行

```bash
LOAD_WS_URL=ws://127.0.0.1:8080/ws \
LOAD_DATABASE_URL="postgres://sanguo:sanguo@localhost:5432/sanguo_loadfull?sslmode=disable" \
LOAD_CONCURRENCY=3000 LOAD_BATTLES=5000 LOAD_BATTLE_WORKERS=64 \
go run ./tools/load/fullchain
```

## 结果

```text
seed: accounts=3000 players=3000 in 196ms
authenticated: 3000/3000 in 919ms failures=0
battle workload: 5000/5000 persisted in 455ms => 10997.3 battles/s failures=0
PASS: authenticated gateway + DB-backed battle workload
```

数据库核对：

```text
accounts=3000
players=3000
sessions=3100
battle_reports=5500
```

## 说明

- 3000 条连接在战斗负载期间保持，不是建连后立即关闭。
- 每场战斗至少一次 PostgreSQL 玩家读取和一次 `battle_report` 写入。
- 战斗模拟为真实 `battle.Simulate`，战报通过 `report.PGStore` 持久化。
