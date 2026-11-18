import { afterEach, expect, it, vi } from "vitest";
import { GameApp } from "./GameApp";
import { GatewayClient } from "@/net/GatewayClient";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it.each([true, false])("uses the real server-selection startup with an optional stall (%s)", async (requiredLoads) => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const imageAsset = (id: string, path: string) => ({
    id, kind: "icon", variants: [{ scale: 1, path }],
    display_size: { w: 32, h: 32 }, anchor: { x: 0, y: 0 },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      assets: [imageAsset("item.icon.2001.v1", "optional.png"), imageAsset("ui.panel.default.v1", "required.png")],
    }),
  }));
  let failRequired: (() => void) | undefined;
  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    removeAttribute() {}
    set src(url: string) {
      if (!url.endsWith("/required.png")) return;
      if (requiredLoads) queueMicrotask(() => this.onload?.());
      else failRequired = () => this.onerror?.();
    }
  });
  const connect = vi.spyOn(GatewayClient.prototype, "connect").mockResolvedValue();
  const list = vi.spyOn(GatewayClient.prototype, "listGameServers").mockResolvedValue({
    servers: [{ shard: { server_id: 1, status: 1, display_name: "Available S1" } }],
  });
  const mutations = (["login", "register", "enterGameServer", "createCity"] as const)
    .map((method) => vi.spyOn(GatewayClient.prototype, method));
  const root = document.createElement("div");
  const frame = document.createElement("div");
  const canvas = document.createElement("canvas");
  const hud = document.createElement("div");
  root.append(frame);
  frame.append(canvas, hud);
  document.body.append(root);
  const app = new GameApp(root, frame, canvas, hud);
  try {
    const startup = app.start();
    await vi.advanceTimersByTimeAsync(14_999);
    expect(connect).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    if (requiredLoads) {
      expect(connect).toHaveBeenCalledOnce();
      await startup;
      expect(list).toHaveBeenCalledOnce();
      expect(frame.textContent).toContain("Available S1");
    } else {
      expect(connect).not.toHaveBeenCalled();
      expect(list).not.toHaveBeenCalled();
      expect(failRequired).toBeTypeOf("function");
      const failure = expect(startup).rejects.toThrow("failed to load art");
      failRequired?.();
      await failure;
    }
    for (const spy of mutations) expect(spy).not.toHaveBeenCalled();
  } finally {
    (app as unknown as { scenes: { current?: { leave(): void } } }).scenes.current?.leave();
    app.destroy();
  }
});
