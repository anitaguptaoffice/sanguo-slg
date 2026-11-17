import { afterEach, expect, it, vi } from "vitest";
import { GameApp } from "./GameApp";
import { AssetLoader } from "./AssetLoader";
import { GatewayClient } from "@/net/GatewayClient";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ""; });
it("actual app reaches server selection when only optional localStorage is unavailable", async () => {
  vi.spyOn(window, "localStorage", "get").mockImplementation(() => { throw new DOMException("blocked", "SecurityError"); });
  expect(() => sessionStorage.getItem("startup-storage-control")).not.toThrow();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1)); vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.spyOn(AssetLoader.prototype, "loadAll").mockResolvedValue();
  const connect = vi.spyOn(GatewayClient.prototype, "connect").mockResolvedValue();
  const list = vi.spyOn(GatewayClient.prototype, "listGameServers").mockResolvedValue({
    servers: [{ shard: { server_id: 1, status: 1, display_name: "Available S1" } }],
  });
  const mutations = ["login", "register", "enterGameServer", "createCity"] as const;
  const sent = mutations.map(method => vi.spyOn(GatewayClient.prototype, method));
  const root = document.createElement("div"), frame = document.createElement("div"), hud = document.createElement("div");
  const canvas = document.createElement("canvas"); root.append(frame); frame.append(canvas, hud); document.body.append(root);
  let app: GameApp | undefined;
  try {
    app = new GameApp(root, frame, canvas, hud); await app.start();
    expect(connect).toHaveBeenCalledTimes(1); expect(list).toHaveBeenCalledTimes(1);
    expect(frame.textContent).toContain("Available S1");
    expect(frame.querySelector<HTMLButtonElement>('[data-action="enter-game"]')?.disabled).toBe(false);
    for (const spy of sent) expect(spy).not.toHaveBeenCalled();
  } finally {
    // Own the mounted scene's DOM listeners as well as the app's frame/network resources.
    (app as unknown as { scenes: { current?: { leave(): void } } } | undefined)?.scenes.current?.leave();
    app?.destroy();
  }
});
