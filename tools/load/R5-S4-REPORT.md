# R5-S4 压测与备份演练记录（2026-11-22）

环境：本机 AMD Ryzen 9 9950X / 32 线程，PostgreSQL 16 与 Redis 单实例，
Go 服务 `cmd/server` 监听 `:8080`，WebSocket 端点为 `/ws`。

## 3000 CCU 连接

```bash
LOAD_WS_URL=ws://127.0.0.1:8080/ws LOAD_CONCURRENCY=3000 \
  go run ./tools/load/cmd/loadws
```

结果：

```text
ok: concurrency=3000 elapsed=86.247001ms
```

3000 条 WebSocket 建连 + ping/pong 全部成功，无失败连接。

## 战斗结算吞吐

```bash
go test -run '^$' -bench BenchmarkSimulateBaseline -benchtime=3s ./internal/military/battle
```

结果：

```text
BenchmarkSimulateBaseline-32   373036   9080 ns/op
```

单线程约 11.0 万场/秒，远超 500 场/秒目标。

## 备份与回滚

```bash
PGPASSWORD=sanguo tools/gm/backup_restore.sh backup sanguo <db> r5s4-drill.dump
PGPASSWORD=sanguo tools/gm/backup_restore.sh verify sanguo <db> r5s4-drill.dump
```

演练输出：

```text
backup: r5s4-drill.dump (980K)
migrations=43
players=1
cities=1
accounts=1
orphan_cities=0
verify: OK
```
