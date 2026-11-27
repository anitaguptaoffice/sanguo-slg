import { captureActor } from "@/net/actorContext";
import { openCenterPanel, toggleCenterPanel } from "@/ui/centerPanelForeground";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  applyPanelStateChrome,
  PANEL_STATE_LOADING_MESSAGE,
} from "@/engine/panelStateChrome";
import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import type { BattleReportSummary, MarchSummary } from "@/net/militaryFormat";
import { readBattleReportTimeWindowFilterSession } from "@/net/battleReportListState";
import {
  applyMarchTargetAndRemember,
  marchTargetStatusMessage,
} from "@/net/marchTargetMemory";
import {
  citiesFromListPlayerCitiesResponse,
  formatCityCoords,
  formatPlayerCityLine,
  isCurrentMainCity,
  type PlayerCitySummary,
} from "@/net/worldFormat";
import {
  countMarchesAtCell,
  findPlayerCityAtGrid,
  formatWorldCityMarchDestCount,
  gridCellsMatch,
  WORLD_CITY_COORD_ONLY_CLASS,
  WORLD_CITY_ROW_MARCH_COUNT_CLASS,
  WORLD_CITY_ROW_MARCH_DEST_CLASS,
  WORLD_CITY_ROW_SELECTED_CLASS,
} from "@/ui/marchWorldListLink";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import { buildWorldInfoCardSummary } from "@/ui/worldInfoCard";
import { formatWorldTileOccupationSummary } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileMarchSummaryLine,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
} from "@/ui/minimapMarchStack";
import { WORLD_TILE_INFO_CARD_CLASS } from "@/ui/minimapTileFocusLink";
import {
  applyWorldTileFocusPulse,
  shouldPulseWorldTileFocusOnSelect,
  type WorldTileGridSelectionSource,
} from "@/ui/worldTileSelectionSync";

export type MarchTargetSink = {
  /** 出征表单容器（含 data-field to-x / to-y）；可选。 */
  marchFormRoot?: ParentNode | null;
  /** 填入成功后回调（如打开军事面板、更新 HUD 状态）。 */
  onFilled?: (x: number, y: number) => void;
};

export const WORLD_TILE_FOCUS_PULSE_CLASS = "world-tile-focus-pulse";
export const WORLD_TILE_FOCUS_PULSE_MS = 2000;

export type WorldPanelsOptions = {
  /** 世界列表点选格点变化（用于军情列表目的格筛选）。 */
  onGridSelectionChange?: (grid: { x: number; y: number } | null) => void;
  /** ListMarches 快照（只读计数，无新 RPC）。 */
  getMarchesSnapshot?: () => MarchSummary[];
  /** 点击「指向此格的行军 N 条」时选中军情首条匹配行。 */
  onMarchCountClick?: (grid: { x: number; y: number }) => void;
  /** 信息卡「打开军情」深链。 */
  onViewMarchesAtGrid?: (grid: { x: number; y: number }) => void;
  /** 战报列表快照（只读，格点关联最近战报）。 */
  getBattleReportsSnapshot?: () => BattleReportSummary[];
  /** 信息卡「打开战报筛选」深链。 */
  onViewBattleReportsAtGrid?: (grid: { x: number; y: number }, hintReportId?: number) => void;
  /** CLIENT-129 信息卡 loading/error 九宫（可选）。 */
  assets?: AssetLoader;
  /** 信息卡点击：居中小地图视口（不新 world RPC）。 */
  onCenterMinimapAtGrid?: (grid: { x: number; y: number }) => void;
  /** 军情列表当前选中行军（只读对照互高亮，CLIENT-237）。 */
  getSelectedIntelMarch?: () => MarchSummary | null;
  /** 军情面板根节点（互高亮 DOM 查询）。 */
  getIntelPanelRoot?: () => ParentNode | null;
};

export class WorldPanels {
  private panel!: HTMLElement;
  private cities: PlayerCitySummary[] = [];
  private selectedGrid: { x: number; y: number } | null = null;
  private marchDestHighlight: { x: number; y: number } | null = null;
  private citiesLoading = false;
  private citiesLoadError: string | null = null;
  private citiesReadVersion = 0;
  private citiesOwner: (() => boolean) | null = null;
  private ownedFields: { x: number; y: number; name: string; bonus_percent: number }[] = [];
  private ownedFieldsOwner: (() => boolean) | null = null;
  private fieldGathers: FieldGatherRow[] = [];

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private readonly marchTarget: MarchTargetSink,
    private onStatus: (msg: string) => void,
    private readonly options?: WorldPanelsOptions,
  ) {}

  attach(): void {
    this.detach();
    this.cities = [];
    this.citiesOwner = null;
    this.citiesLoading = false;
    this.citiesLoadError = null;
    this.ownedFields = [];
    this.ownedFieldsOwner = null;
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
  }

  detach(): void {
    ++this.citiesReadVersion;
    this.panel?.remove();
  }

  toggle(): void {
    toggleCenterPanel(this.panel);
    if (!this.panel.classList.contains("hidden")) void this.refreshList();
  }

  /** CLIENT-108/109：外部深链打开世界面板（不关闭已打开状态）。 */
  openPanel(): void {
    if (!this.panel.classList.contains("hidden")) return;
    openCenterPanel(this.panel);
    resetCenterPanelViewportScroll(this.panel);
    void this.refreshList();
  }

  getRoot(): HTMLElement {
    return this.panel;
  }

  getSelectedGrid(): { x: number; y: number } | null {
    return this.selectedGrid;
  }

  /** 军情行选中时高亮目的格；null 清除。 */
  setMarchDestHighlight(dest: { x: number; y: number } | null): void {
    if (dest != null && (!Number.isFinite(dest.x) || !Number.isFinite(dest.y))) {
      this.marchDestHighlight = null;
    } else {
      this.marchDestHighlight = dest;
    }
    this.renderList();
  }

  clearGridSelection(): void {
    if (!this.selectedGrid) return;
    this.selectedGrid = null;
    this.options?.onGridSelectionChange?.(null);
    this.renderList();
    this.renderInfoCard();
  }

  /** 小地图等外部入口同步世界选中格（不重复写入出征表单）。 */
  selectGridAt(
    x: number,
    y: number,
    opts?: { toggleOffIfSame?: boolean; source?: WorldTileGridSelectionSource },
  ): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (
      opts?.toggleOffIfSame &&
      this.selectedGrid != null &&
      gridCellsMatch(this.selectedGrid.x, this.selectedGrid.y, x, y)
    ) {
      this.clearGridSelection();
      return;
    }
    this.selectedGrid = { x, y };
    this.options?.onGridSelectionChange?.({ x, y });
    this.renderList();
    this.renderInfoCard();
    if (shouldPulseWorldTileFocusOnSelect(opts?.source)) {
      const card = this.panel.querySelector<HTMLElement>('[data-role="world-tile-info"]');
      applyWorldTileFocusPulse(card);
    }
  }

  /** 军情列表刷新后更新各行行军计数与信息卡。 */
  refreshMarchDestCounts(): void {
    this.renderList();
    this.renderInfoCard();
  }

  /** 打开世界面板、选中格点并触发 CLIENT-170 焦点脉冲（无新 world RPC）。 */
  openAndFocusTile(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const opening = this.panel.classList.contains("hidden");
    if (opening) {
      openCenterPanel(this.panel);
      resetCenterPanelViewportScroll(this.panel);
      void this.refreshList();
    }
    this.selectGridAt(x, y);
    this.scheduleWorldTileFocusPulse();
  }

  private scheduleWorldTileFocusPulse(): void {
    const card = this.panel.querySelector<HTMLElement>('[data-role="world-tile-info"]');
    if (!card) return;
    card.classList.remove(WORLD_TILE_FOCUS_PULSE_CLASS);
    void card.offsetWidth;
    card.classList.add(WORLD_TILE_FOCUS_PULSE_CLASS);
    window.setTimeout(
      () => card.classList.remove(WORLD_TILE_FOCUS_PULSE_CLASS),
      WORLD_TILE_FOCUS_PULSE_MS,
    );
  }

  private async refreshOwnedFields(): Promise<void> {
    const cityId = this.currentCityId();
    const ul = this.panel?.querySelector<HTMLElement>('[data-role="owned-field-list"]');
    const summary = this.panel?.querySelector<HTMLElement>('[data-role="owned-fields-summary"]');
    if (!ul || !summary) return;
    if (!cityId || typeof this.gateway.listOwnedFields !== "function") {
      this.ownedFields = [];
      ul.innerHTML = "";
      summary.textContent = "尚未占领野地。";
      return;
    }
    const actor = captureActor(this.gateway, () => this.getSession());
    const owner = () => actor() && this.currentCityId() === cityId;
    this.ownedFieldsOwner = owner;
    try {
      const [fieldsResponse, gathersResponse] = (await Promise.all([
        this.gateway.listOwnedFields(cityId),
        typeof this.gateway.listFieldGathers === "function"
          ? this.gateway.listFieldGathers(cityId)
          : Promise.resolve({ gathers: [] }),
      ])) as [
        { fields?: { x?: number; y?: number; name?: string; bonus_percent?: number }[] },
        { gathers?: FieldGatherWire[] },
      ];
      if (!owner()) return;
      this.ownedFields = (fieldsResponse.fields ?? []).map((field) => ({
        x: field.x ?? 0,
        y: field.y ?? 0,
        name: field.name ?? "野地",
        bonus_percent: field.bonus_percent ?? 0,
      }));
      this.fieldGathers = (gathersResponse.gathers ?? []).map((gather) => ({
        gather_id: gather.gather_id ?? 0,
        x: gather.x ?? 0,
        y: gather.y ?? 0,
        name: gather.name ?? "野地",
        status: gather.status ?? 0,
        finish_at_ms: gather.finish_at_ms ?? 0,
        reward: gather.reward,
      }));
      this.renderOwnedFields();
    } catch (error) {
      if (!owner()) return;
      this.ownedFields = [];
      ul.innerHTML = "";
      summary.textContent = `野地列表加载失败：${formatPanelGatewayErrorFromUnknown("world", error)}`;
    }
  }

  private renderOwnedFields(): void {
    const ul = this.panel?.querySelector<HTMLElement>('[data-role="owned-field-list"]');
    const summary = this.panel?.querySelector<HTMLElement>('[data-role="owned-fields-summary"]');
    if (!ul || !summary) return;
    ul.innerHTML = "";
    if (!this.ownedFields.length) {
      summary.textContent = "尚未占领野地。";
      return;
    }
    summary.textContent = `附属野地 ${this.ownedFields.length} 块（产量加成按地形叠加；采集耗粮 500，需空闲将领，历时 1 小时）。`;
    for (const field of this.ownedFields) {
      const li = document.createElement("li");
      li.className = "world-owned-field-row";
      li.textContent = `${field.name} (${field.x},${field.y}) · 产量 +${field.bonus_percent}% `;
      const gather = this.fieldGathers.find(
        (row) => row.x === field.x && row.y === field.y && row.status === 1,
      );
      if (gather) {
        const when = gather.finish_at_ms ? new Date(gather.finish_at_ms).toLocaleTimeString() : "—";
        const label = document.createElement("span");
        label.className = "world-field-gather-status";
        label.textContent = Date.now() >= gather.finish_at_ms ? "采集完成，可领取 " : `采集中，预计 ${when} 完成 `;
        li.appendChild(label);
        const claim = document.createElement("button");
        claim.type = "button";
        claim.dataset.action = "claim-gather";
        claim.dataset.gatherId = String(gather.gather_id);
        claim.textContent = "领取";
        li.appendChild(claim);
      } else {
        const gatherButton = document.createElement("button");
        gatherButton.type = "button";
        gatherButton.dataset.action = "start-gather";
        gatherButton.dataset.x = String(field.x);
        gatherButton.dataset.y = String(field.y);
        gatherButton.textContent = "采集";
        li.appendChild(gatherButton);
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "abandon-field";
      button.dataset.x = String(field.x);
      button.dataset.y = String(field.y);
      button.textContent = "放弃";
      li.appendChild(button);
      ul.appendChild(li);
    }
  }

  private async startGather(x: number, y: number): Promise<void> {
    const cityId = this.currentCityId();
    if (!cityId || typeof this.gateway.startFieldGather !== "function") return;
    try {
      await this.gateway.startFieldGather(cityId, x, y);
      this.onStatus(`已在 (${x},${y}) 开始采集，1 小时后可领取`);
    } catch (error) {
      this.onStatus(formatPanelGatewayErrorFromUnknown("world", error));
    }
    await this.refreshOwnedFields();
  }

  private async claimGather(gatherId: number): Promise<void> {
    if (typeof this.gateway.claimFieldGather !== "function") return;
    try {
      const response = (await this.gateway.claimFieldGather(gatherId)) as {
        reward?: { food?: number; wood?: number; stone?: number; iron?: number; gold?: number;
          items?: { item_cfg_id?: number; count?: number }[] };
      };
      this.onStatus(`采集领取成功：${formatGatherReward(response.reward)}`);
    } catch (error) {
      this.onStatus(formatPanelGatewayErrorFromUnknown("world", error));
    }
    await this.refreshOwnedFields();
  }

  private async abandonField(x: number, y: number): Promise<void> {
    const cityId = this.currentCityId();
    if (!cityId || typeof this.gateway.abandonField !== "function") return;
    if (!window.confirm(`放弃 (${x},${y}) 的附属野地？产量加成会立即失效。`)) return;
    try {
      await this.gateway.abandonField(cityId, x, y);
      this.onStatus(`已放弃附属野地 (${x},${y})`);
    } catch (error) {
      this.onStatus(formatPanelGatewayErrorFromUnknown("world", error));
    }
    await this.refreshOwnedFields();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel product-chrome-panel hidden world-panel";
    el.dataset.centerPanel = "world";
    el.innerHTML = `
      <h3>世界</h3>
      <p class="world-panel-hint" data-role="world-hint">玩家城池与坐标（非大地图）；点选可将坐标填入出征目标，并在下方信息卡扫读格点上下文。</p>
      <aside class="world-tile-info ${WORLD_TILE_INFO_CARD_CLASS} hidden" data-role="world-tile-info" aria-live="polite">
        <h4>格点信息</h4>
        <p class="world-tile-info-state hidden" data-role="world-tile-info-state"></p>
        <div data-role="world-tile-info-body">
          <dl class="world-tile-info-lines" data-role="world-tile-info-lines"></dl>
          <p class="world-tile-info-hint hidden" data-role="world-tile-occupation-hint"></p>
          <p class="world-tile-info-march" data-role="world-tile-march-count"></p>
          <p class="world-tile-info-secondary ${WORLD_TILE_MARCH_SUMMARY_LINE_CLASS}" data-role="world-tile-march-secondary"></p>
          <div class="world-tile-info-actions">
            <button type="button" data-action="view-marches-at-grid">在军情中查看</button>
            <button type="button" class="hidden" data-action="view-battle-reports-at-grid">打开战报筛选</button>
          </div>
        </div>
      </aside>
      <button type="button" data-action="refresh-world">刷新城池</button>
      <div class="panel-scroll-body" data-role="world-scroll">
        <ul class="world-city-list" data-role="world-list"></ul>
        <h4>附属野地</h4>
        <p class="world-owned-fields-summary" data-role="owned-fields-summary">尚未占领野地。</p>
        <ul class="world-owned-field-list" data-role="owned-field-list"></ul>
      </div>
    `;
    return el;
  }

  private currentCityId(): number | undefined {
    return this.getSession()?.cityId;
  }

  private renderList(): void {
    if (this.citiesOwner && !this.citiesOwner()) this.cities = [];
    const ul = this.panel.querySelector('[data-role="world-list"]');
    if (!ul) return;
    ul.innerHTML = "";
    const currentId = this.currentCityId();
    if (!this.cities.length) {
      const li = document.createElement("li");
      li.textContent = "（暂无城池，请刷新或先建城）";
      ul.appendChild(li);
      return;
    }
    const highlight = this.marchDestHighlight;
    const hasCityAtHighlight =
      highlight != null && findPlayerCityAtGrid(this.cities, highlight.x, highlight.y) != null;

    const marches = this.options?.getMarchesSnapshot?.() ?? [];

    if (highlight != null && !hasCityAtHighlight) {
      const coordLi = document.createElement("li");
      coordLi.className = WORLD_CITY_COORD_ONLY_CLASS;
      const label = document.createElement("span");
      label.className = "world-city-row-label";
      label.textContent = `格点 ${formatCityCoords(highlight.x, highlight.y)}（无玩家城池）`;
      coordLi.appendChild(label);
      this.appendMarchCountButton(coordLi, highlight.x, highlight.y, marches);
      coordLi.setAttribute("data-x", String(highlight.x));
      coordLi.setAttribute("data-y", String(highlight.y));
      coordLi.classList.add(WORLD_CITY_ROW_MARCH_DEST_CLASS);
      ul.appendChild(coordLi);
    }

    for (const city of this.cities) {
      const li = document.createElement("li");
      const id = city.city_id ?? 0;
      const label = document.createElement("span");
      label.className = "world-city-row-label";
      label.textContent = formatPlayerCityLine(city, currentId);
      li.appendChild(label);
      const cx = city.x;
      const cy = city.y;
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        this.appendMarchCountButton(li, cx!, cy!, marches);
      }
      if (id) {
        li.setAttribute("data-city-id", String(id));
        li.setAttribute("data-x", String(city.x ?? ""));
        li.setAttribute("data-y", String(city.y ?? ""));
      }
      if (isCurrentMainCity(city, currentId)) li.classList.add("current-main");
      if (
        highlight != null &&
        gridCellsMatch(city.x, city.y, highlight.x, highlight.y)
      ) {
        li.classList.add(WORLD_CITY_ROW_MARCH_DEST_CLASS);
      }
      if (
        this.selectedGrid != null &&
        gridCellsMatch(city.x, city.y, this.selectedGrid.x, this.selectedGrid.y)
      ) {
        li.classList.add(WORLD_CITY_ROW_SELECTED_CLASS);
      }
      ul.appendChild(li);
    }
    this.renderInfoCard();
  }

  private renderInfoCard(): void {
    const card = this.panel.querySelector('[data-role="world-tile-info"]');
    const stateEl = this.panel.querySelector<HTMLElement>('[data-role="world-tile-info-state"]');
    const bodyEl = this.panel.querySelector('[data-role="world-tile-info-body"]');
    const dl = this.panel.querySelector('[data-role="world-tile-info-lines"]');
    const hintEl = this.panel.querySelector('[data-role="world-tile-occupation-hint"]');
    const marchEl = this.panel.querySelector('[data-role="world-tile-march-count"]');
    const secondaryEl = this.panel.querySelector('[data-role="world-tile-march-secondary"]');
    const reportBtn = this.panel.querySelector<HTMLButtonElement>(
      '[data-action="view-battle-reports-at-grid"]',
    );
    if (
      !card ||
      !dl ||
      !marchEl ||
      !secondaryEl ||
      !hintEl ||
      !stateEl ||
      !bodyEl
    )
      return;

    if (!this.selectedGrid) {
      card.classList.add("hidden");
      stateEl.textContent = "";
      stateEl.classList.add("hidden");
      stateEl.removeAttribute("data-panel-state");
      bodyEl.classList.remove("hidden");
      dl.innerHTML = "";
      hintEl.textContent = "";
      hintEl.classList.add("hidden");
      marchEl.textContent = "";
      secondaryEl.textContent = "";
      return;
    }

    const { x, y } = this.selectedGrid;
    card.classList.remove("hidden");
    card.setAttribute("data-grid-x", String(x));
    card.setAttribute("data-grid-y", String(y));

    if (this.citiesLoading) {
      stateEl.classList.remove("hidden");
      stateEl.textContent = "格点信息加载中…";
      applyPanelStateChrome(stateEl, "loading", this.options?.assets);
      bodyEl.classList.add("hidden");
      return;
    }

    if (this.citiesLoadError) {
      stateEl.classList.remove("hidden");
      stateEl.textContent = this.citiesLoadError;
      applyPanelStateChrome(stateEl, "error", this.options?.assets);
      bodyEl.classList.add("hidden");
      return;
    }

    stateEl.textContent = "";
    stateEl.classList.add("hidden");
    stateEl.removeAttribute("data-panel-state");
    bodyEl.classList.remove("hidden");

    const marches = this.options?.getMarchesSnapshot?.() ?? [];
    const battleReports = this.options?.getBattleReportsSnapshot?.() ?? [];
    const timeWindow = readBattleReportTimeWindowFilterSession() ?? "all";
    const cityAtGrid = findPlayerCityAtGrid(this.cities, x, y);
    const summary = buildWorldInfoCardSummary({
      cell: { x, y },
      cities: this.cities,
      marches,
      options: {
        ownCityX: this.getSession()?.cityX,
        ownCityY: this.getSession()?.cityY,
        currentCityId: this.currentCityId(),
        battleReports,
        battleReportTimeWindow: timeWindow,
      },
    });
    dl.innerHTML = "";
    const addLine = (term: string, detail: string) => {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = detail;
      dl.appendChild(dt);
      dl.appendChild(dd);
    };
    addLine("坐标", summary.coordsLine.replace(/^格点 /, ""));
    if (summary.cityLine) addLine("城池", summary.cityLine);
    addLine("占领", formatWorldTileOccupationSummary(cityAtGrid, this.currentCityId()));
    if (summary.playerLine) addLine("玩家", summary.playerLine);
    if (summary.terrainLine) addLine("地形", summary.terrainLine.replace(/^资源格：/, ""));
    if (summary.manhattanLine) addLine("距离", summary.manhattanLine);
    if (summary.occupationHintLine) {
      hintEl.textContent = summary.occupationHintLine;
      hintEl.classList.remove("hidden");
    } else {
      hintEl.textContent = "";
      hintEl.classList.add("hidden");
    }
    marchEl.textContent = summary.marchCountLine;
    secondaryEl.textContent = formatWorldTileMarchSummaryLine(marches, { x, y });
    if (reportBtn) {
      if (summary.showBattleReportShortcut) {
        reportBtn.classList.remove("hidden");
        if (summary.recentBattleReportId != null) {
          reportBtn.setAttribute("data-report-id", String(summary.recentBattleReportId));
        } else {
          reportBtn.removeAttribute("data-report-id");
        }
      } else {
        reportBtn.classList.add("hidden");
        reportBtn.removeAttribute("data-report-id");
      }
    }
  }

  private async refreshList(): Promise<void> {
    void this.refreshOwnedFields();
    const actor = captureActor(this.gateway, this.getSession);
    const panel = this.panel;
    const version = ++this.citiesReadVersion;
    const current = () => actor() && this.panel === panel && panel.parentNode === this.mount &&
      version === this.citiesReadVersion;
    if (this.citiesOwner && !this.citiesOwner()) {
      this.cities = [];
      this.citiesOwner = null;
      this.renderList();
    }
    this.citiesLoading = true;
    this.citiesLoadError = null;
    this.renderInfoCard();
    this.onStatus("拉取城池列表…");
    try {
      const res = await this.gateway.listPlayerCities();
      if (!current()) return;
      this.citiesOwner = actor;
      this.cities = citiesFromListPlayerCitiesResponse(res as { cities?: PlayerCitySummary[] });
      this.citiesLoadError = null;
      this.renderList();
      this.onStatus(`世界 · ${this.cities.length} 座城池`);
    } catch (e) {
      if (!current()) return;
      this.citiesLoadError = formatPanelGatewayErrorFromUnknown("world", e);
      this.renderInfoCard();
      this.onStatus(this.citiesLoadError);
    } finally {
      if (!current()) return;
      this.citiesLoading = false;
      this.renderInfoCard();
    }
  }

  private appendMarchCountButton(
    li: HTMLElement,
    x: number,
    y: number,
    marches: MarchSummary[],
  ): void {
    const count = countMarchesAtCell(marches, x, y);
    const text = formatWorldCityMarchDestCount(count);
    if (!text) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = WORLD_CITY_ROW_MARCH_COUNT_CLASS;
    btn.setAttribute("data-action", "world-march-count");
    btn.setAttribute("data-x", String(x));
    btn.setAttribute("data-y", String(y));
    btn.textContent = text;
    li.appendChild(btn);
  }

  private onClick(ev: Event): void {
    const target = ev.target as HTMLElement;
    const startGatherBtn = target.closest("button[data-action='start-gather']") as HTMLButtonElement | null;
    if (startGatherBtn) {
      const x = Number(startGatherBtn.dataset.x);
      const y = Number(startGatherBtn.dataset.y);
      if (Number.isFinite(x) && Number.isFinite(y)) void this.startGather(x, y);
      return;
    }
    const claimGatherBtn = target.closest("button[data-action='claim-gather']") as HTMLButtonElement | null;
    if (claimGatherBtn) {
      const gatherId = Number(claimGatherBtn.dataset.gatherId);
      if (Number.isFinite(gatherId)) void this.claimGather(gatherId);
      return;
    }
    const abandonBtn = target.closest("button[data-action='abandon-field']") as HTMLButtonElement | null;
    if (abandonBtn) {
      const x = Number(abandonBtn.dataset.x);
      const y = Number(abandonBtn.dataset.y);
      if (Number.isFinite(x) && Number.isFinite(y)) void this.abandonField(x, y);
      return;
    }
    const infoCard = target.closest('[data-role="world-tile-info"]');
    if (
      infoCard &&
      !target.closest("button") &&
      this.selectedGrid &&
      !this.panel.classList.contains("hidden")
    ) {
      this.options?.onCenterMinimapAtGrid?.({ ...this.selectedGrid });
    }
    const viewIntelBtn = target.closest("button[data-action='view-marches-at-grid']");
    if (viewIntelBtn) {
      if (!this.selectedGrid) return;
      this.options?.onViewMarchesAtGrid?.({ ...this.selectedGrid });
      return;
    }
    const viewReportBtn = target.closest("button[data-action='view-battle-reports-at-grid']");
    if (viewReportBtn) {
      if (!this.selectedGrid) return;
      const hint = Number(viewReportBtn.getAttribute("data-report-id"));
      this.options?.onViewBattleReportsAtGrid?.(
        { ...this.selectedGrid },
        Number.isFinite(hint) && hint > 0 ? hint : undefined,
      );
      return;
    }
    const marchCountBtn = target.closest("button[data-action='world-march-count']");
    if (marchCountBtn) {
      ev.stopPropagation();
      const x = Number(marchCountBtn.getAttribute("data-x"));
      const y = Number(marchCountBtn.getAttribute("data-y"));
      if (Number.isFinite(x) && Number.isFinite(y)) {
        this.options?.onMarchCountClick?.({ x, y });
      }
      return;
    }
    const action = target.closest("button")?.getAttribute("data-action");
    if (action === "refresh-world") {
      void this.refreshList();
      return;
    }
    const row = target.closest("li[data-x][data-y]");
    if (!row) return;
    const x = Number(row.getAttribute("data-x"));
    const y = Number(row.getAttribute("data-y"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.onStatus("该城池无有效坐标");
      return;
    }
    if (this.selectedGrid != null && gridCellsMatch(this.selectedGrid.x, this.selectedGrid.y, x, y)) {
      this.clearGridSelection();
      return;
    }
    this.selectGridAt(x, y);

    const filled = applyMarchTargetAndRemember(this.marchTarget.marchFormRoot, x, y, {
      source: "world_city",
    });
    if (filled) {
      this.marchTarget.onFilled?.(x, y);
      this.onStatus(marchTargetStatusMessage("world_city", x, y));
    } else {
      this.onStatus(`坐标 (${x},${y})（出征表单未就绪，仅展示）`);
    }
  }
}

type FieldGatherWire = {
  gather_id?: number;
  x?: number;
  y?: number;
  name?: string;
  status?: number;
  finish_at_ms?: number;
  reward?: { food?: number; wood?: number; stone?: number; iron?: number; gold?: number;
    items?: { item_cfg_id?: number; count?: number }[] };
};

type FieldGatherRow = {
  gather_id: number;
  x: number;
  y: number;
  name: string;
  status: number;
  finish_at_ms: number;
  reward?: FieldGatherWire["reward"];
};

function formatGatherReward(reward: FieldGatherWire["reward"]): string {
  if (!reward) return "无奖励";
  const parts: string[] = [];
  const resources: [string, number | undefined][] = [
    ["粮", reward.food], ["木", reward.wood], ["石", reward.stone], ["铁", reward.iron], ["金", reward.gold],
  ];
  for (const [label, value] of resources) {
    if ((value ?? 0) > 0) parts.push(`${label}${value}`);
  }
  for (const item of reward.items ?? []) {
    if ((item.count ?? 0) > 0) parts.push(`道具#${item.item_cfg_id}×${item.count}`);
  }
  return parts.length ? parts.join(" ") : "无奖励";
}
