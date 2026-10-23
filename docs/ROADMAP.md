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

- [ ] 分服与开服流程（wave:5 PLAT-004 等）— 网关选服与 `ServerSelectScene` 已冒烟；**wave:8 OPS-OPEN-001** 验收开服运营清单
- [x] 军团、聊天（GUILD-001/002、CHAT-001、WIRE-001）— 域服务 + H5 面板已联调
- [ ] 排行与榜单 — RANK-001 冒烟通过；**wave:8 RANK-002** 双榜与刷新策略加深验收
- [ ] 3000 并发压测 — **wave:8 LOAD-001** 可重复脚本 + `docs/load/PLAT-002-baseline.md`

进度参考：`go test ./internal/api -run TestM3SocialSmokePath`（见根 `README.md`）。出口：可小范围对外开放；客户端 `CLIENT-004`（wave:5）；**wave:8 INTG-005** 复跑 M3 子集 + M4 持久化重启。

## M4 内容（持续）

- [x] 任务系统（QUEST-001）+ wave:7 DATA-001 核心子集 — 端到端见 **INTG-005** 复跑
- [x] 道具与商城（CONTENT-002、SHOP-001、ECON-001 真扣费）
- [ ] 活动与运营后台（GM-001）— `cmd/gm` 已有；开服/运营流程见 **OPS-OPEN-001**
- [ ] 数据埋点 — **wave:8 TELEMETRY-001**

出口：`INTG-004` / **INTG-005** 内容冒烟；`CLIENT-005` + **CLIENT-006**（真实网关背包/使用道具与军团聊天）达 M4 客户端出口。

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

## Wave 8 M3/M4 出口加固

wave:7、WIRE-001、CLIENT-ART-INTG-001 已合并后，补齐 ROADMAP 仍开放的验收与文档缺口（**core-subset-first** 不变）。

| 可并行（status:ready） | 任务 | 说明 |
|---|---|---|
| ‖ | INTG-005 | DATA-001 + ECON-001 + PERSIST-* 下复跑 M3 子集与 M4 冒烟，含重启恢复；`tools/smoke` 一键命令 |
| ‖ | CLIENT-006 | 客户端对接 `content.v1.ListPlayerBag` / `UseConsumable` 与 WIRE-001 军团聊天 |
| ‖ | RANK-002 | 双榜 + PG + Scheduler 完整性（相对 RANK-001 加深） |
| ‖ | LOAD-001 | 3000 连接压测脚本与 PLAT-002 基准报告 |
| ‖ | OPS-OPEN-001 | 开服运营 runbook + GM 检查清单（文档 only） |
| ‖ | TELEMETRY-001 | 登录/建城/战斗/购买/领奖等最小埋点 |

依赖说明：INTG-005 与 CLIENT-006 建议同迭代联调，但可并行开工；RANK-002 不阻塞 INTG-005 的 M4 路径。

## 不做

跨服战、赛季、实时 PvP、移动原生、多语言——v1.0 范围外。

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 战斗规则复杂度被低估 | 工期翻倍 | MIL-001 先做原型，用对拍验证 |
| 客户端工作量占比高 | 阻塞上线 | 与 M0 并行启动，占位美术先跑通 |
| 契约频繁变更 | 并行失效 | 每周冻结评审 |
| legacy 全量 cfg 灌入 | 工期与合规风险 | wave7 核心子集上限，扩量单独开波次 |
