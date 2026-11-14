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
afterEach(() => { scenes.forEach(s => s.leave()); scenes.length = 0; document.body.replaceChildren(); vi.clearAllMocks(); });

async function setupWithEmptyHead() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
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
    getSessionId: () => "s",
    getSessionGeneration: () => 1,
    getBoundServerId: () => 1,
    getAuthenticatedIdentity: () => ({ accountId: "44", serverId: 1, playerId: 7, generation: 1 }),
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({
      intents: [],
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
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="login-existing"]')!.click(); await flush();
  cred();
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!.click(); await flush();
  cred();
  return { layoutFrame };
}

it("shows discover empty-head boundary after Discover on EMPTY durable head", async () => {
  const { layoutFrame } = await setupWithEmptyHead();
  const discoverBtn = layoutFrame.querySelector<HTMLButtonElement>('[data-action="discover-first-city"]')!;
  expect(discoverBtn.disabled).toBe(false);
  const row = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discover-empty-head-boundary"]')!;
  expect(row.hidden).toBe(false);
  expect(row.textContent).toMatch(/Discover empty-head 边界/);
  expect(row.textContent).toMatch(/不得用重复 Discover 代替/);
  expect(row.textContent).toMatch(/predecessor=EMPTY/);
  const observationRow = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discovery-empty"]')!;
  expect(observationRow.hidden).toBe(false);
  expect(observationRow.textContent).toMatch(/actor discovery EMPTY/);
  const pendingRow = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discover-pending-head-boundary"]')!;
  expect(pendingRow.hidden).toBe(true);
  const rejectedRow = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discover-rejected-head-boundary"]')!;
  expect(rejectedRow.hidden).toBe(true);
  const succeededRow = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discover-succeeded-head-boundary"]')!;
  expect(succeededRow.hidden).toBe(true);
});

it("hides discover empty-head boundary before Discover", async () => {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const ctx = { layoutFrame, hud: document.getElementById("hud")!, gateway: { connect: vi.fn(), listGameServers: vi.fn(async () => ({ servers: [] })) }, assets: {}, switchScene: vi.fn() } as unknown as SceneContext;
  await scene.enter(ctx);
  const row = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-discover-empty-head-boundary"]')!;
  expect(row.hidden).toBe(true);
});