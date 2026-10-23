import { AssetLoader } from "@/engine/AssetLoader";
import { applyLayoutFrameStyles, computeLayoutViewport } from "@/engine/layoutViewport";
import { LAYOUT_FRAME } from "@/engine/mainCitySlots";
import { SceneManager } from "@/engine/SceneManager";
import { GatewayClient } from "@/net/GatewayClient";
import { ServerSelectScene } from "@/scenes/ServerSelectScene";
import { MainCityScene } from "@/scenes/MainCityScene";

export class GameApp {
  private readonly scenes = new SceneManager();
  private readonly assets = new AssetLoader();
  private readonly gateway = new GatewayClient();
  private raf = 0;
  private last = 0;
  private viewport = computeLayoutViewport(LAYOUT_FRAME.w, LAYOUT_FRAME.h);
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly viewportRoot: HTMLElement,
    private readonly layoutFrame: HTMLElement,
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
  ) {
    this.scenes.register(new ServerSelectScene());
    this.scenes.register(new MainCityScene());
  }

  getLayoutViewport() {
    return this.viewport;
  }

  private syncCanvasSize(): void {
    const rect = this.viewportRoot.getBoundingClientRect();
    this.viewport = computeLayoutViewport(rect.width, rect.height);
    applyLayoutFrameStyles(this.layoutFrame, this.viewport);

    const dpr = window.devicePixelRatio || 1;
    const frameRect = this.layoutFrame.getBoundingClientRect();
    const w = Math.max(1, Math.floor(frameRect.width * dpr));
    const h = Math.max(1, Math.floor(frameRect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.viewport = computeLayoutViewport(frameRect.width, frameRect.height);
  }

  async start(): Promise<void> {
    this.hud.textContent = "加载资源…";
    this.syncCanvasSize();
    this.resizeObserver = new ResizeObserver(() => this.syncCanvasSize());
    this.resizeObserver.observe(this.viewportRoot);
    await this.assets.loadAll(window.devicePixelRatio || 1);
    const ctx = {
      canvas: this.canvas,
      hud: this.hud,
      layoutFrame: this.layoutFrame,
      gateway: this.gateway,
      assets: this.assets,
      getViewport: () => this.viewport,
      switchScene: async (_n: string, _d?: unknown) => {},
    };
    await this.scenes.switch("serverSelect", ctx);
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = (now - this.last) / 1000;
      this.last = now;
      this.syncCanvasSize();
      this.scenes.update(dt);
      const c2d = this.canvas.getContext("2d");
      if (c2d) {
        c2d.setTransform(1, 0, 0, 1, 0, 0);
        c2d.fillStyle = "#1a1410";
        c2d.fillRect(0, 0, this.canvas.width, this.canvas.height);
        const dpr = window.devicePixelRatio || 1;
        c2d.scale(dpr, dpr);
        this.scenes.draw(c2d);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.gateway.close();
  }
}
