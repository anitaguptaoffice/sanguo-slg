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

出口：wave:9 **INTG-006**（#138）+ **CLIENT-007**（#135）+ **HERO-002**（#139）+ **MAIL-001**（#136）+ **DATA-002**（#137）养成/邮件/横屏；wave:10 **CLIENT-008**（#156）将领/邮件面板、**HERO-003**（#158）招募预览、**QUEST-002**（#157）日常 chain、**GM-003**（#154）运营收口与 **INTG-007**（#159）冒烟；wave:11 **CLIENT-009**（[#169](https://github.com/anitaguptaoffice/sanguo-slg/pull/169)）日常 UI、**CLIENT-010**（[#171](https://github.com/anitaguptaoffice/sanguo-slg/pull/171)）招募模板与背包/商城可读性、**CLIENT-012**（[#170](https://github.com/anitaguptaoffice/sanguo-slg/pull/170)）战报底栏入口，**QUEST-003**（[#173](https://github.com/anitaguptaoffice/sanguo-slg/pull/173)）日常挂钩与 **INTG-008**（[#174](https://github.com/anitaguptaoffice/sanguo-slg/pull/174)）冒烟——H5 **日常 + 招募模板预览 + 战报** 最短可玩路径见 [client/README.md](../client/README.md#wave-11-可玩环m4-出口--intg-008)；wave:12 **CLIENT-013**（[#188](https://github.com/anitaguptaoffice/sanguo-slg/pull/188)）行军列表、**CLIENT-014**（[#187](https://github.com/anitaguptaoffice/sanguo-slg/pull/187)）将领详情、**CLIENT-015**（[#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)）世界坐标出征、**CLIENT-016**/**CLIENT-017**/**CLIENT-018** 战报筛选/邮件收件箱/HUD 反馈与 **INTG-009**（[#192](https://github.com/anitaguptaoffice/sanguo-slg/pull/192)）冒烟——H5 **行军列表 + 将领详情 + 邮件 + 战报筛选** 可玩路径见 [client/README.md](../client/README.md#wave-12-可玩加深m4-出口--intg-009)；wave:13 **CLIENT-019**（[#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206)）队列倒计时、**CLIENT-020**（[#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204)）背包/商城反馈、**CLIENT-021**（[#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207)）双榜只读、**CLIENT-022**（[#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205)）军团/聊天可读、**CLIENT-023**（[#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208)）招募↔日常闭环与 **INTG-010**（[#203](https://github.com/anitaguptaoffice/sanguo-slg/pull/203)）冒烟——H5 **队列倒计时 + 背包/商城反馈 + 双榜 + 社交可读 + 招募日常闭环** 路径见 [client/README.md](../client/README.md#wave-13-闭环加深m4-出口--intg-010)；wave:14 **DOM-003**（[#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)）建造加速符对接 domestic、**CLIENT-024**（[#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220)）chain 400 多类型日常引导、**CLIENT-025**（[#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)）行军结束→战报提示、**CLIENT-026**（[#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222)）队列建造加速 UI、**CLIENT-027**（[#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)）HUD 待办徽章与 **INTG-011**（[#223](https://github.com/anitaguptaoffice/sanguo-slg/pull/223)）冒烟——H5 **建造加速真实生效 + 多类型日常引导 + 行军战报提示 + HUD 待办徽章** 路径见 [client/README.md](../client/README.md#wave-14-日常与队列闭环m4-出口--intg-011)；wave:15 **CLIENT-028**（[#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)）世界地图行军只读标注、**CLIENT-029**（[#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238) `e084ac8f`）邮件/战报/背包密度、**CLIENT-030**（[#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236)）排行/军团/聊天扫读、**CLIENT-031**（[#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)）将领招募对比、**CLIENT-032**（[#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240)）manifest HUD/面板接线、**CLIENT-033**（[#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`，**wave:15 hotfix**）军事面板运行时三修与 **INTG-012**（[#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237)）冒烟——H5 **世界地图标注 + 面板密度 + 社交扫读 + 招募对比 + manifest 接线** 路径见 [client/README.md](../client/README.md#wave-15-世界地图与面板密度m4-出口--intg-012)；wave:16 **CLIENT-034**（[#254](https://github.com/anitaguptaoffice/sanguo-slg/pull/254)）战报回合详情与行军深链、**CLIENT-035**（[#253](https://github.com/anitaguptaoffice/sanguo-slg/pull/253)）邮件附件领取、**CLIENT-036**（[#255](https://github.com/anitaguptaoffice/sanguo-slg/pull/255)）军事 manifest、**INTG-013**（[#257](https://github.com/anitaguptaoffice/sanguo-slg/pull/257)）冒烟、**CLIENT-037**（[#256](https://github.com/anitaguptaoffice/sanguo-slg/pull/256) `5a4bb4af`）小地图扫读、**CLIENT-038**（[#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258) `30c95e2a`）HUD 角标深链、**CLIENT-039**（[#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260) `9e98a28b`）1280 顶栏叠字修——H5 **战报回合 + 邮件领取 + 军事 manifest + 小地图 + HUD 深链** 路径见 [client/README.md](../client/README.md#wave-16-战报邮件闭环与军事反馈m4-出口--intg-013)、**DOCS-EXIT-008**（[#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) / [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261) `58bd03b7`）；wave:17 **CLIENT-041**（[#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) / [#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275) `12a8850f`）小地图选点出征、**CLIENT-042**（[#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) / [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`）战报坐标复盘、**CLIENT-043**（[#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) / [#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279) `66e5578a`）军事目标记忆、**CLIENT-044**（[#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) / [#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272) `d437076a`）日常战报横幅、**CLIENT-045**（[#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269) / [#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273) `5a3ae507`）社交刷新与 **INTG-014**（[#270](https://github.com/anitaguptaoffice/sanguo-slg/issues/270) / [#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274) `90fb5356`）网关冒烟——H5 **小地图选点出征 + 战报坐标复盘 + 军事目标记忆 + 日常战报横幅 + 社交刷新** 路径见 [client/README.md](../client/README.md#wave-17-世界出征互链与复盘导航m4-出口--intg-014)。里程碑 **DOCS-EXIT-002**（[#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152)）、**DOCS-EXIT-003**（[#168](https://github.com/anitaguptaoffice/sanguo-slg/issues/168)）、**DOCS-EXIT-004**（[#185](https://github.com/anitaguptaoffice/sanguo-slg/issues/185)）、**DOCS-EXIT-005**（[#202](https://github.com/anitaguptaoffice/sanguo-slg/issues/202)）、**DOCS-EXIT-006**（[#217](https://github.com/anitaguptaoffice/sanguo-slg/issues/217)）、**DOCS-EXIT-007**（[#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234) / [#242](https://github.com/anitaguptaoffice/sanguo-slg/pull/242)）、**DOCS-EXIT-008**（[#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) / [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261)）、**DOCS-EXIT-009**（[#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271)）。

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
| [#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152) | DOCS-EXIT-002 | 已完成 | [#160](https://github.com/anitaguptaoffice/sanguo-slg/pull/160) |

**明确不做**：合并或复制 PR #77/#82/#100/#108/#126/#140/#141/#144/#145；全量 legacy 活动 cfg；第三批核心子集扩量（无单独编排授权）。

## Wave 11 H5 日常可玩环 — **已完成**

**策略**：在 **DATA-002** 子集与 wave:10 后端（QUEST-002 / HERO-003）上补齐 H5 **日常任务 UI**、**招募模板预览**、战报独立入口与网关冒烟；**不**开 DATA-003、**不**灌 `cfg_act*`、不做不可逆消费扩量。波次 backlog 规划 [#161](https://github.com/anitaguptaoffice/sanguo-slg/pull/161)。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#162](https://github.com/anitaguptaoffice/sanguo-slg/issues/162) | CLIENT-009 | 已完成 | [#169](https://github.com/anitaguptaoffice/sanguo-slg/pull/169) |
| [#163](https://github.com/anitaguptaoffice/sanguo-slg/issues/163) | CLIENT-010 | 已完成 | [#171](https://github.com/anitaguptaoffice/sanguo-slg/pull/171) |
| [#164](https://github.com/anitaguptaoffice/sanguo-slg/issues/164) | QUEST-003 | 已完成 | [#173](https://github.com/anitaguptaoffice/sanguo-slg/pull/173) |
| [#165](https://github.com/anitaguptaoffice/sanguo-slg/issues/165) | CLIENT-011 | 已完成 | [#172](https://github.com/anitaguptaoffice/sanguo-slg/pull/172) |
| [#166](https://github.com/anitaguptaoffice/sanguo-slg/issues/166) | CLIENT-012 | 已完成 | [#170](https://github.com/anitaguptaoffice/sanguo-slg/pull/170) |
| [#167](https://github.com/anitaguptaoffice/sanguo-slg/issues/167) | INTG-008 | 已完成 | [#174](https://github.com/anitaguptaoffice/sanguo-slg/pull/174) |
| [#168](https://github.com/anitaguptaoffice/sanguo-slg/issues/168) | DOCS-EXIT-003 | 已完成 | [#175](https://github.com/anitaguptaoffice/sanguo-slg/pull/175) |

H5 人工验收与 INTG-008 路径对齐，见 [client/README.md](../client/README.md#wave-11-可玩环m4-出口--intg-008)。

**明确不做**：合并或复制 PR #77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权。

## Wave 12 H5 可玩加深 — **已完成**

**策略**：在 **DATA-002** 子集与 wave:11 H5 日常/招募/战报环上，加深**行军**、**将领详情**、**邮件**、**战报可读性**与 **HUD 反馈**；网关 **INTG-009** 复跑 `tools/smoke`。**不**开 DATA-003、**不**灌 `cfg_act*`、不做不可逆消费扩量。波次 backlog 规划 [#176](https://github.com/anitaguptaoffice/sanguo-slg/pull/176)。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#178](https://github.com/anitaguptaoffice/sanguo-slg/issues/178) | CLIENT-013 | 已完成 | [#188](https://github.com/anitaguptaoffice/sanguo-slg/pull/188) |
| [#179](https://github.com/anitaguptaoffice/sanguo-slg/issues/179) | CLIENT-014 | 已完成 | [#187](https://github.com/anitaguptaoffice/sanguo-slg/pull/187) |
| [#180](https://github.com/anitaguptaoffice/sanguo-slg/issues/180) | CLIENT-015 | 已完成 | [#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186) |
| [#181](https://github.com/anitaguptaoffice/sanguo-slg/issues/181) | CLIENT-016 | 已完成 | [#189](https://github.com/anitaguptaoffice/sanguo-slg/pull/189) |
| [#182](https://github.com/anitaguptaoffice/sanguo-slg/issues/182) | CLIENT-017 | 已完成 | [#190](https://github.com/anitaguptaoffice/sanguo-slg/pull/190) |
| [#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) | CLIENT-018 | 已完成 | [#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191) |
| [#184](https://github.com/anitaguptaoffice/sanguo-slg/issues/184) | INTG-009 | 已完成 | [#192](https://github.com/anitaguptaoffice/sanguo-slg/pull/192) |
| [#185](https://github.com/anitaguptaoffice/sanguo-slg/issues/185) | DOCS-EXIT-004 | 已完成 | [#194](https://github.com/anitaguptaoffice/sanguo-slg/pull/194) |

H5 人工验收与 INTG-009 路径对齐，见 [client/README.md](../client/README.md#wave-12-可玩加深m4-出口--intg-009)（**行军列表 + 将领详情 + 邮件 + 战报筛选**）。

**明确不做**：合并或复制 PR #77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权。全屏大地图 / 新建筑类型 / 改 `spec/proto` 冻结契约（战报筛选仅客户端）。

## Wave 13 H5 闭环加深 — **已完成**

**策略**：在 wave:12 **行军/将领/邮件/战报/HUD** 之上，补齐 **内政与募兵队列可读**、**背包/商城消费反馈**、**双榜只读**、**军团/聊天信息密度**与 **招募↔日常闭环**；网关 **INTG-010** 复跑 smoke。**仍**在 DATA-002 子集；**不**开 DATA-003、**不**灌 `cfg_act*`、不做不可逆消费扩量。**不**做行军取消/加速（`military.v1` 无对应 RPC，本波不开 contract）。波次 backlog 规划 [#195](https://github.com/anitaguptaoffice/sanguo-slg/pull/195)。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#196](https://github.com/anitaguptaoffice/sanguo-slg/issues/196) | CLIENT-019 | 已完成 | [#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206) |
| [#197](https://github.com/anitaguptaoffice/sanguo-slg/issues/197) | CLIENT-020 | 已完成 | [#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204) |
| [#198](https://github.com/anitaguptaoffice/sanguo-slg/issues/198) | CLIENT-021 | 已完成 | [#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207) |
| [#199](https://github.com/anitaguptaoffice/sanguo-slg/issues/199) | CLIENT-022 | 已完成 | [#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205) |
| [#200](https://github.com/anitaguptaoffice/sanguo-slg/issues/200) | CLIENT-023 | 已完成 | [#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208) |
| [#201](https://github.com/anitaguptaoffice/sanguo-slg/issues/201) | INTG-010 | 已完成 | [#203](https://github.com/anitaguptaoffice/sanguo-slg/pull/203) |
| [#202](https://github.com/anitaguptaoffice/sanguo-slg/issues/202) | DOCS-EXIT-005 | 已完成 | [#209](https://github.com/anitaguptaoffice/sanguo-slg/pull/209) |

H5 人工验收与 INTG-010 路径对齐，见 [client/README.md](../client/README.md#wave-13-闭环加深m4-出口--intg-010)（**队列倒计时 + 背包/商城反馈 + 双榜 + 社交可读 + 招募日常闭环**）。

**明确不做**：合并或复制 PR #77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权；行军 **取消/加速**（`CancelMarch` 等，需未来 contract 卡，当前 `military.v1` 无 RPC）。

## Wave 14 H5 日常与队列闭环 — **已完成**

**策略**：在 wave:13 **队列/经济/社交/招募日常** 之上，让 **建造加速符（2003）真实缩短 domestic 队列**、加深 **chain 400 练兵/建造/战备日常引导**、**行军结束→战报** 提示与 **HUD 待办徽章**；网关 **INTG-011** 复跑 smoke。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速（无 RPC）。波次 backlog 规划 [#210](https://github.com/anitaguptaoffice/sanguo-slg/pull/210)（`07382247`）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#211](https://github.com/anitaguptaoffice/sanguo-slg/issues/211) | DOM-003 | 已完成 | [#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)（`d99004b7`） |
| [#212](https://github.com/anitaguptaoffice/sanguo-slg/issues/212) | CLIENT-024 | 已完成 | [#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220)（`64bc77cb`） |
| [#213](https://github.com/anitaguptaoffice/sanguo-slg/issues/213) | CLIENT-025 | 已完成 | [#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)（`67721178`） |
| [#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214) | CLIENT-026 | 已完成 | [#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222)（`0e0cef67`） |
| [#215](https://github.com/anitaguptaoffice/sanguo-slg/issues/215) | CLIENT-027 | 已完成 | [#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)（`95aac888`） |
| [#216](https://github.com/anitaguptaoffice/sanguo-slg/issues/216) | INTG-011 | 已完成 | [#223](https://github.com/anitaguptaoffice/sanguo-slg/pull/223)（`ad6ddc8e`） |
| [#217](https://github.com/anitaguptaoffice/sanguo-slg/issues/217) | DOCS-EXIT-006 | 已完成 | [#225](https://github.com/anitaguptaoffice/sanguo-slg/pull/225) |

H5 人工验收与 INTG-011 路径对齐，见 [client/README.md](../client/README.md#wave-14-日常与队列闭环m4-出口--intg-011)（**建造加速真实生效 + 多类型日常引导 + 行军战报提示 + HUD 待办徽章**）。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权；行军 **取消/加速**（`CancelMarch` 等，需未来 contract 卡，当前 `military.v1` 无 RPC）；募兵队列 **加速**（本波仅建造队列对接 DOM-003）。

## Wave 15 H5 世界地图与面板密度 — **已完成**

**策略**：在 wave:14 **日常/队列/HUD 待办** 闭环之上，加深 **世界地图行军只读标注**、**邮件/战报/背包** 空态与列表密度、**排行/军团/聊天** 扫读、**将领招募** 小 UX，以及 **manifest 已落地样件**（#218）的 HUD/面板接线；网关 **INTG-012** 复跑 smoke。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#226](https://github.com/anitaguptaoffice/sanguo-slg/pull/226)（`e56689b8`）。美术轨 **ART-MILITARY-005** 军事九宫格已合 [#227](https://github.com/anitaguptaoffice/sanguo-slg/pull/227)（`80559e4`）；**不**合并 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) 或 art hold PR #77/#82。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#228](https://github.com/anitaguptaoffice/sanguo-slg/issues/228) | CLIENT-028 | 已完成 | [#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)（`dbee7a40`） |
| [#229](https://github.com/anitaguptaoffice/sanguo-slg/issues/229) | CLIENT-029 | 已完成 | [#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238)（`e084ac8f`） |
| [#230](https://github.com/anitaguptaoffice/sanguo-slg/issues/230) | CLIENT-030 | 已完成 | [#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236)（`e3019f34`） |
| [#231](https://github.com/anitaguptaoffice/sanguo-slg/issues/231) | CLIENT-031 | 已完成 | [#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)（`58a95775`） |
| [#232](https://github.com/anitaguptaoffice/sanguo-slg/issues/232) | CLIENT-032 | 已完成 | [#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240)（`1825858d`） |
| [#233](https://github.com/anitaguptaoffice/sanguo-slg/issues/233) | INTG-012 | 已完成 | [#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237)（`7f812896`） |
| [#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234) | DOCS-EXIT-007 | 已完成 | [#242](https://github.com/anitaguptaoffice/sanguo-slg/pull/242) |

H5 人工验收与 INTG-012 路径对齐，见 [client/README.md](../client/README.md#wave-15-世界地图与面板密度m4-出口--intg-012)（**世界地图行军标注 + 邮件/战报/背包密度 + 社交扫读 + 将领招募对比 + manifest 接线**；manifest 资产表见同文件 [CLIENT-032 manifest 美术接线](../client/README.md#client-032-manifest-美术接线)）。**wave:15 hotfix**：**CLIENT-033**（[#243](https://github.com/anitaguptaoffice/sanguo-slg/issues/243) / [#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`）军事字色/募兵主按钮/窄屏 HUD，**不**重复进 wave:16 任务卡。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权；行军 **取消/加速**（`CancelMarch` 等，需未来 contract 卡，当前 `military.v1` 无 RPC）；募兵队列 **加速**（与 wave:14 相同，仅建造队列对接 DOM-003）。

## Wave 16 H5 战报邮件闭环与军事反馈加深 — **已完成**

**策略**：在 wave:15 **世界地图标注 + 面板密度 + manifest 默认面板** 之上，加深 **战报详情回合可读** 与 **行军结束深链**、**邮件附件领取** 与 HUD 一致、**军事九宫格**（`ui.panel.military.v1`，#227）接线、**小地图多行军扫读** 与 **HUD 角标深链**；网关 **INTG-013** 复跑 smoke（`GetBattleReport` + `ClaimPlayerMailAttachments`）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。wave:15 军事运行时三修已由 **CLIENT-033**（[#243](https://github.com/anitaguptaoffice/sanguo-slg/issues/243) / [#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`，**wave:15 hotfix**）合入，**不**纳入本波 backlog。波次 backlog 规划 [#245](https://github.com/anitaguptaoffice/sanguo-slg/pull/245)（`a3a80aec`）。**CLIENT-039**（[#259](https://github.com/anitaguptaoffice/sanguo-slg/issues/259) / [#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260) `9e98a28b`）为 wave:16 标签下 1280 顶栏叠字运行时修，**不**替代 CLIENT-033。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#246](https://github.com/anitaguptaoffice/sanguo-slg/issues/246) | CLIENT-034 | 已完成 | [#254](https://github.com/anitaguptaoffice/sanguo-slg/pull/254)（`37259743`） |
| [#247](https://github.com/anitaguptaoffice/sanguo-slg/issues/247) | CLIENT-035 | 已完成 | [#253](https://github.com/anitaguptaoffice/sanguo-slg/pull/253)（`5c505354`） |
| [#248](https://github.com/anitaguptaoffice/sanguo-slg/issues/248) | CLIENT-036 | 已完成 | [#255](https://github.com/anitaguptaoffice/sanguo-slg/pull/255)（`fed5e5bf`） |
| [#249](https://github.com/anitaguptaoffice/sanguo-slg/issues/249) | CLIENT-037 | 已完成 | [#256](https://github.com/anitaguptaoffice/sanguo-slg/pull/256)（`5a4bb4af`） |
| [#250](https://github.com/anitaguptaoffice/sanguo-slg/issues/250) | CLIENT-038 | 已完成 | [#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258)（`30c95e2a`） |
| [#251](https://github.com/anitaguptaoffice/sanguo-slg/issues/251) | INTG-013 | 已完成 | [#257](https://github.com/anitaguptaoffice/sanguo-slg/pull/257)（`14dad6da`） |
| [#259](https://github.com/anitaguptaoffice/sanguo-slg/issues/259) | CLIENT-039 | 已完成 | [#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260)（`9e98a28b`） |
| [#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) | DOCS-EXIT-008 | 已完成 | [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261)（`58bd03b7`） |

H5 人工验收与 INTG-013 路径对齐，见 [client/README.md](../client/README.md#wave-16-战报邮件闭环与军事反馈m4-出口--intg-013)（**战报回合详情 + 邮件附件领取 + 军事 manifest + 小地图扫读 + HUD 角标深链 + 1280 顶栏叠字**）。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003** 第三批核心子集扩量；`cfg_act*` 活动 cfg 灌入；不可逆消费（新道具/商城 SKU）扩量——无单独编排授权；行军 **取消/加速**（`CancelMarch` 等，需未来 contract 卡，当前 `military.v1` 无 RPC）；募兵队列 **加速**（与 wave:14/15 相同，仅建造队列对接 DOM-003）。

**wave:16 美术轨（非本波 backlog 卡）**：**CLIENT-040**（[#262](https://github.com/anitaguptaoffice/sanguo-slg/issues/262) / [#263](https://github.com/anitaguptaoffice/sanguo-slg/pull/263) `a4add478`）已补 1280 军事全页 `<1MB` JPG/WebP 证据供 #108 复验，与 **CLIENT-039** HUD 叠字修互补；wave:17 **不**重复开证据压缩实现卡。

## Wave 17 H5 世界出征互链与复盘导航 — **已完成**

**策略**：在 wave:16 **战报回合/邮件领取/小地图扫读/HUD 深链** 之上，加深 **小地图→出征坐标**、**战报坐标→小地图复盘**、**军事目标记忆**、**日常战备与战报未读横幅** 与 **排行/聊天手动刷新**；网关 **INTG-014** 复跑 smoke（行军目的点 + 战报坐标字段）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#264](https://github.com/anitaguptaoffice/sanguo-slg/pull/264)（`ee33f2d9`）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) | CLIENT-041 | 已完成 | [#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275)（`12a8850f`） |
| [#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) | CLIENT-042 | 已完成 | [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276)（`7b9e4c3f`） |
| [#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) | CLIENT-043 | 已完成 | [#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279)（`66e5578a`） |
| [#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) | CLIENT-044 | 已完成 | [#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272)（`d437076a`） |
| [#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269) | CLIENT-045 | 已完成 | [#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273)（`5a3ae507`） |
| [#270](https://github.com/anitaguptaoffice/sanguo-slg/issues/270) | INTG-014 | 已完成 | [#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274)（`90fb5356`） |
| [#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271) | DOCS-EXIT-009 | 文档收口 | PR [#278](https://github.com/anitaguptaoffice/sanguo-slg/pull/278) |

H5 人工验收与 **INTG-014** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-17-世界出征互链与复盘导航m4-出口--intg-014)（**小地图选点出征 + 战报坐标复盘 + 军事目标记忆 + 日常战报横幅 + 社交刷新**）。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；**CLIENT-040** 全页证据压缩（wave:16 美术轨单独跟进）。

## 不做

跨服战、赛季、实时 PvP、移动原生、多语言——v1.0 范围外。

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 战斗规则复杂度被低估 | 工期翻倍 | MIL-001 先做原型，用对拍验证 |
| 客户端工作量占比高 | 阻塞上线 | 与 M0 并行启动，占位美术先跑通 |
| 契约频繁变更 | 并行失效 | 每周冻结评审 |
| legacy 全量 cfg 灌入 | 工期与合规风险 | wave7 核心子集上限，扩量单独开波次 |
