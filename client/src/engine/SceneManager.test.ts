import { describe, expect, it, vi } from "vitest";
import { AssetLoader } from "@/engine/AssetLoader";
import { computeLayoutViewport } from "@/engine/layoutViewport";
import { LAYOUT_FRAME } from "@/engine/mainCitySlots";
import { SceneManager, type Scene } from "@/engine/SceneManager";
describe("SceneManager", () => {
  it("switches scenes and calls enter/leave", async () => {
    const mgr = new SceneManager();
    const order: string[] = [];
    const a: Scene = {
      name: "a",
      enter: async () => {
        order.push("enter-a");
      },
      leave: () => order.push("leave-a"),
    };
    const b: Scene = {
      name: "b",
      enter: async () => {
        order.push("enter-b");
      },
      leave: () => order.push("leave-b"),
    };
    mgr.register(a);
    mgr.register(b);
    const canvas = document.createElement("canvas");
    const hud = document.createElement("div");
    const layoutFrame = document.createElement("div");
    const ctx = {
      canvas,
      hud,
      layoutFrame,
      gateway: {
        connect: async () => {},
        register: async () => ({}),
        login: async () => ({}),
        listPlayerCities: async () => ({}),
        createCity: async () => ({}),
        getCityState: async () => ({}),
        startBuildingUpgrade: async () => ({}),
        close: () => {},
        getSessionId: () => "",
      },
      assets: new AssetLoader(),
      getViewport: () => computeLayoutViewport(LAYOUT_FRAME.w, LAYOUT_FRAME.h),
      switchScene: vi.fn(),
    };
    await mgr.switch("a", ctx);
    await mgr.switch("b", ctx);
    expect(order).toEqual(["enter-a", "leave-a", "enter-b"]);
  });
});
