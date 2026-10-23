import type { Scene, SceneContext } from "@/engine/SceneManager";

export class LoginScene implements Scene {
  readonly name = "login";
  private hud!: HTMLElement;

  async enter(ctx: SceneContext): Promise<void> {
    this.hud = ctx.hud;
    this.hud.textContent = "连接网关…";
    await ctx.gateway.connect();
    this.hud.textContent = "登录中（demo / demo123）…";
    try {
      const res = await ctx.gateway.login("demo", "demo123", 1);
      await ctx.switchScene("mainCity", res);
    } catch (e) {
      this.hud.textContent = `登录失败: ${(e as Error).message}`;
    }
  }

  leave(): void {}
}
