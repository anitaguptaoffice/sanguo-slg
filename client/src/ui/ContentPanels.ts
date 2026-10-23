import type { MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  applyUseResult,
  type BagStack,
  bagFromListPlayerBagResponse,
  mergeRewardBundle,
  mergeWallet,
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
  validateUseConsumable,
} from "@/net/contentFormValidation";
import { formatQuestLine, formatWalletPrice, itemLabel } from "@/net/contentFormat";
import {
  bagEmptyListClass,
  bagEmptyListMessage,
  formatBagStackRowLabel,
} from "@/net/panelDensity";

type QuestProgress = {
  quest_cfg_id?: number;
  quest_code?: string;
  state?: number;
  progress_current?: number;
  progress_target?: number;
};

type ShopOffer = {
  offer_id?: number;
  shelf_name?: string;
  item_cfg_id?: number;
  quantity_per_purchase?: number;
  price_resources?: ResourceWallet;
  purchase_limit?: number;
  purchased_count?: number;
  sold_out?: boolean;
};

export class ContentPanels {
  private questPanel!: HTMLElement;
  private bagPanel!: HTMLElement;
  private shopPanel!: HTMLElement;
  private questRows: QuestProgress[] = [];
  private shopOffers: ShopOffer[] = [];
  private selectedQuestId = 1001;
  private selectedItemId = 2001;
  private selectedOfferId = 1001;
  private bagHighlightItemId = 0;
  private bagHighlightItemIds = new Set<number>();
  /** 最近一次购买成功时行内追加文案（offer_id → 摘要）。 */
  private shopPurchaseFlash = new Map<number, string>();

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private onSessionPatch: (patch: Partial<MainCitySession>) => void,
    private onStatus: (msg: string) => void,
  ) {}

  attach(): void {
    this.questPanel = this.buildQuestPanel();
    this.bagPanel = this.buildBagPanel();
    this.shopPanel = this.buildShopPanel();
    this.mount.appendChild(this.questPanel);
    this.mount.appendChild(this.bagPanel);
    this.mount.appendChild(this.shopPanel);
    this.questPanel.addEventListener("click", (ev) => this.onQuestClick(ev));
    this.bagPanel.addEventListener("click", (ev) => this.onBagClick(ev));
    this.shopPanel.addEventListener("click", (ev) => this.onShopClick(ev));
    this.questPanel.addEventListener("change", (ev) => this.onQuestSelect(ev));
    this.bagPanel.addEventListener("change", (ev) => this.onBagSelect(ev));
    this.shopPanel.addEventListener("change", (ev) => this.onShopSelect(ev));
  }

  detach(): void {
    this.questPanel?.remove();
    this.bagPanel?.remove();
    this.shopPanel?.remove();
  }

  toggleQuest(): void {
    this.questPanel.classList.toggle("hidden");
    if (!this.questPanel.classList.contains("hidden")) void this.refreshQuests();
  }

  toggleBag(): void {
    this.bagPanel.classList.toggle("hidden");
    if (!this.bagPanel.classList.contains("hidden")) void this.refreshBag();
  }

  getBagRoot(): HTMLElement {
    return this.bagPanel;
  }

  /** 日常战备：打开背包并高亮指定 item_cfg_id（如 march_ration=2020）。 */
  openBagHighlightItem(itemCfgId: number): void {
    this.bagHighlightItemIds = new Set(itemCfgId > 0 ? [itemCfgId] : []);
    this.bagHighlightItemId = itemCfgId;
    this.selectedItemId = itemCfgId;
    this.ensureBagSelectOption(itemCfgId);
    const sel = this.bagPanel.querySelector('[data-field="item-id"]') as HTMLSelectElement | null;
    if (sel) sel.value = String(itemCfgId);
    this.bagPanel.classList.remove("hidden");
    const hint = this.bagPanel.querySelector('[data-role="bag-hint"]');
    if (hint) {
      hint.textContent = `筛选高亮 item_cfg_id=${itemCfgId}；「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量。`;
    }
    void this.refreshBag();
  }

  /** 将领养成互链：高亮多个养成消耗品（ListPlayerBag 过滤结果）。 */
  openBagHighlightItems(itemCfgIds: number[]): void {
    const ids = itemCfgIds.filter((id) => id > 0);
    this.bagHighlightItemIds = new Set(ids);
    const first = ids[0] ?? 0;
    this.bagHighlightItemId = first;
    if (first) {
      this.selectedItemId = first;
      this.ensureBagSelectOption(first);
      const sel = this.bagPanel.querySelector('[data-field="item-id"]') as HTMLSelectElement | null;
      if (sel) sel.value = String(first);
    }
    this.bagPanel.classList.remove("hidden");
    const hint = this.bagPanel.querySelector('[data-role="bag-hint"]');
    if (hint) {
      hint.textContent = ids.length
        ? `将领养成高亮 item_cfg_id=${ids.join("、")}；「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量。`
        : "暂无养成消耗品；「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量。";
    }
    void this.refreshBag();
  }

  toggleShop(): void {
    this.shopPanel.classList.toggle("hidden");
    if (!this.shopPanel.classList.contains("hidden")) void this.refreshShop();
  }

  private serverId(): number {
    const s = this.getSession();
    return s?.serverId ?? this.gateway.getBoundServerId() ?? s?.player?.server_id ?? 0;
  }

  private patchBag(bag: BagStack[]): void {
    this.onSessionPatch({ bag });
    this.renderBagList();
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
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>任务</h3>
      <label>任务 ID
        <input type="number" data-field="quest-id" min="1001" value="1001" />
      </label>
      <button type="button" data-action="refresh-quests">刷新列表</button>
      <button type="button" data-action="accept-quest">接取</button>
      <button type="button" data-action="report-quest">上报进度(绝对值2)</button>
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
      <p data-role="bag-hint">「刷新背包」经 content.v1.ListPlayerBag 拉服务端全量；领奖/购买仍会先合并到本会话。</p>
      <label>道具
        <select data-field="item-id">
          <option value="2001">2001 谷袋·初备</option>
          <option value="2003">2003 急工符·五刻</option>
          <option value="2020">2020 远征干粮</option>
        </select>
      </label>
      <label>数量 <input type="number" data-field="use-count" min="1" value="1" /></label>
      <p class="bag-form-error hidden" data-role="bag-form-error" role="alert"></p>
      <div class="content-panel-actions">
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="refresh-bag">刷新背包</button>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="use-item">使用道具</button>
      </div>
      <ul class="bag-list" data-role="bag-list"></ul>
      <p class="panel-feedback bag-panel-feedback" data-role="bag-feedback" hidden></p>
    `;
    return el;
  }

  private buildShopPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden";
    el.innerHTML = `
      <h3>商城</h3>
      <p data-role="shop-hint">扣费结果以 wallet_after 为准（ECON-001 真钱包）。</p>
      <p class="panel-feedback" data-role="shop-feedback" hidden></p>
      <button type="button" data-action="refresh-shop">刷新货架</button>
      <label>商品 offer
        <select data-field="offer-id"></select>
      </label>
      <p class="shop-form-error hidden" data-role="shop-form-error" role="alert"></p>
      <button type="button" data-action="buy-offer">购买×1</button>
      <ul class="shop-list" data-role="shop-list"></ul>
    `;
    return el;
  }

  private renderQuestList(): void {
    const ul = this.questPanel.querySelector('[data-role="quest-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    for (const q of this.questRows) {
      const li = document.createElement("li");
      li.textContent = formatQuestLine(q);
      ul.appendChild(li);
    }
  }

  private renderBagList(): void {
    const ul = this.bagPanel.querySelector('[data-role="bag-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    const bag = this.getSession()?.bag ?? [];
    for (const row of bag) {
      const li = document.createElement("li");
      li.className = "bag-stack-row";
      const { idCell, name, qtyCell } = formatBagStackRowLabel(row);
      const idSpan = document.createElement("span");
      idSpan.className = "bag-stack-id";
      idSpan.textContent = idCell;
      const nameSpan = document.createElement("span");
      nameSpan.className = "bag-stack-name";
      nameSpan.textContent = name;
      const qtySpan = document.createElement("span");
      qtySpan.className = "bag-stack-qty";
      qtySpan.textContent = `×${qtyCell.trim()}`;
      li.appendChild(idSpan);
      li.appendChild(nameSpan);
      li.appendChild(qtySpan);
      if (
        row.item_cfg_id &&
        (this.bagHighlightItemIds.has(row.item_cfg_id) ||
          (this.bagHighlightItemId && row.item_cfg_id === this.bagHighlightItemId))
      ) {
        li.classList.add("item-highlight");
      }
      ul.appendChild(li);
    }
    if (!bag.length) {
      const li = document.createElement("li");
      li.className = bagEmptyListClass();
      li.textContent = bagEmptyListMessage();
      ul.appendChild(li);
    }
  }

  private renderShopList(): void {
    const ul = this.shopPanel.querySelector('[data-role="shop-list"]');
    const sel = this.shopPanel.querySelector('[data-field="offer-id"]') as HTMLSelectElement;
    if (!ul || !sel) return;
    ul.innerHTML = "";
    sel.innerHTML = "";
    for (const o of this.shopOffers) {
      const li = document.createElement("li");
      const price = formatWalletPrice(o.price_resources ?? {});
      let line = formatShopOfferListLine(o, price);
      const flash = this.shopPurchaseFlash.get(o.offer_id ?? 0);
      if (flash) line += ` · ${flash}`;
      li.textContent = line;
      ul.appendChild(li);
      const opt = document.createElement("option");
      opt.value = String(o.offer_id ?? 0);
      opt.textContent = `#${o.offer_id} ${itemLabel(o.item_cfg_id)}`;
      sel.appendChild(opt);
    }
    if (this.shopOffers[0]?.offer_id) {
      sel.value = String(this.selectedOfferId || this.shopOffers[0].offer_id);
    }
  }

  private async refreshQuests(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取任务…");
    try {
      const res = (await this.gateway.listPlayerQuests(sid, { includeCompleted: true })) as {
        quests?: QuestProgress[];
      };
      this.questRows = res.quests ?? [];
      this.renderQuestList();
      this.onStatus(`任务 ${this.questRows.length} 条`);
    } catch (e) {
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async acceptQuest(): Promise<void> {
    const sid = this.serverId();
    const id = this.selectedQuestId;
    this.onStatus(`接取任务 ${id}…`);
    try {
      await this.gateway.acceptQuest(sid, id);
      await this.refreshQuests();
      this.onStatus(`已接取 #${id}`);
    } catch (e) {
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async reportQuest(): Promise<void> {
    const sid = this.serverId();
    const id = this.selectedQuestId;
    this.onStatus(`上报任务 ${id} 进度…`);
    try {
      await this.gateway.reportQuestProgress(sid, id, true, 2);
      await this.refreshQuests();
      this.onStatus("进度已上报");
    } catch (e) {
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async claimQuest(): Promise<void> {
    const sid = this.serverId();
    const id = this.selectedQuestId;
    this.onStatus(`领奖 ${id}…`);
    try {
      const res = (await this.gateway.claimQuestReward(sid, id)) as {
        granted_rewards?: { items?: { item_cfg_id?: number; quantity?: number }[]; resources?: ResourceWallet };
      };
      const session = this.getSession();
      if (session) {
        const bag = mergeRewardBundle(session.bag, res.granted_rewards);
        const wallet = mergeWallet(session.wallet, res.granted_rewards?.resources);
        this.onSessionPatch({ bag, wallet });
      }
      await this.refreshQuests();
      this.onStatus("任务奖励已领取");
    } catch (e) {
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async refreshBag(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取背包…");
    try {
      const res = (await this.gateway.listPlayerBag(sid)) as {
        items?: { item_cfg_id?: number; quantity?: number }[];
      };
      const stacks = bagFromListPlayerBagResponse(res.items);
      this.patchBag(stacks);
      this.onStatus(`背包 ${stacks.length} 种道具（content.v1）`);
    } catch (e) {
      this.renderBagList();
      this.onStatus(`背包刷新失败：${gatewayErrorMessage(e)}`);
    }
  }

  private async useItem(): Promise<void> {
    const sid = this.serverId();
    const count = Number((this.bagPanel.querySelector('[data-field="use-count"]') as HTMLInputElement)?.value ?? 1);
    const itemId = this.selectedItemId;
    const validated = validateUseConsumable({
      itemCfgId: itemId,
      count,
      bag: this.getSession()?.bag ?? [],
    });
    if (!validated.ok) {
      setBagFormErrorDisplay(this.bagPanel, validated.message);
      this.onStatus(validated.message);
      return;
    }
    setBagFormErrorDisplay(this.bagPanel, null);
    this.onStatus(`使用 ${itemLabel(itemId)}×${count}…`);
    this.setBagFeedback(null);
    try {
      const res = (await this.gateway.useConsumable(sid, itemId, count)) as {
        remaining?: number;
        wallet_after?: ResourceWallet;
        effect_summary?: string;
        speedup_seconds?: number;
      };
      const session = this.getSession();
      const walletBefore = session?.wallet;
      if (session) {
        const bag = applyUseResult(session.bag, itemId, res.remaining ?? 0);
        const wallet = res.wallet_after ? { ...res.wallet_after } : session.wallet;
        this.onSessionPatch({ bag, wallet });
      }
      setBagFormErrorDisplay(this.bagPanel, null);
      const summary = formatUseConsumableEffectSummary(itemId, res, walletBefore, res.wallet_after);
      this.setBagFeedback(summary);
      this.onStatus(summary);
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("bag", e);
      setBagFormErrorDisplay(this.bagPanel, msg);
      this.setBagFeedback(null);
      this.onStatus(msg);
    }
  }

  private async refreshShop(): Promise<void> {
    const sid = this.serverId();
    this.onStatus("拉取货架…");
    try {
      const res = (await this.gateway.listShopShelf(sid)) as { offers?: ShopOffer[] };
      this.shopOffers = res.offers ?? [];
      this.renderShopList();
      this.onStatus(`货架 ${this.shopOffers.length} 个商品`);
    } catch (e) {
      this.onStatus(gatewayErrorMessage(e));
    }
  }

  private async buyOffer(): Promise<void> {
    const sid = this.serverId();
    const offerId = this.selectedOfferId;
    const purchaseCount = 1;
    const offer = this.shopOffers.find((o) => o.offer_id === offerId);
    const session = this.getSession();
    const validated = validatePurchaseShopOffer({
      offer,
      offerId,
      purchaseCount,
      wallet: session?.wallet,
    });
    if (!validated.ok) {
      setShopFormErrorDisplay(this.shopPanel, validated.message);
      this.onStatus(validated.message);
      return;
    }
    setShopFormErrorDisplay(this.shopPanel, null);
    this.onStatus(`购买 offer ${offerId}…`);
    this.setShopFeedback(null);
    try {
      const res = (await this.gateway.purchaseShopOffer(sid, offerId, purchaseCount)) as {
        granted_items?: { items?: { item_cfg_id?: number; quantity?: number }[] };
        wallet_after?: ResourceWallet;
        offer?: ShopOffer;
      };
      const session = this.getSession();
      if (session) {
        const bag = mergeRewardBundle(session.bag, res.granted_items);
        const wallet = res.wallet_after ? { ...res.wallet_after } : session.wallet;
        this.onSessionPatch({ bag, wallet });
      }
      const granted = res.granted_items?.items?.[0];
      const grantedQty = (granted?.quantity ?? 1) * purchaseCount;
      const feedback = formatShopPurchaseFeedback(purchaseCount, res.wallet_after, {
        itemCfgId: granted?.item_cfg_id,
        grantedQty,
      });
      setShopFormErrorDisplay(this.shopPanel, null);
      this.shopPurchaseFlash.set(offerId, `已购 +${purchaseCount}`);
      this.setShopFeedback(feedback);
      await this.refreshShop();
      this.onStatus(feedback);
    } catch (e) {
      const msg = formatPanelGatewayErrorFromUnknown("shop", e);
      setShopFormErrorDisplay(this.shopPanel, msg);
      this.setShopFeedback(null);
      this.onStatus(msg);
    }
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
    }
  }

  private onShopSelect(ev: Event): void {
    const t = ev.target as HTMLElement;
    if (t.getAttribute("data-field") === "offer-id") {
      this.selectedOfferId = Number((t as HTMLSelectElement).value) || 1001;
    }
  }

  private onQuestClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-quests") void this.refreshQuests();
    if (a === "accept-quest") void this.acceptQuest();
    if (a === "report-quest") void this.reportQuest();
    if (a === "claim-quest") void this.claimQuest();
  }

  private onBagClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-bag") void this.refreshBag();
    if (a === "use-item") void this.useItem();
  }

  private ensureBagSelectOption(itemCfgId: number): void {
    const sel = this.bagPanel.querySelector('[data-field="item-id"]') as HTMLSelectElement | null;
    if (!sel) return;
    const exists = [...sel.options].some((o) => Number(o.value) === itemCfgId);
    if (exists) return;
    const opt = document.createElement("option");
    opt.value = String(itemCfgId);
    opt.textContent = `${itemCfgId} ${itemLabel(itemCfgId)}`;
    sel.appendChild(opt);
  }

  private onShopClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (!btn) return;
    const a = btn.getAttribute("data-action");
    if (a === "refresh-shop") void this.refreshShop();
    if (a === "buy-offer") void this.buyOffer();
  }
}
