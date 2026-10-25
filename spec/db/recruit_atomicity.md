# SPEC-RECRUIT-ATOMIC-001：自然招募原子提交与将领创建身份

状态：待独立评审的规范候选；不是已实现、已验证或已发布的保证。
基线：`1c5a0912eba3bb27ad3e2ac89ae37a6209e223ac`；关联自然首招验收 #1763。
本卡仅改 spec；不改运行时代码、任务卡、seed、协议、部署或历史参考/美术 hold PR。
本文件明确后续 DB 迁移契约，但不包含会被 ApplySpecs 自动执行的 SQL 文件。
实施与发布须通过第 7–9 节，不能以本规范存在代替修复或验收。

## 1. 范围与源代码依据

目标：一次自然 `RecruitHero` 的既有资源消耗、招募书消耗、新英雄必须同一 PG 事务提交。
另一个必要边界：所有将领创建入口都使用无覆盖的身份分配，不能被旧创建者覆盖。
DATA-002 模板、属性、招募书、费用、重复模板规则、响应字段与既有错误码不变。
不加新 SKU、IAP、福利、玩法、请求键或 RPC；不重做背包/将领系统。

以下是阅读基线源代码所得，不是运行时复现：

| 源码 | 当前行为与本契约约束 |
|---|---|
| `internal/hero/player_ops.go: RecruitPlayer` | 先 SaveHero 后 ApplyRecruitSpend；须替换为同一事务 |
| `internal/api/hero_inventory.go: ApplyRecruitSpend` | 钱包独立提交后 content.Remove；不能作为新原子路径 |
| `internal/hero/pg_store.go: SaveHero / MaxHeroID` | MAX+1 与冲突 UPDATE；创建须彻底分离 |
| `internal/content/bag.go: Remove`、`pg_store.go: SaveStack` | 缓存算绝对余量后写回；须修共享库存的生产消费路径 |
| `internal/hero/pg_recruit_player_test.go` | pgRecruitInventory 是另写的测试适配器；不能证明 API 生产适配器安全 |
| `internal/content/pg_grant.go`、`pg_consumable.go` | 已有 wallet→item 锁顺序；新路径不得反向 |

## 2. 认证与费用权威

- `server_id/player_id` 来自认证会话；请求 server 不匹配仍拒绝。
- 请求只能选择既有模板或既有招募道具/池，不能指定费用、余额、库存、英雄 ID/属性。
- 指定模板以服务器 DATA-002 catalog 的 `RecruitCost`、`RecruitItem` 为准。
- 随机招募保留既有有效 item/pool/default 选择语义及未拥有模板候选规则；不扩池。
- 随机分支仍扣所选模板的四资源费用及所用招募书 1 本；不能被客户端预览值覆盖。
- 自然招募只扣现有 food/wood/stone/iron，gold 保持原值；不顺便新增金币收费。
- 消耗为非负资源、正数道具数量；非法配置/未知模板/道具不得变成免费招募。
- 初始等级、忠诚、四维、status、模板归属保持现有规则；纯计算不能发布成功状态。
- 服务端随机源须并发安全，不接受客户端随机种子；不改变既有随机抽取的玩法规则。

## 3. 一个事务，一个提交决定

选定 API 协调器作为生产事务所有者；hero 定义规则和将领存取，content 定义库存存取。
所有参与者使用同一个 PG pool/database 的同一个事务句柄，不是各自 Begin 的事务。
事务参与端口不允许 Commit/Rollback、不另开连接、不调用会独立提交的旧 Spend/Remove。
缺少任一事务端口时 fail closed；禁止降级为旧部分提交或内存成功路径。

事务执行顺序（READ COMMITTED，错误即退出并回滚）：

1. 验证会话/请求及依赖；Begin，一处负责 defer Rollback 和最终 Commit。
2. 对该玩家 `player_wallet` 行 `FOR UPDATE`；缺失且费用非零按资源不足处理。
   钱包行同时串行化同玩家自然招募；即使将来合法零费用，也不能跳过串行化。
   禁止以之前读到的缓存余额替代锁内值。锁不跨响应或网络副作用持有。
3. 在该事务内重新读取所属英雄，按服务器 catalog 校验并选择模板。
   并发其他创建者仍由现有正模板唯一索引最终裁决，不只靠预检查。
4. 钱包参与端口按锁内余额/条件扣减四资源，保留 gold；不足不得改变任何资产。
5. content 事务端口扣既定书数量；所有物品按 item_cfg_id 升序取锁/扣减。
6. hero 事务端口 INSERT 新英雄，使用第 5 节 sequence 身份；返回实际 ID。
7. Commit 成功才发布结果、刷新缓存、触发现有招募后任务信号。

资源、库存或 INSERT 任一步失败、取消、明确回滚/死锁终止：本次全部资产写入回滚。
不允许“先保存英雄再扣钱”、补偿性删英雄、扣书后补钱、事务后独立补写英雄。
唯一索引冲突也必须回滚资源和书；只有模板唯一冲突映射为已有的重复模板业务错误。
主键冲突是身份分配/迁移故障，不能伪装成功、覆盖原英雄或当作重复模板吞掉。
序列号码跳号不是资产部分提交，见第 5 节。

### 3.1 端口语义与域边界

以下是必须满足的能力，不要求引入通用框架或照抄接口名称：

| 所属域 | 必须提供的能力 | 明确禁止 |
|---|---|---|
| API | Begin/Commit；认证映射；钱包 Read/SpendInTx；组合下面两个域 | 在 API 复制 hero/item SQL；调用自提交 Spend |
| hero | tx 内列英雄、服务器规则计算、CreateHeroInTx；返回持久 ID | 直接改 content 表；把 caller PlayerState 当权威 PG 资产 |
| content | DebitItemsInTx(ctx, tx, player, costs)，返回实际余量 | 查询缓存决定余量；缓存绝对数 SaveStack；在端口内提交 |

可以传已有 pgx.Tx 或仅含 Exec/Query/QueryRow 的窄执行器；禁止隐式全局“当前事务”。
hero 创建端口的 INSERT 必须用传入执行器；其 Pool-only SaveHero 不得被误调用。
非事务便捷创建封装可自行开事务，但不能供已处在招募事务内的调用方使用。
旧纯内存规则测试可保留；不得宣称分开的 MemStore/InventoryPort 已有跨域原子保证。

### 3.2 内容域共享库存的必要修复

扣减语义为 `UPDATE player_item SET quantity=quantity-q WHERE ... AND quantity>=q RETURNING quantity`，
其中 q 必须大于零，主键必须含认证 server/player/item；零返回行表示库存不足。
可采用锁内读后写的等价实现；零库存可同事务删除或保留零行，不得先提交再清零。
事务失败不发布缓存变更，不得通过 Remove→SaveStack 写入缓存推导的绝对数量。

仅给 RecruitHero 新增此端口仍不足：旧 PG Remove 的迟到绝对写能覆盖新招募扣减。
必须另做 content 卡，把生产 PG Remove 改为同样的持久条件扣减；旧内存行为不冒充 PG。
它须覆盖 UseConsumable、shop item-payment、hero item-spend 等实际共用入口。
这不授权重做其效果、价格或整个操作的多域事务；只修共同库存扣减正确性。
所有在线增加/创建正库存的路径（包括 Add/Set/SaveStack 与 Grant）必须共享同玩家的
wallet→item 串行化：先确保钱包行存在并锁住它，再读取背包、创建缺失行或更新零/正库存行。
仅对已有 item 行加锁或使用原子 delta 不足；不存在/零库存行的创建也必须持有该钱包锁。
当前 Grant 只锁已有 quantity>0 行，再以绝对 EXCLUDED.quantity UPSERT；因此其免重写前提
是所有在线正库存写入都遵守上述串行化，不能允许 item-only Add 在扫描与 UPSERT 之间插入。
生产 Add/Set/SaveStack 还须使用锁内新值/原子 delta，不得写缓存绝对值；未满足这些条件时，
仅允许作为明确授权且相关写流量关闭后的维护操作，不得在线开放。
现有 Grant/资源包事务保留各自语义；满足共同串行化前提后，不要求重写其锁内绝对值更新。
所有需同时锁钱包/道具的操作遵守 wallet→item；单独扣书不得锁 item 后再等 wallet。

## 4. 缓存、错误与重试边界

- PG 是提交结果权威；成功后库存/钱包刷新失败只记录诊断、失效缓存、安排下次读取刷新。
- 缓存刷新失败不得将已提交招募返回为“购买失败”，不得自动再次扣费或赠还书。
- 禁止用较早事务的返回快照盲写覆盖较新缓存；优先失效/重新读取，写操作始终读 PG。
- 成功响应的 hero_id/template/level/loyalty 取本次提交结果，不要求先成功刷新所有缓存。
- 任务通知仅在提交后；通知失败不回滚已提交资产，也不宣称任务累计已原子提交。
- 明确失败未提交才可按现有业务错误返回；SQL/连接内部信息不得泄漏给玩家。
- Commit/回复丢失可能导致结果未知：不得声称必然回滚，不得盲目重放或补偿。
- 没有持久 request key，本契约不保证随机招募“请求恰好一次”；重复请求可分别成功并分别付费。
- 指定模板的唯一约束阻止重复拥有，但不是随机请求幂等账本；trace_id 不是请求键。
- 不新增客户端自动重试；断线后先刷新英雄/背包/钱包，不能把不确定结果显示为确定未扣费。

## 5. 选择显式 sequence，而非 MAX+创建锁

新数据库对象：`player_hero_id_seq`，BIGINT、正数、INCREMENT 1、NO CYCLE。
所有服的新创建共享这一 sequence；保留 `(server_id, hero_id)` 主键及现有英雄 ID 不变。
旧英雄跨服同 ID 仍合法；消费者不能依赖服内连续 ID 或从 ID 推导归属。
CreateHero 在 INSERT 内取 nextval 并 RETURNING hero_id；调用者不得传入手算 ID。
创建 SQL 不得有 `ON CONFLICT ... DO UPDATE`；不得使用 MAX、进程计数器或随机碰撞回退。
序列并发取号互异，事务回滚允许跳号；不承诺 gapless，也不回收已提交后删除的 ID。
这些是 PostgreSQL 的既有语义：[sequence functions](https://www.postgresql.org/docs/16/functions-sequence.html)。

迁移契约（后续独立 spec/db 迁移卡实现、验证，不在服务请求路径执行 DDL）：

1. 新对象按有序 schema migration 创建，运行账号有 USAGE，禁止日常代码 setval/restart。
2. 完全关闭并排空第 6 节旧创建者及相关维护写入；数据库锁只能辅助，不能替代停旧实例。
3. 单迁移所有者在事务中锁住 player_hero 写入后读取跨服高水位并初始化序列。
   可用 SHARE ROW EXCLUSIVE；锁在事务结束释放：[LOCK](https://www.postgresql.org/docs/16/sql-lock.html)。
4. 高水位 H 至少覆盖现存 player_hero 的最大 ID、持久英雄引用的最大 ID、已知保留高水位。
   检查 hero_skill/assignment、field_army.hero_ids 及已存在的 hero_* / player_hero_* 辅助表。
   未落库的历史已删除 ID 无法从 MAX 证明；不得宣称修复了所有历史复用。
5. 空库 H=0 时首个 ID=1；非空库首个 ID>H；H 达 BIGINT 上限时 fail closed，不能回绕。
6. 迁移重试/恢复必须向前推进，不能降低现有 sequence 高水位、重建/reset sequence。
   备份/恢复保留序列状态；恢复后重新核对行/引用高水位，在开放写入前修正不足。
7. 当前 ApplySpecs 将 SQL 执行与 migration 名记录分开；迁移须能安全处理“SQL 已完成、
   记录未写入”的重试，并显式验证已有 sequence 的类型/步长/NO CYCLE，不能盲目 IF NOT EXISTS。
8. 生产用前验证权限、迁移记录及 nextval 范围；不存在/权限不足时禁招募，不能回退 MAX+1。

拒绝仅用迁移无关的 advisory lock + MAX+1：所有创建者仍须同时改造才能防旧 UPSERT，
而删除最大 ID 后可能复用引用；跨进程 mutex 更不足。sequence 增加一个小 DB 契约，
换取直接、可测试的分配规则；**sequence 本身不能保护我们免受仍运行的旧 UPSERT**。
不另加 UUID、雪花号、新身份服务或全表永久创建锁。

## 6. 全创建入口切换，保留合法更新/转让

| 入口（internal/hero） | 必须切换的动作 | 本卡不扩大承诺 |
|---|---|---|
| player_ops.go: RecruitPlayer | 同事务扣费 + sequence INSERT | 本契约完整原子目标 |
| recruit.go: RecruitAndPersist | 禁止把外部 PlayerState+MAX 当 PG 自然招募；PG 路径接原子协调或明确拒绝 | 纯内存规则测试可保留 |
| hotel.go: RecruitHotelCandidate | sequence INSERT，保留候选属性/金币/容量规则 | 只修身份，不宣称 gold+候选删除已原子 |
| coming.go: InjectComing | sequence INSERT，元数据使用返回 ID | 不把现有 metadata 两次写宣称原子 |
| captive.go: InjectCaptive | sequence INSERT，元数据使用返回 ID | 同上，不添加战斗产俘玩法 |
| persuade.go: LionizeHero hire | sequence INSERT，保留模板与好友状态语义 | 不宣称现有 lionize 状态更新已原子 |

以上入口无论目前是否暴露 API/GM，都不能保留潜在的旧覆盖写法。
测试 fixture/维护导入不得借生产 SaveHero UPSERT 创建；明确区分 fixture 建数与更新。
新发现的创建入口同样纳入清单；上线前搜索直接 INSERT、SaveHero、MaxHeroID 调用审查。

SaveHero 改为仅 UPDATE 已存在 `(server_id,hero_id)`；影响 0 行必须报未找到，不能补 INSERT。
既有忠诚、等级、经验、加点、行军、任职、coming 接受、captive 招降仍可更新原英雄。
身份主键不变不等于 player_id 永远不变：合法授权的归属转让须仍能 UPDATE 已存在行，
校验原归属/状态并正确维护关联数据；不可为修创建覆盖而一刀切禁止所有 owner 更新。
无授权的 owner/template 改写仍禁止；正常更新不能被误路由到 CreateHero 或重新分配 ID。
MemStore 的创建/更新区分与 PG 一致，按 server+hero 键隔离，创建碰撞失败；测试不能藏掉差异。

## 7. 发布与降级的硬门禁

独立契约评审通过后才实现；没有全域实现和证据，不开放新自然首招或宣称 #1763 完整验收。
发布单元须包含 sequence 迁移、所有创建者 insert-only/update-only、共享库存安全扣减、
API 原子协调与缓存后提交处理。分域 PR 可分别合入，但不代表可分开滚动开放写入。

切换必须：停招募/创建/相关维护写入口 → 排空旧事务和旧实例 → 迁移与检查高水位 →
部署全套兼容 writer → 核对版本/能力并通过生产适配器验收 → 再开放写入。
所有能写 player_hero 的旧进程必须退出；只停 RecruitHero 而保留旧 hotel/GM writer 不够。
共享书库存的旧绝对写进程同样必须退出或对应入口停用；禁止新旧不兼容 writer 混跑。
此文不授权执行部署；执行者须另持发布授权与可验证的排空证据。

降级只允许到仍懂 sequence、insert-only、事务和安全库存扣减的版本。
若只能回到旧 MAX/UPSERT/分段扣费版本，保持相关写入口关闭；不能以“临时恢复”绕过。
不删除 sequence、不改低高水位、不追扣/赠还已提交资产、不恢复旧数据库快照覆盖新交易。
发现旧 writer 或 identity collision：关闭相关写入口、保留证据、核对提交结果后修复。

## 8. 分域实施计划（均需独立卡/PR，每卡改动 ≤400 行）

编号为规划占位，不表示已在 backlog 分配；编排者创建卡后实施，不跨域顺手修改。

| 顺序/建议卡 | 独占修改范围 | 交付与依赖 |
|---|---|---|
| A SPEC-RECRUIT-ID | spec/db/** | 迁移、恢复/重试说明、SQL 验证；依赖本契约独立批准 |
| B HERO-CREATE-ID | internal/hero/** | PG/Mem create/update 分离及所有第 6 节创建者；依赖 A；超限拆 store 与 callers 卡 |
| B1 API-HERO-FIXTURES | internal/api/** 测试 | 把 SaveHero 建数 fixture 迁至明确创建端口；与 B 接口交付协调，不由 hero agent 跨域修改 |
| C CONTENT-ITEM-DEBIT | internal/content/** | tx 条件扣书端口 + PG Remove 修复、共享库存并发证据；依赖本契约 |
| D HERO-RECRUIT-TX | internal/hero/** | 规则计划与 tx-bound 创建/读取能力；拒绝旧 PG RecruitAndPersist 绕过；依赖 B |
| E API-RECRUIT-TX | internal/api/** | 唯一事务所有者、钱包 tx 端口、接 B/C/D、commit 后刷新/任务信号 |
| F API-RECRUIT-VERIFY | internal/api/** 测试 | 实际生产 wiring + PG 集成，非 pgRecruitInventory 替身；依赖 E |
| G RELEASE-RECRUIT-GATE | 发布记录/运行手册（另卡授权） | 全 writer 清单、停写/排空/迁移/降级证明；不在本 spec 卡部署 |

B/D 不同 agent 不得同时写同一 hero 文件；编排者串行或明确文件归属。
B 可先加创建端口，再迁移各域 fixture/callers，最后取消 SaveHero UPSERT；过渡提交不具备上线资格。
最终集成必须包含 B1，否则不能用未改造 fixture 的失败掩盖新增回归或绕过更新语义。
必要公共端口先由所属域交付，API 只调用；不足不能复制其他域 SQL 来“先跑通”。
现有非自然招募多步操作的原子性另列修复项，不以本卡身份修复冒充全部完成。

## 9. 接受条件与独立评审

未来测试必须在隔离测试 DB 使用真实 PGStore、content 实现和 API 生产协调器：

1. DATA-002 指定模板成功：恰好一英雄，精确四资源/书差额，gold 不动，响应 ID 可重读。
2. 资源不足、书不足、未知输入：英雄/书/全部资源不变。
3. 在资源后、书后、INSERT 后、Commit 前注入可控失败/取消：所有资产均无部分提交。
4. 同玩家同模板并发：至多一次成功且只扣一次；另一请求稳定业务拒绝。
5. 同玩家不同模板/随机、书或资源仅够一次：不能透支，成功次数与实际差额匹配。
6. 不同玩家并发及自然招募与 hotel/coming/captive/lionize 创建交错：ID 不碰撞、不改旧英雄。
7. 创建主键冲突只失败不覆盖；删除最高英雄后新创建不复用；历史跨服同 ID 仍可独立更新。
8. 现有升级、忠诚、任职、行军、coming/captive 转态及合法 owner 转让不退化为插入/禁止。
9. 缓存刻意陈旧、两个 Service 实例、Remove/Grant 与招募交错：无丢扣/恢复旧库存/负库存；
   若开放在线 Add/Set，还须覆盖 Grant 与其对缺失/零库存行创建的竞争，证明共同钱包锁有效。
10. 提交前不发布缓存；提交成功而刷新失败仍成功；重启后 PG 资产与响应一致。
11. Commit 结果未知不自动重放；随机重复请求不以“恰好一次”断言测试。
12. 迁移空库/存量高 ID/残留引用/重试/恢复/权限不足/耗尽及禁旧 writer 门禁有明确证据。

独立 reviewer 至少核对：DB 分配/迁移恢复与旧 writer 门禁、hero 全创建/更新覆盖、
content 条件扣减与锁顺序、API 真实单事务及缓存错误语义；不得仅重跑原假适配器测试。
审查须注明源码证据、运行通过、未运行与已知非目标各是什么；不能把设计评审写成修复完成。
本规范准备阶段只做源码阅读和文档静态检查；未运行漏洞复现、审计 harness 或数据库变更。
