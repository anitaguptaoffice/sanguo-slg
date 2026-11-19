# Phase R0：外科清创与单轨运行时合一施工手册

> **执行铁律**：在启动任何 `R1` 新玩法前，必须先按 `R0-1 → R0-2 → R0-3` 顺序完成本阶段清创。未拆除 `.github/workflows` 中的旧文件校验锁前，直接删文件会导致 CI 立即报错。

---

## Slice `R0-1`：拆除 CI 历史文件锁并收敛 GitHub Actions

### 1. 必拆的 CI 硬编码地雷
`.github/workflows/ci.yml` 当前硬编码绑定了历史碎片文件，必须在第一步清理：
- `go-build-test-lint` 中的 **`Check Recruit cleanup Go formatting`**（强校验 `internal/api/recruit_cleanup*.go` 存在性）；
- `go-build-test-lint` 中的 **`Check fresh DOM catalog Go formatting and identity`** 与 `Archive fresh DOM catalog identity evidence`（强校验 19 个 `internal/domestic/fresh_*.go` 与 `.github/scripts/dom_fresh_catalog_gate.py`）；
- `go-build-test-lint` 中的 `First-city ledger ACK-loss harness (#2579)`（归入可选专项测试，不再阻塞常规构建）；
- `domestic-pg` 中的 `python3 .github/scripts/dom_fresh_catalog_gate.py "$mode" "$log"`。

### 2. `.github/workflows/` 收敛清单
- **保留并重整为主干**：
  - `.github/workflows/ci.yml`：保留 `scope` + `client-build-test`（`npm ci && npm run build && npm test`）+ `go-build-test-lint`（`gofmt` 全仓检查、`make build`、`make build-gm`、`make test-fast`、PG 集成测试、`golangci-lint`）。
- **停用或删除的 25 个历史单卡诊断/旧同步 workflow**：
  - 旧波次同步：`tasks-sync.yml`（防止误触发重建历史波次 Issue）。
  - 单卡历史 QA / 形式化验证 workflow：`account-identity-bindings.yml`、`account-return-pg.yml`、`api-process-failure-pg.yml`、`api-return-source-pg.yml`、`bag-item-icon-qa.yml`、`ci-test-support.yml`、`daily-reward-host.yml`、`existing-account-native.yml`、`explicit-registration-native.yml`、`first-city-storage.yml`、`gateway-errorcode.yml`、`item-full-host.yml`、`live-chat-delay.yml`、`live-hero-expr-qa.yml`、`live-quest-browser-qa.yml`、`march-start-reveal.yml`、`military-return-pending-pg.yml`、`platform-identity-pg.yml`、`queue-build-row-stability.yml`、`queue-speedup-icon-host.yml`、`recruit-tx-panic-pg.yml`、`recruit-v2-bindings.yml`、`recruit-v2-wire.yml`、`shop-bag-settlement.yml`、`world-return-pg.yml`。
- **新增 1 条端到端可玩门禁**：
  - `.github/workflows/playable-smoke.yml`：启动真实 PostgreSQL 17 + Redis 7 + `cmd/server` + Vite 构建产物，通过 Playwright 跑通核心玩家链路（随 `R1+` 切片持续扩充）。

### 3. `R0-1` 验收标准
- PR 上仅跑收敛后的 `CI` 主干并全绿；仓库内无任何针对固定旧 commit SHA 的矩阵 workflow。

---

## Slice `R0-2`：前端 `client/src` 外科清创（铲除 ~4.6 万行波次废代码）

### 1. 待删除的 `516` 个波次堆叠文件范围
在 `client/src/{engine,net,ui}` 下，凡文件名匹配正则 `(Residual|Deep|Sweep|NarrowManifest|Filter008Evidence)` 的 `.ts` 与 `.test.ts` 文件（共 `516` 个文件，约 `46,074` 行，全部来自 `wave:20–59` “巩固再加深五层”空转）一律移除，并同步清理 `client/README.md` 中冗长的 `wave:11–59` 流水账段落。

### 2. 必须同步摘除引用的核心宿主文件（按引用密度排序）
删除上述文件同时，清理以下核心文件中的 import、DOM 重复挂载行与旧类名引用：
1. `client/src/ui/HeroMailPanels.ts`（57 处引用）及 `HeroMailPanels.test.ts`、`HeroMailPanels.bagNavigation.test.ts`
2. `client/src/scenes/MainCityScene.ts`（51 处引用）及 `MainCityScene.militaryReadability.test.ts`
3. `client/src/ui/SocialPanels.ts`（35 处引用）及 `SocialPanels.test.ts`
4. `client/src/engine/layoutViewport.ts`（33 处 `NarrowManifest` 重导出引用）
5. `client/src/net/mailClaimHudBadgeSync.ts`（11 处）及 `.test.ts`
6. `client/src/ui/MarchListPanel.ts`（10 处）及 `.test.ts`
7. `client/src/ui/WorldPanels.ts`（10 处）
8. `client/src/net/queueRemainingProgress.ts`（9 处）
9. `client/src/ui/QueuePanels.ts`（9 处）
10. `client/src/ui/BattleReportPanel.ts`（8 处）及 `.test.ts`
11. `client/src/ui/ContentPanels.ts`（7 处）
12. `client/src/ui/DailyQuestPanels.ts`（2 处）
13. **特别注意**：`client/src/engine/clientModuleGraph.test.ts` 第 17–24 行硬编码动态 `import("./wave59WorldIntelBattleReportMailShopRankNarrowManifest")` 与 `wave55*`，须改为仅断言真实生产入口 bundle 构建无未解析导出。
14. 其余零星 1–5 处引用文件：`guildPresenceKnowledge.test.ts`、`recruitFormInlineHint.ts`、`recruitSubmitFeedback.ts`、`dailyQuestProgressFormat.ts`、`heroDetailCultivationUse.ts`、`heroMailState.ts`、`hudCenterTodo.ts`、`leaderboardRowHeroId.ts`、`marchReturned.test.ts`、`questClaimHudLink.ts`、`marchReturnedSnapshot.test.ts`、`marchSnapshotFreshness.test.ts`、`marchUnitSelection.test.ts`、`militaryHeroEntry.test.ts`。
15. 同步清理 `client/scripts/recruit_recovery_guard.py` 等浏览器外部恢复许可仪式脚本。

### 3. 必保核心资产与界面净化要求
- **完整保留**：`GatewayClient.ts`、Protobuf 编解码、`AssetLoader.ts`、`artPanelSkin.ts` / `artChromeSkin.ts` / `artToolbarIconSkin.ts` / `artBadgeSkin.ts`、`client/public/assets/art/v1/` 全部原创美术纹理（374 个文件）、选服/登录/首城/主城基础业务交互。
- **界面净化**：移除面板标题与顶栏中的 `military.v1`、`art 1x @1.0dpr`、裸内部队列 hash 等调试字样。

### 4. `R0-2` 验收标准
- `client/src` 生产代码从 `~78k` LOC 降至 **`≤ 33k` LOC**；
- `cd client && npx tsc --noEmit && npx vitest run && npx vite build` 零报错通过；
- 启动本地前后端后，登录 → 首城 → 主城各面板开关与操作正常无白屏、无重复状态条。

---

## Slice `R0-3`：后端双轨运行时合一（解除 `loopback` 与外部 Profile 锁死）

### 1. 现状病灶定位
- `internal/platform/config/config.go` 与 `internal/platform/runtime/gateway.go` 将服务端分裂为两套互斥路径：
  - 默认路径（`Prepared* = false`）：部分军事/行军状态仅驻内存，进程重启即丢；
  - `PreparedFirstCity` / `PreparedRecruit` / `PreparedMarch` 路径：被 `internal/platform/runtime/first_city_prepared.go` 中 `validatePreparedFirstCityLocal()` 强制锁死在 `loopback`（非 `127.0.0.1` 直接拒绝启动），强依赖外部 `MIL_FRESH_PROFILE_FILE` 与单机 writer lease，且关闭了 `MountGmHTTP` 与标准 `CreateCity` / `RecruitTroop` 路由。

### 2. 合一改造动作
1. **统一配置与启动入口（`internal/platform/config` + `internal/platform/runtime`）**：
   - 移除 `SANGUO_FIRST_CITY_USE_PREPARED_CITY`、`SANGUO_PREPARED_RECRUIT`、`SANGUO_PREPARED_MARCH`、`MIL_FRESH_PROFILE_FILE` 四个分叉开关及 `validatePreparedFirstCityLocal()` 回环限制。
   - `cmd/server` 启动时统一执行：`ApplySpecs`（自动幂等建表/迁移）→ 加载 `spec/data` 静态配置 → 初始化默认服地图 → 从 PostgreSQL 恢复未完成建造/募兵/行军队列 → 挂载全部业务 WebSocket 路由与 `/gm/*` 管理接口 → 启动建造/募兵/行军/排行调度器。
2. **用标准 PG 事务替换过度 OID 钉死仪式**：
   - 首城创建、建筑升级、士兵招募、部队出征、到达战斗、返程入账统一收敛为清晰的领域 Service 方法，使用标准 `pgx` ACID 事务 + `SELECT ... FOR UPDATE` + 客户端 `request_id` / `command_id` 幂等表即可；清理 `freshsource` / `recruittx` 中仅用于证明 catalog OID 未变的冗余包装及配套数万行故障穷举测试，保留真实的业务幂等与重启恢复 PG 集成测试。
3. **统一客户端招募与行军协议调用**：
   - 客户端招募与出征统一走单一正式路由（无需 WebSocket subprotocol 特判握手或浏览器外置文件许可）。

### 3. `R0-3` 验收标准
- 监听 `0.0.0.0:8080` 连接远程或容器 PostgreSQL 均可正常启动（不再受 `loopback` 限制）；
- `make test-fast` 与 `make test-gate` 全绿；
- **重启持久化端到端验证**：启动 `cmd/server` → 浏览器完成注册、建城、升建筑、募兵、派兵出征 → 重启 `cmd/server` 进程 → 刷新浏览器确认城池、钱包、在途募兵队列、在途行军及回城兵力 100% 准确恢复。
