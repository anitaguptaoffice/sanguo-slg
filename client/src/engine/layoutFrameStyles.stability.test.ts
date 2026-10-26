import { afterEach, describe, expect, it, vi } from "vitest";
import { applyLayoutFrameStyles, computeLayoutViewport } from "./layoutViewport";

vi.mock("./AssetLoader", () => ({ AssetLoader: class { loadAll = async () => {}; } }));
vi.mock("@/scenes/MainCityScene", () => ({ MainCityScene: class { name = "mainCity"; enter = async () => {}; leave() {} } }));
vi.mock("@/scenes/ServerSelectScene", () => ({ ServerSelectScene: class { name = "serverSelect"; enter = async () => {}; leave() {} } }));
vi.mock("@/net/GatewayClient", () => ({ GatewayClient: class { close() {} } }));
import { GameApp } from "./GameApp";

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("CLT-LAYOUT-IDEMPOTENT-001 frame styles", () => {
  it("performs no style mutation for unchanged frame inputs", () => {
    const frame = document.createElement("div"); const viewport = computeLayoutViewport(1280, 720);
    applyLayoutFrameStyles(frame, viewport);
    const writeScale = vi.spyOn(frame.style, "setProperty");
    const observer = new MutationObserver(() => {}); observer.observe(frame, { attributes: true });
    for (let i = 0; i < 600; i++) applyLayoutFrameStyles(frame, { ...viewport });
    expect(writeScale).not.toHaveBeenCalled();
    expect(observer.takeRecords()).toEqual([]); observer.disconnect();
  });
  it("applies changed letterboxing/scale and repairs externally changed styles", () => {
    const frame = document.createElement("div"); applyLayoutFrameStyles(frame, computeLayoutViewport(1280, 720));
    applyLayoutFrameStyles(frame, computeLayoutViewport(1000, 1000));
    expect([frame.style.width, frame.style.height, frame.style.left, frame.style.top]).toEqual(["1000px", "562.5px", "0px", "218.75px"]);
    expect(frame.style.getPropertyValue("--ui-scale")).toBe("0.625");
    frame.style.width = "1px"; frame.style.setProperty("--ui-scale", "2");
    applyLayoutFrameStyles(frame, computeLayoutViewport(1000, 1000));
    expect(frame.style.width).toBe("1000px"); expect(frame.style.getPropertyValue("--ui-scale")).toBe("0.625");
  });
  it("keeps ResizeObserver, animation-frame DPR changes and narrow-mode transitions live", async () => {
    let tick: FrameRequestCallback = () => {}; let resize: ResizeObserverCallback = () => {};
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { tick = callback; return 1; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { constructor(callback: ResizeObserverCallback) { resize = callback; } observe() {} disconnect = disconnect; });
    vi.stubGlobal("devicePixelRatio", 1);
    const root = document.createElement("div"), frame = document.createElement("div"), hud = document.createElement("div"), canvas = document.createElement("canvas");
    root.append(frame); frame.append(canvas, hud); document.body.append(root);
    let width = 1280, height = 720;
    vi.spyOn(root, "getBoundingClientRect").mockImplementation(() => ({ width, height } as DOMRect));
    vi.spyOn(frame, "getBoundingClientRect").mockImplementation(() => ({ width: parseFloat(frame.style.width), height: parseFloat(frame.style.height) } as DOMRect));
    vi.spyOn(canvas, "getContext").mockReturnValue(null);
    const app = new GameApp(root, frame, canvas, hud); await app.start();
    expect([canvas.width, canvas.height]).toEqual([1280, 720]); expect(frame.classList.contains("layout-narrow")).toBe(true);
    vi.stubGlobal("devicePixelRatio", 2); tick(performance.now() + 16);
    expect([canvas.width, canvas.height]).toEqual([2560, 1440]);
    width = 1600; height = 900; resize([], {} as ResizeObserver);
    expect([canvas.width, canvas.height]).toEqual([3200, 1800]); expect(frame.classList.contains("layout-narrow")).toBe(false);
    width = 1000; height = 1000; tick(performance.now() + 32);
    expect(frame.style.top).toBe("218.75px"); expect(frame.classList.contains("layout-narrow")).toBe(true);
    expect(app.getLayoutViewport().uiScale).toBe(0.625);
    app.destroy(); expect(disconnect).toHaveBeenCalledOnce();
  });
});
