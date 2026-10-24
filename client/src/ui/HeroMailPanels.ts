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
  applyMailClaimResult,
  syncMailInboxSnapshotAfterClaim,
  syncMailRowAfterClaim,
  formatMailClaimGrantedSummary,
  filterHeroCultivationBagItemIds,
  heroListLines,
  mergeRecruitTemplateOwnership,
  parseGetHeroDetailResponse,
  renderHeroDetailMarkup,
  syncHeroSummaryFromDetail,
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
import type { DailyQuestRow } from "@/net/dailyQuestState";
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
  type UseConsumableSubmitState,
  useConsumableSubmitStateMachine,
} from "@/net/useConsumableSubmitFeedback";

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
  private mailClaimInlinePulseMailId = 0;
  /** CLIENT-209：与 HUD 深链轮询同源的日常 chain 400 快照（只读扫读，无新 RPC）。 */
  private mailHudTodoDailyRows: DailyQuestRow[] = [];
  private mailHudTodoRefreshStamp = 0;
  private mailHudTodoPulsePending = false;
  private recruitHeroInflight = false;
  private recruitLastError: string | null = null;
  private recruitLastSuccessHeroId: number | null = null;
  private heroesRefreshInflight = false;
  private heroListLastRefreshedAtMs = 0;
  /** CLIENT-199：自列表打开详情时保留筛选摘要；返回列表后清空。 */
  private heroDetailListContext: Pick<HeroListReturnPayload, "filter" | "sort"> | null = null;
  /** CLIENT-199：返回列表后折叠详情区，行高亮仍由 selectedHeroId 驱动。 */
  private heroDetailCollapsed = false;
  private heroCultivationSubmitState: UseConsumableSubmitState = "idle";
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
    this.heroPanel = this.buildHeroPanel();
    this.mailPanel = this.buildMailPanel();
    this.mount.appendChild(this.heroPanel);
    this.mount.appendChild(this.mailPanel);
    this.heroPanel.addEventListener("click", (ev) => this.onHeroClick(ev));
    this.mailPanel.addEventListener("click", (ev) => this.onMailClick(ev));
    this.heroPanel.addEventListener("change", (ev) => this.onHeroChange(ev));
    this.mailPanel.addEventListener("change", (ev) => this.onMailChange(ev));
    this.heroPanel.addEventListener("keydown", this.onHeroListKeyDown);
    this.heroFocusTrap = createCenterPanelFocusTrap(this.heroPanel, () => this.closeHeroFromKeyboard());
  }

  detach(): void {
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
    this.heroPanel.classList.toggle("hidden");
    if (!this.heroPanel.classList.contains("hidden")) {
      void this.refreshRecruitTemplates();
      void this.refreshHeroes({ restoreSelection: true });
    }
    this.syncHeroPanelFocusTrap();
  }

  /** CLIENT-097：排行深链 — 打开将领面板并 GetHeroDetail（只读）。 */
  async openHeroDetailDeepLink(heroId: number): Promise<void> {
    this.mailPanel.classList.add("hidden");
    this.heroPanel.classList.remove("hidden");
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
    this.mailPanel.classList.toggle("hidden");
    if (!this.mailPanel.classList.contains("hidden")) {
      resetCenterPanelViewportScroll(this.mailPanel);
      this.onUnreadCount?.(0);
      void this.refreshMail();
    } else void this.syncUnreadBadge();
  }

  /** 仅打开邮件面板（不 toggle 关闭）。 */
  openMailPanel(): void {
    if (this.isMailOpen()) return;
    this.mailPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.mailPanel);
    this.onUnreadCount?.(0);
    void this.refreshMail();
  }

  /** 战报深链：打开收件箱并高亮指定邮件（不自动领取附件）。 */
  openAndHighlightMail(mailId: number): void {
    this.mailPanel.classList.remove("hidden");
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
    this.heroPanel.classList.remove("hidden");
    resetCenterPanelViewportScroll(this.heroPanel);
    this.selectedHeroId = heroId;
    void this.refreshHeroes().then(() => {
      void this.loadHeroDetail(heroId).then(() => {
        const row = this.heroPanel.querySelector(`li[data-hero-id="${heroId}"]`);
        row?.scrollIntoView?.({ block: "nearest" });
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
    this.mailPanel.classList.remove("hidden");
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
    this.mailPanel.classList.remove("hidden");
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
    scheduleMailClaimRowPulse(findMailListRow(this.mailPanel, mailId));
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

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private buildHeroPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.dataset.centerPanel = "hero";
    el.innerHTML = `
      <h3>将领</h3>
      <p data-role="hero-hint">hero.v1 列表/详情/招募；模板与消耗来自 ListRecruitTemplates。</p>
      <button type="button" data-action="refresh-heroes">刷新列表</button>
      <p class="hero-list-refresh-status hidden" data-role="hero-list-refreshed-at" aria-label="列表上次刷新"></p>
      <p class="march-form-error-sibling hidden" data-role="hero-list-form-error" role="alert"></p>
      <button type="button" data-action="refresh-templates">刷新招募模板</button>
      <label>招募模板
        <select data-field="template-select"><option value="">（先刷新模板）</option></select>
      </label>
      <p class="recruit-wallet-compare-line hidden" data-role="recruit-wallet-compare-line" aria-live="polite"></p>
      <p class="recruit-cost-preview" data-role="recruit-preview"></p>
      <p class="recruit-form-inline-hint hidden" data-role="recruit-form-inline-hint" aria-live="polite"></p>
      <button type="button" class="hidden recruit-goto-bag-item-gap-btn" data-action="recruit-goto-bag-item-gap">打开背包</button>
      <button type="button" data-action="recruit-hero">招募</button>
      <p class="recruit-success-toast hidden" data-role="recruit-success-toast" role="status">
        <span data-role="recruit-success-msg"></span>
        <button type="button" class="hidden" data-action="recruit-open-hero-detail">打开详情</button>
      </p>
      <p class="march-form-error-sibling hidden" data-role="recruit-form-error" role="alert"></p>
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
    const ul = this.heroPanel.querySelector('[data-role="hero-list"]');
    const detailEl = this.heroPanel.querySelector('[data-role="hero-detail"]');
    if (!ul) return;
    ul.innerHTML = "";
    this.syncHeroListFilterChipDom();
    const visibleHeroes = heroListRowsForDisplay(
      this.heroes,
      this.heroListFilter,
      this.heroListSort,
      this.heroListFilterContext(),
    );
    if (this.heroesRefreshInflight && !this.heroes.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE, { assets: this.assets });
    } else if (!this.heroes.length) {
      const msg = this.heroListLoadError ?? heroListLines([])[0];
      const kind = this.heroListLoadError ? "error" : "empty";
      renderPanelStateListRow(ul, kind, msg, { assets: this.assets });
    } else if (!visibleHeroes.length) {
      renderPanelStateListRow(ul, "empty", heroListFilteredEmptyMessage(this.heroListFilter), {
        assets: this.assets,
      });
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
        body.appendChild(primarySpan);
        body.appendChild(loyaltySubline);
        body.appendChild(secondarySpan);
        li.appendChild(body);
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
    if (detailEl) {
      if (!this.selectedHeroId || this.heroDetailCollapsed) {
        detailEl.innerHTML = renderHeroDetailMarkup(null);
      } else if (this.heroDetailLoading) {
        detailEl.innerHTML = renderHeroDetailStateLoadingMarkup();
      } else if (this.heroDetailError) {
        detailEl.innerHTML = renderHeroDetailStateErrorMarkup(this.heroDetailError);
      } else {
        const { bag } = this.sessionEconomy();
        const cultivationHtml = renderHeroDetailCultivationUseMarkup(
          bag,
          this.heroCultivationSubmitState,
          this.heroDetail,
        );
        detailEl.innerHTML = renderHeroDetailMarkup(
          this.heroDetail,
          this.recruitAffordSummaryForHeroDetail(),
          this.recruitTemplateForHeroDetail(),
          cultivationHtml,
          bag,
          formatHeroDetailFromListHint(this.heroDetailListContext),
        );
      }
    }
  }

  private recruitTemplatesForDisplay(): RecruitTemplatePreview[] {
    return mergeRecruitTemplateOwnership(this.recruitTemplates, this.heroes);
  }

  private renderTemplateList(): void {
    const ul = this.heroPanel.querySelector('[data-role="template-list"]');
    const sel = this.heroPanel.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    const preview = this.heroPanel.querySelector('[data-role="recruit-preview"]');
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
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
      li.appendChild(primarySpan);
      li.appendChild(secondarySpan);
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
    this.syncRecruitFormInlineState(row);
    const ul = this.heroPanel.querySelector('[data-role="template-list"]');
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
    const ul = this.mailPanel.querySelector('[data-role="mail-list"]');
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
    const ul = this.mailPanel.querySelector('[data-role="mail-list"]');
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
    this.heroDetailLoading = true;
    this.heroDetailError = null;
    this.renderHeroList();
    this.onStatus(`将领详情 #${heroId}…`);
    try {
      const res = await this.gateway.getHeroDetail(sid, heroId);
      this.heroDetail = parseGetHeroDetailResponse(res);
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
      const msg = formatPanelGatewayErrorFromUnknown("bag", e);
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
    this.onSessionPatch({ bag, wallet });
  }

  private async recruitHero(): Promise<void> {
    if (this.recruitHeroInflight) return;
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
    let dailyBefore: DailyQuestRow | null = null;
    try {
      dailyBefore = await this.fetchDailyRecruitRow();
    } catch {
      /* 日常列表失败不阻断招募 */
    }
    this.recruitHeroInflight = true;
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
      await this.syncEconomyAfterRecruit();
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
        this.mailInboxSnapshot = syncMailInboxSnapshotAfterClaim(
          this.mailInboxSnapshot,
          mailId,
          updatedRow,
        );
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
    }
  }

  private onHeroClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    const btnAction = btn?.getAttribute("data-action");
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
    const li = (ev.target as HTMLElement).closest("li[data-hero-id]");
    if (li && !btn) {
      const id = Number(li.getAttribute("data-hero-id"));
      if (id) void this.loadHeroDetail(id, { fromHeroList: true });
      return;
    }
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-heroes") void this.refreshHeroes({ pulseOnSuccess: true });
    if (a === "hero-filter-all") {
      this.heroListFilter = "all";
      writeHeroListFilterSession(this.heroListFilter);
      this.renderHeroList();
    }
    if (a === "hero-filter-deployable") {
      this.heroListFilter = "deployable";
      writeHeroListFilterSession(this.heroListFilter);
      this.renderHeroList();
    }
    if (a === "hero-sort-level") {
      this.heroListSort = "level_desc";
      writeHeroListSortSession(this.heroListSort);
      this.renderHeroList();
    }
    if (a === "hero-sort-loyalty") {
      this.heroListSort = "loyalty_desc";
      writeHeroListSortSession(this.heroListSort);
      this.renderHeroList();
    }
    if (a === "refresh-templates") void this.refreshRecruitTemplates();
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
