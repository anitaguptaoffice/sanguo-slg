import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
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
  findPlayerCityAtGrid,
  gridCellsMatch,
  WORLD_CITY_COORD_ONLY_CLASS,
  WORLD_CITY_ROW_MARCH_DEST_CLASS,
  WORLD_CITY_ROW_SELECTED_CLASS,
} from "@/ui/marchWorldListLink";

export type MarchTargetSink = {
  /** 出征表单容器（含 data-field to-x / to-y）；可选。 */
  marchFormRoot?: ParentNode | null;
  /** 填入成功后回调（如打开军事面板、更新 HUD 状态）。 */
  onFilled?: (x: number, y: number) => void;
};

export type WorldPanelsOptions = {
  /** 世界列表点选格点变化（用于军情列表目的格筛选）。 */
  onGridSelectionChange?: (grid: { x: number; y: number } | null) => void;
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
  }

  private buildPanel(): HTMLElement {
    const el = document.createElement("div");
    el.className = "content-panel hidden world-panel";
    el.innerHTML = `
      <h3>世界</h3>
      <p class="world-panel-hint" data-role="world-hint">玩家城池与坐标（非大地图）；点选可将坐标填入出征目标。</p>
      <button type="button" data-action="refresh-world">刷新城池</button>
      <ul class="world-city-list" data-role="world-list"></ul>
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

    if (highlight != null && !hasCityAtHighlight) {
      const coordLi = document.createElement("li");
      coordLi.className = WORLD_CITY_COORD_ONLY_CLASS;
      coordLi.textContent = `格点 ${formatCityCoords(highlight.x, highlight.y)}（无玩家城池）`;
      coordLi.setAttribute("data-x", String(highlight.x));
      coordLi.setAttribute("data-y", String(highlight.y));
      coordLi.classList.add(WORLD_CITY_ROW_MARCH_DEST_CLASS);
      ul.appendChild(coordLi);
    }

    for (const city of this.cities) {
      const li = document.createElement("li");
      const id = city.city_id ?? 0;
      li.textContent = formatPlayerCityLine(city, currentId);
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

  private onClick(ev: Event): void {
    const target = ev.target as HTMLElement;
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
    this.selectedGrid = { x, y };
    this.options?.onGridSelectionChange?.({ x, y });
    this.renderList();

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
