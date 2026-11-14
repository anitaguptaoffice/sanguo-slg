import { afterEach, expect, it, vi } from "vitest";
import { ServerSelectScene } from "./ServerSelectScene";
import type { SceneContext } from "@/engine/SceneManager";
import type { FirstCityScope } from "@/net/firstCityCanonical";
import { createFirstCityIntent } from "@/net/firstCityCanonical";

vi.mock("@/engine/artButtonSkin", () => ({ skinPrimaryButtons: vi.fn() }));
vi.mock("@/engine/artPanelSkin", () => ({ skinDefaultPanel: vi.fn() }));
const config = vi.hoisted(() => ({ GATEWAY_WS_URL: "ws://localhost:8080/ws" }));
vi.mock("@/config", () => config);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const scenes: ServerSelectScene[] = [];
const scope: FirstCityScope = { realmId: "11111111-1111-4111-8111-111111111111", shard: 1, playerId: 7n, accountId: 44n };
const commandId = "22222222-2222-4222-8222-222222222222";
afterEach(() => { scenes.forEach(s => s.leave()); scenes.length = 0; document.body.replaceChildren(); vi.clearAllMocks(); });

async function setupDiscovery() {
  const scene = new ServerSelectScene(); scenes.push(scene);
  document.body.innerHTML = "<div id='layout'></div><div id='hud'></div>";
  const layoutFrame = document.getElementById("layout")!;
  const hud = document.getElementById("hud")!;
  const retainedIntent = createFirstCityIntent(scope, {
    commandId, predecessor: { kind: "empty" }, name: "规范记录", x: 10, y: 20,
  });
  const retainedRecord = {
    intent: retainedIntent,
    template: { templateVersion: "v1", rulesVersion: "r1", catalogVersion: "c1", contentEncodingVersion: 1, contentSha256: "00" },
    state: { kind: "pending" as const },
  };
  const discovery = { kind: "discovery" as const, scope, head: { kind: "command" as const, record: retainedRecord } };
  const idContentConflict = {
    kind: "idContentConflict" as const,
    scope,
    requestedCommandId: commandId,
    command: retainedRecord,
    head: { kind: "command" as const, record: retainedRecord },
  };
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
      intents: [
        createFirstCityIntent(scope, { commandId, predecessor: { kind: "empty" }, name: "冲突提案", x: 99, y: 88 }),
      ],
      observations: [discovery, idContentConflict] as never[],
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
  return { layoutFrame };
}

it("surfaces ID_CONTENT_CONFLICT intake panel with server record without auto-continue claims", async () => {
  const { layoutFrame } = await setupDiscovery();
  const panel = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-id-content-conflict"]')!;
  const localDraft = layoutFrame.querySelector<HTMLElement>('[data-role="first-city-local-draft"]')!;
  expect(panel.hidden).toBe(false);
  expect(panel.textContent).toContain(commandId);
  expect(panel.textContent).toContain("规范记录");
  expect(panel.textContent).not.toMatch(/\(99,88\)/);
  expect(panel.textContent).toMatch(/ID_CONTENT_CONFLICT/);
  expect(localDraft.textContent).toContain("冲突提案");
  expect(localDraft.textContent).toMatch(/\(99,88\)/);
  expect(panel.textContent).toMatch(/显式/);
});
