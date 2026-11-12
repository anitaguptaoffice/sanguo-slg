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
    getSessionGeneration: () => 1,
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({ intents: [], observations: [discovery], unavailable: false })),
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
  const input = (name: string) => layoutFrame.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
  input("login").value = "fresh"; input("password").value = "test-password";
  input("password").dispatchEvent(new Event("input", { bubbles: true }));
  return { scene, ctx, gateway, layoutFrame, input };
}

it("reveals dormant probe only after a no-city existing login on local gateways", async () => {
  const { gateway, layoutFrame, input } = await setup();
  const probe = () => layoutFrame.querySelector<HTMLElement>('[data-role="first-city-probe"]')!;
  expect(probe().hidden).toBe(true);
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click(); await flush();
  expect(probe().hidden).toBe(false);
  expect(layoutFrame.textContent).toContain("首次建城流程尚未开放");
  input("password").value = "test-password";
  input("password").dispatchEvent(new Event("input", { bubbles: true }));
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click(); await flush();
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledWith("world.v2.DiscoverFirstCityIntent", {}, undefined);
  expect(layoutFrame.textContent).toContain("durable head 为空");
});
it("hides probe UI when the gateway URL is outside the dev boundary", async () => {
  config.GATEWAY_WS_URL = "ws://example.com/ws";
  expect(permitsFirstCityV2Probe(config.GATEWAY_WS_URL)).toBe(false);
  const { layoutFrame } = await setup();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click(); await flush();
  expect(layoutFrame.querySelector<HTMLElement>('[data-role="first-city-probe"]')!.hidden).toBe(true);
});
it("never navigates to main city during discover probe", async () => {
  const { ctx, layoutFrame, input } = await setup();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click(); await flush();
  input("password").value = "test-password";
  input("password").dispatchEvent(new Event("input", { bubbles: true }));
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click(); await flush();
  expect(ctx.switchScene).not.toHaveBeenCalled();
});
