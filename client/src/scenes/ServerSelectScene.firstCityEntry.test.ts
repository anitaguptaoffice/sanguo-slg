import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import { permitsFirstCityV2Probe } from "./firstCityServerSelectEntry";
import type { SceneContext } from "@/engine/SceneManager";
import type { FirstCityScope } from "@/net/firstCityCanonical";

vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1,
  playerId: 7n, accountId: 44n };
afterEach(() => { scenes.splice(0).forEach(s => s.leave()); document.body.replaceChildren(); vi.clearAllMocks(); config.GATEWAY_WS_URL = "ws://localhost:8080/ws"; });

async function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  const layoutFrame = document.createElement("div"), hud = document.createElement("div");
  document.body.append(layoutFrame, hud);
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  let generation = 1;
  const gateway = {
    connect: vi.fn(async () => {}),
    listGameServers: vi.fn(async () => ({ servers: [{ shard: { server_id: 1, status: 1 } }] })),
    login: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 } })),
    register: vi.fn(async () => ({})),
    enterGameServer: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 } })),
    listPlayerCities: vi.fn(async () => ({ cities: [] })),
    createCity: vi.fn(),
    getCityState: vi.fn(),
    getSessionId: () => "session",
    getSessionGeneration: () => generation,
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({ intents: [], observations: [discovery], unavailable: false })),
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
  const input = (name: string) => layoutFrame.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  input("login").value = "fresh"; input("password").value = "test-password";
  input("password").dispatchEvent(new Event("input", { bubbles: true }));
  const refill = () => {
    input("password").value = "test-password";
    input("password").dispatchEvent(new Event("input", { bubbles: true }));
  };
  const probeDiscover = async () => {
    refill();
    layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click();
    await flush();
  };
  const noCityLogin = async () => {
    layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click();
    await flush();
  };
  return { scene, ctx, gateway, layoutFrame, input, refill, probeDiscover, noCityLogin,
    bumpGeneration: () => { generation++; } };
}

it("reveals dormant probe only after a no-city existing login on local gateways", async () => {
  const { gateway, layoutFrame, probeDiscover, noCityLogin } = await setup();
  const probe = () => layoutFrame.querySelector<HTMLElement>('[data-role="first-city-probe"]')!;
  expect(probe().hidden).toBe(true);
  await noCityLogin();
  expect(probe().hidden).toBe(false);
  expect(layoutFrame.textContent).toContain("首次建城流程尚未开放");
  const loginBefore = gateway.login.mock.calls.length;
  const enterBefore = gateway.enterGameServer.mock.calls.length;
  await probeDiscover();
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(gateway.login.mock.calls.length).toBe(loginBefore + 1);
  expect(gateway.enterGameServer.mock.calls.length).toBe(enterBefore + 1);
  expect(gateway.login).toHaveBeenLastCalledWith("fresh", "test-password", 1);
  expect(gateway.enterGameServer).toHaveBeenLastCalledWith(1);
  expect(gateway.login.mock.invocationCallOrder.at(-1)!).toBeGreaterThan(gateway.enterGameServer.mock.invocationCallOrder.at(-2)!);
  expect(gateway.enterGameServer.mock.invocationCallOrder.at(-1)!).toBeLessThan(gateway.requestPersistedFirstCity.mock.invocationCallOrder.at(-1)!);
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledOnce();
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledWith("world.v2.DiscoverFirstCityIntent", {}, undefined);
  expect((await gateway.requestPersistedFirstCity.mock.results[0]!.value).scope).toEqual(scope);
  expect(layoutFrame.textContent).toContain("durable head 为空");
});
it("hides probe UI for remote ws and every wss URL", async () => {
  for (const url of ["ws://example.com/ws", "wss://127.0.0.1:8080/ws", "wss://game.example/ws"]) {
    config.GATEWAY_WS_URL = url;
    expect(permitsFirstCityV2Probe(url)).toBe(false);
    const { layoutFrame, noCityLogin } = await setup();
    await noCityLogin();
    expect(layoutFrame.querySelector<HTMLElement>('[data-role="first-city-probe"]')!.hidden).toBe(true);
    scenes.pop()!.leave();
    document.body.replaceChildren();
    vi.clearAllMocks();
  }
});
it("never navigates to main city during discover probe", async () => {
  const { ctx, probeDiscover, noCityLogin } = await setup();
  await noCityLogin();
  await probeDiscover();
  expect(ctx.switchScene).not.toHaveBeenCalled();
});
it("single-flights duplicate discover clicks", async () => {
  const { gateway, layoutFrame, noCityLogin, refill } = await setup();
  await noCityLogin();
  const pending = new Promise(() => {});
  gateway.requestPersistedFirstCity.mockImplementation(() => pending as any);
  refill();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click();
  await flush();
  expect(gateway.login).toHaveBeenCalledTimes(2);
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledTimes(1);
});
it("reports probe failure when session generation changes mid-probe", async () => {
  const { gateway, layoutFrame, noCityLogin, bumpGeneration, refill } = await setup();
  await noCityLogin();
  gateway.enterGameServer.mockImplementationOnce(async () => { bumpGeneration(); return { player: { player_id: 7, server_id: 1 } }; });
  refill();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click(); await flush();
  expect(layoutFrame.textContent).toContain("探测结果尚未确认");
  expect(gateway.requestPersistedFirstCity).not.toHaveBeenCalled();
});
it("reports probe failure without v1 fallback when persisted discover rejects", async () => {
  const { gateway, layoutFrame, probeDiscover, noCityLogin } = await setup();
  await noCityLogin();
  gateway.requestPersistedFirstCity.mockRejectedValueOnce(new Error("UNKNOWN"));
  await probeDiscover();
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(layoutFrame.textContent).toContain("探测结果尚未确认");
});
it("does not leave probe in-flight locked after blank credentials or a failed attempt", async () => {
  const { gateway, layoutFrame, noCityLogin, refill, probeDiscover, input } = await setup();
  await noCityLogin();
  const probeBtn = () => layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!;
  input("password").value = "";
  input("password").dispatchEvent(new Event("input", { bubbles: true }));
  probeBtn().click(); await flush();
  expect(probeBtn().disabled).toBe(true);
  refill();
  expect(probeBtn().disabled).toBe(false);
  await probeDiscover();
  gateway.requestPersistedFirstCity.mockRejectedValueOnce(new Error("UNKNOWN"));
  refill();
  await probeDiscover();
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledTimes(2);
  expect(layoutFrame.textContent).not.toContain("探测进行中");
});
