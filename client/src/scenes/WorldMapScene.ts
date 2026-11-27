import type { AssetLoader } from "@/engine/AssetLoader";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import {
  clampCamera,
  fetchRadius,
  projectTile,
  terrainFill,
  terrainLabel,
  tileAtScreen,
  visibleTileBounds,
  zoomAround,
  MAX_ZOOM,
  MIN_ZOOM,
  type Camera,
  type ViewportSize,
} from "./worldMapMath";
import {
  worldCityAssetId,
  worldFlagAssetId,
  worldSpecialCityAssetId,
  worldSpecialCityLandmarkAssetId,
  worldMarchAssetId,
  worldResourceAssetId,
  worldTileAssetId,
} from "./worldMapArt";
import {
  buildWorldMapTileActionSpecs,
  worldMapActionDataAction,
  type WorldMapTileActionSpec,
} from "@/ui/worldMapTileDetailActions";
import {
  marchInterpolatedTile,
  worldMapMarchNeedsAnimation,
  type WorldMapMarchDrawInput,
} from "@/net/worldMapMarchInterp";

export type WorldMapDeps = {
  gateway: () => GatewayPort;
  getSession: () => MainCitySession | null;
  onMarchTarget: (x: number, y: number, marchPurpose?: number) => void;
  /** 采集/野地管理等次要入口：回主城并打开「世界」面板定位格点。 */
  onOpenWorldAtTile?: (x: number, y: number) => void;
  /** Optional R1-S6 art; procedural shapes remain the fallback. */
  assets?: AssetLoader;
};

type SpecialCityMarker = {
  city_cfg_id: number;
  city_type: number;
  name: string;
  x: number;
  y: number;
  owner_guild_id: number;
  owner_guild_name: string;
  garrison: number;
  hero_name: string;
  unit_name: string;
  min_phase: number;
  locked: boolean;
  lock_reason: string;
};

type Tile = {
  x: number;
  y: number;
  terrain: number;
  level: number;
  max_level: number;
  province_id: number;
  province_name: string;
  owner_player_id: number;
  owner_city_id: number;
  owner_name: string;
  npc_kind: number;
  npc_level: number;
  city_level: number;
  in_battle: boolean;
};

type MarchLine = WorldMapMarchDrawInput & {
  march_id: number;
  owner_player_id: number;
};

type Province = { province_id: number; name: string; x: number; y: number };

type TileDetail = {
  tile: Tile;
  actions: string[];
  garrison_tier: number;
  resource_bonus_percent: number;
  distance_from_capital: number;
};

const MAP_SIZE = 500;
const FETCH_DELAY_MS = 140;

/** Full-screen isometric world map. Owns its canvas and detail card; the main
 *  city scene keeps running underneath and the gateway connection is untouched. */
export class WorldMapScene {
  private layer!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private detail!: HTMLElement;
  private statusEl!: HTMLElement;
  private provinceSelect!: HTMLSelectElement;
  private clickTrap: ((ev: MouseEvent) => void) | null = null;

  private camera: Camera = { centerX: 60, centerY: 60, zoom: 1 };
  private tiles = new Map<string, Tile>();
  private marches: MarchLine[] = [];
  private provinces: Province[] = [];
  private selected: { x: number; y: number } | null = null;
  private specialCities: SpecialCityMarker[] = [];
  private fetchTimer: number | null = null;
  private fetchGeneration = 0;
  private renderQueued = false;
  private marchAnimFrame = 0;
  private dragging = false;
  private dragMoved = 0;
  private dragLast: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private opened = false;
  private onKeyDown: ((ev: KeyboardEvent) => void) | null = null;

  constructor(private readonly parent: HTMLElement, private readonly deps: WorldMapDeps) {}

  attach(): void {
    this.layer = document.createElement("div");
    this.layer.className = "world-map-layer world-map-scene hidden";
    this.layer.dataset.role = "world-map-layer";
    this.layer.innerHTML = `
      <div class="world-map-header world-map-header-bar" data-role="world-map-header">
        <strong>世界大地图</strong>
        <span class="world-map-coords" data-role="world-map-coords"></span>
        <label>X <input type="number" min="0" max="499" data-field="jump-x" /></label>
        <label>Y <input type="number" min="0" max="499" data-field="jump-y" /></label>
        <button type="button" data-action="world-map-jump">跳转</button>
        <select data-field="province" aria-label="州郡跳转"><option value="">州郡</option></select>
        <button type="button" data-action="world-map-home">回到主城</button>
        <button type="button" data-action="world-map-zoom-in">放大</button>
        <button type="button" data-action="world-map-zoom-out">缩小</button>
        <button type="button" data-action="world-map-close">返回主城</button>
      </div>
      <div class="world-map-canvas-wrap" data-role="world-map-canvas-wrap">
        <canvas data-role="world-map-canvas"></canvas>
      </div>
      <div class="world-map-status world-map-status-line" data-role="world-map-status"></div>
      <div class="world-map-legend world-map-legend-bar">
        <span><i style="background:#8fbf5f"></i>平地</span>
        <span><i style="background:#3f7a45"></i>森林</span>
        <span><i style="background:#8a8070"></i>山地</span>
        <span><i style="background:#4f8fbf"></i>湖泊</span>
        <span><i style="background:#d8c07a"></i>荒漠</span>
        <span><i style="background:#5f6f4f"></i>沼泽</span>
        <span><i style="background:#c8a24a"></i>城池</span>
        <span><i style="background:#c0392b"></i>黄巾</span>
      </div>
      <aside class="world-map-detail hidden" data-role="world-map-detail"></aside>
    `;
    this.canvas = this.layer.querySelector('[data-role="world-map-canvas"]') as HTMLCanvasElement;
    this.detail = this.layer.querySelector('[data-role="world-map-detail"]') as HTMLElement;
    this.statusEl = this.layer.querySelector('[data-role="world-map-status"]') as HTMLElement;
    this.provinceSelect = this.layer.querySelector('[data-field="province"]') as HTMLSelectElement;
    this.applyBaseStyles();
    this.parent.appendChild(this.layer);

    this.layer.addEventListener("click", this.onClick);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("resize", this.onResize);
  }

  detach(): void {
    this.close();
    this.layer?.removeEventListener("click", this.onClick);
    this.canvas?.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas?.removeEventListener("pointermove", this.onPointerMove);
    this.canvas?.removeEventListener("pointerup", this.onPointerUp);
    this.canvas?.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas?.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("resize", this.onResize);
    this.layer?.remove();
  }

  isOpen(): boolean {
    return this.opened;
  }

  open(centerX: number, centerY: number): void {
    if (!this.layer) return;
    this.opened = true;
    this.camera = clampCamera({ centerX, centerY, zoom: this.camera.zoom }, MAP_SIZE);
    this.layer.classList.remove("hidden");
    this.selected = null;
    this.hideDetail();
    this.resizeCanvas();
    this.requestRender();
    this.startMarchAnimationLoop();
    this.scheduleFetch(0);
    void this.refreshSpecialCities();
    this.setStatus("拖拽平移，滚轮或按钮缩放；点击格点查看详情。");
    if (!this.onKeyDown) {
      this.onKeyDown = (ev: KeyboardEvent) => {
        if (!this.opened || ev.key !== "Escape") return;
        if (!this.detail.classList.contains("hidden")) {
          ev.preventDefault();
          this.hideDetail();
          return;
        }
        ev.preventDefault();
        this.close();
      };
      window.addEventListener("keydown", this.onKeyDown);
    }
  }

  close(): void {
    this.opened = false;
    this.stopMarchAnimationLoop();
    this.dragging = false;
    this.dragLast = null;
    if (this.fetchTimer != null) {
      window.clearTimeout(this.fetchTimer);
      this.fetchTimer = null;
    }
    this.layer?.classList.add("hidden");
    this.hideDetail();
  }

  private applyBaseStyles(): void {
    const header = this.layer.querySelector('[data-role="world-map-header"]') as HTMLElement;
    const wrap = this.layer.querySelector('[data-role="world-map-canvas-wrap"]') as HTMLElement;
    const legend = this.layer.querySelector(".world-map-legend") as HTMLElement;
    this.layer.style.cssText =
      "position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;gap:6px;padding:10px;" +
      "background:#171410;color:#e8dcc8;font:13px/1.4 system-ui,sans-serif;";
    header.style.cssText =
      "display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 8px;" +
      "background:#241d16;border:1px solid #4a3c2a;border-radius:6px;";
    header.querySelectorAll("input,select,button").forEach((el) => {
      (el as HTMLElement).style.cssText =
        "background:#1a1510;color:#e8dcc8;border:1px solid #5a4a34;border-radius:4px;padding:2px 6px;";
    });
    header.querySelectorAll("input").forEach((el) => {
      (el as HTMLInputElement).style.width = "56px";
    });
    wrap.style.cssText = "position:relative;flex:1;min-height:0;border:1px solid #4a3c2a;border-radius:6px;overflow:hidden;";
    this.canvas.style.cssText = "display:block;width:100%;height:100%;cursor:grab;touch-action:none;";
    this.statusEl.style.cssText = "min-height:18px;color:#c8b795;";
    legend.style.cssText = "display:flex;flex-wrap:wrap;gap:10px;color:#c8b795;font-size:12px;";
    legend.querySelectorAll("i").forEach((el) => {
      (el as HTMLElement).style.cssText =
        "display:inline-block;width:10px;height:10px;margin-right:3px;border-radius:2px;vertical-align:middle;";
    });
    this.detail.style.cssText =
      "position:absolute;right:16px;top:64px;width:min(280px,calc(100% - 32px));max-height:min(70%,calc(100% - 80px));overflow:auto;padding:10px;" +
      "background:#241d16ee;border:1px solid #6a5538;border-radius:8px;box-shadow:0 6px 18px #0008;";
    this.detail.classList.add("world-map-detail-card");
  }

  private onResize = (): void => {
    if (!this.opened) return;
    this.resizeCanvas();
    this.requestRender();
    this.scheduleFetch();
  };

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.clientWidth || 960;
    const height = this.canvas.clientHeight || 540;
    this.canvas.width = Math.max(1, Math.round(width * dpr));
    this.canvas.height = Math.max(1, Math.round(height * dpr));
    const ctx = this.canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private size(): { width: number; height: number } {
    return { width: this.canvas.clientWidth || 960, height: this.canvas.clientHeight || 540 };
  }

  private onClick = (ev: MouseEvent): void => {
    const target = (ev.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
    if (!target) return;
    switch (target.dataset.action) {
      case "world-map-close":
        this.close();
        break;
      case "world-map-home": {
        const session = this.deps.getSession();
        if (session) this.jumpTo(session.cityX ?? 60, session.cityY ?? 60);
        break;
      }
      case "world-map-jump": {
        const x = Number((this.layer.querySelector('[data-field="jump-x"]') as HTMLInputElement).value);
        const y = Number((this.layer.querySelector('[data-field="jump-y"]') as HTMLInputElement).value);
        if (Number.isFinite(x) && Number.isFinite(y)) this.jumpTo(x, y);
        break;
      }
      case "world-map-zoom-in":
        this.setZoom(Math.min(MAX_ZOOM, this.camera.zoom + 0.5));
        break;
      case "world-map-zoom-out":
        this.setZoom(Math.max(MIN_ZOOM, this.camera.zoom - 0.5));
        break;
      case "world-map-march": {
        const purpose = Number(target.getAttribute("data-march-purpose"));
        const x = this.selected?.x ?? this.camera.centerX;
        const y = this.selected?.y ?? this.camera.centerY;
        this.deps.onMarchTarget(x, y, Number.isFinite(purpose) && purpose > 0 ? purpose : undefined);
        this.close();
        break;
      }
      case "world-map-open-world": {
        const x = this.selected?.x ?? this.camera.centerX;
        const y = this.selected?.y ?? this.camera.centerY;
        this.deps.onOpenWorldAtTile?.(x, y);
        this.close();
        break;
      }
    }
  };

  private onProvinceChange = (): void => {
    const value = Number(this.provinceSelect.value);
    const province = this.provinces.find((item) => item.province_id === value);
    if (province) this.jumpTo(province.x, province.y);
  };

  private jumpTo(x: number, y: number): void {
    this.camera = clampCamera({ ...this.camera, centerX: x, centerY: y }, MAP_SIZE);
    this.requestRender();
    this.scheduleFetch(0);
  }

  private setZoom(zoom: number): void {
    const size = this.size();
    this.camera = clampCamera(zoomAround(this.camera, { x: size.width / 2, y: size.height / 2 }, size, zoom), MAP_SIZE);
    this.requestRender();
    this.scheduleFetch();
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (ev.button !== 0) return;
    this.dragging = true;
    this.dragMoved = 0;
    this.dragLast = { x: ev.clientX, y: ev.clientY };
    this.pointerId = ev.pointerId;
    this.canvas.setPointerCapture?.(ev.pointerId);
    this.canvas.style.cursor = "grabbing";
  };

  private onPointerMove = (ev: PointerEvent): void => {
    if (!this.dragging || !this.dragLast) return;
    const dx = ev.clientX - this.dragLast.x;
    const dy = ev.clientY - this.dragLast.y;
    this.dragLast = { x: ev.clientX, y: ev.clientY };
    this.dragMoved += Math.abs(dx) + Math.abs(dy);
    const halfW = 32 * this.camera.zoom;
    const halfH = 16 * this.camera.zoom;
    // Screen delta back to tile delta on the isometric lattice.
    const tileDx = dx / halfW / 2 + dy / halfH / 2;
    const tileDy = dy / halfH / 2 - dx / halfW / 2;
    this.camera = clampCamera(
      { ...this.camera, centerX: this.camera.centerX - tileDx, centerY: this.camera.centerY - tileDy },
      MAP_SIZE,
    );
    this.requestRender();
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (!this.dragging) return;
    this.dragging = false;
    this.canvas.style.cursor = "grab";
    if (this.pointerId != null && this.canvas.hasPointerCapture?.(this.pointerId)) {
      this.canvas.releasePointerCapture?.(this.pointerId);
    }
    this.pointerId = null;
    this.dragLast = null;
    if (this.dragMoved < 6) {
      const rect = this.canvas.getBoundingClientRect();
      const tile = tileAtScreen(
        { x: ev.clientX - rect.left, y: ev.clientY - rect.top },
        this.camera,
        this.size(),
      );
      if (tile.x >= 0 && tile.y >= 0 && tile.x < MAP_SIZE && tile.y < MAP_SIZE) {
        void this.selectTile(tile.x, tile.y);
      }
    }
    this.scheduleFetch();
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const size = this.size();
    const next = ev.deltaY < 0 ? MAX_ZOOM : MIN_ZOOM;
    this.camera = clampCamera(
      zoomAround(this.camera, { x: ev.clientX - rect.left, y: ev.clientY - rect.top }, size, next),
      MAP_SIZE,
    );
    this.requestRender();
    this.scheduleFetch();
  };

  private scheduleFetch(delay = FETCH_DELAY_MS): void {
    if (!this.opened) return;
    if (this.fetchTimer != null) window.clearTimeout(this.fetchTimer);
    this.fetchTimer = window.setTimeout(() => {
      this.fetchTimer = null;
      void this.fetchViewport();
    }, delay);
  }

  private async fetchViewport(): Promise<void> {
    const gateway = this.deps.gateway();
    if (!this.opened || !gateway) return;
    const generation = ++this.fetchGeneration;
    const radius = fetchRadius(this.camera, this.size());
    try {
      const reply = (await gateway.getWorldViewport(
        Math.round(this.camera.centerX),
        Math.round(this.camera.centerY),
        radius.x,
        radius.y,
      )) as { tiles?: Tile[]; marches?: MarchLine[]; provinces?: Province[] };
      if (!this.opened || generation !== this.fetchGeneration) return;
      if (this.tiles.size > 20000) this.tiles.clear();
      for (const tile of reply.tiles ?? []) this.tiles.set(`${tile.x}:${tile.y}`, tile);
      this.marches = reply.marches ?? [];
      this.kickMarchAnimationTick();
      if (reply.provinces?.length) {
        this.provinces = reply.provinces;
        this.fillProvinceSelect();
      }
      this.setStatus(
        `${terrainLabel(this.tiles.get(`${Math.round(this.camera.centerX)}:${Math.round(this.camera.centerY)}`)?.terrain ?? -1)} · 中心 (${Math.round(this.camera.centerX)}, ${Math.round(this.camera.centerY)}) · 已载入 ${this.tiles.size} 格 · 行军 ${this.marches.length} 条`,
      );
      this.requestRender();
    } catch (error) {
      if (generation === this.fetchGeneration) {
        this.setStatus(`世界视口加载失败：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private fillProvinceSelect(): void {
    if (this.provinceSelect.options.length > 1) return;
    for (const province of this.provinces) {
      const option = document.createElement("option");
      option.value = String(province.province_id);
      option.textContent = province.name;
      this.provinceSelect.appendChild(option);
    }
    this.provinceSelect.addEventListener("change", this.onProvinceChange);
  }

  private async refreshSpecialCities(): Promise<void> {
    const gateway = this.deps.gateway();
    if (!gateway) return;
    try {
      const res = (await gateway.listSpecialCities()) as { cities?: Record<string, unknown>[] };
      this.specialCities = (res.cities ?? []).map((row) => ({
        city_cfg_id: Number(row.city_cfg_id ?? 0),
        city_type: Number(row.city_type ?? 1),
        name: String(row.name ?? "名城"),
        x: Number(row.x ?? 0),
        y: Number(row.y ?? 0),
        owner_guild_id: Number(row.owner_guild_id ?? 0),
        owner_guild_name: String(row.owner_guild_name ?? ""),
        garrison: Number(row.garrison ?? 0),
        hero_name: String(row.hero_name ?? ""),
        unit_name: String(row.unit_name ?? ""),
        min_phase: Number(row.min_phase ?? 1),
        locked: Boolean(row.locked),
        lock_reason: String(row.lock_reason ?? ""),
      }));
      this.requestRender();
    } catch {
      /* markers are optional; the hall panel remains authoritative */
    }
  }

  private specialCityAt(x: number, y: number): SpecialCityMarker | undefined {
    return this.specialCities.find((city) => city.x === x && city.y === y);
  }

  private async selectTile(x: number, y: number): Promise<void> {
    this.selected = { x, y };
    this.requestRender();
    const special = this.specialCityAt(x, y);
    if (special) {
      this.showSpecialCityDetail(special);
      return;
    }
    const gateway = this.deps.gateway();
    if (!gateway) return;
    try {
      const detail = (await gateway.getWorldTileDetail(x, y)) as TileDetail;
      if (this.selected?.x !== x || this.selected?.y !== y) return;
      this.showDetail(detail);
    } catch (error) {
      this.setStatus(`格点详情加载失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private showSpecialCityDetail(city: SpecialCityMarker): void {
    const types = ["", "县城", "郡城", "州城", "都城"];
    const owner = city.owner_guild_id > 0 ? (city.owner_guild_name || `盟#${city.owner_guild_id}`) : "中立";
    const elite = city.unit_name ? ` · 精锐 ${city.unit_name}` : "";
    this.detail.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <strong style="color:#ffe1a0">${types[city.city_type] ?? "名城"} · ${city.name}</strong>
        <button type="button" data-action="world-map-detail-close" style="background:none;border:none;color:#c8b795;cursor:pointer;">×</button>
      </div>
      <p>坐标 (${city.x}, ${city.y}) · 归属：${owner}</p>
      <p>守军 ${city.garrison} · 守将 ${city.hero_name || "未知"}${elite}</p>
      <p style="color:#e8a87c">名城国战：胜利后由攻方联盟占领并解锁地域精锐。</p>
      ${city.locked
        ? `<p style="color:#e8a87c">${city.lock_reason || `需世界阶段 ${city.min_phase}`}</p>`
        : `<button type="button" data-action="world-map-march" style="width:100%;margin-top:6px;background:#6a4f2a;color:#f4e6c8;border:1px solid #a07c46;border-radius:4px;padding:4px;">出征名城 (${city.x}, ${city.y})</button>`}
    `;
    this.detail.classList.remove("hidden");
    const close = this.detail.querySelector('[data-action="world-map-detail-close"]');
    close?.addEventListener("click", () => this.hideDetail());
  }

  private renderTileActionButton(spec: WorldMapTileActionSpec, tileX: number, tileY: number): string {
    const dataAction = worldMapActionDataAction(spec.kind);
    const purpose =
      spec.marchPurpose != null ? ` data-march-purpose="${spec.marchPurpose}"` : "";
    const className =
      spec.variant === "primary"
        ? "world-map-detail-btn world-map-detail-btn--primary art-btn-primary art-btn-primary-full"
        : "world-map-detail-btn world-map-detail-btn--secondary";
    return `<button type="button" class="${className}" data-action="${dataAction}"${purpose}>${spec.label}</button>`;
  }

  private showDetail(detail: TileDetail): void {
    const tile = detail.tile;
    const viewer = this.deps.getSession()?.player.player_id ?? 0;
    const owner =
      tile.owner_city_id > 0
        ? `${tile.owner_name || "未知领主"}${tile.owner_player_id === viewer ? "（己方）" : ""} · ${tile.owner_city_id}`
        : "无主";
    const npc = tile.npc_kind === 1 ? "黄巾营寨" : "普通野地";
    const ownCity = tile.owner_player_id === viewer && tile.owner_city_id > 0;
    const { primary, secondary } = buildWorldMapTileActionSpecs(detail.actions ?? [], {
      ownCity,
      npcHuangjin: tile.npc_kind === 1,
    });
    const secondaryHtml = secondary
      .map((spec) => this.renderTileActionButton(spec, tile.x, tile.y))
      .join("");
    this.detail.innerHTML = `
      <div class="world-map-detail-head">
        <strong>${terrainLabel(tile.terrain)} Lv${tile.level}</strong>
        <button type="button" class="world-map-detail-close" data-action="world-map-detail-close" aria-label="关闭">×</button>
      </div>
      <p class="world-map-detail-meta">坐标 (${tile.x}, ${tile.y}) · ${tile.province_name || `州郡 ${tile.province_id}`}</p>
      <p class="world-map-detail-meta">${npc} · 归属：${owner}</p>
      <p class="world-map-detail-meta">守军档位 ${detail.garrison_tier} · 产量加成 ${detail.resource_bonus_percent}% · 距主城 ${detail.distance_from_capital}</p>
      ${tile.npc_kind === 1 ? '<p class="world-map-detail-tip">黄巾营寨：主操作为出征讨伐，亦可先侦察。</p>' : ""}
      <div class="world-map-detail-actions">
        ${this.renderTileActionButton(primary, tile.x, tile.y)}
        ${secondaryHtml ? `<div class="world-map-detail-actions-secondary">${secondaryHtml}</div>` : ""}
      </div>
    `;
    this.detail.classList.remove("hidden");
    const close = this.detail.querySelector('[data-action="world-map-detail-close"]');
    close?.addEventListener("click", () => this.hideDetail());
  }

  private hideDetail(): void {
    this.detail.classList.add("hidden");
    this.detail.innerHTML = "";
  }

  private setStatus(message: string): void {
    this.statusEl.textContent = message;
  }

  private requestRender(): void {
    if (this.renderQueued || !this.opened) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private startMarchAnimationLoop(): void {
    this.kickMarchAnimationTick();
  }

  private kickMarchAnimationTick(): void {
    if (!this.opened || this.marchAnimFrame) return;
    this.marchAnimFrame = requestAnimationFrame(() => {
      this.marchAnimFrame = 0;
      if (!this.opened) return;
      if (worldMapMarchNeedsAnimation(this.marches, Date.now())) {
        this.requestRender();
        this.kickMarchAnimationTick();
      }
    });
  }

  private stopMarchAnimationLoop(): void {
    if (this.marchAnimFrame) {
      cancelAnimationFrame(this.marchAnimFrame);
      this.marchAnimFrame = 0;
    }
  }

  private render(): void {
    if (!this.opened) return;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    const size = this.size();
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.fillStyle = "#101a14";
    ctx.fillRect(0, 0, size.width, size.height);

    const coords = this.layer.querySelector('[data-role="world-map-coords"]');
    if (coords) {
      coords.textContent = `中心 (${Math.round(this.camera.centerX)}, ${Math.round(this.camera.centerY)}) · ${this.camera.zoom}×`;
    }

    const bounds = visibleTileBounds(this.camera, size, 2);
    const minX = Math.max(0, bounds.minX);
    const minY = Math.max(0, bounds.minY);
    const maxX = Math.min(MAP_SIZE - 1, bounds.maxX);
    const maxY = Math.min(MAP_SIZE - 1, bounds.maxY);
    const halfW = 32 * this.camera.zoom;
    const halfH = 16 * this.camera.zoom;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = this.tiles.get(`${x}:${y}`);
        if (!tile) continue;
        const point = projectTile(x, y, this.camera, size);
        if (point.x < -halfW || point.x > size.width + halfW || point.y < -halfH || point.y > size.height + halfH * 3) continue;
        // The flat fill runs underneath the texture so antialiased diamond
        // edges never expose the dark canvas background between tiles.
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - halfH);
        ctx.lineTo(point.x + halfW, point.y);
        ctx.lineTo(point.x, point.y + halfH);
        ctx.lineTo(point.x - halfW, point.y);
        ctx.closePath();
        ctx.fillStyle = terrainFill(tile.terrain);
        ctx.fill();
        const textured = this.drawAsset(
          ctx,
          worldTileAssetId(tile.terrain),
          point.x - halfW,
          point.y - halfH,
          halfW * 2,
          halfH * 2,
        );
        if (!textured) {
          ctx.strokeStyle = "rgba(0,0,0,0.18)";
          ctx.stroke();
        }
        if (this.selected && this.selected.x === x && this.selected.y === y) {
          ctx.beginPath();
          ctx.moveTo(point.x, point.y - halfH);
          ctx.lineTo(point.x + halfW, point.y);
          ctx.lineTo(point.x, point.y + halfH);
          ctx.lineTo(point.x - halfW, point.y);
          ctx.closePath();
          ctx.strokeStyle = "#fff3c4";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        this.decorateTile(ctx, tile, point, halfW, halfH);
      }
    }

    this.drawSpecialCities(ctx, size);
    this.drawMarches(ctx, size);
  }

  private drawSpecialCities(ctx: CanvasRenderingContext2D, size: ViewportSize): void {
    if (this.specialCities.length === 0) return;
    ctx.textAlign = "center";
    for (const city of this.specialCities) {
      if (city.x < 0 || city.y < 0 || city.x >= MAP_SIZE || city.y >= MAP_SIZE) continue;
      const point = projectTile(city.x, city.y, this.camera, size);
      if (point.x < -80 || point.x > size.width + 80 || point.y < -80 || point.y > size.height + 80) continue;
      const drawn = this.drawAssetAt(ctx, worldSpecialCityLandmarkAssetId(city.city_cfg_id, city.city_type), point.x, point.y, this.camera.zoom * 0.62);
      if (!drawn) {
        ctx.fillStyle = "#e0b34a";
        ctx.beginPath();
        ctx.arc(point.x, point.y - 8, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      const label = city.locked ? `${city.name.slice(0, 5)}🔒` : city.name.slice(0, 6);
      ctx.font = "bold 11px system-ui, sans-serif";
      const width = (ctx.measureText?.(label).width ?? label.length * 8) + 10;
      ctx.fillStyle = "rgba(26,16,8,0.88)";
      ctx.fillRect(point.x - width / 2, point.y - 44, width, 15);
      ctx.fillStyle = "#ffe1a0";
      ctx.fillText(label, point.x, point.y - 33);
      if (city.owner_guild_id > 0) {
        const owner = city.owner_guild_name || `盟#${city.owner_guild_id}`;
        ctx.font = "9px system-ui, sans-serif";
        const ow = (ctx.measureText?.(owner).width ?? owner.length * 6) + 8;
        ctx.fillStyle = "rgba(60,20,18,0.88)";
        ctx.fillRect(point.x - ow / 2, point.y - 27, ow, 12);
        ctx.fillStyle = "#ffc7a8";
        ctx.fillText(owner, point.x, point.y - 18);
      }
    }
  }

  private decorateTile(
    ctx: CanvasRenderingContext2D,
    tile: Tile,
    point: { x: number; y: number },
    halfW: number,
    halfH: number,
  ): void {
    if (tile.terrain === 0 || tile.owner_city_id > 0) {
      const city = tile.terrain === 0;
      const spriteScale = this.camera.zoom * 0.5;
      const cityDrawn = city
        ? this.drawAssetAt(
            ctx,
            worldCityAssetId(tile.city_level || tile.level),
            point.x,
            point.y + halfH * 0.6,
            spriteScale,
          )
        : false;
      if (!cityDrawn) {
        ctx.strokeStyle = city ? "#ffd166" : "#9ad0f5";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - halfH);
        ctx.lineTo(point.x + halfW, point.y);
        ctx.lineTo(point.x, point.y + halfH);
        ctx.lineTo(point.x - halfW, point.y);
        ctx.closePath();
        ctx.stroke();
        ctx.lineWidth = 1;
      }
      if (!city) {
        const resource = worldResourceAssetId(tile.terrain);
        if (resource) {
          this.drawAssetAt(ctx, resource, point.x - halfW * 0.4, point.y + halfH * 0.5, spriteScale);
        }
      }
      const viewer = this.deps.getSession()?.player?.player_id ?? 0;
      this.drawAssetAt(
        ctx,
        worldFlagAssetId(tile.owner_player_id, viewer),
        point.x + halfW * 0.7,
        point.y + halfH * 0.3,
        spriteScale * (city ? 0.55 : 0.7),
      );
      const label = (tile.owner_name || (city ? "城" : "野地")).slice(0, 5);
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "center";
      const width = (ctx.measureText?.(label).width ?? label.length * 7) + 8;
      ctx.fillStyle = "rgba(20,14,8,0.82)";
      ctx.fillRect(point.x - width / 2, point.y - halfH - 15, width, 14);
      ctx.fillStyle = city ? "#ffe9a8" : "#bfe4ff";
      ctx.fillText(label, point.x, point.y - halfH - 4);
      return;
    }
    if (tile.npc_kind === 1) {
      const drawn = this.drawAssetAt(
        ctx,
        "world.obj.huangjin.v1",
        point.x,
        point.y + halfH * 0.55,
        this.camera.zoom * 0.5,
      );
      if (!drawn) {
        ctx.fillStyle = "#c0392b";
        ctx.beginPath();
        ctx.moveTo(point.x, point.y - halfH - 12);
        ctx.lineTo(point.x + 6, point.y - halfH - 2);
        ctx.lineTo(point.x - 6, point.y - halfH - 2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#f4e6c8";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("黄巾", point.x, point.y + 3);
      ctx.fillStyle = "rgba(20,16,10,0.65)";
      ctx.fillText(`Lv${tile.level}`, point.x, point.y + 14);
      return;
    }

    const session = this.deps.getSession();
    const isOwnCapital =
      session &&
      tile.x === session.cityX &&
      tile.y === session.cityY;
    if (isOwnCapital) {
      ctx.strokeStyle = "#ffe566";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y - halfH);
      ctx.lineTo(point.x + halfW, point.y);
      ctx.lineTo(point.x, point.y + halfH);
      ctx.lineTo(point.x - halfW, point.y);
      ctx.closePath();
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.fillStyle = "rgba(255, 230, 140, 0.92)";
      ctx.font = "bold 10px system-ui, sans-serif";
      ctx.fillText("主城", point.x, point.y - halfH - 6);
    }
    const minLevelLabel =
      this.camera.zoom >= MAX_ZOOM ? 1 : this.camera.zoom >= 1.5 ? 6 : 9;
    const selectedHere =
      this.selected?.x === tile.x && this.selected?.y === tile.y;
    if (tile.level >= minLevelLabel || selectedHere) {
      ctx.fillStyle = tile.level >= 8 ? "#f4e6c8" : "rgba(232, 220, 200, 0.55)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Lv${tile.level}`, point.x, point.y + halfH - 4);
    }
    if (tile.max_level > tile.level) {
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.beginPath();
      ctx.arc(point.x + halfW * 0.55, point.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Draws one registered world texture at an exact rectangle. */
  private drawAsset(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ): boolean {
    const art = this.deps.assets?.getImageForAsset(assetId);
    if (!art) return false;
    ctx.drawImage(art.img, x, y, w, h);
    return true;
  }

  /** Draws one sprite at its manifest anchor, scaled by the camera. */
  private drawAssetAt(
    ctx: CanvasRenderingContext2D,
    assetId: string,
    x: number,
    y: number,
    scale: number,
  ): boolean {
    const art = this.deps.assets?.getImageForAsset(assetId);
    if (!art) return false;
    const meta = art.meta;
    const w = meta.display_size.w * scale;
    const h = meta.display_size.h * scale;
    const ax = meta.display_size.w > 0 ? meta.anchor.x / meta.display_size.w : 0.5;
    const ay = meta.display_size.h > 0 ? meta.anchor.y / meta.display_size.h : 0.5;
    ctx.drawImage(art.img, x - w * ax, y - h * ay, w, h);
    return true;
  }

  private drawMarches(ctx: CanvasRenderingContext2D, size: { width: number; height: number }): void {
    if (!this.marches.length) return;
    const nowMs = Date.now();
    const dashOffset = (nowMs / 40) % 16;
    ctx.save();
    ctx.lineWidth = 2;
    for (const march of this.marches) {
      const from = projectTile(march.from_x, march.from_y, this.camera, size);
      const to = projectTile(march.to_x, march.to_y, this.camera, size);
      const interp = marchInterpolatedTile(march, nowMs);
      const marker = projectTile(interp.x, interp.y, this.camera, size);
      ctx.strokeStyle = "rgba(255, 209, 102, 0.85)";
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -dashOffset;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      if (interp.moving) {
        ctx.strokeStyle = "#fff3c4";
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = dashOffset;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(marker.x, marker.y);
        ctx.stroke();
      }
      const phase = march.phase ?? 2;
      this.drawAssetAt(ctx, worldMarchAssetId(phase), marker.x, marker.y + 6, this.camera.zoom * 0.52);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const angle = Math.atan2(dy, dx);
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(marker.x + 10 * Math.cos(angle), marker.y + 10 * Math.sin(angle));
      ctx.lineTo(marker.x + 6 * Math.cos(angle + 2.6), marker.y + 6 * Math.sin(angle + 2.6));
      ctx.lineTo(marker.x + 6 * Math.cos(angle - 2.6), marker.y + 6 * Math.sin(angle - 2.6));
      ctx.closePath();
      ctx.fill();
      if (interp.remainingSec != null && interp.moving) {
        ctx.font = "11px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe8b0";
        const mins = Math.floor(interp.remainingSec / 60);
        const secs = interp.remainingSec % 60;
        ctx.fillText(
          `${mins}:${String(secs).padStart(2, "0")}`,
          marker.x,
          marker.y - 14,
        );
      }
    }
    ctx.restore();
  }
}
