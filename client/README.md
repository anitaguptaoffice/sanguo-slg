# H5 客户端（CLIENT-001 ~ CLIENT-036+）

## 首城 V2 本地验收

本机 `make dev` 栈下走通 **注册 → 无城登录 → V2 Discover/Submit → 主城**，步骤与命令见 [qa/FIRST-CITY-PLAYABLE.md](qa/FIRST-CITY-PLAYABLE.md)。日常迭代用根目录 `make test-fast`；动 api/client 合 PR 前用 `make test-gate`。

## CLIENT-032 manifest 美术接线

主树 `client/public/assets/art/v1/manifest.json`（#218）已落地样件，H5 接线 asset id：

| asset id | 用途 |
|---|---|
| `res.icon.food.v1` | HUD 顶栏 DOM 粮图标（`appendHudResourceStrip`，CLIENT-039 起不再在 canvas 重复绘制） |
| `res.icon.wood.v1` | HUD 顶栏 DOM 木图标 |
| `res.icon.iron.v1` | HUD 顶栏 DOM 铁图标 |
| `res.icon.stone.v1` | HUD 顶栏 DOM 石图标 |
| `ui.panel.default.v1` | 邮件面板根 nine-slice（`artPanelSkin.skinMailPanel`）；主城 **建造侧栏**（`skinDefaultPanel`，CLIENT-111 / ART-CHROME-006） |
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

### ART-TOOLBAR-ICONS-007 运行时 UX（CLIENT-118）

在 **#482** `artToolbarIconSkin` 工程挂载前提下：底栏八个 `toggle-*`（军事/邮件/队列/背包/日常/世界/将领/商城）在 `ui.button.toolbar.v1` chrome 内挂 **`ui.icon.toolbar.*.v1`** 32px 图标 + 两字标签；`mountToolbarIcons` 对 **normal/hover/pressed/disabled** 走 `getButtonImage`（manifest `button_states` 就绪时）或 **variants** 回退，并与 chrome 同步指针态。按钮设 **`data-art-skin="off"`** 时跳过图标、保留文字标签。**1280×720** 底栏横向滚动时图标与 **CLIENT-107** 角标不被 `overflow` 裁切，标签省略、完整文案见 **`title`**；**`aria-expanded`** 仍由 **CLIENT-110** `syncToolbarAriaExpanded` 维护。美术证据只读：`docs/art/samples/art-toolbar-icons-007/`。单测：`artToolbarIconSkin.test.ts`。

### ART-UI-PANEL-STATE-009 工程挂载（面板 loading/empty/error 纸底）

对照 **#482** / **#509** 只读 cherry-pick **3** manifest id / **6** PNG（`ui.panel.loading.v1`、`ui.panel.empty.v1`、`ui.panel.error.v1` 九宫 **320×120**，L/T/R/B **16**）；**不合** art hold / VERIFY Draft（#77 / #82 / #108 / #506 等）。薄封装 **`artPanelStateSkin`**：`resolvePanelStateAssetId` / `PANEL_STATE_ASSET_BY_KIND` 供 **CLIENT-129** `panelStateChrome` 接线；**`data-art-skin="off"`** 回退 **CLIENT-067** 纯文案。证据：`docs/art/samples/art-ui-panel-state-009/`（`INVENTORY.md`、`manifest-index.json`、`hit-proof.json`）。单测：`artPanelStateSkin.test.ts`。

### ART-WORLD-MINIMAP-010 工程挂载（小地图目的点 / 图例 chrome）

对照 **#482** / **#509** / **#551** 只读工程挂载 **2** manifest id / **4** PNG（`ui.minimap.dest.v1` 目的格 marker **14×14** 锚点中心 **7,7**；`ui.minimap.legend.v1` 图例条 **240×14**）；**不合** art hold / VERIFY Draft（#77 / #82 / #108 / #506 等）。薄封装 **`artWorldMinimapSkin`**：`resolveMinimapDestAssetId` / `resolveMinimapLegendAssetId` 供 **CLIENT-139** `drawWorldMinimap` 接线；图例文案仍用 **`MINIMAP_DEST_ETA_LEGEND`** 代码绘制；**`data-art-skin="off"`** 回退 canvas 圆点/纯文字。证据：`docs/art/samples/art-world-minimap-010/`（`INVENTORY.md`、`manifest-index.json`、`hit-proof.json`）。单测：`artWorldMinimapSkin.test.ts`。**不**含世界瓦片/全屏图集。

### ART-UI-FILTER-008 工程挂载（列表筛选 chrome）

从 Draft **#506** @ `38451735` 只读 cherry-pick **9** manifest id / **18** PNG（chip 四态、row 三态 nine-slice、`badge.dot` / `badge.count`）；**不合** #506 / #108 / #77 / #82。运行时薄封装 **`artUiFilterSkin`**：`mountFilterUiSkins` 对 `data-ui-filter-chip` / `data-ui-filter-row` / `data-ui-filter-badge` 接线；chip 精灵 **72×32**、**命中区 CSS ≥44×44**；计数角标 **20×16** 文案 **1–9 / 9+**（`formatFilterBadgeCount`）。**`data-art-skin="off"`** 跳过皮肤。证据：`docs/art/samples/art-ui-filter-008/`（`manifest-index.json`、`hit-proof.json`）。单测：`artUiFilterSkin.test.ts`。

**CLIENT-122（邮件面板）**：在 **CLIENT-121** `artFilterChipRuntime` / `remountPanelFilterChips` 之上，收件箱 **全部 / 未读** 筛选条接 `data-ui-filter-chip` + `badge.count`（count=0 整节点 `hidden`）；`mail-inbox-filter-v1` 记忆 filter（与 **CLIENT-106** 角标推导并存）。列表行 `data-ui-filter-row` + 未读 **dot** / 未领附件 **count**（`formatMailFilterChips` / `formatMailRowCountBadge`）。`HeroMailPanels.mountMailFilterSkins(assets)` 与 `MainCityScene` 全局 `remountPanelFilterChips` 并存。

**CLIENT-143（邮件领取同步）**：`ClaimPlayerMailAttachments` 成功后 `syncMailRowAfterClaim` / `syncMailInboxSnapshotAfterClaim` 即时更新列表 **已领** 态；tab 筛选 chip 与底栏 HUD 待办角标共用 `mailInboxSnapshot` + `countMailUnreadAndUnclaimed`（**CLIENT-106** / **CLIENT-134**）。收件箱主行 **主题 + 未读点**；次行 **`mailRowAttachmentIconSummary` + `formatMailRelativeTime`**；批量领取 **CLIENT-087** 成功行 `mail-claim-pulse`。领取失败 **CLIENT-067** `mail-form-error` + 列表 **CLIENT-129** 骨架不退化。单测：`heroMailState.test.ts`（`syncMailRowAfterClaim`）、`panelDensity.test.ts`、`mailClaimFeedback.test.ts`。

**CLIENT-159（邮件一键批量领取）**：收件箱工具栏 **领取全部附件**（`selectAllUnclaimedMailIds` 筛当前 tab 未领附件，顺序 `ClaimPlayerMailAttachments`）；`batchClaimSummary` 汇总 toast，成功行 `mail-claim-pulse`，失败行 `mail-claim-error` + **CLIENT-067**。`HudTodoBadgePoll.applyMailInboxSnapshot` 与面板 tab / **CLIENT-134** 深链共用 `mailInboxSnapshot` 递减（`mailHudBadgeFacetCounts` / `diffHudTodoMailBadgeCounts`）；单封领取 **CLIENT-143** 不退化。单测：`mailBatchClaim.test.ts`、`hudTodoBadges.test.ts`、`hudTodoBadgePoll.test.ts`、`HeroMailPanels.test.ts`。

**CLIENT-177（邮件分 tab 空态与附件扫读）**：收件箱 **全部 / 未读 / 未领附件** tab（未领附件为 `MAIL_INBOX_FILTER_UNCLAIMED` 客户端过滤 `ListPlayerMail` ALL 快照，不新 RPC）；真空列表 `formatMailTabEmptyHint` 差异化 hint（含 dev 无种子提示）+ **CLIENT-129** `data-panel-state=empty`。有附件行次行 `formatMailAttachmentTypeSweep`（资源/道具图标摘要，只读 attachments metadata）；**CLIENT-159** 批量领取与 HUD 角标 **不退化**。单测：`mailInboxTabFormat.test.ts`、`HeroMailPanels.test.ts`。

**CLIENT-192（邮件领取行内反馈）**：单封 **领取附件** 成功后详情区 `data-role="mail-claim-inline"` 展示 `formatMailClaimSuccessLine`（资源/道具摘要，无新 mail RPC）并触发 `mail-claim-inline-pulse`；列表行仍 `mail-claim-pulse`，HUD 角标走 **CLIENT-162** `applyMailBadgeCountsFromSnapshot`；**CLIENT-177** 分 tab 空态与 **CLIENT-159** 批量领取 **不退化**。单测：`mailClaimFeedback.test.ts`、`HeroMailPanels.test.ts`。

### ART-UI-PANEL-STATE-009 面板态运行时（CLIENT-129）

**`panelStateChrome`**：`resolvePanelStateSkin` 将 **loading / empty / error** 映射 **`ui.panel.loading.v1`** / **`ui.panel.empty.v1`** / **`ui.panel.error.v1`**（CLIENT-128 manifest 就绪时 nine-slice 挂到列表占位行）；邮件 / 日常 / 将领列表 / 建造队列 / 军情 / 战报 **首屏拉取** 与 **筛选空结果** 共用 **`data-panel-state=loading|empty|error`** + **`panel-state-chrome`** class（筛选 chip 与 **CLIENT-029** / wave:27 **`data-ui-filter-chip`** 不退化）。面板或列表祖先设 **`data-art-skin="off"`** 时跳过九宫、保留 **`panelDensity` / CLIENT-067** 纯文案回退。单测：`panelStateChrome.test.ts`。

**CLIENT-230（将领面板 hero 壳运行时挂载）**：将领中心面板根 **`data-art-panel=ui.panel.hero.v1`**（`heroPanelArtMount.resolveHeroPanelArtMount` / `mountHeroPanelArtShell`；manifest `nine_slice` 就绪时 `skinHeroPanel`，否则或 **`data-art-skin="off"`** 时 **`data-art-panel-placeholder`** 占位、不挂纸底）；列表/详情 loading·empty·error 经 **`skimHeroPanelStateChrome`** 与 **CLIENT-129** 统一骨架扫读，**CLIENT-133** 详情养成区不退化；**无**新 hero RPC / **无** IAP。`MainCityScene` → `HeroMailPanels.mountHeroPanelArtShell`；单测：`heroPanelArtMount.test.ts`。

**CLIENT-173（面板网关错误与重试）**：背包 / 商城 / 排行 / 军团 / 建造队列首屏拉取失败时列表占位行共用 **`formatPanelGatewayListError`**（域前缀 + **CLIENT-067** `[code]`）与行内 **`panel-gateway-retry`**（`data-action` 重试刷新）；与 **CLIENT-129** `data-panel-state=error` **并存**。分类 / 筛选 chip 空结果仍走 **`formatPanelEmptyHint`** → **empty** 态，不与 error 混用。单测：`panelGatewayError.test.ts`、`contentFormValidation.test.ts`、`ContentPanels.test.ts`。

**CLIENT-200（军团/聊天空错态扫读）**：成员列表与聊天列表 **empty** 走 **CLIENT-053** `social-list-empty` + **`formatGuildPanelEmptyHint`**；首屏拉取 **gateway error** 走 **CLIENT-173** **`formatGuildChatPanelGatewayListError`**（`formatPanelGatewayError` + 「军团：/聊天：」前缀）与行内 **`guild-chat-retry-inline`**（`retry-refresh-members` / `retry-refresh-chat`，同源刷新 handler，无新 guild RPC）。**CLIENT-185** 职务分组头 / 聊天未读分隔线与 **CLIENT-144** 刷新戳记不退化。单测：`socialFormat.test.ts`、`SocialPanels.test.ts`。

**CLIENT-217（军团在线摘要与聊天退避重试）**：成员列表头 **`formatGuildMemberOnlineSummaryLine`** / **`guild-member-online-summary`** 展示在线/总数（`ListGuildMembers` 同源 `total_count` / `online_count` hint 或成员 `is_online` 计数，无新 RPC）；聊天列表 gateway error 在 **CLIENT-200** 文案与 **`guild-chat-retry-inline`** 基础上叠加 **`guild-chat-backoff-retry`**（指数退避秒数 + `重试 (Ns)` 行内钮）。**CLIENT-161** 未读分隔线与空错态不退化。单测：`socialFormat.test.ts`、`guildChatGatewayBackoff.test.ts`、`SocialPanels.test.ts`。

**CLIENT-234（军团职务头与聊天未读分隔抛光）**：成员职务分组折叠钮 **`aria-label`** 走 **`formatGuildRoleGroupHeaderLine`**（`formatGuildRoleGroupHeaderLabel` + 只读 **`formatGuildRoleGroupCountLabel`**，**CLIENT-185/101** 折叠与 `guild-role-group-count` chip **不退化**，无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-separator`**（与 **CLIENT-185** `chat-unread-separator`、**CLIENT-161** tab/HUD 角标及 **`shouldShowChatUnreadSeparator`** 标为已读可见性 **并存**）。单测：`socialFormat.test.ts`、`chatUnread.test.ts`、`SocialPanels.test.ts`。

**CLIENT-249（军团职务分组头与聊天未读分隔扫读残余）**：职务分组头下 **`formatGuildDutyHeaderResidualLine`** / **`data-role="guild-role-group-header-line"`** 只读残余次行（**CLIENT-234** 折叠钮 **`aria-label`** 与 **`guild-role-group-count`**、**CLIENT-217** **`guild-member-online-summary`** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-sweep`**（与 **CLIENT-234** `guild-chat-unread-separator` 并存），首条未读消息行 **`guild-chat-unread-first-msg-sweep-ring` 1.2s**（**CLIENT-200** 空错态与 **CLIENT-217** 退避重试钮 **不退化**；**非** wave:38 退避主叙事）。单测：`guildDutyHeaderResidual.test.ts`、`guildChatUnreadDividerResidual.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-265（军团职务分组头与聊天未读分隔扫读残余巩固）**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepLine`** / **`guild-duty-header-residual-deep-line`** 只读巩固次行（职务头 + 职务/本组在线计数 + **CLIENT-249** 残余整行对照；**CLIENT-234/249/217** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deep-sweep`**（与 **CLIENT-249** 残余 sweep **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepSweepRing`**：**CLIENT-249** 1.2s 环 + **1.5s** `guild-chat-unread-first-msg-deep-sweep-ring`（**CLIENT-200** 空错态 **不退化**）。单测：`guildDutyHeaderResidualDeep.test.ts`、`guildChatUnreadDividerResidualDeep.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-281（军团职务分组头与聊天未读分隔扫读残余巩固再加深）**：成员职务分组头 **`formatGuildDutyHeaderResidualDeeperLine`** / **`guild-duty-header-residual-deeper-line`** 只读巩固再加深第三行（职务头 + 职务/本组在线计数 + **CLIENT-265** 深行对照；**CLIENT-234/265** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deeper-sweep`**（与 **CLIENT-265** 深扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeeperSweepRing`**：**CLIENT-265** 深环链 + **2s** `guild-chat-unread-first-msg-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:45 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeeper.test.ts`、`guildChatUnreadDividerResidualDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-297（军团职务分组头与聊天未读分隔扫读残余巩固再加深一层）**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestLine`** / **`guild-duty-header-residual-deepest-line`** 只读巩固再加深一层第三行（职务头 + 职务/本组在线计数 + **CLIENT-281** 更深行对照；**CLIENT-234/281** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-sweep`**（与 **CLIENT-281** 更深扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestSweepRing`**：**CLIENT-281** 更深环链 + **2s** `guild-chat-unread-first-msg-deepest-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:47 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepest.test.ts`、`guildChatUnreadDividerResidualDeepest.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**wave:59（CLIENT-385）排行列表密度扫读与招募模板行内摘要残余巩固再加深五层**：三甲密度 **CLIENT-369** `formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine` 第九行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeepestDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deepest-deepest-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深五层** 第十行扫读；**CLIENT-184/305/321/337/353/369** **不退化**；**非** wave:58 **CLIENT-376** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-369** 五层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deepest-deepest-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深五层** 行内摘要；**CLIENT-056/215/337/353/369** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeepestDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1696](https://github.com/anitaguptaoffice/sanguo-slg/issues/1696)）

**wave:57（CLIENT-369）排行列表密度扫读与招募模板行内摘要残余巩固再加深五层**：三甲密度 **CLIENT-353** `formatRankListDensityScanResidualDeepestDeepestDeepestLine` 第八行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deepest-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深五层** 第九行扫读；**CLIENT-184/305/321/337/353** **不退化**；**非** wave:56 **CLIENT-360** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-353** 四层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deepest-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深五层** 行内摘要；**CLIENT-056/215/337/353** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1654](https://github.com/anitaguptaoffice/sanguo-slg/issues/1654)）

**wave:55（CLIENT-353）排行列表密度扫读与招募模板行内摘要残余巩固再加深四层**：三甲密度 **CLIENT-337** `formatRankListDensityScanResidualDeepestDeepestDeeperLine` 第七行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeepestLine`** / **`rank-list-density-scan-residual-deepest-deepest-deepest-line`**（名次变化 + 战力/击杀分数 **巩固再加深四层** 第八行扫读；**CLIENT-184/305/321/337** **不退化**；**非** wave:54 **CLIENT-344** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-337** 三层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeepestSummary`** / **`recruit-template-inline-residual-deepest-deepest-deepest-summary`**（模板 id + 币种余额 **巩固再加深四层** 行内摘要；**CLIENT-056/215/337** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeepest.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeepestSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1612](https://github.com/anitaguptaoffice/sanguo-slg/issues/1612)）

**wave:53（CLIENT-337）排行列表密度扫读与招募模板行内摘要残余巩固再加深三层**：三甲密度 **CLIENT-321** `formatRankListDensityScanResidualDeepestDeeperLine` 第六行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深三层** 第七行扫读；**CLIENT-184/305/321** **不退化**；**非** wave:52 **CLIENT-328** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-321** 二层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深三层** 行内摘要；**CLIENT-056/215/321** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1570](https://github.com/anitaguptaoffice/sanguo-slg/issues/1570)）

**wave:51（CLIENT-321）排行列表密度扫读与招募模板行内摘要残余巩固再加深二层**：三甲密度 **CLIENT-305** `formatRankListDensityScanResidualDeepestLine` 第五行下追加只读 **`formatRankListDensityScanResidualDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深二层** 第六行扫读；**CLIENT-184/305** **不退化**；**非** wave:50 **CLIENT-312** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-305** 一层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深二层** 行内摘要；**CLIENT-056/215** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1537](https://github.com/anitaguptaoffice/sanguo-slg/issues/1537)）

**wave:50（CLIENT-313）军团职务分组头与聊天未读分隔扫读残余巩固再加深二层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deeper-line`** 只读巩固再加深二层第四行（职务头 + 职务/本组在线计数 + **CLIENT-297** 更深一层行对照；**CLIENT-234/297** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deeper-sweep`**（与 **CLIENT-297** 更深一层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRing`**：**CLIENT-297** 更深一层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:49 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1506](https://github.com/anitaguptaoffice/sanguo-slg/issues/1506)）

**wave:52（CLIENT-329）军团职务分组头与聊天未读分隔扫读残余巩固再加深三层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deepest-deeper-line`** 只读巩固再加深三层第四行（职务头 + 职务/本组在线计数 + **CLIENT-313** 更深二层行对照；**CLIENT-234/297/313** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deeper-sweep`**（与 **CLIENT-313** 更深二层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRing`**：**CLIENT-313** 更深二层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:51 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1549](https://github.com/anitaguptaoffice/sanguo-slg/issues/1549)）

**wave:54（CLIENT-345）军团职务分组头与聊天未读分隔扫读残余巩固再加深四层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeepestLine`** / **`guild-duty-header-residual-deepest-deepest-deepest-line`** 只读巩固再加深四层第四行（职务头 + 职务/本组在线计数 + **CLIENT-329** 更深三层行对照；**CLIENT-234/297/313/329** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deepest-sweep`**（与 **CLIENT-329** 更深三层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRing`**：**CLIENT-329** 更深三层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deepest-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:53 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeepestDeepest.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeepest.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1591](https://github.com/anitaguptaoffice/sanguo-slg/issues/1591)）

**wave:56（CLIENT-361）军团职务分组头与聊天未读分隔扫读残余巩固再加深五层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deepest-deepest-deeper-line`** 只读巩固再加深五层第四行（职务头 + 职务/本组在线计数 + **CLIENT-345** 更深四层行对照；**CLIENT-234/297/313/329/345** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deepest-deeper-sweep`**（与 **CLIENT-345** 更深四层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeeperSweepRing`**：**CLIENT-345** 更深四层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:55 世界军情战报邮件商城排行栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeepestDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeepestDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1633](https://github.com/anitaguptaoffice/sanguo-slg/issues/1633)）

**wave:58（CLIENT-377）军团职务分组头与聊天未读分隔扫读残余巩固再加深五层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeepestDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deepest-deepest-deepest-deeper-line`** 只读 wave:58 巩固再加深五层第四行（职务头 + 职务/本组在线计数 + **CLIENT-361** 更深五层行对照；**CLIENT-234/297/313/329/345/361** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deepest-deepest-deeper-sweep`**（与 **CLIENT-361** 更深五层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestDeepestDeeperSweepRing`**：**CLIENT-361** 更深五层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deepest-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:57 世界军情战报邮件商城排行栈主叙事）。1280 manifest：`guild-duty-header-residual-deepest-deepest-deepest-deepest-deepest-line` / `guild-chat-unread-divider-residual-deepest-deepest-deepest-deepest-deepest-sweep`（**CLIENT-377**）。单测：`guildDutyHeaderResidualDeepestDeepestDeepestDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeepestDeepestDeeper.test.ts`、`filterListNarrowManifest.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1675](https://github.com/anitaguptaoffice/sanguo-slg/issues/1675)）

**CLIENT-258（军情 phase 变更扫读与再出征表单预填残余）**：`ListMarches` phase 变化行与选中行军信息卡阶段条叠加 **`intel-phase-change-residual-pulse` 1.5s**（与 **CLIENT-221** `intel-phase-change-flash`、**CLIENT-205** `march-intel-phase-eta-strip`、**CLIENT-220** 小地图互选 **并存**；**非** wave:39 phase 脉冲主叙事重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidual`**，军事面板 **`march-intel-remarch-residual-summary`** 只读展示目标坐标与 **CLIENT-093** 同源兵力摘要（**CLIENT-222/238** 交接与校验戳记 **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualPulse.test.ts`、`marchIntelRemarchResidual.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-274）军情 phase 变更扫读与再出征表单预填残余巩固加深**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-258** `intel-phase-change-residual-pulse` 上叠加 **`intel-phase-change-residual-deep-pulse` 2s** 巩固扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-258** 残余 **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeep`**，军事面板 **`march-intel-remarch-residual-deep-summary`** 只读 **加深** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-258/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepPulse.test.ts`、`marchIntelRemarchResidualDeep.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:47（CLIENT-290）军情 phase 变更扫读与再出征表单预填残余巩固再加深**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-274** `intel-phase-change-residual-deep-pulse` 上叠加 **`intel-phase-change-residual-deeper-pulse` 2s** **巩固再加深**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeeper`**，军事面板 **`march-intel-remarch-residual-deeper-summary`** 只读 **巩固再加深** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-274/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeeperPulse.test.ts`、`marchIntelRemarchResidualDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:49（CLIENT-306）军情 phase 变更扫读与再出征表单预填残余巩固再加深一层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-290** `intel-phase-change-residual-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-pulse` 2s** **巩固再加深一层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepest`**，军事面板 **`march-intel-remarch-residual-deepest-summary`** 只读 **巩固再加深一层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-301** 出征刷新戳记可 stub；**CLIENT-290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestPulse.test.ts`、`marchIntelRemarchResidualDeepest.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:51（CLIENT-322）军情 phase 变更扫读与再出征表单预填残余巩固再加深二层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-306** `intel-phase-change-residual-deepest-pulse` 上叠加 **`intel-phase-change-residual-deepest-deeper-pulse` 2s** **巩固再加深二层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deeper-summary`** 只读 **巩固再加深二层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-317** 出征刷新戳记可 stub；**CLIENT-306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1538](https://github.com/anitaguptaoffice/sanguo-slg/issues/1538)）

**wave:53（CLIENT-338）军情 phase 变更扫读与再出征表单预填残余巩固再加深三层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-322** `intel-phase-change-residual-deepest-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deeper-pulse` 2s** **巩固再加深三层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deeper-summary`** 只读 **巩固再加深三层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-333** 出征刷新戳记可 stub；**CLIENT-322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1571](https://github.com/anitaguptaoffice/sanguo-slg/issues/1571)）

**wave:55（CLIENT-354）军情 phase 变更扫读与再出征表单预填残余巩固再加深四层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-338** `intel-phase-change-residual-deepest-deepest-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deepest-pulse` 2s** **巩固再加深四层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-338/322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeepest`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deepest-summary`** 只读 **巩固再加深四层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-350** 出征刷新戳记可 stub；**CLIENT-338/322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeepestPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeepest.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:57（CLIENT-370）军情 phase 变更扫读与再出征表单预填残余巩固再加深五层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-354** `intel-phase-change-residual-deepest-deepest-deepest-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deepest-deeper-pulse` 2s** **巩固再加深五层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-354/338/322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠；**非** wave:56 主城队列主叙事）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deepest-deeper-summary`** 只读 **巩固再加深五层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-366** 出征刷新戳记可 stub；**CLIENT-354/338/322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1655](https://github.com/anitaguptaoffice/sanguo-slg/issues/1655)）

**wave:59（CLIENT-386）军情 phase 变更扫读与再出征表单预填残余巩固再加深五层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-370** `intel-phase-change-residual-deepest-deepest-deepest-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deepest-deepest-deeper-pulse` 2s** **巩固再加深五层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-370/354/338/322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠；**非** wave:58 主城队列主叙事）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deepest-deepest-deeper-summary`** 只读 **巩固再加深五层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-382** 出征刷新戳记可 stub；**CLIENT-370/354/338/322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1697](https://github.com/anitaguptaoffice/sanguo-slg/issues/1697)）

### ART-UI-FILTER-008 运行时 chip（CLIENT-121）

**`artFilterChipRuntime`** + **`remountPanelFilterChips`**：邮件（全部/未读）、日常四态、战报 outcome 筛选按钮带 **`data-ui-filter-chip`**，主城 **`MainCityScene`** 在面板九宫挂载后接线四态 sprite；选中同步 **`aria-pressed` / `aria-current`** 与 **`.selected`**，**`:focus-visible`** 金环；**`data-art-skin="off"`** 仍走纯文字 chip 且保留 **≥44×44** 命中区。单测：`artFilterChipRuntime.test.ts`（含 `probeFilterChipHitMeetsMin` / `readFilterChipCssMinHit` 探针，不单扫 CSS 字符串）。

**CLIENT-126**（#516）：**`artBadgeSkin`** 集中 dot/count（`ui.badge.dot.v1` / `ui.badge.count.v1`）、`formatBadgeCount` / `applyUiCountBadge`（**n≤0 整节点 `hidden` + class 隐藏**，#108）；底栏 `toolbarBadge`、顶栏待办 count、邮件 tab 附件角标共用；1280 窄屏 manifest count **20×16** 不裁切底栏图标。单测：`artBadgeSkin.test.ts`。

| asset id | 用途 |
|---|---|
| `ui.minimap.dest.v1` / `ui.minimap.legend.v1` | 小地图目的格 marker / 图例条 chrome（**CLIENT-138** `artWorldMinimapSkin`；运行时 **CLIENT-139**） |
| `ui.chip.filter.v1` / `.hover` / `.pressed` / `.selected` | 筛选 chip 四态 sprite |
| `ui.list.row.v1` / `.hover` / `.selected` | 列表行 nine-slice 三态 |
| `ui.badge.dot.v1` | 未读/提示圆点 |
| `ui.badge.count.v1` | 数字角标底图（20×16） |
| `ui.panel.loading.v1` / `.empty` / `.error` | 面板列表区 loading / empty / error 九宫纸底（**CLIENT-128** `artPanelStateSkin`；运行时 **CLIENT-129**） |

技术栈与引擎备选说明见仓库根 [docs/client-engine.md](../docs/client-engine.md)（**当前**为 Vite + TS + Canvas 2D / DOM，非 Cocos）。

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：

**选服列表 → 登录/进服 → 拉城/建城 → 主城（内政/军事/战报/任务/日常/背包/商城/将领/邮件）→ 世界/私聊 → 军团 → 战力排行**

## 当前状态与本地验收

研发按仓库根 [AGENTS.md](../AGENTS.md) 与 [docs/plan/README.md](../docs/plan/README.md) 的垂直切片推进（R0 → R5），历史 wave:11–59 流水账已随 Phase R0 清创移除。

本地门禁：

```bash
cd client
npm ci
npx tsc --noEmit        # 类型检查
npm test                # vitest 单测
npm run build           # 生产构建
node e2e/playable-smoke.mjs   # 真实网关 + 前端可玩冒烟（需要 APP_URL 指向已启动的前端）
```

启动真实网关与前端：仓库根执行 `make dev`；前端单独预览用 `npx vite preview --port 4173`。
