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

export class MainCityBuildingPanel {
  private panel!: HTMLElement;
  private selectedSlotKey: string | null = null;
  private technics: TechnicRow[] = [];
  private researchJob: { tid?: number; target?: number; finish_at_ms?: number } | null = null;
  private offices: CityOfficeRow[] = [];
  private officeHeroes: OfficeHeroOption[] = [];
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
    const officesEl = this.panel.querySelector<HTMLElement>('[data-role="city-offices"]');
    officesEl?.classList.toggle("hidden", slotKey !== "recruit_hall");
    if (slotKey === "recruit_hall") this.renderOffices();
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
