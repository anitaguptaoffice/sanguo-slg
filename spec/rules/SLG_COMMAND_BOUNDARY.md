# SLG 应用命令与可恢复状态边界

任务：[SPEC-SLG-COMMAND-BOUNDARY-001 / #1797](https://github.com/anitaguptaoffice/sanguo-slg/issues/1797)。
本文件是架构契约候选，不是已实现保证、具体接口冻结或生产启用许可。
基线：`bd96ae6aea28cd982989e07e8aec098d6a8ee4fe`；以下“必须”约束后续设计与实现。
保留 Go + PostgreSQL、现有领域规则和已批准数值；不换框架、不拆微服务、不大规模重写。
不复制第三方代码，不要求事件溯源、通用 command bus、通用事务框架或旧系统适配层。

## 1. 当前事实与目标的区别

基线中的实际源码（不是未来接口）：

- [RecruitWithWallet](../../internal/military/march/recruit_commit.go) 在 MIL 锁内调用钱包提交，
  随后才发布内存任务；源码明确承认扣费后崩溃可丢任务，且没有请求级幂等。
- [military handlers](../../internal/api/military_handlers.go) 将其与 DOM WithWallet 组合；
  当前请求不能被当作已经携带稳定命令身份，响应 `trace_id` 也不是重试身份。
- [Hub](../../internal/military/march/hub.go) 持有城市、行军与回调运行时状态；
  [Scheduler](../../internal/military/march/scheduler.go) 先从内存堆移除到期项再调用处理器。
  有 SQL 表或战报，并不证明内存中的完整生命周期可在重启后恢复。
- [shop coordinator](../../internal/api/shop_purchase_tx.go) 展示了绑定参与者、单协调者、
  supplied-tx、未知提交与提交后刷新边界；不代表它已有本契约要求的身份/读回或全部元数据保护。
  尤其其私有 begin hook 不是本契约新路径的生产可注入 Begin 模板。
- [DOM pg_store](../../internal/domestic/pg_store.go) 的 saveCityInTx 实际自行 Begin；
  名称包含 InTx 不等于可参与应用命令事务，不能嵌入新 UoW 形成第二次提交。

首条目标恢复链为 **招募 → 出征 → 战斗 → 返城**。这是多个短事务连接的持久状态机，
不是跨等待时间持有一个事务。招募单片完成不等于整条链完成。

## 2. 职责与依赖方向

- Transport：鉴权、解码、范围校验、调用命令、映射结果；不编排多域 SQL，不从缓存决定授权。
- Application command：复核权威 actor/shard/owner，编排固定参与者顺序，拥有一次业务提交、
  命令身份处理、提交结果分类与受控恢复；不复制领域 SQL 或战斗/经济算法。
- Domain participant：保留本域规则、纯计算与本域 SQL；仅在被授予的同一事务内检查/写入。
  WORLD 负责城市归属，DOM 负责权威资源钱包，MIL 负责兵力与生命周期；
  涉及 HERO、战报或其他域时另立该域参与者卡，不能由 MIL/APP 越界代写。
- 基本依赖为 transport → application → domain participants；领域不能反向依赖应用协调者，
  不能调用另一个协调者形成隐式事务。平台只提供必要数据库机制，不持有业务成功权。
  最终包名/端口/导入图须另行冻结；允许经审阅的窄领域凭证依赖，不引入循环。

## 3. 唯一事务所有者与来源证明

每个原子状态转换由一个明确应用命令拥有 Begin、Commit、Rollback；执行顺序写在固定代码中。
构造时捕获不可变的确切 pool、具体参与者与受信配置，拒绝 nil、未绑定、被替换或内存替代品。
实际 Begin 必须来自该捕获 pool 的直接调用；生产执行入口不得接受任意 tx、Begin 函数、
Store、初始化器、执行 callback 或调用方提交的“成功”凭据。测试故障点不得变成生产注入入口。

参与者只能使用这次 Begin 返回的确切活跃事务，不得 Begin/Commit/Rollback、savepoint 回退、
独立 pooled fallback 或提前发布缓存。异常、取消、panic 路径必须清理；回滚清理使用有界、
不依赖已取消请求的上下文。清理尝试不证明未知提交已经回滚。

同 DSN、同物理连接、同 catalog 元数据都不是“同一 pool / 同一事务”的证明。
来源依赖不可变构造与闭合调用图；单独一个任意 pgx.Tx 不能自证来源。
所有生产调用点必须受审阅，禁止 API/boot/legacy/recovery 绕过命令直调这些写端口。
这不是对恶意同进程 Go、unsafe/reflection、任意 SQL 或特权 DBA 的沙箱承诺。

### 绑定、授权与锁

- 在事务内依据权威 account/player/shard 和 WORLD owner 校验权限，不能相信传入 owner 或缓存。
  命令/任务/兵力/战报身份均带所属作用域；一个裸 ID 不是授权。
- 构造与工作前复核 pool/参与者身份、database/schema/current role/session、cohort（适用时）、
  relation/allocator OID 和所有权/权限；业务 SQL 显式限定 schema，catalog 查询使用可信解析。
  先锁定再检查/复核，拒绝 TEMP shadow、角色/search_path 重定向和未审阅的 RLS、trigger、
  rule、inheritance、default 或关系替换；保留调用方局部设置，不借检查器偷偷改变设置。
- 各命令必须另行冻结完整锁序，包括早期关系 pin、锁升级和已有 writer 的交互。
  方向为权威 actor → wallet → WORLD city → 相关领域状态/队列/receipt；
  HERO/force、多城市顺序及 receipt 的精确位置尚未冻结，不能靠本概述证明无死锁。
- 新招募路径不得在 PG 锁内获取 Hub/cache mutex。若需要已有 DOM 结算，必须在 Begin 前结束，
  扣费基线取结算后余额；不得把它悄悄嵌套为第二个提交。
  fresh-create 的过渡 DOM gate 若保留，则须先于 DB 锁取得并保证释放，不能持 DB 锁再回入 Hub。
- 超时、死锁和绑定异常 fail closed；重试资格仍遵守命令身份和提交分类，不能降级走旧 writer。

## 4. 持久权威、到期任务与副作用

目标路径以 PostgreSQL 为 durable truth。缓存、Hub 镜像和内存定时堆只可从已提交状态重建；
缓存丢失不能变成空军队、重新扣费或重做战斗的依据。禁止 SQL → 可变旧 Hub 的双权威镜像。

每个等待中的转换必须有可恢复的持久身份、所属范围、状态、到期时间和所需已接受输入。
启动及周期扫描从 DB 找候选，不依赖登录、内存 callback 或客户端提醒；候选发现不是领取成功。
执行者按冻结锁序再次校验 owner、前置状态、到期条件与转换身份，再原子提交效果与状态变化。
早到、重复到达、多个 worker、重启重扫都不能重复 credit/debit、发兵、结算或 promotion。
不得仅因墙上时间已超过 ETA 推断转换已发生；不恢复丢失的函数闭包作为业务真源。

必须可靠交付的事务外效果采用 **outbox 概念**：业务提交同时记录待交付事实，
提交后可重试投递，接收方按效果身份幂等；投递成功与业务提交不是同一件事。
缓存失效可为可重建的 best effort；不能把必须送达的奖励/通知伪装为无关缓存。
这里不冻结 outbox 表、消息协议或通用总线，也不宣称跨系统 exactly-once delivery。

## 5. 命令身份、重复与未知提交

稳定命令身份由可信调用方在第一次提交前保存，超时/重启后复用；作用域至少区分
shard、经认证 actor 和操作种类。不能用 trace_id、进程计数器、时间、坐标、载荷 hash，
或执行中才分配的队列 ID 代替请求身份。相同参数但不同命令身份是独立意图。

请求 fingerprint 表示校验后的、带版本的规范类型化意图；必须能判定精确相等，不能只比 hash。
同一身份且同一意图返回原已接受 receipt，不再扣费、分配或按当前配置重新计价；
同一身份而意图不同必须冲突拒绝且不写入。当前钱包/兵力/任务状态不是原始接受结果。
授权隔离必须覆盖查重/读回，不能因猜到身份而读取其他 actor 的 receipt。
精确字段、编码、长度、保留策略、错误码和传输方式均待独立 SPEC；未批准到期策略前不删/复用身份。

接受 receipt、业务扣费/状态效果与下一阶段 durable job 必须在同一事务提交。
不得先独立提交一个 pending claim，留下无法判定是否接受的身份；并发相同身份必须串行裁决，
唯一约束是最终防线，不代替授权与锁序。后续转换也需要稳定转换身份及已完成判据。

| 结果类别 | 对调用方与恢复的语义 |
|---|---|
| 确认提交成功 | 返回持久接受结果；随后可发布/失效缓存。后续缓存错误不否定提交。 |
| 确认拒绝或确认回滚 | 本次原子业务效果未接受；保持错误原因。重试仍使用原身份并重新验证。 |
| 提交结果不明 | 可能全部已提交；不得伪报已回滚、退款、补兵、重新分配或盲重放。 |

Commit 返回错误、连接丢失或确认包丢失，并不一概意味着回滚。
未知结果不发布推测成功；以原作用域身份做新的权威读回，并按冻结序列化边界等待原事务解决。
匹配且一致的 receipt/job 证明原接受；不一致或不可读保持 unavailable/unknown 并隔离调查。
只有原事务已确定结束、权威一致读证实身份未接受，才允许同身份重新提交；
瞬时缺行、超时和缓存 miss 都不够。不得换身份规避不确定性。
在稳定身份/receipt 契约落地前，只能安全重载/人工核对，不能承诺自动恢复原请求。

## 6. 新城与旧数据边界

Option B 的选定方向是应用层实际 Begin、固定 WORLD → MIL → DOM 新城参与步骤；
不是把现有 DOM CreateNewCity 或 MIL 独立 read transaction 套入另一个事务。
只有绑定 WORLD 的实际新 INSERT 可签发 exact-tx、one-shot 的窄新城凭证，
后续阶段只能用其封闭的 city/owner/shard 身份，不能接受任意 CityID/fresh=true 或 callback 返回值。
零值、外来/已关闭/已消费事务凭证必须拒绝；复制不能重置消费，退出必失效。
MIL 成功必须来自实际初始化与读回，不来自“尝试过”或消费凭证；DOM 返回身份须对照而非覆盖来源。
具体凭证 API、共享状态、清理和 stage/发布方法仍需独立接口 SPEC。

fresh cohort 的 marker、完整且合法兵力行及 owner 必须在同一权威事务验证。
新城初始化只能与该次真正新建及 DOM 初始化原子提交；发现已有 marker/兵力/相关任务不能重置。
缺 marker、部分行、旧空行、旧内存丢失或不可读状态都不是零兵/legacy-empty adoption 的许可。
禁止从钱包、战报、时钟或“看起来没人用”重建旧军队；本契约不恢复未知英雄/NPC/旧 callback 状态。
新城证明是启用新 cohort 的前置条件，不是已有城市迁移方案。

## 7. 首条恢复链与验收矩阵

以下为后续实施必须满足的状态归属，不是新 gameplay：

| 转换 | 同一次提交中必须一致的业务事实 |
|---|---|
| 接受招募 | DOM 权威扣费、MIL 接受 receipt 与训练任务；已接受成本/时长证据保留。 |
| 招募完成 | MIL 完成状态、库存 credit、依现有规则的排队推进及下一 due；不得再次扣费。 |
| 接受出征 | 权威库存扣减/占用、行军接受身份、必要英雄/编队状态和到达 due；不能先扣兵再丢行军。 |
| 战斗结算 | 被接受的结算身份/结果、伤亡与必要领域效果、下一生命周期及返回 due；不能重复战利品/报告效果。 |
| 返城完成 | 幸存兵恢复、相关占用释放、终态/转换 receipt；不能终态已记但兵丢失，或重复返兵。 |

战斗输入/随机性/结果保存、涉及多个 owner 的锁序、战报及奖励的原子/投递边界需专门冻结。
不能用“重启重算一次”掩盖不同结果；此处不改变战斗数值、存活规则或队列时序。
保留现有 [共享 queue identity](queue_identity.md) 的作用域、分配与保留约束，不能恢复 city-local 计数器。

真正验收必须用单独授权的隔离 PostgreSQL 与全新进程，确定故障屏障后终止本测试持有的进程，
验证退出，再重启并从 DB 恢复；抛出普通异常或同进程重建对象不等于 crash proof。
每项均核对精确钱包/兵力、receipt/job/owner 关联、无关域不变、缓存无投机发布及终态保留。

| 故障/重复场景 | 必须观察到的结果 |
|---|---|
| 招募扣费后、任务/receipt 提交前终止 | 整个接受事务无效果；原身份重试最多接受一次。 |
| 接受提交后、响应前终止 | 原 receipt 与任务仍在；同身份重试不再扣费/分配。 |
| 出征扣兵后、行军提交前终止 | 扣兵与行军全有或全无；不能丢兵或复制部队。 |
| 战斗计算后、结算提交前终止 | 无部分结算；按冻结输入/结果协议恢复，不能先发奖励再丢状态。 |
| 战斗提交后、返回调度前终止 | 已接受结果唯一，durable 返回 due 可重新发现；不重结战斗。 |
| 返兵前终止，以及返兵后终态提交前终止 | 可恢复待返状态，或完整终态；重启最终只返一次。 |
| 任一阶段 commit ack 丢失/commit 尚未解决 | 保持 unknown；读回等待解决并辨识全有/全无，不补偿、不盲重放。 |
| 两个 worker/重复 due/早到/重启扫描 | 已完成 no-op，未到期无效果；一次转换只生效一次。 |
| 同身份同意图/改意图/不同 actor | 原结果复用/无写冲突/授权隔离，不能将不同 actor 视作合法重复。 |
| 提交后缓存失效或通知投递失败 | DB 接受仍成立；缓存重建，必达效果按持久身份重投且不重复业务效果。 |
| 无内存事件、无登录、长期停机 | 启动及周期扫描恢复 due；不靠猜 ETA 完成，不跳过队列规则。 |
| 错 pool/schema/role/owner/cohort、缺行或旧数据 | fail closed，无 debit/job/初始化/库存修复；原有数据不变。 |

## 8. 实施与启用门槛（尚未完成）

本卡只冻结架构不变量；**NOT YET FROZEN** 的 SQL/DDL、Go 端口、proto、状态编码、
receipt/fingerprint 物理表示、保留/清理、锁/隔离/超时计划与错误映射必须另立独立 SPEC 卡。
先审阅、满足适用冻结窗口与通知、合并，再做各域小实现卡；不能用本文当作公共接口已批准。
不依赖新 schema 的无副作用领域计算可另立单域卡先做，例如复用既有 UnitSpec/Resources/
RecruitRequest 与 DATA-002 规则的 dormant 招募成本/时长溢出检查，返回值拥有自己的数据。
它不接触 Hub、钱包、DB、queue、时间戳、ID 或 receipt，不证明 affordability/readiness/授权，
也不绕过后续可变状态、存储、wire 契约或整链启用门槛。
CreateCity 的 gate/clone/钱包结算/可信单次时间采样/发布生命周期也须明确保存原有行为。

发布前必须列全旧库存/队列/英雄/行军 writer、snapshot flusher、callback、后台任务、管理入口，
证明排空、兼容或 fence；招募先启用也必须挡住旧 StartMarch 在英雄/编队/库存效果之前的入口。
新 writer 与旧 writer 不得同时争夺权威。保留并发 DDL fence，表锁/receipt 不替代外部 fence。
回滚方案不能恢复会覆盖新状态的旧 writer；迁移、恢复与 cohort 切换均需独立部署授权/证据。

本候选未执行运行时/PG/重启测试，不宣称恢复链通过；源码合并也不是部署或生产验收。
最终文件需独立 SPEC review、精确 head 的必需 CI、单文件 ≤300 行及链接/scope 检查。
历史 reference/art/VERIFY hold 不动；本卡不改变 #1795 等其他任务的权限或发布边界。
遵守 [AGENTS](../../AGENTS.md) 与 [接手约定](../../docs/SUCCESSOR-POLICY-2026-10-26.md)。
