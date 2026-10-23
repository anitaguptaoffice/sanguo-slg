# H5 客户端（CLIENT-001 ~ CLIENT-036+）

## CLIENT-032 manifest 美术接线

主树 `client/public/assets/art/v1/manifest.json`（#218）已落地样件，H5 接线 asset id：

| asset id | 用途 |
|---|---|
| `res.icon.food.v1` | HUD 顶栏 DOM 粮图标（`appendHudResourceStrip`，CLIENT-039 起不再在 canvas 重复绘制） |
| `res.icon.wood.v1` | HUD 顶栏 DOM 木图标 |
| `res.icon.iron.v1` | HUD 顶栏 DOM 铁图标 |
| `res.icon.stone.v1` | HUD 顶栏 DOM 石图标 |
| `ui.panel.default.v1` | 邮件面板根 nine-slice（`artPanelSkin.skinMailPanel`） |
| `ui.panel.daily.v1` | 日常面板根（`artPanelSkin.skinDailyPanel`，CLIENT-103） |
| `ui.panel.hero.v1` | 将领面板根（`artPanelSkin.skinHeroPanel`，CLIENT-062） |
| `ui.panel.bag.v1` | 背包面板根（`artPanelSkin.skinBagPanel`，CLIENT-062） |
| `ui.panel.queue.v1` | 队列面板根（`artPanelSkin.skinQueuePanel`，CLIENT-062） |
| `ui.panel.military.v1` | 军事表单面板、队列募兵区块（`artPanelSkin.skinMilitaryPanel`；募兵/出征主按钮见 CLIENT-033） |
| `ui.panel.world.v1` / `ui.panel.rank.v1` | 世界 / 排行面板根（CLIENT-078） |
| `ui.panel.march.v1` / `ui.panel.battle-report.v1` | 军情行军列表 / 战报列表+详情根（CLIENT-086） |
| `ui.panel.shop.v1` / `ui.panel.guild.v1` / `ui.panel.chat.v1` | 商城 / 军团 / 聊天面板根（CLIENT-095）；背包仍用 `ui.panel.bag.v1` |

图标缺失时 HUD 回退为「粮/木/铁/石/币 + 数值」纯文字（与 CLIENT-011 一致）。面板根节点设 `data-art-skin="off"` 可跳过 nine-slice。

### ART-CHROME-006 运行时 UX（CLIENT-110）

在 **#452/#456** 已接线 `ui.panel.default.v1` 选服弹层与 `ui.hud.bar.v1` / `ui.toolbar.bar.v1` chrome 前提下：**选服** 顶栏触发钮打开 `role=dialog` 弹层，**Esc** 关闭并在关闭后焦点回到触发钮；弹层内 **Tab** 焦点循环与 `:focus-visible` 金环。主城底栏各 `toggle-*` 按钮 **`aria-expanded`** 与对应中心/侧栏面板打开态同步；**1280×720** `layout-narrow` 下工具栏标签与 **CLIENT-107** 角标溢出省略，完整计数见按钮 **`title`**。美术证据只读：`docs/art/samples/art-chrome-006/`。单测：`overlayFocusTrap.test.ts`、`toolbarAriaExpanded.test.ts`、`ServerSelectScene.test.ts`。

技术栈与引擎备选说明见仓库根 [docs/client-engine.md](../docs/client-engine.md)（**当前**为 Vite + TS + Canvas 2D / DOM，非 Cocos）。

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：

**选服列表 → 登录/进服 → 拉城/建城 → 主城（内政/军事/战报/任务/日常/背包/商城/将领/邮件）→ 世界/私聊 → 军团 → 战力排行**

## Wave 11 可玩环（M4 出口 / INTG-008）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-008** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量。

| 能力 | 验收小节 |
|---|---|
| **日常 UI**（chain 400，无手填上报） | [手动验收（日常 chain 400，CLIENT-009）](#手动验收日常-chain-400client-009) |
| **招募模板预览**（将领面板 + 背包/商城可读性） | [手动验收（M4：将领 / 邮件，CLIENT-008）](#手动验收m4将领--邮件client-008) 步骤 2；背包/商城行文案见 **CLIENT-010**（#171） |
| **战报入口**（底栏独立面板） | [手动验收（募兵 → 行军 → 战报）](#手动验收募兵--行军--战报) 步骤 4（**CLIENT-012**，#170） |
| **HUD 资源条与建筑等级** | **CLIENT-011**（[#165](https://github.com/anitaguptaoffice/sanguo-slg/issues/165) / [#172](https://github.com/anitaguptaoffice/sanguo-slg/pull/172)）：顶栏粮/木/铁/石/币与画布槽位等级见 [横屏布局 CLIENT-007](#手动验收横屏布局-client-007) 与上文 `hudFormat` 说明 |
| **HUD 资源增加摘要** | [手动验收（HUD 资源变动，CLIENT-018）](#手动验收hud-资源变动-client-018)（[#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) / [#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191)） |

## Wave 12 可玩加深（M4 出口 / INTG-009）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-009** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量。

| 能力 | 验收小节 |
|---|---|
| **行军列表**（`ListMarches`、出征后反馈） | [手动验收（募兵 → 行军 → 战报，CLIENT-012 / CLIENT-013）](#手动验收募兵--行军--战报client-012--client-013) 步骤 3–4；世界坐标填入出征见 **CLIENT-015**（[#180](https://github.com/anitaguptaoffice/sanguo-slg/issues/180) / [#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)） |
| **将领详情**（`GetHeroDetail`、列表可读性） | [手动验收（将领详情 CLIENT-014）](#手动验收将领详情-client-014) |
| **邮件**（收件箱 / 已读 / 领附件） | [手动验收（邮件收件箱，CLIENT-017）](#手动验收邮件收件箱client-017)（[#182](https://github.com/anitaguptaoffice/sanguo-slg/issues/182) / [#190](https://github.com/anitaguptaoffice/sanguo-slg/pull/190)）；招募相关仍见 [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) |
| **战报筛选**（outcome 客户端筛选 + 详情摘要） | [手动验收（战报筛选 CLIENT-016）](#手动验收战报筛选-client-016) |
| **HUD 资源变动提示** | [手动验收（HUD 资源变动，CLIENT-018）](#手动验收hud-资源变动-client-018)（[#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) / [#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191)） |

## Wave 13 闭环加深（M4 出口 / INTG-010）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-010** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC，需未来 contract 卡）。

| 能力 | 验收小节 |
|---|---|
| **内政/募兵队列倒计时** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019)（[#196](https://github.com/anitaguptaoffice/sanguo-slg/issues/196) / [#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206)） |
| **建造队列加速符** | [手动验收（队列加速 CLIENT-026）](#手动验收队列加速-client-026)（[#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214)） |
| **背包使用 / 商城购买可读反馈** | [手动验收（背包与商城反馈，CLIENT-020）](#手动验收背包与商城反馈-client-020)（[#197](https://github.com/anitaguptaoffice/sanguo-slg/issues/197) / [#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204)） |
| **排行双榜只读**（战力 / 资源总量 + 快照元数据） | [手动验收（排行双榜 CLIENT-021）](#手动验收排行双榜-client-021)（[#198](https://github.com/anitaguptaoffice/sanguo-slg/issues/198) / [#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207)） |
| **军团 / 聊天可读联调** | [手动验收（M3：选服 / 聊天 / 军团 / 排行，CLIENT-022）](#手动验收m3选服--聊天--军团--排行client-022)（[#199](https://github.com/anitaguptaoffice/sanguo-slg/issues/199) / [#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205)） |
| **招募成功 ↔ 日常将领任务闭环** | [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) 步骤 3（**CLIENT-023**，[#200](https://github.com/anitaguptaoffice/sanguo-slg/issues/200) / [#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208)） |

## Wave 14 日常与队列闭环（M4 出口 / INTG-011）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-011** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC，需未来 contract 卡）；募兵队列 **加速**（本波仅建造队列，见 **DOM-003** / **CLIENT-026**）。

| 能力 | 验收小节 |
|---|---|
| **建造加速真实生效**（道具 2003 → domestic `upgrade_finish_at_ms`） | [手动验收（队列加速 CLIENT-026）](#手动验收队列加速-client-026)（[#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214) / [#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222)；服务端 **DOM-003** [#211](https://github.com/anitaguptaoffice/sanguo-slg/issues/211) / [#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)） |
| **多类型日常引导**（chain 400 练兵/建造/战备） | [手动验收（日常练兵/建造/战备 CLIENT-024）](#手动验收日常练兵建造战备-client-024)（[#212](https://github.com/anitaguptaoffice/sanguo-slg/issues/212) / [#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220)） |
| **日常战报未读横幅**（chain 400 顶栏联动，wave:17 **CLIENT-044**） | [手动验收（日常战备与战报横幅 CLIENT-044）](#手动验收日常战备与战报横幅-client-044)（[#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) / [#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272) `d437076a`）；wave:17 总表见 [Wave 17](#wave-17-世界出征互链与复盘导航m4-出口--intg-014) |
| **行军结束 → 战报提示**（到达 toast + 战报未读） | [手动验收（行军到达与战报未读 CLIENT-025）](#手动验收行军到达与战报未读-client-025)（[#213](https://github.com/anitaguptaoffice/sanguo-slg/issues/213) / [#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)） |
| **HUD 待办徽章**（邮件 / 日常 / 战报底栏角标） | [手动验收（HUD 待办徽章，CLIENT-027）](#手动验收hud-待办徽章-client-027)（[#215](https://github.com/anitaguptaoffice/sanguo-slg/issues/215) / [#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)） |

## Wave 15 世界地图与面板密度（M4 出口 / INTG-012）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-012** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）。

| 能力 | 验收小节 |
|---|---|
| **世界地图行军只读标注**（小地图 ↔ `ListMarches` 联动） | [手动验收（世界地图行军标注 CLIENT-028）](#手动验收世界地图行军标注-client-028)（[#228](https://github.com/anitaguptaoffice/sanguo-slg/issues/228) / [#241](https://github.com/anitaguptaoffice/sanguo-slg/pull/241)） |
| **邮件 / 战报 / 背包密度**（空态、两行摘要、筛选空文案） | [手动验收（邮件战报背包密度 CLIENT-029）](#手动验收邮件战报背包密度-client-029)（[#229](https://github.com/anitaguptaoffice/sanguo-slg/issues/229) / [#238](https://github.com/anitaguptaoffice/sanguo-slg/pull/238)） |
| **排行 / 军团 / 聊天扫读** | [手动验收（社交扫读 CLIENT-030）](#手动验收社交扫读-client-030)（[#230](https://github.com/anitaguptaoffice/sanguo-slg/issues/230) / [#236](https://github.com/anitaguptaoffice/sanguo-slg/pull/236)） |
| **排行 / 聊天手动刷新** | [手动验收（社交刷新 CLIENT-045）](#手动验收社交刷新-client-045)（[#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269)） |
| **将领详情与招募池对比** | [手动验收（将领招募对比 CLIENT-031）](#手动验收将领招募对比-client-031)（[#231](https://github.com/anitaguptaoffice/sanguo-slg/issues/231) / [#235](https://github.com/anitaguptaoffice/sanguo-slg/pull/235)） |
| **manifest HUD / 面板接线** | [CLIENT-032 manifest 美术接线](#client-032-manifest-美术接线)（[#232](https://github.com/anitaguptaoffice/sanguo-slg/issues/232) / [#240](https://github.com/anitaguptaoffice/sanguo-slg/pull/240)） |
| **军事面板运行时三修**（wave:15 hotfix，非 wave:16 卡） | **CLIENT-033**（[#243](https://github.com/anitaguptaoffice/sanguo-slg/issues/243) / [#244](https://github.com/anitaguptaoffice/sanguo-slg/pull/244) `b320b4de`）：字色对比度、募兵/出征主按钮四态、1280 窄屏 HUD；证据见 `docs/art/samples/client-033/` |

## Wave 16 战报邮件闭环与军事反馈（M4 出口 / INTG-013）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-013** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **战报回合详情 + 行军结束深链** | [手动验收（战报详情 CLIENT-034）](#手动验收战报详情回合表与行军深链-client-034)（[#246](https://github.com/anitaguptaoffice/sanguo-slg/issues/246) / [#254](https://github.com/anitaguptaoffice/sanguo-slg/pull/254)） | 已合 |
| **邮件附件领取 + 未领高亮** | [手动验收（邮件附件领取 CLIENT-035）](#手动验收邮件附件领取-client-035)（[#247](https://github.com/anitaguptaoffice/sanguo-slg/issues/247) / [#253](https://github.com/anitaguptaoffice/sanguo-slg/pull/253)）；基础收件箱仍见 [CLIENT-017](#手动验收邮件收件箱client-017) | 已合 |
| **军事 panel manifest**（`ui.panel.military.v1`） | [CLIENT-032 manifest 美术接线](#client-032-manifest-美术接线) + [募兵 → 行军](#手动验收募兵--行军--战报client-012--client-013)（[#248](https://github.com/anitaguptaoffice/sanguo-slg/issues/248) / [#255](https://github.com/anitaguptaoffice/sanguo-slg/pull/255)）；募兵主按钮样式见 **CLIENT-033** hotfix | 已合 |
| **小地图比例尺 / 多行军扫读** | [手动验收（小地图 CLIENT-037）](#手动验收小地图比例尺与多行军-client-037)（[#249](https://github.com/anitaguptaoffice/sanguo-slg/issues/249) / [#256](https://github.com/anitaguptaoffice/sanguo-slg/pull/256) `5a4bb4af`） | 已合 |
| **小地图选点出征** | [手动验收（小地图选点 CLIENT-041）](#手动验收小地图选点出征-client-041)（[#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) / [#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275) `12a8850f`） | 已合 |
| **HUD 角标点击深链** | [手动验收（HUD 角标深链 CLIENT-038）](#手动验收hud-角标深链-client-038)（[#250](https://github.com/anitaguptaoffice/sanguo-slg/issues/250) / [#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258) `30c95e2a`） | 已合 |
| **1280 顶栏 canvas/DOM 叠字** | [手动验收（1280 顶栏 HUD CLIENT-039）](#手动验收1280-顶栏-hud-client-039)（[#259](https://github.com/anitaguptaoffice/sanguo-slg/issues/259) / [#260](https://github.com/anitaguptaoffice/sanguo-slg/pull/260) `9e98a28b`）；**不**替代 **CLIENT-033** hotfix | 已合 |

**wave:16 美术轨**（非 wave:17 实现卡）：**CLIENT-040**（[#262](https://github.com/anitaguptaoffice/sanguo-slg/issues/262) / [#263](https://github.com/anitaguptaoffice/sanguo-slg/pull/263) `a4add478`）1280 军事全页 `<1MB` 证据，见 [`docs/art/samples/client-040/`](../docs/art/samples/client-040/README.md)。

## Wave 17 世界出征互链与复盘导航（M4 出口 / INTG-014）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-014** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126；**CLIENT-040** 为 wave:16 美术证据轨、**非**本波实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图选点 → 出征 to_x/to_y** | [手动验收（小地图选点出征 CLIENT-041）](#手动验收小地图选点出征-client-041)（[#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265) / [#275](https://github.com/anitaguptaoffice/sanguo-slg/pull/275) `12a8850f`） | 已合 |
| **战报坐标摘要 → 小地图复盘高亮** | [手动验收（战报坐标与小地图复盘 CLIENT-042）](#手动验收战报坐标与小地图复盘-client-042)（[#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) / [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`） | 已合 |
| **军事出征目标记忆**（`sessionStorage`） | [手动验收（出征目标记忆 CLIENT-043）](#手动验收出征目标记忆-client-043)（[#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) / [#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279) `66e5578a`） | 已合 |
| **日常战备与战报未读横幅** | [手动验收（日常战备与战报横幅 CLIENT-044）](#手动验收日常战备与战报横幅-client-044)（[#268](https://github.com/anitaguptaoffice/sanguo-slg/issues/268) / [#272](https://github.com/anitaguptaoffice/sanguo-slg/pull/272) `d437076a`） | 已合 |
| **排行 / 聊天手动刷新与上次更新** | [手动验收（社交刷新 CLIENT-045）](#手动验收社交刷新-client-045)（[#269](https://github.com/anitaguptaoffice/sanguo-slg/issues/269) / [#273](https://github.com/anitaguptaoffice/sanguo-slg/pull/273) `5a3ae507`） | 已合 |
| **网关冒烟**（行军目的点 + 战报坐标） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 17** / `TestINTG014Wave17SmokePath`（[#270](https://github.com/anitaguptaoffice/sanguo-slg/issues/270) / [#274](https://github.com/anitaguptaoffice/sanguo-slg/pull/274) `90fb5356`） | 已合 |

**推荐串联**：小地图空白区选点（**CLIENT-041**，写入并记住 `to_x/to_y`）→ **军事** 出征（[CLIENT-015](#手动验收世界坐标-client-015) / [CLIENT-013](#手动验收募兵--行军--战报client-012--client-013)；**CLIENT-043** 会话预填/清除）→ 战报 **在地图查看** 复盘（**CLIENT-042**）→ **日常** 顶栏战报横幅（**CLIENT-044**）→ **排行/聊天** **刷新**（**CLIENT-045**）；网关字段见 `tools/smoke/README.md` **INTG-014**（`TestINTG014Wave17SmokePath`）。

**wave:18** 出征反馈与面板可读加深见下文 [Wave 18](#wave-18-出征反馈与面板可读加深m4-出口--intg-015)。**CLIENT-046**（[#277](https://github.com/anitaguptaoffice/sanguo-slg/issues/277) / [#280](https://github.com/anitaguptaoffice/sanguo-slg/pull/280)）为美术证据轨，**非** wave:18 backlog 实现卡；**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）046 FAIL 跟进修已合，证据见 [`docs/art/samples/client-054/`](../docs/art/samples/client-054/README.md)。

## Wave 18 出征反馈与面板可读加深（M4 出口 / INTG-015）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-015** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **军情 ETA 与列表密度** | [手动验收（行军列表 ETA CLIENT-047）](#手动验收行军列表-eta-与军情密度-client-047)（[#283](https://github.com/anitaguptaoffice/sanguo-slg/issues/283) / [#294](https://github.com/anitaguptaoffice/sanguo-slg/pull/294) `e2e4c367`） | 已合 |
| **出征表单格点/兵力校验** | [手动验收（出征表单校验 CLIENT-048）](#手动验收出征表单格点与兵力校验-client-048)（[#284](https://github.com/anitaguptaoffice/sanguo-slg/issues/284) / [#293](https://github.com/anitaguptaoffice/sanguo-slg/pull/293) `0e460f7b`） | 已合 |
| **战报加载更多与筛选记忆** | [手动验收（战报分页 CLIENT-049）](#手动验收战报加载更多与筛选记忆-client-049)（[#285](https://github.com/anitaguptaoffice/sanguo-slg/issues/285) / [#297](https://github.com/anitaguptaoffice/sanguo-slg/pull/297) `17a41ff2`） | 已合 |
| **邮件领取与 HUD 角标同步** | [手动验收（邮件领取 HUD 同步 CLIENT-050）](#手动验收邮件领取-hud-同步-client-050)（[#286](https://github.com/anitaguptaoffice/sanguo-slg/issues/286) / [#299](https://github.com/anitaguptaoffice/sanguo-slg/pull/299) `b40c01f7`） | 已合 |
| **HUD 资源变动脉冲** | [手动验收（HUD 资源脉冲 CLIENT-051）](#手动验收hud-资源变动脉冲-client-051)（[#288](https://github.com/anitaguptaoffice/sanguo-slg/issues/288) / [#295](https://github.com/anitaguptaoffice/sanguo-slg/pull/295) `504a91ef`） | 已合 |
| **建造队列↔日常互链** | [手动验收（日常 CLIENT-024）](#手动验收日常练兵建造战备-client-024) 步骤 5（**CLIENT-052**，[#289](https://github.com/anitaguptaoffice/sanguo-slg/issues/289) / [#296](https://github.com/anitaguptaoffice/sanguo-slg/pull/296) `a94cb935`） | 已合 |
| **社交空态与网关错误文案** | [手动验收（社交空态 CLIENT-053）](#手动验收社交空态与错误文案-client-053)（[#290](https://github.com/anitaguptaoffice/sanguo-slg/issues/290) / [#298](https://github.com/anitaguptaoffice/sanguo-slg/pull/298) `0b915f74`） | 已合 |
| **网关冒烟**（行军时刻 + 战报分页） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 18** / `TestINTG015Wave18SmokePath`（[#291](https://github.com/anitaguptaoffice/sanguo-slg/issues/291) / [#301](https://github.com/anitaguptaoffice/sanguo-slg/pull/301) `ee574240`） | 已合 |

**推荐串联**（在 [Wave 17](#wave-17-世界出征互链与复盘导航m4-出口--intg-014) 小地图选点/目标记忆基础上）：**军事** 出征前看 **march-form-error** 内联校验（**CLIENT-048**）→ 底栏 **「行军」** 扫读 ETA 次行（**CLIENT-047**）→ **战报** 筛选记忆 + **加载更多**（**CLIENT-049**）→ **邮件** 领取后角标即时同步（**CLIENT-050**）→ 领奖/购买后顶栏 **resource-pulse**（**CLIENT-051**）→ **队列**/**日常** 互链按钮（**CLIENT-052**）→ **排行/军团/聊天** 空错态（**CLIENT-053**）；网关字段见 `tools/smoke/README.md` **INTG-015**。

波次总览与 **DOCS-EXIT-010**（[#292](https://github.com/anitaguptaoffice/sanguo-slg/issues/292) / [#302](https://github.com/anitaguptaoffice/sanguo-slg/pull/302) `b63ed954`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 18」。

## Wave 19 可玩加深（M4 出口 / INTG-016）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-016** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **将领招募对比 + 钱包可负担** | [CLIENT-031](#手动验收将领招募对比-client-031) + [CLIENT-056](#手动验收将领招募钱包对比-client-056)（[#327](https://github.com/anitaguptaoffice/sanguo-slg/issues/327) / [#341](https://github.com/anitaguptaoffice/sanguo-slg/pull/341) `2006b478`） | 已合 |
| **商城购买 / 背包使用客户端校验** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020)（**CLIENT-057**，[#328](https://github.com/anitaguptaoffice/sanguo-slg/issues/328) / [#339](https://github.com/anitaguptaoffice/sanguo-slg/pull/339) `22368a0f`） | 已合 |
| **小地图目的点 ETA 角标与图例** | [手动验收（小地图 ETA CLIENT-058）](#手动验收小地图目的点-eta-client-058)（[#329](https://github.com/anitaguptaoffice/sanguo-slg/issues/329) / [#338](https://github.com/anitaguptaoffice/sanguo-slg/pull/338) `eb8f8a26`）；列表 ETA 基线 [CLIENT-047](#手动验收行军列表-eta-与军情密度-client-047) | 已合 |
| **建造/募兵队列总览 + 资源产出速率** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019)（**CLIENT-059**，[#330](https://github.com/anitaguptaoffice/sanguo-slg/issues/330) / [#343](https://github.com/anitaguptaoffice/sanguo-slg/pull/343) `6df0ef9f`） | 已合 |
| **邮件 ↔ 战报 ↔ 日常三角深链** | [CLIENT-044](#手动验收日常战备与战报横幅-client-044) / [CLIENT-038](#手动验收hud-角标深链-client-038) + **CLIENT-060**（[#331](https://github.com/anitaguptaoffice/sanguo-slg/issues/331) / [#344](https://github.com/anitaguptaoffice/sanguo-slg/pull/344) `97c99156`） | 已合 |
| **世界城池列表 ↔ 军情行双向高亮** | [CLIENT-047](#手动验收行军列表-eta-与军情密度-client-047) / [CLIENT-015](#手动验收世界坐标-client-015) + **CLIENT-061**（[#332](https://github.com/anitaguptaoffice/sanguo-slg/issues/332) / [#342](https://github.com/anitaguptaoffice/sanguo-slg/pull/342) `b2fb1a01`） | 已合 |
| **1280 将领/背包/队列 manifest 与滚动** | [CLIENT-032 manifest 美术接线](#client-032-manifest-美术接线) + [手动验收（1280 将领/背包/队列 CLIENT-062）](#手动验收1280-将领背包队列-client-062)（[#333](https://github.com/anitaguptaoffice/sanguo-slg/issues/333) / [#340](https://github.com/anitaguptaoffice/sanguo-slg/pull/340) `1d9ab72f`） | 已合 |
| **网关冒烟**（将领详情 + 邮件分页 + 城池队列字段） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 19** / `TestINTG016Wave19SmokePath`（[#334](https://github.com/anitaguptaoffice/sanguo-slg/issues/334) / [#337](https://github.com/anitaguptaoffice/sanguo-slg/pull/337) `7ecb7d4d`） | 已合 |

**推荐串联**（在 [Wave 18](#wave-18-出征反馈与面板可读加深m4-出口--intg-015) 军情/校验/分页基础上）：**将领** 招募模板持/需对比（**CLIENT-056**）→ **背包/商城** `shop-form-error` / `bag-form-error` 内联校验（**CLIENT-057**）→ 出征后小地图 **目的点数字 ETA**（**CLIENT-058**）→ **队列** 顶栏总览与 HUD 产出速率（**CLIENT-059**）→ **邮件/战报/日常** 来源标签与三角深链（**CLIENT-060**）→ **世界** 城池与 **行军** 列表互选高亮（**CLIENT-061**）→ 视口 **1280×720** 下将领/背包/队列 manifest 与滚动（**CLIENT-062**）；网关字段见 `tools/smoke/README.md` **INTG-016**。

**wave:18 美术轨**（非 wave:19 backlog）：**CLIENT-054**（[#287](https://github.com/anitaguptaoffice/sanguo-slg/issues/287) / [#300](https://github.com/anitaguptaoffice/sanguo-slg/pull/300) `870ebcf2`）、**CLIENT-055**（[#303](https://github.com/anitaguptaoffice/sanguo-slg/issues/303) / [#305](https://github.com/anitaguptaoffice/sanguo-slg/pull/305) `f675d43a`）——均非 wave:19 实现卡。**wave:19 美术轨旁路**：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）已合，证据 [`docs/art/samples/client-063/`](../docs/art/samples/client-063/README.md)；art hold **#108** 仍 FAIL → **CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）进行中。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-011**（[#335](https://github.com/anitaguptaoffice/sanguo-slg/issues/335) / [#346](https://github.com/anitaguptaoffice/sanguo-slg/pull/346) `d0920b5d`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 19」。**wave:20** 面板互链与反馈巩固见下文 [Wave 20](#wave-20-面板互链与反馈巩固m4-出口--intg-017)。

## Wave 20 面板互链与反馈巩固（M4 出口 / INTG-017）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-017** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **战报时间窗与胜负摘要** | [手动验收（战报时间窗 CLIENT-065）](#手动验收战报时间窗筛选-client-065)（[#350](https://github.com/anitaguptaoffice/sanguo-slg/issues/350) / [#360](https://github.com/anitaguptaoffice/sanguo-slg/pull/360) `9396165e`） | 已合 |
| **主城槽位升级摘要与队列深链** | [手动验收（主城槽位队列深链 CLIENT-066）](#手动验收主城槽位队列深链-client-066)（[#351](https://github.com/anitaguptaoffice/sanguo-slg/issues/351) / [#366](https://github.com/anitaguptaoffice/sanguo-slg/pull/366) `a9788a83`） | 已合 |
| **招募/商城/背包/出征统一错误口径** | [手动验收（四类面板统一错误 CLIENT-067）](#手动验收四类面板统一错误-client-067)（[#352](https://github.com/anitaguptaoffice/sanguo-slg/issues/352) / [#361](https://github.com/anitaguptaoffice/sanguo-slg/pull/361) `f858c821`） | 已合 |
| **邮件战报日常深链余量** | [手动验收（邮件战报日常深链 CLIENT-068）](#手动验收邮件战报日常深链-client-068)（[#353](https://github.com/anitaguptaoffice/sanguo-slg/issues/353) / [#363](https://github.com/anitaguptaoffice/sanguo-slg/pull/363) `4af126c8`） | 已合 |
| **军情格点筛选与小地图视野联动** | [手动验收（军情格点筛选 CLIENT-069）](#手动验收军情格点筛选-client-069)（[#354](https://github.com/anitaguptaoffice/sanguo-slg/issues/354) / [#362](https://github.com/anitaguptaoffice/sanguo-slg/pull/362) `857e696e`） | 已合 |
| **1280 军事/邮件/日常 manifest 与滚动** | [手动验收（1280 军事/邮件/日常 CLIENT-070）](#手动验收1280-军事邮件日常-client-070)（[#355](https://github.com/anitaguptaoffice/sanguo-slg/issues/355) / [#364](https://github.com/anitaguptaoffice/sanguo-slg/pull/364) `944a3cdd`） | 已合 |
| **队列↔日常行内进度与倒计时** | [手动验收（队列日常行内反馈 CLIENT-071）](#手动验收队列日常行内反馈-client-071)（[#356](https://github.com/anitaguptaoffice/sanguo-slg/issues/356) / [#359](https://github.com/anitaguptaoffice/sanguo-slg/pull/359) `4ea9e69f`） | 已合 |
| **网关冒烟**（战报时间字段 + 产出速率 + 军情格点） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 20** / `TestINTG017Wave20SmokePath`（[#357](https://github.com/anitaguptaoffice/sanguo-slg/issues/357) / [#365](https://github.com/anitaguptaoffice/sanguo-slg/pull/365) `4b522cae`） | 已合 |

**推荐串联**（在 [Wave 19](#wave-19-可玩加深m4-出口--intg-016) 招募对比/队列总览/邮件三角深链基础上）：**战报** 时间窗 + 胜负 chips（**CLIENT-065**）→ 画布 **升级中槽位** 点选深链 **队列** 行（**CLIENT-066**）→ **将领/商城/背包/军事** 统一 `formatPanelGatewayError`（**CLIENT-067**）→ **邮件/战报** 正文解析与 **相关日常** 标签（**CLIENT-068**）→ **行军** 格点筛选 + 小地图视野（**CLIENT-069**）→ 视口 **1280×720** 军事/邮件/日常 manifest 滚动（**CLIENT-070**）→ **队列/日常** 同行日课进度与倒计时（**CLIENT-071**）；网关字段见 `tools/smoke/README.md` **INTG-017**。

**wave:19 美术轨旁路**（**非** wave:20 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路进行中。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-012**（[#358](https://github.com/anitaguptaoffice/sanguo-slg/issues/358) / [#367](https://github.com/anitaguptaoffice/sanguo-slg/pull/367) `79f54e0d`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 20」。**wave:21** 养成复盘与世界可读加深见下文 [Wave 21](#wave-21-养成复盘与世界可读加深m4-出口--intg-018)。

## Wave 21 养成复盘与世界可读加深（M4 出口 / INTG-018）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-018** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **将领详情养成对比与招募背包互链** | [手动验收（将领详情养成对比 CLIENT-072）](#手动验收将领详情养成对比-client-072)（[#369](https://github.com/anitaguptaoffice/sanguo-slg/issues/369) / [#385](https://github.com/anitaguptaoffice/sanguo-slg/pull/385) `03c8149b`） | 已合 |
| **世界城池与资源格只读信息卡** | [手动验收（世界格点信息卡 CLIENT-073）](#手动验收世界格点信息卡-client-073)（[#370](https://github.com/anitaguptaoffice/sanguo-slg/issues/370) / [#386](https://github.com/anitaguptaoffice/sanguo-slg/pull/386) `87a2a8cb`） | 已合 |
| **战报详情回合跳转与部队摘要** | [CLIENT-034](#手动验收战报详情回合表与行军深链-client-034) / [CLIENT-065](#手动验收战报时间窗筛选-client-065) + **CLIENT-074**（[#371](https://github.com/anitaguptaoffice/sanguo-slg/issues/371) / [#379](https://github.com/anitaguptaoffice/sanguo-slg/pull/379) `4102f1a5`） | 已合 |
| **日常列表筛选记忆与完成态扫读** | [CLIENT-049](#手动验收战报加载更多与筛选记忆-client-049) / [CLIENT-071](#手动验收队列日常行内反馈-client-071) + **CLIENT-075**（[#372](https://github.com/anitaguptaoffice/sanguo-slg/issues/372) / [#381](https://github.com/anitaguptaoffice/sanguo-slg/pull/381) `b0ca4ba5`） | 已合 |
| **排行/军团/聊天刷新与空错态巩固** | [CLIENT-045](#手动验收社交刷新-client-045) / [CLIENT-053](#手动验收社交空态与错误文案-client-053) + **CLIENT-076**（[#373](https://github.com/anitaguptaoffice/sanguo-slg/issues/373) / [#384](https://github.com/anitaguptaoffice/sanguo-slg/pull/384) `439c1b67`） | 已合 |
| **HUD 待办角标与中心面板深链** | [手动验收（HUD 待办聚合与中心面板深链 CLIENT-077）](#手动验收hud-待办聚合与中心面板深链-client-077)（[#374](https://github.com/anitaguptaoffice/sanguo-slg/issues/374) / [#387](https://github.com/anitaguptaoffice/sanguo-slg/pull/387) `e1d44182`） | 已合 |
| **1280 将领/世界/排行 manifest 与滚动** | [手动验收（1280 将领/世界/排行 CLIENT-078）](#手动验收1280-将领世界排行-client-078)（[#375](https://github.com/anitaguptaoffice/sanguo-slg/issues/375) / [#383](https://github.com/anitaguptaoffice/sanguo-slg/pull/383) `8187d4f4`） | 已合 |
| **背包批量使用与商城分类扫读** | [CLIENT-020](#手动验收背包与商城反馈-client-020)（**CLIENT-057** 购买校验基线，wave:19）+ **CLIENT-079**（[#376](https://github.com/anitaguptaoffice/sanguo-slg/issues/376) / [#382](https://github.com/anitaguptaoffice/sanguo-slg/pull/382) `c9b53258`） | 已合 |
| **网关冒烟**（将领养成字段 + 战报 rounds + 日常进度 + 城池格点） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 21** / `TestINTG018Wave21SmokePath`（[#377](https://github.com/anitaguptaoffice/sanguo-slg/issues/377) / [#380](https://github.com/anitaguptaoffice/sanguo-slg/pull/380) `0a78b1d6`） | 已合 |

**推荐串联**（在 [Wave 20](#wave-20-面板互链与反馈巩固m4-出口--intg-017) 时间窗/槽位深链/经济错误统一基础上）：**将领** 详情养成对比与招募背包互链（**CLIENT-072**）→ **世界** 格点只读信息卡与军情互链（**CLIENT-073**）→ **战报** 回合跳转与坐标部队摘要（**CLIENT-074**）→ **日常** 筛选记忆与完成态扫读（**CLIENT-075**）→ **排行/军团/聊天** 刷新巩固（**CLIENT-076**）→ **HUD** 待办与中心面板深链（**CLIENT-077**）→ 视口 **1280×720** 将领/世界/排行 manifest（**CLIENT-078**）→ **背包** 批量与 **商城** 分类扫读（**CLIENT-079**）；网关字段见 `tools/smoke/README.md` **INTG-018**。

**wave:19 美术轨旁路**（**非** wave:21 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:21 backlog 实现卡）。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-013**（[#378](https://github.com/anitaguptaoffice/sanguo-slg/issues/378) / [#388](https://github.com/anitaguptaoffice/sanguo-slg/pull/388) `b5a1488e`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 21」。**wave:22** 出征执行反馈与主城经济扫读见下文 [Wave 22](#wave-22-出征执行反馈与主城经济扫读m4-出口--intg-019)。

## Wave 22 出征执行反馈与主城经济扫读（M4 出口 / INTG-019）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-019** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**（仅建造队列，见 wave:14 **DOM-003**）；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **出征提交反馈与新行军高亮** | [手动验收（出征提交反馈 CLIENT-080）](#手动验收出征提交反馈-client-080)（[#390](https://github.com/anitaguptaoffice/sanguo-slg/issues/390) / [#403](https://github.com/anitaguptaoffice/sanguo-slg/pull/403) `4a73aa2e`） | 已合 |
| **HUD 资源余量与产出扫读** | [手动验收（HUD 资源扫读 CLIENT-081）](#手动验收hud-资源扫读-client-081)（[#391](https://github.com/anitaguptaoffice/sanguo-slg/issues/391) / [#402](https://github.com/anitaguptaoffice/sanguo-slg/pull/402) `63a5dcee`） | 已合 |
| **建造升级下级消耗只读预览** | [手动验收（建造消耗预览 CLIENT-082）](#手动验收建造消耗预览-client-082)（[#392](https://github.com/anitaguptaoffice/sanguo-slg/issues/392) / [#407](https://github.com/anitaguptaoffice/sanguo-slg/pull/407) `023e2524`） | 已合 |
| **战报上一封/下一封与胜负 streak** | [手动验收（战报上一封下一封与胜负 streak CLIENT-083）](#手动验收战报上一封下一封与胜负-streak-client-083)（[#393](https://github.com/anitaguptaoffice/sanguo-slg/issues/393) / [#406](https://github.com/anitaguptaoffice/sanguo-slg/pull/406) `b081d127`） | 已合 |
| **军团成员→聊天草稿一步** | [手动验收（军团提到聊天草稿 CLIENT-084）](#手动验收军团提到聊天草稿-client-084)（[#394](https://github.com/anitaguptaoffice/sanguo-slg/issues/394) / [#401](https://github.com/anitaguptaoffice/sanguo-slg/pull/401) `e19d0a71`） | 已合 |
| **军情行军阶段变更提醒** | [手动验收（军情阶段提醒与列表 chips CLIENT-085）](#手动验收军情阶段提醒与列表-chips-client-085)（[#395](https://github.com/anitaguptaoffice/sanguo-slg/issues/395) / [#408](https://github.com/anitaguptaoffice/sanguo-slg/pull/408) `48b0960c`） | 已合 |
| **1280 军情/战报/主城队列 manifest** | [手动验收（1280 军情/战报/主城队列 CLIENT-086）](#手动验收1280-军情战报主城队列-client-086)（[#396](https://github.com/anitaguptaoffice/sanguo-slg/issues/396) / [#409](https://github.com/anitaguptaoffice/sanguo-slg/pull/409) `77749bd8`） | 已合 |
| **邮件附件多选批量领取** | [手动验收（邮件附件批量领取 CLIENT-087）](#手动验收邮件附件批量领取-client-087)（[#397](https://github.com/anitaguptaoffice/sanguo-slg/issues/397) / [#405](https://github.com/anitaguptaoffice/sanguo-slg/pull/405) `f647b4bc`） | 已合 |
| **网关冒烟**（资源余量 + 行军 phase + 军团成员） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 22** / `TestINTG019Wave22SmokePath`（[#398](https://github.com/anitaguptaoffice/sanguo-slg/issues/398) / [#404](https://github.com/anitaguptaoffice/sanguo-slg/pull/404) `2482fd64`） | 已合 |

**推荐串联**（在 [Wave 21](#wave-21-养成复盘与世界可读加深m4-出口--intg-018) 养成对比/世界信息卡/战报回合跳转基础上）：**军事** 出征提交反馈与高亮新行军（**CLIENT-080**）→ 顶栏 **资源扫读**（**CLIENT-081**）→ 画布槽位 **升级消耗预览**（**CLIENT-082**）→ **战报** 相邻导航与 streak（**CLIENT-083**）→ **军团** **提到** 填入聊天草稿（**CLIENT-084**）→ 军情 **phase** 变更提醒与列表 chips（**CLIENT-085**）→ 视口 **1280×720** 军情/战报/队列 manifest（**CLIENT-086**）→ **邮件** 勾选 **批量领取**（**CLIENT-087**）；网关字段见 `tools/smoke/README.md` **INTG-019**。

**wave:19 美术轨旁路**（**非** wave:22 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:22 backlog 实现卡）。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-014**（[#399](https://github.com/anitaguptaoffice/sanguo-slg/issues/399) / [#410](https://github.com/anitaguptaoffice/sanguo-slg/pull/410) `23a6f0ed`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 22」。**wave:23** 后勤互链与全链路反馈加深见下文 [Wave 23](#wave-23-后勤互链与全链路反馈加深m4-出口--intg-020)。

## Wave 23 后勤互链与全链路反馈加深（M4 出口 / INTG-020）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-020** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**；**永不合并** art hold PR #77/#82/#108/#100/#126。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **募兵下一批消耗只读预览** | [手动验收（募兵消耗预览 CLIENT-088）](#手动验收募兵消耗预览-client-088)（[#412](https://github.com/anitaguptaoffice/sanguo-slg/issues/412) / [#423](https://github.com/anitaguptaoffice/sanguo-slg/pull/423) `d60d8345`） | 已合 |
| **出征 ETA 与兵力汇总条** | [出征表单校验 CLIENT-048](#手动验收出征表单格点与兵力校验-client-048) 内 **march-form-summary**（**CLIENT-089**，[#413](https://github.com/anitaguptaoffice/sanguo-slg/issues/413) / [#429](https://github.com/anitaguptaoffice/sanguo-slg/pull/429) `b610caab`） | 已合 |
| **小地图与军情高亮互选** | [手动验收（小地图与军情互选 CLIENT-090）](#手动验收小地图与军情互选-client-090)（[#414](https://github.com/anitaguptaoffice/sanguo-slg/issues/414) / [#430](https://github.com/anitaguptaoffice/sanguo-slg/pull/430) `358f88aa`） | 已合 |
| **日常可领取首条定位与领奖脉冲** | [手动验收（日常可领取定位 CLIENT-091）](#手动验收日常可领取定位-client-091)（[#415](https://github.com/anitaguptaoffice/sanguo-slg/issues/415) / [#426](https://github.com/anitaguptaoffice/sanguo-slg/pull/426) `f3523e87`） | 已合 |
| **商城/背包购买缺口对比** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020) 第 7 步 **CLIENT-092**（[#416](https://github.com/anitaguptaoffice/sanguo-slg/issues/416) / [#427](https://github.com/anitaguptaoffice/sanguo-slg/pull/427) `6394ddfb`） | 已合 |
| **军情行再出征预填** | [手动验收（军情再出征预填 CLIENT-093）](#手动验收军情再出征预填-client-093)（[#417](https://github.com/anitaguptaoffice/sanguo-slg/issues/417) / [#425](https://github.com/anitaguptaoffice/sanguo-slg/pull/425) `62dd6def`） | 已合 |
| **战报相邻导航键盘与焦点环** | [手动验收（战报相邻导航键盘与焦点环 CLIENT-094）](#手动验收战报相邻导航键盘与焦点环-client-094)（[#418](https://github.com/anitaguptaoffice/sanguo-slg/issues/418) / [#428](https://github.com/anitaguptaoffice/sanguo-slg/pull/428) `f8152b2d`） | 已合 |
| **1280 背包/商城/军团 manifest** | [手动验收（1280 背包/商城/军团聊天 CLIENT-095）](#手动验收1280-背包商城军团聊天-client-095)（[#419](https://github.com/anitaguptaoffice/sanguo-slg/issues/419) / [#431](https://github.com/anitaguptaoffice/sanguo-slg/pull/431) `7d19874f`） | 已合 |
| **网关冒烟**（商城价 + 邮件未领附件 + 建筑 level） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 23** / `TestINTG020Wave23SmokePath`（[#420](https://github.com/anitaguptaoffice/sanguo-slg/issues/420) / [#424](https://github.com/anitaguptaoffice/sanguo-slg/pull/424) `d27e863e`） | 已合 |

**推荐串联**（在 [Wave 22](#wave-22-出征执行反馈与主城经济扫读m4-出口--intg-019) 出征反馈/HUD 经济扫读基础上）：**军事** 募兵消耗预览（**CLIENT-088**）→ 出征 **汇总条**（**CLIENT-089**）→ **小地图↔军情** 互选（**CLIENT-090**）→ **日常** 可领取定位与领奖脉冲（**CLIENT-091**）→ **商城/背包** 缺口对比（**CLIENT-092**）→ 军情 **再出征** 预填（**CLIENT-093**）→ **战报** 键盘相邻导航（**CLIENT-094**）→ 视口 **1280×720** 背包/商城/军团 manifest（**CLIENT-095**）；网关字段见 `tools/smoke/README.md` **INTG-020**。

**wave:19 美术轨旁路**（**非** wave:23 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:23 backlog 实现卡）。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-015**（[#421](https://github.com/anitaguptaoffice/sanguo-slg/issues/421) / [#432](https://github.com/anitaguptaoffice/sanguo-slg/pull/432) `58ec47a2`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 23」。**wave:24** 社交排行与将领执行反馈加深见下文 [Wave 24](#wave-24-h5-社交排行与将领执行反馈加深m4-出口--intg-021)。

## Wave 24 H5 社交排行与将领执行反馈加深（M4 出口 / INTG-021）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-021** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**；**永不合并** art hold PR #77/#82/#108/#100/#126 及 VERIFY [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444)。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **双榜我的排名钉选与刷新戳记** | [手动验收（社交扫读 CLIENT-030）](#手动验收社交扫读-client-030) 排行第 1 步 **CLIENT-096**（[#434](https://github.com/anitaguptaoffice/sanguo-slg/issues/434) / [#446](https://github.com/anitaguptaoffice/sanguo-slg/pull/446) `4f8821bc`） | 已合 |
| **排行条目→将领/世界深链** | [手动验收（社交扫读 CLIENT-030）](#手动验收社交扫读-client-030) 排行第 1 步 **CLIENT-097**（[#435](https://github.com/anitaguptaoffice/sanguo-slg/issues/435) / [#454](https://github.com/anitaguptaoffice/sanguo-slg/pull/454) `225ee845`） | 已合 |
| **将领招募提交执行反馈** | [手动验收（将领招募钱包对比 CLIENT-056）](#手动验收将领招募钱包对比-client-056) + **CLIENT-098**（[#436](https://github.com/anitaguptaoffice/sanguo-slg/issues/436) / [#450](https://github.com/anitaguptaoffice/sanguo-slg/pull/450) `fd5e0128`） | 已合 |
| **将领列表刷新与详情选中记忆** | [手动验收（将领详情养成对比 CLIENT-072）](#手动验收将领详情养成对比-client-072) + **CLIENT-099**（[#437](https://github.com/anitaguptaoffice/sanguo-slg/issues/437) / [#451](https://github.com/anitaguptaoffice/sanguo-slg/pull/451) `c207b6c9`） | 已合 |
| **战报攻守摘要与排行/将领互链** | [手动验收（战报详情 CLIENT-034）](#手动验收战报详情回合表与行军深链-client-034) + **CLIENT-100**（[#438](https://github.com/anitaguptaoffice/sanguo-slg/issues/438) / [#453](https://github.com/anitaguptaoffice/sanguo-slg/pull/453) `91ee2474`） | 已合 |
| **军团成员职务分组** | [手动验收（社交扫读 CLIENT-030）](#手动验收社交扫读-client-030) 军团第 2 步 **CLIENT-101**（[#439](https://github.com/anitaguptaoffice/sanguo-slg/issues/439) / [#448](https://github.com/anitaguptaoffice/sanguo-slg/pull/448) `d68c5f27`） | 已合 |
| **聊天未读与社交角标** | [手动验收（聊天未读与社交角标 CLIENT-102）](#手动验收聊天未读与社交角标-client-102)（[#440](https://github.com/anitaguptaoffice/sanguo-slg/issues/440) / [#455](https://github.com/anitaguptaoffice/sanguo-slg/pull/455) `da139567`） | 已合 |
| **1280 排行/将领/日常 manifest** | [手动验收（1280 排行将领日常 CLIENT-103）](#手动验收1280-排行将领日常-client-103)（[#441](https://github.com/anitaguptaoffice/sanguo-slg/issues/441) / [#449](https://github.com/anitaguptaoffice/sanguo-slg/pull/449) `62e13a90`） | 已合 |
| **网关冒烟**（双榜 my_rank + 军团 role + 可选招募） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 24** / `TestINTG021Wave24SmokePath`（[#442](https://github.com/anitaguptaoffice/sanguo-slg/issues/442) / [#447](https://github.com/anitaguptaoffice/sanguo-slg/pull/447) `9eb18c48`） | 已合 |

**推荐串联**（在 [Wave 23](#wave-23-后勤互链与全链路反馈加深m4-出口--intg-020) 背包商城军团 manifest 基础上）：**排行** 双榜钉选与刷新戳记（**CLIENT-096**）→ 榜单行 **将领/世界** 深链（**CLIENT-097**）→ **将领** 招募执行反馈（**CLIENT-098**）与列表刷新/选中记忆（**CLIENT-099**）→ **战报** 攻守摘要与排行互链（**CLIENT-100**）→ **军团** 职务分组（**CLIENT-101**）→ **聊天** 未读与底栏角标（**CLIENT-102**）→ 视口 **1280×720** 排行/将领/日常 manifest（**CLIENT-103**）；网关字段见 `tools/smoke/README.md` **INTG-021**。

**wave:19 美术轨旁路**（**非** wave:24 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（完整浏览器视口队列证据，**非** wave:24 backlog 实现卡）。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-016**（[#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 24」。

### 手动验收（聊天未读与社交角标 CLIENT-102）

`ListChatMessages` 快照 + 本地 `localStorage` 键 **`chat-last-read-ts`** 估算世界/军团频道未读（无服务端 read cursor）。底栏 **「聊天」** 角标为两频道之和，**「军团」** 角标与聊天面板 **军团** tab、军团面板 **军团频道** 入口同步；打开频道并 **滚到底** 后该频道未读清零。单测：`chatUnread.test.ts`（`estimateChatUnread`）、`chatUnreadPoll.test.ts`；与 **CLIENT-077** 顶栏待办角标并存。

### 手动验收（HUD 待办角标单一事实源 CLIENT-107）

`src/net/hudTodoBadges.ts` 为底栏角标与 **CLIENT-077** 顶栏待办深链的**唯一计数推导**（`HudTodoBadgePoll` 轮询写入快照后调用 `buildHudTodoBadges`）。**CLIENT-102** 聊天/军团角标仍走 `ChatUnreadTracker`，**不**并入顶栏「待办」总和。

| 入口 | 计数规则（纯函数） | 清零 / 抑制 |
|---|---|---|
| 底栏 **邮件** | `mailToolbarBadgeCount`：未读 `total_count` + 首屏「已读未领附件」（去重，兼容 **CLIENT-106** `countMailUnreadAndUnclaimed`） | 打开邮件面板；领取/MarkRead 后 `applyMailUnreadSnapshot` 递减 |
| 底栏 **日常** | `dailyToolbarBadgeCount`：chain 400 **可领取** `state=3`（**CLIENT-091**） | 打开日常面板 |
| 底栏 **队列** | `queueBuildingToolbarBadgeCount`：`upgrade_finish_at_ms > now` 槽位数 | 打开队列面板；建造完成或倒计时结束随 **GetCityState** `recomputeToolbarCounts` |
| 底栏 **战报** | `BattleReportUnreadSession`（**CLIENT-027/025**） | 打开战报面板 |
| 底栏 **聊天** / **军团** | `ChatUnreadTracker.getSummary`（**CLIENT-102**） | 频道滚到底 `markChannelRead` |
| 顶栏 **待办** | `buildHudCenterTodoCounts`：可领附件邮件 / 可领日常 / `BuildCompleteTodoTracker` 建造完成 | 领取、确认队列完成槽位；与上表邮件/日常数字同源 |

dev 空邮件/空日常：角标 **0 隐藏**，不抛错。单测：`hudTodoBadges.test.ts`、`hudTodoBadgePoll.test.ts`、`hudCenterTodo.test.ts`。

### 手动验收（将领招募执行反馈 CLIENT-098）

在 [CLIENT-056](#手动验收将领招募钱包对比-client-056) 钱包对比与 [CLIENT-067](#手动验收四类面板统一错误-client-067) 错误口径上：

1. 点 **招募**：主按钮 **disabled** 且文案 **提交中…**；成功则状态栏 `formatRecruitSuccessStatus` 摘要，可选 **打开详情**（带新 `hero_id`）；扣费涉及粮木铁石时顶栏 **resource-pulse**（**CLIENT-051**）。
2. 失败：inline 错误保留模板选中；不扩 recruit pool。单测：`HeroMailPanels.test.ts` / 招募状态机纯函数。

### 手动验收（将领列表刷新与选中记忆 CLIENT-099）

在 [CLIENT-072](#手动验收将领详情养成对比-client-072) 养成对比上：

1. **刷新** 将领列表：loading + 成功后 `hero-list-refresh-pulse` 短暂高亮；失败走 **CLIENT-067**。
2. 关闭再开将领面板：`sessionStorage` **`hero-detail-selected-id`** 恢复上次行并滚入视；与 **CLIENT-098** 成功深链写入一致。

### 手动验收（战报攻守摘要与排行互链 CLIENT-100）

在 [CLIENT-034](#手动验收战报详情回合表与行军深链-client-034) / [CLIENT-083](#手动验收战报上一封下一封与胜负-streak-client-083) / [CLIENT-094](#手动验收战报相邻导航键盘与焦点环-client-094) 基础上：

1. 战报详情顶栏只读 **攻方/守方** 玩家名 + 模板名一行摘要（`formatBattleReportSideSummary`）。
2. **打开将领** / **打开排行**：己方攻将→将领详情；守方 viewer→详情，否则只读提示；排行按钮打开战力榜并高亮可映射行（**CLIENT-097** 规则）。

## 网关地址

| 环境 | 变量 / 地址 |
|------|-------------|
| 本地 `make dev`（**默认**） | `ws://127.0.0.1:8080/ws` |
| 本地 mock（登录 + 军事桩） | `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws` |
| 其他环境 | 构建前设置 `VITE_GATEWAY_WS_URL` |

配置见 `src/config.ts`。军事消息定义在 `spec/proto/sanguo/military/v1/military.proto`（客户端通过 `loadProto` 加载 spec + `client/proto` 扩展，不修改 `spec/`）。

## 联调真实后端（推荐）

```bash
# 仓库根目录：Postgres + Redis + Go 网关（INTG-002 战斗闭环）
make dev

# 另一终端：H5
cd client && npm install && npm run dev
# 浏览器 http://localhost:5173
```

默认账号：`demo` / `demo123`。启动后先在 **选服界面** 点选服务器再「进入游戏」。

布局基线见仓库根 [`docs/art/layout-landscape.md`](../docs/art/layout-landscape.md)（**1600×900** 外框、舞台 **1600×788**、HUD/底栏各 **56px**）。实现入口：`src/engine/layoutViewport.ts`、`src/engine/mainCitySlots.ts`、`GameApp` 全屏 letterbox。

主城 HUD / 画布上的**建筑等级**（城主府、农田等）来自 `domestic.v1.GetCityState` 响应的 `buildings`（`slot_key`、`level`、`upgrade_finish_at_ms`），见 `src/net/hudFormat.ts` 与 `MainCityScene`。

### 手动验收（横屏布局 CLIENT-007 / HUD CLIENT-011）

1. `cd client && npm run dev`，浏览器打开 H5；窗口可任意比例，页面背景为 `#1a1410`，中间为等比缩放的 **16:9 游戏外框**（非 16:9 时出现上下或左右黑边）。
2. 开发者工具将视口设为 **1600×900**：画布外框应贴满窗口；主城 **HUD** 占顶栏 56px（`#hud` 叠在画布上缘），**底栏** 按钮行占底部 56px（`.layout-toolbar`），中间为舞台。CLIENT-011：`#hud` 应展示五资源当前值；城主府/农田等槽位标签含 **Lv.N**（升级进行中时可带完成时间摘要）。
3. 视口 **1280×720**：外框缩放至 1280×720（`uiScale=0.8`，见 `layoutViewport.test.ts`）；`mc.bg.plateau.v1` 仍铺满舞台 y∈[56,844)，`hall`/`farm` 样件与槽位对齐（可对照 `docs/art/maincity-slots.md`）。
4. 视口 **400×900**（窄屏）：左右贴边、上下 letterbox；点击农田槽位仍可触发升级（hit 区域随 `uiScale` 缩放）。
5. 选服界面面板居中落在舞台区域内（顶底各留 56px 带）。

### 手动验收（M3：选服 / 聊天 / 军团 / 排行，CLIENT-022）

1. 连接 `make dev` 后打开 H5，选服列表应出现至少 `S1`（dev 服 1）。
2. 进入主城后点 **「聊天」**：
   - 列表行应含 **频道**（世界/私聊/军团）、**本地时间**（`sent_at_ms`）、**发送者 display_name 与 player_id**、正文。
   - 世界频道发一条消息并点「刷新」应能看到记录；私聊需填对方 `player_id`。
   - **军团**频道需先在「军团」面板创建/加入军团；未入团时客户端拦截发送，状态栏提示需先入团；服务端可能返回 `61005`/`61001`，状态栏显示中文摘要 + `code`。
   - 真实服可用 `cmd/gm mute` 测禁言；mock 网关在世界频道发送内容 **`__mock_mute__`** 可模拟 5 分钟禁言，再次发送应看到 **已被禁言 (code=61006)**。
3. 点 **「军团」**：创建或加入后顶栏 **`guild-summary`** 应持久显示 `guild_id` 与名称（同一会话内切换面板不丢失）；「刷新成员」列表行含 **职务**（`guildRoleLabel`）与 **加入时间**（若 API 返回 `joined_at_ms`）。加入不存在的军团时状态栏应可读（如 `军团不存在 (code=60001)`）。
4. 点 **「排行」**：双榜与快照元数据见 [CLIENT-021](#手动验收排行双榜-client-021)；扫读加深见 [CLIENT-030](#手动验收社交扫读-client-030)。本小节侧重军团/聊天可读（CLIENT-022）。
5. M2 军事/内政仍可用：**「军事」**、**「升级农田」** 等。

mock 网关（军团频道 + 禁言桩）：

```bash
cd client && npm run mock:gateway
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（M4：任务 / 背包 / 商城，对齐 INTG-004）

与 `tools/smoke/README.md` 中 `TestM4ContentSmokePath` 同路径（教程任务 1001、商城 offer 1001、道具 2001）。

1. `make dev` 启动后进入主城，HUD 显示 **币**（`player_wallet.gold`，商城银币价映射到 gold 字段）。
2. **任务**：打开「任务」→「接取」→「上报进度(绝对值2)」→「领奖」。背包应出现谷袋·初备（2001）；HUD 粮/币随奖励变化。
3. **商城**：打开「商城」→「刷新货架」→ 选择 offer 1001 →「购买×1」。余额不足时面板与状态栏显示 `[code] msg`（如 `[64003] 余额不足`）；成功时见 [CLIENT-020](#手动验收背包与商城反馈-client-020)。
4. **背包**：「刷新背包」调用 `content.v1.ListPlayerBag`；「使用道具」调用 `content.v1.UseConsumable`。效果摘要见 [CLIENT-020](#手动验收背包与商城反馈-client-020)。CLIENT-010 起列表行展示道具名/数量摘要，商城货架行展示 offer 标题与价格。

### 手动验收（日常 chain 400，CLIENT-009）

与 `tools/smoke/README.md` / INTG-007 中 `daily_food_1`（`quest_cfg_id=1012`，`chain_id=400`）一致；进度由服务端 QUEST-002 自动挂钩，客户端**无**手填上报。

1. `make dev` 进入主城（君主等级须满足 cfg 解锁，dev 账号通常已够）。
2. 底栏点 **「日常」**（与教程 **「任务」** 面板分离）。列表应经 `quest.v1.ListPlayerQuests` + `chain_id=400` 展示 `daily_food_1` 等行：cfg code、状态文案、`current/target` 进度。
3. 选中 `daily_food_1` → **接取** → 通过内政收粮或等待资源累积使进度达标（真实服自动推进）→ **领奖**。HUD **粮/木/铁/石/币** 与状态栏背包摘要应更新（`ListPlayerBag` + 领奖 `granted_rewards` 合并，同 ContentPanels）。
4. 视口 **1600×900**：底栏含「日常」且单行不撑破 56px 底栏；面板落在顶底 56px 带之间、可滚动。

mock 网关（chain 400 默认列出 1012）：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（日常练兵/建造/战备 CLIENT-024）

与 DATA-002 / QUEST-003 一致：`daily_train_1`（`quest_cfg_id=1014`）、`daily_build_1`（`1032`）、`daily_march_1`（`1033`，`use_item` + `march_ration` → `item_cfg_id=2020`）。chain 400 **无**手填 `ReportQuestProgress`。

1. `make dev` 进入主城，君主等级满足对应日常解锁（dev 账号通常已够）。
2. 底栏 **「日常」** → **刷新列表**。每行应带 objective 标签（如 `[练兵]`、`[建造]`、`[战备]`）+ cfg code + `current/target` 进度（与 ListPlayerQuests 一致）。
3. **daily_train_1**：接取且进行中 → 详情/「下一步」提示募兵 → 点 **「前往下一步」** 应打开 **「队列」** 与 **「军事」**；完成募兵后进度由服务端推进 → **领奖**，顶栏 CLIENT-018 `+…` 飘字与 HUD 更新。
4. **daily_build_1**：接取且进行中 → **「前往下一步」** 打开 **「队列」**；对农田等发起升级并完成队列后进度达标 → 领奖。
5. **CLIENT-052 队列↔日常互链**：`daily_build_1` 进行中且农田（`building_cfg_id=2`）正在升级 → **「队列」** 对应建造行出现 **「日常：下一步」**，点击打开 **「日常」** 并滚到 1032 行；日常列表该行附带 **队列：农田 → Lv… · 剩余 …** 只读摘要（与队列面板同一 `GetCityState` 快照，不新 RPC）。加速符 **DOM-003** 逻辑不变。
6. **daily_march_1**：接取且进行中 → **「前往下一步」** 打开 **「背包」** 并高亮 **2020 远征干粮** → **使用道具** 成功后日常进度推进 → 领奖。
7. 单测：`dailyQuestObjective.test.ts`、`dailyQuestQueueMatch.test.ts`；全量 `cd client && npm test`。

### 手动验收（日常战备与战报横幅 CLIENT-044）

在 **CLIENT-024** 日常引导与 **CLIENT-025** 战报未读口径上，于 chain 400 面板顶部增加战报联动横幅；与 **CLIENT-035** 邮件未领附件高亮（独立「邮件」面板）互不遮挡。

1. `make dev` 或 mock：产生至少一条相对上次打开战报面板未读的战报（见 [CLIENT-025](#手动验收行军到达与战报未读-client-025)）。
2. 底栏 **「日常」** 打开后，标题下方应出现金色边条横幅 **「有未读战报，点击查看」**；无未读时不占位。
3. **点击横幅** → 打开 **「战报」** 面板并深链首条未读（与底栏战报角标深链 **CLIENT-038** 一致）；未读清零后横幅消失。
4. **daily_march_1**（1033）进行中：列表行标签为 **`[战备]`**；**「前往下一步」** 仍打开背包并高亮 **2020**（CLIENT-024）。
5. 同时存在未领附件邮件时：邮件面板 **「领取附件」** 高亮与日常横幅可同时存在，各自面板内展示。
6. 单测：`dailyQuestBattleReportBanner.test.ts`、`DailyQuestPanels.test.ts`；全量 `cd client && npm test`。

### 手动验收（小地图选点出征 CLIENT-041）

在 [CLIENT-037 小地图](#手动验收小地图比例尺与多行军-client-037) 与 [CLIENT-015 世界坐标出征](#手动验收世界坐标-client-015) 之上：小地图 **空白区域** 单击经 `minimapLayoutToWorld` 反算世界格点并写入军事出征 **to_x/to_y**（`applyMarchTargetToForm`）；点击已有 **行军目的点** 仍走 `findMarchIdForMinimapDestClick` 选中 `ListMarches` 行（CLIENT-037 行为不变）。

1. `make dev` 进主城，展开小地图；在 **非目的点**、非折叠 toggle 区域单击，状态栏应提示 **已选出征目标 (x,y)**，**军事** 面板自动展开且 `to_x`/`to_y` 与之一致（`clampWorldMapCoord`，0..499）。
2. 用该坐标完成 [募兵 → 行军](#手动验收募兵--行军--战报client-012--client-013)；`ListMarches` 目的点与小地图标记一致（INTG-014 断言 `to_x`/`to_y`）。
3. 点击小地图上 **已有行军目的点**：应高亮对应列表行并打开军事面板，**不**误写表单坐标。
4. 单测：`worldMinimap.test.ts`（`minimapLayoutToWorld` / `clampWorldMapCoord`）；全量 `cd client && npm test`。

### 手动验收（社交刷新 CLIENT-045）

在 [CLIENT-030 社交扫读](#手动验收社交扫读-client-030) 与 [CLIENT-021 双榜](#手动验收排行双榜-client-021) 之上：**排行** 面板 **刷新排行榜**、**聊天** 面板 **刷新** 触发既有列表 RPC；成功后在 `social-refresh-status` 展示 `formatSocialPanelLastUpdated`（**上次更新：…**），in-flight 时按钮 `disabled`（`chatListInflight` / `rankListInflight` 单飞，与 CLIENT-018 `GetCityState` 不嵌套）。

1. `make dev` 打开 **排行**，切换战力/资源榜后点 **刷新排行榜**：列表更新且出现 **上次更新** 行；刷新过程中按钮不可点。
2. **聊天**（世界/私聊/军团）点 **刷新**：`ListChatMessages` 成功后同样展示时间戳；空列表仍用 CLIENT-029/030 密度文案。
3. 断网或网关错误：状态行显示 **刷新失败：…**（`formatSocialPanelRefreshError`），状态栏同步 gateway 摘要。
4. **CLIENT-076**：排行/军团/聊天三面板刷新共用 `formatPanelRefreshMeta`（in-flight **刷新中…** + spinner、成功 **上次更新**、失败 **`[code]`** + **重试**）；单测：`socialRefreshFormat.test.ts`；全量 `cd client && npm test`。

### 手动验收（将领详情 CLIENT-014）

在 CLIENT-008 将领面板基础上，验收 `hero.v1.GetHeroDetail` 与列表可读性（`make dev` 或 mock 网关均可）。

1. 点 **「将领」** →「刷新列表」。每行应含 **Lv** 与 **忠诚** 数值（来自 `ListPlayerHeroes`）。
2. 点击某一将领行：详情区展示 **template_name**、**稀有度**、**Lv** 与四维属性（武/智/政/统，CLIENT-031 表格 + 进度条）、**忠诚度及 loyalty_min~loyalty_max 区间**。
3. 详情区末尾应提示：养成道具请走底栏 **「背包」** → **「使用道具」**（`content.v1.UseConsumable`），无将领专用 RPC。
4. 未选将领或 `hero_id=0` 时不应发起 GetHeroDetail；状态栏应提示 hero_id 无效（客户端拦截）。

mock 预置将领时可用 `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev`，招募一名后再点列表验详情。

### 手动验收（M4：将领，CLIENT-008）

与 `internal/api/hero_handlers.go` 网关路由一致（`make dev` 真实 PG）。

1. 进入主城后点 **「将领」** →「刷新列表」。新号应为空列表提示；若已有将领，点击列表项加载 `hero.v1.GetHeroDetail` 详情（属性/忠诚，见 CLIENT-014）。
2. **招募模板**：点「刷新招募模板」调用 `hero.v1.ListRecruitTemplates`；下拉或列表行展示模板名、稀有度、资源+道具消耗预览（与 HERO-003 / `make dev` 目录一致）。选择模板后「招募」使用所选 `template_cfg_id` 与预览中的 `item_cfg_id`（及 `pool`），不再手填 1001/2004。
3. **招募**：成功时自动刷新列表并高亮新 `hero_id` 行、加载详情；状态栏展示模板名与扣费摘要（CLIENT-023）。若已接取 `daily_recruit_1`（`quest_cfg_id=1015`）且进行中，状态栏提示打开「日常」，后台刷新 chain 400 列表（进度由 QUEST-002/003 服务端推进）。道具/资源不足时显示服务端 `code` 与 `msg`。

### 手动验收（邮件收件箱，CLIENT-017）

与 `internal/api/mail_handlers.go` 一致：`content.v1.ListPlayerMail`（`filter` 全部/未读）、`MarkPlayerMailRead`、`ClaimMailAttachments`。

1. `make dev` 进入主城；底栏 **「邮件」** 有未读时按钮右上角红色数字角标（不挡点击）。
2. 打开邮件面板 → **全部 / 未读** 切换列表；每行展示**标题 + 摘要**（正文截断或附件提示）。
3. **点开**一封未读邮件 → 自动调用 `MarkPlayerMailRead`；在「未读」筛选下该封应从列表消失。
4. 带附件邮件显示 **「领取附件」** → 成功后 HUD 五资源与背包摘要更新（`wallet_after` / `bag_items`）；重复领取或失败时面板内显示明确错误文案。
5. 空收件箱显示「暂无邮件，完成日常…」；未读筛选无信时显示「暂无未读邮件」。
6. 视口 **1600×900**：面板落在顶底 56px 带之间，列表与正文区可滚动、不撑破外框。

**GM 发信（真实 PG）** — 参数见 [`docs/ops/open-server-runbook.md`](../docs/ops/open-server-runbook.md) §4.5：

```bash
# 仓库根；需 DATABASE_URL 等与 make dev 一致
GOTOOLCHAIN=go1.23.0 go run ./cmd/gm send-mail \
  --server-id=1 --player-id=<你的 player_id> \
  --title='测试奖励' --body='CLIENT-017 验收' \
  --food=1000 --gold=50 \
  --reason='CLIENT-017 manual'
```

`player_id` 可在进服后 HUD 或 `cmd/gm lookup` 查到。发信后回到 H5 点邮件 **「刷新」**。

mock 网关预置 1 封欢迎邮件与 2 本名册，便于离线点领：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

```bash
# 仓库根
make dev
cd client && npm install && npm run dev
```

### 手动验收（募兵 → 行军 → 战报，CLIENT-012 / CLIENT-013）

1. 登录进入主城后，点 **「军事」** 打开面板。
2. **募兵**：选兵种（默认步兵）、数量（如 50），点「募兵」。HUD 会显示扣费后的资源；若返回 `queue_id` / `finish_at_ms`，需等到完成时间后再出征（服务端调度器在 `make dev` 中自动推进）。
3. **出征**：目标默认 **(5,5)**（M2 驻点），调整出征步兵数量后点「出征攻击」。状态栏与军事面板会显示最近一次行军摘要。
4. 点底栏 **「行军」** → **「刷新列表」**（或等待约 5s 自动刷新）：列表调用 `military.v1.ListMarches`，每行展示目的、阶段、起终点坐标、出发/到达时间。出征成功后若面板已打开会自动刷新。
5. 等待行军到达并完成战斗后（真实环境取决于距离与调度），点 **「战报」** → **「刷新列表」**，点击某条战报查看回合/伤亡摘要（字段以服务端为准）。
6. 面板落在 1600×900 外框内可滚动；内政仍可用：**「升级农田」「刷新状态」**。

### 手动验收（世界地图行军标注 CLIENT-028）

主城舞台右上角叠加只读 **小地图**（`worldMinimap` / `drawWorldMinimap`）：**己方城池**（会话 `cityX/cityY`，刷新状态时会 `ListPlayerCities` 对齐）与 **ListMarches** 进行中行军 **目的点**。滚轮在小地图区域内缩放、拖拽平移视野；**建筑槽位 hit 区域**仍按 `MAIN_CITY_SLOTS` + `canvasToLayout`，与小地图变换无关。

1. `make dev` 或 mock 网关登录主城，确认舞台右上角有「世界（只读）」框与己方城点（默认 mock 创建城约 60,60）。
2. 完成 [募兵 → 出征](#手动验收募兵--行军--战报client-012--client-013) 后，小地图应出现目的点标记；底栏 **「行军」** 刷新列表后目的坐标与列表 `to_x/to_y` 一致。
3. 在行军列表 **点击一行**：该行高亮，小地图高亮该行军 **起点/终点** 与底部 **阶段文案**（行军中/已到达/撤回中）。
4. 在小地图 **点击目的点**：应选中列表中 **首条** 匹配该坐标的行军（只读，不发起新 RPC）；列表行高亮。
5. 在小地图区域滚轮缩放并拖拽平移后，点击 **农田** 等槽位仍可触发升级/选中（窄屏 letterbox 下 hit 随 `uiScale` 缩放）。
6. 军事面板仍仅有出征表单（**无** 取消行军/加速按钮）；[世界坐标 CLIENT-015](#手动验收世界坐标-client-015) 填入出征目标流程不退化。
7. 单测：`worldMinimap.test.ts`、`MarchListPanel` 选中用例；`cd client && npm test`。

### 手动验收（小地图与军情互选 CLIENT-090）

在 [CLIENT-028](#手动验收世界地图行军标注-client-028)、[CLIENT-080](#手动验收军情阶段提醒与列表-chips-client-085) 与 [CLIENT-069](#手动验收军情格点筛选-client-069) 基础上，小地图目的点与 **行军** 列表 **双向同步**（纯客户端，无新 military RPC）：

1. **军情 → 小地图**：底栏 **「行军」** 点击一行，该行应带 `march-list-row-selected` 轮廓；小地图 **目的格** 与该行 `to_x/to_y` 加亮（`drawWorldMinimap` 的 `selectedMarchId` 标注层），连线加粗（CLIENT-037）。
2. **小地图 → 军情**：展开小地图，点击 **行军目的点**（非空白）：应打开/聚焦 **行军** 面板并选中对应 `march_id` 行（同格多条时仍为 **首条**，CLIENT-037）；空白单击仍只填出征坐标（CLIENT-041），ETA 角标不退化（CLIENT-058）。
3. **sessionStorage**：`minimap-march-focus-id` 记录当前互选 `march_id`；`march-highlight-id`（CLIENT-080 新出征扫读）独立并存、互不清除——规则见 `minimapMarchFocus.ts` 与 `minimapMarchFocus.test.ts`。
4. 刷新页面后，小地图拉取 `ListMarches` 后应恢复上次互选行军的高亮（面板可未打开）。
5. **格点筛选**（世界选中格 / 手动坐标）与上述互选并存，筛选仍只过滤列表行、不改网关请求。
6. `cd client && npm test` 含 `minimapMarchFocus.test.ts` 与 `MarchListPanel` 焦点恢复用例。

### 手动验收（军情再出征预填 CLIENT-093）

军情列表每行 **再出征**（`march-row-remarch-btn`）打开 **军事** 面板并预填该行 `to_x/to_y`（`applyMarchIntelRemarchPrefill` + **CLIENT-043** session）；军事表单区只读 **上次兵力** 摘要（`ListMarches` 快照 `troops`，`formatMarchIntelLastTroopsSummary`）。预填后 **CLIENT-089** `march-form-summary` 即时刷新；**CLIENT-080** `march-highlight-id` 不因点再出征而清除（用户手改目标才清）。**CLIENT-090** 小地图互选与 **CLIENT-061** 世界高亮不退化；无 `CancelMarch`。

1. `make dev` 至少完成一次出征 → 底栏 **行军** 列表某行点 **再出征** → **军事** 面板目的坐标与摘要应与该行一致。
2. 改 `to_x`/`to_y` 后高亮行应清除；再出征不自动 `StartMarch`。
3. 单测：`marchIntelRemarch.test.ts`、`MarchListPanel.test.ts`。

### 手动验收（小地图比例尺与多行军 CLIENT-037）

在 [CLIENT-028](#手动验收世界地图行军标注-client-028) 基础上：

1. 展开小地图时右下角应有 **近似比例尺**（`≈N格` 文案 + 横条），缩放/平移后 N 会随视野变化。
2. 多条进行中行军：列表刷新后小地图应绘制 **起终点连线**；**行军中** 为实线、**撤回中** 为虚线（颜色与 CLIENT-028 点标区分）；在列表 **选中一行** 后该行军连线加粗高亮，优先于阶段默认样式。
3. 点右上角 **▼** 折叠为角标「世界 ▶」，刷新页面后折叠状态应保持（`sessionStorage` 键 `rxsg.client.worldMinimap.collapsed`）；折叠后点击角标可展开。
4. 折叠状态下点击原小地图区域内的 **农田** 等槽位仍应响应（折叠条仅占右上角窄条，不占 270×210 hit 区）。
5. 仍无取消行军/加速；`cd client && npm test` 含 `worldMinimap` 比例尺/折叠/描边用例。

### 手动验收（小地图选点出征 CLIENT-041）

在 [CLIENT-028](#手动验收世界地图行军标注-client-028) / [CLIENT-037](#手动验收小地图比例尺与多行军-client-037) 基础上：

1. 展开小地图，在 **空白区域单击**（非行军目的点、非折叠 ▼）：军事面板 `to_x` / `to_y` 应更新为反算格点（0..499），状态栏提示 **「已选出征目标 (x,y)」**。
2. 滚轮缩放或拖拽平移后再次单击空白，坐标应随当前视野变化；小幅移动仍视为拖拽，不填点。
3. 单击已有 **行军目的点** 仍优先选中 `ListMarches` 行并打开军事面板（CLIENT-037），**不**覆盖为空白反算坐标。
4. [世界坐标 CLIENT-015](#手动验收世界坐标-client-015) 点城填坐标与上述表单共用；折叠小地图时不响应地图区单击。
5. `cd client && npm test` 含 `minimapLayoutToWorld` / `clampWorldMapCoord` 用例。

### 手动验收（世界坐标 CLIENT-015）

1. 进入主城后点 **「世界」**（或世界城池面板入口，与 `world.v1.ListPlayerCities` 一致）→ **「刷新城池」**。
2. 列表应展示玩家城池坐标；当前主城行标注 **「主城」**。
3. 选中一行 → **「填入出征目标」**：军事面板 `to_x` / `to_y` 应更新为该城坐标（与 CLIENT-013 出征表单联动）。
4. 在 **「军事」** 中调整兵力后 **出征攻击**；底栏 **「行军」** 列表应出现对应目的坐标。

### 手动验收（出征目标记忆 CLIENT-043）

（[#267](https://github.com/anitaguptaoffice/sanguo-slg/issues/267) / [#279](https://github.com/anitaguptaoffice/sanguo-slg/pull/279) `66e5578a`）。与 [CLIENT-015](#手动验收世界坐标-client-015)（世界城池点选）及 [CLIENT-041](#手动验收小地图选点出征-client-041)（小地图空白单击）共用军事面板 `to_x` / `to_y`（`marchTargetMemory` / `applyMarchTargetAndRemember`）：

1. **会话记忆**：`sessionStorage` 键 `rxsg.client.marchTarget.last`（JSON `{x,y}`）。`StartMarch` 成功后写入；小地图空白选点或世界城池点选也会立即覆盖该键。
2. **刷新预填**：刷新页面进入主城后，军事面板应自动预填上次记住的坐标（无记忆时仍为默认 5,5）。
3. **冲突规则**：先小地图选点再点世界城池（或相反）时，**最后一次点选/单击** 的坐标同时更新表单与 session；状态栏文案说明已记住/覆盖。
4. **小地图高亮**：小地图空白单击填点后打开军事面板时，目标 X/Y 输入区应短暂高亮，提示文案提及「小地图选点」。
5. **清除**：军事面板 **「清除出征目标记忆」** 删除 session 并将坐标恢复默认；不影响 CLIENT-037 行军目的点单击（仍只选中列表行）。
6. `cd client && npm test` 含 `marchTargetMemory.test.ts`。

### 手动验收（战报筛选 CLIENT-016）

与 **CLIENT-012** 底栏 **「战报」** 面板一致；筛选仅客户端，不改 `ListBattleReports` 请求参数。

1. `make dev` 下完成至少一次出征并产生战报（见上文募兵 → 行军步骤）。
2. 点 **「战报」** → **「刷新列表」**。面板顶部应有 **全部 / 胜 / 负 / 平** 筛选（基于 `BattleReportSummary.outcome`）；切换筛选后列表行即时过滤，无需重新拉网关。
3. 点击某条战报：详情区展示 **回合数**、攻/守 **伤亡 map 摘要** 与 **result** 文案；字段以服务端为准。
4. 若列表超过一页，使用 **加载更多**（`limit`/`offset`）或既有分页；失败时状态栏文案可重试。
5. 视口 **1600×900**：筛选行与列表落在顶底 56px 带之间、可滚动。

### 手动验收（行军到达与战报未读 CLIENT-025）

`MarchArrivalPoll` 轮询 `ListMarches`：出征后跟踪 `march_id`；行军阶段 **marching(2)→arrived(3)/returning(4)** 或列表中该行消失时，顶栏状态栏出现 **「行军 #id 已到达 (x,y)」** 文案与可点 **「查看战报」**（`MARCH_ARRIVAL_VIEW_REPORT_LABEL`；列表项带 `report_id` 时深链该战报）。`sessionStorage` 键 `rxsg.client.marchPhaseReminder.ids` 记录本会话已提醒的 `march_id`，避免重复 toast（**CLIENT-085**）。`BattleReportUnreadSession` 记录上次打开战报面板时的 `report_id` 上界，刷新列表后新增战报计入未读（与 **CLIENT-027** 底栏角标联动）。

1. `make dev` 完成 [募兵 → 行军](#手动验收募兵--行军--战报client-012--client-013) 步骤 2–3，保持主城场景（无需一直打开「行军」面板）。
2. 等待行军到达并完成战斗（距离与调度决定耗时；可缩短目标距离）。到达时状态栏应出现 **行军 #… 已到达 (x,y)** 与 **查看战报** 按钮。
3. 点击 **查看战报** 应打开底栏 **「战报」** 面板并触发列表刷新；未打开前底栏 **「战报」** 可出现未读角标（见 [CLIENT-027](#手动验收hud-待办徽章-client-027)）。
4. 打开战报面板后未读角标清零；再次产生新战报时角标恢复；同一 `march_id` 在本会话内不应重复弹出到达 toast。
5. 单测：`marchArrival.test.ts`、`marchArrivalReminder.test.ts`、`marchArrivalPoll.test.ts`、`marchPhaseReminderSession.test.ts`、`battleReportUnread.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（军情阶段提醒与列表 chips CLIENT-085）

在 **CLIENT-025** 到达提示与 **CLIENT-047** 军情密度之上：`MarchListPanel` 每次 `ListMarches` 刷新会与上一快照对比 `phase`，**行军中→驻扎/返回** 时与后台 `MarchArrivalPoll` 共用同一套提醒与 `sessionStorage` 去重。列表主行左侧展示 phase **chips**（`marchPhaseChipLabel`：**去程/驻扎/返回** 等），主行文案为 `#id · 目的 · 坐标`（阶段不再挤在主行字符串里）；格点筛选与小地图联动行为不退化 **CLIENT-069**。

1. `make dev` 出征一条行军，打开 **「行军」** 面板：行进行中应看到 **去程** chip 与坐标。
2. 保持面板打开或仅留在主城，待 `phase` 变为 **驻扎** 或 **返回**：HUD 出现一次性到达 toast（含格点）与 **查看战报**；chip 同步变为 **驻扎** 或 **返回**。
3. 再次 **刷新列表** 或等待下一轮轮询：同一 `march_id` 不应重复 toast（可开 DevTools → Application → Session Storage 查看 `rxsg.client.marchPhaseReminder.ids`）。
4. 单测：`marchArrivalReminder.test.ts`、`marchPhaseReminderSession.test.ts`、`MarchListPanel.test.ts`（chips 与 `onMarchArrivalReminders`）。

### 手动验收（行军列表 ETA 与军情密度 CLIENT-047）

`MarchListPanel` 列表行 **主行**（phase chip + `#id · 目的 · 坐标`）+ **次行**（出发/到达绝对时刻 + `formatMarchRemainingMs` 相对 ETA）。多条行军时 `march-list-compact` 收紧行高；空列表仍用 `march-list-empty`（不退化 **CLIENT-029** 空态）。面板打开且 `marchNeedsPoll` 时：**每 5s** `ListMarches` 刷新列表，**每 1s** 仅更新次行剩余文案（不额外 RPC）；与 **CLIENT-025/085** 到达 toast 并存。

1. `make dev` 出征至少一条 **行军中** 行军，打开底栏 **「行军」**。
2. 主行含 **去程** chip、目的与坐标；次行含出发/到达时刻与 **剩余 Nm** 或 **即将到达**（待发/已到达显示阶段文案）。
3. 保持面板打开观察约 10s：剩余文案每秒变化，网络面板无额外 `ListMarches`（仅 5s 轮询一次）。
4. 同时等待行军到达：HUD **行军 #id 已到达** 与 **查看战报** 仍出现（CLIENT-025/085）。
5. 单测：`militaryFormat.test.ts`（`formatMarchRemainingMs`、`marchPhaseChipLabel`）、`MarchListPanel.test.ts`、`panelDensity.test.ts`。

### 手动验收（出征表单格点与兵力校验 CLIENT-048）

军事面板 `#march-form-error` 在点 **出征攻击** 前展示 `validateMarchForm` 中文原因；校验通过才调用 `StartMarch`。格点范围 **0..499**（`WORLD_MAP_EDGE`）；目标与己方城格相同、步兵数大于城内可用数均拦截。

1. `make dev` 进主城，打开 **「军事」**；将 `to_x`/`to_y` 留空或填非数字 → **出征攻击** 应在表单下方出现错误文案，**无** `StartMarch` 请求。
2. 填 **(60,60)**（与己方城同格，以当前 `GetCityState` 为准）→ 提示不能与己方城池同格。
3. 出征步兵数大于当前城内步兵 → 提示兵力不足。
4. 合法坐标与数量出征成功 → 错误区清空；若网关失败，同区域展示 `err.message`（不只状态栏）。
5. 与 **CLIENT-041** 选点、**CLIENT-043** 目标记忆并存。单测：`marchFormValidation.test.ts`。

军事面板出征区 **`march-form-summary`**（**CLIENT-089**）：随 `to_x`/`to_y` 与出征步兵输入即时刷新，只读展示目标格点、兵力合计与 `formatMarchRemainingMs` 同源 ETA（由城格 + 表单推算单程耗时，不发 `StartMarch`）；途粮不足时汇总条带 `resource-warn` 且 `march-form-summary-warn` 一行提示，不自动打开商城。单测：`marchFormSummary.test.ts`。

### 手动验收（出征提交反馈 CLIENT-080）

军事面板 **出征攻击**：`StartMarch` 发出后按钮 **disabled** 且文案 **出征中…**（`marchSubmitFeedback`）；成功顶栏 toast **已出征 (x,y)**，失败在 **march-form-error** 展示 `gatewayErrorMessage`（**CLIENT-067** 口径）。成功后底栏 **行军** 列表对应 `march_id` 行附加 `march-row-recent`（`sessionStorage` 键 `march-highlight-id`，选其他行或 **60s** 清除）。**CLIENT-048** 校验与 **CLIENT-047** ETA 不退化。

1. `make dev` 合法出征一次 → 观察按钮态与顶栏 toast → 打开 **行军** 列表确认高亮行。
2. 故意网关失败（断网或非法兵力）→ 表单内错误文案，按钮恢复可点。
3. 单测：`marchHighlight.test.ts`、`marchSubmitFeedback.test.ts`、`MarchListPanel.test.ts`。

### 手动验收（HUD 资源扫读 CLIENT-081）

顶栏五资源条 **hover / focus / 点击展开** 时展示 `formatResourceSweepLine(production_rates, wallet)`（余量 + 四资源 **+/h**；缺 `production_rates` 则仅余量），不占常驻次行；与 **CLIENT-051** 资源脉冲、**CLIENT-059** 队列总览并存。

1. `make dev` 进主城，鼠标悬停或 Tab 聚焦顶栏粮/木/铁/石 → 展开条应含当前余量与产出速率（与 `GetCityState` 一致）。
2. 领奖或购买后 **CLIENT-051** 脉冲仍出现，展开条数值随后续 `GetCityState` 刷新。
3. 单测：`hudFormat.test.ts`（`formatResourceSweepLine`）、`GameApp` HUD 接线相关用例。

### 手动验收（建造消耗预览 CLIENT-082）

画布选中可升级槽位时，建造面板展示 **下一级** 粮/木/铁/石消耗与耗时只读摘要（`previewUpgradeCost` + 现有 cfg 映射）；资源不足时 **确认升级** disabled 且 inline **缺少：粮 N …**（**CLIENT-067** 口径）。**CLIENT-066** 槽位进度与 **DOM-003** 加速符不变。

1. `make dev` 点选农田等槽位 → 预览行含下级消耗；故意保留资源不足 → 按钮禁用 + 缺少提示。
2. 资源充足时仅展示预览，需玩家点 **确认升级** 才发 RPC。
3. 窄屏下预览行不横向溢出（与 **CLIENT-086** 一并验收）。单测：`previewUpgradeCost.test.ts`。

**建造提交反馈（CLIENT-104）**：点 **确认升级** 后按钮 **disabled** 且文案 **提交中…**（`buildSubmitFeedback`）；成功顶栏状态 `formatBuildSubmitSuccess(slot_key, targetLevel)`，扣粮木铁石时触发 **CLIENT-051** 资源脉冲；失败在 **build-form-error** 展示 **CLIENT-067** 口径且保留槽位选中与消耗预览。**CLIENT-066** 队列深链不退化。单测：`buildSubmitFeedback.test.ts`。

### 手动验收（募兵消耗预览 CLIENT-088）

军事/队列募兵区（军事面板募兵表单）在选中兵种与数量时展示 **下一批** 粮/木/铁/石消耗与耗时只读摘要（`previewRecruitCost` + `troopRecruitCatalog`，钱包来自 `GetCityState.resources`）；资源不足时 **募兵** disabled 且 inline **缺少：粮 N …**（**CLIENT-067** 口径）。足够时仅预览，需点 **募兵** 才发 `RecruitTroop`。募兵队列 **加速**仍 out；**CLIENT-082** 建造预览与 **DOM-003** 建造加速符不退化。

1. `make dev` 打开 **军事** → 切换兵种/数量，预览行应含消耗与 `耗时 m:ss`。
2. 故意保留资源不足 → **募兵** 禁用 + 缺少提示；补足资源后按钮可点且不发 RPC 直至点击。
3. 单测：`previewRecruitCost.test.ts`、`troopRecruitForm.test.ts`。

### 手动验收（日常可领取定位 CLIENT-091）

日常面板筛选 **可领取** 时出现 **定位首条**（`daily-locate-first`）：滚动至 `pickFirstClaimableDailyQuestCfgIdForFilter` 首行并加 `daily-quest-claimable` 高亮；与 **CLIENT-077** HUD 待办深链（`center-claimable`）并存。**领奖** 成功该行短暂 `quest-claim-pulse` + **CLIENT-051** 资源脉冲；失败 **CLIENT-067** 口径。**CLIENT-075** 筛选记忆与 **CLIENT-044** 战报横幅不退化。

1. `make dev` 使 chain 400 至少一条 `state=3` → **日常** → **可领取** → **定位首条** 应滚到首条可领行。
2. **领奖** 后观察脉冲与 HUD；刷新页面筛选记忆仍恢复。
3. 单测：`dailyQuestListFilter.test.ts`、`DailyQuestPanels.test.ts`。

### 手动验收（军团提到聊天草稿 CLIENT-084）

军团成员列表每行 **提到** 将 `@显示名 ` 填入聊天输入（`formatGuildMentionDraft`），并切换到军团聊天 tab；未入军团时按钮 hidden。**CLIENT-076** 刷新 meta 不退化。

1. `make dev` 已入军团 → **军团** 面板点某成员 **提到** → **聊天** 输入框应出现 `@…` 草稿（不自动发送）。
2. 单测：`socialFormat.test.ts`（`formatGuildMentionDraft`）、`SocialPanels.test.ts`。

### 手动验收（邮件附件批量领取 CLIENT-087）

邮件列表含未领附件的行可勾选，点 **批量领取勾选** 顺序调用既有领取 RPC；`batchClaimSummary` 汇总成功/失败条数，失败走 **CLIENT-067** 文案。成功后 **CLIENT-050** HUD 同步与 **CLIENT-068** 战报深链不退化。

1. `make dev` 多封未领附件邮件 → 勾选两封以上 → **批量领取勾选** → 状态栏/面板反馈含汇总条数。
2. 单测：`mailBatchClaim.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（战报加载更多与筛选记忆 CLIENT-049）

`battleReportListState` 管理分页与 outcome 筛选；筛选写入 `sessionStorage`，刷新页面后恢复。**加载更多** 无更多数据时按钮禁用并显示「已加载全部 N 条」。

1. `make dev` 产生多条战报（多次出征或 dev 数据）。
2. 底栏 **「战报」** → 切换 **胜/负/平** 筛选 → 刷新浏览器页面，筛选应恢复。
3. 列表超过首页 `limit` 时点 **加载更多**；末页按钮禁用且文案含总条数；加载失败保留已拉取行并展示 gateway 文案。
4. **在地图查看**（CLIENT-042）与回合表（CLIENT-034）行为不退化。单测：`battleReportListState.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（战报时间窗筛选 CLIENT-065）

`filterBattleReportsByTimeWindow` 基于 `BattleReportSummary.created_at_ms` 做本地日历日过滤（**全部 / 今日 / 近7日**），不改 `ListBattleReports` 请求；时间窗与 outcome 筛选分别写入 `sessionStorage`（`battleReportListState`）。列表顶部 **胜/负/平** 只读 chips 统计当前时间窗内已加载战报；与 outcome 筛选组合后列表即时过滤，筛选无结果仍用 CLIENT-029「无匹配战报」文案。

1. `make dev` 产生跨日或多条战报（见 CLIENT-049）。
2. 底栏 **「战报」** → outcome 筛选旁 **时间** 下拉切换 **今日 / 近7日** → 列表行即时变化；刷新页面后时间窗与胜负筛选各自恢复。
3. 摘要条应显示当前时间窗内胜/负/平计数；**加载更多**、回合表、**在地图查看** 行为不退化。
4. 单测：`militaryFormat.test.ts`、`battleReportListState.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（战报上一封下一封与胜负 streak CLIENT-083）

详情顶栏 **上一封 / 下一封** 在当前 **时间窗（CLIENT-065）** 与 **outcome 筛选（CLIENT-049）** 后的列表顺序内切换 `report_id`；切换时尽量保留 **回合跳转（CLIENT-074）** 的高亮回合与展开状态（新战报无该回合则重置）。列表顶 **胜负摘要 chips** 旁增加 **连胜 / 连负** streak chip（`computeOutcomeStreak`，基于当前组合筛选后的已加载列表、自最近一场起连续胜/负计数）。**在地图查看（CLIENT-042）** 行为不退化。键盘相邻导航与焦点环见 **CLIENT-094**。

1. `make dev` 产生多条胜/负交错的战报；底栏 **「战报」** → 组合时间窗与胜负筛选，确认列表顺序与按钮禁用态（首条无上一封、末条无下一封）。
2. 打开详情并点回合跳转高亮某一回合 → **下一封** 切到邻战报后高亮回合应尽量保留；点 **在地图查看** 仍驱动小地图高亮。
3. 列表顶应同时见 **胜/负/平** 计数与 **连胜 N** 或 **连负 N**（最近一场为平局时不显示 streak）。
4. 单测：`battleReportOutcomeStreak.test.ts`、`battleReportListNav.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（战报相邻导航键盘与焦点环 CLIENT-094）

详情区 `[data-role="report-detail"]` 为 **`role=region`**，`aria-label` 注明 **← / →** 与 **Alt+← / Alt+→** 切换上一封/下一封（与 **CLIENT-083** 按钮同源 `battleReportListNav`）。**详情区聚焦**时方向键触发相邻战报；在面板其它区域（如筛选条）可用 **Alt+方向键**；**时间窗（CLIENT-065）**、**回合跳转（CLIENT-074）** 与 outcome 筛选不退化。切换战报后焦点回到详情顶栏 **上一封/下一封** 按钮（`:focus-visible` 金环）；**1280×720** `layout-narrow` 下导航按钮 `scroll-margin-bottom` 与 `.panel-scroll-body` 底内边距避免焦点环被底栏 56px 工具条裁切。

在战报面板根 `.battle-report-panel` 设置 **`data-battle-report-adj-nav-keyboard="off"`** 可关闭方向键 / Alt+方向键相邻导航（按钮仍可用）。

1. `make dev` 打开战报详情 → Tab 聚焦详情区或导航按钮 → **← / →** 在筛选后列表内切换；筛选条聚焦时 **Alt+→** 仍可切换。
2. 点 **下一封** 或键盘切换后焦点应在顶栏导航按钮上；窄屏下 Tab 到导航按钮时金环完整可见、不被底栏遮挡。
3. 回合跳转下拉/芯片、时间窗下拉仍可操作；方向键在 `select` 内不触发相邻战报。
4. 根节点 `data-battle-report-adj-nav-keyboard="off"` 后键盘不再切换，**上一封/下一封** 仍可点。
5. 单测：`battleReportListNav.test.ts`（筛选列表邻接 id）、`BattleReportPanel.test.ts`（region/键盘/焦点/data attr）。

### 手动验收（战报详情回合表与行军深链 CLIENT-034）

`GetBattleReport` 成功后，详情区顶部仍保留 `formatBattleReportDetail` 文字摘要；下方为结构化 **回合表**（回合号、攻/守行动摘要、双方剩余兵力 map）。回合数 **> 8** 时表格默认折叠，点 **「展开全部回合」** 显示全部行。列表/详情加载失败仍可用 **重试** 按钮（不退化 **CLIENT-029** 列表密度）。行军结束 HUD 链接（**CLIENT-025**）点击后调用 `openPanelWithDeepLink`：刷新 `ListBattleReports` 后选中 `MarchEndBattleReportHint` 或最近 `report_id` 并自动 `GetBattleReport`。

1. `make dev` 产生至少一场带多回合明细的战报（见上文募兵 → 行军）。
2. 底栏 **「战报」** → 点击一条记录：详情 `pre` 摘要含结果/伤亡；下方表格列头为 **回合 / 攻方行动 / 守方行动 / 攻方剩余 / 守方剩余**。
3. 若服务端返回 **> 8** 回合：初始无表格行，显示折叠提示与 **展开全部回合**；点击后展示全部行。
4. 断网或 mock 失败详情：应出现 **重试加载详情**；列表失败仍保留 **重试加载列表** 与筛选条。
5. 完成一次行军到达后点 HUD **行军结束，查看战报**：战报面板打开、列表刷新、**最近战报** 行高亮且详情已加载（若 hint 与列表首条不一致则以 hint 为准）。
6. 单测：`battleReportRounds.test.ts`、`battleReportDeepLink.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（战报坐标与小地图复盘 CLIENT-042）

（[#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) / [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`）。战报列表行 **坐标** 与守方摘要分行突出（`formatReportCoord` / `formatBattleReportFoeWithoutCoord`）；详情顶栏同样展示坐标与 **「在地图查看」**。点击后经 `extractBattleReportReplayCoord` 读取 summary 既有 `location_x/y`（不扩 proto），主城舞台小地图绘制 **临时战报高亮** 并 `pan/zoom` 纳入视野；关闭战报面板或切换选中战报时清除高亮。小地图折叠时状态栏仍提示坐标。

1. `make dev` 产生至少一条带 `location_x/y` 的战报（见募兵 → 行军）。
2. 底栏 **「战报」** → 列表行应见金色 **坐标(...)** 行；点开详情顶栏有坐标与 **在地图查看**。
3. 点击 **在地图查看**：展开小地图时应出现 **战报** 标记与橙红高亮圈，视野自动对准该格点。
4. 折叠小地图后再次点击 **在地图查看**：状态栏应提示坐标与「展开小地图可查看高亮」。
5. 关闭战报面板或点另一条战报：小地图临时高亮应消失。
6. 单测：`battleReportReplayCoord.test.ts`、`worldMinimap.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（邮件附件领取 CLIENT-035）

在 [CLIENT-017](#手动验收邮件收件箱client-017) 基础上验收 **未领附件高亮** 与领取后与 **CLIENT-027** HUD 角标一致。

1. `make dev` 或 GM `send-mail` 发一封带附件且未领取的邮件（见 CLIENT-017 §4.5）。
2. 底栏 **「邮件」** 角标与列表行 **「未领取」** 角标一致；已读但未领的行仍高亮 **「领取附件」**。
3. 点击 **领取附件**：`ClaimPlayerMailAttachments` 成功后刷新列表、背包与顶栏五资源；状态栏展示道具 id + 数量摘要（与 `heroMailState` 合并逻辑一致）。
4. 领取失败时面板内显示 gateway `msg`，不静默；重复领取显示明确错误。
5. 单测：`heroMailState.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（邮件领取 HUD 同步 CLIENT-050）

在 CLIENT-035 领取闭环基础上：**领取附件** 后列表行「未领取」标记应立即消失（无需关面板再开）；关面板后底栏未读角标与 `ListPlayerMail` 未读 `total_count` 一致。领取进行中「领取附件」按钮应禁用；失败保留高亮并显示 gateway 文案。

1. `make dev`：未读带附件邮件 → 打开邮件 → 领取成功 → 同行角标消失，关面板后角标递减。
2. 模拟领取失败：面板内 `mail-status` 显示错误，仍可再次领取。
3. 单测：`hudTodoBadge.test.ts`（`mailUnreadSnapshotFromListResponse`）、`hudTodoBadgePoll.test.ts`、`HeroMailPanels.test.ts` 领取/HUD 用例。

### 手动验收（邮件面板 tab 角标 CLIENT-106）

在 **CLIENT-050** 底栏未读角标与 **CLIENT-087** 批量领取基础上，收件箱工具栏 **未读 / 全部** 两个 tab 与 `ListPlayerMail` 快照同步：

| Tab | 展示规则 |
|---|---|
| **未读** | 文案 `未读 N`，`N` = `ListPlayerMail`（`filter=未读`）`total_count`；打开邮件标已读后本地立即减 1（与底栏角标一致） |
| **全部** | 主文案「全部」；有未领附件时旁侧金色角标 **`附件 M`**，`M` = `filter=all` 首屏列表上 `countMailUnreadAndUnclaimed` 的 `unclaimed`（与 CLIENT-077 可领邮件推导一致） |

1. `make dev` / mock：多封未读与未领附件 → 打开邮件面板 → **未读 N** / **附件 M** 与列表一致。
2. 点开未读或 **领取附件** / **批量领取** 成功后：同行高亮与 tab 数字即时递减，关面板后底栏未读角标仍与 **未读 N** 一致。
3. 单测：`heroMailState.test.ts`（`countMailUnreadAndUnclaimed`）、`HeroMailPanels.test.ts`。

### 手动验收（HUD 资源变动脉冲 CLIENT-051）

`GetCityState` 轮询检测到粮/木/铁/石/币任一 **增量 > 0** 时，顶栏对应 DOM 图标触发短暂 `resource-pulse` 动画（≤2s）；纯扣费仍走 **CLIENT-018** 文案摘要，不重复脉冲。

1. `make dev` 进主城，记下顶栏五资源。
2. **日常领奖**或 **邮件领附件** 使某资源增加：对应 HUD 图标应短暂脉冲，且 CLIENT-018 `+…` 摘要仍可出现。
3. **募兵/建造** 扣费：无脉冲，仅有数值下降与既有反馈。
4. 视口 **1280×720** / **1600×900**：脉冲不遮挡底栏 56px。单测：`hudResourcePulse.test.ts`。

### 手动验收（军事 manifest CLIENT-036）

`artPanelSkin.skinMilitaryPanel` 对 **军事表单**、底栏 **「行军」** 列表根、**「队列」** 募兵区块应用 manifest `ui.panel.military.v1`（#227 / ART-MILITARY-005）。**将领/背包/队列** 中心面板根分别用 `ui.panel.hero.v1` / `bag.v1` / `queue.v1`（CLIENT-062）；**世界/排行** 用 `ui.panel.world.v1` / `ui.panel.rank.v1`（CLIENT-078）；**邮件** 用 `ui.panel.default.v1`（`skinMailPanel`，CLIENT-070）；**日常** 用 `ui.panel.daily.v1`（`skinDailyPanel`，CLIENT-103）；**商城/军团/聊天** 用 `ui.panel.shop.v1` / `guild.v1` / `chat.v1`（CLIENT-095）。`data-art-skin="off"` 可跳过 nine-slice。

1. `make dev` 打开 **「军事」** / **「行军」** / **「队列」**：面板根应出现军事九宫格背景（与 `docs/art/samples/client-033/` 1600×900 样张一致）。
2. **募兵** / **出征** 主按钮四态与对比度见 **CLIENT-033** hotfix（本卡不重复改 hit 区与 1280 HUD）。
3. 单测：`artPanelSkin.test.ts`；全量 `cd client && npm test`。

### 手动验收（HUD 角标深链 CLIENT-038）

在 [CLIENT-027](#手动验收hud-待办徽章-client-027) 角标计数基础上：`toolbarBadge` 有计数时角标带 `toolbar-badge--deeplink`，**点击角标**（非按钮正文）深链，复用 `HudTodoBadgePoll` 快照、**不**额外 RPC。

1. `make dev` 或 mock：有未读邮件时 **点击「邮件」角标** → 打开邮件面板、`filter=未读`、选中 `firstUnreadMailId` 对应行。
2. chain 400 有待办时 **点击「日常」角标** → 打开日常面板并高亮 `firstDailyTodoCfgId`（可领奖优先于可接取，与角标计数一致）。
3. 有新战报未读时 **点击「战报」角标** → 打开战报列表并 `openPanelWithDeepLink(firstUnreadBattleReportId)`；与 CLIENT-025 行军结束链接行为一致。
4. 角标为 0 时无深链样式；点击按钮正文仍仅 toggle 面板（与 wave:14 相同）。
5. 单测：`toolbarBadge.test.ts`、`hudTodoBadge.test.ts`、`DailyQuestPanels.test.ts` / `HeroMailPanels.test.ts` 深链用例。

### 手动验收（1280 顶栏 HUD CLIENT-039）

顶栏五资源 **仅 DOM**（`#hud` + `appendHudResourceStrip`）；canvas 顶栏带只绘不透明背板，**不再**在 canvas 重复粮木铁石图标/数值，避免 1280×720 与 DOM 叠字。证据与截图见 [`docs/art/samples/client-039/`](../docs/art/samples/client-039/README.md)。

1. 视口 **1280×720**，`make dev` 进主城并打开 **「军事」** 面板：顶栏资源条应清晰可读、无双重描边/叠字；主城/建筑等级文案仍在 `#hud` 内。
2. 视口 **1600×900**：行为与 CLIENT-011 / CLIENT-032 一致（manifest 图标 + 数值）。
3. 可选复现截图：`cd client && node scripts/capture-client-039-evidence.mjs`。
4. 军事字色/募兵四态仍以 **CLIENT-033** 样张为准（`docs/art/samples/client-033/`）。

### 手动验收（1280 将领/背包/队列 CLIENT-062）

`#layout-frame` 在最小内容视口 **1280×720**（`uiScale=0.8`）时带 `layout-narrow`（`layoutViewport.isNarrowLayoutViewport` / `GameApp` 同步）。三面板根分别接线 manifest **`ui.panel.hero.v1`** / **`ui.panel.bag.v1`** / **`ui.panel.queue.v1`**（`skinHeroPanel` / `skinBagPanel` / `skinQueuePanel`，与 CLIENT-032 军事 `ui.panel.military.v1` 同级 nine-slice）；邮件/日常仍用 `ui.panel.default.v1`。与 **CLIENT-039** 顶栏、**CLIENT-054/055** 纸底字色与 primary 按钮 **并存**。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **将领**、**背包**、**队列**；面板纸底为 manifest 九宫格（非纯色 `#2a221c` 回退），顶栏 HUD 无叠字。
2. 将领/背包/队列内长列表（模板、将领行、背包格、建造/募兵队列）在 `layout-narrow` 下于 `.panel-scroll-body` 或列表区 **`overflow-y: auto`** 滚动，底栏 56px 工具条不被面板内容盖住。
3. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；三面板 manifest 与 **CLIENT-054** 纸底表现不退化。
4. 单测：`layoutViewport.test.ts`（窄屏 class）、`artPanelSkin.test.ts`（三面板 asset id）；`cd client && npm test` 绿。

### 手动验收（1280 军事/邮件/日常 CLIENT-070）

`#layout-frame.layout-narrow` 下 **军事**（`data-center-panel="military"` + `ui.panel.military.v1`）、**邮件** 根节点 nine-slice 与 CLIENT-062 将领/背包/队列同级；邮件仍用 `ui.panel.default.v1`（`skinMailPanel`）；日常见 **CLIENT-103** `ui.panel.daily.v1`。募兵/出征主按钮 hit 区与 **CLIENT-033** hotfix **并存**；`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **军事**、**邮件**、**日常**；面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 军事表单在 `.panel-scroll-body` 内滚动，**募兵** / **出征攻击** 主按钮可滚至可见且可点；邮件长列表与详情（含 **领取附件**）、日常任务列表与 **前往下一步** 在 `layout-narrow` 下 **`overflow-y: auto`**，底栏 56px 工具条不遮挡末行操作。
3. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；三面板 manifest 与 **CLIENT-054/055**、军事 **CLIENT-033** 表现不退化。
4. 单测：`contentPanelScroll.test.ts`、`artPanelSkin.test.ts`（CLIENT-070 manifest 映射）、`HeroMailPanels` / `DailyQuestPanels`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 将领/世界/排行 CLIENT-078）

`#layout-frame.layout-narrow` 下 **将领**（`data-center-panel="hero"` + `ui.panel.hero.v1`，CLIENT-062）、**世界**（`data-center-panel="world"` + **`ui.panel.world.v1`**）、**排行**（`data-center-panel="rank"` + **`ui.panel.rank.v1`）根节点 nine-slice 与 CLIENT-070 军事/邮件/日常同级；`skinWorldPanel` / `skinRankPanel` 与 `skinHeroPanel` 同级接线。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **将领**、**世界**、**排行**；面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 将领详情（`.hero-detail`）与世界格点信息卡（`.world-tile-info`，CLIENT-073）在窄屏下 **无横向溢出**；城池列表与排行表在 `.panel-scroll-body` 内 **`overflow-y: auto`**，底栏 56px 工具条不遮挡 **刷新城池** / **刷新排行榜**。
3. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；三面板 manifest 与 **CLIENT-054/055**、将领 **CLIENT-062** 表现不退化。
4. 单测：`artPanelSkin.test.ts`（CLIENT-078 manifest 映射）、`contentPanelScroll.test.ts`（`world`/`rank` id）、`HeroMailPanels` / `WorldPanels` / `SocialPanels`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 军情/战报/主城队列 CLIENT-086）

`#layout-frame.layout-narrow` 下 **军情**（`data-center-panel="march"` + **`ui.panel.march.v1`**）、**战报**（`data-center-panel="battle-report"` + **`ui.panel.battle-report.v1`**）、**队列**（`data-center-panel="queue"` + `ui.panel.queue.v1`，CLIENT-062）根节点 nine-slice 与 CLIENT-078/070 同级；`skinMarchIntelPanel` / `skinBattleReportPanel` / `skinQueuePanel` 接线。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开底栏 **行军**（军情）、**战报**、**队列**；面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 军情列表（含 CLIENT-080 目的格高亮行）、战报列表与详情、队列建造/募兵长表在 `.panel-scroll-body` 内 **`overflow-y: auto`** 滚动；底栏 56px 工具条不遮挡 **刷新列表** / 详情操作 / CLIENT-083 导航按钮。
3. 军情选中行与队列建造行（含 **CLIENT-082** 升级消耗预览）在窄屏 **无横向溢出**；画布槽位升级标签（CLIENT-066）不越出槽位区。
4. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；三面板 manifest 与 **CLIENT-054/055**、军情 **CLIENT-069** 筛选表现不退化。
5. 单测：`artPanelSkin.test.ts`（CLIENT-086 manifest 映射）、`contentPanelScroll.test.ts`（`march` / `battle-report` id）、`MarchListPanel` / `BattleReportPanel`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 背包/商城/军团聊天 CLIENT-095）

`#layout-frame.layout-narrow` 下 **背包**（`data-center-panel="bag"` + **`ui.panel.bag.v1`**）、**商城**（`data-center-panel="shop"` + **`ui.panel.shop.v1`**）、**军团** / **聊天**（`data-center-panel="guild"` / `"chat"` + **`ui.panel.guild.v1`** / **`ui.panel.chat.v1`**）根节点 nine-slice 与 CLIENT-086/078 同级；`skinBagPanel` / `skinShopPanel` / `skinGuildPanel` / `skinChatPanel` 接线。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **背包**、**商城**、**军团**、**聊天**；面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 背包道具表、商城货架长表、军团成员表与聊天消息在 `.panel-scroll-body` 内 **`overflow-y: auto`** 滚动；底栏 56px 工具条不遮挡 **使用道具** / **购买×1** / **提到** / **发送**。
3. **CLIENT-092** 缺口条（`bag-wallet-gap` / `shop-wallet-gap`）与 **CLIENT-084** 军团 **提到** 按钮在窄屏 **无横向溢出**（`wallet-gap-line` `overflow-wrap` + 成员行 `flex-wrap`）。
4. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；四面板 manifest 与 **CLIENT-062/079/084** 表现不退化。
5. 单测：`artPanelSkin.test.ts`（CLIENT-095 manifest 映射）、`contentPanelScroll.test.ts`（`shop` / `guild` / `chat` id）、`layoutViewport.test.ts`（窄屏注册表）、`ContentPanels` / `SocialPanels`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 排行将领日常 CLIENT-103）

`#layout-frame.layout-narrow` 下 **排行**（`data-center-panel="rank"` + **`ui.panel.rank.v1`**）、**将领**（`data-center-panel="hero"` + **`ui.panel.hero.v1`**）、**日常**（`data-center-panel="daily"` + **`ui.panel.daily.v1`**）根节点 nine-slice 与 CLIENT-095/078 同级；`skinRankPanel` / `skinHeroPanel` / `skinDailyPanel` 接线。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **排行**、**将领**、**日常**；面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 双榜切换与排行表、将领列表/详情、日常任务长表在 `.panel-scroll-body` 内 **`overflow-y: auto`** 滚动；底栏 56px 工具条不遮挡 **刷新排行榜** / **招募** / **领奖** / **定位首条**（CLIENT-091）。
3. **CLIENT-096** `rank-viewer-bar` 钉选行、**CLIENT-091** 可领取 **定位首条**、**CLIENT-102** 底栏 `toolbar-badge` 在窄屏 **无横向溢出**（`overflow-wrap` / `flex-wrap`）。
4. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；三面板 manifest 与 **CLIENT-078/091** 表现不退化。
5. 单测：`artPanelSkin.test.ts`（CLIENT-103 manifest 映射）、`contentPanelScroll.test.ts`（`rank` / `hero` / `daily` id）、`layoutViewport.test.ts`（窄屏注册表）、`SocialPanels` / `HeroMailPanels` / `DailyQuestPanels`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（背包与商城反馈，CLIENT-020）

`contentFeedback.ts` 解析 `UseConsumable` / `PurchaseShopOffer` 响应；背包/商城面板内 `panel-feedback` 与顶栏状态栏同步文案。使用资源包(2001) 成功后 **CLIENT-018** 顶栏仍可出现 `+粮…` 短时摘要（`patchSession` + `formatWalletGainBrief`）。

1. `make dev` 或 mock 网关进入主城，**任务领奖**或 **商城购买** 获得谷袋(2001) 与急工符(2003)（mock 购买即得 2001）。
2. **背包**：「刷新背包」→ 选 **2001** →「使用道具」。面板金色反馈区与 HUD 末行应同时显示效果（如「获得粮食 …」「+粮…」）；顶栏粮增加时出现 CLIENT-018 `+粮` 飘字。
3. 选 **2003** →「使用道具」：面板与状态栏应显示加速文案（服务端 `effect_summary` 或 `speedup_seconds` 推导）。
4. 故意数量大于库存或 mock 下耗尽道具：失败时面板与状态栏为 `[code] msg`，不静默。
5. **商城**：「刷新货架」→ offer 1001 →「购买×1」。成功行内追加 `已购 +1`，面板反馈含 `钱包 粮 … 币 …`（与顶栏 HUD 同 `formatResourceHudGroup` 格式）；限购行仍显示 `限购 n/m`；**CLIENT-057** 起余额不足/售罄/限购在 `shop-form-error` 内联中文提示且不发 RPC；网关失败经 **CLIENT-067** `formatPanelGatewayError`（如 `余额不足 [64003]`）。
6. **背包使用**：数量为 0 或道具不在背包快照时 `bag-form-error` 内联提示（不发 RPC）；成功清空错误区、金色 `panel-feedback` 展示效果，失败保留 `bag-form-error`（与 **CLIENT-048** / **CLIENT-067** 军事 `march-form-error` 口径一致）。
7. **CLIENT-092 缺口对比**：商城选中 offer / 背包选中消耗品时，`shop-wallet-gap` / `bag-wallet-gap` 只读展示 `formatWalletGapLine`（粮/木/铁/石 需/余）；不足资源名带 `resource-gap-warn`，与 **CLIENT-057** 预校验内联错误并存。
8. 单测：`contentFeedback.test.ts`、`contentFormValidation.test.ts`、`walletGap.test.ts`；全量 `cd client && npm test`。

### 手动验收（HUD 资源变动，CLIENT-018）

承接 **CLIENT-011** 顶栏五资源；`hudFormat.formatWalletGainBrief` 对比领奖/购买前后 `wallet` 字段，在 `#hud` 短时显示 `+粮/+木/+铁/+石/+币` 摘要（约数秒淡出）。`CityStateFetch` 对 `domestic.v1.GetCityState` **单飞去重**；`cityStatePoll` 在主城：有 DOM 面板打开时约 **5s** 轮询刷新 HUD/建筑等级，无面板时约 **30s** 降频。

1. `make dev` 进入主城，记下顶栏粮/币等初值。
2. **日常领奖**或 **任务领奖**（见 [日常 chain 400](#手动验收日常-chain-400client-009)）：领奖成功后顶栏应出现对应 `+…` 摘要，随后数值与 HUD 一致。
3. **商城购买**或 **邮件领附件**（见 [CLIENT-017](#手动验收邮件收件箱client-017)）：`wallet_after` 增加时同样出现摘要。
4. **将领招募**成功且扣费/消耗后若钱包净增（mock 少见），摘要行为一致；纯扣费无 `+` 提示。
5. 打开 **「任务」** 或 **「邮件」** 面板停留：观察 HUD 仍周期性刷新（5s 档）；关闭所有面板后频率降低（30s 档），浏览器网络面板中 `GetCityState` 无并发重复请求（单飞）。
6. 视口 **1280×720** 与 **1600×900**：`+粮` 摘要不遮挡底栏 56px 行（见 `layoutViewport` 单测）。

`make dev` 真实网关：

```bash
# 仓库根
make dev
cd client && npm install && npm run dev
```

mock 网关（含 ListMarches 桩，出征后列表可见）：

```bash
cd client && npm run mock:gateway
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（排行双榜 CLIENT-021）

与 `rank.v1.GetLeaderboard` 网关一致（`make dev` 真实 PG；mock 网关返回固定条目）。

1. 进入主城后点 **「排行」** → 榜单类型下拉应含 **战力榜**、**资源总量榜**（`LB_PLAYER_POWER` / `LB_PLAYER_RESOURCE`）。
2. 切换类型后点 **「刷新榜单」**：列表行格式为 `名次. 显示名 · 分数`；面板顶部或摘要区展示 **我的名次**（`my_rank` / `my_score`），未上榜时文案含「未上榜」与当前战力或资源总量。
3. 若网关返回 `snapshot_version` / `snapshot_refreshed_at_ms`（及可选 `batch_id`），面板应展示 **快照批次/刷新时间** 摘要（`formatLeaderboardSnapshotMeta`），便于对照 Scheduler 刷新。
4. 打开排行面板时应自动拉取当前所选类型（无需先手动刷新）；失败时状态栏显示可读错误，可重试。
5. 单测：`leaderboardFormat.test.ts`、`SocialPanels.test.ts`（战力榜打开即拉取）。

### 手动验收（队列 CLIENT-019）

队列面板顶栏（**CLIENT-059**）汇总进行中建造/募兵条数与 `formatBuildQueueCountdown` 最近倒计时；顶栏资源条 hover/focus/点击展开时通过 `formatResourceSweepLine` 扫读余量与 `production_rates`（缺字段则仅余量），不占固定次行（**CLIENT-081**）。

1. `make dev` 下联调，主城底栏 **「队列」**（mock 无募兵队列）。
2. 升级农田等使 `upgrade_finish_at_ms > now`：列表含槽位、目标等级、`formatUpgradeRemaining` 剩余时间与完成时刻；打开面板时 1s 刷新，关闭即停。
3. 军事募兵若返回 `queue_id`/`finish_at_ms`：列表显示兵种/数量/倒计时；完成后提示刷新兵力，可点「刷新内政」或「刷新状态」并打开军事。
4. **1600×900** 下面板可滚动。

### 手动验收（队列加速 CLIENT-026）

1. `make dev` 下联调；确保背包有 **道具 2003**（短促工符 / 急工符·五刻，可用 GM 发放或商城购买后「刷新背包」）。
2. 主城升级一槽建筑（如农田），使 `upgrade_finish_at_ms > now`；打开底栏 **「队列」**，进行中建造行旁应出现 **「使用短促工符」**。
3. 无 2003 或数量为 0 时按钮应 **禁用**（悬停提示道具不足）；无进行中建造时不应出现可点的加速（或点击后提示无建造）。
4. 点击 **「使用短促工符」**：调用 `content.v1.UseConsumable`（`item_cfg_id=2003`，`count=1`）；面板底部 `queue-status` 与 HUD 状态栏展示 `effect_summary` 或推导的加速秒数。
5. 成功后自动 **GetCityState**：队列行剩余时间应缩短（`upgrade_finish_at_ms` 前移，依赖服务端 DOM-003）；背包 2003 数量减 1。可对比使用前后面板倒计时或完成时刻。
6. 募兵行 **无** 加速按钮（本卡仅建造队列）。单测：`QueuePanels.test.ts`、`bagState`（`bagStackQuantity`）。

### 手动验收（邮件战报背包密度，CLIENT-029）

`panelDensity.ts` / `militaryFormat` 战报行辅助；邮件未读行 class `unread` 与 CLIENT-027 角标同色（`#c9a227`）。

1. `make dev` 或 mock 进主城。**邮件**：空收件箱显示「暂无邮件，完成日常…」；有信时每行两行（标题+时间 / 附件或已读角标），未读行左侧金条背景；底栏未读角标与 CLIENT-027 一致。
2. **战报**：列表加载失败时状态栏与列表内「重试」提示，与真空列表「暂无战报…」区分；有数据时行首 outcome 色块 + 对手摘要 + 时间；筛选无结果时保留筛选条且列表提示「无匹配战报」。
3. **背包**：空列表引导「商城」「日常」；道具行 `item_cfg_id` 与数量列对齐；使用失败时金色反馈在列表**下方**，不遮挡道具行。
4. 单测：`panelDensity.test.ts`、`BattleReportPanel.test.ts`、`HeroMailPanels.test.ts`；全量 `cd client && npm test`。

### 手动验收（社交扫读 CLIENT-030）

在 CLIENT-021 / CLIENT-022 基础上加深排行顶栏、军团排序与聊天分组（`make dev` 或 mock）。

1. **排行**：打开面板后 `rank-viewer-bar` 展示 **我的名次 / 分数**（`my_rank` / `my_score`）；手动刷新成功后同栏展示 **上次刷新**（`rank-last-refresh-ms` session）；`my_rank>0` 时列表顶行 **钉选** `formatMyRankPinLine`；表头 `thead` 固定；空榜行使用 `formatLeaderboardEmptyHint()`（含 dev 无种子提示）。**CLIENT-097**：点击榜单行 — 战力榜己方行打开将领详情（`GetHeroDetail`），他人行状态栏提示只读；资源榜有格点字段时打开世界信息卡，否则只读摘要弹层。
2. **军团**：「刷新成员」列表按职务（团长→官员→成员）与战力排序（`sortGuildMembers`），并按职务 **分组折叠**（`groupGuildMembersByRole`，默认展开团长组）；每行职务 chip + `player_id` 截断与加入时间摘要（CLIENT-101）。
3. **聊天**：世界频道消息按本地日插入 **今日/昨日** 分组标题（`groupChatMessagesByLocalDay`）；世界行 `chat-msg-world` 行高收紧，`chat-sender` 长昵称不被裁切。
4. 单测：`socialFormat.test.ts`、`leaderboardFormat.test.ts`、`SocialPanels.test.ts`。

### 手动验收（社交刷新 CLIENT-045）

排行与聊天面板 **手动刷新** 与 **陈旧提示**（`make dev` 或 mock；`SocialPanels` + `socialRefreshFormat`）。

1. 主城点 **「排行」**：打开即拉取当前榜单；成功后 **「刷新排行榜」** 下方出现 **上次更新** 本地时间戳。
2. 连点刷新或切换榜单触发拉取时，刷新按钮应 **禁用**直至返回；快速双击不应并发重复 RPC（单飞 dedupe）。
3. 断网或 mock 失败：面板内红色 **刷新失败：…** 文案（网关 `formatSocialGatewayError`），状态栏同步；修复后再次刷新应恢复时间戳。
4. **「聊天」** 各频道（世界/私聊/军团）同理：**刷新** 按钮 + **上次更新**；发送成功后自动刷新也应更新时间戳。
5. 单测：`socialRefreshFormat.test.ts`、`socialPanelInflight.test.ts`、`SocialPanels.test.ts`（时间戳、in-flight 禁用、失败文案）。

### 手动验收（社交空态与错误文案 CLIENT-053）

排行/军团/聊天空列表与刷新失败文案统一走 `socialFormat` + `formatSocialPanelRefreshError`（与 CLIENT-045 刷新按钮并存）。

1. **排行**：空榜行含「刷新排行榜」引导；刷新失败且曾有成功数据时表格保留上次快照，状态栏 **刷新失败** 并标注 **数据可能已过期**。
2. **聊天**：无消息时列表空态含「刷新」引导；军团频道未入团为只读说明 + **前往军团**（不新 RPC）。
3. **军团**：未入团成员区只读说明；已入团无成员或刷新失败时列表空态与面板内 **刷新失败：…** 一致。
4. 单测：`socialFormat.test.ts`（空态 key）、`SocialPanels.test.ts`（陈旧快照、军团跳转、列表重试提示）。

### 手动验收（将领招募对比 CLIENT-031）

在 [CLIENT-014](#手动验收将领详情-client-014) / [CLIENT-008](#手动验收m4将领client-008) 基础上验收招募池对比与扣费明细。

1. 点 **「将领」** → 刷新列表 → 点选将领：详情区 **Lv** 与模板名同屏，四维为表格 + 进度条（武力/智力/政治/统率）。
2. **刷新招募模板**：列表/下拉对 `already_owned` 或已有同 `template_cfg_id` 将领的行展示 **「已招募」**（`recruit-owned` 样式）。
3. 选中模板：预览区 **扣费明细** 为 `formatRecruitDeductSummary`，与招募成功状态栏扣费文案一致。
4. 招募成功后的 **CLIENT-023** 日常跟进提示路径不变。单测：`heroMailState.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（将领招募钱包对比 CLIENT-056）

在 [CLIENT-031](#手动验收将领招募对比-client-031) 基础上，用会话 HUD 钱包/背包与模板消耗对比（不发 `RecruitHero` 预检逻辑见 `recruitAffordability.compareRecruitAffordability`）：

1. **将领** → 刷新招募模板：列表行 **主行** 为模板名+稀有度，**次行** 为「持/需」与 ✓/不足；与顶栏五资源快照一致。
2. 点选将领加载详情：详情区在属性表上方展示 **同一摘要**（同 `template_cfg_id` 的招募模板）。
3. 资源或道具不足时 **招募** 按钮禁用，`march-form-error-sibling` 展示中文原因；强行改 DOM 触发仍被客户端拦截。网关 `RecruitHero` 失败时状态栏与错误区与 **CLIENT-067** 一致（`formatPanelGatewayError`，如 `道具不足 [10001]`）。
4. 单测：`recruitAffordability.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（将领详情养成对比 CLIENT-072）

在 [CLIENT-014](#手动验收将领详情-client-014) / [CLIENT-056](#手动验收将领招募钱包对比-client-056) 基础上：

1. 点选将领：详情区展示 **养成进度条**（有 `exp_*` 时等级经验 + `loyalty_min~max` 忠诚条；缺经验字段时降级为 **Lv·忠诚** 摘要）；列表行 `selected` 与详情 `hero_id` 同步。
2. 属性表 **Δ 列** 为 `compareHeroDetailToTemplate` 相对模板基准四维 ±N（不发新 hero RPC）。
3. **去招募**：同面板招募区预选当前 `template_cfg_id`；**相关道具**：`ListPlayerBag` 过滤养成消耗品（如将魂碎晶 2017）并打开背包高亮。
4. 单测：`heroMailState.test.ts`（对比/进度/背包过滤）、`HeroMailPanels.test.ts`。

### 手动验收（四类面板统一错误 CLIENT-067）

将领/商城/背包/军事的内联错误区（`recruit-form-error`、`shop-form-error`、`bag-form-error`、`march-form-error`）经 `contentFormValidation.setPanelFormErrorDisplay` 渲染；网关失败统一为 `formatPanelGatewayError` 的中文摘要 + 末尾 `[code]`（如商城 `余额不足 [64003]`），与 CLIENT-056/057 预校验共用同一 DOM 槽位，成功操作后错误区清空。

### 手动验收（世界格点信息卡 CLIENT-073）

在 [CLIENT-069](#手动验收军情格点筛选-client-069) 格点筛选与 [CLIENT-061](#手动验收世界坐标-client-015) 双向高亮基础上，**世界** 面板点选城池/格点后展示只读 **格点信息卡**（坐标、匹配 `ListPlayerCities` 快照的城池名/城墙等级、空地格资源类型文案；**不新 world RPC**）。

1. 打开 **世界** → 点选一城或列表行：应出现 **格点信息** 卡，含坐标与 **指向此格行军 N 条**（或「暂无」）；再次点选同一行取消选中并隐藏信息卡。
2. 信息卡 **在军情中查看**：应打开/保持 **行军** 面板，目的格筛选为 **世界选中格**（与 CLIENT-069 一致）；列表仅显示 `to_x/to_y` 匹配行。
3. 小地图 **空白单击** 选出征目标时，世界信息卡应同步该格；小地图视野 `pan/zoom` 纳入该格，目的点标注与 CLIENT-028 行军连线不退化；军情选中行军时仍以 CLIENT-069 目的格视野为准。
4. 单测：`worldTileInfoCard.test.ts`、`WorldPanels.test.ts`、`MarchListPanel.test.ts`、`worldMinimap.test.ts`。

### 手动验收（军情格点筛选 CLIENT-069）

在 [CLIENT-061](#手动验收世界坐标-client-015) 双向高亮与 [CLIENT-058](#手动验收小地图目的点-eta-client-058) ETA 角标基础上，降低多行军扫读成本（**无 CancelMarch/撤回**；筛选仅客户端过滤 `ListMarches` 快照，不新 RPC）。

1. 打开 **行军** 面板：「目的格点筛选」应提供 **全部** / **世界选中格** / **手动格点**（x、y + **应用**）。
2. **世界** 面板点选城池行：军情筛选自动切到 **世界选中格**，列表仅显示 `to_x/to_y` 与该格一致的行；再次点选同一行取消世界选中后，筛选回到 **全部**。
3. **手动格点**：输入目的坐标并 **应用**，列表即时过滤；仍只使用已拉取的行军快照（可开 Network 确认无额外 `ListMarches`）。
4. 军情列表 **选中一行**：展开小地图应 `pan/zoom` 纳入该行目的格与 ETA 角标（与 CLIENT-058 同口径）；**折叠** 小地图时顶栏状态栏复述 `formatMinimapCollapsedSelectedMarchStatus`（含坐标与剩余时间/阶段）。
5. **世界** 列表各行在有条目指向该格时展示 **指向此格的行军 N 条**；点击该计数应打开/保持军情面板并选中 **首条** 匹配行军。
6. 单测：`marchWorldListLink.test.ts`、`MarchListPanel.test.ts`、`WorldPanels.test.ts`、`worldMinimap.test.ts`。

### 手动验收（主城槽位队列深链 CLIENT-066）

`MainCitySlotUpgradeOverlay` 在 `upgrade_finish_at_ms > now` 的槽位上叠加 DOM 标签（`formatUpgradeRemainingAbbrev` + CSS 细进度条，`pointer-events: none`）；点击升级中槽位打开底栏 **队列** 并 `openAndHighlightBuildSlot` 高亮对应 `slot_key` 建造行（`queueBuildRowDomId`）。与 **CLIENT-059** 队列顶栏总览、**CLIENT-052** 日常互链按钮并存；募兵加速仍 **out**。

1. `make dev` 升级一槽建筑至 `upgrade_finish_at_ms > now`：画布槽位旁应出现剩余时间缩写与细进度条。
2. 点击该升级中槽位：应打开 **队列** 面板，对应建造行 `selected` 并滚入视口（id `queue-build-row-<slot_key>`）。
3. **CLIENT-059** HUD 产出速率次行与 **CLIENT-026** 建造加速符逻辑不退化。单测：`mainCitySlotUpgrade.test.ts`、`QueuePanels.test.ts`。

### 手动验收（建造队列完成脉冲 CLIENT-105）

`GetCityState` 轮询/推送后，`detectBuildJustCompleted` 检测槽位 `upgrade_finish_at_ms` 由进行中→空闲：对应队列行 **3s** `queue-build-complete-pulse` 并展示最新 **Lv** 文案。队列建造行点击仍 `openAndHighlightBuildSlot`；与画布升级标签 **互高亮**（`queue-build-slot-mutual-highlight`）直至点选其他槽位或关闭互选。与 **CLIENT-052** 日常互链、**CLIENT-026** 加速符并存；募兵加速仍 **out**。

1. mock/dev：令一槽升级在轮询瞬间完成 → 队列行应脉冲且等级文案更新。
2. 升级中槽位与队列行互点：画布标签与队列行应同步高亮；点选非升级槽位后互高亮清除。
3. 单测：`buildQueueComplete.test.ts`、`QueuePanels.test.ts`。

### 手动验收（邮件战报日常深链 CLIENT-068）

在 **CLIENT-060** 三角深链主干上，`mailBattleCrossLink` 扩展邮件正文 `#report` / 「战报」+数字等模式；战报详情胜/负且 chain 400 `daily_march_1` / `daily_build_1` **进行中** 时展示 **相关日常** 按钮（打开日常并 `scrollIntoView`，不自动领奖）；邮件含世界坐标时状态栏提示可在世界面板查看。

1. GM `send-mail` 或 dev 邮件：正文含 `report_id=` 或 `#report` → **查看战报** 应选中对应行。
2. 战报详情 **胜/负** + 对应日课进行中 → **相关日常** 打开日常面板并滚到 cfg 行。
3. 单测：`mailBattleCrossLink.test.ts`、`BattleReportPanel.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（队列日常行内反馈 CLIENT-071）

队列建造行匹配 `daily_build_1` 时在 **日常：下一步** 旁展示只读 **日课 current/target**（`formatLinkedDailyQuestProgressSummary`）；日常面板建造/练兵进行中行展示队列 **最近到期** 建造或募兵倒计时（`formatDailyQuestQueueInlineHint`，与 `QueuePanels` 同源快照）。**DOM-003** 加速符与募兵加速 **out** 口径不变。

1. `make dev`：chain 400 建造日课进行中且队列有对应升级行 → 队列行应见 **日课 n/m** 摘要。
2. 日常面板对应建造/练兵行应见队列倒计时摘要（与队列面板一致口径）。
3. 单测：`dailyQuestQueueMatch.test.ts`、`QueuePanels.test.ts`、`DailyQuestPanels.test.ts`。

### 手动验收（小地图目的点 ETA CLIENT-058）

在 [CLIENT-028](#手动验收世界地图行军标注-client-028) / [CLIENT-037](#手动验收小地图比例尺与多行军-client-037) 与 [CLIENT-047](#手动验收行军列表-eta-与军情密度-client-047) 基础上：

1. `make dev` 完成出征后，小地图 **目的点** 旁应出现 **剩余时间缩写**（行军中/撤回中，与 `formatMarchRemainingMsAbbrev` 同口径）或阶段简写 **待/达**（`minimapMarchPhaseShortLabel`）。
2. 展开小地图时图例区应展示 **`点=目的格 · 数字=剩余时间`**（`MINIMAP_DEST_ETA_LEGEND`）；缩放/平移后角标仍随目的点绘制。
3. 折叠小地图并在列表 **选中一行** 行军：状态栏应复述 `formatMinimapCollapsedSelectedMarchStatus`（含目的坐标与 ETA/阶段）。
4. 仍无取消行军/加速。单测：`worldMinimap.test.ts`（ETA 角标文案与 `clampMinimapEtaLabelLayout`）。

### 手动验收（HUD 待办聚合与中心面板深链 CLIENT-077）

顶栏 `#hud` 在资源条旁展示 **待办** 聚合角标（三类计数之和）：**可领取邮件**（`mailHasUnclaimedAttachments`）、**可领日常**（chain 400 `state=3`）、**建造完成**（`BuildCompleteTodoTracker` 记录的槽位，来自 `GetCityState` 队列状态变迁，无新 RPC）。与底栏 **CLIENT-027/038** 邮件未读/日常可接+可领/战报未读角标并存。

1. `make dev` 或 mock：有可领奖日常、可领附件邮件、或刚完成建造时顶栏出现 **待办 N**；`title` 展示分项计数。
2. **点击待办角标** → 按优先级打开中心面板并滚到首条：`日常(可领)` → `邮件(可领)` → `队列(建造完成)`；`data-todo-scroll-target` 为 `daily:<cfg>` / `mail:<id>` / `queue:<slot>`。
3. 面板已打开且目标未变时 **重复点击不重复滚动**；底栏角标深链（CLIENT-038）与槽位→队列（CLIENT-066）、邮件战报标签（CLIENT-068）行为不变。
4. **CLIENT-051** 资源脉冲与 **1280×720** 顶栏布局不退化（待办按钮在资源条右侧，不叠 canvas 字）。
5. 单测：`hudCenterTodo.test.ts`、`buildCompleteTodo.test.ts`、`hudTodoBadgePoll.test.ts`。

### 手动验收（HUD 待办徽章，CLIENT-027）

底栏 **邮件 / 日常 / 战报** 右上角数字角标；有计数时可 **角标深链**（**CLIENT-038**），按钮正文点击仍 toggle 面板。轮询间隔与 CLIENT-018 `CityStatePoll` 同档（面板打开 5s / 关闭 30s），各来源请求单飞。

1. `make dev` 或 mock 进主城：有未读邮件时 **「邮件」** 角标为 `ListPlayerMail` 未读 `total_count`；chain 400 存在 **可接(1)** 或 **可领奖(3)** 日常时 **「日常」** 角标为对应条数；新战报相对上次打开战报面板为 **「战报」** 角标（CLIENT-025 `BattleReportUnreadSession`）。
2. 点开对应面板后该入口角标立即清零；关闭面板后随轮询恢复（邮件未读、日常待办、战报未读各自独立）。
3. 行军到达 HUD 提示点开后战报角标同样清零。
4. 视口 **1600×900**：角标叠在按钮内侧右上，底栏仍可正常点按。

## 仅 mock 网关

`mock-server` 实现 `Login`、**选服/进服**、**聊天（含军团频道）/军团/排行**、**quest/shop/content.v1 背包** 与军事路由的**即时**桩（募兵无队列）。另含最简建城/内政桩以便进主城；完整内政与持久化请连 `make dev`。

```bash
cd client && npm run mock:gateway   # ws://127.0.0.1:19090/ws
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 验证

```bash
cd client && npm test && npm run build
```

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`hudFormat`（资源条分组数值与 `+粮` 摘要）、`hudCenterTodo` / `buildCompleteTodo`（顶栏待办聚合与 scroll target）、`hudTodoBadges` / `hudTodoBadge` / `HudTodoBadgePoll` / `toolbarBadge`（待办角标单一事实源与单飞轮询）、`battleReportReplayCoord`（战报复盘坐标提取）、`worldMinimap`（小地图缩放/行军高亮/战报复盘 framing/比例尺/折叠 sessionStorage/多行军描边/目的点 ETA 角标）、`panelDensity`（邮件/战报/背包空态与未读 class）、`queueState` / `QueuePanels`（内政升级与募兵队列行、建造加速符 UseConsumable）、`contentFeedback`（背包/商城效果与网关错误文案）、`cityStateFetch` / `cityStatePoll`（GetCityState 单飞与降频轮询）、`militaryFormat`、`socialFormat` / `socialRefreshFormat` / `socialPanelInflight` / `SocialPanels`（聊天日期分组、军团职务排序、排行空榜提示、刷新时间戳与单飞）、`bagState`（网关背包合并）、`BattleReportPanel` / `MarchListPanel`（空列表/加载失败/列表行）、`dailyQuestObjective` / `dailyQuestState` / `dailyQuestBattleReportBanner` / `DailyQuestPanels`（chain 400 多类型标签、战报未读横幅、下一步导航与领奖合并）、`heroMailState`（招募模板/已招募/扣费明细/收件箱 filter·摘要·领取合并）、`recruitAffordability`（招募消耗 vs HUD 钱包对比）/ `HeroMailPanels`（未读切换、点开已读、角标）与 `StartMarchRequest` / `ListMarchesRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报/行军、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
