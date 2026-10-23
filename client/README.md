# H5 客户端（CLIENT-001 ~ CLIENT-036+）

## CLIENT-032 manifest 美术接线

主树 `client/public/assets/art/v1/manifest.json`（#218）已落地样件，H5 接线 asset id：

| asset id | 用途 |
|---|---|
| `res.icon.food.v1` | HUD 顶栏 DOM 粮图标（`appendHudResourceStrip`，CLIENT-039 起不再在 canvas 重复绘制） |
| `res.icon.wood.v1` | HUD 顶栏 DOM 木图标 |
| `res.icon.iron.v1` | HUD 顶栏 DOM 铁图标 |
| `res.icon.stone.v1` | HUD 顶栏 DOM 石图标 |
| `ui.panel.default.v1` | 队列 / 邮件 / 背包 / 日常面板根 nine-slice（`artPanelSkin.skinNineSlicePanel`） |
| `ui.panel.military.v1` | 军事表单面板、行军列表、队列募兵区块（`artPanelSkin.skinMilitaryPanel`；募兵/出征主按钮见 CLIENT-033） |

图标缺失时 HUD 回退为「粮/木/铁/石/币 + 数值」纯文字（与 CLIENT-011 一致）。面板根节点设 `data-art-skin="off"` 可跳过 nine-slice。

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
| **小地图选点出征** | [手动验收（小地图选点 CLIENT-041）](#手动验收小地图选点出征-client-041)（[#265](https://github.com/anitaguptaoffice/sanguo-slg/issues/265)） | 本 PR |
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
5. **daily_march_1**：接取且进行中 → **「前往下一步」** 打开 **「背包」** 并高亮 **2020 远征干粮** → **使用道具** 成功后日常进度推进 → 领奖。
6. 单测：`dailyQuestObjective.test.ts`；全量 `cd client && npm test`。

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
4. 单测：`socialRefreshFormat.test.ts`；全量 `cd client && npm test`。

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

`MarchArrivalPoll` 轮询 `ListMarches`：出征后跟踪 `march_id`；行军阶段 **marching(2)→arrived(3)/returning(4)** 或列表中该行消失时，顶栏状态栏出现可点链接 **「行军结束，查看战报」**（`MARCH_ARRIVAL_STATUS_TOAST`）。`BattleReportUnreadSession` 记录上次打开战报面板时的 `report_id` 上界，刷新列表后新增战报计入未读（与 **CLIENT-027** 底栏角标联动）。

1. `make dev` 完成 [募兵 → 行军](#手动验收募兵--行军--战报client-012--client-013) 步骤 2–3，保持主城场景（无需一直打开「行军」面板）。
2. 等待行军到达并完成战斗（距离与调度决定耗时；可缩短目标距离）。到达时状态栏应出现 **行军结束，查看战报** 链接。
3. 点击链接应打开底栏 **「战报」** 面板并触发列表刷新；未打开前底栏 **「战报」** 可出现未读角标（见 [CLIENT-027](#手动验收hud-待办徽章-client-027)）。
4. 打开战报面板后未读角标清零；再次产生新战报时角标恢复。
5. 单测：`marchArrival.test.ts`、`marchArrivalPoll.test.ts`、`battleReportUnread.test.ts`、`BattleReportPanel.test.ts`。

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

### 手动验收（军事 manifest CLIENT-036）

`artPanelSkin.skinMilitaryPanel` 对 **军事表单**、底栏 **「行军」** 列表根、**「队列」** 募兵区块应用 manifest `ui.panel.military.v1`（#227 / ART-MILITARY-005）；非军事面板仍用 `ui.panel.default.v1`（CLIENT-032）。`data-art-skin="off"` 可跳过 nine-slice。

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

### 手动验收（背包与商城反馈，CLIENT-020）

`contentFeedback.ts` 解析 `UseConsumable` / `PurchaseShopOffer` 响应；背包/商城面板内 `panel-feedback` 与顶栏状态栏同步文案。使用资源包(2001) 成功后 **CLIENT-018** 顶栏仍可出现 `+粮…` 短时摘要（`patchSession` + `formatWalletGainBrief`）。

1. `make dev` 或 mock 网关进入主城，**任务领奖**或 **商城购买** 获得谷袋(2001) 与急工符(2003)（mock 购买即得 2001）。
2. **背包**：「刷新背包」→ 选 **2001** →「使用道具」。面板金色反馈区与 HUD 末行应同时显示效果（如「获得粮食 …」「+粮…」）；顶栏粮增加时出现 CLIENT-018 `+粮` 飘字。
3. 选 **2003** →「使用道具」：面板与状态栏应显示加速文案（服务端 `effect_summary` 或 `speedup_seconds` 推导）。
4. 故意数量大于库存或 mock 下耗尽道具：失败时面板与状态栏为 `[code] msg`，不静默。
5. **商城**：「刷新货架」→ offer 1001 →「购买×1」。成功行内追加 `已购 +1`，面板反馈含 `钱包 粮 … 币 …`（与顶栏 HUD 同 `formatResourceHudGroup` 格式）；限购行仍显示 `限购 n/m`；余额不足为 `[64003] 余额不足`（真实服 code 以网关为准）。
6. 单测：`contentFeedback.test.ts`；全量 `cd client && npm test`。

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

1. **排行**：打开面板后 `rank-viewer-bar` 展示 **我的名次 / 分数**（`my_rank` / `my_score`）；表头 `thead` 固定；空榜行使用 `formatLeaderboardEmptyHint()`（含 dev 无种子提示）。
2. **军团**：「刷新成员」列表按职务（团长→官员→成员）与战力排序（`sortGuildMembers`）；行内 `player_id` 截断展示，含加入时间摘要。
3. **聊天**：世界频道消息按本地日插入 **今日/昨日** 分组标题（`groupChatMessagesByLocalDay`）；世界行 `chat-msg-world` 行高收紧，`chat-sender` 长昵称不被裁切。
4. 单测：`socialFormat.test.ts`、`leaderboardFormat.test.ts`、`SocialPanels.test.ts`。

### 手动验收（社交刷新 CLIENT-045）

排行与聊天面板 **手动刷新** 与 **陈旧提示**（`make dev` 或 mock；`SocialPanels` + `socialRefreshFormat`）。

1. 主城点 **「排行」**：打开即拉取当前榜单；成功后 **「刷新排行榜」** 下方出现 **上次更新** 本地时间戳。
2. 连点刷新或切换榜单触发拉取时，刷新按钮应 **禁用**直至返回；快速双击不应并发重复 RPC（单飞 dedupe）。
3. 断网或 mock 失败：面板内红色 **刷新失败：…** 文案（网关 `formatSocialGatewayError`），状态栏同步；修复后再次刷新应恢复时间戳。
4. **「聊天」** 各频道（世界/私聊/军团）同理：**刷新** 按钮 + **上次更新**；发送成功后自动刷新也应更新时间戳。
5. 单测：`socialRefreshFormat.test.ts`、`socialPanelInflight.test.ts`、`SocialPanels.test.ts`（时间戳、in-flight 禁用、失败文案）。

### 手动验收（将领招募对比 CLIENT-031）

在 [CLIENT-014](#手动验收将领详情-client-014) / [CLIENT-008](#手动验收m4将领client-008) 基础上验收招募池对比与扣费明细。

1. 点 **「将领」** → 刷新列表 → 点选将领：详情区 **Lv** 与模板名同屏，四维为表格 + 进度条（武力/智力/政治/统率）。
2. **刷新招募模板**：列表/下拉对 `already_owned` 或已有同 `template_cfg_id` 将领的行展示 **「已招募」**（`recruit-owned` 样式）。
3. 选中模板：预览区 **扣费明细** 为 `formatRecruitDeductSummary`，与招募成功状态栏扣费文案一致。
4. 招募成功后的 **CLIENT-023** 日常跟进提示路径不变。单测：`heroMailState.test.ts`、`HeroMailPanels.test.ts`。

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

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`hudFormat`（资源条分组数值与 `+粮` 摘要）、`hudTodoBadge` / `HudTodoBadgePoll` / `toolbarBadge`（待办角标聚合与单飞轮询）、`battleReportReplayCoord`（战报复盘坐标提取）、`worldMinimap`（小地图缩放/行军高亮/战报复盘 framing/比例尺/折叠 sessionStorage/多行军描边）、`panelDensity`（邮件/战报/背包空态与未读 class）、`queueState` / `QueuePanels`（内政升级与募兵队列行、建造加速符 UseConsumable）、`contentFeedback`（背包/商城效果与网关错误文案）、`cityStateFetch` / `cityStatePoll`（GetCityState 单飞与降频轮询）、`militaryFormat`、`socialFormat` / `socialRefreshFormat` / `socialPanelInflight` / `SocialPanels`（聊天日期分组、军团职务排序、排行空榜提示、刷新时间戳与单飞）、`bagState`（网关背包合并）、`BattleReportPanel` / `MarchListPanel`（空列表/加载失败/列表行）、`dailyQuestObjective` / `dailyQuestState` / `dailyQuestBattleReportBanner` / `DailyQuestPanels`（chain 400 多类型标签、战报未读横幅、下一步导航与领奖合并）、`heroMailState`（招募模板/已招募/扣费明细/收件箱 filter·摘要·领取合并）/ `HeroMailPanels`（未读切换、点开已读、角标）与 `StartMarchRequest` / `ListMarchesRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报/行军、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
