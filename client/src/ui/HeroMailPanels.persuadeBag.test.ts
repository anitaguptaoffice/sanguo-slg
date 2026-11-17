import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { GatewayClient, type GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { beginAssetRead, captureAssetRead } from "@/net/questClaimAssets";
import { beginAssetMutation } from "@/net/assetMutation";
import { getTypes } from "@/net/loadProto";

const panels: HeroMailPanels[] = [];
const flush = async () => { for (let i = 0; i < 3; i++) await new Promise(r => setTimeout(r, 0)); };
function deferred<T = any>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
beforeEach(() => sessionStorage.clear());
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; vi.restoreAllMocks(); });
async function setup(books = 1, action = "persuade") {
  let generation = 1, token = "token", boundServer = 1, friend = action === "hire" ? 30 : 10;
  let session = { serverId: 1, cityId: 1, player: { player_id: 7 }, wallet: { gold: 100000 },
    bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const items = () => books ? [{ item_cfg_id: 2004, quantity: books }] : [];
  const targets = () => [
    { npc_cfg_id: 1002, display_name: "关羽", state: action === "befriend" ? 0 : 1, level: 1,
      friend, hire_friend_min: 30, next_persuade_at_ms: friend === 20 ? Date.now() + 86400000 : 0 },
    { npc_cfg_id: 1003, display_name: "张飞", state: 1, friend: 10, hire_friend_min: 30 },
  ];
  const gateway = {
    getBoundServerId: () => boundServer, getSessionId: () => token, getSessionGeneration: () => generation,
    listPlayerBag: vi.fn(async () => ({ items: items() })), getCityState: vi.fn(),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [] })), listRecruitTemplates: vi.fn(async () => ({ templates: [] })),
    listHotelRecruitCandidates: vi.fn(async () => ({ candidates: [] })), listCaptiveHeroes: vi.fn(async () => ({ captives: [] })),
    listComingHeroes: vi.fn(async () => ({ coming: [] })), listPersuadeTargets: vi.fn(async () => ({ targets: targets() })),
    persuadeHero: vi.fn(async () => { books--; friend += 10; return { friend_delta: 10 }; }),
    lionizeHero: vi.fn(async () => ({ befriended: action === "befriend", recruited: action === "hire", display_name: "关羽", gold_spent: 500 })),
  };
  const root = document.createElement("div"); document.body.append(root);
  const status = vi.fn(), patch = vi.fn((value: Partial<MainCitySession>) => { Object.assign(session, value); panel.refreshRecruitAffordability(); });
  const panel = new HeroMailPanels(root, gateway as unknown as GatewayPort, () => session, patch, status);
  panels.push(panel); panel.attach(); panel.toggleHero(); await flush(); patch.mockClear(); status.mockClear();
  const button = (name = "persuade-primary") => root.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const select = () => root.querySelector<HTMLElement>('li[data-npc-cfg-id="1003"]')!.click();
  const start = () => { root.querySelectorAll<HTMLDetailsElement>("details").forEach(d => { d.open = true; }); button().click(); };
  const change = (kind: string) => {
    if (kind === "actor") session.player!.player_id = 8;
    if (kind === "city") session.cityId = 2;
    if (kind === "server") session.serverId = 2;
    if (kind === "connection") generation++;
    if (kind === "token") token = "new";
    if (kind === "boundServer") boundServer = 2;
    if (kind === "session") session = { ...session };
  };
  return { panel, root, gateway, port: gateway as unknown as GatewayPort, patch, status, button, select, start, change, session: () => session,
    text: (role: string) => root.querySelector(`[data-role="persuade-${role}"]`)?.textContent ?? "" };
}

it.each([1, 4])("confirmed persuasion replaces the full bag with %i starting scrolls", async books => {
  const f = await setup(books), wallet = f.session().wallet;
  const snapshot = [{ item_cfg_id: 3001, quantity: 9 }, ...(books > 1 ? [{ item_cfg_id: 2004, quantity: books - 1 }] : [])];
  f.gateway.listPlayerBag.mockResolvedValueOnce({ items: snapshot });
  f.start(); await flush(); f.select();
  expect(f.session().bag).toEqual(snapshot.sort((a, b) => a.item_cfg_id - b.item_cfg_id));
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(2);
  expect(f.button().disabled).toBe(books === 1);
  expect(f.text("preview")).toContain(books === 1 ? "当前 0" : "持有 3");
  expect(f.session().wallet).toBe(wallet); expect(f.gateway.getCityState).not.toHaveBeenCalled();
  expect(f.text("meta")).toContain("关羽游说成功");
});

it("keeps success and pending inventory after both reads fail; refresh retries only reads", async () => {
  const f = await setup(); f.gateway.listPlayerBag.mockRejectedValueOnce(new Error("bag offline"));
  f.gateway.listPersuadeTargets.mockRejectedValueOnce(new Error("targets offline"));
  f.start(); await flush(); f.select();
  expect(f.text("meta")).toContain("关羽游说成功"); expect(f.text("form-error")).toContain("背包待同步");
  expect(f.text("form-error")).toContain("结交目标待刷新"); expect(f.button().disabled).toBe(true);
  expect(f.status.mock.calls.at(-1)?.[0]).toContain("游说成功"); f.button().click();
  f.button("refresh-persuade-targets").click(); await flush();
  expect(f.session().bag).toEqual([]); expect(f.text("form-error")).toBe("");
  expect(f.gateway.persuadeHero).toHaveBeenCalledTimes(1); expect(f.gateway.lionizeHero).not.toHaveBeenCalled();
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(3); expect(f.text("preview")).toContain("张飞");
});

it("target-list failure does not turn a confirmed successful bag settlement into failure", async () => {
  const f = await setup(3); f.gateway.listPersuadeTargets.mockRejectedValueOnce(new Error("offline"));
  f.start(); await flush();
  expect(f.session().bag).toEqual([{ item_cfg_id: 2004, quantity: 2 }]);
  expect(f.status.mock.calls.at(-1)?.[0]).toContain("游说成功"); expect(f.text("meta")).toContain("关羽游说成功");
  expect(f.text("form-error")).not.toContain("背包待同步");
});

it.each(["selection", "close", "reopen"])("%s while confirmed inventory is loading cannot discard consumption", async kind => {
  const f = await setup(), bag = deferred(); f.gateway.listPlayerBag.mockReturnValueOnce(bag.promise);
  f.start(); await flush(); f.select(); expect(f.button().disabled).toBe(true);
  if (kind !== "selection") f.panel.toggleHero();
  if (kind === "reopen") { f.panel.toggleHero(); await flush(); }
  bag.resolve({ items: [] }); await flush();
  expect(f.session().bag).toEqual([]); expect(f.gateway.persuadeHero).toHaveBeenCalledTimes(1);
  if (kind === "close") { f.panel.toggleHero(); await flush(); }
  if (f.text("form-error").includes("背包待同步")) { f.button("refresh-persuade-targets").click(); await flush(); }
  expect(f.text("meta")).toContain("关羽游说成功"); expect(f.button().disabled).toBe(true);
});

it("closing before confirmation still reconciles the original session", async () => {
  const f = await setup(), mutation = deferred(); f.gateway.persuadeHero.mockReturnValueOnce(mutation.promise);
  f.gateway.listPlayerBag.mockResolvedValueOnce({ items: [] }); f.start(); f.panel.toggleHero();
  mutation.resolve({ friend_delta: 10 }); await flush(); expect(f.session().bag).toEqual([]);
  expect(f.patch).toHaveBeenCalledExactlyOnceWith({ bag: [] });
});

it.each(["epoch", "mutation", "bag"])("a newer %s supersedes inventory and leaves explicit read recovery", async kind => {
  const f = await setup(), bag = deferred(); f.gateway.listPlayerBag.mockReturnValueOnce(bag.promise);
  f.start(); await flush();
  if (kind === "epoch") beginAssetRead(f.port);
  if (kind === "mutation") beginAssetMutation(f.port, () => true)();
  if (kind === "bag") f.session().bag = [{ item_cfg_id: 2004, quantity: 8 }];
  const before = f.session().bag; bag.resolve({ items: [] }); await flush(); f.select();
  expect(f.session().bag).toBe(before); expect(f.patch).not.toHaveBeenCalled();
  expect(f.text("form-error")).toContain("背包待同步"); expect(f.button().disabled).toBe(true);
  f.button("refresh-persuade-targets").click(); await flush(); expect(f.session().bag).toEqual([]);
  expect(f.gateway.persuadeHero).toHaveBeenCalledTimes(1);
});

it.each(["actor", "city", "server", "connection", "token", "boundServer", "session"])("old confirmed bag cannot publish after %s changes", async kind => {
  const f = await setup(), bag = deferred(); f.gateway.listPlayerBag.mockReturnValueOnce(bag.promise);
  f.start(); await flush(); f.change(kind); f.status.mockClear();
  const current = captureAssetRead(f.port); bag.resolve({ items: [] }); await flush();
  expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(current()).toBe(true);
  f.panel.refreshRecruitAffordability(); expect(f.text("meta")).not.toContain("游说成功");
  expect(f.button("refresh-persuade-targets").disabled).toBe(false);
});

it("same-actor session replacement before confirmation cannot invalidate or patch the replacement", async () => {
  const f = await setup(), mutation = deferred(); f.gateway.persuadeHero.mockReturnValueOnce(mutation.promise);
  f.start(); f.change("session"); f.status.mockClear(); const epoch = captureAssetRead(f.port);
  mutation.resolve({ friend_delta: 10 }); await flush();
  expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(epoch()).toBe(true);
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(1);
});

it("rejected persuasion retains its mapped error and never reads inventory", async () => {
  const f = await setup(); f.gateway.persuadeHero.mockRejectedValueOnce(new Error("hero: persuade on cooldown"));
  f.start(); await flush(); expect(f.text("form-error")).toContain("游说冷却");
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(1); expect(f.text("meta")).not.toContain("游说成功");
});

it.each(["confirmation", "bag"])("detach/re-entry rejects an old %s without clearing the new request", async phase => {
  const f = await setup(3), old = deferred();
  if (phase === "confirmation") f.gateway.persuadeHero.mockReturnValueOnce(old.promise);
  else f.gateway.listPlayerBag.mockReturnValueOnce(old.promise);
  f.start(); await flush(); f.panel.detach(); f.panel.attach(); f.panel.toggleHero(); await flush();
  const next = deferred(); f.gateway.persuadeHero.mockReturnValueOnce(next.promise); f.select(); f.start();
  expect(f.gateway.persuadeHero).toHaveBeenCalledTimes(2);
  f.patch.mockClear(); f.status.mockClear(); const epoch = captureAssetRead(f.port);
  old.resolve(phase === "confirmation" ? { friend_delta: 10 } : { items: [] }); await flush();
  expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(epoch()).toBe(true);
  expect(f.button().disabled).toBe(true); next.reject(new Error("test cleanup")); await flush();
});

it("double click and target refresh during submission issue one mutation", async () => {
  const f = await setup(), mutation = deferred(); f.gateway.persuadeHero.mockReturnValueOnce(mutation.promise);
  f.start(); f.button().click(); f.select(); f.button().click(); f.button("refresh-persuade-targets").click();
  expect(f.gateway.persuadeHero).toHaveBeenCalledExactlyOnceWith(1, 1, 1002);
  expect(f.gateway.listPersuadeTargets).toHaveBeenCalledTimes(1);
  f.gateway.listPlayerBag.mockResolvedValueOnce({ items: [] }); mutation.resolve({ friend_delta: 10 }); await flush();
  expect(f.text("preview")).toContain("张飞"); expect(f.text("meta")).toContain("关羽游说成功");
});

it.each(["befriend", "hire"])("%s keeps LionizeHero semantics without inventory or gold arithmetic", async action => {
  const f = await setup(1, action), wallet = f.session().wallet; f.start(); await flush();
  expect(f.gateway.lionizeHero).toHaveBeenCalledExactlyOnceWith(1, 1, 1002);
  expect(f.gateway.persuadeHero).not.toHaveBeenCalled(); expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(1);
  expect(f.gateway.getCityState).not.toHaveBeenCalled(); expect(f.session().wallet).toBe(wallet);
  expect(f.status.mock.calls.some(([s]) => s.includes(action === "hire" ? "已招入" : "已结交"))).toBe(true);
  expect(f.gateway.listPlayerHeroes).toHaveBeenCalledTimes(action === "hire" ? 2 : 1);
});

it("actual GatewayClient/protobuf ordinary last-scroll path reads the authoritative empty bag", async () => {
  const types = getTypes(); let books = 1, friend = 10; const routes: string[] = [];
  const gateway = new GatewayClient();
  const packet = (name: string, value: object) => Uint8Array.from(types.ServerPacket.encode({ code: 0,
    data: (types as any)[`${name}Response`].encode(value).finish() }).finish()).buffer;
  vi.spyOn(gateway as any, "sendAndWait").mockImplementation(async (wire: any) => {
    const request = types.ClientPacket.decode(wire) as any, name = request.route.split(".").at(-1); routes.push(name);
    if (name === "PersuadeHero") {
      expect(types.PersuadeHeroRequest.toObject(types.PersuadeHeroRequest.decode(request.payload), { longs: Number }))
        .toMatchObject({ server_id: 1, city_id: 1, npc_cfg_id: 1002 });
      books--; friend += 10; return packet(name, { npc_cfg_id: 1002, friend, friend_delta: 10, next_persuade_at_ms: Date.now() + 86400000 });
    }
    const fixtures: Record<string, object> = { Login: { session_id: "test-session" }, ListPlayerHeroes: { heroes: [] },
      ListRecruitTemplates: { templates: [] }, ListHotelRecruitCandidates: { candidates: [] }, ListCaptiveHeroes: { captives: [] },
      ListComingHeroes: { coming: [] }, ListPlayerBag: { items: books ? [{ item_cfg_id: 2004, quantity: books }] : [] },
      ListPersuadeTargets: { targets: [
        { npc_cfg_id: 1002, display_name: "关羽", state: 1, friend, hire_friend_min: 30, next_persuade_at_ms: friend > 10 ? Date.now() + 86400000 : 0 },
        { npc_cfg_id: 1003, display_name: "张飞", state: 1, friend: 10, hire_friend_min: 30 },
      ] } };
    expect(fixtures[name], `unexpected route ${name}`).toBeDefined(); return packet(name, fixtures[name]);
  });
  await gateway.login("test-player", "test-only", 1);
  const session = { serverId: 1, cityId: 1, player: { player_id: 7 }, wallet: { gold: 10000 }, bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const root = document.createElement("div"); document.body.append(root);
  const panel = new HeroMailPanels(root, gateway, () => session, p => { Object.assign(session, p); panel.refreshRecruitAffordability(); }, () => {});
  panels.push(panel); panel.attach(); panel.toggleHero(); await flush();
  root.querySelectorAll<HTMLDetailsElement>("details").forEach(d => { d.open = true; });
  root.querySelector<HTMLButtonElement>('[data-action="persuade-primary"]')!.click(); await flush();
  root.querySelector<HTMLElement>('li[data-npc-cfg-id="1003"]')!.click();
  expect(books).toBe(0); expect(session.bag).toEqual([]);
  expect(routes.slice(-3)).toEqual(["PersuadeHero", "ListPlayerBag", "ListPersuadeTargets"]);
  expect(root.querySelector('[data-role="persuade-preview"]')?.textContent).toContain("当前 0");
  expect(root.querySelector<HTMLButtonElement>('[data-action="persuade-primary"]')!.disabled).toBe(true);
});
