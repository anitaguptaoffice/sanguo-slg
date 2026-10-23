# 路线图

## M0 规格（2–3 周）

- [x] SPEC-001 领域模型与 DDL
- [x] SPEC-002 通信协议
- [x] SPEC-003 核心规则文档
- [x] SPEC-004 数值数据管线

出口：契约冻结，后续实现不再改接口。

## M1 骨架（3–4 周）

- [x] PLAT-001 仓库骨架与构建
- [x] PLAT-002 网关与连接管理
- [x] PLAT-003 可观测性
- [x] ACC-001 账号与登录
- [x] WORLD-001 地图与城池
- [x] DOM-001 建筑与资源
- [x] CLIENT-001 客户端骨架

出口：单人可登录、建城、造建筑、资源增长。

## M2 战斗（3–4 周）

- [x] MIL-001 战斗引擎
- [x] MIL-002 募兵与行军
- [x] 战报与复盘（MIL-003 / INTG-002）
- [x] 客户端战斗表现（CLIENT-003）

出口：完整战斗闭环，战斗服独立部署。

## M3 多人（4–6 周）

- [x] 分服与开服流程（PLAT-004 + **OPS-OPEN-001**）— 选服冒烟 + **[开服运营最小流程](ops/open-server-runbook.md)** 可执行清单
- [x] 军团、聊天（GUILD-001/002、CHAT-001、WIRE-001）— 域服务 + H5 面板已联调
- [x] 排行与榜单（RANK-001 + **RANK-002**）— PG 双榜、刷新 Scheduler 与加深单测已合
- [x] 3000 并发压测（**LOAD-001**）— `make load-ws` / `docs/load/PLAT-002-baseline.md`

进度参考：`go test ./internal/api -run TestM3SocialSmokePath`；完整 M3/M4 重启冒烟见 `tools/smoke/README.md`（**INTG-005**）。客户端 M3：`CLIENT-004`；wave:9 **INTG-006** 在 DATA-002 后复跑扩量子集。

## M4 内容（持续）

- [x] 任务系统（QUEST-001）+ wave:7 DATA-001 核心子集 — **INTG-005** / wave:9 **INTG-006** 复跑
- [x] 道具与商城（CONTENT-002、SHOP-001、ECON-001 真扣费）
- [ ] 活动与运营后台（GM-001）— `cmd/gm` 已有；完整活动 cfg 仍不纳入核心子集
- [x] 数据埋点（**TELEMETRY-001**）— obs 事件 + api handler 挂钩

出口：`INTG-005`（#125）+ **CLIENT-006**（#121）已合；wave:9 扩量后 **INTG-006** + **CLIENT-007**（横屏基线）+ **HERO-002** / **MAIL-001** 加深养成与邮件。里程碑收口文档：**DOCS-EXIT-001**（#131，进行中）。

## Wave 7 对齐波次（核心子集可玩优先）

策略：**先灌关键 cfg 子集、再接持久化与真扣费**，对照原版规则与数值，代码与文案全部重写。参照物见 [docs/reference.md](reference.md)（PR #77 / #82 只读，禁止合并）。

| 顺序 | 任务 | 说明 |
|---|---|---|
| 1 | SPEC-ALIGN-001 | 必有 `cfg_*` 清单 + `CORE_SUBSET.md` 行数上限 |
| 2 ‖ | DATA-001、RULES-ALIGN-001 | 灌 `spec/data`；公式 params + 单测 |
| 3 ‖ | PERSIST-001～003 | chat/rank、hero/bag、quest/shop 落 PG |
| 4 | ECON-001 | 商城真扣钱包，去掉 spent overlay |
| 5 | GM-002 | 禁言接聊天闸 |
| 复跑 | INTG-004、CLIENT-005 | 在子集数据与 wave7 后端就绪后联调（见各卡 body） |

与 wave:5/6 关系：`GUILD-002`、`CLIENT-004` 仍为 M3/M4 出口卡；wave7 不替换它们，仅在其后的持久化与数据对齐阶段补充依赖说明。

## Wave 8 M3/M4 出口加固（已完成）

wave:7、WIRE-001、CLIENT-ART-INTG-001 合并后补齐的六卡均已合入 main（#125 INTG-005、#121 CLIENT-006、#122 RANK-002、#123 LOAD-001、#120 OPS-OPEN-001、#124 TELEMETRY-001）。**core-subset-first** 不变。

| 任务 | 说明 |
|---|---|
| INTG-005 | DATA-001 + ECON-001 + PERSIST-* 下复跑 M3 子集与 M4 冒烟，含重启恢复 |
| CLIENT-006 | `content.v1.ListPlayerBag` / `UseConsumable` 与军团聊天真实网关 |
| RANK-002 | 双榜 + PG + Scheduler 完整性 |
| LOAD-001 | 3000 WS 压测与基准报告 |
| OPS-OPEN-001 | 开服运营 runbook |
| TELEMETRY-001 | 最小玩法埋点 |

## Wave 9 核心子集第二批（扩量 + 养成/邮件/横屏）

**触发**：INTG-005 + CLIENT-006 已合，编排者授权开 **DATA-002**（见 `spec/data/CORE_SUBSET.md` 扩量条款）。参照物 PR #77 / #82 / #100 / #108 **只读**，禁止合并或复制进主树。

**进度**（与 GitHub `wave:9` 标签同步；INTG-006 合入后编排者可能再补一轮 M3/M4 勾选）：

| Issue | 任务 | 状态 | 说明 |
|---|---|---|---|
| [#128](https://github.com/anitaguptaoffice/sanguo-slg/issues/128) | DATA-002 | 进行中 | 核心 cfg 上限约 +50%，文案重写，更新 source + generated |
| [#129](https://github.com/anitaguptaoffice/sanguo-slg/issues/129) | CLIENT-007 | 进行中 | 横屏 1600×900 外框 / 舞台 788 / HUD（仅 `client/**`） |
| [#130](https://github.com/anitaguptaoffice/sanguo-slg/issues/130) | MAIL-001 | 进行中 | `player_mail` 最小收件箱 + GM 发邮件（DDL 已有） |
| [#131](https://github.com/anitaguptaoffice/sanguo-slg/issues/131) | DOCS-EXIT-001 | 进行中 | 本卡：M3/M4 出口与 wave:9 进度文档收口 |
| [#132](https://github.com/anitaguptaoffice/sanguo-slg/issues/132) | HERO-002 | 待 DATA-002（`status:blocked`） | 将领招募/列表/详情加深，对接 hero 域 + DATA-002 模板 |
| [#133](https://github.com/anitaguptaoffice/sanguo-slg/issues/133) | INTG-006 | 待 DATA-002（`status:blocked`） | 扩量子集下复跑 INTG-005 路径，更新 `tools/smoke` |

并行关系：DATA-002、CLIENT-007、MAIL-001、DOCS-EXIT-001 可并行（‖）。HERO-002、INTG-006 在 DATA-002 合并后由编排者 `tasks_sync` 或手工改为 `status:ready`（YAML `blocked_until: [DATA-002]`）。

## 不做

跨服战、赛季、实时 PvP、移动原生、多语言——v1.0 范围外。

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 战斗规则复杂度被低估 | 工期翻倍 | MIL-001 先做原型，用对拍验证 |
| 客户端工作量占比高 | 阻塞上线 | 与 M0 并行启动，占位美术先跑通 |
| 契约频繁变更 | 并行失效 | 每周冻结评审 |
| legacy 全量 cfg 灌入 | 工期与合规风险 | wave7 核心子集上限，扩量单独开波次 |
