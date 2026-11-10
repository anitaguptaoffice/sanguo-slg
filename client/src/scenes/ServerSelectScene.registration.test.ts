import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import type { SceneContext } from "@/engine/SceneManager";
vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
async function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  const layoutFrame = document.createElement("div"), hud = document.createElement("div");
  document.body.append(layoutFrame, hud);
  let generation = 1, handlers: any;
  const player = { player_id: 7, server_id: 1 };
  const gateway = {
    connect: vi.fn(async (h: any) => { handlers = h; }),
    listGameServers: vi.fn(async () => ({ servers: [{ shard: { server_id: 1, status: 1 } }] })),
    register: vi.fn(async () => ({ account_id: "44" })), login: vi.fn(async () => ({ player })),
    enterGameServer: vi.fn(async () => ({ player })), listPlayerCities: vi.fn(async () => ({ cities: [] })),
    createCity: vi.fn(), getCityState: vi.fn(), getSessionId: () => "session", getSessionGeneration: () => generation,
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  const input = (name: string) => layoutFrame.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  const button = (action: string) => layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const fill = (login = "fresh", password = "test-password") => {
    input("login").value = login; input("password").value = password;
    input("password").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const noEntry = () => {
    expect(gateway.login).not.toHaveBeenCalled(); expect(gateway.enterGameServer).not.toHaveBeenCalled();
    expect(gateway.createCity).not.toHaveBeenCalled(); expect(ctx.switchScene).not.toHaveBeenCalled();
  };
  return { scene, ctx, gateway, input, button, fill, noEntry, layoutFrame, hud,
    invalidate: () => generation++, disconnect: () => handlers.onClose(),
    close: () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })) };
}
afterEach(() => {
  scenes.splice(0).forEach(s => s.leave()); document.body.replaceChildren(); vi.clearAllMocks();
  config.GATEWAY_WS_URL = "ws://localhost:8080/ws";
});
it("requires a separate explicit registration click and never authenticates or creates a city", async () => {
  const f = await setup(); f.noEntry(); expect(f.gateway.register).not.toHaveBeenCalled();
  expect(f.button("register-account").textContent).toContain("注册新账号");
  expect(f.button("enter-game").textContent).toContain("演示");
  f.fill("  fresh  ", " spaces preserved "); f.button("register-account").click(); await flush();
  expect(f.gateway.register).toHaveBeenCalledExactlyOnceWith("fresh", " spaces preserved "); f.noEntry();
  expect(f.layoutFrame.textContent).toContain("账号已注册");
  expect(f.layoutFrame.textContent).toContain("首次建城尚未开放");
  expect(f.input("password").value).toBe(""); expect(f.button("register-account").disabled).toBe(true);
  f.fill(); f.button("login-existing").click(); await flush();
  expect(f.gateway.login).toHaveBeenCalledTimes(1); expect(f.gateway.listPlayerCities).toHaveBeenCalledTimes(1);
  expect(f.layoutFrame.textContent).toContain("首次建城流程尚未开放");
  expect(f.layoutFrame.textContent).toContain("本次注册未登录或建城");
  expect(f.layoutFrame.textContent).not.toContain("尚未登录");
  expect(f.gateway.createCity).not.toHaveBeenCalled(); expect(f.ctx.switchScene).not.toHaveBeenCalled();
});
it("implicit form submission is login, never registration", async () => {
  const f = await setup(); f.fill();
  f.layoutFrame.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); await flush();
  expect(f.gateway.register).not.toHaveBeenCalled(); expect(f.gateway.login).toHaveBeenCalledTimes(1);
});
it.each(["", "   "])("rejects blank login %j and password before Register", async login => {
  const f = await setup(); f.fill(login); f.button("register-account").click();
  f.fill("fresh", ""); f.button("register-account").click(); expect(f.gateway.register).not.toHaveBeenCalled();
});
it("shares single-flight with every entry action and rejects repeated registration", async () => {
  const f = await setup(), pending = Promise.withResolvers<any>(); f.gateway.register.mockReturnValue(pending.promise);
  f.fill(); f.button("register-account").click(); f.button("register-account").click();
  f.button("login-existing").click(); f.button("enter-game").click(); f.button("refresh-servers").click();
  expect(f.input("login").disabled).toBe(true); expect(f.input("password").value).toBe(""); f.noEntry();
  expect(f.gateway.register).toHaveBeenCalledTimes(1); pending.resolve({ account_id: "44" }); await flush();
  f.fill(); f.button("register-account").click(); expect(f.gateway.register).toHaveBeenCalledTimes(1);
});
it.each([new Error("raw test-password"), Object.assign(new Error("duplicate test-password"), { code: 10003 })])("keeps error outcome unknown without leaking or retrying", async error => {
  const f = await setup(); f.gateway.register.mockRejectedValue(error); f.fill();
  f.button("register-account").click(); await flush(); f.fill(); f.button("register-account").click();
  expect(f.layoutFrame.textContent).toContain("注册结果尚未确认");
  expect(f.layoutFrame.textContent).not.toContain(error.message); expect(f.gateway.register).toHaveBeenCalledTimes(1); f.noEntry();
});
it.each([{}, { account_id: "0" }, { account_id: "-1" }, { account_id: "not-an-id" }])("does not confirm malformed success %j", async response => {
  const f = await setup(); f.gateway.register.mockResolvedValue(response as any); f.fill();
  f.button("register-account").click(); await flush(); expect(f.layoutFrame.textContent).toContain("注册结果尚未确认"); f.noEntry();
});
it.each(["close", "reentry", "disconnect", "identity"])("ignores late success after %s and preserves no-repeat fence", async mode => {
  const f = await setup(), pending = Promise.withResolvers<any>(); f.gateway.register.mockReturnValue(pending.promise);
  f.fill(); f.button("register-account").click();
  if (mode === "close") { f.close(); f.hud.querySelector<HTMLButtonElement>("button")!.click(); }
  if (mode === "reentry") { f.scene.leave(); await f.scene.enter(f.ctx); }
  if (mode === "disconnect") f.disconnect();
  if (mode === "identity") f.invalidate();
  pending.resolve({ account_id: "44" }); await flush();
  expect(f.layoutFrame.textContent).not.toContain("账号已注册");
  expect(f.layoutFrame.textContent).toContain("注册结果尚未确认");
  expect(f.input("password").value).toBe(""); f.fill(); f.button("register-account").click();
  expect(f.gateway.register).toHaveBeenCalledTimes(1); f.noEntry();
});
it("does not transmit credentials over a nonlocal cleartext gateway", async () => {
  config.GATEWAY_WS_URL = "ws://example.com/ws";
  const f = await setup(); f.fill(); f.button("register-account").click(); await flush();
  expect(f.gateway.register).not.toHaveBeenCalled(); expect(f.input("password").value).toBe("");
  expect(f.layoutFrame.textContent).toContain("加密网关"); f.noEntry();
});
it("clears unsent password on dismissal and never stores credentials", async () => {
  const f = await setup(), local = vi.spyOn(Storage.prototype, "setItem"); f.fill(); f.close();
  expect(f.input("password").value).toBe(""); expect(f.gateway.register).not.toHaveBeenCalled();
  f.hud.querySelector<HTMLButtonElement>("button")!.click(); f.fill(); f.button("register-account").click(); await flush();
  expect(local).not.toHaveBeenCalled(); local.mockRestore();
});
