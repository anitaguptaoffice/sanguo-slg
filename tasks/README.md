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
| 21 | H5 养成复盘与世界可读加深（**规划中**，见 ROADMAP Wave 21） | CLIENT-072–079、INTG-018、DOCS-EXIT-013（`backlog.yml` 真源；合并后 `tasks_sync`）；**CLIENT-064** 美术旁路——**非**本波实现编号 |

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

### Wave 21 进度（`backlog.yml` 已入库，待 `tasks_sync` 创建 Issue）

| Issue | ID | 状态 |
|---|---|---|
| （待 sync） | CLIENT-072 | 待开工 |
| （待 sync） | CLIENT-073 | 待开工 |
| （待 sync） | CLIENT-074 | 待开工 |
| （待 sync） | CLIENT-075 | 待开工 |
| （待 sync） | CLIENT-076 | 待开工 |
| （待 sync） | CLIENT-077 | 待开工 |
| （待 sync） | CLIENT-078 | 待开工 |
| （待 sync） | CLIENT-079 | 待开工 |
| （待 sync） | INTG-018 | 待开工 |
| （待 sync） | DOCS-EXIT-013 | `blocked_until: INTG-018` |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 21」。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；**永不合并** art hold PR **#77** / **#82** / **#108** / #100 / #126 及 VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）美术旁路——**非** wave:21 实现 backlog；实现卡 **CLIENT-072** 起。
