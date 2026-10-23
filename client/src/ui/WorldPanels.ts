import type { MainCitySession } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";
import {
  applyMarchTargetToForm,
  citiesFromListPlayerCitiesResponse,
  formatPlayerCityLine,
  isCurrentMainCity,
  type PlayerCitySummary,
} from "@/net/worldFormat";

export type MarchTargetSink = {
  /** 出征表单容器（含 data-field to-x / to-y）；可选。 */
  marchFormRoot?: ParentNode | null;
  /** 填入成功后回调（如打开军事面板、更新 HUD 状态）。 */
  onFilled?: (x: number, y: number) => void;
};

export class WorldPanels {
  private panel!: HTMLElement;
  private cities: PlayerCitySummary[] = [];

  constructor(
    private readonly mount: HTMLElement,
    private readonly gateway: GatewayPort,
    private getSession: () => MainCitySession | null,
    private readonly marchTarget: MarchTargetSink,
    private onStatus: (msg: string) => void,
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
    const row = target.closest("li[data-city-id]");
    if (!row) return;
    const x = Number(row.getAttribute("data-x"));
    const y = Number(row.getAttribute("data-y"));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.onStatus("该城池无有效坐标");
      return;
    }
    const filled = applyMarchTargetToForm(this.marchTarget.marchFormRoot, x, y);
    if (filled) {
      this.marchTarget.onFilled?.(x, y);
      this.onStatus(`已填入出征目标 (${x},${y})`);
    } else {
      this.onStatus(`坐标 (${x},${y})（出征表单未就绪，仅展示）`);
    }
  }
}
