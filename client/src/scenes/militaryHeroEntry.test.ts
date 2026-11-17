import { afterEach, expect, it, vi } from "vitest";
import { MainCityScene } from "./MainCityScene";
import { MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW, computeMinimapWorldBounds, worldToMinimapLayout } from "@/ui/worldMinimap";
afterEach(() => { sessionStorage.clear(); document.body.innerHTML = ""; });
function setup() {
  let heroes: { hero_id: number; level: number }[] = [];
  const root = document.createElement("div"); root.dataset.centerPanel = "military"; root.className = "hidden";
  root.innerHTML = '<input data-field="to-x" value="10"><input data-field="to-y" value="20"><input data-field="march-count" value="5"><select data-field="march-hero"></select><button data-action="march"></button><p data-role="march-form-error"></p>';
  document.body.appendChild(root);
  const gateway = { getSessionId: () => "a", getSessionGeneration: () => 1, getBoundServerId: () => 1,
    listPlayerHeroes: vi.fn(async () => ({ heroes })), recruitHero: vi.fn(async () => { heroes = [{ hero_id: 7, level: 1 }]; return { hero_id: 7 }; }) };
  const scene = new MainCityScene() as unknown as Record<string, any>;
  Object.assign(scene, { session: { serverId: 1, player: { player_id: 1 }, cityId: 1, cityX: 60, cityY: 60,
    buildings: [], wallet: {}, garrisonStatus: "ready", cityTroops: [{ unit_cfg_id: 1, count: 40 }] }, gateway, militaryPanel: root,
    dailyQuest: { getSelectedQuestRow: () => ({ quest_cfg_id: 1014, quest_code: "daily_train_1", state: 2 }) },
    queuePanels: { getRecruitQueueSnapshot: () => [], getHighlightedRecruitQueueId: () => null, open: vi.fn(), flashDailyQueueAnchorHighlight: vi.fn() },
    currentMinimapLayoutRect: () => MINIMAP_LAYOUT_RECT, focusMinimapOnWorldGrid: vi.fn(),
    world: { selectGridAt: vi.fn() }, renderHud: vi.fn(), marchList: { getSelectedMarch: () => null } });
  return { scene, gateway, root, button: () => root.querySelector<HTMLButtonElement>('[data-action="march"]')!,
    select: () => root.querySelector<HTMLSelectElement>('[data-field="march-hero"]')! };
}
it("daily training navigation after first recruit should discover the new march leader", async () => {
  const f = setup(); await f.scene.refreshMarchFormHeroes();
  expect(f.select().value).toBe("");
  await f.gateway.recruitHero();
  f.scene.navigateDailyQuest({ kind: "train_troops" });
  await Promise.resolve(); await Promise.resolve();
  expect(f.root.classList.contains("hidden")).toBe(false);
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2);
  expect(f.select().value).toBe("7");
  expect(f.button().disabled).toBe(false);
});
it("control: opening military from its toolbar discovers the same newly recruited leader", async () => {
  const f = setup(); await f.scene.refreshMarchFormHeroes(); await f.gateway.recruitHero();
  const toolbar = document.createElement("button"); toolbar.dataset.action = "toggle-military";
  f.scene.onToolbarClick({ target: toolbar }); await Promise.resolve(); await Promise.resolve();
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2);
  expect(f.select().value).toBe("7"); expect(f.button().disabled).toBe(false);
});

it("minimap target entry after first recruit should discover the new march leader", async () => {
  const f = setup(); await f.scene.refreshMarchFormHeroes(); await f.gateway.recruitHero();
  const point = worldToMinimapLayout(65, 65, computeMinimapWorldBounds(60, 60, [], null), MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
  f.scene.applyMinimapMarchTargetPick(point.x, point.y); await Promise.resolve(); await Promise.resolve();
  expect(f.root.querySelector<HTMLInputElement>('[data-field="to-x"]')!.value).toBe("65");
  expect(f.root.classList.contains("hidden")).toBe(false);
  expect(f.select().value).toBe("7"); expect(f.button().disabled).toBe(false);
});

const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const cleanup: Array<() => void> = [];
afterEach(() => { cleanup.splice(0).forEach(fn => fn()); vi.restoreAllMocks(); });
async function mounted() {
  let heroes: any[] = [], generation = 1;
  const session = { serverId: 1, player: { player_id: 1, level: 1 }, cityId: 1, cityName: "主城", cityX: 60, cityY: 60,
    wallet: { food: 10000, wood: 10000, stone: 10000, iron: 10000, gold: 10000 }, buildings: [],
    cityTroops: [{ unit_cfg_id: 1, count: 500 }], garrisonStatus: "ready", bag: [] };
  const fallback = vi.fn(async () => ({}));
  const gateway = new Proxy({
    getSessionId: () => "actor", getSessionGeneration: () => generation, getBoundServerId: () => 1,
    listPlayerHeroes: vi.fn(async () => ({ heroes, total_count: heroes.length })),
    listPlayerCities: vi.fn(async () => ({ cities: [{ city_id: 2, name: "城池", x: 65, y: 65 }] })),
    listPlayerBag: vi.fn(async () => ({ items: [{ item_cfg_id: 2004, quantity: 2 }] })),
    listRecruitTemplates: vi.fn(async () => ({ templates: [{ template_cfg_id: 1001, pool: "standard",
      recruit_cost: { food: 10 }, recruit_item: { item_cfg_id: 2004, quantity: 1 } }] })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, level: 1 })),
    getCityState: vi.fn(async () => ({ wallet: session.wallet, garrison: { troops: session.cityTroops } })),
    recruitHero: vi.fn(async () => { heroes = [{ hero_id: 7, template_cfg_id: 1001, level: 1 }]; return heroes[0]; }),
    startMarch: vi.fn(),
  }, { get: (target, key) => key in target ? target[key as keyof typeof target] : fallback });
  const assets = new Proxy({ getTextureScale: () => 1, getDevicePixelRatio: () => 1 },
    { get: (target, key) => key in target ? target[key as keyof typeof target] : () => undefined });
  const layoutFrame = document.createElement("div"); layoutFrame.id = "layout-frame";
  const hud = document.createElement("div"), canvas = document.createElement("canvas");
  layoutFrame.append(hud, canvas); document.body.append(layoutFrame);
  const scene = new MainCityScene(); cleanup.push(() => scene.leave());
  await scene.enter({ layoutFrame, hud, canvas, gateway, assets, switchScene: vi.fn(),
    getViewport: () => ({ scale: 1, offsetX: 0, offsetY: 0 }) } as any, session);
  await flush();
  const internals = scene as unknown as Record<string, any>;
  const panel = layoutFrame.querySelector<HTMLElement>(".military-panel")!;
  const select = () => panel.querySelector<HTMLSelectElement>('[data-field="march-hero"]')!;
  const click = (action: string) => layoutFrame.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  return { scene, internals, gateway, panel, select, click, layoutFrame, session,
    setHeroes: (value: any[]) => { heroes = value; }, relogin: () => { generation++; } };
}
it("mounted first recruitment then world-city click enables a leader without a toolbar detour", async () => {
  const f = await mounted(); expect(f.select().value).toBe("");
  f.click("toggle-hero"); await flush();
  const disclosure = f.layoutFrame.querySelector<HTMLDetailsElement>('[data-role="hero-recruit-host"]')!;
  disclosure.querySelector("summary")!.click();
  const recruit = f.layoutFrame.querySelector<HTMLButtonElement>('[data-action="recruit-hero"]')!;
  expect(recruit.disabled).toBe(false); recruit.click();
  await vi.waitFor(() => expect(f.gateway.recruitHero).toHaveBeenCalledTimes(1)); await flush();
  expect(f.select().value).toBe(""); // The hero panel owns a different roster cache.
  f.click("toggle-world"); await flush();
  f.layoutFrame.querySelector<HTMLElement>('.world-panel li[data-x="65"][data-y="65"]')!.click(); await flush();
  expect(f.select().value).toBe("7");
  expect(f.panel.querySelector<HTMLInputElement>('[data-field="to-x"]')!.value).toBe("65");
  expect(f.panel.querySelector<HTMLButtonElement>('[data-action="march"]')!.disabled).toBe(false);
  expect(f.gateway.startMarch).not.toHaveBeenCalled(); expect(f.gateway.recruitHero).toHaveBeenCalledTimes(1);
});
it.each(["daily", "intel", "banner", "queue", "hud"])("mounted %s entry refreshes without submitting or replacing target fields", async route => {
  const f = await mounted(); await f.gateway.recruitHero();
  if (route === "daily") f.internals.navigateDailyQuest({ kind: "train_troops" });
  if (route === "intel") f.internals.openMilitaryFromIntelRemarch({ march_id: 5, to_x: 65, to_y: 65, troops: [{ unit_cfg_id: 1, count: 10 }] });
  if (route === "banner") f.internals.openMilitaryQueueBannerHighlight(5);
  if (route === "queue") { f.internals.queuePanels.addRecruitEntry({ queue_id: 5, unit_cfg_id: 1, count: 10, finish_at_ms: Date.now() + 60000 }); f.internals.openMilitaryRecruitFromQueueRow({ queue_id: 5 }); }
  if (route === "hud") { vi.spyOn(f.internals, "hudMilitaryTodoSweepCounts").mockReturnValue({ marchSubmittable: 1, intelInProgress: 0, reportsUnread: 0 }); f.internals.openHudMilitaryTodoDeepLink("march"); }
  await flush(); expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2); expect(f.select().value).toBe("7"); expect(f.gateway.startMarch).not.toHaveBeenCalled();
});
function deferred<T>() { let resolve!: (v: T) => void, reject!: (e: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
it("coalesces repeated entries, preserves later valid selection and fields, and never reopens a hidden panel", async () => {
  const f = await mounted(); f.setHeroes([{ hero_id: 7 }, { hero_id: 8 }]);
  f.click("toggle-military"); await flush(); f.select().value = "8";
  const d = deferred<any>(); f.gateway.listPlayerHeroes.mockReturnValueOnce(d.promise);
  f.internals.navigateDailyQuest({ kind: "train_troops" }); f.internals.openMilitaryQueueBannerHighlight(5);
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(3);
  const x = f.panel.querySelector<HTMLInputElement>('[data-field="to-x"]')!, count = f.panel.querySelector<HTMLInputElement>('[data-field="march-count"]')!;
  x.value = "70"; count.value = "23"; f.select().value = "7";
  f.click("toggle-world"); await flush();
  d.resolve({ heroes: [{ hero_id: 8 }, { hero_id: 7 }] }); await flush();
  expect(f.select().value).toBe("7"); expect(x.value).toBe("70"); expect(count.value).toBe("23");
  expect(f.panel.classList.contains("hidden")).toBe(true); expect(f.gateway.startMarch).not.toHaveBeenCalled();
});
it("read failure preserves existing roster, valid selection and local busy bindings; a later entry retries only the read", async () => {
  const f = await mounted(); f.setHeroes([{ hero_id: 7 }, { hero_id: 8 }]); f.click("toggle-military"); await flush();
  f.internals.marchLocalBusyHeroIds.add(7); f.select().value = "8";
  f.gateway.listPlayerHeroes.mockRejectedValueOnce(new Error("read offline")); f.internals.openMilitaryQueueBannerHighlight(5); await flush();
  expect(f.select().value).toBe("8"); expect(f.internals.marchLocalBusyHeroIds.has(7)).toBe(true);
  f.internals.openMilitaryQueueBannerHighlight(5); await flush();
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(4); expect(f.select().value).toBe("8");
  expect(f.select().querySelector<HTMLOptionElement>('option[value="7"]')!.disabled).toBe(true);
  expect(f.gateway.startMarch).not.toHaveBeenCalled(); expect(f.gateway.recruitHero).not.toHaveBeenCalled();
});
it.each(["leave", "relogin"])("pending entry read cannot apply after %s", async boundary => {
  const f = await mounted(), d = deferred<any>(); f.gateway.listPlayerHeroes.mockReturnValueOnce(d.promise);
  f.internals.navigateDailyQuest({ kind: "train_troops" });
  if (boundary === "leave") f.scene.leave(); else f.relogin();
  d.resolve({ heroes: [{ hero_id: 7 }] }); await flush();
  expect(f.select().value).toBe(""); expect(f.internals.marchFormHeroes).toEqual([]);
  expect(f.gateway.startMarch).not.toHaveBeenCalled();
});
it("does not convert per-frame synchronization or toolbar closing into roster polling", async () => {
  const f = await mounted(); f.click("toggle-military"); await flush(); f.click("toggle-military");
  for (let i = 0; i < 5; i++) f.internals.syncMilitaryPanel();
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(2);
});
