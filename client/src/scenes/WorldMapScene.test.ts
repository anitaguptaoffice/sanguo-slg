import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorldMapScene } from "./WorldMapScene";
import { TILE_H, TILE_W } from "./worldMapMath";

const tile = (x: number, y: number, overrides: Record<string, unknown> = {}) => ({
  x,
  y,
  terrain: 1,
  level: 3,
  max_level: 10,
  province_id: 2,
  province_name: "冀州",
  owner_player_id: 0,
  owner_city_id: 0,
  owner_name: "",
  npc_kind: 0,
  npc_level: 0,
  in_battle: false,
  ...overrides,
});

function makeGateway() {
  return {
    getWorldViewport: vi.fn(async (cx: number, cy: number) => ({
      tiles: [
        tile(cx, cy, { terrain: 3, npc_kind: 1, npc_level: 3 }),
        tile(cx + 1, cy, { owner_city_id: 9, owner_player_id: 7, owner_name: "主城" }),
        tile(cx, cy + 1, { terrain: 6 }),
      ],
      marches: [
        { march_id: 5, from_x: cx, from_y: cy, to_x: cx + 1, to_y: cy, phase: 1, arrive_at_ms: 0, owner_player_id: 7 },
      ],
      provinces: [{ province_id: 2, name: "冀州", x: cx, y: cy }],
    })),
    getWorldTileDetail: vi.fn(async (x: number, y: number) => ({
      tile: tile(x, y, { terrain: 3, npc_kind: 1 }),
      actions: ["查看详情", "讨伐掠夺"],
      garrison_tier: 2,
      resource_bonus_percent: 8,
      distance_from_capital: 4,
    })),
  };
}

describe("WorldMapScene", () => {
  let parent: HTMLElement;
  let gateway: ReturnType<typeof makeGateway>;
  let onMarchTarget: ReturnType<typeof vi.fn>;
  let scene: WorldMapScene;
  let ctx: Record<string, unknown>;

  beforeEach(() => {
    document.body.innerHTML = "";
    parent = document.createElement("div");
    document.body.appendChild(parent);
    gateway = makeGateway();
    onMarchTarget = vi.fn();
    ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      arc: vi.fn(),
      setTransform: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      font: "",
      textAlign: "",
      measureText: (text: string) => ({ width: text.length * 7 }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    scene = new WorldMapScene(parent, {
      gateway: () => gateway as never,
      getSession: () => ({ player: { player_id: 7 }, cityX: 60, cityY: 60 }) as never,
      onMarchTarget,
    });
    scene.attach();
  });

  it("draws registered world art when the loader provides it", async () => {
    const drawImage = vi.fn();
    (ctx as Record<string, unknown>).drawImage = drawImage;
    const getImageForAsset = vi.fn((id: string) => ({
      img: { id } as unknown as HTMLImageElement,
      meta: { id, display_size: { w: 128, h: 64 }, anchor: { x: 64, y: 32 } },
      scale: 1,
    }));
    const artScene = new WorldMapScene(parent, {
      gateway: () => gateway as never,
      getSession: () => ({ player: { player_id: 7 }, cityX: 60, cityY: 60 }) as never,
      onMarchTarget,
      assets: { getImageForAsset } as never,
    });
    artScene.attach();
    artScene.open(61, 61);
    await vi.waitFor(() => expect(gateway.getWorldViewport).toHaveBeenCalled());
    await vi.waitFor(() => expect(drawImage.mock.calls.length).toBeGreaterThan(0));
    expect(getImageForAsset).toHaveBeenCalledWith("world.tile.forest.v1");
    expect(getImageForAsset).toHaveBeenCalledWith("world.obj.huangjin.v1");
    expect(getImageForAsset).toHaveBeenCalledWith("world.flag.self.v1");
    artScene.detach?.();
  });

  it("opens, fetches the viewport and lists provinces", async () => {
    scene.open(61, 61);
    expect(scene.isOpen()).toBe(true);
    await vi.waitFor(() => expect(gateway.getWorldViewport).toHaveBeenCalled());
    expect(gateway.getWorldViewport).toHaveBeenCalledWith(61, 61, expect.any(Number), expect.any(Number));
    await vi.waitFor(() => {
      const options = parent.querySelectorAll('[data-field="province"] option');
      expect(options.length).toBe(2);
      expect(options[1].textContent).toBe("冀州");
    });
  });

  it("selects a tile, shows its detail and pre-fills the march target", async () => {
    scene.open(60, 60);
    const canvas = parent.querySelector("canvas") as HTMLCanvasElement;
    Object.defineProperty(canvas, "clientWidth", { value: 1280, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 720, configurable: true });
    Object.defineProperty(canvas, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0 }),
      configurable: true,
    });
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 640, clientY: 360, pointerId: 1 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 640, clientY: 360, pointerId: 1 }));
    await vi.waitFor(() => expect(gateway.getWorldTileDetail).toHaveBeenCalledWith(60, 60));
    await vi.waitFor(() => {
      const detail = parent.querySelector('[data-role="world-map-detail"]') as HTMLElement;
      expect(detail.classList.contains("hidden")).toBe(false);
      expect(detail.textContent).toContain("森林");
      expect(detail.textContent).toContain("黄巾营寨");
    });
    (parent.querySelector('[data-action="world-map-march"]') as HTMLButtonElement).click();
    expect(onMarchTarget).toHaveBeenCalledWith(60, 60);
    expect(scene.isOpen()).toBe(false);
  });

  it("drags the camera and refetches around the new centre", async () => {
    scene.open(60, 60);
    await vi.waitFor(() => expect(gateway.getWorldViewport).toHaveBeenCalledTimes(1));
    const canvas = parent.querySelector("canvas") as HTMLCanvasElement;
    Object.defineProperty(canvas, "clientWidth", { value: 1280, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 720, configurable: true });
    canvas.dispatchEvent(new PointerEvent("pointerdown", { button: 0, clientX: 400, clientY: 300, pointerId: 2 }));
    canvas.dispatchEvent(new PointerEvent("pointermove", { button: 0, clientX: 500, clientY: 300, pointerId: 2 }));
    canvas.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 500, clientY: 300, pointerId: 2 }));
    await vi.waitFor(() => expect(gateway.getWorldViewport.mock.calls.length).toBeGreaterThan(1));
    const last = gateway.getWorldViewport.mock.calls.at(-1)!;
    expect(last[0]).not.toBe(60);
    expect(TILE_W / 2).toBe(32);
    expect(TILE_H / 2).toBe(16);
  });

  it("jumps to the home city and closes", async () => {
    scene.open(10, 10);
    (parent.querySelector('[data-action="world-map-home"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const last = gateway.getWorldViewport.mock.calls.at(-1)!;
      expect(last[0]).toBe(60);
      expect(last[1]).toBe(60);
    });
    (parent.querySelector('[data-action="world-map-close"]') as HTMLButtonElement).click();
    expect(scene.isOpen()).toBe(false);
    expect((parent.querySelector('[data-role="world-map-layer"]') as HTMLElement).classList.contains("hidden")).toBe(true);
  });
});
