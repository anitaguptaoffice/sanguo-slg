import { isKnownShopRejection, readShopCurrentState, SHOP_CURRENT_STATE_ONLY, SHOP_RELOAD_FAILED, SHOP_UNKNOWN_OUTCOME, type ShopOffer } from "@/net/shopOutcome";
import { BAG_USE_UNKNOWN, useBagItemWithAssets } from "@/net/bagUseAssets";
import { beginAssetRead, claimQuestWithAssets, refreshQuestAssets, QUEST_ASSETS_PENDING } from "@/net/questClaimAssets";
import { bagUseCapabilityHint } from "@/net/bagUseCapability";
import { captureActor } from "@/net/actorContext";
import { renderSuccessfulReadNotice } from "@/net/successfulReadNotice";
import { openCenterPanel, toggleCenterPanel } from "@/ui/centerPanelForeground";
import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  bagStackQuantity,
  type BagStack,
  bagFromListPlayerBagResponse,
} from "@/net/bagState";
import {
  formatShopOfferListLine,
  formatShopPurchaseFeedback,
  formatUseConsumableEffectSummary,
  gatewayErrorMessage,
} from "@/net/contentFeedback";
import {
  formatPanelGatewayErrorFromUnknown,
  setBagFormErrorDisplay,
  setShopFormErrorDisplay,
  validatePurchaseShopOffer,
  validateBagUseConsumable,
} from "@/net/contentFormValidation";
import { formatQuestLine, formatWalletPrice, itemLabel } from "@/net/contentFormat";
import {
  BATCH_USE_SLOT_CAP,
  isBatchUseEligibleItem,
  summarizeBatchUseConsumableResults,
  validateBatchUseConsumableSlots,
} from "@/net/bagBatchUse";
import {
  BAG_CATEGORY_TABS,
  countBagRowsByCategory,
  filterBagRowsByCategory,
  formatBagStackQty,
  readBagCategoryTabSession,
  writeBagCategoryTabSession,
  type BagClientCategory,
} from "@/net/bagCategory";
import {
  applyBagPanelScrollTop,
  readBagCategoryScrollState,
  readBagPanelScrollTop,
  scrollTopForBagCategory,
  updateBagCategoryScrollTop,
} from "@/net/bagCategoryScroll";
import {
  captureBagLastViewedForShopReturn,
  consumeBagShopReturnHighlight,
  scheduleBagRowReturnHighlight,
} from "@/net/bagShopReturnHighlight";
import { highlightBagShopCategoryScanRow } from "@/net/bagShopCategoryScan";
import {
  findBagShopInlineStateResidualTarget,
  shouldBagShopInlineStateResidualRing,
} from "@/net/bagShopInlineStateResidual";
import { pulseBagShopInlineStateResidualRings } from "@/net/bagShopInlineStateResidualDeep";
import {
  clearPanelReturnSourceSession,
  findPanelReturnSourceCategoryTab,
  readPanelReturnSourceSession,
  writePanelReturnSourceSession,
  type PanelReturnSourceKind,
  type PanelReturnSourcePayload,
} from "@/net/panelReturnSourceHighlightResidual";
import { pulsePanelReturnSourceCategoryResidualHighlights } from "@/net/panelReturnSourceHighlightResidualDeep";
import {
  bagEmptyListClass,
  formatBagStackRowLabel,
} from "@/net/panelDensity";
import {
  formatPanelEmptyHint,
  formatPanelGatewayErrorFromUnknownForList,
  renderPanelGatewayErrorListRow,
} from "@/net/panelGatewayError";
import {
  applyShopPurchaseAffordDisplay,
  shopOfferAffordInlineForRow,
} from "@/net/shopOfferAfford";
import {
  formatShopPriceVsWallet,
  formatShopPriceWalletGapLine,
  formatShopTabWalletBalanceLine,
  formatShopWalletCompareLine,
  resolveShopTabCurrency,
  SHOP_PRICE_WALLET_GAP_LINE_CLASS,
  syncShopWalletCompareLine,
} from "@/net/shopTabCurrency";
import { SHOP_OFFER_AFFORD_INLINE_CLASS } from "@/engine/mainCityWave30NarrowManifest";
import {
  PANEL_STATE_LOADING_MESSAGE,
  renderPanelStateListRow,
} from "@/engine/panelStateChrome";
import {
  countShopOffersByCategory,
  filterShopOffersByCategory,
  SHOP_CATEGORY_TABS,
  type ShopOfferClientCategory,
} from "@/net/shopOfferCategory";
import {
  formatShopPurchaseSuccess,
  syncShopPurchaseSubmitButton,
  walletShopPurchaseDeductPulseKeys,
} from "@/net/purchaseSubmitFeedback";
import {
  applyWalletGapBar,
  consumableUseWalletNeed,
} from "@/net/walletGap";
import {
  findBagStackRow,
  formatBagUseGatewayErrorFromUnknown,
  scheduleBagRowUsedPulse,
  scheduleBagUseConsumablePulse,
  scheduleBagUseInlinePulse,
  shouldPulseBagStackAfterUse,
  syncUseConsumableSubmitButtons,
  type UseConsumableSubmitState,
  useConsumableSubmitStateMachine,
} from "@/net/useConsumableSubmitFeedback";
import { BAG_ITEM_CFG_SUMMARY_CLASS } from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";
import { formatBagItemCfgSummary } from "@/net/bagItemCfgSummary";
import {
  BAG_ROW_INLINE_STATE_CLASS,
  formatBagRowInlineState,
} from "@/net/bagRowInlineState";
import {
  clearBagOpenSourceSession,
  formatBagOpenSourceTagLabel,
  readBagOpenSourceSession,
  writeBagOpenSourceSession,
  type BagOpenSource,
} from "@/net/bagOpenSource";
import {
  buildHeroBagDeepLinkQuery,
  type HeroBagDeepLinkQuery,
  scrollBagItemRowIntoView,
  writeHeroBagDeepLinkQuerySession,
} from "@/net/heroDetailBagDeepLink";
import { BAG_HERO_ITEM_GAP_HIGHLIGHT_CLASS } from "@/net/recruitFormInlineHint";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";

type QuestProgress = {
  quest_cfg_id?: number;
  quest_code?: string;
  state?: number;
  progress_current?: number;
  progress_target?: number;
};

export class ContentPanels {
  private questPanel!: HTMLElement;
  private bagPanel!: HTMLElement;
  private shopPanel!: HTMLElement;
  private questReadVersion = 0;
  private questClaimInflight = false;
  private bagReadVersion = 0;
  private questRows: QuestProgress[] = [];
  private shopOffers: ShopOffer[] = [];
  private selectedQuestId = 1001;
  private selectedItemId = 2001;
  private selectedOfferId = 1001;
  private bagHighlightItemId = 0;
  private bagHighlightItemIds = new Set<number>();
  /** CLIENT-201：招募道具缺口深链高亮（叠加 CLIENT-165 item-highlight）。 */
  private bagRecruitItemGapHighlight = false;
  private shopCategory: ShopOfferClientCategory = "all";
  private bagCategory: BagClientCategory = readBagCategoryTabSession();
  /** CLIENT-210：各分类 tab 滚动位置（与 session 同步）。 */
  private bagCategoryScrollTops = new Map<BagClientCategory, number>();
  /** 最近一次购买成功时行内追加文案（offer_id → 摘要）。 */
  private shopPurchaseFlash = new Map<number, string>();
  private useConsumableSubmitState: UseConsumableSubmitState = "idle";
  private bagUseState?: { current: () => boolean; needsReload: boolean };
  /** CLIENT-079：当前选中道具的批量格勾选（0-based 格序号）。 */
  private bagBatchCheckedSlots = new Set<number>();
  private shopReadVersion = 0;
  private shopState?: { current: () => boolean; busy: string; needsReload: boolean; unknown: boolean; outcome: string; warning: string };
  private shopListLoading = false;
  private shopListError: string | null = null;
  private bagListLoading = false;
  private bagListError: string | null = null;
  private bagReturnHeroId = 0;
  private shopLastGrantedItemCfgId = 0;
  private onBagReturnHeroDetail?: (heroId: number) => void;
  /** CLIENT-256：打开背包/商城时待高亮分类（在 toggle 时同步消费 session，避免陈旧 refresh then）。 */
  private pendingPanelReturnSourceHighlight: PanelReturnSourcePayload | null = null;
  private bagOpenGeneration = 0;
  private shopOpenGeneration = 0;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
    private readonly onShopMaterialPulse?: (keys: (keyof ResourceWallet)[]) => void,
  ) {}

  setBagReturnHeroDetailHandler(handler: (heroId: number) => void): void {
    this.onBagReturnHeroDetail = handler;
  }

  attach(): void {
    this.questPanel = this.buildQuestPanel();
    this.bagPanel = this.buildBagPanel();
    this.shopPanel = this.buildShopPanel();
    this.mount.appendChild(this.questPanel);
    this.mount.appendChild(this.bagPanel);
    this.mount.appendChild(this.shopPanel);
    this.bagPanel.addEventListener("center-panel-suspend", () => {
      this.persistBagCategoryScrollPosition();
      this.bagOpenGeneration++;
    });
    this.shopPanel.addEventListener("center-panel-suspend", () => { this.shopOpenGeneration++; });
    this.questPanel.addEventListener("click", (ev) => this.onQuestClick(ev));
    this.bagPanel.addEventListener("click", (ev) => this.onBagClick(ev));
    this.shopPanel.addEventListener("click", (ev) => this.onShopClick(ev));
    this.questPanel.addEventListener("change", (ev) => this.onQuestSelect(ev));
    this.bagPanel.addEventListener("change", (ev) => this.onBagSelect(ev));
    this.syncBagItemSelect();
    this.syncUseConsumableSubmitUi();
    this.shopPanel.addEventListener("change", (ev) => this.onShopSelect(ev));
  }

  detach(): void {
    this.shopState = undefined;
    ++this.shopReadVersion;
    this.questPanel?.remove();
    this.bagPanel?.remove();
    this.shopPanel?.remove();
  }

  toggleQuest(): void {
    toggleCenterPanel(this.questPanel);
    if (!this.questPanel.classList.contains("hidden")) void this.refreshQuests();
  }

  toggleBag(): void {
    const wasHidden = this.bagPanel.classList.contains("hidden");
    const returnFromShop = !this.shopPanel.classList.contains("hidden");
    toggleCenterPanel(this.bagPanel);
    if (!wasHidden) {
      this.persistBagCategoryScrollPosition();
      if (!this.shopPanel.classList.contains("hidden")) {
        captureBagLastViewedForShopReturn(this.selectedItemId);
      }
      this.syncBagOpenSourceTag();
      return;
    }
    if (!this.bagHighlightItemId) {
      clearBagOpenSourceSession();
    }
    this.stashPanelReturnSourceHighlightOnOpen("bag");
    const bagOpenGeneration = ++this.bagOpenGeneration;
    const shopReturnItemId = returnFromShop ? consumeBagShopReturnHighlight() : null;
    this.syncBagCategoryScrollMemoryFromSession();
    const deepLinkHighlight = this.bagHighlightItemId > 0;
    if (deepLinkHighlight) {
      resetCenterPanelViewportScroll(this.bagPanel);
    }
    this.syncBagOpenSourceTag();
    void this.refreshBag().then(() => {
      if (bagOpenGeneration !== this.bagOpenGeneration) return;
      if (!deepLinkHighlight) {
        this.applyBagCategoryScrollTop(this.scrollTopForActiveBagCategory());
      }
      if (shopReturnItemId) {
        scheduleBagRowReturnHighlight(this.bagPanel, shopReturnItemId);
      }
      this.applyPanelReturnSourceHighlightResidual("bag");
    });
  }

  getBagRoot(): HTMLElement {
    return this.bagPanel;
  }

  getShopRoot(): HTMLElement {
    return this.shopPanel;
  }

  /** 打开排行/军情前记录背包或商城当前分类（CLIENT-256）。 */
  capturePanelReturnSourceBeforeRankIntel(sourceKind: PanelReturnSourceKind): void {
    const bagOpen = !this.bagPanel.classList.contains("hidden");
    const shopOpen = !this.shopPanel.classList.contains("hidden");
    if (bagOpen) {
      writePanelReturnSourceSession({
        targetPanel: "bag",
        categoryId: this.bagCategory,
        sourceKind,
      });
    } else if (shopOpen) {
      writePanelReturnSourceSession({
        targetPanel: "shop",
        categoryId: this.shopCategory,
        sourceKind,
      });
    }
  }

  private takePendingPanelReturnSourceHighlight(
    targetPanel: "bag" | "shop",
  ): PanelReturnSourcePayload | null {
    const payload = this.pendingPanelReturnSourceHighlight;
    if (!payload || payload.targetPanel !== targetPanel) return null;
    this.pendingPanelReturnSourceHighlight = null;
    return payload;
  }

  private stashPanelReturnSourceHighlightOnOpen(targetPanel: "bag" | "shop"): void {
    const payload = readPanelReturnSourceSession();
    if (payload?.targetPanel === targetPanel) {
      clearPanelReturnSourceSession();
      this.pendingPanelReturnSourceHighlight = payload;
    } else {
      this.pendingPanelReturnSourceHighlight = null;
    }
  }

  private applyPanelReturnSourceHighlightResidual(targetPanel: "bag" | "shop"): void {
    const payload = this.takePendingPanelReturnSourceHighlight(targetPanel);
    if (!payload) return;
    const root = targetPanel === "bag" ? this.bagPanel : this.shopPanel;
    const tab = findPanelReturnSourceCategoryTab(root, targetPanel, payload.categoryId);
    pulsePanelReturnSourceCategoryResidualHighlights(tab, root);
  }

  private syncBagInlineStateResidualRing(): void {
    const bag = this.getSession()?.bag ?? [];
    const row = bag.find((r) => r.item_cfg_id === this.selectedItemId) ?? null;
    if (!shouldBagShopInlineStateResidualRing("bag", row, undefined, null)) return;
    const li = this.bagPanel.querySelector<HTMLElement>(
      `li[data-item-cfg-id="${this.selectedItemId}"]`,
    );
    const target = findBagShopInlineStateResidualTarget(li, "bag");
    pulseBagShopInlineStateResidualRings(target, this.bagPanel);
  }

  private syncShopInlineStateResidualRing(): void {
    const wallet = this.sessionWallet();
    const offer = this.shopOffers.find((o) => o.offer_id === this.selectedOfferId) ?? null;
    if (!shouldBagShopInlineStateResidualRing("shop", null, wallet, offer)) return;
    const li = this.shopPanel.querySelector<HTMLElement>(
      `li[data-offer-id="${this.selectedOfferId}"]`,
    );
    const target = findBagShopInlineStateResidualTarget(li, "shop");
    pulseBagShopInlineStateResidualRings(target, this.shopPanel);
  }

  /** 日常战备：打开背包并高亮指定 item_cfg_id（如 march_ration=2020）。 */
  openBagHighlightItem(itemCfgId: number): void {
    this.openBagWithDeepLink(
      buildHeroBagDeepLinkQuery({
        highlightItemId: itemCfgId,
        bagCategory: "all",
        openSource: "daily",
      }),
      "daily",
    );
  }

  /** 商城购买后查看背包（CLIENT-175 来源标签 shop）。 */
  openBagFromShopDeepLink(itemCfgId: number): void {
    if (itemCfgId <= 0) return;
    this.openBagWithDeepLink(
      buildHeroBagDeepLinkQuery({
        highlightItemId: itemCfgId,
        bagCategory: "all",
        openSource: "shop",
      }),
      "shop",
    );
  }

  /** 将领养成互链（CLIENT-165）：`bagCategory` / `highlightItemId` / `returnHeroId` 深链。 */
  openBagFromHeroDeepLink(link: HeroBagDeepLinkQuery): void {
    this.openBagWithDeepLink(link, link.openSource ?? "hero");
  }

  /** 招募表单养成道具缺口（CLIENT-201）：`bag-hero-item-gap-highlight` + 深链 query。 */
  openBagFromRecruitItemGapDeepLink(link: HeroBagDeepLinkQuery): void {
    this.openBagWithDeepLink(
      { ...link, recruitItemGap: true, openSource: link.openSource ?? "hero" },
      link.openSource ?? "hero",
    );
  }

  private openBagWithDeepLink(link: HeroBagDeepLinkQuery, source: BagOpenSource): void {
    writeBagOpenSourceSession(source);
    const highlightItemId = link.highlightItemId;
    const ids = highlightItemId > 0 ? [highlightItemId] : [];
    this.bagReturnHeroId = link.returnHeroId > 0 ? link.returnHeroId : 0;
    if (link.bagCategory) {
      this.bagCategory = link.bagCategory;
      writeBagCategoryTabSession(link.bagCategory);
    }
    writeHeroBagDeepLinkQuerySession({
      ...link,
      openSource: link.openSource ?? source,
    });
    this.bagRecruitItemGapHighlight = link.recruitItemGap === true;
    this.bagHighlightItemIds = new Set(ids);
    this.bagHighlightItemId = highlightItemId;
    if (highlightItemId > 0) {
      this.selectedItemId = highlightItemId;
      this.syncBagItemSelect();
    }
    openCenterPanel(this.bagPanel);
    resetCenterPanelViewportScroll(this.bagPanel);
    this.syncBagReturnHeroButton();
    const hint = this.bagPanel.querySelector('[data-role="bag-hint"]');
    if (hint) {
      const cat = link.bagCategory && link.bagCategory !== "all" ? `分类=${link.bagCategory} · ` : "";
      hint.textContent = highlightItemId > 0
        ? `${cat}高亮 item_cfg_id=${highlightItemId}；「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量。`
        : "暂无养成消耗品；「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量。";
    }
    this.syncBagOpenSourceTag();
    void this.refreshBag().then(() => {
      if (highlightItemId > 0) {
        scrollBagItemRowIntoView(this.bagPanel, highlightItemId);
        if (source === "shop") {
          scheduleBagRowReturnHighlight(this.bagPanel, highlightItemId);
        }
      }
    });
  }

  openBagHighlightItems(itemCfgIds: number[]): void {
    const first = itemCfgIds.find((id) => id > 0) ?? 0;
    this.openBagWithDeepLink(
      buildHeroBagDeepLinkQuery({ highlightItemId: first, openSource: "hero" }),
      "hero",
    );
  }

  private syncBagReturnHeroButton(): void {
    const btn = this.bagPanel.querySelector<HTMLButtonElement>('[data-action="bag-return-hero"]');
    if (!btn) return;
    if (this.bagReturnHeroId > 0) {
      btn.classList.remove("hidden");
      btn.textContent = `返回将领详情 #${this.bagReturnHeroId}`;
    } else {
      btn.classList.add("hidden");
    }
  }

  private returnToHeroDetailFromBag(): void {
    const heroId = this.bagReturnHeroId;
    if (heroId <= 0) return;
    this.bagReturnHeroId = 0;
    this.syncBagReturnHeroButton();
    this.bagPanel.classList.add("hidden");
    this.syncBagOpenSourceTag();
    this.onBagReturnHeroDetail?.(heroId);
  }

  private syncBagOpenSourceTag(): void {
    const el = this.bagPanel.querySelector('[data-role="bag-open-source-tag"]') as HTMLElement | null;
    if (!el) return;
    const source = readBagOpenSourceSession();
    const panelOpen = !this.bagPanel.classList.contains("hidden");
    if (!source || !panelOpen) {
      el.hidden = true;
      el.textContent = "";
      el.removeAttribute("data-bag-open-source");
      return;
    }
    el.hidden = false;
    el.setAttribute("data-bag-open-source", source);
    el.textContent = formatBagOpenSourceTagLabel(source);
  }

  toggleShop(): void {
    const wasHidden = this.shopPanel.classList.contains("hidden");
    const returnFromBag = !this.bagPanel.classList.contains("hidden");
    toggleCenterPanel(this.shopPanel);
    if (!wasHidden) return;
    this.stashPanelReturnSourceHighlightOnOpen("shop");
    const shopOpenGeneration = ++this.shopOpenGeneration;
    if (returnFromBag) {
      this.persistBagCategoryScrollPosition();
      captureBagLastViewedForShopReturn(this.selectedItemId);
    }
    resetCenterPanelViewportScroll(this.shopPanel);
    void this.refreshShop().then(() => {
      if (shopOpenGeneration !== this.shopOpenGeneration) return;
      this.applyPanelReturnSourceHighlightResidual("shop");
    });
  }

  private syncBagCategoryScrollMemoryFromSession(): void {
    const state = readBagCategoryScrollState();
    this.bagCategoryScrollTops.clear();
    for (const key of ["all", "consumable", "cultivation"] as const) {
      const top = scrollTopForBagCategory(state, key);
      if (top > 0) this.bagCategoryScrollTops.set(key, top);
    }
  }

  private persistBagCategoryScrollPosition(): void {
    const top = readBagPanelScrollTop(this.bagPanel);
    this.bagCategoryScrollTops.set(this.bagCategory, top);
    updateBagCategoryScrollTop(this.bagCategory, top);
  }

  private scrollTopForActiveBagCategory(): number {
    const cached = this.bagCategoryScrollTops.get(this.bagCategory);
    if (cached != null && Number.isFinite(cached) && cached >= 0) return Math.trunc(cached);
    return scrollTopForBagCategory(readBagCategoryScrollState(), this.bagCategory);
  }

  private restoreBagCategoryScrollPosition(): void {
    this.applyBagCategoryScrollTop(this.scrollTopForActiveBagCategory());
  }

  /** 列表重绘后再恢复 scrollTop（避免 jsdom/窄屏下 scrollHeight 未更新时钳位）。 */
  private applyBagCategoryScrollTop(scrollTop: number): void {
    applyBagPanelScrollTop(this.bagPanel, scrollTop);
    queueMicrotask(() => applyBagPanelScrollTop(this.bagPanel, scrollTop));
  }

  private switchBagCategory(next: BagClientCategory): void {
    if (next === this.bagCategory) return;
    const currentTop = readBagPanelScrollTop(this.bagPanel);
    this.bagCategoryScrollTops.set(this.bagCategory, currentTop);
    updateBagCategoryScrollTop(this.bagCategory, currentTop);
    this.bagCategory = next;
    writeBagCategoryTabSession(next);
    this.renderBagList();
    this.applyBagCategoryScrollTop(this.scrollTopForActiveBagCategory());
    highlightBagShopCategoryScanRow(this.bagPanel, "bag");
  }

  private switchShopCategory(next: ShopOfferClientCategory): void {
    if (next === this.shopCategory) return;
    this.shopCategory = next;
    this.renderShopList();
    highlightBagShopCategoryScanRow(this.shopPanel, "shop");
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private patchBag(bag: BagStack[]): void {
    this.onSessionPatch({ bag });
    this.renderBagList();
    this.syncBagWalletGap();
  }

  private sessionWallet(): ResourceWallet | undefined {
    return this.getSession()?.wallet;
  }

  private syncBagWalletGap(): void {
    this.syncUseConsumableSubmitUi();
    const count = Number(
      (this.bagPanel.querySelector('[data-field="use-count"]') as HTMLInputElement)?.value ?? 1,
    );
    applyWalletGapBar(
      this.bagPanel,
      "bag-wallet-gap",
      consumableUseWalletNeed(this.selectedItemId, count),
      this.sessionWallet(),
      { includeZeroNeed: true },
    );
  }

  private syncShopWalletGap(): void {
    const purchaseCount = 1;
    const offer = this.shopOffers.find((o) => o.offer_id === this.selectedOfferId);
    applyShopPurchaseAffordDisplay(
      this.shopPanel,
      offer?.price_resources,
      this.sessionWallet(),
      purchaseCount,
    );
    this.syncShopTabCurrencySweep();
    this.syncShopPurchaseSubmit();
  }

  private syncShopTabCurrencySweep(): void {
    const el = this.shopPanel.querySelector('[data-role="shop-tab-currency-sweep"]');
    if (!el || !(el instanceof HTMLElement)) return;
    const currencies = resolveShopTabCurrency(this.shopOffers, this.shopCategory);
    const line = formatShopTabWalletBalanceLine(this.sessionWallet(), currencies);
    if (!line) {
      el.textContent = "";
      el.hidden = true;
    } else {
      el.textContent = line;
      el.hidden = false;
    }
    syncShopWalletCompareLine(
      this.shopPanel,
      formatShopWalletCompareLine(this.sessionWallet(), this.shopOffers, this.shopCategory),
    );
  }

  private shopPurchaseCanAfford(): boolean {
    const purchaseCount = 1;
    const offer = this.shopOffers.find((o) => o.offer_id === this.selectedOfferId);
    return validatePurchaseShopOffer({
      offer,
      offerId: this.selectedOfferId,
      purchaseCount,
      wallet: this.getSession()?.wallet,
    }).ok;
  }

  private syncShopViewGrantedBagButton(): void {
    const btn = this.shopPanel.querySelector<HTMLButtonElement>(
      '[data-action="shop-view-granted-bag"]',
    );
    if (!btn) return;
    if (this.shopLastGrantedItemCfgId > 0) {
      btn.classList.remove("hidden");
      btn.textContent = `在背包查看 #${this.shopLastGrantedItemCfgId}`;
    } else {
      btn.classList.add("hidden");
    }
  }

  private shopContext() {
    if (!this.shopState?.current()) {
      const actor = captureActor(this.gateway, this.getSession);
      const state = { current: () => this.shopState === state && actor() && this.shopPanel.parentNode === this.mount,
        busy: "", needsReload: false, unknown: false, outcome: "", warning: "" };
      this.shopState = state;
      this.shopOffers = [];
      this.shopPurchaseFlash.clear();
      this.shopLastGrantedItemCfgId = 0;
      this.shopListError = null;
    }
    return this.shopState;
  }

  private syncShopPurchaseSubmit(): void {
    const state = this.shopContext();
    syncShopPurchaseSubmitButton(this.shopPanel, state.busy === "buy" ? "submitting" : "idle",
      !state.busy && !state.needsReload && !this.shopListError && this.shopPurchaseCanAfford());
    const buy = this.shopPanel.querySelector<HTMLButtonElement>('[data-action="buy-offer"]');
    if (buy && state.unknown && !state.busy) buy.textContent = "新购买×1（非重试）";
    for (const button of this.shopPanel.querySelectorAll<HTMLButtonElement>('[data-action="refresh-shop"], [data-action="retry-refresh-shop"], [data-action="reload-shop-state"]')) {
      button.disabled = !!state.busy;
    }
    const reload = this.shopPanel.querySelector<HTMLElement>('[data-action="reload-shop-state"]');
    if (reload) reload.hidden = !state.outcome && !state.needsReload;
    this.setShopFeedback(state.outcome || null);
    setShopFormErrorDisplay(this.shopPanel, state.warning || null);
    this.syncShopViewGrantedBagButton();
  }

  private shopStatus(message: string): void {
    if (!this.shopPanel.classList.contains("hidden")) this.onStatus(message);
  }

  private setBagFeedback(text: string | null): void {
    const el = this.bagPanel.querySelector('[data-role="bag-feedback"]') as HTMLElement | null;
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  private setShopFeedback(text: string | null): void {
    const el = this.shopPanel.querySelector('[data-role="shop-feedback"]') as HTMLElement | null;
    if (!el) return;
    if (!text) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = text;
  }

  private buildQuestPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel quest-panel hidden";
    el.innerHTML = `
      <h3>任务</h3>
      <label>任务 ID
        <input type="number" data-field="quest-id" min="1001" value="1001" />
      </label>
      <button type="button" data-action="refresh-quests">刷新列表</button>
      <button type="button" data-action="accept-quest">接取</button>
      <button type="button" data-action="claim-quest">领奖</button>
      <ul class="quest-list" data-role="quest-list"></ul>
    `;
    return el;
  }

  private buildBagPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.dataset.centerPanel = "bag";
    el.innerHTML = `
      <h3>背包</h3>
      <span class="bag-open-source-tag hidden" data-role="bag-open-source-tag" hidden></span>
      <p data-role="bag-hint">「刷新背包」拉取服务端全量；任务领奖后刷新权威背包与钱包，重复回复不叠加奖励。</p>
      <label>道具
        <select data-field="item-id"></select>
      </label>
      <label>数量 <input type="number" data-field="use-count" min="1" value="1" /></label>
      <p class="wallet-gap-line hidden" data-role="bag-wallet-gap" aria-live="polite"></p>
      <p class="bag-form-error hidden" data-role="bag-form-error" role="alert"></p>
      <div class="content-panel-actions">
        <button type="button" class="art-btn-primary art-btn-primary-full hidden" data-action="bag-return-hero">返回将领详情</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-bag">刷新背包</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="use-item">使用道具</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="use-item-batch">批量使用勾选格</button>
      </div>
      <p class="panel-feedback bag-panel-feedback" data-role="bag-use-capability" aria-live="polite" hidden></p>
      <p class="bag-batch-hint" data-role="bag-batch-hint">同道具可多格勾选，逐次调用 UseConsumable×1 并汇总结果。</p>
      <div class="bag-category-tabs" data-role="bag-category-tabs" role="tablist"></div>
      <div class="panel-scroll-body" data-role="bag-scroll">
        <ul class="bag-list" data-role="bag-list"></ul>
      </div>
      <p class="panel-feedback bag-panel-feedback" data-role="bag-feedback" hidden></p>
    `;
    return el;
  }

  private buildShopPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.dataset.centerPanel = "shop";
    el.innerHTML = `
      <h3>商城</h3>
      <p data-role="shop-hint">购买回执与当前资产分开显示；状态刷新不会重发购买。</p>
      <p class="panel-feedback" data-role="shop-feedback" role="status" aria-live="polite" hidden></p>
      <button type="button" data-action="reload-shop-state" hidden>重新加载当前状态</button>
      <div class="shop-category-tabs" data-role="shop-category-tabs" role="tablist"></div>
      <p class="shop-tab-currency-sweep hidden" data-role="shop-tab-currency-sweep" aria-live="polite"></p>
      <p class="shop-wallet-compare-line hidden" data-role="shop-wallet-compare-line" aria-live="polite"></p>
      <button type="button" data-action="refresh-shop">刷新货架</button>
      <label>商品 offer
        <select data-field="offer-id"></select>
      </label>
      <p class="wallet-gap-line hidden" data-role="shop-wallet-gap" aria-live="polite"></p>
      <p class="shop-form-error hidden" data-role="shop-form-error" role="alert"></p>
      <button type="button" data-action="buy-offer">购买×1</button>
      <button type="button" class="hidden" data-action="shop-view-granted-bag">在背包查看所购道具</button>
      <div class="panel-scroll-body" data-role="shop-scroll">
        <ul class="shop-list" data-role="shop-list"></ul>
      </div>
    `;
    return el;
  }

  private renderQuestList(): void {
    const ul = this.questPanel.querySelector<HTMLElement>('[data-role="quest-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    for (const q of this.questRows) {
      const li = document.createElement("li");
      li.textContent = formatQuestLine(q);
      ul.appendChild(li);
    }
  }

  private visibleBagStacks(): BagStack[] {
    const bag = this.getSession()?.bag ?? [];
    return filterBagRowsByCategory(bag, this.bagCategory);
  }

  private renderBagCategoryTabs(): void {
    const host = this.bagPanel.querySelector('[data-role="bag-category-tabs"]');
    if (!host) return;
    host.innerHTML = "";
    const bag = this.getSession()?.bag ?? [];
    const counts = countBagRowsByCategory(bag);
    for (const tab of BAG_CATEGORY_TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bag-category-tab";
      btn.setAttribute("data-bag-category", tab.id);
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.id === this.bagCategory ? "true" : "false");
      if (tab.id === this.bagCategory) btn.classList.add("active");
      const n = tab.id === "all" ? counts.all : counts[tab.id];
      btn.textContent = n > 0 ? `${tab.label} (${n})` : tab.label;
      host.appendChild(btn);
    }
  }

  private renderBagList(): void {
    this.syncBagItemSelect();
    this.renderBagCategoryTabs();
    const ul = this.bagPanel.querySelector<HTMLElement>('[data-role="bag-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    const bag = this.getSession()?.bag ?? [];
    if (this.bagListLoading && !bag.length) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE);
      this.syncBagWalletGap();
      return;
    }
    if (this.bagListError && !bag.length) {
      renderPanelGatewayErrorListRow(ul, this.bagListError, {
        legacyClass: bagEmptyListClass(),
        retryAction: "retry-refresh-bag",
      });
      this.syncBagWalletGap();
      return;
    }
    const visible = this.visibleBagStacks();
    for (const row of visible) {
      const li = document.createElement("li");
      li.className = "bag-stack-row";
      if (row.item_cfg_id) li.setAttribute("data-item-cfg-id", String(row.item_cfg_id));
      const { idCell, name } = formatBagStackRowLabel(row);
      const idSpan = document.createElement("span");
      idSpan.className = "bag-stack-id";
      idSpan.textContent = idCell;
      const nameSpan = document.createElement("span");
      nameSpan.className = "bag-stack-name";
      nameSpan.textContent = name;
      const qtySpan = document.createElement("span");
      qtySpan.className = "bag-stack-qty";
      qtySpan.textContent = formatBagStackQty(row.quantity);
      li.appendChild(idSpan);
      li.appendChild(nameSpan);
      li.appendChild(qtySpan);
      const summary = formatBagItemCfgSummary(row);
      if (summary) {
        const secondary = document.createElement("span");
        secondary.className = `bag-stack-secondary ${BAG_ITEM_CFG_SUMMARY_CLASS}`;
        secondary.textContent = summary;
        li.appendChild(secondary);
      }
      if (row.item_cfg_id === this.selectedItemId) {
        const inline = formatBagRowInlineState(row);
        if (inline) {
          const inlineEl = document.createElement("span");
          inlineEl.className = BAG_ROW_INLINE_STATE_CLASS;
          inlineEl.textContent = inline;
          li.appendChild(inlineEl);
        }
      }
      if (
        row.item_cfg_id === this.selectedItemId &&
        isBatchUseEligibleItem(row.item_cfg_id) &&
        (row.quantity ?? 0) > 0
      ) {
        const slots = document.createElement("span");
        slots.className = "bag-slot-picks";
        slots.setAttribute("data-role", "bag-slot-picks");
        const cap = Math.min(row.quantity ?? 0, BATCH_USE_SLOT_CAP);
        for (let i = 0; i < cap; i += 1) {
          const pick = document.createElement("label");
          pick.className = "bag-slot-pick";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.setAttribute("data-role", "bag-slot-checkbox");
          cb.setAttribute("data-item-id", String(row.item_cfg_id));
          cb.setAttribute("data-slot-index", String(i));
          cb.checked = this.bagBatchCheckedSlots.has(i);
          pick.appendChild(cb);
          pick.appendChild(document.createTextNode(`${i + 1}`));
          slots.appendChild(pick);
        }
        li.appendChild(slots);
      }
      if (
        row.item_cfg_id &&
        (this.bagHighlightItemIds.has(row.item_cfg_id) ||
          (this.bagHighlightItemId && row.item_cfg_id === this.bagHighlightItemId))
      ) {
        li.classList.add("item-highlight");
        if (this.bagRecruitItemGapHighlight) {
          li.classList.add(BAG_HERO_ITEM_GAP_HIGHLIGHT_CLASS);
        }
      }
      ul.appendChild(li);
    }
    if (!visible.length) {
      const msg = formatPanelEmptyHint({
        panel: "bag",
        category: this.bagCategory,
        hasAnyStacks: bag.length > 0,
      });
      renderPanelStateListRow(ul, "empty", msg, { legacyClass: bagEmptyListClass() });
    }
    this.syncBagWalletGap();
    this.syncBagInlineStateResidualRing();
  }

  private renderShopCategoryTabs(): void {
    const host = this.shopPanel.querySelector('[data-role="shop-category-tabs"]');
    if (!host) return;
    host.innerHTML = "";
    const counts = countShopOffersByCategory(this.shopOffers);
    for (const tab of SHOP_CATEGORY_TABS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-category-tab";
      btn.setAttribute("data-shop-category", tab.id);
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", tab.id === this.shopCategory ? "true" : "false");
      if (tab.id === this.shopCategory) btn.classList.add("active");
      const n = tab.id === "all" ? counts.all : counts[tab.id];
      btn.textContent = n > 0 ? `${tab.label} (${n})` : tab.label;
      host.appendChild(btn);
    }
  }

  private visibleShopOffers(): ShopOffer[] {
    return filterShopOffersByCategory(this.shopOffers, this.shopCategory);
  }

  private countSelectedBagBatchSlots(itemId: number): number {
    const boxes = this.bagPanel.querySelectorAll(
      `input[data-role="bag-slot-checkbox"][data-item-id="${itemId}"]:checked`,
    );
    return boxes.length;
  }

  private renderShopList(): void {
    this.renderShopCategoryTabs();
    const visible = this.visibleShopOffers();
    const ul = this.shopPanel.querySelector<HTMLElement>('[data-role="shop-list"]');
    const sel = this.shopPanel.querySelector('[data-field="offer-id"]') as HTMLSelectElement;
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
    if (this.shopListLoading) {
      renderPanelStateListRow(ul, "loading", PANEL_STATE_LOADING_MESSAGE);
      this.syncShopWalletGap();
      return;
    }
    if (this.shopListError) {
      renderPanelGatewayErrorListRow(ul, this.shopListError, {
        legacyClass: "shop-list-error",
        retryAction: "retry-refresh-shop",
      });
      this.syncShopWalletGap();
      return;
    }
    const wallet = this.sessionWallet();
    for (const o of visible) {
      const li = document.createElement("li");
      if (o.offer_id) li.setAttribute("data-offer-id", String(o.offer_id));
      const price = formatWalletPrice(o.price_resources ?? {});
      let line = formatShopOfferListLine(o, price);
      const flash = this.shopPurchaseFlash.get(o.offer_id ?? 0);
      if (flash) line += ` · ${flash}`;
      const main = document.createElement("span");
      main.className = "shop-offer-line-main";
      main.textContent = line;
      li.appendChild(main);
      const priceVsWallet = formatShopPriceVsWallet(wallet, o.price_resources, 1);
      if (priceVsWallet) {
        const vs = document.createElement("span");
        vs.className = "shop-price-vs-wallet";
        vs.textContent = priceVsWallet;
        li.appendChild(vs);
      }
      const priceWalletGap = formatShopPriceWalletGapLine(wallet, o.price_resources, 1);
      if (priceWalletGap) {
        const gapLine = document.createElement("span");
        gapLine.className = SHOP_PRICE_WALLET_GAP_LINE_CLASS;
        gapLine.textContent = priceWalletGap;
        li.appendChild(gapLine);
      }
      const afford = shopOfferAffordInlineForRow(wallet, o, 1);
      if (afford) {
        const affordEl = document.createElement("span");
        affordEl.className = SHOP_OFFER_AFFORD_INLINE_CLASS;
        affordEl.textContent = afford;
        li.appendChild(affordEl);
      }
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = String(o.offer_id ?? 0);
      opt.textContent = `#${o.offer_id} ${itemLabel(o.item_cfg_id)}`;
      sel.appendChild(opt);
    }
    const stillVisible = visible.some((o) => o.offer_id === this.selectedOfferId);
    if (!stillVisible && visible[0]?.offer_id) {
      this.selectedOfferId = visible[0].offer_id ?? this.selectedOfferId;
    }
    if (visible[0]?.offer_id) {
      sel.value = String(this.selectedOfferId || visible[0].offer_id);
    }
    if (!visible.length) {
      const msg = formatPanelEmptyHint({
        panel: "shop",
        hasAnyOffers: this.shopOffers.length > 0,
      });
      renderPanelStateListRow(ul, "empty", msg, { legacyClass: "shop-empty" });
    }
    this.syncShopWalletGap();
    this.syncShopInlineStateResidualRing();
  }

  private async refreshQuests(): Promise<void> {
    const actor = captureActor(this.gateway, this.getSession);
    const version = ++this.questReadVersion;
    const current = () => actor() && version === this.questReadVersion && this.questPanel.parentNode === this.mount;
    renderSuccessfulReadNotice(this.questPanel);
    const sid = this.serverId();
    this.onStatus("拉取任务…");
    try {
      const res = (await this.gateway.listPlayerQuests(sid, { includeCompleted: true })) as {
        quests?: QuestProgress[];
      };
      if (!current()) return;
      renderSuccessfulReadNotice(this.questPanel, res);
      this.questRows = res.quests ?? [];
      this.renderQuestList();
      this.onStatus(`任务 ${this.questRows.length} 条`);
    } catch (e) {
      if (!current()) return;
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async acceptQuest(): Promise<void> {
    const current = captureActor(this.gateway, this.getSession);
    const sid = this.serverId();
    const id = this.selectedQuestId;
    this.onStatus(`接取任务 ${id}…`);
    try {
      await this.gateway.acceptQuest(sid, id);
      if (!current()) return;
      await this.refreshQuests();
      if (!current()) return;
      this.onStatus(`已接取 #${id}`);
    } catch (e) {
      if (!current()) return;
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async claimQuest(): Promise<void> {
    if (this.questClaimInflight) return;
    const current = captureActor(this.gateway, this.getSession);
    const id = this.selectedQuestId;
    const button = this.questPanel.querySelector<HTMLButtonElement>('[data-action="claim-quest"]');
    this.questClaimInflight = true;
    if (button) button.disabled = true;
    this.onStatus(`领奖 ${id}…`);
    try {
      const res = await claimQuestWithAssets(this.gateway, id, this.getSession, this.onSessionPatch);
      if (!res || !current()) return;
      await this.refreshQuests();
      if (current()) this.onStatus("任务奖励已领取，资产已同步");
    } catch (e) {
      if (current()) this.onStatus(gatewayErrorMessage(e));
    } finally {
      this.questClaimInflight = false;
      if (button) button.disabled = false;
    }
  }

  private async refreshBag(): Promise<void> {
    const state = this.bagUseContext();
    if (state.needsReload) {
      if (this.useConsumableSubmitState === "submitting") return;
      this.setUseConsumableSubmitState("submitting");
      try {
        if (!await refreshQuestAssets(this.gateway, this.getSession, this.onSessionPatch, state.current)) return;
        state.needsReload = false;
        setBagFormErrorDisplay(this.bagPanel, null);
        this.renderBagList();
        this.onStatus("当前背包与钱包已同步；上次使用结果请核对，未重发使用请求。");
      } catch {
        if (state.current()) setBagFormErrorDisplay(this.bagPanel, QUEST_ASSETS_PENDING);
      } finally {
        if (state.current()) this.setUseConsumableSubmitState("idle");
      }
      return;
    }
    const actor = captureActor(this.gateway, this.getSession);
    const latest = beginAssetRead(this.gateway);
    const previousBag = this.getSession()?.bag;
    const version = ++this.bagReadVersion;
    const current = () => actor() && version === this.bagReadVersion && this.bagPanel.parentNode === this.mount;
    renderSuccessfulReadNotice(this.bagPanel);
    const sid = this.serverId();
    this.bagListLoading = true;
    this.bagListError = null;
    this.renderBagList();
    this.onStatus("拉取背包…");
    try {
      const res = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      if (!current()) return;
      if (!latest() || this.getSession()?.bag !== previousBag) {
        this.bagListLoading = false;
        this.renderBagList();
        return;
      }
      renderSuccessfulReadNotice(this.bagPanel, res);
      const stacks = bagFromListPlayerBagResponse(res.items);
      this.patchBag(stacks);
      this.bagListLoading = false;
      this.bagListError = null;
      this.renderBagList();
      this.onStatus(`背包 ${stacks.length} 种道具（content.v1）`);
    } catch (e) {
      if (!current()) return;
      this.bagListLoading = false;
      this.bagListError = formatPanelGatewayErrorFromUnknownForList("bag", e);
      this.renderBagList();
      this.onStatus(this.bagListError);
    }
  }

  private bagUseContext() {
    if (!this.bagUseState?.current()) {
      const actor = captureActor(this.gateway, this.getSession);
      const state = { current: () => this.bagUseState === state && actor() && this.bagPanel.parentNode === this.mount, needsReload: false };
      this.bagUseState = state;
      this.useConsumableSubmitState = "idle";
      this.setBagFeedback(null);
      setBagFormErrorDisplay(this.bagPanel, null);
    }
    return this.bagUseState;
  }

  private syncUseConsumableSubmitUi(): void {
    const state = this.bagUseContext();
    syncUseConsumableSubmitButtons(this.bagPanel, this.useConsumableSubmitState);
    const hint = bagUseCapabilityHint(this.selectedItemId);
    const guidance = this.bagPanel.querySelector<HTMLElement>('[data-role="bag-use-capability"]');
    if (guidance) { guidance.hidden = !hint; guidance.textContent = hint ?? ""; }
    if (hint || state.needsReload) for (const button of this.bagPanel.querySelectorAll<HTMLButtonElement>('[data-action="use-item"], [data-action="use-item-batch"]')) {
      button.disabled = true;
    }
  }

  private setUseConsumableSubmitState(next: UseConsumableSubmitState): void {
    this.useConsumableSubmitState = next;
    this.syncUseConsumableSubmitUi();
  }

  private pulseBagRowIfStackChanged(itemId: number, quantityBefore: number, remaining: number): void {
    const quantityAfter = remaining > 0 ? remaining : 0;
    this.renderBagList();
    if (!shouldPulseBagStackAfterUse(quantityBefore, quantityAfter)) return;
    const row = findBagStackRow(this.bagPanel, itemId);
    scheduleBagRowUsedPulse(row);
    scheduleBagUseInlinePulse(row);
    scheduleBagUseConsumablePulse(row);
  }

  private async useItem(): Promise<void> {
    const state = this.bagUseContext();
    if (this.useConsumableSubmitState === "submitting" || state.needsReload) return;
    const count = Number((this.bagPanel.querySelector('[data-field="use-count"]') as HTMLInputElement)?.value ?? 1);
    const itemId = this.selectedItemId;
    const bag = this.getSession()?.bag ?? [];
    const validated = validateBagUseConsumable({
      itemCfgId: itemId,
      count,
      bag,
    });
    if (!validated.ok) {
      setBagFormErrorDisplay(this.bagPanel, validated.message);
      this.onStatus(validated.message);
      return;
    }
    setBagFormErrorDisplay(this.bagPanel, null);
    this.useConsumableSubmitState = useConsumableSubmitStateMachine(this.useConsumableSubmitState, {
      type: "CLEAR_ERROR",
    });
    this.setUseConsumableSubmitState(
      useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "SUBMIT" }),
    );
    this.setBagFeedback(null);
    const quantityBefore = bagStackQuantity(bag, itemId);
    try {
      const walletBefore = this.getSession()?.wallet;
      const result = await useBagItemWithAssets(this.gateway, itemId, count, this.getSession, this.onSessionPatch, state.current);
      if (!result || !state.current()) return;
      const res = result.response;
      state.needsReload = !result.synced;
      setBagFormErrorDisplay(this.bagPanel, result.synced ? null : QUEST_ASSETS_PENDING);
      const summary = formatUseConsumableEffectSummary(itemId, res, walletBefore, res.wallet_after);
      this.setBagFeedback(summary);
      this.onStatus(summary);
      this.pulseBagRowIfStackChanged(itemId, quantityBefore, res.remaining ?? 0);
      this.setUseConsumableSubmitState(
        useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "SUCCESS" }),
      );
    } catch (e) {
      if (!state.current()) return;
      state.needsReload = true;
      const msg = `${formatBagUseGatewayErrorFromUnknown(e)}；${BAG_USE_UNKNOWN}`;
      setBagFormErrorDisplay(this.bagPanel, msg);
      this.setBagFeedback(BAG_USE_UNKNOWN);
      this.onStatus(msg);
      this.setUseConsumableSubmitState(
        useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "FAIL" }),
      );
    }
  }

  private async useItemBatch(): Promise<void> {
    const state = this.bagUseContext();
    if (this.useConsumableSubmitState === "submitting" || state.needsReload) return;
    const itemId = this.selectedItemId;
    const slotCount = this.countSelectedBagBatchSlots(itemId);
    const bag = this.getSession()?.bag ?? [];
    const validated = validateBatchUseConsumableSlots({ itemCfgId: itemId, slotCount, bag });
    if (!validated.ok) {
      setBagFormErrorDisplay(this.bagPanel, validated.message);
      this.onStatus(validated.message);
      return;
    }
    setBagFormErrorDisplay(this.bagPanel, null);
    this.setBagFeedback(null);
    this.useConsumableSubmitState = useConsumableSubmitStateMachine(this.useConsumableSubmitState, {
      type: "CLEAR_ERROR",
    });
    this.setUseConsumableSubmitState(
      useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "SUBMIT" }),
    );
    const quantityBefore = bagStackQuantity(bag, itemId);
    const attempts: ({ ok: true } | { ok: false; message: string })[] = [];
    let lastRemaining = quantityBefore;
    try {
      for (let i = 0; i < slotCount; i += 1) {
        try {
          if (!state.current()) return;
          const result = await useBagItemWithAssets(this.gateway, itemId, 1, this.getSession, this.onSessionPatch, state.current);
          if (!result || !state.current()) return;
          const res = result.response;
          state.needsReload = !result.synced;
          lastRemaining = res.remaining ?? 0;
          attempts.push({ ok: true });
          if (state.needsReload) break;
        } catch (e) {
          if (!state.current()) return;
          state.needsReload = true;
          attempts.push({ ok: false, message: `${formatBagUseGatewayErrorFromUnknown(e)}；${BAG_USE_UNKNOWN}` });
          break;
        }
      }
      const summary = summarizeBatchUseConsumableResults(attempts);
      this.setBagFeedback(summary.summaryText);
      if (summary.lastError) {
        setBagFormErrorDisplay(this.bagPanel, summary.lastError);
        this.setUseConsumableSubmitState(
          useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "FAIL" }),
        );
      } else {
        setBagFormErrorDisplay(this.bagPanel, state.needsReload ? QUEST_ASSETS_PENDING : null);
        this.setUseConsumableSubmitState(
          useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "SUCCESS" }),
        );
      }
      this.onStatus(summary.summaryText);
      if (summary.failureCount === 0) {
        this.bagBatchCheckedSlots.clear();
      }
      if (attempts.some((a) => a.ok)) {
        this.pulseBagRowIfStackChanged(itemId, quantityBefore, lastRemaining);
      } else {
        this.renderBagList();
      }
    } finally {
      if (state.current() && this.useConsumableSubmitState === "submitting") {
        this.setUseConsumableSubmitState(
          useConsumableSubmitStateMachine(this.useConsumableSubmitState, { type: "SUCCESS" }),
        );
      }
    }
  }

  private async refreshShop(): Promise<void> {
    const state = this.shopContext();
    if (!state.current() || !this.getSession()) return;
    if (state.busy) { this.syncShopPurchaseSubmit(); return; }
    if (state.needsReload) return this.reloadShopState();
    const version = ++this.shopReadVersion;
    state.busy = "list";
    this.shopListLoading = true;
    this.shopListError = null;
    this.renderShopList();
    try {
      const res = await this.gateway.listShopShelf(this.serverId()) as { offers?: ShopOffer[] };
      if (!state.current() || version !== this.shopReadVersion) return;
      this.shopOffers = res.offers ?? [];
      this.shopStatus(state.outcome || `货架 ${this.shopOffers.length} 个商品`);
    } catch (e) {
      if (!state.current() || version !== this.shopReadVersion) return;
      this.shopListError = formatPanelGatewayErrorFromUnknownForList("shop", e);
      this.shopStatus(this.shopListError);
    } finally {
      if (state.current() && version === this.shopReadVersion) {
        state.busy = "";
        this.shopListLoading = false;
        this.renderShopList();
      }
    }
  }

  private async reloadShopState(owned = false): Promise<void> {
    const state = this.shopContext();
    if (!state.current() || (state.busy && !owned) || !this.getSession() || this.shopPanel.classList.contains("hidden")) return;
    const version = ++this.shopReadVersion;
    state.busy = "reload";
    state.needsReload = true;
    this.syncShopPurchaseSubmit();
    try {
      const snapshot = await readShopCurrentState(this.gateway, this.getSession, state.current);
      if (!snapshot || !state.current()) return;
      if (!snapshot.fresh() || version !== this.shopReadVersion) throw new Error(SHOP_RELOAD_FAILED);
      this.onSessionPatch({ bag: snapshot.bag, wallet: snapshot.wallet });
      this.shopOffers = snapshot.offers;
      this.shopListError = null;
      state.needsReload = false;
      state.warning = SHOP_CURRENT_STATE_ONLY;
      renderSuccessfulReadNotice(this.bagPanel, snapshot.bagRes);
      this.renderBagList();
    } catch {
      if (!state.current()) return;
      state.warning = SHOP_RELOAD_FAILED;
    } finally {
      if (state.current()) {
        state.busy = "";
        this.renderShopList();
        this.shopStatus([state.outcome, state.warning].filter(Boolean).join("；"));
      }
    }
  }

  private async buyOffer(): Promise<void> {
    const state = this.shopContext();
    if (!state.current() || state.busy || state.needsReload || !this.getSession() || this.shopPanel.classList.contains("hidden")) return;
    const offerId = this.selectedOfferId;
    const purchaseCount = 1;
    const offer = this.shopOffers.find((o) => o.offer_id === offerId);
    const walletBefore = this.getSession()?.wallet;
    const validated = validatePurchaseShopOffer({ offer, offerId, purchaseCount, wallet: walletBefore });
    if (!validated.ok) {
      state.warning = validated.message;
      this.shopStatus(validated.message);
      this.syncShopPurchaseSubmit();
      return;
    }
    state.busy = "buy";
    state.needsReload = true;
    state.unknown = false;
    state.outcome = state.warning = "";
    this.shopPurchaseFlash.delete(offerId);
    this.shopLastGrantedItemCfgId = 0;
    beginAssetRead(this.gateway); // Older bag/wallet reads must not overwrite a submitted purchase.
    ++this.shopReadVersion;
    this.renderShopList();
    let res: { granted_items?: { items?: { item_cfg_id?: number; quantity?: number }[] }; wallet_after?: ResourceWallet };
    try {
      res = await this.gateway.purchaseShopOffer(this.serverId(), offerId, purchaseCount) as typeof res;
    } catch (e) {
      if (!state.current()) return;
      const known = isKnownShopRejection(e);
      if (!known) beginAssetRead(this.gateway); // Invalidate reads started during an unconfirmed purchase.
      state.unknown = !known;
      state.outcome = known ? "" : SHOP_UNKNOWN_OUTCOME;
      state.warning = known ? formatPanelGatewayErrorFromUnknown("shop", e) : SHOP_RELOAD_FAILED;
      state.needsReload = !known;
      state.busy = "";
      this.syncShopPurchaseSubmit();
      this.shopStatus(state.outcome || state.warning);
      return; // Never replay, compensate or infer rollback from an unavailable response.
    }
    if (!state.current()) return;
    beginAssetRead(this.gateway); // Invalidate intervening reads even when hidden; do not start recovery.
    const granted = res.granted_items?.items?.[0];
    this.shopLastGrantedItemCfgId = Math.floor(Number(granted?.item_cfg_id) || 0);
    state.outcome = `${formatShopPurchaseSuccess(offerId)} · ${formatShopPurchaseFeedback(purchaseCount, undefined, {
      itemCfgId: granted?.item_cfg_id, grantedQty: granted?.quantity,
    })}`; // granted_items already contains total quantity, not quantity per purchase.
    state.warning = SHOP_RELOAD_FAILED;
    this.shopPurchaseFlash.set(offerId, `已购 +${purchaseCount}`);
    this.syncShopPurchaseSubmit();
    if (this.shopPanel.classList.contains("hidden")) {
      state.busy = "";
      this.syncShopPurchaseSubmit();
      return; // Closing never cancels the sent action or starts background recovery.
    }
    const pulseKeys = walletShopPurchaseDeductPulseKeys(walletBefore, res.wallet_after, offer?.price_resources, purchaseCount);
    if (pulseKeys.length) this.onShopMaterialPulse?.(pulseKeys);
    this.shopStatus(state.outcome);
    await this.reloadShopState(true);
  }

  private onQuestSelect(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "quest-id") {
      this.selectedQuestId = Number((t as HTMLInputElement).value) || 1001;
    }
  }

  private onBagSelect(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "item-id") {
      this.selectedItemId = Number((t as HTMLSelectElement).value) || 2001;
      this.bagBatchCheckedSlots.clear();
      this.renderBagList();
      this.syncBagWalletGap();
    }
    if (t.getAttribute("data-field") === "use-count") {
      this.syncBagWalletGap();
    }
    if (t.getAttribute("data-role") === "bag-slot-checkbox") {
      const idx = Number(t.getAttribute("data-slot-index"));
      const itemId = Number(t.getAttribute("data-item-id"));
      if (itemId !== this.selectedItemId || !Number.isInteger(idx)) return;
      if ((t as HTMLInputElement).checked) this.bagBatchCheckedSlots.add(idx);
      else this.bagBatchCheckedSlots.delete(idx);
    }
  }

  private onShopSelect(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "offer-id") {
      this.selectedOfferId = Number((t as HTMLSelectElement).value) || 1001;
      this.syncShopWalletGap();
      this.syncShopInlineStateResidualRing();
    }
  }

  private onQuestClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-quests") void this.refreshQuests();
    if (a === "accept-quest") void this.acceptQuest();
    if (a === "claim-quest") void this.claimQuest();
  }

  private onBagClick(ev: Event): void {
    const catBtn = (ev.target as HTMLElement).closest("[data-bag-category]");
    if (catBtn) {
      const next = catBtn.getAttribute("data-bag-category") as BagClientCategory | null;
      if (next && next !== this.bagCategory) {
        this.switchBagCategory(next);
      }
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "bag-return-hero") this.returnToHeroDetailFromBag();
    if (a === "refresh-bag" || a === "retry-refresh-bag") void this.refreshBag();
    if (a === "use-item") void this.useItem();
    if (a === "use-item-batch") void this.useItemBatch();
  }

  /** Keep selection stable, even at zero stock; never silently retarget a use. */
  private syncBagItemSelect(): void {
    const sel = this.bagPanel.querySelector<HTMLSelectElement>('[data-field="item-id"]');
    if (!sel) return;
    const bag = this.getSession()?.bag ?? [];
    const ids = new Set([2001, 2003, 2020, this.selectedItemId]);
    for (const row of bag) {
      if (Number.isSafeInteger(row.item_cfg_id) && row.item_cfg_id > 0 && row.quantity > 0) ids.add(row.item_cfg_id);
    }
    sel.replaceChildren(...[...ids].sort((a, b) => a - b).map(id => {
      const option = document.createElement("option");
      option.value = String(id);
      option.textContent = `${id} ${itemLabel(id)} · 持有 ${bagStackQuantity(bag, id)}`;
      return option;
    }));
    sel.value = String(this.selectedItemId);
  }

  private onShopClick(ev: Event): void {
    const catBtn = (ev.target as HTMLElement).closest("[data-shop-category]");
    if (catBtn) {
      const next = catBtn.getAttribute("data-shop-category") as ShopOfferClientCategory | null;
      if (next && next !== this.shopCategory) {
        this.switchShopCategory(next);
      }
      return;
    }
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-shop" || a === "retry-refresh-shop") void this.refreshShop();
    if (a === "reload-shop-state") void this.reloadShopState();
    if (a === "buy-offer") void this.buyOffer();
    if (a === "shop-view-granted-bag") {
      this.openBagFromShopDeepLink(this.shopLastGrantedItemCfgId);
    }
  }
}
