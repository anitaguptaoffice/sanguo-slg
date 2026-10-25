# ONBOARDING-001：DATA-002 有界首招与权威主教程

状态：编排者选择后待独立评审的契约；未发布、未实现。
范围：初始书2004×1，main chain100（1001–1005），君主最低等级1–5。
不得宣称完整DATA-002已通关：1007要求等级6，1008要求8，均未被本规则解决。
现有quest奖励、任务ID/前置/目标/解锁等级、物品、SKU保持不变；不涉及IAP、DATA-003。
历史参考及美术hold PR不合并。各实施卡仅修改所属域，≤400行；本契约先独立评审。

## 1. 初始招募书：新增有限福利

这是额外+1本初始书政策，不是奖励总量不变；1001/1002既有奖励完整保留。
资格：认证server/player在**一个数据库一致快照**中没有所属英雄、没有正数2004库存。
查询必须覆盖所有英雄status；不接受客户端声称数量；不得以两个独立查询的时间差拼出资格。
一次SQL语句的NOT EXISTS英雄、NOT EXISTS正库存满足快照要求；仅针对认证角色。
无需且不声称证明该玩家“历史从未招募”；已有hero/book时不发，不消耗未来资格。
后续首次满足资格仍可获赠，包括旧号；这是补救政策的明确结果。

以既有atomic content.Grant发固定奖包2004×1，固定键：
`onboarding:starter-scroll:v1:<player_id>`，server_id由Grant命名空间提供。
不得使用session、时间、随机键；功能回滚/重试/恢复不得更换v1或奖包。
成功发过的角色永不因书耗尽、英雄消失、重启、重复登录再获得此奖。
资格快照后并发获得hero/book仍允许这次获赠；**不保证提交时仍无hero/book**。
并发登录可均满足资格，但同角色最多一次成功赠送；不同服角色分别计算。
不能用本政策额外赠书来掩盖其他招募扣书/英雄保存失败导致的资产损失。

### 1.1 发布前强制条件

item-only/空资源/零资源delta的Grant不得推进player_wallet.updated_at。
当前Grant即使只给书也UPDATE钱包时间，可能丢失自然离线产出时间段；须独立content修复卡先验证。
该修复只防止本次零资源奖包触碰生产时钟，不代表全局共享checkpoint问题已修好。
奖包、钱包、成功流水仍使用原有事务/幂等保障，不在API复制发奖SQL。

### 1.2 错误、重试与提示

满包、StackLimit、DB暂时错误不得将starter记成功，亦不得永久阻断正常登录。
整笔失败回滚；不强塞、不删其他道具、不转换金币、不引入邮件/新RPC。
普通登录及既定背包/教程查询刷新可重试资格和固定Grant；未成功就不能显示“已到账”。
若grant成功但回复丢失，固定键重试不得再赠；流水匹配失败必须报诊断，不能换键。
重新符合资格与实际赠书仍受固定成功键限制，内存pending不是权威记录。
回滚仅停新赠送；保留库存和流水，不追扣已使用的书。

失败提示可置于成功ServerPacket.msg，不改变code=0及正常查询payload。
只显示安全、简短用户文案（例如“初始招募书暂未到账，请整理背包后刷新重试”）；不泄露SQL/内部错误。
msg纯展示，不据其内容授予资格、改变权限、造库存、判断grant成功或改变重试策略。
当前GatewayClient仅错误时读取msg，成功时丢弃；因此必须配套客户端成功提示通道：
仅普通背包/教程刷新消费成功msg，以textContent/等价转义文本显示，不用innerHTML。
请求须绑定发起时server/player/session-generation，切号后的迟到提示丢弃；提示长度有界。
登录可不弹窗打断；正常刷新再显现提示。没有msg不能推定成功，成功以真实背包为准。
客户端现有刷新机制重试，不新增自动高频轮询、不新增RPC、不把提示文字作为机器协议。
旧客户端忽略msg仍能登录，但不能据此声称旧客户端已具备可见错误反馈。

## 2. 权威主教程与持久证明

仅chain100 ID1001–1005：服务器读取认证玩家所属城市已持久完成建筑、所属英雄。
1001/1003/1004/1005：指定building_cfg_id达到目标level则绝对count=1；排队中不算。
1002：存在至少一名持久所属英雄可满足首名武将目标（任意status）。
此兼容语义是“已获得首名武将”，不是证明一定来自RecruitHero；不外推1011累计两次招募。
成功动作后、接取后、普通任务/链查询及领奖前触发reconcile，弥补动作先于接取和事件丢失。
不自动接取/领奖；事件仅作核验信号，不使用客户端计数。
新发奖必须已有accepted任务行，且固定chain/ID、前置completed、unlock等级全部合法；
不存在/unaccepted行不得经reconcile变claimable。第3节精确成功receipt恢复是独立路径，不伪造新资格。

### 2.1 证明持久化且不可退步

利用既有player_quest.progress JSON，新增可选字段 `server_verified_version: 1`。
v1明确绑定本契约chain100既定目标；旧JSON字段缺失/0无证明，未知版本不能当v1接受。
只有服务端权威reconcile核实目标成立后可写该字段，公共Report不得写入/伪造。
v1证明、count=1及claimable必须同一任务行原子保存，然后才允许发奖。
证明已落地后，英雄离开/建筑变化/重启不撤销达成事实，不把claimable退回in_progress。
已completed始终保留，不重发、不降低等级；旧completed来源不明不追溯撤销。
旧claimable没有证明时，领奖前必须重新核验，或走第3节已成功奖励receipt恢复。
未满足时保持“未核验不可领”的业务结果，不能把其旧count当作真证据。

现有Store.UpsertPlayerQuest无条件覆盖整行，会被迟到写回退状态/丢证明；必须补单调更新保障。
以下单调规则仅限chain100固定教程ID；daily既有UTC重置/周期清零必须保留。
同一角色教程的Accept/reconcile/Claim并发需CAS/行锁/单调合并，不依赖单进程mutex。
proof1不可被旧JSON覆盖；completed不可被旧claimable覆盖；完成时间/领取时间不得被空值清除。
JSON反序列化错误/未知proof版本必须显式处理，不能忽略解析错误后默认为可信完成。
旧版本进程会忽略/覆写新JSON字段：发布必须排空旧写实例后切换，禁止新旧任务写服务混跑。
回滚仍须保留proof-aware且有权威门禁的writer；做不到则关闭任务写入口。不得回滚至旧任意Report写服务。

在API公共RPC边界拒绝不可信ReportQuestProgress，不得修改内部trusted daily方法使其失效。
公共ReportQuestProgress不得根据absolute/value/event_type推进server权威目标。
允许拒绝或只触发server reconcile；不得因兼容客户端而继续接受任意count。
未建立明确客户端自报allowlist的其他目标默认不得由公共任意count获得奖励；内部daily可信事件保留。
整数极值/负值、伪装event_type、他服他城、重放均不得跳过条件。

## 3. 发奖故障窗口及receipt接口

现有RewardGranter仅GrantQuestReward；没有只读receipt查询。必须增加独立只读port。
现有content.Store.FindSuccessfulGrant仅grantID/bool，缺owner/reward校验，不能直接充当安全receipt。
建议域接口语义：按server/player/quest固定claim键和预期canonical奖包检查成功receipt；
返回匹配成功/不存在/明确错误，附真实grantID及原奖包；查询不得创建/修改/重试grant。
匹配必须同时核对认证server/player、该教程固定claim键、status=success及精确canonical奖励内容。
不得以通用source_type或任意同主人的其他grant充当receipt；客户端不得提交receipt owner/key/payload。
比较应与现有Grant JSON语义一致（包含empty resources处理），不能以显示文案变化制造不匹配。
错owner、错包、非success、DB错误不可当作成功；显式诊断，不换键不发替代包。
API/quest只消费content提供的port，禁止在quest域直接跨域写reward表。

领奖恢复顺序：
1. completed：保留，执行等级恢复，返回既定AlreadyCompleted语义；不发奖。
   此错误响应没有新level成功字段；客户端用权威PlayerProfile刷新或重登恢复等级，不凭错误文字猜等级。
2. 非completed但有匹配成功receipt：恢复completed及领取记录，再派生等级；不再次调用新奖包发奖。
3. 无receipt：必须有持久proof1或先核验并持久proof1，才可调用固定key Grant。
4. Grant成功但任务状态写失败：下次通过receipt恢复；不能要求已消失的英雄/建筑重新出现。
5. 任务完成但等级写失败：下次读取/登录/重复Claim派生补齐等级，无需重新领原奖励。
receipt不得作为“过去真实动作已发生”的证据，而是已发奖状态一致性恢复依据；不追扣既成资产。
新的public进度与Claim仍须权威门禁，不能主动创造receipt来绕过动作。

## 4. 君主有限等级规则与回复

player现有level默认1，无player exp；hero经验规则不适用于君主。
新增规则：1001→1005连续前置全部completed的最大sort n，使level至少max(1,n)，本规则上限5。
仅显式ID/chain100映射，不能因未来任意sort999配置升到999。
持久写 `GREATEST(existing_level, milestone)`；已高等级不降，claimable不能提前升级。
1001完成后1、1002后2、1003后3、1004后4、1005后5，对应下一节点unlock1/2/3/4。
1006 unlock5仅等级条件可满足；1007 unlock6及1008 unlock8仍无本合同自然成长路径。
孤立1005 completed但前置缺失不能直接MAX升5；旧合法连续完成状态可补齐等级。
等级派生可持久重试；不要用内存一次事件保证完成。读取故障不可假装成功level1。

ClaimQuestRewardResponse新增普通 `int32 player_level = 4`。
正数仅表示本次回复时已持久的真实等级，0=未知/旧服兼容，不是level0，不代表重置。
两份当前quest.proto的1/2/3字段均为quest/chain/rewards；不得重排、覆盖另一份文件。
客户端只在同actor及session-generation回复、且值>0时单调更新max(current,received)；
切号迟到回复丢弃，不能用上个角色高等级污染新角色。重登以当前角色PlayerProfile初始化。
非成功/等级写失败不得返回假正数；API返回恢复错误后由权威Profile刷新/重登恢复，不重复发奖。
Claim成功/receipt恢复/重放均不得把granted_rewards再次加到H5本地资产；
以actor/session-guarded权威背包与钱包刷新替换，不能以“重复响应”构造额外奖励。
删除旧教程UI的Report absolute=2按钮；自然流程不得依赖该调试入口。
该字段不等于单次里程碑n，不可将已有20级回复成5级。

## 5. 必须验收的状态和结果

| 场景 | 必须结果 |
|---|---|
| 新号无hero/book | 真实钱包默认值，最多额外书1；level1；1001原奖励不变 |
| 旧1001已领、1002未领且无hero/book | starter可发1；原2001不追扣；1002原book仍给 |
| 有hero或book | 此次不发；当前hero可用于1002补判，原前置不绕过 |
| starter已成功后书耗尽/hero消失 | 不再发starter |
| 满包/stack上限/临时DB失败 | 无成功流水/部分资产，登录正常，普通刷新可重试并有安全提示 |
| 双登录同角色 | 最多一本；相同固定成功键 |
| 资格快照后并发入hero/book | 允许额外一本，但不得突破固定一次上限；stack限制仍有效 |
| starter回复丢失/进程重启 | 同键恢复，不新增；item-only钱包时间不变化 |
| 新proof完成后hero消失 | proof持久，不回退、不阻塞合法领奖 |
| 旧claimable且无proof/receipt | 重新核验；未满足不能领奖 |
| 原reward已成功、状态未完成 | 只读匹配receipt恢复，不双发、不因当前状态变化卡死 |
| 已completed、等级写失败 | 下一次派生补齐；等级20保持20 |
| 并发reconcile/Claim/旧快照写入 | proof/state单调，completed及领取时间不丢失 |
| 切号迟到等级/提示回复 | 丢弃，不污染当前角色 |
| 伪造Report参数或receipt错owner/包 | 无新增领取权/发奖，错误可诊断 |

自然验收：真实注册登录→接1001→支付官府升级并等完成→正常领奖→接1002→正式招募
→正常领1002得原书并升2→自然农田3/伐木2/兵营2对应领奖升3/4/5。
无GM、SQL写库存/等级/进度、伪造Report或改时间；只读SQL核对SHA、流水、状态允许。
再跑先动作后接任务补判、重登/重启、旧矩阵、故障注入及并发负例；故障fixture与自然证据分开。
冻结旧协议schema编译独立descriptor，并用旧descriptor解码新增字段的新二进制回复；
验证旧1/2/3字段不变、新4可忽略、旧回复新解码level=0，以及旧positive scalar不回退。
该wire兼容不意味着旧任务writer兼容proof；另测旧writer会丢未知JSON字段，发布门禁必须阻止它。
招募扣费/英雄保存原子性有独立风险，必须另外验证，不能用重复starter掩盖。

## 6. 单域实现卡及依赖

- CONTENT-ZERO-DELTA：仅零资源Grant保留wallet.updated_at，真实PG验证；starter发布前置。
- CONTENT-RECEIPT：只读完整匹配receipt接口与测试，不跨域修改quest。
- QUEST-PROOF：progress字段/单调写/receipt消费/恢复；过400行拆存储及服务两卡。
- QUEST-RECONCILE：权威provider及chain100连续里程碑纯逻辑，不读其他域私有实现。
- API-STARTER：快照资格、固定Grant、非阻断错误与普通查询retry；仅API域。
- API-TUTORIAL：provider接线/等级持久化/公共Report门禁；过400行拆安全与接线。
- API-WIRE：仅同步已审canonical协议及生成物，普通int32字段4，不混业务。
- CLIENT-NOTICE、CLIENT-LEVEL：成功提示转义与actor guard；等级>0单调应用，分别域内测试。
- INTG-ONBOARD：自然链100、旧状态、fault及race验收，明确仍未解决后续等级链。

实施前独立评审本契约；本文件不视为生产验收结果或对外发布证明。
