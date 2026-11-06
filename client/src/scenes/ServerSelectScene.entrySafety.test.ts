import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import type { SceneContext } from "@/engine/SceneManager";
import { bootstrapMainCity } from "@/net/bootstrapSession";
vi.mock("@/net/bootstrapSession", () => ({ bootstrapMainCity: vi.fn() }));
vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const deferred = <T,>() => {
  let resolve!: (value: T) => void; let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const rows = (...pairs: [number, number][]) => ({ servers: pairs.map(([server_id, status]) => ({ shard: { server_id, status, display_name: `S${server_id}` } })) });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  const layoutFrame = document.createElement("div"), hud = document.createElement("div");
  document.body.append(layoutFrame, hud);
  const gateway = { connect: vi.fn(async () => {}), listGameServers: vi.fn(async () => rows([1, 1], [2, 2])) };
  const ctx = { layoutFrame, hud, canvas: document.createElement("canvas"), gateway, assets: {}, switchScene: vi.fn(async () => {}), getViewport: vi.fn() } as unknown as SceneContext;
  const button = (action: string) => layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const select = (id: number) => layoutFrame.querySelector<HTMLElement>(`[data-server-id="${id}"]`)!.click();
  const selected = () => layoutFrame.querySelector<HTMLElement>("li.selected")?.dataset.serverId;
  return { scene, ctx, gateway, button, select, selected, layoutFrame };
}
afterEach(() => { scenes.splice(0).forEach(s => s.leave()); document.body.innerHTML = ""; vi.resetAllMocks(); });
describe("server entry safety", () => {
  it("chooses an available server and ignores maintenance/stopped rows", async () => {
    const f = setup(); f.gateway.listGameServers.mockResolvedValue(rows([1, 0], [2, 3], [3, 2]));
    await f.scene.enter(f.ctx); expect(f.selected()).toBe("3");
    f.select(1); f.select(2); expect(f.selected()).toBe("3");
  });
  it("clears a removed selection and disables entry for an empty list", async () => {
    const f = setup(); await f.scene.enter(f.ctx); f.select(2);
    f.gateway.listGameServers.mockResolvedValue(rows()); f.button("refresh-servers").click(); await flush();
    expect(f.selected()).toBeUndefined(); expect(f.button("enter-game").disabled).toBe(true);
  });
  it("does not invent S1 after list failure", async () => {
    const f = setup(); f.gateway.listGameServers.mockRejectedValue(new Error("offline")); await f.scene.enter(f.ctx);
    expect(f.layoutFrame.querySelectorAll("li")).toHaveLength(0); expect(f.button("enter-game").disabled).toBe(true);
  });
  it("starts bootstrap only once while pending", async () => {
    const f = setup(); const d = deferred<any>(); vi.mocked(bootstrapMainCity).mockReturnValue(d.promise);
    await f.scene.enter(f.ctx); f.button("enter-game").click(); f.button("enter-game").click();
    expect(bootstrapMainCity).toHaveBeenCalledTimes(1); d.resolve({ serverId: 1 }); await flush();
    expect(f.ctx.switchScene).toHaveBeenCalledTimes(1);
  });
  it("preserves a valid choice and falls back only when it becomes unavailable", async () => {
    const f = setup(); await f.scene.enter(f.ctx); f.select(2);
    f.button("refresh-servers").click(); await flush(); expect(f.selected()).toBe("2");
    f.gateway.listGameServers.mockResolvedValue(rows([1, 1], [2, 0]));
    f.button("refresh-servers").click(); await flush(); expect(f.selected()).toBe("1");
  });
  it("disables unavailable and unknown-only lists", async () => {
    const f = setup(); f.gateway.listGameServers.mockResolvedValue(rows([1, 0], [2, 3], [3, 99], [0, 1]));
    await f.scene.enter(f.ctx); expect(f.button("enter-game").disabled).toBe(true);
    f.select(3); expect(f.selected()).toBeUndefined(); expect(bootstrapMainCity).not.toHaveBeenCalled();
  });
  it("freezes selection, refresh and entry during a list read, then permits retry after error", async () => {
    const f = setup(); await f.scene.enter(f.ctx); const d = deferred<ReturnType<typeof rows>>();
    f.gateway.listGameServers.mockReturnValueOnce(d.promise); f.button("refresh-servers").click();
    f.button("refresh-servers").click(); f.button("enter-game").click(); f.select(2);
    expect(f.gateway.listGameServers).toHaveBeenCalledTimes(2); expect(f.selected()).toBe("1");
    expect(bootstrapMainCity).not.toHaveBeenCalled(); d.reject(new Error("offline")); await flush();
    expect(f.button("enter-game").disabled).toBe(true); expect(f.button("refresh-servers").disabled).toBe(false);
    f.button("refresh-servers").click(); await flush(); expect(f.button("enter-game").disabled).toBe(false);
  });
  it("freezes selected target during entry and recovers after failure", async () => {
    const f = setup(); await f.scene.enter(f.ctx); f.select(2); const d = deferred<any>();
    vi.mocked(bootstrapMainCity).mockReturnValueOnce(d.promise); f.button("enter-game").click();
    f.select(1); f.button("refresh-servers").click(); expect(f.selected()).toBe("2");
    expect(f.gateway.listGameServers).toHaveBeenCalledTimes(1);
    expect(vi.mocked(bootstrapMainCity).mock.calls[0][3]).toBe(2);
    d.reject(new Error("denied")); await flush(); expect(f.button("enter-game").disabled).toBe(false);
    expect(f.layoutFrame.textContent).toContain("进服失败: denied");
    vi.mocked(bootstrapMainCity).mockResolvedValueOnce({ serverId: 2 } as any);
    f.button("enter-game").click(); await flush(); expect(bootstrapMainCity).toHaveBeenCalledTimes(2);
  });
  it("ignores old list success after leave and re-enter", async () => {
    const f = setup(); const d = deferred<ReturnType<typeof rows>>(); f.gateway.listGameServers.mockReturnValueOnce(d.promise);
    const old = f.scene.enter(f.ctx); await flush(); f.scene.leave(); await f.scene.enter(f.ctx);
    d.resolve(rows([99, 1])); await old; expect(f.selected()).toBe("1");
    expect(f.layoutFrame.textContent).not.toContain("S99");
  });
  it("ignores old list rejection without clearing the new list", async () => {
    const f = setup(); const d = deferred<ReturnType<typeof rows>>(); f.gateway.listGameServers.mockReturnValueOnce(d.promise);
    const old = f.scene.enter(f.ctx); await flush(); f.scene.leave(); await f.scene.enter(f.ctx);
    d.reject(new Error("old")); await old; expect(f.selected()).toBe("1");
    expect(f.button("enter-game").disabled).toBe(false);
  });
  it("does not list servers after leaving during connect", async () => {
    const f = setup(); const d = deferred<void>(); f.gateway.connect.mockReturnValueOnce(d.promise);
    const entering = f.scene.enter(f.ctx); f.scene.leave(); d.resolve(); await entering;
    expect(f.gateway.listGameServers).not.toHaveBeenCalled();
  });
  it.each(["resolve", "reject"] as const)("holds single-flight across re-entry and suppresses stale bootstrap %s", async (result) => {
    const f = setup(); await f.scene.enter(f.ctx); const d = deferred<any>();
    vi.mocked(bootstrapMainCity).mockReturnValueOnce(d.promise); f.button("enter-game").click();
    f.scene.leave(); await f.scene.enter(f.ctx); f.button("enter-game").click();
    expect(bootstrapMainCity).toHaveBeenCalledTimes(1); expect(f.button("enter-game").disabled).toBe(true);
    if (result === "resolve") d.resolve({ serverId: 1 }); else d.reject(new Error("old entry"));
    await flush(); expect(f.ctx.switchScene).not.toHaveBeenCalled();
    expect(f.layoutFrame.textContent).not.toContain("old entry"); expect(f.button("enter-game").disabled).toBe(false);
  });

});
