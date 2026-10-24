# 任务卡

`backlog.yml` 是任务清单的唯一真源。改完执行：

```bash
python3 tools/tasks_sync.py            # 同步到 GitHub Issues
python3 tools/tasks_sync.py --dry-run  # 先看会改什么
```

同步是幂等的：按 `[ID]` 前缀匹配，已存在的只更新内容与标签，不会重复创建。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | `域-序号`，如 `MIL-001`，全局唯一 |
| `title` | 是 | 一句话，动宾结构 |
| `wave` | 是 | 波次编号（wave:7+ 见 `docs/ROADMAP.md`） |
| `domain` | 是 | 归属域，决定标签与目录所有权 |
| `depends_on` | 是 | 依赖的任务 ID，空数组表示可立即开工 |
| `blocked_until` | 否 | 与 `depends_on` 并行的编排用：所列卡合并前本卡保持 `status:blocked` |
| `sync_status` | 否 | 可选 `ready` / `blocked`：覆盖 `tasks_sync.py` 默认标签（wave:8 依赖已合并时用 `ready`） |
| `size` | 是 | S（半天）/ M（1 天）/ L（2 天以上，建议再拆） |
| `owner_dir` | 是 | 允许修改的目录，CI 据此做越界检查 |
| `scope` | 否 | 允许修改的文件 glob |
| `out_of_scope` | 否 | 明确禁止修改的路径 |
| `acceptance` | 是 | 验收标准，必须可自动或人工验证 |
| `body` | 是 | 背景与实现要点，要能让 agent 独立开工 |

## 状态流转

```
status:blocked  ──依赖完成──▶  status:ready
status:ready    ──认领────▶  status:in-progress
status:in-progress ──提 PR──▶  status:review
status:review   ──合并────▶  status:done
```

状态靠标签维护，不改 YAML。YAML 只描述"任务是什么"，GitHub 描述"做到哪了"。

## 写卡的三条硬要求

1. **能独立开工**：不读其他代码也能动手。
2. **边界可判定**：scope 之外的改动必须能被 CI 拦住。
3. **验收可验证**：不写"实现良好"这种话。

## 当前波次

| 波次 | 内容 | 任务 |
|---|---|---|
| 1 | 规格 + 骨架 + 最高风险原型 | SPEC-001~004, PLAT-001~003, MIL-001, CLIENT-001 |
| 2 | 各业务域并行 | ACC-001, WORLD-001, DOM-001, MIL-002 |
| 3 | M1 串联 + 将领/道具/战报 | INTG-001, HERO-001, CONTENT-001, MIL-003, CLIENT-002 |
| 4 | M2 战斗闭环 + 内政落库 | DOM-002, MIL-004, MIL-005, INTG-002, CLIENT-003, CONTRACT-001（可选契约） |
| 5 | M3 多人 | CONTRACT-002, SPEC-005, PLAT-004, CHAT-001, RANK-001, GUILD-001/002, INTG-003, CLIENT-004 |
| 6 | M4 内容 | CONTRACT-003, SPEC-006, QUEST-001, CONTENT-002, SHOP-001, GM-001, INTG-004, CLIENT-005 |
| 7 | 对齐：核心 cfg 子集 | SPEC-ALIGN-001, DATA-001, PERSIST-001~003, ECON-001, GM-002, RULES-ALIGN-001；复跑 INTG-004 / CLIENT-005 |
| 8 | M3/M4 出口加固（**已完成**，见 ROADMAP Wave 8） | INTG-005 (#125), CLIENT-006 (#121), RANK-002 (#122), LOAD-001 (#123), OPS-OPEN-001 (#120), TELEMETRY-001 (#124) |
| 9 | 核心 cfg 第二批 + 养成/邮件/横屏（**已完成**） | 见下表 |
| 10 | M4 玩法加深（**已完成**，见 ROADMAP Wave 10） | CLIENT-008 (#156), HERO-003 (#158), QUEST-002 (#157), GM-003 (#154), INTG-007 (#159), DOCS-EXIT-002 (#160) |
| 11 | H5 日常可玩环（**已完成**，见 ROADMAP Wave 11） | CLIENT-009–012 (#169–#172), QUEST-003 (#173), INTG-008 (#174), DOCS-EXIT-003 (#168/#175) |
| 12 | H5 可玩加深（**已完成**，见 ROADMAP Wave 12） | CLIENT-013–018 (#186–#191), INTG-009 (#192), DOCS-EXIT-004 (#194) |
| 13 | H5 闭环加深（**已完成**，见 ROADMAP Wave 13） | CLIENT-019–023 (#204–#208), INTG-010 (#203), DOCS-EXIT-005 ([#202](https://github.com/anitaguptaoffice/sanguo-slg/issues/202)/[#209](https://github.com/anitaguptaoffice/sanguo-slg/pull/209)) |
| 14 | H5 日常与队列闭环（**已完成**，见 ROADMAP Wave 14） | DOM-003 ([#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)), CLIENT-024–027 ([#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)–[#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)), INTG-011 ([#223](https://github.com/anitaguptaoffice/sanguo-slg/pull/223)), DOCS-EXIT-006 ([#225](https://github.com/anitaguptaoffice/sanguo-slg/pull/225) `077e4937`) |
| 15 | H5 世界地图与面板密度（**已完成**，见 ROADMAP Wave 15） | CLIENT-028–032 ([#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)–[#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)、[#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238) `e084ac8f`), INTG-012 ([#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237)), DOCS-EXIT-007 ([#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234)/[#242](https://github.com/anitaguptaoffice/sanguo-slg/pull/242)) |
| 16 | H5 战报邮件闭环与军事反馈加深（**已完成**，见 ROADMAP Wave 16） | CLIENT-034–039、INTG-013、DOCS-EXIT-008（[#245](https://github.com/anitaguptaoffice/sanguo-slg/pull/245) / [#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261) `58bd03b7`） |
| 17 | H5 世界出征互链与复盘导航（**已完成**，见 ROADMAP Wave 17） | CLIENT-041–045 ([#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275)–[#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279)、[#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272)、[#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273)）、INTG-014 ([#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274) `90fb5356`)、DOCS-EXIT-009 ([#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271) / [#278](https://github.com/anitaguptaoffice/sanguo-slg/pull/278) `af713f07`) |
| 18 | H5 出征反馈与面板可读加深（**已完成**，见 ROADMAP Wave 18） | CLIENT-047–053 ([#293](https://github.com/anitaguptaoffice/sanguo-slg/pull/293)–[#299](https://github.com/anitaguptaoffice/sanguo-slg/pull/299)、[#295](https://github.com/anitaguptaoffice/sanguo-slg/pull/295)–[#298](https://github.com/anitaguptaoffice/sanguo-slg/pull/298))、INTG-015 ([#301](https://github.com/anitaguptaoffice/sanguo-slg/pull/301) `ee574240`)、DOCS-EXIT-010 ([#302](https://github.com/anitaguptaoffice/sanguo-slg/pull/302) `b63ed954`)；**CLIENT-046** [#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277) 美术证据轨、**CLIENT-054** [#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) 046 FAIL 跟进（[#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`） |
| 19 | H5 可玩加深（**已完成**，见 ROADMAP Wave 19） | CLIENT-056–062 ([#339](https://github.com/anitaguptaoffice/sanguo-slg/pull/339)–[#344](https://github.com/anitaguptaoffice/sanguo-slg/pull/344)、[#340](https://github.com/anitaguptaoffice/sanguo-slg/pull/340)–[#342](https://github.com/anitaguptaoffice/sanguo-slg/pull/342)、[#341](https://github.com/anitaguptaoffice/sanguo-slg/pull/341) `2006b478`)、INTG-016 ([#337](https://github.com/anitaguptaoffice/sanguo-slg/pull/337) `7ecb7d4d`)、DOCS-EXIT-011 ([#335](https://github.com/anitaguptaoffice/sanguo-slg/issues/335) / [#346](https://github.com/anitaguptaoffice/sanguo-slg/pull/346) `d0920b5d`)；**CLIENT-054**/**CLIENT-055** wave:18 美术 hotfix——**非**本波 backlog；**CLIENT-063** [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) 已合、**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路 |
| 20 | H5 面板互链与反馈巩固（**已完成**，见 ROADMAP Wave 20） | CLIENT-065–071 ([#360](https://github.com/anitaguptaoffice/sanguo-slg/pull/360)–[#364](https://github.com/anitaguptaoffice/sanguo-slg/pull/364)、[#359](https://github.com/anitaguptaoffice/sanguo-slg/pull/359) `4ea9e69f`)、INTG-017 ([#365](https://github.com/anitaguptaoffice/sanguo-slg/pull/365) `4b522cae`)、DOCS-EXIT-012 ([#358](https://github.com/anitaguptaoffice/sanguo-slg/issues/358) / [#367](https://github.com/anitaguptaoffice/sanguo-slg/pull/367) `79f54e0d`)；**CLIENT-063** [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) 已合、**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) wave:19 美术旁路——**非**本波 backlog 实现卡 |
| 21 | H5 养成复盘与世界可读加深（**已完成**，见 ROADMAP Wave 21） | CLIENT-072–079 ([#385](https://github.com/anitaguptaoffice/sanguo-slg/pull/385)–[#382](https://github.com/anitaguptaoffice/sanguo-slg/pull/382) `03c8149b`–`c9b53258`)、INTG-018 ([#377](https://github.com/anitaguptaoffice/sanguo-slg/issues/377) / [#380](https://github.com/anitaguptaoffice/sanguo-slg/pull/380) `0a78b1d6`)、DOCS-EXIT-013 ([#378](https://github.com/anitaguptaoffice/sanguo-slg/issues/378) / [#388](https://github.com/anitaguptaoffice/sanguo-slg/pull/388) `b5a1488e`)；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 22 | H5 出征执行反馈与主城经济扫读（**已完成**，见 ROADMAP Wave 22） | CLIENT-080–087（[#401](https://github.com/anitaguptaoffice/sanguo-slg/pull/401)–[#409](https://github.com/anitaguptaoffice/sanguo-slg/pull/409) `e19d0a71`–`48b0960c`）、INTG-019 ([#398](https://github.com/anitaguptaoffice/sanguo-slg/issues/398) / [#404](https://github.com/anitaguptaoffice/sanguo-slg/pull/404) `2482fd64`)、DOCS-EXIT-014 ([#399](https://github.com/anitaguptaoffice/sanguo-slg/issues/399) / [#410](https://github.com/anitaguptaoffice/sanguo-slg/pull/410) `23a6f0ed`)；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 23 | H5 后勤互链与全链路反馈加深（**已完成**，见 ROADMAP Wave 23） | CLIENT-088–095（[#423](https://github.com/anitaguptaoffice/sanguo-slg/pull/423)–[#431](https://github.com/anitaguptaoffice/sanguo-slg/pull/431) `d60d8345`–`7d19874f`）、INTG-020 ([#420](https://github.com/anitaguptaoffice/sanguo-slg/issues/420) / [#424](https://github.com/anitaguptaoffice/sanguo-slg/pull/424) `d27e863e`)、DOCS-EXIT-015 ([#421](https://github.com/anitaguptaoffice/sanguo-slg/issues/421) / [#432](https://github.com/anitaguptaoffice/sanguo-slg/pull/432) `58ec47a2`)；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 24 | H5 社交排行与将领执行反馈加深（**已完成**，见 ROADMAP Wave 24） | CLIENT-096–103（[#446](https://github.com/anitaguptaoffice/sanguo-slg/pull/446)–[#455](https://github.com/anitaguptaoffice/sanguo-slg/pull/455) `4f8821bc`–`da139567`）、INTG-021 ([#442](https://github.com/anitaguptaoffice/sanguo-slg/issues/442) / [#447](https://github.com/anitaguptaoffice/sanguo-slg/pull/447) `9eb18c48`)、DOCS-EXIT-016 ([#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443) / [#457](https://github.com/anitaguptaoffice/sanguo-slg/pull/457) `d1c517db`）；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 25 | H5 主城队列·邮件日常·世界读图加深（**已完成**，见 ROADMAP Wave 25） | CLIENT-104–111（[#471](https://github.com/anitaguptaoffice/sanguo-slg/pull/471)–[#480](https://github.com/anitaguptaoffice/sanguo-slg/pull/480) `7959d209`–`afb8861b`）、INTG-022 ([#468](https://github.com/anitaguptaoffice/sanguo-slg/issues/468) / [#472](https://github.com/anitaguptaoffice/sanguo-slg/pull/472) `d43f7777`)、DOCS-EXIT-017 ([#469](https://github.com/anitaguptaoffice/sanguo-slg/issues/469) / [#483](https://github.com/anitaguptaoffice/sanguo-slg/pull/483) `5752072e`)；**ART-CHROME-006** [#473](https://github.com/anitaguptaoffice/sanguo-slg/pull/473) 工程修——**非** backlog 实现卡；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 26 | H5 背包商城·招募养成·出征募兵反馈加深（**已完成**，见 ROADMAP Wave 26） | CLIENT-112–119（[#486](https://github.com/anitaguptaoffice/sanguo-slg/issues/486)–[#493](https://github.com/anitaguptaoffice/sanguo-slg/issues/493)；合入 [#498](https://github.com/anitaguptaoffice/sanguo-slg/pull/498) `68a687de`–[#502](https://github.com/anitaguptaoffice/sanguo-slg/pull/502) `a36c1ae6`）、INTG-023 ([#494](https://github.com/anitaguptaoffice/sanguo-slg/issues/494) / [#499](https://github.com/anitaguptaoffice/sanguo-slg/pull/499) `92a96489`)、DOCS-EXIT-018 ([#495](https://github.com/anitaguptaoffice/sanguo-slg/issues/495) / [#507](https://github.com/anitaguptaoffice/sanguo-slg/pull/507) `6c9d66cd`）；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 27 | H5 筛选列表·邮件日常军情战报可读加深（**已完成**，见 ROADMAP Wave 27） | CLIENT-120–127（[#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509) `50e052f0`–[#527](https://github.com/anitaguptaoffice/sanguo-slg/pull/527) `8c45fa1a`）、INTG-024 ([#518](https://github.com/anitaguptaoffice/sanguo-slg/issues/518) / [#521](https://github.com/anitaguptaoffice/sanguo-slg/pull/521) `aa64edb2`)、DOCS-EXIT-019 ([#519](https://github.com/anitaguptaoffice/sanguo-slg/issues/519) / [#529](https://github.com/anitaguptaoffice/sanguo-slg/pull/529) `bb4437e4`)；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 28 | H5 主城七槽·将领养成·HUD深链·面板态可读加深（**已完成**，见 ROADMAP Wave 28） | CLIENT-128–135（[#532](https://github.com/anitaguptaoffice/sanguo-slg/issues/532)–[#539](https://github.com/anitaguptaoffice/sanguo-slg/issues/539)；合入 [#544](https://github.com/anitaguptaoffice/sanguo-slg/pull/544)–[#553](https://github.com/anitaguptaoffice/sanguo-slg/pull/553) `68bafda8`–`747c0505`）、INTG-025 ([#540](https://github.com/anitaguptaoffice/sanguo-slg/issues/540) / [#545](https://github.com/anitaguptaoffice/sanguo-slg/pull/545) `508a7ac2`)、DOCS-EXIT-020 ([#541](https://github.com/anitaguptaoffice/sanguo-slg/issues/541) / [#555](https://github.com/anitaguptaoffice/sanguo-slg/pull/555) `9ef14ce6`)；**CLIENT-136** [#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) 工程修——**非** backlog 实现卡；**CLIENT-064** [#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347) 美术旁路——**非**本波 backlog 实现卡 |
| 29 | H5 世界行军互链·军情战报复盘·邮件社交扫读加深（**已完成**，见 ROADMAP Wave 29） | CLIENT-138–145（[#558](https://github.com/anitaguptaoffice/sanguo-slg/issues/558)–[#565](https://github.com/anitaguptaoffice/sanguo-slg/issues/565)；合入 [#569](https://github.com/anitaguptaoffice/sanguo-slg/pull/569)–[#577](https://github.com/anitaguptaoffice/sanguo-slg/pull/577) `bd3b30dd`–`f60e3e95`）、INTG-026 ([#566](https://github.com/anitaguptaoffice/sanguo-slg/issues/566) / [#568](https://github.com/anitaguptaoffice/sanguo-slg/pull/568) `71537297`)、DOCS-EXIT-021 ([#567](https://github.com/anitaguptaoffice/sanguo-slg/issues/567) / [#581](https://github.com/anitaguptaoffice/sanguo-slg/pull/581) `924a2834`）；**CLIENT-137** [#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574) 与 **CLIENT-146** [#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579) 美术旁路——**非**本波 backlog 实现卡 |
| 30 | H5 主城产出仓库·日常领取闭环·将领列表筛选扫读·双榜刷新加深（**已完成**，见 ROADMAP Wave 30） | CLIENT-148–155（[#584](https://github.com/anitaguptaoffice/sanguo-slg/issues/584)–[#591](https://github.com/anitaguptaoffice/sanguo-slg/issues/591)；合入 [#601](https://github.com/anitaguptaoffice/sanguo-slg/pull/601) `873b8158`–[#602](https://github.com/anitaguptaoffice/sanguo-slg/pull/602) `6978ebac`）、INTG-027 ([#592](https://github.com/anitaguptaoffice/sanguo-slg/issues/592) / [#595](https://github.com/anitaguptaoffice/sanguo-slg/pull/595) `ca125b9e`)、DOCS-EXIT-022 ([#593](https://github.com/anitaguptaoffice/sanguo-slg/issues/593) / [#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604) `ad278a7c`)；**CLIENT-064** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** 美术旁路——**非**本波 backlog 实现卡 |
| 31 | H5 出征募兵执行反馈巩固·战报相邻导航加深·邮件批量领取·军团聊天草稿未读·HUD 待办一致（**已完成**，见 ROADMAP Wave 31） | CLIENT-156–163（[#606](https://github.com/anitaguptaoffice/sanguo-slg/issues/606)–[#613](https://github.com/anitaguptaoffice/sanguo-slg/issues/613)；合入 [#618](https://github.com/anitaguptaoffice/sanguo-slg/pull/618) `dde3cba9`–[#624](https://github.com/anitaguptaoffice/sanguo-slg/pull/624) `5ffcb5af`）、INTG-028 ([#614](https://github.com/anitaguptaoffice/sanguo-slg/issues/614) / [#616](https://github.com/anitaguptaoffice/sanguo-slg/pull/616) `8d8aac12`)、DOCS-EXIT-023 ([#615](https://github.com/anitaguptaoffice/sanguo-slg/issues/615) / [#625](https://github.com/anitaguptaoffice/sanguo-slg/pull/625) `status:review`)；**CLIENT-064** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** 美术旁路——**非**本波 backlog 实现卡 |

### Wave 9 进度（已完成）

| Issue | ID | 状态 |
|---|---|---|
| [#128](https://github.com/anitaguptaoffice/sanguo-slg/issues/128) | DATA-002 | `status:done`（#137） |
| [#129](https://github.com/anitaguptaoffice/sanguo-slg/issues/129) | CLIENT-007 | `status:done`（#135） |
| [#130](https://github.com/anitaguptaoffice/sanguo-slg/issues/130) | MAIL-001 | `status:done`（#136） |
| [#131](https://github.com/anitaguptaoffice/sanguo-slg/issues/131) | DOCS-EXIT-001 | `status:done`（#134） |
| [#132](https://github.com/anitaguptaoffice/sanguo-slg/issues/132) | HERO-002 | `status:done`（#139） |
| [#133](https://github.com/anitaguptaoffice/sanguo-slg/issues/133) | INTG-006 | `status:done`（#138） |

### Wave 10 进度（已完成）

| Issue | ID | 状态 |
|---|---|---|
| [#147](https://github.com/anitaguptaoffice/sanguo-slg/issues/147) | CLIENT-008 | `status:done`（[#156](https://github.com/anitaguptaoffice/sanguo-slg/pull/156)） |
| [#148](https://github.com/anitaguptaoffice/sanguo-slg/issues/148) | HERO-003 | `status:done`（[#158](https://github.com/anitaguptaoffice/sanguo-slg/pull/158)） |
| [#149](https://github.com/anitaguptaoffice/sanguo-slg/issues/149) | QUEST-002 | `status:done`（[#157](https://github.com/anitaguptaoffice/sanguo-slg/pull/157)） |
| [#150](https://github.com/anitaguptaoffice/sanguo-slg/issues/150) | GM-003 | `status:done`（[#154](https://github.com/anitaguptaoffice/sanguo-slg/pull/154)） |
| [#151](https://github.com/anitaguptaoffice/sanguo-slg/issues/151) | INTG-007 | `status:done`（[#159](https://github.com/anitaguptaoffice/sanguo-slg/pull/159)） |
| [#152](https://github.com/anitaguptaoffice/sanguo-slg/issues/152) | DOCS-EXIT-002 | `status:done`（[#160](https://github.com/anitaguptaoffice/sanguo-slg/pull/160)） |

### Wave 11 进度（与 GitHub `wave:11` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#162](https://github.com/anitaguptaoffice/sanguo-slg/issues/162) | CLIENT-009 | `status:done`（[#169](https://github.com/anitaguptaoffice/sanguo-slg/pull/169)） |
| [#163](https://github.com/anitaguptaoffice/sanguo-slg/issues/163) | CLIENT-010 | `status:done`（[#171](https://github.com/anitaguptaoffice/sanguo-slg/pull/171)） |
| [#164](https://github.com/anitaguptaoffice/sanguo-slg/issues/164) | QUEST-003 | `status:done`（[#173](https://github.com/anitaguptaoffice/sanguo-slg/pull/173)） |
| [#165](https://github.com/anitaguptaoffice/sanguo-slg/issues/165) | CLIENT-011 | `status:done`（[#172](https://github.com/anitaguptaoffice/sanguo-slg/pull/172)） |
| [#166](https://github.com/anitaguptaoffice/sanguo-slg/issues/166) | CLIENT-012 | `status:done`（[#170](https://github.com/anitaguptaoffice/sanguo-slg/pull/170)） |
| [#167](https://github.com/anitaguptaoffice/sanguo-slg/issues/167) | INTG-008 | `status:done`（[#174](https://github.com/anitaguptaoffice/sanguo-slg/pull/174)） |
| [#168](https://github.com/anitaguptaoffice/sanguo-slg/issues/168) | DOCS-EXIT-003 | `status:done`（[#175](https://github.com/anitaguptaoffice/sanguo-slg/pull/175)） |

### Wave 12 进度（与 GitHub `wave:12` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#178](https://github.com/anitaguptaoffice/sanguo-slg/issues/178) | CLIENT-013 | `status:done`（[#188](https://github.com/anitaguptaoffice/sanguo-slg/pull/188)） |
| [#179](https://github.com/anitaguptaoffice/sanguo-slg/issues/179) | CLIENT-014 | `status:done`（[#187](https://github.com/anitaguptaoffice/sanguo-slg/pull/187)） |
| [#180](https://github.com/anitaguptaoffice/sanguo-slg/issues/180) | CLIENT-015 | `status:done`（[#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)） |
| [#181](https://github.com/anitaguptaoffice/sanguo-slg/issues/181) | CLIENT-016 | `status:done`（[#189](https://github.com/anitaguptaoffice/sanguo-slg/pull/189)） |
| [#182](https://github.com/anitaguptaoffice/sanguo-slg/issues/182) | CLIENT-017 | `status:done`（[#190](https://github.com/anitaguptaoffice/sanguo-slg/pull/190)） |
| [#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) | CLIENT-018 | `status:done`（[#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191)） |
| [#184](https://github.com/anitaguptaoffice/sanguo-slg/issues/184) | INTG-009 | `status:done`（[#192](https://github.com/anitaguptaoffice/sanguo-slg/pull/192)） |
| [#185](https://github.com/anitaguptaoffice/sanguo-slg/issues/185) | DOCS-EXIT-004 | `status:done`（[#194](https://github.com/anitaguptaoffice/sanguo-slg/pull/194)） |

### Wave 13 进度（与 GitHub `wave:13` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#196](https://github.com/anitaguptaoffice/sanguo-slg/issues/196) | CLIENT-019 | `status:done`（[#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206)） |
| [#197](https://github.com/anitaguptaoffice/sanguo-slg/issues/197) | CLIENT-020 | `status:done`（[#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204)） |
| [#198](https://github.com/anitaguptaoffice/sanguo-slg/issues/198) | CLIENT-021 | `status:done`（[#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207)） |
| [#199](https://github.com/anitaguptaoffice/sanguo-slg/issues/199) | CLIENT-022 | `status:done`（[#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205)） |
| [#200](https://github.com/anitaguptaoffice/sanguo-slg/issues/200) | CLIENT-023 | `status:done`（[#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208)） |
| [#201](https://github.com/anitaguptaoffice/sanguo-slg/issues/201) | INTG-010 | `status:done`（[#203](https://github.com/anitaguptaoffice/sanguo-slg/pull/203)） |
| [#202](https://github.com/anitaguptaoffice/sanguo-slg/issues/202) | DOCS-EXIT-005 | `status:done`（[#209](https://github.com/anitaguptaoffice/sanguo-slg/pull/209)） |

### Wave 14 进度（与 GitHub `wave:14` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#211](https://github.com/anitaguptaoffice/sanguo-slg/issues/211) | DOM-003 | `status:done`（[#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221) `d99004b7`） |
| [#212](https://github.com/anitaguptaoffice/sanguo-slg/issues/212) | CLIENT-024 | `status:done`（[#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220) `64bc77cb`） |
| [#213](https://github.com/anitaguptaoffice/sanguo-slg/issues/213) | CLIENT-025 | `status:done`（[#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219) `67721178`） |
| [#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214) | CLIENT-026 | `status:done`（[#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222) `0e0cef67`） |
| [#215](https://github.com/anitaguptaoffice/sanguo-slg/issues/215) | CLIENT-027 | `status:done`（[#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224) `95aac888`） |
| [#216](https://github.com/anitaguptaoffice/sanguo-slg/issues/216) | INTG-011 | `status:done`（[#223](https://github.com/anitaguptaoffice/sanguo-slg/pull/223) `ad6ddc8e`） |
| [#217](https://github.com/anitaguptaoffice/sanguo-slg/issues/217) | DOCS-EXIT-006 | `status:done`（[#225](https://github.com/anitaguptaoffice/sanguo-slg/pull/225) `077e4937`） |

### Wave 15 进度（与 GitHub `wave:15` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#228](https://github.com/anitaguptaoffice/sanguo-slg/issues/228) | CLIENT-028 | `status:done`（[#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241) `dbee7a40`） |
| [#229](https://github.com/anitaguptaoffice/sanguo-slg/issues/229) | CLIENT-029 | `status:done`（[#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238) `e084ac8f`） |
| [#230](https://github.com/anitaguptaoffice/sanguo-slg/issues/230) | CLIENT-030 | `status:done`（[#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236) `e3019f34`） |
| [#231](https://github.com/anitaguptaoffice/sanguo-slg/issues/231) | CLIENT-031 | `status:done`（[#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235) `58a95775`） |
| [#232](https://github.com/anitaguptaoffice/sanguo-slg/issues/232) | CLIENT-032 | `status:done`（[#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240) `1825858d`） |
| [#233](https://github.com/anitaguptaoffice/sanguo-slg/issues/233) | INTG-012 | `status:done`（[#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237) `7f812896`） |
| [#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234) | DOCS-EXIT-007 | `status:done`（[#242](https://github.com/anitaguptaoffice/sanguo-slg/pull/242) `967d02f`） |

**wave:15 hotfix**（不重复进 wave:16 卡）：[#243](https://github.com/anitaguptaoffice/sanguo-slg/issues/243) **CLIENT-033** `status:done`（[#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`）。

### Wave 16 进度（与 GitHub `wave:16` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#246](https://github.com/anitaguptaoffice/sanguo-slg/issues/246) | CLIENT-034 | `status:done`（[#254](https://github.com/anitaguptaoffice/sanguo-slg/pull/254) `37259743`） |
| [#247](https://github.com/anitaguptaoffice/sanguo-slg/issues/247) | CLIENT-035 | `status:done`（[#253](https://github.com/anitaguptaoffice/sanguo-slg/pull/253) `5c505354`） |
| [#248](https://github.com/anitaguptaoffice/sanguo-slg/issues/248) | CLIENT-036 | `status:done`（[#255](https://github.com/anitaguptaoffice/sanguo-slg/pull/255) `fed5e5bf`） |
| [#249](https://github.com/anitaguptaoffice/sanguo-slg/issues/249) | CLIENT-037 | `status:done`（[#256](https://github.com/anitaguptaoffice/sanguo-slg/pull/256) `5a4bb4af`） |
| [#250](https://github.com/anitaguptaoffice/sanguo-slg/issues/250) | CLIENT-038 | `status:done`（[#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258) `30c95e2a`） |
| [#251](https://github.com/anitaguptaoffice/sanguo-slg/issues/251) | INTG-013 | `status:done`（[#257](https://github.com/anitaguptaoffice/sanguo-slg/pull/257) `14dad6da`） |
| [#259](https://github.com/anitaguptaoffice/sanguo-slg/issues/259) | CLIENT-039 | `status:done`（[#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260) `9e98a28b`） |
| [#252](https://github.com/anitaguptaoffice/sanguo-slg/issues/252) | DOCS-EXIT-008 | `status:done`（[#261](https://github.com/anitaguptaoffice/sanguo-slg/pull/261) `58bd03b7`） |

**wave:16 美术轨**（非 wave:17 实现卡）：[#262](https://github.com/anitaguptaoffice/sanguo-slg/issues/262) **CLIENT-040** `status:done`（[#263](https://github.com/anitaguptaoffice/sanguo-slg/pull/263) `a4add478`）。

### Wave 17 进度（与 GitHub `wave:17` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) | CLIENT-041 | `status:done`（[#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275) `12a8850f`） |
| [#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) | CLIENT-042 | `status:done`（[#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`） |
| [#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) | CLIENT-043 | `status:done`（[#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279) `66e5578a`） |
| [#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) | CLIENT-044 | `status:done`（[#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272) `d437076a`） |
| [#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269) | CLIENT-045 | `status:done`（[#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273) `5a3ae507`） |
| [#270](https://github.com/anitaguptaoffice/sanguo-slg/issues/270) | INTG-014 | `status:done`（[#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274) `90fb5356`） |
| [#271](https://github.com/anitaguptaoffice/sanguo-slg/issues/271) | DOCS-EXIT-009 | `status:done`（[#278](https://github.com/anitaguptaoffice/sanguo-slg/pull/278) `af713f07`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 17」；`backlog.yml` 为任务真源，本表仅便于对照 Issue。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR #77/#82/#108/#100/#126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)；wave:15 hotfix **CLIENT-033**（[#243](https://github.com/anitaguptaoffice/sanguo-slg/issues/243) / [#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`）军事对比度/按钮/HUD（不重复进 wave:16/17 卡）。**美术轨**：**CLIENT-046**（[#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277)）中心四面板证据，**非** wave:18 实现 backlog。

### Wave 18 进度（与 GitHub `wave:18` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#283](https://github.com/anitaguptaoffice/sanguo-slg/issues/283) | CLIENT-047 | `status:done`（[#294](https://github.com/anitaguptaoffice/sanguo-slg/pull/294) `e2e4c367`） |
| [#284](https://github.com/anitaguptaoffice/sanguo-slg/issues/284) | CLIENT-048 | `status:done`（[#293](https://github.com/anitaguptaoffice/sanguo-slg/pull/293) `0e460f7b`） |
| [#285](https://github.com/anitaguptaoffice/sanguo-slg/issues/285) | CLIENT-049 | `status:done`（[#297](https://github.com/anitaguptaoffice/sanguo-slg/pull/297) `17a41ff2`） |
| [#286](https://github.com/anitaguptaoffice/sanguo-slg/issues/286) | CLIENT-050 | `status:done`（[#299](https://github.com/anitaguptaoffice/sanguo-slg/pull/299) `b40c01f7`） |
| [#288](https://github.com/anitaguptaoffice/sanguo-slg/issues/288) | CLIENT-051 | `status:done`（[#295](https://github.com/anitaguptaoffice/sanguo-slg/pull/295) `504a91ef`） |
| [#289](https://github.com/anitaguptaoffice/sanguo-slg/issues/289) | CLIENT-052 | `status:done`（[#296](https://github.com/anitaguptaoffice/sanguo-slg/pull/296) `a94cb935`） |
| [#290](https://github.com/anitaguptaoffice/sanguo-slg/issues/290) | CLIENT-053 | `status:done`（[#298](https://github.com/anitaguptaoffice/sanguo-slg/pull/298) `0b915f74`） |
| [#291](https://github.com/anitaguptaoffice/sanguo-slg/issues/291) | INTG-015 | `status:done`（[#301](https://github.com/anitaguptaoffice/sanguo-slg/pull/301) `ee574240`） |
| [#292](https://github.com/anitaguptaoffice/sanguo-slg/issues/292) | DOCS-EXIT-010 | `status:done`（[#302](https://github.com/anitaguptaoffice/sanguo-slg/pull/302) `b63ed954`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 18」；`backlog.yml` 为任务真源，本表仅便于对照 Issue。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR #77/#82/#108/#100/#126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**美术轨**：**CLIENT-046**（[#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277) / [#280](https://github.com/anitaguptaoffice/sanguo-slg/pull/280) `722256c2`）中心四面板证据，**非** wave:18 实现 backlog；**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）046 FAIL 跟进修 `status:done`，证据 [`docs/art/samples/client-054/`](../docs/art/samples/client-054/README.md)。

### Wave 19 进度（与 GitHub `wave:19` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#327](https://github.com/anitaguptaoffice/sanguo-slg/issues/327) | CLIENT-056 | `status:done`（[#341](https://github.com/anitaguptaoffice/sanguo-slg/pull/341) `2006b478`） |
| [#328](https://github.com/anitaguptaoffice/sanguo-slg/issues/328) | CLIENT-057 | `status:done`（[#339](https://github.com/anitaguptaoffice/sanguo-slg/pull/339) `22368a0f`） |
| [#329](https://github.com/anitaguptaoffice/sanguo-slg/issues/329) | CLIENT-058 | `status:done`（[#338](https://github.com/anitaguptaoffice/sanguo-slg/pull/338) `eb8f8a26`） |
| [#330](https://github.com/anitaguptaoffice/sanguo-slg/issues/330) | CLIENT-059 | `status:done`（[#343](https://github.com/anitaguptaoffice/sanguo-slg/pull/343) `6df0ef9f`） |
| [#331](https://github.com/anitaguptaoffice/sanguo-slg/issues/331) | CLIENT-060 | `status:done`（[#344](https://github.com/anitaguptaoffice/sanguo-slg/pull/344) `97c99156`） |
| [#332](https://github.com/anitaguptaoffice/sanguo-slg/issues/332) | CLIENT-061 | `status:done`（[#342](https://github.com/anitaguptaoffice/sanguo-slg/pull/342) `b2fb1a01`） |
| [#333](https://github.com/anitaguptaoffice/sanguo-slg/issues/333) | CLIENT-062 | `status:done`（[#340](https://github.com/anitaguptaoffice/sanguo-slg/pull/340) `1d9ab72f`） |
| [#334](https://github.com/anitaguptaoffice/sanguo-slg/issues/334) | INTG-016 | `status:done`（[#337](https://github.com/anitaguptaoffice/sanguo-slg/pull/337) `7ecb7d4d`） |
| [#335](https://github.com/anitaguptaoffice/sanguo-slg/issues/335) | DOCS-EXIT-011 | `status:done`（[#346](https://github.com/anitaguptaoffice/sanguo-slg/pull/346) `d0920b5d`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 19」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**wave:18 美术轨**（非 wave:19 backlog）：**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）、**CLIENT-055**（[#303](https://github.com/anitaguptaoffice/sanguo-slg/issues/303) / [#305](https://github.com/anitaguptaoffice/sanguo-slg/pull/305) `f675d43a`）。**wave:19 美术轨旁路**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）`status:done`；**#108** 仍 FAIL → **CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）`status:in-progress`——**非** wave:19/wave:20 实现 backlog 卡。

### Wave 20 进度（与 GitHub `wave:20` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#350](https://github.com/anitaguptaoffice/sanguo-slg/issues/350) | CLIENT-065 | `status:done`（[#360](https://github.com/anitaguptaoffice/sanguo-slg/pull/360) `9396165e`） |
| [#351](https://github.com/anitaguptaoffice/sanguo-slg/issues/351) | CLIENT-066 | `status:done`（[#366](https://github.com/anitaguptaoffice/sanguo-slg/pull/366) `a9788a83`） |
| [#352](https://github.com/anitaguptaoffice/sanguo-slg/issues/352) | CLIENT-067 | `status:done`（[#361](https://github.com/anitaguptaoffice/sanguo-slg/pull/361) `f858c821`） |
| [#353](https://github.com/anitaguptaoffice/sanguo-slg/issues/353) | CLIENT-068 | `status:done`（[#363](https://github.com/anitaguptaoffice/sanguo-slg/pull/363) `4af126c8`） |
| [#354](https://github.com/anitaguptaoffice/sanguo-slg/issues/354) | CLIENT-069 | `status:done`（[#362](https://github.com/anitaguptaoffice/sanguo-slg/pull/362) `857e696e`） |
| [#355](https://github.com/anitaguptaoffice/sanguo-slg/issues/355) | CLIENT-070 | `status:done`（[#364](https://github.com/anitaguptaoffice/sanguo-slg/pull/364) `944a3cdd`） |
| [#356](https://github.com/anitaguptaoffice/sanguo-slg/issues/356) | CLIENT-071 | `status:done`（[#359](https://github.com/anitaguptaoffice/sanguo-slg/pull/359) `4ea9e69f`） |
| [#357](https://github.com/anitaguptaoffice/sanguo-slg/issues/357) | INTG-017 | `status:done`（[#365](https://github.com/anitaguptaoffice/sanguo-slg/pull/365) `4b522cae`） |
| [#358](https://github.com/anitaguptaoffice/sanguo-slg/issues/358) | DOCS-EXIT-012 | `status:done`（[#367](https://github.com/anitaguptaoffice/sanguo-slg/pull/367) `79f54e0d`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 20」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**wave:19 美术轨旁路**（**非** wave:20 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）`status:done`；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）`status:in-progress`——与 **CLIENT-065** 起 wave:20 实现卡编号无关。

### Wave 21 进度（与 GitHub `wave:21` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#369](https://github.com/anitaguptaoffice/sanguo-slg/issues/369) | CLIENT-072 | `status:done`（[#385](https://github.com/anitaguptaoffice/sanguo-slg/pull/385) `03c8149b`） |
| [#370](https://github.com/anitaguptaoffice/sanguo-slg/issues/370) | CLIENT-073 | `status:done`（[#386](https://github.com/anitaguptaoffice/sanguo-slg/pull/386) `87a2a8cb`） |
| [#371](https://github.com/anitaguptaoffice/sanguo-slg/issues/371) | CLIENT-074 | `status:done`（[#379](https://github.com/anitaguptaoffice/sanguo-slg/pull/379) `4102f1a5`） |
| [#372](https://github.com/anitaguptaoffice/sanguo-slg/issues/372) | CLIENT-075 | `status:done`（[#381](https://github.com/anitaguptaoffice/sanguo-slg/pull/381) `b0ca4ba5`） |
| [#373](https://github.com/anitaguptaoffice/sanguo-slg/issues/373) | CLIENT-076 | `status:done`（[#384](https://github.com/anitaguptaoffice/sanguo-slg/pull/384) `439c1b67`） |
| [#374](https://github.com/anitaguptaoffice/sanguo-slg/issues/374) | CLIENT-077 | `status:done`（[#387](https://github.com/anitaguptaoffice/sanguo-slg/pull/387) `e1d44182`） |
| [#375](https://github.com/anitaguptaoffice/sanguo-slg/issues/375) | CLIENT-078 | `status:done`（[#383](https://github.com/anitaguptaoffice/sanguo-slg/pull/383) `8187d4f4`） |
| [#376](https://github.com/anitaguptaoffice/sanguo-slg/issues/376) | CLIENT-079 | `status:done`（[#382](https://github.com/anitaguptaoffice/sanguo-slg/pull/382) `c9b53258`） |
| [#377](https://github.com/anitaguptaoffice/sanguo-slg/issues/377) | INTG-018 | `status:done`（[#380](https://github.com/anitaguptaoffice/sanguo-slg/pull/380) `0a78b1d6`） |
| [#378](https://github.com/anitaguptaoffice/sanguo-slg/issues/378) | DOCS-EXIT-013 | `status:done`（[#388](https://github.com/anitaguptaoffice/sanguo-slg/pull/388) `b5a1488e`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 21」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:21 实现 backlog；实现卡 **CLIENT-072** 起。

### Wave 22 进度（与 GitHub `wave:22` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#390](https://github.com/anitaguptaoffice/sanguo-slg/issues/390) | CLIENT-080 | `status:done`（[#403](https://github.com/anitaguptaoffice/sanguo-slg/pull/403) `4a73aa2e`） |
| [#391](https://github.com/anitaguptaoffice/sanguo-slg/issues/391) | CLIENT-081 | `status:done`（[#402](https://github.com/anitaguptaoffice/sanguo-slg/pull/402) `63a5dcee`） |
| [#392](https://github.com/anitaguptaoffice/sanguo-slg/issues/392) | CLIENT-082 | `status:done`（[#407](https://github.com/anitaguptaoffice/sanguo-slg/pull/407) `023e2524`） |
| [#393](https://github.com/anitaguptaoffice/sanguo-slg/issues/393) | CLIENT-083 | `status:done`（[#406](https://github.com/anitaguptaoffice/sanguo-slg/pull/406) `b081d127`） |
| [#394](https://github.com/anitaguptaoffice/sanguo-slg/issues/394) | CLIENT-084 | `status:done`（[#401](https://github.com/anitaguptaoffice/sanguo-slg/pull/401) `e19d0a71`） |
| [#395](https://github.com/anitaguptaoffice/sanguo-slg/issues/395) | CLIENT-085 | `status:done`（[#408](https://github.com/anitaguptaoffice/sanguo-slg/pull/408) `48b0960c`） |
| [#396](https://github.com/anitaguptaoffice/sanguo-slg/issues/396) | CLIENT-086 | `status:done`（[#409](https://github.com/anitaguptaoffice/sanguo-slg/pull/409) `77749bd8`） |
| [#397](https://github.com/anitaguptaoffice/sanguo-slg/issues/397) | CLIENT-087 | `status:done`（[#405](https://github.com/anitaguptaoffice/sanguo-slg/pull/405) `f647b4bc`） |
| [#398](https://github.com/anitaguptaoffice/sanguo-slg/issues/398) | INTG-019 | `status:done`（[#404](https://github.com/anitaguptaoffice/sanguo-slg/pull/404) `2482fd64`） |
| [#399](https://github.com/anitaguptaoffice/sanguo-slg/issues/399) | DOCS-EXIT-014 | `status:done`（[#410](https://github.com/anitaguptaoffice/sanguo-slg/pull/410) `23a6f0ed`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 22」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:22 实现 backlog；实现卡 **CLIENT-080** 起。Issue 由 `tasks_sync`（[#389](https://github.com/anitaguptaoffice/sanguo-slg/pull/389) `b46ce7a8` 合入后 Actions 全量 sync）创建。

### Wave 23 进度（与 GitHub `wave:23` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#412](https://github.com/anitaguptaoffice/sanguo-slg/issues/412) | CLIENT-088 | `status:done`（[#423](https://github.com/anitaguptaoffice/sanguo-slg/pull/423) `d60d8345`） |
| [#413](https://github.com/anitaguptaoffice/sanguo-slg/issues/413) | CLIENT-089 | `status:done`（[#429](https://github.com/anitaguptaoffice/sanguo-slg/pull/429) `b610caab`） |
| [#414](https://github.com/anitaguptaoffice/sanguo-slg/issues/414) | CLIENT-090 | `status:done`（[#430](https://github.com/anitaguptaoffice/sanguo-slg/pull/430) `358f88aa`） |
| [#415](https://github.com/anitaguptaoffice/sanguo-slg/issues/415) | CLIENT-091 | `status:done`（[#426](https://github.com/anitaguptaoffice/sanguo-slg/pull/426) `f3523e87`） |
| [#416](https://github.com/anitaguptaoffice/sanguo-slg/issues/416) | CLIENT-092 | `status:done`（[#427](https://github.com/anitaguptaoffice/sanguo-slg/pull/427) `6394ddfb`） |
| [#417](https://github.com/anitaguptaoffice/sanguo-slg/issues/417) | CLIENT-093 | `status:done`（[#425](https://github.com/anitaguptaoffice/sanguo-slg/pull/425) `62dd6def`） |
| [#418](https://github.com/anitaguptaoffice/sanguo-slg/issues/418) | CLIENT-094 | `status:done`（[#428](https://github.com/anitaguptaoffice/sanguo-slg/pull/428) `f8152b2d`） |
| [#419](https://github.com/anitaguptaoffice/sanguo-slg/issues/419) | CLIENT-095 | `status:done`（[#431](https://github.com/anitaguptaoffice/sanguo-slg/pull/431) `7d19874f`） |
| [#420](https://github.com/anitaguptaoffice/sanguo-slg/issues/420) | INTG-020 | `status:done`（[#424](https://github.com/anitaguptaoffice/sanguo-slg/pull/424) `d27e863e`） |
| [#421](https://github.com/anitaguptaoffice/sanguo-slg/issues/421) | DOCS-EXIT-015 | `status:done`（[#432](https://github.com/anitaguptaoffice/sanguo-slg/pull/432) `58ec47a2`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 23」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:23 实现 backlog；实现卡 **CLIENT-088** 起。Issue 由 `tasks_sync`（[#411](https://github.com/anitaguptaoffice/sanguo-slg/pull/411) `83f94385` 合入后 Actions 全量 sync）创建。

### Wave 24 进度（与 GitHub `wave:24` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#434](https://github.com/anitaguptaoffice/sanguo-slg/issues/434) | CLIENT-096 | `status:done`（[#446](https://github.com/anitaguptaoffice/sanguo-slg/pull/446) `4f8821bc`） |
| [#435](https://github.com/anitaguptaoffice/sanguo-slg/issues/435) | CLIENT-097 | `status:done`（[#454](https://github.com/anitaguptaoffice/sanguo-slg/pull/454) `225ee845`） |
| [#436](https://github.com/anitaguptaoffice/sanguo-slg/issues/436) | CLIENT-098 | `status:done`（[#450](https://github.com/anitaguptaoffice/sanguo-slg/pull/450) `fd5e0128`） |
| [#437](https://github.com/anitaguptaoffice/sanguo-slg/issues/437) | CLIENT-099 | `status:done`（[#451](https://github.com/anitaguptaoffice/sanguo-slg/pull/451) `c207b6c9`） |
| [#438](https://github.com/anitaguptaoffice/sanguo-slg/issues/438) | CLIENT-100 | `status:done`（[#453](https://github.com/anitaguptaoffice/sanguo-slg/pull/453) `91ee2474`） |
| [#439](https://github.com/anitaguptaoffice/sanguo-slg/issues/439) | CLIENT-101 | `status:done`（[#448](https://github.com/anitaguptaoffice/sanguo-slg/pull/448) `d68c5f27`） |
| [#440](https://github.com/anitaguptaoffice/sanguo-slg/issues/440) | CLIENT-102 | `status:done`（[#455](https://github.com/anitaguptaoffice/sanguo-slg/pull/455) `da139567`） |
| [#441](https://github.com/anitaguptaoffice/sanguo-slg/issues/441) | CLIENT-103 | `status:done`（[#449](https://github.com/anitaguptaoffice/sanguo-slg/pull/449) `62e13a90`） |
| [#442](https://github.com/anitaguptaoffice/sanguo-slg/issues/442) | INTG-021 | `status:done`（[#447](https://github.com/anitaguptaoffice/sanguo-slg/pull/447) `9eb18c48`） |
| [#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443) | DOCS-EXIT-016 | `status:done`（[#457](https://github.com/anitaguptaoffice/sanguo-slg/pull/457) `d1c517db`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 24」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:24 实现 backlog；实现卡 **CLIENT-096** 起。Issue 由 `tasks_sync`（[#433](https://github.com/anitaguptaoffice/sanguo-slg/pull/433) `8a182448` 合入后 Actions 全量 sync）创建。

### Wave 25 进度（与 GitHub `wave:25` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#460](https://github.com/anitaguptaoffice/sanguo-slg/issues/460) | CLIENT-104 | `status:done`（[#471](https://github.com/anitaguptaoffice/sanguo-slg/pull/471) `7959d209`） |
| [#461](https://github.com/anitaguptaoffice/sanguo-slg/issues/461) | CLIENT-105 | `status:done`（[#476](https://github.com/anitaguptaoffice/sanguo-slg/pull/476) `dc0a3ba0`） |
| [#462](https://github.com/anitaguptaoffice/sanguo-slg/issues/462) | CLIENT-106 | `status:done`（[#474](https://github.com/anitaguptaoffice/sanguo-slg/pull/474) `3a43d2b4`） |
| [#463](https://github.com/anitaguptaoffice/sanguo-slg/issues/463) | CLIENT-107 | `status:done`（[#480](https://github.com/anitaguptaoffice/sanguo-slg/pull/480) `bb402f94`） |
| [#464](https://github.com/anitaguptaoffice/sanguo-slg/issues/464) | CLIENT-108 | `status:done`（[#478](https://github.com/anitaguptaoffice/sanguo-slg/pull/478) `5b984854`） |
| [#465](https://github.com/anitaguptaoffice/sanguo-slg/issues/465) | CLIENT-109 | `status:done`（[#477](https://github.com/anitaguptaoffice/sanguo-slg/pull/477) `afb8861b`） |
| [#466](https://github.com/anitaguptaoffice/sanguo-slg/issues/466) | CLIENT-110 | `status:done`（[#479](https://github.com/anitaguptaoffice/sanguo-slg/pull/479) `683a4bb6`） |
| [#467](https://github.com/anitaguptaoffice/sanguo-slg/issues/467) | CLIENT-111 | `status:done`（[#475](https://github.com/anitaguptaoffice/sanguo-slg/pull/475) `e722a9b6`） |
| [#468](https://github.com/anitaguptaoffice/sanguo-slg/issues/468) | INTG-022 | `status:done`（[#472](https://github.com/anitaguptaoffice/sanguo-slg/pull/472) `d43f7777`） |
| [#469](https://github.com/anitaguptaoffice/sanguo-slg/issues/469) | DOCS-EXIT-017 | `status:done`（[#483](https://github.com/anitaguptaoffice/sanguo-slg/pull/483) `5752072e`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 25」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239) / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481)（Draft）。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:25 实现 backlog；实现卡 **CLIENT-104～111**。Issue 由 `tasks_sync`（[#458](https://github.com/anitaguptaoffice/sanguo-slg/pull/458) `7a6189ba` 合入 main 后 Actions 全量 sync）创建。

### Wave 26 进度（与 GitHub `wave:26` 标签同步，2026-10-23）

| Issue | ID | 状态 |
|---|---|---|
| [#486](https://github.com/anitaguptaoffice/sanguo-slg/issues/486) | CLIENT-112 | `status:done`（[#498](https://github.com/anitaguptaoffice/sanguo-slg/pull/498) `68a687de`） |
| [#487](https://github.com/anitaguptaoffice/sanguo-slg/issues/487) | CLIENT-113 | `status:done`（[#501](https://github.com/anitaguptaoffice/sanguo-slg/pull/501) `2b0702d4`） |
| [#488](https://github.com/anitaguptaoffice/sanguo-slg/issues/488) | CLIENT-114 | `status:done`（[#497](https://github.com/anitaguptaoffice/sanguo-slg/pull/497) `11a68ff4`） |
| [#489](https://github.com/anitaguptaoffice/sanguo-slg/issues/489) | CLIENT-115 | `status:done`（[#504](https://github.com/anitaguptaoffice/sanguo-slg/pull/504) `bfac0925`） |
| [#490](https://github.com/anitaguptaoffice/sanguo-slg/issues/490) | CLIENT-116 | `status:done`（[#505](https://github.com/anitaguptaoffice/sanguo-slg/pull/505) `d4ea2d8d`） |
| [#491](https://github.com/anitaguptaoffice/sanguo-slg/issues/491) | CLIENT-117 | `status:done`（[#500](https://github.com/anitaguptaoffice/sanguo-slg/pull/500) `314a6396`） |
| [#492](https://github.com/anitaguptaoffice/sanguo-slg/issues/492) | CLIENT-118 | `status:done`（[#503](https://github.com/anitaguptaoffice/sanguo-slg/pull/503) `cabe8f0a`） |
| [#493](https://github.com/anitaguptaoffice/sanguo-slg/issues/493) | CLIENT-119 | `status:done`（[#502](https://github.com/anitaguptaoffice/sanguo-slg/pull/502) `a36c1ae6`） |
| [#494](https://github.com/anitaguptaoffice/sanguo-slg/issues/494) | INTG-023 | `status:done`（[#499](https://github.com/anitaguptaoffice/sanguo-slg/pull/499) `92a96489`） |
| [#495](https://github.com/anitaguptaoffice/sanguo-slg/issues/495) | DOCS-EXIT-018 | `status:done`（[#507](https://github.com/anitaguptaoffice/sanguo-slg/pull/507) `6c9d66cd`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 26」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:26 实现 backlog；实现卡 **CLIENT-112～119**。Issue 由 `tasks_sync`（[#484](https://github.com/anitaguptaoffice/sanguo-slg/pull/484) `90cef893` 合入 main 后 [Actions 全量 sync](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/40035973405)）创建。

### Wave 27 进度（与 GitHub `wave:27` 标签同步，2026-10-24）

| Issue | ID | 状态 |
|---|---|---|
| [#510](https://github.com/anitaguptaoffice/sanguo-slg/issues/510) | CLIENT-120 | `status:done`（[#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509) `50e052f0` ART-UI-FILTER-008 工程挂载） |
| [#511](https://github.com/anitaguptaoffice/sanguo-slg/issues/511) | CLIENT-121 | `status:done`（[#524](https://github.com/anitaguptaoffice/sanguo-slg/pull/524) `4edacef9` chip 运行时 + ≥44px） |
| [#512](https://github.com/anitaguptaoffice/sanguo-slg/issues/512) | CLIENT-122 | `status:done`（[#528](https://github.com/anitaguptaoffice/sanguo-slg/pull/528) `b15449a3` 邮件筛选/行/角标） |
| [#513](https://github.com/anitaguptaoffice/sanguo-slg/issues/513) | CLIENT-123 | `status:done`（[#525](https://github.com/anitaguptaoffice/sanguo-slg/pull/525) `e86375f7` 日常筛选/行/角标） |
| [#514](https://github.com/anitaguptaoffice/sanguo-slg/issues/514) | CLIENT-124 | `status:done`（[#522](https://github.com/anitaguptaoffice/sanguo-slg/pull/522) `32f195cc` 军情筛选/行） |
| [#515](https://github.com/anitaguptaoffice/sanguo-slg/issues/515) | CLIENT-125 | `status:done`（[#523](https://github.com/anitaguptaoffice/sanguo-slg/pull/523) `2cff59f0` 战报筛选/行） |
| [#516](https://github.com/anitaguptaoffice/sanguo-slg/issues/516) | CLIENT-126 | `status:done`（[#526](https://github.com/anitaguptaoffice/sanguo-slg/pull/526) `d1424a39` badge.dot/count） |
| [#517](https://github.com/anitaguptaoffice/sanguo-slg/issues/517) | CLIENT-127 | `status:done`（[#527](https://github.com/anitaguptaoffice/sanguo-slg/pull/527) `8c45fa1a` 1280 manifest） |
| [#518](https://github.com/anitaguptaoffice/sanguo-slg/issues/518) | INTG-024 | `status:done`（[#521](https://github.com/anitaguptaoffice/sanguo-slg/pull/521) `aa64edb2` 网关冒烟） |
| [#519](https://github.com/anitaguptaoffice/sanguo-slg/issues/519) | DOCS-EXIT-019 | `status:done`（[#529](https://github.com/anitaguptaoffice/sanguo-slg/pull/529) `bb4437e4`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 27」。wave:27 全收口 tip **`bb4437e4`**（含 ART 运行时证据 [#530](https://github.com/anitaguptaoffice/sanguo-slg/pull/530)）。

### Wave 28 进度（与 GitHub `wave:28` 标签同步，2026-10-24）

| Issue | ID | 状态 |
|---|---|---|
| [#532](https://github.com/anitaguptaoffice/sanguo-slg/issues/532) | CLIENT-128 | `status:done`（[#551](https://github.com/anitaguptaoffice/sanguo-slg/pull/551) `f900255b` ART-UI-PANEL-STATE-009 工程挂载） |
| [#533](https://github.com/anitaguptaoffice/sanguo-slg/issues/533) | CLIENT-129 | `status:done`（[#549](https://github.com/anitaguptaoffice/sanguo-slg/pull/549) `bbed304f` 面板 loading/empty/error 统一） |
| [#534](https://github.com/anitaguptaoffice/sanguo-slg/issues/534) | CLIENT-130 | `status:done`（[#544](https://github.com/anitaguptaoffice/sanguo-slg/pull/544) `68bafda8` 七槽 overlay 扫读） |
| [#535](https://github.com/anitaguptaoffice/sanguo-slg/issues/535) | CLIENT-131 | `status:done`（[#548](https://github.com/anitaguptaoffice/sanguo-slg/pull/548) `aab1b10f` 队列七槽矩阵） |
| [#536](https://github.com/anitaguptaoffice/sanguo-slg/issues/536) | CLIENT-132 | `status:done`（[#550](https://github.com/anitaguptaoffice/sanguo-slg/pull/550) `862592e1` 将领列表扫读） |
| [#537](https://github.com/anitaguptaoffice/sanguo-slg/issues/537) | CLIENT-133 | `status:done`（[#546](https://github.com/anitaguptaoffice/sanguo-slg/pull/546) `aee4ad93` 将领详情养成深链） |
| [#538](https://github.com/anitaguptaoffice/sanguo-slg/issues/538) | CLIENT-134 | `status:done`（[#547](https://github.com/anitaguptaoffice/sanguo-slg/pull/547) `735f4670` HUD 待办深链一致） |
| [#539](https://github.com/anitaguptaoffice/sanguo-slg/issues/539) | CLIENT-135 | `status:done`（[#553](https://github.com/anitaguptaoffice/sanguo-slg/pull/553) `747c0505` 键盘焦点 + 1280 manifest） |
| [#540](https://github.com/anitaguptaoffice/sanguo-slg/issues/540) | INTG-025 | `status:done`（[#545](https://github.com/anitaguptaoffice/sanguo-slg/pull/545) `508a7ac2` 网关冒烟） |
| [#541](https://github.com/anitaguptaoffice/sanguo-slg/issues/541) | DOCS-EXIT-020 | `status:done`（[#555](https://github.com/anitaguptaoffice/sanguo-slg/pull/555) `9ef14ce6`） |

**工程修**（非 wave:28 backlog 实现卡）：**CLIENT-136** `status:done`（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb` ART-UI-FILTER-008 联调修正）。

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 28」。wave:28 **全收口** tip **`9ef14ce6`**（DOCS-EXIT-020 [#555](https://github.com/anitaguptaoffice/sanguo-slg/pull/555)；实现末卡 **`747c0505`** #553 CLIENT-135）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:28 实现 backlog；实现卡 **CLIENT-128～135**。

### Wave 29 进度（与 GitHub `wave:29` 标签同步，2026-10-24）

| Issue | ID | 状态 |
|---|---|---|
| [#558](https://github.com/anitaguptaoffice/sanguo-slg/issues/558) | CLIENT-138 | `status:done`（[#575](https://github.com/anitaguptaoffice/sanguo-slg/pull/575) `a36dd072` ART-WORLD-MINIMAP-010 工程挂载） |
| [#559](https://github.com/anitaguptaoffice/sanguo-slg/issues/559) | CLIENT-139 | `status:done`（[#570](https://github.com/anitaguptaoffice/sanguo-slg/pull/570) `dff8936f` 小地图行军 ETA 与出征互链） |
| [#560](https://github.com/anitaguptaoffice/sanguo-slg/issues/560) | CLIENT-140 | `status:done`（[#571](https://github.com/anitaguptaoffice/sanguo-slg/pull/571) `75c0f953` 世界信息卡↔军情军事深链） |
| [#561](https://github.com/anitaguptaoffice/sanguo-slg/issues/561) | CLIENT-141 | `status:done`（[#572](https://github.com/anitaguptaoffice/sanguo-slg/pull/572) `6632a203` 军情 ETA 密度与 phase 扫读） |
| [#562](https://github.com/anitaguptaoffice/sanguo-slg/issues/562) | CLIENT-142 | `status:done`（[#569](https://github.com/anitaguptaoffice/sanguo-slg/pull/569) `bd3b30dd` 战报坐标复盘与小地图跳转） |
| [#563](https://github.com/anitaguptaoffice/sanguo-slg/issues/563) | CLIENT-143 | `status:done`（[#576](https://github.com/anitaguptaoffice/sanguo-slg/pull/576) `63000d8a` 邮件领取同步与收件箱密度） |
| [#564](https://github.com/anitaguptaoffice/sanguo-slg/issues/564) | CLIENT-144 | `status:done`（[#573](https://github.com/anitaguptaoffice/sanguo-slg/pull/573) `deeb5e39` 军团/聊天刷新扫读） |
| [#565](https://github.com/anitaguptaoffice/sanguo-slg/issues/565) | CLIENT-145 | `status:done`（[#577](https://github.com/anitaguptaoffice/sanguo-slg/pull/577) `f60e3e95` 军事表单校验 + 1280 manifest） |
| [#566](https://github.com/anitaguptaoffice/sanguo-slg/issues/566) | INTG-026 | `status:done`（[#568](https://github.com/anitaguptaoffice/sanguo-slg/pull/568) `71537297` 网关冒烟） |
| [#567](https://github.com/anitaguptaoffice/sanguo-slg/issues/567) | DOCS-EXIT-021 | `status:done`（[#581](https://github.com/anitaguptaoffice/sanguo-slg/pull/581) `924a2834`） |

**美术旁路**（非 wave:29 backlog 实现卡）：**CLIENT-137** `status:done`（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574) `36c69009`）；**CLIENT-146** `status:done`（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579) `4f5a9732` FILTER-008 日常行条跟进）。

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 29」。wave:29 **全收口** tip **`924a2834`**（DOCS-EXIT-021 [#581](https://github.com/anitaguptaoffice/sanguo-slg/pull/581)；实现末卡 **`f60e3e95`** #577 CLIENT-145；基线 wave:28 **`9ef14ce6`**）。**范围外**同 wave:28；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:29 实现 backlog；实现卡 **CLIENT-138～145**，**勿占用 CLIENT-136/137**。

### Wave 30 进度（与 GitHub `wave:30` 标签同步，2026-10-24）

| Issue | ID | 状态 |
|---|---|---|
| [#584](https://github.com/anitaguptaoffice/sanguo-slg/issues/584) | CLIENT-148 | `status:done`（[#601](https://github.com/anitaguptaoffice/sanguo-slg/pull/601) `873b8158` HUD 产出速率与仓库余量扫读） |
| [#585](https://github.com/anitaguptaoffice/sanguo-slg/issues/585) | CLIENT-149 | `status:done`（[#598](https://github.com/anitaguptaoffice/sanguo-slg/pull/598) `8ef18b2d` 建造·募兵队列完成脉冲与槽位互跳） |
| [#586](https://github.com/anitaguptaoffice/sanguo-slg/issues/586) | CLIENT-150 | `status:done`（[#603](https://github.com/anitaguptaoffice/sanguo-slg/pull/603) `e34a2315` 日常可领批量/首条定位与 chain 进度） |
| [#587](https://github.com/anitaguptaoffice/sanguo-slg/issues/587) | CLIENT-151 | `status:done`（[#600](https://github.com/anitaguptaoffice/sanguo-slg/pull/600) `197d3492` 将领列表筛选排序记忆扫读） |
| [#588](https://github.com/anitaguptaoffice/sanguo-slg/issues/588) | CLIENT-152 | `status:done`（[#596](https://github.com/anitaguptaoffice/sanguo-slg/pull/596) `e910be27` 双榜我的排名刷新跳动与钉选） |
| [#589](https://github.com/anitaguptaoffice/sanguo-slg/issues/589) | CLIENT-153 | `status:done`（[#597](https://github.com/anitaguptaoffice/sanguo-slg/pull/597) `bc5fe88a` 背包分类 tab 与堆叠扫读） |
| [#590](https://github.com/anitaguptaoffice/sanguo-slg/issues/590) | CLIENT-154 | `status:done`（[#599](https://github.com/anitaguptaoffice/sanguo-slg/pull/599) `d48a8520` 商城货币不足行内态） |
| [#591](https://github.com/anitaguptaoffice/sanguo-slg/issues/591) | CLIENT-155 | `status:done`（[#602](https://github.com/anitaguptaoffice/sanguo-slg/pull/602) `6978ebac` 1280 主城产出·日常·将领·排行 manifest） |
| [#592](https://github.com/anitaguptaoffice/sanguo-slg/issues/592) | INTG-027 | `status:done`（[#595](https://github.com/anitaguptaoffice/sanguo-slg/pull/595) `ca125b9e` 网关冒烟） |
| [#593](https://github.com/anitaguptaoffice/sanguo-slg/issues/593) | DOCS-EXIT-022 | `status:done`（[#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604) `ad278a7c`） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 30」。wave:30 **全收口** main tip **`ad278a7c6bb80e6991306d17c3eb42e58046b336`**（DOCS-EXIT-022 [#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604)；实现末卡 **`6978ebac`** #602 CLIENT-155）；基线 wave:29 **`924a2834`**（DOCS-EXIT-021 [#581](https://github.com/anitaguptaoffice/sanguo-slg/pull/581)）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**美术旁路**（**非** wave:30 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）、**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）、**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）、**CLIENT-147**（FILTER-008 旁路）。实现卡 **CLIENT-148～155**，**勿占用 CLIENT-136/137/146/147**。Issue 由 `tasks_sync`（[#583](https://github.com/anitaguptaoffice/sanguo-slg/pull/583) `0af8f9d6` 合入 main 后 [Actions 全量 sync](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/40051454522)）创建。

### Wave 31 进度（与 GitHub `wave:31` 标签同步，2026-10-24）

| Issue | ID | 状态 |
|---|---|---|
| [#606](https://github.com/anitaguptaoffice/sanguo-slg/issues/606) | CLIENT-156 | `status:done`（[#618](https://github.com/anitaguptaoffice/sanguo-slg/pull/618) `dde3cba9` 出征提交→军情/军事队列顶栏反馈） |
| [#607](https://github.com/anitaguptaoffice/sanguo-slg/issues/607) | CLIENT-157 | `status:done`（[#623](https://github.com/anitaguptaoffice/sanguo-slg/pull/623) `b415fc76` 募兵提交→队列与军事互跳） |
| [#608](https://github.com/anitaguptaoffice/sanguo-slg/issues/608) | CLIENT-158 | `status:done`（[#617](https://github.com/anitaguptaoffice/sanguo-slg/pull/617) `f19cada1` 战报相邻导航与列表焦点） |
| [#609](https://github.com/anitaguptaoffice/sanguo-slg/issues/609) | CLIENT-159 | `status:done`（[#622](https://github.com/anitaguptaoffice/sanguo-slg/pull/622) `085e903a` 邮件一键批量领取与 HUD 同步） |
| [#610](https://github.com/anitaguptaoffice/sanguo-slg/issues/610) | CLIENT-160 | `status:done`（[#621](https://github.com/anitaguptaoffice/sanguo-slg/pull/621) `7eadaf82` 军团提到草稿记忆与输入扫读） |
| [#611](https://github.com/anitaguptaoffice/sanguo-slg/issues/611) | CLIENT-161 | `status:done`（[#619](https://github.com/anitaguptaoffice/sanguo-slg/pull/619) `ce0b3925` 聊天未读角标与列表分隔线） |
| [#612](https://github.com/anitaguptaoffice/sanguo-slg/issues/612) | CLIENT-162 | `status:done`（[#620](https://github.com/anitaguptaoffice/sanguo-slg/pull/620) `3c9c40b2` HUD 待办与面板 tab/chip 一致） |
| [#613](https://github.com/anitaguptaoffice/sanguo-slg/issues/613) | CLIENT-163 | `status:done`（[#624](https://github.com/anitaguptaoffice/sanguo-slg/pull/624) `5ffcb5af` 1280 出征募兵战报邮件社交 manifest） |
| [#614](https://github.com/anitaguptaoffice/sanguo-slg/issues/614) | INTG-028 | `status:done`（[#616](https://github.com/anitaguptaoffice/sanguo-slg/pull/616) `8d8aac12` 网关冒烟扩展） |
| [#615](https://github.com/anitaguptaoffice/sanguo-slg/issues/615) | DOCS-EXIT-023 | `status:review`（[#625](https://github.com/anitaguptaoffice/sanguo-slg/pull/625) 文档收口） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 31」。wave:31 实现末卡 main tip **`5ffcb5af031e574f9d5d081c5ceb3a008b3b235d`**（#624 CLIENT-163）；基线 wave:30 **`ad278a7c6bb80e6991306d17c3eb42e58046b336`**（DOCS-EXIT-022 [#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604) `ad278a7c`）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)（Draft）及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**美术旁路**（**非** wave:31 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）、**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）、**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）、**CLIENT-147**（FILTER-008 旁路）。实现卡 **CLIENT-156～163**，**勿占用 CLIENT-136/137/146/147**。Issue 由 `tasks_sync`（[#605](https://github.com/anitaguptaoffice/sanguo-slg/pull/605) `85678ca9` 合入 main 后 sync）创建。
