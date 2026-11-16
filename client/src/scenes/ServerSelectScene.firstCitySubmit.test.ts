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
const proposal = { command_id: "22222222-2222-4222-8222-222222222222", predecessor: { empty: {} }, name: "城", x: 60, y: 60 };
const wireScope = { realm_id: scope.realmId, server_id: 1, player_id: String(scope.playerId), account_id: String(scope.accountId) };
const record = (state = "pending") => ({
  canonical: { scope: wireScope, operation: "world.first_city", operation_version: 2, canonical_version: 1, proposal },
  template: { template_version: "v1", rules_version: "r1", catalog_version: "c1", content_encoding_version: 1, content_sha256: new Uint8Array(32) },
  [state]: state === "succeeded" ? { city_id: "1", server_id: 1, player_id: String(scope.playerId), is_capital: true, wall_level: 1, morale: 100 } : {},
});
const outcome = (state = "pending") => ({
  outcome: { scope: wireScope, kind: 1, requested_command_id: proposal.command_id,
    command: record(state), head: { command: record(state) } },
});
afterEach(() => { scenes.forEach(s => s.leave()); scenes.length = 0; document.body.replaceChildren(); vi.clearAllMocks(); });

async function setup() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const discovery = { kind: "discovery" as const, scope, head: { kind: "empty" as const } };
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
      const command = { kind: "command" as const, scope, requestedCommandId: proposal.command_id,
        command: { intent: { scope, proposal: { commandId: proposal.command_id, predecessor: { kind: "empty" }, name: "城", x: 60, y: 60 }, encode: () => new Uint8Array(8), matches: () => true },
          template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
          state: { kind: "pending" as const } },
        head: { kind: "command" as const, record: record() } };
      observations.push(command);
      return command;
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

it("runs login, enter, then persisted submit after discover", async () => {
  const { layoutFrame, gateway } = await setup();
  const loginBefore = gateway.login.mock.calls.length;
  const enterBefore = gateway.enterGameServer.mock.calls.length;
  layoutFrame.querySelector<HTMLInputElement>('input[name="fc-name"]')!.value = "城";
  layoutFrame.querySelector<HTMLButtonElement>('[data-action="submit-first-city"]')!.click(); await flush();
  expect(gateway.login.mock.calls.length).toBe(loginBefore + 1);
  expect(gateway.enterGameServer.mock.calls.length).toBe(enterBefore + 1);
  expect(gateway.requestPersistedFirstCity.mock.calls.some(([route]) => route === "world.v2.SubmitFirstCity")).toBe(true);
  expect(gateway.createCity).not.toHaveBeenCalled();
  expect(layoutFrame.textContent).toMatch(/Submit|命令|pending/);
});
