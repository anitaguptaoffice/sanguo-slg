import type { Scene, SceneContext } from "@/engine/SceneManager";
import { bootstrapMainCity } from "@/net/bootstrapSession";

const DEFAULT_LOGIN = "demo";
const DEFAULT_PASSWORD = "demo123";
const DEFAULT_SERVER = 1;

export class LoginScene implements Scene {
  readonly name = "login";
  private hud!: HTMLElement;

  async enter(ctx: SceneContext): Promise<void> {
    this.hud = ctx.hud;
    this.hud.textContent = "连接网关…";
    try {
      await ctx.gateway.connect();
      this.hud.textContent = `登录中（${DEFAULT_LOGIN}）…`;
      const session = await bootstrapMainCity(
        ctx.gateway,
        DEFAULT_LOGIN,
        DEFAULT_PASSWORD,
        DEFAULT_SERVER,
      );
      await ctx.switchScene("mainCity", session);
    } catch (e) {
      this.hud.textContent = `登录失败: ${(e as Error).message}`;
    }
  }

  leave(): void {}
}
