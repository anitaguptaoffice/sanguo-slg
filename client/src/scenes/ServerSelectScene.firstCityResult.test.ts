import { afterEach, expect, it, vi } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
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

async function setup(notObserved = true) {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  const observations: unknown[] = [discovery];
  const ownedIntent = createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "城", x: 1, y: 2 });
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
    getSessionId: () => "s",
    getSessionGeneration: () => generation,
    getBoundServerId: () => 1,
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 7, generation }),
    requestPersistedFirstCity: vi.fn(async (route: string) => {
      if (route.endsWith("DiscoverFirstCityIntent")) return discovery;
      const response = notObserved ? {
        kind: "notObserved" as const, scope, requestedCommandId: commandId, command: null, head: { kind: "empty" as const },
      } : {
        kind: "command" as const, scope, requestedCommandId: commandId,
        command: {
          intent: { scope, proposal: { commandId, predecessor: { kind: "empty" }, name: "城", x: 60, y: 60 },
            encode: () => new Uint8Array(8), matches: () => true },
          template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
          state: { kind: "pending" as const },
        },
        head: { kind: "empty" as const },
      };
      observations.push(response);
      return response;
    }),
    readFirstCityHistory: vi.fn(() => ({ intents: [ownedIntent], observations: observations as any[], unavailable: false })),
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
  const { layoutFrame, gateway } = await setup();
  const loginBefore = gateway.login.mock.calls.length;
  const enterBefore = gateway.enterGameServer.mock.calls.length;
  layoutFrame.querySelector<HTMLInputElement>('input[name="fc-command-id"]')!.value = commandId;
  const password = layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!;
  password.value = "test-password";
  password.dispatchEvent(new Event("input", { bubbles: true }));
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="get-first-city-result"]')!.click(); await flush();
  expect(gateway.login.mock.calls.length).toBe(loginBefore + 1);
  expect(gateway.enterGameServer.mock.calls.length).toBe(enterBefore + 1);
  expect(gateway.requestPersistedFirstCity.mock.calls.some(([route]) => route === "world.v2.GetFirstCityResult")).toBe(true);
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(layoutFrame.textContent).toMatch(/NOT_OBSERVED|GetResult/);
});

it("shows pending result text without claiming main-city entry", async () => {
  const { layoutFrame, gateway } = await setup(false);
  layoutFrame.querySelector<HTMLInputElement>('input[name="fc-command-id"]')!.value = commandId;
  const password = layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!;
  password.value = "test-password";
  password.dispatchEvent(new Event("input", { bubbles: true }));
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="get-first-city-result"]')!.click(); await flush();
  expect(gateway.requestPersistedFirstCity.mock.calls.some(([route]) => route === "world.v2.GetFirstCityResult")).toBe(true);
  expect(layoutFrame.textContent).toMatch(/pending/);
  expect(layoutFrame.textContent).not.toMatch(/已进入主城/);
});
