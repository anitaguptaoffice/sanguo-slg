import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import type { SceneContext } from "@/engine/SceneManager";
import type { FirstCityScope } from "@/net/firstCityCanonical";

vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const commandId = "22222222-2222-4222-8222-222222222222";
afterEach(() => { scenes.forEach(s => s.leave()); scenes.length = 0; document.body.replaceChildren(); vi.clearAllMocks(); });

async function ready() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  const notObserved = { kind: "notObserved" as const, scope, requestedCommandId: commandId, command: null, head: { kind: "empty" as const } };
  const observations: unknown[] = [discovery];
  const gateway = {
    connect: vi.fn(async () => {}),
    listGameServers: vi.fn(async () => ({ servers: [{ shard: { server_id: 1, status: 1 } }] })),
    login: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 } })),
    register: vi.fn(async () => ({})),
    enterGameServer: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 } })),
    listPlayerCities: vi.fn(async () => ({ cities: [] })),
    createCity: vi.fn(),
    getCityState: vi.fn(),
    getSessionId: () => "s",
    getSessionGeneration: () => 1,
    requestPersistedFirstCity: vi.fn(async (route: string) => {
      if (route.endsWith("DiscoverFirstCityIntent")) return discovery;
      if (route.endsWith("GetFirstCityResult")) { observations.push(notObserved); return notObserved; }
      return discovery;
    }),
    readFirstCityHistory: vi.fn(() => ({ intents: [], observations: observations as any[], unavailable: false })),
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
  const cred = () => {
    layoutFrame.querySelector<HTMLInputElement>('input[name="login"]')!.value = "fresh";
    const password = layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!;
    password.value = "test-password";
    password.dispatchEvent(new Event("input", { bubbles: true }));
  };
  cred();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click(); await flush();
  cred();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click(); await flush();
  cred();
  return { layoutFrame, gateway, ctx };
}

it("runs login, enter, then persisted GetFirstCityResult", async () => {
  const { layoutFrame, gateway } = await ready();
  const loginBefore = gateway.login.mock.calls.length;
  const commandInput = layoutFrame.querySelector<HTMLInputElement>('input[name="fc-command-id"]')!;
  commandInput.value = commandId;
  commandInput.dispatchEvent(new Event("input", { bubbles: true }));
  const password = layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!;
  password.value = "test-password";
  password.dispatchEvent(new Event("input", { bubbles: true }));
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="get-first-city-result"]')!.click(); await flush();
  expect(gateway.login.mock.calls.length).toBe(loginBefore + 1);
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledWith("world.v2.GetFirstCityResult",
    { expectedScope: scope, commandId }, undefined);
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(layoutFrame.textContent).toContain("NOT_OBSERVED");
});
