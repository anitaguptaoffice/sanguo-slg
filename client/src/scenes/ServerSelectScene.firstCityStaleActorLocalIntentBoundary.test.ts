import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import type { SceneContext } from "@/engine/SceneManager";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";

vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const scenes: ServerSelectScene[] = [];
const scope: FirstCityScope = {
  realmId: "11111111-1111-4111-8111-111111111111",
  shard: 1,
  playerId: 7n,
  accountId: 44n,
};
const journalId = "33333333-3333-4333-8333-333333333333";
afterEach(() => {
  scenes.forEach((s) => s.leave());
  scenes.length = 0;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

async function setupWithDrift() {
  const scene = new ServerSelectScene();
  scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  const journalIntent = createFirstCityIntent(scope, {
    commandId: journalId,
    predecessor: { kind: "empty" },
    name: "journal 最近草案",
    x: 1,
    y: 2,
  });
  let sessionGeneration = 1;
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
    getSessionGeneration: () => sessionGeneration,
    getBoundServerId: () => 1,
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 7, generation: sessionGeneration }),
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({
      intents: [journalIntent],
      observations: [discovery] as never[],
      unavailable: false,
    })),
  };
  const ctx = {
    layoutFrame,
    hud,
    gateway,
    assets: {},
    switchScene: vi.fn(),
  } as unknown as SceneContext;
  await scene.enter(ctx);
  layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
  const cred = (login = "fresh") => {
    layoutFrame.querySelector<HTMLInputElement>('input[name="login"]')!.value = login;
    const password = layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!;
    password.value = "test-password";
    password.dispatchEvent(new Event("input", { bubbles: true }));
  };
  cred();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click();
  await flush();
  cred();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click();
  await flush();
  sessionGeneration = 2;
  layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  return { layoutFrame };
}

it("shows stale-actor local-intent boundary when identity drifts with journal", async () => {
  const { layoutFrame } = await setupWithDrift();
  const row = layoutFrame.querySelector('[data-role="first-city-stale-actor-local-intent-boundary"]');
  expect(row).not.toBeNull();
  expect((row as HTMLElement).hidden).toBe(false);
  const text = row!.textContent ?? "";
  expect(text).toMatch(/stale-actor·本地 intent 边界/);
  expect(text).toMatch(/firstCityActorBindingDrifted/);
  expect(text).toMatch(/journal 最近保留 intent/);
  const submitBtn = layoutFrame.querySelector<HTMLButtonElement>('[data-action="submit-first-city"]');
  expect(submitBtn?.disabled).toBe(true);
});

it("hides stale-actor local-intent boundary before Discover", async () => {
  const scene = new ServerSelectScene();
  scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
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
    getBoundServerId: () => 1,
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 7, generation: 1 }),
    requestPersistedFirstCity: vi.fn(),
    readFirstCityHistory: vi.fn(() => ({ intents: [], observations: [], unavailable: false })),
  };
  const ctx = { layoutFrame, hud: document.getElementById("hud")!, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  layoutFrame.querySelector<HTMLElement>('[data-server-id="1"]')!.click();
  const row = layoutFrame.querySelector('[data-role="first-city-stale-actor-local-intent-boundary"]');
  expect(row).not.toBeNull();
  expect((row as HTMLElement).hidden).toBe(true);
});