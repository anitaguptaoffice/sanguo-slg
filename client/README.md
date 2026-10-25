# H5 客户端（CLIENT-001 ~ CLIENT-036+）

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

**wave:55（CLIENT-353）排行列表密度扫读与招募模板行内摘要残余巩固再加深四层**：三甲密度 **CLIENT-337** `formatRankListDensityScanResidualDeepestDeepestDeeperLine` 第七行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeepestLine`** / **`rank-list-density-scan-residual-deepest-deepest-deepest-line`**（名次变化 + 战力/击杀分数 **巩固再加深四层** 第八行扫读；**CLIENT-184/305/321/337** **不退化**；**非** wave:54 **CLIENT-344** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-337** 三层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeepestSummary`** / **`recruit-template-inline-residual-deepest-deepest-deepest-summary`**（模板 id + 币种余额 **巩固再加深四层** 行内摘要；**CLIENT-056/215/337** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeepest.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeepestSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1612](https://github.com/anitaguptaoffice/sanguo-slg/issues/1612)）

**wave:53（CLIENT-337）排行列表密度扫读与招募模板行内摘要残余巩固再加深三层**：三甲密度 **CLIENT-321** `formatRankListDensityScanResidualDeepestDeeperLine` 第六行下追加只读 **`formatRankListDensityScanResidualDeepestDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深三层** 第七行扫读；**CLIENT-184/305/321** **不退化**；**非** wave:52 **CLIENT-328** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-321** 二层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深三层** 行内摘要；**CLIENT-056/215/321** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1570](https://github.com/anitaguptaoffice/sanguo-slg/issues/1570)）

**wave:51（CLIENT-321）排行列表密度扫读与招募模板行内摘要残余巩固再加深二层**：三甲密度 **CLIENT-305** `formatRankListDensityScanResidualDeepestLine` 第五行下追加只读 **`formatRankListDensityScanResidualDeepestDeeperLine`** / **`rank-list-density-scan-residual-deepest-deeper-line`**（名次变化 + 战力/击杀分数 **巩固再加深二层** 第六行扫读；**CLIENT-184/305** **不退化**；**非** wave:50 **CLIENT-312** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-305** 一层摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestDeeperSummary`** / **`recruit-template-inline-residual-deepest-deeper-summary`**（模板 id + 币种余额 **巩固再加深二层** 行内摘要；**CLIENT-056/215** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepestDeeper.test.ts`、`recruitTemplateInlineResidualDeepestDeeperSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1537](https://github.com/anitaguptaoffice/sanguo-slg/issues/1537)）

**wave:50（CLIENT-313）军团职务分组头与聊天未读分隔扫读残余巩固再加深二层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deeper-line`** 只读巩固再加深二层第四行（职务头 + 职务/本组在线计数 + **CLIENT-297** 更深一层行对照；**CLIENT-234/297** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deeper-sweep`**（与 **CLIENT-297** 更深一层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeeperSweepRing`**：**CLIENT-297** 更深一层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:49 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1506](https://github.com/anitaguptaoffice/sanguo-slg/issues/1506)）

**wave:52（CLIENT-329）军团职务分组头与聊天未读分隔扫读残余巩固再加深三层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeeperLine`** / **`guild-duty-header-residual-deepest-deepest-deeper-line`** 只读巩固再加深三层第四行（职务头 + 职务/本组在线计数 + **CLIENT-313** 更深二层行对照；**CLIENT-234/297/313** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deeper-sweep`**（与 **CLIENT-313** 更深二层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeeperSweepRing`**：**CLIENT-313** 更深二层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deeper-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:51 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeepestDeeper.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeeper.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1549](https://github.com/anitaguptaoffice/sanguo-slg/issues/1549)）

**wave:54（CLIENT-345）军团职务分组头与聊天未读分隔扫读残余巩固再加深四层**：成员职务分组头 **`formatGuildDutyHeaderResidualDeepestDeepestDeepestLine`** / **`guild-duty-header-residual-deepest-deepest-deepest-line`** 只读巩固再加深四层第四行（职务头 + 职务/本组在线计数 + **CLIENT-329** 更深三层行对照；**CLIENT-234/297/313/329** **不退化**；无新 guild RPC）；聊天未读分隔 `<li>` 叠加 **`guild-chat-unread-divider-residual-deepest-deepest-deepest-sweep`**（与 **CLIENT-329** 更深三层扫读 **并存**），首条未读 **`scheduleGuildChatUnreadFirstMsgDeepestDeepestDeepestSweepRing`**：**CLIENT-329** 更深三层环链 + **2.5s** `guild-chat-unread-first-msg-deepest-deepest-deepest-sweep-ring`（**CLIENT-200** 空错态 **不退化**；**非** wave:53 世界军情战报邮件商城栈主叙事）。单测：`guildDutyHeaderResidualDeepestDeepestDeepest.test.ts`、`guildChatUnreadDividerResidualDeepestDeepestDeepest.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1591](https://github.com/anitaguptaoffice/sanguo-slg/issues/1591)）

**CLIENT-258（军情 phase 变更扫读与再出征表单预填残余）**：`ListMarches` phase 变化行与选中行军信息卡阶段条叠加 **`intel-phase-change-residual-pulse` 1.5s**（与 **CLIENT-221** `intel-phase-change-flash`、**CLIENT-205** `march-intel-phase-eta-strip`、**CLIENT-220** 小地图互选 **并存**；**非** wave:39 phase 脉冲主叙事重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidual`**，军事面板 **`march-intel-remarch-residual-summary`** 只读展示目标坐标与 **CLIENT-093** 同源兵力摘要（**CLIENT-222/238** 交接与校验戳记 **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualPulse.test.ts`、`marchIntelRemarchResidual.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-274）军情 phase 变更扫读与再出征表单预填残余巩固加深**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-258** `intel-phase-change-residual-pulse` 上叠加 **`intel-phase-change-residual-deep-pulse` 2s** 巩固扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-258** 残余 **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeep`**，军事面板 **`march-intel-remarch-residual-deep-summary`** 只读 **加深** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-258/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepPulse.test.ts`、`marchIntelRemarchResidualDeep.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:47（CLIENT-290）军情 phase 变更扫读与再出征表单预填残余巩固再加深**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-274** `intel-phase-change-residual-deep-pulse` 上叠加 **`intel-phase-change-residual-deeper-pulse` 2s** **巩固再加深**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeeper`**，军事面板 **`march-intel-remarch-residual-deeper-summary`** 只读 **巩固再加深** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-274/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeeperPulse.test.ts`、`marchIntelRemarchResidualDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:49（CLIENT-306）军情 phase 变更扫读与再出征表单预填残余巩固再加深一层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-290** `intel-phase-change-residual-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-pulse` 2s** **巩固再加深一层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepest`**，军事面板 **`march-intel-remarch-residual-deepest-summary`** 只读 **巩固再加深一层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-301** 出征刷新戳记可 stub；**CLIENT-290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestPulse.test.ts`、`marchIntelRemarchResidualDeepest.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:51（CLIENT-322）军情 phase 变更扫读与再出征表单预填残余巩固再加深二层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-306** `intel-phase-change-residual-deepest-pulse` 上叠加 **`intel-phase-change-residual-deepest-deeper-pulse` 2s** **巩固再加深二层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deeper-summary`** 只读 **巩固再加深二层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-317** 出征刷新戳记可 stub；**CLIENT-306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1538](https://github.com/anitaguptaoffice/sanguo-slg/issues/1538)）

**wave:53（CLIENT-338）军情 phase 变更扫读与再出征表单预填残余巩固再加深三层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-322** `intel-phase-change-residual-deepest-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deeper-pulse` 2s** **巩固再加深三层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeeper`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deeper-summary`** 只读 **巩固再加深三层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-333** 出征刷新戳记可 stub；**CLIENT-322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeeper.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1571](https://github.com/anitaguptaoffice/sanguo-slg/issues/1571)）

**wave:55（CLIENT-354）军情 phase 变更扫读与再出征表单预填残余巩固再加深四层**：`ListMarches` phase 变化行与选中行军信息卡阶段条在 **CLIENT-338** `intel-phase-change-residual-deepest-deepest-deeper-pulse` 上叠加 **`intel-phase-change-residual-deepest-deepest-deepest-pulse` 2s** **巩固再加深四层**同步扫读（**CLIENT-221** flash、**CLIENT-220** 小地图互选、**CLIENT-338/322/306/290/274/258** **不退化**；**非** wave:39 phase 主脉冲重复堆叠）。军情行 **再出征** 走 **`prefillMarchFormFromIntelResidualDeepestDeepestDeepest`**，军事面板 **`march-intel-remarch-residual-deepest-deepest-deepest-summary`** 只读 **巩固再加深四层** 目标坐标/兵力摘要（可附带 **CLIENT-253** 底栏余量 hint；**CLIENT-350** 出征刷新戳记可 stub；**CLIENT-338/322/306/290/253** **不退化**；**无** CancelMarch）。单测：`marchIntelPhaseChangeResidualDeepestDeepestDeepestPulse.test.ts`、`marchIntelRemarchResidualDeepestDeepestDeepest.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

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
| **HUD 角标点击深链** | [手动验收（HUD 角标深链 CLIENT-038）](#手动验收hud-角标深链-client-038)（[#250](https://github.com/anitaguptaoffice/sanguo-slg/issues/250) / [#258](https://github.com/anitaguptaoffice/sanguo-slg/pull/258) `30c95e2a`）；**CLIENT-134** 队列建造中 + 筛选 chip 对齐见 [CLIENT-134](#手动验收hud-资源条与待办角标深链-client-134) | 已合 |
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

波次总览与 **DOCS-EXIT-016**（[#443](https://github.com/anitaguptaoffice/sanguo-slg/issues/443) / [#457](https://github.com/anitaguptaoffice/sanguo-slg/pull/457) `d1c517db`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 24」。**wave:25** 主城队列·邮件日常·世界读图加深见下文 [Wave 25](#wave-25-h5-主城队列邮件日常世界读图加深m4-出口--intg-022)。

## Wave 25 H5 主城队列·邮件日常·世界读图加深（M4 出口 / INTG-022）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-022** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC）；募兵队列 **加速**；主城建造/募兵 **新 RPC**；战报 proto 扩量；**永不合并** art hold PR #77/#82/#108/#100/#126 及 VERIFY [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481)。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城槽位建造/升级提交反馈** | [建造消耗预览 CLIENT-082](#手动验收建造消耗预览-client-082) 内 **CLIENT-104**（[#460](https://github.com/anitaguptaoffice/sanguo-slg/issues/460) / [#471](https://github.com/anitaguptaoffice/sanguo-slg/pull/471) `7959d209`） | 已合 |
| **建造队列完成脉冲与槽位互高亮** | [手动验收（建造队列完成脉冲 CLIENT-105）](#手动验收建造队列完成脉冲-client-105)（[#461](https://github.com/anitaguptaoffice/sanguo-slg/issues/461) / [#476](https://github.com/anitaguptaoffice/sanguo-slg/pull/476) `dc0a3ba0`） | 已合 |
| **邮件未读/未领附件 tab 角标** | [手动验收（邮件面板 tab 角标 CLIENT-106）](#手动验收邮件面板-tab-角标-client-106)（[#462](https://github.com/anitaguptaoffice/sanguo-slg/issues/462) / [#474](https://github.com/anitaguptaoffice/sanguo-slg/pull/474) `3a43d2b4`） | 已合 |
| **HUD 邮件/日常/队列待办角标一致** | [手动验收（HUD 待办角标单一事实源 CLIENT-107）](#手动验收hud-待办角标单一事实源-client-107)（[#463](https://github.com/anitaguptaoffice/sanguo-slg/issues/463) / [#480](https://github.com/anitaguptaoffice/sanguo-slg/pull/480) `bb402f94`） | 已合 |
| **世界格点城池/资源点信息卡加深** | [手动验收（世界格点信息卡 CLIENT-073）](#手动验收世界格点信息卡-client-073) + [CLIENT-108 加深](#手动验收世界格点信息卡加深-client-108)（[#464](https://github.com/anitaguptaoffice/sanguo-slg/issues/464) / [#478](https://github.com/anitaguptaoffice/sanguo-slg/pull/478) `5b984854`） | 已合 |
| **军情筛选记忆与战报复盘互链** | [手动验收（军情战报筛选记忆 CLIENT-109）](#手动验收军情战报筛选记忆-client-109)（[#465](https://github.com/anitaguptaoffice/sanguo-slg/issues/465) / [#477](https://github.com/anitaguptaoffice/sanguo-slg/pull/477) `afb8861b`） | 已合 |
| **ART-CHROME-006 运行时 UX** | [ART-CHROME-006 运行时 UX（CLIENT-110）](#art-chrome-006-运行时-uxclient-110)（[#466](https://github.com/anitaguptaoffice/sanguo-slg/issues/466) / [#479](https://github.com/anitaguptaoffice/sanguo-slg/pull/479) `683a4bb6`；对比度工程 [#473](https://github.com/anitaguptaoffice/sanguo-slg/pull/473)） | 已合 |
| **1280 主城/邮件/队列 manifest** | [手动验收（1280 主城建造/邮件/队列 CLIENT-111）](#手动验收1280-主城建造邮件队列-client-111)（[#467](https://github.com/anitaguptaoffice/sanguo-slg/issues/467) / [#475](https://github.com/anitaguptaoffice/sanguo-slg/pull/475) `e722a9b6`） | 已合 |
| **网关冒烟**（建造队列 + 邮件未读 + 日常可领 + 格点） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 25** / `TestINTG022Wave25SmokePath`（[#468](https://github.com/anitaguptaoffice/sanguo-slg/issues/468) / [#472](https://github.com/anitaguptaoffice/sanguo-slg/pull/472) `d43f7777`） | 已合 |

**推荐串联**（在 [Wave 24](#wave-24-h5-社交排行与将领执行反馈加深m4-出口--intg-021) 排行/将领/社交 manifest 基础上）：画布槽位 **确认升级** 提交反馈（**CLIENT-104**）→ **队列** 完成脉冲与槽位互高亮（**CLIENT-105**）→ **邮件** 未读/附件 tab 角标（**CLIENT-106**）与 **HUD** 待办单一事实源（**CLIENT-107**）→ **世界** 格点信息卡加深（**CLIENT-108**）→ **行军/战报** 筛选记忆与世界复盘互链（**CLIENT-109**）→ **选服/HUD chrome** 焦点与窄屏工具栏（**CLIENT-110**）→ 视口 **1280×720** 主城/邮件/队列 manifest（**CLIENT-111**）；网关字段见 `tools/smoke/README.md` **INTG-022**。

**wave:19 美术轨旁路**（**非** wave:25 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:25 backlog 实现卡）。实现卡 **CLIENT-104** 起，**勿占用 CLIENT-064**。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-017**（[#469](https://github.com/anitaguptaoffice/sanguo-slg/issues/469) / [#483](https://github.com/anitaguptaoffice/sanguo-slg/pull/483) `5752072e`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 25」。**wave:26** 背包商城·招募养成·出征募兵反馈加深见下文 [Wave 26](#wave-26-h5-背包商城招募养成出征募兵反馈加深m4-出口--intg-023)。

## Wave 26 H5 背包商城·招募养成·出征募兵反馈加深（M4 出口 / INTG-023）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-023** 网关冒烟一致）。**范围外**同 Wave 25；**永不合并** art hold / VERIFY Draft（含 [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **背包道具使用/批量使用提交脉冲** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020) 第 6 步 **CLIENT-112**（[#486](https://github.com/anitaguptaoffice/sanguo-slg/issues/486) / [#498](https://github.com/anitaguptaoffice/sanguo-slg/pull/498) `68a687de`） | 已合 |
| **商城购买提交与钱包扣费脉冲** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020) 第 5 步 **CLIENT-113**（[#487](https://github.com/anitaguptaoffice/sanguo-slg/issues/487) / [#501](https://github.com/anitaguptaoffice/sanguo-slg/pull/501) `2b0702d4`） | 已合 |
| **将领招募提交反馈巩固** | [手动验收（将领招募提交反馈巩固 CLIENT-114）](#手动验收将领招募提交反馈巩固-client-114)（[#488](https://github.com/anitaguptaoffice/sanguo-slg/issues/488) / [#497](https://github.com/anitaguptaoffice/sanguo-slg/pull/497) `11a68ff4`） | 已合 |
| **将领详情养成道具使用执行反馈** | [手动验收（将领详情养成道具使用反馈 CLIENT-115）](#手动验收将领详情养成道具使用反馈-client-115)（[#489](https://github.com/anitaguptaoffice/sanguo-slg/issues/489) / [#504](https://github.com/anitaguptaoffice/sanguo-slg/pull/504) `bfac0925`） | 已合 |
| **出征提交反馈巩固与新行军 ETA** | [手动验收（出征提交反馈 CLIENT-080）](#手动验收出征提交反馈-client-080) **CLIENT-116**（[#490](https://github.com/anitaguptaoffice/sanguo-slg/issues/490) / [#505](https://github.com/anitaguptaoffice/sanguo-slg/pull/505) `d4ea2d8d`） | 已合 |
| **募兵提交执行反馈与队列行脉冲** | [手动验收（募兵消耗预览 CLIENT-088）](#手动验收募兵消耗预览-client-088) **CLIENT-117**（[#491](https://github.com/anitaguptaoffice/sanguo-slg/issues/491) / [#500](https://github.com/anitaguptaoffice/sanguo-slg/pull/500) `314a6396`） | 已合 |
| **ART-TOOLBAR-ICONS-007 底栏四态运行时接线** | [ART-TOOLBAR-ICONS-007 运行时 UX（CLIENT-118）](#art-toolbar-icons-007-运行时-uxclient-118)（[#492](https://github.com/anitaguptaoffice/sanguo-slg/issues/492) / [#503](https://github.com/anitaguptaoffice/sanguo-slg/pull/503) `cabe8f0a`） | 已合 |
| **1280 背包/商城/招募/军事 manifest** | [手动验收（1280 背包商城招募军事 CLIENT-119）](#手动验收1280-背包商城招募军事-client-119)（[#493](https://github.com/anitaguptaoffice/sanguo-slg/issues/493) / [#502](https://github.com/anitaguptaoffice/sanguo-slg/pull/502) `a36c1ae6`） | 已合 |
| **网关冒烟**（背包堆叠 + 商城扣费 + 将领详情 + 募兵 + 行军 phase） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 26** / `TestINTG023Wave26SmokePath`（[#494](https://github.com/anitaguptaoffice/sanguo-slg/issues/494) / [#499](https://github.com/anitaguptaoffice/sanguo-slg/pull/499) `92a96489`） | 已合 |

**推荐串联**（在 [Wave 25](#wave-25-h5-主城队列邮件日常世界读图加深m4-出口--intg-022) 主城/邮件/队列 manifest 基础上）：**背包** 使用/批量提交脉冲（**CLIENT-112**）→ **商城** 购买提交与扣费脉冲（**CLIENT-113**）→ **将领** 招募提交巩固（**CLIENT-114**）与详情养成道具使用（**CLIENT-115**）→ **军事** 出征提交巩固（**CLIENT-116**）与募兵提交脉冲（**CLIENT-117**）→ 底栏 **ART-TOOLBAR-ICONS-007** 四态图标（**CLIENT-118**）→ 视口 **1280×720** 背包/商城/招募/军事 manifest（**CLIENT-119**）；网关字段见 `tools/smoke/README.md` **INTG-023**。

**wave:19 美术轨旁路**（**非** wave:26 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:26 backlog 实现卡）。实现卡 **CLIENT-112** 起，**勿占用 CLIENT-064**。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-018**（[#495](https://github.com/anitaguptaoffice/sanguo-slg/issues/495) / [#507](https://github.com/anitaguptaoffice/sanguo-slg/pull/507) `6c9d66cd`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 26」。**wave:27** 筛选列表·邮件日常军情战报可读加深见下文 [Wave 27](#wave-27-h5-筛选列表邮件日常军情战报可读加深m4-出口--intg-024)。

## Wave 27 H5 筛选列表·邮件日常军情战报可读加深（M4 出口 / INTG-024）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-024** 网关冒烟一致）。**范围外**同 Wave 26；**永不合并** art hold / VERIFY Draft（含 [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **ART-UI-FILTER-008 工程挂载** | [ART-UI-FILTER-008 工程挂载（列表筛选 chrome）](#art-ui-filter-008-工程挂载列表筛选-chrome) **CLIENT-120**（[#510](https://github.com/anitaguptaoffice/sanguo-slg/issues/510) / [#509](https://github.com/anitaguptaoffice/sanguo-slg/pull/509) `50e052f0`） | 已合 |
| **筛选 chip 运行时（≥44px）** | [ART-UI-FILTER-008 运行时 chip（CLIENT-121）](#art-ui-filter-008-运行时-chipclient-121)（[#511](https://github.com/anitaguptaoffice/sanguo-slg/issues/511) / [#524](https://github.com/anitaguptaoffice/sanguo-slg/pull/524) `4edacef9`） | 已合 |
| **邮件筛选/行/角标可读** | 上文 **CLIENT-122** + [邮件收件箱](#邮件收件箱)（[#512](https://github.com/anitaguptaoffice/sanguo-slg/issues/512) / [#528](https://github.com/anitaguptaoffice/sanguo-slg/pull/528) `b15449a3`） | 已合 |
| **日常筛选/行/角标可读** | [日常任务](#日常任务) **CLIENT-123**（[#513](https://github.com/anitaguptaoffice/sanguo-slg/issues/513) / [#525](https://github.com/anitaguptaoffice/sanguo-slg/pull/525) `e86375f7`） | 已合 |
| **军情筛选/行可读** | [行军列表](#行军列表) **CLIENT-124**（[#514](https://github.com/anitaguptaoffice/sanguo-slg/issues/514) / [#522](https://github.com/anitaguptaoffice/sanguo-slg/pull/522) `32f195cc`） | 已合 |
| **战报筛选/行可读** | [战报列表](#战报列表) **CLIENT-125**（[#515](https://github.com/anitaguptaoffice/sanguo-slg/issues/515) / [#523](https://github.com/anitaguptaoffice/sanguo-slg/pull/523) `2cff59f0`） | 已合 |
| **badge.dot/count 统一** | **CLIENT-126**（[#516](https://github.com/anitaguptaoffice/sanguo-slg/issues/516) / [#526](https://github.com/anitaguptaoffice/sanguo-slg/pull/526) `d1424a39`）；见 [ART-UI-FILTER-008 运行时 chip](#art-ui-filter-008-运行时-chipclient-121) | 已合 |
| **1280 筛选列表 manifest** | [手动验收（1280 邮件/日常/军情/战报筛选列表 CLIENT-127）](#手动验收1280-邮件日常军情战报筛选列表-client-127)（[#517](https://github.com/anitaguptaoffice/sanguo-slg/issues/517) / [#527](https://github.com/anitaguptaoffice/sanguo-slg/pull/527) `8c45fa1a`） | 已合 |
| **网关冒烟**（邮件未读/附件 + 日常可领 + 军情 phase + 战报 outcome） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 27** / `TestINTG024Wave27SmokePath`（[#518](https://github.com/anitaguptaoffice/sanguo-slg/issues/518) / [#521](https://github.com/anitaguptaoffice/sanguo-slg/pull/521) `aa64edb2`） | 已合 |

**推荐串联**（在 [Wave 26](#wave-26-h5-背包商城招募养成出征募兵反馈加深m4-出口--intg-023) 经济军事 manifest 基础上）：**ART-UI-FILTER-008** 资产工程挂载（**CLIENT-120**）→ 全局 **`remountPanelFilterChips`**（**CLIENT-121**）→ **`artBadgeSkin`** dot/count（**CLIENT-126**）→ **邮件** / **日常** / **军情** / **战报** 各面板筛选 chip + 列表行九宫（**CLIENT-122**～**125**）→ 视口 **1280×720** 四面板筛选条与列表 manifest（**CLIENT-127**）；网关字段见 `tools/smoke/README.md` **INTG-024**。

**wave:19 美术轨旁路**（**非** wave:27 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:27 backlog 实现卡）。实现卡 **CLIENT-120** 起，**勿占用 CLIENT-064**。**永不合并** art hold **#77** / **#82** / **#108**。

波次总览与 **DOCS-EXIT-019**（[#519](https://github.com/anitaguptaoffice/sanguo-slg/issues/519) / [#529](https://github.com/anitaguptaoffice/sanguo-slg/pull/529) `bb4437e4`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 27」。**wave:28** 主城七槽·将领养成·HUD 深链·面板态可读加深见 [Wave 28](#wave-28-h5-主城七槽将领养成hud深链面板态可读加深m4-出口--intg-025)；**wave:29** 世界行军互链·军情战报复盘·邮件社交扫读加深见 [Wave 29](#wave-29-h5-世界行军互链军情战报复盘邮件社交扫读加深m4-出口--intg-026)。

## Wave 28 H5 主城七槽·将领养成·HUD 深链·面板态可读加深（M4 出口 / INTG-025）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-025** 网关冒烟一致）。**范围外**同 Wave 27；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **ART-UI-PANEL-STATE-009 工程挂载** | [ART-UI-PANEL-STATE-009 工程挂载（面板 loading/empty/error 纸底）](#art-ui-panel-state-009-工程挂载面板-loadingemptyerror-纸底) **CLIENT-128**（[#532](https://github.com/anitaguptaoffice/sanguo-slg/issues/532) / [#551](https://github.com/anitaguptaoffice/sanguo-slg/pull/551) `f900255b`） | 已合 |
| **面板 loading/empty/error 统一** | [ART-UI-PANEL-STATE-009 面板态运行时（CLIENT-129）](#art-ui-panel-state-009-面板态运行时client-129)（[#533](https://github.com/anitaguptaoffice/sanguo-slg/issues/533) / [#549](https://github.com/anitaguptaoffice/sanguo-slg/pull/549) `bbed304f`） | 已合 |
| **主城七槽等级/ETA 扫读与队列深链** | [手动验收（主城七槽等级与升级 ETA 扫读 CLIENT-130）](#手动验收主城七槽等级与升级-eta-扫读-client-130)（[#534](https://github.com/anitaguptaoffice/sanguo-slg/issues/534) / [#544](https://github.com/anitaguptaoffice/sanguo-slg/pull/544) `68bafda8`） | 已合 |
| **建造队列七槽状态矩阵与互跳** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019) 内 **CLIENT-131**（[#535](https://github.com/anitaguptaoffice/sanguo-slg/issues/535) / [#548](https://github.com/anitaguptaoffice/sanguo-slg/pull/548) `aab1b10f`） | 已合 |
| **将领列表等级/忠诚扫读** | [手动验收（将领列表行扫读 CLIENT-132）](#手动验收将领列表行扫读-client-132)（[#536](https://github.com/anitaguptaoffice/sanguo-slg/issues/536) / [#550](https://github.com/anitaguptaoffice/sanguo-slg/pull/550) `862592e1`） | 已合 |
| **将领详情忠诚养成与背包深链** | [手动验收（将领详情忠诚养成深链 CLIENT-133）](#手动验收将领详情忠诚养成深链-client-133)（[#537](https://github.com/anitaguptaoffice/sanguo-slg/issues/537) / [#546](https://github.com/anitaguptaoffice/sanguo-slg/pull/546) `aee4ad93`） | 已合 |
| **HUD 资源条与待办角标深链一致** | [手动验收（HUD 资源条与待办角标深链 CLIENT-134）](#手动验收hud-资源条与待办角标深链-client-134)（[#538](https://github.com/anitaguptaoffice/sanguo-slg/issues/538) / [#547](https://github.com/anitaguptaoffice/sanguo-slg/pull/547) `735f4670`） | 已合 |
| **面板内键盘焦点 + 1280 主城将领 HUD manifest** | [手动验收（1280 主城将领 HUD manifest CLIENT-135）](#手动验收1280-主城将领-hud-manifest-client-135)（[#539](https://github.com/anitaguptaoffice/sanguo-slg/issues/539) / [#553](https://github.com/anitaguptaoffice/sanguo-slg/pull/553) `747c0505`） | 已合 |
| **网关冒烟**（七槽 `level`/ETA + 将领 level/loyalty + 待办字段） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 28** / `TestINTG025Wave28SmokePath`（[#540](https://github.com/anitaguptaoffice/sanguo-slg/issues/540) / [#545](https://github.com/anitaguptaoffice/sanguo-slg/pull/545) `508a7ac2`） | 已合 |

**推荐串联**（在 [Wave 27](#wave-27-h5-筛选列表邮件日常军情战报可读加深m4-出口--intg-024) 筛选列表 manifest 基础上）：**ART-UI-PANEL-STATE-009** 工程挂载（**CLIENT-128**）→ 各面板 **`panelStateChrome`** loading/empty/error（**CLIENT-129**）→ 画布 **七槽 overlay** 扫读与队列深链（**CLIENT-130**）→ **队列** 七槽状态矩阵互跳（**CLIENT-131**）→ **将领** 列表行扫读（**CLIENT-132**）与详情养成背包深链（**CLIENT-133**）→ 顶栏/底栏 **HUD 待办深链** 与筛选 chip 一致（**CLIENT-134**）→ 视口 **1280×720** 主城/将领/HUD manifest + 面板 **Tab/Esc/↑↓** 焦点（**CLIENT-135**）；网关字段见 `tools/smoke/README.md` **INTG-025**。

**wave:19 美术轨旁路**（**非** wave:28 backlog 实现卡）：**CLIENT-063**（[#336](https://github.com/anitaguptaoffice/sanguo-slg/issues/336) / [#345](https://github.com/anitaguptaoffice/sanguo-slg/pull/345) `8b34edd1`）**已合**；**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）wave:19 美术旁路（**非** wave:28 backlog 实现卡）。实现卡 **CLIENT-128** 起，**勿占用 CLIENT-064**。**永不合并** art hold **#77** / **#82** / **#108**。

**工程修**（**非** wave:28 backlog 实现卡）：**CLIENT-136**（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb`）ART-UI-FILTER-008 纸底字色/chip 视觉槽与冻结证据补齐（联调修正）。

波次总览与 **DOCS-EXIT-020**（[#541](https://github.com/anitaguptaoffice/sanguo-slg/issues/541) / [#555](https://github.com/anitaguptaoffice/sanguo-slg/pull/555) `9ef14ce6`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 28」。实现末卡 tip **`747c0505`**（#553 CLIENT-135）。

## Wave 29 H5 世界行军互链·军情战报复盘·邮件社交扫读加深（M4 出口 / INTG-026）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-026** 网关冒烟一致）。**范围外**同 Wave 28；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **ART-WORLD-MINIMAP-010 工程挂载** | [ART-WORLD-MINIMAP-010 工程挂载（小地图目的点 / 图例 chrome）](#art-world-minimap-010-工程挂载小地图目的点--图例-chrome) **CLIENT-138**（[#558](https://github.com/anitaguptaoffice/sanguo-slg/issues/558) / [#575](https://github.com/anitaguptaoffice/sanguo-slg/pull/575) `a36dd072`） | 已合 |
| **小地图行军 ETA 与出征坐标互链** | [手动验收（小地图出征互链巩固 CLIENT-139）](#手动验收小地图出征互链巩固-client-139)（[#559](https://github.com/anitaguptaoffice/sanguo-slg/issues/559) / [#570](https://github.com/anitaguptaoffice/sanguo-slg/pull/570) `dff8936f`） | 已合 |
| **世界信息卡↔军情军事深链** | [手动验收（世界信息卡↔军情军事深链 CLIENT-140）](#手动验收世界信息卡军情军事深链-client-140)（[#560](https://github.com/anitaguptaoffice/sanguo-slg/issues/560) / [#571](https://github.com/anitaguptaoffice/sanguo-slg/pull/571) `75c0f953`） | 已合 |
| **军情 ETA 次行密度与 phase 扫读** | [军情战报筛选记忆 CLIENT-109](#手动验收军情战报筛选记忆-client-109) 内 **CLIENT-141**（[#561](https://github.com/anitaguptaoffice/sanguo-slg/issues/561) / [#572](https://github.com/anitaguptaoffice/sanguo-slg/pull/572) `6632a203`） | 已合 |
| **战报坐标复盘与小地图跳转** | [战报坐标与小地图复盘 CLIENT-042](#手动验收战报坐标与小地图复盘-client-042) 深化 **CLIENT-142**（[#562](https://github.com/anitaguptaoffice/sanguo-slg/issues/562) / [#569](https://github.com/anitaguptaoffice/sanguo-slg/pull/569) `bd3b30dd`） | 已合 |
| **邮件领取同步与收件箱密度** | 上文 [CLIENT-143（邮件领取同步）](#art-ui-filter-008-工程挂载列表筛选-chrome)（[#563](https://github.com/anitaguptaoffice/sanguo-slg/issues/563) / [#576](https://github.com/anitaguptaoffice/sanguo-slg/pull/576) `63000d8a`） | 已合 |
| **军团/聊天刷新扫读** | [手动验收（社交刷新戳记与角标同步 CLIENT-144）](#手动验收社交刷新戳记与角标同步-client-144)（[#564](https://github.com/anitaguptaoffice/sanguo-slg/issues/564) / [#573](https://github.com/anitaguptaoffice/sanguo-slg/pull/573) `deeb5e39`） | 已合 |
| **军事表单校验 + 1280 世界军情战报社交 manifest** | [手动验收（1280 世界军情战报社交 CLIENT-145）](#手动验收1280-世界军情战报社交-client-145)（[#565](https://github.com/anitaguptaoffice/sanguo-slg/issues/565) / [#577](https://github.com/anitaguptaoffice/sanguo-slg/pull/577) `f60e3e95`） | 已合 |
| **网关冒烟**（行军格点 ETA + 战报坐标 + 邮件附件 + 世界城池） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 29** / `TestINTG026Wave29SmokePath`（[#566](https://github.com/anitaguptaoffice/sanguo-slg/issues/566) / [#568](https://github.com/anitaguptaoffice/sanguo-slg/pull/568) `71537297`） | 已合 |

**推荐串联**（在 [Wave 28](#wave-28-h5-主城七槽将领养成hud深链面板态可读加深m4-出口--intg-025) 面板态与 HUD 深链基础上）：**ART-WORLD-MINIMAP-010** 工程挂载（**CLIENT-138**，可选）→ 小地图 **目的 ETA 角标** 与军事表单 **坐标互链**（**CLIENT-139**）→ 世界 **信息卡↔军情** 一步深链（**CLIENT-140**）→ 军情列表 **次行 ETA/phase 脉冲**（**CLIENT-141**）→ 战报 **坐标复盘→小地图**（**CLIENT-142**）→ 邮件 **领取同步** 与行密度（**CLIENT-143**）→ 军团/聊天 **刷新戳记**（**CLIENT-144**）→ **军事目标记忆/表单校验** + 视口 **1280×720** 世界·军情·战报·社交 manifest（**CLIENT-145**）；网关字段见 `tools/smoke/README.md` **INTG-026**。

**工程修 / 美术旁路**（**非** wave:29 backlog 实现卡）：**CLIENT-136**（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb`）已合；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574) `36c69009`）FILTER-008 冻结补证；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579) `4f5a9732`）FILTER-008 日常行条跟进。

**wave:19 美术轨旁路**（**非** wave:29 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）——**非**本波 backlog 实现卡。实现卡 **CLIENT-138** 起，**勿占用 CLIENT-136/137**。

波次总览与 **DOCS-EXIT-021**（[#567](https://github.com/anitaguptaoffice/sanguo-slg/issues/567) / [#581](https://github.com/anitaguptaoffice/sanguo-slg/pull/581) `924a2834`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 29」。实现末卡 tip **`f60e3e95`**（#577 CLIENT-145）；全收口 **`924a2834`**.

## Wave 30 H5 主城产出仓库·日常领取闭环·将领列表筛选扫读·双榜刷新加深（M4 出口 / INTG-027）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-027** 网关冒烟一致）。**范围外**同 Wave 29；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **HUD 产出速率与仓库余量扫读巩固** | [手动验收（HUD 经济扫读 CLIENT-148）](#手动验收hud-经济扫读-client-148)（[#584](https://github.com/anitaguptaoffice/sanguo-slg/issues/584) / [#601](https://github.com/anitaguptaoffice/sanguo-slg/pull/601) `873b8158`） | 已合 |
| **建造·募兵队列完成脉冲与七槽互跳** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019) 内 **CLIENT-149**（[#585](https://github.com/anitaguptaoffice/sanguo-slg/issues/585) / [#598](https://github.com/anitaguptaoffice/sanguo-slg/pull/598) `8ef18b2d`） | 已合 |
| **日常可领批量/首条定位与 chain 进度** | [手动验收（日常可领取定位 CLIENT-091）](#手动验收日常可领取定位-client-091) 内 **CLIENT-150**（[#586](https://github.com/anitaguptaoffice/sanguo-slg/issues/586) / [#603](https://github.com/anitaguptaoffice/sanguo-slg/pull/603) `e34a2315`） | 已合 |
| **将领列表筛选排序记忆扫读** | [手动验收（将领列表筛选排序记忆 CLIENT-151）](#手动验收将领列表筛选排序记忆-client-151)（[#587](https://github.com/anitaguptaoffice/sanguo-slg/issues/587) / [#600](https://github.com/anitaguptaoffice/sanguo-slg/pull/600) `197d3492`） | 已合 |
| **双榜我的排名刷新跳动与钉选** | [手动验收（排行双榜 CLIENT-021）](#手动验收排行双榜-client-021) 内 **CLIENT-152**（[#588](https://github.com/anitaguptaoffice/sanguo-slg/issues/588) / [#596](https://github.com/anitaguptaoffice/sanguo-slg/pull/596) `e910be27`） | 已合 |
| **背包分类 tab 与堆叠数量扫读** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020) 第 8 步 **CLIENT-153**（[#589](https://github.com/anitaguptaoffice/sanguo-slg/issues/589) / [#597](https://github.com/anitaguptaoffice/sanguo-slg/pull/597) `bc5fe88a`） | 已合 |
| **商城货币不足行内态** | 同上第 9 步 **CLIENT-154**（[#590](https://github.com/anitaguptaoffice/sanguo-slg/issues/590) / [#599](https://github.com/anitaguptaoffice/sanguo-slg/pull/599) `d48a8520`） | 已合 |
| **1280 主城产出·日常·将领·排行组合 manifest** | [手动验收（1280 wave:30 组合 manifest CLIENT-155）](#手动验收1280-wave30-组合-manifest-client-155)（[#591](https://github.com/anitaguptaoffice/sanguo-slg/issues/591) / [#602](https://github.com/anitaguptaoffice/sanguo-slg/pull/602) `6978ebac`） | 已合 |
| **网关冒烟**（产出余量 + 日常进度 + 将领 + 双榜 + 背包堆叠） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 30** / `TestINTG027Wave30SmokePath`（[#592](https://github.com/anitaguptaoffice/sanguo-slg/issues/592) / [#595](https://github.com/anitaguptaoffice/sanguo-slg/pull/595) `ca125b9e`） | 已合 |

**推荐串联**（在 [Wave 29](#wave-29-h5-世界行军互链军情战报复盘邮件社交扫读加深m4-出口--intg-026) 世界行军/军情/邮件社交栈基础上）：顶栏 **HUD 产出/仓库扫读**（**CLIENT-148**）→ **队列** 建造/募兵完成脉冲与七槽互跳（**CLIENT-149**）→ **日常** 可领定位/批量领取与 chain 进度（**CLIENT-150**）→ **将领** 列表筛选排序记忆（**CLIENT-151**）→ **排行** 双榜刷新钉选（**CLIENT-152**）→ **背包/商城** 分类 tab 与行内态（**CLIENT-153/154**）→ 视口 **1280×720** 主城产出·日常·将领·排行组合 manifest（**CLIENT-155**）；网关字段见 `tools/smoke/README.md` **INTG-027**。

**美术旁路**（**非** wave:30 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574) `36c69009`）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579) `4f5a9732`）；**CLIENT-147**（FILTER-008 旁路）——均 **非**本波 backlog 实现卡。实现卡 **CLIENT-148～155**，**勿占用 CLIENT-136/137/146/147**。

波次总览与 **DOCS-EXIT-022**（[#593](https://github.com/anitaguptaoffice/sanguo-slg/issues/593) / [#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 30」。实现合入后 main tip **`6978ebacaa3c91cc6556e93a10a1d227706e6c06`**（#602 CLIENT-155）。

## Wave 31 H5 出征募兵执行反馈巩固·战报相邻导航加深·邮件批量领取·军团聊天草稿未读·HUD 待办一致（M4 出口 / INTG-028）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-028** 网关冒烟一致）。**范围外**同 Wave 30；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓；**不**开 DATA-003 / `cfg_act*` / 不可逆消费扩量；**不**做 `CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **出征提交→军情/军事队列顶栏反馈** | [手动验收（出征提交反馈 CLIENT-080）](#手动验收出征提交反馈-client-080) 内 **CLIENT-156**（[#606](https://github.com/anitaguptaoffice/sanguo-slg/issues/606) / [#618](https://github.com/anitaguptaoffice/sanguo-slg/pull/618) `dde3cba9`） | 已合 |
| **募兵提交→募兵队列与军事互跳** | [手动验收（募兵消耗预览 CLIENT-088）](#手动验收募兵消耗预览-client-088) 内 **CLIENT-157**（[#607](https://github.com/anitaguptaoffice/sanguo-slg/issues/607) / [#623](https://github.com/anitaguptaoffice/sanguo-slg/pull/623) `b415fc76`） | 已合 |
| **战报详情相邻条导航与列表焦点** | [手动验收（战报相邻条导航 CLIENT-158）](#手动验收战报相邻条导航与列表焦点-client-158)（[#608](https://github.com/anitaguptaoffice/sanguo-slg/issues/608) / [#617](https://github.com/anitaguptaoffice/sanguo-slg/pull/617) `f19cada1`） | 已合 |
| **邮件附件一键批量领取与 HUD 同步** | [手动验收（邮件附件批量领取 CLIENT-087 / CLIENT-159）](#手动验收邮件附件批量领取-client-087--client-159)（[#609](https://github.com/anitaguptaoffice/sanguo-slg/issues/609) / [#622](https://github.com/anitaguptaoffice/sanguo-slg/pull/622) `085e903a`） | 已合 |
| **军团提到草稿记忆与聊天输入扫读** | [手动验收（军团提到聊天草稿 CLIENT-084）](#手动验收军团提到聊天草稿-client-084) 内 **CLIENT-160**（[#610](https://github.com/anitaguptaoffice/sanguo-slg/issues/610) / [#621](https://github.com/anitaguptaoffice/sanguo-slg/pull/621) `7eadaf82`） | 已合 |
| **聊天未读角标与列表分隔线扫读** | [手动验收（聊天未读列表扫读 CLIENT-161）](#手动验收聊天未读列表扫读与角标同步-client-161)（[#611](https://github.com/anitaguptaoffice/sanguo-slg/issues/611) / [#619](https://github.com/anitaguptaoffice/sanguo-slg/pull/619) `ce0b3925`） | 已合 |
| **HUD 待办角标与面板 tab/chip 一致** | [手动验收（HUD 待办与面板 tab/chip 一致 CLIENT-162）](#手动验收hud-待办与面板-tabchip-一致-client-162)（[#612](https://github.com/anitaguptaoffice/sanguo-slg/issues/612) / [#620](https://github.com/anitaguptaoffice/sanguo-slg/pull/620) `3c9c40b2`） | 已合 |
| **1280 出征募兵战报邮件社交组合 manifest** | [手动验收（1280 wave:31 组合 manifest CLIENT-163）](#手动验收1280-wave31-组合-manifest-client-163)（[#613](https://github.com/anitaguptaoffice/sanguo-slg/issues/613) / [#624](https://github.com/anitaguptaoffice/sanguo-slg/pull/624) `5ffcb5af`） | 已合 |
| **网关冒烟**（行军提交+募兵队列+战报邻接+邮件未领+日常可领） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 31** / `TestINTG028Wave31SmokePath`（[#614](https://github.com/anitaguptaoffice/sanguo-slg/issues/614) / [#616](https://github.com/anitaguptaoffice/sanguo-slg/pull/616) `8d8aac12`） | 已合 |

**推荐串联**（在 [Wave 30](#wave-30-h5-主城产出仓库日常领取闭环将领列表筛选扫读双榜刷新加深m4-出口--intg-027) 主城产出/日常/将领/排行栈基础上）：**军事** 出征提交观察 `march-queue-banner` 与军情高亮（**CLIENT-156**）→ **募兵** 提交后队列↔军事互跳（**CLIENT-157**）→ **战报** 详情相邻条导航（**CLIENT-158**）→ **邮件** 一键批量领取与 HUD 角标递减（**CLIENT-159**）→ **军团/聊天** 草稿记忆与未读分隔线（**CLIENT-160/161**）→ 顶栏/底栏待办与面板 tab/chip 一致（**CLIENT-162**）→ 视口 **1280×720** 出征募兵战报邮件社交 manifest（**CLIENT-163**）；网关字段见 `tools/smoke/README.md` **INTG-028**。

**美术旁路**（**非** wave:31 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574) `36c69009`）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579) `4f5a9732`）；**CLIENT-147**（FILTER-008 旁路）——均 **非**本波 backlog 实现卡。实现卡 **CLIENT-156～163**，**勿占用 CLIENT-136/137/146/147**。

波次总览与 **DOCS-EXIT-023**（[#615](https://github.com/anitaguptaoffice/sanguo-slg/issues/615) / [#625](https://github.com/anitaguptaoffice/sanguo-slg/pull/625)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 31」。实现合入后 main tip **`5ffcb5af031e574f9d5d081c5ceb3a008b3b235d`**（#624 CLIENT-163）；基线 wave:30 **`ad278a7c6bb80e6991306d17c3eb42e58046b336`**（DOCS-EXIT-022 [#604](https://github.com/anitaguptaoffice/sanguo-slg/pull/604) `ad278a7c`）。

## Wave 32 H5 主城建造消耗队列扫读·将领招募商城货币·双榜深链·日常链·世界格点（M4 出口 / INTG-029）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-029** 网关冒烟一致）。**范围外**同 Wave 31；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506)）。**世界瓦片/图集**仍暂缓。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城建造消耗与队列 ETA 扫读** | [手动验收（主城建造 CLIENT-082）](#手动验收主城建造升级-client-082) 内 **CLIENT-164**（[#627](https://github.com/anitaguptaoffice/sanguo-slg/issues/627) / [#638](https://github.com/anitaguptaoffice/sanguo-slg/pull/638)） | 已合 |
| **将领详情养成道具缺口与背包深链** | [手动验收（将领详情养成道具缺口与背包深链 CLIENT-165）](#手动验收将领详情养成道具缺口与背包深链-client-165)（[#628](https://github.com/anitaguptaoffice/sanguo-slg/issues/628) / [#646](https://github.com/anitaguptaoffice/sanguo-slg/pull/646)） | 已合 |
| **招募面板币种余额扫读与将领详情互跳** | [手动验收（招募钱包扫读与详情互跳 CLIENT-166）](#手动验收招募钱包扫读与详情互跳-client-166)（[#629](https://github.com/anitaguptaoffice/sanguo-slg/issues/629) / [#643](https://github.com/anitaguptaoffice/sanguo-slg/pull/643)） | 已合 |
| **商城分类 tab 货币余额扫读与行内价格对比** | [手动验收（背包商城 CLIENT-057）](#手动验收背包商城-client-057) 内 **CLIENT-167**（[#630](https://github.com/anitaguptaoffice/sanguo-slg/issues/630) / [#645](https://github.com/anitaguptaoffice/sanguo-slg/pull/645)） | 已合 |
| **双榜列表行将领详情深链与返回榜位记忆** | [手动验收（排行双榜 CLIENT-021）](#手动验收排行双榜-client-021) 内 **CLIENT-168**（[#631](https://github.com/anitaguptaoffice/sanguo-slg/issues/631) / [#640](https://github.com/anitaguptaoffice/sanguo-slg/pull/640)） | 已合 |
| **日常多 chain 类型 tab 与进行中首条定位** | [手动验收（日常可领取定位 CLIENT-091）](#手动验收日常可领取定位-client-091) 内 **CLIENT-169**（[#632](https://github.com/anitaguptaoffice/sanguo-slg/issues/632) / [#644](https://github.com/anitaguptaoffice/sanguo-slg/pull/644)） | 已合 |
| **世界格点信息卡与小地图选点焦点扫读** | [手动验收（世界格点扫读 CLIENT-170）](#手动验收世界格点扫读-client-170)（[#633](https://github.com/anitaguptaoffice/sanguo-slg/issues/633) / [#642](https://github.com/anitaguptaoffice/sanguo-slg/pull/642)） | 已合 |
| **1280 主城建造将领商城日常世界组合 manifest** | [手动验收（1280 wave:32 组合 manifest CLIENT-171）](#手动验收1280-wave32-组合-manifest-client-171)（[#634](https://github.com/anitaguptaoffice/sanguo-slg/issues/634) / [#641](https://github.com/anitaguptaoffice/sanguo-slg/pull/641) `30b6d007`） | 已合 |
| **网关冒烟**（建造队列+将领详情+背包+商城+双榜+日常链+世界格点） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 32** / `TestINTG029Wave32SmokePath`（[#635](https://github.com/anitaguptaoffice/sanguo-slg/issues/635) / [#639](https://github.com/anitaguptaoffice/sanguo-slg/pull/639)） | 已合 |

**推荐串联**（在 [Wave 31](#wave-31-h5-出征募兵执行反馈巩固战报相邻导航加深邮件批量领取军团聊天草稿未读hud待办一致m4-出口--intg-028) 出征/邮件/HUD 栈基础上）：**建造** 消耗预览与队列 ETA 扫读（**CLIENT-164**）→ **将领详情** 道具缺口与背包深链（**CLIENT-165**）→ **招募** 钱包扫读与详情互跳（**CLIENT-166**）→ **商城** 分类币种余额（**CLIENT-167**）→ **双榜** 将领深链与返回记忆（**CLIENT-168**）→ **日常** chain tab 与进行中定位（**CLIENT-169**）→ **世界** 格点信息卡与小地图焦点（**CLIENT-170**）→ 视口 **1280×720** 组合 manifest（**CLIENT-171**）；网关字段见 `tools/smoke/README.md` **INTG-029**。

**美术旁路**（**非** wave:32 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）。**工程旁路**：**ART-TOOLBAR-ICONS-009** 挂载 [#647](https://github.com/anitaguptaoffice/sanguo-slg/pull/647) / 1280 证据 [#648](https://github.com/anitaguptaoffice/sanguo-slg/pull/648)——**非**本波 backlog。实现卡 **CLIENT-164～171**。波次总览与 **DOCS-EXIT-024**（[#636](https://github.com/anitaguptaoffice/sanguo-slg/issues/636) / [#650](https://github.com/anitaguptaoffice/sanguo-slg/pull/650) `5440264`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 32」。**全收口** main tip **`5440264164ca61520e9394d7af6f989d1e42199b`**（DOCS-EXIT-024）；实现末卡 **`30b6d007`** #641 CLIENT-171；基线 wave:31 **`e76fc6dd8a66c0c0b7b304590fc49194bec194b6`**（DOCS-EXIT-023 [#625](https://github.com/anitaguptaoffice/sanguo-slg/pull/625) `e76fc6dd`）。**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓。wave:33 出口见 [Wave 33](#wave-33-h5-军情行军只读信息卡面板空错态巩固日常背包任务可读战报邮件扫读1280组合manifest补洞m4-出口--intg-030)。

### 手动验收（1280 wave:32 组合 manifest CLIENT-171）

视口 **1280×720** `layout-narrow`：**建造侧栏** `building-upgrade-preview` / `resource-deficit`（**CLIENT-164**）、**队列** `queue-row-progress` / `queue-row-progress-fill`、**将领** 详情 `hero-upgrade-item-gap` / `hero-upgrade-item-gap-warn`（**CLIENT-165**）与招募 `recruit-afford-secondary` / `recruit-cost-deficit` / `recruit-scroll-anchor-v1`（**CLIENT-166**）、**商城** `shop-tab-currency-sweep` / `shop-price-vs-wallet`（**CLIENT-167**）、**双榜** `rank-view-hero` / `leaderboard-return-scroll-v1`（**CLIENT-168**）、**日常** `daily-chain-tabs`（`daily-chain-tab-v1` / **CLIENT-169**）、**世界** `world-tile-info` / `formatWorldTileInfoSecondary` / `world-tile-focus-pulse`（**CLIENT-170**）与小地图窄屏 rect 与 **CLIENT-155/163** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；队列进度条与商城余额条 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave32MainCityBuildHeroShopDailyWorldNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-171）；`cd client && npm test` 绿。

1. 视口 **1280×720**：点槽位开 **建造**、底栏 **队列/将领/商城/日常/世界/排行**；长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:32 DOM 钩子（软依赖 **CLIENT-164～170**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163** manifest 不退化。

## Wave 33 H5 军情行军只读信息卡·面板空错态巩固·日常背包任务可读·战报邮件扫读·1280组合manifest补洞（M4 出口 / INTG-030）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-030** 网关冒烟一致）。**范围外**同 Wave 32；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / [#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) / [#649](https://github.com/anitaguptaoffice/sanguo-slg/pull/649)）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **军情行军只读信息卡与列表选中互链** | [手动验收（募兵 → 行军 → 战报 CLIENT-013）](#手动验收募兵--行军--战报client-012--client-013) + **CLIENT-172** `march-info-card`（[#652](https://github.com/anitaguptaoffice/sanguo-slg/issues/652) / [#667](https://github.com/anitaguptaoffice/sanguo-slg/pull/667)） | 已合 |
| **面板网关 error/empty 文案与重试扫读** | 顶栏说明 **CLIENT-173** `panel-gateway-retry`（[#653](https://github.com/anitaguptaoffice/sanguo-slg/issues/653) / [#671](https://github.com/anitaguptaoffice/sanguo-slg/pull/671)）；与 **CLIENT-129** 并存 | 已合 |
| **日常任务进度条与奖励道具扫读** | [手动验收（日常可领取定位 CLIENT-091）](#手动验收日常可领取定位-client-091) 内 **CLIENT-174** `daily-quest-progress`（[#654](https://github.com/anitaguptaoffice/sanguo-slg/issues/654) / [#664](https://github.com/anitaguptaoffice/sanguo-slg/pull/664)） | 已合 |
| **背包道具 cfg 摘要与来源标签** | [手动验收（背包与商城反馈 CLIENT-020）](#手动验收背包与商城反馈-client-020) 第 3 步 **CLIENT-175** `bag-item-cfg-summary`（[#655](https://github.com/anitaguptaoffice/sanguo-slg/issues/655) / [#670](https://github.com/anitaguptaoffice/sanguo-slg/pull/670)） | 已合 |
| **战报列表胜负摘要与 outcome 筛选记忆** | [手动验收（战报筛选 CLIENT-016）](#手动验收战报筛选-client-016) + **CLIENT-176** `battle-report-row-summary`（[#656](https://github.com/anitaguptaoffice/sanguo-slg/issues/656) / [#663](https://github.com/anitaguptaoffice/sanguo-slg/pull/663)） | 已合 |
| **邮件分 tab 空态与附件类型扫读** | [手动验收（邮件收件箱 CLIENT-017）](#手动验收邮件收件箱client-017) + **CLIENT-177** `mail-attachment-sweep`（[#657](https://github.com/anitaguptaoffice/sanguo-slg/issues/657) / [#669](https://github.com/anitaguptaoffice/sanguo-slg/pull/669)） | 已合 |
| **军事出征只读汇总与军情信息卡互跳** | [手动验收（出征表单 CLIENT-048）](#手动验收出征表单格点与兵力校验-client-048) 内 **CLIENT-089** 汇总条 + **CLIENT-178** `march-form-readonly-strip`（[#658](https://github.com/anitaguptaoffice/sanguo-slg/issues/658) / [#668](https://github.com/anitaguptaoffice/sanguo-slg/pull/668)） | 已合 |
| **1280 军情战报邮件背包日常组合 manifest 补洞** | [手动验收（1280 wave:33 组合 manifest CLIENT-179）](#手动验收1280-wave33-组合-manifest-client-179)（[#659](https://github.com/anitaguptaoffice/sanguo-slg/issues/659) / [#666](https://github.com/anitaguptaoffice/sanguo-slg/pull/666) `03a210b2`） | 已合 |
| **网关冒烟**（军情行军+日常奖励+背包摘要+战报 outcome+邮件附件） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 33** / `TestINTG030Wave33SmokePath`（[#660](https://github.com/anitaguptaoffice/sanguo-slg/issues/660) / [#665](https://github.com/anitaguptaoffice/sanguo-slg/pull/665)） | 已合 |

**推荐串联**（在 [Wave 32](#wave-32-h5-主城建造消耗队列扫读将领招募商城货币双榜深链日常链世界格点m4-出口--intg-029) 主城建造/将领商城/世界格点栈基础上）：**军情** 列表选中→只读信息卡与世界格点互链（**CLIENT-172**）→ 各面板网关失败 **error + 重试**（**CLIENT-173**）→ **日常** 进度条与奖励次行（**CLIENT-174**）→ **背包** cfg 摘要与来源标签（**CLIENT-175**）→ **战报** outcome 摘要与筛选记忆（**CLIENT-176**）→ **邮件** 分 tab 空态与附件扫读（**CLIENT-177**）→ **军事** 只读汇总条与军情信息卡互跳（**CLIENT-178**）→ 视口 **1280×720** 军情战报邮件背包日常 manifest 补洞（**CLIENT-179**）；网关字段见 `tools/smoke/README.md` **INTG-030**。

**美术旁路**（**非** wave:33 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）。**工程旁路**：**ART-ACTION-ICONS-010** 挂载 [#662](https://github.com/anitaguptaoffice/sanguo-slg/pull/662) `2e899898`——**非**本波 backlog；Draft [#649](https://github.com/anitaguptaoffice/sanguo-slg/pull/649)/[#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) **不合**。实现卡 **CLIENT-172～179**。波次总览与 **DOCS-EXIT-025**（[#661](https://github.com/anitaguptaoffice/sanguo-slg/issues/661) / [#673](https://github.com/anitaguptaoffice/sanguo-slg/pull/673) `47a27b8`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 33」。实现合入后 main tip **`03a210b23bbdb724ea8cddd2d2cac32dd57d7817`**（#666 CLIENT-179）；基线 wave:32 **`5440264164ca61520e9394d7af6f989d1e42199b`**（DOCS-EXIT-024 [#650](https://github.com/anitaguptaoffice/sanguo-slg/pull/650) `5440264`；实现 tip **`30b6d007`**）。wave:34 出口见 [Wave 34](#wave-34-h5-主城七槽队列互链巩固将领列表招募执行反馈双榜军团聊天扫读hud产出待办深链1280组合manifestm4-出口--intg-031)。

### 手动验收（1280 wave:33 组合 manifest CLIENT-179）

视口 **1280×720** `layout-narrow`：**军情** `march-info-card` / `march-row-selected`（**CLIENT-172**）、**战报** `battle-report-outcome-summary` / `battle-report-row-summary` + `battle-report-outcome-filter-v1`（**CLIENT-176**）、**邮件** `mail-tab-empty-hint` / `mail-attachment-sweep`（**CLIENT-177**）、**背包** `bag-item-cfg-summary` / `bag-open-source-v1`（**CLIENT-175**）、**日常** `daily-quest-progress` / `daily-quest-reward-line`（**CLIENT-174**）、**军事** `march-form-readonly-strip` 与军情互跳 `view-march-intel-card` / `open-military-from-march-intel`（**CLIENT-178**）与 **CLIENT-163/171** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；信息卡与汇总条在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave33IntelBattleMailBagDailyNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-179）；`cd client && npm test` 绿。（[#659](https://github.com/anitaguptaoffice/sanguo-slg/issues/659) / [#666](https://github.com/anitaguptaoffice/sanguo-slg/pull/666) `03a210b2`）

1. 视口 **1280×720**：底栏 **军情/战报/邮件/背包/日常/军事** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:33 DOM 钩子（软依赖 **CLIENT-172～178**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171** manifest 不退化。

## Wave 34 H5 主城七槽队列互链巩固·将领列表招募执行反馈·双榜军团聊天扫读·HUD产出待办深链·1280组合manifest（M4 出口 / INTG-031）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-031** 网关冒烟一致）。**范围外**同 Wave 33；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / [#637](https://github.com/anitaguptaoffice/sanguo-slg/pull/637) / [#649](https://github.com/anitaguptaoffice/sanguo-slg/pull/649) / [#674](https://github.com/anitaguptaoffice/sanguo-slg/pull/674)）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城七槽↔建造/募兵队列双向高亮互跳** | [手动验收（1280 wave:34 组合 manifest CLIENT-187）](#手动验收1280-wave34-组合-manifest-client-187) 内 **CLIENT-180**（[#675](https://github.com/anitaguptaoffice/sanguo-slg/issues/675) / [#688](https://github.com/anitaguptaoffice/sanguo-slg/pull/688)）；细节见正文 **wave:34（CLIENT-180）** bullet | 已合 |
| **队列完成脉冲与 HUD 产出/仓库余量联动** | [CLIENT-181（HUD 队列完成联动扫读）](#client-181hud-队列完成联动扫读)（[#676](https://github.com/anitaguptaoffice/sanguo-slg/issues/676) / [#689](https://github.com/anitaguptaoffice/sanguo-slg/pull/689)） | 已合 |
| **将领列表刷新戳记与详情返回记忆** | [手动验收（将领列表刷新戳记与详情返回记忆 CLIENT-182）](#手动验收将领列表刷新戳记与详情返回记忆-client-182)（[#677](https://github.com/anitaguptaoffice/sanguo-slg/issues/677) / [#691](https://github.com/anitaguptaoffice/sanguo-slg/pull/691)） | 已合 |
| **招募提交行内反馈与币种行脉冲** | [手动验收（将领招募提交行内反馈 CLIENT-183）](#手动验收将领招募提交行内反馈-client-183)（[#678](https://github.com/anitaguptaoffice/sanguo-slg/issues/678) / [#693](https://github.com/anitaguptaoffice/sanguo-slg/pull/693)） | 已合 |
| **双榜手动刷新密度与钉选保持** | [手动验收（排行双榜 CLIENT-021）](#手动验收排行双榜-client-021) 内 **CLIENT-184**（[#679](https://github.com/anitaguptaoffice/sanguo-slg/issues/679) / [#692](https://github.com/anitaguptaoffice/sanguo-slg/pull/692)） | 已合 |
| **军团职务分组头与聊天未读分隔线** | [手动验收（军团职务分组头与聊天未读分隔线扫读 CLIENT-185）](#手动验收军团职务分组头与聊天未读分隔线扫读-client-185)（[#680](https://github.com/anitaguptaoffice/sanguo-slg/issues/680) / [#687](https://github.com/anitaguptaoffice/sanguo-slg/pull/687)） | 已合 |
| **队列↔日常前往下一步双向锚点** | [手动验收（日常练兵/建造/战备 CLIENT-024）](#手动验收日常练兵建造战备-client-024) 第 6 步 **CLIENT-186**（[#681](https://github.com/anitaguptaoffice/sanguo-slg/issues/681) / [#690](https://github.com/anitaguptaoffice/sanguo-slg/pull/690)） | 已合 |
| **1280 主城将领排行社交 HUD 组合 manifest** | [手动验收（1280 wave:34 组合 manifest CLIENT-187）](#手动验收1280-wave34-组合-manifest-client-187)（[#682](https://github.com/anitaguptaoffice/sanguo-slg/issues/682) / [#694](https://github.com/anitaguptaoffice/sanguo-slg/pull/694) `a758d6bd`） | 已合 |
| **网关冒烟**（七槽队列+HUD余量+将领+招募+双榜+军团聊天+日常锚点） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 34** / `TestINTG031Wave34SmokePath`（[#683](https://github.com/anitaguptaoffice/sanguo-slg/issues/683) / [#686](https://github.com/anitaguptaoffice/sanguo-slg/pull/686)） | 已合 |

**推荐串联**（在 [Wave 33](#wave-33-h5-军情行军只读信息卡面板空错态巩固日常背包任务可读战报邮件扫读1280组合manifest补洞m4-出口--intg-030) 军情/战报/邮件栈基础上 **轮转**回主城队列与社交栈）：**七槽** 选中↔**队列** 行互跳（**CLIENT-180**）→ 队列完成 **HUD 产出余量** 脉冲（**CLIENT-181**）→ **将领列表** 刷新戳记与详情返回记忆（**CLIENT-182**）→ **招募** 提交行内反馈（**CLIENT-183**）→ **双榜** 刷新密度与钉选（**CLIENT-184**）→ **军团** 职务分组与 **聊天** 未读分隔线（**CLIENT-185**）→ **队列↔日常** 双向锚点（**CLIENT-186**）→ 视口 **1280×720** 主城将领排行社交 HUD manifest（**CLIENT-187**）；网关字段见 `tools/smoke/README.md` **INTG-031**。

**美术旁路**（**非** wave:34 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）。**工程旁路**：**ART-ACTION-ICONS-011** 挂载 [#685](https://github.com/anitaguptaoffice/sanguo-slg/pull/685) `d97ee9a9`——**非**本波 backlog；Draft [#674](https://github.com/anitaguptaoffice/sanguo-slg/pull/674) **不合**。实现卡 **CLIENT-180～187**。波次总览与 **DOCS-EXIT-026**（[#684](https://github.com/anitaguptaoffice/sanguo-slg/issues/684)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 34」。实现合入后 main tip **`a758d6bdb194a682f051d44e4161047be724a6d3`**（#694 CLIENT-187）；基线 wave:33 **`03a210b23bbdb724ea8cddd2d2cac32dd57d7817`**（DOCS-EXIT-025 [#673](https://github.com/anitaguptaoffice/sanguo-slg/pull/673) `47a27b8`；实现 tip **`03a210b2`**）。

### 手动验收（1280 wave:34 组合 manifest CLIENT-187）

视口 **1280×720** `layout-narrow`：**七槽** `city-slot-pulse` / 队列 `queue-row-slot-highlight`（**CLIENT-180**）、顶栏 HUD `formatHudProductionWalletLine` / `hud-resource-sweep`（**CLIENT-181**；manifest 亦登记 `hud-production-wallet-line`）、**将领** `hero-list-refreshed-at` / `hero-list-refresh-pulse` / `hero-list-selected-v1`（**CLIENT-182**）、招募 `recruit-submitting` / `recruit-success-pulse`（**CLIENT-183**）、**双榜** `leaderboard-top-density-line`（**CLIENT-184**）、**军团** `guild-role-group-header`、**聊天** `chat-unread-separator`（**CLIENT-185**）、**队列↔日常** `daily-queue-anchor-highlight`（**CLIENT-186**）与 **CLIENT-171/179** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；分组头与密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave34MainCityHeroRankSocialHudNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`、`chatUnread.test.ts`（CLIENT-187）；`cd client && npm test` 绿。（[#682](https://github.com/anitaguptaoffice/sanguo-slg/issues/682) / [#694](https://github.com/anitaguptaoffice/sanguo-slg/pull/694) `a758d6bd`）

1. 视口 **1280×720**：主城七槽 overlay、底栏 **队列/将领/排行/军团/聊天/日常** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:34 DOM 钩子（软依赖 **CLIENT-180～186**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179** manifest 不退化。

## Wave 35 H5 世界小地图军情互链·战报 outcome 复盘·邮件日常领取·背包商城扫读·1280组合manifest（M4 出口 / INTG-032）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-032** 网关冒烟一致）。**范围外**同 Wave 34；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#637** / **#649** / **#674** / **#697**）；**ART-012** 将领面板旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **世界小地图↔格点信息卡双向焦点互链** | [手动验收（1280 wave:35 组合 manifest CLIENT-195）](#手动验收1280-wave35-组合-manifest-client-195) 内 **CLIENT-188**（[#699](https://github.com/anitaguptaoffice/sanguo-slg/issues/699) / [#712](https://github.com/anitaguptaoffice/sanguo-slg/pull/712)）；细节见正文 **wave:35（CLIENT-188）** bullet | 已合 |
| **军情列表↔出征表单坐标同步高亮** | [手动验收（军事出征 CLIENT-015）](#手动验收军事出征-client-015) 内 **CLIENT-189**（[#700](https://github.com/anitaguptaoffice/sanguo-slg/issues/700) / [#713](https://github.com/anitaguptaoffice/sanguo-slg/pull/713)） | 已合 |
| **战报 outcome 色带与相邻条导航焦点环** | [手动验收（战报列表 CLIENT-016）](#手动验收战报列表-client-016) 内 **CLIENT-190**（[#701](https://github.com/anitaguptaoffice/sanguo-slg/issues/701) / [#711](https://github.com/anitaguptaoffice/sanguo-slg/pull/711)） | 已合 |
| **战报坐标复盘↔小地图/军情信息卡互跳** | [手动验收（战报坐标复盘 CLIENT-042）](#手动验收战报坐标复盘-client-042) 内 **CLIENT-191**（[#702](https://github.com/anitaguptaoffice/sanguo-slg/issues/702) / [#716](https://github.com/anitaguptaoffice/sanguo-slg/pull/716)） | 已合 |
| **邮件分 tab 空态与单封附件领取脉冲** | [手动验收（邮件收件箱 CLIENT-017）](#手动验收邮件收件箱-client-017) 内 **CLIENT-192**（[#703](https://github.com/anitaguptaoffice/sanguo-slg/issues/703) / [#710](https://github.com/anitaguptaoffice/sanguo-slg/pull/710)） | 已合 |
| **日常可领取进度与邮件/HUD 待办联动** | [手动验收（日常任务 CLIENT-009）](#手动验收日常任务-client-009) 内 **CLIENT-193**（[#704](https://github.com/anitaguptaoffice/sanguo-slg/issues/704) / [#714](https://github.com/anitaguptaoffice/sanguo-slg/pull/714)） | 已合 |
| **背包行内态与商城货币缺口扫读** | [手动验收（背包商城 CLIENT-020）](#手动验收背包商城-client-020) 内 **CLIENT-194**（[#705](https://github.com/anitaguptaoffice/sanguo-slg/issues/705) / [#717](https://github.com/anitaguptaoffice/sanguo-slg/pull/717)） | 已合 |
| **1280 世界军情战报邮件日常背包商城组合 manifest** | [手动验收（1280 wave:35 组合 manifest CLIENT-195）](#手动验收1280-wave35-组合-manifest-client-195)（[#706](https://github.com/anitaguptaoffice/sanguo-slg/issues/706) / [#715](https://github.com/anitaguptaoffice/sanguo-slg/pull/715) `8b4230e4`） | 已合 |
| **网关冒烟**（小地图军情+战报复盘+邮件领取+日常进度+背包商城） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 35** / `TestINTG032Wave35SmokePath`（[#707](https://github.com/anitaguptaoffice/sanguo-slg/issues/707) / [#709](https://github.com/anitaguptaoffice/sanguo-slg/pull/709)） | 已合 |

**推荐串联**（在 [Wave 34](#wave-34-h5-主城七槽队列互链巩固将领列表招募执行反馈双榜军团聊天扫读hud产出待办深链1280组合manifestm4-出口--intg-031) 主城/社交栈基础上 **轮转**回世界/军情/战报栈）：**小地图↔格点信息卡** 双向焦点（**CLIENT-188**）→ **军情↔出征表单** 坐标同步高亮（**CLIENT-189**）→ **战报** outcome 色带与相邻焦点（**CLIENT-190**）→ **战报坐标复盘** 与小地图/军情互跳（**CLIENT-191**）→ **邮件** tab 空态与单封领取脉冲（**CLIENT-192**）→ **日常** 可领取扫读与 HUD 待办（**CLIENT-193**）→ **背包/商城** 行内态与货币缺口（**CLIENT-194**）→ 视口 **1280×720** 世界军情战报邮件日常 manifest（**CLIENT-195**）；网关字段见 `tools/smoke/README.md` **INTG-032**。

- **wave:35（CLIENT-188）小地图格点互链**：小地图选点后 **`world-tile-info-card`** 展示坐标与城池/空地只读摘要（CLIENT-170 口径）；信息卡非按钮点击反向 **`minimap-focus-pulse`** 2s 高亮选点（CLIENT-139 互链不退化）；军情选中行军终点同步小地图 **`minimap-march-end-highlight`**（与 CLIENT-172 信息卡可叠加，无新 world RPC）。单测：`minimapTileFocusLink.test.ts`（`syncMinimapFocusFromTileCard` / `highlightMinimapMarchEnd`）；`cd client && npm test` 绿。（[#699](https://github.com/anitaguptaoffice/sanguo-slg/issues/699) / [#712](https://github.com/anitaguptaoffice/sanguo-slg/pull/712) `0b80db5e`）

**美术旁路**（**非** wave:35 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修——**非**本波 backlog）。实现卡 **CLIENT-188～195**。波次总览与 **DOCS-EXIT-027**（[#708](https://github.com/anitaguptaoffice/sanguo-slg/issues/708)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 35」。实现合入后 main tip **`8b4230e4fcb946e96e707f1f5db22c293edd3123`**（#715 CLIENT-195）；基线 wave:34 **`0d48fb25eff511c2fd834b94e9286fc4069e425c`**（DOCS-EXIT-026 [#695](https://github.com/anitaguptaoffice/sanguo-slg/pull/695)；实现 tip **`a758d6bd`**）。

### 手动验收（1280 wave:35 组合 manifest CLIENT-195）

视口 **1280×720** `layout-narrow`：**世界** `world-tile-info-card` / `minimap-focus-pulse` / `minimap-march-end-highlight` / `minimap-battle-replay-pulse`（**CLIENT-188/191**）、**军情** `march-info-card` / `march-row-selected`（**CLIENT-172**）与军事 **出征表单** `march-form-coord-sync-highlight`（**CLIENT-189**）、**战报** `battle-report-outcome-band` / `battle-report-adjacent-focus-ring` + `battle-report-outcome-filter-v1`（**CLIENT-190/176**）、**邮件** `mail-tab-empty-hint` / `mail-claim-inline-pulse`（**CLIENT-192/177**）、**日常** `daily-claimable-sweep-line` / `daily-claim-progress-pulse` 与顶栏 `hud-todo-sweep-line`（**CLIENT-193**）、**背包/商城** `bag-row-inline-state` / `bag-use-inline-pulse` / `shop-price-wallet-gap-line`（**CLIENT-194**）与 **CLIENT-179/187** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；战报/邮件密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave35WorldIntelBattleReportMailDailyNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-195）；`cd client && npm test` 绿。（[#706](https://github.com/anitaguptaoffice/sanguo-slg/issues/706) / [#715](https://github.com/anitaguptaoffice/sanguo-slg/pull/715) `8b4230e4`）

1. 视口 **1280×720**：底栏 **世界/军情/战报/邮件/日常/背包/商城/军事** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:35 DOM 钩子（软依赖 **CLIENT-188～194**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187** manifest 不退化。

## Wave 36 H5 主城队列剩余/完成焦点·将领养成对比/列表互跳·社交空错态·招募表单/背包缺口·HUD中心面板深链·1280组合manifest（M4 出口 / INTG-033）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-033** 网关冒烟一致）。**范围外**同 Wave 35；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#637** / **#649** / **#674** / **#697**）；**ART-012** 将领面板旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列剩余时间与进度条扫读** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019) 内 **CLIENT-196**（[#722](https://github.com/anitaguptaoffice/sanguo-slg/issues/722) / [#736](https://github.com/anitaguptaoffice/sanguo-slg/pull/736)）；细节见正文 **wave:36（CLIENT-196）** bullet | 已合 |
| **队列完成态与七槽焦点环互链** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019) 内 **CLIENT-197**（[#723](https://github.com/anitaguptaoffice/sanguo-slg/issues/723) / [#734](https://github.com/anitaguptaoffice/sanguo-slg/pull/734)） | 已合 |
| **将领详情养成对比与升级进度条** | [手动验收（将领详情 CLIENT-014）](#手动验收将领详情-client-014) 内 **CLIENT-198**（[#724](https://github.com/anitaguptaoffice/sanguo-slg/issues/724) / [#733](https://github.com/anitaguptaoffice/sanguo-slg/pull/733)） | 已合 |
| **将领列表↔详情筛选记忆互跳** | [手动验收（将领列表↔详情筛选记忆扫读 CLIENT-199）](#手动验收将领列表详情筛选记忆扫读-client-199)（[#725](https://github.com/anitaguptaoffice/sanguo-slg/issues/725) / [#739](https://github.com/anitaguptaoffice/sanguo-slg/pull/739)） | 已合 |
| **军团/聊天网关空错态重试扫读** | [手动验收（M3：选服 / 聊天 / 军团 / 排行，CLIENT-022）](#手动验收m3选服--聊天--军团--排行client-022) 内 **CLIENT-200**（[#726](https://github.com/anitaguptaoffice/sanguo-slg/issues/726) / [#738](https://github.com/anitaguptaoffice/sanguo-slg/pull/738)） | 已合 |
| **招募表单校验与背包养成道具缺口深链** | [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) 内 **CLIENT-201**（[#727](https://github.com/anitaguptaoffice/sanguo-slg/issues/727) / [#740](https://github.com/anitaguptaoffice/sanguo-slg/pull/740)） | 已合 |
| **HUD 中心四面板 tab 深链余量** | [手动验收（HUD 待办徽章，CLIENT-027）](#手动验收hud-待办徽章-client-027) 内 **CLIENT-202**（[#728](https://github.com/anitaguptaoffice/sanguo-slg/issues/728) / [#737](https://github.com/anitaguptaoffice/sanguo-slg/pull/737)） | 已合 |
| **1280 主城队列将领社交 HUD 深链组合 manifest** | [手动验收（1280 wave:36 组合 manifest CLIENT-203）](#手动验收1280-wave36-组合-manifest-client-203)（[#729](https://github.com/anitaguptaoffice/sanguo-slg/issues/729) / [#735](https://github.com/anitaguptaoffice/sanguo-slg/pull/735) `6d4daaa4`） | 已合 |
| **网关冒烟**（主城队列+将领养成+社交+招募背包+HUD深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 36** / `TestINTG033Wave36SmokePath`（[#730](https://github.com/anitaguptaoffice/sanguo-slg/issues/730) / [#732](https://github.com/anitaguptaoffice/sanguo-slg/pull/732)） | 已合 |

**推荐串联**（在 [Wave 35](#wave-35-h5-世界小地图军情互链战报-outcome-复盘邮件日常领取背包商城扫读1280组合manifestm4-出口--intg-032) 世界/军情/战报栈基础上 **轮转**回主城队列与社交栈）：**队列** 剩余时间/进度条扫读（**CLIENT-196**）→ 完成态 **七槽焦点环**（**CLIENT-197**）→ **将领详情** 养成对比与升级进度（**CLIENT-198**）→ **列表↔详情** 筛选记忆（**CLIENT-199**）→ **军团/聊天** 空错态重试（**CLIENT-200**）→ **招募** 表单校验与背包缺口深链（**CLIENT-201**）→ **HUD** 中心面板 tab 深链（**CLIENT-202**）→ 视口 **1280×720** 主城队列将领社交 manifest（**CLIENT-203**）；网关字段见 `tools/smoke/README.md` **INTG-033**。

**美术旁路**（**非** wave:36 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修 + [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) 终验补丁 `ce61ee75`——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-196～203**。波次总览与 **DOCS-EXIT-028**（[#731](https://github.com/anitaguptaoffice/sanguo-slg/issues/731)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 36」。实现合入后 main tip **`6d4daaa4c4daff6cca11ae2bf4b4335b81f882e5`**（#735 CLIENT-203）；工程 tip（含 ART-012 #721）**`ce61ee7523b2d4b963db586209a72f8320573069`**；基线 wave:35 **`9737f49a08e3e7b518d03ad22cc89d579ac61e52`**（DOCS-EXIT-027 [#719](https://github.com/anitaguptaoffice/sanguo-slg/pull/719)；实现 tip **`8b4230e4`**）。

### 手动验收（1280 wave:36 组合 manifest CLIENT-203）

视口 **1280×720** `layout-narrow`：**队列** `queue-row-eta-line` / `queue-row-progress-bar`（**CLIENT-196**）、完成 **七槽** `city-slot-complete-focus-ring` / `queue-row-complete-pulse`（**CLIENT-197**）、**将领** `hero-growth-compare-strip` / `hero-upgrade-progress-bar`（**CLIENT-198**）、列表返回 `hero-list-return-v1` / `hero-list-return-highlight`（**CLIENT-199**）、**军团/聊天** `guild-chat-empty-error-row` / `guild-chat-retry-inline`（**CLIENT-200**）、招募 `recruit-form-inline-hint` / `bag-hero-item-gap-highlight`（**CLIENT-201**）、顶栏 `hud-center-panel-deeplink-line` / 底栏 `center-panel-tab-pulse`（**CLIENT-202**）与 **CLIENT-187/195** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；队列/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave36MainCityQueueHeroSocialHudNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-203）；`cd client && npm test` 绿。（[#729](https://github.com/anitaguptaoffice/sanguo-slg/issues/729) / [#735](https://github.com/anitaguptaoffice/sanguo-slg/pull/735) `6d4daaa4`）

1. 视口 **1280×720**：底栏 **队列/将领/军团/聊天** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:36 DOM 钩子（软依赖 **CLIENT-196～202**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195** manifest 不退化。

## Wave 37 H5 世界小地图行军叠标·军情 ETA 阶段条·出征兵力余量警示·战报列表密度·战报回合摘要·邮件日常 HUD·背包商城返回·1280组合manifest（M4 出口 / INTG-034）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-034** 网关冒烟一致）。**范围外**同 Wave 36；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **世界小地图多行军终点叠标与格点行军摘要** | 正文 **wave:37（CLIENT-204）** bullet；[手动验收（1280 wave:37 组合 manifest CLIENT-211）](#手动验收1280-wave37-组合-manifest-client-211) | 已合 |
| **军情 phase/ETA 阶段条与列表次行扫读** | 正文 **wave:37（CLIENT-205）** bullet（[#774](https://github.com/anitaguptaoffice/sanguo-slg/issues/774) / [#770](https://github.com/anitaguptaoffice/sanguo-slg/pull/770)） | 已合 |
| **出征表单兵力余量警示与军情汇总互跳** | 正文 **wave:37（CLIENT-206）** bullet（[#775](https://github.com/anitaguptaoffice/sanguo-slg/issues/775) / [#766](https://github.com/anitaguptaoffice/sanguo-slg/pull/766)） | 已合 |
| **战报列表时间窗 chip 与胜负 streak 次行** | 正文 **wave:37（CLIENT-207）** bullet（[#776](https://github.com/anitaguptaoffice/sanguo-slg/issues/776) / [#768](https://github.com/anitaguptaoffice/sanguo-slg/pull/768)） | 已合 |
| **战报详情回合摘要条只读扫读** | 正文 **wave:37（CLIENT-208）** bullet（[#777](https://github.com/anitaguptaoffice/sanguo-slg/issues/777) / [#764](https://github.com/anitaguptaoffice/sanguo-slg/pull/764)） | 已合 |
| **邮件分 tab 未读与日常可领取 HUD 联动** | 正文 **CLIENT-209** bullet（[#778](https://github.com/anitaguptaoffice/sanguo-slg/issues/778) / [#771](https://github.com/anitaguptaoffice/sanguo-slg/pull/771)） | 已合 |
| **背包分类 tab 滚动记忆与商城返回行高亮** | 正文 **CLIENT-210** bullet（[#779](https://github.com/anitaguptaoffice/sanguo-slg/issues/779) / [#772](https://github.com/anitaguptaoffice/sanguo-slg/pull/772)） | 已合 |
| **1280 世界军情战报邮件背包组合 manifest** | [手动验收（1280 wave:37 组合 manifest CLIENT-211）](#手动验收1280-wave37-组合-manifest-client-211)（[#780](https://github.com/anitaguptaoffice/sanguo-slg/issues/780) / [#769](https://github.com/anitaguptaoffice/sanguo-slg/pull/769) `1c6320d4`） | 已合 |
| **网关冒烟**（世界叠标+军情ETA+出征余量+战报密度+邮件日常HUD+背包商城） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 37** / `TestINTG034Wave37SmokePath`（[#781](https://github.com/anitaguptaoffice/sanguo-slg/issues/781) / [#765](https://github.com/anitaguptaoffice/sanguo-slg/pull/765)） | 已合 |

**推荐串联**（在 [Wave 36](#wave-36-h5-主城队列剩余完成焦点将领养成对比列表互跳社交空错态招募表单背包缺口hud中心面板深链1280组合manifestm4-出口--intg-033) 主城/将领/社交栈基础上 **轮转**回世界/军情/战报/邮件/背包栈）：**小地图** 多行军叠标与格点行军摘要（**CLIENT-204**）→ **军情** phase/ETA 阶段条与列表次行（**CLIENT-205**）→ **出征** 兵力余量警示与军情互跳（**CLIENT-206**）→ **战报** 时间窗 chip 与 streak 次行（**CLIENT-207**）→ **战报详情** 回合摘要条（**CLIENT-208**）→ **邮件** 分 tab 未读与日常 HUD 联动（**CLIENT-209**）→ **背包/商城** 分类滚动记忆与返回高亮（**CLIENT-210**）→ 视口 **1280×720** 世界军情战报邮件背包 manifest（**CLIENT-211**）；网关字段见 `tools/smoke/README.md` **INTG-034**。

- **wave:37（CLIENT-204）小地图行军叠标**：在 **CLIENT-188** `minimap-march-end-highlight` 基础上，同格点多行军目的点绘制只读 **`minimap-march-stack-badge`**（`×N` 角标，`ListMarches` 客户端计数）；格点信息卡次行 **`formatWorldTileMarchSummaryLine`** / `world-tile-march-summary-line` 展示 **最近终点行军** phase/ETA（与军情 `formatMarchListSecondary` 同口径，无新 world RPC）。单测：`minimapMarchStack.test.ts`、`wave37MinimapMarchStackNarrowManifest.test.ts`；`cd client && npm test` 绿。（[#773](https://github.com/anitaguptaoffice/sanguo-slg/issues/773) / [#767](https://github.com/anitaguptaoffice/sanguo-slg/pull/767) `330f17ca`）

**美术旁路**（**非** wave:37 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修 + [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) 终验补丁 `ce61ee75`——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-204～211**。波次总览与 **DOCS-EXIT-029**（[#763](https://github.com/anitaguptaoffice/sanguo-slg/issues/763)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 37」。实现合入后 main tip **`1c6320d45f5caa5a363f61d4cd54a1a289686f2b`**（#769 CLIENT-211）；基线 wave:36 **全收口** tip **`a3792b2ec9347ace95c85fb0ed1e1012d5d0c8dd`**（DOCS-EXIT-028 [#751](https://github.com/anitaguptaoffice/sanguo-slg/pull/751) `a3792b2`；实现 tip **`6d4daaa4`**）。

### 手动验收（1280 wave:37 组合 manifest CLIENT-211）

视口 **1280×720** `layout-narrow`：**世界** `minimap-march-stack-badge` / `world-tile-march-summary-line`（**CLIENT-204**）、**军情** `march-intel-phase-eta-strip` / `intel-row-phase-subline`（**CLIENT-205**）与军事 **出征** `march-form-troop-reserve-line` / `march-form-reserve-warn`（**CLIENT-206**）、**战报** `battle-report-time-filter-v1` / `battle-report-list-streak-line` / `battle-report-round-summary-strip`（**CLIENT-207/208**；**CLIENT-176/190** 不退化）、**邮件** `mail-tab-unread-sweep-line` / `mail-tab-hud-sync-pulse` 与日常 `quest-claim-hud-link-line`（**CLIENT-209**）、**背包/商城** `bag-category-tab-v1` / `bag-category-scroll-v1` / `bag-row-return-highlight`（**CLIENT-210**；**CLIENT-194** 不退化）与 **CLIENT-195/203** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；军情/战报/邮件密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave37WorldIntelBattleReportMailBagNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-211）；`cd client && npm test` 绿。（[#780](https://github.com/anitaguptaoffice/sanguo-slg/issues/780) / [#769](https://github.com/anitaguptaoffice/sanguo-slg/pull/769) `1c6320d4`）

1. 视口 **1280×720**：底栏 **世界/军情/战报/邮件/背包/商城/军事** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:37 DOM 钩子（软依赖 **CLIENT-204～210**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203** manifest 不退化。

## Wave 38 H5 主城队列 ETA 分段·将领忠诚·双榜冷却·招募商城币种·HUD 底栏深链·社交退避·日常队列预览·1280组合manifest（M4 出口 / INTG-035）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-035** 网关冒烟一致）。**范围外**同 Wave 37；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领装备槽 / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段标签与完成态七槽余量扫读** | 正文 **wave:38（CLIENT-212）** bullet（[#785](https://github.com/anitaguptaoffice/sanguo-slg/issues/785) / [#811](https://github.com/anitaguptaoffice/sanguo-slg/pull/811)） | 已合 |
| **将领列表忠诚次行与详情养成道具堆叠扫读** | 正文 **wave:38（CLIENT-213）** bullet（[#786](https://github.com/anitaguptaoffice/sanguo-slg/issues/786) / [#806](https://github.com/anitaguptaoffice/sanguo-slg/pull/806)） | 已合 |
| **双榜手动刷新冷却戳记与排行空态行内重试** | 正文 **wave:38（CLIENT-214）** bullet（[#787](https://github.com/anitaguptaoffice/sanguo-slg/issues/787) / [#813](https://github.com/anitaguptaoffice/sanguo-slg/pull/813)） | 已合 |
| **招募与商城多币种钱包只读对比行** | 正文 **wave:38（CLIENT-215）** bullet（[#788](https://github.com/anitaguptaoffice/sanguo-slg/issues/788) / [#810](https://github.com/anitaguptaoffice/sanguo-slg/pull/810)） | 已合 |
| **HUD 待办合并扫读行与底栏四面板深链脉冲** | 正文 **CLIENT-216** bullet（[#789](https://github.com/anitaguptaoffice/sanguo-slg/issues/789) / [#809](https://github.com/anitaguptaoffice/sanguo-slg/pull/809)） | 已合 |
| **军团成员在线摘要与聊天拉取失败退避重试** | 正文 **wave:38（CLIENT-217）** bullet（[#790](https://github.com/anitaguptaoffice/sanguo-slg/issues/790) / [#808](https://github.com/anitaguptaoffice/sanguo-slg/pull/808)） | 已合 |
| **日常可领 chain 次行与队列下一完成 ETA 预览互链** | 正文 **wave:38（CLIENT-218）** bullet（[#791](https://github.com/anitaguptaoffice/sanguo-slg/issues/791) / [#812](https://github.com/anitaguptaoffice/sanguo-slg/pull/812)） | 已合 |
| **1280 主城将领社交队列组合 manifest** | [手动验收（1280 wave:38 组合 manifest CLIENT-219）](#手动验收1280-wave38-组合-manifest-client-219)（[#792](https://github.com/anitaguptaoffice/sanguo-slg/issues/792) / [#807](https://github.com/anitaguptaoffice/sanguo-slg/pull/807) `f7572123`） | 已合 |
| **网关冒烟**（主城队列 ETA+将领忠诚+双榜冷却+招募商城币种+HUD 底栏+社交退避+日常队列预览） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 38** / `TestINTG035Wave38SmokePath`（[#793](https://github.com/anitaguptaoffice/sanguo-slg/issues/793) / [#805](https://github.com/anitaguptaoffice/sanguo-slg/pull/805)） | 已合 |

**推荐串联**（在 [Wave 37](#wave-37-h5-世界小地图行军叠标军情-eta阶段条出征兵力余量警示战报列表密度战报回合摘要邮件日常-hud背包商城返回1280组合manifestm4-出口--intg-034) 世界/军情/战报栈基础上 **轮转**回主城队列与社交栈）：**队列** ETA 分段与完成态七槽余量（**CLIENT-212**）→ **将领** 忠诚次行与养成道具堆叠（**CLIENT-213**）→ **双榜** 刷新冷却与空态重试（**CLIENT-214**）→ **招募/商城** 多币种对比（**CLIENT-215**）→ **HUD** 待办合并与底栏深链脉冲（**CLIENT-216**）→ **军团/聊天** 在线摘要与退避重试（**CLIENT-217**）→ **日常↔队列** chain 次行与下一完成预览（**CLIENT-218**）→ 视口 **1280×720** 主城将领社交队列 manifest（**CLIENT-219**）；网关字段见 `tools/smoke/README.md` **INTG-035**。

**美术旁路**（**非** wave:38 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-136**（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb`，ART-UI-FILTER-008 联调修正）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修 + [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) 终验补丁 `ce61ee75`——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-212～219**。波次总览与 **DOCS-EXIT-030**（[#794](https://github.com/anitaguptaoffice/sanguo-slg/issues/794)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 38」。**工程全收口** main tip **`501e2a75228f39d67fe954963355f29afbe065e7`**（INTG-035 [#805](https://github.com/anitaguptaoffice/sanguo-slg/pull/805) `501e2a75`）；**实现全收口** tip **`f7572123a27adc44f4709c4c76cdd81ffaa1d8c3`**（#807 CLIENT-219）；基线 wave:37 **全收口** tip **`3d6687c2ed212fafe74a6dc738be4d29e01d62be`**（DOCS-EXIT-029 [#783](https://github.com/anitaguptaoffice/sanguo-slg/pull/783) `3d6687c2`；实现 tip **`1c6320d4`**）。

### 手动验收（1280 wave:38 组合 manifest CLIENT-219）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-label` / `domestic-queue-complete-slot-margin` / `queue-next-finish-preview` / `data-action="queue-open-daily-anchor"`（**CLIENT-212/218**；**CLIENT-196/197** 不退化）、**将领** `hero-list-row-loyalty-subline` / `data-role="hero-list-loyalty-subline"` / `hero-loyalty-warn-dot` / `hero-detail-consumable-stack-line`（**CLIENT-213**）、**双榜** `rank-refresh-cooldown-stamp` / `data-role="rank-refresh-cooldown"` / `rank-manual-refresh-ms` / `rank-empty-retry-inline`（**CLIENT-214**）、**招募/商城** `recruit-wallet-compare-line` / `shop-wallet-compare-line`（**CLIENT-215**）、**HUD** `.hud-todo-merged-sweep` / `data-role="hud-todo-merged-sweep-line"` / `toolbar-panel-deep-link-pulse`（**CLIENT-216**；**CLIENT-202** 不退化）、**军团** `guild-member-online-summary` / `data-role="guild-member-online-summary"` / `guild-chat-backoff-retry`（**CLIENT-217**）、**日常** `daily-quest-chain-type-subline`（**CLIENT-218**；**CLIENT-174/169** 不退化）与 **CLIENT-203/211** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave38MainCityHeroSocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-219）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常/商城** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:38 DOM 钩子（软依赖 **CLIENT-212～218**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211** manifest 不退化。单测：`wave38MainCityHeroSocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-219）；`cd client && npm test` 绿。（[#792](https://github.com/anitaguptaoffice/sanguo-slg/issues/792) / [#807](https://github.com/anitaguptaoffice/sanguo-slg/pull/807) `f7572123`）

## Wave 39 H5 世界小地图军情双向同步·军情 phase 变更脉冲·出征军情交接·战报坐标军情互链·邮件战报联动·HUD 军事待办深链·1280组合manifest（M4 出口 / INTG-036）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-036** 网关冒烟一致）。**范围外**同 Wave 38；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图格点与军情列表双向同步高亮环** | 正文 **wave:39（CLIENT-220）** bullet（[#838](https://github.com/anitaguptaoffice/sanguo-slg/issues/838) / [#835](https://github.com/anitaguptaoffice/sanguo-slg/pull/835)） | 已合 |
| **军情 phase 变更列表脉冲与信息卡阶段条** | 正文 **wave:39（CLIENT-221）** bullet（[#839](https://github.com/anitaguptaoffice/sanguo-slg/issues/839) / [#828](https://github.com/anitaguptaoffice/sanguo-slg/pull/828)） | 已合 |
| **出征提交军情交接与新行军列表高亮** | 正文 **wave:39（CLIENT-222）** bullet（[#840](https://github.com/anitaguptaoffice/sanguo-slg/issues/840) / [#831](https://github.com/anitaguptaoffice/sanguo-slg/pull/831)） | 已合 |
| **战报列表坐标标签与军情/小地图复盘互链** | 正文 **wave:39（CLIENT-223）** bullet（[#841](https://github.com/anitaguptaoffice/sanguo-slg/issues/841) / [#829](https://github.com/anitaguptaoffice/sanguo-slg/pull/829)） | 已合 |
| **战报详情回合摘要与军情同源行军互跳** | 正文 **wave:39（CLIENT-224）** bullet（[#842](https://github.com/anitaguptaoffice/sanguo-slg/issues/842) / [#830](https://github.com/anitaguptaoffice/sanguo-slg/pull/830)） | 已合 |
| **邮件战报类分 tab 与战报 outcome 筛选联动** | 正文 **CLIENT-225** bullet（[#843](https://github.com/anitaguptaoffice/sanguo-slg/issues/843) / [#837](https://github.com/anitaguptaoffice/sanguo-slg/pull/837)） | 已合 |
| **HUD 军事待办分段深链军情/战报/出征脉冲** | 正文 **CLIENT-226** bullet（[#844](https://github.com/anitaguptaoffice/sanguo-slg/issues/844) / [#836](https://github.com/anitaguptaoffice/sanguo-slg/pull/836)） | 已合 |
| **1280 世界军情战报邮件出征组合 manifest** | [手动验收（1280 wave:39 组合 manifest CLIENT-227）](#手动验收1280-wave39-组合-manifest-client-227)（[#845](https://github.com/anitaguptaoffice/sanguo-slg/issues/845) / [#832](https://github.com/anitaguptaoffice/sanguo-slg/pull/832) `bd66eab9`） | 已合 |
| **网关冒烟**（小地图军情同步+phase 脉冲+出征交接+战报坐标互链+邮件战报+HUD 军事待办） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 39** / `TestINTG036Wave39SmokePath`（[#846](https://github.com/anitaguptaoffice/sanguo-slg/issues/846) / [#833](https://github.com/anitaguptaoffice/sanguo-slg/pull/833)） | 已合 |

**推荐串联**（在 [Wave 38](#wave-38-h5-主城队列-eta-分段将领忠诚双榜冷却招募商城币种hud-底栏深链社交退避日常队列预览1280组合manifestm4-出口--intg-035) 主城/社交栈基础上 **轮转**回世界/军情/战报/邮件/军事栈）：**小地图↔军情** 双向同步环（**CLIENT-220**）→ **军情** phase 变更脉冲与阶段条（**CLIENT-221**）→ **出征** 提交军情交接与新行军高亮（**CLIENT-222**）→ **战报** 坐标军情互链（**CLIENT-223**）→ **战报详情** 回合摘要军情互跳（**CLIENT-224**）→ **邮件** 战报 tab 与 outcome 筛选联动（**CLIENT-225**）→ **HUD** 军事待办深链脉冲（**CLIENT-226**）→ 视口 **1280×720** 世界军情战报邮件出征 manifest（**CLIENT-227**）；网关字段见 `tools/smoke/README.md` **INTG-036**。

**美术旁路**（**非** wave:39 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-136**（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb`）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修 + [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) 终验补丁 `ce61ee75`——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-220～227**。波次总览与 **DOCS-EXIT-031**（[#826](https://github.com/anitaguptaoffice/sanguo-slg/issues/826)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 39」。**工程全收口** main tip **`f298dd4f49708d52d34e1a72083b315e7e903481`**（INTG-036 [#833](https://github.com/anitaguptaoffice/sanguo-slg/pull/833) `f298dd4f`）；**实现全收口** tip **`bd66eab92abf2cae0e32bbb1e6c242d8411628f6`**（#832 CLIENT-227）；基线 wave:38 **全收口** tip **`d71eba7189e055e3256bba95c257221860d0d37a`**（DOCS-EXIT-030 [#814](https://github.com/anitaguptaoffice/sanguo-slg/pull/814) `d71eba71`；实现 tip **`f7572123`**）。

### 手动验收（1280 wave:39 组合 manifest CLIENT-227）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-sync-ring`（**CLIENT-220**）、**军情** `intel-row-minimap-sync-highlight` / `intel-phase-change-flash`（**CLIENT-221**；**CLIENT-205** 阶段条不退化）、**出征** `march-submit-intel-handoff-line` / `intel-new-march-highlight`（**CLIENT-222**）、**战报** `report-list-intel-jump-tag` / `report-round-summary-intel-link` / `data-action="open-intel-for-report"`（**CLIENT-223/224**；**CLIENT-207/208** 不退化）、**邮件** `mail-battle-category-sweep-line` + session `report-outcome-filter-bridge-v1`（**CLIENT-225**）、**HUD** `hud-military-todo-sweep` / `data-role="hud-military-todo-sweep-line"` / `hud-military-todo-pulse`（**CLIENT-226**；**CLIENT-216** 合并行不退化）与 **CLIENT-211/219** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave39WorldIntelBattleReportMailMarchHudNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-227）；`cd client && npm test` 绿。

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:39 DOM 钩子（软依赖 **CLIENT-220～226**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219** manifest 不退化。单测：`wave39WorldIntelBattleReportMailMarchHudNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-227）；`cd client && npm test` 绿。（[#845](https://github.com/anitaguptaoffice/sanguo-slg/issues/845) / [#832](https://github.com/anitaguptaoffice/sanguo-slg/pull/832) `bd66eab9`）

## Wave 40 H5 主城七槽队列抛光·将领面板壳·背包使用·日常领取·军团社交扫读·1280组合manifest（M4 出口 / INTG-037）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-037** 网关冒烟一致）。**范围外**同 Wave 39；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城七槽与建造募兵队列双向焦点抛光** | 正文 **wave:40（CLIENT-228）** bullet（[#850](https://github.com/anitaguptaoffice/sanguo-slg/issues/850) / [#861](https://github.com/anitaguptaoffice/sanguo-slg/pull/861)） | 已合 |
| **队列返回主城七槽滚动与 ring 记忆** | 正文 **wave:40（CLIENT-229）** bullet（[#851](https://github.com/anitaguptaoffice/sanguo-slg/issues/851) / [#868](https://github.com/anitaguptaoffice/sanguo-slg/pull/868)） | 已合 |
| **将领 hero 壳运行时挂载与 panelState 扫读** | 正文 **wave:40（CLIENT-230）** bullet（[#852](https://github.com/anitaguptaoffice/sanguo-slg/issues/852) / [#863](https://github.com/anitaguptaoffice/sanguo-slg/pull/863)） | 已合 |
| **将领列表↔详情返回高亮与筛选 chip 记忆抛光** | 正文 **wave:40（CLIENT-231）** bullet（[#853](https://github.com/anitaguptaoffice/sanguo-slg/issues/853) / [#860](https://github.com/anitaguptaoffice/sanguo-slg/pull/860)） | 已合 |
| **背包 UseConsumable 行内执行脉冲与经济错误反馈** | 正文 **wave:40（CLIENT-232）** bullet（[#854](https://github.com/anitaguptaoffice/sanguo-slg/issues/854) / [#862](https://github.com/anitaguptaoffice/sanguo-slg/pull/862)） | 已合 |
| **日常可领取首条 scroll-into-view 与领取进度脉冲** | 正文 **wave:40（CLIENT-233）** bullet（[#855](https://github.com/anitaguptaoffice/sanguo-slg/issues/855) / [#865](https://github.com/anitaguptaoffice/sanguo-slg/pull/865)） | 已合 |
| **军团职务分组头与聊天未读分隔线扫读** | 正文 **wave:40（CLIENT-234）** bullet（[#856](https://github.com/anitaguptaoffice/sanguo-slg/issues/856) / [#867](https://github.com/anitaguptaoffice/sanguo-slg/pull/867)） | 已合 |
| **1280 主城将领背包日常军团组合 manifest** | [手动验收（1280 wave:40 组合 manifest CLIENT-235）](#手动验收1280-wave40-组合-manifest-client-235)（[#857](https://github.com/anitaguptaoffice/sanguo-slg/issues/857) / [#864](https://github.com/anitaguptaoffice/sanguo-slg/pull/864) `fe533816`） | 已合 |
| **网关冒烟**（主城槽位队列抛光+将领 hero 壳+背包 UseConsumable+日常领取+军团社交扫读） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 40** / `TestINTG037Wave40SmokePath`（[#858](https://github.com/anitaguptaoffice/sanguo-slg/issues/858) / [#866](https://github.com/anitaguptaoffice/sanguo-slg/pull/866)） | 已合 |

**推荐串联**（在 [Wave 39](#wave-39-h5-世界小地图军情双向同步军情-phase-变更脉冲出征军情交接战报坐标军情互链邮件战报联动hud-军事待办深链1280组合manifestm4-出口--intg-036) 世界/军情/战报/邮件栈基础上 **轮转**回主城/将领/背包/日常/军团栈）：**七槽↔队列** 双向焦点抛光（**CLIENT-228**）→ **队列** 返回主城槽位滚动与 ring 记忆（**CLIENT-229**）→ **将领** hero 壳挂载与 panelState（**CLIENT-230**）→ **将领** 列表↔详情返回高亮与筛选 chip（**CLIENT-231**）→ **背包** `UseConsumable` 行内脉冲与经济错误（**CLIENT-232**）→ **日常** 可领首条 scroll 与领取进度脉冲（**CLIENT-233**）→ **军团** 职务分组头与聊天未读分隔线（**CLIENT-234**）→ 视口 **1280×720** 主城将领背包日常军团 manifest（**CLIENT-235**）；网关字段见 `tools/smoke/README.md` **INTG-037**。

**美术旁路**（**非** wave:40 backlog 实现卡）：**CLIENT-064**（[#347](https://github.com/anitaguptaoffice/sanguo-slg/issues/347)）；**CLIENT-136**（[#552](https://github.com/anitaguptaoffice/sanguo-slg/pull/552) `f26ed1cb`）；**CLIENT-137**（[#556](https://github.com/anitaguptaoffice/sanguo-slg/issues/556) / [#574](https://github.com/anitaguptaoffice/sanguo-slg/pull/574)）；**CLIENT-146**（[#578](https://github.com/anitaguptaoffice/sanguo-slg/issues/578) / [#579](https://github.com/anitaguptaoffice/sanguo-slg/pull/579)）；**CLIENT-147**（FILTER-008 旁路）；**ART-012**（[#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698) 工程修 + [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) 终验补丁 `ce61ee75`——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-228～235**。波次总览与 **DOCS-EXIT-032**（[#859](https://github.com/anitaguptaoffice/sanguo-slg/issues/859)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 40」。**工程全收口** main tip **`d4f37ce761a2e07de68ee645e4c70a5a0997a7b0`**（INTG-037 [#866](https://github.com/anitaguptaoffice/sanguo-slg/pull/866) `d4f37ce7`）；**实现全收口** tip **`fe533816afe525fb4647e4ea02b5650a9ba068b3`**（#864 CLIENT-235）；基线 wave:39 **全收口** tip **`3d62bd3ab9807acb9e3d6cc18b081af6e3af3f99`**（DOCS-EXIT-031 [#848](https://github.com/anitaguptaoffice/sanguo-slg/pull/848) `3d62bd3a`；实现 tip **`bd66eab9`**）。

### 手动验收（1280 wave:40 组合 manifest CLIENT-235）

视口 **1280×720** `layout-narrow`：**七槽/队列** `domestic-slot-queue-focus-ring` / `domestic-slot-return-ring` + session `domestic-slot-scroll-v1`（**CLIENT-228/229**；**CLIENT-180/197/212** 不退化）、**将领** `data-art-panel="ui.panel.hero.v1"`（**CLIENT-230**；**CLIENT-213** 忠诚次行不退化）、`hero-list-return-highlight` + `hero-list-filter-v1`（**CLIENT-231**；**CLIENT-199** 不退化）、**背包** `bag-use-consumable-pulse` / `bag-use-economy-error-line`（**CLIENT-232**；**CLIENT-112/194** 不退化）、**日常** `data-role="daily-claimable-scroll-anchor"` / `quest-claim-progress-pulse`（**CLIENT-233**；**CLIENT-174/193** 不退化）、**军团** `data-role="guild-role-group-header-line"` / `guild-chat-unread-separator`（**CLIENT-234**；**CLIENT-185/217** 不退化）与 **CLIENT-219/227** 同级窄屏契约（**非** wave:39 世界军情 manifest 面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/背包/日常密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave40MainCityHeroBagDailyGuildNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-235）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/背包/日常/军团** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:40 DOM 钩子（软依赖 **CLIENT-228～234**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227** manifest 不退化。单测：`wave40MainCityHeroBagDailyGuildNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-235）；`cd client && npm test` 绿。（[#857](https://github.com/anitaguptaoffice/sanguo-slg/issues/857) / [#864](https://github.com/anitaguptaoffice/sanguo-slg/pull/864) `fe533816`）

## Wave 55 H5 世界小地图军情 scroll-sync 残余巩固再加深四层（CLIENT-348 起）

在 [Wave 54](#wave-54-h5-主城队列-eta-完成焦点残余巩固再加深四层client-340-起) 主城/将领/队列栈基础上 **轮转回**世界/军情栈做 **scroll-sync 与格点 ETA 对照残余巩固再加深四层**；**仍** DATA-002；**无**新 world RPC；范围外同 Wave 52/53/54。

**wave:55（CLIENT-348）小地图视口锚点与军情列表 scroll-sync 残余巩固再加深四层**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeepestDeepestDeepest`** 在 **CLIENT-332** `syncMinimapViewportIntelScrollResidualDeepestDeepestDeeper` 与 **`minimap-intel-scroll-sync-residual-deepest-deepest-deeper-ring` 1.5s** 之上叠加 **`minimap-intel-scroll-sync-residual-deepest-deepest-deepest-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:53 CLIENT-332 首版巩固再加深三层标题复刻主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestLine`** / `world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line` **巩固再加深四层第五行** **`world-tile-intel-eta-cross-residual-deepest-deepest-deepest-pulse` 1.5s** 只读对照（**CLIENT-332** `formatWorldTileIntelEtaCrossResidualDeepestDeepestDeeperLine` / deepest-deepest-deeper 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeepestDeepestDeepest.test.ts`、`worldTileIntelEtaCrossResidualDeepestDeepestDeepest.test.ts`；`cd client && npm test` 绿。（Closes [#1607](https://github.com/anitaguptaoffice/sanguo-slg/issues/1607)）

## Wave 54 H5 主城队列 ETA 完成焦点残余巩固再加深四层（CLIENT-340 起）

在 [Wave 53](#wave-53-h5-世界小地图军情-scroll-sync-残余巩固再加深三层client-332-起) 世界/军情栈基础上 **轮转回**主城/将领/队列栈做 **残余巩固再加深四层**；**仍** DATA-002；**无**主城建造新 RPC；范围外同 Wave 52/53。

**wave:54（CLIENT-340）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深四层**：队列行在 **CLIENT-324** 巩固再加深三层第六行下追加 **`formatDomesticQueueEtaSegmentResidualDeepestDeepestDeepestLabel`**（**`domestic-queue-eta-segment-residual-deepest-deepest-deepest-label`** 巩固再加深四层分段阈值 + **`domestic-queue-eta-segment-residual-deepest-deepest-deepest-finish`** 完成倒计时只读第七行；**CLIENT-212/244/260/276/292/308/324** **不退化**；**非** wave:52 CLIENT-324 首版巩固再加深三层标题复刻主叙事）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deepest-deepest-deepest-ring` 3.5s**（与 **CLIENT-324** `domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeepestDeepestDeepest.test.ts`、`domesticQueueCompleteFocusResidualDeepestDeepestDeepestRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。（Closes [#1586](https://github.com/anitaguptaoffice/sanguo-slg/issues/1586)）

## Wave 53 H5 世界小地图军情 scroll-sync 残余巩固再加深三层（CLIENT-332 起）

在 [Wave 52](#wave-52-h5-主城队列-eta-完成焦点残余巩固再加深三层client-324-起) 主城/将领/队列栈基础上 **轮转回**世界/军情栈做 **scroll-sync 与格点 ETA 对照残余巩固再加深三层**；**仍** DATA-002；**无**新 world RPC；范围外同 Wave 50/51/52。

**wave:53（CLIENT-332）小地图视口锚点与军情列表 scroll-sync 残余巩固再加深三层**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeepestDeepestDeeper`** 在 **CLIENT-316** `syncMinimapViewportIntelScrollResidualDeepestDeeper` 与 **`minimap-intel-scroll-sync-residual-deepest-deeper-ring` 1.5s** 之上叠加 **`minimap-intel-scroll-sync-residual-deepest-deepest-deeper-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:51 CLIENT-316 首版巩固再加深二层标题复刻主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeepestDeepestDeeperLine`** / `world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line` **巩固再加深三层第五行** **`world-tile-intel-eta-cross-residual-deepest-deepest-deeper-pulse` 1.5s** 只读对照（**CLIENT-316** `formatWorldTileIntelEtaCrossResidualDeepestDeeperLine` / deepest-deeper 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeepestDeepestDeeper.test.ts`、`worldTileIntelEtaCrossResidualDeepestDeepestDeeper.test.ts`；`cd client && npm test` 绿。（Closes [#1565](https://github.com/anitaguptaoffice/sanguo-slg/issues/1565)）

## Wave 52 H5 主城队列 ETA 完成焦点残余巩固再加深三层（CLIENT-324 起）

在 [Wave 51](#wave-51-h5-世界小地图军情-scroll-sync-残余巩固再加深二层client-316-起) 世界/军情栈基础上 **轮转回**主城/将领/队列栈做 **残余巩固再加深三层**；**仍** DATA-002；**无**主城建造新 RPC；范围外同 Wave 50/51。

**wave:52（CLIENT-324）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深三层**：队列行在 **CLIENT-308** 巩固再加深二层第五行下追加 **`formatDomesticQueueEtaSegmentResidualDeepestDeepestDeeperLabel`**（**`domestic-queue-eta-segment-residual-deepest-deepest-deeper-label`** 巩固再加深三层分段阈值 + **`domestic-queue-eta-segment-residual-deepest-deepest-deeper-finish`** 完成倒计时只读第六行；**CLIENT-212/244/260/276/292/308** **不退化**；**非** wave:50 CLIENT-308 首版巩固再加深二层标题复刻主叙事）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring` 3.5s**（与 **CLIENT-308** `domestic-queue-complete-focus-residual-deepest-deeper-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeepestDeepestDeeper.test.ts`、`domesticQueueCompleteFocusResidualDeepestDeepestDeeperRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。（Closes [#1544](https://github.com/anitaguptaoffice/sanguo-slg/issues/1544)）

## Wave 52 H5 双榜刷新冷却戳记与钉选保持残余巩固再加深三层（CLIENT-328）

在 [Wave 50](#wave-50-h5-双榜刷新冷却戳记与钉选保持残余巩固再加深二层client-312) **CLIENT-312** 双榜钉选保持栈基础上 **巩固再加深三层**；主叙事 **非** wave:51 **CLIENT-321** 排行招募密度扫读重复；**仍** DATA-002；**无**新 rank RPC；范围外同 Wave 50/51。

**wave:52（CLIENT-328）双榜刷新冷却戳记与钉选保持残余巩固再加深三层**：**CLIENT-312** 巩固再加深二层第四行下只读 **`formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp`** / **`rank-refresh-cooldown-residual-deepest-deepest-deeper-stamp`** / `data-role="rank-refresh-cooldown-residual-deepest-deepest-deeper"`（冷却窗口内合并 **冷却剩余** + **上次刷新** + **手动刷新次数** 只读 **巩固再加深三层** 第四行；**CLIENT-296/214** **不退化**；**无**新 rank RPC；**非** wave:51 **CLIENT-321** 排行密度/招募摘要主叙事）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deepest-deepest-deeper-ring` 3s**（**CLIENT-264** 环 **不退化**）。单测：`rankRefreshCooldownResidualDeepestDeepestDeeper.test.ts`、`rankPinKeepResidualDeepestDeepestDeeperRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1548](https://github.com/anitaguptaoffice/sanguo-slg/issues/1548)）

## Wave 54 H5 将领列表忠诚次行与详情养成道具扫读残余巩固再加深四层（CLIENT-342）

在 [Wave 52](#wave-52-h5-将领列表忠诚次行与详情养成道具扫读残余巩固再加深三层client-326) **CLIENT-326** 将领养成扫读栈基础上 **巩固再加深四层**；主叙事 **非** wave:53 **CLIENT-337** 排行招募密度栈；**仍** DATA-002；**无** hero 专用升级 RPC；**非** ART-012 / #983/#108/#697 像素任务。

**wave:54（CLIENT-342）将领列表忠诚次行与详情养成道具扫读残余巩固再加深四层**：列表 **`formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline`** / **`hero-list-row-loyalty-residual-deepest-deepest-deepest-subline`**（忠诚 + 经验进度只读巩固再加深四层第四行；**CLIENT-326** `hero-list-row-loyalty-residual-deepest-deepest-deeper-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeepestDeepestDeepestSweep`** / **`hero-detail-consumable-stack-residual-deepest-deepest-deepest-sweep`** + **`hero-detail-consumable-stack-residual-deepest-deepest-deepest-sweep-ring` 3s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** 壳与 **CLIENT-326** 再加深三层扫读 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeepestDeepestDeepestSubline.test.ts`、`heroDetailConsumableStackResidualDeepestDeepestDeepestSweep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1588](https://github.com/anitaguptaoffice/sanguo-slg/issues/1588)）

## Wave 54 H5 双榜刷新冷却戳记与钉选保持残余巩固再加深四层（CLIENT-344）

在 [Wave 52](#wave-52-h5-双榜刷新冷却戳记与钉选保持残余巩固再加深三层client-328) **CLIENT-328** 双榜钉选保持栈基础上 **巩固再加深四层**；主叙事 **非** wave:53 **CLIENT-337** 排行招募密度扫读重复；**仍** DATA-002；**无**新 rank RPC；范围外同 Wave 52/53。

**wave:54（CLIENT-344）双榜刷新冷却戳记与钉选保持残余巩固再加深四层**：**CLIENT-328** 巩固再加深三层第四行下只读 **`formatRankRefreshCooldownResidualDeepestDeepestDeepestStamp`** / **`rank-refresh-cooldown-residual-deepest-deepest-deepest-stamp`** / `data-role="rank-refresh-cooldown-residual-deepest-deepest-deepest"`（冷却窗口内合并 **冷却剩余** + **上次刷新** + **手动刷新次数** 只读 **巩固再加深四层** 第四行；**CLIENT-328/214** **不退化**；**无**新 rank RPC；**非** wave:53 **CLIENT-337** 排行密度/招募摘要主叙事）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deepest-deepest-deepest-ring` 3s**（**CLIENT-264** 环 **不退化**）。单测：`rankRefreshCooldownResidualDeepestDeepestDeepest.test.ts`、`rankPinKeepResidualDeepestDeepestDeepestRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1590](https://github.com/anitaguptaoffice/sanguo-slg/issues/1590)）

## Wave 52 H5 将领列表忠诚次行与详情养成道具扫读残余巩固再加深三层（CLIENT-326）

在 [Wave 50](#wave-50-h5-主城队列-eta-完成焦点残余巩固再加深二层队列预览槽位互链再加深二层将领养成扫读再加深二层panelstate-筛选再加深二层双榜钉选再加深二层军团聊天再加深二层日常-hud-深链再加深二层1280-组合-manifest-巩固再加深二层m4-出口--intg-050) **CLIENT-310** 将领养成扫读栈基础上 **巩固再加深三层**；主叙事 **非** wave:51 **CLIENT-321** 排行招募密度栈；**仍** DATA-002；**无** hero 专用升级 RPC；**非** ART-012 / #983/#108/#697 像素任务。

**wave:52（CLIENT-326）将领列表忠诚次行与详情养成道具扫读残余巩固再加深三层**：列表 **`formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline`** / **`hero-list-row-loyalty-residual-deepest-deepest-deeper-subline`**（忠诚 + 经验进度只读巩固再加深三层第四行；**CLIENT-294** `hero-list-row-loyalty-residual-deepest-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep`** / **`hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep`** + **`hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep-ring` 3s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** 壳与 **CLIENT-310** 再加深二层扫读 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeepestDeepestDeeperSubline.test.ts`、`heroDetailConsumableStackResidualDeepestDeepestDeeperSweep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1546](https://github.com/anitaguptaoffice/sanguo-slg/issues/1546)）

## Wave 51 H5 世界小地图军情 scroll-sync 残余巩固再加深二层（CLIENT-316 起）

在 [Wave 50](#wave-50-h5-主城队列-eta-完成焦点残余巩固再加深二层client-308-起) 主城栈基础上 **轮转回**世界/军情栈做 **scroll-sync 与格点 ETA 对照残余巩固再加深二层**；**仍** DATA-002；**无**新 world RPC；范围外同 Wave 49/50。

**wave:51（CLIENT-316）小地图视口锚点与军情列表 scroll-sync 残余巩固再加深二层**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeepestDeeper`** 在 **CLIENT-300** `syncMinimapViewportIntelScrollResidualDeepest` 与 **`minimap-intel-scroll-sync-residual-deepest-ring` 1.5s** 之上叠加 **`minimap-intel-scroll-sync-residual-deepest-deeper-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:49 CLIENT-300 首版巩固再加深一层标题复刻主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeepestDeeperLine`** / `world-tile-intel-eta-cross-residual-deepest-deeper-line` **巩固再加深二层第五行** **`world-tile-intel-eta-cross-residual-deepest-deeper-pulse` 1.5s** 只读对照（**CLIENT-300** `formatWorldTileIntelEtaCrossResidualDeepestLine` / deepest 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeepestDeeper.test.ts`、`worldTileIntelEtaCrossResidualDeepestDeeper.test.ts`；`cd client && npm test` 绿。（Closes [#1539](https://github.com/anitaguptaoffice/sanguo-slg/issues/1539)）

## Wave 50 H5 主城队列 ETA 完成焦点残余巩固再加深二层（CLIENT-308 起）

在 [Wave 49](#wave-49-h5-世界小地图军情-scroll-sync-残余巩固再加深一层出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固再加深一层m4-出口--intg-049) 世界栈基础上 **轮转回**主城/将领/队列栈做 **残余巩固再加深二层**；**仍** DATA-002；**无**主城建造新 RPC；范围外同 Wave 48/49。

**wave:50（CLIENT-308）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深二层**：队列行在 **CLIENT-292** 巩固再加深一层第四行下追加 **`formatDomesticQueueEtaSegmentResidualDeepestDeeperLabel`**（**`domestic-queue-eta-segment-residual-deepest-deeper-label`** 巩固再加深二层分段阈值 + **`domestic-queue-eta-segment-residual-deepest-deeper-finish`** 完成倒计时只读第五行；**CLIENT-212/244/260/276/292** **不退化**；**非** wave:48 CLIENT-292 首版巩固再加深一层标题复刻主叙事）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deepest-deeper-ring` 3.5s**（与 **CLIENT-292** `domestic-queue-complete-focus-residual-deepest-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeepestDeeper.test.ts`、`domesticQueueCompleteFocusResidualDeepestDeeperRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。（Closes [#1501](https://github.com/anitaguptaoffice/sanguo-slg/issues/1501)）

## Wave 49 H5 世界小地图军情 scroll-sync 残余巩固再加深一层（CLIENT-300 起）

在 [Wave 48](#wave-48-h5-主城队列-eta-完成焦点残余巩固再加深一层队列预览槽位互链再加深一层将领养成扫读再加深一层panelstate-筛选再加深一层双榜钉选再加深一层军团聊天再加深一层日常-hud-深链再加深一层1280-组合-manifest-巩固再加深一层m4-出口--intg-048) 主城栈基础上 **轮转回**世界/军情栈；**仍** DATA-002；**无**新 world RPC；范围外同 Wave 47/48。

## Wave 50 H5 双榜刷新冷却戳记与钉选保持残余巩固再加深二层（CLIENT-312）

在 [Wave 48](#wave-48-h5-主城栈残余巩固再加深一层client-292299--intg-048) **CLIENT-296** 双榜钉选保持栈基础上 **巩固再加深二层**；主叙事 **非** wave:49 **CLIENT-305** 排行招募密度扫读重复；**仍** DATA-002；**无**新 rank RPC；范围外同 Wave 48/49。

**wave:50（CLIENT-312）双榜刷新冷却戳记与钉选保持残余巩固再加深二层**：**CLIENT-296** 巩固再加深一层第三行下只读 **`formatRankRefreshCooldownResidualDeepestDeeperStamp`** / **`rank-refresh-cooldown-residual-deepest-deeper-stamp`** / `data-role="rank-refresh-cooldown-residual-deepest-deeper"`（冷却窗口内合并 **冷却剩余** + **上次刷新** + **手动刷新次数** 只读 **巩固再加深二层** 第四行；**CLIENT-296/214** **不退化**；**无**新 rank RPC；**非** wave:49 **CLIENT-305** 排行密度/招募摘要主叙事）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deepest-deeper-ring` 3s**（**CLIENT-264** 环 **不退化**）。单测：`rankRefreshCooldownResidualDeepestDeeper.test.ts`、`rankPinKeepResidualDeepestDeeperRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1505](https://github.com/anitaguptaoffice/sanguo-slg/issues/1505)）

**wave:50（CLIENT-310）将领列表忠诚次行与详情养成道具扫读残余巩固再加深二层**：列表 **`formatHeroListLoyaltyResidualDeepestDeeperSubline`** / **`hero-list-row-loyalty-residual-deepest-deeper-subline`**（忠诚 + 经验进度只读巩固再加深二层第四行；**CLIENT-294** `hero-list-row-loyalty-residual-deepest-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeepestDeeperSweep`** / **`hero-detail-consumable-stack-residual-deepest-deeper-sweep`** + **`hero-detail-consumable-stack-residual-deepest-deeper-sweep-ring` 3s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** 壳与 **CLIENT-294** 再加深一层扫读 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeepestDeeperSubline.test.ts`、`heroDetailConsumableStackResidualDeepestDeeperSweep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1503](https://github.com/anitaguptaoffice/sanguo-slg/issues/1503)）

**wave:49（CLIENT-300）小地图视口锚点与军情列表 scroll-sync 残余巩固再加深一层**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeepest`** 在 **CLIENT-284** `syncMinimapViewportIntelScrollResidualDeeper` 与 **`minimap-intel-scroll-sync-residual-deeper-ring` 1.5s** 之上叠加 **`minimap-intel-scroll-sync-residual-deepest-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:47 CLIENT-284 首版巩固再加深标题复刻主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeepestLine`** / `world-tile-intel-eta-cross-residual-deepest-line` **巩固再加深一层第五行** **`world-tile-intel-eta-cross-residual-deepest-pulse` 1.5s** 只读对照（**CLIENT-284** `formatWorldTileIntelEtaCrossResidualDeeperLine` / deeper 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeepest.test.ts`、`worldTileIntelEtaCrossResidualDeepest.test.ts`；`cd client && npm test` 绿。（Closes [#1400](https://github.com/anitaguptaoffice/sanguo-slg/issues/1400)）

## Wave 48 H5 主城队列 ETA 完成焦点残余巩固再加深一层（CLIENT-292 起）

在 [Wave 47](#wave-47-h5-世界小地图军情-scroll-sync-残余巩固再加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固再加深m4-出口--intg-047) 世界栈基础上 **轮转回**主城/将领/队列栈；**仍** DATA-002；**无**主城建造新 RPC；范围外同 Wave 47。
**wave:48（CLIENT-292）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深一层**：队列行在 **CLIENT-276** 巩固再加深第四行下追加 **`formatDomesticQueueEtaSegmentResidualDeepestLabel`**（**`domestic-queue-eta-segment-residual-deepest-label`** 巩固再加深一层分段相位 + **`domestic-queue-eta-segment-residual-deepest-finish`** 完成倒计时只读第四行；**CLIENT-212/244/260/276** **不退化**；**非** wave:46 CLIENT-276 首版巩固标题复刻主叙事）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deepest-ring` 3s**（与 **CLIENT-276** `domestic-queue-complete-focus-residual-deeper-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeepest.test.ts`、`domesticQueueCompleteFocusResidualDeepestRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。（Closes [#1379](https://github.com/anitaguptaoffice/sanguo-slg/issues/1379)）

## Wave 48 H5 主城队列预览槽位互链残余巩固再加深一层（CLIENT-293 起）

在 [Wave 46](#wave-46-h5-主城队列-eta-完成焦点残余巩固再加深队列预览槽位互链再加深将领养成扫读再加深panelstate-筛选再加深双榜钉选再加深军团聊天再加深日常-hud-深链再加深1280-组合-manifest-巩固再加深m4-出口--intg-043) 主城栈基础上 **轮转回**队列预览互链栈做 **残余巩固再加深一层**；**仍** DATA-002；**无**新 domestic RPC；范围外同 Wave 46/47。

**wave:48（CLIENT-293）队列下一完成预览与七槽互链残余巩固再加深一层**：在 **CLIENT-277** 巩固再加深行下追加 **`formatNextQueueFinishPreviewResidualDeepestLine`** / **`queue-next-finish-preview-residual-deepest-line`**（双队列类型 + 槽位标签 + 下一完成 ETA 只读 **巩固再加深一层** 摘要；**CLIENT-277/261/245/218 不退化**；**非** wave:46 CLIENT-277 首版巩固主叙事重复）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deepest-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deepest-ring` 2.5s** 最深环（叠 **CLIENT-277** 更深环与 **CLIENT-292** `domestic-queue-complete-focus-residual-deepest-ring` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeepest.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。（Closes [#1380](https://github.com/anitaguptaoffice/sanguo-slg/issues/1380)）

## Wave 50 H5 主城队列预览槽位互链残余巩固再加深二层（CLIENT-309）

在 [Wave 48](#wave-48-h5-主城队列预览槽位互链残余巩固再加深一层client-293-起) 队列预览互链栈基础上 **残余巩固再加深二层**；主叙事 **非** wave:48 CLIENT-293 首版巩固再加深一层标题复刻 / wave:49 世界军情战报栈重复；**仍** DATA-002；**无**新 domestic RPC；范围外同 Wave 48/49。

**wave:50（CLIENT-309）队列下一完成预览与七槽互链残余巩固再加深二层**：在 **CLIENT-293** 巩固再加深一层行下追加 **`formatNextQueueFinishPreviewResidualDeepestDeeperLine`** / **`queue-next-finish-preview-residual-deepest-deeper-line`**（双队列类型 + 槽位标签 + 下一完成 ETA 只读 **巩固再加深二层** 摘要；**CLIENT-293/277/261/245/218 不退化**；**非** wave:48 CLIENT-293 首版巩固再加深一层主叙事重复）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deepest-deeper-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deepest-deeper-ring` 3s** 更深环（叠 **CLIENT-293** 最深环与 **CLIENT-308** `domestic-queue-complete-focus-residual-deepest-deeper-ring` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeepestDeeper.test.ts`、`domesticQueueCompleteFocusResidualDeepestDeeperRing.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。（Closes [#1502](https://github.com/anitaguptaoffice/sanguo-slg/issues/1502)）

## Wave 52 H5 主城队列预览槽位互链残余巩固再加深三层（CLIENT-325）

在 [Wave 50](#wave-50-h5-主城队列预览槽位互链残余巩固再加深二层client-309) 队列预览互链栈基础上 **残余巩固再加深三层**；主叙事 **非** wave:50 CLIENT-309 首版巩固再加深二层标题复刻 / wave:51 世界军情战报栈重复；**仍** DATA-002；**无**新 domestic RPC；范围外同 Wave 50/51。

**wave:52（CLIENT-325）队列下一完成预览与七槽互链残余巩固再加深三层**：在 **CLIENT-309** 巩固再加深二层行下追加 **`formatNextQueueFinishPreviewResidualDeepestDeepestDeeperLine`** / **`queue-next-finish-preview-residual-deepest-deepest-deeper-line`**（双队列类型 + 槽位标签 + 下一完成 ETA 只读 **巩固再加深三层** 摘要；**CLIENT-293/277/261/245/218 不退化**；**非** wave:50 CLIENT-309 首版巩固再加深二层主叙事重复）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deepest-deepest-deeper-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deepest-deepest-deeper-ring` 3.5s** 更深环（叠 **CLIENT-309** 最深二层环与 **CLIENT-324** `domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeepestDeepestDeeper.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。（Closes [#1545](https://github.com/anitaguptaoffice/sanguo-slg/issues/1545)）

## Wave 54 H5 主城队列预览槽位互链残余巩固再加深四层（CLIENT-341）

在 [Wave 52](#wave-52-h5-主城队列预览槽位互链残余巩固再加深三层client-325) 队列预览互链栈基础上 **残余巩固再加深四层**；主叙事 **非** wave:52 CLIENT-325 首版巩固再加深三层标题复刻 / wave:53 世界军情战报栈重复；**仍** DATA-002；**无**新 domestic RPC；范围外同 Wave 52/53。

**wave:54（CLIENT-341）队列下一完成预览与七槽互链残余巩固再加深四层**：在 **CLIENT-325** 巩固再加深三层行下追加 **`formatNextQueueFinishPreviewResidualDeepestDeepestDeepestLine`** / **`queue-next-finish-preview-residual-deepest-deepest-deepest-line`**（双队列类型 + 槽位标签 + 下一完成 ETA 只读 **巩固再加深四层** 摘要；**CLIENT-309/293/277/261/245/218 不退化**；**非** wave:52 CLIENT-325 首版巩固再加深三层主叙事重复）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring` 3s** 更深环（叠 **CLIENT-325** 最深三层环与 **CLIENT-340** `domestic-queue-complete-focus-residual-deepest-deepest-deepest-ring` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeepestDeepestDeepest.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。（Closes [#1587](https://github.com/anitaguptaoffice/sanguo-slg/issues/1587)）

## Wave 49 H5 战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深一层（CLIENT-302）

在 [Wave 47](#wave-47-h5-世界小地图军情-scroll-sync-残余巩固再加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固再加深m4-出口--intg-047) 战报键盘/坐标栈基础上 **巩固再加深一层**；主叙事 **非** wave:48 主城/将领/日常 HUD 栈重复；**仍** DATA-002；**无**战报 proto 扩量；范围外同 Wave 47/48。

**wave:49（CLIENT-302）战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深一层**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-286** `report-list-keyboard-adjacent-nav-residual-deeper-ring` **2.5s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deepest-ring` 2.5s**（**CLIENT-239** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-286** `formatBattleReportCoordCopyBarResidualDeeperSweep` / **`battle-report-coord-copy-bar-residual-deeper-sweep` 2.5s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeepestSweep`** + **`battle-report-coord-copy-bar-residual-deepest-sweep` 2.5s** 巩固再加深一层扫读环（**CLIENT-240** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeepest.test.ts`、`battleReportCoordCopyBarResidualDeepestSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1402](https://github.com/anitaguptaoffice/sanguo-slg/issues/1402)）

## Wave 51 H5 战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深二层（CLIENT-318）

在 [Wave 49](#wave-49-h5-战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深一层client-302) 战报键盘/坐标栈基础上 **巩固再加深二层**；主叙事 **非** wave:50 主城/将领/日常 HUD 栈重复；**仍** DATA-002；**无**战报 proto 扩量；范围外同 Wave 49/50。

**wave:51（CLIENT-318）战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深二层**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-302** `report-list-keyboard-adjacent-nav-residual-deepest-ring` **2.5s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deepest-deeper-ring` 2.5s**（**CLIENT-239** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-302** `formatBattleReportCoordCopyBarResidualDeepestSweep` / **`battle-report-coord-copy-bar-residual-deepest-sweep` 2.5s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeepestDeeperSweep`** + **`battle-report-coord-copy-bar-residual-deepest-deeper-sweep` 2.5s** 巩固再加深二层扫读环（**CLIENT-240** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeepestDeeper.test.ts`、`battleReportCoordCopyBarResidualDeepestDeeperSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1535](https://github.com/anitaguptaoffice/sanguo-slg/issues/1535)）

## Wave 53 H5 战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深三层（CLIENT-334）

在 [Wave 51](#wave-51-h5-战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深二层client-318) 战报键盘/坐标栈基础上 **巩固再加深三层**；主叙事 **非** wave:52 主城/将领/日常 HUD 栈重复；**仍** DATA-002；**无**战报 proto 扩量；1280 组合 manifest 钩子软依赖 **CLIENT-339**；范围外同 Wave 51/52。

**wave:53（CLIENT-334）战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深三层**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-318** `report-list-keyboard-adjacent-nav-residual-deepest-deeper-ring` **2.5s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deepest-deepest-deeper-ring` 2.5s**（**CLIENT-286** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-318** `formatBattleReportCoordCopyBarResidualDeepestDeeperSweep` / **`battle-report-coord-copy-bar-residual-deepest-deeper-sweep` 2.5s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeepestDeepestDeeperSweep`** + **`battle-report-coord-copy-bar-residual-deepest-deepest-deeper-sweep` 2.5s** 巩固再加深三层扫读环（**CLIENT-286** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeper.test.ts`、`battleReportCoordCopyBarResidualDeepestDeepestDeeperSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1567](https://github.com/anitaguptaoffice/sanguo-slg/issues/1567)）

## Wave 55 H5 战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深四层（CLIENT-350）

在 [Wave 53](#wave-53-h5-战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深三层client-334) 战报键盘/坐标栈基础上 **巩固再加深四层**；主叙事 **非** wave:54 主城/将领/日常 HUD 栈重复；**仍** DATA-002；**无**战报 proto 扩量；范围外同 Wave 53/54。

**wave:55（CLIENT-350）战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深四层**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-334** `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deeper-ring` **2.5s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-ring` 2.5s**（**CLIENT-286** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-334** `formatBattleReportCoordCopyBarResidualDeepestDeepestDeeperSweep` / **`battle-report-coord-copy-bar-residual-deepest-deepest-deeper-sweep` 2.5s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep`** + **`battle-report-coord-copy-bar-residual-deepest-deepest-deepest-sweep` 2.5s** 巩固再加深四层扫读环（**CLIENT-286** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepest.test.ts`、`battleReportCoordCopyBarResidualDeepestDeepestDeepestSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1609](https://github.com/anitaguptaoffice/sanguo-slg/issues/1609)）

## Wave 47 H5 世界小地图军情 scroll-sync 残余巩固再加深（CLIENT-284 起）
在 [Wave 46](#wave-46-h5-主城队列-eta-完成焦点残余巩固再加深队列预览槽位互链再加深将领养成扫读再加深panelstate-筛选再加深双榜钉选再加深军团聊天再加深日常-hud-深链再加深1280-组合-manifest-巩固再加深m4-出口--intg-043) 主城栈基础上 **轮转回**世界/军情栈；**仍** DATA-002；**无**新 world RPC；范围外同 Wave 46。
**wave:47（CLIENT-284）小地图视口锚点与军情列表 scroll-sync 残余巩固再加深**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeeper`** 在 **CLIENT-268** `syncMinimapViewportIntelScrollResidualDeep` 与 **`minimap-intel-scroll-sync-residual-deep-ring` 1.5s** 之上叠加 **`minimap-intel-scroll-sync-residual-deeper-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:45 CLIENT-268 首版巩固加深标题复刻主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeeperLine`** / `world-tile-intel-eta-cross-residual-deeper-line` **巩固再加深第四行** **`world-tile-intel-eta-cross-residual-deeper-pulse` 1.5s** 只读对照（**CLIENT-268** `formatWorldTileIntelEtaCrossResidualDeepLine` / deep 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeeper.test.ts`、`worldTileIntelEtaCrossResidualDeeper.test.ts`；`cd client && npm test` 绿。（Closes [#1283](https://github.com/anitaguptaoffice/sanguo-slg/issues/1283)）
**wave:47（CLIENT-286）战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-270** `report-list-keyboard-adjacent-nav-residual-deep-ring` **2.5s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deeper-ring` 2.5s**（**CLIENT-239** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-270** `formatBattleReportCoordCopyBarResidualDeepSweep` / **`battle-report-coord-copy-bar-residual-deep-sweep` 2.5s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeeperSweep`** + **`battle-report-coord-copy-bar-residual-deeper-sweep` 2.5s** 巩固再加深扫读环（**CLIENT-240** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeeper.test.ts`、`battleReportCoordCopyBarResidualDeeperSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（[#1285](https://github.com/anitaguptaoffice/sanguo-slg/issues/1285)）

## Wave 55 H5 世界小地图军情 scroll-sync 残余巩固再加深四层·出征戳记兵力余量再加深四层·战报键盘坐标复制再加深四层·邮件 HUD 附件再加深四层·背包商城返回再加深四层·排行招募扫读再加深四层·军情 phase 预填再加深四层·1280 组合 manifest 巩固再加深四层（M4 出口 / INTG-055）

在 [Wave 54](#wave-54-h5-主城七槽队列-eta-完成焦点残余巩固再加深四层队列预览槽位互链再加深四层将领养成扫读再加深四层panelstate-筛选-chip-再加深四层双榜钉选再加深四层军团聊天再加深四层日常-chain-队列-hud-深链再加深四层1280-主城将领日常社交队列组合-manifest-巩固再加深四层m4-出口--intg-054) 主城/将领栈基础上 **轮转回**世界/军情/战报/邮件/商城/排行栈做 **残余巩固再加深四层**（**residual-deepest-deepest-deepest**）；**非** wave:54 主城队列 / 将领养成 / 双榜钉选 / 军团聊天 / 日常 HUD 主叙事；**非** wave:53 CLIENT-332～339 **首版巩固再加深三层**重复堆叠。**范围外**同 Wave 54；**仍** DATA-002；实现卡 **CLIENT-348～355**（自 **CLIENT-348** 起）。

**wave:55（CLIENT-349）出征表单刷新戳记与兵力余量只读对照残余巩固再加深四层**：军事出征底栏在 **CLIENT-333** 巩固再加深三层第七行上追加 **`formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine`** / **`march-form-troop-margin-residual-deepest-deepest-deepest-line`** 兵力余量 ↔ 钱包只读 **巩固再加深四层** 第八行对照（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deepest-deepest-deepest`** 在 **CLIENT-333** 戳记上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deepest-deepest-deepest-pulse`** 与 **CLIENT-333** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeepestDeepestDeepest.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1608](https://github.com/anitaguptaoffice/sanguo-slg/issues/1608)）

## Wave 54 H5 主城七槽队列 ETA 完成焦点残余巩固再加深四层·队列预览槽位互链再加深四层·将领养成扫读再加深四层·panelState 筛选 chip 再加深四层·双榜钉选再加深四层·军团聊天再加深四层·日常 chain 队列 HUD 深链再加深四层·1280 主城将领日常社交队列组合 manifest 巩固再加深四层（M4 出口 / INTG-054）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-054** 网关冒烟一致）。在 [Wave 53](#wave-53-h5-世界小地图军情-scroll-sync-残余巩固再加深三层出征戳记兵力余量再加深三层战报键盘坐标复制再加深三层邮件-hud-附件再加深三层背包商城返回再加深三层排行招募扫读再加深三层军情-phase-预填再加深三层1280-组合-manifest-巩固再加深三层m4-出口--intg-053) 世界/军情栈基础上 **轮转回**主城/将领/队列/日常/社交/HUD 栈做 **残余巩固再加深四层**（**residual-deepest-deepest-deepest**：主城队列 ETA/完成焦点、队列预览槽位互链、将领养成道具扫读、panelState 与筛选 chip、双榜钉选刷新、军团聊天扫读、日常 chain·队列·HUD 底栏深链、1280 主城/将领/日常/社交/队列 manifest）；**非** wave:53 CLIENT-339 世界军情战报邮件商城排行 manifest 面板集。**范围外**同 Wave 53；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-340～347**（自 **CLIENT-340** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **1280 主城将领日常社交队列组合 manifest 巩固再加深四层** | [手动验收（1280 wave:54 组合 manifest 巩固再加深四层 CLIENT-347）](#手动验收1280-wave54-组合-manifest-巩固再加深四层-client-347)（[#1593](https://github.com/anitaguptaoffice/sanguo-slg/issues/1593) / [#1601](https://github.com/anitaguptaoffice/sanguo-slg/pull/1601) `39bfa38b`） | 已合 |

### 手动验收（1280 wave:54 组合 manifest 巩固再加深四层 CLIENT-347）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deepest-deepest-deepest-label` / `domestic-queue-eta-segment-residual-deepest-deepest-deepest-finish` / `domestic-queue-complete-focus-residual-deepest-deepest-deepest-ring`（**CLIENT-340**；**CLIENT-324/308/292** **不退化**）、`queue-next-finish-preview-residual-deepest-deepest-deepest-line` / `domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-ring`（**CLIENT-341**；**CLIENT-325/309** **不退化**）、**将领** `hero-list-row-loyalty-residual-deepest-deepest-deepest-subline` / `hero-detail-consumable-stack-residual-deepest-deepest-deepest-sweep`（**CLIENT-342**；**CLIENT-326/310** **不退化**）、`hero-panel-state-residual-deepest-deepest-deepest-sweep` + session `hero-list-filter-chip-residual-deepest-deepest-deepest-v1`（**CLIENT-343**；**CLIENT-327/311** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deepest-deepest-deepest-stamp` / `rank-pin-keep-residual-deepest-deepest-deepest-ring`（**CLIENT-344**；**CLIENT-328/312** **不退化**）、**军团/聊天** `guild-duty-header-residual-deepest-deepest-deepest-line` / `guild-chat-unread-divider-residual-deepest-deepest-deepest-sweep`（**CLIENT-345**；**CLIENT-329/313** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deepest-deepest-deepest-subline` / `hud-todo-toolbar-deep-link-residual-deepest-deepest-deepest-pulse`（**CLIENT-346**；**CLIENT-330/314** **不退化**）与 **CLIENT-331/339** 同级窄屏契约（**非** wave:53 CLIENT-339 世界栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave54MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-347）；`cd client && npm test` 绿。（Closes [#1593](https://github.com/anitaguptaoffice/sanguo-slg/issues/1593)）

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:54 DOM 钩子（软依赖 **CLIENT-340～346**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299/307/315/323/331/339** manifest 不退化。单测：`wave54MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-347）；`cd client && npm test` 绿。（Closes [#1593](https://github.com/anitaguptaoffice/sanguo-slg/issues/1593)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

## Wave 53 H5 世界小地图军情 scroll-sync 残余巩固再加深三层·出征戳记兵力余量再加深三层·战报键盘坐标复制再加深三层·邮件 HUD 附件再加深三层·背包商城返回再加深三层·排行招募扫读再加深三层·军情 phase 预填再加深三层·1280 组合 manifest 巩固再加深三层（M4 出口 / INTG-053）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-053** 网关冒烟一致）。在 [Wave 52](#wave-52-h5-主城七槽队列-eta-完成焦点残余巩固再加深三层队列预览槽位互链再加深三层将领养成扫读再加深三层panelstate-筛选-chip-再加深三层双榜钉选再加深三层军团聊天再加深三层日常-chain-队列-hud-深链再加深三层1280-主城将领日常社交队列组合-manifest-巩固再加深三层m4-出口--intg-052) 主城/将领栈基础上 **轮转回**世界/军情/战报/邮件/商城/排行栈做 **残余巩固再加深三层**（**residual-deepest-deepest-deeper**：小地图军情 scroll-sync、出征刷新戳记与兵力余量、战报键盘相邻导航与坐标复制、邮件 HUD 附件领取、背包/商城返回高亮、排行/招募扫读、军情 phase 再出征预填、1280 世界/军情/战报/邮件/商城/排行 manifest）；**非** wave:52 CLIENT-331 主城将领日常社交队列 manifest 面板集。**范围外**同 Wave 52；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-332～339**（自 **CLIENT-332** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固再加深三层** | 正文 **wave:53（CLIENT-332）** bullet（[#1565](https://github.com/anitaguptaoffice/sanguo-slg/issues/1565) / [#1579](https://github.com/anitaguptaoffice/sanguo-slg/pull/1579) `e37d1a81`） | 已合 |
| **出征表单刷新戳记与兵力余量只读对照残余巩固再加深三层** | 正文 **wave:53（CLIENT-333）** bullet（[#1566](https://github.com/anitaguptaoffice/sanguo-slg/issues/1566) / [#1577](https://github.com/anitaguptaoffice/sanguo-slg/pull/1577) `8868f2f7`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深三层** | 正文 **wave:53（CLIENT-334）** bullet（[#1567](https://github.com/anitaguptaoffice/sanguo-slg/issues/1567) / [#1582](https://github.com/anitaguptaoffice/sanguo-slg/pull/1582) `4fb43407`） | 已合 |
| **邮件附件领取与 HUD 邮件日常角标同步残余巩固再加深三层** | 正文 **wave:53（CLIENT-335）** bullet（[#1568](https://github.com/anitaguptaoffice/sanguo-slg/issues/1568) / [#1576](https://github.com/anitaguptaoffice/sanguo-slg/pull/1576) `579b94fc`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余巩固再加深三层** | 正文 **wave:53（CLIENT-336）** bullet（[#1569](https://github.com/anitaguptaoffice/sanguo-slg/issues/1569) / [#1581](https://github.com/anitaguptaoffice/sanguo-slg/pull/1581) `ad931c50`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余巩固再加深三层** | 正文 **wave:53（CLIENT-337）** bullet（[#1570](https://github.com/anitaguptaoffice/sanguo-slg/issues/1570) / [#1580](https://github.com/anitaguptaoffice/sanguo-slg/pull/1580) `c28fd965`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余巩固再加深三层** | 正文 **wave:53（CLIENT-338）** bullet（[#1571](https://github.com/anitaguptaoffice/sanguo-slg/issues/1571) / [#1578](https://github.com/anitaguptaoffice/sanguo-slg/pull/1578) `e3dcacf8`） | 已合 |
| **1280 世界军情战报邮件商城排行组合 manifest 巩固再加深三层** | [手动验收（1280 wave:53 组合 manifest 巩固再加深三层 CLIENT-339）](#手动验收1280-wave53-组合-manifest-巩固再加深三层-client-339)（[#1572](https://github.com/anitaguptaoffice/sanguo-slg/issues/1572) / [#1583](https://github.com/anitaguptaoffice/sanguo-slg/pull/1583) `0bb05e3b`） | 已合 |
| **网关冒烟**（世界军情 scroll-sync + 出征戳记兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填 **residual deepest-deepest-deeper** hints） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 53** / `TestINTG053Wave53SmokePath`（[#1573](https://github.com/anitaguptaoffice/sanguo-slg/issues/1573) / [#1575](https://github.com/anitaguptaoffice/sanguo-slg/pull/1575) `3f276fe8`） | 已合 |

**推荐串联**（在 [Wave 52](#wave-52-h5-主城七槽队列-eta-完成焦点残余巩固再加深三层队列预览槽位互链再加深三层将领养成扫读再加深三层panelstate-筛选-chip-再加深三层双榜钉选再加深三层军团聊天再加深三层日常-chain-队列-hud-深链再加深三层1280-主城将领日常社交队列组合-manifest-巩固再加深三层m4-出口--intg-052) 主城栈基础上 **轮转**回世界栈）：**世界** scroll-sync **巩固再加深三层**（**CLIENT-332**）→ **出征** 刷新戳记与兵力余量 **巩固再加深三层**（**CLIENT-333**）→ **战报** 键盘相邻导航与坐标复制 **巩固再加深三层**（**CLIENT-334**）→ **邮件** HUD 附件领取 **巩固再加深三层**（**CLIENT-335**）→ **背包/商城** 返回高亮 **巩固再加深三层**（**CLIENT-336**）→ **排行/招募** 扫读 **巩固再加深三层**（**CLIENT-337**）→ **军情** phase 再出征预填 **巩固再加深三层**（**CLIENT-338**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest **巩固再加深三层**（**CLIENT-339**）；网关字段见 `tools/smoke/README.md` **INTG-053**。

### 手动验收（1280 wave:53 组合 manifest 巩固再加深三层 CLIENT-339）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-residual-deepest-deepest-deeper-ring` + `world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line`（**CLIENT-332**；**CLIENT-316/300/284** **不退化**）、**军事出征** `march-form-troop-margin-residual-deepest-deepest-deeper-line` / `march-submit-intel-refresh-stamp-residual-deepest-deepest-deeper`（**CLIENT-333**；**CLIENT-317/301/285** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deeper-ring` / `battle-report-coord-copy-bar-residual-deepest-deepest-deeper-sweep`（**CLIENT-334**；**CLIENT-318/302/286** **不退化**）、**邮件** `mail-claim-hud-sync-residual-deepest-deepest-deeper-pulse` / `mail-attachment-claim-residual-deepest-deepest-deeper-subline`（**CLIENT-335**；**CLIENT-319/303/287** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-deepest-deepest-deeper-ring` / `panel-return-source-highlight-residual-deepest-deepest-deeper`（**CLIENT-336**；**CLIENT-320/304/288** **不退化**）、**排行/招募** `rank-list-density-scan-residual-deepest-deepest-deeper-line` / `recruit-template-inline-residual-deepest-deepest-deeper-summary`（**CLIENT-337**；**CLIENT-321/305/289** **不退化**）、**军情** `intel-phase-change-residual-deepest-deepest-deeper-pulse` / `intel-march-prefill-residual-deepest-deepest-deeper-line` + `prefill-march-form-from-intel-residual-deepest-deepest-deeper`（**CLIENT-338**；**CLIENT-322/306/290** **不退化**）与 **CLIENT-323/331** 同级窄屏契约（**非** wave:52 CLIENT-331 主城栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在 `layout-narrow` **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave53WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-339）；`cd client && npm test` 绿。（Closes [#1572](https://github.com/anitaguptaoffice/sanguo-slg/issues/1572)）

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:53 DOM 钩子（软依赖 **CLIENT-332～338**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299/307/315/323/331** manifest 不退化。单测：`wave53WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-339）；`cd client && npm test` 绿。（Closes [#1572](https://github.com/anitaguptaoffice/sanguo-slg/issues/1572)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:53 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-332～339**（自 **CLIENT-332** 起）。波次总览与 **DOCS-EXIT-045**（[#1574](https://github.com/anitaguptaoffice/sanguo-slg/issues/1574)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 53」。**工程全收口** tip **`3f276fe81fc8e4cbd5347f20ddf75a352af58e15`**（INTG-053 [#1575](https://github.com/anitaguptaoffice/sanguo-slg/pull/1575) `3f276fe8`）；**实现全收口** tip **`0bb05e3b3fe6807571a17fdc453884626f3bc55b`**（#1583 CLIENT-339）；基线 wave:52 **全收口** tip **`8121d2a44aebd98dfcf8ad49322371f63f24cfde`**（DOCS-EXIT-044 [#1563](https://github.com/anitaguptaoffice/sanguo-slg/pull/1563) `8121d2a4`；工程 tip **`cdf2654b`** #1554 INTG-052；实现 tip **`4d2956c8`** #1562 CLIENT-331）。波次 backlog [#1564](https://github.com/anitaguptaoffice/sanguo-slg/pull/1564)（`ab2bc196`）。

## Wave 52 H5 主城七槽队列 ETA 完成焦点残余巩固再加深三层·队列预览槽位互链再加深三层·将领养成扫读再加深三层·panelState 筛选 chip 再加深三层·双榜钉选再加深三层·军团聊天再加深三层·日常 chain 队列 HUD 深链再加深三层·1280 主城将领日常社交队列组合 manifest 巩固再加深三层（M4 出口 / INTG-052）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-052** 网关冒烟一致）。在 [Wave 51](#wave-51-h5-世界小地图军情-scroll-sync-残余巩固再加深二层出征戳记兵力余量再加深二层战报键盘坐标复制再加深二层邮件-hud-附件再加深二层背包商城返回再加深二层排行招募扫读再加深二层军情-phase-预填再加深二层1280-组合-manifest-巩固再加深二层m4-出口--intg-051) 世界/军情栈基础上 **轮转回**主城/将领/队列/日常/社交/HUD 栈做 **残余巩固再加深三层**（**residual-deepest-deepest-deeper**：主城队列 ETA/完成焦点、队列预览槽位互链、将领养成道具扫读、panelState 与筛选 chip、双榜钉选刷新、军团聊天扫读、日常 chain·队列·HUD 底栏深链、1280 主城/将领/日常/社交/队列 manifest）；**非** wave:51 CLIENT-323 世界军情战报邮件商城排行 manifest 面板集。**范围外**同 Wave 51；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-324～331**（自 **CLIENT-324** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深三层** | 正文 **wave:52（CLIENT-324）** bullet（[#1544](https://github.com/anitaguptaoffice/sanguo-slg/issues/1544) / [#1555](https://github.com/anitaguptaoffice/sanguo-slg/pull/1555) `ec10b963`） | 已合 |
| **队列下一完成预览与七槽互链残余巩固再加深三层** | 正文 **wave:52（CLIENT-325）** bullet（[#1545](https://github.com/anitaguptaoffice/sanguo-slg/issues/1545) / [#1561](https://github.com/anitaguptaoffice/sanguo-slg/pull/1561) `6d05ecac`） | 已合 |
| **将领列表忠诚次行与详情养成道具扫读残余巩固再加深三层** | 正文 **wave:52（CLIENT-326）** bullet（[#1546](https://github.com/anitaguptaoffice/sanguo-slg/issues/1546) / [#1560](https://github.com/anitaguptaoffice/sanguo-slg/pull/1560) `b3a73fee`） | 已合 |
| **将领 panelState 与列表筛选 chip 记忆残余抛光再加深三层** | 正文 **wave:52（CLIENT-327）** bullet（[#1547](https://github.com/anitaguptaoffice/sanguo-slg/issues/1547) / [#1559](https://github.com/anitaguptaoffice/sanguo-slg/pull/1559) `26fa101a`） | 已合 |
| **双榜刷新冷却戳记与钉选保持残余巩固再加深三层** | 正文 **wave:52（CLIENT-328）** bullet（[#1548](https://github.com/anitaguptaoffice/sanguo-slg/issues/1548) / [#1556](https://github.com/anitaguptaoffice/sanguo-slg/pull/1556) `120fe697`） | 已合 |
| **军团职务分组头与聊天未读分隔扫读残余巩固再加深三层** | 正文 **wave:52（CLIENT-329）** bullet（[#1549](https://github.com/anitaguptaoffice/sanguo-slg/issues/1549) / [#1557](https://github.com/anitaguptaoffice/sanguo-slg/pull/1557) `92b28a5d`） | 已合 |
| **日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深三层** | 正文 **wave:52（CLIENT-330）** bullet（[#1550](https://github.com/anitaguptaoffice/sanguo-slg/issues/1550) / [#1558](https://github.com/anitaguptaoffice/sanguo-slg/pull/1558) `a3833902`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest 巩固再加深三层** | [手动验收（1280 wave:52 组合 manifest 巩固再加深三层 CLIENT-331）](#手动验收1280-wave52-组合-manifest-巩固再加深三层-client-331)（[#1551](https://github.com/anitaguptaoffice/sanguo-slg/issues/1551) / [#1562](https://github.com/anitaguptaoffice/sanguo-slg/pull/1562) `4d2956c8`） | 已合 |
| **网关冒烟**（主城队列 ETA 巩固再加深三层 + 将领养成扫读 + 双榜钉选 + 军团聊天 + 日常 chain·队列·HUD 深链 **residual deepest-deepest-deeper** hints） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 52** / `TestINTG052Wave52SmokePath`（[#1552](https://github.com/anitaguptaoffice/sanguo-slg/issues/1552) / [#1554](https://github.com/anitaguptaoffice/sanguo-slg/pull/1554) `cdf2654b`） | 已合 |

**推荐串联**（在 [Wave 51](#wave-51-h5-世界小地图军情-scroll-sync-残余巩固再加深二层出征戳记兵力余量再加深二层战报键盘坐标复制再加深二层邮件-hud-附件再加深二层背包商城返回再加深二层排行招募扫读再加深二层军情-phase-预填再加深二层1280-组合-manifest-巩固再加深二层m4-出口--intg-051) 世界栈基础上 **轮转**回主城栈）：**队列** ETA/完成焦点 **巩固再加深三层**（**CLIENT-324**）→ **队列** 预览槽位互链 **再加深三层**（**CLIENT-325**）→ **将领** 养成道具扫读 **再加深三层**（**CLIENT-326**）→ **将领** panelState 与筛选 chip **抛光再加深三层**（**CLIENT-327**）→ **双榜** 钉选刷新 **巩固再加深三层**（**CLIENT-328**）→ **军团/聊天** 扫读 **再加深三层**（**CLIENT-329**）→ **日常/HUD** chain 队列深链 **再加深三层**（**CLIENT-330**）→ 视口 **1280×720** 主城将领日常社交队列 manifest **巩固再加深三层**（**CLIENT-331**）；网关字段见 `tools/smoke/README.md` **INTG-052**。

### 手动验收（1280 wave:52 组合 manifest 巩固再加深三层 CLIENT-331）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deepest-deepest-deeper-label` / `domestic-queue-eta-segment-residual-deepest-deepest-deeper-finish` / `domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring`（**CLIENT-324**；**CLIENT-308/292/276/260/244/212** **不退化**）、`queue-next-finish-preview-residual-deepest-deepest-deeper-line` / `domestic-slot-preview-cross-link-residual-deepest-deepest-deeper-ring`（**CLIENT-325**；**CLIENT-309/293/277/261/245/218** **不退化**）、**将领** `hero-list-row-loyalty-residual-deepest-deepest-deeper-subline` / `hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep`（**CLIENT-326**；**CLIENT-310/294/278/262/246/230** **不退化**）、`hero-panel-state-residual-deepest-deepest-deeper-sweep` + session `hero-list-filter-chip-residual-deepest-deepest-deeper-v1`（**CLIENT-327**；**CLIENT-311/295/279/263/247/231** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deepest-deepest-deeper-stamp` / `rank-pin-keep-residual-deepest-deepest-deeper-ring`（**CLIENT-328**；**CLIENT-312/296/280/264/248/214** **不退化**）、**军团/聊天** `guild-duty-header-residual-deepest-deepest-deeper-line` / `guild-chat-unread-divider-residual-deepest-deepest-deeper-sweep`（**CLIENT-329**；**CLIENT-313/297/281/265/249/234** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deepest-deepest-deeper-subline` / `hud-todo-toolbar-deep-link-residual-deepest-deepest-deeper-pulse`（**CLIENT-330**；**CLIENT-314/298/282/266/250/216** **不退化**）与 **CLIENT-315/323** 同级窄屏契约（**非** wave:51 CLIENT-323 世界栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave52MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-331）；`cd client && npm test` 绿。（Closes [#1551](https://github.com/anitaguptaoffice/sanguo-slg/issues/1551)）

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:52 DOM 钩子（软依赖 **CLIENT-324～330**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299/307/315/323** manifest 不退化。单测：`wave52MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-331）；`cd client && npm test` 绿。（Closes [#1551](https://github.com/anitaguptaoffice/sanguo-slg/issues/1551)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:52 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-324～331**（自 **CLIENT-324** 起）。波次总览与 **DOCS-EXIT-044**（[#1553](https://github.com/anitaguptaoffice/sanguo-slg/issues/1553)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 52」。**工程全收口** tip **`cdf2654ba229beb6957c2db1cf6735aa41594325`**（INTG-052 [#1554](https://github.com/anitaguptaoffice/sanguo-slg/pull/1554) `cdf2654b`）；**实现全收口** tip **`4d2956c8e6851b466e465e0d7b21b80fe434f850`**（#1562 CLIENT-331）；基线 wave:51 **全收口** tip **`509b74cbc3ad03c7ef1a00777d8c851627e68abd`**（DOCS-EXIT-043 [#1542](https://github.com/anitaguptaoffice/sanguo-slg/pull/1542) `509b74cb`；工程 tip **`0f1b958f`** #1532 INTG-051；实现 tip **`4fe4b269`** #1540 CLIENT-323）。波次 backlog [#1543](https://github.com/anitaguptaoffice/sanguo-slg/pull/1543)（`1658fb77`）。

## Wave 51 H5 世界小地图军情 scroll-sync 残余巩固再加深二层·出征戳记兵力余量再加深二层·战报键盘坐标复制再加深二层·邮件 HUD 附件再加深二层·背包商城返回再加深二层·排行招募扫读再加深二层·军情 phase 预填再加深二层·1280 组合 manifest 巩固再加深二层（M4 出口 / INTG-051）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-051** 网关冒烟一致）。在 [Wave 50](#wave-50-h5-主城队列-eta-完成焦点残余巩固再加深二层队列预览槽位互链再加深二层将领养成扫读再加深二层panelstate-筛选再加深二层双榜钉选再加深二层军团聊天再加深二层日常-hud-深链再加深二层1280-组合-manifest-巩固再加深二层m4-出口--intg-050) 主城栈基础上 **轮转回**世界/军情/战报/邮件/商城/排行栈做 **残余巩固再加深二层**（**residual-deepest-deeper**：小地图军情 scroll-sync、出征刷新戳记与兵力余量、战报键盘相邻导航与坐标复制、邮件 HUD 附件领取、背包/商城返回高亮、排行/招募扫读、军情 phase 再出征预填、1280 世界/军情/战报/邮件/商城/排行 manifest）；**非** wave:50 CLIENT-315 主城将领日常社交队列 manifest 面板集。**范围外**同 Wave 50；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-316～323**（自 **CLIENT-316** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固再加深二层** | 正文 **wave:51（CLIENT-316）** bullet（[#1539](https://github.com/anitaguptaoffice/sanguo-slg/issues/1539) / [#1539](https://github.com/anitaguptaoffice/sanguo-slg/pull/1539) `bc3ec8b4`） | 已合 |
| **出征表单刷新戳记与兵力余量只读对照残余巩固再加深二层** | 正文 **wave:51（CLIENT-317）** bullet（[#1534](https://github.com/anitaguptaoffice/sanguo-slg/issues/1534) / [#1534](https://github.com/anitaguptaoffice/sanguo-slg/pull/1534) `ec0c6000`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深二层** | 正文 **wave:51（CLIENT-318）** bullet（[#1535](https://github.com/anitaguptaoffice/sanguo-slg/issues/1535) / [#1535](https://github.com/anitaguptaoffice/sanguo-slg/pull/1535) `2efa9fb0`） | 已合 |
| **邮件附件领取与 HUD 邮件日常角标同步残余巩固再加深二层** | 正文 **wave:51（CLIENT-319）** bullet（[#1533](https://github.com/anitaguptaoffice/sanguo-slg/issues/1533) / [#1533](https://github.com/anitaguptaoffice/sanguo-slg/pull/1533) `19ff3a3c`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余巩固再加深二层** | 正文 **wave:51（CLIENT-320）** bullet（[#1536](https://github.com/anitaguptaoffice/sanguo-slg/issues/1536) / [#1536](https://github.com/anitaguptaoffice/sanguo-slg/pull/1536) `6ed945ee`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余巩固再加深二层** | 正文 **wave:51（CLIENT-321）** bullet（[#1537](https://github.com/anitaguptaoffice/sanguo-slg/issues/1537) / [#1537](https://github.com/anitaguptaoffice/sanguo-slg/pull/1537) `293f8d2d`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余巩固再加深二层** | 正文 **wave:51（CLIENT-322）** bullet（[#1538](https://github.com/anitaguptaoffice/sanguo-slg/issues/1538) / [#1538](https://github.com/anitaguptaoffice/sanguo-slg/pull/1538) `28817d3b`） | 已合 |
| **1280 世界军情战报邮件商城排行组合 manifest 巩固再加深二层** | [手动验收（1280 wave:51 组合 manifest 巩固再加深二层 CLIENT-323）](#手动验收1280-wave51-组合-manifest-巩固再加深二层-client-323)（[#1540](https://github.com/anitaguptaoffice/sanguo-slg/issues/1540) / [#1540](https://github.com/anitaguptaoffice/sanguo-slg/pull/1540) `4fe4b269`） | 已合 |
| **网关冒烟**（世界军情 scroll-sync + 出征戳记兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填 **residual deepest-deeper** hints） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 51** / `TestINTG051Wave51SmokePath`（[#1532](https://github.com/anitaguptaoffice/sanguo-slg/issues/1532) / [#1532](https://github.com/anitaguptaoffice/sanguo-slg/pull/1532) `0f1b958f`） | 已合 |

**推荐串联**（在 [Wave 50](#wave-50-h5-主城队列-eta-完成焦点残余巩固再加深二层队列预览槽位互链再加深二层将领养成扫读再加深二层panelstate-筛选再加深二层双榜钉选再加深二层军团聊天再加深二层日常-hud-深链再加深二层1280-组合-manifest-巩固再加深二层m4-出口--intg-050) 主城栈基础上 **轮转**回世界栈）：**世界** scroll-sync **巩固再加深二层**（**CLIENT-316**）→ **出征** 刷新戳记与兵力余量 **巩固再加深二层**（**CLIENT-317**）→ **战报** 键盘相邻导航与坐标复制 **巩固再加深二层**（**CLIENT-318**）→ **邮件** HUD 附件领取 **巩固再加深二层**（**CLIENT-319**）→ **背包/商城** 返回高亮 **巩固再加深二层**（**CLIENT-320**）→ **排行/招募** 扫读 **巩固再加深二层**（**CLIENT-321**）→ **军情** phase 再出征预填 **巩固再加深二层**（**CLIENT-322**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest **巩固再加深二层**（**CLIENT-323**）；网关字段见 `tools/smoke/README.md` **INTG-051**。

### 手动验收（1280 wave:51 组合 manifest 巩固再加深二层 CLIENT-323）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-residual-deepest-deeper-ring` + `world-tile-intel-eta-cross-residual-deepest-deeper-line`（**CLIENT-316**；**CLIENT-300/284** **不退化**）、**军事出征** `march-form-troop-margin-residual-deepest-deeper-line` / `march-submit-intel-refresh-stamp-residual-deepest-deeper`（**CLIENT-317**；**CLIENT-301/285** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-deepest-deeper-ring` / `battle-report-coord-copy-bar-residual-deepest-deeper-sweep`（**CLIENT-318**；**CLIENT-302/286** **不退化**）、**邮件** `mail-claim-hud-sync-residual-deepest-deeper-pulse` / `mail-attachment-claim-residual-deepest-deeper-subline`（**CLIENT-319**；**CLIENT-303/287** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-deepest-deeper-ring` / `panel-return-source-highlight-residual-deepest-deeper`（**CLIENT-320**；**CLIENT-304/288** **不退化**）、**排行/招募** `rank-list-density-scan-residual-deepest-deeper-line` / `recruit-template-inline-residual-deepest-deeper-summary`（**CLIENT-321**；**CLIENT-305/289** **不退化**）、**军情** `intel-phase-change-residual-deepest-deeper-pulse` / `intel-march-prefill-residual-deepest-deeper-line` + `prefill-march-form-from-intel-residual-deepest-deeper`（**CLIENT-322**；**CLIENT-306/290** **不退化**）与 **CLIENT-307/315** 同级窄屏契约（**非** wave:50 CLIENT-315 主城栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在 `layout-narrow` **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave51WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-323）；`cd client && npm test` 绿。（Closes [#1540](https://github.com/anitaguptaoffice/sanguo-slg/issues/1540)）

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:51 DOM 钩子（软依赖 **CLIENT-316～322**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299/307/315** manifest 不退化。单测：`wave51WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-323）；`cd client && npm test` 绿。（Closes [#1540](https://github.com/anitaguptaoffice/sanguo-slg/issues/1540)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:51 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-316～323**（自 **CLIENT-316** 起）。波次总览与 **DOCS-EXIT-043**（[#1531](https://github.com/anitaguptaoffice/sanguo-slg/issues/1531) / [#1542](https://github.com/anitaguptaoffice/sanguo-slg/pull/1542) `509b74cb`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 51」。**工程全收口** tip **`0f1b958f05ba8d0eb15d859ff21bdfc44ed40e2d`**（INTG-051 [#1532](https://github.com/anitaguptaoffice/sanguo-slg/pull/1532) `0f1b958f`）；**实现全收口** tip **`4fe4b2699f49f0a2f9709315a276677f2dd27ea5`**（#1540 CLIENT-323）；**全收口** main tip **`509b74cbc3ad03c7ef1a00777d8c851627e68abd`**（DOCS-EXIT-043）；基线 wave:50 **全收口** tip **`b343380005ffd1acc85b3ef00a065f8936c3265a`**（DOCS-EXIT-042 [#1520](https://github.com/anitaguptaoffice/sanguo-slg/pull/1520) `b3433800`；工程 tip **`ebb2bbec`** #1511 INTG-050；实现 tip **`d725a7f9`** #1519 CLIENT-315）。波次 backlog [#1521](https://github.com/anitaguptaoffice/sanguo-slg/pull/1521)（`c4088d19`）。tip 血统含 docs 样本 [#1541](https://github.com/anitaguptaoffice/sanguo-slg/pull/1541) `69ce159b`（hero-host 1280 capture-buttons 证据；**非** CLIENT 实现卡）。

## Wave 50 H5 主城队列 ETA 完成焦点残余巩固再加深二层·队列预览槽位互链再加深二层·将领养成扫读再加深二层·panelState 筛选再加深二层·双榜钉选再加深二层·军团聊天再加深二层·日常 HUD 深链再加深二层·1280 组合 manifest 巩固再加深二层（M4 出口 / INTG-050）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-050** 网关冒烟一致）。在 [Wave 49](#wave-49-h5-世界小地图军情-scroll-sync-残余巩固再加深一层出征戳记兵力余量再加深一层战报键盘坐标复制再加深一层邮件-hud-附件再加深一层背包商城返回再加深一层排行招募扫读再加深一层军情-phase-预填再加深一层1280-组合-manifest-巩固再加深一层m4-出口--intg-049) 世界栈基础上 **轮转回**主城/将领/队列/日常/社交栈做 **残余巩固再加深二层**；**非** wave:49 CLIENT-307 世界军情战报邮件商城排行 manifest 面板集。**范围外**同 Wave 49；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-308～315**（自 **CLIENT-308** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深二层** | 正文 **wave:50（CLIENT-308）** bullet（[#1501](https://github.com/anitaguptaoffice/sanguo-slg/issues/1501) / [#1516](https://github.com/anitaguptaoffice/sanguo-slg/pull/1516) `0970b97e`） | 已合 |
| **队列下一完成预览与七槽互链残余巩固再加深二层** | 正文 **wave:50（CLIENT-309）** bullet（[#1502](https://github.com/anitaguptaoffice/sanguo-slg/issues/1502) / [#1517](https://github.com/anitaguptaoffice/sanguo-slg/pull/1517) `ca471277`） | 已合 |
| **将领列表忠诚次行与详情养成道具扫读残余巩固再加深二层** | 正文 **wave:50（CLIENT-310）** bullet（[#1503](https://github.com/anitaguptaoffice/sanguo-slg/issues/1503) / [#1515](https://github.com/anitaguptaoffice/sanguo-slg/pull/1515) `1150637d`） | 已合 |
| **将领 panelState 与列表筛选 chip 记忆残余抛光再加深二层** | 正文 **wave:50（CLIENT-311）** bullet（[#1504](https://github.com/anitaguptaoffice/sanguo-slg/issues/1504) / [#1514](https://github.com/anitaguptaoffice/sanguo-slg/pull/1514) `5758318a`） | 已合 |
| **双榜刷新冷却戳记与钉选保持残余巩固再加深二层** | 正文 **wave:50（CLIENT-312）** bullet（[#1505](https://github.com/anitaguptaoffice/sanguo-slg/issues/1505) / [#1512](https://github.com/anitaguptaoffice/sanguo-slg/pull/1512) `834ec62d`） | 已合 |
| **军团职务分组头与聊天未读分隔扫读残余巩固再加深二层** | 正文 **wave:50（CLIENT-313）** bullet（[#1506](https://github.com/anitaguptaoffice/sanguo-slg/issues/1506) / [#1518](https://github.com/anitaguptaoffice/sanguo-slg/pull/1518) `58adb67a`） | 已合 |
| **日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深二层** | 正文 **wave:50（CLIENT-314）** bullet（[#1507](https://github.com/anitaguptaoffice/sanguo-slg/issues/1507) / [#1513](https://github.com/anitaguptaoffice/sanguo-slg/pull/1513) `773b82a5`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest 巩固再加深二层** | [手动验收（1280 wave:50 组合 manifest 巩固再加深二层 CLIENT-315）](#手动验收1280-wave50-组合-manifest-巩固再加深二层-client-315)（[#1508](https://github.com/anitaguptaoffice/sanguo-slg/issues/1508) / [#1519](https://github.com/anitaguptaoffice/sanguo-slg/pull/1519) `d725a7f9`） | 已合 |
| **网关冒烟**（主城队列 ETA 巩固再加深二层 + 将领养成扫读 + 双榜钉选 + 军团聊天 + 日常 chain·队列·HUD 深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 50** / `TestINTG050Wave50SmokePath`（[#1509](https://github.com/anitaguptaoffice/sanguo-slg/issues/1509) / [#1511](https://github.com/anitaguptaoffice/sanguo-slg/pull/1511) `ebb2bbec`） | 已合 |

**推荐串联**（在 [Wave 49](#wave-49-h5-世界小地图军情-scroll-sync-残余巩固再加深一层出征戳记兵力余量再加深一层战报键盘坐标复制再加深一层邮件-hud-附件再加深一层背包商城返回再加深一层排行招募扫读再加深一层军情-phase-预填再加深一层1280-组合-manifest-巩固再加深一层m4-出口--intg-049) 世界栈基础上 **轮转**回主城栈）：**队列** ETA/完成焦点 **巩固再加深二层**（**CLIENT-308**）→ **队列** 预览槽位互链 **再加深二层**（**CLIENT-309**）→ **将领** 养成扫读 **再加深二层**（**CLIENT-310**）→ **将领** panelState 与筛选 chip **抛光再加深二层**（**CLIENT-311**）→ **双榜** 钉选刷新 **巩固再加深二层**（**CLIENT-312**）→ **军团/聊天** 扫读 **再加深二层**（**CLIENT-313**）→ **日常/HUD** chain 队列深链 **再加深二层**（**CLIENT-314**）→ 视口 **1280×720** 主城将领日常社交队列 manifest **巩固再加深二层**（**CLIENT-315**）；网关字段见 `tools/smoke/README.md` **INTG-050**。

### 手动验收（1280 wave:50 组合 manifest 巩固再加深二层 CLIENT-315）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deepest-deeper-label` / `domestic-queue-eta-segment-residual-deepest-deeper-finish` / `domestic-queue-complete-focus-residual-deepest-deeper-ring`（**CLIENT-308**；**CLIENT-292/276/260/244/212** **不退化**）、`queue-next-finish-preview-residual-deepest-deeper-line` / `domestic-slot-preview-cross-link-residual-deepest-deeper-ring`（**CLIENT-309**；**CLIENT-293/277/261/245/218** **不退化**）、**将领** `hero-list-row-loyalty-residual-deepest-deeper-subline` / `hero-detail-consumable-stack-residual-deepest-deeper-sweep`（**CLIENT-310**；**CLIENT-294/278/262/246/230** **不退化**）、`hero-panel-state-residual-deepest-deeper-sweep` + session `hero-list-filter-chip-residual-deepest-deeper-v1`（**CLIENT-311**；**CLIENT-295/279/263/247/231** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deepest-deeper-stamp` / `rank-pin-keep-residual-deepest-deeper-ring`（**CLIENT-312**；**CLIENT-296/280/264/248/214** **不退化**）、**军团/聊天** `guild-duty-header-residual-deepest-deeper-line` / `guild-chat-unread-divider-residual-deepest-deeper-sweep`（**CLIENT-313**；**CLIENT-297/281/265/249/234** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deepest-deeper-subline` / `hud-todo-toolbar-deep-link-residual-deepest-deeper-pulse`（**CLIENT-314**；**CLIENT-298/282/266/250/216** **不退化**）与 **CLIENT-299/307** 同级窄屏契约（**非** wave:49 CLIENT-307 世界栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave50MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-315）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:50 DOM 钩子（软依赖 **CLIENT-308～314**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299/307** manifest 不退化。单测：`wave50MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-315）；`cd client && npm test` 绿。（Closes [#1508](https://github.com/anitaguptaoffice/sanguo-slg/issues/1508)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:50 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-308～315**（自 **CLIENT-308** 起）。波次总览与 **DOCS-EXIT-042**（[#1510](https://github.com/anitaguptaoffice/sanguo-slg/issues/1510)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 50」。**工程全收口** tip **`ebb2bbec9811c004a92015a666a4a2335f6f2d61`**（INTG-050 [#1511](https://github.com/anitaguptaoffice/sanguo-slg/pull/1511) `ebb2bbec`）；**实现全收口** tip **`d725a7f900ff4704fd4ec0505883e6bbc22edc36`**（#1519 CLIENT-315）；基线 wave:49 **全收口** tip **`51911d7829fcb0ce5c4a6fb5eaddd43b5e5414ba`**（DOCS-EXIT-041 [#1499](https://github.com/anitaguptaoffice/sanguo-slg/pull/1499) `51911d78`；工程 tip **`e192fe96`** #1410 INTG-049；实现 tip **`2c75deea`** #1459 CLIENT-307）。波次 backlog [#1500](https://github.com/anitaguptaoffice/sanguo-slg/pull/1500)（`124b614e`）。

## Wave 49 H5 世界小地图军情 scroll-sync 残余巩固再加深一层·出征戳记兵力余量再加深一层·战报键盘坐标复制再加深一层·邮件 HUD 附件再加深一层·背包商城返回再加深一层·排行招募扫读再加深一层·军情 phase 预填再加深一层·1280 组合 manifest 巩固再加深一层（M4 出口 / INTG-049）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-049** 网关冒烟一致）。在 [Wave 48](#wave-48-h5-主城队列-eta-完成焦点残余巩固再加深一层队列预览槽位互链再加深一层将领养成扫读再加深一层panelstate-筛选再加深一层双榜钉选再加深一层军团聊天再加深一层日常-hud-深链再加深一层1280-组合-manifest-巩固再加深一层m4-出口--intg-048) 主城栈基础上 **轮转回**世界/军情/战报/邮件/商城/排行栈做 **残余巩固再加深一层**；**非** wave:48 CLIENT-299 主城将领日常社交队列 manifest 面板集。**范围外**同 Wave 48；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID。实现卡 **CLIENT-300～307**（自 **CLIENT-300** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固再加深一层** | 正文 **wave:49（CLIENT-300）** bullet（[#1400](https://github.com/anitaguptaoffice/sanguo-slg/issues/1400) / [#1497](https://github.com/anitaguptaoffice/sanguo-slg/pull/1497) `e8b0167c`） | 已合 |
| **出征表单刷新戳记与兵力余量只读对照残余巩固再加深一层** | 正文 **wave:49（CLIENT-301）** bullet（[#1401](https://github.com/anitaguptaoffice/sanguo-slg/issues/1401) / [#1465](https://github.com/anitaguptaoffice/sanguo-slg/pull/1465) `a6f0203a`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深一层** | 正文 **wave:49（CLIENT-302）** bullet（[#1402](https://github.com/anitaguptaoffice/sanguo-slg/issues/1402) / [#1411](https://github.com/anitaguptaoffice/sanguo-slg/pull/1411) `af9ca084`） | 已合 |
| **邮件附件领取与 HUD 邮件日常角标同步残余巩固再加深一层** | 正文 **wave:49（CLIENT-303）** bullet（[#1403](https://github.com/anitaguptaoffice/sanguo-slg/issues/1403) / [#1448](https://github.com/anitaguptaoffice/sanguo-slg/pull/1448) `43f2ed83`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余巩固再加深一层** | 正文 **wave:49（CLIENT-304）** bullet（[#1404](https://github.com/anitaguptaoffice/sanguo-slg/issues/1404) / [#1451](https://github.com/anitaguptaoffice/sanguo-slg/pull/1451) `7fed5dbf`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余巩固再加深一层** | 正文 **wave:49（CLIENT-305）** bullet（[#1405](https://github.com/anitaguptaoffice/sanguo-slg/issues/1405) / [#1446](https://github.com/anitaguptaoffice/sanguo-slg/pull/1446) `51b8c629`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余巩固再加深一层** | 正文 **wave:49（CLIENT-306）** bullet（[#1406](https://github.com/anitaguptaoffice/sanguo-slg/issues/1406) / [#1498](https://github.com/anitaguptaoffice/sanguo-slg/pull/1498) `68c3fd6a`） | 已合 |
| **1280 世界军情战报邮件商城排行组合 manifest 巩固再加深一层** | [手动验收（1280 wave:49 组合 manifest 巩固再加深一层 CLIENT-307）](#手动验收1280-wave49-组合-manifest-巩固再加深一层-client-307)（[#1407](https://github.com/anitaguptaoffice/sanguo-slg/issues/1407) / [#1459](https://github.com/anitaguptaoffice/sanguo-slg/pull/1459) `2c75deea`） | 已合 |
| **网关冒烟**（小地图军情 scroll-sync 巩固再加深一层 + 出征兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 49** / `TestINTG049Wave49SmokePath`（[#1408](https://github.com/anitaguptaoffice/sanguo-slg/issues/1408) / [#1410](https://github.com/anitaguptaoffice/sanguo-slg/pull/1410) `e192fe96`） | 已合 |

**推荐串联**（在 [Wave 48](#wave-48-h5-主城队列-eta-完成焦点残余巩固再加深一层队列预览槽位互链再加深一层将领养成扫读再加深一层panelstate-筛选再加深一层双榜钉选再加深一层军团聊天再加深一层日常-hud-深链再加深一层1280-组合-manifest-巩固再加深一层m4-出口--intg-048) 主城栈基础上 **轮转**回世界栈）：小地图↔军情 scroll-sync **残余巩固再加深一层**（**CLIENT-300**）→ 出征刷新戳记与兵力余量 **再加深一层**（**CLIENT-301**）→ 战报键盘相邻导航与坐标复制 **再加深一层**（**CLIENT-302**）→ 邮件 HUD 附件领取 **再加深一层**（**CLIENT-303**）→ 背包商城返回高亮 **再加深一层**（**CLIENT-304**）→ 排行招募扫读 **再加深一层**（**CLIENT-305**）→ 军情 phase 再出征预填 **再加深一层**（**CLIENT-306**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest **巩固再加深一层**（**CLIENT-307**）；网关字段见 `tools/smoke/README.md` **INTG-049**。

### 手动验收（1280 wave:49 组合 manifest 巩固再加深一层 CLIENT-307）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-residual-deepest-ring` + `world-tile-intel-eta-cross-residual-deepest-line`（**CLIENT-300**；**CLIENT-284/268** **不退化**）、**军事出征** `march-form-troop-margin-residual-deepest-line` / `march-submit-intel-refresh-stamp-residual-deepest`（**CLIENT-301**；**CLIENT-285/269** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-deepest-ring` / `battle-report-coord-copy-bar-residual-deepest-sweep`（**CLIENT-302**；**CLIENT-286/270** **不退化**）、**邮件** `mail-claim-hud-sync-residual-deepest-pulse` / `mail-attachment-claim-residual-deepest-subline`（**CLIENT-303**；**CLIENT-287/271** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-deepest-ring` / `panel-return-source-highlight-residual-deepest`（**CLIENT-304**；**CLIENT-288/272** **不退化**）、**排行/招募** `rank-list-density-scan-residual-deepest-line` / `recruit-template-inline-residual-deepest-summary`（**CLIENT-305**；**CLIENT-289/273** **不退化**）、**军情** `intel-phase-change-residual-deepest-pulse` / `intel-march-prefill-residual-deepest-line` + `prefill-march-form-from-intel-residual-deepest`（**CLIENT-306**；**CLIENT-290/274** **不退化**）与 **CLIENT-291/299** 同级窄屏契约（**非** wave:48 CLIENT-299 主城栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave49WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-307）；`cd client && npm test` 绿。

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:49 DOM 钩子（软依赖 **CLIENT-300～306**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291/299** manifest 不退化。单测：`wave49WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-307）；`cd client && npm test` 绿。（Closes [#1407](https://github.com/anitaguptaoffice/sanguo-slg/issues/1407)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:49 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-300～307**（自 **CLIENT-300** 起）。波次总览与 **DOCS-EXIT-041**（[#1409](https://github.com/anitaguptaoffice/sanguo-slg/issues/1409) / [#1499](https://github.com/anitaguptaoffice/sanguo-slg/pull/1499) `51911d78`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 49」。**工程全收口** tip **`e192fe96d9e79deebdcc121eb6a5c54b57211d42`**（INTG-049 [#1410](https://github.com/anitaguptaoffice/sanguo-slg/pull/1410) `e192fe96`）；**实现全收口** tip **`2c75deeaf2c31fff8673acee5efc1395ebc21596`**（#1459 CLIENT-307）；**全收口** main tip **`51911d7829fcb0ce5c4a6fb5eaddd43b5e5414ba`**（DOCS-EXIT-041）；基线 wave:48 **全收口** tip **`7df4fcbc71e7dc9957d6d45a2e5c3ec648ceed5e`**（DOCS-EXIT-040 [#1398](https://github.com/anitaguptaoffice/sanguo-slg/pull/1398) `7df4fcbc`；工程 tip **`09fdce34`** #1389 INTG-048；实现 tip **`f5d74761`** #1396 CLIENT-299）。

## Wave 48 H5 主城队列 ETA 完成焦点残余巩固再加深一层·队列预览槽位互链再加深一层·将领养成扫读再加深一层·panelState 筛选再加深一层·双榜钉选再加深一层·军团聊天再加深一层·日常 HUD 深链再加深一层·1280 组合 manifest 巩固再加深一层（M4 出口 / INTG-048）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-048** 网关冒烟一致）。在 [Wave 47](#wave-47-h5-世界小地图军情-scroll-sync-残余巩固再加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固再加深m4-出口--intg-047) 世界栈基础上 **轮转回**主城/将领/队列/日常/社交栈做 **残余巩固再加深一层**；**非** wave:47 CLIENT-291 世界军情战报邮件商城排行 manifest 面板集。**范围外**同 Wave 47；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / **#697** / **#983** / **#1017** / **#1069**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。实现卡 **CLIENT-292～299**（自 **CLIENT-292** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深一层** | 正文 **wave:48（CLIENT-292）** bullet（[#1379](https://github.com/anitaguptaoffice/sanguo-slg/issues/1379) / [#1390](https://github.com/anitaguptaoffice/sanguo-slg/pull/1390) `9b8215ac`） | 已合 |
| **队列下一完成预览与七槽互链残余巩固再加深一层** | 正文 **wave:48（CLIENT-293）** bullet（[#1380](https://github.com/anitaguptaoffice/sanguo-slg/issues/1380) / [#1393](https://github.com/anitaguptaoffice/sanguo-slg/pull/1393) `b19d6a67`） | 已合 |
| **将领列表忠诚次行与详情养成道具扫读残余巩固再加深一层** | 正文 **wave:48（CLIENT-294）** bullet（[#1381](https://github.com/anitaguptaoffice/sanguo-slg/issues/1381) / [#1391](https://github.com/anitaguptaoffice/sanguo-slg/pull/1391) `350c0744`） | 已合 |
| **将领 panelState 与列表筛选 chip 记忆残余抛光再加深一层** | 正文 **wave:48（CLIENT-295）** bullet（[#1382](https://github.com/anitaguptaoffice/sanguo-slg/issues/1382) / [#1392](https://github.com/anitaguptaoffice/sanguo-slg/pull/1392) `ce15f6e4`） | 已合 |
| **双榜刷新冷却戳记与钉选保持残余巩固再加深一层** | 正文 **wave:48（CLIENT-296）** bullet（[#1383](https://github.com/anitaguptaoffice/sanguo-slg/issues/1383) / [#1395](https://github.com/anitaguptaoffice/sanguo-slg/pull/1395) `60facfe6`） | 已合 |
| **军团职务分组头与聊天未读分隔扫读残余巩固再加深一层** | 正文 **wave:48（CLIENT-297）** bullet（[#1384](https://github.com/anitaguptaoffice/sanguo-slg/issues/1384) / [#1397](https://github.com/anitaguptaoffice/sanguo-slg/pull/1397) `8d4f93b6`） | 已合 |
| **日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深一层** | 正文 **wave:48（CLIENT-298）** bullet（[#1385](https://github.com/anitaguptaoffice/sanguo-slg/issues/1385) / [#1394](https://github.com/anitaguptaoffice/sanguo-slg/pull/1394) `1fb37fa8`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest 巩固再加深一层** | [手动验收（1280 wave:48 组合 manifest 巩固再加深一层 CLIENT-299）](#手动验收1280-wave48-组合-manifest-巩固再加深一层-client-299)（[#1386](https://github.com/anitaguptaoffice/sanguo-slg/issues/1386) / [#1396](https://github.com/anitaguptaoffice/sanguo-slg/pull/1396) `f5d74761`） | 已合 |
| **网关冒烟**（主城队列 ETA 巩固再加深一层 + 将领养成扫读 + 双榜钉选 + 军团聊天 + 日常 chain·队列·HUD 深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 48** / `TestINTG048Wave48SmokePath`（[#1387](https://github.com/anitaguptaoffice/sanguo-slg/issues/1387) / [#1389](https://github.com/anitaguptaoffice/sanguo-slg/pull/1389) `09fdce34`） | 已合 |

**推荐串联**（在 [Wave 47](#wave-47-h5-世界小地图军情-scroll-sync-残余巩固再加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固再加深m4-出口--intg-047) 世界栈基础上 **轮转**回主城栈）：**队列** ETA/完成焦点 **巩固再加深一层**（**CLIENT-292**）→ **队列** 预览槽位互链 **再加深一层**（**CLIENT-293**）→ **将领** 养成扫读 **再加深一层**（**CLIENT-294**）→ **将领** panelState 与筛选 chip **抛光再加深一层**（**CLIENT-295**）→ **双榜** 钉选刷新 **巩固再加深一层**（**CLIENT-296**）→ **军团/聊天** 扫读 **再加深一层**（**CLIENT-297**）→ **日常/HUD** chain 队列深链 **再加深一层**（**CLIENT-298**）→ 视口 **1280×720** 主城将领日常社交队列 manifest **巩固再加深一层**（**CLIENT-299**）；网关字段见 `tools/smoke/README.md` **INTG-048**。

### 手动验收（1280 wave:48 组合 manifest 巩固再加深一层 CLIENT-299）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deepest-label` / `domestic-queue-eta-segment-residual-deepest-finish` / `domestic-queue-complete-focus-residual-deepest-ring`（**CLIENT-292**；**CLIENT-276/260/244/212** **不退化**）、`queue-next-finish-preview-residual-deepest-line` / `domestic-slot-preview-cross-link-residual-deepest-ring`（**CLIENT-293**；**CLIENT-277/261/245/218** **不退化**）、**将领** `hero-list-row-loyalty-residual-deepest-subline` / `hero-detail-consumable-stack-residual-deepest-sweep`（**CLIENT-294**；**CLIENT-278/262/246/230** **不退化**）、`hero-panel-state-residual-deepest-sweep` + session `hero-list-filter-chip-residual-deepest-v1`（**CLIENT-295**；**CLIENT-279/263/247/231** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deepest-stamp` / `rank-pin-keep-residual-deepest-ring`（**CLIENT-296**；**CLIENT-280/264/248/214** **不退化**）、**军团/聊天** `guild-duty-header-residual-deepest-line` / `guild-chat-unread-divider-residual-deepest-sweep`（**CLIENT-297**；**CLIENT-281/265/249/234** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deepest-subline` / `hud-todo-toolbar-deep-link-residual-deepest-pulse`（**CLIENT-298**；**CLIENT-282/266/250/216** **不退化**）与 **CLIENT-283/291** 同级窄屏契约（**非** wave:47 CLIENT-291 世界栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave48MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-299）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:48 DOM 钩子（软依赖 **CLIENT-292～298**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283/291** manifest 不退化。单测：`wave48MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-299）；`cd client && npm test` 绿。（Closes [#1386](https://github.com/anitaguptaoffice/sanguo-slg/issues/1386)）

**硬约束**：**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；**无** CancelMarch / 募兵加速 / 主城建造新 RPC / 战报 proto 扩量；世界瓦片/图集仍暂缓；**无** IAP / 新商城 SKU；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** #77/#82/#100/#108/#126/#444/#481/#506/#637/#649/#674/#697/#942/#983/#1017/#1069/#1191/#1192/#1193/#1203/#1204/#1205/#1206/#1207 等 art hold / VERIFY draft PR。

**美术旁路**（**非** wave:48 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-292～299**（自 **CLIENT-292** 起）。波次总览与 **DOCS-EXIT-040**（[#1388](https://github.com/anitaguptaoffice/sanguo-slg/issues/1388)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 48」。**工程全收口** tip **`09fdce347f6eccf57dfaa7861a413e5421c750c2`**（INTG-048 [#1389](https://github.com/anitaguptaoffice/sanguo-slg/pull/1389) `09fdce34`）；**实现全收口** tip **`f5d74761e001df22326bef66d02346dbca762a81`**（#1396 CLIENT-299）；基线 wave:47 **全收口** tip **`e0fae53af829f328b061ed2bda3e5c3bc67c83ed`**（DOCS-EXIT-039 `e0fae53a`；工程 tip **`0330d0a2`** #1304 INTG-047；实现 tip **`aa9c123e`** #1311 CLIENT-291）。

## Wave 47 H5 世界小地图军情 scroll-sync 残余巩固再加深·出征戳记兵力余量·战报键盘坐标·邮件 HUD 附件·背包商城返回·排行招募扫读·军情 phase 预填·1280 组合 manifest 巩固再加深（M4 出口 / INTG-047）
在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-047** 网关冒烟一致）。在 [Wave 46](#wave-46-h5-主城队列-eta-完成焦点残余巩固再加深队列预览槽位互链再加深将领养成扫读再加深panelstate-筛选再加深双榜钉选再加深军团聊天再加深日常-hud-深链再加深1280-组合-manifest-巩固再加深m4-出口--intg-043) 主城栈基础上 **轮转**回世界/军情/战报/邮件/商城/排行栈做 **残余巩固再加深**；**非** wave:46 CLIENT-283 主城将领日常社交队列 manifest 面板集。**范围外**同 Wave 46；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / **#697** / **#983** / **#1017** / **#1069**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。实现卡 **CLIENT-284～291**（自 **CLIENT-284** 起）。
| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固再加深** | 正文 **wave:47（CLIENT-284）** bullet（[#1283](https://github.com/anitaguptaoffice/sanguo-slg/issues/1283) / [#1310](https://github.com/anitaguptaoffice/sanguo-slg/pull/1310) `9ff4879a`） | 已合 |
| **出征表单刷新戳记与兵力余量只读对照残余巩固再加深** | 正文 **wave:47（CLIENT-285）** bullet（[#1284](https://github.com/anitaguptaoffice/sanguo-slg/issues/1284) / [#1307](https://github.com/anitaguptaoffice/sanguo-slg/pull/1307) `c10aa569`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余巩固再加深** | 正文 **wave:47（CLIENT-286）** bullet（[#1285](https://github.com/anitaguptaoffice/sanguo-slg/issues/1285) / [#1308](https://github.com/anitaguptaoffice/sanguo-slg/pull/1308) `5a9b8fd5`） | 已合 |
| **邮件附件领取与 HUD 角标同步残余巩固再加深** | 正文 **wave:47（CLIENT-287）** bullet（[#1286](https://github.com/anitaguptaoffice/sanguo-slg/issues/1286) / [#1306](https://github.com/anitaguptaoffice/sanguo-slg/pull/1306) `598f0bb6`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余巩固再加深** | 正文 **wave:47（CLIENT-288）** bullet（[#1287](https://github.com/anitaguptaoffice/sanguo-slg/issues/1287) / [#1305](https://github.com/anitaguptaoffice/sanguo-slg/pull/1305) `3196707f`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余巩固再加深** | 正文 **wave:47（CLIENT-289）** bullet（[#1288](https://github.com/anitaguptaoffice/sanguo-slg/issues/1288) / [#1309](https://github.com/anitaguptaoffice/sanguo-slg/pull/1309) `5623f8d3`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余巩固再加深** | 正文 **wave:47（CLIENT-290）** bullet（[#1289](https://github.com/anitaguptaoffice/sanguo-slg/issues/1289) / [#1312](https://github.com/anitaguptaoffice/sanguo-slg/pull/1312) `57ef8259`） | 已合 |
| **1280 世界军情战报邮件商城排行组合 manifest 巩固再加深** | [手动验收（1280 wave:47 组合 manifest 巩固再加深 CLIENT-291）](#手动验收1280-wave47-组合-manifest-巩固再加深-client-291)（[#1290](https://github.com/anitaguptaoffice/sanguo-slg/issues/1290) / [#1311](https://github.com/anitaguptaoffice/sanguo-slg/pull/1311) `aa9c123e`） | 已合 |
| **网关冒烟**（小地图军情 scroll-sync 巩固再加深 + 出征兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 47** / `TestINTG047Wave47SmokePath`（[#1291](https://github.com/anitaguptaoffice/sanguo-slg/issues/1291) / [#1304](https://github.com/anitaguptaoffice/sanguo-slg/pull/1304) `0330d0a2`） | 已合 |
**推荐串联**（在 [Wave 46](#wave-46-h5-主城队列-eta-完成焦点残余巩固再加深队列预览槽位互链再加深将领养成扫读再加深panelstate-筛选再加深双榜钉选再加深军团聊天再加深日常-hud-深链再加深1280-组合-manifest-巩固再加深m4-出口--intg-043) 主城栈基础上 **轮转**回世界栈）：小地图↔军情 scroll-sync **残余巩固再加深**（**CLIENT-284**）→ 出征刷新戳记与兵力余量 **残余巩固再加深**（**CLIENT-285**）→ 战报键盘相邻导航与坐标复制 **残余巩固再加深**（**CLIENT-286**）→ 邮件 HUD 附件领取 **残余巩固再加深**（**CLIENT-287**）→ 背包商城返回高亮 **残余巩固再加深**（**CLIENT-288**）→ 排行招募扫读 **残余巩固再加深**（**CLIENT-289**）→ 军情 phase 再出征预填 **残余巩固再加深**（**CLIENT-290**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest **巩固再加深**（**CLIENT-291**）；网关字段见 `tools/smoke/README.md` **INTG-047**。
### 手动验收（1280 wave:47 组合 manifest 巩固再加深 CLIENT-291）
视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-residual-deeper-ring` + `world-tile-intel-eta-cross-residual-deeper-line`（**CLIENT-284**；**CLIENT-268/252** **不退化**）、**军事出征** `march-form-troop-margin-residual-deeper-line` / `march-submit-intel-refresh-stamp-residual-deeper`（**CLIENT-285**；**CLIENT-269/253** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-deeper-ring` / `battle-report-coord-copy-bar-residual-deeper-sweep`（**CLIENT-286**；**CLIENT-270/254** **不退化**）、**邮件** `mail-claim-hud-sync-residual-deeper-pulse` / `mail-attachment-claim-residual-deeper-subline`（**CLIENT-287**；**CLIENT-271/255** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-deeper-ring` / `panel-return-source-highlight-residual-deeper`（**CLIENT-288**；**CLIENT-272/256** **不退化**）、**排行/招募** `rank-list-density-scan-residual-deeper-line` / `recruit-template-inline-residual-deeper-summary`（**CLIENT-289**；**CLIENT-273/257** **不退化**）、**军情** `intel-phase-change-residual-deeper-pulse` / `intel-march-prefill-residual-deeper-line` + `prefill-march-form-from-intel-residual-deeper`（**CLIENT-290**；**CLIENT-274/258** **不退化**）与 **CLIENT-275/283** 同级窄屏契约（**非** wave:46 CLIENT-283 主城栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave47WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-291）；`cd client && npm test` 绿。
1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:47 DOM 钩子（软依赖 **CLIENT-284～290**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275/283** manifest 不退化。单测：`wave47WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-291）；`cd client && npm test` 绿。（[#1290](https://github.com/anitaguptaoffice/sanguo-slg/issues/1290) / [#1311](https://github.com/anitaguptaoffice/sanguo-slg/pull/1311) `aa9c123e`）
**美术旁路**（**非** wave:47 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-284～291**（自 **CLIENT-284** 起）。波次总览与 **DOCS-EXIT-039**（[#1292](https://github.com/anitaguptaoffice/sanguo-slg/issues/1292)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 47」。**工程全收口** tip **`0330d0a2b2d4234f34501b9dc9975b4a16c660e7`**（INTG-047 [#1304](https://github.com/anitaguptaoffice/sanguo-slg/pull/1304) `0330d0a2`）；**实现全收口** tip **`aa9c123ee17b71f3b82385eb8a17f75e75ab6bf9`**（#1311 CLIENT-291）；基线 wave:46 **全收口** tip **`12f06e78230fce6cf017f399fbcbb26d10778f98`**（DOCS-EXIT-038 [#1169](https://github.com/anitaguptaoffice/sanguo-slg/pull/1169) `b7731d29`；工程宿主 `12f06e78`）。
## Wave 49 H5 世界栈排行招募扫读残余巩固再加深一层（CLIENT-305 等 / INTG-049）

**wave:49（CLIENT-305）排行列表密度扫读与招募模板行内摘要残余巩固再加深一层**：三甲密度 **CLIENT-289** `formatRankListDensityScanResidualDeeperLine` 第四行下追加只读 **`formatRankListDensityScanResidualDeepestLine`** / **`rank-list-density-scan-residual-deepest-line`**（名次变化 + 战力/击杀分数 **巩固再加深一层** 第五行扫读；**CLIENT-184/289** **不退化**；**非** wave:48 **CLIENT-296** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-289** 加深摘要旁追加 **`formatRecruitTemplateInlineResidualDeepestSummary`** / **`recruit-template-inline-residual-deepest-summary`**（模板 id + 币种余额 **巩固再加深一层** 行内摘要；**CLIENT-056/215** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeepest.test.ts`、`recruitTemplateInlineResidualDeepestSummary.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1405](https://github.com/anitaguptaoffice/sanguo-slg/issues/1405)）

## Wave 48 H5 主城栈残余巩固再加深一层（CLIENT-292～299 / INTG-048）
**wave:48（CLIENT-296）双榜刷新冷却戳记与钉选保持残余巩固再加深一层**：**CLIENT-280** 再加深第三行下只读 **`formatRankRefreshCooldownResidualDeepestStamp`** / **`rank-refresh-cooldown-residual-deepest-stamp`** / `data-role="rank-refresh-cooldown-residual-deepest"`（冷却窗口内合并 **冷却剩余** + **上次刷新** + **手动刷新次数** 只读 **巩固再加深一层** 第三行；**CLIENT-280/214** **不退化**；**无**新 rank RPC；**非** wave:47 **CLIENT-289** 排行密度/招募摘要主叙事）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deepest-ring` 2.5s**（**CLIENT-264** 环 **不退化**）。单测：`rankRefreshCooldownResidualDeepest.test.ts`、`rankPinKeepResidualDeepestRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（[#1383](https://github.com/anitaguptaoffice/sanguo-slg/issues/1383)）

## Wave 46 H5 主城队列 ETA 完成焦点残余巩固再加深·队列预览槽位互链再加深·将领养成扫读再加深·panelState 筛选再加深·双榜钉选再加深·军团聊天再加深·日常 HUD 深链再加深·1280 组合 manifest 巩固再加深（M4 出口 / INTG-043）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-043** 网关冒烟一致）。在 [Wave 45](#wave-45-h5-世界小地图军情-scroll-sync-残余巩固加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固m4-出口--intg-042) 世界栈基础上 **轮转回**主城/将领/队列/日常/社交栈做 **残余巩固再加深**；**非** wave:45 CLIENT-275 世界军情战报邮件商城排行 manifest 面板集。**范围外**同 Wave 45；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / **#697** / **#983** / **#1017** / **#1069**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。实现卡 **CLIENT-276～283**（自 **CLIENT-276** 起）。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深** | 正文 **wave:46（CLIENT-276）** bullet（[#1073](https://github.com/anitaguptaoffice/sanguo-slg/issues/1073) / [#1131](https://github.com/anitaguptaoffice/sanguo-slg/pull/1131) `c6d13fad`） | 已合 |
| **队列下一完成预览与七槽互链残余巩固再加深** | 正文 **wave:46（CLIENT-277）** bullet（[#1074](https://github.com/anitaguptaoffice/sanguo-slg/issues/1074) / [#1129](https://github.com/anitaguptaoffice/sanguo-slg/pull/1129) `311ac04c`） | 已合 |
| **将领列表忠诚次行与详情养成道具扫读残余巩固再加深** | 正文 **wave:46（CLIENT-278）** bullet（[#1075](https://github.com/anitaguptaoffice/sanguo-slg/issues/1075) / [#1168](https://github.com/anitaguptaoffice/sanguo-slg/pull/1168) `2d341974`） | 已合 |
| **将领 panelState 与列表筛选 chip 记忆残余抛光再加深** | 正文 **wave:46（CLIENT-279）** bullet（[#1076](https://github.com/anitaguptaoffice/sanguo-slg/issues/1076) / [#1132](https://github.com/anitaguptaoffice/sanguo-slg/pull/1132) `98ba1460`） | 已合 |
| **双榜刷新冷却戳记与钉选保持残余巩固再加深** | 正文 **wave:46（CLIENT-280）** bullet（[#1077](https://github.com/anitaguptaoffice/sanguo-slg/issues/1077) / [#1134](https://github.com/anitaguptaoffice/sanguo-slg/pull/1134) `7c70b421`） | 已合 |
| **军团职务分组头与聊天未读分隔扫读残余巩固再加深** | 正文 **wave:46（CLIENT-281）** bullet（[#1078](https://github.com/anitaguptaoffice/sanguo-slg/issues/1078) / [#1167](https://github.com/anitaguptaoffice/sanguo-slg/pull/1167) `205d5b3c`） | 已合 |
| **日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深** | 正文 **wave:46（CLIENT-282）** bullet（[#1079](https://github.com/anitaguptaoffice/sanguo-slg/issues/1079) / [#1130](https://github.com/anitaguptaoffice/sanguo-slg/pull/1130) `79ef8654`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest 巩固再加深** | [手动验收（1280 wave:46 组合 manifest 巩固再加深 CLIENT-283）](#手动验收1280-wave46-组合-manifest-巩固再加深-client-283)（[#1080](https://github.com/anitaguptaoffice/sanguo-slg/issues/1080) / [#1133](https://github.com/anitaguptaoffice/sanguo-slg/pull/1133) `55beaf6b`） | 已合 |
| **网关冒烟**（主城队列 ETA 巩固再加深 + 将领养成扫读 + 双榜钉选 + 军团聊天 + 日常 chain·队列·HUD 深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 46** / `TestINTG043Wave46SmokePath`（[#1081](https://github.com/anitaguptaoffice/sanguo-slg/issues/1081) / [#1128](https://github.com/anitaguptaoffice/sanguo-slg/pull/1128) `d613ec59`） | 已合 |

**wave:46（CLIENT-276）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固再加深**：队列行在 **CLIENT-260** 深巩固第三行下追加 **`formatDomesticQueueEtaSegmentResidualDeeperLabel`**（**`domestic-queue-eta-segment-residual-deeper-label`** 巩固再加深分段阈值 + **`domestic-queue-eta-segment-residual-deeper-finish`** 完成倒计时只读第四行；**CLIENT-212/244/260** **不退化**；**非** wave:44 CLIENT-260 首版巩固标题复刻主叙事）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deeper-ring` 3s**（与 **CLIENT-260** `domestic-queue-complete-focus-residual-deep-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeeper.test.ts`、`domesticQueueCompleteFocusResidualDeeperRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。

**wave:46（CLIENT-280）双榜刷新冷却戳记与钉选保持残余巩固再加深**：**CLIENT-264** 巩固次行下只读 **`formatRankRefreshCooldownResidualDeeperStamp`** / **`rank-refresh-cooldown-residual-deeper-stamp`** / `data-role="rank-refresh-cooldown-residual-deeper"`（冷却窗口内合并 **冷却剩余** + **上次刷新** + **手动刷新次数** + 冷却窗进度只读 **再加深** 第三行；**CLIENT-264/248/214** **不退化**；**无**新 rank RPC；**非** wave:45 **CLIENT-273** 排行密度/招募摘要主叙事）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deeper-ring` 2.5s**（与 **CLIENT-248/264** 环 **并存**）。单测：`rankRefreshCooldownResidualDeeper.test.ts`、`rankPinKeepResidualDeeperRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（[#1077](https://github.com/anitaguptaoffice/sanguo-slg/issues/1077)）

**推荐串联**（在 [Wave 45](#wave-45-h5-世界小地图军情-scroll-sync-残余巩固加深出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifest-巩固m4-出口--intg-042) 世界栈基础上 **轮转**回主城栈）：**队列** ETA/完成焦点 **巩固再加深**（**CLIENT-276**）→ **队列** 预览槽位互链 **巩固再加深**（**CLIENT-277**）→ **将领** 养成扫读 **巩固再加深**（**CLIENT-278**）→ **将领** panelState 与筛选 chip **抛光再加深**（**CLIENT-279**）→ **双榜** 钉选刷新 **巩固再加深**（**CLIENT-280**）→ **军团/聊天** 扫读 **巩固再加深**（**CLIENT-281**）→ **日常/HUD** chain 队列深链 **巩固再加深**（**CLIENT-282**）→ 视口 **1280×720** 主城将领日常社交队列 manifest **巩固再加深**（**CLIENT-283**）；网关字段见 `tools/smoke/README.md` **INTG-043**。

**美术旁路**（**非** wave:46 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-276～283**（自 **CLIENT-276** 起）。波次总览与 **DOCS-EXIT-038**（[#1082](https://github.com/anitaguptaoffice/sanguo-slg/issues/1082)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 46」。**工程全收口** main tip **`d613ec59b3afa2d5e57a40f83cbd00084df4ef61`**（INTG-043 [#1128](https://github.com/anitaguptaoffice/sanguo-slg/pull/1128) `d613ec59`）；**实现全收口** tip **`55beaf6b45508bbb94fd371bafb449f19f7c7125`**（#1133 CLIENT-283）；基线 wave:45 **全收口** tip **`296a26ed8e9bd8ca36050a78e2dcf5e1ca3486a7`**（DOCS-EXIT-037 [#1070](https://github.com/anitaguptaoffice/sanguo-slg/pull/1070) `296a26ed`；实现 tip **`097f500f`**）。

### 手动验收（1280 wave:46 组合 manifest 巩固再加深 CLIENT-283）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deeper-label` / `domestic-queue-eta-segment-residual-deeper-finish` / `domestic-queue-complete-focus-residual-deeper-ring`（**CLIENT-276**；**CLIENT-260/244/212** **不退化**）、`queue-next-finish-preview-residual-deeper-line` / `domestic-slot-preview-cross-link-residual-deeper-ring`（**CLIENT-277**；**CLIENT-261/245/218** **不退化**）、**将领** `hero-list-row-loyalty-residual-deeper-subline` / `hero-detail-consumable-stack-residual-deeper-sweep`（**CLIENT-278**；**CLIENT-262/246/230** **不退化**）、`hero-panel-state-residual-deeper-sweep` + session `hero-list-filter-chip-residual-deeper-v1`（**CLIENT-279**；**CLIENT-263/247/231** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deeper-stamp` / `rank-pin-keep-residual-deeper-ring`（**CLIENT-280**；**CLIENT-264/248/214** **不退化**）、**军团/聊天** `guild-duty-header-residual-deeper-line` / `guild-chat-unread-divider-residual-deeper-sweep`（**CLIENT-281**；**CLIENT-265/249/234** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deeper-subline` / `hud-todo-toolbar-deep-link-residual-deeper-pulse`（**CLIENT-282**；**CLIENT-266/250/216** **不退化**）与 **CLIENT-267/275** 同级窄屏契约（**非** wave:45 CLIENT-275 世界栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave46MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-283）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:46 DOM 钩子（软依赖 **CLIENT-276～282**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267/275** manifest 不退化。单测：`wave46MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-283）；`cd client && npm test` 绿。（[#1080](https://github.com/anitaguptaoffice/sanguo-slg/issues/1080) / [#1133](https://github.com/anitaguptaoffice/sanguo-slg/pull/1133) `55beaf6b`）

## Wave 45 H5 世界小地图军情 scroll-sync 残余巩固加深·出征戳记兵力余量·战报键盘坐标·邮件 HUD 附件·背包商城返回·排行招募扫读·军情 phase 预填·1280 组合 manifest 巩固（M4 出口 / INTG-042）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-042** 网关冒烟一致）。在 [Wave 44](#wave-44-h5-主城队列-eta完成焦点残余巩固将领养成扫读panelstate-筛选双榜钉选军团聊天日常-hud-深链1280-组合-manifestm4-出口--intg-041) 主城/将领/队列栈基础上 **轮转**回世界/军情/战报/邮件/商城/排行栈的残余 **巩固加深**；**非** wave:44 CLIENT-267 主城将领日常社交队列 manifest 面板集 / 双榜钉选主叙事重复。**范围外**同 Wave 44；**仍** DATA-002；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / **#697** / **#983** / **#1017** / **#1069**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固加深** | 正文 **wave:45（CLIENT-268）** bullet（[#1022](https://github.com/anitaguptaoffice/sanguo-slg/issues/1022) / [#1063](https://github.com/anitaguptaoffice/sanguo-slg/pull/1063) `ca9ba12a`） | 已合 |
| **出征表单刷新戳记与兵力余量只读对照残余加深** | 正文 **wave:45（CLIENT-269）** bullet（[#1023](https://github.com/anitaguptaoffice/sanguo-slg/issues/1023) / [#1067](https://github.com/anitaguptaoffice/sanguo-slg/pull/1067) `d0a79390`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余巩固加深** | 正文 **wave:45（CLIENT-270）** bullet（[#1024](https://github.com/anitaguptaoffice/sanguo-slg/issues/1024) / [#1062](https://github.com/anitaguptaoffice/sanguo-slg/pull/1062) `53d73560`） | 已合 |
| **邮件附件领取与 HUD 邮件日常角标同步残余加深** | 正文 **wave:45（CLIENT-271）** bullet（[#1025](https://github.com/anitaguptaoffice/sanguo-slg/issues/1025) / [#1066](https://github.com/anitaguptaoffice/sanguo-slg/pull/1066) `b19f0b5c`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余巩固加深** | 正文 **wave:45（CLIENT-272）** bullet（[#1026](https://github.com/anitaguptaoffice/sanguo-slg/issues/1026) / [#1061](https://github.com/anitaguptaoffice/sanguo-slg/pull/1061) `e0d254a3`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余加深** | 正文 **wave:45（CLIENT-273）** bullet（[#1027](https://github.com/anitaguptaoffice/sanguo-slg/issues/1027) / [#1068](https://github.com/anitaguptaoffice/sanguo-slg/pull/1068) `099dccba`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余巩固加深** | 正文 **wave:45（CLIENT-274）** bullet（[#1028](https://github.com/anitaguptaoffice/sanguo-slg/issues/1028) / [#1065](https://github.com/anitaguptaoffice/sanguo-slg/pull/1065) `a6d64a7a`） | 已合 |
| **1280 世界军情战报邮件商城排行组合 manifest 巩固** | [手动验收（1280 wave:45 组合 manifest 巩固 CLIENT-275）](#手动验收1280-wave45-组合-manifest-巩固-client-275)（[#1029](https://github.com/anitaguptaoffice/sanguo-slg/issues/1029) / [#1064](https://github.com/anitaguptaoffice/sanguo-slg/pull/1064) `097f500f`） | 已合 |
| **网关冒烟**（小地图军情 scroll-sync 巩固加深 + 出征兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 45** / `TestINTG042Wave45SmokePath`（[#1030](https://github.com/anitaguptaoffice/sanguo-slg/issues/1030) / [#1060](https://github.com/anitaguptaoffice/sanguo-slg/pull/1060)） | 已合 |

**wave:45（CLIENT-268）小地图视口锚点与军情列表 scroll-sync 残余巩固加深**：军情行变更时 **`syncMinimapViewportIntelScrollResidualDeep`** 在 **CLIENT-252** `syncMinimapViewportIntelScrollResidual` 与 **`minimap-intel-scroll-sync-deep-ring` 1.2s** 之上叠加 **`minimap-intel-scroll-sync-residual-deep-ring` 1.5s**（**CLIENT-220** `minimap-intel-sync-ring` **不退化**；**非** wave:39 phase 脉冲主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualDeepLine`** / `world-tile-intel-eta-cross-residual-deep-line` **巩固第三行** **`world-tile-intel-eta-cross-residual-deep-pulse` 1.5s** 只读对照（**CLIENT-252** `formatWorldTileIntelEtaCrossResidualLine` / cross 脉冲 **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidualDeep.test.ts`、`worldTileIntelEtaCrossResidualDeep.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-270）战报列表密度键盘相邻导航与详情坐标复制条残余巩固加深**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行在 **CLIENT-254** `report-list-keyboard-adjacent-nav-residual-ring` **2s** 上叠加 **`report-list-keyboard-adjacent-nav-residual-deep-ring` 2.5s**（**CLIENT-239** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后在 **CLIENT-254** `formatBattleReportCoordCopyBarResidualSweep` / **`battle-report-coord-copy-bar-residual-sweep` 2s** 上叠加 **`formatBattleReportCoordCopyBarResidualDeepSweep`** + **`battle-report-coord-copy-bar-residual-deep-sweep` 2.5s** 深扫读环（**CLIENT-240** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidualDeep.test.ts`、`battleReportCoordCopyBarResidualDeepSweep.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。（[#1024](https://github.com/anitaguptaoffice/sanguo-slg/issues/1024)）

**推荐串联**（在 [Wave 44](#wave-44-h5-主城队列-eta完成焦点残余巩固将领养成扫读panelstate-筛选双榜钉选军团聊天日常-hud-深链1280-组合-manifestm4-出口--intg-041) 主城栈基础上 **轮转**回世界栈）：小地图↔军情 scroll-sync **残余巩固加深**（**CLIENT-268**）→ 出征刷新戳记与兵力余量 **残余加深**（**CLIENT-269**）→ 战报键盘相邻导航与坐标复制 **残余巩固加深**（**CLIENT-270**）→ 邮件 HUD 附件领取 **残余加深**（**CLIENT-271**）→ 背包商城返回高亮 **残余巩固加深**（**CLIENT-272**）→ 排行招募扫读 **残余加深**（**CLIENT-273**）→ 军情 phase 再出征预填 **残余巩固加深**（**CLIENT-274**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest **巩固**（**CLIENT-275**）；网关字段见 `tools/smoke/README.md` **INTG-042**。

**美术旁路**（**非** wave:45 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-268～275**（自 **CLIENT-268** 起）。波次总览与 **DOCS-EXIT-037**（[#1031](https://github.com/anitaguptaoffice/sanguo-slg/issues/1031)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 45」。**工程全收口** main tip **`622fa35b795b5924a1a56f79dd6d75c7d5c76326`**（INTG-042 [#1060](https://github.com/anitaguptaoffice/sanguo-slg/pull/1060) `622fa35b`）；**实现全收口** tip **`097f500f36a580f885e762af420d51d9b9a46e4e`**（#1064 CLIENT-275）；基线 wave:44 **全收口** tip **`4c3605acfe48178f14c3840cf94fd45b2a1f8860`**（DOCS-EXIT-036 [#1018](https://github.com/anitaguptaoffice/sanguo-slg/pull/1018) `4c3605ac`；实现 tip **`417fc6c4`**）。

### 手动验收（1280 wave:45 组合 manifest 巩固 CLIENT-275）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-residual-deep-ring` + `world-tile-intel-eta-cross-residual-deep-line`（**CLIENT-268**；**CLIENT-252/236** 不退化）、**军事出征** `march-form-troop-margin-residual-deep-line` / `march-submit-intel-refresh-stamp-residual-deep`（**CLIENT-269**；**CLIENT-253/238** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-deep-ring` / `battle-report-coord-copy-bar-residual-deep-sweep`（**CLIENT-270**；**CLIENT-254/239/240** **不退化**）、**邮件** `mail-claim-hud-sync-residual-deep-pulse` / `mail-attachment-claim-residual-deep-subline`（**CLIENT-271**；**CLIENT-255/241** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-deep-ring` / `panel-return-source-highlight-residual-deep`（**CLIENT-272**；**CLIENT-256/242/211** **不退化**）、**排行/招募** `rank-list-density-scan-residual-deep-line` / `recruit-template-inline-residual-deep-summary`（**CLIENT-273**；**CLIENT-257/184** **不退化**）、**军情** `intel-phase-change-residual-deep-pulse` / `intel-march-prefill-residual-deep-line` + `data-action="prefill-march-form-from-intel-residual-deep"`（**CLIENT-274**；**CLIENT-258/205** **不退化**）与 **CLIENT-259/267** 同级窄屏契约（**非** wave:44 CLIENT-267 主城栈面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave45WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-275）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **世界/军情/战报/邮件/背包/商城/排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:45 DOM 钩子（软依赖 **CLIENT-268～274**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259/267** manifest 不退化。单测：`wave45WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-275）；`cd client && npm test` 绿。（[#1029](https://github.com/anitaguptaoffice/sanguo-slg/issues/1029) / [#1064](https://github.com/anitaguptaoffice/sanguo-slg/pull/1064) `097f500f`）

## Wave 44 H5 主城队列 ETA/完成焦点残余巩固·将领养成扫读·panelState 筛选·双榜钉选·军团聊天·日常 HUD 深链·1280 组合 manifest（M4 出口 / INTG-041）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-041** 网关冒烟一致）。在 [Wave 43](#wave-43-h5-世界小地图军情-scroll-sync-残余出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifestm4-出口--intg-040) 世界/军情/战报/邮件/商城栈基础上 **轮转**回主城/将领/队列/日常/社交栈的残余 **加深巩固**；**非** wave:43 CLIENT-259 世界军情战报邮件商城排行 manifest 面板集 / 排行招募密度扫读主叙事重复。**范围外**同 Wave 43；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**勿**将 **ART-012** 登记为本波实现卡 ID；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / **#697** / **#983** / **#1017**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城队列 ETA 分段与完成态七槽 ring 残余巩固** | 正文 **wave:44（CLIENT-260）** bullet（[#988](https://github.com/anitaguptaoffice/sanguo-slg/issues/988) / [#999](https://github.com/anitaguptaoffice/sanguo-slg/pull/999) `9607d2a6`） | 已合 |
| **队列下一完成预览与七槽互链残余巩固** | 正文 **wave:44（CLIENT-261）** bullet（[#989](https://github.com/anitaguptaoffice/sanguo-slg/issues/989) / [#1004](https://github.com/anitaguptaoffice/sanguo-slg/pull/1004) `123a6c82`） | 已合 |
| **将领列表忠诚次行与详情养成道具扫读残余巩固** | 正文 **wave:44（CLIENT-262）** bullet（[#990](https://github.com/anitaguptaoffice/sanguo-slg/issues/990) / [#1006](https://github.com/anitaguptaoffice/sanguo-slg/pull/1006) `beae2e0f`） | 已合 |
| **将领 panelState 与列表筛选 chip 记忆残余抛光** | 正文 **wave:44（CLIENT-263）** bullet（[#991](https://github.com/anitaguptaoffice/sanguo-slg/issues/991) / [#1000](https://github.com/anitaguptaoffice/sanguo-slg/pull/1000) `fe9831dd`） | 已合 |
| **双榜刷新冷却戳记与钉选保持残余巩固** | 正文 **wave:44（CLIENT-264）** bullet（[#992](https://github.com/anitaguptaoffice/sanguo-slg/issues/992) / [#1005](https://github.com/anitaguptaoffice/sanguo-slg/pull/1005) `93e3a314`） | 已合 |
| **军团职务头与聊天未读分隔扫读残余巩固** | 正文 **wave:44（CLIENT-265）** bullet（[#993](https://github.com/anitaguptaoffice/sanguo-slg/issues/993) / [#1002](https://github.com/anitaguptaoffice/sanguo-slg/pull/1002) `fba07688`） | 已合 |
| **日常 chain 与队列 HUD 深链残余加深** | 正文 **wave:44（CLIENT-266）** bullet（[#994](https://github.com/anitaguptaoffice/sanguo-slg/issues/994) / [#1003](https://github.com/anitaguptaoffice/sanguo-slg/pull/1003) `736b32a7`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest 巩固** | [手动验收（1280 wave:44 组合 manifest 巩固 CLIENT-267）](#手动验收1280-wave44-组合-manifest-巩固-client-267)（[#995](https://github.com/anitaguptaoffice/sanguo-slg/issues/995) / [#1001](https://github.com/anitaguptaoffice/sanguo-slg/pull/1001) `417fc6c4`） | 已合 |
| **网关冒烟**（主城队列 ETA/完成焦点 + 将领养成扫读 + 双榜钉选 + 军团聊天 + 日常 chain·队列·HUD 深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 44** / `TestINTG041Wave44SmokePath`（[#996](https://github.com/anitaguptaoffice/sanguo-slg/issues/996) / [#998](https://github.com/anitaguptaoffice/sanguo-slg/pull/998)） | 已合 |

**推荐串联**（在 [Wave 43](#wave-43-h5-世界小地图军情-scroll-sync-残余出征戳记兵力余量战报键盘坐标邮件-hud-附件背包商城返回排行招募扫读军情-phase-预填1280-组合-manifestm4-出口--intg-040) 世界栈基础上 **轮转**回主城栈）：**队列** ETA/完成焦点残余巩固（**CLIENT-260**）→ **队列** 预览槽位互链残余巩固（**CLIENT-261**）→ **将领** 养成扫读残余巩固（**CLIENT-262**）→ **将领** panelState 与筛选 chip 残余抛光（**CLIENT-263**）→ **双榜** 钉选刷新残余巩固（**CLIENT-264**）→ **军团/聊天** 扫读残余巩固（**CLIENT-265**）→ **日常/HUD** chain 队列深链残余加深（**CLIENT-266**）→ 视口 **1280×720** 主城将领日常社交队列 manifest **巩固**（**CLIENT-267**）；网关字段见 `tools/smoke/README.md` **INTG-041**。

**wave:44（CLIENT-262）将领列表忠诚次行与详情养成道具扫读残余巩固**：列表 **`formatHeroListLoyaltyResidualDeepSubline`** / **`hero-list-row-loyalty-residual-deep-subline`**（忠诚 + 经验进度只读深巩固；**CLIENT-246** `hero-list-row-loyalty-residual-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeepSweep`** / **`hero-detail-consumable-stack-residual-deep-sweep`** + **`hero-detail-consumable-stack-residual-deep-sweep-ring` 2s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** `data-art-panel=ui.panel.hero.v1` 壳与 **CLIENT-246** 残余行 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeepSubline.test.ts`、`heroDetailConsumableStackResidualDeepSweep.test.ts`、`HeroMailPanels.test.ts`、`heroMailState.test.ts`；`cd client && npm test` 绿。（[#990](https://github.com/anitaguptaoffice/sanguo-slg/issues/990)）

**wave:46（CLIENT-278）将领养成扫读巩固再加深**：列表 **`formatHeroListLoyaltyResidualDeeperSubline`** / **`hero-list-row-loyalty-residual-deeper-subline`**（忠诚 + 经验进度只读巩固再加深第三行；**CLIENT-262** `hero-list-row-loyalty-residual-deep-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeeperSweep`** / **`hero-detail-consumable-stack-residual-deeper-sweep`** + **`hero-detail-consumable-stack-residual-deeper-sweep-ring` 2.5s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** 壳与 **CLIENT-262** 深扫读 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeeperSubline.test.ts`、`heroDetailConsumableStackResidualDeeperSweep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（[#1075](https://github.com/anitaguptaoffice/sanguo-slg/issues/1075)）

**wave:48（CLIENT-294）将领养成扫读巩固再加深一层**：列表 **`formatHeroListLoyaltyResidualDeepestSubline`** / **`hero-list-row-loyalty-residual-deepest-subline`**（忠诚 + 经验进度只读巩固再加深一层第三行；**CLIENT-278** `hero-list-row-loyalty-residual-deeper-subline` **不退化**；**无** hero 专用升级 RPC）；详情 **`formatHeroDetailConsumableStackResidualDeepestSweep`** / **`hero-detail-consumable-stack-residual-deepest-sweep`** + **`hero-detail-consumable-stack-residual-deepest-sweep-ring` 2.5s** 只读扫读（养成堆叠 + **`pickHeroDetailBagDeepLink`** 背包深链 hint；**CLIENT-230** 壳与 **CLIENT-278** 再加深扫读 **不退化**；**非** ART-012 / #983/#108/#697 像素任务）。单测：`heroListLoyaltyResidualDeepestSubline.test.ts`、`heroDetailConsumableStackResidualDeepestSweep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1381](https://github.com/anitaguptaoffice/sanguo-slg/issues/1381)）

**美术旁路**（**非** wave:44 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-260～267**（自 **CLIENT-260** 起）。波次总览与 **DOCS-EXIT-036**（[#997](https://github.com/anitaguptaoffice/sanguo-slg/issues/997)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 44」。**工程全收口** main tip **`ae46bb3a9f112ed347cae58bddc32807ebed995d`**（INTG-041 [#998](https://github.com/anitaguptaoffice/sanguo-slg/pull/998) `ae46bb3a`）；**实现全收口** tip **`417fc6c4`**（#1001 CLIENT-267）；基线 wave:43 **全收口** tip **`84e6b990d27f850dd752ce5d0c755c675be832fd`**（DOCS-EXIT-035 [#986](https://github.com/anitaguptaoffice/sanguo-slg/pull/986) `84e6b990`；实现 tip **`215de092`**）。

### 手动验收（1280 wave:44 组合 manifest 巩固 CLIENT-267）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-deep-label` / `domestic-queue-complete-focus-residual-deep-ring`（**CLIENT-260**；**CLIENT-244/212** **不退化**）、`queue-next-finish-preview-residual-deep-line` / `domestic-slot-preview-cross-link-residual-deep-ring`（**CLIENT-261**；**CLIENT-245/218** **不退化**）、**将领** `hero-list-row-loyalty-residual-deep-subline` / `hero-detail-consumable-stack-residual-deep-sweep`（**CLIENT-262**；**CLIENT-246/230** **不退化**）、`hero-panel-state-residual-deep-sweep` + session `hero-list-filter-chip-residual-deep-v1`（**CLIENT-263**；**CLIENT-247/231** **不退化**）、**双榜** `rank-refresh-cooldown-residual-deep-stamp` / `rank-pin-keep-residual-deep-ring`（**CLIENT-264**；**CLIENT-248/214** **不退化**）、**军团/聊天** `guild-duty-header-residual-deep-line` / `guild-chat-unread-divider-residual-deep-sweep`（**CLIENT-265**；**CLIENT-249/234** **不退化**）、**日常/HUD** `quest-chain-queue-hud-residual-deep-subline` / `hud-todo-toolbar-deep-link-residual-deep-pulse`（**CLIENT-266**；**CLIENT-250/216** **不退化**）与 **CLIENT-251/235** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave44MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-267）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:44 DOM 钩子（软依赖 **CLIENT-260～266**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251/259** manifest 不退化。单测：`wave44MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-267）；`cd client && npm test` 绿。（[#995](https://github.com/anitaguptaoffice/sanguo-slg/issues/995) / [#1001](https://github.com/anitaguptaoffice/sanguo-slg/pull/1001) `417fc6c4`）

## Wave 43 H5 世界小地图军情 scroll-sync 残余·出征戳记兵力余量·战报键盘坐标·邮件 HUD 附件·背包商城返回·排行招募扫读·军情 phase 预填·1280 组合 manifest（M4 出口 / INTG-040）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-040** 网关冒烟一致）。**范围外**同 Wave 42；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表 scroll-sync 残余巩固** | 正文 **wave:43（CLIENT-252）** bullet（[#955](https://github.com/anitaguptaoffice/sanguo-slg/issues/955) / [#970](https://github.com/anitaguptaoffice/sanguo-slg/pull/970) `90aef0a4`） | 已合 |
| **出征表单刷新戳记加深与兵力余量只读对照残余** | 正文 **wave:43（CLIENT-253）** bullet（[#956](https://github.com/anitaguptaoffice/sanguo-slg/issues/956) / [#967](https://github.com/anitaguptaoffice/sanguo-slg/pull/967) `da08b168`） | 已合 |
| **战报列表密度键盘相邻导航与详情坐标复制条残余** | 正文 **wave:43（CLIENT-254）** bullet（[#957](https://github.com/anitaguptaoffice/sanguo-slg/issues/957) / [#969](https://github.com/anitaguptaoffice/sanguo-slg/pull/969) `6875fe1f`） | 已合 |
| **邮件附件领取与 HUD 邮件日常角标同步残余** | 正文 **CLIENT-255** bullet（[#958](https://github.com/anitaguptaoffice/sanguo-slg/issues/958) / [#966](https://github.com/anitaguptaoffice/sanguo-slg/pull/966) `13149c5a`） | 已合 |
| **背包商城行内态与面板返回来源高亮残余** | 正文 **wave:43（CLIENT-256）** bullet（[#959](https://github.com/anitaguptaoffice/sanguo-slg/issues/959) / [#982](https://github.com/anitaguptaoffice/sanguo-slg/pull/982) `d619f09a`） | 已合 |
| **排行列表密度扫读与招募模板行内摘要残余** | 正文 **wave:43（CLIENT-257）** bullet（[#960](https://github.com/anitaguptaoffice/sanguo-slg/issues/960) / [#971](https://github.com/anitaguptaoffice/sanguo-slg/pull/971) `690e554d`） | 已合 |
| **军情 phase 变更扫读与再出征表单预填残余** | 正文 **CLIENT-258** bullet（[#961](https://github.com/anitaguptaoffice/sanguo-slg/issues/961) / [#965](https://github.com/anitaguptaoffice/sanguo-slg/pull/965) `d8e9b898`） | 已合 |
| **1280 世界军情战报邮件商城排行招募组合 manifest** | [手动验收（1280 wave:43 组合 manifest CLIENT-259）](#手动验收1280-wave43-组合-manifest-client-259)（[#962](https://github.com/anitaguptaoffice/sanguo-slg/issues/962) / [#968](https://github.com/anitaguptaoffice/sanguo-slg/pull/968) `215de092`） | 已合 |
| **网关冒烟**（小地图军情 scroll-sync + 出征兵力余量 + 战报键盘坐标 + 邮件 HUD 附件 + 背包商城返回 + 排行招募扫读 + 军情 phase 预填） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 43** / `TestINTG040Wave43SmokePath`（[#963](https://github.com/anitaguptaoffice/sanguo-slg/issues/963) / [#985](https://github.com/anitaguptaoffice/sanguo-slg/pull/985)） | 已合 |

**推荐串联**（在 [Wave 42](#wave-42-h5-主城队列-eta-完成焦点残余将领养成扫读双榜钉选军团聊天日常-chain-hud-深链1280-组合-manifestm4-出口--intg-039) 主城栈基础上 **轮转**回世界/军情/战报/邮件/商城/排行/招募栈）：小地图↔军情 scroll-sync 残余（**CLIENT-252**）→ 出征刷新戳记与兵力余量（**CLIENT-253**）→ 战报键盘相邻导航与坐标复制（**CLIENT-254**）→ 邮件 HUD 附件领取（**CLIENT-255**）→ 背包商城返回高亮（**CLIENT-256**）→ 排行招募扫读（**CLIENT-257**）→ 军情 phase 再出征预填（**CLIENT-258**）→ 视口 **1280×720** 世界军情战报邮件商城排行 manifest（**CLIENT-259**）；网关字段见 `tools/smoke/README.md` **INTG-040**。

**美术旁路**（**非** wave:43 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-252～259**（自 **CLIENT-252** 起）。波次总览与 **DOCS-EXIT-035**（[#964](https://github.com/anitaguptaoffice/sanguo-slg/issues/964) / [#986](https://github.com/anitaguptaoffice/sanguo-slg/pull/986) `84e6b990`）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 43」。**工程全收口** main tip **`7c4456dfc0c0572ed858556668bc67878938bec6`**（INTG-040 [#985](https://github.com/anitaguptaoffice/sanguo-slg/pull/985) `7c4456df`）；**实现全收口** tip **`215de0921fc7a70ab8b7f4073ddf3e6843dba574`**（#968 CLIENT-259）；**全收口** main tip **`84e6b990d27f850dd752ce5d0c755c675be832fd`**（DOCS-EXIT-035）；基线 wave:42 **全收口** tip **`bb4f62db461cb75f0b56227906f5ea1e0605886f`**（DOCS-EXIT-034 [#943](https://github.com/anitaguptaoffice/sanguo-slg/pull/943) `bb4f62db`；实现 tip **`0928260b`**）。

### 手动验收（1280 wave:43 组合 manifest CLIENT-259）

视口 **1280×720** `layout-narrow`：**世界** `minimap-intel-scroll-sync-deep-ring` + `world-tile-intel-eta-cross-residual-line`（**CLIENT-252**；**CLIENT-236/237** 不退化）、**军事出征** `march-form-troop-margin-residual-line` / `march-submit-intel-refresh-stamp-deep`（**CLIENT-253**；**CLIENT-238** 戳记 **不退化**）、**战报** `report-list-keyboard-adjacent-nav-residual-ring` / `battle-report-coord-copy-bar-residual-sweep`（**CLIENT-254**；**CLIENT-239/240** **不退化**）、**邮件** `mail-claim-hud-sync-deep-pulse` / `mail-attachment-claim-residual-subline`（**CLIENT-255**；**CLIENT-241** **不退化**）、**背包/商城** `bag-shop-inline-state-residual-ring` / `panel-return-source-highlight-residual`（**CLIENT-256**；**CLIENT-242/211** **不退化**）、**排行/招募** `rank-list-density-scan-residual-line` / `recruit-template-inline-residual-summary`（**CLIENT-257**；**CLIENT-184/242** **不退化**）、**军情** `intel-phase-change-residual-pulse` / `intel-march-prefill-residual-line` + `data-action="prefill-march-form-from-intel-residual"`（**CLIENT-258**；**CLIENT-205/222** **不退化**）与 **CLIENT-243/251** 同级窄屏契约（**非** wave:42 主城将领日常社交队列 manifest 面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave43WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-259）；`cd client && npm test` 绿。

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行/招募** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:43 DOM 钩子（软依赖 **CLIENT-252～258**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243/251** manifest 不退化。单测：`wave43WorldIntelBattleReportMailShopRankNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-259）；`cd client && npm test` 绿。（[#962](https://github.com/anitaguptaoffice/sanguo-slg/issues/962) / [#968](https://github.com/anitaguptaoffice/sanguo-slg/pull/968) `215de092`）

## Wave 42 H5 主城队列 ETA 完成焦点残余·将领养成扫读·双榜钉选·军团聊天·日常 chain HUD 深链·1280 组合 manifest（M4 出口 / INTG-039）

在 `make dev` 下联调的最短人工路径（与 [`tools/smoke/README.md`](../tools/smoke/README.md) **INTG-039** 网关冒烟一致）。**范围外**同 Wave 41；**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；将领**装备槽** / hero 专用升级 RPC；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做；**永不合并** art hold / VERIFY Draft（含 **#77** / **#82** / **#108** / #100 / #126 / [#444](https://github.com/anitaguptaoffice/sanguo-slg/pull/444) / [#481](https://github.com/anitaguptaoffice/sanguo-slg/pull/481) / [#506](https://github.com/anitaguptaoffice/sanguo-slg/pull/506) / **#637** / **#649** / **#674** / **#697**）；**CLIENT-064** / **CLIENT-136** / **CLIENT-137** / **CLIENT-146** / **CLIENT-147** / **ART-012** 美术旁路——**非**本波 backlog 实现卡。

| 能力 | 验收小节 | 状态 |
|---|---|---|
| **主城建造募兵队列 ETA 分段与完成态七槽焦点残余扫读** | 正文 **wave:42（CLIENT-244）** bullet（[#913](https://github.com/anitaguptaoffice/sanguo-slg/issues/913) / [#937](https://github.com/anitaguptaoffice/sanguo-slg/pull/937) `5b5d2d3a`） | 已合 |
| **队列下一完成预览与七槽完成余量 ring 残余互链** | 正文 **wave:42（CLIENT-245）** bullet（[#914](https://github.com/anitaguptaoffice/sanguo-slg/issues/914) / [#939](https://github.com/anitaguptaoffice/sanguo-slg/pull/939) `2b3375e9`） | 已合 |
| **将领列表忠诚次行与详情养成道具堆叠扫读残余** | 正文 **wave:42（CLIENT-246）** bullet（[#915](https://github.com/anitaguptaoffice/sanguo-slg/issues/915) / [#935](https://github.com/anitaguptaoffice/sanguo-slg/pull/935) `64401293`） | 已合 |
| **将领 panelState 扫读与列表筛选 chip 记忆残余抛光** | [手动验收（将领 panelState 与筛选 chip 记忆残余抛光 CLIENT-247）](#手动验收将领-panelstate-与筛选-chip-记忆残余抛光-client-247)（[#916](https://github.com/anitaguptaoffice/sanguo-slg/issues/916) / [#940](https://github.com/anitaguptaoffice/sanguo-slg/pull/940) `96bad024`） | 已合 |
| **双榜手动刷新冷却戳记与钉选保持残余扫读** | 正文 **wave:42（CLIENT-248）** bullet（[#917](https://github.com/anitaguptaoffice/sanguo-slg/issues/917) / [#934](https://github.com/anitaguptaoffice/sanguo-slg/pull/934) `53fad513`） | 已合 |
| **军团职务分组头与聊天未读分隔扫读残余** | 正文 **CLIENT-249** bullet（[#918](https://github.com/anitaguptaoffice/sanguo-slg/issues/918) / [#941](https://github.com/anitaguptaoffice/sanguo-slg/pull/941) `3b5b1d2c`） | 已合 |
| **日常 chain 次行队列互链与 HUD 待办底栏深链残余** | 正文 **wave:42（CLIENT-250）** bullet（[#919](https://github.com/anitaguptaoffice/sanguo-slg/issues/919) / [#938](https://github.com/anitaguptaoffice/sanguo-slg/pull/938) `d68d273f`） | 已合 |
| **1280 主城将领日常社交队列组合 manifest** | [手动验收（1280 wave:42 组合 manifest CLIENT-251）](#手动验收1280-wave42-组合-manifest-client-251)（[#920](https://github.com/anitaguptaoffice/sanguo-slg/issues/920) / [#936](https://github.com/anitaguptaoffice/sanguo-slg/pull/936) `0928260b`） | 已合 |
| **网关冒烟**（主城队列 ETA 完成焦点+将领养成扫读+双榜钉选+军团聊天+日常队列 HUD 深链） | [`tools/smoke/README.md`](../tools/smoke/README.md) **Wave 42** / `TestINTG039Wave42SmokePath`（[#921](https://github.com/anitaguptaoffice/sanguo-slg/issues/921) / [#933](https://github.com/anitaguptaoffice/sanguo-slg/pull/933)） | 已合 |

**推荐串联**（在 [Wave 41](#wave-41-h5-世界小地图视口军情残余出征表单反馈战报密度键盘邮件-hud-同步背包商城排行招募扫读1280-组合-manifestm4-出口--intg-038) 世界/军情/战报/邮件/商城栈基础上 **轮转**回主城/将领/队列/日常/社交/HUD 栈）：**队列** ETA 分段与七槽完成焦点残余（**CLIENT-244**）→ **队列** 下一完成预览与槽位余量 ring（**CLIENT-245**）→ **将领** 忠诚次行与养成道具堆叠扫读（**CLIENT-246**）→ **将领** panelState 与筛选 chip 记忆（**CLIENT-247**）→ **双榜** 刷新冷却与钉选保持（**CLIENT-248**）→ **军团/聊天** 职务头与未读分隔扫读（**CLIENT-249**）→ **日常/HUD** chain 队列互链与底栏深链残余（**CLIENT-250**）→ 视口 **1280×720** 主城将领日常社交队列 manifest（**CLIENT-251**）；网关字段见 `tools/smoke/README.md` **INTG-039**。

**美术旁路**（**非** wave:42 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-244～251**（自 **CLIENT-244** 起）。波次总览与 **DOCS-EXIT-034**（[#922](https://github.com/anitaguptaoffice/sanguo-slg/issues/922)）见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 42」。**工程全收口** main tip **`46c79a097b845ca6d1ebd6eb317856b79116342e`**（INTG-039 [#933](https://github.com/anitaguptaoffice/sanguo-slg/pull/933) `46c79a09`）；**实现全收口** tip **`0928260ba0bf46d0fa10c8b06202f52bd5479059`**（#936 CLIENT-251）；基线 wave:41 **全收口** tip **`98d6535ec22139d10bf9b0a6b8cb852f3c5d1fb4`**（DOCS-EXIT-033 [#911](https://github.com/anitaguptaoffice/sanguo-slg/pull/911) `98d6535e`；实现 tip **`b57a393a`**）。

### 手动验收（1280 wave:42 组合 manifest CLIENT-251）

视口 **1280×720** `layout-narrow`：**队列** `domestic-queue-eta-segment-residual-label` / `domestic-queue-complete-focus-residual-ring`（**CLIENT-244**；**CLIENT-212/228** 不退化）、`queue-next-finish-preview-residual-line` / `domestic-slot-complete-margin-residual-ring`（**CLIENT-245**；**CLIENT-218** 不退化）、**将领** `hero-list-loyalty-residual-subline` / `hero-detail-consumable-stack-residual-line`（**CLIENT-246**；**CLIENT-213/230** 不退化）、`hero-panel-state-residual-sweep` + session `hero-list-filter-chip-residual-v1`（**CLIENT-247**；**CLIENT-231** 不退化）、**双榜** `rank-refresh-cooldown-residual-stamp` / `rank-pin-keep-residual-ring`（**CLIENT-248**；**CLIENT-214/242** 不退化）、**军团/聊天** `guild-duty-header-residual-line` / `guild-chat-unread-divider-residual-sweep`（**CLIENT-249**；**CLIENT-234/217** 不退化）、**日常/HUD** `quest-chain-queue-hud-residual-subline` / `hud-todo-toolbar-deep-link-residual-pulse`（**CLIENT-250**；**CLIENT-233/216** 不退化）与 **CLIENT-235/219** 同级窄屏契约（**非** wave:41 世界军情战报邮件商城 manifest 面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；主城/将领/社交密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave42MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-251）；`cd client && npm test` 绿。

1. 视口 **1280×720**：底栏 **队列/将领/排行/军团/聊天/日常** 与 **建造侧栏** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:42 DOM 钩子（软依赖 **CLIENT-244～250**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235/243** manifest 不退化。单测：`wave42MainCityHeroDailySocialQueueNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-251）；`cd client && npm test` 绿。（[#920](https://github.com/anitaguptaoffice/sanguo-slg/issues/920) / [#936](https://github.com/anitaguptaoffice/sanguo-slg/pull/936) `0928260b`）

## Wave 43 H5 世界小地图军情 scroll-sync 残余·出征兵力余量·战报键盘坐标·邮件 HUD·背包商城·排行招募·军情 phase 再出征·1280 组合 manifest（M4 出口 / INTG-040）

在 wave:42 主城/将领/队列栈 **轮转**回世界/军情/战报/邮件/商城/排行栈后的残余加深；**非** wave:39 双向高亮环 / phase 脉冲主叙事重复堆叠。**范围外**同 Wave 42；基线 wave:42 main tip **`bb4f62db461cb75f0b56227906f5ea1e0605886f`**（DOCS-EXIT-034 [#943](https://github.com/anitaguptaoffice/sanguo-slg/pull/943)）；波次 backlog [#944](https://github.com/anitaguptaoffice/sanguo-slg/pull/944)（`0dab7176`）。**仍不做** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速；主城建造/募兵**新 RPC**；战报 proto 扩量；**世界瓦片/图集**仍暂缓；**花钱类/IAP/新商城 SKU** 不做。

**wave:43（CLIENT-252）小地图视口锚点与军情列表 scroll-sync 残余巩固**：军情行变更时 **`syncMinimapViewportIntelScrollResidual`** 在 **CLIENT-236** `syncMinimapViewportToIntelRow` 视口锚点与列表滚入基础上，叠加 **`minimap-intel-scroll-sync-deep-ring` 1.2s**（**CLIENT-220** `minimap-intel-sync-ring` / **CLIENT-138/090** 互选 **不退化**；**非** wave:39 phase 脉冲主叙事）；格点信息卡 **`formatWorldTileIntelEtaCrossResidualLine`** / `world-tile-intel-eta-cross-residual-line` 与军情 **`march-intel-phase-eta-strip`** **`march-intel-eta-cross-residual-pulse` 1.2s** 只读对照（**CLIENT-237** `formatWorldTileIntelEtaResidualLine` / `world-tile-intel-eta-residual-ring` **不退化**；**无**新 world RPC）。单测：`minimapViewportIntelScrollResidual.test.ts`、`worldTileIntelEtaCrossResidual.test.ts`；`cd client && npm test` 绿。

## Wave 41 H5 世界小地图视口军情残余·出征表单反馈·战报密度键盘·邮件 HUD 同步·背包商城排行招募扫读·1280 组合 manifest（M4 出口 / INTG-038）

| 能力 | 文档锚点 | 状态 |
|---|---|---|
| **小地图视口锚点与军情列表可见行 scroll-sync 残余** | 正文 **wave:41（CLIENT-236）** bullet（[#882](https://github.com/anitaguptaoffice/sanguo-slg/issues/882) / [#908](https://github.com/anitaguptaoffice/sanguo-slg/pull/908) `2f977956`） | 已合 |
| **格点信息卡坐标次行与军情 ETA 只读对照残余** | 正文 **wave:41（CLIENT-237）** bullet（[#883](https://github.com/anitaguptaoffice/sanguo-slg/issues/883) / [#903](https://github.com/anitaguptaoffice/sanguo-slg/pull/903) `da0dd201`） | 已合 |
| **出征表单校验汇总与提交后军情刷新戳记残余** | 正文 **wave:41（CLIENT-238）** bullet（[#884](https://github.com/anitaguptaoffice/sanguo-slg/issues/884) / [#904](https://github.com/anitaguptaoffice/sanguo-slg/pull/904) `6b81f339`） | 已合 |
| **战报列表行密度与 j/k 键盘焦点环残余** | 正文 **wave:41（CLIENT-239）** bullet（[#885](https://github.com/anitaguptaoffice/sanguo-slg/issues/885) / [#909](https://github.com/anitaguptaoffice/sanguo-slg/pull/909) `7c609e7a`） | 已合 |
| **战报详情攻守摘要与坐标只读复制条残余** | 正文 **wave:41（CLIENT-240）** bullet（[#886](https://github.com/anitaguptaoffice/sanguo-slg/issues/886) / [#906](https://github.com/anitaguptaoffice/sanguo-slg/pull/906) `dfaf07f8`） | 已合 |
| **邮件领取与 HUD 邮件/日常可领角标同步残余** | 正文 **wave:41（CLIENT-241）** bullet（[#887](https://github.com/anitaguptaoffice/sanguo-slg/issues/887) / [#910](https://github.com/anitaguptaoffice/sanguo-slg/pull/910) `1b36af47`） | 已合 |
| **背包商城分类扫描高亮与双榜钉选/招募钱包对比行残余** | 正文 **wave:41（CLIENT-242）** bullet（[#888](https://github.com/anitaguptaoffice/sanguo-slg/issues/888) / [#905](https://github.com/anitaguptaoffice/sanguo-slg/pull/905) `f8a7b6c6`） | 已合 |
| **1280 世界军情战报邮件商城排行招募组合 manifest** | [手动验收（1280 wave:41 组合 manifest CLIENT-243）](#手动验收1280-wave41-组合-manifest-client-243)（[#889](https://github.com/anitaguptaoffice/sanguo-slg/issues/889) / [#902](https://github.com/anitaguptaoffice/sanguo-slg/pull/902) `b57a393a`） | 已合 |

**推荐串联**（在 [Wave 40](#wave-40-h5-主城七槽队列抛光将领面板壳背包使用日常领取军团社交扫读1280组合manifestm4-出口--intg-037) 主城栈基础上 **轮转**回世界/军情/战报/邮件/商城/排行/招募栈）：**小地图视口**↔军情 scroll-sync（**CLIENT-236**）→ **格点** ETA 对照（**CLIENT-237**）→ **出征** 校验戳记（**CLIENT-238**）→ **战报** 密度键盘（**CLIENT-239**）→ **战报详情** 摘要坐标复制（**CLIENT-240**）→ **邮件** HUD 同步（**CLIENT-241**）→ **背包/商城/排行/招募** 扫读（**CLIENT-242**）→ 视口 **1280×720** 世界军情战报邮件商城排行招募 manifest（**CLIENT-243**）；网关字段见 `tools/smoke/README.md` **INTG-038**（[#890](https://github.com/anitaguptaoffice/sanguo-slg/issues/890) / [#907](https://github.com/anitaguptaoffice/sanguo-slg/pull/907) `e9d7b312`）。

**wave:41（CLIENT-236）小地图视口锚点与军情列表 scroll-sync**：军情列表选中行军时 **`syncMinimapViewportToIntelRow`** 将小地图视口平移至该行 `to_x`/`to_y` 锚点，并叠加 **`minimap-viewport-intel-sync-ring` 1.2s**（session **`minimap-viewport-intel-anchor-v1`** 序列化 zoom/pan；**CLIENT-220** `minimap-intel-sync-ring` / **CLIENT-138/090** 互选 **不退化**）；小地图 **拖拽/滚轮缩放** 结束后 **`scrollIntelListToVisibleMarch`** 将视口中心对应 `march_id` 行滚入 **`.panel-scroll-body[data-role='march-scroll']`**。单测：`minimapViewportIntelSync.test.ts`；`cd client && npm test` 绿。

**CLIENT-237（格点信息卡坐标次行与军情 ETA 只读对照残余扫读）**：世界格点信息卡顶栏 **`formatWorldTileIntelEtaResidualLine`** / `world-tile-intel-eta-residual-line` 展示选中格 **最近终点行军** `phase` + ETA（与 **CLIENT-205** `formatMarchIntelPhaseEtaStrip` 同源；**CLIENT-170/188** `world-tile-march-summary-line` **不退化**；无新 world RPC）；军情只读信息卡 **`march-intel-eta-residual-coord`** 目的格坐标次行与格点信息卡 **`world-tile-intel-eta-residual-ring`** **1s** 互高亮（**CLIENT-172/205** 信息卡阶段条 **不退化**）。单测：`worldTileIntelEtaResidual.test.ts`、`WorldPanels.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:41（CLIENT-238）出征表单校验汇总与提交后军情刷新戳记残余**：军事面板出征区底栏 **`data-role="march-form-validation-sweep-line"`** 由 **`formatMarchFormValidationSweepLine`** 只读汇总坐标 / 兵力 / 目标三段校验（**CLIENT-048** `march-form-error` 与 **CLIENT-206** 余量顶栏 **不退化**）；`StartMarch` / `MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp`** 展示 **`formatMarchSubmitIntelRefreshStampLine`**（加深与 **2.5s** 见 **CLIENT-253** `march-submit-intel-refresh-stamp-deep`），新 `march_id` 列表行附加 **`intel-list-refresh-march-pulse`**（**CLIENT-080/222** **不退化**；**无** CancelMarch）。单测：`marchFormValidationSweep.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:41（CLIENT-239）战报列表密度与键盘焦点环**：列表行 **`report-list-density-row`** 含 **`report-list-density-outcome-band`** 色带、**`report-list-density-timestamp`** 与 **`report-list-density-coord`**（**CLIENT-125/190** **不退化**）；面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 并附加 **`report-list-keyboard-focus-ring`**（**CLIENT-094/158** **不退化**）；**`data-battle-report-list-keyboard="off"`** 可关闭。单测：`battleReportListDensityKeyboard.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。

**wave:41（CLIENT-240）战报详情攻守模板摘要行与坐标只读复制条残余**：详情 outcome 色带下 **`battle-report-side-template-residual`**（`formatBattleReportSideTemplateResidualLine`：攻守主将模板一行 + `兵力损耗` 次行；**CLIENT-100** 侧栏互链与 **CLIENT-176** 列表摘要 **不退化**）；战场坐标区 **`data-action="copy-report-coords-readonly"`** / **`battle-report-coord-copy-bar`** 展示 **`x,y`** 文本，点击后 **Selection API** 选中态 **1.5s**（**无** `navigator.clipboard`；**CLIENT-208** 回合摘要条与 **CLIENT-223** 列表坐标标签 **不退化**）。单测：`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。

**wave:43（CLIENT-254）战报列表密度键盘相邻导航与详情坐标复制条残余巩固**：面板聚焦时 **j/k** 或 **↑/↓** 驱动相邻 `report_id` 时列表行叠加 **`report-list-keyboard-adjacent-nav-residual-ring` 2s**（**CLIENT-239** `report-list-density-row` / `report-list-keyboard-focus-ring` **不退化**；**无** proto 扩量）；详情坐标只读复制条点击后 **`formatBattleReportCoordCopyBarResidualSweep`** + **`battle-report-coord-copy-bar-residual-sweep` 2s** 扫读环（**CLIENT-240** Selection 选中 **1.5s** **不退化**；**无**剪贴板 API 扩权限）。单测：`battleReportListKeyboardAdjacentNavResidual.test.ts`、`battleReportDetailTemplateResidual.test.ts`、`BattleReportPanel.test.ts`；`cd client && npm test` 绿。

**wave:42（CLIENT-244）主城建造募兵队列 ETA 分段与完成态七槽焦点残余扫读**：建造/募兵队列行在 **CLIENT-212** `domestic-queue-eta-segment-label` 旁只读次行 **`formatDomesticQueueEtaSegmentResidualLabel`**（**`domestic-queue-eta-segment-residual-label`**：下一档阈值提示；与 **CLIENT-228** 双向焦点 **并列**，**非** wave:40 抛光主叙事重复）；队列完成时七槽对应格叠加 **`domestic-queue-complete-focus-residual-ring` 2s**（与 **CLIENT-197** `city-slot-complete-focus-ring`、**CLIENT-212** `domestic-queue-complete-slot-margin` **不退化**）；无新 domestic RPC / 募兵加速。单测：`domesticQueueEtaSegmentResidual.test.ts`、`domesticQueueCompleteFocusResidualRing.test.ts`、`queueRemainingProgress.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。

**wave:44（CLIENT-260）主城队列 ETA 分段完成焦点与七槽 ring 残余巩固**：队列行在 **CLIENT-244** 残余次行下追加 **`formatDomesticQueueEtaSegmentResidualDeepLabel`**（**`domestic-queue-eta-segment-residual-deep-label`** 巩固分段阈值 + **`domestic-queue-eta-segment-residual-deep-finish`** 完成倒计时只读第三行；**CLIENT-212** 分段标签 **不退化**；**非** wave:40/38 主叙事重复）；队列完成时七槽叠加 **`domestic-queue-complete-focus-residual-deep-ring` 2.5s**（与 **CLIENT-244** `domestic-queue-complete-focus-residual-ring` **并存不退化**；**无**主城建造新 RPC）。单测：`domesticQueueEtaSegmentResidualDeep.test.ts`、`domesticQueueCompleteFocusResidualDeepRing.test.ts`、`queueRemainingProgress.test.ts`；`cd client && npm test` 绿。

**CLIENT-241（邮件附件领取成功与 HUD 邮件/日常可领角标同步残余）**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaim`** 合并更新 `mailInboxSnapshot` 并推导底栏邮件未读/未领附件与日常可领计数（**CLIENT-050/106/209** **不退化**；**CLIENT-193** 与 **CLIENT-209** 扫读行经 `bumpMailClaimHudTodoSweepLinkage` 即时刷新）。列表成功行 **`mail-claim-hud-sync-pulse`** 2s（与 **CLIENT-192** `mail-claim-pulse` 并存）。单测：`mailClaimHudBadgeSync.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-255（邮件附件领取与 HUD 邮件日常角标同步残余）**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimDeep`** 在 **CLIENT-241** 同步基础上叠加列表行 **`mail-claim-hud-sync-deep-pulse`** 2.5s（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualSubline`** / **`mail-attachment-claim-residual-subline`** 展示附件类型 + 领取结果只读残余次行（**非** wave:42 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-271）邮件 HUD 附件领取残余加深**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeep`** 在 **CLIENT-255** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deep-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeepSubline`** / **`mail-attachment-claim-residual-deep-subline`** 在 **CLIENT-255** 残余次行上展示附件类型 ↔ 领取结果只读 **加深** 次行（**非** wave:44 **CLIENT-266** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeepSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:47（CLIENT-287）邮件 HUD 附件领取残余巩固再加深**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeeper`** 在 **CLIENT-271** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deeper-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeeperSubline`** / **`mail-attachment-claim-residual-deeper-subline`** 在 **CLIENT-271** 加深次行上展示附件类型 ↔ 领取结果只读 **巩固再加深** 第三行（**非** wave:46 **CLIENT-282** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeeperSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:41（CLIENT-242）背包商城分类扫描高亮与双榜钉选招募钱包对比行残余**：背包/商城分类 tab 切换时 **`highlightBagShopCategoryScanRow`** 首条匹配行 **`bag-shop-category-scan-ring` 1.5s**（**CLIENT-194/092** **不退化**；**无**新 SKU）；双榜顶栏 **`formatRankPinRefreshResidualLine`** / **`rank-pin-refresh-residual-line`**（**CLIENT-152/214** **不退化**）；招募 **`formatRecruitWalletCompareResidualLine`** / **`recruit-wallet-compare-residual-line`**（**CLIENT-056/215** **不退化**；**非** IAP）。单测：`bagShopCategoryScan.test.ts`、`rankPinRefreshResidual.test.ts`、`recruitWalletCompareResidual.test.ts`；`cd client && npm test` 绿。

**wave:43（CLIENT-256）背包商城行内态与面板返回来源高亮残余**：选中堆叠达本地上限或商城标价不足时，行内态 **`bag-shop-inline-state-residual-ring` 1.5s**（**CLIENT-194/092** 行内文案与缺口条 **不退化**；**无**新 SKU）；自排行/军情打开背包或商城时 **`panel-return-source-highlight-residual`** 高亮离开前分类 tab/chip **2s**（**CLIENT-211** `bag-row-return-highlight` / 分类滚动记忆 **不退化**）。单测：`bagShopInlineStateResidual.test.ts`、`panelReturnSourceHighlightResidual.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-272）背包商城行内态与面板返回来源高亮残余巩固加深**：在 **CLIENT-256** 行内态残余环上叠加 **`bag-shop-inline-state-residual-deep-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deep`** 高亮来源 tab/chip **2.5s**（**CLIENT-256** `panel-return-source-highlight-residual` **并存不退化**）。单测：`bagShopInlineStateResidualDeep.test.ts`、`panelReturnSourceHighlightResidualDeep.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:47（CLIENT-288）背包商城行内态与面板返回来源高亮残余巩固再加深**：在 **CLIENT-272** 行内态深环上叠加 **`bag-shop-inline-state-residual-deeper-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deeper`** 高亮来源 tab/chip **2.5s**（**CLIENT-272** `panel-return-source-highlight-residual-deep` **并存不退化**）。单测：`bagShopInlineStateResidualDeeperRing.test.ts`、`panelReturnSourceHighlightResidualDeeper.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:49（CLIENT-304）背包商城行内态与面板返回来源高亮残余巩固再加深一层**：在 **CLIENT-288** 行内态再深环上叠加 **`bag-shop-inline-state-residual-deepest-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deepest`** 高亮来源 tab/chip **2.5s**（**CLIENT-288** `panel-return-source-highlight-residual-deeper` **并存不退化**）。单测：`bagShopInlineStateResidualDeepestRing.test.ts`、`panelReturnSourceHighlightResidualDeepest.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:51（CLIENT-320）背包商城行内态与面板返回来源高亮残余巩固再加深二层**：在 **CLIENT-304** 行内态最深环上叠加 **`bag-shop-inline-state-residual-deepest-deeper-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deepest-deeper`** 高亮来源 tab/chip **2.5s**（**CLIENT-304** `panel-return-source-highlight-residual-deepest` **并存不退化**）。单测：`bagShopInlineStateResidualDeepestDeeperRing.test.ts`、`panelReturnSourceHighlightResidualDeepestDeeper.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:53（CLIENT-336）背包商城行内态与面板返回来源高亮残余巩固再加深三层**：在 **CLIENT-320** 行内态二层环上叠加 **`bag-shop-inline-state-residual-deepest-deepest-deeper-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deepest-deepest-deeper`** 高亮来源 tab/chip **2.5s**（**CLIENT-320** `panel-return-source-highlight-residual-deepest-deeper` **并存不退化**；1280 组合 manifest 软依赖 **CLIENT-339**）。单测：`bagShopInlineStateResidualDeepestDeepestDeeperRing.test.ts`、`panelReturnSourceHighlightResidualDeepestDeepestDeeper.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**wave:55（CLIENT-352）背包商城行内态与面板返回来源高亮残余巩固再加深四层**：在 **CLIENT-336** 行内态三层环上叠加 **`bag-shop-inline-state-residual-deepest-deepest-deepest-ring` 2s**（**CLIENT-194/092** 行内文案 **不退化**；**无**新 SKU）；自排行/军情返回背包或商城时 **`panel-return-source-highlight-residual-deepest-deepest-deepest`** 高亮来源 tab/chip **2.5s**（**CLIENT-336** `panel-return-source-highlight-residual-deepest-deepest-deeper` **并存不退化**；1280 组合 manifest 软依赖 **CLIENT-355**）。单测：`bagShopInlineStateResidualDeepestDeepestDeepestRing.test.ts`、`panelReturnSourceHighlightResidualDeepestDeepestDeepest.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。

**美术旁路**（**非** wave:41 backlog 实现卡）：**CLIENT-064**、**CLIENT-136**、**CLIENT-137**、**CLIENT-146**、**CLIENT-147**、**ART-012**（含工程修 [#698](https://github.com/anitaguptaoffice/sanguo-slg/pull/698)、终验补丁 [#721](https://github.com/anitaguptaoffice/sanguo-slg/pull/721) `ce61ee75`）——**非**本波 backlog；Draft [#697](https://github.com/anitaguptaoffice/sanguo-slg/pull/697) **不合**）。实现卡 **CLIENT-236～243**（自 **CLIENT-236** 起）。**勿**将 **ART-012** 登记为本波实现卡 ID。波次总览见 [`docs/ROADMAP.md`](../docs/ROADMAP.md)「Wave 41」。**仍** DATA-002；**无** DATA-003 / `cfg_act*` / 不可逆消费扩量；`CancelMarch`/募兵加速/主城建造新 RPC/战报 proto 扩量仍 out；世界瓦片/图集仍暂缓；**花钱类/IAP/新商城 SKU** 不做。wave:41 **工程全收口** main tip **`e9d7b312a3b7bbdfd8d602a959718ba410ec0c69`**（INTG-038 [#907](https://github.com/anitaguptaoffice/sanguo-slg/pull/907) `e9d7b312`）；**实现全收口** tip **`b57a393ac2abff796c5c7c2d5c1d2c82273ace5a`**（CLIENT-243 [#902](https://github.com/anitaguptaoffice/sanguo-slg/pull/902) `b57a393a`）；基线 wave:40 **全收口** tip **`b2171e2579a1de522da28a36f3801a84153f858a`**（DOCS-EXIT-032 [#880](https://github.com/anitaguptaoffice/sanguo-slg/pull/880) `b2171e25`；实现 tip **`fe533816`**）。

### 手动验收（1280 wave:41 组合 manifest CLIENT-243）

视口 **1280×720** `layout-narrow`：**世界** `minimap-viewport-intel-sync-ring` + session `minimap-viewport-intel-anchor-v1`（**CLIENT-236**；**CLIENT-220** 双向环不退化）、`world-tile-intel-eta-residual-ring`（**CLIENT-237**；**CLIENT-170/205** 不退化）、**军事出征** `march-form-validation-sweep-line` / `march-submit-intel-refresh-stamp`（**CLIENT-238**；**CLIENT-222** 交接 **不退化**）、**战报** `report-list-density-row` / `report-list-keyboard-focus-ring`（**CLIENT-239**）、`battle-report-side-template-residual-line` / `data-action="copy-report-coords-readonly"`（**CLIENT-240**）、**邮件** `mail-claim-hud-sync-pulse`（**CLIENT-241**；**CLIENT-225** outcome 桥 **不退化**）、**背包/商城** `bag-shop-category-scan-ring`、**排行** `rank-pin-refresh-residual-line`、**招募** `recruit-wallet-compare-residual-line`（**CLIENT-242**；**CLIENT-215** 钱包对比 **不退化**）与 **CLIENT-227/235** 同级窄屏契约（**非** wave:40 主城将领背包日常 manifest 面板集）；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；世界/军情/战报/邮件/商城密度行在窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-243）；`cd client && npm test` 绿。

1. 视口 **1280×720**：**世界/军情/军事出征/战报/邮件/背包/商城/排行/招募** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；上述 wave:41 DOM 钩子（软依赖 **CLIENT-236～242**）在窄屏下不换行溢出。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145/155/163/171/179/187/195/203/211/219/227/235** manifest 不退化。单测：`wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-243）；`cd client && npm test` 绿。（[#889](https://github.com/anitaguptaoffice/sanguo-slg/issues/889) / [#902](https://github.com/anitaguptaoffice/sanguo-slg/pull/902) `b57a393a`）

**wave:42（CLIENT-250）日常 chain·队列互链与 HUD 待办底栏深链残余**：日常可领行 **`formatQuestChainQueueHudResidualSubline`** / **`daily-quest-chain-queue-hud-residual-subline`** 展示 chain 类型 + 全局队列下一完成 ETA 只读残余次行（**CLIENT-218** `daily-quest-chain-type-subline` 与 **CLIENT-233** `scrollQuestClaimableIntoView` **不退化**；**非** wave:40 scroll 主叙事重复）。HUD 待办角标/合并行深链打开底栏时 **`pulseHudTodoToolbarDeepLinkResidual`** 叠加 **`hud-todo-toolbar-deep-link-residual-pulse`** 1.5s（与 **CLIENT-216** `toolbar-panel-deep-link-pulse`、**CLIENT-241** 邮件角标同步 **并存**；**非** wave:41 邮件 HUD 同步主叙事）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**wave:44（CLIENT-266）日常队列 HUD 深链巩固**：可领日常行在 **CLIENT-250** 残余次行上叠加 **`formatQuestChainQueueHudResidualDeepSubline`** / **`daily-quest-chain-queue-hud-residual-deep-subline`**，以 **CLIENT-218** chain 类型次行 ↔ 队列下一完成 ETA 只读 **巩固** 深链对照（**CLIENT-250/218 不退化**；**非** wave:43 **CLIENT-255** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-250** 残余脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deep-pulse`** **2s**（**CLIENT-241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**wave:46（CLIENT-282）日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深**：可领日常行在 **CLIENT-266** 深链巩固次行上叠加 **`formatQuestChainQueueHudResidualDeeperSubline`** / **`daily-quest-chain-queue-hud-residual-deeper-subline`** 第三行（chain 类型 ↔ 队列下一完成 ETA 只读 **巩固再加深** 对照；**CLIENT-266/218 不退化**；**非** wave:45 **CLIENT-271** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-266** 深脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deeper-pulse`** **2.5s**（**CLIENT-241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**wave:48（CLIENT-298）日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深一层**：可领日常行在 **CLIENT-282** 巩固再加深第三行上叠加 **`formatQuestChainQueueHudResidualDeepestSubline`** / **`daily-quest-chain-queue-hud-residual-deepest-subline`** 第四行（chain 类型 ↔ 队列下一完成 ETA 只读 **巩固再加深一层** 对照；**CLIENT-282/218 不退化**；**非** wave:47 **CLIENT-287** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-282** 更深脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deepest-pulse`** **2.5s**（**CLIENT-266/241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**wave:50（CLIENT-314）日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深二层**：可领日常行在 **CLIENT-298** 巩固再加深一层第四行上叠加 **`formatQuestChainQueueHudResidualDeepestDeeperSubline`** / **`daily-quest-chain-queue-hud-residual-deepest-deeper-subline`**（chain 类型 ↔ 队列下一完成 ETA 只读 **巩固再加深二层** 对照；**CLIENT-298/218 不退化**；**非** wave:49 **CLIENT-303** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-298** 最深脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deepest-deeper-pulse`** **3s**（**CLIENT-266/241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**wave:52（CLIENT-330）日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深三层**：可领日常行在 **CLIENT-314** 巩固再加深二层第五行上叠加 **`formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline`** / **`daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline`**（chain 类型 ↔ 队列下一完成 ETA 只读 **巩固再加深三层** 第六行对照；**CLIENT-314/298/218 不退化**；**非** wave:51 **CLIENT-319** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-314** 最深二层脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deepest-deepest-deeper-pulse`** **3s**（**CLIENT-266/241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1550](https://github.com/anitaguptaoffice/sanguo-slg/issues/1550)）

**wave:54（CLIENT-346）日常 chain 队列互链与 HUD 待办底栏深链残余巩固再加深四层**：可领日常行在 **CLIENT-330** 巩固再加深三层第六行上叠加 **`formatQuestChainQueueHudResidualDeepestDeepestDeepestSubline`** / **`daily-quest-chain-queue-hud-residual-deepest-deepest-deepest-subline`**（chain 类型 ↔ 队列下一完成 ETA 只读 **巩固再加深四层** 第七行对照；**CLIENT-330/218 不退化**；**非** wave:53 **CLIENT-335** 邮件 HUD 附件主叙事）。HUD 底栏面板打开时 **`pulseHudTodoToolbarDeepLinkResidual`** 在 **CLIENT-330** 最深三层脉冲上叠加 **`hud-todo-toolbar-deep-link-residual-deepest-deepest-deepest-pulse`** **3s**（**CLIENT-266/241** 角标同步 **不退化**）。单测：`questChainQueueHudResidual.test.ts`、`hudTodoToolbarDeepLinkResidual.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1592](https://github.com/anitaguptaoffice/sanguo-slg/issues/1592)）

**wave:49（CLIENT-303）邮件 HUD 附件领取与角标同步残余巩固再加深一层**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeepest`** 在 **CLIENT-287** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deepest-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeepestSubline`** / **`mail-attachment-claim-residual-deepest-subline`** 在 **CLIENT-287** 巩固再加深第三行上展示附件类型 ↔ 领取结果只读 **巩固再加深一层** 第四行（**非** wave:48 **CLIENT-298** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeepestSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1403](https://github.com/anitaguptaoffice/sanguo-slg/issues/1403)）

**wave:51（CLIENT-319）邮件 HUD 附件领取与角标同步残余巩固再加深二层**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeepestDeeper`** 在 **CLIENT-303** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deepest-deeper-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeepestDeeperSubline`** / **`mail-attachment-claim-residual-deepest-deeper-subline`** 在 **CLIENT-303** 巩固再加深一层第四行上展示附件类型 ↔ 领取结果只读 **巩固再加深二层** 第五行（**非** wave:50 **CLIENT-314** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeepestDeeperSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:53（CLIENT-335）邮件 HUD 附件领取与角标同步残余巩固再加深三层**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeeper`** 在 **CLIENT-319** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deepest-deepest-deeper-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeepestDeepestDeeperSubline`** / **`mail-attachment-claim-residual-deepest-deepest-deeper-subline`** 在 **CLIENT-319** 巩固再加深二层第五行上展示附件类型 ↔ 领取结果只读 **巩固再加深三层** 第六行（**非** wave:52 **CLIENT-330** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeepestDeepestDeeperSubline.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1568](https://github.com/anitaguptaoffice/sanguo-slg/issues/1568)）

**wave:55（CLIENT-351）邮件 HUD 附件领取与角标同步残余巩固再加深四层**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeepest`** 在 **CLIENT-335** 同步基础上叠加列表行 **`mail-claim-hud-sync-residual-deepest-deepest-deepest-pulse`** **3s**（**CLIENT-050/106/209** **不退化**）；邮件行 **`formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline`** / **`mail-attachment-claim-residual-deepest-deepest-deepest-subline`** 在 **CLIENT-335** 巩固再加深三层第六行上展示附件类型 ↔ 领取结果只读 **巩固再加深四层** 第七行（**非** wave:54 **CLIENT-346** 日常 chain/HUD 深链主叙事）。单测：`mailClaimHudBadgeSync.test.ts`、`mailAttachmentClaimResidualDeepestDeepestDeepestSubline.test.ts`；`cd client && npm test` 绿。（Closes [#1610](https://github.com/anitaguptaoffice/sanguo-slg/issues/1610)）

**wave:43（CLIENT-253）出征表单刷新戳记加深与兵力余量只读对照残余**：军事出征底栏校验汇总下 **`formatMarchFormTroopMarginResidualLine`** / **`march-form-troop-margin-residual-line`** 展示兵力余量警示主行 + **`march-form-troop-margin-residual-subline`** 钱包粮途耗只读残余次行（**CLIENT-206** `march-form-troop-reserve-line` 与 **CLIENT-048** `march-form-error` / `march-form-summary-warn` **不退化**；**无** CancelMarch）。`MarchAttack` / `StartMarch` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-deep`** 在 **CLIENT-238** 戳记上延长展示 **2.5s**，新 `march_id` 列表行 **`intel-list-refresh-march-pulse`** 与首条 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-pulse`** 同步（**CLIENT-080/222** **不退化**）。单测：`marchFormTroopMarginResidual.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-269）出征表单刷新戳记与兵力余量只读对照残余加深**：军事出征底栏在 **CLIENT-253** 残余次行上追加 **`formatMarchFormTroopMarginResidualDeepLine`** / **`march-form-troop-margin-residual-deep-line`** 兵力余量 ↔ 钱包粮途耗只读加深第三行（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deep`** 在 **CLIENT-253** `march-submit-intel-refresh-stamp-deep` 上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deep-pulse`** 与 **CLIENT-253** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeep.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:47（CLIENT-285）出征表单刷新戳记与兵力余量只读对照残余巩固再加深**：军事出征底栏在 **CLIENT-269** 深对照第三行上追加 **`formatMarchFormTroopMarginResidualDeeperLine`** / **`march-form-troop-margin-residual-deeper-line`** 兵力余量 ↔ 钱包只读 **巩固再加深** 第四行（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deeper`** 在 **CLIENT-269** 戳记上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deeper-pulse`** 与 **CLIENT-269** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeeper.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:49（CLIENT-301）出征表单刷新戳记与兵力余量只读对照残余巩固再加深一层**：军事出征底栏在 **CLIENT-285** 巩固再加深第四行上追加 **`formatMarchFormTroopMarginResidualDeepestLine`** / **`march-form-troop-margin-residual-deepest-line`** 兵力余量 ↔ 钱包只读 **巩固再加深一层** 第五行（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deepest`** 在 **CLIENT-285** 戳记上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deepest-pulse`** 与 **CLIENT-285** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeepest.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

**wave:51（CLIENT-317）出征表单刷新戳记与兵力余量只读对照残余巩固再加深二层**：军事出征底栏在 **CLIENT-301** 巩固再加深一层第五行上追加 **`formatMarchFormTroopMarginResidualDeepestDeeperLine`** / **`march-form-troop-margin-residual-deepest-deeper-line`** 兵力余量 ↔ 钱包只读 **巩固再加深二层** 对照行（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deepest-deeper`** 在 **CLIENT-301** 戳记上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deepest-deeper-pulse`** 与 **CLIENT-301** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeepestDeeper.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1534](https://github.com/anitaguptaoffice/sanguo-slg/issues/1534)）

**wave:53（CLIENT-333）出征表单刷新戳记与兵力余量只读对照残余巩固再加深三层**：军事出征底栏在 **CLIENT-317** 巩固再加深二层第六行上追加 **`formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine`** / **`march-form-troop-margin-residual-deepest-deepest-deeper-line`** 兵力余量 ↔ 钱包只读 **巩固再加深三层** 第七行对照（**CLIENT-206/048** **不退化**；**无** CancelMarch）。`MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp-residual-deepest-deepest-deeper`** 在 **CLIENT-317** 戳记上延长展示 **3s**，首条新行军 **`intel-row-phase-subline`** **`intel-list-refresh-march-subline-residual-deepest-deepest-deeper-pulse`** 与 **CLIENT-317** 次行脉冲 **并存**（**CLIENT-080** **不退化**）。单测：`marchFormTroopMarginResidualDeepestDeepestDeeper.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。（Closes [#1566](https://github.com/anitaguptaoffice/sanguo-slg/issues/1566)）

### 手动验收（1280 wave:31 组合 manifest CLIENT-163）

视口 **1280×720** `layout-narrow`：**军事出征/募兵**、**军情**、**战报** `battle-report-detail-nav`、**邮件** 批量工具栏（`claim-mail-batch` / `claim-mail-all`）、**军团/聊天** `guild-chat-draft` / `chat-input-counter` / `chat-unread-separator`（**CLIENT-185**）；邮件 tab 角标 `mail-filter-tab-badge`（**CLIENT-162**） 与 **CLIENT-145/155** 同级；`.panel-scroll-body` **`padding-bottom: 64px`**；`march-queue-banner` 与未读分隔线窄屏 **无横向溢出**；`data-art-skin="off"` 可跳过。单测：`wave31MarchMailSocialNarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`；`cd client && npm test` 绿。（[#613](https://github.com/anitaguptaoffice/sanguo-slg/issues/613)）

### 手动验收（HUD 经济扫读 CLIENT-148）

在 **CLIENT-081** 资源扫读与 **CLIENT-134** 待办深链基础上巩固：`GetCityState` 同行 `production_rates` + `wallet` 驱动顶栏 **hover / focus / 点击展开** 次行 `formatResourceSweepLine(production_rates, wallet)`（四资源 **余量 +/h**；缺 `production_rates` 仅余量）；`diffWalletPositiveGains` 为 **CLIENT-051** `resource-pulse` 与轮询后展开条余量刷新的**同一 wallet 事实源**（`patchSession` / `walletResourcePulseKeys`）；**CLIENT-059** 队列面板总览与资源展开条并存；`HudTodoBadgePoll` **不**嵌套并发 `GetCityState`。

1. `make dev` 进主城：悬停或 Tab 聚焦顶栏资源条 → 次行应含余量与 **+/h**（与网关 `GetCityState` 一致）；点击展开后日常领奖使粮增加 → **resource-pulse** 与展开条粮余量同步更新，展开态不随 `renderHud` 丢失。
2. 打开 **队列** 面板：顶栏资源扫读与队列总览 **同时**可读；待办角标深链仍只走既有轮询单飞。
3. 单测：`hudFormat.test.ts`（`formatResourceSweepLine`、`diffWalletPositiveGains`）、`hudResourcePulse.test.ts`、`artResourceHud.test.ts`；`cd client && npm test` 绿。

### 手动验收（1280 wave:30 组合 manifest CLIENT-155）

视口 **1280×720** `layout-narrow`：顶栏 **HUD 资源展开条**（`hud-resource-sweep` / **CLIENT-148** 产出扫读）、**队列顶栏** `queue-panel-overview`（**CLIENT-059**）、**日常筛选条**（`filterListNarrowManifest` / **CLIENT-127** + 行次行 `daily-quest-row-progress` 槽位 **CLIENT-150**）、**将领列表** + 预留 **`hero-list-filters`**（**CLIENT-151**）、**排行钉选** `rank-viewer-bar` / `rank-pin-row`（**CLIENT-152** `rank-my-rank-changed-pulse`）、**背包/商城** `bag-category-tabs` / `shop-offer-afford-inline`（**CLIENT-153/154** 软依赖 DOM）与 **CLIENT-127/135** 同级窄屏契约；`.panel-scroll-body` **`padding-bottom: 64px`** 清底栏 **56px**；`data-art-skin="off"` 可跳过。单测：`mainCityWave30NarrowManifest.test.ts`、`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-155）；`cd client && npm test` 绿。

1. 视口 **1280×720**：顶栏资源条 **hover/focus/点击** 展开 `formatResourceSweepLine` 次行不换行溢出；打开 **队列** 见顶栏总览行；**日常** 筛选 chip 条横向滚动；**将领** / **排行** 长列表在 `.panel-scroll-body` 内滚动且末行不被底栏遮挡；**背包/商城** tab 与行内文案 **无横向溢出**。
2. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119/127/135/145** manifest 不退化。

### 手动验收（1280 世界军情战报社交 CLIENT-145）

视口 **1280×720** `layout-narrow`：**世界小地图展开区**（窄屏放大 rect）、**军情/战报/排行/军团/聊天** 面板根 `worldIntelSocialNarrowManifest`（与 CLIENT-119/127 同级）；session **marchTargetMemory** 与军情 **再出征** 并存，预填变更时 **march-form-error** / **march-form-summary** 即时重算；军情/战报列表 **↑/↓** roving；`.panel-scroll-body` **padding-bottom: 64px** 清底栏 **56px**；`data-art-skin="off"` 可跳过。单测：`worldIntelSocialNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-145）；`cd client && npm test` 绿。（[#565](https://github.com/anitaguptaoffice/sanguo-slg/issues/565) / [#577](https://github.com/anitaguptaoffice/sanguo-slg/pull/577) `f60e3e95`）

### 手动验收（1280 主城将领 HUD manifest CLIENT-135）

`#layout-frame.layout-narrow` 下 **建造侧栏**（`building`）、**队列**（`queue`）、**将领**（`hero`）与画布 **七槽升级 overlay**、顶栏 **HUD 待办角标**、**CLIENT-129** 预留 `data-panel-state` 骨架：**不遮挡底栏 56px**、**无横向溢出**；`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：点画布槽位打开 **建造侧栏**，底栏打开 **队列** / **将领**；面板内 **Tab** 焦点在面板根内循环，**Esc** 关闭并将焦点回到对应底栏触发钮（**CLIENT-110** 口径）；**将领列表** / **队列建造行** 聚焦后 **↑/↓** roving 切换（`data-list-roving-keyboard=off` 可关）。
2. 七槽 DOM overlay、队列表与将领长列表在 `.panel-scroll-body` 内滚动；`padding-bottom: 64px` 与 `scroll-margin-bottom` 避免末行/焦点环被底栏裁切；顶栏 `hud-center-todo-badge` 与底栏 `toolbar-badge` 窄屏省略不退化 **CLIENT-107**。
3. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；**CLIENT-111/119** manifest 不退化。
4. 单测：`mainCityHeroHudNarrowManifest.test.ts`、`centerPanelFocusTrap.test.ts`、`listRovingTabindex.test.ts`、`layoutViewport.test.ts`（CLIENT-135 注册表）；`cd client && npm test` 绿。

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
| 底栏 **聊天** / **军团** | `hudTodoSocialBadgesFromChatSummary`（**CLIENT-161**，数据来自 **CLIENT-102** `ChatUnreadTracker`） | 滚过 `chat-unread-separator` 或 **标为已读**（**CLIENT-161/185**） |
| 顶栏 **待办** | `buildHudCenterTodoCounts`：可领附件邮件 / 可领日常 / `BuildCompleteTodoTracker` 建造完成 | 领取、确认队列完成槽位；与上表邮件/日常数字同源 |

dev 空邮件/空日常：角标 **0 隐藏**，不抛错。单测：`hudTodoBadges.test.ts`、`hudTodoBadgePoll.test.ts`、`hudCenterTodo.test.ts`。

### 手动验收（HUD 待办与面板 tab/chip 一致 CLIENT-162）

在 [CLIENT-107](#手动验收hud-待办角标单一事实源-client-107) / [CLIENT-134](#手动验收hud-角标深链-client-134) 之上：`buildHudTodoReconciled` + `reconcileHudTodoBadges` 保证底栏 **邮件/日常/队列** 与邮件 **未读·全部** chip、日常 **可领取** chip、**GetCityState** 队列角标 **零漂移**；`mailPanelTabBadgeCounts` / `mailPanelTabBadgeCountsFromPollSnapshot` 为面板与深链唯一推导。聊天/军团走 `chatSocialBadgesFromSummary`（**CLIENT-102/161**），不并入顶栏待办总和。`HudTodoBadgePoll.pollOnce` 并发 **合并为单飞**，与 `ChatUnreadPoll` 同 tick 不嵌套重复 RPC。单测：`hudTodoBadges.test.ts` 快照表、`hudTodoBadgePoll.test.ts` 合并轮询用例。

### 手动验收（将领招募执行反馈 CLIENT-098）

在 [CLIENT-056](#手动验收将领招募钱包对比-client-056) 钱包对比与 [CLIENT-067](#手动验收四类面板统一错误-client-067) 错误口径上：

1. 点 **招募**：主按钮 **disabled** 且文案 **招募中…**（**CLIENT-114** 巩固，见下节）；成功则状态栏 `formatRecruitSuccessStatus` 摘要，可选 **打开详情**（带新 `hero_id`）；扣费涉及粮木铁石时顶栏 **resource-pulse**（**CLIENT-051**）。
2. 失败：inline 错误保留模板选中；不扩 recruit pool。单测：`HeroMailPanels.test.ts` / 招募状态机纯函数。

### 手动验收（将领招募提交反馈巩固 CLIENT-114）

在 [CLIENT-098](#手动验收将领招募执行反馈-client-098) 执行反馈与 [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 选中记忆上巩固（无新招募模板 SKU）：

1. `hero.v1.RecruitHero` 往返：主按钮 **招募中…** + **disabled**（`recruitSubmitFeedback`）；成功：`recruit-success-toast` 摘要 + 列表行短暂 **`hero-row-recruited-pulse`**，并写入 **`hero-detail-selected-id`**（与详情深链一致）。
2. `ListPlayerHeroes` 刷新后新行 **滚入视**（`focusRecruitedHeroListRow`）；失败仍展示 **CLIENT-056** 钱包/道具对比 + **CLIENT-067** inline，保留模板选中。
3. 单测：`recruitSubmitFeedback.test.ts`（`resolveRecruitSubmitPhase` 边界与行脉冲）、`HeroMailPanels.test.ts`。

### 手动验收（将领列表刷新与选中记忆 CLIENT-099）

在 [CLIENT-072](#手动验收将领详情养成对比-client-072) 养成对比上：

1. **刷新** 将领列表：loading + 成功后 `hero-list-refresh-pulse` 短暂高亮；失败走 **CLIENT-067**。
2. 关闭再开将领面板：`sessionStorage` **`hero-detail-selected-id`** 恢复上次行并滚入视；与 **CLIENT-098** 成功深链写入一致。

### 手动验收（将领列表行扫读 CLIENT-132）

在 [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 选中记忆与 [CLIENT-114](#手动验收将领招募提交反馈巩固-client-114) 招募行脉冲不退化前提下：

1. **刷新列表** 后每行 **主行** 为模板名 + **Lv.N** + **忠诚** 摘要（`formatHeroListRowPrimary`）；**次行** 为四维缩写（已加载详情时）或 **详情查看养成**（`formatHeroListRowSecondary`）。
2. 行容器可选挂 `data-ui-panel-listrow="ui.panel.listrow.default.v1"`；`data-hero-id` / `hero-row-recruited-pulse` / 滚入视逻辑不变。
3. 单测：`heroListRowFormat.test.ts`、`HeroMailPanels.test.ts`；全量 `cd client && npm test`。

### 手动验收（将领列表筛选排序记忆 CLIENT-151）

在 [CLIENT-132](#手动验收将领列表行扫读-client-132) 行扫读与 [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 选中记忆不退化前提下：

1. 将领列表上方筛选条：**全部 / 可出征** + 排序 **等级↓ / 忠诚↓**（`data-ui-filter-chip`；`data-art-skin=off` 回退文字按钮）。
2. 筛选与排序仅客户端处理已加载 `ListPlayerHeroes` 快照，不写新 RPC；「可出征」按忠诚阈值（默认 ≥30，已加载详情时尊重 `loyalty_min`）过滤。
3. `sessionStorage`：**`hero-list-filter-v1`** / **`hero-list-sort-v1`** 跨会话记忆；筛选无匹配走 **CLIENT-129** empty 占位，加载/拉取失败仍走 **CLIENT-129** loading/error。
4. 单测：`heroListFilter.test.ts`（`filterHeroListRows` / `sortHeroListRows`）、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领列表刷新戳记与详情返回记忆 CLIENT-182）

在 [CLIENT-151](#手动验收将领列表筛选排序记忆-client-151) 筛选排序与 [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 选中记忆不退化前提下：

1. **刷新列表** 成功后顶栏展示 `formatHeroListRefreshedAt`（**列表更新：刚刚 / N 分钟前** 等，基于 `ListPlayerHeroes` 成功时刻）；刷新中面板根 `data-hero-list-inflight=1` 且按钮 **disabled**，禁止重复点击。
2. 自列表点选将领打开详情后关闭再开面板：`sessionStorage` **`hero-list-selected-v1`** 恢复 **`hero-scroll` scrollTop** 与对应 **`hero_id` 行高亮**；**`hero-list-filter-v1` / `hero-list-sort-v1`** 仍按 CLIENT-151 恢复。
3. 单测：`formatHeroListRefreshedAt.test.ts`、`heroListSelectedSession.test.ts`、`heroListRefreshFeedback.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领列表↔详情筛选记忆扫读 CLIENT-199）

在 [CLIENT-151](#手动验收将领列表筛选排序记忆-client-151) 与 [CLIENT-182](#手动验收将领列表刷新戳记与详情返回记忆-client-182) 不退化前提下：

1. 自列表点选将领：`sessionStorage` **`hero-list-return-v1`** 快照当前 **筛选 chip + 排序 + `hero-scroll` scrollTop + `hero_id`**（与 **`hero-list-filter-v1` / `hero-list-sort-v1` / `hero-list-selected-v1`** 并存）；详情顶栏展示 **`formatHeroDetailFromListHint`**（`data-role="hero-detail-list-hint"`）。
2. 详情 **返回列表**：按 `hero-list-return-v1` 恢复筛选/排序/滚动与行高亮；**刷新戳记** `hero-list-refreshed-at` 与 **CLIENT-072** 养成对比/进度条不退化。
3. 单测：`heroListReturnState.test.ts`（`serializeHeroListReturnState` / `formatHeroDetailFromListHint`）、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领列表返回高亮与筛选 chip 记忆抛光 CLIENT-231）

在 [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 列表↔详情互跳与 [CLIENT-151](#手动验收将领列表筛选排序记忆-client-151) **`hero-list-filter-v1`** 不退化、[CLIENT-213](#手动验收将领忠诚次行与养成道具堆叠扫读-client-213) 忠诚次行 **不重复主叙事** 前提下：

1. 详情 **返回列表**：对应 `hero_id` 行追加 **`hero-list-return-highlight` 2s** 扫读脉冲（与 `.selected` 选中并存）；消费 **`hero-list-return-v1`** 后筛选/排序仍由 **`hero-list-filter-v1` / `hero-list-sort-v1`** 恢复 chip 态。
2. **`hero-list-selected-v1`** 滚动与选中记忆、详情顶栏 **`formatHeroDetailFromListHint`** 与 **CLIENT-182** 刷新戳记不退化。
3. 单测：`heroListReturnHighlight.test.ts`、`heroListReturnState.test.ts`（`consumeHeroListReturnState`）、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领 panelState 与筛选 chip 记忆残余抛光 CLIENT-247）

在 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) 返回高亮与 [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) **`hero-list-selected-v1`** 不退化、[CLIENT-129](#panelstatechrome) `data-panel-state` 骨架不退化前提下：

1. 将领列表/详情 **loading / empty / error** 占位下追加只读 **`hero-panel-state-residual-sweep`**（`formatHeroPanelStateResidualSweepLine`：当前筛选/排序记忆 + gateway 重试扫读）；列表首屏拉取失败仍走 **CLIENT-173** 行内 **`panel-gateway-retry`**（`retry-refresh-heroes`）且顶栏 **CLIENT-067** `hero-list-form-error` **不退化**。
2. 筛选 chip 点击写入 **`hero-list-filter-chip-residual-v1`**（与 **`hero-list-filter-v1` / `hero-list-sort-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-sweep`** 展示末次 chip 记忆摘要。
3. 单测：`heroPanelStateResidualSweep.test.ts`、`heroListFilterChipResidual.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:44（CLIENT-263）将领 panelState 与列表筛选 chip 记忆残余抛光加深**：列表/详情 loading·empty·error 在 **CLIENT-247** `hero-panel-state-residual-sweep` 下追加只读 **`hero-panel-state-residual-deep-sweep`**（`formatHeroPanelStateResidualDeepSweepLine`：巩固文案 + **`formatHeroPanelGatewayRetryDeepHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deep-v1`**（与 **`hero-list-filter-chip-residual-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deep-sweep`** 展示深化记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeepSweep.test.ts`、`heroListFilterChipResidualDeep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领 panelState 与筛选 chip 记忆残余抛光加深 CLIENT-263）

在 [CLIENT-247](#手动验收将领-panelstate-与筛选-chip-记忆残余抛光-client-247) 扫读行与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-sweep`** 下追加 **`hero-panel-state-residual-deep-sweep`**（巩固文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deep-v1`**，筛选条 **`hero-list-filter-chip-residual-deep-sweep`** 展示深化摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeepSweep.test.ts`、`heroListFilterChipResidualDeep.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（[#991](https://github.com/anitaguptaoffice/sanguo-slg/issues/991)）

**wave:46（CLIENT-279）将领 panelState 与列表筛选 chip 记忆残余抛光再加深**：列表/详情 loading·empty·error 在 **CLIENT-263** `hero-panel-state-residual-deep-sweep` 下追加只读 **`hero-panel-state-residual-deeper-sweep`**（`formatHeroPanelStateResidualDeeperSweepLine`：巩固再加深文案 + **`formatHeroPanelGatewayRetryDeeperHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deeper-v1`**（与 **`hero-list-filter-chip-residual-deep-v1`**、**`hero-list-filter-chip-residual-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deeper-sweep`** 展示巩固再加深记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeeperSweep.test.ts`、`heroListFilterChipResidualDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领 panelState 与列表筛选 chip 记忆残余抛光再加深 CLIENT-279）

在 [CLIENT-263](#手动验收将领-panelstate-与筛选-chip-记忆残余抛光加深-client-263) 深化扫读与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-deep-sweep`** 下追加 **`hero-panel-state-residual-deeper-sweep`**（巩固再加深文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deeper-v1`**，筛选条 **`hero-list-filter-chip-residual-deeper-sweep`** 展示巩固再加深摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeeperSweep.test.ts`、`heroListFilterChipResidualDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1076](https://github.com/anitaguptaoffice/sanguo-slg/issues/1076)）

**wave:48（CLIENT-295）将领 panelState 与列表筛选 chip 记忆残余抛光再加深一层**：列表/详情 loading·empty·error 在 **CLIENT-279** `hero-panel-state-residual-deeper-sweep` 下追加只读 **`hero-panel-state-residual-deepest-sweep`**（`formatHeroPanelStateResidualDeepestSweepLine`：巩固再加深一层文案 + **`formatHeroPanelGatewayRetryDeepestHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` / **CLIENT-279** **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deepest-v1`**（与 **`hero-list-filter-chip-residual-deeper-v1`**、**`hero-list-filter-chip-residual-deep-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deepest-sweep`** 展示巩固再加深一层记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeepestSweep.test.ts`、`heroListFilterChipResidualDeepest.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:50（CLIENT-311）将领 panelState 与列表筛选 chip 记忆残余抛光再加深二层**：列表/详情 loading·empty·error 在 **CLIENT-295** `hero-panel-state-residual-deepest-sweep` 下追加只读 **`hero-panel-state-residual-deepest-deeper-sweep`**（`formatHeroPanelStateResidualDeepestDeeperSweepLine`：巩固再加深二层文案 + **`formatHeroPanelGatewayRetryDeepestDeeperHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` / **CLIENT-295** **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deepest-deeper-v1`**（与 **`hero-list-filter-chip-residual-deepest-v1`**、**`hero-list-filter-chip-residual-deeper-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deepest-deeper-sweep`** 展示巩固再加深二层记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeepestDeeperSweep.test.ts`、`heroListFilterChipResidualDeepestDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:52（CLIENT-327）将领 panelState 与列表筛选 chip 记忆残余抛光再加深三层**：列表/详情 loading·empty·error 在 **CLIENT-311** `hero-panel-state-residual-deepest-deeper-sweep` 下追加只读 **`hero-panel-state-residual-deepest-deepest-deeper-sweep`**（`formatHeroPanelStateResidualDeepestDeepestDeeperSweepLine`：巩固再加深三层文案 + **`formatHeroPanelGatewayRetryDeepestDeepestDeeperHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` / **CLIENT-311** **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deepest-deepest-deeper-v1`**（与 **`hero-list-filter-chip-residual-deepest-deeper-v1`**、**`hero-list-filter-chip-residual-deepest-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deepest-deepest-deeper-sweep`** 展示巩固再加深三层记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeepestDeepestDeeperSweep.test.ts`、`heroListFilterChipResidualDeepestDeepestDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:54（CLIENT-343）将领 panelState 与列表筛选 chip 记忆残余抛光再加深四层**：列表/详情 loading·empty·error 在 **CLIENT-327** `hero-panel-state-residual-deepest-deepest-deeper-sweep` 下追加只读 **`hero-panel-state-residual-deepest-deepest-deepest-sweep`**（`formatHeroPanelStateResidualDeepestDeepestDeepestSweepLine`：巩固再加深四层文案 + **`formatHeroPanelGatewayRetryDeepestDeepestDeepestHint`** 网关重试 hint；**CLIENT-173** `panel-gateway-retry` / **CLIENT-067** `hero-list-form-error` / **CLIENT-327** **不退化**）。筛选 chip 点击写入 **`hero-list-filter-chip-residual-deepest-deepest-deepest-v1`**（与 **`hero-list-filter-chip-residual-deepest-deepest-deeper-v1`**、**`hero-list-filter-chip-residual-deepest-deeper-v1`**、**`hero-list-filter-v1`**、**`hero-list-return-v1`** 并存）；筛选条下 **`hero-list-filter-chip-residual-deepest-deepest-deepest-sweep`** 展示巩固再加深四层记忆摘要（**CLIENT-231** 返回高亮 / **CLIENT-199** `hero-list-selected-v1` **不退化**）。单测：`heroPanelStateResidualDeepestDeepestDeepestSweep.test.ts`、`heroListFilterChipResidualDeepestDeepestDeepest.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领 panelState 与列表筛选 chip 记忆残余抛光再加深四层 CLIENT-343）

在 [CLIENT-327](#手动验收将领-panelstate-与列表筛选-chip-记忆残余抛光再加深三层-client-327) 巩固再加深三层扫读与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-deepest-deepest-deeper-sweep`** 下追加 **`hero-panel-state-residual-deepest-deepest-deepest-sweep`**（巩固再加深四层文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deepest-deepest-deepest-v1`**，筛选条 **`hero-list-filter-chip-residual-deepest-deepest-deepest-sweep`** 展示巩固再加深四层摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeepestDeepestDeepestSweep.test.ts`、`heroListFilterChipResidualDeepestDeepestDeepest.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1589](https://github.com/anitaguptaoffice/sanguo-slg/issues/1589)）

### 手动验收（将领 panelState 与列表筛选 chip 记忆残余抛光再加深三层 CLIENT-327）

在 [CLIENT-311](#手动验收将领-panelstate-与列表筛选-chip-记忆残余抛光再加深二层-client-311) 巩固再加深二层扫读与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-deepest-deeper-sweep`** 下追加 **`hero-panel-state-residual-deepest-deepest-deeper-sweep`**（巩固再加深三层文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deepest-deepest-deeper-v1`**，筛选条 **`hero-list-filter-chip-residual-deepest-deepest-deeper-sweep`** 展示巩固再加深三层摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeepestDeepestDeeperSweep.test.ts`、`heroListFilterChipResidualDeepestDeepestDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1547](https://github.com/anitaguptaoffice/sanguo-slg/issues/1547)）

### 手动验收（将领 panelState 与列表筛选 chip 记忆残余抛光再加深二层 CLIENT-311）

在 [CLIENT-295](#手动验收将领-panelstate-与列表筛选-chip-记忆残余抛光再加深一层-client-295) 巩固再加深一层扫读与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-deepest-sweep`** 下追加 **`hero-panel-state-residual-deepest-deeper-sweep`**（巩固再加深二层文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deepest-deeper-v1`**，筛选条 **`hero-list-filter-chip-residual-deepest-deeper-sweep`** 展示巩固再加深二层摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeepestDeeperSweep.test.ts`、`heroListFilterChipResidualDeepestDeeper.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1504](https://github.com/anitaguptaoffice/sanguo-slg/issues/1504)）

### 手动验收（将领 panelState 与列表筛选 chip 记忆残余抛光再加深一层 CLIENT-295）

在 [CLIENT-279](#手动验收将领-panelstate-与列表筛选-chip-记忆残余抛光再加深-client-279) 巩固再加深扫读与 [CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) / [CLIENT-199](#手动验收将领列表详情筛选记忆扫读-client-199) 记忆 **不退化** 前提下：

1. 将领列表/详情 **loading / empty / error** 占位在 **`hero-panel-state-residual-deeper-sweep`** 下追加 **`hero-panel-state-residual-deepest-sweep`**（巩固再加深一层文案 + gateway 重试 hint）；首屏失败仍走 **CLIENT-173** 行内重试与顶栏表单错误。
2. 筛选 chip 写入 **`hero-list-filter-chip-residual-deepest-v1`**，筛选条 **`hero-list-filter-chip-residual-deepest-sweep`** 展示巩固再加深一层摘要；**`hero-list-return-highlight`** 与 **`hero-list-selected-v1`** 仍正常。
3. 单测：`heroPanelStateResidualDeepestSweep.test.ts`、`heroListFilterChipResidualDeepest.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1382](https://github.com/anitaguptaoffice/sanguo-slg/issues/1382)）

### 手动验收（将领忠诚次行与养成道具堆叠扫读 CLIENT-213）

在 [CLIENT-132](#手动验收将领列表行扫读-client-132) / [CLIENT-165](#手动验收将领详情养成道具缺口与背包深链-client-165) / [CLIENT-198](#手动验收将领详情养成对比-client-072) 不退化前提下：

1. **将领列表** 每行在主行与四维次行之间展示 `formatHeroListLoyaltySubline`（`hero-list-row-loyalty-subline`）：忠诚/可选士气只读摘要 + 可出征态；忠诚低于 **CLIENT-151** 阈值时前置 `hero-loyalty-warn-dot`（同源 `ListPlayerHeroes` 字段，**无** hero 专用升级 RPC）。
2. **将领详情** 养成进度区下方展示 `formatHeroDetailConsumableStackLine`（`hero-detail-consumable-stack-line`）：`ListPlayerBag` 同源养成道具 **堆叠×N** + 升级/忠诚 **需/缺口** 只读对比；`hero-upgrade-item-gap` 与 **CLIENT-198** 进度条次行 **不退化**。
3. 单测：`heroListLoyaltySubline.test.ts`、`heroDetailConsumableStackLine.test.ts`、`HeroMailPanels.test.ts`、`heroMailState.test.ts`；`cd client && npm test` 绿。（[#786](https://github.com/anitaguptaoffice/sanguo-slg/issues/786)）

### 手动验收（将领列表忠诚次行与详情养成道具堆叠扫读残余 CLIENT-246）

在 [CLIENT-213](#手动验收将领忠诚次行与养成道具堆叠扫读-client-213) 忠诚主行与正文 **CLIENT-230** hero 壳挂载 **不退化**、[CLIENT-231](#手动验收将领列表返回高亮与筛选-chip-记忆抛光-client-231) 列表返回抛光 **不重复主叙事** 前提下：

1. **将领列表** 每行在 **CLIENT-213** 忠诚次行下方展示 `formatHeroListLoyaltyResidualSubline`（`hero-list-row-loyalty-residual-subline` / `data-role="hero-list-loyalty-residual-subline"`）：忠诚摘要 + 出征阈值只读对照；低忠诚时前置 `hero-loyalty-residual-warn-dot`（与主行 `hero-loyalty-warn-dot` 同源阈值；**无** hero 专用升级 RPC）。
2. **将领详情** 养成进度区在 **CLIENT-213** `hero-detail-consumable-stack-line` 下方展示 `formatHeroDetailConsumableStackResidualLine`（`hero-detail-consumable-stack-residual-line`）：背包同源养成道具 **持/需** 汇总 + 总缺口只读扫读；缺口时 `hero-detail-consumable-stack-residual-deficit`；`hero-upgrade-item-gap` 与 **CLIENT-230** `data-art-panel=ui.panel.hero.v1` 壳 **不退化**（**非** ART-012 任务 ID）。
3. 单测：`heroListLoyaltyResidualSubline.test.ts`、`heroDetailConsumableStackResidualLine.test.ts`、`HeroMailPanels.test.ts`、`heroMailState.test.ts`；`cd client && npm test` 绿。（[#915](https://github.com/anitaguptaoffice/sanguo-slg/issues/915)）

**wave:42（CLIENT-246）将领列表忠诚次行与详情养成道具堆叠扫读残余**：列表 **`formatHeroListLoyaltyResidualSubline`** + **`hero-loyalty-residual-warn-dot`**；详情 **`formatHeroDetailConsumableStackResidualLine`** / **`hero-detail-consumable-stack-residual-line`**；**CLIENT-213/230** **不退化**；无 hero 专用升级 RPC。单测：`heroListLoyaltyResidualSubline.test.ts`、`heroDetailConsumableStackResidualLine.test.ts`、`HeroMailPanels.test.ts`、`heroMailState.test.ts`。

**wave:44（CLIENT-262）** 在 **CLIENT-246** 之上叠加列表深巩固次行与详情深扫读行，见 [Wave 44](#wave-44-h5-主城队列-eta完成焦点残余巩固将领养成扫读panelstate-筛选双榜钉选军团聊天日常-hud-深链1280-组合-manifestm4-出口--intg-041) bullet。

### 手动验收（将领详情养成道具使用反馈 CLIENT-115）

在 [CLIENT-072](#手动验收将领详情养成对比-client-072) 养成对比与 [CLIENT-067](#手动验收四类面板统一错误-client-067) 错误口径上：

1. 点选将领后详情区 **使用养成道具**：仍走 `content.v1.UseConsumable`×1（优先将魂碎晶 2017）；往返中按钮 **disabled** 且 **使用中…**。
2. 成功：再拉 `GetHeroDetail`，行内展示等级/忠诚变化摘要，详情头 `hero-detail-stat-pulse` 短暂高亮；**CLIENT-072** 进度条与 Δ 列不退化。
3. 背包无养成消耗品时按钮 **disabled**，`hero-cultivation-disabled-reason` 中文可读；网关失败走 `hero-cultivation-form-error`（**CLIENT-067** 口径）。
4. 单测：`heroDetailCultivationUse.test.ts`、`useConsumableSubmitFeedback.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（将领详情养成道具缺口与背包深链 CLIENT-165）

在 [CLIENT-132](#手动验收将领列表行扫读-client-132) / [CLIENT-153](#手动验收背包分类-tab-与堆叠扫读-client-153) / [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 基础上：

1. 将领详情 **等级经验 / 忠诚** 进度条次行展示 `formatHeroUpgradeItemGap`（道具 `#id` 需/持 vs `ListPlayerBag` 快照）；不足时 **使用养成道具** 保持 disabled + `hero-cultivation-disabled-reason` 缺口文案。
2. **前往背包使用养成道具**：深链带 `bagCategory` + `highlightItemId` + `returnHeroId`（`serializeHeroBagDeepLinkQuery` / CLIENT-134 模式），打开背包定位 **CLIENT-153** 分类 tab 与高亮堆叠行；**返回将领详情** 保留 `hero_id`。
3. **CLIENT-175 背包道具扫读**：堆叠行次行 `formatBagItemCfgSummary`（养成/消耗/其他 + 本地 cfg 堆叠上限或简述）；自日常/将领/商城深链打开时展示 `bag-open-source-v1` 来源标签（`daily`/`hero`/`shop`，query 键 `bagOpenSource`）；关闭再开仍保留 **CLIENT-165** `highlightItemId` 高亮；商城「在背包查看所购道具」走 `shop` 来源。单测：`bagItemCfgSummary.test.ts`、`bagOpenSource.test.ts`、`ContentPanels.test.ts`。
4. 单测：`heroUpgradeItemGap.test.ts`、`heroDetailBagDeepLink.test.ts`（query 解析）、`HeroMailPanels.test.ts` / `ContentPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领详情忠诚养成深链 CLIENT-133）

在 [CLIENT-072](#手动验收将领详情养成对比-client-072) / [CLIENT-115](#手动验收将领详情养成道具使用反馈-client-115) 基础上：

1. 点选将领：`GetHeroDetail` 往返中详情区 **CLIENT-129** 骨架「详情加载中…」；失败 inline **CLIENT-067**（`panel-state-error`），列表行不退化。
2. 详情 **忠诚条/等级经验** 与列表行 `Lv` / `忠诚` 数值一致；`UseConsumable` 成功后列表行同步更新，**CLIENT-115** 摘要与 `hero-detail-stat-pulse` 不退化。
3. **前往背包使用养成道具**：拉 `ListPlayerBag` 后打开背包并滚入视首条养成 consumable（2017 子集）；无道具或网关失败走 **CLIENT-067**（`hero-cultivation-form-error`）。
4. 单测：`heroDetailBagDeepLink.test.ts`、`panelStateChrome.test.ts`、`heroMailState.test.ts`（`syncHeroSummaryFromDetail`）、`HeroMailPanels.test.ts`。

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
6. **CLIENT-186 队列日常锚点高亮**：日常 **「前往下一步」**（建造/练兵）打开队列时，匹配建造/募兵行 **`daily-queue-anchor-highlight` 2s**（与 **CLIENT-174** 进度条、**CLIENT-180** 槽位高亮 class **可叠加**）；队列 **「日常：下一步」** 反向打开日常并按 `quest_cfg_id` **`scrollIntoView`**（含 **CLIENT-169** chain tab 切换）。单测：`dailyQueueAnchor.test.ts`、`QueuePanels.test.ts`。
7. **CLIENT-218 日常队列互链**：日常可领行次行 **`formatQuestChainTypeSubline`**（`daily-quest-chain-type-subline`：chain 类型只读标签 + 进度摘要，**CLIENT-174/169** 不退化）；队列顶栏 **`formatNextQueueFinishPreviewLine`**（`queue-next-finish-preview`：建造/募兵 **下一完成** ETA 只读预览，点击 **`queue-open-daily-anchor`** 跳转日常 `quest_cfg_id`；**CLIENT-212** `formatDomesticQueueEtaSegmentLabel` 分段可叠加）。单测：`questChainTypeSubline.test.ts`、`nextQueueFinishPreview.test.ts`、`DailyQuestPanels.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。
8. **daily_march_1**：接取且进行中 → **「前往下一步」** 打开 **「背包」** 并高亮 **2020 远征干粮** → **使用道具** 成功后日常进度推进 → 领奖。
9. 单测：`dailyQuestObjective.test.ts`、`dailyQuestQueueMatch.test.ts`、`dailyQueueAnchor.test.ts`；全量 `cd client && npm test`。

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
4. **CLIENT-076**：排行/军团/聊天三面板刷新共用 `formatPanelRefreshMeta`（in-flight **刷新中…** + spinner、成功 **上次刷新**（**CLIENT-144** `formatPanelRefreshStamp`）、失败 **`[code]`** + **重试**）；单测：`panelRefreshStamp.test.ts`、`socialRefreshFormat.test.ts`；全量 `cd client && npm test`。

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

**wave:26 巩固（CLIENT-116）**：在 wave:22 **CLIENT-080** 行为之上，出征成功会 **自动打开行军面板** 并滚动到新行；该行展示行内 **`march-row-recent-eta`**（与 **CLIENT-089** `march-form-summary` / **CLIENT-047** `formatMarchRemainingMs` 同源 ETA 摘要），次行仍保留完整出发/到达时刻；**CLIENT-109** 阶段/排序筛选记忆与 **CLIENT-025** 到达战报提示链不退化。`marchSubmitStateMachine` + 高亮 TTL 纯函数见 `marchSubmitFeedback.test.ts` / `marchHighlight.test.ts`。

**wave:31 巩固（CLIENT-156）**：`StartMarch` 成功除 **CLIENT-116** `march-row-recent` 外，**军事** 面板顶栏 **`march-queue-banner`** 展示 `formatMarchQueueBanner` 摘要（**5s** `march-queue-banner-pulse`）；军情新高亮行次行追加 **「已提交」** 戳记（与 **CLIENT-141** ETA/phase 并存）。点击摘要条 `openMarchPanelAndHighlight(march_id)` 打开军情并高亮行；行内 **军事队列** 链回军事顶栏（`resolveMarchQueueJumpIndex` 互跳索引）。loading/empty/error 仍走 **CLIENT-129** `panelStateChrome`。单测：`marchQueueBanner.test.ts`、`MarchListPanel.test.ts`。

**wave:39（CLIENT-222）**：`StartMarch` / smoke 同源出征成功后 **`notifyMarchStarted`** 自动打开军情面板；顶栏 **`march-submit-intel-handoff-strip`** 展示 `formatMarchSubmitIntelHandoffLine`（目标坐标 + `formatMarchIntelPhaseEtaStrip` phase hint，**3s** 收起）；新 `march_id` 列表行附加 **`intel-new-march-highlight`** **3s** 扫读脉冲（与 **CLIENT-116** `march-row-recent` / **CLIENT-156** `march-queue-banner` 并存；**CLIENT-178** 军事只读汇总条互跳 **不退化**）。单测：`marchSubmitIntelHandoff.test.ts`、`MarchListPanel.test.ts`。

**wave:33（CLIENT-178）**：军事面板 **`march-form-readonly-strip`** 用 `formatMarchFormSummaryLine` / 军情选中行军快照扫读 **格点 + 兵力 + ETA**；**查看军情信息卡** 跳转军情列表选中 `march_id` 并高亮 **`march-info-card`**（与 **CLIENT-172** 信息卡 DOM/格式化钩子可叠加）。信息卡 **打开军事** 走 **CLIENT-093** `applyMarchIntelRemarchPrefillWithFeedback`；**CLIENT-156** 队列顶栏与 **CLIENT-145** 表单 summary/error 不退化。单测：`marchFormReadonlyStrip.test.ts`、`marchInfoCard.test.ts`、`marchFormIntelJump.test.ts`。

**wave:35（CLIENT-189）**：军情列表选中 `march_id` 时军事表单目标坐标输入框 **`march-form-coord-sync-highlight`** **1.5s**（同源 `to_x`/`to_y`）；军事面板改 `to_x`/`to_y` 后军情列表 **`scrollIntelRowForCoords`** 滚动并高亮终点匹配行，无匹配时 **`march-intel-coord-sync-empty-hint`**（**CLIENT-173** empty 态，非网关 error）。**CLIENT-178** 汇总条与 **CLIENT-156** 提交反馈不退化。单测：`marchFormCoordSync.test.ts`。

**wave:37（CLIENT-206）**：军事出征表单顶栏 **`march-form-troop-reserve-line`** 用 **`formatMarchFormTroopReserveLine`** 只读对比已选步兵与城内可用余量；超出时行内 **`march-form-reserve-warn`** 可点击 **`scrollIntelRowForMarchForm`** 跳转军情并选中同源 `march_id` 或最近终点匹配行，**出征攻击** 与 **CLIENT-145** `validateMarchForm` 同步 **disabled**（无新 military RPC）。**CLIENT-178** 只读汇总条互跳 **不退化**。单测：`marchFormTroopReserve.test.ts`。

**wave:41（CLIENT-238）出征表单校验汇总与提交后军情刷新戳记残余**：军事面板出征区底栏 **`data-role="march-form-validation-sweep-line"`** 由 **`formatMarchFormValidationSweepLine`** 只读汇总坐标 / 兵力 / 目标三段校验（**CLIENT-048** `march-form-error` 与 **CLIENT-206** 余量顶栏 **不退化**；**非** wave:39 军情交接主叙事重复）。`StartMarch` / `MarchAttack` 成功且 `ListMarches` 刷新后军情顶栏 **`march-submit-intel-refresh-stamp`** 展示 **`formatMarchSubmitIntelRefreshStampLine`**（加深与 **2.5s** 见 **wave:43 CLIENT-253**）；新 `march_id` 列表行附加 **`intel-list-refresh-march-pulse`**（**CLIENT-080/222** `march-row-recent` / `intel-new-march-highlight` **不退化**；**无** CancelMarch）。单测：`marchFormValidationSweep.test.ts`、`marchSubmitIntelRefreshStamp.test.ts`、`MarchListPanel.test.ts`；`cd client && npm test` 绿。

1. `make dev` 合法出征一次 → 观察按钮 **出征中…** 与顶栏 toast → **行军** 面板应自动展开且新行带金色 ETA 前缀与高亮框。
2. 故意网关失败（断网或非法兵力）→ 表单内错误文案，按钮恢复可点。
3. 单测：`marchHighlight.test.ts`、`marchSubmitFeedback.test.ts`、`marchFormSummary.test.ts`、`MarchListPanel.test.ts`。

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

**募兵提交反馈（CLIENT-117）**：点 **募兵** 后按钮 **disabled** 且文案 **募兵中…**（`recruitTroopSubmitFeedback`）；成功顶栏状态 `formatRecruitTroopSuccess`，队列募兵行与军事面板只读募兵列表行 **3s** `recruit-row-pulse`，扣粮木铁石时触发 **CLIENT-051** 资源脉冲；失败在 **troop-recruit-form-error** 展示 **CLIENT-067** 口径且保留 **CLIENT-088** 消耗预览。**CLIENT-019** 队列倒计时与 **CLIENT-024** 日常引导不退化。单测：`recruitTroopSubmitFeedback.test.ts`。

**募兵队列↔军事互跳（CLIENT-157）**：`RecruitTroop` 排队成功后保留 **CLIENT-117** 提交脉冲；队列面板 **首行**（最早完成批次）与兵营矩阵格 **互高亮**（`highlightRecruitQueue` / `queue-recruit-slot-mutual-highlight`），军事募兵区展示 **查看队列** → `openRecruitQueueAndHighlight(queue_id)`（`sessionStorage` 键 `recruit-highlight-queue-id`）。队列募兵行点击打开 **军事** 并滚动募兵区、预选对应兵种（`resolveRecruitQueueJumpTarget` + 只读快照，不新 RPC）；军事只读募兵列表行点击反向打开队列并高亮。**CLIENT-149** 完成脉冲 `queue-recruit-complete-pulse` 与提交 `recruit-row-pulse` 样式仍区分。单测：`recruitQueueJump.test.ts`、`QueuePanels.test.ts`。

### 手动验收（日常可领取定位 CLIENT-091）

日常面板筛选 **可领取** 时出现 **定位首条**（`daily-locate-first`）：滚动至 `pickFirstClaimableDailyQuestCfgIdForFilter` 首行并加 `daily-quest-claimable` 高亮；与 **CLIENT-077** HUD 待办深链（`center-claimable`）并存。**领奖** 成功该行短暂 `quest-claim-pulse` + **CLIENT-051** 资源脉冲；失败 **CLIENT-067** 口径。**CLIENT-075** 筛选记忆与 **CLIENT-044** 战报横幅不退化。

1. `make dev` 使 chain 400 至少一条 `state=3` → **日常** → **可领取** → **定位首条** 应滚到首条可领行。
2. **领奖** 后观察脉冲与 HUD；刷新页面筛选记忆仍恢复。
3. 单测：`dailyQuestListFilter.test.ts`、`DailyQuestPanels.test.ts`。

**CLIENT-150（日常领取闭环）**：列表行 **次行** `formatDailyQuestProgressSecondary` 展示 chain 400 `progress_current/progress_target`（`ListPlayerQuests` 快照，不新 RPC）；**批量领取可领**（CLIENT-087 同级逐条 `ClaimQuestReward`）成功行 `quest-claim-pulse`，`HudTodoBadgePoll.applyDailyChainRowsSnapshot` 使底栏 **可领** 角标即时递减；筛选 **可领取** 时 **定位首条**（CLIENT-091）与 CLIENT-123 chip 并存。loading/error 仍走 **CLIENT-129**。单测：`dailyQuestProgressFormat.test.ts`、`dailyQuestBatchClaim.test.ts`、`dailyQuestListFilter.test.ts`（`pickFirstClaimableDailyQuestCfgIdForFilter`）、`DailyQuestPanels.test.ts`、`hudTodoBadgePoll.test.ts`。

**CLIENT-169（日常多 chain tab）**：顶栏 **chain 类型 tab**（如 400 主线 / 401 支线，`pickDailyChainTabs` 对空链隐藏）；`sessionStorage` 键 **`daily-chain-tab-v1`** 记忆上次 tab。`ListPlayerQuests` `chain_id=0` 拉全链快照后按 tab 过滤，**切换 tab** 时 `findFirstInProgressQuestIndex` 定位首条 `progress_current<progress_target` 并 `scrollIntoView`；**可领取**筛选与 **批量领取**（CLIENT-150/159）不退化；**主线（400）tab** 内可领 chip 与 **CLIENT-162** HUD 日常角标一致。单测：`dailyQuestChainTab.test.ts`、`DailyQuestPanels.test.ts`。

**CLIENT-174（日常进度条与奖励道具扫读）**：日常列表行 **次行** 在 `formatDailyQuestProgressSecondary` 文案下展示细进度条 **`daily-quest-progress`** / **`daily-quest-progress-fill`**（`progress_current`/`progress_target` 宽度经 `clampDailyQuestProgressPercent` 钳制）；有 cfg 道具奖励时追加 **`formatDailyQuestRewardLine`**（`reward_item_id`/`quantity` 或 DATA-002 回退，无则省略）。不新 quest RPC；**CLIENT-169** chain tab、**CLIENT-150** 领取脉冲、**CLIENT-162** HUD 角标不退化。单测：`dailyQuestProgressFormat.test.ts`、`DailyQuestPanels.test.ts`、`filterListNarrowManifest.test.ts`。

**CLIENT-193（日常可领取进度扫读与邮件 HUD 待办联动）**：日常面板顶栏 **`formatDailyClaimableSweepLine`**（chain 400 可领条数 + 首条 `#quest_cfg_id` 进度 %）；领奖成功后顶栏扫读行 **`daily-claim-progress-pulse`** 1s（**CLIENT-174** 行内进度条不退化）。顶栏待办与底栏邮件/日常角标 **`title`** 共用 **`formatHudTodoSweepLine`**（邮件未领附件 + 日常可领计数，与 **CLIENT-162/192** 同源快照、无重复 toast）；**CLIENT-186** 队列日常锚点不退化。单测：`dailyClaimableSweep.test.ts`、`hudTodoSweep.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-233（日常可领取首条 scroll-into-view 与领取成功进度脉冲）**：打开日常面板后 **`scrollQuestClaimableIntoView`** 将当前链/「可领取」筛选下首条可领行滚入视区（**CLIENT-091** `pickFirstClaimableDailyQuestCfgIdForFilter` **不退化**）；单条/批量领奖成功后行内 **`quest-claim-progress-pulse`** 1s 且次行进度条/文案经 `applyDailyQuestRowAfterClaim` 即时刷新（**CLIENT-150/174** 行脉冲与顶栏 **`daily-claim-progress-pulse`** **不退化**；无新 quest RPC）。单测：`dailyQuestClaimFeedback.test.ts`、`DailyQuestPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-202（HUD 中心四面板 tab 深链余量扫读）**：顶栏 **`data-role="hud-center-panel-deeplink-line"`** 由 **`formatHudCenterPanelDeepLinkLine`** / **`hudCenterPanelDeepLinkSegments`** 合并邮件/日常（与 **CLIENT-193** `formatHudTodoSweepLine` 同源文案）、队列建造中、聊天未读；分段点击 **`resolveCenterPanelTabFromHudTodo`** 打开邮件/日常/队列/聊天中心面板并复用 **CLIENT-134/162** 角标深链落点（无新 HUD RPC）。对应底栏 tab 触发 **`center-panel-tab-pulse`** 1.5s；**CLIENT-186** 队列日常锚点与 **CLIENT-193** 底栏 `title` 扫读 **可叠加**。单测：`hudCenterPanelDeepLink.test.ts`、`hudCenterTodo.test.ts`；`cd client && npm test` 绿。

**CLIENT-209（邮件分 tab 未读与日常可领取 HUD 待办联动扫读）**：邮件面板 **`formatMailTabUnreadSweepLine`**（各 tab 未读/未领附件只读计数，与 **CLIENT-177** tab 角标同源）+ **`formatMailPanelHudCombinedSweepLine`**（**`formatQuestClaimHudLinkLine`** 首条可领 `#quest_cfg_id` 与邮件未读合并；**CLIENT-193** 底栏 `formatHudTodoSweepLine` **不退化**）。HUD 轮询 bump **`data-hud-center-panel-deeplink-stamp`** 与顶栏 **CLIENT-202** 深链行、邮件扫读行共用，并触发 **`mail-tab-hud-sync-pulse`** 1.5s（无新 content RPC）。单测：`mailTabUnreadSweep.test.ts`、`questClaimHudLink.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-241（邮件附件领取成功与 HUD 邮件/日常可领角标同步残余）**：`ClaimPlayerMailAttachments` 成功后 **`syncHudMailQuestBadgeAfterClaim`** 合并更新 `mailInboxSnapshot` 并推导底栏邮件未读/未领附件与日常可领计数（**CLIENT-050/106/209** 轮询与 tab 角标 **不退化**；**CLIENT-193** `formatHudTodoSweepLine` 与 **CLIENT-209** 扫读行经 `bumpMailClaimHudTodoSweepLinkage` 即时刷新）。列表成功行 **`mail-claim-hud-sync-pulse`** 2s（与 **CLIENT-192** `mail-claim-pulse` 并存）。单测：`mailClaimHudBadgeSync.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**CLIENT-225（邮件战报类分 tab 扫读与战报 outcome 筛选记忆联动）**：邮件面板顶栏 **战报/系统** 分类 tab + **`formatMailBattleCategorySweepLine`**（分类内未读/未领附件只读计数；**CLIENT-177** 全部/未读/未领附件空态与 **CLIENT-209** HUD 扫读 **不退化**）。自战报类邮件 **查看战报** 深链写入 `sessionStorage` **`report-outcome-filter-bridge-v1`**，打开战报面板时一次性同步 outcome chip（**CLIENT-176** `battle-report-outcome-filter-v1` 记忆保留）；自战报 **相关邮件** 返回时恢复分类 tab 与收件箱 filter。单测：`mailBattleCategory.test.ts`、`reportOutcomeFilterBridge.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（军团提到聊天草稿 CLIENT-084）

军团成员列表每行 **提到** 将 `@显示名 ` 填入聊天输入（`formatGuildMentionDraft`），并切换到军团聊天 tab；未入军团时按钮 hidden。**CLIENT-076** 刷新 meta 不退化。

1. `make dev` 已入军团 → **军团** 面板点某成员 **提到** → **聊天** 输入框应出现 `@…` 草稿（不自动发送）。
2. 单测：`socialFormat.test.ts`（`formatGuildMentionDraft`）、`SocialPanels.test.ts`。

**CLIENT-160（聊天草稿记忆与输入扫读）**：**提到** 与输入变更将草稿写入 `sessionStorage` 键 **`guild-chat-draft-v1`**；切换底栏 **聊天** 关闭再打开 **恢复草稿**（不自动发送）。聊天输入区只读 **`chat-input-counter`**（如 `0/500`，上限与 `validateSendChatContent` / 网关 SendChat 一致）；**CLIENT-101** 职务分组与 **提到** 并存。单测：`guildChatDraft.test.ts`、`chatSendValidation.test.ts`、`SocialPanels.test.ts`。

### 手动验收（邮件附件批量领取 CLIENT-087 / CLIENT-159）

邮件列表含未领附件的行可勾选，点 **批量领取勾选** 或 **领取全部附件**（当前 tab 下全部未领）顺序调用既有领取 RPC；`batchClaimSummary` 汇总成功/失败条数，失败走 **CLIENT-067** 文案且失败行 `mail-claim-error`。成功后 **CLIENT-050** / `applyMailInboxSnapshot` HUD 与 tab 角标同步递减，**CLIENT-068** 战报深链不退化。

1. `make dev` 多封未领附件邮件 → **领取全部附件** 或勾选两封以上 → **批量领取勾选** → 状态栏/面板反馈含汇总条数。
2. 单测：`mailBatchClaim.test.ts`、`hudTodoBadges.test.ts`、`hudTodoBadgePoll.test.ts`、`HeroMailPanels.test.ts`。

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

### 手动验收（战报列表时间窗 chip 与 streak 次行 CLIENT-207）

顶栏 **时间** chip（**全部 / 今日 / 近7日**，`data-ui-filter-chip`）写入 `sessionStorage` 键 **`battle-report-time-filter-v1`**（自 `rxsg.client.battleReport.timeWindowFilter` 迁移）；与 **CLIENT-176** `battle-report-outcome-filter-v1` 分离，返回战报面板后各自恢复。列表行次行 `formatBattleReportListStreakLine`：在当前组合筛选序内，连续胜/负 streak 段 **首行** 附加 **连胜 N / 连负 N** 只读摘要；顶栏 **CLIENT-083** streak chip 与 **CLIENT-158** 相邻导航 **不退化**；**无**战报 proto 扩量。

1. `make dev` 产生跨日、多胜负交错的战报 → 切换时间 chip 与 outcome chip 组合 → 刷新页面后两路筛选恢复。
2. 连续两场以上胜/负时，列表 streak 段首行次行应含 **连胜/连负**；摘要条 streak chip 仍显示自最近一场起的计数。
3. 单测：`battleReportListState.test.ts`（`serializeBattleReportTimeFilter`）、`militaryFormat.test.ts`（`formatBattleReportListStreakLine`）、`battleReportTimeFilterChip.test.ts`、`BattleReportPanel.test.ts`。

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

### 手动验收（战报相邻条导航与列表焦点 CLIENT-158）

在 **CLIENT-083 / CLIENT-094** 基础上：**上一封/下一封**（及详情区 **←/→**、筛选区 **Alt+←/→**）在 **CLIENT-083** 筛选序内切换时，列表 **↑/↓ roving** 的 `tabindex` 同步到对应 `report_id` 行（键盘焦点仍回到详情顶栏导航按钮，与 CLIENT-094 一致）。首/末封按钮 **`disabled` + `aria-disabled="true"`**；切换后保留 **CLIENT-074** 回合高亮仅当新战报仍含该回合，否则重置。**CLIENT-125** 筛选 chip 变更后邻接序与按钮禁用态即时重算；**CLIENT-142** 坐标复盘不退化。

1. `make dev` 打开战报，选中中间一条 → **下一封** 后列表中仅邻行 `tabindex=0`，再 **↑/↓** 可继续 roving 打开其它战报。
2. 首条战报 **上一封**、末条 **下一封** 应禁用且 `aria-disabled=true`；切换 outcome 筛选后邻接按钮状态与列表顺序一致。
3. 单测：`battleReportListNav.test.ts`（`battleReportListRovingFocusIndex` / `syncBattleReportListRovingFocus`）、`BattleReportPanel.test.ts`（邻接+焦点索引+筛选重算）。

### 手动验收（战报详情回合表与行军深链 CLIENT-034）

`GetBattleReport` 成功后，详情区顶部仍保留 `formatBattleReportDetail` 文字摘要；下方为结构化 **回合表**（回合号、攻/守行动摘要、双方剩余兵力 map）。回合数 **> 8** 时表格默认折叠，点 **「展开全部回合」** 显示全部行。列表/详情加载失败仍可用 **重试** 按钮（不退化 **CLIENT-029** 列表密度）。行军结束 HUD 链接（**CLIENT-025**）点击后调用 `openPanelWithDeepLink`：刷新 `ListBattleReports` 后选中 `MarchEndBattleReportHint` 或最近 `report_id` 并自动 `GetBattleReport`。

1. `make dev` 产生至少一场带多回合明细的战报（见上文募兵 → 行军）。
2. 底栏 **「战报」** → 点击一条记录：详情 `pre` 摘要含结果/伤亡；下方表格列头为 **回合 / 攻方行动 / 守方行动 / 攻方剩余 / 守方剩余**。
3. 若服务端返回 **> 8** 回合：初始无表格行，显示折叠提示与 **展开全部回合**；点击后展示全部行。
4. 断网或 mock 失败详情：应出现 **重试加载详情**；列表失败仍保留 **重试加载列表** 与筛选条。
5. 完成一次行军到达后点 HUD **行军结束，查看战报**：战报面板打开、列表刷新、**最近战报** 行高亮且详情已加载（若 hint 与列表首条不一致则以 hint 为准）。
6. 单测：`battleReportRounds.test.ts`、`battleReportDeepLink.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（战报坐标与小地图复盘 CLIENT-042）

（[#266](https://github.com/anitaguptaoffice/sanguo-slg/issues/266) / [#276](https://github.com/anitaguptaoffice/sanguo-slg/pull/276) `7b9e4c3f`）。战报列表行 **坐标** 与守方摘要分行突出（`formatReportCoord` / `formatBattleReportFoeWithoutCoord`）；详情 **坐标区** 展示 `location_x/location_y` 与 **「在小地图定位」**（[#562](https://github.com/anitaguptaoffice/sanguo-slg/issues/562) **CLIENT-142**）。点击后经 `parseBattleReportLocation` + `applyBattleReportMinimapFocus` 读取 summary 既有 `location_x/y`（不扩 proto），`openWorldMinimapExpanded` 展开小地图、绘制 **临时战报高亮** 并 `pan/zoom` 纳入视野，同时 **世界信息卡** 选中格与战报坐标一致；关闭战报面板或切换选中战报时清除高亮。列表次行攻守摘要（**CLIENT-098**）、筛选 chip（**CLIENT-125**）与详情键盘相邻导航（**CLIENT-094**）在坐标跳转后不退化。

1. `make dev` 产生至少一条带 `location_x/y` 的战报（见募兵 → 行军）。
2. 底栏 **「战报」** → 列表行应见金色 **坐标(...)** 行；点开详情坐标区有 `location_x=… · location_y=…` 与 **在小地图定位**。
3. 点击 **在小地图定位**：小地图应自动展开，出现 **战报** 标记与橙红高亮圈，视野对准该格点；世界面板信息卡格点与战报一致。
4. 关闭战报面板或点另一条战报：小地图临时高亮应消失。
5. 单测：`battleReportMinimapFocus.test.ts`、`battleReportReplayCoord.test.ts`、`worldMinimap.test.ts`、`BattleReportPanel.test.ts`。

**wave:35（CLIENT-191）战报复盘互跳**：战报详情坐标区除 **在小地图定位**（CLIENT-142）外，**坐标复盘** 经 `openMinimapForBattleCoords` 展开世界/小地图、canvas 战报高亮与 **`#layout-frame.minimap-battle-replay-pulse`** 2s 脉冲，并写入 `sessionStorage` **`battle-report-replay-v1`**；有 ListMarches 快照匹配时显示 **查看军情**（`resolveIntelRowNearCoords` 只读选中同格/最近目的格行军）。军情 **`march-info-card`** **复盘战报** 优先 `march.report_id`，否则同目的格 session 深链 `openPanelWithDeepLink(report_id)`；**CLIENT-142** 定位与 **CLIENT-176/158** outcome/相邻导航不退化。单测：`battleReportIntelReplayJump.test.ts`、`BattleReportPanel.test.ts`、`MarchListPanel.test.ts`。

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

### 手动验收（HUD 资源条与待办角标深链 CLIENT-134）

在 **CLIENT-038** / **CLIENT-107** / **CLIENT-122**～**126** 基础上：`resolveHudTodoOpenTarget` 将 `HudTodoBadgePoll.getDeepLinkSnapshot()` 映射为面板落点；底栏角标深链与筛选 chip **选中态**一致（`mail-inbox-filter-v1` / `daily-quest-filter` 键名不变）。

| 角标 | 深链 filter / 高亮 | 面板 tab 数字（CLIENT-126） |
|---|---|---|
| **邮件** | 有未读 → `filter=未读`；仅可领附件 → `filter=全部` + 首封可领 | `mailFilterTabCountsFromHudDeepLink` 与快照 `mailUnreadTotal` / `mailClaimable` |
| **日常** | 有可领 → **可领取** chip；否则 **全部** + 首条可接 | `claimableCount` 与 `dailyClaimable` |
| **队列** | 打开面板并高亮 `firstQueueBuildingSlotKey` 建造行 | 与 `queueBuildingToolbarBadgeCount` 同源 |

顶栏五资源 **hover / focus / 展开** 仍由 `wireHudResourceSweep` 展示 `formatResourceSweepLine(production_rates, wallet)`（与 `GetCityState` 同行字段）；**CLIENT-051** 资源脉冲与建造/招募表单并存。单测：`hudTodoOpenTarget.test.ts`、`artResourceHud.test.ts`。

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

### 手动验收（1280 主城建造/邮件/队列 CLIENT-111）

`#layout-frame.layout-narrow` 下 **建造侧栏**（`.building-panel` + `data-center-panel="building"` + **`ui.panel.default.v1`**，`skinDefaultPanel`）、**邮件**（`data-center-panel="mail"` + `ui.panel.default.v1`）、**队列**（`data-center-panel="queue"` + **`ui.panel.queue.v1`**）根节点 nine-slice 与 CLIENT-086/103 同级；画布槽位升级 overlay（CLIENT-066）在窄屏不横向越界。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：点画布 **农田/城主府** 打开左侧建造侧栏，并打开底栏 **邮件**、**队列**；三处面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 建造预览、邮件长列表与队列建造/募兵表在 `.panel-scroll-body` 内 **`overflow-y: auto`** 滚动；底边距避免末行被底栏 **56px** 工具条遮挡。
3. **CLIENT-105** 队列完成脉冲（`queue-build-complete-pulse`）、**CLIENT-106** 邮件 tab 角标（`mail-filter-tab-badge` / `mail-unclaimed-badge`）、**CLIENT-107** 顶栏 `hud-center-todo-badge` 与底栏 `toolbar-badge` 在窄屏 **无横向溢出**（`flex-wrap` / `text-overflow` / inset 脉冲）。
4. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；建造侧栏/邮件/队列 manifest 与 **CLIENT-062/070/086** 表现不退化。
5. 单测：`artPanelSkin.test.ts`（CLIENT-111 manifest 映射）、`contentPanelScroll.test.ts`（`building` / `mail` / `queue`）、`layoutViewport.test.ts`（CLIENT-111 注册表）、`MainCityBuildingPanel` / `HeroMailPanels` / `QueuePanels`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 背包商城招募军事 CLIENT-119）

`#layout-frame.layout-narrow` 下 **背包**（`data-center-panel="bag"` + **`ui.panel.bag.v1`**）、**商城**（`shop` + **`ui.panel.shop.v1`**）、**将领**（`hero` + **`ui.panel.hero.v1`**，含招募模板区）、**军事**（`.military-panel` + `data-center-panel="military"` + **`ui.panel.military.v1`**）根节点 nine-slice 与 CLIENT-095/086 同级；`skinBagPanel` / `skinShopPanel` / `skinHeroPanel` / `skinMilitaryPanel` 接线。`data-art-skin="off"` 可跳过纸底。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **背包**、**商城**、**将领**、**军事**；四面板纸底为 manifest 九宫格，顶栏 HUD 无叠字。
2. 背包道具表、商城货架、将领列表/模板与军事募兵/出征表单在 `.panel-scroll-body` 内 **`overflow-y: auto`** 滚动；`padding-bottom` 避免末行被底栏 **56px** 工具条遮挡（军事 **募兵** / **出征攻击** 可滚至可见）。
3. **CLIENT-112**～**117** 提交行脉冲（`bag-row-used-pulse` / `hero-row-recruited-pulse` / `recruit-row-pulse` 等）与 **CLIENT-118** `ui.icon.toolbar.*.v1` 底栏图标在窄屏 **无横向溢出**（`overflow-x: hidden` / `overflow-wrap` / 工具栏横向滚动）。
4. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；四面板 manifest 与 **CLIENT-062/095/070** 表现不退化。
5. 单测：`artPanelSkin.test.ts`（CLIENT-119 manifest 映射）、`contentPanelScroll.test.ts`（`bag` / `shop` / `hero` / `military`）、`layoutViewport.test.ts`（CLIENT-119 注册表）、`ContentPanels` / `HeroMailPanels` / `mainCityMilitaryPanelDom.test.ts`（`panel-scroll-body`）；`cd client && npm test` 绿。

### 手动验收（1280 邮件/日常/军情/战报筛选列表 CLIENT-127）

`#layout-frame.layout-narrow` 下 **邮件** / **日常** / **军情（行军）** / **战报** 四面板：`filterListNarrowManifest` 注册 `data-center-panel` id 与面板纸底 manifest（`ui.panel.default.v1` / `ui.panel.daily.v1` / `ui.panel.march.v1` / `ui.panel.battle-report.v1`）；筛选条根节点带 **`.panel-filter-chip-bar`**（横向 **滚动/换行**、`overflow-y: visible`，`:focus-visible` 金环不被裁切；chip **≥44×44** 命中，含 `data-ui-filter-chip` 与既有文字 chip）。`MainCityScene` 在九宫挂载后先 **`remountPanelFilterChips`**（CLIENT-121），再 **`mountFilterListPanelSkins`** 接线行/角标（`data-art-skin="off"` 跳过皮肤）。**软依赖** CLIENT-122～126：合入后为列表行/角标补 `data-ui-filter-row` / `data-ui-filter-badge` 即可消费同一挂载，本卡 CSS 已预留行/角标 **无横向溢出** 规则。

1. 视口 **1280×720**，`make dev` 进主城：依次打开 **邮件**、**日常**、**军情**、**战报**；筛选条可横向滚动或换行，Tab 聚焦 chip 时金环完整可见。
2. 长列表在 `.panel-scroll-body` 内 **`overflow-y: auto`**；`padding-bottom: 64px` 避免末行被底栏 **56px** 工具条遮挡；行九宫与 **badge.dot/count**（CLIENT-126）在窄屏无横向溢出。
3. 视口 **1600×900**：`#layout-frame` **无** `layout-narrow`；四面板 manifest 与 **CLIENT-070/086/111** 表现不退化。
4. 单测：`filterListNarrowManifest.test.ts`、`layoutViewport.test.ts`（CLIENT-127 注册表）、`artPanelSkin.test.ts`（CLIENT-127 映射）、`HeroMailPanels` / `DailyQuestPanels` / `MarchListPanel` / `BattleReportPanel`（`.panel-filter-chip-bar`）；`cd client && npm test` 绿。

### 手动验收（背包与商城反馈，CLIENT-020）

`contentFeedback.ts` 解析 `UseConsumable` / `PurchaseShopOffer` 响应；背包/商城面板内 `panel-feedback` 与顶栏状态栏同步文案。使用资源包(2001) 成功后 **CLIENT-018** 顶栏仍可出现 `+粮…` 短时摘要（`patchSession` + `formatWalletGainBrief`）。

1. `make dev` 或 mock 网关进入主城，**任务领奖**或 **商城购买** 获得谷袋(2001) 与急工符(2003)（mock 购买即得 2001）。
2. **背包**：「刷新背包」→ 选 **2001** →「使用道具」。面板金色反馈区与 HUD 末行应同时显示效果（如「获得粮食 …」「+粮…」）；顶栏粮增加时出现 CLIENT-018 `+粮` 飘字。
3. 选 **2003** →「使用道具」：面板与状态栏应显示加速文案（服务端 `effect_summary` 或 `speedup_seconds` 推导）。
4. 故意数量大于库存或 mock 下耗尽道具：失败时面板与状态栏为 `[code] msg`，不静默。
5. **商城**：「刷新货架」→ offer 1001 →「购买×1」。成功行内追加 `已购 +1`，面板反馈含 `钱包 粮 … 币 …`（与顶栏 HUD 同 `formatResourceHudGroup` 格式）；限购行仍显示 `限购 n/m`；**CLIENT-057** 起余额不足/售罄/限购在 `shop-form-error` 内联中文提示且不发 RPC；网关失败经 **CLIENT-067** `formatPanelGatewayError`（如 `余额不足 [64003]`）。**CLIENT-113**：`PurchaseShopOffer` 往返时购买钮 **disabled + 购买中…**；成功状态栏 `formatShopPurchaseSuccess(offer_id)`，粮/木/铁/石扣费触发顶栏 **CLIENT-051** 脉冲，背包行即时刷新；失败仍见 `shop-form-error` 与 **CLIENT-092** `shop-wallet-gap`。
6. **背包使用**：数量为 0 或道具不在背包快照时 `bag-form-error` 内联提示（不发 RPC）；成功清空错误区、金色 `panel-feedback` 展示效果，失败保留 `bag-form-error`（与 **CLIENT-048** / **CLIENT-067** 军事 `march-form-error` 口径一致）。**CLIENT-112**：「使用道具」/「批量使用勾选格」提交中 **disabled + 使用中…**；成功 `formatUseConsumableEffectSummary` + 列表行 `bag-row-used-pulse`（3s）+ 钱包增量 **CLIENT-051** 脉冲；失败保留道具选中与批量勾选。**CLIENT-232**：成功时堆叠数格 `bag-stack-qty` 附加 **`bag-use-consumable-pulse`（2s）**（`ListPlayerBag` 合并后即时减一展示；**CLIENT-112/194** 行脉冲不退化）；经济类网关失败走 **`formatBagUseEconomyErrorLine`**（道具/资源不足 **CLIENT-067** 口径，**非**商城 IAP）。
7. **CLIENT-092 缺口对比**：商城选中 offer / 背包选中消耗品时，`shop-wallet-gap` / `bag-wallet-gap` 只读展示 `formatWalletGapLine`（粮/木/铁/石 需/余）；不足资源名带 `resource-gap-warn`，与 **CLIENT-057** 预校验内联错误并存。
8. **CLIENT-153 背包分类**：**全部 / 消耗品 / 养成** tab（`sessionStorage` 键 `bag-category-tab-v1`）；切换仅客户端过滤 `ListPlayerBag` 会话快照、**不新 RPC**；行内 **cfg 名 + `bag-stack-qty`（`formatBagStackQty`）** 堆叠扫读；真空/筛选无匹配走 **CLIENT-029** + **CLIENT-129** `renderPanelStateListRow`；**CLIENT-112** 使用提交脉冲不退化。
9. **CLIENT-154 商城行内态**：货架列表行与购买区 `shop-wallet-gap` 在钱包不足时行内展示 `formatShopOfferAffordInline`（`缺少：粮 N …`，**CLIENT-067** 口径）；足够时购买区仍为 **CLIENT-092** 需/余对比条，**购买×1** disabled 与文案一致；货架 **loading/error/空** 走 **CLIENT-129** `renderPanelStateListRow`；**CLIENT-113** 购买脉冲不退化。
10. **CLIENT-167 商城货币扫读**：分类 tab 下 `shop-tab-currency-sweep` 展示 `resolveShopTabCurrency` + `formatShopTabWalletBalanceLine`（本类结算币种余额，切换 tab **即时**更新）；货架行次行 `formatShopPriceVsWallet`（现价/余额并排）与 **CLIENT-154**「缺少」行内态并存；**CLIENT-113** 购买提交脉冲不退化。
11. **CLIENT-194 背包商城扫读巩固**：背包下拉选中堆叠行展示 `bag-row-inline-state`（`formatBagRowInlineState` = 数量 + **CLIENT-175** cfg 摘要）；`UseConsumable` 成功仍保留列表行 `bag-row-used-pulse`（**CLIENT-112** 批量不退化）并追加行内 `bag-use-inline-pulse`。商城货架行次行 `formatShopPriceWalletGapLine`（标价/余额/缺口只读对比，与 **CLIENT-167** `shop-price-vs-wallet` 并存）；**不**扩 SKU / IAP。单测：`bagRowInlineState.test.ts`、`shopTabCurrency.test.ts`、`useConsumableSubmitFeedback.test.ts`、`ContentPanels.test.ts`。
12. **CLIENT-210 背包分类滚动记忆与商城返回高亮**：`sessionStorage` 键 **`bag-category-tab-v1`** 存当前 tab + 各分类 `scrollTop`（`serializeBagCategoryScrollState`）；切换 **全部/消耗品/养成** tab 恢复对应滚动位置（**CLIENT-175** 道具摘要行不退化）。自商城返回背包（底栏互切或「在背包查看所购道具」）：列表行 **`bag-row-return-highlight` 2s** 扫读上次查看 `item_cfg_id`（**CLIENT-194** 货币缺口行不退化；**非** wave:26 购买提交脉冲）；**不**扩 SKU / IAP。单测：`bagCategoryScroll.test.ts`、`bagShopReturnHighlight.test.ts`、`ContentPanels.test.ts`。
13. 单测：`contentFeedback.test.ts`、`contentFormValidation.test.ts`、`walletGap.test.ts`、`shopOfferAfford.test.ts`、`shopTabCurrency.test.ts`、`useConsumableSubmitFeedback.test.ts`、`purchaseSubmitFeedback.test.ts`、`bagCategory.test.ts`、`heroUpgradeItemGap.test.ts`、`heroDetailBagDeepLink.test.ts`；全量 `cd client && npm test` 绿。

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

**CLIENT-131** 队列面板在顶栏摘要下展示 **七槽状态矩阵**（`buildBuildQueueSlotMatrix` / `hall`…`wall` 列序）：只读缩写格标注空闲/升级中/可升级；格点击 `openAndHighlightBuildSlot` 与 **CLIENT-105** / **CLIENT-130** 画布深链互高亮并存。进行中建造行经 `sortBuildQueueRows` **最早完成优先**；列表 loading/empty/error 与 **CLIENT-129** `renderPanelStateListRow` / `data-panel-state` 共用骨架。单测：`buildQueueMatrix.test.ts`、`QueuePanels.test.ts`。

**CLIENT-149 队列完成反馈**：建造仍由 `detectBuildJustCompleted` 触发 **3s** `queue-build-complete-pulse`，队列行/七槽矩阵/画布 `queue-build-slot-mutual-highlight` 互跳不退化；募兵批次完成由 `detectRecruitQueueJustCompleted` 触发 **3s** `queue-recruit-complete-pulse`（与提交成功 `recruit-row-pulse`、建造脉冲样式区分），募兵行与兵营矩阵格 `queue-recruit-slot-mutual-highlight` 互跳；无新 RPC、募兵加速仍 **out**。单测：`recruitQueueComplete.test.ts`、`QueuePanels.test.ts`。

**CLIENT-181（HUD 队列完成联动扫读）**：建造/募兵队列条目完成时（`detectBuildJustCompleted` / `detectRecruitQueueJustCompleted` 或募兵 `checkRecruitCompletions` 同源检测），顶栏对应产出资源触发 **CLIENT-148** `resource-pulse`（`hud-resource-pulse` 动画），并 `formatHudProductionWalletLine` 刷新 `hud-resource-sweep` **产出速率 + 仓库余量** 只读次行；`sessionStorage` 键 **`queue-complete-pulse-v1`** 对同一完成事件去重，避免与 **CLIENT-162** 待办角标刷新重复 HUD 反馈；无新 `GetCityState` 字段。单测：`hudQueueCompletePulse.test.ts`。

**wave:32（CLIENT-164）主城建造消耗与队列 ETA 扫读**：选中槽位时建造面板 `formatBuildUpgradeCostLine` 行内展示下级粮/木/铁/石消耗，相对 `GetCityState.wallet` 不足段 **`resource-deficit` 标红**（只读）；队列建造/募兵行次行展示 `formatUpgradeRemaining` 剩余时间 + `formatQueueRemainingProgress` **细进度条**（`finish_at_ms` 与 cfg 反推 `started_at`；无起点则仅倒计时），顶栏 `formatBuildQueueCountdown` 与 **CLIENT-149** 完成脉冲并存。loading/error 仍 **CLIENT-129**；单测：`buildUpgradeCostLine.test.ts`、`queueRemainingProgress.test.ts`、`MainCityBuildingPanel.test.ts`、`QueuePanels.test.ts`。

**wave:34（CLIENT-180）七槽↔队列双向互链**：画布七槽 overlay 选中槽位时，队列面板对应建造/募兵行 **`queue-row-slot-highlight` 2s**（`highlightQueueRowForSlot` + 只读 `GetCityState` 快照）；建造队列行点击 **`scrollCitySlotIntoView`** 反向 **`city-slot-pulse` 2s** 定位槽位标签。与 **CLIENT-149/131** 互高亮、**CLIENT-164** 消耗预览、**CLIENT-157** 募兵队列↔军事互跳并存；无新 domestic RPC。单测：`citySlotQueueLink.test.ts`、`QueuePanels.test.ts`。

**wave:36（CLIENT-196）主城队列剩余时间与进度条可读扫读加深**：建造/募兵队列行次行展示 **`formatQueueRemainingEtaLine`**（剩余秒数 + `upgrade_finish_at_ms`/`finish_at_ms` 完成时刻只读摘要）与 **`queue-row-progress-bar`** 细进度条（**CLIENT-164** `formatUpgradeRemaining` / `queue-row-countdown` / `queue-row-progress-fill` **不退化**）；七槽 overlay **`queue-row-slot-highlight`**（**CLIENT-180**）与队列完成 **HUD** `hud-resource-sweep` 脉冲（**CLIENT-181**）并存；无新 domestic RPC / 募兵加速。单测：`queueRemainingEtaLine.test.ts`、`queueRemainingProgress.test.ts`、`QueuePanels.test.ts`。

**wave:36（CLIENT-197）队列完成焦点环互链**：建造/募兵完成（`detectBuildJustCompleted` / `detectRecruitQueueJustCompleted` 同源 **CLIENT-181** 检测，无新 toast）时，对应七槽 overlay **`city-slot-complete-focus-ring` 2s** + 队列只读行 **`queue-row-complete-pulse` 2s**（`queue-row-complete-readonly` 标记完成待领取/已结束；与 **CLIENT-149** 3s 脉冲及 **CLIENT-164** 剩余进度行可叠加）。点击完成队列行仍 **`scrollCitySlotIntoView` + `city-slot-pulse`（CLIENT-180 不退化）**；`sessionStorage` 键 **`queue-complete-focus-ring-v1`** 去重。单测：`queueCompleteFocusRing.test.ts`、`QueuePanels.test.ts`。

**wave:38（CLIENT-212）主城队列 ETA 分段与完成态七槽余量扫读**：建造/募兵队列行次行在 **CLIENT-196** `queue-row-eta-line` / `queue-row-progress-bar` **并列**展示只读 **`formatDomesticQueueEtaSegmentLabel`**（`<1h` / `今日内` / `>1d`）与 class **`domestic-queue-eta-segment-label`**；队列项完成时七槽对应格叠加 **`domestic-queue-complete-slot-margin`** 余量文案（`空闲槽` / `升级中槽`）**2s** 脉冲，**CLIENT-197** `city-slot-complete-focus-ring` **不退化**；无新 domestic RPC / 募兵加速。单测：`domesticQueueEtaSegment.test.ts`、`domesticQueueCompleteSlotMargin.test.ts`、`queueRemainingProgress.test.ts`、`QueuePanels.test.ts`。（[#785](https://github.com/anitaguptaoffice/sanguo-slg/issues/785) / [#811](https://github.com/anitaguptaoffice/sanguo-slg/pull/811) `5f441caa`）

**wave:42（CLIENT-244）主城队列 ETA 分段残余次行与完成态七槽焦点残余环**：队列行 **CLIENT-212** 分段标签旁 **`formatDomesticQueueEtaSegmentResidualLabel`** / **`domestic-queue-eta-segment-residual-label`**；完成态七槽 **`domestic-queue-complete-focus-residual-ring` 2s**（**CLIENT-197/212/228** 不退化）。单测：`domesticQueueEtaSegmentResidual.test.ts`、`domesticQueueCompleteFocusResidualRing.test.ts`。

**wave:40（CLIENT-229）队列返回主城七槽滚动与 ring 记忆**：关闭/收起队列面板时 **`restoreDomesticSlotScrollAnchor`** 按 `sessionStorage` **`domestic-slot-scroll-v1`**（槽位 `slotIndex` + 窄屏七槽条带 `scrollLeft`）滚回上次选中槽，条带格与画布 overlay 叠加 **`domestic-slot-return-ring` 1.2s**；打开队列或队列内高亮变化时 **`captureDomesticSlotScrollAnchor`** 写入；窄屏 **`.main-city-slot-overlay`** 七槽条与 **CLIENT-149/180/197** 互跳 **不退化**；与 **CLIENT-228** `highlightDomesticSlotForQueueRow` **并存**；无新 domestic RPC。单测：`domesticSlotScrollAnchor.test.ts`；`cd client && npm test` 绿。

**wave:38（CLIENT-215）招募商城多币种钱包对比**：将领面板顶栏 **`recruit-wallet-compare-line`**（`formatRecruitWalletCompareLine`：选中模板币种 **需 | 持** vs HUD `wallet`/背包，只读；与 **CLIENT-166/056** 列表次行 **余/需** 并存）；商城分类 tab 下 **`shop-wallet-compare-line`**（`formatShopWalletCompareLine`：本 tab 最低标价 vs 钱包余额；**CLIENT-167** `shop-tab-currency-sweep` 与 **CLIENT-194** 行内标价对比 **不退化**）。**非** IAP / **不**扩 SKU。单测：`recruitWalletCompare.test.ts`、`shopTabCurrency.test.ts`、`HeroMailPanels.test.ts`、`ContentPanels.test.ts`；`cd client && npm test` 绿。（[#788](https://github.com/anitaguptaoffice/sanguo-slg/issues/788) / [#810](https://github.com/anitaguptaoffice/sanguo-slg/pull/810) `8c5c705a`）

**wave:38（CLIENT-216）HUD 待办合并扫读行与底栏四面板深链脉冲**：待办区 **`.hud-todo-merged-sweep`** 合并行由 **`formatHudTodoMergedSweepLine`**（邮件/日常/队列/社交单行扫读，与 **CLIENT-202/162/209** 文案同源）驱动；分段点击或底栏角标深链 **`resolveToolbarPanelFromHudTodo`** 打开对应面板并触发底栏 **`toolbar-panel-deep-link-pulse`** 1.5s（**CLIENT-118** 四态图标与 **CLIENT-202** `center-panel-tab-pulse` **不退化**；无新 HUD RPC）。单测：`hudTodoMergedSweep.test.ts`；`cd client && npm test` 绿。（[#789](https://github.com/anitaguptaoffice/sanguo-slg/issues/789) / [#809](https://github.com/anitaguptaoffice/sanguo-slg/pull/809) `10bf1b62`）

**wave:39（CLIENT-226）HUD 军事待办分段深链军情战报出征面板脉冲**：待办区 **`.hud-military-todo-sweep`** / **`data-role="hud-military-todo-sweep-line"`** 由 **`formatHudMilitaryTodoSweepLine`** 分段展示军情进行中 / 战报未读 / 出征可提交只读计数（与 **CLIENT-216** 合并行 **并存**）；分段或底栏角标深链 **`resolveToolbarPanelFromHudMilitaryTodo`** 打开军情 / 战报 / 军事面板并触发底栏 **`hud-military-todo-pulse`** 1.5s（**CLIENT-156/158/209** 与 **CLIENT-216** `toolbar-panel-deep-link-pulse` **不退化**；无新 HUD RPC）。单测：`hudMilitaryTodoSweep.test.ts`；`cd client && npm test` 绿。

**wave:40（CLIENT-228）主城七槽与建造募兵队列双向焦点抛光**：画布七槽选中时队列面板同源 `building_cfg_id` 建造/募兵行附加 **`domestic-slot-queue-focus-ring` 1.5s**（`highlightDomesticQueueRowFocusRing` + `pulseQueueRowForOverlaySlot`；**CLIENT-180** `queue-row-slot-highlight` / **CLIENT-212** ETA 分段 / **CLIENT-196** 进度条 **不退化**）；队列行点击反向 **`highlightDomesticSlotForQueueRow`** 七槽 overlay 焦点环（与 **CLIENT-180** `city-slot-pulse`、**CLIENT-197** `city-slot-complete-focus-ring` **可叠加**）；无新 domestic RPC。单测：`domesticSlotQueueFocusRing.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。

**wave:38（CLIENT-213）将领列表忠诚次行与详情养成道具堆叠扫读**：列表行 **`formatHeroListLoyaltySubline`**（class **`hero-list-row-loyalty-subline`** / `data-role="hero-list-loyalty-subline"`）+ 低忠诚 **`hero-loyalty-warn-dot`**；详情 **`formatHeroDetailConsumableStackLine`**（**`hero-detail-consumable-stack-line`**）堆叠×N 与需/缺口只读对比；**CLIENT-165/198** **不退化**；无 hero 专用升级 RPC。单测：`heroListLoyaltySubline.test.ts`、`heroDetailConsumableStackLine.test.ts`、`HeroMailPanels.test.ts`、`heroMailState.test.ts`。（[#786](https://github.com/anitaguptaoffice/sanguo-slg/issues/786) / [#806](https://github.com/anitaguptaoffice/sanguo-slg/pull/806) `80003615`）

**wave:38（CLIENT-214）双榜手动刷新冷却戳记与排行空态行内重试**：「刷新排行榜」旁只读 **`formatRankRefreshCooldownStamp`** / **`rank-refresh-cooldown-stamp`** / `data-role="rank-refresh-cooldown"`（`rank-manual-refresh-ms` session，5s 客户端冷却；**无**新 rank RPC）；空榜行内 **`rank-empty-retry-inline`**（`retry-refresh-rank`，同源 `refreshRank`）；首屏拉取失败仍走 **CLIENT-173** `formatPanelGatewayError` + `panel-gateway-retry`。**CLIENT-184** 三甲密度行 / 钉选滚动与 **CLIENT-152** 戳记 **不退化**。单测：`rankRefreshCooldown.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（[#787](https://github.com/anitaguptaoffice/sanguo-slg/issues/787) / [#813](https://github.com/anitaguptaoffice/sanguo-slg/pull/813) `339a4dac`）

**wave:41（CLIENT-242）背包商城分类扫描高亮与双榜钉选招募钱包对比行残余**：背包/商城分类 tab 切换时 **`highlightBagShopCategoryScanRow`** 首条匹配行 **`bag-shop-category-scan-ring` 1.5s**（**CLIENT-194/092** 行内态与缺口条 **不退化**；**无**新 SKU）；双榜顶栏 **`formatRankPinRefreshResidualLine`** / **`rank-pin-refresh-residual-line`** 只读钉选名次 + 上次刷新 + 冷却残余（**CLIENT-152/214** **不退化**）；招募顶栏对比行下 **`formatRecruitWalletCompareResidualLine`** / **`recruit-wallet-compare-residual-line`** 列表口径余/需残余（**CLIENT-056/215** **不退化**；**非** IAP）。单测：`bagShopCategoryScan.test.ts`、`rankPinRefreshResidual.test.ts`、`recruitWalletCompareResidual.test.ts`、`ContentPanels.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**wave:42（CLIENT-248）双榜手动刷新冷却戳记与钉选保持残余扫读**：「刷新排行榜」下只读 **`formatRankRefreshCooldownResidualStamp`** / **`rank-refresh-cooldown-residual-stamp`** / `data-role="rank-refresh-cooldown-residual"`（冷却窗口内合并 **冷却剩余** + **上次刷新** 次行；旁侧 **`formatRankRefreshCooldownStamp`**（**CLIENT-214**）与 **`rank-pin-refresh-residual-line`**（**CLIENT-242**）**不退化**；**无**新 rank RPC）；手动刷新成功后钉选行 **`rank-pin-keep-residual-ring` 1.5s**（**CLIENT-184** 三甲密度 / 钉选滚动 **不退化**；**非** wave:41 招募钱包对比主叙事）。单测：`rankRefreshCooldownResidual.test.ts`、`rankPinKeepResidualRing.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。

**wave:44（CLIENT-264）双榜刷新冷却戳记与钉选保持残余巩固**：残余次行下只读 **`formatRankRefreshCooldownResidualDeepStamp`** / **`rank-refresh-cooldown-residual-deep-stamp`** / `data-role="rank-refresh-cooldown-residual-deep"`（冷却窗口内合并 **CLIENT-248** 残余 + **`rank-manual-refresh-count`** 本会话 **手动刷新次数**；**CLIENT-248/214** 主戳记 **不退化**；**无**新 rank RPC）；手动刷新成功后钉选行叠加 **`rank-pin-keep-residual-deep-ring` 2s**（与 **CLIENT-248** `rank-pin-keep-residual-ring` **并存**；**非** wave:43 **CLIENT-257** 排行密度/招募摘要主叙事）。单测：`rankRefreshCooldownResidualDeep.test.ts`、`rankPinKeepResidualDeepRing.test.ts`、`rankManualRefreshCountSession.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（[#992](https://github.com/anitaguptaoffice/sanguo-slg/issues/992)）

**wave:46（CLIENT-280）双榜刷新冷却戳记与钉选保持残余巩固再加深**：见 [Wave 46](#wave-46-h5-主城队列-eta-完成焦点残余巩固再加深队列预览槽位互链再加深将领养成扫读再加深panelstate-筛选再加深双榜钉选再加深军团聊天再加深日常-hud-深链再加深1280-组合-manifest-巩固再加深m4-出口--intg-043) 正文 bullet。

**wave:43（CLIENT-257）排行列表密度扫读与招募模板行内摘要残余**：第二次及以后手动刷新后三甲密度行 **`formatLeaderboardTopDensityLine`** 主行下只读 **`formatRankListDensityScanResidualLine`** / **`rank-list-density-scan-residual-line`**（名次变化 + 战力/资源分数次行；**CLIENT-184** 密度快览与钉选滚动 **不退化**；**非** wave:42 `rank-pin-keep-residual-ring` 主叙事重复）。招募模板列表行在 **CLIENT-056** 余/需次行旁追加 **`formatRecruitTemplateInlineResidualSummary`** / **`recruit-template-inline-residual-summary`**（模板 id + 币种余额只读摘要；**CLIENT-215** 顶栏对比行 **不退化**；**非** IAP）。单测：`rankListDensityScanResidual.test.ts`、`recruitTemplateInlineResidualSummary.test.ts`、`SocialPanels.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

**wave:45（CLIENT-273）排行列表密度扫读与招募模板行内摘要残余加深**：三甲密度 **CLIENT-257** 残余次行下追加只读 **`formatRankListDensityScanResidualDeepLine`** / **`rank-list-density-scan-residual-deep-line`**（名次变化 + 战力/资源分数 **加深** 第三行扫读；**CLIENT-184/257** **不退化**；**非** wave:44 **CLIENT-264** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-257** 残余摘要旁追加 **`formatRecruitTemplateInlineResidualDeepSummary`** / **`recruit-template-inline-residual-deep-summary`**（模板 id + 币种余需 **加深** 行内摘要；**CLIENT-056/215** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeep.test.ts`、`recruitTemplateInlineResidualDeepSummary.test.ts`、`SocialPanels.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（[#1027](https://github.com/anitaguptaoffice/sanguo-slg/issues/1027) / [#1068](https://github.com/anitaguptaoffice/sanguo-slg/pull/1068) `099dccba`）

**wave:47（CLIENT-289）排行列表密度扫读与招募模板行内摘要残余巩固再加深**：三甲密度 **CLIENT-273** 残余加深第三行下追加只读 **`formatRankListDensityScanResidualDeeperLine`** / **`rank-list-density-scan-residual-deeper-line`**（名次变化 + 战力/资源分数 **巩固再加深** 第四行扫读；**CLIENT-184/273** **不退化**；**非** wave:46 **CLIENT-280** 双榜钉选保持主叙事）。招募模板列表在 **CLIENT-273** 加深摘要旁追加 **`formatRecruitTemplateInlineResidualDeeperSummary`** / **`recruit-template-inline-residual-deeper-summary`**（模板 id + 币种余额 **巩固再加深** 行内摘要；**CLIENT-056/215** **不退化**；**非** IAP）。单测：`rankListDensityScanResidualDeeper.test.ts`、`recruitTemplateInlineResidualDeeperSummary.test.ts`、`SocialPanels.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。（Closes [#1288](https://github.com/anitaguptaoffice/sanguo-slg/issues/1288)）

**wave:38（CLIENT-217）军团成员在线摘要与聊天拉取失败退避重试**：军团成员列表头 **`formatGuildMemberOnlineSummaryLine`** / **`guild-member-online-summary`** / `data-role="guild-member-online-summary"`；聊天 gateway error 叠加 **`guild-chat-backoff-retry`**（退避秒数 + 行内重试，与 **CLIENT-200** `guild-chat-retry-inline` **并存**）；**CLIENT-161** 未读分隔线与空错态 **不退化**。单测：`socialFormat.test.ts`、`guildChatGatewayBackoff.test.ts`、`SocialPanels.test.ts`；`cd client && npm test` 绿。（[#788](https://github.com/anitaguptaoffice/sanguo-slg/issues/788) / [#808](https://github.com/anitaguptaoffice/sanguo-slg/pull/808) `2b8787c7`）

**wave:38（CLIENT-218）日常可领 chain 次行与队列下一完成 ETA 预览互链**：日常可领行次行 **`formatQuestChainTypeSubline`**（**`daily-quest-chain-type-subline`**）；队列顶栏 **`formatNextQueueFinishPreviewLine`**（**`queue-next-finish-preview`**，`data-action="queue-open-daily-anchor"` 跳转日常锚点；**CLIENT-212** 分段可叠加）。单测：`questChainTypeSubline.test.ts`、`nextQueueFinishPreview.test.ts`、`DailyQuestPanels.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。（[#789](https://github.com/anitaguptaoffice/sanguo-slg/issues/789) / [#812](https://github.com/anitaguptaoffice/sanguo-slg/pull/812) `bcc74181`）

**wave:42（CLIENT-245）队列下一完成预览与七槽完成余量 ring 残余互链**：队列顶栏主预览 **`formatNextQueueFinishPreviewLine`**（**CLIENT-218** **不退化**）下 **`formatNextQueueFinishPreviewResidualLine`** / **`queue-next-finish-preview-residual-line`** 只读残余（cfg 摘要 + ETA 剩余；**非** wave:38 预览主叙事重复堆叠）；点击 **`data-action="domestic-slot-complete-margin-residual-ring"`** 定位七槽并 **`domestic-slot-complete-margin-residual-ring` 1.5s**（**CLIENT-212** `domestic-queue-complete-slot-margin` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidual.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。

**wave:44（CLIENT-261）队列下一完成预览与七槽互链残余巩固**：在 **CLIENT-245** 残余行下追加 **`formatNextQueueFinishPreviewResidualDeepLine`** / **`queue-next-finish-preview-residual-deep-line`**（建造/募兵双队列只读计数 + 下一完成 ETA 巩固摘要；**CLIENT-218/245 不退化**）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deep-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deep-ring` 2s** 深环（叠加 **CLIENT-244** `domestic-queue-complete-focus-residual-ring`；**CLIENT-260** `domestic-queue-complete-focus-residual-deep-ring` 软依赖 stub **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeep.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。

**wave:46（CLIENT-277）队列下一完成预览与七槽互链残余巩固再加深**：在 **CLIENT-261** 深巩固行下追加 **`formatNextQueueFinishPreviewResidualDeeperLine`** / **`queue-next-finish-preview-residual-deeper-line`**（双队列类型 + 槽位标签 + 下一完成 ETA 只读 **巩固再加深** 摘要；**CLIENT-261/218/245 不退化**；**非** wave:44 CLIENT-261 首版巩固主叙事重复）；点击 **`data-action="domestic-slot-preview-cross-link-residual-deeper-ring"`** 定位七槽并 **`domestic-slot-preview-cross-link-residual-deeper-ring` 2.5s** 更深环（叠 **CLIENT-261** 深环与 **CLIENT-276** `domestic-queue-complete-focus-residual-deeper-ring` **不退化**；**无**新 domestic RPC）。单测：`nextQueueFinishPreviewResidualDeeper.test.ts`、`QueuePanels.test.ts`；`cd client && npm test` 绿。

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
3. **背包**：空列表引导「商城」「日常」；道具行 `item_cfg_id` 与数量列对齐；**CLIENT-153** 分类 tab 与 `bag-stack-qty` 堆叠扫读见 [CLIENT-020](#手动验收背包与商城反馈-client-020) 第 8 步；使用失败时金色反馈在列表**下方**，不遮挡道具行。
4. 单测：`panelDensity.test.ts`、`BattleReportPanel.test.ts`、`HeroMailPanels.test.ts`；全量 `cd client && npm test`。

### 手动验收（社交扫读 CLIENT-030）

在 CLIENT-021 / CLIENT-022 基础上加深排行顶栏、军团排序与聊天分组（`make dev` 或 mock）。

1. **排行**：打开面板后 `rank-viewer-bar` 展示 **我的名次 / 分数**（`my_rank` / `my_score`）；手动刷新成功后同栏展示 **上次刷新**（`rank-last-refresh-ms` session）；`my_rank>0` 时列表顶行 **钉选** `formatMyRankPinLine`；表头 `thead` 固定；空榜行使用 `formatLeaderboardEmptyHint()`（含 dev 无种子提示）。**CLIENT-097**：点击榜单行 — 战力榜己方行打开将领详情（`GetHeroDetail`），他人行状态栏提示只读；资源榜有格点字段时打开世界信息卡，否则只读摘要弹层。**CLIENT-168（wave:32）**：列表行在 `parseLeaderboardRowHeroId` 可解析时展示 **查看将领** 按钮（快照可选 `hero_id` / `player_id`）；跳转将领详情 **CLIENT-099** 选中态；自详情再开排行时 `leaderboard-return-scroll-v1` 恢复 **原榜 tab + scrollTop**。**CLIENT-152（wave:30）**：手动 **刷新排行榜** 后若 `my_rank` 相对上次快照变化，钉选行附加 `rank-my-rank-changed-pulse` 3s；钉选 **主行** 为 `formatMyRankPinLine`，**次行** `formatMyRankPinSecondaryLine`（复用 `formatSocialPanelLastUpdated`）；`rank-viewer-bar` 戳记模式不退化。**CLIENT-184（wave:34）**：第二次及以后 **手动刷新** 成功后列表顶先展示 `formatLeaderboardRefreshedHint` + 最多三条 `formatLeaderboardTopDensityLine`（名次+简称+分数截断），其下仍为钉选行；`leaderboard-pin-v1` 恢复刷新前 `scrollTop` 以保持钉选扫读，且 **不** 清除 `leaderboard-return-scroll-v1`；空榜仍 **CLIENT-053**。单测：`leaderboardFormat.test.ts`、`leaderboardPin.test.ts`、`leaderboardRowHeroId.test.ts`、`leaderboardReturnScroll.test.ts`、`leaderboardMyRankRefresh.test.ts`、`SocialPanels.test.ts`。
2. **军团**：「刷新成员」列表按职务（团长→官员→成员）与战力排序（`sortGuildMembers`），并按职务 **分组折叠**（`groupGuildMembersByRole`，**CLIENT-185** `guild-role-group-header` + `guild-role-group-count`，默认展开团长组）；每行 **主行** 昵称 + 职务 chip，次行 `player_id` 截断与战力/加入摘要（CLIENT-101 + **CLIENT-144**）。
3. **聊天**：世界频道消息按本地日插入 **今日/昨日** 分组标题（`groupChatMessagesByLocalDay`）；世界行 `chat-msg-world` 行高收紧，`chat-sender` 长昵称不被裁切。
4. 单测：`socialFormat.test.ts`、`leaderboardFormat.test.ts`、`SocialPanels.test.ts`。

### 手动验收（社交刷新 CLIENT-045）

排行与聊天面板 **手动刷新** 与 **陈旧提示**（`make dev` 或 mock；`SocialPanels` + `socialRefreshFormat`）。

1. 主城点 **「排行」**：打开即拉取当前榜单；成功后 **「刷新排行榜」** 下方出现 **上次更新** 本地时间戳。
2. 连点刷新或切换榜单触发拉取时，刷新按钮应 **禁用**直至返回；快速双击不应并发重复 RPC（单飞 dedupe）。
3. 断网或 mock 失败：面板内红色 **刷新失败：…** 文案（网关 `formatSocialGatewayError`），状态栏同步；修复后再次刷新应恢复时间戳。
4. **「聊天」** 各频道（世界/私聊/军团）同理：**刷新** 按钮 + **上次更新**；发送成功后自动刷新也应更新时间戳。
5. 单测：`socialRefreshFormat.test.ts`、`socialPanelInflight.test.ts`、`SocialPanels.test.ts`（时间戳、in-flight 禁用、失败文案）。

### 手动验收（聊天未读列表扫读与角标同步 CLIENT-161）

在 [CLIENT-102](#手动验收聊天未读与社交角标-client-102) / [CLIENT-144](#手动验收社交刷新戳记与角标同步-client-144) 之上：消息列表按本地已读游标插入未读分隔线（**CLIENT-185** 起 class **`chat-unread-separator`**，`findChatUnreadSeparatorIndex`）；底栏 **聊天** / **军团** 与面板 tab 角标共用 `hudTodoBadges` **`hudTodoSocialBadgesFromChatSummary`**（与 `estimateChatUnreadCount` 同源）。**打开聊天 tab 不清零游标**；滚过分隔线或点 **标为已读** 后 `markChannelRead` 与 HUD 角标同步递减。空/错态仍 **CLIENT-053** + **CLIENT-129**。单测：`chatUnread.test.ts`、`hudTodoBadges.test.ts`、`SocialPanels.test.ts`。

### 手动验收（军团职务分组头与聊天未读分隔线扫读 CLIENT-185）

在 [CLIENT-101](#手动验收社交扫读-client-030) / [CLIENT-160](#手动验收军团提到聊天草稿-client-084) / [CLIENT-161](#手动验收聊天未读列表扫读与角标同步-client-161) / [CLIENT-162](#手动验收hud-待办与面板-tabchip-一致-client-162) 之上加深扫读：

1. **军团**：成员列表 `groupGuildMembersByRole` 职务顺序（团长→官员→成员）不退化；每组 **`guild-role-group-header`** 展示折叠钮 + **`guild-role-group-count`** 人数 chip（默认仅团长组展开）。
2. **聊天**：首条未读消息上方插入 **`chat-unread-separator`**，居中文案 **`formatChatUnreadSweepLine`**（与 tab/HUD `estimateChatUnreadCount` 条数一致）；滚过分隔线或 **标为已读** 后角标递减；**`guild-chat-draft-v1`** 草稿记忆（CLIENT-160）与 **CLIENT-162** 底栏社交角标不退化。
3. 单测：`socialFormat.test.ts`（`groupGuildMembersByRole`）、`chatUnread.test.ts`（`findChatUnreadSeparatorIndex`、`formatChatUnreadSweepLine`）、`SocialPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（社交刷新戳记与角标同步 CLIENT-144）

在 [CLIENT-045](#手动验收社交刷新-client-045) / [CLIENT-096](#手动验收社交扫读-client-030) / [CLIENT-102](#手动验收聊天未读与社交角标-client-102) 之上：`formatPanelRefreshStamp` 统一排行顶栏与军团/聊天 `social-refresh-status` 的 **上次刷新** 相对文案（48h 内 **刚刚/N 分钟前/N 小时前**；更久回退本地时间）；`chat-panel-last-refresh-ms` / `guild-panel-last-refresh-ms` **sessionStorage** 在重开面板时恢复戳记（不新 RPC）。聊天 **手动刷新** 后 `ChatUnreadTracker` 快照即时驱动频道 tab 角标（与底栏 **CLIENT-161** `hudTodoSocialBadgesFromChatSummary` 同一估算）；空/错态仍走 **CLIENT-053** + **CLIENT-129** 骨架。

1. **排行**：`rank-last-refresh-ms` 与刷新按钮旁状态行均含 **上次刷新：刚刚**（或相对时间）。
2. **军团**：职务分组下成员主行见昵称 + 职务标签；**刷新成员** 成功后见相对 **上次刷新**。
3. **聊天**：手动 **刷新** 后未读 tab 角标与快照一致；失败/空列表不退化 CLIENT-053。
4. 单测：`panelRefreshStamp.test.ts`、`socialRefreshFormat.test.ts`、`SocialPanels.test.ts`；全量 `cd client && npm test`。

### 手动验收（社交空态与错误文案 CLIENT-053）

排行/军团/聊天空列表与刷新失败文案统一走 `socialFormat` + `formatSocialPanelRefreshError`（与 CLIENT-045 刷新按钮并存）。**CLIENT-200** 起军团成员 / 聊天列表 empty 统一 **`formatGuildPanelEmptyHint`**；列表区网关失败为 **`data-panel-state=error`** + **`guild-chat-retry-inline`**（与工具栏 `social-refresh-retry` 并存）。

1. **排行**：空榜行含「刷新排行榜」引导；刷新失败且曾有成功数据时表格保留上次快照，状态栏 **刷新失败** 并标注 **数据可能已过期**。
2. **聊天**：无消息时列表空态含「刷新」引导；军团频道未入团为只读说明 + **前往军团**（不新 RPC）；刷新失败见 **聊天：** + `[code]` 与列表内 **重试**。
3. **军团**：未入团成员区只读说明；已入团无成员见 `formatGuildPanelEmptyHint`；刷新失败见 **军团：** + `[code]` 与 **`guild-chat-retry-inline`**。
4. 单测：`socialFormat.test.ts`（`formatGuildPanelEmptyHint`）、`SocialPanels.test.ts`（陈旧快照、军团跳转、行内重试）。

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

### 手动验收（招募钱包扫读与详情互跳 CLIENT-166）

在 [CLIENT-056](#手动验收将领招募钱包对比-client-056) / [CLIENT-148](#手动验收hud-经济扫读-client-148) HUD `wallet` 与 [CLIENT-099](#手动验收将领列表刷新与选中记忆-client-099) 选中记忆基础上巩固（**无新** hero/recruit RPC；**不重复** wave:26 **CLIENT-114** 提交脉冲/toast 主叙事）：

1. **将领** → 刷新招募模板：列表行 **次行** `formatRecruitWalletSweepLine` 展示招募币种（**币**/将魂碎晶等 `recruit_cost`/`recruit_item`）与顶栏 **wallet**/背包 **余/需** 对比；不足时次行带 **`recruit-cost-deficit`**（只读）。
2. 招募行 **查看将领**：已拥有同 `template_cfg_id` 时打开 `GetHeroDetail`（`hero_id`）；未拥有实例时按钮 **灰显**（`recruit-template-locked`），招募行选中与 **CLIENT-114** 脉冲不退化。
3. 详情 **去招募**：预选 `template_cfg_id`，写入 **`recruit-scroll-anchor-v1`** 并滚动至对应模板行；与 **CLIENT-072** 互跳并存。
4. 单测：`recruitWalletSweep.test.ts`、`recruitScrollAnchor.test.ts`、`HeroMailPanels.test.ts`；`cd client && npm test` 绿。

### 手动验收（将领招募提交行内反馈 CLIENT-183）

在 [CLIENT-114](#手动验收将领招募提交反馈巩固-client-114) 提交态与 [CLIENT-166](#手动验收招募钱包扫读与详情互跳-client-166) 钱包扫读基础上（**非** wave:26 商城购买脉冲；**无** IAP/新 SKU）：

1. 点 **招募**：预览行 `recruit-submitting` + **招募提交中…**（与主钮 **招募中…** 并存）；`RecruitHero` 成功则 `recruit-success-toast` 展示 `formatRecruitSuccessLine`（将领名 + 已扣币种摘要，**不**为摘要去拉额外 hero RPC）。
2. 成功后 `GetCityState`（或 `cityStateFetch`）刷新会话 **wallet**，列表/预览 **余/需** 次行即时递减，并短暂 **`recruit-success-pulse`（1.5s）**；粮木铁石仍可走顶栏 **CLIENT-051** 脉冲。
3. 失败仍走 **CLIENT-173** `formatPanelGatewayError` 内联区；单测：`recruitSubmitFeedback.test.ts`、`HeroMailPanels.test.ts`。

### 手动验收（招募表单行内校验与背包道具缺口深链 CLIENT-201）

在 [CLIENT-166](#手动验收招募钱包扫读与详情互跳-client-166) 钱包扫读、[CLIENT-183](#手动验收将领招募提交行内反馈-client-183) 提交脉冲与 [CLIENT-165](#手动验收将领详情养成道具缺口与背包深链-client-165) 背包深链基础上（**非** wave:26 商城购买脉冲；**无** IAP/新 SKU）：

1. 选中招募模板：预览下方 **`formatRecruitFormInlineHint`** 只读校验行（模板名 + 币种 **余/需**）；不足时带 **`recruit-form-inline-warn`** 且主钮 **disabled**（与 `recruit-form-error` / **CLIENT-057** 预校验并存）。
2. **`recruit_item` 道具缺口**：校验行旁 **打开背包** 深链（`recruitItemGap=1` + `highlightItemId`）；背包堆叠行叠加 **`bag-hero-item-gap-highlight`**（保留 **CLIENT-165** `item-highlight` 与 **CLIENT-194** 行内态）。
3. `RecruitHero` 成功仍走 **CLIENT-183** `recruit-success-pulse`；单测：`recruitFormInlineHint.test.ts`、`heroDetailBagDeepLink.test.ts`、`HeroMailPanels.test.ts`、`ContentPanels.test.ts`。

### 手动验收（将领详情养成对比 CLIENT-072）

在 [CLIENT-014](#手动验收将领详情-client-014) / [CLIENT-056](#手动验收将领招募钱包对比-client-056) 基础上：

1. 点选将领：详情区展示 **养成进度条**（有 `exp_*` 时等级经验 + `loyalty_min~max` 忠诚条；缺经验字段时降级为 **Lv·忠诚** 摘要）；列表行 `selected` 与详情 `hero_id` 同步。
2. 属性表 **Δ 列** 为 `compareHeroDetailToTemplate` 相对模板基准四维 ±N（不发新 hero RPC）。
3. **去招募**：同面板招募区预选当前 `template_cfg_id`；**相关道具**：`ListPlayerBag` 过滤养成消耗品（如将魂碎晶 2017）并打开背包高亮。
4. 单测：`heroMailState.test.ts`（对比/进度/背包过滤）、`HeroMailPanels.test.ts`。

**CLIENT-198（将领详情养成前后对比与进度扫读）**：在 **CLIENT-072/133/165** 不退化前提下，详情头下 **`hero-growth-compare-strip`** 展示 `formatHeroGrowthCompareStrip`（等级/忠诚 **当前→下一档** 只读行）；养成区 **`hero-upgrade-progress-bar`** + 次行 **`formatHeroUpgradeProgressLine`**（caption + 百分比）；`GetHeroDetail` 失败仍走 **CLIENT-173** `formatPanelGatewayError`；道具缺口深链仍走 **CLIENT-165**。单测：`heroGrowthCompareFormat.test.ts`、`heroMailState.test.ts`；`cd client && npm test` 绿。（[#724](https://github.com/anitaguptaoffice/sanguo-slg/issues/724)）

### 手动验收（四类面板统一错误 CLIENT-067）

将领/商城/背包/军事的内联错误区（`recruit-form-error`、`shop-form-error`、`bag-form-error`、`march-form-error`）经 `contentFormValidation.setPanelFormErrorDisplay` 渲染；网关失败统一为 `formatPanelGatewayError` 的中文摘要 + 末尾 `[code]`（如商城 `余额不足 [64003]`），与 CLIENT-056/057 预校验共用同一 DOM 槽位，成功操作后错误区清空。

### 手动验收（世界格点信息卡 CLIENT-073）

在 [CLIENT-069](#手动验收军情格点筛选-client-069) 格点筛选与 [CLIENT-061](#手动验收世界坐标-client-015) 双向高亮基础上，**世界** 面板点选城池/格点后展示只读 **格点信息卡**（坐标、匹配 `ListPlayerCities` 快照的城池名/城墙等级、空地格资源类型文案；**不新 world RPC**）。

1. 打开 **世界** → 点选一城或列表行：应出现 **格点信息** 卡，含坐标与 **指向此格进行中行军 N 条**（或「暂无」）；再次点选同一行取消选中并隐藏信息卡。
2. 信息卡 **在军情中查看**：应打开/保持 **行军** 面板，目的格筛选为 **世界选中格**（与 CLIENT-069 一致）；列表仅显示 `to_x/to_y` 匹配行。
3. 小地图 **空白单击** 选出征目标时，世界信息卡应同步该格；小地图视野 `pan/zoom` 纳入该格，目的点标注与 CLIENT-028 行军连线不退化；军情选中行军时仍以 CLIENT-069 目的格视野为准。
4. 单测：`worldTileInfoCard.test.ts`、`WorldPanels.test.ts`、`MarchListPanel.test.ts`、`worldMinimap.test.ts`；深化见 [CLIENT-140](#手动验收世界信息卡军情军事深链-client-140)。

### 手动验收（世界格点扫读 CLIENT-170）

在 [CLIENT-140](#手动验收世界信息卡军情军事深链-client-140) / [CLIENT-061](#手动验收世界坐标-client-015) 互链与 [CLIENT-156](#wave31-巩固client-156) 出征反馈基础上，补 **格点扫读余量**（只读 `ListPlayerCities` / `ListMarches` 快照，**不**灌世界瓦片/图集，**不**新 world RPC）：

1. **世界** 格点信息卡：坐标 `x/y`、城池名、`formatWorldTileOccupationSummary` 占领态一行；次行 `formatWorldTileInfoSecondary` 展示首条进行中行军 ETA（无则 hint）。
2. **小地图** 空白选点：世界信息卡同步该格并附加 **2s** `world-tile-focus-pulse`；小地图 `focusGrid` 金环与 CLIENT-090 军情选中不退化。
3. 点击信息卡非按钮区域：**居中** 小地图视口（`focusMinimapOnWorldGrid`，无新 RPC）；出征 `march-queue-banner`（CLIENT-156）不退化。
4. 单测：`formatWorldTileInfoSecondary`、`worldTileSelectionSync.test.ts`、`WorldPanels.test.ts`；`cd client && npm test` 绿。（[#633](https://github.com/anitaguptaoffice/sanguo-slg/issues/633)）

### 手动验收（世界信息卡↔军情军事深链 CLIENT-140）

在 [CLIENT-073](#手动验收世界格点信息卡-client-073) / [CLIENT-108](#手动验收世界格点信息卡加深-client-108) 只读信息卡与 [CLIENT-069](#手动验收军情格点筛选-client-069) / [CLIENT-090](#手动验收小地图与军情互选-client-090) 互选基础上，补 **世界↔军情** 一步深链（纯 `ListMarches` 客户端过滤，**无** world proto 扩量）：

1. **世界** 信息卡：`countMarchesAtCell` 仅计进行中阶段（与 minimap 目的点口径一致）；**在军情中查看** 打开行军面板并套用目的格筛选。
2. **军情** 行选中：世界列表目的格高亮 + 小地图视野纳入目的格（`minimapMarchFocus` / CLIENT-090 不退化）。
3. 刷新城池时信息卡 **CLIENT-129** `data-panel-state` loading/error（`world-tile-info-state`）；`data-art-skin="off"` 回退纯文案。
4. 单测：`worldInfoCard.test.ts`（`countMarchesAtCell` + `buildWorldInfoCardSummary`）、`WorldPanels.test.ts`、`MarchListPanel.test.ts`。

### 手动验收（世界格点信息卡加深 CLIENT-108）

在 **CLIENT-073** 基础上，信息卡补充 **玩家展示名**、**资源格类型**、**曼哈顿距离**（相对主城）与 **最近战报** 快捷入口（只读 `ListPlayerCities` / `ListMarches` / 战报列表快照，**无新 world RPC**）。战报列表行 **复盘格点** 应打开世界面板并选中对应坐标（与 **CLIENT-109** 互链）。

1. **世界** 点选空地/资源格：信息卡应展示资源类型或「暂无城池」提示；有城池时展示城墙等级与玩家名（若快照带 `owner_display_name`）。
2. 信息卡 **最近战报** / 战报行 **复盘格点**：应深链世界格点并保持 **CLIENT-069** 军情筛选不退化。
3. 单测：`worldTileInfoCard.test.ts`、`WorldPanels.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（军情战报筛选记忆 CLIENT-109）

**行军** 列表：`military-list-filter-v1`（`sessionStorage`）记忆 **阶段筛选**（全部/待发/去程/驻扎/返回）与 **ETA 排序**；与 **CLIENT-047/069/085** 列表密度、格点筛选并存。**战报** 列表：胜负 outcome 筛选键迁移至 `battle-report-outcome-filter-v1`（兼容 **CLIENT-049** 旧键），与时间窗 **CLIENT-065** 分离；**CLIENT-125** 筛选条接 **CLIENT-121** `data-ui-filter-chip`（`aria-pressed` + `battle-report-outcome-filter-v1` 记忆），列表行 `data-ui-filter-row` 九宫与胜/负 **badge.dot**（与攻守摘要 **CLIENT-100**、键盘 **CLIENT-094**、复盘格点 **CLIENT-108** 并存）；列表行 **复盘格点** 打开世界信息卡（**CLIENT-108**）。

1. 切换军情阶段筛选与 ETA 排序 → 刷新页面后恢复。
2. 战报 **胜/负/平** 筛选与时间窗组合 → 刷新后各自恢复；点 **复盘格点** 应选中世界格点。
3. 单测：`militaryListFilter.test.ts`、`battleReportListState.test.ts`、`MarchListPanel.test.ts`、`BattleReportPanel.test.ts`。

**wave:33（CLIENT-176）**：战报列表 **主行** `formatBattleReportListPrimaryLine`（`#report_id` + 对手标题 + 时间）；**次行** `formatBattleReportRowSummary`（胜负 + 攻守方简称 + `formatReportCoord`）；顶栏 outcome chip（胜/负/全部/平）仍写 `battle-report-outcome-filter-v1`，与 **CLIENT-158** 相邻导航、**CLIENT-125** 筛选条不退化。单测：`militaryFormat.test.ts`（`formatBattleReportRowSummary`）、`battleReportListState.test.ts`、`BattleReportPanel.test.ts`。

**wave:35（CLIENT-190）**：战报详情顶栏只读 **`battle-report-outcome-band`**（`formatBattleReportOutcomeHeadline` + 胜/负/平色带）；**上一封/下一封** 与键盘 **←/→** / **Alt+←/→** 导航按钮附加 **`battle-report-adjacent-focus-ring`** 加深 `:focus-visible`；**CLIENT-176** outcome 筛选记忆、**CLIENT-158** 相邻导航与 streak 摘要不退化。单测：`militaryFormat.test.ts`（`formatBattleReportOutcomeHeadline`）、`battleReportListNav.test.ts`、`BattleReportPanel.test.ts`。

**wave:37（CLIENT-207）**：战报列表顶栏 **时间窗 chip**（`battle-report-time-filter-v1`）与列表次行 **`formatBattleReportListStreakLine`** streak 扫读；**CLIENT-176** outcome 筛选、**CLIENT-083/158** 顶栏 streak 与相邻导航不退化。单测：`battleReportListState.test.ts`、`battleReportTimeFilterChip.test.ts`、`militaryFormat.test.ts`、`BattleReportPanel.test.ts`。

**wave:39（CLIENT-223）战报列表坐标军情互链**：列表次行 **`formatBattleReportCoordinateTag`** + 可点 **`report-list-intel-jump-tag`**（`data-action="report-list-intel-jump"`）：优先打开军情并选中同源/最近目的格行军，无匹配时 **坐标复盘** 展开小地图格点（**CLIENT-191/142** 详情互链、**CLIENT-207** 时间窗/streak **不退化**；**CLIENT-220** 同步环可接 `stubIntelMinimapSyncAfterReportListJump`）。单测：`battleReportListIntelJump.test.ts`、`militaryFormat.test.ts`、`BattleReportPanel.test.ts`。

**wave:41（CLIENT-239）战报列表密度与键盘焦点环**：列表行 **`report-list-density-row`** 含左侧 **`report-list-density-outcome-band`** 色带、**`report-list-density-timestamp`** 时间戳单行扫读与次行 **`report-list-density-coord`** 坐标（**CLIENT-125/190** 筛选 chip 与详情 outcome 色带 **不退化**）。面板聚焦时 **j/k** 或 **↑/↓**（列表行已聚焦时仍由 roving 处理 ↑/↓）驱动相邻 `report_id` 并附加 **`report-list-keyboard-focus-ring`**（**CLIENT-094/158** 详情 ←/→ 与 Alt+←/→ **不退化**）。根节点 **`data-battle-report-list-keyboard="off"`** 可关闭列表键盘导航。单测：`battleReportListDensityKeyboard.test.ts`、`BattleReportPanel.test.ts`。

**wave:37（CLIENT-208）**：战报详情 **`battle-report-outcome-band`** 下方只读 **`battle-report-round-summary-strip`**（`formatBattleReportRoundSummaryStrip`：首/末回合号 + 攻/守伤亡 map 摘要，沿用既有战报 detail JSON，**无** proto 扩量）；**CLIENT-065/207** 时间窗筛选后列表仍高亮当前 `report_id`；**CLIENT-125** 回合跳转表与折叠 **不退化**。单测：`militaryFormat.test.ts`（`formatBattleReportRoundSummaryStrip`）、`BattleReportPanel.test.ts`。

**wave:39（CLIENT-224）**：战报详情回合摘要条内 **`report-round-summary-intel-link`**（`data-action="open-intel-for-report"`）只读跳转军情并选中 `resolveMarchIdForBattleReport` 解析的同源 `report_id`/坐标最近 `march_id` 行；**CLIENT-208** 摘要文案、**CLIENT-178** 军事汇总条与 **CLIENT-205** 军情信息卡 **不退化**（**无** proto 扩量）。单测：`battleReportRoundSummaryIntelLink.test.ts`、`BattleReportPanel.test.ts`。

**wave:27（CLIENT-124）**：在 **CLIENT-109** 记忆与 **CLIENT-090/093** 小地图互选、再出征预填不退化前提下，军情 **阶段** 改为 **ART-UI-FILTER-008** 筛选 chip（`data-ui-filter-chip` + `militaryListPhaseChipReducer`）；列表行接 **九宫**（`data-ui-filter-row`）与新出征 **badge.dot**（`data-ui-filter-badge="dot"`，与 **CLIENT-116** `march-row-recent` / 行内 ETA 并存）。ETA 仍用下拉排序。无 `CancelMarch`/加速。单测：`militaryListPhaseChip.test.ts`、`MarchListPanel.test.ts`。

**wave:29（CLIENT-141）**：军情列表 **主行** = 目的格点 + 模板摘要（目的 / `#id` / 编制）；**次行** = `formatMarchRemainingMs` 剩余 ETA + `formatMarchPhase` 中文阶段。`ListMarches` 刷新后 `detectMarchPhaseChanges` 对 phase 变化的行附加 **`march-phase-changed`** 脉冲 3s；**CLIENT-124** 筛选 chip 与 **最早到达** 默认排序（`eta_asc`，`default` 同义）并存；loading/empty/error 仍走 **CLIENT-129**。单测：`formatMarchListSecondary`、`marchPhaseListRefresh.test.ts`、`MarchListPanel.test.ts`。

**wave:33（CLIENT-172）**：军情选中行军行展示只读 **`march-info-card`**（主行 `formatMarchInfoCardPrimary`、次行 `formatMarchEtaLine` + 兵力/将领摘要）；**查看目的格点** 打开世界面板并 **`world-tile-focus-pulse`**（CLIENT-170）；**再出征** 走 **CLIENT-093**（无 CancelMarch）；列表↔卡片 **`march-row-selected`** 双向高亮；loading/error 仍 **CLIENT-129**。单测：`marchInfoCard.test.ts`、`MarchListPanel.test.ts`、`WorldPanels.test.ts`。

**wave:37（CLIENT-205）**：军情信息卡顶栏 **`march-intel-phase-eta-strip`**（`formatMarchIntelPhaseEtaStrip`：phase 只读标签 + 剩余秒数/`formatMarchRemainingMs` + `arrive_at_ms` 到达时刻）；列表行次行 **`intel-row-phase-subline`** 与信息卡 **`march-intel-phase-eta-mutual-highlight`** 同步高亮；**CLIENT-172** 主/次行与 **CLIENT-189** `march-form-coord-sync-highlight` **不退化**（无 CancelMarch）。单测：`marchIntelPhaseEtaStrip.test.ts`、`MarchListPanel.test.ts`。

**wave:39（CLIENT-220）**：军情列表选中行军时小地图目的格 **`minimap-intel-sync-ring`** **1.5s** 焦点环（canvas + `#layout-frame` 脉冲，`beginMinimapIntelSyncRingForMarch`）；小地图点选行军终点、世界格点「在军情中查看」或「指向此格的行军」时 **`highlightIntelRowForMinimapTile`** 为同源 `march_id` 行附加 **`intel-row-minimap-sync-highlight`**；**CLIENT-204/205/189/170** 叠标、阶段条与坐标互链 **不退化**（无新 world RPC）。单测：`minimapIntelSyncHighlight.test.ts`、`filterListNarrowManifest.test.ts`。

**wave:41（CLIENT-236）**：军情选中行 **`syncMinimapViewportToIntelRow`** + **`minimap-viewport-intel-sync-ring` 1.2s** 视口锚点抛光（与 **CLIENT-220** 双向环 **并存**）；小地图手势结束后 **`scrollIntelListToVisibleMarch`** 滚入军情 **`.panel-scroll-body`**（**CLIENT-090/138** 列表互选 **不退化**）。单测：`minimapViewportIntelSync.test.ts`。

**wave:39（CLIENT-221）**：`ListMarches` 轮询/刷新时 `detectMarchPhaseChange` 对 phase 变化行附加 **`intel-phase-change-flash`** **2s** 脉冲（与 **CLIENT-141** `march-phase-changed` **3s** 可叠加）；选中行军 phase 变更时信息卡 **`formatMarchIntelPhaseEtaStrip`** 即时刷新且阶段条同步脉冲；**CLIENT-082/085** 到达阶段提醒 **可叠加**（无 CancelMarch）。单测：`marchIntelPhaseChangeFlash.test.ts`、`MarchListPanel.test.ts`。

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

### 手动验收（主城七槽等级与升级 ETA 扫读 CLIENT-130）

在 **CLIENT-066** 队列深链与 **CLIENT-104** 建造提交反馈之上，**七槽**（`hall`…`wall`，见 [`docs/art/maincity-slots.md`](../docs/art/maincity-slots.md)）画布 overlay 常驻 **`formatSlotOverlayLabel`**（`Lv.N`，升级中追加 `formatUpgradeRemainingAbbrev` ETA + 细进度条）；空闲与 `upgrade_finish_at_ms=0` 一致仅 **Lv**。点击空闲槽仍开建造侧栏；升级中仍深链队列 **`openAndHighlightBuildSlot`**（**CLIENT-105** 互高亮）；底栏 **CLIENT-107** `queueBuilding` 角标仍按进行中槽位数。契约仍 **`GetCityState`**，无新建造 RPC。

1. `make dev` 进主城：七槽均应可见 **Lv.N**；令一槽升级进行中 → 该槽标签为 **Lv.N · m:ss** 且带进度条，其余槽仅等级。
2. 升级中点槽 → **队列** 高亮对应行；点空闲槽 → **建造** 侧栏；互高亮与 **CLIENT-105** 脉冲不退化。
3. 单测：`mainCitySlotUpgrade.test.ts`（`formatSlotOverlayLabel`）、`QueuePanels.test.ts`、`buildSubmitFeedback.test.ts`（**CLIENT-104**）。

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

### 手动验收（小地图出征互链巩固 CLIENT-139）

在 [CLIENT-058](#手动验收小地图目的点-eta-client-058) / [CLIENT-041](#手动验收小地图选点出征-client-041) / [CLIENT-015](#手动验收世界坐标-client-015) 之上：目的格 **ETA 角标** 由 `formatMinimapDestEtaLabel` 驱动（与 `formatMarchRemainingMs` / `marchClockMs` 同 tick）；图例 **`MINIMAP_DEST_ETA_LEGEND`** 与角标并存。军事面板 `to_x`/`to_y`、**`marchTargetMemory`**（`resolveMarchTargetTruth` / `syncMarchTargetSessionFromForm`）与小地图 **focus 环** 同一事实源；`data-art-skin=off` 时目的点走 **canvas 描边**（`ui.minimap.dest.v1` 可选，CLIENT-138 资产缺失时自动回退）。

1. 小地图空白单击 → 表单坐标 + session + 小地图金环同步；世界城池点选后同样对齐。
2. 行军中目的点旁数字角标每秒刷新，与军情列表 `formatMarchRemainingMs` 一致。
3. 单测：`worldMinimap.test.ts`（`formatMinimapDestEtaLabel`）、`minimapMarchTargetCoord.test.ts`（坐标回写）、`artMinimapDestSkin.test.ts`。

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

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`hudFormat`（资源条分组数值与 `+粮` 摘要）、`hudCenterTodo` / `buildCompleteTodo`（顶栏待办聚合与 scroll target）、`hudTodoBadges` / `hudTodoBadge` / `HudTodoBadgePoll` / `hudTodoOpenTarget` / `toolbarBadge`（待办角标单一事实源、深链落点与单飞轮询）、`battleReportReplayCoord`（战报复盘坐标提取）、`worldMinimap`（小地图缩放/行军高亮/战报复盘 framing/比例尺/折叠 sessionStorage/多行军描边/目的点 ETA 角标）、`panelDensity`（邮件/战报/背包空态与未读 class）、`queueState` / `QueuePanels`（内政升级与募兵队列行、建造加速符 UseConsumable）、`contentFeedback`（背包/商城效果与网关错误文案）、`cityStateFetch` / `cityStatePoll`（GetCityState 单飞与降频轮询）、`militaryFormat`、`socialFormat` / `socialRefreshFormat` / `socialPanelInflight` / `SocialPanels`（聊天日期分组、军团职务排序、排行空榜提示、刷新时间戳与单飞）、`bagState`（网关背包合并）、`BattleReportPanel` / `MarchListPanel`（空列表/加载失败/列表行）、`dailyQuestObjective` / `dailyQuestState` / `dailyQuestBattleReportBanner` / `DailyQuestPanels`（chain 400 多类型标签、战报未读横幅、下一步导航与领奖合并）、`heroMailState`（招募模板/已招募/扣费明细/收件箱 filter·摘要·领取合并）、`recruitAffordability`（招募消耗 vs HUD 钱包对比）/ `HeroMailPanels`（未读切换、点开已读、角标）与 `StartMarchRequest` / `ListMarchesRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报/行军、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
