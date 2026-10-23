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

出口：wave:9 **INTG-006**（#138）+ **CLIENT-007**（#135）+ **HERO-002**（#139）+ **MAIL-001**（#136）+ **DATA-002**（#137）养成/邮件/横屏；wave:10 **CLIENT-008**（#156）将领/邮件面板、**HERO-003**（#158）招募预览、**QUEST-002**（#157）日常 chain、**GM-003**（#154）运营收口与 **INTG-007**（#159）冒烟；wave:11 **CLIENT-009**（[#169](https://github.com/anitaguptaoffice/sanguo-slg/pull/169)）日常 UI、**CLIENT-010**（[#171](https://github.com/anitaguptaoffice/sanguo-slg/pull/171)）招募模板与背包/商城可读性、**CLIENT-012**（[#170](https://github.com/anitaguptaoffice/sanguo-slg/pull/170)）战报底栏入口，**QUEST-003**（[#173](https://github.com/anitaguptaoffice/sanguo-slg/pull/173)）日常挂钩与 **INTG-008**（[#174](https://github.com/anitaguptaoffice/sanguo-slg/pull/174)）冒烟——H5 **日常 + 招募模板预览 + 战报** 最短可玩路径见 [client/README.md](../client/README.md#wave-11-可玩环m4-出口--intg-008)；wave:12 **CLIENT-013**（[#188](https://github.com/anitaguptaoffice/sanguo-slg/pull/188)）行军列表、**CLIENT-014**（[#187](https://github.com/anitaguptaoffice/sanguo-slg/pull/187)）将领详情、**CLIENT-015**（[#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)）世界坐标出征、**CLIENT-016**/**CLIENT-017**/**CLIENT-018** 战报筛选/邮件收件箱/HUD 反馈与 **INTG-009**（[#192](https://github.com/anitaguptaoffice/sanguo-slg/pull/192)）冒烟——H5 **行军列表 + 将领详情 + 邮件 + 战报筛选** 可玩路径见 [client/README.md](../client/README.md#wave-12-可玩加深m4-出口--intg-009)；wave:13 **CLIENT-019**（[#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206)）队列倒计时、**CLIENT-020**（[#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204)）背包/商城反馈、**CLIENT-021**（[#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207)）双榜只读、**CLIENT-022**（[#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205)）军团/聊天可读、**CLIENT-023**（[#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208)）招募↔日常闭环与 **INTG-010**（[#203](https://github.com/anitaguptaoffice/sanguo-slg/pull/203)）冒烟——H5 **队列倒计时 + 背包/商城反馈 + 双榜 + 社交可读 + 招募日常闭环** 路径见 [client/README.md](../client/README.md#wave-13-闭环加深m4-出口--intg-010)；wave:14 **DOM-003**（[#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)）建造加速符对接 domestic、**CLIENT-024**（[#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220)）chain 400 多类型日常引导、**CLIENT-025**（[#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)）行军结束→战报提示、**CLIENT-026**（[#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222)）队列建造加速 UI、**CLIENT-027**（[#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)）HUD 待办徽章与 **INTG-011**（[#223](https://github.com/anitaguptaoffice/sanguo-slg/pull/223)）冒烟——H5 **建造加速真实生效 + 多类型日常引导 + 行军战报提示 + HUD 待办徽章** 路径见 [client/README.md](../client/README.md#wave-14-日常与队列闭环m4-出口--intg-011)；wave:15 **CLIENT-028**（[#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)）世界地图行军只读标注、**CLIENT-029**（[#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238) `e084ac8f`）邮件/战报/背包密度、**CLIENT-030**（[#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236)）排行/军团/聊天扫读、**CLIENT-031**（[#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)）将领招募对比、**CLIENT-032**（[#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240)）manifest HUD/面板接线、**CLIENT-033**（[#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`，**wave:15 hotfix**）军事面板运行时三修与 **INTG-012**（[#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237)）冒烟——H5 **世界地图标注 + 面板密度 + 社交扫读 + 招募对比 + manifest 接线** 路径见 [client/README.md](../client/README.md#wave-15-世界地图与面板密度m4-出口--intg-012)；wave:16 **CLIENT-034**（[#254](https://github.com/anitaguptaoffice/sanguo-slg/pull/254)）战报回合详情与行军深链、**CLIENT-035**（[#253](https://github.com/anitaguptaoffice/sanguo-slg/pull/253)）邮件附件领取、**CLIENT-036**（[#255](https://github.com/anitaguptaoffice/sanguo-slg/pull/255)）军事 manifest、**INTG-013**（[#257](https://github.com/anitaguptaoffice/sanguo-slg/pull/257)）冒烟、**CLIENT-037**（[#256](https://github.com/anitaguptaoffice/sanguo-slg/pull/256) `5a4bb4af`）小地图扫读、**CLIENT-038**（[#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258) `30c95e2a`）HUD 角标深链、**CLIENT-039**（[#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260) `9e98a28b`）1280 顶栏叠字修——H5 **战报回合 + 邮件领取 + 军事 manifest + 小地图 + HUD 深链** 路径见 [client/README.md](../client/README.md#wave-16-战报邮件闭环与军事反馈m4-出口--intg-013)、**DOCS-EXIT-008**（[#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) / [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261) `58bd03b7`）；wave:17 **CLIENT-041**（[#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) / [#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275) `12a8850f`）小地图选点出征、**CLIENT-042**（[#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) / [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`）战报坐标复盘、**CLIENT-043**（[#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) / [#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279) `66e5578a`）军事目标记忆、**CLIENT-044**（[#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) / [#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272) `d437076a`）日常战报横幅、**CLIENT-045**（[#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269) / [#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273) `5a3ae507`）社交刷新与 **INTG-014**（[#270](https://github.com/anitaguptaoffice/sanguo-slg/issues/270) / [#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274) `90fb5356`）网关冒烟——H5 **小地图选点出征 + 战报坐标复盘 + 军事目标记忆 + 日常战报横幅 + 社交刷新** 路径见 [client/README.md](../client/README.md#wave-17-世界出征互链与复盘导航m4-出口--intg-014)；wave:18 **CLIENT-047**（[#283](https://github.com/anitaguptaoffice/sanguo-slg/issues/283) / [#294](https://github.com/anitaguptaoffice/sanguo-slg/pull/294) `e2e4c367`）军情 ETA 与列表密度、**CLIENT-048**（[#284](https://github.com/anitaguptaoffice/sanguo-slg/issues/284) / [#293](https://github.com/anitaguptaoffice/sanguo-slg/pull/293) `0e460f7b`）出征表单校验、**CLIENT-049**（[#285](https://github.com/anitaguptaoffice/sanguo-slg/issues/285) / [#297](https://github.com/anitaguptaoffice/sanguo-slg/pull/297) `17a41ff2`）战报分页与筛选记忆、**CLIENT-050**（[#286](https://github.com/anitaguptaoffice/sanguo-slg/issues/286) / [#299](https://github.com/anitaguptaoffice/sanguo-slg/pull/299) `b40c01f7`）邮件领取 HUD 同步、**CLIENT-051**（[#288](https://github.com/anitaguptaoffice/sanguo-slg/issues/288) / [#295](https://github.com/anitaguptaoffice/sanguo-slg/pull/295) `504a91ef`）HUD 资源脉冲、**CLIENT-052**（[#289](https://github.com/anitaguptaoffice/sanguo-slg/issues/289) / [#296](https://github.com/anitaguptaoffice/sanguo-slg/pull/296) `a94cb935`）队列↔日常互链、**CLIENT-053**（[#290](https://github.com/anitaguptaoffice/sanguo-slg/issues/290) / [#298](https://github.com/anitaguptaoffice/sanguo-slg/pull/298) `0b915f74`）社交空错态与 **INTG-015**（[#291](https://github.com/anitaguptaoffice/sanguo-slg/issues/291) / [#301](https://github.com/anitaguptaoffice/sanguo-slg/pull/301) `ee574240`）网关冒烟——H5 **军情 ETA + 出征校验 + 战报分页 + 邮件领取同步 + HUD 资源脉冲 + 队列日常互链 + 社交空错态** 路径见 [client/README.md](../client/README.md#wave-18-出征反馈与面板可读加深m4-出口--intg-015)、**DOCS-EXIT-010**（[#292](https://github.com/anitaguptaoffice/sanguo-slg/issues/292) / [#302](https://github.com/anitaguptaoffice/sanguo-slg/pull/302) `b63ed954`）；wave:19 **CLIENT-056**（[#327](https://github.com/anitaguptaoffice/sanguo-slg/issues/327) / [#341](https://github.com/anitaguptaoffice/sanguo-slg/pull/341) `2006b478`）将领招募钱包对比、**CLIENT-057**（[#328](https://github.com/anitaguptaoffice/sanguo-slg/issues/328) / [#339](https://github.com/anitaguptaoffice/sanguo-slg/pull/339) `22368a0f`）商城/背包校验、**CLIENT-058**（[#329](https://github.com/anitaguptaoffice/sanguo-slg/issues/329) / [#338](https://github.com/anitaguptaoffice/sanguo-slg/pull/338) `eb8f8a26`）小地图 ETA、**CLIENT-059**（[#330](https://github.com/anitaguptaoffice/sanguo-slg/issues/330) / [#343](https://github.com/anitaguptaoffice/sanguo-slg/pull/343) `6df0ef9f`）队列与产出总览、**CLIENT-060**（[#331](https://github.com/anitaguptaoffice/sanguo-slg/issues/331) / [#344](https://github.com/anitaguptaoffice/sanguo-slg/pull/344) `97c99156`）邮件战报日常互链、**CLIENT-061**（[#332](https://github.com/anitaguptaoffice/sanguo-slg/issues/332) / [#342](https://github.com/anitaguptaoffice/sanguo-slg/pull/342) `b2fb1a01`）世界军情高亮、**CLIENT-062**（[#333](https://github.com/anitaguptaoffice/sanguo-slg/issues/333) / [#340](https://github.com/anitaguptaoffice/sanguo-slg/pull/340) `1d9ab72f`）1280 manifest 与 **INTG-016**（[#334](https://github.com/anitaguptaoffice/sanguo-slg/issues/334) / [#337](https://github.com/anitaguptaoffice/sanguo-slg/pull/337) `7ecb7d4d`）网关冒烟——H5 **将领招募对比 + 商城/背包校验 + 小地图 ETA + 队列资源总览 + 邮件战报日常互链 + 世界军情高亮 + 1280 manifest** 路径见 [client/README.md](../client/README.md#wave-19-可玩加深m4-出口--intg-016)、**DOCS-EXIT-011**（[#335](https://github.com/anitaguptaoffice/sanguo-slg/issues/335) / [#346](https://github.com/anitaguptaoffice/sanguo-slg/pull/346) `d0920b5d`）；wave:20 **CLIENT-065**（[#350](https://github.com/anitaguptaoffice/sanguo-slg/issues/350) / [#360](https://github.com/anitaguptaoffice/sanguo-slg/pull/360) `9396165e`）战报时间窗、**CLIENT-066**（[#351](https://github.com/anitaguptaoffice/sanguo-slg/issues/351) / [#366](https://github.com/anitaguptaoffice/sanguo-slg/pull/366) `a9788a83`）主城槽位队列深链、**CLIENT-067**（[#352](https://github.com/anitaguptaoffice/sanguo-slg/issues/352) / [#361](https://github.com/anitaguptaoffice/sanguo-slg/pull/361) `f858c821`）经济错误统一、**CLIENT-068**（[#353](https://github.com/anitaguptaoffice/sanguo-slg/issues/353) / [#363](https://github.com/anitaguptaoffice/sanguo-slg/pull/363) `4af126c8`）邮件战报日常深链、**CLIENT-069**（[#354](https://github.com/anitaguptaoffice/sanguo-slg/issues/354) / [#362](https://github.com/anitaguptaoffice/sanguo-slg/pull/362) `857e696e`）军情格点筛选、**CLIENT-070**（[#355](https://github.com/anitaguptaoffice/sanguo-slg/issues/355) / [#364](https://github.com/anitaguptaoffice/sanguo-slg/pull/364) `944a3cdd`）1280 军事邮件日常 manifest、**CLIENT-071**（[#356](https://github.com/anitaguptaoffice/sanguo-slg/issues/356) / [#359](https://github.com/anitaguptaoffice/sanguo-slg/pull/359) `4ea9e69f`）队列日常行内反馈与 **INTG-017**（[#357](https://github.com/anitaguptaoffice/sanguo-slg/issues/357) / [#365](https://github.com/anitaguptaoffice/sanguo-slg/pull/365) `4b522cae`）网关冒烟——H5 **战报时间窗 + 主城槽位队列深链 + 经济错误统一 + 邮件战报日常深链 + 军情格点筛选 + 1280 军事邮件日常 manifest + 队列日常行内反馈** 路径见 [client/README.md](../client/README.md#wave-20-面板互链与反馈巩固m4-出口--intg-017)、**DOCS-EXIT-012**（[#358](https://github.com/anitaguptaoffice/sanguo-slg/issues/358) / [#367](https://github.com/anitaguptaoffice/sanguo-slg/pull/367) `79f54e0d`）；wave:21 **CLIENT-072**（[#369](https://github.com/anitaguptaoffice/sanguo-slg/issues/369) / [#385](https://github.com/anitaguptaoffice/sanguo-slg/pull/385) `03c8149b`）将领养成对比、**CLIENT-073**（[#370](https://github.com/anitaguptaoffice/sanguo-slg/issues/370) / [#386](https://github.com/anitaguptaoffice/sanguo-slg/pull/386) `87a2a8cb`）世界信息卡、**CLIENT-074**（[#371](https://github.com/anitaguptaoffice/sanguo-slg/issues/371) / [#379](https://github.com/anitaguptaoffice/sanguo-slg/pull/379) `4102f1a5`）战报回合跳转、**CLIENT-075**（[#372](https://github.com/anitaguptaoffice/sanguo-slg/issues/372) / [#381](https://github.com/anitaguptaoffice/sanguo-slg/pull/381) `b0ca4ba5`）日常筛选记忆、**CLIENT-076**（[#373](https://github.com/anitaguptaoffice/sanguo-slg/issues/373) / [#384](https://github.com/anitaguptaoffice/sanguo-slg/pull/384) `439c1b67`）社交刷新巩固、**CLIENT-077**（[#374](https://github.com/anitaguptaoffice/sanguo-slg/issues/374) / [#387](https://github.com/anitaguptaoffice/sanguo-slg/pull/387) `e1d44182`）HUD 待办深链、**CLIENT-078**（[#375](https://github.com/anitaguptaoffice/sanguo-slg/issues/375) / [#383](https://github.com/anitaguptaoffice/sanguo-slg/pull/383) `8187d4f4`）1280 将领世界排行 manifest、**CLIENT-079**（[#376](https://github.com/anitaguptaoffice/sanguo-slg/issues/376) / [#382](https://github.com/anitaguptaoffice/sanguo-slg/pull/382) `c9b53258`）背包批量/商城分类与 **INTG-018**（[#377](https://github.com/anitaguptaoffice/sanguo-slg/issues/377) / [#380](https://github.com/anitaguptaoffice/sanguo-slg/pull/380) `0a78b1d6`）网关冒烟——H5 **将领养成对比 + 世界信息卡 + 战报回合跳转 + 日常筛选记忆 + 社交刷新巩固 + HUD 待办深链 + 1280 将领世界排行 manifest + 背包批量/商城分类** 路径见 [client/README.md](../client/README.md#wave-21-养成复盘与世界可读加深m4-出口--intg-018)、**DOCS-EXIT-013**（[#378](https://github.com/anitaguptaoffice/sanguo-slg/issues/378) / [#388](https://github.com/anitaguptaoffice/sanguo-slg/pull/388) `b5a1488e`）；wave:22 **CLIENT-080**（[#390](https://github.com/anitaguptaoffice/sanguo-slg/issues/390) / [#403](https://github.com/anitaguptaoffice/sanguo-slg/pull/403) `4a73aa2e`）出征提交反馈、**CLIENT-081**（[#391](https://github.com/anitaguptaoffice/sanguo-slg/issues/391) / [#402](https://github.com/anitaguptaoffice/sanguo-slg/pull/402) `63a5dcee`）HUD 经济扫读、**CLIENT-082**（[#392](https://github.com/anitaguptaoffice/sanguo-slg/issues/392) / [#407](https://github.com/anitaguptaoffice/sanguo-slg/pull/407) `023e2524`）建造消耗预览、**CLIENT-083**（[#393](https://github.com/anitaguptaoffice/sanguo-slg/issues/393) / [#406](https://github.com/anitaguptaoffice/sanguo-slg/pull/406) `b081d127`）战报相邻导航、**CLIENT-084**（[#394](https://github.com/anitaguptaoffice/sanguo-slg/issues/394) / [#401](https://github.com/anitaguptaoffice/sanguo-slg/pull/401) `e19d0a71`）军团聊天草稿、**CLIENT-085**（[#395](https://github.com/anitaguptaoffice/sanguo-slg/issues/395) / [#408](https://github.com/anitaguptaoffice/sanguo-slg/pull/408) `48b0960c`）军情阶段提醒、**CLIENT-086**（[#396](https://github.com/anitaguptaoffice/sanguo-slg/issues/396) / [#409](https://github.com/anitaguptaoffice/sanguo-slg/pull/409) `77749bd8`）1280 军情战报主城 manifest、**CLIENT-087**（[#397](https://github.com/anitaguptaoffice/sanguo-slg/issues/397) / [#405](https://github.com/anitaguptaoffice/sanguo-slg/pull/405) `f647b4bc`）邮件附件批量领取与 **INTG-019**（[#398](https://github.com/anitaguptaoffice/sanguo-slg/issues/398) / [#404](https://github.com/anitaguptaoffice/sanguo-slg/pull/404) `2482fd64`）网关冒烟——H5 **出征提交反馈 + HUD 经济扫读 + 建造消耗预览 + 战报相邻导航 + 军团聊天草稿 + 军情阶段提醒 + 1280 军情战报主城 manifest + 邮件附件批量领取** 路径见 [client/README.md](../client/README.md#wave-22-出征执行反馈与主城经济扫读m4-出口--intg-019)、**DOCS-EXIT-014**（[#399](https://github.com/anitaguptaoffice/sanguo-slg/issues/399) / [#410](https://github.com/anitaguptaoffice/sanguo-slg/pull/410) `23a6f0ed`）；wave:23 **CLIENT-088**（[#412](https://github.com/anitaguptaoffice/sanguo-slg/issues/412) / [#423](https://github.com/anitaguptaoffice/sanguo-slg/pull/423) `d60d8345`）募兵消耗预览、**CLIENT-089**（[#413](https://github.com/anitaguptaoffice/sanguo-slg/issues/413) / [#429](https://github.com/anitaguptaoffice/sanguo-slg/pull/429) `b610caab`）出征汇总条、**CLIENT-090**（[#414](https://github.com/anitaguptaoffice/sanguo-slg/issues/414) / [#430](https://github.com/anitaguptaoffice/sanguo-slg/pull/430) `358f88aa`）小地图军情互选、**CLIENT-091**（[#415](https://github.com/anitaguptaoffice/sanguo-slg/issues/415) / [#426](https://github.com/anitaguptaoffice/sanguo-slg/pull/426) `f3523e87`）日常可领取定位、**CLIENT-092**（[#416](https://github.com/anitaguptaoffice/sanguo-slg/issues/416) / [#427](https://github.com/anitaguptaoffice/sanguo-slg/pull/427) `6394ddfb`）商城背包缺口对比、**CLIENT-093**（[#417](https://github.com/anitaguptaoffice/sanguo-slg/issues/417) / [#425](https://github.com/anitaguptaoffice/sanguo-slg/pull/425) `62dd6def`）军情再出征预填、**CLIENT-094**（[#418](https://github.com/anitaguptaoffice/sanguo-slg/issues/418) / [#428](https://github.com/anitaguptaoffice/sanguo-slg/pull/428) `f8152b2d`）战报键盘导航、**CLIENT-095**（[#419](https://github.com/anitaguptaoffice/sanguo-slg/issues/419) / [#431](https://github.com/anitaguptaoffice/sanguo-slg/pull/431) `7d19874f`）1280 背包商城军团 manifest 与 **INTG-020**（[#420](https://github.com/anitaguptaoffice/sanguo-slg/issues/420) / [#424](https://github.com/anitaguptaoffice/sanguo-slg/pull/424) `d27e863e`）网关冒烟——H5 **募兵消耗预览 + 出征汇总条 + 小地图军情互选 + 日常可领取定位 + 商城背包缺口对比 + 军情再出征预填 + 战报键盘导航 + 1280 背包商城军团 manifest** 路径见 [client/README.md](../client/README.md#wave-23-后勤互链与全链路反馈加深m4-出口--intg-020)、**DOCS-EXIT-015**（[#421](https://github.com/anitaguptaoffice/sanguo-slg/issues/421) / [#432](https://github.com/anitaguptaoffice/sanguo-slg/pull/432) `58ec47a2`）；wave:24 **CLIENT-096**（[#434](https://github.com/anitaguptaoffice/sanguo-slg/issues/434) / [#446](https://github.com/anitaguptaoffice/sanguo-slg/pull/446) `4f8821bc`）双榜钉选与刷新戳记、**CLIENT-097**（[#435](https://github.com/anitaguptaoffice/sanguo-slg/issues/435) / [#454](https://github.com/anitaguptaoffice/sanguo-slg/pull/454) `225ee845`）排行将领深链、**CLIENT-098**（[#436](https://github.com/anitaguptaoffice/sanguo-slg/issues/436) / [#450](https://github.com/anitaguptaoffice/sanguo-slg/pull/450) `fd5e0128`）招募执行反馈、**CLIENT-099**（[#437](https://github.com/anitaguptaoffice/sanguo-slg/issues/437) / [#451](https://github.com/anitaguptaoffice/sanguo-slg/pull/451) `c207b6c9`）将领列表记忆、**CLIENT-100**（[#438](https://github.com/anitaguptaoffice/sanguo-slg/issues/438) / [#453](https://github.com/anitaguptaoffice/sanguo-slg/pull/453) `91ee2474`）战报攻守摘要互链、**CLIENT-101**（[#439](https://github.com/anitaguptaoffice/sanguo-slg/issues/439) / [#448](https://github.com/anitaguptaoffice/sanguo-slg/pull/448) `d68c5f27`）军团职务分组、**CLIENT-102**（[#440](https://github.com/anitaguptaoffice/sanguo-slg/issues/440) / [#455](https://github.com/anitaguptaoffice/sanguo-slg/pull/455) `da139567`）聊天未读角标、**CLIENT-103**（[#441](https://github.com/anitaguptaoffice/sanguo-slg/issues/441) / [#449](https://github.com/anitaguptaoffice/sanguo-slg/pull/449) `62e13a90`）1280 排行将领日常 manifest 与 **INTG-021**（[#442](https://github.com/anitaguptaoffice/sanguo-slg/issues/442) / [#447](https://github.com/anitaguptaoffice/sanguo-slg/pull/447) `9eb18c48`）网关冒烟——H5 **双榜钉选 + 排行将领深链 + 招募执行反馈 + 将领列表记忆 + 战报攻守摘要互链 + 军团职务分组 + 聊天未读角标 + 1280 排行将领日常 manifest** 路径见 [client/README.md](../client/README.md#wave-24-h5-社交排行与将领执行反馈加深m4-出口--intg-021)、**DOCS-EXIT-016**（[#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443) / [#457](https://github.com/anitaguptaoffice/sanguo-slg/pull/457) `d1c517db`）；wave:25 **CLIENT-104**（[#460](https://github.com/anitaguptaoffice/sanguo-slg/issues/460) / [#471](https://github.com/anitaguptaoffice/sanguo-slg/pull/471) `7959d209`）主城建造提交反馈、**CLIENT-105**（[#461](https://github.com/anitaguptaoffice/sanguo-slg/issues/461) / [#476](https://github.com/anitaguptaoffice/sanguo-slg/pull/476) `dc0a3ba0`）队列完成脉冲与槽位互高亮、**CLIENT-106**（[#462](https://github.com/anitaguptaoffice/sanguo-slg/issues/462) / [#474](https://github.com/anitaguptaoffice/sanguo-slg/pull/474) `3a43d2b4`）邮件未读/未领附件 tab 角标、**CLIENT-107**（[#463](https://github.com/anitaguptaoffice/sanguo-slg/issues/463) / [#480](https://github.com/anitaguptaoffice/sanguo-slg/pull/480) `bb402f94`）HUD 待办角标单一事实源、**CLIENT-108**（[#464](https://github.com/anitaguptaoffice/sanguo-slg/issues/464) / [#478](https://github.com/anitaguptaoffice/sanguo-slg/pull/478) `5b984854`）世界格点信息卡加深、**CLIENT-109**（[#465](https://github.com/anitaguptaoffice/sanguo-slg/issues/465) / [#477](https://github.com/anitaguptaoffice/sanguo-slg/pull/477) `afb8861b`）军情/战报筛选记忆与世界复盘互链、**CLIENT-110**（[#466](https://github.com/anitaguptaoffice/sanguo-slg/issues/466) / [#479](https://github.com/anitaguptaoffice/sanguo-slg/pull/479) `683a4bb6`）ART-CHROME-006 运行时 UX、**CLIENT-111**（[#467](https://github.com/anitaguptaoffice/sanguo-slg/issues/467) / [#475](https://github.com/anitaguptaoffice/sanguo-slg/pull/475) `e722a9b6`）1280 主城/邮件/队列 manifest 与 **INTG-022**（[#468](https://github.com/anitaguptaoffice/sanguo-slg/issues/468) / [#472](https://github.com/anitaguptaoffice/sanguo-slg/pull/472) `d43f7777`）网关冒烟——H5 **主城建造提交与队列互跳 + 邮件未读附件角标 + HUD 待办一致 + 世界信息卡加深 + 军情战报筛选记忆 + ART-CHROME-006 运行时 UX + 1280 主城邮件队列 manifest** 路径见 [client/README.md](../client/README.md#wave-25-h5-主城队列邮件日常世界读图加深m4-出口--intg-022)、**DOCS-EXIT-017**（[#469](https://github.com/anitaguptaoffice/sanguo-slg/issues/469) / [#483](https://github.com/anitaguptaoffice/sanguo-slg/pull/483) `5752072e`）；wave:26 **CLIENT-112**（[#486](https://github.com/anitaguptaoffice/sanguo-slg/issues/486) / [#498](https://github.com/anitaguptaoffice/sanguo-slg/pull/498) `68a687de`）背包消耗提交脉冲、**CLIENT-113**（[#487](https://github.com/anitaguptaoffice/sanguo-slg/issues/487) / [#501](https://github.com/anitaguptaoffice/sanguo-slg/pull/501) `2b0702d4`）商城购买提交脉冲、**CLIENT-114**（[#488](https://github.com/anitaguptaoffice/sanguo-slg/issues/488) / [#497](https://github.com/anitaguptaoffice/sanguo-slg/pull/497) `11a68ff4`）将领招募提交巩固、**CLIENT-115**（[#489](https://github.com/anitaguptaoffice/sanguo-slg/issues/489) / [#504](https://github.com/anitaguptaoffice/sanguo-slg/pull/504) `bfac0925`）将领养成道具执行反馈、**CLIENT-116**（[#490](https://github.com/anitaguptaoffice/sanguo-slg/issues/490) / [#505](https://github.com/anitaguptaoffice/sanguo-slg/pull/505) `d4ea2d8d`）出征提交巩固、**CLIENT-117**（[#491](https://github.com/anitaguptaoffice/sanguo-slg/issues/491) / [#500](https://github.com/anitaguptaoffice/sanguo-slg/pull/500) `314a6396`）募兵提交脉冲、**CLIENT-118**（[#492](https://github.com/anitaguptaoffice/sanguo-slg/issues/492) / [#503](https://github.com/anitaguptaoffice/sanguo-slg/pull/503) `cabe8f0a`）ART-TOOLBAR-ICONS-007 四态接线、**CLIENT-119**（[#493](https://github.com/anitaguptaoffice/sanguo-slg/issues/493) / [#502](https://github.com/anitaguptaoffice/sanguo-slg/pull/502) `a36c1ae6`）1280 背包商城招募军事 manifest 与 **INTG-023**（[#494](https://github.com/anitaguptaoffice/sanguo-slg/issues/494) / [#499](https://github.com/anitaguptaoffice/sanguo-slg/pull/499) `92a96489`）网关冒烟——H5 **背包/商城消耗提交脉冲 + 将领招募与养成道具执行反馈 + 出征募兵提交巩固 + ART-TOOLBAR-ICONS-007 四态接线 + 1280 背包商城招募军事 manifest** 路径见 [client/README.md](../client/README.md#wave-26-h5-背包商城招募养成出征募兵反馈加深m4-出口--intg-023)、**DOCS-EXIT-018**（[#495](https://github.com/anitaguptaoffice/sanguo-slg/issues/495)）。工程修 **ART-CHROME-006** 选服对比度（[#473](https://github.com/anitaguptaoffice/sanguo-slg/pull/473) `39241c49`，非 backlog 实现卡）。里程碑 **DOCS-EXIT-002**（[#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152)）、**DOCS-EXIT-003**（[#168](https://github.com/anitaguptaoffice/sanguo-slg/issues/168)）、**DOCS-EXIT-004**（[#185](https://github.com/anitaguptaoffice/sanguo-slg/issues/185)）、**DOCS-EXIT-005**（[#202](https://github.com/anitaguptaoffice/sanguo-slg/issues/202)）、**DOCS-EXIT-006**（[#217](https://github.com/anitaguptaoffice/sanguo-slg/issues/217)）、**DOCS-EXIT-007**（[#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234) / [#242](https://github.com/anitaguptaoffice/sanguo-slg/pull/242)）、**DOCS-EXIT-008**（[#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) / [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261)）、**DOCS-EXIT-009**（[#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271) / [#278](https://github.com/anitaguptaoffice/sanguo-slg/pull/278) `af713f07`）。

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
| [#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271) | DOCS-EXIT-009 | 已完成 | [#278](https://github.com/anitaguptaoffice/sanguo-slg/pull/278)（`af713f07`） |

H5 人工验收与 **INTG-014** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-17-世界出征互链与复盘导航m4-出口--intg-014)（**小地图选点出征 + 战报坐标复盘 + 军事目标记忆 + 日常战报横幅 + 社交刷新**）。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；**CLIENT-040** 全页证据压缩（wave:16 美术轨单独跟进）。

**wave:17 美术轨（非本波 backlog 实现卡）**：**CLIENT-046**（[#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277)）中心四面板美术证据轨，与 wave:18 实现卡 **CLIENT-047** 起编号无关。

## Wave 18 H5 出征反馈与面板可读加深 — **已完成**

**策略**：在 wave:17 **小地图选点/战报复盘/目标记忆/日常横幅/社交刷新** 之上，加深 **军情 ETA 与列表密度**、**出征表单客户端校验**、**战报分页与筛选记忆**、**邮件领取与 HUD 同步**、**资源变动脉冲**、**建造队列↔日常互链** 与 **社交空错态统一**；网关 **INTG-015** 复跑 smoke（行军 `depart_at_ms`/`arrive_at_ms` + 战报 `ListBattleReports` 分页）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#281](https://github.com/anitaguptaoffice/sanguo-slg/issues/281) / 入库 PR（`9d19701a`）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#283](https://github.com/anitaguptaoffice/sanguo-slg/issues/283) | CLIENT-047 | 已完成 | [#294](https://github.com/anitaguptaoffice/sanguo-slg/pull/294)（`e2e4c367`） |
| [#284](https://github.com/anitaguptaoffice/sanguo-slg/issues/284) | CLIENT-048 | 已完成 | [#293](https://github.com/anitaguptaoffice/sanguo-slg/pull/293)（`0e460f7b`） |
| [#285](https://github.com/anitaguptaoffice/sanguo-slg/issues/285) | CLIENT-049 | 已完成 | [#297](https://github.com/anitaguptaoffice/sanguo-slg/pull/297)（`17a41ff2`） |
| [#286](https://github.com/anitaguptaoffice/sanguo-slg/issues/286) | CLIENT-050 | 已完成 | [#299](https://github.com/anitaguptaoffice/sanguo-slg/pull/299)（`b40c01f7`） |
| [#288](https://github.com/anitaguptaoffice/sanguo-slg/issues/288) | CLIENT-051 | 已完成 | [#295](https://github.com/anitaguptaoffice/sanguo-slg/pull/295)（`504a91ef`） |
| [#289](https://github.com/anitaguptaoffice/sanguo-slg/issues/289) | CLIENT-052 | 已完成 | [#296](https://github.com/anitaguptaoffice/sanguo-slg/pull/296)（`a94cb935`） |
| [#290](https://github.com/anitaguptaoffice/sanguo-slg/issues/290) | CLIENT-053 | 已完成 | [#298](https://github.com/anitaguptaoffice/sanguo-slg/pull/298)（`0b915f74`） |
| [#291](https://github.com/anitaguptaoffice/sanguo-slg/issues/291) | INTG-015 | 已完成 | [#301](https://github.com/anitaguptaoffice/sanguo-slg/pull/301)（`ee574240`） |
| [#292](https://github.com/anitaguptaoffice/sanguo-slg/issues/292) | DOCS-EXIT-010 | 已完成 | [#302](https://github.com/anitaguptaoffice/sanguo-slg/pull/302)（`b63ed954`） |

H5 人工验收与 **INTG-015** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-18-出征反馈与面板可读加深m4-出口--intg-015)（**军情 ETA + 出征校验 + 战报分页 + 邮件领取同步 + HUD 资源脉冲 + 队列日常互链 + 社交空错态**）。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；**CLIENT-046**（[#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277) / [#280](https://github.com/anitaguptaoffice/sanguo-slg/pull/280) `722256c2`）中心四面板美术证据轨——**非** wave:18 backlog 实现卡，与 **CLIENT-047** 起编号无关。

**wave:18 美术轨旁路（非 backlog 实现卡）**：**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）**已完成**——**CLIENT-046** 证据 FAIL 跟进修（纸底字色 + `ui.button.primary.v1` 接线 + 证据纠错），见 [`docs/art/samples/client-054/`](art/samples/client-054/README.md)。

## Wave 19 H5 可玩加深 — **已完成**

**策略**：在 wave:18 **军情 ETA/出征校验/战报分页/邮件同步/资源脉冲/队列日常互链/社交空错态** 之上，加深 **将领招募对比 + 钱包可负担**、**商城/背包客户端校验内联反馈**、**小地图目的点 ETA 角标与图例**、**建造/募兵队列与资源产出速率总览**、**邮件↔战报↔日常三角深链与来源标签**、**世界城池列表与军情行双向高亮** 与 **1280 将领/背包/队列 manifest 与滚动巩固**；网关 **INTG-016** 复跑 smoke（`GetHeroDetail` + `ListPlayerMail` 分页 + `GetCityState` 队列/建筑时间字段）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#304](https://github.com/anitaguptaoffice/sanguo-slg/pull/304)（`c84c87c8`）；Issue 映射 [#326](https://github.com/anitaguptaoffice/sanguo-slg/pull/326)。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#327](https://github.com/anitaguptaoffice/sanguo-slg/issues/327) | CLIENT-056 | 已完成 | [#341](https://github.com/anitaguptaoffice/sanguo-slg/pull/341)（`2006b478`） |
| [#328](https://github.com/anitaguptaoffice/sanguo-slg/issues/328) | CLIENT-057 | 已完成 | [#339](https://github.com/anitaguptaoffice/sanguo-slg/pull/339)（`22368a0f`） |
| [#329](https://github.com/anitaguptaoffice/sanguo-slg/issues/329) | CLIENT-058 | 已完成 | [#338](https://github.com/anitaguptaoffice/sanguo-slg/pull/338)（`eb8f8a26`） |
| [#330](https://github.com/anitaguptaoffice/sanguo-slg/issues/330) | CLIENT-059 | 已完成 | [#343](https://github.com/anitaguptaoffice/sanguo-slg/pull/343)（`6df0ef9f`） |
| [#331](https://github.com/anitaguptaoffice/sanguo-slg/issues/331) | CLIENT-060 | 已完成 | [#344](https://github.com/anitaguptaoffice/sanguo-slg/pull/344)（`97c99156`） |
| [#332](https://github.com/anitaguptaoffice/sanguo-slg/issues/332) | CLIENT-061 | 已完成 | [#342](https://github.com/anitaguptaoffice/sanguo-slg/pull/342)（`b2fb1a01`） |
| [#333](https://github.com/anitaguptaoffice/sanguo-slg/issues/333) | CLIENT-062 | 已完成 | [#340](https://github.com/anitaguptaoffice/sanguo-slg/pull/340)（`1d9ab72f`） |
| [#334](https://github.com/anitaguptaoffice/sanguo-slg/issues/334) | INTG-016 | 已完成 | [#337](https://github.com/anitaguptaoffice/sanguo-slg/pull/337)（`7ecb7d4d`） |
| [#335](https://github.com/anitaguptaoffice/sanguo-slg/issues/335) | DOCS-EXIT-011 | 已完成 | [#346](https://github.com/anitaguptaoffice/sanguo-slg/pull/346)（`d0920b5d`） |

H5 人工验收与 **INTG-016** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-19-可玩加深m4-出口--intg-016)（**将领招募对比 + 商城/背包校验 + 小地图 ETA + 队列资源总览 + 邮件战报日常互链 + 世界军情高亮 + 1280 manifest**；manifest 资产表见 [CLIENT-032 manifest 美术接线](../client/README.md#client-032-manifest-美术接线)）。

**wave:18 美术轨（非 wave:19 backlog 实现卡）**：**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）**已完成**；**CLIENT-055**（[#303](https://github.com/anitaguptaoffice/sanguo-slg/issues/303) / [#305](https://github.com/anitaguptaoffice/sanguo-slg/pull/305) `f675d43a`）wave:18 四面板 FAIL **余项** hotfix **已完成**——与 wave:19 实现卡 **CLIENT-056** 起编号无关。

**wave:19 美术轨旁路（非 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）已重拍 `queue-representative` 三视口证据，见 [`docs/art/samples/client-063/`](art/samples/client-063/README.md)；art hold **#108** 仍 FAIL → **CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）进行中（完整浏览器视口证据，停局部裁切）。**不**合并 art hold PR **#77** / **#82** / **#108**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY。

## Wave 20 H5 面板互链与反馈巩固 — **已完成**

**策略**：在 wave:19 **将领对比/经济校验/小地图 ETA/队列总览/邮件战报日常互链/世界军情高亮/1280 manifest** 之上，加深 **战报时间窗与胜负摘要**、**主城槽位→队列深链**、**招募/商城/背包/出征统一错误口径**、**邮件战报日常深链余量**、**军情格点筛选与小地图视野**、**1280 军事/邮件/日常 manifest** 与 **队列↔日常行内进度**；网关 **INTG-017** 复跑 smoke（`ListBattleReports` 时间/outcome 字段 + `GetCityState.production_rates` + `ListMarches` 目的格点）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#349](https://github.com/anitaguptaoffice/sanguo-slg/pull/349)（`314a813a`）；Issue 映射随 `tasks_sync` 入库（#350–#358）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#350](https://github.com/anitaguptaoffice/sanguo-slg/issues/350) | CLIENT-065 | 已完成 | [#360](https://github.com/anitaguptaoffice/sanguo-slg/pull/360)（`9396165e`） |
| [#351](https://github.com/anitaguptaoffice/sanguo-slg/issues/351) | CLIENT-066 | 已完成 | [#366](https://github.com/anitaguptaoffice/sanguo-slg/pull/366)（`a9788a83`） |
| [#352](https://github.com/anitaguptaoffice/sanguo-slg/issues/352) | CLIENT-067 | 已完成 | [#361](https://github.com/anitaguptaoffice/sanguo-slg/pull/361)（`f858c821`） |
| [#353](https://github.com/anitaguptaoffice/sanguo-slg/issues/353) | CLIENT-068 | 已完成 | [#363](https://github.com/anitaguptaoffice/sanguo-slg/pull/363)（`4af126c8`） |
| [#354](https://github.com/anitaguptaoffice/sanguo-slg/issues/354) | CLIENT-069 | 已完成 | [#362](https://github.com/anitaguptaoffice/sanguo-slg/pull/362)（`857e696e`） |
| [#355](https://github.com/anitaguptaoffice/sanguo-slg/issues/355) | CLIENT-070 | 已完成 | [#364](https://github.com/anitaguptaoffice/sanguo-slg/pull/364)（`944a3cdd`） |
| [#356](https://github.com/anitaguptaoffice/sanguo-slg/issues/356) | CLIENT-071 | 已完成 | [#359](https://github.com/anitaguptaoffice/sanguo-slg/pull/359)（`4ea9e69f`） |
| [#357](https://github.com/anitaguptaoffice/sanguo-slg/issues/357) | INTG-017 | 已完成 | [#365](https://github.com/anitaguptaoffice/sanguo-slg/pull/365)（`4b522cae`） |
| [#358](https://github.com/anitaguptaoffice/sanguo-slg/issues/358) | DOCS-EXIT-012 | 已完成 | [#367](https://github.com/anitaguptaoffice/sanguo-slg/pull/367)（`79f54e0d`） |

H5 人工验收与 **INTG-017** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-20-面板互链与反馈巩固m4-出口--intg-017)（**战报时间窗 + 主城槽位队列深链 + 经济错误统一 + 邮件战报日常深链 + 军情格点筛选 + 1280 军事邮件日常 manifest + 队列日常行内反馈**）。

**wave:19 美术轨旁路（非 wave:20 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:20 backlog 实现卡）。wave:20 实现卡 **CLIENT-065** 起，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY。

## Wave 21 H5 养成复盘与世界可读加深 — **已完成**

**策略**：在 wave:20 **战报时间窗/槽位队列/经济错误统一/邮件战报日常深链/军情筛选/1280 军事邮件日常 manifest/队列日常行内反馈** 之上，加深 **将领详情养成对比与招募背包互链**、**世界格点只读信息卡**、**战报回合跳转与部队摘要**、**日常筛选记忆与完成态扫读**、**排行军团聊天刷新巩固**、**HUD 待办深链余量**、**1280 将领/世界/排行 manifest** 与 **背包批量/商城分类扫读**；网关 **INTG-018** 复跑 smoke（`GetHeroDetail` 养成字段 + `GetBattleReport.rounds` + `ListPlayerQuests` 进度 + `ListPlayerCities` 格点）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#368](https://github.com/anitaguptaoffice/sanguo-slg/pull/368)（`tasks_sync` 已创建 #369–#378）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#369](https://github.com/anitaguptaoffice/sanguo-slg/issues/369) | CLIENT-072 | 已完成 | [#385](https://github.com/anitaguptaoffice/sanguo-slg/pull/385)（`03c8149b`） |
| [#370](https://github.com/anitaguptaoffice/sanguo-slg/issues/370) | CLIENT-073 | 已完成 | [#386](https://github.com/anitaguptaoffice/sanguo-slg/pull/386)（`87a2a8cb`） |
| [#371](https://github.com/anitaguptaoffice/sanguo-slg/issues/371) | CLIENT-074 | 已完成 | [#379](https://github.com/anitaguptaoffice/sanguo-slg/pull/379)（`4102f1a5`） |
| [#372](https://github.com/anitaguptaoffice/sanguo-slg/issues/372) | CLIENT-075 | 已完成 | [#381](https://github.com/anitaguptaoffice/sanguo-slg/pull/381)（`b0ca4ba5`） |
| [#373](https://github.com/anitaguptaoffice/sanguo-slg/issues/373) | CLIENT-076 | 已完成 | [#384](https://github.com/anitaguptaoffice/sanguo-slg/pull/384)（`439c1b67`） |
| [#374](https://github.com/anitaguptaoffice/sanguo-slg/issues/374) | CLIENT-077 | 已完成 | [#387](https://github.com/anitaguptaoffice/sanguo-slg/pull/387)（`e1d44182`） |
| [#375](https://github.com/anitaguptaoffice/sanguo-slg/issues/375) | CLIENT-078 | 已完成 | [#383](https://github.com/anitaguptaoffice/sanguo-slg/pull/383)（`8187d4f4`） |
| [#376](https://github.com/anitaguptaoffice/sanguo-slg/issues/376) | CLIENT-079 | 已完成 | [#382](https://github.com/anitaguptaoffice/sanguo-slg/pull/382)（`c9b53258`） |
| [#377](https://github.com/anitaguptaoffice/sanguo-slg/issues/377) | INTG-018 | 已完成 | [#380](https://github.com/anitaguptaoffice/sanguo-slg/pull/380)（`0a78b1d6`） |
| [#378](https://github.com/anitaguptaoffice/sanguo-slg/issues/378) | DOCS-EXIT-013 | 已完成 | [#388](https://github.com/anitaguptaoffice/sanguo-slg/pull/388)（`b5a1488e`） |

H5 人工验收与 **INTG-018** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-21-养成复盘与世界可读加深m4-出口--intg-018)（**将领养成对比 + 世界信息卡 + 战报回合跳转 + 日常筛选记忆 + 社交刷新巩固 + HUD 待办深链 + 1280 将领世界排行 manifest + 背包批量/商城分类**）。

**wave:19 美术轨旁路（非 wave:21 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:21 backlog 实现卡）。wave:21 实现卡 **CLIENT-072** 起，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY。

## Wave 22 H5 出征执行反馈与主城经济扫读 — **已完成**

**策略**：在 wave:21 **将领养成/世界信息卡/战报回合跳转/日常筛选/社交刷新/HUD 待办/1280 将领世界排行/背包批量商城分类** 之上，加深 **出征提交与军情新行军反馈**、**主城产出与仓库余量 HUD 扫读**、**建造下级消耗只读预览**、**战报相邻导航与胜负 streak**、**军团成员→聊天草稿一步**、**军情阶段变更提醒**、**1280 主城/军情/战报 manifest** 与 **邮件附件批量领取反馈**；网关 **INTG-019** 复跑 smoke（`GetCityState.resources` + `ListMarches.phase` + `ListGuildMembers` 条数）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#389](https://github.com/anitaguptaoffice/sanguo-slg/pull/389)（`b46ce7a8`）；Issue 映射随 `tasks_sync`（#390–#399）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#390](https://github.com/anitaguptaoffice/sanguo-slg/issues/390) | CLIENT-080 | 已完成 | [#403](https://github.com/anitaguptaoffice/sanguo-slg/pull/403)（`4a73aa2e`） |
| [#391](https://github.com/anitaguptaoffice/sanguo-slg/issues/391) | CLIENT-081 | 已完成 | [#402](https://github.com/anitaguptaoffice/sanguo-slg/pull/402)（`63a5dcee`） |
| [#392](https://github.com/anitaguptaoffice/sanguo-slg/issues/392) | CLIENT-082 | 已完成 | [#407](https://github.com/anitaguptaoffice/sanguo-slg/pull/407)（`023e2524`） |
| [#393](https://github.com/anitaguptaoffice/sanguo-slg/issues/393) | CLIENT-083 | 已完成 | [#406](https://github.com/anitaguptaoffice/sanguo-slg/pull/406)（`b081d127`） |
| [#394](https://github.com/anitaguptaoffice/sanguo-slg/issues/394) | CLIENT-084 | 已完成 | [#401](https://github.com/anitaguptaoffice/sanguo-slg/pull/401)（`e19d0a71`） |
| [#395](https://github.com/anitaguptaoffice/sanguo-slg/issues/395) | CLIENT-085 | 已完成 | [#408](https://github.com/anitaguptaoffice/sanguo-slg/pull/408)（`48b0960c`） |
| [#396](https://github.com/anitaguptaoffice/sanguo-slg/issues/396) | CLIENT-086 | 已完成 | [#409](https://github.com/anitaguptaoffice/sanguo-slg/pull/409)（`77749bd8`） |
| [#397](https://github.com/anitaguptaoffice/sanguo-slg/issues/397) | CLIENT-087 | 已完成 | [#405](https://github.com/anitaguptaoffice/sanguo-slg/pull/405)（`f647b4bc`） |
| [#398](https://github.com/anitaguptaoffice/sanguo-slg/issues/398) | INTG-019 | 已完成 | [#404](https://github.com/anitaguptaoffice/sanguo-slg/pull/404)（`2482fd64`） |
| [#399](https://github.com/anitaguptaoffice/sanguo-slg/issues/399) | DOCS-EXIT-014 | 已完成 | [#410](https://github.com/anitaguptaoffice/sanguo-slg/pull/410)（`23a6f0ed`） |

H5 人工验收与 **INTG-019** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-22-出征执行反馈与主城经济扫读m4-出口--intg-019)（**出征提交反馈 + HUD 经济扫读 + 建造消耗预览 + 战报相邻导航 + 军团聊天草稿 + 军情阶段提醒 + 1280 军情战报主城 manifest + 邮件附件批量领取**）。

**wave:19 美术轨旁路（非 wave:22 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:22 backlog 实现卡）。wave:22 实现卡 **CLIENT-080** 起，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY。

## Wave 23 H5 后勤互链与全链路反馈加深 — **已完成**

**策略**：在 wave:22 **出征提交反馈/HUD 经济扫读/建造消耗预览/战报相邻导航/军团聊天草稿/军情阶段提醒/1280 军情战报主城 manifest/邮件附件批量领取** 之上，加深 **募兵下一批消耗只读预览**、**出征表单 ETA 与兵力汇总条**、**小地图与军情高亮双向同步**、**日常可领取首条定位与领取脉冲**、**商城背包购买缺口对比**、**军情行打开军事预填再出征**、**战报相邻导航键盘与焦点环** 与 **1280 背包/商城/军团 manifest**；网关 **INTG-020** 复跑 smoke（`ListShopOffers` 价格字段 + `ListPlayerMail` 未领附件计数 + `GetCityState` 建筑 level）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#411](https://github.com/anitaguptaoffice/sanguo-slg/pull/411)（`83f94385`）；Issue 映射随 `tasks_sync`（#412–#421）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#412](https://github.com/anitaguptaoffice/sanguo-slg/issues/412) | CLIENT-088 | 已完成 | [#423](https://github.com/anitaguptaoffice/sanguo-slg/pull/423)（`d60d8345`） |
| [#413](https://github.com/anitaguptaoffice/sanguo-slg/issues/413) | CLIENT-089 | 已完成 | [#429](https://github.com/anitaguptaoffice/sanguo-slg/pull/429)（`b610caab`） |
| [#414](https://github.com/anitaguptaoffice/sanguo-slg/issues/414) | CLIENT-090 | 已完成 | [#430](https://github.com/anitaguptaoffice/sanguo-slg/pull/430)（`358f88aa`） |
| [#415](https://github.com/anitaguptaoffice/sanguo-slg/issues/415) | CLIENT-091 | 已完成 | [#426](https://github.com/anitaguptaoffice/sanguo-slg/pull/426)（`f3523e87`） |
| [#416](https://github.com/anitaguptaoffice/sanguo-slg/issues/416) | CLIENT-092 | 已完成 | [#427](https://github.com/anitaguptaoffice/sanguo-slg/pull/427)（`6394ddfb`） |
| [#417](https://github.com/anitaguptaoffice/sanguo-slg/issues/417) | CLIENT-093 | 已完成 | [#425](https://github.com/anitaguptaoffice/sanguo-slg/pull/425)（`62dd6def`） |
| [#418](https://github.com/anitaguptaoffice/sanguo-slg/issues/418) | CLIENT-094 | 已完成 | [#428](https://github.com/anitaguptaoffice/sanguo-slg/pull/428)（`f8152b2d`） |
| [#419](https://github.com/anitaguptaoffice/sanguo-slg/issues/419) | CLIENT-095 | 已完成 | [#431](https://github.com/anitaguptaoffice/sanguo-slg/pull/431)（`7d19874f`） |
| [#420](https://github.com/anitaguptaoffice/sanguo-slg/issues/420) | INTG-020 | 已完成 | [#424](https://github.com/anitaguptaoffice/sanguo-slg/pull/424)（`d27e863e`） |
| [#421](https://github.com/anitaguptaoffice/sanguo-slg/issues/421) | DOCS-EXIT-015 | 已完成 | [#432](https://github.com/anitaguptaoffice/sanguo-slg/pull/432)（`58ec47a2`） |

H5 人工验收与 **INTG-020** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-23-后勤互链与全链路反馈加深m4-出口--intg-020)（**募兵消耗预览 + 出征汇总条 + 小地图军情互选 + 日常可领取定位 + 商城背包缺口对比 + 军情再出征预填 + 战报键盘导航 + 1280 背包商城军团 manifest**）。

**wave:19 美术轨旁路（非 wave:23 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:23 backlog 实现卡）。wave:23 实现卡 **CLIENT-088** 起，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY。

## Wave 24 H5 社交排行与将领执行反馈加深 — **已完成**

**策略**：在 wave:23 **募兵/出征汇总/小地图军情互选/日常可领取/商城背包缺口/军情再出征/战报键盘/1280 背包商城军团 manifest** 之上，加深 **双榜我的排名钉选与刷新戳记**、**排行条目→将领详情深链**、**将领招募提交执行反馈**、**将领列表刷新与详情选中记忆**、**战报攻守模板摘要与排行互链**、**军团成员职务分组扫读**、**聊天未读与 HUD 社交角标同步** 与 **1280 排行/将领/日常 manifest**；网关 **INTG-021** 复跑 smoke（`GetLeaderboard` `my_rank`/`my_score` + `ListGuildMembers` `role` + 可选 `RecruitHero` 响应字段）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速。波次 backlog 规划 [#433](https://github.com/anitaguptaoffice/sanguo-slg/pull/433)（`8a182448`）；Issue 映射随 `tasks_sync`（#434–#443）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#434](https://github.com/anitaguptaoffice/sanguo-slg/issues/434) | CLIENT-096 | 已完成 | [#446](https://github.com/anitaguptaoffice/sanguo-slg/pull/446)（`4f8821bc`） |
| [#435](https://github.com/anitaguptaoffice/sanguo-slg/issues/435) | CLIENT-097 | 已完成 | [#454](https://github.com/anitaguptaoffice/sanguo-slg/pull/454)（`225ee845`） |
| [#436](https://github.com/anitaguptaoffice/sanguo-slg/issues/436) | CLIENT-098 | 已完成 | [#450](https://github.com/anitaguptaoffice/sanguo-slg/pull/450)（`fd5e0128`） |
| [#437](https://github.com/anitaguptaoffice/sanguo-slg/issues/437) | CLIENT-099 | 已完成 | [#451](https://github.com/anitaguptaoffice/sanguo-slg/pull/451)（`c207b6c9`） |
| [#438](https://github.com/anitaguptaoffice/sanguo-slg/issues/438) | CLIENT-100 | 已完成 | [#453](https://github.com/anitaguptaoffice/sanguo-slg/pull/453)（`91ee2474`） |
| [#439](https://github.com/anitaguptaoffice/sanguo-slg/issues/439) | CLIENT-101 | 已完成 | [#448](https://github.com/anitaguptaoffice/sanguo-slg/pull/448)（`d68c5f27`） |
| [#440](https://github.com/anitaguptaoffice/sanguo-slg/issues/440) | CLIENT-102 | 已完成 | [#455](https://github.com/anitaguptaoffice/sanguo-slg/pull/455)（`da139567`） |
| [#441](https://github.com/anitaguptaoffice/sanguo-slg/issues/441) | CLIENT-103 | 已完成 | [#449](https://github.com/anitaguptaoffice/sanguo-slg/pull/449)（`62e13a90`） |
| [#442](https://github.com/anitaguptaoffice/sanguo-slg/issues/442) | INTG-021 | 已完成 | [#447](https://github.com/anitaguptaoffice/sanguo-slg/pull/447)（`9eb18c48`） |
| [#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443) | DOCS-EXIT-016 | 已完成 | [#457](https://github.com/anitaguptaoffice/sanguo-slg/pull/457)（`d1c517db`） |

H5 人工验收与 **INTG-021** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-24-h5-社交排行与将领执行反馈加深m4-出口--intg-021)（**双榜钉选 + 排行将领深链 + 招募执行反馈 + 将领列表记忆 + 战报攻守摘要互链 + 军团职务分组 + 聊天未读角标 + 1280 排行将领日常 manifest**）。

**wave:19 美术轨旁路（非 wave:24 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:24 backlog 实现卡）。wave:24 实现卡 **CLIENT-096** 起，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444)；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；合并 art hold/VERIFY；**主城建造/募兵新 RPC** 或战报 proto 扩量（本波仅客户端执行反馈与只读深链）。

## Wave 25 H5 主城队列·邮件日常·世界读图加深 — **已完成**

**策略**：在 wave:24 **双榜钉选 / 排行将领深链 / 招募执行反馈 / 将领记忆 / 战报攻守互链 / 军团职务 / 聊天未读角标 / 1280 排行将领日常 manifest** 之上，轮转加深 **主城建造提交与队列行互跳反馈**、**邮件未读/未领附件与 HUD 待办角标一致**、**世界格点只读信息卡**、**军情列表与战报胜负筛选记忆**、**ART-CHROME-006 选服/HUD chrome 运行时小 UX**（#452/#456 已接线；工程对比度 [#473](https://github.com/anitaguptaoffice/sanguo-slg/pull/473) `39241c49`；**不**合并 #444/#108/#481）与 **1280 主城/邮件/队列 manifest**；网关 **INTG-022** 复跑 smoke（`GetCityState` 建造 `upgrade_finish_at_ms` + `ListPlayerMail` 未读 + 日常可领计数 + `ListPlayerCities` 格点）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速；**不**开主城建造/募兵新 RPC 或战报 proto 扩量。波次 backlog 规划 [#458](https://github.com/anitaguptaoffice/sanguo-slg/pull/458)（`7a6189ba`）；main tip 合入参考 `afb8861b`（#477 CLIENT-109 squash 末卡）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#460](https://github.com/anitaguptaoffice/sanguo-slg/issues/460) | CLIENT-104 | 已完成 | [#471](https://github.com/anitaguptaoffice/sanguo-slg/pull/471)（`7959d209`） |
| [#461](https://github.com/anitaguptaoffice/sanguo-slg/issues/461) | CLIENT-105 | 已完成 | [#476](https://github.com/anitaguptaoffice/sanguo-slg/pull/476)（`dc0a3ba0`） |
| [#462](https://github.com/anitaguptaoffice/sanguo-slg/issues/462) | CLIENT-106 | 已完成 | [#474](https://github.com/anitaguptaoffice/sanguo-slg/pull/474)（`3a43d2b4`） |
| [#463](https://github.com/anitaguptaoffice/sanguo-slg/issues/463) | CLIENT-107 | 已完成 | [#480](https://github.com/anitaguptaoffice/sanguo-slg/pull/480)（`bb402f94`） |
| [#464](https://github.com/anitaguptaoffice/sanguo-slg/issues/464) | CLIENT-108 | 已完成 | [#478](https://github.com/anitaguptaoffice/sanguo-slg/pull/478)（`5b984854`） |
| [#465](https://github.com/anitaguptaoffice/sanguo-slg/issues/465) | CLIENT-109 | 已完成 | [#477](https://github.com/anitaguptaoffice/sanguo-slg/pull/477)（`afb8861b`） |
| [#466](https://github.com/anitaguptaoffice/sanguo-slg/issues/466) | CLIENT-110 | 已完成 | [#479](https://github.com/anitaguptaoffice/sanguo-slg/pull/479)（`683a4bb6`） |
| [#467](https://github.com/anitaguptaoffice/sanguo-slg/issues/467) | CLIENT-111 | 已完成 | [#475](https://github.com/anitaguptaoffice/sanguo-slg/pull/475)（`e722a9b6`） |
| [#468](https://github.com/anitaguptaoffice/sanguo-slg/issues/468) | INTG-022 | 已完成 | [#472](https://github.com/anitaguptaoffice/sanguo-slg/pull/472)（`d43f7777`） |
| [#469](https://github.com/anitaguptaoffice/sanguo-slg/issues/469) | DOCS-EXIT-017 | 已完成 | [#483](https://github.com/anitaguptaoffice/sanguo-slg/pull/483)（`5752072e`） |

H5 人工验收与 **INTG-022** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-25-h5-主城队列邮件日常世界读图加深m4-出口--intg-022)（**主城建造提交与队列互跳 + 邮件未读附件角标 + HUD 待办一致 + 世界信息卡加深 + 军情战报筛选记忆 + ART-CHROME-006 运行时 UX + 1280 主城邮件队列 manifest**）。

**wave:19 美术轨旁路（非 wave:25 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:25 backlog 实现卡）。wave:25 实现卡 **CLIENT-104～111**，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481)（Draft）；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；合并 art hold/VERIFY；**世界瓦片/图集**仍暂缓。

## Wave 26 H5 背包商城·招募养成·出征募兵反馈加深 — **已完成**

**策略**：在 wave:25 **主城建造/队列互跳 / 邮件 HUD 待办 / 世界读图 / 军情战报筛选 / ART-CHROME-006 / 1280 主城邮件队列 manifest** 收口后，**轮转**加深尚未同题堆叠的 **背包/商城购买与消耗提交脉冲**、**将领招募与养成道具可读执行**、**出征/募兵提交反馈巩固**、**ART-TOOLBAR-ICONS-007 底栏四态运行时接线**（工程挂载 [#482](https://github.com/anitaguptaoffice/sanguo-slg/pull/482) `f1a3888a`；**不**合并 [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) Draft）与 **1280 背包/商城/招募/军事 manifest**；网关 **INTG-023** 复跑 smoke（`ListPlayerBag` 堆叠 + 可选 `PurchaseShopOffer` + `GetHeroDetail` level/loyalty + optional `RecruitTroop` + `ListMarches` phase）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速；**不**开主城建造/募兵新 RPC 或战报 proto 扩量；**世界瓦片/图集**仍暂缓。波次 backlog 规划 [#484](https://github.com/anitaguptaoffice/sanguo-slg/pull/484)（`90cef893`）；main tip 合入参考 `6c9d66cd`（#507 DOCS-EXIT-018）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#486](https://github.com/anitaguptaoffice/sanguo-slg/issues/486) | CLIENT-112 | 已完成 | [#498](https://github.com/anitaguptaoffice/sanguo-slg/pull/498)（`68a687de`） |
| [#487](https://github.com/anitaguptaoffice/sanguo-slg/issues/487) | CLIENT-113 | 已完成 | [#501](https://github.com/anitaguptaoffice/sanguo-slg/pull/501)（`2b0702d4`） |
| [#488](https://github.com/anitaguptaoffice/sanguo-slg/issues/488) | CLIENT-114 | 已完成 | [#497](https://github.com/anitaguptaoffice/sanguo-slg/pull/497)（`11a68ff4`） |
| [#489](https://github.com/anitaguptaoffice/sanguo-slg/issues/489) | CLIENT-115 | 已完成 | [#504](https://github.com/anitaguptaoffice/sanguo-slg/pull/504)（`bfac0925`） |
| [#490](https://github.com/anitaguptaoffice/sanguo-slg/issues/490) | CLIENT-116 | 已完成 | [#505](https://github.com/anitaguptaoffice/sanguo-slg/pull/505)（`d4ea2d8d`） |
| [#491](https://github.com/anitaguptaoffice/sanguo-slg/issues/491) | CLIENT-117 | 已完成 | [#500](https://github.com/anitaguptaoffice/sanguo-slg/pull/500)（`314a6396`） |
| [#492](https://github.com/anitaguptaoffice/sanguo-slg/issues/492) | CLIENT-118 | 已完成 | [#503](https://github.com/anitaguptaoffice/sanguo-slg/pull/503)（`cabe8f0a`） |
| [#493](https://github.com/anitaguptaoffice/sanguo-slg/issues/493) | CLIENT-119 | 已完成 | [#502](https://github.com/anitaguptaoffice/sanguo-slg/pull/502)（`a36c1ae6`） |
| [#494](https://github.com/anitaguptaoffice/sanguo-slg/issues/494) | INTG-023 | 已完成 | [#499](https://github.com/anitaguptaoffice/sanguo-slg/pull/499)（`92a96489`） |
| [#495](https://github.com/anitaguptaoffice/sanguo-slg/issues/495) | DOCS-EXIT-018 | 已完成 | [#507](https://github.com/anitaguptaoffice/sanguo-slg/pull/507)（`6c9d66cd`） |

H5 人工验收与 **INTG-023** 网关冒烟对齐，见 [client/README.md](../client/README.md#wave-26-h5-背包商城招募养成出征募兵反馈加深m4-出口--intg-023)（**背包/商城消耗提交脉冲 + 将领招募与养成道具执行反馈 + 出征募兵提交巩固 + ART-TOOLBAR-ICONS-007 四态接线 + 1280 背包商城招募军事 manifest**）。

**wave:19 美术轨旁路（非 wave:26 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:26 backlog 实现卡）。wave:26 实现卡 **CLIENT-112～119**，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）；**DATA-003**；`cfg_act*`；新道具/商城 SKU；`CancelMarch`/行军与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**灌入或全屏大地图——仍 out of core subset。

## Wave 27 H5 筛选列表·邮件日常军情战报可读加深 — **规划中**

**策略**：在 wave:26 **背包/商城/将领/出征募兵提交脉冲 / ART-TOOLBAR-ICONS-007 / 1280 经济军事 manifest** 收口后，**轮转**加深尚未同题堆叠的 **ART-UI-FILTER-008 工程挂载与运行时接线**（对照 ART-TOOLBAR **#482** `f1a3888a`；Draft [**#506**](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) 只读、**永不合并** #506/#481/#444/#108/#100/#77/#82）、**邮件/日常/军情/战报筛选 chip + 列表行九宫 + badge.dot/count 可读**（契约 **9** asset id / **18** PNG；count 固定 **20×16** 文案 **1–9/9+**；chip 命中 **≥44px** 工程补）、**1280 筛选条不裁切与列表滚动不挡底栏**；网关 **INTG-024** 复跑 smoke（保留 INTG-023，按本波客户端轻量扩展邮件未读/附件、日常可领、军情 phase、战报 outcome 摘要）。**仍** DATA-002；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch` 与募兵加速；**不**开主城建造/募兵新 RPC 或战报 proto 扩量；**世界瓦片/图集**仍暂缓。波次 backlog [#508](https://github.com/anitaguptaoffice/sanguo-slg/pull/508)（`ffd8bb51`）合入后由 `tasks_sync` 创建 Issue（[Actions 全量 sync](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/40041007668)）。

| Issue | 任务 | 状态 | 合并参考 |
|---|---|---|---|
| [#510](https://github.com/anitaguptaoffice/sanguo-slg/issues/510) | CLIENT-120 | 规划中 | ART-UI-FILTER-008 工程挂载 |
| [#511](https://github.com/anitaguptaoffice/sanguo-slg/issues/511) | CLIENT-121 | 规划中 | chip 运行时 + ≥44px |
| [#512](https://github.com/anitaguptaoffice/sanguo-slg/issues/512) | CLIENT-122 | 规划中 | 邮件筛选/行/角标 |
| [#513](https://github.com/anitaguptaoffice/sanguo-slg/issues/513) | CLIENT-123 | 规划中 | 日常筛选/行/角标 |
| [#514](https://github.com/anitaguptaoffice/sanguo-slg/issues/514) | CLIENT-124 | 规划中 | 军情筛选/行 |
| [#515](https://github.com/anitaguptaoffice/sanguo-slg/issues/515) | CLIENT-125 | 规划中 | 战报筛选/行 |
| [#516](https://github.com/anitaguptaoffice/sanguo-slg/issues/516) | CLIENT-126 | 规划中 | badge.dot/count 统一 |
| [#517](https://github.com/anitaguptaoffice/sanguo-slg/issues/517) | CLIENT-127 | 规划中 | 1280 筛选列表 manifest |
| [#518](https://github.com/anitaguptaoffice/sanguo-slg/issues/518) | INTG-024 | 规划中 | 网关冒烟 |
| [#519](https://github.com/anitaguptaoffice/sanguo-slg/issues/519) | DOCS-EXIT-019 | 待依赖 | 文档收口 |

**wave:19 美术轨旁路（非 wave:27 backlog 实现卡，不阻塞本波收口）**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:27 backlog 实现卡）。wave:27 实现卡 **CLIENT-120～127**，**勿占用 CLIENT-064**。

**明确不做**：合并或复制 art hold PR（#77/#82/#100/#108/#126/#140/#141/#144/#145/#153/#155/#177）或 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）；**DATA-003**；`cfg_act*`；新道具/商城 SKU；不可逆消费扩量；`CancelMarch`/行军与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；花钱类决策不做。

## 不做

跨服战、赛季、实时 PvP、移动原生、多语言——v1.0 范围外。

## 风险

| 风险 | 影响 | 对策 |
|---|---|---|
| 战斗规则复杂度被低估 | 工期翻倍 | MIL-001 先做原型，用对拍验证 |
| 客户端工作量占比高 | 阻塞上线 | 与 M0 并行启动，占位美术先跑通 |
| 契约频繁变更 | 并行失效 | 每周冻结评审 |
| legacy 全量 cfg 灌入 | 工期与合规风险 | wave7 核心子集上限，扩量单独开波次 |
