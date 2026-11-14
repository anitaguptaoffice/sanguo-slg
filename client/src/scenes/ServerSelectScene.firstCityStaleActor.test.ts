import { afterEach, expect, it, vi } from "vitest";
import { createFirstCityIntent } from "@/net/firstCityCanonical";
import { ServerSelectScene } from "./ServerSelectScene";
import { FIRST_CITY_STALE_ACTOR_NOTICE } from "./firstCityServerSelectActor";
import type { SceneContext } from "@/engine/SceneManager";
import type { FirstCityScope } from "@/net/firstCityCanonical";

vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const foreignId = "33333333-3333-4333-8333-333333333333";
const ownedId = "22222222-2222-4222-8222-222222222222";
afterEach(() => { scenes.forEach(s => s.leave()); scenes.length = 0; document.body.replaceChildren(); vi.clearAllMocks(); });

async function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
  const ownedIntent = createFirstCityIntent(scope, { commandId: ownedId, predecessor: { kind: "empty" }, name: "城", x: 1, y: 2 });
  let accountId = "44";
  const gateway = {
    connect: vi.fn(async () => {}),
    listGameServers: vi.fn(async () => ({ servers: [{ shard: { server_id: 1, status: 1 } }] })),
    login: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 } })),
    register: vi.fn(async () => ({})),
    enterGameServer: vi.fn(async () => ({ player: { player_id: 7, server_id: 1 }, account_id: accountId })),
    listPlayerCities: vi.fn(async () => ({ cities: [] })),
    createCity: vi.fn(),
    getCityState: vi.fn(),
    getSessionId: () => "s",
    getSessionGeneration: () => 1,
    getBoundServerId: () => 1,
    getAuthenticatedIdentity: () => ({ accountId, serverId: 1, playerId: 7, generation: 1 }),
    requestPersistedFirstCity: vi.fn(async () => discovery),
    readFirstCityHistory: vi.fn(() => ({ intents: [ownedIntent], observations: [discovery], unavailable: false })),
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
  return { layoutFrame, gateway, cred, setAccountId: (value: string) => { accountId = value; } };
}

it("clears retained knowledge and shows stale notice after account switch", async () => {
  const { layoutFrame, cred } = await setup();
  expect(layoutFrame.textContent).toContain("durable head 为空");
  cred("other-user");
  layoutFrame.querySelector<HTMLInputElement>('input[name="login"]')!.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  expect(layoutFrame.textContent).toContain("stale-actor");
  expect(layoutFrame.querySelector<HTMLElement>('[data-role="first-city-command"]')!.hidden).toBe(true);
});

it("does not call GetResult for foreign commandId", async () => {
  const { layoutFrame, gateway } = await setup();
  layoutFrame.querySelector<HTMLInputElement>('input[name="fc-command-id"]')!.value = foreignId;
  layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!.value = "test-password";
  layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!.dispatchEvent(new Event("input", { bubbles: true }));
  const btn = layoutFrame.querySelector<HTMLButtonElement>('[data-action="get-first-city-result"]')!;
  expect(btn.disabled).toBe(true);
  btn.click(); await flush();
  expect(gateway.requestPersistedFirstCity).toHaveBeenCalledTimes(1);
});

it("fail-closes submit when authenticated identity mismatches knowledge", async () => {
  const { layoutFrame, gateway, setAccountId } = await setup();
  setAccountId("99");
  layoutFrame.querySelector<HTMLInputElement>('input[name="fc-name"]')!.value = "城";
  layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!.value = "test-password";
  layoutFrame.querySelector<HTMLInputElement>('input[name="password"]')!.dispatchEvent(new Event("input", { bubbles: true }));
  const submitBefore = gateway.requestPersistedFirstCity.mock.calls.length;
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="submit-first-city"]')!.click(); await flush();
  expect(gateway.requestPersistedFirstCity.mock.calls.length).toBe(submitBefore);
  expect(layoutFrame.textContent).toMatch(/命令未完成|尚未确认/);
});

it("surfaces stale-actor copy without playable-first-city claims", async () => {
  const { layoutFrame, cred } = await setup();
  cred("drift");
  layoutFrame.querySelector<HTMLInputElement>('input[name="login"]')!.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  expect(layoutFrame.textContent).toContain(FIRST_CITY_STALE_ACTOR_NOTICE);
  expect(layoutFrame.textContent).not.toContain("可玩首城验收已完成");
});
