import { openCenterPanel } from "@/ui/centerPanelForeground";
import type { CityBuilding, MainCitySession, ResourceWallet } from "@/net/bootstrapSession";
import {
  buildSubmitButtonDisabled,
  buildSubmitButtonLabel,
  type BuildSubmitState,
} from "@/net/buildSubmitFeedback";
import { buildingBySlot } from "@/net/hudFormat";
import { formatBuildUpgradeCostLine } from "@/net/buildUpgradeCostLine";
import { previewUpgradeCost } from "@/net/previewUpgradeCost";
import { buildUpgradePrerequisiteHint } from "@/net/buildUpgradePrerequisite";
import {
  applyPanelStateChrome,
  PANEL_STATE_CHROME_CLASS,
  PANEL_STATE_LOADING_MESSAGE,
} from "@/engine/panelStateChrome";
import { createCenterPanelFocusTrap, type CenterPanelFocusTrap } from "@/ui/centerPanelFocusTrap";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";

export type MainCityBuildingPanelReskin = (root: HTMLElement) => void;

export type TechnicRow = {
  tid?: number;
  name?: string;
  level?: number;
  max_level?: number;
  academy_level?: number;
  can_research?: boolean;
  reason?: string;
  next_cost?: { food?: number; wood?: number; stone?: number; iron?: number };
  next_time_sec?: number;
};

export type CityOfficeRow = {
  office?: number;
  hero_id?: number;
  name?: string;
  level?: number;
  loyalty?: number;
  salary?: number;
  production_pct?: number;
  build_pct?: number;
  research_pct?: number;
  defense_pct?: number;
  attack_pct?: number;
};

export type OfficeHeroOption = { hero_id?: number; name?: string; level?: number; status?: number };
export type WallDefenseRow = { defense_type?: number; name?: string; count?: number; space?: number };
export type MarketOfferRow = {
  offer_id?: number; seller_city_id?: number; seller_name?: string; resource_type?: number;
  amount?: number; price_milli?: number; gold_total?: number; distance?: number;
  deliver_seconds?: number; own?: boolean;
};
export type MarketDeliveryRow = {
  offer_id?: number; seller_city_id?: number; resource_type?: number;
  amount?: number; gold_total?: number; deliver_at_ms?: number;
};
export type MarketView = {
  market_level?: number; listing_capacity?: number; caravan_capacity?: number;
  max_listing_amount?: number; gold?: number; offers?: MarketOfferRow[];
  own_offers?: MarketOfferRow[]; deliveries?: MarketDeliveryRow[];
};
export type TacticPresetRow = { unit_cfg_id?: number; troop_type?: number; target_type?: number; hold?: boolean };
export type RankView = {
  prestige?: number; rank_level?: number; city_cap?: number;
  next_prestige?: number; next_cap?: number;
};
export type HistoricalHeroRow = {
  npc_cfg_id?: number; template_cfg_id?: number; display_name?: string; level?: number;
  force?: number; intel?: number; politics?: number; command?: number;
  x?: number; y?: number; state?: number; owner_player_id?: number; city_id?: number;
  friend?: number; discovered?: boolean;
};
export type EquipmentRow = {
  equipment_id?: number; cfg_id?: number; slot_type?: number; tier?: number; name?: string;
  enhance_level?: number; max_enhance?: number; gems?: number[]; speed_pct?: number;
  equipped?: boolean; hero_id?: number;
  attrs?: { force?: number; intel?: number; politics?: number; command?: number };
};
export type StorehouseView = {
  level?: number; capacity_bonus?: number; protection_percent?: number;
  protected_amount?: { food?: number; wood?: number; stone?: number; iron?: number };
};

export class MainCityBuildingPanel {
  private panel!: HTMLElement;
  private selectedSlotKey: string | null = null;
  private technics: TechnicRow[] = [];
  private researchJob: { tid?: number; target?: number; finish_at_ms?: number } | null = null;
  private offices: CityOfficeRow[] = [];
  private officeHeroes: OfficeHeroOption[] = [];
  private wallDefenses: WallDefenseRow[] = [];
  private wallArea = 0;
  private wallUsed = 0;
  private market: MarketView | null = null;
  private storehouse: StorehouseView | null = null;
  private tactics: TacticPresetRow[] = [];
  private equipmentHeroId = 0;
  private equipped: EquipmentRow[] = [];
  private inventory: EquipmentRow[] = [];
  private blacksmithLevel = 0;
  private stableLevel = 0;
  private historical: HistoricalHeroRow[] = [];
  private rank: RankView | null = null;
  private focusTrap: CenterPanelFocusTrap | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly slotLabels: Record<string, string>,
    private readonly getSession: () => MainCitySession | null,
    private readonly onUpgrade: (slotKey: string, buildingCfgId: number) => void,
    private readonly getSubmitState: () => BuildSubmitState,
    private readonly reskin?: MainCityBuildingPanelReskin,
    private readonly defaultDismissTrigger?: () => HTMLElement | null,
    private readonly onDemolish?: (slotKey: string) => void,
    private readonly onResearchTechnic?: (tid: number) => void,
    private readonly onOfficeAction?: (action: string, office: number, heroId: number) => void,
    private readonly onWallAction?: (action: string, defenseType: number, unitId: number) => void,
    private readonly onMarketAction?: (action: string, resourceType: number, amount: number, priceMilli: number, hours: number, offerId: number) => void,
    private readonly onTacticAction?: (unitCfgId: number, targetType: number, hold: boolean) => void,
    private readonly onRunDrill?: () => void,
    private readonly onEquipmentAction?: (action: string, slotType: number, tier: number, equipmentId: number, gemCfgId: number) => void,
    private readonly onHistoricalAction?: (action: string, npcCfgId: number) => void,
    private readonly onTrickAction?: (trickType: number, targetMarchId: number) => void,
    private readonly onRankAction?: (action: "promote" | "found", name: string, x: number, y: number) => void,
  ) {}

  attach(): void {
    this.panel = document.createElement("div");
    this.panel.className = "building-panel hidden";
    this.panel.dataset.centerPanel = "building";
    this.panel.innerHTML = `
      <h3 data-role="build-title">建造</h3>
      <div class="panel-scroll-body" data-role="building-scroll">
        <p class="building-level-line" data-role="build-level"></p>
        <p class="building-upgrade-preview" data-role="build-preview"></p>
        <p class="build-form-error hidden" data-role="build-prerequisite" id="build-prerequisite" role="status"></p>
        <p class="build-form-error hidden" data-role="build-form-error" role="alert"></p>
        <button type="button" class="art-btn-primary art-btn-primary-full" data-action="confirm-upgrade" aria-describedby="build-prerequisite" disabled>
          确认升级
        </button>
        <button type="button" class="build-demolish hidden" data-action="demolish-building">
          降级/拆除（返还 25%）
        </button>
        <div class="wall-defenses hidden" data-role="wall-defenses">
          <h4>城墙城防</h4>
          <p data-role="wall-status"></p>
          <div class="city-civic-actions" data-role="wall-build-buttons"></div>
          <h4>伤兵治疗</h4>
          <p data-role="wounded-status"></p>
          <div class="city-civic-actions" data-role="wounded-buttons"></div>
        </div>
        <div class="market-section hidden" data-role="market">
          <h4>NPC 商人</h4>
          <p data-role="market-status"></p>
          <label>资源 <select data-field="market-resource">
            <option value="0">粮食</option><option value="1">木材</option>
            <option value="2">石料</option><option value="3">铁锭</option>
          </select></label>
          <label>数量 <input type="number" min="1" step="1" value="100" data-field="market-amount"></label>
          <div class="city-civic-actions">
            <button type="button" data-action="buy-merchant">向商人买入</button>
            <button type="button" data-action="sell-merchant">向商人卖出</button>
          </div>
          <h4>同服挂单</h4>
          <p data-role="market-offers-status"></p>
          <div data-role="market-offers"></div>
          <h4>我的挂单</h4>
          <div data-role="market-own"></div>
          <h4>商队运输</h4>
          <div data-role="market-deliveries"></div>
          <h4>发布挂单</h4>
          <label>数量 <input type="number" min="1" step="1" value="100" data-field="offer-amount"></label>
          <label>单价（千金币/单位） <input type="number" min="1" step="1" value="100" data-field="offer-price"></label>
          <label>可见范围 <select data-field="offer-hours">
            <option value="1">1 小时</option><option value="4">4 小时</option>
            <option value="12">12 小时</option><option value="24">24 小时</option>
          </select></label>
          <button type="button" data-action="create-offer">发布挂单</button>
        </div>
        <div class="drill-tactics hidden" data-role="drill-tactics">
          <h4>校场战术</h4>
          <p data-role="drill-status"></p>
          <label>兵种 <select data-field="tactic-troop">
            <option value="1">步兵</option><option value="2">骑兵</option>
            <option value="3">弓兵</option><option value="4">器械</option>
            <option value="5">民夫</option><option value="6">义兵</option>
            <option value="7">斥候</option><option value="8">长枪兵</option>
            <option value="9">刀盾兵</option><option value="10">长弓手</option>
            <option value="11">轻骑</option><option value="12">铁骑</option>
          </select></label>
          <label>集火目标 <select data-field="tactic-target">
            <option value="-1">默认</option><option value="0">步兵</option>
            <option value="1">骑兵</option><option value="2">弓兵</option><option value="3">器械</option>
          </select></label>
          <label><input type="checkbox" data-field="tactic-hold"> 坚守不推进</label>
          <button type="button" data-action="save-tactic">保存战术</button>
          <button type="button" data-action="run-drill">沙盘演习（100 步 vs 100 弓）</button>
          <div data-role="tactic-list"></div>
        </div>
        <div class="historical-section hidden" data-role="historical">
          <h4>历史名将传闻</h4>
          <p data-role="historical-status"></p>
          <div data-role="historical-list"></div>
        </div>
        <div class="equipment-section hidden" data-role="equipment">
          <h4>装备工坊</h4>
          <p data-role="equipment-status"></p>
          <div class="city-civic-actions" data-role="equipment-forge"></div>
          <h4>已穿戴</h4>
          <div data-role="equipment-equipped"></div>
          <h4>背包</h4>
          <div data-role="equipment-inventory"></div>
        </div>
        <div class="storehouse-section hidden" data-role="storehouse">
          <h4>仓库</h4>
          <p data-role="storehouse-status"></p>
        </div>
        <div class="rank-section hidden" data-role="rank">
          <h4>声望与爵位</h4>
          <p data-role="rank-status"></p>
          <button type="button" data-action="promote-rank">晋升爵位</button>
          <h4>平地筑城</h4>
          <label>城名 <input type="text" data-field="found-name" value="新城"></label>
          <label>坐标 X <input type="number" data-field="found-x" value="61"></label>
          <label>坐标 Y <input type="number" data-field="found-y" value="61"></label>
          <button type="button" data-action="found-city">筑城</button>
        </div>
        <div class="trick-section hidden" data-role="tricks">
          <h4>招贤馆计谋</h4>
          <p data-role="trick-status">需任命军师，消耗 1 个锦囊；千里奔袭选己方行军，八门金锁/关门打狗选敌方行军</p>
          <label>目标行军 ID <input type="number" min="1" step="1" data-field="trick-march" value="1"></label>
          <div class="city-civic-actions">
            <button type="button" data-action="cast-trick" data-trick-type="1">千里奔袭</button>
            <button type="button" data-action="cast-trick" data-trick-type="2">八门金锁</button>
            <button type="button" data-action="cast-trick" data-trick-type="3">关门打狗</button>
            <button type="button" data-action="cast-trick" data-trick-type="4">空城计</button>
          </div>
        </div>
        <div class="city-offices hidden" data-role="city-offices">
          <h4>招贤馆三职</h4>
          <p data-role="office-status"></p>
          <label>职位 <select data-field="office-kind">
            <option value="1">城守</option><option value="2">军师</option><option value="3">主将</option>
          </select></label>
          <label>将领 <select data-field="office-hero"></select></label>
          <div class="city-civic-actions">
            <button type="button" data-action="appoint-office">任命</button>
            <button type="button" data-action="clear-office">卸任</button>
            <button type="button" data-action="pay-office">发俸禄</button>
            <button type="button" data-action="reward-office">赏赐（500 金）</button>
          </div>
        </div>
        <div class="academy-technic-section hidden" data-role="academy-technics">
          <h4>书院科技</h4>
          <p data-role="technic-status"></p>
          <label>科技 <select data-role="technic-select"></select></label>
          <p data-role="technic-detail"></p>
          <button type="button" data-action="research-technic">开始研究</button>
        </div>
      </div>
    `;
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
    this.focusTrap = createCenterPanelFocusTrap(this.panel, () => this.close());
    this.reskin?.(this.panel);
  }

  detach(): void {
    this.focusTrap?.dispose();
    this.focusTrap = null;
    this.panel?.remove();
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  isOpen(): boolean {
    return !!this.panel && !this.panel.classList.contains("hidden");
  }

  close(): void {
    this.focusTrap?.setOpen(false);
    this.panel?.classList.add("hidden");
    this.selectedSlotKey = null;
  }

  selectSlot(slotKey: string, opts?: { dismissTrigger?: HTMLElement | null }): void {
    this.selectedSlotKey = slotKey.trim() || null;
    openCenterPanel(this.panel);
    resetCenterPanelViewportScroll(this.panel);
    this.render();
    resetCenterPanelViewportScroll(this.panel);
    const trigger =
      opts?.dismissTrigger ?? this.defaultDismissTrigger?.() ?? null;
    this.focusTrap?.setOpen(true, trigger);
  }

  setTechnics(techs: TechnicRow[], job: { tid?: number; target?: number; finish_at_ms?: number } | null): void {
    this.technics = techs;
    this.researchJob = job;
    this.renderTechnics();
  }

  setCityOffices(offices: CityOfficeRow[], heroes: OfficeHeroOption[]): void {
    this.offices = offices;
    this.officeHeroes = heroes;
    this.renderOffices();
  }

  updateCityOffices(offices: CityOfficeRow[]): void {
    this.offices = offices;
    this.renderOffices();
  }

  sync(): void {
    if (!this.isOpen() || !this.selectedSlotKey) return;
    this.render();
  }

  setFormError(message: string | null): void {
    const el = this.panel?.querySelector('[data-role="build-form-error"]');
    if (!el) return;
    if (message?.trim()) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  private buildingForSlot(slotKey: string): CityBuilding | undefined {
    return buildingBySlot(this.getSession()?.buildings, slotKey);
  }

  private wallet(): ResourceWallet | undefined {
    return this.getSession()?.wallet;
  }

  render(): void {
    if (!this.panel) return;
    const slotKey = this.selectedSlotKey;
    const titleEl = this.panel.querySelector('[data-role="build-title"]');
    const levelEl = this.panel.querySelector('[data-role="build-level"]');
    const previewEl = this.panel.querySelector('[data-role="build-preview"]');
    const prerequisiteEl = this.panel.querySelector('[data-role="build-prerequisite"]');
    const btn = this.panel.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]');
    const demolishBtn = this.panel.querySelector<HTMLButtonElement>('[data-action="demolish-building"]');
    if (!slotKey || !titleEl || !levelEl || !previewEl || !prerequisiteEl || !btn) return;
    prerequisiteEl.textContent = "";
    prerequisiteEl.classList.add("hidden");

    const label = this.slotLabels[slotKey] ?? slotKey;
    titleEl.textContent = label;
    const building = this.buildingForSlot(slotKey);
    const level = building?.level ?? 0;
    const now = Date.now();
    const upgrading = (building?.upgrade_finish_at_ms ?? 0) > now;

    levelEl.textContent = level > 0 ? `当前 Lv${level}` : "未建造";
    const academy = this.panel.querySelector<HTMLElement>('[data-role="academy-technics"]');
    academy?.classList.toggle("hidden", slotKey !== "academy");
    if (slotKey === "academy") this.renderTechnics();
    const rankEl = this.panel.querySelector<HTMLElement>('[data-role="rank"]');
    rankEl?.classList.toggle("hidden", slotKey !== "hall");
    if (slotKey === "hall") this.renderRank();
    const trickEl = this.panel.querySelector<HTMLElement>('[data-role="tricks"]');
    trickEl?.classList.toggle("hidden", slotKey !== "recruit_hall");
    const officesEl = this.panel.querySelector<HTMLElement>('[data-role="city-offices"]');
    officesEl?.classList.toggle("hidden", slotKey !== "recruit_hall");
    if (slotKey === "recruit_hall") this.renderOffices();
    const wallEl = this.panel.querySelector<HTMLElement>('[data-role="wall-defenses"]');
    wallEl?.classList.toggle("hidden", slotKey !== "wall");
    if (slotKey === "wall") this.renderWall();
    const marketEl = this.panel.querySelector<HTMLElement>('[data-role="market"]');
    marketEl?.classList.toggle("hidden", slotKey !== "market");
    if (slotKey === "market") this.renderMarket();
    const drillEl = this.panel.querySelector<HTMLElement>('[data-role="drill-tactics"]');
    drillEl?.classList.toggle("hidden", slotKey !== "drill_ground");
    if (slotKey === "drill_ground") this.renderTactics();
    const historicalEl = this.panel.querySelector<HTMLElement>('[data-role="historical"]');
    historicalEl?.classList.toggle("hidden", slotKey !== "inn");
    if (slotKey === "inn") this.renderHistorical();
    const equipmentEl = this.panel.querySelector<HTMLElement>('[data-role="equipment"]');
    equipmentEl?.classList.toggle("hidden", slotKey !== "smithy" && slotKey !== "stable");
    if (slotKey === "smithy" || slotKey === "stable") this.renderEquipment();
    const storeEl = this.panel.querySelector<HTMLElement>('[data-role="storehouse"]');
    storeEl?.classList.toggle("hidden", slotKey !== "warehouse");
    if (slotKey === "warehouse") this.renderStorehouse();
    if (demolishBtn) {
      demolishBtn.classList.toggle("hidden", level <= 0);
      demolishBtn.disabled = upgrading || (building?.building_cfg_id === 1 && level <= 1);
      demolishBtn.textContent = level <= 1 ? "拆除（返还 25%）" : "降级（返还 25%）";
    }

    if (upgrading) {
      previewEl.textContent = "升级进行中，见「队列」面板";
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    const session = this.getSession();
    if (!session) {
      previewEl.textContent = PANEL_STATE_LOADING_MESSAGE;
      previewEl.innerHTML = "";
      applyPanelStateChrome(previewEl as HTMLElement, "loading");
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    const preview = previewUpgradeCost(slotKey, level, this.wallet());
    if (!preview) {
      previewEl.textContent = "暂无升级配置";
      previewEl.innerHTML = "";
      previewEl.classList.remove(PANEL_STATE_CHROME_CLASS);
      previewEl.removeAttribute("data-panel-state");
      btn.disabled = true;
      this.setFormError(null);
      return;
    }

    previewEl.classList.remove(PANEL_STATE_CHROME_CLASS);
    previewEl.removeAttribute("data-panel-state");
    const costLine = formatBuildUpgradeCostLine(
      preview.targetLevel,
      preview.cost,
      this.wallet(),
      { timeSec: preview.timeSec },
    );
    previewEl.textContent = costLine.textLine;
    previewEl.innerHTML = costLine.htmlLine;
    const prerequisite = buildUpgradePrerequisiteHint(
      preview.buildingCfgId, preview.targetLevel, session.buildings,
    );
    prerequisiteEl.textContent = prerequisite ?? "";
    prerequisiteEl.classList.toggle("hidden", !prerequisite);
    const submitState = this.getSubmitState();
    btn.disabled = buildSubmitButtonDisabled(submitState, preview.canAfford && !prerequisite, false);
    btn.textContent = buildSubmitButtonLabel(submitState);
    if (submitState !== "error") {
      this.setFormError(preview.insufficientHint);
    }
  }

  setWallDefenses(rows: WallDefenseRow[], area: number, used: number): void {
    this.wallDefenses = rows;
    this.wallArea = area;
    this.wallUsed = used;
    this.renderWall();
  }

  private renderWall(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="wall-defenses"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="wall-status"]');
    const build = section.querySelector<HTMLElement>('[data-role="wall-build-buttons"]');
    const wounded = section.querySelector<HTMLElement>('[data-role="wounded-status"]');
    const woundBtns = section.querySelector<HTMLElement>('[data-role="wounded-buttons"]');
    if (!status || !build || !wounded || !woundBtns) return;
    status.textContent = `墙区 ${this.wallUsed}/${this.wallArea} · ` +
      this.wallDefenses.map((d) => `${d.name}×${d.count ?? 0}`).join(" ");
    build.innerHTML = "";
    for (const row of this.wallDefenses) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "build-defense";
      button.dataset.defenseType = String(row.defense_type ?? 0);
      button.textContent = `建造${row.name}`;
      build.appendChild(button);
    }
    const troops = this.getSession()?.cityTroops ?? [];
    const woundedKnown = troops.filter((t) => (t.wounded ?? 0) > 0);
    wounded.textContent = woundedKnown.length
      ? "点击兵种消耗黄金治疗全部伤兵"
      : "伤兵数据按兵种查询；点击兵种尝试治疗";
    woundBtns.innerHTML = "";
    for (let unitId = 1; unitId <= 12; unitId++) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "heal-wounded";
      button.dataset.unitId = String(unitId);
      button.textContent = `治疗兵种#${unitId}`;
      woundBtns.appendChild(button);
    }
  }

  setMarket(view: MarketView | null): void {
    this.market = view;
    this.renderMarket();
  }

  setStorehouse(view: StorehouseView | null): void {
    this.storehouse = view;
    this.renderStorehouse();
  }

  private resourceName(resourceType: number | undefined): string {
    return ["粮食", "木材", "石料", "铁锭"][resourceType ?? 0] ?? "资源";
  }

  setTactics(rows: TacticPresetRow[]): void {
    this.tactics = rows;
    this.renderTactics();
  }

  setHistorical(rows: HistoricalHeroRow[]): void {
    this.historical = rows;
    this.renderHistorical();
  }

  private renderHistorical(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="historical"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="historical-status"]');
    const list = section.querySelector<HTMLElement>('[data-role="historical-list"]');
    if (!status || !list) return;
    status.textContent = "打听传闻消耗 500 金；被俘名将可消耗 5000 金与 1 件珠宝招降";
    list.textContent = "";
    const labels = ["在野", "被俘", "归顺", "叛逃"];
    for (const row of this.historical) {
      const el = document.createElement("div");
      el.className = "market-offer-row";
      const coords = row.discovered ? `坐标(${row.x},${row.y})` : "坐标未知";
      el.textContent = `${row.display_name ?? "名将"} Lv${row.level ?? 0} · ${labels[row.state ?? 0] ?? "?"} · ${coords} `;
      if ((row.state ?? 0) === 0 && !row.discovered) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = "search-historical";
        b.dataset.npcCfgId = String(row.npc_cfg_id ?? 0);
        b.textContent = "打听";
        el.appendChild(b);
      }
      if ((row.state ?? 0) === 1) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = "persuade-historical";
        b.dataset.npcCfgId = String(row.npc_cfg_id ?? 0);
        b.textContent = "招降";
        el.appendChild(b);
      }
      list.appendChild(el);
    }
  }

  setEquipment(heroId: number, equipped: EquipmentRow[], inventory: EquipmentRow[], blacksmith: number, stable: number): void {
    this.equipmentHeroId = heroId;
    this.equipped = equipped;
    this.inventory = inventory;
    this.blacksmithLevel = blacksmith;
    this.stableLevel = stable;
    this.renderEquipment();
  }

  setRank(view: RankView | null): void {
    this.rank = view;
    this.renderRank();
  }

  private renderRank(): void {
    const status = this.panel?.querySelector<HTMLElement>('[data-role="rank-status"]');
    if (!status) return;
    const r = this.rank;
    if (!r) {
      status.textContent = "声望数据加载中";
      return;
    }
    status.textContent = `声望 ${r.prestige ?? 0} · 爵位 ${r.rank_level ?? 0} · 城市上限 ${r.city_cap ?? 1}` +
      ((r.next_prestige ?? 0) > 0 ? ` · 下一级需 ${r.next_prestige} 声望 / 上限 ${r.next_cap}` : " · 已满级");
  }

  setTrickResult(text: string): void {
    const status = this.panel?.querySelector<HTMLElement>('[data-role="trick-status"]');
    if (status) status.textContent = text;
  }

  setDrillResult(text: string): void {
    const status = this.panel?.querySelector<HTMLElement>('[data-role="drill-status"]');
    if (status) status.textContent = text;
  }

  private renderTactics(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="drill-tactics"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="drill-status"]');
    const list = section.querySelector<HTMLElement>('[data-role="tactic-list"]');
    if (!status || !list) return;
    const unitNames = ["步兵", "骑兵", "弓兵", "器械", "民夫", "义兵", "斥候", "长枪兵", "刀盾兵", "长弓手", "轻骑", "铁骑"];
    const targetNames = ["步兵", "骑兵", "弓兵", "器械"];
    const targetName = (n: number | undefined) => (n === undefined || n < 0 ? "默认" : targetNames[n] ?? "默认");
    status.textContent = "按具体兵种设置集火目标；坚守会停止推进";
    list.textContent = "";
    for (const row of this.tactics) {
      const unit = row.unit_cfg_id ?? (row.troop_type ?? 0) + 1;
      const line = document.createElement("div");
      line.textContent = `${unitNames[unit - 1] ?? `兵种#${unit}`} → ${targetName(row.target_type)}${row.hold ? " · 坚守" : ""}`;
      list.appendChild(line);
    }
  }

  private renderMarket(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="market"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="market-status"]');
    const offersStatus = section.querySelector<HTMLElement>('[data-role="market-offers-status"]');
    const offers = section.querySelector<HTMLElement>('[data-role="market-offers"]');
    const own = section.querySelector<HTMLElement>('[data-role="market-own"]');
    const deliveries = section.querySelector<HTMLElement>('[data-role="market-deliveries"]');
    if (!status || !offersStatus || !offers || !own || !deliveries) return;
    const m = this.market;
    if (!m) {
      status.textContent = "市场数据加载中";
      offersStatus.textContent = "";
      offers.innerHTML = "";
      own.innerHTML = "";
      deliveries.innerHTML = "";
      return;
    }
    status.textContent = `市场 Lv${m.market_level ?? 0} · 挂单 ${m.own_offers?.length ?? 0}/${m.listing_capacity ?? 0}` +
      ` · 商队 ${m.deliveries?.length ?? 0}/${m.caravan_capacity ?? 0} · 金币 ${m.gold ?? 0}`;
    offersStatus.textContent = `可见挂单 ${m.offers?.length ?? 0} 条 · 单笔上限 ${m.max_listing_amount ?? 0}`;
    offers.innerHTML = "";
    for (const offer of m.offers ?? []) {
      const row = document.createElement("div");
      row.className = "market-offer-row";
      row.textContent = `${offer.seller_name ?? "玩家"} · ${this.resourceName(offer.resource_type)}×${offer.amount ?? 0}` +
        ` · ${((offer.price_milli ?? 0) / 1000).toFixed(2)} 金/单位 · 总价 ${offer.gold_total ?? 0}` +
        ` · 距离 ${offer.distance ?? 0} · 运输 ${offer.deliver_seconds ?? 0}s `;
      const buy = document.createElement("button");
      buy.type = "button";
      buy.dataset.action = "buy-offer";
      buy.dataset.offerId = String(offer.offer_id ?? 0);
      buy.textContent = "买入";
      row.appendChild(buy);
      offers.appendChild(row);
    }
    own.innerHTML = "";
    for (const offer of m.own_offers ?? []) {
      const row = document.createElement("div");
      row.className = "market-offer-row";
      row.textContent = `${this.resourceName(offer.resource_type)}×${offer.amount ?? 0} · 总价 ${offer.gold_total ?? 0} `;
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.dataset.action = "cancel-offer";
      cancel.dataset.offerId = String(offer.offer_id ?? 0);
      cancel.textContent = "取消";
      row.appendChild(cancel);
      own.appendChild(row);
    }
    deliveries.innerHTML = "";
    for (const d of m.deliveries ?? []) {
      const row = document.createElement("div");
      row.className = "market-offer-row";
      row.textContent = `${this.resourceName(d.resource_type)}×${d.amount ?? 0} · 预计 ${new Date(d.deliver_at_ms ?? 0).toLocaleTimeString()} 到达`;
      deliveries.appendChild(row);
    }
  }

  private renderEquipment(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="equipment"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="equipment-status"]');
    const forge = section.querySelector<HTMLElement>('[data-role="equipment-forge"]');
    const equipped = section.querySelector<HTMLElement>('[data-role="equipment-equipped"]');
    const inventory = section.querySelector<HTMLElement>('[data-role="equipment-inventory"]');
    if (!status || !forge || !equipped || !inventory) return;
    const slots = ["头盔", "铠甲", "武器", "坐骑", "饰品"];
    status.textContent = `铁匠铺 Lv${this.blacksmithLevel} · 马厩 Lv${this.stableLevel} · 将领#${this.equipmentHeroId}`;
    forge.textContent = "";
    for (let slot = 0; slot < 5; slot++) {
      for (let tier = 1; tier <= 3; tier++) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = "forge-equipment";
        b.dataset.slotType = String(slot);
        b.dataset.tier = String(tier);
        b.textContent = `打造${slots[slot]}T${tier}`;
        forge.appendChild(b);
      }
    }
    const row = (item: EquipmentRow, actions: string[]) => {
      const el = document.createElement("div");
      el.className = "market-offer-row";
      const a = item.attrs ?? {};
      el.textContent = `${item.name ?? "装备"} Lv${item.enhance_level ?? 0}/${item.max_enhance ?? 0}` +
        ` · 力${a.force ?? 0} 智${a.intel ?? 0} 政${a.politics ?? 0} 统${a.command ?? 0}` +
        (item.speed_pct ? ` · 速${item.speed_pct}%` : "") +
        (item.gems?.length ? ` · 宝珠${item.gems.join(",")}` : "") + " ";
      for (const action of actions) {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.action = action;
        b.dataset.equipmentId = String(item.equipment_id ?? 0);
        b.dataset.slotType = String(item.slot_type ?? 0);
        b.textContent = action === "enhance-equipment" ? "强化"
          : action === "socket-gem" ? "镶嵌宝珠"
          : action === "equip-item" ? "穿戴"
          : action === "unequip-item" ? "卸下"
          : action === "train-mount" ? "驯养" : action;
        el.appendChild(b);
      }
      return el;
    };
    equipped.textContent = "";
    for (const item of this.equipped) equipped.appendChild(row(item, ["unequip-item"]));
    inventory.textContent = "";
    for (const item of this.inventory) {
      const actions = ["enhance-equipment", "socket-gem", "equip-item"];
      if (item.slot_type === 3) actions.push("train-mount");
      inventory.appendChild(row(item, actions));
    }
  }

  private renderStorehouse(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="storehouse"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="storehouse-status"]');
    if (!status) return;
    const s = this.storehouse;
    if (!s) {
      status.textContent = "仓库数据加载中";
      return;
    }
    const p = s.protected_amount ?? {};
    status.textContent = `仓库 Lv${s.level ?? 0} · 容量加成 ${s.capacity_bonus ?? 0} · 保护 ${s.protection_percent ?? 0}%` +
      ` · 受保护 粮${p.food ?? 0} 木${p.wood ?? 0} 石${p.stone ?? 0} 铁${p.iron ?? 0}`;
  }

  private renderOffices(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="city-offices"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="office-status"]');
    const select = section.querySelector<HTMLSelectElement>('[data-field="office-hero"]');
    if (!status || !select) return;
    const nameOf = (office: number) => {
      const row = this.offices.find((o) => o.office === office);
      return row ? `${row.name} Lv${row.level} 忠诚${row.loyalty}` : "空缺";
    };
    status.textContent = `城守：${nameOf(1)} · 军师：${nameOf(2)} · 主将：${nameOf(3)}`;
    const prev = Number(select.value);
    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = this.officeHeroes.length ? "选择将领" : "暂无空闲将领";
    select.appendChild(placeholder);
    for (const h of this.officeHeroes) {
      const id = Number(h.hero_id ?? 0);
      if (id <= 0) continue;
      const option = document.createElement("option");
      option.value = String(id);
      option.textContent = `${h.name ?? "将领"} Lv${h.level ?? 1}`;
      select.appendChild(option);
    }
    if (prev) select.value = String(prev);
  }

  private renderTechnics(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="academy-technics"]');
    if (!section || section.classList.contains("hidden")) return;
    const select = section.querySelector<HTMLSelectElement>('[data-role="technic-select"]');
    const detail = section.querySelector<HTMLElement>('[data-role="technic-detail"]');
    const status = section.querySelector<HTMLElement>('[data-role="technic-status"]');
    const button = section.querySelector<HTMLButtonElement>('[data-action="research-technic"]');
    if (!select || !detail || !status || !button) return;
    if (this.researchJob?.finish_at_ms) {
      status.textContent = `研究中：科技 #${this.researchJob.tid} → Lv${this.researchJob.target}，${new Date(this.researchJob.finish_at_ms).toLocaleTimeString()} 完成`;
      button.disabled = true;
    } else {
      status.textContent = "书院空闲";
      button.disabled = false;
    }
    const prev = Number(select.value);
    select.innerHTML = "";
    for (const t of this.technics) {
      const option = document.createElement("option");
      option.value = String(t.tid ?? 0);
      option.textContent = `${t.name ?? "科技"} Lv${t.level ?? 0}/${t.max_level ?? 0}`;
      option.disabled = !t.can_research;
      select.appendChild(option);
    }
    if (prev && this.technics.some((t) => t.tid === prev)) select.value = String(prev);
    const sel = this.technics.find((t) => t.tid === Number(select.value)) ?? this.technics[0];
    if (sel) {
      const c = sel.next_cost ?? {};
      detail.textContent = sel.can_research
        ? `下一级：粮${c.food ?? 0} 木${c.wood ?? 0} 石${c.stone ?? 0} 铁${c.iron ?? 0} · ${sel.next_time_sec ?? 0}s · 需书院 Lv${sel.academy_level ?? 0}`
        : sel.reason ?? "不可研究";
      button.disabled = button.disabled || !sel.can_research;
    }
  }

  private onClick(ev: Event): void {
    const btn = (ev.target as HTMLElement).closest("button");
    if (btn?.getAttribute("data-action") === "promote-rank") {
      this.onRankAction?.("promote", "", 0, 0);
      return;
    }
    if (btn?.getAttribute("data-action") === "found-city") {
      const section = this.panel.querySelector<HTMLElement>('[data-role="rank"]');
      const name = section?.querySelector<HTMLInputElement>('[data-field="found-name"]')?.value?.trim() || "新城";
      const x = Number(section?.querySelector<HTMLInputElement>('[data-field="found-x"]')?.value ?? 0);
      const y = Number(section?.querySelector<HTMLInputElement>('[data-field="found-y"]')?.value ?? 0);
      this.onRankAction?.("found", name, x, y);
      return;
    }
    if (btn?.getAttribute("data-action") === "cast-trick") {
      const trickType = Number(btn?.dataset.trickType ?? 0);
      const target = Number(this.panel.querySelector<HTMLInputElement>('[data-field="trick-march"]')?.value ?? 0);
      this.onTrickAction?.(trickType, target);
      return;
    }
    const historicalAction = btn?.getAttribute("data-action");
    if (historicalAction === "search-historical" || historicalAction === "persuade-historical") {
      this.onHistoricalAction?.(historicalAction, Number(btn?.dataset.npcCfgId ?? 0));
      return;
    }
    const equipmentAction = btn?.getAttribute("data-action");
    if (equipmentAction && ["forge-equipment", "enhance-equipment", "socket-gem", "equip-item", "unequip-item", "train-mount"].includes(equipmentAction)) {
      this.onEquipmentAction?.(equipmentAction, Number(btn?.dataset.slotType ?? 0), Number(btn?.dataset.tier ?? 1),
        Number(btn?.dataset.equipmentId ?? 0), 1);
      return;
    }
    if (btn?.getAttribute("data-action") === "run-drill") {
      this.onRunDrill?.();
      return;
    }
    if (btn?.getAttribute("data-action") === "save-tactic") {
      const section = this.panel.querySelector<HTMLElement>('[data-role="drill-tactics"]');
      const unitCfgId = Number(section?.querySelector<HTMLSelectElement>('[data-field="tactic-troop"]')?.value ?? 1);
      const targetType = Number(section?.querySelector<HTMLSelectElement>('[data-field="tactic-target"]')?.value ?? -1);
      const hold = !!section?.querySelector<HTMLInputElement>('[data-field="tactic-hold"]')?.checked;
      this.onTacticAction?.(unitCfgId, targetType, hold);
      return;
    }
    const marketAction = btn?.getAttribute("data-action");
    if (marketAction && ["buy-merchant", "sell-merchant", "create-offer", "cancel-offer", "buy-offer"].includes(marketAction)) {
      const section = this.panel.querySelector<HTMLElement>('[data-role="market"]');
      const resourceType = Number(section?.querySelector<HTMLSelectElement>('[data-field="market-resource"]')?.value ?? 0);
      const merchantAmount = Number(section?.querySelector<HTMLInputElement>('[data-field="market-amount"]')?.value ?? 0);
      const offerAmount = Number(section?.querySelector<HTMLInputElement>('[data-field="offer-amount"]')?.value ?? 0);
      const priceMilli = Number(section?.querySelector<HTMLInputElement>('[data-field="offer-price"]')?.value ?? 0);
      const hours = Number(section?.querySelector<HTMLSelectElement>('[data-field="offer-hours"]')?.value ?? 1);
      const offerId = Number(btn?.dataset.offerId ?? 0);
      this.onMarketAction?.(marketAction, resourceType, marketAction === "create-offer" ? offerAmount : merchantAmount, priceMilli, hours, offerId);
      return;
    }
    const wallAction = btn?.getAttribute("data-action");
    if (wallAction === "build-defense" || wallAction === "heal-wounded") {
      const defenseType = Number(btn?.dataset.defenseType ?? 0);
      const unitId = Number(btn?.dataset.unitId ?? 0);
      this.onWallAction?.(wallAction, defenseType, unitId);
      return;
    }
    const officeAction = btn?.getAttribute("data-action");
    if (officeAction && officeAction.endsWith("-office")) {
      const section = this.panel.querySelector<HTMLElement>('[data-role="city-offices"]');
      const office = Number(section?.querySelector<HTMLSelectElement>('[data-field="office-kind"]')?.value ?? 0);
      const heroId = Number(section?.querySelector<HTMLSelectElement>('[data-field="office-hero"]')?.value ?? 0);
      const action = officeAction.replace("-office", "");
      if (action === "pay" || action === "reward" || action === "appoint") {
        if (action === "appoint" && (!heroId || !office)) return;
      }
      this.onOfficeAction?.(action, office, heroId);
      return;
    }
    if (btn?.getAttribute("data-action") === "research-technic") {
      const select = this.panel.querySelector<HTMLSelectElement>('[data-role="technic-select"]');
      const tid = Number(select?.value ?? 0);
      if (tid > 0 && !btn.disabled) this.onResearchTechnic?.(tid);
      return;
    }
    if (btn?.getAttribute("data-action") === "demolish-building") {
      const slotKey = this.selectedSlotKey;
      if (!slotKey || btn.disabled || !this.buildingForSlot(slotKey)) return;
      this.onDemolish?.(slotKey);
      return;
    }
    if (!btn || btn.getAttribute("data-action") !== "confirm-upgrade") return;
    // State may have hydrated/changed since the last paint; never submit an old preview.
    this.render();
    const slotKey = this.selectedSlotKey;
    if (!slotKey || btn.disabled) return;
    const building = this.buildingForSlot(slotKey);
    const level = building?.level ?? 0;
    const preview = previewUpgradeCost(slotKey, level, this.wallet());
    if (!preview?.canAfford) {
      this.setFormError(preview?.insufficientHint ?? "资源不足");
      this.render();
      return;
    }
    this.setFormError(null);
    this.onUpgrade(slotKey, preview.buildingCfgId);
  }
}
