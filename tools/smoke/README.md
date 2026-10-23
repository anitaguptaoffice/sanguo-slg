# M2 战斗闭环冒烟

依赖本地 PostgreSQL（与 `make dev` 相同栈）。未设置 `DATABASE_URL` 时集成测会自动 skip。

## 一键验证（推荐）

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestM2BattleReportSmokePath|TestLoginCreateCityUpgradeFlow' -count=1 -v
```

覆盖路径：注册/登录 → 建城 → 募兵（或预置兵力）→ `military.v1.StartMarch` 攻打 M2 驻点 (5,5) → 调度推进 → `ListBattleReports` / `GetBattleReport` 可查战报。

## 真实进程

```bash
make dev-up
GOTOOLCHAIN=go1.23.0 make dev
```

WebSocket 网关：`ws://127.0.0.1:8080/ws`（默认 `HTTP_ADDR`，见 `internal/platform/config`）。

### M2 已知限制

- 行军队列在进程内存（`march.Hub`）；**重启后未完成的行军/募兵队列不会恢复**，但 DOM-002 已持久化城池资源与建筑。
- 战斗目标驻点由 `combat.M2FixtureGarrisons()` 提供，当前为坐标 (5,5)。
