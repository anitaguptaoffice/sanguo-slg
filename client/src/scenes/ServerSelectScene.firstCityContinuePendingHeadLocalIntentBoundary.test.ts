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
const headId = "22222222-2222-4222-8222-222222222222";
const journalId = "33333333-3333-4333-8333-333333333333";
afterEach(() => {
  scenes.forEach((s) => s.leave());
  scenes.length = 0;
  document.body.replaceChildren();
  vi.clearAllMocks();
});

async function setupPendingHeadWithJournal() {
  const scene = new ServerSelectScene();
  scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const headIntent = createFirstCityIntent(scope, {
    commandId: headId,
    predecessor: { kind: "empty" },
    name: "待定演示城",
    x: 9,
    y: 10,
  });
  const record = {
    intent: headIntent,
    template: {
      templateVersion: "v1",
      rulesVersion: "r1",
      catalogVersion: "c1",
      contentEncodingVersion: 1,
      contentSha256: "00",
    },
    state: { kind: "pending" as const },
  };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record } };
  const journalIntent = createFirstCityIntent(scope, {
    commandId: journalId,
    predecessor: { kind: "empty" },
    name: "journal 最近草案",
    x: 1,
    y: 2,
  });
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
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({
      intents: [journalIntent],
      observations: [discovery] as never[],
      unavailable: false,
    })),
  };
  const ctx = { layoutFrame, hud, gateway, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
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
  return { layoutFrame };
}

it("shows continue pending-head local-intent boundary on pending head with journal", async () => {
  const { layoutFrame } = await setupPendingHeadWithJournal();
  const row = layoutFrame.querySelector('[data-role="first-city-continue-pending-head-local-intent-boundary"]');
  expect(row).not.toBeNull();
  expect((row as HTMLElement).hidden).toBe(false);
  const text = row!.textContent ?? "";
  expect(text).toMatch(/Continue pending-head·本地 intent 边界/);
  expect(text).toMatch(/journal 最近保留 intent/);
  expect(text).toMatch(/resolveFirstCityContinuePendingHeadBoundaryView/);
  expect(text).toMatch(/Continue 须显式点击/);
});

it("hides continue pending-head local-intent boundary before Discover", async () => {
  const scene = new ServerSelectScene();
  scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const ctx = {
    layoutFrame,
    hud: document.getElementById("hud")!,
    gateway: { connect: vi.fn() },
    assets: {},
    switchScene: vi.fn(),
  } as unknown as SceneContext;
  await scene.enter(ctx);
  const row = layoutFrame.querySelector<HTMLElement>(
    '[data-role="first-city-continue-pending-head-local-intent-boundary"]',
  )!;
  expect(row?.hidden ?? true).toBe(true);
});