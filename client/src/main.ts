import { GameApp } from "@/engine/GameApp";

const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hud = document.getElementById("hud") as HTMLElement | null;
if (!canvas || !hud) throw new Error("missing #game or #hud");

const app = new GameApp(canvas, hud);
app.start().catch((e: unknown) => {
  hud.textContent = `启动失败: ${(e as Error).message}`;
  console.error(e);
});
