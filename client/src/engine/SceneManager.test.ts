import { describe, expect, it, vi } from "vitest";
import { AssetLoader } from "@/engine/AssetLoader";
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
    const ctx = {
      canvas,
      hud,
      gateway: { connect: async () => {}, login: async () => ({}), close: () => {}, getSessionId: () => "" },
      assets: new AssetLoader(),
      switchScene: vi.fn(),
    };
    await mgr.switch("a", ctx);
    await mgr.switch("b", ctx);
    expect(order).toEqual(["enter-a", "leave-a", "enter-b"]);
  });
});
