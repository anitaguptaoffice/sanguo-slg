import type { Scene, SceneContext } from "@/engine/SceneManager";

type LoginPayload = {
  session_id: string;
  player?: { display_name?: string; level?: number; power?: number };
  wallet?: { food?: number; wood?: number; gold?: number };
};

export class MainCityScene implements Scene {
  readonly name = "mainCity";
  private data: LoginPayload | null = null;
  private hud!: HTMLElement;

  async enter(ctx: SceneContext, data?: unknown): Promise<void> {
    this.data = (data as LoginPayload) ?? null;
    this.hud = ctx.hud;
    const p = this.data?.player;
    const w = this.data?.wallet;
    this.hud.textContent = `主城 · ${p?.display_name ?? "君主"} Lv${p?.level ?? 1} · 粮 ${w?.food ?? 0}`;
  }

  leave(): void {}

  draw(c2d: CanvasRenderingContext2D): void {
    const w = c2d.canvas.width;
    const h = c2d.canvas.height;
    c2d.fillStyle = "#3d5c3a";
    c2d.fillRect(0, 0, w, h);
    c2d.fillStyle = "#5c4a32";
    c2d.fillRect(16, h - 120, w - 32, 96);
    c2d.fillStyle = "#f5e6c8";
    c2d.font = "18px system-ui";
    c2d.fillText("主城（占位美术）", 24, h - 72);
    c2d.font = "13px system-ui";
    c2d.fillStyle = "#c9b896";
    const p = this.data?.player;
    c2d.fillText(`战力 ${p?.power ?? 0}`, 24, h - 48);
  }
}
