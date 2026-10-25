import { openCenterPanel, toggleCenterPanel } from "@/ui/centerPanelForeground";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  remountPanelFilterChips,
  setFilterChipLabel,
  syncFilterChipAria,
} from "@/engine/artFilterChipRuntime";
import {
  mountHeroPanelArtRuntime,
  skimHeroPanelStateChrome,
} from "@/engine/heroPanelArtMount";
import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import { formatUseConsumableEffectSummary, gatewayErrorMessage } from "@/net/contentFeedback";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { renderPanelGatewayErrorListRow } from "@/net/panelGatewayError";
import type { CityStateFetch } from "@/net/cityStateFetch";
import type { GatewayPort } from "@/net/GatewayClient";
import { applyUseResult, bagFromListPlayerBagResponse, type BagStack } from "@/net/bagState";
import {
  DAILY_QUEST_CHAIN_ID,
  dailyQuestsFromListResponse,
  findDailyRecruitQuest,
  formatRecruitDailyFollowUpHint,
  shouldPromptDailyRecruitAfterRecruit,
  type DailyQuestRow,
} from "@/net/dailyQuestState";
import {
  mountFilterBadgeCount,
  mountFilterBadgeDot,
  mountFilterBadges,
  mountFilterRow,
  mountFilterRows,
} from "@/engine/artUiFilterSkin";
import {
  formatHeroListRowPrimary,
  formatHeroListRowSecondary,
  HERO_LIST_ROW_PANEL_SKIN_ID,
  resolveHeroListRowSource,
} from "@/net/heroListRowFormat";
import {
  formatHeroListLoyaltySubline,
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_ROLE,
  HERO_LOYALTY_WARN_DOT_CLASS,
  normalizeListPlayerHeroSummary,
  heroListRowShowsLoyaltyWarnDot,
} from "@/net/heroListLoyaltySubline";
import {
  formatHeroListLoyaltyResidualSubline,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualWarnDot,
} from "@/net/heroListLoyaltyResidualSubline";
import {
  formatHeroListLoyaltyResidualDeepSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEP_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepWarnDot,
} from "@/net/heroListLoyaltyResidualDeepSubline";
import {
  formatHeroListLoyaltyResidualDeeperSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPER_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeeperSubline";
import {
  formatHeroListLoyaltyResidualDeepestSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestSubline";
import {
  formatHeroListLoyaltyResidualDeepestDeeperSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPER_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeeperSubline";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeeperSubline";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestSubline";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
  HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline";
import { scheduleHeroDetailConsumableStackResidualDeepSweep } from "@/net/heroDetailConsumableStackResidualDeepSweep";
import { scheduleHeroDetailConsumableStackResidualDeeperSweep } from "@/net/heroDetailConsumableStackResidualDeeperSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestSweep } from "@/net/heroDetailConsumableStackResidualDeepestSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestDeeperSweep } from "@/net/heroDetailConsumableStackResidualDeepestDeeperSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep } from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeeperSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestSweep } from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeepestSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep } from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep";
import { scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep } from "@/net/heroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep";
import {
  heroListFilteredEmptyMessage,
  heroListRowsForDisplay,
  readHeroListFilterSession,
  readHeroListSortSession,
  type HeroListFilter,
  type HeroListFilterContext,
  type HeroListSort,
  writeHeroListFilterSession,
  writeHeroListSortSession,
} from "@/net/heroListFilter";
import {
  formatHeroListFilterChipResidualSweepLine,
  readHeroListFilterChipResidualSession,
  syncHeroListFilterChipResidualSweep,
  type HeroListFilterChipAction,
} from "@/net/heroListFilterChipResidual";
import {
  formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession,
  syncHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweep,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeepest";
import {
  formatHeroListFilterChipResidualDeepestDeepestDeepestSweepLine,
  readHeroListFilterChipResidualDeepestDeepestDeepestSession,
  syncHeroListFilterChipResidualDeepestDeepestDeepestSweep,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepest";
import {
  captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession,
  syncHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweep,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeeper";
import {
  formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine,
  readHeroListFilterChipResidualDeepestDeepestDeeperSession,
  syncHeroListFilterChipResidualDeepestDeepestDeeperSweep,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeeper";
import {
  captureHeroListFilterChipResidualDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeeperSweepLine,
  readHeroListFilterChipResidualDeepestDeeperSession,
  syncHeroListFilterChipResidualDeepestDeeperSweep,
} from "@/net/heroListFilterChipResidualDeepestDeeper";
import {
  formatHeroListFilterChipResidualDeepestSweepLine,
  readHeroListFilterChipResidualDeepestSession,
  syncHeroListFilterChipResidualDeepestSweep,
} from "@/net/heroListFilterChipResidualDeepest";
import {
  captureHeroListFilterChipResidualDeeper,
  formatHeroListFilterChipResidualDeeperSweepLine,
  readHeroListFilterChipResidualDeeperSession,
  syncHeroListFilterChipResidualDeeperSweep,
} from "@/net/heroListFilterChipResidualDeeper";
import {
  formatHeroListFilterChipResidualDeepSweepLine,
  readHeroListFilterChipResidualDeepSession,
  syncHeroListFilterChipResidualDeepSweep,
} from "@/net/heroListFilterChipResidualDeep";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep,
  skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeepestSweep,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeepestSweep";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestSweep,
  skimHeroDetailPanelStateResidualDeepestDeepestDeepestSweep,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestSweep";
import {
  appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep,
  skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeeperSweep,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeeperSweep";
import {
  appendHeroPanelStateResidualDeepestDeepestDeeperSweep,
  skimHeroDetailPanelStateResidualDeepestDeepestDeeperSweep,
} from "@/net/heroPanelStateResidualDeepestDeepestDeeperSweep";
import {
  appendHeroPanelStateResidualDeepestDeeperSweep,
  skimHeroDetailPanelStateResidualDeepestDeeperSweep,
} from "@/net/heroPanelStateResidualDeepestDeeperSweep";
import {
  appendHeroPanelStateResidualDeepestSweep,
  skimHeroDetailPanelStateResidualDeepestSweep,
} from "@/net/heroPanelStateResidualDeepestSweep";
import {
  appendHeroPanelStateResidualDeeperSweep,
  skimHeroDetailPanelStateResidualDeeperSweep,
} from "@/net/heroPanelStateResidualDeeperSweep";
import {
  appendHeroPanelStateResidualDeepSweep,
  skimHeroDetailPanelStateResidualDeepSweep,
} from "@/net/heroPanelStateResidualDeepSweep";
import {
  appendHeroPanelStateResidualSweep,
  skimHeroDetailPanelStateResidualSweep,
  type HeroPanelStateResidualContext,
} from "@/net/heroPanelStateResidualSweep";
import {
  applyMailClaimResult,
  syncMailRowAfterClaim,
  formatMailClaimGrantedSummary,
  filterHeroCultivationBagItemIds,
  heroListLines,
  mergeRecruitTemplateOwnership,
  parseGetHeroDetailResponse,
  renderHeroDetailMarkup,
  syncHeroSummaryFromDetail,
  syncHeroSummaryFromLargess,
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
  mailHasUnclaimedAttachments,
  upsertMailRow,
  mailIsUnread,
  mailTitle,
  parseRecruitTemplates,
  pickRecruitSelection,
  recruitTemplateListLines,
  heroTemplateLabel,
  type HeroDetail,
  type HeroSummary,
  type MailRow,
  type RecruitTemplatePreview,
} from "@/net/heroMailState";
import {
  formatMailFilterChips,
  formatMailRowCountBadge,
  mailRowAttachmentBadgeCount,
  mailRowShowsUnreadDot,
  readMailInboxFilterSession,
  writeMailInboxFilterSession,
} from "@/net/mailInboxFilter";
import {
  filterMailRowsForInboxTab,
  formatMailTabEmptyHint,
  mailInboxFilterToEmptyTab,
  resolveMailListPlayerMailFilter,
} from "@/net/mailInboxTabFormat";
import { mailPanelTabBadgeCounts, mailToolbarBadgeCount } from "@/net/hudTodoBadges";
import {
  MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE,
  MAIL_TAB_UNREAD_SWEEP_ROLE,
  formatMailTabUnreadSweepLine,
  mailInboxFilterToUnreadSweepTab,
  scheduleMailTabHudSyncPulse,
  setHudCenterPanelDeepLinkRefreshStamp,
} from "@/net/mailTabUnreadSweep";
import { formatMailPanelHudCombinedSweepLine } from "@/net/questClaimHudLink";
import {
  mailInboxEmptyListClass,
  mailInboxLoadErrorListHint,
  mailListRowClassName,
  mailRowMetaLine,
  mailRowTitleLine,
} from "@/net/panelDensity";
import { centerTodoScrollTargetId, pickFirstClaimableMailId } from "@/net/hudCenterTodo";
import { mailUnreadSnapshotFromListResponse, pickFirstUnreadMailId } from "@/net/hudTodoBadge";
import { TODO_SCROLL_TARGET_ATTR, scrollCenterTodoTarget } from "@/ui/centerTodoScroll";
import {
  appendMailWorldCoordStatusHint,
  mailPlainTextHasWorldCoord,
  resolveMailBattleReportLink,
} from "@/net/mailBattleCrossLink";
import {
  MAIL_BATTLE_CATEGORY_SWEEP_CLASS,
  MAIL_BATTLE_CATEGORY_SWEEP_ROLE,
  MAIL_BATTLE_CATEGORY_TABS,
  filterMailRowsByBattleCategory,
  formatMailBattleCategorySweepLine,
  mailBattleCategorySweepCounts,
  readMailBattleCategoryTabSession,
  writeMailBattleCategoryTabSession,
  type MailBattleCategoryTab,
} from "@/net/mailBattleCategory";
import {
  stageReportOutcomeFilterBridgeFromMail,
  takeMailReturnFromReportBridge,
} from "@/net/reportOutcomeFilterBridge";
import { createCenterPanelFocusTrap, type CenterPanelFocusTrap } from "@/ui/centerPanelFocusTrap";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import { ensureHeroDetailBustNameInScrollClip } from "@/ui/heroDetailScrollClip";
import {
  handleListRovingKeyDown,
  syncListRovingTabindex,
} from "@/ui/listRovingTabindex";
import {
  batchClaimSummary,
  orderBatchClaimMailIds,
  selectAllUnclaimedMailIds,
  validateBatchClaimMailSelection,
  validateClaimAllUnclaimedMail,
} from "@/net/mailBatchClaim";
import {
  findMailListRow,
  formatMailClaimSuccessLine,
  MAIL_CLAIM_ERROR_CLASS,
  type MailClaimGrantedPayload,
  scheduleMailClaimInlinePulse,
  scheduleMailClaimRowPulse,
} from "@/net/mailClaimFeedback";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeeperSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestDeeperSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestDeepestDeeperSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestDeeperSubline";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSubline";
import {
  pulseMailClaimHudSyncAfterClaimResidualDeepestDeepestDeepestDeepestDeeper,
  syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeepestDeepestDeeper,
} from "@/net/mailClaimHudBadgeSync";
import {
  compareRecruitAffordability,
  formatRecruitAffordabilitySummaryMarkup,
  recruitAffordabilityForTemplate,
  setRecruitAffordabilityErrorDisplay,
} from "@/net/recruitAffordability";
import { resolveHeroIdForRecruitTemplate } from "@/net/recruitHeroViewLink";
import {
  applyRecruitScrollAnchorSession,
  writeRecruitScrollAnchorSession,
} from "@/net/recruitScrollAnchor";
import { formatRecruitWalletSweepLine } from "@/net/recruitWalletSweep";
import {
  formatRecruitWalletCompareLine,
  syncRecruitWalletCompareLine,
} from "@/net/recruitWalletCompare";
import {
  formatRecruitWalletCompareResidualLine,
  syncRecruitWalletCompareResidualLine,
} from "@/net/recruitWalletCompareResidual";
import {
  formatRecruitTemplateInlineResidualDeepSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepSummary";
import {
  formatRecruitTemplateInlineResidualDeeperSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPER_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeeperSummary";
import {
  formatRecruitTemplateInlineResidualDeepestSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestSummary";
import {
  formatRecruitTemplateInlineResidualDeepestDeeperSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestDeeperSummary";
import {
  formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestDeepestDeeperSummary";
import {
  formatRecruitTemplateInlineResidualDeepestDeepestDeepestSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestDeepestDeepestSummary";
import {
  formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary";
import {
  formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary";
import {
  formatRecruitTemplateInlineResidualSummary,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_ROLE,
} from "@/net/recruitTemplateInlineResidualSummary";
import {
  buildRecruitItemGapBagDeepLink,
  formatRecruitFormInlineHint,
  syncRecruitFormInlineHintDisplay,
} from "@/net/recruitFormInlineHint";
import {
  buildRecruitSuccessFeedback,
  focusRecruitedHeroListRow,
  refreshRecruitWalletSweepDisplays,
  resolveRecruitSubmitPhase,
  scheduleRecruitWalletSweepPulse,
  setRecruitSuccessToastDisplay,
  syncRecruitSubmitButton,
  syncRecruitSubmittingLine,
  walletMaterialDeductPulseKeys,
} from "@/net/recruitSubmitFeedback";
import {
  renderHotelCandidateList,
  setHotelRecruitFormError,
  syncHotelListRefreshButton,
  syncHotelRecruitMeta,
  syncHotelRecruitPreview,
  syncHotelRefreshPoolButton,
  syncHotelRecruitSubmitButton,
} from "@/net/hotelRecruitPanel";
import {
  canAffordHotelCandidate,
  formatHotelRecruitGatewayError,
  formatHotelRefreshItemHint,
  parseHotelRecruitListResponse,
  type HotelRecruitCandidate,
  type HotelRecruitPoolMeta,
} from "@/net/hotelRecruitState";
import {
  renderCaptiveHeroList,
  setCaptiveHeroFormError,
  syncCaptiveListRefreshButton,
  syncCaptiveReleaseButton,
  syncCaptiveSummonButton,
  syncCaptiveSummonPreview,
} from "@/net/captiveHeroPanel";
import {
  canAffordCaptiveSummon,
  filterCaptivesForCity,
  formatCaptiveHeroGatewayError,
  parseListCaptiveHeroesResponse,
  parseTrySummonCaptiveResponse,
  type CaptiveHeroRow,
  type CaptiveSummonPreview,
} from "@/net/captiveHeroState";
import {
  renderPersuadeTargetList,
  setPersuadeFormError,
  syncPersuadeListRefreshButton,
  syncPersuadeMeta,
  syncPersuadePreview,
  syncPersuadePrimaryButton,
} from "@/net/persuadePanel";
import {
  formatPersuadeGatewayError,
  parsePersuadeTargetListResponse,
  resolvePersuadePrimaryAction,
  type PersuadeTarget,
} from "@/net/persuadeState";
import {
  renderComingHeroList,
  setComingHeroFormError,
  syncComingAcceptButton,
  syncComingAcceptPreview,
  syncComingListRefreshButton,
  syncComingRejectButton,
} from "@/net/comingHeroPanel";
import {
  canConfirmComingAccept,
  filterComingForCity,
  formatComingHeroGatewayError,
  parseListComingHeroesResponse,
  parseTryAcceptComingResponse,
  type ComingAcceptPreview,
  type ComingHeroRow,
} from "@/net/comingHeroState";
import {
  pickRestoredHeroId,
  readHeroDetailSelectedSession,
  writeHeroDetailSelectedSession,
} from "@/net/heroDetailSelectedSession";
import {
  scheduleHeroListRefreshPulse,
  scrollHeroListRowIntoView,
  setHeroListFormErrorDisplay,
  syncHeroListRefreshedAtDisplay,
  syncHeroListRefreshButton,
} from "@/net/heroListRefreshFeedback";
import {
  applyHeroPanelListScrollTop,
  readHeroListSelectedSession,
  readHeroPanelListScrollTop,
  writeHeroListSelectedSession,
} from "@/net/heroListSelectedSession";
import { scheduleHeroRowReturnHighlight } from "@/net/heroListReturnHighlight";
import {
  applyHeroListReturnScroll,
  captureHeroListReturnPayload,
  consumeHeroListReturnState,
  formatHeroDetailFromListHint,
  readHeroListReturnState,
  type HeroListReturnPayload,
  writeHeroListReturnState,
} from "@/net/heroListReturnState";
import {
  buildHeroBagDeepLinkQuery,
  pickHeroDetailBagDeepLink,
  type HeroBagDeepLinkQuery,
} from "@/net/heroDetailBagDeepLink";
import {
  renderHeroDetailStateErrorMarkup,
  renderHeroDetailStateLoadingMarkup,
} from "@/net/panelStateChrome";
import {
  formatHeroDetailCultivationUseStatus,
  formatHeroDetailStatChangeSummary,
  renderHeroDetailCultivationUseMarkup,
  scheduleHeroDetailStatPulse,
  setHeroCultivationFormErrorDisplay,
  setHeroCultivationSuccessDisplay,
  syncHeroDetailCultivationUseButton,
  validateHeroDetailCultivationUse,
} from "@/net/heroDetailCultivationUse";
import {
  formatHeroLargessGatewayErrorFromUnknown,
  formatHeroLargessSuccessStatus,
  largessGiftKindProto,
  parseLargessHeroResponse,
  pickDefaultLargessItemCfgId,
  renderHeroDetailLargessMarkup,
  setHeroLargessFormErrorDisplay,
  setHeroLargessSuccessDisplay,
  syncHeroDetailLargessCooldownDisplay,
  syncHeroDetailLargessSubmitButton,
  validateHeroDetailLargessSubmit,
  type HeroLargessGiftMode,
} from "@/net/heroDetailLargess";
import {
  applyHeroPointResultToDetail,
  buildAddHeroPointTargets,
  formatHeroPointAddSuccessStatus,
  formatHeroPointClearSuccessStatus,
  formatHeroPointGatewayErrorFromUnknown,
  heroPointSnapshotFromDetail,
  mergeHeroPointSnapshot,
  renderHeroDetailPointsMarkup,
  setHeroPointFormErrorDisplay,
  setHeroPointSuccessDisplay,
  syncHeroDetailPointsControls,
  type HeroPointAllocStat,
} from "@/net/heroDetailPoints";
import {
  applyRestHeroToDetail,
  formatHeroForceGatewayErrorFromUnknown,
  formatHeroRestSuccessStatus,
  persistHeroMarchForceFromDetail,
  renderHeroDetailForceMarkup,
  setHeroForceFormErrorDisplay,
  setHeroForceSuccessDisplay,
  syncHeroDetailForceControls,
} from "@/net/heroDetailForce";
import {
  applyUpgradeHeroToDetail,
  formatHeroUpgradeGatewayErrorFromUnknown,
  formatHeroUpgradeSuccessStatus,
  renderHeroDetailUpgradeMarkup,
  setHeroUpgradeFormErrorDisplay,
  setHeroUpgradeSuccessDisplay,
  syncHeroDetailUpgradeButton,
} from "@/net/heroDetailUpgrade";
import {
  applyBeginHeroExprToDetail,
  applyCancelHeroExprToDetail,
  applyHeroExprFinishToDetail,
  formatHeroExprBeginSuccessStatus,
  formatHeroExprCancelSuccessStatus,
  formatHeroExprFasterSuccessStatus,
  formatHeroExprFinishSuccessStatus,
  formatHeroExprGatewayErrorFromUnknown,
  heroExprSnapshotFromDetail,
  isHeroExprInProgress,
  mergeHeroExprSnapshot,
  normalizeHeroExprHours,
  renderHeroDetailExprMarkup,
  setHeroExprFormErrorDisplay,
  setHeroExprSuccessDisplay,
  syncHeroDetailExprControls,
} from "@/net/heroDetailExpr";
import {
  formatBagUseGatewayErrorFromUnknown,
  type UseConsumableSubmitState,
  useConsumableSubmitStateMachine,
} from "@/net/useConsumableSubmitFeedback";
import {
  mountHeroDetailBust,
  mountHeroListAvatar,
} from "@/engine/heroPortraitFrameSkin";

export class HeroMailPanels {
  private heroPanel!: HTMLElement;
  private mailPanel!: HTMLElement;
  private heroes: HeroSummary[] = [];
  private mails: MailRow[] = [];
  /** filter=all 首屏快照，供 tab 角标与 HUD 可领附件计数（与 CLIENT-077 列表推导一致）。 */
  private mailInboxSnapshot: MailRow[] = [];
  /** ListPlayerMail unread 的 total_count，与底栏 CLIENT-050 一致。 */
  private mailUnreadTotal = 0;
  /** `ListPlayerMail` filter=未读 首条 id（与 `mailUnreadTotal` 同源轮询）。 */
  private mailUnreadFirstId = 0;
  /** CLIENT-134：角标深链打开面板前，筛选 chip 数字与 `HudTodoDeepLinkSnapshot` 对齐。 */
  private mailFilterTabCountOverride: { unreadForTab: number; unclaimedCount: number } | null = null;
  private mailFilter = MAIL_INBOX_FILTER_ALL;
  private mailBattleCategory: MailBattleCategoryTab = "system";
  /** 最近一次 ListPlayerMail 页（收件箱 filter 应用前），供战报/系统 tab 切换本地过滤。 */
  private mailListRpcPage: MailRow[] = [];
  private mailListError = "";
  private mailListLoading = false;
  private heroListLoadError: string | null = null;
  private heroListFilter: HeroListFilter = "all";
  private heroListSort: HeroListSort = "level_desc";
  private selectedHeroId = 0;
  private selectedMailId = 0;
  private heroDetail: HeroDetail | null = null;
  private heroDetailLoading = false;
  private heroDetailError: string | null = null;
  private recruitTemplates: RecruitTemplatePreview[] = [];
  private selectedTemplateId = 0;
  private recruitItemId = 0;
  private recruitPool = "standard";
  private claimMailInflight = 0;
  private mailBatchSelected = new Set<number>();
  private mailBatchClaimFailedIds = new Set<number>();
  /** CLIENT-192：单封领取详情行内成功文案（按 mail_id 记忆，切换邮件仍可见）。 */
  private mailClaimSuccessLineByMailId = new Map<number, string>();
  /** CLIENT-255：列表行附件领取残余次行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualSublineByMailId = new Map<number, string>();
  /** CLIENT-271：列表行附件领取残余加深次行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepSublineByMailId = new Map<number, string>();
  /** CLIENT-287：列表行附件领取残余巩固再加深第三行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeeperSublineByMailId = new Map<number, string>();
  /** CLIENT-303：列表行附件领取残余巩固再加深一层第四行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepestSublineByMailId = new Map<number, string>();
  /** CLIENT-319：列表行附件领取残余巩固再加深二层第五行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepestDeeperSublineByMailId = new Map<number, string>();
  /** CLIENT-335：列表行附件领取残余巩固再加深三层第六行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepestDeepestDeeperSublineByMailId = new Map<number, string>();
  private mailAttachmentClaimResidualDeepestDeepestDeepestSublineByMailId = new Map<
    number,
    string
  >();
  /** CLIENT-367：列表行附件领取残余巩固再加深五层第八行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepestDeepestDeepestDeeperSublineByMailId = new Map<
    number,
    string
  >();
  /** CLIENT-383：列表行附件领取残余巩固再加深五层第九行（按 mail_id 记忆）。 */
  private mailAttachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSublineByMailId = new Map<
    number,
    string
  >();
  private mailClaimInlinePulseMailId = 0;
  /** CLIENT-209：与 HUD 深链轮询同源的日常 chain 400 快照（只读扫读，无新 RPC）。 */
  private mailHudTodoDailyRows: DailyQuestRow[] = [];
  private mailHudTodoRefreshStamp = 0;
  private mailHudTodoPulsePending = false;
  private recruitHeroInflight = false;
  private recruitLastError: string | null = null;
  private recruitLastSuccessHeroId: number | null = null;
  private hotelCandidates: HotelRecruitCandidate[] = [];
  private hotelMeta: HotelRecruitPoolMeta = {};
  private selectedHotelCandidateId = 0;
  private hotelListInflight = false;
  private hotelRefreshInflight = false;
  private hotelRecruitInflight = false;
  private captiveHeroesAll: CaptiveHeroRow[] = [];
  private captiveHeroes: CaptiveHeroRow[] = [];
  private selectedCaptiveHeroId = 0;
  private captiveSummonPreview: CaptiveSummonPreview | null = null;
  private captiveListInflight = false;
  private captiveTryInflight = false;
  private captivePreviewRequest = 0;
  private captiveSummonInflight = false;
  private captiveReleaseInflight = false;
  private persuadeTargets: PersuadeTarget[] = [];
  private selectedPersuadeNpcId = 0;
  private persuadeListInflight = false;
  private persuadePrimaryInflight = false;
  private comingHeroesAll: ComingHeroRow[] = [];
  private comingHeroes: ComingHeroRow[] = [];
  private selectedComingHeroId = 0;
  private comingAcceptPreview: ComingAcceptPreview | null = null;
  private comingListInflight = false;
  private comingTryInflight = false;
  private comingPreviewRequest = 0;
  private comingAcceptInflight = false;
  private comingRejectInflight = false;
  private heroesRefreshInflight = false;
  private heroListLastRefreshedAtMs = 0;
  /** CLIENT-199：自列表打开详情时保留筛选摘要；返回列表后清空。 */
  private heroDetailListContext: Pick<HeroListReturnPayload, "filter" | "sort"> | null = null;
  /** CLIENT-199：返回列表后折叠详情区，行高亮仍由 selectedHeroId 驱动。 */
  private heroDetailCollapsed = false;
  private heroCultivationSubmitState: UseConsumableSubmitState = "idle";
  private heroLargessSubmitState: UseConsumableSubmitState = "idle";
  private heroLargessGiftMode: HeroLargessGiftMode = "gold";
  private heroLargessItemCfgId: number | null = null;
  private heroLargessNextAtByHeroId = new Map<number, number>();
  private heroLargessCooldownTimer: ReturnType<typeof setInterval> | null = null;
  private heroUpgradeSubmitState: UseConsumableSubmitState = "idle";
  private heroPointSubmitState: UseConsumableSubmitState = "idle";
  private heroForceSubmitState: UseConsumableSubmitState = "idle";
  private heroPointSnapshotByHeroId = new Map<
    number,
    ReturnType<typeof heroPointSnapshotFromDetail>
  >();
  private heroExprSubmitState: UseConsumableSubmitState = "idle";
  private heroExprHoursPref = 1;
  private heroExprSnapshotByHeroId = new Map<
    number,
    ReturnType<typeof heroExprSnapshotFromDetail>
  >();
  private heroExprCountdownTimer: ReturnType<typeof setInterval> | null = null;
  private heroFocusTrap: CenterPanelFocusTrap | null = null;
  private readonly onHeroListKeyDown = (ev: KeyboardEvent) => this.onHeroPanelListKeyDown(ev);

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private onUnreadCount?: (count: number) => void,
    private readonly cityStateFetch?: CityStateFetch,
    private readonly onDailyRecruitLoop?: () => void | Promise<void>,
    private readonly onMailHudSnapshot?: (snap: { count: number; firstId: number }) => void,
    private readonly onMailInboxSnapshot?: (mails: MailRow[], mailUnreadTotal: number) => void,
    private readonly onOpenBattleReport?: (reportId: number | null) => void | Promise<void>,
    private readonly onOpenHeroCultivationBag?: (link: HeroBagDeepLinkQuery) => void,
    private readonly onRecruitMaterialPulse?: (keys: (keyof ResourceWallet)[]) => void,
    private readonly assets?: AssetLoader,
    private readonly dismissHeroToolbarTrigger?: () => HTMLElement | null,
  ) {}

  attach(): void {
    this.mailFilter = readMailInboxFilterSession() ?? MAIL_INBOX_FILTER_ALL;
    this.mailBattleCategory = readMailBattleCategoryTabSession();
    this.heroListFilter = readHeroListFilterSession();
    this.heroListSort = readHeroListSortSession();
    if (!readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession()) {
      captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(this.heroListFilter, this.heroListSort);
    }
    this.heroPanel = this.buildHeroPanel();
    this.mailPanel = this.buildMailPanel();
    this.mount.appendChild(this.heroPanel);
    if (this.heroPanel.closest(".layout-narrow")) {
      this.heroPanel.querySelectorAll<HTMLDetailsElement>(".hero-capture-info").forEach((el) => { el.open = false; });
    }
    this.mount.appendChild(this.mailPanel);
    this.heroPanel.addEventListener("click", (ev) => this.onHeroClick(ev));
    this.mailPanel.addEventListener("click", (ev) => this.onMailClick(ev));
    this.heroPanel.addEventListener("change", (ev) => this.onHeroChange(ev));
    this.mailPanel.addEventListener("change", (ev) => this.onMailChange(ev));
    this.heroPanel.addEventListener("keydown", this.onHeroListKeyDown);
    this.heroFocusTrap = createCenterPanelFocusTrap(this.heroPanel, () => this.closeHeroFromKeyboard());
  }

  detach(): void {
    ++this.recruitBagGeneration;
    this.recruitBagRequest = null;
    this.recruitBagKey = null;
    this.clearHeroLargessCooldownTimer();
    this.heroPanel?.removeEventListener("keydown", this.onHeroListKeyDown);
    this.heroFocusTrap?.dispose();
    this.heroFocusTrap = null;
    this.heroPanel?.remove();
    this.mailPanel?.remove();
  }

  private closeHeroFromKeyboard(): void {
    this.heroPanel.classList.add("hidden");
  }

  private syncHeroPanelFocusTrap(): void {
    const open = !this.heroPanel.classList.contains("hidden");
    if (open) {
      this.heroFocusTrap?.setOpen(true, this.dismissHeroToolbarTrigger?.() ?? null);
    } else {
      this.heroFocusTrap?.setOpen(false, null, true);
    }
  }

  private onHeroPanelListKeyDown(ev: KeyboardEvent): void {
    if (this.heroPanel.classList.contains("hidden")) return;
    const ul = this.heroPanel.querySelector<HTMLElement>('[data-role="hero-list"]');
    if (!ul) return;
    handleListRovingKeyDown(ev, ul, {
      itemSelector: "li[data-hero-id]",
      onActivate: (row) => {
        const id = Number(row.getAttribute("data-hero-id"));
        if (id > 0) void this.loadHeroDetail(id, { fromHeroList: true });
      },
    });
  }

  /** 会话钱包/背包变更时刷新招募可负担对比（与 HUD 快照一致）。 */
  refreshRecruitAffordability(): void {
    if (!this.heroPanel || this.heroPanel.classList.contains("hidden")) return;
    this.renderTemplateList();
    this.renderHeroList();
    this.syncHotelRecruitUi();
    this.syncCaptiveHeroUi();
    this.syncPersuadeUi();
    this.syncComingHeroUi();
  }

  private recruitBagKey: string | null = null;
  private recruitBagRequest: { key: string; promise: Promise<void> } | null = null;
  private recruitBagError: string | null = null;
  private recruitBagGeneration = 0;

  private recruitSessionKey(): string | null {
    const session = this.getSession();
    return session ? `${session.serverId}:${session.player?.player_id}:${session.cityId}` : null;
  }

  private recruitBagReady(): boolean {
    return this.recruitBagKey !== null && this.recruitBagKey === this.recruitSessionKey();
  }

  /** Unknown inventory must never be presented as an empty inventory. */
  private ensureRecruitBag(): Promise<void> {
    const key = this.recruitSessionKey();
    if (!key || this.recruitBagReady()) return Promise.resolve();
    if (this.recruitBagRequest?.key === key) return this.recruitBagRequest.promise;
    const generation = ++this.recruitBagGeneration;
    const sid = this.serverId();
    this.recruitBagError = null;
    const promise = (async () => {
      try {
        const res = await Promise.resolve().then(() => this.gateway.listPlayerBag(sid)) as {
          items?: { item_cfg_id?: number; quantity?: number }[];
        };
        if (generation !== this.recruitBagGeneration || key !== this.recruitSessionKey() ||
            this.heroPanel.classList.contains("hidden")) return;
        this.recruitBagKey = key;
        this.onSessionPatch({ bag: bagFromListPlayerBagResponse(res.items) });
      } catch {
        if (generation !== this.recruitBagGeneration || key !== this.recruitSessionKey()) return;
        this.recruitBagError = "背包加载失败，请重试";
      } finally {
        if (generation === this.recruitBagGeneration) {
          this.recruitBagRequest = null;
          if (!this.heroPanel.classList.contains("hidden")) this.renderTemplateList();
        }
      }
    })();
    this.recruitBagRequest = { key, promise };
    this.renderTemplateList();
    return promise;
  }

  private sessionEconomy(): { wallet: ResourceWallet; bag: BagStack[] } {
    const session = this.getSession();
    return { wallet: session?.wallet ?? {}, bag: session?.bag ?? [] };
  }

  private setMailFormError(message: string | null): void {
    const el = this.mailPanel?.querySelector('[data-role="mail-form-error"]');
    if (!el) return;
    if (message?.trim()) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  private pruneMailBatchSelection(): void {
    const valid = new Set(
      this.mails
        .filter(mailHasUnclaimedAttachments)
        .map((m) => m.mail_id ?? 0)
        .filter((id) => id > 0),
    );
    for (const id of this.mailBatchSelected) {
      if (!valid.has(id)) this.mailBatchSelected.delete(id);
    }
  }

  private syncBatchClaimButton(): void {
    const batchBtn = this.mailPanel?.querySelector(
      '[data-action="claim-mail-batch"]',
    ) as HTMLButtonElement | null;
    const allBtn = this.mailPanel?.querySelector(
      '[data-action="claim-mail-all"]',
    ) as HTMLButtonElement | null;
    const hasPick = orderBatchClaimMailIds(this.mails, this.mailBatchSelected).length > 0;
    const hasAll = selectAllUnclaimedMailIds(this.mails).length > 0;
    const inflight = this.claimMailInflight !== 0;
    if (batchBtn) batchBtn.disabled = inflight || !hasPick;
    if (allBtn) allBtn.disabled = inflight || !hasAll;
  }

  private withMailWorldCoordHint(baseStatus: string, mail: MailRow | null): string {
    if (!mail) return baseStatus;
    if (mailPlainTextHasWorldCoord(mailTitle(mail), mail.body ?? "")) {
      return appendMailWorldCoordStatusHint(baseStatus);
    }
    return baseStatus;
  }

  private selectedRecruitTemplateRow(): RecruitTemplatePreview | undefined {
    return this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === this.selectedTemplateId);
  }

  private recruitAffordSummaryForHeroDetail(): string {
    if (!this.recruitBagReady()) return this.recruitBagError ?? "正在加载背包…";
    const tplId = this.heroDetail?.template_cfg_id;
    if (!tplId) return "";
    const template = this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === tplId);
    if (!template) return "";
    const { wallet, bag } = this.sessionEconomy();
    return formatRecruitAffordabilitySummaryMarkup(template, wallet, bag);
  }

  private recruitTemplateForHeroDetail(): RecruitTemplatePreview | undefined {
    const tplId = this.heroDetail?.template_cfg_id;
    if (!tplId) return undefined;
    return this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === tplId);
  }

  getMailRoot(): HTMLElement {
    return this.mailPanel;
  }

  /** 面板根挂载后由 MainCityScene 调用；列表重绘时内部也会刷新。 */
  mountMailFilterSkins(assets?: AssetLoader): void {
    const loader = assets ?? this.assets;
    if (!loader || !this.mailPanel) return;
    this.syncMailFilterChipDom(loader);
    mountFilterRows(this.mailPanel, loader);
    this.mountMailListRowSkins(loader);
    remountPanelFilterChips(this.mailPanel, loader);
  }

  /** CLIENT-230：`ui.panel.hero.v1` 壳挂载 + CLIENT-129 panelState 扫读。 */
  mountHeroPanelArtShell(assets?: AssetLoader): void {
    const loader = assets ?? this.assets;
    if (!loader || !this.heroPanel) return;
    mountHeroPanelArtRuntime(this.heroPanel, loader, 520, 320);
    this.syncHeroListFilterChipDom(loader);
    remountPanelFilterChips(this.heroPanel, loader);
  }

  /** CLIENT-151：将领列表筛选 chip（CLIENT-121）；列表重绘时内部也会刷新。 */
  mountHeroListFilterSkins(assets?: AssetLoader): void {
    const loader = assets ?? this.assets;
    if (!loader || !this.heroPanel) return;
    this.syncHeroListFilterChipDom(loader);
    remountPanelFilterChips(this.heroPanel, loader);
    skimHeroPanelStateChrome(this.heroPanel, loader);
  }

  getHeroRoot(): HTMLElement {
    return this.heroPanel;
  }

  toggleHero(): void {
    toggleCenterPanel(this.heroPanel);
    if (!this.heroPanel.classList.contains("hidden")) {
      this.recruitBagKey = null;
      void this.ensureRecruitBag();
      void this.refreshRecruitTemplates();
      void this.refreshHeroes({ restoreSelection: true });
      void this.refreshHotelCandidates();
      void this.refreshCaptiveHeroes();
      void this.refreshPersuadeTargets();
      void this.refreshComingHeroes();
    }
    this.syncHeroPanelFocusTrap();
  }

  /** CLIENT-097：排行深链 — 打开将领面板并 GetHeroDetail（只读）。 */
  async openHeroDetailDeepLink(heroId: number): Promise<void> {
    this.mailPanel.classList.add("hidden");
    openCenterPanel(this.heroPanel);
    void this.ensureRecruitBag();
    resetCenterPanelViewportScroll(this.heroPanel);
    if (!this.heroes.length) await this.refreshHeroes();
    let id = heroId;
    if (id <= 0) {
      id = this.heroes.find((h) => (h.hero_id ?? 0) > 0)?.hero_id ?? 0;
    }
    if (id <= 0) {
      this.renderHeroList();
      this.onStatus("暂无将领可查看");
      return;
    }
    await this.loadHeroDetail(id);
    this.syncHeroPanelFocusTrap();
  }

  isMailOpen(): boolean {
    return this.mailPanel != null && !this.mailPanel.classList.contains("hidden");
  }

  toggleMail(): void {
    toggleCenterPanel(this.mailPanel);
    if (!this.mailPanel.classList.contains("hidden")) {
      resetCenterPanelViewportScroll(this.mailPanel);
      this.onUnreadCount?.(0);
      void this.refreshMail();
    } else void this.syncUnreadBadge();
  }

  /** 仅打开邮件面板（不 toggle 关闭）。 */
  openMailPanel(): void {
    if (this.isMailOpen()) return;
    openCenterPanel(this.mailPanel);
    resetCenterPanelViewportScroll(this.mailPanel);
    this.onUnreadCount?.(0);
    void this.refreshMail();
  }

  /** 战报深链：打开收件箱并高亮指定邮件（不自动领取附件）。 */
  openAndHighlightMail(mailId: number): void {
    openCenterPanel(this.mailPanel);
    resetCenterPanelViewportScroll(this.mailPanel);
    this.onUnreadCount?.(0);
    const mailReturn = takeMailReturnFromReportBridge();
    if (mailReturn) {
      this.mailBattleCategory = mailReturn.categoryTab;
      writeMailBattleCategoryTabSession(this.mailBattleCategory);
      this.mailFilter = mailReturn.inboxFilter;
      writeMailInboxFilterSession(this.mailFilter);
      if (mailReturn.selectedMailId && mailReturn.selectedMailId > 0) {
        this.selectedMailId = mailReturn.selectedMailId;
      }
    } else {
      this.mailFilter = MAIL_INBOX_FILTER_ALL;
      writeMailInboxFilterSession(this.mailFilter);
    }
    if (mailId > 0) this.selectedMailId = mailId;
    void this.refreshMail().then(() => this.focusHighlightedMail(mailId));
  }

  /** 战报深链：打开将领面板并加载详情（CLIENT-100）。 */
  openAndHighlightHero(heroId: number): void {
    if (!heroId) return;
    openCenterPanel(this.heroPanel);
    resetCenterPanelViewportScroll(this.heroPanel);
    this.selectedHeroId = heroId;
    void this.refreshHeroes().then(() => {
      void this.loadHeroDetail(heroId).then(() => {
        scrollHeroListRowIntoView(this.heroPanel, heroId);
      });
    });
  }

  /** 将领列表快照（战报互链等只读用途，不发 RPC）。 */
  getHeroesSnapshot(): HeroSummary[] {
    return [...this.heroes];
  }

  private async focusHighlightedMail(mailId: number): Promise<void> {
    if (mailId <= 0 || !this.mails.some((m) => m.mail_id === mailId)) return;
    await this.openMail(mailId);
    const row = this.mailPanel.querySelector(`li[data-mail-id="${mailId}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }

  /** 待办角标深链：打开筛选并选中首条目标（id/filter 来自 `resolveHudTodoOpenTarget`）。 */
  openFromTodoBadge(
    preferredMailId = 0,
    opts?: {
      mailFilter?: typeof MAIL_INBOX_FILTER_ALL | typeof MAIL_INBOX_FILTER_UNREAD;
      filterTabCounts?: { unreadForTab: number; unclaimedCount: number };
    },
  ): void {
    openCenterPanel(this.mailPanel);
    resetCenterPanelViewportScroll(this.mailPanel);
    this.onUnreadCount?.(0);
    const mailFilter = opts?.mailFilter ?? MAIL_INBOX_FILTER_UNREAD;
    this.mailFilterTabCountOverride = opts?.filterTabCounts ?? null;
    this.mailFilter = mailFilter;
    writeMailInboxFilterSession(this.mailFilter);
    if (preferredMailId > 0) this.selectedMailId = preferredMailId;
    void this.refreshMail().then(() => {
      this.mailFilterTabCountOverride = null;
      if (mailFilter === MAIL_INBOX_FILTER_UNREAD) {
        void this.focusFirstUnreadMail(preferredMailId);
        return;
      }
      const pickId =
        preferredMailId > 0 && this.mails.some((m) => m.mail_id === preferredMailId)
          ? preferredMailId
          : pickFirstClaimableMailId(this.mails);
      if (pickId <= 0) return;
      void this.openMail(pickId).then(() => {
        const row = this.mailPanel.querySelector(`li[data-mail-id="${pickId}"]`);
        row?.scrollIntoView?.({ block: "nearest" });
      });
    });
  }

  /** CLIENT-077：顶栏待办聚合深链 — 首封可领附件邮件。 */
  openFromCenterTodoClaimable(
    preferredMailId = 0,
    opts?: { skipScroll?: boolean },
  ): boolean {
    const wasOpen = this.isMailOpen();
    openCenterPanel(this.mailPanel);
    this.mailFilter = MAIL_INBOX_FILTER_ALL;
    writeMailInboxFilterSession(this.mailFilter);
    if (preferredMailId > 0) this.selectedMailId = preferredMailId;
    void this.refreshMail().then(() => {
      const pickId =
        preferredMailId > 0 && this.mails.some((m) => m.mail_id === preferredMailId)
          ? preferredMailId
          : pickFirstClaimableMailId(this.mails);
      if (!pickId) return;
      void this.openMail(pickId).then(() => {
        if (opts?.skipScroll) return;
        scrollCenterTodoTarget(
          this.mailPanel,
          centerTodoScrollTargetId("mail", pickId),
        );
      });
    });
    return wasOpen;
  }

  private async focusFirstUnreadMail(preferredMailId: number): Promise<void> {
    const fromList = pickFirstUnreadMailId(this.mails);
    const pickId =
      preferredMailId > 0 && this.mails.some((m) => m.mail_id === preferredMailId)
        ? preferredMailId
        : fromList;
    if (!pickId) return;
    await this.openMail(pickId);
    const row = this.mailPanel.querySelector(`li[data-mail-id="${pickId}"]`);
    row?.scrollIntoView?.({ block: "nearest" });
  }

  /** 底栏角标：拉取未读 total_count（与列表 filter 无关）。 */
  async syncUnreadBadge(): Promise<void> {
    if (this.isMailOpen()) {
      this.onUnreadCount?.(0);
      return;
    }
    if (!this.onUnreadCount) return;
    const snap = await this.pullMailUnreadSnapshot();
    this.onUnreadCount(snap.count);
  }

  private async pullMailUnreadSnapshot(): Promise<{ count: number; firstId: number }> {
    const sid = this.serverId();
    if (!sid) return { count: 0, firstId: 0 };
    try {
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: MAIL_INBOX_FILTER_UNREAD,
        pageSize: 1,
        pageOffset: 0,
      })) as { mails?: MailRow[]; total_count?: number };
      return mailUnreadSnapshotFromListResponse(res);
    } catch {
      return { count: 0, firstId: 0 };
    }
  }

  private applyMailUnreadHud(snap: { count: number; firstId: number }): void {
    this.onMailHudSnapshot?.(snap);
    this.onUnreadCount?.(this.isMailOpen() ? 0 : snap.count);
  }

  private pulseMailRowAfterClaim(mailId: number): void {
    if (!this.mailPanel) return;
    const row = findMailListRow(this.mailPanel, mailId);
    scheduleMailClaimRowPulse(row);
    pulseMailClaimHudSyncAfterClaimResidualDeepestDeepestDeepestDeepestDeeper(row);
    this.bumpMailClaimHudTodoSweepLinkage();
  }

  /** CLIENT-241：领取成功后刷新邮件面板 HUD 扫读行并触发 mail-tab-hud-sync-pulse。 */
  private bumpMailClaimHudTodoSweepLinkage(): void {
    if (!this.isMailOpen()) return;
    this.mailHudTodoRefreshStamp = Date.now();
    this.mailHudTodoPulsePending = true;
    this.syncMailHudTodoSweepDom();
  }

  private applyHudMailQuestBadgeAfterClaim(
    mailId: number,
    rowAfter: MailRow,
    granted?: MailClaimGrantedPayload,
    mailBeforeClaim?: MailRow,
  ): void {
    const sync = syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeepestDeepestDeeper(
      {
        mailUnreadTotal: this.mailUnreadTotal,
        mailInboxSnapshot: this.mailInboxSnapshot,
        dailyChainRows: this.mailHudTodoDailyRows,
      },
      mailId,
      rowAfter,
      mailInboxFilterToUnreadSweepTab(this.mailFilter),
      granted,
      mailBeforeClaim,
    );
    this.mailInboxSnapshot = sync.mailInboxSnapshot;
    if (sync.attachmentClaimResidualSubline && mailId > 0) {
      this.mailAttachmentClaimResidualSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepSubline,
      );
    }
    if (sync.attachmentClaimResidualDeeperSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeeperSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeeperSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestDeeperSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestDeeperSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestDeeperSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestDeepestDeeperSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestDeepestDeeperSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestDeepestDeeperSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestDeepestDeepestSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestDeepestDeepestSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestDeepestDeepestSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestDeepestDeepestDeeperSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestDeepestDeepestDeeperSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestDeepestDeepestDeeperSubline,
      );
    }
    if (sync.attachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSubline && mailId > 0) {
      this.mailAttachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSublineByMailId.set(
        mailId,
        sync.attachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSubline,
      );
    }
  }

  private syncMailClaimInlineFeedback(mailId: number): void {
    const el = this.mailPanel?.querySelector<HTMLElement>('[data-role="mail-claim-inline"]');
    if (!el) return;
    const line = mailId > 0 ? this.mailClaimSuccessLineByMailId.get(mailId) : undefined;
    const show = !!line;
    el.textContent = line ?? "";
    el.classList.toggle("hidden", !show);
    if (show && this.mailClaimInlinePulseMailId === mailId) {
      this.mailClaimInlinePulseMailId = 0;
      scheduleMailClaimInlinePulse(el);
    }
  }

  private rememberMailClaimInlineSuccess(mailId: number, granted?: MailClaimGrantedPayload): void {
    this.mailClaimSuccessLineByMailId.set(mailId, formatMailClaimSuccessLine(granted));
    this.mailClaimInlinePulseMailId = mailId;
  }

  /** HERO-HOST: collapse recruit/hotel chrome while detail is open (1280 scroll viewport). */
  private syncHeroRecruitHostExpanded(): void {
    const host = this.heroPanel?.querySelector<HTMLDetailsElement>('[data-role="hero-recruit-host"]');
    if (!host) return;
    const detailPaneOpen =
      this.selectedHeroId > 0 &&
      !this.heroDetailCollapsed &&
      !this.heroDetailLoading &&
      !this.heroDetailError &&
      !!this.heroDetail;
    host.open = !detailPaneOpen;
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private cityId(): number {
    return this.getSession()?.cityId ?? 0;
  }

  private selectedHotelCandidate(): HotelRecruitCandidate | undefined {
    return this.hotelCandidates.find((c) => c.candidate_id === this.selectedHotelCandidateId);
  }

  private applyHotelPoolPayload(res: unknown, opts?: { keepSelection?: boolean }): void {
    const { candidates, meta } = parseHotelRecruitListResponse(res);
    this.hotelCandidates = candidates;
    this.hotelMeta = meta;
    if (!opts?.keepSelection || !candidates.some((c) => c.candidate_id === this.selectedHotelCandidateId)) {
      this.selectedHotelCandidateId = candidates[0]?.candidate_id ?? 0;
    }
    this.syncHotelRecruitUi();
  }

  private syncHotelRecruitUi(): void {
    const { wallet, bag } = this.sessionEconomy();
    const refreshHint = formatHotelRefreshItemHint(bag);
    syncHotelRecruitMeta(this.heroPanel, this.hotelMeta);
    renderHotelCandidateList(this.heroPanel, this.hotelCandidates, this.selectedHotelCandidateId);
    syncHotelRecruitPreview(this.heroPanel, this.selectedHotelCandidate(), wallet, refreshHint);
    const afford = canAffordHotelCandidate(this.selectedHotelCandidate(), wallet, this.hotelMeta);
    syncHotelListRefreshButton(this.heroPanel, this.hotelListInflight);
    syncHotelRefreshPoolButton(this.heroPanel, this.hotelRefreshInflight, bag);
    syncHotelRecruitSubmitButton(
      this.heroPanel,
      this.hotelRecruitInflight,
      afford.ok && (this.selectedHotelCandidateId ?? 0) > 0,
    );
  }

  private async refreshHotelCandidates(): Promise<void> {
    if (this.hotelListInflight) return;
    const sid = this.serverId();
    const cityId = this.cityId();
    if (!cityId) {
      setHotelRecruitFormError(this.heroPanel, "尚未进入城池，无法拉取客栈列表");
      return;
    }
    this.hotelListInflight = true;
    setHotelRecruitFormError(this.heroPanel, null);
    this.syncHotelRecruitUi();
    this.onStatus("拉取客栈候选…");
    try {
      const res = await this.gateway.listHotelRecruitCandidates(sid, cityId);
      this.applyHotelPoolPayload(res);
      this.onStatus(`客栈候选 ${this.hotelCandidates.length} 名`);
    } catch (e) {
      const msg = formatHotelRecruitGatewayError(e);
      setHotelRecruitFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.hotelListInflight = false;
      this.syncHotelRecruitUi();
    }
  }

  private async refreshHotelPool(): Promise<void> {
    if (this.hotelRefreshInflight) return;
    const sid = this.serverId();
    const cityId = this.cityId();
    if (!cityId) {
      setHotelRecruitFormError(this.heroPanel, "尚未进入城池，无法刷新客栈池");
      return;
    }
    this.hotelRefreshInflight = true;
    setHotelRecruitFormError(this.heroPanel, null);
    this.syncHotelRecruitUi();
    this.onStatus("访贤刷新客栈池…");
    try {
      const res = await this.gateway.refreshHotelRecruitPool(sid, cityId);
      this.applyHotelPoolPayload(res);
      await this.syncEconomyAfterRecruit();
      this.onStatus(`客栈池已刷新（${this.hotelCandidates.length} 名候选）`);
    } catch (e) {
      const msg = formatHotelRecruitGatewayError(e);
      setHotelRecruitFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.hotelRefreshInflight = false;
      this.syncHotelRecruitUi();
    }
  }

  private async recruitHotelCandidate(): Promise<void> {
    if (this.hotelRecruitInflight) return;
    const candidate = this.selectedHotelCandidate();
    const { wallet } = this.sessionEconomy();
    const afford = canAffordHotelCandidate(candidate, wallet, this.hotelMeta);
    if (!afford.ok) {
      setHotelRecruitFormError(this.heroPanel, afford.reason ?? "无法招入");
      this.onStatus(afford.reason ?? "无法招入");
      return;
    }
    const sid = this.serverId();
    const cityId = this.cityId();
    const candidateId = candidate?.candidate_id ?? 0;
    if (!cityId || !candidateId) {
      setHotelRecruitFormError(this.heroPanel, "请先选择客栈候选");
      return;
    }
    this.hotelRecruitInflight = true;
    setHotelRecruitFormError(this.heroPanel, null);
    this.syncHotelRecruitUi();
    this.onStatus(`招入 ${candidate?.display_name ?? "候选"}…`);
    try {
      const res = (await this.gateway.recruitHotelCandidate(sid, cityId, candidateId)) as {
        hero_id?: number;
        display_name?: string;
      };
      await this.syncEconomyAfterRecruit();
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        writeHeroDetailSelectedSession(res.hero_id);
      }
      await this.refreshHeroes();
      if (res.hero_id) focusRecruitedHeroListRow(this.heroPanel, res.hero_id);
      const listRes = await this.gateway.listHotelRecruitCandidates(sid, cityId);
      this.applyHotelPoolPayload(listRes, { keepSelection: false });
      const name = res.display_name?.trim() || candidate?.display_name || "新将领";
      this.onStatus(`已招入 ${name}${res.hero_id ? `（#${res.hero_id}）` : ""}`);
    } catch (e) {
      const msg = formatHotelRecruitGatewayError(e);
      setHotelRecruitFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.hotelRecruitInflight = false;
      this.syncHotelRecruitUi();
    }
  }

  private syncCaptureDisclosure(role: string, name?: string): void {
    const summary = this.heroPanel.querySelector<HTMLElement>(`[data-role="${role}"] .hero-capture-info > summary`);
    if (summary) {
      summary.textContent = `目标与费用：${name || "未选择"}`;
      summary.title = summary.textContent;
      summary.setAttribute("aria-label", `${summary.closest("section")?.getAttribute("aria-label") || ""}：${summary.textContent}`);
    }
  }

  private selectedCaptiveHero(): CaptiveHeroRow | undefined {
    return this.captiveHeroes.find((c) => c.hero_id === this.selectedCaptiveHeroId);
  }

  private applyCaptiveListPayload(res: unknown, opts?: { keepSelection?: boolean }): void {
    this.captiveHeroesAll = parseListCaptiveHeroesResponse(res);
    const cityId = this.cityId();
    this.captiveHeroes = filterCaptivesForCity(this.captiveHeroesAll, cityId);
    if (
      !opts?.keepSelection ||
      !this.captiveHeroes.some((c) => c.hero_id === this.selectedCaptiveHeroId)
    ) {
      this.selectedCaptiveHeroId = this.captiveHeroes[0]?.hero_id ?? 0;
    }
    this.captiveSummonPreview = null;
    this.syncCaptiveHeroUi();
    if (this.selectedCaptiveHeroId > 0) void this.prefetchCaptiveSummonPreview();
  }

  private syncCaptiveHeroUi(): void {
    const { wallet, bag } = this.sessionEconomy();
    renderCaptiveHeroList(this.heroPanel, this.captiveHeroes, this.selectedCaptiveHeroId);
    this.syncCaptureDisclosure("captive-hero-section", this.selectedCaptiveHero()?.display_name);
    syncCaptiveSummonPreview(
      this.heroPanel,
      this.selectedCaptiveHero(),
      this.captiveSummonPreview,
      wallet,
      bag,
    );
    const afford = canAffordCaptiveSummon(this.captiveSummonPreview, wallet, bag);
    syncCaptiveListRefreshButton(this.heroPanel, this.captiveListInflight);
    syncCaptiveSummonButton(
      this.heroPanel,
      this.captiveSummonInflight,
      this.captiveTryInflight,
      afford.ok && this.captiveSummonPreview?.hero_id === this.selectedCaptiveHeroId && (this.selectedCaptiveHeroId ?? 0) > 0,
    );
    syncCaptiveReleaseButton(
      this.heroPanel,
      this.captiveReleaseInflight,
      (this.selectedCaptiveHeroId ?? 0) > 0,
    );
  }

  private async refreshCaptiveHeroes(): Promise<void> {
    if (this.captiveListInflight) return;
    const sid = this.serverId();
    const cityId = this.cityId();
    if (!cityId) {
      setCaptiveHeroFormError(this.heroPanel, "尚未进入城池，无法拉取俘虏列表");
      return;
    }
    this.captiveListInflight = true;
    setCaptiveHeroFormError(this.heroPanel, null);
    this.syncCaptiveHeroUi();
    this.onStatus("拉取俘虏列表…");
    try {
      const res = await this.gateway.listCaptiveHeroes(sid);
      this.applyCaptiveListPayload(res);
      this.onStatus(`俘虏 ${this.captiveHeroes.length} 名（本城）`);
    } catch (e) {
      const msg = formatCaptiveHeroGatewayError(e);
      setCaptiveHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.captiveListInflight = false;
      this.syncCaptiveHeroUi();
    }
  }

  private async prefetchCaptiveSummonPreview(): Promise<void> {
    const captive = this.selectedCaptiveHero();
    const heroId = captive?.hero_id ?? 0;
    const cityId = captive?.city_id || this.cityId();
    if (!heroId || !cityId) return;
    const request = ++this.captivePreviewRequest;
    this.captiveTryInflight = true;
    this.captiveSummonPreview = null;
    this.syncCaptiveHeroUi();
    const sid = this.serverId();
    try {
      const res = await this.gateway.trySummonCaptive(sid, cityId, heroId);
      if (request !== this.captivePreviewRequest || heroId !== this.selectedCaptiveHeroId) return;
      this.captiveSummonPreview = parseTrySummonCaptiveResponse(res);
    } catch (e) {
      if (request !== this.captivePreviewRequest || heroId !== this.selectedCaptiveHeroId) return;
      const msg = formatCaptiveHeroGatewayError(e);
      setCaptiveHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      if (request === this.captivePreviewRequest) {
        this.captiveTryInflight = false;
        this.syncCaptiveHeroUi();
      }
    }
  }

  private async confirmCaptiveSummon(): Promise<void> {
    if (this.captiveSummonInflight) return;
    const captive = this.selectedCaptiveHero();
    const { wallet, bag } = this.sessionEconomy();
    const afford = canAffordCaptiveSummon(this.captiveSummonPreview, wallet, bag);
    if (!afford.ok || this.captiveSummonPreview?.hero_id !== captive?.hero_id) {
      setCaptiveHeroFormError(this.heroPanel, afford.reason ?? "无法招降");
      this.onStatus(afford.reason ?? "无法招降");
      return;
    }
    const sid = this.serverId();
    const cityId = captive?.city_id || this.cityId();
    const heroId = captive?.hero_id ?? 0;
    if (!cityId || !heroId) {
      setCaptiveHeroFormError(this.heroPanel, "请先选择俘虏");
      return;
    }
    this.captiveSummonInflight = true;
    setCaptiveHeroFormError(this.heroPanel, null);
    this.syncCaptiveHeroUi();
    this.onStatus(`招降 ${captive?.display_name ?? "俘虏"}…`);
    try {
      const res = (await this.gateway.sureSummonCaptive(sid, cityId, heroId)) as {
        hero_id?: number;
        display_name?: string;
      };
      await this.syncEconomyAfterRecruit();
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        writeHeroDetailSelectedSession(res.hero_id);
      }
      await this.refreshHeroes();
      if (res.hero_id) focusRecruitedHeroListRow(this.heroPanel, res.hero_id);
      const listRes = await this.gateway.listCaptiveHeroes(sid);
      this.applyCaptiveListPayload(listRes, { keepSelection: false });
      const name = res.display_name?.trim() || captive?.display_name || "新将领";
      this.onStatus(`已招降 ${name}${res.hero_id ? `（#${res.hero_id}）` : ""}`);
    } catch (e) {
      const msg = formatCaptiveHeroGatewayError(e);
      setCaptiveHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.captiveSummonInflight = false;
      this.syncCaptiveHeroUi();
    }
  }

  private async releaseSelectedCaptive(): Promise<void> {
    if (this.captiveReleaseInflight) return;
    const captive = this.selectedCaptiveHero();
    const sid = this.serverId();
    const cityId = captive?.city_id || this.cityId();
    const heroId = captive?.hero_id ?? 0;
    if (!cityId || !heroId) {
      setCaptiveHeroFormError(this.heroPanel, "请先选择俘虏");
      return;
    }
    this.captiveReleaseInflight = true;
    setCaptiveHeroFormError(this.heroPanel, null);
    this.syncCaptiveHeroUi();
    this.onStatus(`释放 ${captive?.display_name ?? "俘虏"}…`);
    try {
      await this.gateway.releaseCaptive(sid, cityId, heroId);
      const listRes = await this.gateway.listCaptiveHeroes(sid);
      this.applyCaptiveListPayload(listRes, { keepSelection: false });
      this.onStatus(`已释放 ${captive?.display_name ?? "俘虏"}`);
    } catch (e) {
      const msg = formatCaptiveHeroGatewayError(e);
      setCaptiveHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.captiveReleaseInflight = false;
      this.syncCaptiveHeroUi();
    }
  }

  private selectedPersuadeTarget(): PersuadeTarget | undefined {
    return this.persuadeTargets.find((t) => t.npc_cfg_id === this.selectedPersuadeNpcId);
  }

  private applyPersuadeListPayload(res: unknown, opts?: { keepSelection?: boolean }): void {
    const targets = parsePersuadeTargetListResponse(res);
    this.persuadeTargets = targets;
    if (
      !opts?.keepSelection ||
      !targets.some((t) => t.npc_cfg_id === this.selectedPersuadeNpcId)
    ) {
      this.selectedPersuadeNpcId = targets[0]?.npc_cfg_id ?? 0;
    }
    this.syncPersuadeUi();
  }

  private syncPersuadeUi(): void {
    const { wallet, bag } = this.sessionEconomy();
    syncPersuadeMeta(this.heroPanel, this.persuadeTargets.length);
    renderPersuadeTargetList(this.heroPanel, this.persuadeTargets, this.selectedPersuadeNpcId);
    this.syncCaptureDisclosure("persuade-section", this.selectedPersuadeTarget()?.display_name);
    syncPersuadePreview(this.heroPanel, this.selectedPersuadeTarget(), wallet, bag);
    syncPersuadeListRefreshButton(this.heroPanel, this.persuadeListInflight);
    syncPersuadePrimaryButton(
      this.heroPanel,
      this.persuadePrimaryInflight,
      this.selectedPersuadeTarget(),
      wallet,
      bag,
    );
  }

  private async refreshPersuadeTargets(): Promise<void> {
    if (this.persuadeListInflight) return;
    const sid = this.serverId();
    this.persuadeListInflight = true;
    setPersuadeFormError(this.heroPanel, null);
    this.syncPersuadeUi();
    this.onStatus("拉取结交目标…");
    try {
      const res = await this.gateway.listPersuadeTargets(sid);
      this.applyPersuadeListPayload(res);
      this.onStatus(`结交目标 ${this.persuadeTargets.length} 名`);
    } catch (e) {
      const msg = formatPersuadeGatewayError(e);
      setPersuadeFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.persuadeListInflight = false;
      this.syncPersuadeUi();
    }
  }

  private async runPersuadePrimary(): Promise<void> {
    if (this.persuadePrimaryInflight) return;
    const target = this.selectedPersuadeTarget();
    const npcId = target?.npc_cfg_id ?? 0;
    const action = resolvePersuadePrimaryAction(target);
    const sid = this.serverId();
    const cityId = this.cityId();
    if (!cityId || !npcId) {
      setPersuadeFormError(this.heroPanel, "尚未进入城池或未选择结交目标");
      return;
    }
    this.persuadePrimaryInflight = true;
    setPersuadeFormError(this.heroPanel, null);
    this.syncPersuadeUi();
    try {
      if (action === "persuade") {
        const res = (await this.gateway.persuadeHero(sid, cityId, npcId)) as {
          friend_delta?: number;
        };
        const delta = res.friend_delta != null ? Number(res.friend_delta) : 0;
        this.onStatus(`游说成功，友好+${delta}`);
      } else if (action === "befriend" || action === "hire") {
        const res = (await this.gateway.lionizeHero(sid, cityId, npcId)) as {
          befriended?: boolean;
          recruited?: boolean;
          display_name?: string;
        };
        const name = res.display_name ?? target?.display_name ?? "名将";
        if (res.recruited) {
          this.onStatus(`已招入 ${name}`);
          await this.refreshHeroes({ restoreSelection: false });
        } else if (res.befriended) {
          this.onStatus(`已结交 ${name}`);
        } else {
          this.onStatus("名将结交操作完成");
        }
      }
      const listRes = await this.gateway.listPersuadeTargets(sid);
      this.applyPersuadeListPayload(listRes, { keepSelection: true });
    } catch (e) {
      const msg = formatPersuadeGatewayError(e);
      setPersuadeFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.persuadePrimaryInflight = false;
      this.syncPersuadeUi();
    }
  }

  private selectedComingHero(): ComingHeroRow | undefined {
    return this.comingHeroes.find((c) => c.hero_id === this.selectedComingHeroId);
  }

  private applyComingListPayload(res: unknown, opts?: { keepSelection?: boolean }): void {
    this.comingHeroesAll = parseListComingHeroesResponse(res);
    const cityId = this.cityId();
    this.comingHeroes = filterComingForCity(this.comingHeroesAll, cityId);
    if (
      !opts?.keepSelection ||
      !this.comingHeroes.some((c) => c.hero_id === this.selectedComingHeroId)
    ) {
      this.selectedComingHeroId = this.comingHeroes[0]?.hero_id ?? 0;
    }
    this.comingAcceptPreview = null;
    this.syncComingHeroUi();
    if (this.selectedComingHeroId > 0) void this.prefetchComingAcceptPreview();
  }

  private syncComingHeroUi(): void {
    renderComingHeroList(this.heroPanel, this.comingHeroes, this.selectedComingHeroId);
    this.syncCaptureDisclosure("coming-hero-section", this.selectedComingHero()?.display_name);
    syncComingAcceptPreview(this.heroPanel, this.selectedComingHero(), this.comingAcceptPreview);
    const canSubmit = canConfirmComingAccept(this.comingAcceptPreview, this.selectedComingHeroId ?? 0);
    syncComingListRefreshButton(this.heroPanel, this.comingListInflight);
    syncComingAcceptButton(
      this.heroPanel,
      this.comingAcceptInflight,
      this.comingTryInflight,
      canSubmit.ok,
    );
    syncComingRejectButton(
      this.heroPanel,
      this.comingRejectInflight,
      (this.selectedComingHeroId ?? 0) > 0,
    );
  }

  private async refreshComingHeroes(): Promise<void> {
    if (this.comingListInflight) return;
    const sid = this.serverId();
    const cityId = this.cityId();
    if (!cityId) {
      setComingHeroFormError(this.heroPanel, "尚未进入城池，无法拉取来投列表");
      return;
    }
    this.comingListInflight = true;
    setComingHeroFormError(this.heroPanel, null);
    this.syncComingHeroUi();
    this.onStatus("拉取来投列表…");
    try {
      const res = await this.gateway.listComingHeroes(sid);
      this.applyComingListPayload(res);
      this.onStatus(`来投 ${this.comingHeroes.length} 名（本城）`);
    } catch (e) {
      const msg = formatComingHeroGatewayError(e);
      setComingHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.comingListInflight = false;
      this.syncComingHeroUi();
    }
  }

  private async prefetchComingAcceptPreview(): Promise<void> {
    const coming = this.selectedComingHero();
    const heroId = coming?.hero_id ?? 0;
    const cityId = coming?.city_id || this.cityId();
    const sid = this.serverId();
    if (!heroId || !cityId) return;
    const request = ++this.comingPreviewRequest;
    this.comingTryInflight = true;
    this.comingAcceptPreview = null;
    this.syncComingHeroUi();
    try {
      const res = await this.gateway.tryAcceptComing(sid, cityId, heroId);
      if (request !== this.comingPreviewRequest || heroId !== this.selectedComingHeroId) return;
      this.comingAcceptPreview = parseTryAcceptComingResponse(res);
    } catch (e) {
      if (request !== this.comingPreviewRequest || heroId !== this.selectedComingHeroId) return;
      const msg = formatComingHeroGatewayError(e);
      setComingHeroFormError(this.heroPanel, msg);
    } finally {
      if (request === this.comingPreviewRequest) {
        this.comingTryInflight = false;
        this.syncComingHeroUi();
      }
    }
  }

  private async confirmComingAccept(): Promise<void> {
    if (this.comingAcceptInflight) return;
    const coming = this.selectedComingHero();
    const gate = canConfirmComingAccept(this.comingAcceptPreview, coming?.hero_id ?? 0);
    if (!gate.ok) {
      setComingHeroFormError(this.heroPanel, gate.reason ?? "无法接受");
      return;
    }
    const sid = this.serverId();
    const cityId = coming?.city_id || this.cityId();
    const heroId = coming?.hero_id ?? 0;
    if (!cityId || !heroId) {
      setComingHeroFormError(this.heroPanel, "请先选择来投将领");
      return;
    }
    this.comingAcceptInflight = true;
    setComingHeroFormError(this.heroPanel, null);
    this.syncComingHeroUi();
    this.onStatus(`接受 ${coming?.display_name ?? "来投将领"}…`);
    try {
      const res = (await this.gateway.sureAcceptComing(sid, cityId, heroId)) as {
        hero_id?: number;
        display_name?: string;
        level?: number;
        loyalty?: number;
      };
      await this.syncEconomyAfterRecruit();
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        writeHeroDetailSelectedSession(res.hero_id);
      }
      await this.refreshHeroes();
      if (res.hero_id) focusRecruitedHeroListRow(this.heroPanel, res.hero_id);
      const listRes = await this.gateway.listComingHeroes(sid);
      this.applyComingListPayload(listRes, { keepSelection: false });
      const name = res.display_name?.trim() || coming?.display_name || "新将领";
      this.onStatus(`已接受 ${name}${res.hero_id ? `（#${res.hero_id}）` : ""}`);
    } catch (e) {
      const msg = formatComingHeroGatewayError(e);
      setComingHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.comingAcceptInflight = false;
      this.syncComingHeroUi();
    }
  }

  private async rejectSelectedComing(): Promise<void> {
    if (this.comingRejectInflight) return;
    const coming = this.selectedComingHero();
    const sid = this.serverId();
    const cityId = coming?.city_id || this.cityId();
    const heroId = coming?.hero_id ?? 0;
    if (!cityId || !heroId) {
      setComingHeroFormError(this.heroPanel, "请先选择来投将领");
      return;
    }
    this.comingRejectInflight = true;
    setComingHeroFormError(this.heroPanel, null);
    this.syncComingHeroUi();
    this.onStatus(`拒绝 ${coming?.display_name ?? "来投将领"}…`);
    try {
      await this.gateway.rejectComing(sid, cityId, heroId);
      const listRes = await this.gateway.listComingHeroes(sid);
      this.applyComingListPayload(listRes, { keepSelection: false });
      this.onStatus(`已拒绝 ${coming?.display_name ?? "来投将领"}`);
    } catch (e) {
      const msg = formatComingHeroGatewayError(e);
      setComingHeroFormError(this.heroPanel, msg);
      this.onStatus(msg);
    } finally {
      this.comingRejectInflight = false;
      this.syncComingHeroUi();
    }
  }

  private buildHeroPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.dataset.centerPanel = "hero";
    el.innerHTML = `
      <h3>将领</h3>
      <button type="button" data-action="refresh-heroes">刷新列表</button>
      <p class="hero-list-refresh-status hidden" data-role="hero-list-refreshed-at" aria-label="列表上次刷新"></p>
      <p class="march-form-error-sibling hidden" data-role="hero-list-form-error" role="alert"></p>
      <details class="hero-recruit-host" data-role="hero-recruit-host" open>
        <summary class="hero-recruit-host-summary">招募 / 客栈</summary>
        <p data-role="hero-hint">hero.v1 列表/详情/招募；模板与消耗来自 ListRecruitTemplates。</p>
        <button type="button" data-action="refresh-templates">刷新招募模板</button>
        <label>招募模板
          <select data-field="template-select"><option value="">（先刷新模板）</option></select>
        </label>
        <p class="recruit-wallet-compare-line hidden" data-role="recruit-wallet-compare-line" aria-live="polite"></p>
        <p class="recruit-wallet-compare-residual-line hidden" data-role="recruit-wallet-compare-residual-line" aria-live="polite"></p>
        <p class="recruit-cost-preview" data-role="recruit-preview"></p>
        <p class="recruit-form-inline-hint hidden" data-role="recruit-form-inline-hint" aria-live="polite"></p>
        <button type="button" class="hidden recruit-goto-bag-item-gap-btn" data-action="recruit-goto-bag-item-gap">打开背包</button>
        <button type="button" class="hidden" data-action="retry-recruit-bag">重试加载背包</button>
        <button type="button" data-action="recruit-hero">招募</button>
        <p class="recruit-success-toast hidden" data-role="recruit-success-toast" role="status">
          <span data-role="recruit-success-msg"></span>
          <button type="button" class="hidden" data-action="recruit-open-hero-detail">打开详情</button>
        </p>
        <p class="march-form-error-sibling hidden" data-role="recruit-form-error" role="alert"></p>
        <section class="hotel-recruit-section" data-role="hotel-recruit-section" aria-label="客栈招将">
          <h4>客栈招将</h4>
          <p class="hotel-recruit-meta" data-role="hotel-recruit-meta"></p>
          <button type="button" data-action="refresh-hotel-candidates">拉取客栈列表</button>
          <button type="button" data-action="refresh-hotel-pool">访贤刷新池</button>
          <p class="recruit-cost-preview hotel-recruit-preview" data-role="hotel-recruit-preview"></p>
          <button type="button" data-action="recruit-hotel-candidate">招入麾下</button>
          <p class="march-form-error-sibling hidden" data-role="hotel-recruit-form-error" role="alert"></p>
          <ul class="hotel-candidate-list template-list" data-role="hotel-candidate-list"></ul>
        </section>
      </details>
      <div class="hero-capture-sections-row" data-role="hero-capture-sections-row">
        <section class="captive-hero-section" data-role="captive-hero-section" aria-label="俘虏招降">
          <h4>俘虏招降</h4>
          <button type="button" data-action="refresh-captive-list">拉取俘虏列表</button>
          <button type="button" data-action="captive-summon-confirm">确认招降</button>
          <button type="button" data-action="captive-release">释放俘虏</button>
          <p class="march-form-error-sibling hidden" data-role="captive-hero-form-error" role="alert"></p>
          <details class="hero-capture-info" open>
            <summary tabindex="0" aria-label="俘虏招降：目标与费用">目标与费用</summary>
            <div class="hero-capture-info-body">
          <p class="recruit-cost-preview captive-hero-preview" data-role="captive-hero-preview"></p>
          <ul class="captive-hero-list template-list" data-role="captive-hero-list"></ul>
            </div>
          </details>
        </section>
        <section class="persuade-section hotel-recruit-section" data-role="persuade-section" aria-label="名将结交游说">
          <h4>名将结交/游说</h4>
          <button type="button" data-action="refresh-persuade-targets">拉取结交目标</button>
          <button type="button" data-action="persuade-primary">结交/游说</button>
          <p class="march-form-error-sibling hidden" data-role="persuade-form-error" role="alert"></p>
          <details class="hero-capture-info" open>
            <summary tabindex="0" aria-label="结交游说：目标与费用">目标与费用</summary>
            <div class="hero-capture-info-body">
          <p class="persuade-meta hotel-recruit-meta" data-role="persuade-meta"></p>
          <p class="recruit-cost-preview persuade-preview hotel-recruit-preview" data-role="persuade-preview"></p>
          <ul class="persuade-target-list hotel-candidate-list template-list" data-role="persuade-target-list"></ul>
            </div>
          </details>
        </section>
        <section class="coming-hero-section" data-role="coming-hero-section" aria-label="来投将领">
          <h4>来投将领</h4>
          <button type="button" data-action="refresh-coming-list">拉取来投列表</button>
          <button type="button" data-action="coming-accept-confirm">确认接受</button>
          <button type="button" data-action="coming-reject">拒绝来投</button>
          <p class="march-form-error-sibling hidden" data-role="coming-hero-form-error" role="alert"></p>
          <details class="hero-capture-info" open>
            <summary tabindex="0" aria-label="来投将领：目标与费用">目标与费用</summary>
            <div class="hero-capture-info-body">
          <p class="recruit-cost-preview coming-hero-preview" data-role="coming-hero-preview"></p>
          <ul class="coming-hero-list template-list" data-role="coming-hero-list"></ul>
            </div>
          </details>
        </section>
      </div>
      <div class="panel-scroll-body" data-role="hero-scroll">
        <ul class="template-list" data-role="template-list"></ul>
        <div
          class="hero-list-toolbar panel-filter-chip-bar"
          data-role="hero-list-filter-bar"
          role="group"
          aria-label="将领列表筛选"
        >
          <button
            type="button"
            class="hero-filter-btn"
            data-ui-filter-chip
            data-action="hero-filter-all"
            aria-pressed="true"
          >
            <span class="art-filter-chip-label">全部</span>
          </button>
          <button
            type="button"
            class="hero-filter-btn"
            data-ui-filter-chip
            data-action="hero-filter-deployable"
            aria-pressed="false"
          >
            <span class="art-filter-chip-label">可出征</span>
          </button>
          <button
            type="button"
            class="hero-filter-btn"
            data-ui-filter-chip
            data-action="hero-sort-level"
            aria-pressed="true"
          >
            <span class="art-filter-chip-label">等级↓</span>
          </button>
          <button
            type="button"
            class="hero-filter-btn"
            data-ui-filter-chip
            data-action="hero-sort-loyalty"
            aria-pressed="false"
          >
            <span class="art-filter-chip-label">忠诚↓</span>
          </button>
        </div>
        <p
          class="hero-list-filter-chip-residual-sweep hidden"
          data-role="hero-list-filter-chip-residual-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deep-sweep hidden"
          data-role="hero-list-filter-chip-residual-deep-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deeper-sweep hidden"
          data-role="hero-list-filter-chip-residual-deeper-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-deeper-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-deeper-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-deepest-deeper-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-deepest-deeper-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-deepest-deepest-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-deepest-deepest-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-sweep"
          aria-live="polite"
          hidden
        ></p>
        <p
          class="hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-sweep hidden"
          data-role="hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-sweep"
          aria-live="polite"
          hidden
        ></p>
        <ul class="hero-list" data-role="hero-list"></ul>
        <div class="hero-detail" data-role="hero-detail"></div>
      </div>
    `;
    return el;
  }

  private buildMailPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel mail-inbox-panel hidden";
    el.dataset.centerPanel = "mail";
    el.innerHTML = `
      <h3>邮件</h3>
      <p class="mail-inbox-hint" data-role="mail-hint">content.v1 收件箱；点开自动标已读，有附件可一键领取。</p>
      <div class="mail-battle-category-bar panel-filter-chip-bar" data-role="mail-battle-category-bar" role="tablist" aria-label="邮件战报与系统分类">
        ${MAIL_BATTLE_CATEGORY_TABS.map(
          (tab) =>
            `<button type="button" class="mail-battle-category-btn" data-ui-filter-chip data-action="mail-category-${tab.id}" role="tab" aria-selected="false">
              <span class="art-filter-chip-label">${tab.label}</span>
            </button>`,
        ).join("")}
      </div>
      <p class="mail-battle-category-sweep ${MAIL_BATTLE_CATEGORY_SWEEP_CLASS} hidden" data-role="${MAIL_BATTLE_CATEGORY_SWEEP_ROLE}" aria-live="polite" hidden></p>
      <div class="mail-inbox-toolbar mail-filter-bar panel-filter-chip-bar" data-role="mail-filter-bar" role="group" aria-label="邮件筛选">
        <button type="button" class="mail-filter-btn" data-ui-filter-chip data-action="mail-filter-all" aria-pressed="true">
          <span data-role="mail-filter-all-label" class="art-filter-chip-label">全部</span>
          <span class="mail-filter-tab-badge hidden" data-ui-filter-badge="count" data-role="mail-filter-all-count" data-filter-badge-count="0" aria-hidden="true" hidden></span>
        </button>
        <button type="button" class="mail-filter-btn" data-ui-filter-chip data-action="mail-filter-unread" aria-pressed="false">
          <span data-role="mail-filter-unread-label" class="art-filter-chip-label">未读</span>
          <span class="mail-filter-tab-badge hidden" data-ui-filter-badge="count" data-role="mail-filter-unread-count" data-filter-badge-count="0" aria-hidden="true" hidden></span>
        </button>
        <button type="button" class="mail-filter-btn" data-ui-filter-chip data-action="mail-filter-unclaimed" aria-pressed="false">
          <span data-role="mail-filter-unclaimed-label" class="art-filter-chip-label">未领附件</span>
          <span class="mail-filter-tab-badge hidden" data-ui-filter-badge="count" data-role="mail-filter-unclaimed-count" data-filter-badge-count="0" aria-hidden="true" hidden></span>
        </button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-mail">刷新</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="claim-mail-all">领取全部附件</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="claim-mail-batch">批量领取勾选</button>
      </div>
      <p class="mail-tab-unread-sweep hidden" data-role="${MAIL_TAB_UNREAD_SWEEP_ROLE}" aria-live="polite" hidden></p>
      <p class="mail-daily-hud-combined-sweep hidden" data-role="${MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE}" aria-live="polite" hidden></p>
      <p class="mail-form-error hidden" data-role="mail-form-error" role="alert"></p>
      <p class="mail-batch-hint" data-role="mail-batch-hint">当前 tab 含未领附件的邮件可「领取全部」或勾选后批量领取，逐封调用领取并汇总结果。</p>
      <p class="mail-inbox-status" data-role="mail-status"></p>
      <div class="panel-scroll-body" data-role="mail-scroll">
        <ul class="mail-list" data-role="mail-list"></ul>
        <div class="mail-detail hidden" data-role="mail-detail">
          <h4 class="mail-detail-title" data-role="mail-detail-title"></h4>
          <pre class="mail-body" data-role="mail-body"></pre>
          <button type="button" class="art-btn-primary art-btn-primary-full hidden" data-action="claim-mail">领取附件</button>
          <p class="mail-claim-inline-feedback hidden" data-role="mail-claim-inline" aria-live="polite"></p>
          <button type="button" class="art-btn-primary art-btn-primary-full hidden mail-cross-link-btn" data-action="mail-open-battle-report">查看战报</button>
        </div>
      </div>
    `;
    return el;
  }

  private heroPanelStateResidualContext(
    overrides?: Partial<HeroPanelStateResidualContext>,
  ): HeroPanelStateResidualContext {
    return {
      filter: this.heroListFilter,
      sort: this.heroListSort,
      listGatewayError: this.heroListLoadError,
      hasGatewayRetry: false,
      ...overrides,
    };
  }

  private persistHeroListFilterChipResidual(lastChipAction?: HeroListFilterChipAction): void {
    captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(
      this.heroListFilter,
      this.heroListSort,
      lastChipAction,
    );
  }

  private heroListFilterContext(): HeroListFilterContext | undefined {
    const detail = this.heroDetail;
    const heroId = detail?.hero_id ?? 0;
    const lmin = detail?.loyalty_min;
    if (heroId <= 0 || lmin == null || !Number.isFinite(lmin)) return undefined;
    return { detailLoyaltyMinByHeroId: new Map([[heroId, lmin]]) };
  }

  private syncHeroListFilterChipDom(assets?: AssetLoader): void {
    const bar = this.heroPanel?.querySelector('[data-role="hero-list-filter-bar"]');
    if (!bar) return;
    const chipButtons = bar.querySelectorAll<HTMLButtonElement>("button[data-ui-filter-chip]");
    syncFilterChipAria(chipButtons, (btn) => {
      const action = btn.dataset.action;
      if (action === "hero-filter-all") return this.heroListFilter === "all";
      if (action === "hero-filter-deployable") return this.heroListFilter === "deployable";
      if (action === "hero-sort-level") return this.heroListSort === "level_desc";
      if (action === "hero-sort-loyalty") return this.heroListSort === "loyalty_desc";
      return false;
    });
    const loader = assets ?? this.assets;
    if (loader) remountPanelFilterChips(this.heroPanel, loader);
  }

  private renderHeroList(): void {
    const ul = this.heroPanel.querySelector<HTMLElement>('[data-role="hero-list"]');
    const detailEl = this.heroPanel.querySelector<HTMLElement>('[data-role="hero-detail"]');
    if (!ul) return;
    ul.innerHTML = "";
    this.syncHeroListFilterChipDom();
    const visibleHeroes = heroListRowsForDisplay(
      this.heroes,
      this.heroListFilter,
      this.heroListSort,
      this.heroListFilterContext(),
    );
    const residualCtx = (overrides?: Partial<HeroPanelStateResidualContext>) =>
      this.heroPanelStateResidualContext(overrides);
    if (!this.heroes.length && this.heroListLoadError) {
      const li = renderPanelGatewayErrorListRow(ul, this.heroListLoadError, {
        assets: this.assets,
        retryAction: "retry-refresh-heroes",
      });
      appendHeroPanelStateResidualSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeeperSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestDeeperSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestDeepestDeeperSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestDeepestDeepestSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
      appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(li, "error", residualCtx({ hasGatewayRetry: true }));
    } else if (this.heroesRefreshInflight && !this.heroes.length) {
      const li = renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, {
        assets: this.assets,
      });
      appendHeroPanelStateResidualSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeeperSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestDeeperSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeeperSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(li, "loading", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(li, "loading", residualCtx());
    } else if (!this.heroes.length) {
      const msg = heroListLines([])[0];
      const li = renderPanelStateListRow(ul, "empty", msg, { assets: this.assets });
      appendHeroPanelStateResidualSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(li, "empty", residualCtx());
    } else if (!visibleHeroes.length) {
      const li = renderPanelStateListRow(ul, "empty", heroListFilteredEmptyMessage(this.heroListFilter), {
        assets: this.assets,
      });
      appendHeroPanelStateResidualSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeeperSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeepestSweep(li, "empty", residualCtx());
      appendHeroPanelStateResidualDeepestDeepestDeepestDeeperSweep(li, "empty", residualCtx());
    } else {
      for (const h of visibleHeroes) {
        const li = document.createElement("li");
        li.setAttribute("data-ui-panel-listrow", HERO_LIST_ROW_PANEL_SKIN_ID);
        const rowSource = resolveHeroListRowSource(h, this.heroDetail);
        const detailAttrs =
          h.hero_id === this.selectedHeroId && this.heroDetail?.attributes
            ? this.heroDetail.attributes
            : null;
        const body = document.createElement("div");
        body.className = "hero-list-row-body";
        const primarySpan = document.createElement("span");
        primarySpan.className = "hero-list-row-primary";
        primarySpan.textContent = formatHeroListRowPrimary(rowSource);
        const secondarySpan = document.createElement("span");
        secondarySpan.className = "hero-list-row-secondary";
        secondarySpan.textContent = formatHeroListRowSecondary(rowSource, {
          detailAttributes: detailAttrs,
        });
        const filterCtx = this.heroListFilterContext();
        const loyaltySubline = document.createElement("span");
        loyaltySubline.className = HERO_LIST_LOYALTY_SUBLINE_CLASS;
        loyaltySubline.setAttribute("data-role", HERO_LIST_LOYALTY_SUBLINE_ROLE);
        if (heroListRowShowsLoyaltyWarnDot(rowSource, filterCtx)) {
          const dot = document.createElement("span");
          dot.className = HERO_LOYALTY_WARN_DOT_CLASS;
          dot.setAttribute("aria-hidden", "true");
          loyaltySubline.appendChild(dot);
        }
        loyaltySubline.appendChild(
          document.createTextNode(formatHeroListLoyaltySubline(rowSource, filterCtx)),
        );
        const loyaltyResidualSubline = document.createElement("span");
        loyaltyResidualSubline.className = HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS;
        loyaltyResidualSubline.setAttribute("data-role", HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_ROLE);
        if (heroListRowShowsLoyaltyResidualWarnDot(rowSource, filterCtx)) {
          const residualDot = document.createElement("span");
          residualDot.className = HERO_LOYALTY_RESIDUAL_WARN_DOT_CLASS;
          residualDot.setAttribute("aria-hidden", "true");
          loyaltyResidualSubline.appendChild(residualDot);
        }
        loyaltyResidualSubline.appendChild(
          document.createTextNode(formatHeroListLoyaltyResidualSubline(rowSource, filterCtx)),
        );
        const loyaltyResidualDeepSubline = document.createElement("span");
        loyaltyResidualDeepSubline.className = HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS;
        loyaltyResidualDeepSubline.setAttribute("data-role", HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_ROLE);
        if (heroListRowShowsLoyaltyResidualDeepWarnDot(rowSource, filterCtx)) {
          const deepDot = document.createElement("span");
          deepDot.className = HERO_LOYALTY_RESIDUAL_DEEP_WARN_DOT_CLASS;
          deepDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepSubline.appendChild(deepDot);
        }
        loyaltyResidualDeepSubline.appendChild(
          document.createTextNode(formatHeroListLoyaltyResidualDeepSubline(rowSource, filterCtx)),
        );
        const loyaltyResidualDeeperSubline = document.createElement("span");
        loyaltyResidualDeeperSubline.className = HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS;
        loyaltyResidualDeeperSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeeperWarnDot(rowSource, filterCtx)) {
          const deeperDot = document.createElement("span");
          deeperDot.className = HERO_LOYALTY_RESIDUAL_DEEPER_WARN_DOT_CLASS;
          deeperDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeeperSubline.appendChild(deeperDot);
        }
        loyaltyResidualDeeperSubline.appendChild(
          document.createTextNode(formatHeroListLoyaltyResidualDeeperSubline(rowSource, filterCtx)),
        );
        const loyaltyResidualDeepestSubline = document.createElement("span");
        loyaltyResidualDeepestSubline.className = HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS;
        loyaltyResidualDeepestSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeepestWarnDot(rowSource, filterCtx)) {
          const deepestDot = document.createElement("span");
          deepestDot.className = HERO_LOYALTY_RESIDUAL_DEEPEST_WARN_DOT_CLASS;
          deepestDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestSubline.appendChild(deepestDot);
        }
        loyaltyResidualDeepestSubline.appendChild(
          document.createTextNode(formatHeroListLoyaltyResidualDeepestSubline(rowSource, filterCtx)),
        );
        const loyaltyResidualDeepestDeeperSubline = document.createElement("span");
        loyaltyResidualDeepestDeeperSubline.className =
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS;
        loyaltyResidualDeepestDeeperSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot(rowSource, filterCtx)) {
          const deepestDeeperDot = document.createElement("span");
          deepestDeeperDot.className = HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPER_WARN_DOT_CLASS;
          deepestDeeperDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestDeeperSubline.appendChild(deepestDeeperDot);
        }
        loyaltyResidualDeepestDeeperSubline.appendChild(
          document.createTextNode(
            formatHeroListLoyaltyResidualDeepestDeeperSubline(rowSource, filterCtx),
          ),
        );
        const loyaltyResidualDeepestDeepestDeeperSubline = document.createElement("span");
        loyaltyResidualDeepestDeepestDeeperSubline.className =
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
        loyaltyResidualDeepestDeepestDeeperSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot(rowSource, filterCtx)) {
          const deepestDeepestDeeperDot = document.createElement("span");
          deepestDeepestDeeperDot.className =
            HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS;
          deepestDeepestDeeperDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestDeepestDeeperSubline.appendChild(deepestDeepestDeeperDot);
        }
        loyaltyResidualDeepestDeepestDeeperSubline.appendChild(
          document.createTextNode(
            formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline(rowSource, filterCtx),
          ),
        );
        const loyaltyResidualDeepestDeepestDeepestSubline = document.createElement("span");
        loyaltyResidualDeepestDeepestDeepestSubline.className =
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS;
        loyaltyResidualDeepestDeepestDeepestSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot(rowSource, filterCtx)) {
          const deepestDeepestDeepestDot = document.createElement("span");
          deepestDeepestDeepestDot.className =
            HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_WARN_DOT_CLASS;
          deepestDeepestDeepestDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestDeepestDeepestSubline.appendChild(deepestDeepestDeepestDot);
        }
        loyaltyResidualDeepestDeepestDeepestSubline.appendChild(
          document.createTextNode(
            formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline(rowSource, filterCtx),
          ),
        );
        const loyaltyResidualDeepestDeepestDeepestDeeperSubline = document.createElement("span");
        loyaltyResidualDeepestDeepestDeepestDeeperSubline.className =
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
        loyaltyResidualDeepestDeepestDeepestDeeperSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
        );
        if (heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot(rowSource, filterCtx)) {
          const deepestDeepestDeepestDeeperDot = document.createElement("span");
          deepestDeepestDeepestDeeperDot.className =
            HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS;
          deepestDeepestDeepestDeeperDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestDeepestDeepestDeeperSubline.appendChild(deepestDeepestDeepestDeeperDot);
        }
        loyaltyResidualDeepestDeepestDeepestDeeperSubline.appendChild(
          document.createTextNode(
            formatHeroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline(rowSource, filterCtx),
          ),
        );
        const loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline = document.createElement("span");
        loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline.className =
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
        loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline.setAttribute(
          "data-role",
          HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
        );
        if (
          heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeepestDeeperWarnDot(rowSource, filterCtx)
        ) {
          const deepestDeepestDeepestDeepestDeeperDot = document.createElement("span");
          deepestDeepestDeepestDeepestDeeperDot.className =
            HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS;
          deepestDeepestDeepestDeepestDeeperDot.setAttribute("aria-hidden", "true");
          loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline.appendChild(
            deepestDeepestDeepestDeepestDeeperDot,
          );
        }
        loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline.appendChild(
          document.createTextNode(
            formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline(rowSource, filterCtx),
          ),
        );
        body.appendChild(primarySpan);
        body.appendChild(loyaltySubline);
        body.appendChild(loyaltyResidualSubline);
        body.appendChild(loyaltyResidualDeepSubline);
        body.appendChild(loyaltyResidualDeeperSubline);
        body.appendChild(loyaltyResidualDeepestSubline);
        body.appendChild(loyaltyResidualDeepestDeeperSubline);
        body.appendChild(loyaltyResidualDeepestDeepestDeeperSubline);
        body.appendChild(loyaltyResidualDeepestDeepestDeepestSubline);
        body.appendChild(loyaltyResidualDeepestDeepestDeepestDeeperSubline);
        body.appendChild(loyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline);
        body.appendChild(secondarySpan);
        li.appendChild(body);
        mountHeroListAvatar(li, h.template_cfg_id, heroTemplateLabel(h.template_cfg_id), this.assets, this.heroPanel);
        if (h.template_cfg_id) {
          li.dataset.templateCfgId = String(h.template_cfg_id);
        }
        if (h.hero_id) {
          li.setAttribute("data-hero-id", String(h.hero_id));
          li.style.cursor = "pointer";
          li.tabIndex = -1;
          if (h.hero_id === this.selectedHeroId) li.classList.add("selected");
        }
        ul.appendChild(li);
      }
    }
    syncListRovingTabindex(ul, "li[data-hero-id]");
    skimHeroPanelStateChrome(this.heroPanel, this.assets);
    syncHeroListFilterChipResidualSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualSweepLine(readHeroListFilterChipResidualSession()),
    );
    syncHeroListFilterChipResidualDeepSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepSweepLine(readHeroListFilterChipResidualDeepSession()),
    );
    syncHeroListFilterChipResidualDeeperSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeeperSweepLine(readHeroListFilterChipResidualDeeperSession()),
    );
    syncHeroListFilterChipResidualDeepestSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestSweepLine(readHeroListFilterChipResidualDeepestSession()),
    );
    syncHeroListFilterChipResidualDeepestDeeperSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestDeeperSweepLine(
        readHeroListFilterChipResidualDeepestDeeperSession(),
      ),
    );
    syncHeroListFilterChipResidualDeepestDeepestDeeperSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine(
        readHeroListFilterChipResidualDeepestDeepestDeeperSession(),
      ),
    );
    syncHeroListFilterChipResidualDeepestDeepestDeepestSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestDeepestDeepestSweepLine(
        readHeroListFilterChipResidualDeepestDeepestDeepestSession(),
      ),
    );
    syncHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine(
        readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession(),
      ),
    );
    syncHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweep(
      this.heroPanel,
      formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine(
        readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(),
      ),
    );
    if (detailEl) {
      if (!this.selectedHeroId || this.heroDetailCollapsed) {
        detailEl.innerHTML = renderHeroDetailMarkup(null);
        this.syncHeroRecruitHostExpanded();
      } else if (this.heroDetailLoading) {
        detailEl.innerHTML = renderHeroDetailStateLoadingMarkup();
        skimHeroDetailPanelStateResidualSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeeperSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeeperSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeeperSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeepestSweep(detailEl, "loading", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeeperSweep(detailEl, "loading", residualCtx());
        this.syncHeroRecruitHostExpanded();
      } else if (this.heroDetailError) {
        detailEl.innerHTML = renderHeroDetailStateErrorMarkup(this.heroDetailError);
        skimHeroDetailPanelStateResidualSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeeperSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeeperSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeeperSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeepestSweep(detailEl, "error", residualCtx());
        skimHeroDetailPanelStateResidualDeepestDeepestDeepestDeeperSweep(detailEl, "error", residualCtx());
        this.syncHeroRecruitHostExpanded();
      } else {
        const { bag, wallet } = this.sessionEconomy();
        const upgradeHtml =
          renderHeroDetailUpgradeMarkup(this.heroUpgradeSubmitState, this.heroDetail) +
          renderHeroDetailForceMarkup(this.heroForceSubmitState, this.heroDetail) +
          renderHeroDetailPointsMarkup(this.heroPointSubmitState, this.heroDetail) +
          renderHeroDetailExprMarkup(
            this.heroExprSubmitState,
            this.heroDetail,
            wallet,
            this.heroExprHoursPref,
            Date.now(),
          );
        const cultivationHtml = renderHeroDetailCultivationUseMarkup(
          bag,
          this.heroCultivationSubmitState,
          this.heroDetail,
        );
        const largessHtml = renderHeroDetailLargessMarkup(
          this.heroDetail,
          bag,
          wallet,
          this.heroLargessSubmitState,
          this.heroLargessGiftMode,
          this.heroLargessItemCfgId,
          this.getHeroLargessNextAtMs(),
          Date.now(),
        );
        detailEl.innerHTML = renderHeroDetailMarkup(
          this.heroDetail,
          this.recruitAffordSummaryForHeroDetail(),
          this.recruitTemplateForHeroDetail(),
          upgradeHtml,
          cultivationHtml + largessHtml,
          bag,
          formatHeroDetailFromListHint(this.heroDetailListContext),
        );
        this.ensureHeroLargessCooldownTimer();
        mountHeroDetailBust(
          detailEl,
          this.heroDetail?.template_cfg_id,
          this.heroDetail?.template_name || heroTemplateLabel(this.heroDetail?.template_cfg_id),
          this.assets,
          this.heroPanel,
        );
        this.syncHeroRecruitHostExpanded();
        ensureHeroDetailBustNameInScrollClip(this.heroPanel);
        scheduleHeroDetailConsumableStackResidualDeepSweep(detailEl, this.heroDetail, bag);
        scheduleHeroDetailConsumableStackResidualDeeperSweep(detailEl, this.heroDetail, bag);
        scheduleHeroDetailConsumableStackResidualDeepestSweep(detailEl, this.heroDetail, bag);
        scheduleHeroDetailConsumableStackResidualDeepestDeeperSweep(detailEl, this.heroDetail, bag);
        scheduleHeroDetailConsumableStackResidualDeepestDeepestDeeperSweep(
          detailEl,
          this.heroDetail,
          bag,
        );
        scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestSweep(
          detailEl,
          this.heroDetail,
          bag,
        );
        scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeeperSweep(
          detailEl,
          this.heroDetail,
          bag,
        );
        scheduleHeroDetailConsumableStackResidualDeepestDeepestDeepestDeepestDeeperSweep(
          detailEl,
          this.heroDetail,
          bag,
        );
      }
    }
  }

  private recruitTemplatesForDisplay(): RecruitTemplatePreview[] {
    return mergeRecruitTemplateOwnership(this.recruitTemplates, this.heroes);
  }

  private renderTemplateList(): void {
    const ul = this.heroPanel.querySelector<HTMLElement>('[data-role="template-list"]');
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
    const retry = this.heroPanel.querySelector('[data-action="retry-recruit-bag"]');
    retry?.classList.toggle("hidden", !this.recruitBagError);
    if (!this.recruitBagReady()) {
      const message = this.recruitBagError ?? "正在加载背包，稍后检查招募条件…";
      const li = document.createElement("li");
      li.textContent = message;
      ul.appendChild(li);
      if (preview) preview.textContent = message;
      this.syncRecruitButtonState(undefined);
      return;
    }
    const displayTemplates = this.recruitTemplatesForDisplay();
    const lines = recruitTemplateListLines(displayTemplates);
    if (!displayTemplates.length) {
      const li = document.createElement("li");
      li.textContent = lines[0];
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（无模板）";
      sel.appendChild(opt);
      if (preview) preview.textContent = "";
      syncRecruitFormInlineHintDisplay(
        this.heroPanel,
        formatRecruitFormInlineHint(undefined, this.sessionEconomy().wallet, this.sessionEconomy().bag),
      );
      syncRecruitWalletCompareLine(this.heroPanel, null);
      syncRecruitWalletCompareResidualLine(this.heroPanel, null);
      syncRecruitSubmitButton(this.heroPanel, this.recruitSubmitPhase(), false);
      return;
    }
    const { wallet, bag } = this.sessionEconomy();
    for (const t of displayTemplates) {
      const li = document.createElement("li");
      const { primary } = recruitAffordabilityForTemplate(t, wallet, bag);
      const sweep = formatRecruitWalletSweepLine(wallet, t, bag);
      const primarySpan = document.createElement("span");
      primarySpan.className = "recruit-afford-primary";
      primarySpan.textContent = primary;
      const secondarySpan = document.createElement("span");
      secondarySpan.className = "recruit-afford-secondary";
      secondarySpan.textContent = sweep.text;
      if (sweep.hasDeficit) secondarySpan.classList.add("recruit-cost-deficit");
      const residualSpan = document.createElement("span");
      residualSpan.className = RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS;
      residualSpan.setAttribute("data-role", RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_ROLE);
      const residualSummary = formatRecruitTemplateInlineResidualSummary(wallet, t, bag);
      residualSpan.textContent = residualSummary ?? "";
      residualSpan.hidden = !residualSummary;
      const residualDeepSpan = document.createElement("span");
      residualDeepSpan.className = RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS;
      residualDeepSpan.setAttribute("data-role", RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_ROLE);
      const residualDeepSummary = formatRecruitTemplateInlineResidualDeepSummary(wallet, t, bag);
      residualDeepSpan.textContent = residualDeepSummary ?? "";
      residualDeepSpan.hidden = !residualDeepSummary;
      const residualDeeperSpan = document.createElement("span");
      residualDeeperSpan.className = RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPER_SUMMARY_CLASS;
      residualDeeperSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPER_SUMMARY_ROLE,
      );
      const residualDeeperSummary = formatRecruitTemplateInlineResidualDeeperSummary(wallet, t, bag);
      residualDeeperSpan.textContent = residualDeeperSummary ?? "";
      residualDeeperSpan.hidden = !residualDeeperSummary;
      const residualDeepestSpan = document.createElement("span");
      residualDeepestSpan.className = RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_CLASS;
      residualDeepestSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_SUMMARY_ROLE,
      );
      const residualDeepestSummary = formatRecruitTemplateInlineResidualDeepestSummary(wallet, t, bag);
      residualDeepestSpan.textContent = residualDeepestSummary ?? "";
      residualDeepestSpan.hidden = !residualDeepestSummary;
      const residualDeepestDeeperSpan = document.createElement("span");
      residualDeepestDeeperSpan.className = RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS;
      residualDeepestDeeperSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE,
      );
      const residualDeepestDeeperSummary = formatRecruitTemplateInlineResidualDeepestDeeperSummary(
        wallet,
        t,
        bag,
      );
      residualDeepestDeeperSpan.textContent = residualDeepestDeeperSummary ?? "";
      residualDeepestDeeperSpan.hidden = !residualDeepestDeeperSummary;
      const residualDeepestDeepestDeeperSpan = document.createElement("span");
      residualDeepestDeepestDeeperSpan.className =
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS;
      residualDeepestDeepestDeeperSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
      );
      const residualDeepestDeepestDeeperSummary =
        formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary(wallet, t, bag);
      residualDeepestDeepestDeeperSpan.textContent = residualDeepestDeepestDeeperSummary ?? "";
      residualDeepestDeepestDeeperSpan.hidden = !residualDeepestDeepestDeeperSummary;
      const residualDeepestDeepestDeepestSpan = document.createElement("span");
      residualDeepestDeepestDeepestSpan.className =
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS;
      residualDeepestDeepestDeepestSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE,
      );
      const residualDeepestDeepestDeepestSummary =
        formatRecruitTemplateInlineResidualDeepestDeepestDeepestSummary(wallet, t, bag);
      residualDeepestDeepestDeepestSpan.textContent = residualDeepestDeepestDeepestSummary ?? "";
      residualDeepestDeepestDeepestSpan.hidden = !residualDeepestDeepestDeepestSummary;
      const residualDeepestDeepestDeepestDeeperSpan = document.createElement("span");
      residualDeepestDeepestDeepestDeeperSpan.className =
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS;
      residualDeepestDeepestDeepestDeeperSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
      );
      const residualDeepestDeepestDeepestDeeperSummary =
        formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary(wallet, t, bag);
      residualDeepestDeepestDeepestDeeperSpan.textContent =
        residualDeepestDeepestDeepestDeeperSummary ?? "";
      residualDeepestDeepestDeepestDeeperSpan.hidden = !residualDeepestDeepestDeepestDeeperSummary;
      const residualDeepestDeepestDeepestDeepestDeeperSpan = document.createElement("span");
      residualDeepestDeepestDeepestDeepestDeeperSpan.className =
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS;
      residualDeepestDeepestDeepestDeepestDeeperSpan.setAttribute(
        "data-role",
        RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
      );
      const residualDeepestDeepestDeepestDeepestDeeperSummary =
        formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary(wallet, t, bag);
      residualDeepestDeepestDeepestDeepestDeeperSpan.textContent =
        residualDeepestDeepestDeepestDeepestDeeperSummary ?? "";
      residualDeepestDeepestDeepestDeepestDeeperSpan.hidden =
        !residualDeepestDeepestDeepestDeepestDeeperSummary;
      li.appendChild(primarySpan);
      li.appendChild(secondarySpan);
      li.appendChild(residualSpan);
      li.appendChild(residualDeepSpan);
      li.appendChild(residualDeeperSpan);
      li.appendChild(residualDeepestSpan);
      li.appendChild(residualDeepestDeeperSpan);
      li.appendChild(residualDeepestDeepestDeeperSpan);
      li.appendChild(residualDeepestDeepestDeepestSpan);
      li.appendChild(residualDeepestDeepestDeepestDeeperSpan);
      li.appendChild(residualDeepestDeepestDeepestDeepestDeeperSpan);
      const heroIdForTemplate = resolveHeroIdForRecruitTemplate(this.heroes, t.template_cfg_id);
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "recruit-view-hero-btn";
      viewBtn.dataset.action = "recruit-view-hero";
      viewBtn.textContent = "查看将领";
      if (heroIdForTemplate) {
        viewBtn.dataset.heroId = String(heroIdForTemplate);
      } else {
        viewBtn.disabled = true;
        viewBtn.classList.add("recruit-view-hero-locked");
        li.classList.add("recruit-template-locked");
      }
      li.appendChild(viewBtn);
      if (t.already_owned) li.classList.add("recruit-owned");
      if (t.template_cfg_id) {
        li.setAttribute("data-template-id", String(t.template_cfg_id));
        li.style.cursor = "pointer";
        if (t.template_cfg_id === this.selectedTemplateId) li.classList.add("selected");
      }
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = String(t.template_cfg_id ?? 0);
      const ownedTag = t.already_owned ? " · 已招募" : "";
      opt.textContent = `#${t.template_cfg_id} ${t.template_name ?? ""} · 稀有${t.rarity ?? "?"}${ownedTag}`;
      sel.appendChild(opt);
    }
    const pickId = this.selectedTemplateId || displayTemplates[0]?.template_cfg_id || 0;
    if (pickId) sel.value = String(pickId);
    this.applyTemplateSelection(pickId);
    applyRecruitScrollAnchorSession(this.heroPanel);
  }

  private applyTemplateSelection(
    templateCfgId: number,
    opts?: { skipHeroListRender?: boolean },
  ): void {
    const displayTemplates = this.recruitTemplatesForDisplay();
    const row = displayTemplates.find((t) => t.template_cfg_id === templateCfgId);
    const pick = pickRecruitSelection(this.recruitTemplates, templateCfgId);
    if (pick) {
      this.selectedTemplateId = pick.templateCfgId;
      this.recruitItemId = pick.itemCfgId;
      this.recruitPool = pick.pool;
    }
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (preview) {
      if (row) {
        const { wallet, bag } = this.sessionEconomy();
        const { primary } = recruitAffordabilityForTemplate(row, wallet, bag);
        const sweep = formatRecruitWalletSweepLine(wallet, row, bag);
        preview.textContent = `${primary} — ${sweep.text}`;
      } else {
        preview.textContent = this.recruitTemplates.length ? "请选择模板" : "";
      }
    }
    const { wallet, bag } = this.sessionEconomy();
    syncRecruitWalletCompareLine(
      this.heroPanel,
      row ? formatRecruitWalletCompareLine(wallet, row, bag) : null,
    );
    syncRecruitWalletCompareResidualLine(
      this.heroPanel,
      row ? formatRecruitWalletCompareResidualLine(wallet, row, bag) : null,
    );
    this.syncRecruitFormInlineState(row);
    const ul = this.heroPanel.querySelector<HTMLElement>('[data-role="template-list"]');
    ul?.querySelectorAll("li[data-template-id]").forEach((li) => {
      li.classList.toggle("selected", Number(li.getAttribute("data-template-id")) === templateCfgId);
    });
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    if (sel && templateCfgId) sel.value = String(templateCfgId);
    if (!opts?.skipHeroListRender) this.renderHeroList();
  }

  private recruitSubmitPhase(): ReturnType<typeof resolveRecruitSubmitPhase> {
    return resolveRecruitSubmitPhase({
      inflight: this.recruitHeroInflight,
      lastError: this.recruitLastError,
      lastSuccessHeroId: this.recruitLastSuccessHeroId,
    });
  }

  private syncRecruitFormInlineState(templateRow: RecruitTemplatePreview | undefined): void {
    const { wallet, bag } = this.sessionEconomy();
    const inlineHint = formatRecruitFormInlineHint(templateRow, wallet, bag);
    syncRecruitFormInlineHintDisplay(this.heroPanel, inlineHint);
    this.syncRecruitButtonState(templateRow, inlineHint);
  }

  private syncRecruitButtonState(
    templateRow: RecruitTemplatePreview | undefined,
    inlineHint?: ReturnType<typeof formatRecruitFormInlineHint>,
  ): void {
    if (!this.recruitBagReady()) {
      syncRecruitSubmitButton(this.heroPanel, this.recruitSubmitPhase(), false);
      setRecruitAffordabilityErrorDisplay(this.heroPanel, this.recruitBagError);
      const hintEl = this.heroPanel.querySelector('[data-role="recruit-form-inline-hint"]');
      if (hintEl) hintEl.textContent = this.recruitBagError ?? "正在加载背包，稍后检查招募条件…";
      return;
    }
    const hint =
      inlineHint ??
      formatRecruitFormInlineHint(templateRow, this.sessionEconomy().wallet, this.sessionEconomy().bag);
    if (!templateRow) {
      syncRecruitSubmitButton(this.heroPanel, this.recruitSubmitPhase(), false);
      setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
      return;
    }
    const { wallet, bag } = this.sessionEconomy();
    const afford = compareRecruitAffordability(wallet, templateRow, bag);
    syncRecruitSubmitButton(this.heroPanel, this.recruitSubmitPhase(), hint.canSubmit);
    if (!this.recruitHeroInflight) {
      const inlineError = this.recruitLastError?.trim() || afford.insufficientReason || null;
      setRecruitAffordabilityErrorDisplay(this.heroPanel, inlineError);
    }
  }

  private syncMailFilterChipDom(assets?: AssetLoader): void {
    const tabCounts = mailPanelTabBadgeCounts({
      mailUnreadTotal: this.mailUnreadTotal,
      mailClaimablePage: this.mailInboxSnapshot,
    });
    const unreadForTab = this.mailFilterTabCountOverride?.unreadForTab ?? tabCounts.unreadTab;
    const unclaimedCount = this.mailFilterTabCountOverride?.unclaimedCount ?? tabCounts.unclaimedTab;
    const chipSpecs = formatMailFilterChips({
      activeFilter: this.mailFilter,
      unreadForTab,
      unclaimedCount,
    });
    const allBtn = this.mailPanel.querySelector<HTMLButtonElement>('[data-action="mail-filter-all"]');
    const unreadBtn = this.mailPanel.querySelector<HTMLButtonElement>('[data-action="mail-filter-unread"]');
    const unclaimedBtn = this.mailPanel.querySelector<HTMLButtonElement>(
      '[data-action="mail-filter-unclaimed"]',
    );
    const chipButtons = [allBtn, unreadBtn, unclaimedBtn].filter((b): b is HTMLButtonElement => b != null);
    syncFilterChipAria(chipButtons, (btn) => {
      if (btn.dataset.action === "mail-filter-all") return this.mailFilter === MAIL_INBOX_FILTER_ALL;
      if (btn.dataset.action === "mail-filter-unread") return this.mailFilter === MAIL_INBOX_FILTER_UNREAD;
      if (btn.dataset.action === "mail-filter-unclaimed") {
        return this.mailFilter === MAIL_INBOX_FILTER_UNCLAIMED;
      }
      return false;
    });
    const loader = assets ?? this.assets;
    for (const spec of chipSpecs) {
      const btn = this.mailPanel.querySelector<HTMLButtonElement>(`[data-action="${spec.action}"]`);
      if (!btn) continue;
      setFilterChipLabel(btn, spec.label);
      const countEl = btn.querySelector<HTMLElement>("[data-ui-filter-badge='count']");
      if (!countEl) continue;
      const count =
        spec.action === "mail-filter-unread"
          ? unreadForTab
          : spec.action === "mail-filter-all" || spec.action === "mail-filter-unclaimed"
            ? unclaimedCount
            : 0;
      countEl.dataset.filterBadgeCount = String(count);
      if (loader) {
        mountFilterBadgeCount(countEl, loader, count);
      } else {
        countEl.textContent = spec.countBadge;
        const show = Boolean(spec.countBadge);
        countEl.classList.toggle("hidden", !show);
        countEl.hidden = !show;
      }
    }
    if (loader) remountPanelFilterChips(this.mailPanel, loader);
    this.syncMailBattleCategoryDom();
    this.syncMailHudTodoSweepDom();
  }

  private applyMailListClientFilters(page: MailRow[]): MailRow[] {
    const inbox = filterMailRowsForInboxTab(page, this.mailFilter);
    return filterMailRowsByBattleCategory(inbox, this.mailBattleCategory);
  }

  private syncMailBattleCategoryDom(): void {
    const bar = this.mailPanel.querySelector('[data-role="mail-battle-category-bar"]');
    if (bar) {
      for (const btn of Array.from(bar.querySelectorAll<HTMLButtonElement>("button[data-action]"))) {
        const action = btn.dataset.action ?? "";
        const tab = action.replace("mail-category-", "") as MailBattleCategoryTab;
        const selected = tab === this.mailBattleCategory;
        btn.setAttribute("aria-selected", selected ? "true" : "false");
        btn.setAttribute("aria-pressed", selected ? "true" : "false");
        btn.classList.toggle("active", selected);
      }
      if (this.assets) remountPanelFilterChips(this.mailPanel, this.assets);
    }
    const counts = mailBattleCategorySweepCounts(this.mailInboxSnapshot, this.mailBattleCategory);
    const line = formatMailBattleCategorySweepLine(this.mailBattleCategory, counts);
    const sweepEl = this.mailPanel.querySelector<HTMLElement>(
      `[data-role="${MAIL_BATTLE_CATEGORY_SWEEP_ROLE}"]`,
    );
    if (!sweepEl) return;
    if (!line) {
      sweepEl.hidden = true;
      sweepEl.classList.add("hidden");
      sweepEl.textContent = "";
      return;
    }
    sweepEl.hidden = false;
    sweepEl.classList.remove("hidden");
    sweepEl.textContent = line;
  }

  /** CLIENT-209：HUD 待办轮询刷新戳记与邮件 tab 扫读联动（由 MainCityScene 驱动）。 */
  syncMailTabHudTodoLinkage(input: {
    dailyRows: DailyQuestRow[];
    stamp: number;
    pulse?: boolean;
  }): void {
    this.mailHudTodoDailyRows = input.dailyRows.slice();
    this.mailHudTodoRefreshStamp = input.stamp;
    if (input.pulse) this.mailHudTodoPulsePending = true;
    if (this.isMailOpen()) this.syncMailHudTodoSweepDom();
  }

  private syncMailHudTodoSweepDom(): void {
    const tabCounts = mailPanelTabBadgeCounts({
      mailUnreadTotal: this.mailUnreadTotal,
      mailClaimablePage: this.mailInboxSnapshot,
    });
    const unreadForTab = this.mailFilterTabCountOverride?.unreadForTab ?? tabCounts.unreadTab;
    const unclaimedCount = this.mailFilterTabCountOverride?.unclaimedCount ?? tabCounts.unclaimedTab;
    const counts = { unreadForTab, unclaimedCount };
    const tabLine = formatMailTabUnreadSweepLine(
      mailInboxFilterToUnreadSweepTab(this.mailFilter),
      counts,
    );
    const combinedLine = formatMailPanelHudCombinedSweepLine(counts, this.mailHudTodoDailyRows);
    const tabEl = this.mailPanel.querySelector<HTMLElement>(`[data-role="${MAIL_TAB_UNREAD_SWEEP_ROLE}"]`);
    const combinedEl = this.mailPanel.querySelector<HTMLElement>(
      `[data-role="${MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE}"]`,
    );
    const syncLine = (el: HTMLElement | null, line: string | null) => {
      if (!el) return;
      if (!line) {
        el.hidden = true;
        el.classList.add("hidden");
        el.textContent = "";
        return;
      }
      el.hidden = false;
      el.classList.remove("hidden");
      el.textContent = line;
    };
    syncLine(tabEl, tabLine);
    syncLine(combinedEl, combinedLine);
    const stamp = this.mailHudTodoRefreshStamp;
    for (const el of [tabEl, combinedEl]) {
      if (!el || stamp <= 0) continue;
      setHudCenterPanelDeepLinkRefreshStamp(el, stamp);
      if (this.mailHudTodoPulsePending) scheduleMailTabHudSyncPulse(el);
    }
    this.mailHudTodoPulsePending = false;
  }

  private setMailFilterButtons(): void {
    this.syncMailFilterChipDom();
  }

  private patchMailInboxSnapshot(mailId: number, patch: MailRow): void {
    this.mailInboxSnapshot = upsertMailRow(this.mailInboxSnapshot, { ...patch, mail_id: mailId });
    this.setMailFilterButtons();
  }

  private applyMailBadgeCountsFromSnapshot(): void {
    const toolbarMail = mailToolbarBadgeCount({
      unreadTotal: this.mailUnreadTotal,
      mailClaimablePage: this.mailInboxSnapshot,
    });
    const snap = {
      count: toolbarMail,
      firstId: this.mailUnreadFirstId || pickFirstUnreadMailId(this.mailInboxSnapshot),
    };
    this.applyMailUnreadHud(snap);
    this.onMailInboxSnapshot?.(this.mailInboxSnapshot, toolbarMail);
    this.setMailFilterButtons();
  }

  private async refreshMailInboxSnapshot(): Promise<void> {
    const sid = this.serverId();
    if (!sid) {
      this.mailInboxSnapshot = [];
      this.setMailFilterButtons();
      return;
    }
    try {
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: MAIL_INBOX_FILTER_ALL,
        pageSize: 50,
        pageOffset: 0,
      })) as { mails?: MailRow[] };
      this.mailInboxSnapshot = res.mails ?? [];
      this.setMailFilterButtons();
    } catch {
      /* 角标推导失败不阻断列表 */
    }
  }

  private renderMailList(): void {
    const ul = this.mailPanel.querySelector<HTMLElement>('[data-role="mail-list"]');
    const statusEl = this.mailPanel.querySelector('[data-role="mail-status"]');
    const detailWrap = this.mailPanel.querySelector('[data-role="mail-detail"]');
    const titleEl = this.mailPanel.querySelector('[data-role="mail-detail-title"]');
    const body = this.mailPanel.querySelector('[data-role="mail-body"]');
    const claimBtn = this.mailPanel.querySelector('[data-action="claim-mail"]');
    const battleBtn = this.mailPanel.querySelector(
      '[data-action="mail-open-battle-report"]',
    ) as HTMLButtonElement | null;
    if (!ul) return;
    this.setMailFilterButtons();
    ul.innerHTML = "";
    if (statusEl) {
      statusEl.textContent = this.mailListLoading
        ? PANEL_STATE_LOADING_MESSAGE
        : this.mailListError;
      statusEl.classList.toggle("is-error", !!this.mailListError && !this.mailListLoading);
    }
    if (this.mailListLoading && !this.mails.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, {
        assets: this.assets,
      });
    } else if (!this.mails.length) {
      const kind = this.mailListError ? "error" : "empty";
      const msg = this.mailListError
        ? mailInboxLoadErrorListHint()
        : formatMailTabEmptyHint(mailInboxFilterToEmptyTab(this.mailFilter));
      renderPanelStateListRow(ul, kind, msg, {
        legacyClass: mailInboxEmptyListClass(),
        assets: this.assets,
      });
    } else {
      for (const m of this.mails) {
        const li = document.createElement("li");
        li.setAttribute("data-ui-filter-row", "");
        if (m.mail_id) {
          li.setAttribute("data-mail-id", String(m.mail_id));
          li.setAttribute(
            TODO_SCROLL_TARGET_ATTR,
            centerTodoScrollTargetId("mail", m.mail_id),
          );
          if (m.mail_id === this.selectedMailId) li.classList.add("selected");
        }
        for (const cls of mailListRowClassName(m).split(/\s+/).filter(Boolean)) {
          li.classList.add(cls);
        }
        if (m.mail_id && this.mailBatchClaimFailedIds.has(m.mail_id)) {
          li.classList.add(MAIL_CLAIM_ERROR_CLASS);
        }
        if (m.mail_id && mailHasUnclaimedAttachments(m)) {
          const pick = document.createElement("label");
          pick.className = "mail-batch-pick";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.setAttribute("data-role", "mail-batch-checkbox");
          cb.dataset.mailId = String(m.mail_id);
          cb.checked = this.mailBatchSelected.has(m.mail_id);
          cb.disabled = this.claimMailInflight !== 0;
          pick.appendChild(cb);
          pick.appendChild(document.createTextNode("勾选"));
          li.appendChild(pick);
        }
        const titleSpan = document.createElement("span");
        titleSpan.className = "mail-row-title";
        if (mailRowShowsUnreadDot(m)) {
          const dot = document.createElement("span");
          dot.className = "mail-row-unread-dot";
          dot.setAttribute("data-ui-filter-badge", "dot");
          dot.setAttribute("aria-hidden", "true");
          titleSpan.appendChild(dot);
        }
        const titleText = document.createElement("span");
        titleText.className = "mail-row-title-text";
        titleText.textContent = mailRowTitleLine(m);
        titleSpan.appendChild(titleText);
        const summarySpan = document.createElement("span");
        summarySpan.className = "mail-row-summary";
        const metaText = document.createElement("span");
        metaText.className = "mail-row-meta-text";
        metaText.textContent = mailRowMetaLine(m);
        summarySpan.appendChild(metaText);
        const attachCount = mailRowAttachmentBadgeCount(m);
        if (attachCount > 0) {
          const countBadge = document.createElement("span");
          countBadge.className = "mail-row-count-badge";
          countBadge.setAttribute("data-ui-filter-badge", "count");
          countBadge.dataset.filterBadgeCount = String(attachCount);
          countBadge.setAttribute("aria-label", `附件 ${formatMailRowCountBadge(m)}`);
          summarySpan.appendChild(countBadge);
        }
        if (mailHasUnclaimedAttachments(m)) summarySpan.classList.add("mail-row-meta-attach");
        li.appendChild(titleSpan);
        li.appendChild(summarySpan);
        const residualSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualSubline) {
          const residualSpan = document.createElement("span");
          residualSpan.className = MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS;
          residualSpan.setAttribute("data-role", MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_ROLE);
          residualSpan.textContent = residualSubline;
          li.appendChild(residualSpan);
        }
        const residualDeepSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeepSubline) {
          const residualDeepSpan = document.createElement("span");
          residualDeepSpan.className = MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS;
          residualDeepSpan.setAttribute("data-role", MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_ROLE);
          residualDeepSpan.textContent = residualDeepSubline;
          li.appendChild(residualDeepSpan);
        }
        const residualDeeperSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeeperSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeeperSubline) {
          const residualDeeperSpan = document.createElement("span");
          residualDeeperSpan.className = MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_CLASS;
          residualDeeperSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_ROLE,
          );
          residualDeeperSpan.textContent = residualDeeperSubline;
          li.appendChild(residualDeeperSpan);
        }
        const residualDeepestSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeepestSubline) {
          const residualDeepestSpan = document.createElement("span");
          residualDeepestSpan.className = MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_CLASS;
          residualDeepestSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_ROLE,
          );
          residualDeepestSpan.textContent = residualDeepestSubline;
          li.appendChild(residualDeepestSpan);
        }
        const residualDeepestDeeperSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestDeeperSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeepestDeeperSubline) {
          const residualDeepestDeeperSpan = document.createElement("span");
          residualDeepestDeeperSpan.className =
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS;
          residualDeepestDeeperSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE,
          );
          residualDeepestDeeperSpan.textContent = residualDeepestDeeperSubline;
          li.appendChild(residualDeepestDeeperSpan);
        }
        const residualDeepestDeepestDeeperSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestDeepestDeeperSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeepestDeepestDeeperSubline) {
          const residualDeepestDeepestDeeperSpan = document.createElement("span");
          residualDeepestDeepestDeeperSpan.className =
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
          residualDeepestDeepestDeeperSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
          );
          residualDeepestDeepestDeeperSpan.textContent = residualDeepestDeepestDeeperSubline;
          li.appendChild(residualDeepestDeepestDeeperSpan);
        }
        const residualDeepestDeepestDeepestSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestDeepestDeepestSublineByMailId.get(m.mail_id)
            : undefined;
        if (residualDeepestDeepestDeepestSubline) {
          const residualDeepestDeepestDeepestSpan = document.createElement("span");
          residualDeepestDeepestDeepestSpan.className =
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS;
          residualDeepestDeepestDeepestSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
          );
          residualDeepestDeepestDeepestSpan.textContent = residualDeepestDeepestDeepestSubline;
          li.appendChild(residualDeepestDeepestDeepestSpan);
        }
        const residualDeepestDeepestDeepestDeeperSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestDeepestDeepestDeeperSublineByMailId.get(
                m.mail_id,
              )
            : undefined;
        if (residualDeepestDeepestDeepestDeeperSubline) {
          const residualDeepestDeepestDeepestDeeperSpan = document.createElement("span");
          residualDeepestDeepestDeepestDeeperSpan.className =
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
          residualDeepestDeepestDeepestDeeperSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
          );
          residualDeepestDeepestDeepestDeeperSpan.textContent =
            residualDeepestDeepestDeepestDeeperSubline;
          li.appendChild(residualDeepestDeepestDeepestDeeperSpan);
        }
        const residualDeepestDeepestDeepestDeepestDeeperSubline =
          m.mail_id != null
            ? this.mailAttachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSublineByMailId.get(
                m.mail_id,
              )
            : undefined;
        if (residualDeepestDeepestDeepestDeepestDeeperSubline) {
          const residualDeepestDeepestDeepestDeepestDeeperSpan = document.createElement("span");
          residualDeepestDeepestDeepestDeepestDeeperSpan.className =
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
          residualDeepestDeepestDeepestDeepestDeeperSpan.setAttribute(
            "data-role",
            MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
          );
          residualDeepestDeepestDeepestDeepestDeeperSpan.textContent =
            residualDeepestDeepestDeepestDeepestDeeperSubline;
          li.appendChild(residualDeepestDeepestDeepestDeepestDeeperSpan);
        }
        ul.appendChild(li);
      }
    }
    this.mountMailListRowSkins();
    const sel = this.mails.find((m) => m.mail_id === this.selectedMailId) ?? null;
    if (detailWrap) detailWrap.classList.toggle("hidden", !sel);
    if (titleEl) titleEl.textContent = sel ? mailTitle(sel) : "";
    if (body) {
      body.textContent = sel?.body?.trim() || (sel ? "（无正文）" : "");
    }
    if (claimBtn) {
      const show = sel && mailHasUnclaimedAttachments(sel);
      claimBtn.classList.toggle("hidden", !show);
      claimBtn.classList.toggle("mail-claim-highlight", !!(show && sel && !mailIsUnread(sel)));
      if (claimBtn instanceof HTMLButtonElement) {
        claimBtn.disabled = this.claimMailInflight !== 0;
      }
    }
    this.syncMailClaimInlineFeedback(sel?.mail_id ?? 0);
    this.pruneMailBatchSelection();
    this.syncBatchClaimButton();
    if (battleBtn) {
      const link = sel
        ? resolveMailBattleReportLink(mailTitle(sel), sel.body ?? "")
        : { show: false, reportId: null };
      const showBattle = link.show && !!this.onOpenBattleReport;
      battleBtn.classList.toggle("hidden", !showBattle);
      if (link.reportId != null) battleBtn.dataset.reportId = String(link.reportId);
      else battleBtn.removeAttribute("data-report-id");
    }
  }

  private mountMailListRowSkins(assets?: AssetLoader): void {
    const loader = assets ?? this.assets;
    if (!loader || !this.mailPanel) return;
    const ul = this.mailPanel.querySelector<HTMLElement>('[data-role="mail-list"]');
    if (!ul) return;
    for (const row of Array.from(ul.querySelectorAll<HTMLElement>("li[data-ui-filter-row]"))) {
      mountFilterRow(row, loader);
      const dot = row.querySelector<HTMLElement>("[data-ui-filter-badge='dot']");
      if (dot) mountFilterBadgeDot(dot, loader);
      const countEl = row.querySelector<HTMLElement>("[data-ui-filter-badge='count']");
      if (countEl) {
        const count = Number(countEl.dataset.filterBadgeCount ?? "0");
        mountFilterBadgeCount(countEl, loader, Number.isFinite(count) ? count : 0);
      }
    }
    mountFilterBadges(ul, loader);
  }

  private async refreshHeroes(opts?: {
    restoreSelection?: boolean;
    pulseOnSuccess?: boolean;
  }): Promise<void> {
    if (this.heroesRefreshInflight) return;
    this.heroesRefreshInflight = true;
    syncHeroListRefreshButton(this.heroPanel, true);
    setHeroListFormErrorDisplay(this.heroPanel, null);
    this.heroListLoadError = null;
    if (!this.heroes.length) this.renderHeroList();
    const sid = this.serverId();
    this.onStatus("拉取将领…");
    try {
      const res = (await this.gateway.listPlayerHeroes(sid)) as {
        heroes?: HeroSummary[];
        total_count?: number;
      };
      this.heroes = (res.heroes ?? []).map((row) => normalizeListPlayerHeroSummary(row));
      this.heroListLastRefreshedAtMs = Date.now();
      syncHeroListRefreshedAtDisplay(this.heroPanel, this.heroListLastRefreshedAtMs);
      const returnRestore = opts?.restoreSelection ? readHeroListReturnState() : null;
      const listScrollRestore =
        returnRestore ??
        (opts?.restoreSelection ? readHeroListSelectedSession() : null);
      if (opts?.restoreSelection && returnRestore) {
        this.heroListFilter = returnRestore.filter;
        this.heroListSort = returnRestore.sort;
        writeHeroListFilterSession(this.heroListFilter);
        writeHeroListSortSession(this.heroListSort);
        this.persistHeroListFilterChipResidual();
      }
      if (opts?.restoreSelection) {
        const stored = readHeroDetailSelectedSession();
        const listPick = pickRestoredHeroId(this.heroes, listScrollRestore?.heroId ?? null);
        const detailPick = pickRestoredHeroId(this.heroes, stored);
        const pick = listPick ?? detailPick;
        if (pick) this.selectedHeroId = pick;
        if (returnRestore && listPick) {
          this.heroDetailCollapsed = true;
          this.heroDetailListContext = null;
        }
      } else if (
        this.selectedHeroId > 0 &&
        !this.heroes.some((h) => h.hero_id === this.selectedHeroId)
      ) {
        this.selectedHeroId = 0;
        this.heroDetail = null;
      }
      this.renderHeroList();
      this.renderTemplateList();
      if (opts?.restoreSelection && this.selectedHeroId > 0 && !this.heroDetailCollapsed) {
        await this.loadHeroDetail(this.selectedHeroId, {
          skipListSelectionWrite: true,
          fromHeroList: !!returnRestore,
        });
        if (listScrollRestore && listScrollRestore.heroId === this.selectedHeroId) {
          applyHeroPanelListScrollTop(this.heroPanel, listScrollRestore.scrollTop);
        } else {
          scrollHeroListRowIntoView(this.heroPanel, this.selectedHeroId);
        }
      } else if (opts?.restoreSelection && listScrollRestore) {
        applyHeroPanelListScrollTop(this.heroPanel, listScrollRestore.scrollTop);
        if (this.selectedHeroId > 0) {
          scrollHeroListRowIntoView(this.heroPanel, this.selectedHeroId);
        }
      }
      if (opts?.pulseOnSuccess) {
        scheduleHeroListRefreshPulse(
          this.heroPanel.querySelector('[data-role="hero-list"]') as HTMLElement | null,
        );
      }
      this.onStatus(`将领 ${this.heroes.length}/${res.total_count ?? this.heroes.length} 名`);
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      setHeroListFormErrorDisplay(this.heroPanel, msg);
      if (!this.heroes.length) {
        this.heroListLoadError = msg;
        this.renderHeroList();
      }
      this.onStatus(msg);
    } finally {
      this.heroesRefreshInflight = false;
      syncHeroListRefreshButton(this.heroPanel, false);
    }
  }

  private resetHeroCultivationSubmitFeedback(): void {
    this.heroCultivationSubmitState = useConsumableSubmitStateMachine(
      this.heroCultivationSubmitState,
      { type: "CLEAR_ERROR" },
    );
    setHeroCultivationFormErrorDisplay(this.heroPanel, null);
    setHeroCultivationSuccessDisplay(this.heroPanel, null);
  }

  private resetHeroLargessSubmitFeedback(): void {
    this.heroLargessSubmitState = useConsumableSubmitStateMachine(this.heroLargessSubmitState, {
      type: "CLEAR_ERROR",
    });
    setHeroLargessFormErrorDisplay(this.heroPanel, null);
    setHeroLargessSuccessDisplay(this.heroPanel, null);
  }

  private resetHeroUpgradeSubmitFeedback(): void {
    this.heroUpgradeSubmitState = useConsumableSubmitStateMachine(this.heroUpgradeSubmitState, {
      type: "CLEAR_ERROR",
    });
    setHeroUpgradeFormErrorDisplay(this.heroPanel, null);
    setHeroUpgradeSuccessDisplay(this.heroPanel, null);
  }

  private resetHeroPointSubmitFeedback(): void {
    this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
      type: "CLEAR_ERROR",
    });
    setHeroPointFormErrorDisplay(this.heroPanel, null);
    setHeroPointSuccessDisplay(this.heroPanel, null);
  }

  private resetHeroForceSubmitFeedback(): void {
    this.heroForceSubmitState = useConsumableSubmitStateMachine(this.heroForceSubmitState, {
      type: "CLEAR_ERROR",
    });
    setHeroForceFormErrorDisplay(this.heroPanel, null);
    setHeroForceSuccessDisplay(this.heroPanel, null);
  }

  private resetHeroExprSubmitFeedback(): void {
    this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, {
      type: "CLEAR_ERROR",
    });
    setHeroExprFormErrorDisplay(this.heroPanel, null);
    setHeroExprSuccessDisplay(this.heroPanel, null);
  }

  private persistHeroPointSnapshot(detail: HeroDetail | null | undefined): void {
    const snap = heroPointSnapshotFromDetail(detail);
    const heroId = detail?.hero_id;
    if (!heroId || !snap) return;
    this.heroPointSnapshotByHeroId.set(heroId, snap);
  }

  private persistHeroExprSnapshot(detail: HeroDetail | null | undefined): void {
    const snap = heroExprSnapshotFromDetail(detail);
    const heroId = detail?.hero_id;
    if (!heroId) return;
    if (!snap) {
      this.heroExprSnapshotByHeroId.delete(heroId);
      return;
    }
    this.heroExprSnapshotByHeroId.set(heroId, snap);
  }

  private clearHeroExprCountdownTimer(): void {
    if (this.heroExprCountdownTimer != null) {
      window.clearInterval(this.heroExprCountdownTimer);
      this.heroExprCountdownTimer = null;
    }
  }

  private ensureHeroExprCountdownTimer(): void {
    const inExpr = isHeroExprInProgress(this.heroDetail);
    if (!inExpr) {
      this.clearHeroExprCountdownTimer();
      return;
    }
    if (this.heroExprCountdownTimer != null) return;
    this.heroExprCountdownTimer = window.setInterval(() => {
      const { wallet } = this.sessionEconomy();
      syncHeroDetailExprControls(
        this.heroPanel,
        this.heroExprSubmitState,
        this.heroDetail,
        wallet,
        this.heroExprHoursPref,
        Date.now(),
      );
      if (!isHeroExprInProgress(this.heroDetail)) {
        this.clearHeroExprCountdownTimer();
      }
    }, 1000);
  }

  private getHeroLargessNextAtMs(): number | null {
    const heroId = this.selectedHeroId;
    if (!heroId) return null;
    return this.heroLargessNextAtByHeroId.get(heroId) ?? null;
  }

  private clearHeroLargessCooldownTimer(): void {
    if (this.heroLargessCooldownTimer != null) {
      window.clearInterval(this.heroLargessCooldownTimer);
      this.heroLargessCooldownTimer = null;
    }
  }

  private ensureHeroLargessCooldownTimer(): void {
    const nextAt = this.getHeroLargessNextAtMs();
    const onCd = nextAt != null && nextAt > Date.now();
    if (!onCd) {
      this.clearHeroLargessCooldownTimer();
      return;
    }
    if (this.heroLargessCooldownTimer != null) return;
    this.heroLargessCooldownTimer = window.setInterval(() => {
      const heroNext = this.getHeroLargessNextAtMs();
      const now = Date.now();
      syncHeroDetailLargessCooldownDisplay(this.heroPanel, heroNext, now);
      const { bag, wallet } = this.sessionEconomy();
      syncHeroDetailLargessSubmitButton(
        this.heroPanel,
        this.heroLargessSubmitState,
        this.heroDetail,
        bag,
        wallet,
        this.heroLargessGiftMode,
        this.heroLargessItemCfgId,
        heroNext,
        now,
      );
      if (!heroNext || heroNext <= now) {
        this.clearHeroLargessCooldownTimer();
        this.renderHeroList();
      }
    }, 1000);
  }

  private persistHeroListSelectedFromListView(heroId: number): void {
    const scrollTop = readHeroPanelListScrollTop(this.heroPanel);
    writeHeroListSelectedSession({ heroId, scrollTop });
    const captured = captureHeroListReturnPayload(
      this.heroPanel,
      this.heroListFilter,
      this.heroListSort,
      heroId,
    );
    if (captured) writeHeroListReturnState(captured);
  }

  private restoreHeroListFromReturnState(): void {
    const snap = consumeHeroListReturnState();
    const highlightHeroId = snap?.heroId ?? 0;
    if (snap) {
      this.heroListFilter = snap.filter;
      this.heroListSort = snap.sort;
      writeHeroListFilterSession(snap.filter);
      writeHeroListSortSession(snap.sort);
      this.persistHeroListFilterChipResidual();
      this.selectedHeroId = pickRestoredHeroId(this.heroes, snap.heroId) ?? snap.heroId;
      applyHeroListReturnScroll(this.heroPanel, snap.scrollTop);
      writeHeroListSelectedSession({
        heroId: this.selectedHeroId,
        scrollTop: snap.scrollTop,
      });
    }
    this.heroDetailCollapsed = true;
    this.heroDetailListContext = null;
    this.renderHeroList();
    if (this.selectedHeroId > 0) {
      scrollHeroListRowIntoView(this.heroPanel, this.selectedHeroId);
      if (highlightHeroId > 0) {
        scheduleHeroRowReturnHighlight(this.heroPanel, highlightHeroId);
      }
    }
    this.onStatus(snap ? "已返回将领列表" : "列表已展开");
  }

  private async loadHeroDetail(
    heroId: number,
    opts?: { skipListSelectionWrite?: boolean; fromHeroList?: boolean },
  ): Promise<void> {
    const sid = this.serverId();
    this.selectedHeroId = heroId;
    this.heroDetailCollapsed = false;
    writeHeroDetailSelectedSession(heroId);
    if (opts?.fromHeroList) {
      this.heroDetailListContext = {
        filter: this.heroListFilter,
        sort: this.heroListSort,
      };
    } else if (!opts?.skipListSelectionWrite) {
      this.heroDetailListContext = null;
    }
    if (!opts?.skipListSelectionWrite) this.persistHeroListSelectedFromListView(heroId);
    this.resetHeroCultivationSubmitFeedback();
    this.resetHeroLargessSubmitFeedback();
    this.resetHeroUpgradeSubmitFeedback();
    this.resetHeroPointSubmitFeedback();
    this.resetHeroForceSubmitFeedback();
    this.resetHeroExprSubmitFeedback();
    this.heroDetailLoading = true;
    this.heroDetailError = null;
    this.renderHeroList();
    this.onStatus(`将领详情 #${heroId}…`);
    try {
      const res = await this.gateway.getHeroDetail(sid, heroId);
      const parsed = parseGetHeroDetailResponse(res);
      this.heroDetail = mergeHeroExprSnapshot(
        mergeHeroPointSnapshot(parsed, this.heroPointSnapshotByHeroId.get(heroId) ?? null),
        this.heroExprSnapshotByHeroId.get(heroId) ?? null,
      );
      this.persistHeroPointSnapshot(this.heroDetail);
      persistHeroMarchForceFromDetail(this.heroDetail);
      this.persistHeroExprSnapshot(this.heroDetail);
      this.ensureHeroExprCountdownTimer();
      this.heroes = syncHeroSummaryFromDetail(this.heroes, this.heroDetail);
      this.heroDetailError = null;
      this.onStatus("详情已加载");
    } catch (e) {
      this.heroDetail = null;
      this.heroDetailError = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.onStatus(this.heroDetailError);
    } finally {
      this.heroDetailLoading = false;
      this.renderHeroList();
    }
  }

  private async upgradeSelectedHero(): Promise<void> {
    if (this.heroUpgradeSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    const detailBefore = this.heroDetail;
    this.heroUpgradeSubmitState = useConsumableSubmitStateMachine(this.heroUpgradeSubmitState, {
      type: "SUBMIT",
    });
    setHeroUpgradeFormErrorDisplay(this.heroPanel, null);
    setHeroUpgradeSuccessDisplay(this.heroPanel, null);
    syncHeroDetailUpgradeButton(this.heroPanel, this.heroUpgradeSubmitState, this.heroDetail);
    const sid = this.serverId();
    this.onStatus("将领升级…");
    try {
      const res = await this.gateway.upgradeHero(sid, heroId);
      const detailAfter = applyUpgradeHeroToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroUpgradeSubmitState = useConsumableSubmitStateMachine(this.heroUpgradeSubmitState, {
        type: "SUCCESS",
      });
      this.renderHeroList();
      const statusText = formatHeroUpgradeSuccessStatus(detailBefore, detailAfter);
      setHeroUpgradeSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroUpgradeSubmitState = useConsumableSubmitStateMachine(this.heroUpgradeSubmitState, {
        type: "FAIL",
      });
      const msg = formatHeroUpgradeGatewayErrorFromUnknown(e);
      setHeroUpgradeFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      syncHeroDetailUpgradeButton(this.heroPanel, this.heroUpgradeSubmitState, this.heroDetail);
    }
  }

  private async addHeroPointForStat(stat: HeroPointAllocStat): Promise<void> {
    if (this.heroPointSubmitState === "submitting" || !this.selectedHeroId || !this.heroDetail) return;
    const heroId = this.selectedHeroId;
    const targets = buildAddHeroPointTargets(this.heroDetail, stat);
    this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
      type: "SUBMIT",
    });
    setHeroPointFormErrorDisplay(this.heroPanel, null);
    setHeroPointSuccessDisplay(this.heroPanel, null);
    syncHeroDetailPointsControls(this.heroPanel, this.heroPointSubmitState, this.heroDetail);
    const sid = this.serverId();
    this.onStatus("潜力加点…");
    try {
      const res = await this.gateway.addHeroPoint(sid, heroId, targets);
      const detailAfter = applyHeroPointResultToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroPointSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
        type: "SUCCESS",
      });
      this.renderHeroList();
      const statusText = formatHeroPointAddSuccessStatus(stat);
      setHeroPointSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
        type: "FAIL",
      });
      const msg = formatHeroPointGatewayErrorFromUnknown(e);
      setHeroPointFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      syncHeroDetailPointsControls(this.heroPanel, this.heroPointSubmitState, this.heroDetail);
    }
  }

  private async restHeroForceSelected(): Promise<void> {
    if (this.heroForceSubmitState === "submitting" || !this.selectedHeroId || !this.heroDetail) return;
    const heroId = this.selectedHeroId;
    this.heroForceSubmitState = useConsumableSubmitStateMachine(this.heroForceSubmitState, {
      type: "SUBMIT",
    });
    setHeroForceFormErrorDisplay(this.heroPanel, null);
    setHeroForceSuccessDisplay(this.heroPanel, null);
    syncHeroDetailForceControls(this.heroPanel, this.heroForceSubmitState, this.heroDetail);
    const sid = this.serverId();
    this.onStatus("将领休整…");
    try {
      const res = await this.gateway.restHero(sid, heroId);
      const detailAfter = applyRestHeroToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      persistHeroMarchForceFromDetail(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroForceSubmitState = useConsumableSubmitStateMachine(this.heroForceSubmitState, {
        type: "SUCCESS",
      });
      this.renderHeroList();
      const statusText = formatHeroRestSuccessStatus(detailAfter);
      setHeroForceSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroForceSubmitState = useConsumableSubmitStateMachine(this.heroForceSubmitState, {
        type: "FAIL",
      });
      const msg = formatHeroForceGatewayErrorFromUnknown(e);
      setHeroForceFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      syncHeroDetailForceControls(this.heroPanel, this.heroForceSubmitState, this.heroDetail);
    }
  }

  private async clearHeroPointsSelected(): Promise<void> {
    if (this.heroPointSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
      type: "SUBMIT",
    });
    setHeroPointFormErrorDisplay(this.heroPanel, null);
    setHeroPointSuccessDisplay(this.heroPanel, null);
    syncHeroDetailPointsControls(this.heroPanel, this.heroPointSubmitState, this.heroDetail);
    const sid = this.serverId();
    this.onStatus("潜力洗点…");
    try {
      const res = await this.gateway.clearHeroPoint(sid, heroId);
      const detailAfter = applyHeroPointResultToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroPointSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
        type: "SUCCESS",
      });
      this.renderHeroList();
      const statusText = formatHeroPointClearSuccessStatus(detailAfter);
      setHeroPointSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroPointSubmitState = useConsumableSubmitStateMachine(this.heroPointSubmitState, {
        type: "FAIL",
      });
      const msg = formatHeroPointGatewayErrorFromUnknown(e);
      setHeroPointFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      syncHeroDetailPointsControls(this.heroPanel, this.heroPointSubmitState, this.heroDetail);
    }
  }

  private syncHeroExprControlsNow(): void {
    const { wallet } = this.sessionEconomy();
    syncHeroDetailExprControls(
      this.heroPanel,
      this.heroExprSubmitState,
      this.heroDetail,
      wallet,
      this.heroExprHoursPref,
      Date.now(),
    );
  }

  private async beginHeroExprSelected(): Promise<void> {
    if (this.heroExprSubmitState === "submitting" || !this.selectedHeroId || !this.heroDetail) return;
    const heroId = this.selectedHeroId;
    const hours = normalizeHeroExprHours(this.heroExprHoursPref);
    this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUBMIT" });
    setHeroExprFormErrorDisplay(this.heroPanel, null);
    setHeroExprSuccessDisplay(this.heroPanel, null);
    this.syncHeroExprControlsNow();
    const sid = this.serverId();
    this.onStatus("开始历练…");
    try {
      const res = await this.gateway.beginHeroExpr(sid, heroId, hours);
      const detailAfter = applyBeginHeroExprToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroExprSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      const session = this.getSession();
      if (session && res.gold_spent > 0) {
        const nextWallet = { ...session.wallet, gold: (session.wallet.gold ?? 0) - res.gold_spent };
        this.onSessionPatch({ wallet: nextWallet });
      }
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUCCESS" });
      this.renderHeroList();
      const statusText = formatHeroExprBeginSuccessStatus(res);
      setHeroExprSuccessDisplay(this.heroPanel, statusText);
      this.ensureHeroExprCountdownTimer();
      this.onStatus(statusText);
    } catch (e) {
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "FAIL" });
      const msg = formatHeroExprGatewayErrorFromUnknown(e);
      setHeroExprFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      this.syncHeroExprControlsNow();
    }
  }

  private async cancelHeroExprSelected(): Promise<void> {
    if (this.heroExprSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUBMIT" });
    setHeroExprFormErrorDisplay(this.heroPanel, null);
    setHeroExprSuccessDisplay(this.heroPanel, null);
    this.syncHeroExprControlsNow();
    const sid = this.serverId();
    this.onStatus("取消历练…");
    try {
      const res = await this.gateway.cancelHeroExpr(sid, heroId);
      const detailAfter = applyCancelHeroExprToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroExprSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUCCESS" });
      this.clearHeroExprCountdownTimer();
      this.renderHeroList();
      const statusText = formatHeroExprCancelSuccessStatus();
      setHeroExprSuccessDisplay(this.heroPanel, statusText);
      this.onStatus(statusText);
    } catch (e) {
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "FAIL" });
      const msg = formatHeroExprGatewayErrorFromUnknown(e);
      setHeroExprFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      this.syncHeroExprControlsNow();
    }
  }

  private async finishHeroExprSelected(): Promise<void> {
    if (this.heroExprSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUBMIT" });
    setHeroExprFormErrorDisplay(this.heroPanel, null);
    setHeroExprSuccessDisplay(this.heroPanel, null);
    this.syncHeroExprControlsNow();
    const sid = this.serverId();
    this.onStatus("领取历练经验…");
    try {
      const res = await this.gateway.finishHeroExpr(sid, heroId);
      const detailAfter = applyHeroExprFinishToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroExprSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUCCESS" });
      this.clearHeroExprCountdownTimer();
      this.renderHeroList();
      const statusText = formatHeroExprFinishSuccessStatus(res);
      setHeroExprSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "FAIL" });
      const msg = formatHeroExprGatewayErrorFromUnknown(e);
      setHeroExprFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      this.syncHeroExprControlsNow();
    }
  }

  private async fasterHeroExprSelected(): Promise<void> {
    if (this.heroExprSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUBMIT" });
    setHeroExprFormErrorDisplay(this.heroPanel, null);
    setHeroExprSuccessDisplay(this.heroPanel, null);
    this.syncHeroExprControlsNow();
    const sid = this.serverId();
    this.onStatus("加速历练…");
    try {
      const res = await this.gateway.fasterHeroExpr(sid, heroId);
      const detailAfter = applyHeroExprFinishToDetail(this.heroDetail, res);
      this.heroDetail = detailAfter;
      this.persistHeroExprSnapshot(detailAfter);
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "SUCCESS" });
      this.clearHeroExprCountdownTimer();
      this.renderHeroList();
      const statusText = formatHeroExprFasterSuccessStatus(res);
      setHeroExprSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroExprSubmitState = useConsumableSubmitStateMachine(this.heroExprSubmitState, { type: "FAIL" });
      const msg = formatHeroExprGatewayErrorFromUnknown(e);
      setHeroExprFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      this.syncHeroExprControlsNow();
    }
  }

  private async useHeroCultivationItem(): Promise<void> {
    if (this.heroCultivationSubmitState === "submitting" || !this.selectedHeroId) return;
    const { bag } = this.sessionEconomy();
    const validated = validateHeroDetailCultivationUse(bag);
    if (!validated.ok || !validated.itemCfgId) {
      setHeroCultivationFormErrorDisplay(this.heroPanel, validated.message);
      this.onStatus(validated.message);
      this.renderHeroList();
      return;
    }
    const itemId = validated.itemCfgId;
    const heroId = this.selectedHeroId;
    const detailBefore = this.heroDetail;
    this.heroCultivationSubmitState = useConsumableSubmitStateMachine(
      this.heroCultivationSubmitState,
      { type: "SUBMIT" },
    );
    setHeroCultivationFormErrorDisplay(this.heroPanel, null);
    setHeroCultivationSuccessDisplay(this.heroPanel, null);
    syncHeroDetailCultivationUseButton(this.heroPanel, this.heroCultivationSubmitState, bag, this.heroDetail);
    const sid = this.serverId();
    this.onStatus(`使用 ${itemId}×1…`);
    try {
      const res = (await this.gateway.useConsumable(sid, itemId, 1)) as {
        remaining?: number;
        wallet_after?: ResourceWallet;
        effect_summary?: string;
        speedup_seconds?: number;
      };
      const session = this.getSession();
      if (session) {
        const nextBag = applyUseResult(session.bag, itemId, res.remaining ?? 0);
        const wallet = res.wallet_after ? { ...res.wallet_after } : session.wallet;
        this.onSessionPatch({ bag: nextBag, wallet });
      }
      const detailRes = await this.gateway.getHeroDetail(sid, heroId);
      const detailAfter = parseGetHeroDetailResponse(detailRes);
      this.heroDetail = detailAfter;
      this.heroes = syncHeroSummaryFromDetail(this.heroes, detailAfter);
      this.heroCultivationSubmitState = useConsumableSubmitStateMachine(
        this.heroCultivationSubmitState,
        { type: "SUCCESS" },
      );
      this.renderHeroList();
      const statSummary = formatHeroDetailStatChangeSummary(detailBefore, detailAfter);
      const statusText = formatHeroDetailCultivationUseStatus(
        itemId,
        statSummary,
        formatUseConsumableEffectSummary(itemId, res),
      );
      setHeroCultivationSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.onStatus(statusText);
    } catch (e) {
      this.heroCultivationSubmitState = useConsumableSubmitStateMachine(
        this.heroCultivationSubmitState,
        { type: "FAIL" },
      );
      const msg = formatBagUseGatewayErrorFromUnknown(e);
      setHeroCultivationFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      const { bag: bagAfter } = this.sessionEconomy();
      syncHeroDetailCultivationUseButton(
        this.heroPanel,
        this.heroCultivationSubmitState,
        bagAfter,
        this.heroDetail,
      );
    }
  }

  private async submitHeroLargess(): Promise<void> {
    if (this.heroLargessSubmitState === "submitting" || !this.selectedHeroId) return;
    const heroId = this.selectedHeroId;
    const { bag, wallet } = this.sessionEconomy();
    const now = Date.now();
    const validated = validateHeroDetailLargessSubmit(
      this.heroDetail,
      bag,
      wallet,
      this.heroLargessGiftMode,
      this.heroLargessItemCfgId,
      this.getHeroLargessNextAtMs(),
      now,
    );
    if (!validated.ok) {
      setHeroLargessFormErrorDisplay(this.heroPanel, validated.message);
      this.onStatus(validated.message);
      this.renderHeroList();
      return;
    }
    const detailBefore = this.heroDetail;
    const itemCfgId = validated.itemCfgId ?? 0;
    this.heroLargessSubmitState = useConsumableSubmitStateMachine(this.heroLargessSubmitState, {
      type: "SUBMIT",
    });
    setHeroLargessFormErrorDisplay(this.heroPanel, null);
    setHeroLargessSuccessDisplay(this.heroPanel, null);
    syncHeroDetailLargessSubmitButton(
      this.heroPanel,
      this.heroLargessSubmitState,
      this.heroDetail,
      bag,
      wallet,
      this.heroLargessGiftMode,
      this.heroLargessItemCfgId,
      this.getHeroLargessNextAtMs(),
      now,
    );
    const sid = this.serverId();
    this.onStatus("赏赐中…");
    try {
      const raw = await this.gateway.largessHero(
        sid,
        heroId,
        largessGiftKindProto(this.heroLargessGiftMode),
        this.heroLargessGiftMode === "item" ? itemCfgId : 0,
      );
      const res = parseLargessHeroResponse(raw);
      if (res.next_largess_at_ms) {
        this.heroLargessNextAtByHeroId.set(heroId, res.next_largess_at_ms);
      }
      const session = this.getSession();
      if (session && res.gold_spent && res.gold_spent > 0) {
        const nextWallet = { ...session.wallet, gold: (session.wallet.gold ?? 0) - res.gold_spent };
        this.onSessionPatch({ wallet: nextWallet });
      }
      if (session && res.item_cfg_id) {
        const have = bag.find((s) => s.item_cfg_id === res.item_cfg_id)?.quantity ?? 0;
        const remaining = Math.max(0, have - 1);
        const nextBag = applyUseResult(session.bag, res.item_cfg_id, remaining);
        this.onSessionPatch({ bag: nextBag });
      }
      if (res.loyalty != null && this.heroDetail) {
        this.heroDetail = { ...this.heroDetail, loyalty: res.loyalty };
      }
      this.heroes = syncHeroSummaryFromLargess(this.heroes, res);
      this.heroLargessSubmitState = useConsumableSubmitStateMachine(this.heroLargessSubmitState, {
        type: "SUCCESS",
      });
      this.renderHeroList();
      const statusText = formatHeroLargessSuccessStatus(detailBefore, res);
      setHeroLargessSuccessDisplay(this.heroPanel, statusText);
      scheduleHeroDetailStatPulse(
        this.heroPanel.querySelector('[data-role="hero-detail"]') as HTMLElement | null,
      );
      this.ensureHeroLargessCooldownTimer();
      this.onStatus(statusText);
    } catch (e) {
      this.heroLargessSubmitState = useConsumableSubmitStateMachine(this.heroLargessSubmitState, {
        type: "FAIL",
      });
      const msg = formatHeroLargessGatewayErrorFromUnknown(e);
      setHeroLargessFormErrorDisplay(this.heroPanel, msg);
      this.renderHeroList();
      this.onStatus(msg);
    } finally {
      const econ = this.sessionEconomy();
      syncHeroDetailLargessSubmitButton(
        this.heroPanel,
        this.heroLargessSubmitState,
        this.heroDetail,
        econ.bag,
        econ.wallet,
        this.heroLargessGiftMode,
        this.heroLargessItemCfgId,
        this.getHeroLargessNextAtMs(),
        Date.now(),
      );
    }
  }

  private async refreshRecruitTemplates(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取招募模板…");
    try {
      const res = await this.gateway.listRecruitTemplates(sid, { pageSize: 50 });
      const { templates, totalCount } = parseRecruitTemplates(res as { templates?: RecruitTemplatePreview[]; total_count?: number });
      this.recruitTemplates = templates;
      const prev = this.selectedTemplateId;
      this.renderTemplateList();
      if (!prev && templates.length) {
        const pick = pickRecruitSelection(templates);
        if (pick) this.applyTemplateSelection(pick.templateCfgId);
      }
      this.onStatus(`招募模板 ${templates.length}/${totalCount} 条`);
    } catch (e) {
      this.recruitTemplates = [];
      this.renderTemplateList();
      this.onStatus((e as Error).message);
    }
  }

  private async fetchDailyRecruitRow(): Promise<DailyQuestRow | null> {
    const sid = this.serverId();
    const res = await this.gateway.listPlayerQuests(sid, {
      chainId: DAILY_QUEST_CHAIN_ID,
      includeCompleted: true,
    });
    const rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
    return findDailyRecruitQuest(rows);
  }

  private async syncEconomyAfterRecruit(): Promise<void> {
    const key = this.recruitSessionKey();
    const session = this.getSession();
    if (!session) return;
    let bag: BagStack[] = session.bag;
    let wallet: ResourceWallet = session.wallet;
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      bag = bagFromListPlayerBagResponse(bagRes.items);
    } catch {
      /* 保留会话背包 */
    }
    if (this.cityStateFetch) {
      const state = await this.cityStateFetch.fetch();
      if (state?.wallet) wallet = state.wallet;
    } else {
      try {
        const state = (await this.gateway.getCityState(session.cityId)) as { wallet?: ResourceWallet };
        if (state.wallet) wallet = state.wallet;
      } catch {
        /* 保留会话钱包 */
      }
    }
    if (key === this.recruitSessionKey()) this.onSessionPatch({ bag, wallet });
  }

  private async recruitHero(): Promise<void> {
    if (this.recruitHeroInflight || !this.recruitBagReady()) return;
    const sid = this.serverId();
    const tpl = this.selectedTemplateId;
    const itemId = this.recruitItemId;
    const templateRow = this.recruitTemplatesForDisplay().find((t) => t.template_cfg_id === tpl);
    if (!tpl) {
      this.onStatus("请先刷新并选择招募模板");
      return;
    }
    const walletBefore = this.sessionEconomy().wallet;
    const { wallet, bag } = this.sessionEconomy();
    const afford = compareRecruitAffordability(wallet, templateRow ?? {}, bag);
    if (!afford.canAfford) {
      setRecruitAffordabilityErrorDisplay(this.heroPanel, afford.insufficientReason);
      this.onStatus(afford.insufficientReason ?? "资源不足");
      return;
    }
    setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
    setRecruitSuccessToastDisplay(this.heroPanel, null);
    this.recruitHeroInflight = true;
    const recruitKey = this.recruitSessionKey();
    let dailyBefore: DailyQuestRow | null = null;
    try {
      dailyBefore = await this.fetchDailyRecruitRow();
    } catch {
      /* 日常列表失败不阻断招募 */
    }
    if (recruitKey !== this.recruitSessionKey() || this.heroPanel.classList.contains("hidden")) {
      this.recruitHeroInflight = false;
      return;
    }
    this.recruitLastError = null;
    syncRecruitSubmittingLine(this.heroPanel, true);
    this.syncRecruitFormInlineState(templateRow);
    this.onStatus(`招募模板 ${tpl}…`);
    try {
      const res = (await this.gateway.recruitHero(sid, tpl, {
        itemCfgId: itemId,
        pool: this.recruitPool,
      })) as {
        hero_id?: number;
        template_cfg_id?: number;
        level?: number;
        loyalty?: number;
      };
      if (recruitKey !== this.recruitSessionKey()) return;
      await this.syncEconomyAfterRecruit();
      if (recruitKey !== this.recruitSessionKey()) return;
      const { wallet: walletAfter, bag: bagAfter } = this.sessionEconomy();
      refreshRecruitWalletSweepDisplays(
        this.heroPanel,
        tpl,
        templateRow,
        walletAfter,
        bagAfter,
      );
      scheduleRecruitWalletSweepPulse(this.heroPanel, tpl);
      const pulseKeys = walletMaterialDeductPulseKeys(
        walletBefore,
        walletAfter,
        templateRow?.recruit_cost,
      );
      if (pulseKeys.length) this.onRecruitMaterialPulse?.(pulseKeys);
      if (res.hero_id) {
        this.selectedHeroId = res.hero_id;
        writeHeroDetailSelectedSession(res.hero_id);
      }
      await this.refreshHeroes();
      if (res.hero_id) {
        focusRecruitedHeroListRow(this.heroPanel, res.hero_id);
      }
      const feedback = buildRecruitSuccessFeedback(res, templateRow);
      let status = feedback.statusText;
      try {
        const dailyAfter = await this.fetchDailyRecruitRow();
        if (shouldPromptDailyRecruitAfterRecruit(dailyBefore, dailyAfter)) {
          await this.onDailyRecruitLoop?.();
          status = `${status} · ${formatRecruitDailyFollowUpHint()}`;
        }
      } catch {
        /* 忽略日常刷新失败 */
      }
      this.recruitLastSuccessHeroId = res.hero_id ?? null;
      this.recruitLastError = null;
      setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
      setRecruitSuccessToastDisplay(this.heroPanel, { ...feedback, statusText: status });
      this.onStatus(status);
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("recruit", e);
      this.recruitLastError = msg;
      this.recruitLastSuccessHeroId = null;
      setRecruitSuccessToastDisplay(this.heroPanel, null);
      this.onStatus(msg);
      setRecruitAffordabilityErrorDisplay(this.heroPanel, msg);
    } finally {
      this.recruitHeroInflight = false;
      syncRecruitSubmittingLine(this.heroPanel, false);
      const templateId =
        this.selectedRecruitTemplateRow()?.template_cfg_id ?? this.selectedTemplateId;
      if (templateId) this.applyTemplateSelection(templateId, { skipHeroListRender: true });
      else this.syncRecruitFormInlineState(undefined);
    }
  }

  private refreshMail(): Promise<void> {
    return this.refreshMailInner();
  }

  private async refreshMailInner(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取邮件…");
    this.mailListError = "";
    this.mailListLoading = true;
    this.renderMailList();
    try {
      const rpcFilter = resolveMailListPlayerMailFilter(this.mailFilter);
      const res = (await this.gateway.listPlayerMail(sid, {
        filter: rpcFilter,
        pageSize: 50,
      })) as {
        mails?: MailRow[];
        total_count?: number;
      };
      const page = res.mails ?? [];
      this.mailListRpcPage = [...page];
      this.mails = this.applyMailListClientFilters(page);
      if (rpcFilter === MAIL_INBOX_FILTER_ALL) {
        this.mailInboxSnapshot = [...page];
      } else {
        void this.refreshMailInboxSnapshot();
      }
      const unreadSnap = await this.pullMailUnreadSnapshot();
      this.mailUnreadTotal = unreadSnap.count;
      this.mailUnreadFirstId = unreadSnap.firstId;
      this.setMailFilterButtons();
      if (!this.selectedMailId && this.mails[0]?.mail_id) {
        this.selectedMailId = this.mails[0].mail_id!;
      } else if (
        this.selectedMailId &&
        !this.mails.some((m) => m.mail_id === this.selectedMailId)
      ) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      this.renderMailList();
      const total = res.total_count ?? this.mails.length;
      const filterLabel =
        this.mailFilter === MAIL_INBOX_FILTER_UNREAD
          ? "未读"
          : this.mailFilter === MAIL_INBOX_FILTER_UNCLAIMED
            ? "未领附件"
            : "全部";
      const sel = this.mails.find((m) => m.mail_id === this.selectedMailId) ?? null;
      const baseStatus = `邮件（${filterLabel}）${this.mails.length}/${total} 封`;
      this.onStatus(this.withMailWorldCoordHint(baseStatus, sel));
      this.applyMailBadgeCountsFromSnapshot();
      if (!this.isMailOpen()) void this.syncUnreadBadge();
    } catch (e) {
      this.mailListError = (e as Error).message || "加载收件箱失败，请稍后重试";
      this.mails = [];
      this.renderMailList();
      this.onStatus(this.mailListError);
    } finally {
      this.mailListLoading = false;
      this.renderMailList();
    }
  }

  private async markMailRead(mailId: number): Promise<void> {
    const sid = this.serverId();
    const row = this.mails.find((m) => m.mail_id === mailId);
    if (!row || !mailIsUnread(row)) return;
    try {
      const res = (await this.gateway.markPlayerMailRead(sid, mailId)) as { mail?: MailRow };
      if (res.mail) {
        this.mails = this.mails.map((m) => (m.mail_id === mailId ? { ...m, ...res.mail } : m));
        if (mailIsUnread(row)) {
          this.mailUnreadTotal = Math.max(0, this.mailUnreadTotal - 1);
        }
        this.patchMailInboxSnapshot(mailId, res.mail);
        if (this.mailFilter === MAIL_INBOX_FILTER_UNREAD) {
          this.mails = this.mails.filter((m) => m.mail_id !== mailId);
          if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
            this.selectedMailId = this.mails[0]?.mail_id ?? 0;
          }
        }
        this.renderMailList();
        this.applyMailBadgeCountsFromSnapshot();
      } else {
        await this.refreshMail();
      }
      if (!this.isMailOpen()) void this.syncUnreadBadge();
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private async openMail(mailId: number): Promise<void> {
    this.selectedMailId = mailId;
    this.renderMailList();
    const sel = this.mails.find((m) => m.mail_id === mailId) ?? null;
    if (sel && mailPlainTextHasWorldCoord(mailTitle(sel), sel.body ?? "")) {
      this.onStatus(appendMailWorldCoordStatusHint("已打开邮件"));
    }
    await this.markMailRead(mailId);
  }

  private async syncBagFromServer(): Promise<BagStack[] | null> {
    const session = this.getSession();
    if (!session) return null;
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const bag = bagFromListPlayerBagResponse(bagRes.items);
      this.onSessionPatch({ bag });
      return bag;
    } catch {
      return null;
    }
  }

  private async claimMailAttachmentsForId(
    mailId: number,
  ): Promise<
    | {
        ok: true;
        granted?: {
          items?: { item_cfg_id?: number; quantity?: number }[];
          resources?: ResourceWallet;
        };
      }
    | { ok: false; message: string }
  > {
    const sid = this.serverId();
    const mailBeforeClaim = this.mails.find((m) => m.mail_id === mailId);
    try {
      const res = (await this.gateway.claimPlayerMailAttachments(sid, mailId)) as {
        mail?: MailRow;
        granted?: {
          items?: { item_cfg_id?: number; quantity?: number }[];
          resources?: ResourceWallet;
        };
        wallet_after?: MainCitySession["wallet"];
        bag_items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const session = this.getSession();
      const claimPatch = session
        ? applyMailClaimResult(this.mails, mailId, res, session)
        : null;
      const nextMails = claimPatch?.mails ?? syncMailRowAfterClaim(this.mails, mailId, res);
      this.applyMailsAfterClaim(nextMails, mailId);
      if (claimPatch) {
        this.onSessionPatch({ bag: claimPatch.bag, wallet: claimPatch.wallet });
      }
      this.mailBatchSelected.delete(mailId);
      const updatedRow =
        nextMails.find((m) => m.mail_id === mailId) ??
        syncMailRowAfterClaim([], mailId, res).find((m) => m.mail_id === mailId);
      if (updatedRow) {
        this.applyHudMailQuestBadgeAfterClaim(mailId, updatedRow, res.granted, mailBeforeClaim);
      }
      this.applyMailBadgeCountsFromSnapshot();
      return { ok: true, granted: res.granted };
    } catch (e) {
      return { ok: false, message: gatewayErrorMessage(e) };
    }
  }

  private async claimMail(): Promise<void> {
    const mailId = this.selectedMailId;
    if (!mailId) {
      this.onStatus("请选择邮件");
      return;
    }
    if (this.claimMailInflight) return;
    this.mailListError = "";
    this.setMailFormError(null);
    this.claimMailInflight = mailId;
    this.renderMailList();
    this.onStatus(`领取附件 #${mailId}…`);
    const step = await this.claimMailAttachmentsForId(mailId);
    let pulseMailId = 0;
    try {
      if (step.ok) {
        pulseMailId = mailId;
        this.rememberMailClaimInlineSuccess(mailId, step.granted);
        this.renderMailList();
        await this.syncBagFromServer();
        const snap = await this.pullMailUnreadSnapshot();
        this.mailUnreadTotal = snap.count;
        this.mailUnreadFirstId = snap.firstId;
        this.applyMailBadgeCountsFromSnapshot();
        const summary = formatMailClaimGrantedSummary(step.granted);
        this.onStatus(`领取成功：${summary}`);
      } else {
        this.mailListError = step.message;
        this.setMailFormError(step.message);
        this.onStatus(step.message);
      }
    } finally {
      this.claimMailInflight = 0;
      this.renderMailList();
      if (pulseMailId > 0) this.pulseMailRowAfterClaim(pulseMailId);
    }
  }

  private async claimMailBatch(): Promise<void> {
    if (this.claimMailInflight) return;
    const ordered = orderBatchClaimMailIds(this.mails, this.mailBatchSelected);
    const validated = validateBatchClaimMailSelection({ mails: this.mails, selectedMailIds: ordered });
    if (!validated.ok) {
      this.setMailFormError(validated.message);
      this.onStatus(validated.message);
      return;
    }
    await this.runSequentialMailClaims(ordered, `批量领取 ${ordered.length} 封（逐封）…`);
  }

  private async claimMailAll(): Promise<void> {
    if (this.claimMailInflight) return;
    const validated = validateClaimAllUnclaimedMail(this.mails);
    if (!validated.ok) {
      this.setMailFormError(validated.message);
      this.onStatus(validated.message);
      return;
    }
    const ordered = selectAllUnclaimedMailIds(this.mails);
    await this.runSequentialMailClaims(ordered, `领取全部附件 ${ordered.length} 封（逐封）…`);
  }

  private async runSequentialMailClaims(ordered: number[], statusPrefix: string): Promise<void> {
    this.mailListError = "";
    this.setMailFormError(null);
    this.mailBatchClaimFailedIds.clear();
    this.claimMailInflight = -1;
    this.renderMailList();
    this.onStatus(statusPrefix);
    const attempts: ({ ok: true } | { ok: false; message: string })[] = [];
    const pulseMailIds: number[] = [];
    try {
      for (const mailId of ordered) {
        const step = await this.claimMailAttachmentsForId(mailId);
        attempts.push(step.ok ? { ok: true } : { ok: false, message: step.message });
        if (step.ok) pulseMailIds.push(mailId);
        else this.mailBatchClaimFailedIds.add(mailId);
        this.renderMailList();
      }
      await this.syncBagFromServer();
      const snap = await this.pullMailUnreadSnapshot();
      this.mailUnreadTotal = snap.count;
      this.mailUnreadFirstId = snap.firstId;
      this.applyMailBadgeCountsFromSnapshot();
      const summary = batchClaimSummary(attempts);
      if (summary.lastError) {
        this.mailListError = summary.lastError;
        this.setMailFormError(summary.lastError);
      }
      this.onStatus(summary.summaryText);
    } finally {
      this.claimMailInflight = 0;
      this.renderMailList();
      for (const id of pulseMailIds) this.pulseMailRowAfterClaim(id);
    }
  }

  /** 领取后局部更新列表行；未读筛选下已读/已领行移出当前页。 */
  private applyMailsAfterClaim(nextMails: MailRow[], mailId: number): void {
    const updated = nextMails.find((m) => m.mail_id === mailId);
    if (this.mailFilter === MAIL_INBOX_FILTER_UNREAD && updated && !mailIsUnread(updated)) {
      this.mails = nextMails.filter((m) => m.mail_id !== mailId);
      if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      return;
    }
    if (
      this.mailFilter === MAIL_INBOX_FILTER_UNCLAIMED &&
      updated &&
      !mailHasUnclaimedAttachments(updated)
    ) {
      this.mails = nextMails.filter((m) => m.mail_id !== mailId);
      if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      return;
    }
    this.mails = nextMails;
  }

  private onHeroChange(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "template-select") {
      const id = Number((t as HTMLSelectElement).value) || 0;
      if (id) this.applyTemplateSelection(id);
      return;
    }
    if (t.getAttribute("data-field") === "hero-largess-item") {
      this.heroLargessItemCfgId = Number((t as HTMLSelectElement).value) || null;
      this.renderHeroList();
      return;
    }
    const kindInput = t.closest('input[data-action="hero-largess-kind"]');
    if (kindInput && (kindInput as HTMLInputElement).checked) {
      const mode = (kindInput as HTMLInputElement).value;
      if (mode === "gold" || mode === "item") {
        this.heroLargessGiftMode = mode;
        if (mode === "item" && !this.heroLargessItemCfgId) {
          this.heroLargessItemCfgId = pickDefaultLargessItemCfgId(this.sessionEconomy().bag);
        }
        this.renderHeroList();
      }
    }
  }

  private onHeroClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    const btnAction = btn?.getAttribute("data-action");
    if (btnAction && ["captive-summon-confirm", "captive-release", "persuade-primary", "coming-accept-confirm", "coming-reject"].includes(btnAction)) {
      const info = btn?.closest("section")?.querySelector<HTMLDetailsElement>(".hero-capture-info");
      if (info && !info.open) {
        info.open = true;
        this.onStatus("请核对目标与消耗，再点击操作按钮确认");
        return;
      }
    }
    if (btnAction === "recruit-view-hero") {
      const heroId = Number(btn?.getAttribute("data-hero-id"));
      if (heroId > 0) void this.loadHeroDetail(heroId);
      return;
    }
    if (btnAction === "hero-back-to-list") {
      this.restoreHeroListFromReturnState();
      return;
    }
    const tplLi = (ev.target as HTMLElement).closest("li[data-template-id]");
    if (tplLi && !btn) {
      const id = Number(tplLi.getAttribute("data-template-id"));
      if (id) this.applyTemplateSelection(id);
      return;
    }
    const hotelLi = (ev.target as HTMLElement).closest("li.hotel-candidate-row[data-candidate-id]");
    if (hotelLi && !btn) {
      const id = Number(hotelLi.getAttribute("data-candidate-id"));
      if (id > 0) {
        this.selectedHotelCandidateId = id;
        setHotelRecruitFormError(this.heroPanel, null);
        this.syncHotelRecruitUi();
      }
      return;
    }
    const captiveLi = (ev.target as HTMLElement).closest("li.captive-hero-row[data-captive-id]");
    if (captiveLi && !btn) {
      const id = Number(captiveLi.getAttribute("data-captive-id"));
      if (id > 0) {
        this.selectedCaptiveHeroId = id;
        setCaptiveHeroFormError(this.heroPanel, null);
        this.captiveSummonPreview = null;
        this.syncCaptiveHeroUi();
        void this.prefetchCaptiveSummonPreview();
      }
      return;
    }
    const persuadeLi = (ev.target as HTMLElement).closest("li.persuade-target-row[data-npc-cfg-id]");
    if (persuadeLi && !btn) {
      const id = Number(persuadeLi.getAttribute("data-npc-cfg-id"));
      if (id > 0) {
        this.selectedPersuadeNpcId = id;
        setPersuadeFormError(this.heroPanel, null);
        this.syncPersuadeUi();
      }
      return;
    }
    const comingLi = (ev.target as HTMLElement).closest("li.coming-hero-row[data-coming-id]");
    if (comingLi && !btn) {
      const id = Number(comingLi.getAttribute("data-coming-id"));
      if (id > 0) {
        this.selectedComingHeroId = id;
        setComingHeroFormError(this.heroPanel, null);
        this.comingAcceptPreview = null;
        this.syncComingHeroUi();
        void this.prefetchComingAcceptPreview();
      }
      return;
    }
    const li = (ev.target as HTMLElement).closest("li[data-hero-id]");
    if (li && !btn) {
      const id = Number(li.getAttribute("data-hero-id"));
      if (id) void this.loadHeroDetail(id, { fromHeroList: true });
      return;
    }
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-heroes" || a === "retry-refresh-heroes") {
      void this.refreshHeroes({ pulseOnSuccess: true });
    }
    if (a === "hero-filter-all") {
      this.heroListFilter = "all";
      writeHeroListFilterSession(this.heroListFilter);
      this.persistHeroListFilterChipResidual("hero-filter-all");
      this.renderHeroList();
    }
    if (a === "hero-filter-deployable") {
      this.heroListFilter = "deployable";
      writeHeroListFilterSession(this.heroListFilter);
      this.persistHeroListFilterChipResidual("hero-filter-deployable");
      this.renderHeroList();
    }
    if (a === "hero-sort-level") {
      this.heroListSort = "level_desc";
      writeHeroListSortSession(this.heroListSort);
      this.persistHeroListFilterChipResidual("hero-sort-level");
      this.renderHeroList();
    }
    if (a === "hero-sort-loyalty") {
      this.heroListSort = "loyalty_desc";
      writeHeroListSortSession(this.heroListSort);
      this.persistHeroListFilterChipResidual("hero-sort-loyalty");
      this.renderHeroList();
    }
    if (a === "retry-recruit-bag") void this.ensureRecruitBag();
    if (a === "refresh-templates") void this.refreshRecruitTemplates();
    if (a === "refresh-hotel-candidates") void this.refreshHotelCandidates();
    if (a === "refresh-hotel-pool") void this.refreshHotelPool();
    if (a === "recruit-hotel-candidate") void this.recruitHotelCandidate();
    if (a === "refresh-captive-list") void this.refreshCaptiveHeroes();
    if (a === "captive-summon-confirm") void this.confirmCaptiveSummon();
    if (a === "captive-release") void this.releaseSelectedCaptive();
    if (a === "refresh-persuade-targets") void this.refreshPersuadeTargets();
    if (a === "persuade-primary") void this.runPersuadePrimary();
    if (a === "refresh-coming-list") void this.refreshComingHeroes();
    if (a === "coming-accept-confirm") void this.confirmComingAccept();
    if (a === "coming-reject") void this.rejectSelectedComing();
    if (a === "recruit-hero") void this.recruitHero();
    if (a === "recruit-open-hero-detail") {
      const heroId = Number(btn.getAttribute("data-hero-id"));
      if (heroId > 0) void this.loadHeroDetail(heroId);
      return;
    }
    if (a === "hero-goto-recruit") void this.openRecruitForCurrentHero();
    if (a === "hero-related-items") void this.openRelatedCultivationItems();
    if (a === "hero-goto-bag-cultivation") void this.openHeroBagCultivationDeepLink();
    if (a === "recruit-goto-bag-item-gap") void this.openRecruitItemGapBagDeepLink(btn);
    if (a === "hero-use-cultivation-item") void this.useHeroCultivationItem();
    if (a === "hero-largess-submit") void this.submitHeroLargess();
    if (a === "hero-upgrade") void this.upgradeSelectedHero();
    if (a === "hero-point-add") {
      const stat = btn.getAttribute("data-stat");
      if (stat === "force" || stat === "intel" || stat === "politics") {
        void this.addHeroPointForStat(stat);
      }
    }
    if (a === "hero-point-clear") void this.clearHeroPointsSelected();
    if (a === "hero-force-rest") void this.restHeroForceSelected();
    if (a === "hero-expr-hours") {
      const h = Number(btn.getAttribute("data-hours"));
      if (h >= 1 && h <= 4) {
        this.heroExprHoursPref = h;
        this.syncHeroExprControlsNow();
      }
    }
    if (a === "hero-expr-begin") void this.beginHeroExprSelected();
    if (a === "hero-expr-cancel") void this.cancelHeroExprSelected();
    if (a === "hero-expr-finish") void this.finishHeroExprSelected();
    if (a === "hero-expr-faster") void this.fasterHeroExprSelected();
  }

  private async openRecruitForCurrentHero(): Promise<void> {
    const tplId = this.heroDetail?.template_cfg_id;
    if (!tplId) {
      this.onStatus("请先点选将领加载详情");
      return;
    }
    if (!this.recruitTemplates.length) await this.refreshRecruitTemplates();
    writeRecruitScrollAnchorSession(tplId);
    this.applyTemplateSelection(tplId);
    applyRecruitScrollAnchorSession(this.heroPanel);
    this.onStatus(`招募区已预选模板 #${tplId}`);
  }

  private openRecruitItemGapBagDeepLink(btn: HTMLElement): void {
    const itemCfgId = Number(btn.dataset.itemCfgId) || 0;
    if (itemCfgId <= 0) {
      this.onStatus("暂无招募道具缺口可定位");
      return;
    }
    if (!this.onOpenHeroCultivationBag) {
      this.onStatus(`养成道具 item_cfg_id=${itemCfgId}`);
      return;
    }
    const link = buildRecruitItemGapBagDeepLink(itemCfgId);
    this.onOpenHeroCultivationBag(link);
    setRecruitAffordabilityErrorDisplay(this.heroPanel, null);
    this.onStatus(`背包已高亮招募所需道具 ${itemCfgId}，请查看持有数量`);
  }

  private async openHeroBagCultivationDeepLink(): Promise<void> {
    const heroId = this.selectedHeroId;
    let items = this.sessionEconomy().bag;
    const sid = this.serverId();
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      items = bagFromListPlayerBagResponse(bagRes.items);
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("bag", e);
      setHeroCultivationFormErrorDisplay(this.heroPanel, msg);
      this.onStatus(msg);
      return;
    }
    const pick = pickHeroDetailBagDeepLink(heroId, items);
    if (!pick.ok) {
      setHeroCultivationFormErrorDisplay(this.heroPanel, pick.errorMessage);
      this.onStatus(pick.errorMessage);
      this.renderHeroList();
      return;
    }
    setHeroCultivationFormErrorDisplay(this.heroPanel, null);
    if (this.onOpenHeroCultivationBag) {
      const link = buildHeroBagDeepLinkQuery({
        highlightItemId: pick.itemCfgId,
        bagCategory: pick.bagCategory,
        returnHeroId: heroId,
        openSource: "hero",
      });
      this.onOpenHeroCultivationBag(link);
      this.onStatus(`背包已定位 ${pick.itemCfgId}，请「使用道具」`);
      return;
    }
    this.onStatus(`养成道具 item_cfg_id=${pick.itemCfgId}`);
  }

  private async openRelatedCultivationItems(): Promise<void> {
    const sid = this.serverId();
    let items = this.sessionEconomy().bag;
    try {
      const bagRes = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      items = bagFromListPlayerBagResponse(bagRes.items);
    } catch {
      /* 使用会话背包快照 */
    }
    const ids = filterHeroCultivationBagItemIds(items);
    if (this.onOpenHeroCultivationBag) {
      const first = ids[0] ?? 0;
      if (first > 0) {
        this.onOpenHeroCultivationBag(
          buildHeroBagDeepLinkQuery({
            highlightItemId: first,
            returnHeroId: this.selectedHeroId,
            openSource: "hero",
          }),
        );
      }
      return;
    }
    this.onStatus(ids.length ? `养成道具 item_cfg_id：${ids.join("、")}` : "背包暂无养成消耗品（将魂碎晶等）");
  }

  private onMailChange(ev: Event): void {
    const t = ev.target as HTMLInputElement;
    if (t.getAttribute("data-role") !== "mail-batch-checkbox") return;
    const id = Number(t.dataset.mailId) || 0;
    if (!id) return;
    if (t.checked) this.mailBatchSelected.add(id);
    else this.mailBatchSelected.delete(id);
    this.syncBatchClaimButton();
  }

  private onMailClick(ev: Event): void {
    if ((ev.target as HTMLElement).closest("label.mail-batch-pick")) return;
    const li = (ev.target as HTMLElement).closest("li[data-mail-id]");
    if (li) {
      const id = Number(li.getAttribute("data-mail-id"));
      if (id) void this.openMail(id);
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-mail") void this.refreshMail();
    if (a === "mail-filter-all") {
      this.mailFilter = MAIL_INBOX_FILTER_ALL;
      writeMailInboxFilterSession(this.mailFilter);
      void this.refreshMail();
    }
    if (a === "mail-filter-unread") {
      this.mailFilter = MAIL_INBOX_FILTER_UNREAD;
      writeMailInboxFilterSession(this.mailFilter);
      void this.refreshMail();
      return;
    }
    if (a === "mail-filter-unclaimed") {
      this.mailFilter = MAIL_INBOX_FILTER_UNCLAIMED;
      writeMailInboxFilterSession(this.mailFilter);
      void this.refreshMail();
    }
    if (a === "claim-mail") void this.claimMail();
    if (a === "claim-mail-all") void this.claimMailAll();
    if (a === "claim-mail-batch") void this.claimMailBatch();
    if (a === "mail-open-battle-report") {
      const reportRaw = btn.dataset.reportId;
      const reportId = reportRaw ? Number(reportRaw) : 0;
      const sel = this.mails.find((m) => m.mail_id === this.selectedMailId) ?? null;
      if (sel && this.mailBattleCategory === "battle") {
        stageReportOutcomeFilterBridgeFromMail({
          title: mailTitle(sel),
          body: sel.body ?? "",
          categoryTab: this.mailBattleCategory,
          inboxFilter: this.mailFilter,
          selectedMailId: sel.mail_id,
        });
      }
      void this.onOpenBattleReport?.(reportId > 0 ? reportId : null);
    }
    if (a === "mail-category-battle" || a === "mail-category-system") {
      const tab: MailBattleCategoryTab = a === "mail-category-battle" ? "battle" : "system";
      if (tab === this.mailBattleCategory) return;
      this.mailBattleCategory = tab;
      writeMailBattleCategoryTabSession(tab);
      this.mails = this.applyMailListClientFilters(this.mailListRpcPage);
      if (!this.mails.some((m) => m.mail_id === this.selectedMailId)) {
        this.selectedMailId = this.mails[0]?.mail_id ?? 0;
      }
      this.setMailFilterButtons();
      this.renderMailList();
    }
  }
}
