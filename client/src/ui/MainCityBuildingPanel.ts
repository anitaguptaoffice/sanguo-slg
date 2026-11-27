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
import { wireProductPanelChrome } from "@/ui/panelChromeHeader";

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
export type ScoutReportRow = { report_id?: number; x?: number; y?: number; tier?: number; target_name?: string; detail?: string; created_at_ms?: number };
export type BeaconWarningRow = { warning_id?: number; x?: number; y?: number; purpose?: number; arrive_at_ms?: number; beacon_level?: number; attacker_player_id?: number; attacker_troops?: number };
export type AchievementRow = { achievement_id?: number; code?: string; name?: string; description?: string; category?: number; threshold?: number | string; progress?: number | string; claimed?: boolean; can_claim?: boolean; reward_gold?: number | string; reward_prestige?: number | string };
export type ArenaOpponentRow = { opponent_id?: number; name?: string; troop_cap?: number; defender_total?: number; defender_hero?: string; reward_gold?: number | string; reward_prestige?: number | string; reward_item_cfg_id?: number; reward_item_count?: number };
const CAMPAIGN_UNITS: Array<[number, string]> = [
  [1, "步兵"], [2, "骑兵"], [3, "弓兵"], [4, "器械"], [5, "民夫"], [6, "义兵"],
  [7, "斥候"], [8, "长枪兵"], [9, "刀盾兵"], [10, "长弓手"], [11, "轻骑"], [12, "铁骑"],
  [13, "西凉铁骑"], [14, "虎豹骑"], [15, "青州兵"], [16, "南蛮象兵"], [17, "藤甲兵"], [18, "突骑兵"],
];

export type CampaignUnitStack = { unit_cfg_id: number; count: number };
export type CampaignStageRow = { stage_id?: number; code?: string; name?: string; chapter?: number; stage_order?: number; troop_cap?: number; unlocked?: boolean; cleared?: boolean; stars?: number; defender_total?: number; defender_hero?: string; reward_gold?: number | string; reward_prestige?: number | string };
export type SpecialCityRow = { city_cfg_id?: number; city_type?: number; name?: string; x?: number; y?: number; owner_guild_id?: number; owner_guild_name?: string; garrison?: number; wall_level?: number; hero_name?: string; hero_level?: number; unit_cfg_id?: number; unit_name?: string; next_recover_at_ms?: number | string; min_phase?: number; locked?: boolean; lock_reason?: string };
export type GuildRelationRow = { guild_id?: number; target_guild_id?: number; state?: number; effective_at_ms?: number; pending?: boolean };
export type GuildGarrisonRow = { city_id?: number; player_id?: number; unit_cfg_id?: number; count?: number };
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
  private scoutReports: ScoutReportRow[] = [];
  private beaconWarnings: BeaconWarningRow[] = [];
  private guildRelations: GuildRelationRow[] = [];
  private specialCities: SpecialCityRow[] = [];
  private campaignStages: CampaignStageRow[] = [];
  private arenaOpponents: ArenaOpponentRow[] = [];
  private achievements: AchievementRow[] = [];
  private worldProgress: { phase?: number; name?: string; next?: string; unlock?: string; owned_cities?: number | string; campaign_clears?: number | string; reward_gold?: number | string; reward_prestige?: number | string; reward_item_cfg_id?: number; reward_item_count?: number; can_claim?: boolean; claimed?: boolean } = {};
  private unlockedUnits: number[] = [];
  private guildGarrison: GuildGarrisonRow[] = [];
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
    private readonly onRankAction?: (action: "promote" | "found" | "transfer" | "truce", name: string, x: number, y: number) => void,
    private readonly onDiplomacyAction?: (action: string, guildId: number, targetGuildId: number, cityId: number, unit: number, count: number, fromCityId: number) => void,
    private readonly onSpecialAction?: (action: string, unit: number, count: number) => void,
    private readonly onCampaignAction?: (action: string, stageId: number, attacker: CampaignUnitStack[]) => void,
    private readonly onArenaAction?: (action: string, opponentId: number, unit: number, count: number) => void,
    private readonly onAchievementAction?: (achievementId: number) => void,
    private readonly onPhaseClaim?: () => void,
    private readonly equipmentIcon?: (cfgId?: number) => string | undefined,
    private readonly defenseIcon?: (defenseType?: number) => string | undefined,
  ) {}

  attach(): void {
    this.panel = document.createElement("div");
    this.panel.className = "building-panel product-building-panel hidden";
    this.panel.dataset.centerPanel = "building";
    this.panel.innerHTML = `
      <div class="product-panel-header">
        <h3 data-role="build-title">建造</h3>
        <div class="product-panel-header-actions">
          <button type="button" class="product-panel-close" data-action="close-panel" aria-label="关闭建筑面板">×</button>
        </div>
      </div>
      <div class="panel-scroll-body" data-role="building-scroll">
        <div class="building-detail-card">
          <div class="building-detail-head">
            <div class="building-detail-icon" data-role="build-icon" aria-hidden="true">城</div>
            <div class="building-detail-meta">
              <h4 data-role="build-level">未建造</h4>
              <p data-role="build-desc">点选槽位查看功能与升级条件。</p>
            </div>
          </div>
          <dl class="building-upgrade-compare" data-role="build-compare"></dl>
          <p class="building-upgrade-preview" data-role="build-preview"></p>
          <div class="building-prerequisite-row hidden" data-role="build-prerequisite-row">
            <span data-role="build-prerequisite" id="build-prerequisite" role="status"></span>
            <button type="button" class="product-btn-ghost hidden" data-action="jump-prerequisite-hall">前往城主府</button>
          </div>
          <p class="build-form-error hidden" data-role="build-form-error" role="alert"></p>
          <div class="building-panel-actions">
            <button type="button" class="art-btn-primary art-btn-primary-full" data-action="confirm-upgrade" aria-describedby="build-prerequisite" disabled>
              确认升级
            </button>
            <button type="button" class="product-btn-danger-ghost build-demolish hidden" data-action="demolish-building">
              降级/拆除（返还 25%）
            </button>
          </div>
        </div>
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
          <h4>历史战役</h4>
          <p data-role="campaign-status">借调兵力闯关，不损耗城内真实部队；首通发放图纸、宝珠与声望。</p>
          <label>关卡 <select data-field="campaign-stage"></select></label>
          <div class="campaign-formation" data-role="campaign-formation"></div>
          <button type="button" data-action="campaign-add-unit">添加兵种</button>
          <p data-role="campaign-cap"></p>
          <button type="button" data-action="fight-campaign">出征战役</button>
          <div data-role="campaign-stages"></div>
          <h4>沙场比武</h4>
          <p data-role="arena-status">每日首胜可得金币、声望与宝珠。</p>
          <label>对手 <select data-field="arena-opponent"></select></label>
          <label>兵种 <select data-field="arena-unit">
            <option value="1">步兵</option><option value="2">骑兵</option><option value="3">弓兵</option>
            <option value="11">轻骑</option><option value="12">铁骑</option>
          </select></label>
          <label>借调兵力 <input type="number" data-field="arena-count" value="3000"></label>
          <button type="button" data-action="fight-arena">切磋</button>
          <div data-role="arena-opponents"></div>
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
        <div class="diplomacy-section hidden" data-role="diplomacy">
          <h4>联盟外交与驻军</h4>
          <p data-role="diplomacy-status"></p>
          <label>本盟 ID <input type="number" data-field="guild-id" value="1"></label>
          <label>目标盟 ID <input type="number" data-field="target-guild" value="2"></label>
          <div class="city-civic-actions">
            <button type="button" data-action="guild-friendly">结友好</button>
            <button type="button" data-action="guild-hostile">宣战（8 小时生效）</button>
          </div>
          <label>出发/撤回城 ID <input type="number" data-field="garrison-from" value="1"></label>
          <label>驻军城 ID（可填盟友城） <input type="number" data-field="garrison-city" value="1"></label>
          <label>兵种 ID <input type="number" data-field="garrison-unit" value="1"></label>
          <label>数量 <input type="number" data-field="garrison-count" value="1"></label>
          <button type="button" data-action="station-garrison">派遣驻军</button>
          <button type="button" data-action="withdraw-garrison">撤回驻军</button>
          <div data-role="guild-relations"></div>
          <div data-role="guild-garrison"></div>
        </div>
        <div class="beacon-section hidden" data-role="beacon">
          <h4>军情与烽火</h4>
          <p data-role="beacon-status"></p>
          <div data-role="beacon-warnings"></div>
          <h4>侦察报告</h4>
          <div data-role="scout-reports"></div>
        </div>
        <div class="rank-section hidden" data-role="rank">
          <h4>声望与爵位</h4>
          <p data-role="rank-status"></p>
          <button type="button" data-action="promote-rank">晋升爵位</button>
          <button type="button" data-action="use-truce">使用免战牌（8 小时）</button>
          <h4>平地筑城</h4>
          <label>城名 <input type="text" data-field="found-name" value="新城"></label>
          <label>坐标 X <input type="number" data-field="found-x" value="61"></label>
          <label>坐标 Y <input type="number" data-field="found-y" value="61"></label>
          <button type="button" data-action="found-city">筑城</button>
          <h4>城间调兵</h4>
          <label>目标城 ID <input type="number" data-field="transfer-city" value="2"></label>
          <label>兵种 ID <input type="number" data-field="transfer-unit" value="1"></label>
          <label>数量 <input type="number" data-field="transfer-count" value="10"></label>
          <button type="button" data-action="transfer-troops">调兵</button>
          <h4>名城国战</h4>
          <p data-role="special-status">攻占县城、郡城、州城与洛阳，可为联盟解锁地域精锐。</p>
          <div data-role="special-cities"></div>
          <button type="button" data-action="refresh-special">刷新名城</button>
          <button type="button" data-action="claim-special-tax">领取名城税赋</button>
          <label>精锐兵种
            <select data-field="special-unit">
              <option value="13">西凉铁骑</option><option value="14">虎豹骑</option>
              <option value="15">青州兵</option><option value="16">南蛮象兵</option>
              <option value="17">藤甲兵</option><option value="18">突骑兵</option>
            </select>
          </label>
          <label>数量 <input type="number" data-field="special-count" value="10"></label>
          <button type="button" data-action="recruit-special">招募精锐</button>
          <h4>世界进程与成就</h4>
          <p data-role="world-progress"></p>
          <button type="button" data-action="claim-phase-reward">领取世界阶段奖励</button>
          <div data-role="achievements"></div>
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
    wireProductPanelChrome(this.panel);
    this.panel.addEventListener("input", () => this.updateCampaignFormationState());
    this.panel.addEventListener("change", () => this.updateCampaignFormationState());
    this.resetCampaignFormation();
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

    const label = this.slotLabels[slotKey] ?? slotKey;
    titleEl.textContent = label;
    const building = this.buildingForSlot(slotKey);
    const level = building?.level ?? 0;
    const descEl = this.panel.querySelector('[data-role="build-desc"]');
    const iconEl = this.panel.querySelector('[data-role="build-icon"]');
    if (iconEl) iconEl.textContent = label.slice(0, 1);
    if (descEl) {
      descEl.textContent =
        level > 0
          ? `${label}提供内政、军事或经济加成，升级可解锁更高等级效果。`
          : `此地可建造${label}，请先确认城主府等级与资源是否充足。`;
    }
    const now = Date.now();
    const upgrading = (building?.upgrade_finish_at_ms ?? 0) > now;

    levelEl.textContent = level > 0 ? `当前 Lv${level}` : "未建造";
    const academy = this.panel.querySelector<HTMLElement>('[data-role="academy-technics"]');
    academy?.classList.toggle("hidden", slotKey !== "academy");
    if (slotKey === "academy") this.renderTechnics();
    const diplomacyEl = this.panel.querySelector<HTMLElement>('[data-role="diplomacy"]');
    diplomacyEl?.classList.toggle("hidden", slotKey !== "diplomacy");
    if (slotKey === "diplomacy") this.renderDiplomacy();
    const beaconEl = this.panel.querySelector<HTMLElement>('[data-role="beacon"]');
    beaconEl?.classList.toggle("hidden", slotKey !== "beacon");
    if (slotKey === "beacon") this.renderBeacon();
    const rankEl = this.panel.querySelector<HTMLElement>('[data-role="rank"]');
    rankEl?.classList.toggle("hidden", slotKey !== "hall");
    if (slotKey === "hall") {
      this.renderRank();
      this.renderSpecialCities();
      this.renderAchievements();
    }
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
    if (slotKey === "drill_ground") {
      this.renderTactics();
      this.renderCampaignStages();
      this.renderArenaOpponents();
    }
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
    const compareEl = this.panel.querySelector('[data-role="build-compare"]');
    if (compareEl) {
      compareEl.innerHTML = `<dt>当前等级</dt><dd>Lv${level}</dd><dt>升级目标</dt><dd>Lv${preview.targetLevel}</dd>`;
    }
    const prerequisite = buildUpgradePrerequisiteHint(
      preview.buildingCfgId, preview.targetLevel, session.buildings,
    );
    prerequisiteEl.textContent = prerequisite ?? "";
    const prereqRow = this.panel.querySelector('[data-role="build-prerequisite-row"]');
    const jumpHall = this.panel.querySelector<HTMLButtonElement>('[data-action="jump-prerequisite-hall"]');
    const needsHall = !!prerequisite && /城主府/.test(prerequisite);
    prereqRow?.classList.toggle("hidden", !prerequisite);
    jumpHall?.classList.toggle("hidden", !needsHall);
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
      const icon = this.defenseIcon?.(row.defense_type);
      if (icon) {
        const img = document.createElement("img");
        img.src = icon;
        img.width = 24;
        img.height = 24;
        img.alt = "";
        img.style.verticalAlign = "middle";
        img.style.marginRight = "4px";
        button.appendChild(img);
      }
      button.append(`建造${row.name}`);
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

  private campaignUnitOptions(selected: number): string {
    return CAMPAIGN_UNITS.map(([id, name]) => `<option value="${id}"${id === selected ? " selected" : ""}>${name}</option>`).join("");
  }

  private addCampaignRow(unit = 1, count = 1000): void {
    const host = this.panel?.querySelector<HTMLElement>('[data-role="campaign-formation"]');
    if (!host) return;
    const row = document.createElement("div");
    row.dataset.role = "campaign-unit-row";
    row.style.cssText = "display:flex;gap:4px;align-items:center;margin:3px 0";
    row.innerHTML = `<select data-field="campaign-unit" style="flex:1">${this.campaignUnitOptions(unit)}</select>
      <input type="number" data-field="campaign-count" min="1" value="${count}" style="width:90px">
      <button type="button" data-action="campaign-remove-unit">移除</button>`;
    host.appendChild(row);
    this.updateCampaignFormationState();
  }

  private resetCampaignFormation(): void {
    const host = this.panel?.querySelector<HTMLElement>('[data-role="campaign-formation"]');
    if (!host) return;
    host.textContent = "";
    this.addCampaignRow();
  }

  private campaignFormation(): CampaignUnitStack[] {
    const rows = this.panel?.querySelectorAll<HTMLElement>('[data-role="campaign-unit-row"]') ?? [];
    const out: CampaignUnitStack[] = [];
    for (const row of rows) {
      const unit = Number(row.querySelector<HTMLSelectElement>('[data-field="campaign-unit"]')?.value ?? 0);
      const count = Number(row.querySelector<HTMLInputElement>('[data-field="campaign-count"]')?.value ?? 0);
      if (unit > 0 && count > 0) out.push({ unit_cfg_id: unit, count });
    }
    return out;
  }

  private selectedCampaignCap(): number {
    const select = this.panel?.querySelector<HTMLSelectElement>('[data-field="campaign-stage"]');
    const stage = this.campaignStages.find((row) => String(row.stage_id ?? 0) === select?.value);
    return Number(stage?.troop_cap ?? 0);
  }

  private updateCampaignFormationState(): void {
    const hint = this.panel?.querySelector<HTMLElement>('[data-role="campaign-cap"]');
    if (!hint) return;
    const total = this.campaignFormation().reduce((sum, row) => sum + row.count, 0);
    const cap = this.selectedCampaignCap();
    const over = cap > 0 && total > cap;
    hint.textContent = `借调兵力 ${total}${cap > 0 ? ` / ${cap}` : ""}${over ? "（超出关卡上限）" : ""}`;
    hint.style.color = over ? "#c0392b" : "";
  }

  setCampaignStages(stages: CampaignStageRow[]): void {
    this.campaignStages = stages;
    this.renderCampaignStages();
  }

  private renderCampaignStages(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="drill-tactics"]');
    if (!section || section.classList.contains("hidden")) return;
    const list = section.querySelector<HTMLElement>('[data-role="campaign-stages"]');
    const select = section.querySelector<HTMLSelectElement>('[data-field="campaign-stage"]');
    const status = section.querySelector<HTMLElement>('[data-role="campaign-status"]');
    if (!list || !select || !status) return;
    const labels = ["", "黄巾之乱", "讨伐董卓", "官渡之战", "赤壁之战"];
    const selected = select.value;
    select.textContent = "";
    list.textContent = "";
    for (const stage of this.campaignStages) {
      const option = document.createElement("option");
      option.value = String(stage.stage_id ?? 0);
      option.textContent = `${stage.name ?? ""}${stage.unlocked ? "" : "（未解锁）"}`;
      option.disabled = !stage.unlocked;
      select.appendChild(option);
      const line = document.createElement("div");
      line.textContent = `${labels[stage.chapter ?? 0] ?? ""} ${stage.name ?? ""} · 守军 ${stage.defender_total ?? 0} · ${stage.unlocked ? (stage.cleared ? `已通关 ${stage.stars ?? 0} 星` : "可挑战") : "需先通关前置"} · 上限 ${stage.troop_cap ?? 0}`;
      list.appendChild(line);
    }
    const firstUnlocked = this.campaignStages.find((stage) => stage.unlocked && !stage.cleared) ?? this.campaignStages.find((stage) => stage.unlocked);
    if (firstUnlocked && !this.campaignStages.some((stage) => String(stage.stage_id) === selected)) {
      select.value = String(firstUnlocked.stage_id ?? "");
    } else if (selected) {
      select.value = selected;
    }
    const cleared = this.campaignStages.filter((stage) => stage.cleared).length;
    status.textContent = `战役 ${cleared}/${this.campaignStages.length} 通关 · 首通奖励：高阶装备图纸、宝珠匣与声望`;
    this.updateCampaignFormationState();
  }

  setAchievements(rows: AchievementRow[], world: typeof this.worldProgress): void {
    this.achievements = rows;
    this.worldProgress = world;
    this.renderAchievements();
  }

  private renderAchievements(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="rank"]');
    if (!section || section.classList.contains("hidden")) return;
    const list = section.querySelector<HTMLElement>('[data-role="achievements"]');
    const world = section.querySelector<HTMLElement>('[data-role="world-progress"]');
    if (!list || !world) return;
    const p = this.worldProgress;
    const item = p.reward_item_cfg_id ? ` · 道具 ${p.reward_item_count ?? 0}` : "";
    world.textContent = `世界阶段 ${p.phase ?? 1} · ${p.name ?? "讨平黄巾"} · ${p.unlock ?? ""} · ${p.next ?? ""} · 名城 ${p.owned_cities ?? 0} · 战役通关 ${p.campaign_clears ?? 0}` +
      (Number(p.phase ?? 1) >= 2 ? ` · 阶段奖励 金${p.reward_gold ?? 0} 声望${p.reward_prestige ?? 0}${item}${p.claimed ? " · 已领取" : ""}` : "");
    const claim = section.querySelector<HTMLButtonElement>('[data-action="claim-phase-reward"]');
    if (claim) {
      claim.classList.toggle("hidden", Number(p.phase ?? 1) < 2 || p.claimed === true);
      claim.disabled = !p.can_claim;
    }
    list.textContent = "";
    for (const row of this.achievements) {
      const line = document.createElement("div");
      const state = row.claimed ? "已领取" : row.can_claim ? "可领取" : `${row.progress ?? 0}/${row.threshold ?? 0}`;
      const text = `${row.name ?? ""} · ${row.description ?? ""} · ${state} · 金 ${row.reward_gold ?? 0} 声望 ${row.reward_prestige ?? 0}`;
      if (row.can_claim) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.action = "claim-achievement";
        btn.dataset.achievementId = String(row.achievement_id ?? 0);
        btn.textContent = `领取 ${row.name ?? ""}`;
        line.append(`${text} `, btn);
      } else {
        line.textContent = text;
      }
      list.appendChild(line);
    }
  }

  setArenaOpponents(opponents: ArenaOpponentRow[]): void {
    this.arenaOpponents = opponents;
    this.renderArenaOpponents();
  }

  private renderArenaOpponents(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="drill-tactics"]');
    if (!section || section.classList.contains("hidden")) return;
    const list = section.querySelector<HTMLElement>('[data-role="arena-opponents"]');
    const select = section.querySelector<HTMLSelectElement>('[data-field="arena-opponent"]');
    if (!list || !select) return;
    const selected = select.value;
    select.textContent = "";
    list.textContent = "";
    for (const o of this.arenaOpponents) {
      const option = document.createElement("option");
      option.value = String(o.opponent_id ?? 0);
      option.textContent = o.name ?? "";
      select.appendChild(option);
      const line = document.createElement("div");
      const item = o.reward_item_cfg_id ? ` · 宝珠 ${o.reward_item_count ?? 0}` : "";
      line.textContent = `${o.name ?? ""} · 守军 ${o.defender_total ?? 0} · 上限 ${o.troop_cap ?? 0} · 金 ${o.reward_gold ?? 0} 声望 ${o.reward_prestige ?? 0}${item}`;
      list.appendChild(line);
    }
    if (selected && this.arenaOpponents.some((o) => String(o.opponent_id) === selected)) select.value = selected;
  }

  setSpecialCities(cities: SpecialCityRow[], unlocked: number[]): void {
    this.specialCities = cities;
    this.unlockedUnits = unlocked;
    this.renderSpecialCities();
  }

  private renderSpecialCities(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="rank"]');
    const list = section?.querySelector<HTMLElement>('[data-role="special-cities"]');
    const status = section?.querySelector<HTMLElement>('[data-role="special-status"]');
    if (!list || !status || section?.classList.contains("hidden")) return;
    const labels = ["", "县城", "郡城", "州城", "都城"];
    list.textContent = "";
    for (const city of this.specialCities) {
      const line = document.createElement("div");
      const owner = city.owner_guild_id ? city.owner_guild_name || `盟#${city.owner_guild_id}` : "中立";
      const unit = city.unit_cfg_id ? ` · 精锐 ${city.unit_name || `#${city.unit_cfg_id}`}` : "";
      const lock = city.locked ? ` · 未开放（${city.lock_reason ?? `需阶段 ${city.min_phase ?? 1}`}）` : "";
      line.textContent = `${labels[city.city_type ?? 0] ?? "名城"} ${city.name ?? ""} (${city.x ?? 0},${city.y ?? 0}) · ${owner} · 守军 ${city.garrison ?? 0}${unit}${lock}`;
      list.appendChild(line);
    }
    status.textContent = `名城 ${this.specialCities.length} 座 · 已解锁精锐 ${this.unlockedUnits.join("/") || "无"}`;
  }

  setDiplomacy(relations: GuildRelationRow[], garrison: GuildGarrisonRow[]): void {
    this.guildRelations = relations;
    this.guildGarrison = garrison;
    this.renderDiplomacy();
  }

  private renderDiplomacy(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="diplomacy"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="diplomacy-status"]');
    const relations = section.querySelector<HTMLElement>('[data-role="guild-relations"]');
    const garrison = section.querySelector<HTMLElement>('[data-role="guild-garrison"]');
    if (!status || !relations || !garrison) return;
    const labels = ["", "友好", "中立", "敌对"];
    status.textContent = `外交 ${this.guildRelations.length} 条 · 驻军 ${this.guildGarrison.length} 条`;
    relations.textContent = "";
    for (const r of this.guildRelations) {
      const line = document.createElement("div");
      line.textContent = `盟#${r.guild_id ?? 0} → 盟#${r.target_guild_id ?? 0} · ${labels[r.state ?? 0] ?? "?"}${r.pending ? " · 待生效" : ""}`;
      relations.appendChild(line);
    }
    garrison.textContent = "";
    for (const g of this.guildGarrison) {
      const line = document.createElement("div");
      line.textContent = `驻军 城#${g.city_id ?? 0} · 玩家#${g.player_id ?? 0} · 兵种#${g.unit_cfg_id ?? 0} ×${g.count ?? 0}`;
      garrison.appendChild(line);
    }
  }

  setIntel(warnings: BeaconWarningRow[], reports: ScoutReportRow[]): void {
    this.beaconWarnings = warnings;
    this.scoutReports = reports;
    this.renderBeacon();
  }

  private renderBeacon(): void {
    const section = this.panel?.querySelector<HTMLElement>('[data-role="beacon"]');
    if (!section || section.classList.contains("hidden")) return;
    const status = section.querySelector<HTMLElement>('[data-role="beacon-status"]');
    const warnings = section.querySelector<HTMLElement>('[data-role="beacon-warnings"]');
    const reports = section.querySelector<HTMLElement>('[data-role="scout-reports"]');
    if (!status || !warnings || !reports) return;
    status.textContent = `烽火预警 ${this.beaconWarnings.length} 条 · 侦察报告 ${this.scoutReports.length} 条`;
    warnings.textContent = "";
    for (const w of this.beaconWarnings) {
      const line = document.createElement("div");
      line.textContent = `敌袭：玩家#${w.attacker_player_id ?? 0} 目标(${w.x ?? 0},${w.y ?? 0})` +
        ` · 烽火 Lv${w.beacon_level ?? 0} · 兵力 ${w.attacker_troops ?? 0} · ETA ${new Date(w.arrive_at_ms ?? 0).toLocaleTimeString()}`;
      warnings.appendChild(line);
    }
    reports.textContent = "";
    for (const r of this.scoutReports) {
      const line = document.createElement("div");
      line.textContent = `侦察(${r.x ?? 0},${r.y ?? 0}) ${r.target_name ?? ""} · 情报 T${r.tier ?? 1}`;
      reports.appendChild(line);
    }
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
      const icon = this.equipmentIcon?.(item.cfg_id);
      if (icon) {
        const img = document.createElement("img");
        img.src = icon;
        img.width = 28;
        img.height = 28;
        img.alt = "";
        img.style.verticalAlign = "middle";
        img.style.marginRight = "6px";
        el.appendChild(img);
      }
      el.append(`${item.name ?? "装备"} Lv${item.enhance_level ?? 0}/${item.max_enhance ?? 0}` +
        ` · 力${a.force ?? 0} 智${a.intel ?? 0} 政${a.politics ?? 0} 统${a.command ?? 0}` +
        (item.speed_pct ? ` · 速${item.speed_pct}%` : "") +
        (item.gems?.length ? ` · 宝珠${item.gems.join(",")}` : "") + " ");
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
    if (btn?.getAttribute("data-action") === "jump-prerequisite-hall") {
      this.selectSlot("hall");
      return;
    }
    if (btn?.getAttribute("data-action") === "claim-phase-reward") {
      this.onPhaseClaim?.();
      return;
    }
    if (btn?.getAttribute("data-action") === "claim-achievement") {
      this.onAchievementAction?.(Number(btn.dataset.achievementId ?? 0));
      return;
    }
    if (btn?.getAttribute("data-action") === "fight-arena") {
      const section = this.panel.querySelector<HTMLElement>('[data-role="drill-tactics"]');
      const opponent = Number(section?.querySelector<HTMLSelectElement>('[data-field="arena-opponent"]')?.value ?? 0);
      const unit = Number(section?.querySelector<HTMLSelectElement>('[data-field="arena-unit"]')?.value ?? 0);
      const count = Number(section?.querySelector<HTMLInputElement>('[data-field="arena-count"]')?.value ?? 0);
      this.onArenaAction?.("fight", opponent, unit, count);
      return;
    }
    if (btn?.getAttribute("data-action") === "campaign-add-unit") {
      const rows = this.panel.querySelectorAll('[data-role="campaign-unit-row"]').length;
      if (rows < 5) this.addCampaignRow();
      return;
    }
    if (btn?.getAttribute("data-action") === "campaign-remove-unit") {
      const rows = this.panel.querySelectorAll('[data-role="campaign-unit-row"]');
      if (rows.length > 1) btn.closest('[data-role="campaign-unit-row"]')?.remove();
      this.updateCampaignFormationState();
      return;
    }
    if (btn?.getAttribute("data-action") === "fight-campaign") {
      const section = this.panel.querySelector<HTMLElement>('[data-role="drill-tactics"]');
      const stage = Number(section?.querySelector<HTMLSelectElement>('[data-field="campaign-stage"]')?.value ?? 0);
      const attacker = this.campaignFormation();
      const total = attacker.reduce((sum, row) => sum + row.count, 0);
      const cap = this.selectedCampaignCap();
      const status = section?.querySelector<HTMLElement>('[data-role="campaign-status"]');
      if (attacker.length === 0) {
        if (status) status.textContent = "请至少配置一个兵种";
        return;
      }
      if (cap > 0 && total > cap) {
        if (status) status.textContent = `借调兵力 ${total} 超出关卡上限 ${cap}`;
        return;
      }
      this.onCampaignAction?.("fight", stage, attacker);
      return;
    }
    const specialAction = btn?.getAttribute("data-action");
    if (specialAction && ["refresh-special", "claim-special-tax", "recruit-special"].includes(specialAction)) {
      const section = this.panel.querySelector<HTMLElement>('[data-role="rank"]');
      const unit = Number(section?.querySelector<HTMLSelectElement>('[data-field="special-unit"]')?.value ?? 0);
      const count = Number(section?.querySelector<HTMLInputElement>('[data-field="special-count"]')?.value ?? 0);
      this.onSpecialAction?.(specialAction, unit, count);
      return;
    }
    const diplomacyAction = btn?.getAttribute("data-action");
    if (diplomacyAction && ["guild-friendly", "guild-hostile", "station-garrison", "withdraw-garrison"].includes(diplomacyAction)) {
      const section = this.panel.querySelector<HTMLElement>('[data-role="diplomacy"]');
      const guild = Number(section?.querySelector<HTMLInputElement>('[data-field="guild-id"]')?.value ?? 0);
      const target = Number(section?.querySelector<HTMLInputElement>('[data-field="target-guild"]')?.value ?? 0);
      const city = Number(section?.querySelector<HTMLInputElement>('[data-field="garrison-city"]')?.value ?? 0);
      const from = Number(section?.querySelector<HTMLInputElement>('[data-field="garrison-from"]')?.value ?? 0);
      const unit = Number(section?.querySelector<HTMLInputElement>('[data-field="garrison-unit"]')?.value ?? 0);
      const count = Number(section?.querySelector<HTMLInputElement>('[data-field="garrison-count"]')?.value ?? 0);
      this.onDiplomacyAction?.(diplomacyAction, guild, target, city, unit, count, from);
      return;
    }
    if (btn?.getAttribute("data-action") === "use-truce") {
      this.onRankAction?.("truce", "", 0, 0);
      return;
    }
    if (btn?.getAttribute("data-action") === "promote-rank") {
      this.onRankAction?.("promote", "", 0, 0);
      return;
    }
    if (btn?.getAttribute("data-action") === "transfer-troops") {
      const section = this.panel.querySelector<HTMLElement>('[data-role="rank"]');
      const target = Number(section?.querySelector<HTMLInputElement>('[data-field="transfer-city"]')?.value ?? 0);
      const unit = Number(section?.querySelector<HTMLInputElement>('[data-field="transfer-unit"]')?.value ?? 0);
      const count = Number(section?.querySelector<HTMLInputElement>('[data-field="transfer-count"]')?.value ?? 0);
      this.onRankAction?.("transfer", String(unit), target, count);
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
