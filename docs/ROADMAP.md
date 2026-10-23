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
- [x] 活动与运营后台（**GM-001** + wave:10 **GM-003** [#154](https://github.com/anitaguptaoffice/sanguo-slg/pull/154)）— v1 运营能力已按脚注验收；**residual**：活动配置台、可视化排期、`cfg_act*` 仍 **out of core subset**（无第三批 DATA-003 扩量）

  > **v1 运营口径（GM-003）**：**GM CLI/HTTP**（`cmd/gm`：`lookup` / `grant` / `kick` / `mute` / `send-mail`；HTTP 仅 `POST /gm/lookup|grant|kick|mute`）+ **邮件运营**（`send-mail` → `player_mail`，验收见 [开服运营最小流程](ops/open-server-runbook.md) §4）。**非目标**：活动配置台、可视化排期、`cfg_act*` 灌入——仍 **out of core subset**。
- [x] 数据埋点（**TELEMETRY-001**）— obs 事件 + api handler 挂钩

出口：wave:9 **INTG-006**（#138）+ **CLIENT-007**（#135）+ **HERO-002**（#139）+ **MAIL-001**（#136）+ **DATA-002**（#137）养成/邮件/横屏；wave:10 **CLIENT-008**（#156）将领/邮件面板、**HERO-003**（#158）招募预览、**QUEST-002**（#157）日常 chain、**GM-003**（#154）运营收口与 **INTG-007**（#159）冒烟——H5 端将领/邮件/日常可玩。里程碑文档 **DOCS-EXIT-002**（[#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152)）。

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

## Wave 9 核心子集第二批（扩量 + 养成/邮件/横屏）— **已完成**

**触发**：INTG-005 + CLIENT-006 已合，编排者授权 **DATA-002**（见 `spec/data/CORE_SUBSET.md`）。参照物 PR #77 / #82 / #100 / #108 **只读**，禁止合并或复制进主树。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#128](https://github.com/anitaguptaoffice/sanguo-slg/issues/128) | DATA-002 | 已完成 | #137 |
| [#129](https://github.com/anitaguptaoffice/sanguo-slg/issues/129) | CLIENT-007 | 已完成 | #135 |
| [#130](https://github.com/anitaguptaoffice/sanguo-slg/issues/130) | MAIL-001 | 已完成 | #136 |
| [#131](https://github.com/anitaguptaoffice/sanguo-slg/issues/131) | DOCS-EXIT-001 | 已完成 | #134 |
| [#132](https://github.com/anitaguptaoffice/sanguo-slg/issues/132) | HERO-002 | 已完成 | #139 |
| [#133](https://github.com/anitaguptaoffice/sanguo-slg/issues/133) | INTG-006 | 已完成 | #138 |

## Wave 10 M4 玩法加深（客户端 + 日常 + GM 收口）— **已完成**

**策略**：在 wave:9 DATA-002 子集上加深可玩性；**不**开 DATA-003 / 不灌 `cfg_act*`。波次 backlog 规划 [#146](https://github.com/anitaguptaoffice/sanguo-slg/pull/146)；美术轨（#140/#144/#108/#141/#145）并行，不阻塞本波。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#147](https://github.com/anitaguptaoffice/sanguo-slg/issues/147) | CLIENT-008 | 已完成 | [#156](https://github.com/anitaguptaoffice/sanguo-slg/pull/156) |
| [#148](https://github.com/anitaguptaoffice/sanguo-slg/issues/148) | HERO-003 | 已完成 | [#158](https://github.com/anitaguptaoffice/sanguo-slg/pull/158) |
| [#149](https://github.com/anitaguptaoffice/sanguo-slg/issues/149) | QUEST-002 | 已完成 | [#157](https://github.com/anitaguptaoffice/sanguo-slg/pull/157) |
| [#150](https://github.com/anitaguptaoffice/sanguo-slg/issues/150) | GM-003 | 已完成 | [#154](https://github.com/anitaguptaoffice/sanguo-slg/pull/154) |
| [#151](https://github.com/anitaguptaoffice/sanguo-slg/issues/151) | INTG-007 | 已完成 | [#159](https://github.com/anitaguptaoffice/sanguo-slg/pull/159) |
| [#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152) | DOCS-EXIT-002 | 已完成 | 本卡 PR |

**明确不做**：合并或复制 PR #77/#82/#100/#108/#126/#140/#141/#144/#145；全量 legacy 活动 cfg；第三批核心子集扩量（无单独编排授权）。

## 不做

跨服战、赛季、实时 PvP、移动原生、多语言——v1.0 范围外。

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 战斗规则复杂度被低估 | 工期翻倍 | MIL-001 先做原型，用对拍验证 |
| 客户端工作量占比高 | 阻塞上线 | 与 M0 并行启动，占位美术先跑通 |
| 契约频繁变更 | 并行失效 | 每周冻结评审 |
| legacy 全量 cfg 灌入 | 工期与合规风险 | wave7 核心子集上限，扩量单独开波次 |
