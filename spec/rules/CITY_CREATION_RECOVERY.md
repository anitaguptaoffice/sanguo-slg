# 首次建城意图、提交与恢复规则

任务：[SPEC-CITY-CREATION-RECOVERY-001 / #2378][task]。
本文件是完整规则候选；下文“必须”约束后续契约和实现，不表示运行时已经具备这些保证。
采纳须经过独立 SPEC 审阅、适用冻结窗口/通知核验、精确最终 head 的必需 CI 和正式合并。
本卡不修改 wire、DDL、运行时或目标数据库，不启用首次建城，不代表完整新手流程交付。
核验基线：`35f628c5e76e42b0fd7f5ad193a58820edf3ec69`。
基线 tree：`70c74bc6a53d5f26d4a009c5d6285b4366b422d4`；本候选为新规则，无继承实现。
选定方案见 [2026-11-10 前瞻计划及范围修订][plan]；研究记录不是已批准实现。

## 1. 现状、目标与上位规则

基线的 [live handler](../../internal/api/world_handlers.go) 仍调用 DOM CreateNewCity，
经 [saveCityWithWorld](../../internal/domestic/city_atomic.go) 进入 WORLD CreateCityInTx。
[该旧路径](../../internal/world/city_creation.go) 使用 MAX+1；空名和 (0,0) 有默认替换。
[现有协议](../proto/sanguo/world/v1/world.proto) 没有命令身份、receipt、首次意图发现或放置预留。
[PlayerCities](../../internal/world/persist.go) 是当前归属查询，不是历史命令结果。
空列表、同名/同坐标城市、占用错误都不能证明旧请求失败、成功或已结束。
[既有测试](../../internal/api/city_atomic_recovery_test.go) 保留同一玩家四个不同坐标城市，
并模拟真实提交后丢失确认；它没有验收本候选的意图、仲裁、receipt 或重启协议。

采用方案 B：先持久接收规范意图，再执行一次原子业务事务。
这是 [SLG_COMMAND_BOUNDARY §5](SLG_COMMAND_BOUNDARY.md#5-命令身份重复与未知提交)
的唯一首次建城专用例外：PENDING 接收不是业务成功，成功 receipt 仍须与全部业务效果同提交。
本文件的终态拒绝及新 predecessor 意图也只适用于此操作；其他命令的一般重试规则不变。
保留 [WORLD_CITY_IDENTITY](WORLD_CITY_IDENTITY.md)、[FRESH_CITY_PROOF](FRESH_CITY_PROOF.md)
和 [FRESH_CITY_PARTICIPANTS](FRESH_CITY_PARTICIPANTS.md) 的授权、保留、来源与事务生命周期约束。
本文不把 dormant participant、旧 callback 链或研究方案宣称为完整 fixed fresh live route。

## 2. 所有权、永久 slot 与资格

首次建城指永久保留的 onboarding 意图，不指当前城数、首都标记、钱包存在或登录次数。
WORLD 拥有专用 ledger：首次意图 slot、命令历史、规范请求、接收时模板及终态 receipt。
ACCOUNT 仍独占账户状态及 player/account 绑定权威；WORLD 不代写账户、钱包、MIL 或 DOM。
APP/API 负责固定编排、认证、source admission 和结束分类；PLATFORM 只提供窄数据库机制。
不引入通用 command framework、可替换业务参与者或成功 callback。

slot 的稳定逻辑键是 realm + shard + player，跨操作版本、进程重启和 source generation 保留。
realm 不是进程 ID、临时 cohort、当前 OID 或可随意换名的 namespace；其物理映射见 §9。
slot 不因 source 更新、升级 wire version、删城、转移城市或清除本地存储重新获得资格。
slot 永久绑定接收时的 account。首版不支持账户改绑、player 转移或 realm 迁移。
发现绑定变化即关闭该路径；不给新账户新建 slot，也不向原账户泄漏已失去授权的结果。
改绑或迁移需要另立完整保留与授权契约，不能由登录流程隐式处理。

首次可接受的 EMPTY 只能来自完整认证的新 realm 历史和持续排他/保留保证。
不得按“legacy 玩家现在零城”分批采纳，不把缺钱包、空城表或缺 ledger 当无历史证据。
合法多城及后续建城保持独立；不得增加 player/capital 全局唯一约束或删除多余城市。
本操作最多成功一次；拒绝后可有多次明确尝试，但只有一个当前 head，全部旧尝试保留。

## 3. 身份、规范内容与不可变模板

命令 ID 在首次发送前生成并保存，使用非秘密的密码学随机身份；位数/编码另立 wire 契约。
命令作用域包含 realm、shard、player、operation/version，并校验不可变 account 绑定。
trace ID、显示名、城名、坐标、载荷 hash、时间或进程计数器都不能代替命令 ID。
同 ID 同规范内容只返回既有状态，明确继续另按 §6；同 ID 异内容必须报冲突且不写入。
已保留的 ID 不复用；同 ID 不得换 predecessor、坐标、名称、actor 或操作版本来恢复。

规范意图包含 ID、操作/版本、认证作用域、predecessor、明确城名与 x/y。
server 必须从类型化字段独立重建并比较完整规范内容，不能只信调用方 hash 或只比较 hash。
名称必须有效 UTF-8、1–32 个 Unicode 码点且无 NUL；不 trim、不 normalize、不默认改名。
x/y 都必须显式提供，范围各为 0..499；(0,0) 就是实际坐标，不改为 (50,50)。
字段 presence、未知字段、字节编码、大小限制及错误映射由独立 wire 契约完整冻结。
Go/TS 必须有一致 golden vectors；signed-int64 身份不得经过 JavaScript 不安全整数转换。
ledger、客户端存储及证据不保存密码、session token 或其他凭据。

接收时捕获 server-owned 初始模板、规则/目录版本及可恢复的不可变内容。
不能只保存指向可变当前配置的版本名；升级后仍须能准确解释和执行原规范意图。
重复接收不更新模板；无法执行旧模板时保持 unavailable/PENDING，不静默换资源、建筑或名称。
模板复制、初始资源/建筑、空 BuildJobs 等限制继续遵守 fresh participants，不扩展游戏数值。

## 4. 三种持久状态与只读恢复

- PENDING：接收已提交，意图可发现；不证明有城市，也不证明没有正在执行的事务。
- SUCCEEDED：完整城市业务与原始成功 receipt 已原子提交；终态不可改写。
- REJECTED_NO_EFFECT：仅 §7 的窄 finalizer 提交，证明该命令终结且没有本次建城业务效果。

UNKNOWN 是调用方知识不足，NOT_OBSERVED 是本次按 ID 权威读未见记录，都不是持久拒绝。
actor discovery 的 EMPTY 只表示该次读未见已提交 head，不排除未到达包或未提交接收事务。
这些观察不能授权替换已知本地/已接收意图；无本地意图的 INITIAL 只按 §5 专门规则仲裁。
读取失败、历史矛盾、损坏或不完整恢复意味着 unavailable/隔离调查，不得当作 EMPTY。

提供独立的 actor 意图发现和按命令 ID 结果查询；二者只读，不领取、不执行、不改 head。
每次都重新认证当前 account/shard/player，从主权威源查询，不用缓存、副本或当前城市拼 receipt。
成功 receipt 固定原 command、规范内容/模板、实际 city/owner/shard 身份及原始创建结果。
后续改名、城市删除、占领或归属变化不重算历史 receipt，也不撤销成功或恢复首次资格。
receipt 不授予当前城市访问权；进入城市仍须独立检查当前 owner。
猜中 ID 不得读取其他账户的命令；格式错误/未授权仅拒绝本包，不终结以前的 PENDING。
登录、reload、轮询、发现 pending、切设备均不构成首次建城执行授权，不得因此自动执行或改坐标。
退出、切账户/actor、Back/Close 及晚到响应必须隔离，旧响应不能推动新 actor 执行或进入城市。

## 5. INITIAL、predecessor 与接收仲裁

接收事务只提交规范 PENDING 命令及 slot head 的原子转换，不初始化钱包，不分配 city ID，
不写 WORLD 城市、MIL/DOM 状态，不发布业务缓存。接收成功只可显示“意图已接收，未完成”。
认证、source 检查、ACCOUNT 绑定与 slot/command 序列化在事务中完成。
只有当前 head 等于请求 predecessor 才可推进；缺行 CAS 的物理序列化另按 §10 冻结。

以下八项是完整 INITIAL 规则，不得只实现 command-ID 唯一键：
1. 区分 command lookup 的 NOT_OBSERVED 与 actor discovery 的 EMPTY；二者均不证明旧包失败。
   server 无法恢复从未持久接收且所有客户端均已丢失的名称/坐标，不承诺恢复网络中的草稿。
2. 仍持有已发送或未知 local intent，或已知 server head 时，必须保留原 ID/内容并读回。
   不因 miss、EMPTY、超时或清除存储把它当取消；已知拒绝后新意图只用 exact rejected predecessor。
3. 完全没有 local intent 且没有已知 head 时，用户可明确“提交首次建城提案”，生成新 ID，
   以 expected predecessor EMPTY 提交 INITIAL。这不是替换/恢复旧命令，也不保证它胜出。
4. 接收必须在永久 actor slot 上原子 create-if-absent/CAS，只有从未接收 lineage 才能接受 EMPTY。
   不存在的行不能仅靠 SELECT FOR UPDATE 锁住；须证明唯一约束冲突/重读或稳定 slot 锁的完整路径。
   旧接收事务未结束时，同一序列化边界须等待它解决，不能依据 READ COMMITTED 的瞬时缺行接受第二份。
5. 迟到旧 INITIAL 与新提案竞争，最多一个被持久接受；失败者没有业务效果。
   仅向当前已认证 actor 返回真实 canonical winner、head 和状态，不承诺最后点击或最早发包获胜。
6. 不同 ID 的 PENDING winner 必须展示它实际的城名/坐标，不能套用 loser 的 UI 内容。
   本次提交只展示冲突/已有意图；必须下一次明确“继续”才执行 winner，不能自动替换后执行。
   若 winner 已成功，只读返回历史结果，独立校验当前 owner 后才允许正常进入。
7. 已接收 PENDING、SUCCEEDED 或任何 retained rejection lineage 都拒绝 expected EMPTY。
   head 为拒绝时也不清 slot；新明确意图须新 ID 和该 exact rejected head，过时 predecessor 报冲突且不写入。
8. slot、已接收记录或历史因损坏/restore 可能缺失时禁止 INITIAL。
   只有 §9 完整认证与持续 retention 成立才允许 EMPTY CAS，不能让 legacy 零城 actor 借此获得资格。

同一 predecessor 的两个新 ID 最多接收一个；PENDING 或 SUCCEEDED 不可被另一个 ID supersede。
历史终态 ID 的重放只返回原终态，即使 head 已推进也不能复活、回退 head 或执行。
接收 ACK 不明仍须保留原身份，按 §8 poison source；后来读到 PENDING 不授权该 poisoned generation 执行。
首版无取消、abandon-and-replace、自动扫描坐标、随机重试、后台执行或自动补发新意图。
可建性查询/地图选择/预留若另行提供须独立权威契约；查询只是建议，执行仍须重新校验。
坐标 hash 标签、固定 fallback 和 occupied 结果不能替代放置权威或推断城市归属。

## 6. 明确执行与完整业务事务

首次明确提交可在确认接收后执行自己的同 ID/同内容意图；不得据此执行另一个 winner。
之后的 PENDING continuation 必须来自当前用户的明确动作，以原 ID/规范内容执行。
每次 continuation 使用仍合法、已独立准入的 source；先按冻结锁序等旧事务实际结束并读取状态。
PENDING 本身不是执行许可；终态只返回原结果，不再次初始化、分配或发放资源。

APP 捕获同一 generation 的具体 ACCOUNT/WORLD/MIL/DOM、exact Binding 与不可变 profile。
所有实际事务由 APP 经该 Binding 直接 Begin，私有 Access 快照绑定 exact transaction state。
每阶段重新验证 source、账户状态/绑定、作用域、规范内容与模板；不能从 session cache 推断授权。
执行的 DOM gate 必须在 Begin/PG 锁前取得；取消、错误、panic 都释放 gate 并作有界清理。
不在持 PG 锁时回入 Hub，不嵌套 legacy save、独立 pooled fallback、savepoint 或用户 callback。

必须在一个效果事务中完成：
1. 全部 relation pins、元数据/权限复核，随后 ACCOUNT actor 与 slot/command 序列化。
2. DOM 锁定并保留已有钱包；仅在已认证完整历史允许时首次初始化，缺行不是补钱授权。
3. WORLD 按既有 CITY/shard、指定 map cell 锁序检查坐标，用 retained-safe allocator，绝不用 MAX+1。
4. 实际 WORLD 新 INSERT 与 readback 一致才产生 exact-tx、one-shot FreshCity。
5. MIL 消费它，拒绝旧 marker/兵力/队列/历史，实际写入 marker 和四库存并完整读回。
6. DOM 消费真实 InitializedCity，写 checkpoint/buildings，拒绝旧状态，不替换密封身份。
7. 以同一 trusted DB processing sample 完成所需初始化；原子提交 SUCCEEDED receipt 和全部业务效果。

具体强度、ledger pin 位置及全局锁序必须另立物理契约，不把上列逻辑顺序当成无死锁证明。
receipt 记录实际创建结果；WORLD created_at 的既有默认语义不冒充共同 processing sample。
只有确认 Commit 成功才可 Publish/刷新缓存；发布失败不撤销成功、不重做城市或重新赠送资源。
失败必须结束整个效果事务，禁止在已改钱包/城市的失败事务中追加 rejection 后 Commit。
回滚可留下 allocator sequence gap；不得回收 ID，也不把 gap 算成城市/资源业务效果。

## 7. 确认全回滚后的窄 finalizer

选择独立、受锁保护的 finalizer，不采用 savepoint 方案；它只终结命令，不创建或补偿城市。
以下十项是同时成立的规范义务；缺少证据时保持未知或原已知状态，不猜测、补写 durable rejection。

1. 必须取得对这一次实际效果事务成功全量 Rollback 的正面证明，且从未发布业务缓存。
   “已调用 Rollback”、tx 已关闭、connection closed、context canceled 或 cleanup 超时都不够。
   曾尝试 Commit 且结果不明时，后续 Rollback/清理绝不能推出 no-effect。
2. 白名单仅含具体 WORLD participant 在该执行中确认的地形/资源不可建和指定坐标唯一冲突。
   前者须来自实际地图校验分支，后者须来自确切坐标约束，不泛化为任意 SQLSTATE/唯一冲突。
   来源/元数据/账户漂移、allocator、缺失历史、内部 SQL、超时及连接错误都不在白名单。
   私有 provenance 必须绑定 actual branch、command、规范 payload、source 和 exact effect transaction。
   errors.Is 链、错误字符串、调用方 boolean、用户数据、跨事务复用或其他 callback 均不能伪造它。
3. 此私有证据仅在受审固定调用图内有效，不是抵御恶意同进程 Go/DBA 的安全沙箱。
   不导出、序列化、重置、从日志重建或跨重启消费；只授予一次窄 finalizer 尝试，不授予直接返回终态。
4. APP 必须持连续 generation-bound command lease，覆盖 effect Begin/rollback、间隙、
   finalizer Begin/ending 和 bounded cleanup；不得在 rollback 后先记 lease ended，再无 lease Begin。
   正常 close 不接受新命令；既有 lease 仅按已审 phase gate 收尾，不是无限多次 Begin 权限。
   无法安全继续则丢弃私有上下文并保留 PENDING，直到实际事务结束/清理才分类 lease。
5. source drift 或别的命令 unknown 已使 source poisoned 时，旧失败证据不能开始新 finalizer SQL。
   必须区分正常 close/drain 与 poison，并将 phase admission/实际 Begin 授权同 poison 线性化。
   不得先检查“未 poison”再无保护 Begin；先赢的 poison 拒绝新阶段，先获准阶段按受审 ending 规则结束。
   该物理门槛缺失就不 finalizer，等待新已审 source 下的明确继续；不增加 reopen/clear-unknown 捷径。
6. finalizer 重新验证 source/ACCOUNT，在相同 slot/command 锁下读取实际状态。
   只可将绑定、规范内容及 head 均匹配的 PENDING 原子改为 REJECTED_NO_EFFECT；不推进 successor。
   间隙内竞争执行者先提交成功时必须保留 success；已有 rejection 也保留，不能覆盖任何终态。
   finalizer 先提交拒绝时，旧执行者及迟到包只能读终态；竞争事务未结束必须等待，不能靠超时/miss 绕开。
7. 竞争者 COMMIT ACK 丢失时，本 finalizer 的锁/读回最多解释这个命令，不能解除竞争者 source 的 drain。
   所有进程的 server transaction 结束、外部排空与 unknown 证据仍各自成立，不能用 receipt 代替。
8. 即使两事务间坐标变得可用，finalizer 先获锁且仍匹配 PENDING 时仍可终结已确认失败的本次尝试。
   rejection 描述该尝试的终局，不声称地形现在不可用；UI 不把保存的原因当实时 buildability。
   下一次选择须明确新动作、新 ID 和 exact rejected predecessor。
9. rollback 后、finalizer 前 crash 留下 PENDING；旧日志错误不是终态，也不能签发新 proof。
   新 source 下明确继续同命令可能成功，不承诺“曾遇到一次地形错误以后永远失败”。
10. intake 的 uncertain Commit 同样 poison；读到 PENDING 不能绕过 poisoned generation。
    finalizer 自身 Commit 不明也保持 unknown，走原身份读回并保留 unresolved，不再开第二个拒绝事务猜结果。

ACCOUNT 失效、被封或改绑只阻断本次执行/终结资格，不把历史 pending 强制改为 rejection。
error、rollback authority、私有 capability 和物理竞争锁序必须另行冻结并实现；现有 sentinel error 不够。

## 8. source 生命周期与未知结果

intake、effect、finalizer 和读回遵守同一来源/代际身份纪律；不同显式动作须重新准入。
事务结束分类不依赖 HTTP/WebSocket 成败。任意阶段 Commit/rollback ending 不明均 poison/close，
禁止新 admission，drain 保持 unresolved；本地 lease release、取消、超时或进程退出不证明 PG 已结束。
正常 close 允许已准入工作受控收尾，不是“请求 close 的瞬间以后没有任何 commit”。
旧 lease 不授权在 poison 后新建阶段；已获准阶段、close、poison 与 Begin 的精确竞态须可证明。

[当前 freshAdmission](../../internal/api/fresh_admission.go) 仅有 closed/pending 等共享状态，
不能区别正常 close 与 poison 的多阶段准入，也没有 finalizer phase/Begin 线性化门槛。
这是后续实现的明确阻断，不能把已有 acquire/lease 当作本候选全部生命周期已落地。
[militaryGeneration](../../internal/api/military_generation.go) 仅是部分共享组装，不是完整 FreshCity source。
receipt 只解释单命令，不能清空整个 source unknown、证明所有旧事务结束或在线重新开放。
新 source 需新一轮受审启动、完整 provenance、旧 generation 的 server resolution 和持续外部 fence。
若旧事务结束无法证明，就保持关闭，不用新进程/新 generation 名字掩盖未解决的旧写入者。

## 9. retention、物理 realm 与 cutover

slot、全部命令 lineage、规范内容、模板和 receipt 无普通 TTL、reset 或 ID 回收。
城市删除/改属后仍保留成功；拒绝历史也不清空。首版无 legacy adoption、跨账户或 realm 迁移。
备份/restore 必须一致覆盖 ledger、账户绑定、WORLD 城市、钱包、MIL/DOM 及 allocator highwater。
缺 ledger、部分 restore、历史不明、模板遗失或 allocator 回退都 fail closed，不自动补写 receipt/slot。
有 digest、迁移文件或空表不等于完整性；须独立保留可验证的历史与 restore provenance。

首版只允许实际隔离且完整认证的新逻辑 realm；当前没有经本卡认证的目标 realm。
[现有 WORLD schema](../db/002_world.sql) 没有 realm 列；ledger 换一个 namespace 字符串不是物理隔离。
启用前须把稳定 realm 明确映射到实际 cluster/database/schema、shard/actor 身份域、
权威关系、共享 city/queue allocator、账户绑定及 writer authority，并证明映射持续有效。
共享任何存储、坐标、player 或 allocator 权威域时，须整体 fence 不兼容写入者，不能只按 ledger 标签隔离。
完整历史需覆盖该实际边界内已分配/删除/保留身份、wallet 初始化、命令 lineage 及全部恢复来源。

inventory 至少包含 legacy CreateCity、MAX+1、GM/import、直接 SQL、snapshot flusher、
维护/restore/retention、DDL、standalone nextval/setval、旧连接、后台 writer 和 rollback binary。
外部排空与排他必须贯穿最后一个可能活跃事务；表/行锁、profile 校验或本地 drain counter 不替代它。
兼容性、完整锁序和回滚边界必须整体审阅；不将旧 writer 的一个相同锁当作全面兼容证明。
回滚只能关闭新路径或换仍理解 retained ledger 的兼容版本，不能恢复忽略 ledger 的旧 writer。
旧 CreateCity 语义和合法多城保持不变；不能在同一权威边界无 fence 混跑，不能从旧未知请求造新 receipt。
目标采纳、排空、fencing、权限、DDL 与部署均另有门槛，本卡不执行它们，也不部署生产。

## 10. 独立后续契约与实现顺序

现有 ACCOUNT ActorGuard、WORLD/MIL fresh participant 和 admission 只是前置组件。
[DOM snapshotFreshTemplate](../../internal/domestic/fresh_template.go) 不是完整 participant；
基线缺少 DOM PreparedCity 的 gate/LockWallet/Stage/Publish/Close 和完整 APP fixed fresh 链。
依据已采纳 participants 契约，可另立 DOM 与隔离测试组装卡；不得因此开放 live route 或恢复语义。

本规则采纳后仍须依次完成以下独立门槛；每项单域登记、独立 review，不能用 dormant 绕过验证：
1. wire/canonical：新 versioned submit、continue、result、actor discovery；完整字段、presence、
   ID 编码、状态/冲突表示、大小/Unicode/int64/unknown fields 及 Go/TS golden vectors。
2. storage/participant：WORLD ledger DDL、constraints、关系/index/OID/profile inventory、
   缺行 slot CAS、receipt 原子关系、明确事务隔离/锁强度、全局 pins 与 row locks/冲突重读。
   ACCOUNT → slot/command → wallet → CITY/map → MIL/DOM 是待证明的扩展方向，不是已冻结 SQL。
3. private finalizer 与 phase 生命周期：实际全 rollback 证明、白名单分支关联、exact-attempt capability，
   连续 lease、正常 close/poison 区分、phase admission/Begin 线性化、cleanup 和未知 drain。
   完整审阅接收、执行、finalizer、所有共同写入者与 gate 释放；不能靠 check-then-Begin。
4. WORLD ledger/PG companion；必要 ACCOUNT/PLATFORM 按各自新契约实现，不由 APP 越域代写。
5. 完整 DOM participant 和 APP 固定 intake/execution/finalizer/read 协调；共用 exact Binding/controller，
   扩展 source inventory，分别审阅最终组件及 WORLD/MIL/DOM/ACCOUNT 组合。
6. API versioned routes 与 CLIENT 明确提交/继续、canonical winner 展示、读回和 stale-actor 隔离；
   legacy route 独立保留，不默默改协议或借登录触发创建。
7. 完整真实 PG17、浏览器、restart/ACK-loss 验收后，另行核验目标 enrollment、排空/恢复与启用条件。

不在本文冻结 proto 字段号、物理 DDL、Go 方法或权限，不靠一份规则文件声明这些门槛已满足。
这不是拆出缺失状态机来绕过行数；状态、INITIAL、finalizer、retention 与 cutover 语义完整保留于本文。

## 11. 必需真实验收矩阵（本卡未执行）

每项保留精确源码/head/tree、测试命令、实际 PG17 版本、ordinary/race 结果和失败证据。
使用独立连接/进程及隔离测试持有的数据库；跳过数据库测试、unit mock 或同进程重建对象不算通过。
- authority/canonical：跨账户/shard/player、过期/改绑 session、错误 source/Binding/generation，
  非法 UTF-8/NUL/presence/范围/int64，模板升级；同 ID 异内容无写入，原模板不能被换掉。
- durable intake：提交 PENDING 后在执行前杀进程，验证退出再重启；发现原 ID/payload，
  钱包/城市/MIL/DOM 无新增效果；sequence 也不得在 intake 分配。
- ACK-loss：真实接收 COMMIT 确认丢失、真实效果 COMMIT 确认丢失，以及 DB 已成功而 WS 回执丢失；
  区分提交前断线与 DB 已提交后的确认丢失，不用仅抛错误替代，原身份读回且不生成第二城。
- atomicity：在 wallet、WORLD INSERT/readback、MIL marker/四库存、DOM checkpoint/buildings、
  receipt/commit 每个屏障故障；独立观察者看到完整效果+success 或全部业务回滚，允许 sequence gap。
- concurrency：同 ID 同/异内容、两 ID 同 predecessor、不同 actor 同坐标、重复继续；
  原 receipt/钱包/身份及无关账户不变，success 只一次，不从 conflict 推断归属。
- INITIAL：旧包先接收但 ACK 丢失、新包先接收、旧 intake 未提交后 commit/rollback 两种结果，
  旧拒绝后 successor 已接收、无本地状态 EMPTY、两设备同时提案；只有 canonical winner。
  loser 展示真实名称/坐标且须再次明确继续；已保留任何 lineage 都不能重新接受 EMPTY。
- absence：旧事务仍打开时另一连接 lookup miss/EMPTY/PENDING，证明不自动换 ID/坐标，
  continuation 在相同锁边界等待；unknown 不被本地 release、cleanup 或 timeout 清除。
- finalizer：真实全 rollback，竞争 success 先赢、finalizer 先赢、竞争事务未结束、间隙地形变可用，
  crash gap 保留 PENDING；伪造错误/跨 tx proof/日志不能拒绝，ACCOUNT 失效不能终结旧命令。
  覆盖 finalizer Commit ACK-loss 以及竞争者 ACK-loss，不把单 receipt 当 source drain 证据。
- lifecycle：normal close 与 poison 各种 phase/Begin 交错、另一命令 unknown、source drift，
  无 post-poison 新阶段、无 gate 泄漏、无假 drained；确认排空后新受审 source 才可明确继续。
- retention/cutover：删城/转移不重开资格、账户改绑关闭、不完整 restore/缺 ledger/模板遗失关闭，
  实际旧 writer/旧连接/rollback binary 被排除；完整映射与持续 fence 失效立即阻断。
  保留 legacy 多城测试，不用新首次 slot 约束禁止正常多城。
- native browser：真实 cmd/server/PG，1280×720 和 1600×900，注册 → 明确登录 → 明确选名/坐标，
  展示可读 pending/success/rejection；reload、双 tab、清本地状态/另一设备、丢回执、切账户、Back/Close、晚响应。
  最终城市不得 fixture 预建；截图、网络动作与 PG 行/身份/钱包交叉印证，证据不含凭据。
- release：各最终组件和完整组合独立 review，适用 ordinary/race、全部必需 CI 与合并后 main CI 分别记录。

## 12. 采纳边界

本卡只做两份规则文件的完整一致候选；合计 additions+deletions ≤400 自然行，不删安全义务或压长行达标。
若容纳不下必须报告 scope 边界；不能发表缺失保证的中间态，也不声称源码合并就是部署/真实验收。
当前仍未完成 wire、物理存储/锁/proof/phase gate、完整 DOM/APP、API/CLIENT 和目标 realm 认证。
本卡未跑 Go、PG 或浏览器，不能以静态链接/语义检查替代运行时证据；独立最终 review/CI 尚须完成。
遵守 [AGENTS](../../AGENTS.md) 和 [接手约定](../../docs/SUCCESSOR-POLICY-2026-10-26.md)。
历史 reference/art/VERIFY hold（含 #77/#82/#108）、Recruit #2377 及依赖 hold 不变。
不重试 #2426 被拒合并、不搬入其未合内容；注册/登录及其他修复也不是本卡启用许可。

[task]: https://github.com/anitaguptaoffice/sanguo-slg/issues/2378
[plan]: https://github.com/anitaguptaoffice/sanguo-slg/issues/2378#issuecomment-6768841902
