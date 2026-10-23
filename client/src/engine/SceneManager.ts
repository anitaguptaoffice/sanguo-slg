export interface Scene {
  readonly name: string;
  enter(ctx: SceneContext, data?: unknown): Promise<void>;
  leave(): void;
  update?(dt: number): void;
  draw?(ctx: CanvasRenderingContext2D): void;
}

export type SceneContext = {
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  switchScene: (name: string, data?: unknown) => Promise<void>;
  gateway: import("@/net/GatewayClient").GatewayPort;
  assets: import("@/engine/AssetLoader").AssetLoader;
};

export class SceneManager {
  private scenes = new Map<string, Scene>();
  private current: Scene | null = null;

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
  }

  async switch(name: string, ctx: SceneContext, data?: unknown): Promise<void> {
    const next = this.scenes.get(name);
    if (!next) throw new Error(`unknown scene: ${name}`);
    this.current?.leave();
    this.current = next;
    const bound: SceneContext = {
      ...ctx,
      switchScene: (n, d) => this.switch(n, ctx, d),
    };
    await next.enter(bound, data);
  }

  update(dt: number): void {
    this.current?.update?.(dt);
  }

  draw(c2d: CanvasRenderingContext2D): void {
    this.current?.draw?.(c2d);
  }
}
