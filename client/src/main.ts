import { GameApp } from "@/engine/GameApp";

const viewportRoot = document.getElementById("game-viewport") as HTMLElement | null;
const layoutFrame = document.getElementById("layout-frame") as HTMLElement | null;
const canvas = document.getElementById("game") as HTMLCanvasElement | null;
const hud = document.getElementById("hud") as HTMLElement | null;
if (!viewportRoot || !layoutFrame || !canvas || !hud) {
  throw new Error("missing #game-viewport, #layout-frame, #game or #hud");
}

const app = new GameApp(viewportRoot, layoutFrame, canvas, hud);
app.start().catch((e: unknown) => {
  hud.textContent = `启动失败: ${(e as Error).message}`;
  console.error(e);
});
