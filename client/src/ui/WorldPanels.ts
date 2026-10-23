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
  countMarchesToDestination,
  findPlayerCityAtGrid,
  formatWorldCityMarchDestCount,
  gridCellsMatch,
  WORLD_CITY_COORD_ONLY_CLASS,
  WORLD_CITY_ROW_MARCH_COUNT_CLASS,
  WORLD_CITY_ROW_MARCH_DEST_CLASS,
  WORLD_CITY_ROW_SELECTED_CLASS,
} from "@/ui/marchWorldListLink";
import { resetCenterPanelViewportScroll } from "@/ui/contentPanelScroll";
import { formatWorldTileInfoCard } from "@/ui/worldTileInfoCard";

export type MarchTargetSink = {
  /** 出征表单容器（含 data-field to-x / to-y）；可选。 */
  marchFormRoot?: ParentNode | null;
  /** 填入成功后回调（如打开军事面板、更新 HUD 状态）。 */
  onFilled?: (x: number, y: number) => void;
};

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
};

export class WorldPanels {
  private panel!: HTMLElement;
  private cities: PlayerCitySummary[] = [];
  private selectedGrid: { x: number; y: number } | null = null;
  private marchDestHighlight: { x: number; y: number } | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private readonly marchTarget: MarchTargetSink,
    private onStatus: (msg: string) => void,
    private readonly options?: WorldPanelsOptions,
  ) {}

  attach(): void {
    this.panel = this.buildPanel();
    this.mount.appendChild(this.panel);
    this.panel.addEventListener("click", (ev) => this.onClick(ev));
  }

  detach(): void {
    this.panel?.remove();
  }

  toggle(): void {
    this.panel.classList.toggle("hidden");
    if (!this.panel.classList.contains("hidden")) void this.refreshList();
  }

  /** CLIENT-108/109：外部深链打开世界面板（不关闭已打开状态）。 */
  openPanel(): void {
    if (!this.panel.classList.contains("hidden")) return;
    this.panel.classList.remove("hidden");
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
  selectGridAt(x: number, y: number, opts?: { toggleOffIfSame?: boolean }): void {
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
  }

  /** 军情列表刷新后更新各行行军计数与信息卡。 */
  refreshMarchDestCounts(): void {
    this.renderList();
    this.renderInfoCard();
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden world-panel";
    el.dataset.centerPanel = "world";
    el.innerHTML = `
      <h3>世界</h3>
      <p class="world-panel-hint" data-role="world-hint">玩家城池与坐标（非大地图）；点选可将坐标填入出征目标，并在下方信息卡扫读格点上下文。</p>
      <aside class="world-tile-info hidden" data-role="world-tile-info" aria-live="polite">
        <h4>格点信息</h4>
        <dl class="world-tile-info-lines" data-role="world-tile-info-lines"></dl>
        <p class="world-tile-info-hint hidden" data-role="world-tile-occupation-hint"></p>
        <p class="world-tile-info-march" data-role="world-tile-march-count"></p>
        <div class="world-tile-info-actions">
          <button type="button" data-action="view-marches-at-grid">打开军情</button>
          <button type="button" class="hidden" data-action="view-battle-reports-at-grid">打开战报筛选</button>
        </div>
      </aside>
      <button type="button" data-action="refresh-world">刷新城池</button>
      <div class="panel-scroll-body" data-role="world-scroll">
        <ul class="world-city-list" data-role="world-list"></ul>
      </div>
    `;
    return el;
  }

  private currentCityId(): number | undefined {
    return this.getSession()?.cityId;
  }

  private renderList(): void {
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
    const dl = this.panel.querySelector('[data-role="world-tile-info-lines"]');
    const hintEl = this.panel.querySelector('[data-role="world-tile-occupation-hint"]');
    const marchEl = this.panel.querySelector('[data-role="world-tile-march-count"]');
    const reportBtn = this.panel.querySelector<HTMLButtonElement>(
      '[data-action="view-battle-reports-at-grid"]',
    );
    if (!card || !dl || !marchEl || !hintEl) return;

    if (!this.selectedGrid) {
      card.classList.add("hidden");
      dl.innerHTML = "";
      hintEl.textContent = "";
      hintEl.classList.add("hidden");
      marchEl.textContent = "";
      reportBtn?.classList.add("hidden");
      return;
    }

    const { x, y } = this.selectedGrid;
    const marches = this.options?.getMarchesSnapshot?.() ?? [];
    const battleReports = this.options?.getBattleReportsSnapshot?.() ?? [];
    const timeWindow = readBattleReportTimeWindowFilterSession() ?? "all";
    const summary = formatWorldTileInfoCard(
      { x, y },
      this.cities,
      marches,
      {
        ownCityX: this.getSession()?.cityX,
        ownCityY: this.getSession()?.cityY,
        currentCityId: this.currentCityId(),
        battleReports,
        battleReportTimeWindow: timeWindow,
      },
    );

    card.classList.remove("hidden");
    card.setAttribute("data-grid-x", String(x));
    card.setAttribute("data-grid-y", String(y));
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
    this.onStatus("拉取城池列表…");
    try {
      const res = await this.gateway.listPlayerCities();
      this.cities = citiesFromListPlayerCitiesResponse(res as { cities?: PlayerCitySummary[] });
      this.renderList();
      this.onStatus(`世界 · ${this.cities.length} 座城池`);
    } catch (e) {
      this.onStatus((e as Error).message);
    }
  }

  private appendMarchCountButton(
    li: HTMLElement,
    x: number,
    y: number,
    marches: MarchSummary[],
  ): void {
    const count = countMarchesToDestination(marches, x, y);
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
