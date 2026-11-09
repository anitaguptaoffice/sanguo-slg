import { afterEach, describe, expect, it, vi } from "vitest";
import { ServerSelectScene, permitsExistingAccountLogin } from "./ServerSelectScene";
import { bootstrapMainCity } from "@/net/bootstrapSession";
import type { SceneContext } from "@/engine/SceneManager";
import { ErrorCode } from "@/net/loadProto";
vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const scenes: ServerSelectScene[] = [];
function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  const layoutFrame = document.createElement("div"), hud = document.createElement("div");
  document.body.append(layoutFrame, hud);
  let generation = 1;
  const profile = { player_id: 7, server_id: 2, display_name: "Existing", level: 3 };
  const gateway = {
    connect: vi.fn(async () => {}),
    listGameServers: vi.fn(async () => ({ servers: [1, 2].map(server_id => ({ shard: { server_id, status: 1 } })) })),
    login: vi.fn(async () => ({ player: profile })),
    register: vi.fn(async () => ({})),
    enterGameServer: vi.fn(async () => ({ player: profile })),
    listPlayerCities: vi.fn(async () => ({ cities: [{ city_id: 42, name: "Owned", x: 12, y: 13, is_capital: true }] })),
    createCity: vi.fn(async () => ({})),
    getCityState: vi.fn(async () => ({ wallet: { food: 8 }, buildings: [], garrison: { troops: [] } })),
    getSessionId: () => "session", getSessionGeneration: () => generation,
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn(async () => {}) } as unknown as SceneContext;
  const button = (action: string) => layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const input = (name: string) => layoutFrame.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const fill = (login = "account-a", password = "fixture-only") => {
    input("login").value = login; input("password").value = password;
    input("password").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const start = async () => {
    await scene.enter(ctx);
    layoutFrame.querySelector<HTMLElement>('[data-server-id="2"]')!.click();
    fill();
  };
  return { scene, ctx, gateway, layoutFrame, input, button, fill, start, invalidate: () => generation++ };
}
afterEach(() => { scenes.splice(0).forEach(s => s.leave()); document.body.replaceChildren(); vi.clearAllMocks(); });
describe("existing account entry", () => {
  it("runs actual bootstrap for explicit credentials and the selected server without provisioning", async () => {
    const f = setup(); await f.start(); f.fill("  account-a  ", " leading and trailing ");
    f.button("login-existing").click(); await flush();
    expect(f.gateway.login).toHaveBeenCalledWith("account-a", " leading and trailing ", 2);
    expect(f.gateway.enterGameServer).toHaveBeenCalledWith(2);
    expect(f.gateway.getCityState).toHaveBeenCalledWith(42);
    expect(f.gateway.register).not.toHaveBeenCalled(); expect(f.gateway.createCity).not.toHaveBeenCalled();
    expect(f.ctx.switchScene).toHaveBeenCalledWith("mainCity", expect.objectContaining({ cityId: 42, serverId: 2, player: expect.objectContaining({ player_id: 7 }) }));
    expect(f.input("password").value).toBe("");
  });
  it("shows an incomplete-city notice and never creates a city", async () => {
    const f = setup(); f.gateway.listPlayerCities.mockResolvedValue({ cities: [] }); await f.start();
    f.button("login-existing").click(); await flush();
    expect(f.layoutFrame.textContent).toContain("首次建城流程尚未开放");
    expect(f.gateway.createCity).not.toHaveBeenCalled(); expect(f.gateway.register).not.toHaveBeenCalled();
    expect(f.gateway.getCityState).not.toHaveBeenCalled(); expect(f.ctx.switchScene).not.toHaveBeenCalled();
  });
  it.each([ErrorCode.ACCOUNT_LOGIN_FAILED, 10003, 20002])("never registers or falls back after login error %s", async code => {
    const f = setup(); f.gateway.login.mockRejectedValue(Object.assign(new Error("fixture-only must not be echoed"), { code }));
    await f.start(); f.button("login-existing").click(); await flush();
    expect(f.gateway.login).toHaveBeenCalledTimes(1); expect(f.gateway.register).not.toHaveBeenCalled();
    expect(f.gateway.enterGameServer).not.toHaveBeenCalled(); expect(f.gateway.createCity).not.toHaveBeenCalled();
    expect(f.ctx.switchScene).not.toHaveBeenCalled(); expect(f.layoutFrame.textContent).not.toContain("must not be echoed");
    expect(f.layoutFrame.textContent).toContain("登录未完成"); expect(f.input("password").value).toBe("");
  });
  it("rejects blank credentials before calling the gateway", async () => {
    const f = setup(); await f.start(); f.fill("  ", "fixture-only");
    expect(f.button("login-existing").disabled).toBe(true);
    f.layoutFrame.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(f.gateway.login).not.toHaveBeenCalled();
  });
  it("shares single-flight with demo entry and freezes server and credentials", async () => {
    const f = setup(), pending = deferred<any>(); f.gateway.login.mockReturnValue(pending.promise);
    await f.start(); f.button("login-existing").click(); f.button("enter-game").click(); f.button("login-existing").click();
    f.layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
    expect(f.input("login").disabled).toBe(true); expect(f.input("password").disabled).toBe(true);
    expect(f.gateway.login).toHaveBeenCalledTimes(1); expect(f.gateway.login.mock.calls[0]).toEqual(["account-a", "fixture-only", 2]);
    pending.reject(new Error("offline")); await flush();
    expect(f.input("login").disabled).toBe(false); expect(f.button("enter-game").disabled).toBe(false);
  });
  it("keeps demo login credentials and default provisioning behavior", async () => {
    const f = setup(); await f.start(); f.button("enter-game").click(); await flush();
    expect(f.gateway.login).toHaveBeenCalledWith("demo", "demo123", 2);
    f.gateway.login.mockRejectedValueOnce(Object.assign(new Error("absent"), { code: ErrorCode.ACCOUNT_LOGIN_FAILED }));
    await bootstrapMainCity(f.gateway as any, "demo", "demo123", 2);
    expect(f.gateway.register).toHaveBeenCalledWith("demo", "demo123");
  });
  it("clears password on Escape, leave and reentry", async () => {
    const f = setup(); await f.start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(f.input("password").value).toBe(""); f.fill();
    f.scene.leave(); await f.scene.enter(f.ctx);
    expect(f.input("password").value).toBe(""); expect(f.input("login").value).toBe("");
  });
  it("does not apply a late failure after leaving and reentering", async () => {
    const f = setup(), pending = deferred<any>(); f.gateway.login.mockReturnValue(pending.promise);
    await f.start(); f.button("login-existing").click(); f.scene.leave(); await f.scene.enter(f.ctx);
    expect(f.button("enter-game").disabled).toBe(true);
    pending.reject(new Error("old")); await flush();
    expect(f.ctx.switchScene).not.toHaveBeenCalled(); expect(f.layoutFrame.textContent).not.toContain("登录未完成");
  });
  it("rejects stale city reads after an actor generation change", async () => {
    const f = setup(), pending = deferred<any>(); f.gateway.getCityState.mockReturnValue(pending.promise);
    await f.start(); f.button("login-existing").click(); await flush(); f.invalidate();
    pending.resolve({ wallet: {} }); await flush();
    expect(f.ctx.switchScene).not.toHaveBeenCalled(); expect(f.gateway.createCity).not.toHaveBeenCalled();
  });
  it("enters a second existing identity after reload without retaining the first password", async () => {
    const f = setup(); await f.start(); f.button("login-existing").click(); await flush(); f.scene.leave();
    await f.scene.enter(f.ctx); f.layoutFrame.querySelector<HTMLElement>('[data-server-id="2"]')!.click();
    const player = { player_id: 9, server_id: 2, display_name: "Second", level: 1 };
    f.gateway.login.mockResolvedValue({ player }); f.gateway.enterGameServer.mockResolvedValue({ player });
    f.gateway.listPlayerCities.mockResolvedValue({ cities: [{ city_id: 44, name: "Second", x: 22, y: 23, is_capital: true }] });
    f.fill("account-b", "second-fixture"); f.button("login-existing").click(); await flush();
    expect(f.gateway.login).toHaveBeenLastCalledWith("account-b", "second-fixture", 2);
    expect(f.ctx.switchScene).toHaveBeenLastCalledWith("mainCity", expect.objectContaining({ cityId: 44, player: expect.objectContaining({ player_id: 9 }) }));
    expect(f.gateway.register).not.toHaveBeenCalled(); expect(f.gateway.createCity).not.toHaveBeenCalled();
  });
});
it.each([
  ["wss://game.example/ws", true], ["ws://127.0.0.1:8080/ws", true], ["ws://localhost:8080/ws", true],
  ["ws://[::1]:8080/ws", true], ["ws://game.example/ws", false], ["https://game.example/ws", false],
  ["wss://name:secret@game.example/ws", false], ["not a URL", false],
])("credential transport boundary %s", (url, allowed) => expect(permitsExistingAccountLogin(url as string)).toBe(allowed));
