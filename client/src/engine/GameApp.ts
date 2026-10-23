import { AssetLoader } from "@/engine/AssetLoader";
import { SceneManager } from "@/engine/SceneManager";
import { GatewayClient } from "@/net/GatewayClient";
import { LoginScene } from "@/scenes/LoginScene";
import { MainCityScene } from "@/scenes/MainCityScene";

export class GameApp {
  private readonly scenes = new SceneManager();
  private readonly assets = new AssetLoader();
  private readonly gateway = new GatewayClient();
  private raf = 0;
  private last = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly hud: HTMLElement,
  ) {
    this.scenes.register(new LoginScene());
    this.scenes.register(new MainCityScene());
  }

  async start(): Promise<void> {
    this.hud.textContent = "加载资源…";
    await this.assets.loadAll();
    const ctx = {
      canvas: this.canvas,
      hud: this.hud,
      gateway: this.gateway,
      assets: this.assets,
      switchScene: async (_n: string, _d?: unknown) => {},
    };
    await this.scenes.switch("login", ctx);
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = (now - this.last) / 1000;
      this.last = now;
      this.scenes.update(dt);
      const c2d = this.canvas.getContext("2d");
      if (c2d) {
        c2d.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.scenes.draw(c2d);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.gateway.close();
  }
}
