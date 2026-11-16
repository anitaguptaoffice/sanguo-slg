# sanguo-slg 换平台交接（2026-11-12）
任务：[ORCH-PLATFORM-HANDOVER-20261112 / #2530](https://github.com/anitaguptaoffice/sanguo-slg/issues/2530)
本次交接暂停新增开发、合并和下一轮原生验收激活，保留代码、失败记录与现有分支。本文是状态快照，不是全部功能完成或部署证明。

## 1. 先读与总体结论
- 仓库：https://github.com/anitaguptaoffice/sanguo-slg
- 已核实 main：`80f147b6c1be4e1c47fc4c1e9ab2d23379ac4e7e`；tree：`5315e635a5252e1040f64823d803d7c54dff54b1`。
- 该主线及上一产品合并 `a5f67daa8cd2b83eb3436fcfbbb758a85a394caa` 各通过14个push工作流、18个job、226个返回步骤；[闭环记录](https://github.com/anitaguptaoffice/sanguo-slg/pull/2522#issuecomment-6816103263)。
- 项目仍是内测原型，未部署生产，未达到整游戏真实服务端/数据库/浏览器全链路验收。不要给未经证实的总百分比或完工日期。
- 先读 [AGENTS.md](../AGENTS.md)、[接手约定](SUCCESSOR-POLICY-2026-10-26.md)、[原交接](HANDOVER-2026-10-26.md)、[ROADMAP](ROADMAP.md)、[client README](../client/README.md)、[参考边界](reference.md)。
- 旧 wave:59 结束的是旧编排，不是后续研发禁止令。按当前 AGENTS 的限定手工任务入口继续，一卡一PR、单域、≤400行。不要恢复旧bot或全量重放tasks-sync。
- 历史 reference / art / VERIFY hold，以及各PR明确的 NEVER MERGE 继续保留；#77/#82/#108 不合。不得换分支搬入以规避。新修复仍须独立审阅、适用测试、最终head CI及合后主线检查。
- `spec/` 契约独立PR；不直接推main、不强推、不改权限、不部署。不把本交接当成新平台的外部账户/权限授权。

## 2. 产品方向与美术约定
- 三国网页SLG，目标先完整可玩再扩展；电脑横屏，Vite + 自研Canvas，Q版原创美术。
- 资源固定命名、尺寸、1×/2×、PNG/WEBP、图集/九宫格；发布目录 `client/public/assets/art/v1/`，URL `/assets/art/v1/`。
- 参考资源只读，用于尺寸/配色/UI密度，不复制原版代码、文件名、版权文案或美术进入产品。
- 美术对接以 #108 为留言板，但它本身保持hold。样件PASS、模拟后端浏览器PASS、素材入库、真实后端集成、部署是不同层级。
- 高清主城背景、按钮四态和批量资源规格要查对应当前合同与文件；历史2×放大占位不能当原生高清验收。四兵种候选 #1969、地形概念 #2088 尚非完整生产接入。

## 3. 已合入的主要成果
| 范围 | 已交付 | 验收边界/入口 |
|---|---|---|
| 首城客户端基础 | #2488 意图编码、#2490 请求编解码、#2494 响应解析、#2501 Gateway收发 | 不等于实际V2首城建城已接通 |
| 道具生产 | #2479 合同、#2480 49种/98张原创PNG、#2485 背包兼容 | 不等于历史 #1973 背包挂载hold解除 |
| 日常奖励图标 | #2497 合同、#2499 实现、#2502 QA | 27截图/6尺寸DPR/3降级；受控服务；[记录](https://github.com/anitaguptaoffice/sanguo-slg/pull/2499#issuecomment-6805959532) |
| 队列加速道具图标 | #2510 合同、#2512 产品 | main `93618e18` 合后14工作流/18job通过；旧 #2513 留作失败/历史证据 |
| 队列DOM稳定性 | #2519 产品、#2522 QA | 自然刷新保留行/按钮/图标/焦点，更新倒计时与库存；15case、39截图、126裁切观察、48生命周期、12轮询区间、6物理DPR预检；受控transport |
| 商店→背包结算显示 | #2474 产品 `0b7ffdfd`，#2515 QA `b98b24b6` | 16case/32截图；两次合后14工作流通过；[记录](https://github.com/anitaguptaoffice/sanguo-slg/pull/2515#issuecomment-6814277487) |
| 出征/恢复列表定位 | #2478 产品 `d3519566`，#2517 QA `ddc80aab` | 修正恢复后目标行被裁切，30修复case+6基线，3908测试/build，合后14工作流通过；受控组件集成 |
| 其他较早交付 | 已有账号登录 #2419、WORLD持久化 #2176/#2177/#2185/#2189、聊天Unicode #2285、公会在线态 #2294/#2305 | 查各PR最终记录，不把对应NEVER MERGE诊断PR当产品；不扩展为全游戏完成 |

## 4. 首城：当前源码与下一步
- #2505 `d9556557e8a5340b32f95dd1bc603d9caf40c3b7`：完整意图持久化/发出前写入读回，Draft未合；14适用工作流成功，Tasks sync条件跳过。先前artifact上传失败经仅失败job重跑已通过，旧失败保留。
- #2506 `820799fea6d3ff7ffb19b2b808c81b32befa9283`：修正浅克隆来源的原生存储QA，Draft未合。16工作流仍queued；[native run 43095620263](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/43095620263) 零job。没有确证的调度原因，不拿旧25case报告替代新来源验收。
- #2529 `574c31d9615e7093a2bc67759a3c87abd718fde1`：单调状态恢复/冲突识别reducer，Draft未合；两个独审问题已修，源码独审和14适用CI成功。
- #2529 + 当前main的临时组合 `8e502e7` / tree `dde359b0`：负责人报告Node22.23.4下592文件/3959测试+build通过；完整组合审计未结束。两个账户browser工作流测试的是PR head，不是这个组合。临时commit不是远端可恢复发布保证。
- 完整V2首城仍缺：实际UI接线、服务端入口、账本/仲裁、事务协调、原子落库、断线与重启恢复、真实PG+浏览器全流程。旧注册流程能创建city，不等于新V2首城合同已完成。
- DOM PreparedCity 生命周期只是下一步计划，尚无已交付代码；先核对现有DOM/物理账本契约和领域所有权，再注册单域任务。不要重复实现已有codec/Gateway。
- 不继续尝试曾被拒绝的无关操作；排队修复与合同缺口分别处理。最终合并前重新核对main/head与组合有效性。

## 5. 收件箱键盘：完整可恢复实验栈
原产品 #2310 `c32329193e2eaa1b62a2668a35359237175ef22f` 保持原Draft/HOLD，未改其ref。下面全部为独立 **NEVER MERGE** 验证分支，不是可合入产品。
| PR | 用途 | 不可变head |
|---|---|---|
| #2523 | 状态/SQL/economy oracle | `d7ed354c33c4e85b0fd1576ffc43d25544302f1c` |
| #2524 | 认证protobuf trace与并发读一致性 | `a13dbfdd8b194815adeda03ac38259e602808b02` |
| #2525 | 原生runtime/诊断/生命周期 | `1114ce8d295ed89bbf1f1beb782e3eaccdad297b` |
| #2527 | main ddc80aa + 原产品patch的隔离组合 | `541de838056b0fbb1f3c2369a038fb7c49086590` |
| #2528 | 四格baseline/fixed ×1280/1600 scenario | `cd0e88a314c26d3dafb33ac19e70df51b7c056c1` |
- 2026-11-12交接读数：上述最新支持组件各12适用工作流成功，组合14适用工作流成功；scenario native本次条件跳过。最新修正尚未激活原生矩阵，#2528标签为空。
- 验证基线是 `ddc80aab02c6124c7a747ad694f7b2b70163c263`，不是当前main；恢复后先完成旧冻结组合矩阵及独审，再做当前main复验。
- 已修的验收脚本问题：runner缺redis-cli（显式安装官方distro redis-tools）；Playwright默认headless-shell与full Chromium来源断言不符（显式选择完整Chromium，保留sandbox）；诊断吞掉异常；psql14单个 `-c 'BEGIN; SELECT; COMMIT'` 只返回最后命令结果。
- 最新runtime用同一psql进程的三个 `-c` 参数保留repeatable-read只读事务和严格JSON解析；独立review、174纯测试实例及helper测试通过，runtime恰400行。测试实例含导入重复，不宣称174个不同控制。
- 五次原生失败都保留：43163747675 generic preflight；43169971797 redis-cli ENOENT；43172429186 browser来源；43175792698 natural startup；43179202819 snapshot JSON。没有真实键盘验收PASS。
- 下一步按 #2528 的显式label gate，在最终heads CI/组合复核通过后由接手方启动；审阅真实键盘/checkbox分离、焦点、可见区域、SQL状态、trace及cleanup。不得把普通CI、登录成功或城市画面当成邮件键盘通过。
- 20个失败cell ZIP、metadata和内部hash已有核验；远端Actions artifacts有保留期限，接手后及时下载。失败不因后续修正改写为PASS。
- [完整暂停交接](https://github.com/anitaguptaoffice/sanguo-slg/pull/2528#issuecomment-6818564533)；[最终CI收口](https://github.com/anitaguptaoffice/sanguo-slg/pull/2528#issuecomment-6818591413)；[修正记录](https://github.com/anitaguptaoffice/sanguo-slg/pull/2528#issuecomment-6818372531)。旧509行verifier不可用，现为四个真正语义组件，保留≤400与no-orphan/完整组合审阅要求。

## 6. 其他关键未完成项
- 军事：#2470 dormant recruit completion修复仍blocked，未证明真实PG与完整招募→出征→战斗→返回入账→重启恢复闭环；旧本地 `4a47f546` 不是可依赖的远端交付。检查issue与下面API/军事实验PR，不批量合并。
- 英雄训练恢复 #2267 与布局 #2278 尚未完成当前main原生验收。旧full layout为2/4通过，失败涉及1600手动募兵展开丢失、1280重入Tab不能到达；保留失败。#2322/#2328局部PASS不替代完整布局。
- 美术：#1973挂载、#2483全host候选QA、#1969兵种候选、#2088地形概念等未全部完成。资源入库不等于所有界面挂载、图集裁切管线、原生2×质量和全界面验收。
- 各历史任务的scope不同，不因某模块完成自动关闭其他hold。后续优先：可玩的完整首城；军事持久化闭环；已有美术正式界面接入；真实服务端全流程，再扩展内容。

## 7. 本地未提交工作与恢复核验
已检查当前可用项目工作区，不删除或覆盖任何文件。旧目录中的dirty状态多数是远端已发布内容，不需要重复发布或合并。
- 背包旧工作区：3 tracked修改+1新测试，逐blob与 #1973 的4个文件完全一致，可从 `ed32cae751646723ac242849f16a9acb034c8eb4` 恢复。
- arrival-resolver：6个staged文件逐blob与 #1980 完全一致，可从 `d4beda0ce87881bc1c26ae8a4929e1c4a2f678e3` 恢复，HOLD不变。
- arrival-pg：2个staged文件逐blob与 #1983 完全一致，可从 `3cd900f628bb0dd23b5fd84338145637ca55f0ab` 恢复，HOLD不变。
- mail-keyboard-restored：15个未追踪QA文件已逐blob对比GitHub发布head，无独有未发布源码；按上面5个QA分支及workflow固定pin恢复，不把多个组件混入main。
- terrain旧工作区clean；对应远端 #2088 是概念候选，不是生产资产批准。
- 部分早期临时工作区/日志在环境更换后不可用。本交接不声称恢复了所有历史本地文件；以远端commit、PR评论和Actions artifacts为持久来源。无法核实的本地旧commit保持“未恢复/未发布”，不能冒充已推送。

## 8. 新平台快速接手
```bash
git clone https://github.com/anitaguptaoffice/sanguo-slg.git
cd sanguo-slg
git fetch origin
git switch --detach 80f147b6c1be4e1c47fc4c1e9ab2d23379ac4e7e
# 阅读 AGENTS.md 与本交接，再按指定PR分支建立独立worktree。
cd client
npm ci
npm test
npm run build
```
- 先确认main是否已变，不在旧dirty目录直接reset/clean。指定PR用 `git fetch origin refs/pull/<N>/head:refs/remotes/origin/pr-<N>` 恢复，再核对完整SHA。
- 后端/PG版本、环境变量与启动步骤读对应README及当前workflow；不要猜造连接信息，不从旧日志复制凭据。
- 本地sandbox Chromium曾在创建页面前因socket EPERM退出；没有禁用sandbox。官方Actions可完成相应原生执行。环境失败、产品失败、fixture局限分开记录。
- 查询合后CI时用Actions按head_sha检索push run；某些工具仅返回PR-triggered runs，会错误显示“无run”。查询为空先核对事件/页码，不造新commit触发。
- 下一平台无需重复画49张已有图、不重复做已合入Shop/出征/queue修复。首先读未完成卡及最后评论，再决定实现。
- 仅在确切源码、依赖组合、适用单测/集成/原生验收、独审和CI都满足后合并普通新修复；本交接与文档PR不放行任何hold。

## 9. 开放PR全量清单
下表是创建本交接PR之前API返回的99个开放PR（分页2为空），不是合并建议。状态随时间变化，实际接手须重读；标题中的HOLD/NEVER MERGE尤其保留。
| PR | 标题 | 分支 | head SHA | 状态 |
|---|---|---|---|---|
| [#2528](https://github.com/anitaguptaoffice/sanguo-slg/pull/2528) | CI-MAIL-KEYBOARD-ACCEPTANCE-001 Verify real keyboard matrix [NEVER MERGE] | `test/CI-MAIL-KEYBOARD-ACCEPTANCE-001` | `cd0e88a314c26d3dafb33ac19e70df51b7c056c1` | Draft |
| [#2525](https://github.com/anitaguptaoffice/sanguo-slg/pull/2525) | CI-MAIL-KEYBOARD-RUNTIME-001 Validate mailbox keyboard evidence [NEVER MERGE] | `test/CI-MAIL-KEYBOARD-RUNTIME-001` | `1114ce8d295ed89bbf1f1beb782e3eaccdad297b` | Draft |
| [#2529](https://github.com/anitaguptaoffice/sanguo-slg/pull/2529) | CLIENT-FIRST-CITY-KNOWLEDGE-001 Preserve monotonic first-city knowledge | `feat/CLIENT-FIRST-CITY-KNOWLEDGE-001` | `574c31d9615e7093a2bc67759a3c87abd718fde1` | Draft |
| [#2527](https://github.com/anitaguptaoffice/sanguo-slg/pull/2527) | QA-MAIL-KEYBOARD-COMPOSITION-001 Test isolated keyboard composition [NEVER MERGE] | `test/QA-MAIL-KEYBOARD-COMPOSITION-001` | `541de838056b0fbb1f3c2369a038fb7c49086590` | Draft |
| [#2524](https://github.com/anitaguptaoffice/sanguo-slg/pull/2524) | CI-MAIL-EVIDENCE-CONTRACT-001 Validate mailbox keyboard evidence [NEVER MERGE] | `test/CI-MAIL-EVIDENCE-CONTRACT-001` | `a13dbfdd8b194815adeda03ac38259e602808b02` | Draft |
| [#2523](https://github.com/anitaguptaoffice/sanguo-slg/pull/2523) | CI-MAIL-STATE-ORACLE-001 Validate mailbox keyboard evidence [NEVER MERGE] | `test/CI-MAIL-STATE-ORACLE-001` | `d7ed354c33c4e85b0fd1576ffc43d25544302f1c` | Draft |
| [#2513](https://github.com/anitaguptaoffice/sanguo-slg/pull/2513) | QA-QUEUE-SPEEDUP-ICON-001 验收队列加速符真实前端展示 | `test/QA-QUEUE-SPEEDUP-ICON-001` | `1dcd1214f9ff51890c9575339cf94b0b218e4b74` | Draft |
| [#2505](https://github.com/anitaguptaoffice/sanguo-slg/pull/2505) | CLIENT-FIRST-CITY-JOURNAL-001 Persist complete first-city intent before sending | `feat/CLIENT-FIRST-CITY-JOURNAL-001` | `d9556557e8a5340b32f95dd1bc603d9caf40c3b7` | Draft |
| [#2506](https://github.com/anitaguptaoffice/sanguo-slg/pull/2506) | QA-FIRST-CITY-STORAGE-001 Verify native intent persistence and recovery | `test/QA-FIRST-CITY-STORAGE-001` | `820799fea6d3ff7ffb19b2b808c81b32befa9283` | Draft |
| [#2483](https://github.com/anitaguptaoffice/sanguo-slg/pull/2483) | QA-ITEM-FULL-HOST-001 验证完整主城与原创道具纹理 | `test/QA-ITEM-FULL-HOST-001` | `3dabccfc2a900c2059b85e4f79b5fdf00dce54ac` | Draft |
| [#2426](https://github.com/anitaguptaoffice/sanguo-slg/pull/2426) | API-MIL-SHARED-PG-001 Verify the combined source lifetime in PostgreSQL | `feat/API-MIL-SHARED-PG-001` | `50f5634ff00153adf280c261a0db19c034d6cd2a` | Open |
| [#2403](https://github.com/anitaguptaoffice/sanguo-slg/pull/2403) | API-RETURN-FIRST-OVERFLOW-PG-001 Verify overflow rollback unblocks paid completion | `fix/API-RETURN-FIRST-OVERFLOW-PG-001` | `3e414838b0c4f88dd404f3aa68a903e2fe97c462` | Draft |
| [#2401](https://github.com/anitaguptaoffice/sanguo-slg/pull/2401) | API-RECRUIT-COMPLETE-FIRST-PG-001 Verify completion-leading Return capacity | `fix/API-RECRUIT-COMPLETE-FIRST-PG-001` | `1a7d1ed2934bd957500129027b5759e124f2ca15` | Draft |
| [#2377](https://github.com/anitaguptaoffice/sanguo-slg/pull/2377) | contract: SPEC-RECRUIT-CLIENT-JOURNAL-001 specify dormant browser journal | `feat/SPEC-RECRUIT-CLIENT-JOURNAL-001` | `3f135778f5ed6720a5a9a9ab6fa014cba366e0a2` | Draft |
| [#2362](https://github.com/anitaguptaoffice/sanguo-slg/pull/2362) | CI-ACCOUNT-IDENTITY-CODEGEN-001 canonical artifact diagnostic NEVER MERGE | `feat/CI-ACCOUNT-IDENTITY-CODEGEN-001` | `556aa64e4244348b09abfaa43e819b48e13ff99b` | Draft |
| [#2343](https://github.com/anitaguptaoffice/sanguo-slg/pull/2343) | CI-RECRUIT-CODEGEN-DIAGNOSTIC-001 measure generated binding feasibility [NEVER MERGE] | `fix/CI-RECRUIT-CODEGEN-DIAGNOSTIC-001` | `006cd0d5d5e8f5e2a157711d9c33ad03f4bc3fc2` | Draft |
| [#2278](https://github.com/anitaguptaoffice/sanguo-slg/pull/2278) | CI-HERO-LAYOUT-LIVE-001 Verify default roster access [NEVER MERGE] | `verify/CI-HERO-LAYOUT-LIVE-001` | `ce4550abb496f0a36647e7501c9a9d0f2656a2ad` | Draft |
| [#2322](https://github.com/anitaguptaoffice/sanguo-slg/pull/2322) | CI-HERO-RADIO-LIVE-001 Verify native radio boundaries [NEVER MERGE] | `verify/CI-HERO-RADIO-LIVE-001` | `2f624d7feda30d156ce18e49f4d30740cb1b316a` | Draft |
| [#2333](https://github.com/anitaguptaoffice/sanguo-slg/pull/2333) | CI-HERO-RADIO-COLLECTOR-001 Capture complete boundary facts [NEVER MERGE] | `verify/CI-HERO-RADIO-COLLECTOR-001` | `3d62c3d100108b3f2430164ed7b140e4e6330011` | Draft |
| [#2334](https://github.com/anitaguptaoffice/sanguo-slg/pull/2334) | CI-HERO-RADIO-REPLAY-001 Validate complete boundary evidence [NEVER MERGE] | `verify/CI-HERO-RADIO-REPLAY-001` | `df9a0968a7d98cffbf2e78d3712b5e99f4c34f2e` | Draft |
| [#2328](https://github.com/anitaguptaoffice/sanguo-slg/pull/2328) | CI-HERO-REFRESH-LIVE-001 Verify natural detail refresh identity [NEVER MERGE] | `verify/CI-HERO-REFRESH-LIVE-001` | `2a56350a46f9fe5e81522b46d5e8ed4107d932cd` | Draft |
| [#2327](https://github.com/anitaguptaoffice/sanguo-slg/pull/2327) | CI-HERO-REFRESH-ASSERTIONS-001 Validate raw refresh evidence [NEVER MERGE] | `verify/CI-HERO-REFRESH-ASSERTIONS-001` | `ce968619a57f2678de670863febaaf93bce4de89` | Draft |
| [#2330](https://github.com/anitaguptaoffice/sanguo-slg/pull/2330) | CLIENT-HERO-REFRESH-SCROLL-001 Preserve viewport during stable hero refresh | `fix/CLIENT-HERO-REFRESH-SCROLL-001` | `108130059fa33bc7cabbfd8cd0caed90d587c721` | Draft |
| [#2321](https://github.com/anitaguptaoffice/sanguo-slg/pull/2321) | CI-HERO-RADIO-OBSERVER-001 Observe radio boundary events [NEVER MERGE] | `verify/CI-HERO-RADIO-OBSERVER-001` | `c1a06166bc5ce04b0b20538f31a3a89473353478` | Draft |
| [#2324](https://github.com/anitaguptaoffice/sanguo-slg/pull/2324) | CLIENT-HERO-DETAIL-REFRESH-001 Preserve hero detail identity during city refresh | `fix/CLIENT-HERO-DETAIL-REFRESH-001` | `2d1be8ee841e305cfd0f364dfe224b086c67932d` | Draft |
| [#2320](https://github.com/anitaguptaoffice/sanguo-slg/pull/2320) | CLIENT-CENTER-RADIO-TRAP-001 Keep native radio Tab inside center panels | `fix/CLIENT-CENTER-RADIO-TRAP-001` | `c749d2b228bcfe7d359f79fcf5d69a151c0d39c0` | Draft |
| [#2315](https://github.com/anitaguptaoffice/sanguo-slg/pull/2315) | CI-HERO-FOCUS-PROBE-001 Reconstruct retained focus observer (NEVER MERGE) | `feat/CI-HERO-FOCUS-PROBE-001` | `de8db9f44c60762ec58cec750a6b0b6a2fb815c0` | Draft |
| [#2316](https://github.com/anitaguptaoffice/sanguo-slg/pull/2316) | CI-HERO-POLL-FOCUS-001 Reconstruct natural poll focus gate (NEVER MERGE) | `feat/CI-HERO-POLL-FOCUS-001-rebuilt` | `6509fee7d65c66c37e0bec81f8778e530c77f16b` | Draft |
| [#2310](https://github.com/anitaguptaoffice/sanguo-slg/pull/2310) | CLIENT-MAIL-KEYBOARD-001 Open inbox messages with native controls [HOLD native] | `fix/CLIENT-MAIL-KEYBOARD-001` | `c32329193e2eaa1b62a2668a35359237175ef22f` | Draft |
| [#2301](https://github.com/anitaguptaoffice/sanguo-slg/pull/2301) | CI-GUILD-PRESENCE-ACCEPTANCE-001 Verify native unknown guild presence [NEVER MERGE] | `fix/CI-GUILD-PRESENCE-ACCEPTANCE-001` | `f156732c1c9ea643845bacf28e47ce8d62f0ef70` | Draft |
| [#2304](https://github.com/anitaguptaoffice/sanguo-slg/pull/2304) | CI-CHAT-CONTROLLED-SCENARIO-001: validate every controlled readback [NEVER MERGE] | `fix/ci-chat-controlled-scenario-001` | `5100ca17508e5f87049bb2ed909e0b886cf89aa0` | Draft |
| [#2300](https://github.com/anitaguptaoffice/sanguo-slg/pull/2300) | CI-CHAT-DELAY-ACCEPTANCE-001 Verify complete controlled native gate | `fix/ci-chat-delay-acceptance-001` | `b462185c1d4a49d8a17cdfa849740f4cd5ff78ac` | Draft |
| [#2299](https://github.com/anitaguptaoffice/sanguo-slg/pull/2299) | CI-CHAT-DELAY-SERVER-001 Own bounded real-server transport | `fix/ci-chat-delay-server-001` | `bd5a2060675f0e1127beb786320b377245645e70` | Draft |
| [#2298](https://github.com/anitaguptaoffice/sanguo-slg/pull/2298) | CI-CHAT-TCP-DELAY-001 Preserve fixed-delay TCP byte streams | `fix/ci-chat-tcp-delay-001` | `d512df7415f9cee85efb55d73b5ff6238d0783b8` | Draft |
| [#2297](https://github.com/anitaguptaoffice/sanguo-slg/pull/2297) | CI-GUILD-PRESENCE-RUNTIME-001 Isolate real guild presence runtime [NEVER MERGE] | `fix/CI-GUILD-PRESENCE-RUNTIME-001` | `15f75cda10c468cb2616dcdcfff5adefbf3d8b74` | Draft |
| [#2289](https://github.com/anitaguptaoffice/sanguo-slg/pull/2289) | CI-CHAT-UNICODE-ACCEPTANCE-001 Verify complete native Unicode gate [NEVER MERGE] | `fix/ci-chat-unicode-acceptance-001` | `f48b1d64ccd1149d3f5b6e165f28c456b30965e3` | Draft |
| [#2288](https://github.com/anitaguptaoffice/sanguo-slg/pull/2288) | CI-CHAT-RUNTIME-001 Isolate native chat runtime [NEVER MERGE] | `fix/ci-chat-runtime-001` | `6889bc773a52957a6135986d8d48c913517f5cd0` | Draft |
| [#2282](https://github.com/anitaguptaoffice/sanguo-slg/pull/2282) | CLIENT-RECRUIT-COLLAPSE-FOCUS-001 Retain focus before recruitment collapse | `fix/CLIENT-RECRUIT-COLLAPSE-FOCUS-001` | `0f4d78d8c30cac4d749ccb4a7d4c6d427219c6ba` | Draft |
| [#2280](https://github.com/anitaguptaoffice/sanguo-slg/pull/2280) | CI-HERO-LAYOUT-GEOMETRY-001 Validate native geometry predicates [NEVER MERGE] | `verify/CI-HERO-LAYOUT-GEOMETRY-001` | `283160ae6f9970ff396383ae6815ed9783c64753` | Draft |
| [#2277](https://github.com/anitaguptaoffice/sanguo-slg/pull/2277) | CI-HERO-LAYOUT-RUNTIME-001 Freeze live hero runtime [NEVER MERGE] | `verify/CI-HERO-LAYOUT-RUNTIME-001` | `7dc5939f9753a8aa59c94f7101c62a8e4a8eda79` | Draft |
| [#2275](https://github.com/anitaguptaoffice/sanguo-slg/pull/2275) | CLIENT-HERO-PANEL-LAYOUT-001 保留展开状态下的将领列表可见区域 | `fix/CLIENT-HERO-PANEL-LAYOUT-001` | `a7cd2a0fdee5dc2f88c90c1b8f5049afd40dcbe4` | Draft |
| [#2272](https://github.com/anitaguptaoffice/sanguo-slg/pull/2272) | CI-HERO-REACHABILITY-LIVE-001 Diagnose real hero mouse reachability [DRAFT HOLD] | `test/CI-HERO-REACHABILITY-LIVE-001` | `b093c7b8c56192bca821aa2942dafffdb1315569` | Draft |
| [#2269](https://github.com/anitaguptaoffice/sanguo-slg/pull/2269) | CI-HERO-EXPR-REENTRY-LIVE-001 Verify natural training recovery with real services | `test/CI-HERO-EXPR-REENTRY-LIVE-001` | `c960f5d053d1d4f4cd71b9445032e482ca1b66f2` | Draft |
| [#2267](https://github.com/anitaguptaoffice/sanguo-slg/pull/2267) | CLIENT-EXPR-REENTRY-FINISH-001 Restore explicit training claim after reentry [HOLD live QA] | `fix/CLIENT-EXPR-REENTRY-FINISH-001` | `a020369eb4f58e835522934c662ab1fd3d4161e3` | Draft |
| [#2265](https://github.com/anitaguptaoffice/sanguo-slg/pull/2265) | CI-LIVE-QUEST-BROWSER-001 Verify tutorial selection with real server and browser | `test/CI-LIVE-QUEST-BROWSER-001` | `efdede524160424f5ffbcf1f03389a214c6042b0` | Draft |
| [#2263](https://github.com/anitaguptaoffice/sanguo-slg/pull/2263) | CI-API-RECRUIT-COMPLETE-LIFETIME-001 Gate completion rows and confirmed lifetime | `fix/CI-API-RECRUIT-COMPLETE-LIFETIME-001` | `7b29f6eac79fc46a3a95b80773d486f73e27e643` | Draft |
| [#2262](https://github.com/anitaguptaoffice/sanguo-slg/pull/2262) | API-RECRUIT-COMPLETE-CONFIRMED-LIFETIME-PG-001 Prove confirmed completion survives record loss | `fix/API-RECRUIT-COMPLETE-CONFIRMED-LIFETIME-PG-001` | `bd782da67da80511e0721b41a0172311aab3b9d6` | Draft |
| [#2259](https://github.com/anitaguptaoffice/sanguo-slg/pull/2259) | API-RECRUIT-COMPLETE-RETURN-ROWS-PG-001 Prove actual completion row locks and checkpoint | `fix/API-RECRUIT-COMPLETE-RETURN-ROWS-PG-001` | `ad30b7b0ca3d8f072c23d687b7a02c08f6e9563e` | Draft |
| [#2253](https://github.com/anitaguptaoffice/sanguo-slg/pull/2253) | API-RECRUIT-COMPLETE-RETURN-OBSERVED-PG-001 Witness actual credit operands and ends | `fix/API-RECRUIT-COMPLETE-RETURN-OBSERVED-PG-001` | `da44dad528151fb0d4dde7e8b3a5631ee42ff21e` | Draft |
| [#2255](https://github.com/anitaguptaoffice/sanguo-slg/pull/2255) | CI-API-RECRUIT-COMPLETE-PROGRESS-001 Gate later dormant completion evidence | `fix/CI-API-RECRUIT-COMPLETE-PROGRESS-001` | `93517e429dac5fe332000a35abfd1bcaa842db43` | Draft |
| [#2245](https://github.com/anitaguptaoffice/sanguo-slg/pull/2245) | API-RECRUIT-COMPLETE-RETURN-SQL-PG-001 Verify exact Return SQL with paid jobs | `fix/API-RECRUIT-COMPLETE-RETURN-SQL-PG-001` | `65f829782f349fb9ceed748789e5465d29136d3b` | Draft |
| [#2243](https://github.com/anitaguptaoffice/sanguo-slg/pull/2243) | API-RECRUIT-COMPLETE-RETURN-FIXTURE-PG-001 Verify paired actual completion smoke | `fix/API-RECRUIT-COMPLETE-RETURN-FIXTURE-PG-001` | `f390bccfd1bc546ff94165f47754076caffa06fc` | Draft |
| [#2237](https://github.com/anitaguptaoffice/sanguo-slg/pull/2237) | API-RECRUIT-COMPLETE-PROMOTION-PG-001 Verify atomic oldest Recruit promotion | `fix/API-RECRUIT-COMPLETE-PROMOTION-PG-001` | `8eb53222163353b53ecbe6843aee47753a8056cc` | Draft |
| [#2232](https://github.com/anitaguptaoffice/sanguo-slg/pull/2232) | API-RECRUIT-COMPLETE-HISTORY-PG-001 Verify completed Recruit history and replay | `fix/API-RECRUIT-COMPLETE-HISTORY-PG-001` | `22d77d104a451c1e5e96f891a4a8965a0cdfe2eb` | Draft |
| [#2229](https://github.com/anitaguptaoffice/sanguo-slg/pull/2229) | CI-API-RECRUIT-COMPLETE-PG-001 Verify actual dormant completion | `fix/CI-API-RECRUIT-COMPLETE-PG-001` | `49a342b642e2229206c6f949631540aaba2d5f94` | Draft |
| [#2222](https://github.com/anitaguptaoffice/sanguo-slg/pull/2222) | CI-API-RECRUIT-ATTEMPT-END-PG-001 Verify Recruit attempt end extraction | `fix/CI-API-RECRUIT-ATTEMPT-END-PG-001` | `d3592da96e93370d988eee3dd6f97d555acfee78` | Draft |
| [#2228](https://github.com/anitaguptaoffice/sanguo-slg/pull/2228) | API-RECRUIT-COMPLETE-NOEFFECT-PG-001 Verify actual Early and Waiting | `fix/API-RECRUIT-COMPLETE-NOEFFECT-PG-001` | `259ddf2dbbcb2999e26932f2e2de9e5da86eaa55` | Draft |
| [#2226](https://github.com/anitaguptaoffice/sanguo-slg/pull/2226) | API-RECRUIT-COMPLETE-BASIC-PG-001 Verify real paid Recruit completion | `fix/API-RECRUIT-COMPLETE-BASIC-PG-001` | `aeab44939135afe8ff699b1669feef95cb1ce16a` | Draft |
| [#2224](https://github.com/anitaguptaoffice/sanguo-slg/pull/2224) | API-RECRUIT-COMPLETE-001 Add dormant Recruit completion attempt | `fix/API-RECRUIT-COMPLETE-001` | `9c6a2227c9b1c8574561ac84680e334a9d4451a1` | Draft |
| [#2219](https://github.com/anitaguptaoffice/sanguo-slg/pull/2219) | API-RECRUIT-ATTEMPT-END-001 Extract Recruit attempt end classification | `fix/API-RECRUIT-ATTEMPT-END-001` | `faeeae65f2f38b4f4a97332da06bb710880c6a81` | Draft |
| [#2210](https://github.com/anitaguptaoffice/sanguo-slg/pull/2210) | CI-API-MILITARY-ATTEMPT-PG-001 Verify actual military attempts on PostgreSQL | `fix/CI-API-MILITARY-ATTEMPT-PG-001-publication` | `77c3da3b3848682ced275b6a165f1a601199b5bb` | Draft |
| [#2188](https://github.com/anitaguptaoffice/sanguo-slg/pull/2188) | CI-API-RECRUIT-SOURCE-PG-001 Validate initialization and SQL evidence | `fix/CI-API-RECRUIT-SOURCE-PG-001-publication` | `bd74be0a2fe7f78f0f86a14917d95a0f34a3df42` | Draft |
| [#2209](https://github.com/anitaguptaoffice/sanguo-slg/pull/2209) | API-RECRUIT-ATTEMPT-LIFETIME-PG-001 Verify actual confirmed Recruit lifetime | `fix/API-RECRUIT-ATTEMPT-LIFETIME-PG-001-publication` | `89459bd7e8d1da6efa04399fcf6ca42492e7d9ae` | Draft |
| [#2208](https://github.com/anitaguptaoffice/sanguo-slg/pull/2208) | API-RECRUIT-ATTEMPT-NETWORK-PG-001 Verify actual Recruit COMMIT transport uncertainty | `fix/API-RECRUIT-ATTEMPT-NETWORK-PG-001-publication` | `200b7f23046d84ebdcff754c7ebf818142fc8ff9` | Draft |
| [#2207](https://github.com/anitaguptaoffice/sanguo-slg/pull/2207) | API-RECRUIT-ATTEMPT-SERIALIZATION-PG-001 Verify concurrent Recruit command replay | `fix/API-RECRUIT-ATTEMPT-SERIALIZATION-PG-001-publication` | `19bd29f53c60bbc4962405bf916c9e9cad9cf959` | Draft |
| [#2206](https://github.com/anitaguptaoffice/sanguo-slg/pull/2206) | API-RECRUIT-ATTEMPT-FAILURES-PG-001 Verify Recruit failure atomicity boundaries | `fix/API-RECRUIT-ATTEMPT-FAILURES-PG-001-publication` | `376d9094255338cce5ba417b2def1cc4d05b556d` | Draft |
| [#2205](https://github.com/anitaguptaoffice/sanguo-slg/pull/2205) | API-RECRUIT-RETURN-INTEROP-PG-001 Verify actual Recruit and Return interoperability | `fix/API-RECRUIT-RETURN-INTEROP-PG-001-publication` | `c50e4d616906212ff4ff748f7509af498eb4b750` | Draft |
| [#2204](https://github.com/anitaguptaoffice/sanguo-slg/pull/2204) | API-RECRUIT-RETURN-FIXTURE-PG-001 Isolate safe interoperability fixture | `fix/API-RECRUIT-RETURN-FIXTURE-PG-001-publication` | `1f3753b942bf99d632a2fa661533d69ab5beaa00` | Draft |
| [#2203](https://github.com/anitaguptaoffice/sanguo-slg/pull/2203) | API-RECRUIT-ATTEMPT-PG-001 Verify actual Recruit admission and replay | `fix/API-RECRUIT-ATTEMPT-PG-001-publication` | `bc48ce3552b8984a4e783adf16b009d88ea85a3d` | Draft |
| [#2202](https://github.com/anitaguptaoffice/sanguo-slg/pull/2202) | API-RECRUIT-ATTEMPT-001 Compose dormant Recruit admission and replay | `fix/API-RECRUIT-ATTEMPT-001-publication` | `c6daefe14b3b2a6f643045f34ff83043a48bd7e5` | Draft |
| [#2201](https://github.com/anitaguptaoffice/sanguo-slg/pull/2201) | API-RETURN-ATTEMPT-FAILURES-PG-001 Verify actual return transaction failure boundaries | `fix/API-RETURN-ATTEMPT-FAILURES-PG-001-publication` | `d2011cabbb2fc43a10b9b0d5a15cd3ab03e8f298` | Draft |
| [#2200](https://github.com/anitaguptaoffice/sanguo-slg/pull/2200) | API-RETURN-ATTEMPT-NETWORK-PG-001 Verify real return COMMIT transport uncertainty | `fix/API-RETURN-ATTEMPT-NETWORK-PG-001-publication` | `914e2bf1432becf282b30560a390ed8db5632e20` | Draft |
| [#2199](https://github.com/anitaguptaoffice/sanguo-slg/pull/2199) | API-RETURN-ATTEMPT-LOCK-ORDER-PG-001 Witness APP return pin and actor lock order | `fix/API-RETURN-ATTEMPT-LOCK-ORDER-PG-001-publication` | `0d4298728c02d5b5c259ea648c49edba16e37e6e` | Draft |
| [#2198](https://github.com/anitaguptaoffice/sanguo-slg/pull/2198) | API-RETURN-ATTEMPT-LIFETIME-PG-001 Verify return panic and admitted lifetime boundaries | `fix/API-RETURN-ATTEMPT-LIFETIME-PG-001-publication` | `8b265ec5e062fe11bcfff9baa8b247e824f69ac7` | Draft |
| [#2197](https://github.com/anitaguptaoffice/sanguo-slg/pull/2197) | API-RETURN-ATTEMPT-BACKEND-CLEANUP-PG-001 Verify exact return backend transport teardown | `fix/API-RETURN-ATTEMPT-BACKEND-CLEANUP-PG-001-publication` | `88db5c81f5cf672a07e285f7723326bcb6119223` | Draft |
| [#2196](https://github.com/anitaguptaoffice/sanguo-slg/pull/2196) | API-RETURN-ATTEMPT-SERIALIZATION-PG-001 Verify real return duplicate and wallet-to-WORLD serialization | `fix/API-RETURN-ATTEMPT-SERIALIZATION-PG-001-publication` | `50a44e4564114b86c62e296a999d962ca285593d` | Draft |
| [#2195](https://github.com/anitaguptaoffice/sanguo-slg/pull/2195) | API-RETURN-ATTEMPT-BACKEND-CLEANUP-001 Bind return test cleanup to owned transport | `fix/API-RETURN-ATTEMPT-BACKEND-CLEANUP-001-publication` | `64aad9967009eb39a1f434ed414295bd5f541337` | Draft |
| [#2194](https://github.com/anitaguptaoffice/sanguo-slg/pull/2194) | API-RETURN-ATTEMPT-PG-001 Verify dormant APP return flow on PostgreSQL | `fix/API-RETURN-ATTEMPT-PG-001-publication` | `6f6e180b4daca7aa15754977be162619a4346d67` | Draft |
| [#2192](https://github.com/anitaguptaoffice/sanguo-slg/pull/2192) | API-RETURN-ATTEMPT-001 Compose dormant return transaction attempt | `fix/API-RETURN-ATTEMPT-001-publication` | `f52f638a24032aed20fa3f12afd4fc00820fb6a8` | Draft |
| [#2184](https://github.com/anitaguptaoffice/sanguo-slg/pull/2184) | API-RETURN-SOURCE-SQL-001 Reject unreviewed Return source validation SQL | `fix/API-RETURN-SOURCE-SQL-001-publication` | `07acefe83d995f3dd01be7cedf9ffc5cec489fef` | Draft |
| [#2168](https://github.com/anitaguptaoffice/sanguo-slg/pull/2168) | CI-WORLD-CHUNK-DIAGNOSTIC-001 Prove immutable old chunk behavior [NEVER MERGE] | `diagnostic/CI-WORLD-CHUNK-DIAGNOSTIC-001` | `c77bc2164d4d47ca5b5c85885773e015e4eafff8` | Draft |
| [#2165](https://github.com/anitaguptaoffice/sanguo-slg/pull/2165) | WORLD-CHUNK-PERSISTENCE-PG-001 Freeze diagnostic chunk witnesses [NEVER MERGE] | `diagnostic/WORLD-CHUNK-PERSISTENCE-PG-001` | `e52fe0e0a1f9e18fbea6c75307301aad6ccd800b` | Draft |
| [#2092](https://github.com/anitaguptaoffice/sanguo-slg/pull/2092) | CI-MIL-ARRIVAL-PG-001 Run real military PG17 ordinary/race acceptance [HOLD] | `fix/CI-MIL-ARRIVAL-PG-001` | `2f4b23f08039c81778aabc124b74e06b4a6a29c5` | Draft |
| [#2089](https://github.com/anitaguptaoffice/sanguo-slg/pull/2089) | QA-BAG-ICON-BROWSER-001 在标准runner验证背包候选图标 | `test/QA-BAG-ICON-BROWSER-001` | `18ec6347edc0364850669a1923f488215687d710` | Draft |
| [#1973](https://github.com/anitaguptaoffice/sanguo-slg/pull/1973) | CLIENT-BAG-ITEM-ICON-MOUNT-001 背包行可选道具图标挂载 | `feat/CLIENT-BAG-ITEM-ICON-MOUNT-001` | `ed32cae751646723ac242849f16a9acb034c8eb4` | Draft |
| [#2088](https://github.com/anitaguptaoffice/sanguo-slg/pull/2088) | ART-WORLD-TERRAIN-CONCEPT-001 三类世界地形概念小样与建议契约 | `feat/ART-WORLD-TERRAIN-CONCEPT-001` | `dff19ecb9c8e571f9189f98704ac8453e6e75247` | Draft |
| [#2073](https://github.com/anitaguptaoffice/sanguo-slg/pull/2073) | CLIENT-MAINCITY-RETURN-001 Return safely to server selection [HOLD browser] | `feat/CLIENT-MAINCITY-RETURN-001` | `b5abf873be6c501a1cd5c43da0ba792fe57d0160` | Draft |
| [#2065](https://github.com/anitaguptaoffice/sanguo-slg/pull/2065) | CLIENT-HERO-RECRUIT-NAVIGATION-001 Reveal recruitment controls safely [HOLD browser] | `fix/CLIENT-HERO-RECRUIT-NAVIGATION-001` | `e1f240da3b03633d3019e2ea6d539a519fc68d1a` | Draft |
| [#2063](https://github.com/anitaguptaoffice/sanguo-slg/pull/2063) | CLIENT-QUEST-ROW-SELECTION-001 Select tutorial quest rows [HOLD browser acceptance] | `feat/CLIENT-QUEST-ROW-SELECTION-001` | `304e6d2b709586500a53d0049419e5c4d9dd1160` | Draft |
| [#2006](https://github.com/anitaguptaoffice/sanguo-slg/pull/2006) | CLIENT-RANK-PAGINATION-001: browse leaderboards and locate my rank | `feat/CLIENT-RANK-PAGINATION-001` | `85636cb288d1c53d80fa1a3bdccb67205fea15f2` | Draft |
| [#2004](https://github.com/anitaguptaoffice/sanguo-slg/pull/2004) | CLIENT-MAIL-PAGINATION-001: expose older inbox pages safely | `feat/CLIENT-MAIL-PAGINATION-001` | `adc2c9e56b2e1d1134f648e3d0d6b4f22f37f6ae` | Draft |
| [#2003](https://github.com/anitaguptaoffice/sanguo-slg/pull/2003) | CONTENT-MAIL-STABLE-ORDER-001 Stabilize inbox pagination ties [HOLD PG] | `fix/CONTENT-MAIL-STABLE-ORDER-001` | `da9dffa09329900b4a22f6ebde6f906bb11a3d40` | Draft |
| [#2000](https://github.com/anitaguptaoffice/sanguo-slg/pull/2000) | CLIENT-MARCH-UNIT-SELECTION-001 Select existing troop types for march [HOLD browser/live acceptance] | `feat/CLIENT-MARCH-UNIT-SELECTION-001` | `f05365fb480357d25d0df3c58602eecf96ca2229` | Draft |
| [#1983](https://github.com/anitaguptaoffice/sanguo-slg/pull/1983) | MIL-ARRIVAL-RESOLVER-PG-001 Add durable arrival PostgreSQL integration tests [HOLD PG17] | `feat/MIL-ARRIVAL-RESOLVER-PG-001` | `3cd900f628bb0dd23b5fd84338145637ca55f0ab` | Draft |
| [#1980](https://github.com/anitaguptaoffice/sanguo-slg/pull/1980) | MIL-ARRIVAL-RESOLVER-001 Wire default-off durable arrival resolver [HOLD PG17] | `feat/MIL-ARRIVAL-RESOLVER-001` | `d4beda0ce87881bc1c26ae8a4929e1c4a2f678e3` | Draft |
| [#1968](https://github.com/anitaguptaoffice/sanguo-slg/pull/1968) | ART-ITEM-ICONS-001 49种原创道具图标候选包 | `feat/ART-ITEM-ICONS-001` | `91f3080ac50cc1abb961dac9f50e99c9266a2b6e` | Draft |
| [#1969](https://github.com/anitaguptaoffice/sanguo-slg/pull/1969) | ART-UNIT-ICONS-001 四兵种原创静态图标候选包 | `feat/ART-UNIT-ICONS-001-candidates-20261102` | `02716722d54b16e8dce1f765458a0094b9750ea8` | Draft |
| [#82](https://github.com/anitaguptaoffice/sanguo-slg/pull/82) | reference: 补入原版实现参照（服务端 / 客户端 / 表结构） | `reference/legacy-source` | `7c4cd5a7feff947a47669cb125ff242dc180643c` | Open |
| [#77](https://github.com/anitaguptaoffice/sanguo-slg/pull/77) | art: 引入旧版美术资源作为重制参考 | `art/reference-assets` | `4fa055f27f2e06ee4d9a62984c627bb2ad5becb2` | Open |

## 10. 交接完成口径
本次仅发布交接文档并核对已有远端代码；不合并产品、不强推、不部署、不删除现场。进行中工作已暂停移交。已有CI可自然结束，最新状态以指定run为准。
