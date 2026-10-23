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
| 15 | H5 世界地图与面板密度（**已完成**，见 ROADMAP Wave 15） | CLIENT-028–032 ([#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)–[#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)；[#229](https://github.com/anitaguptaoffice/sanguo-slg/issues/229) 跟踪 [#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238)), INTG-012 ([#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237)), DOCS-EXIT-007 ([#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234)) |

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
| [#229](https://github.com/anitaguptaoffice/sanguo-slg/issues/229) | CLIENT-029 | `status:review`（[#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238) 合入中） |
| [#230](https://github.com/anitaguptaoffice/sanguo-slg/issues/230) | CLIENT-030 | `status:done`（[#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236) `e3019f34`） |
| [#231](https://github.com/anitaguptaoffice/sanguo-slg/issues/231) | CLIENT-031 | `status:done`（[#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235) `58a95775`） |
| [#232](https://github.com/anitaguptaoffice/sanguo-slg/issues/232) | CLIENT-032 | `status:done`（[#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240) `1825858d`） |
| [#233](https://github.com/anitaguptaoffice/sanguo-slg/issues/233) | INTG-012 | `status:done`（[#237](https://github.com/anitaguptaoffice/sanguo-slg/pull/237) `7f812896`） |
| [#234](https://github.com/anitaguptaoffice/sanguo-slg/issues/234) | DOCS-EXIT-007 | `status:review`（本 PR 文档收口） |

波次定义与依赖说明见 `docs/ROADMAP.md`「Wave 15」；`backlog.yml` 为任务真源，本表仅便于对照 Issue。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；`CancelMarch` 与募兵加速；art hold / VERIFY [#239](https://github.com/anitaguptaoffice/sanguo-slg/pull/239)。
