import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { ContentPanels } from "./ContentPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY } from "@/net/heroDetailBagDeepLink";
const clean: Array<() => void> = [];
const flush = () => new Promise(r => setTimeout(r, 0));
const actions = ["hero-goto-bag-cultivation", "hero-related-items"] as const;
const items = [{ item_cfg_id: 2017, quantity: 3 }];
beforeEach(() => sessionStorage.clear());
afterEach(() => { clean.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; });
async function setup() {
  let queueing = false, generation = 1;
  const queue: Array<{ route: string; finish: (fail?: boolean) => void }> = [];
  const rpc = (route: string, result: unknown) => queueing
    ? new Promise((resolve, reject) => queue.push({ route, finish: fail => fail ? reject(new Error("old bag failure")) : resolve(result) }))
    : Promise.resolve(result);
  const gateway = {
    getBoundServerId: () => 1, getSessionId: () => "token", getSessionGeneration: () => generation,
    listPlayerHeroes: vi.fn(() => rpc("heroes", { heroes: [{ hero_id: 7 }, { hero_id: 8 }], total_count: 2 })),
    getHeroDetail: vi.fn((_sid: number, id: number) => rpc(`detail${id}`, { hero_id: id, template_name: `Hero ${id}`, template_cfg_id: 1001, level: 2 })),
    listPlayerBag: vi.fn(() => rpc("bag", { items })),
    listShopShelf: vi.fn(() => rpc("shop", { offers: [] })),
  };
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { gold: 10000 },
    bag: items, buildings: [], cityTroops: [] } as MainCitySession;
  const mount = document.createElement("div"); document.body.append(mount);
  const status = vi.fn(), patch = (p: Partial<MainCitySession>) => Object.assign(session, p);
  const content = new ContentPanels(mount, gateway as unknown as GatewayPort, () => session, patch, status);
  const onBag = vi.fn(link => content.openBagFromHeroDeepLink(link));
  const hero = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, patch, status,
    undefined, undefined, undefined, undefined, undefined, undefined, onBag);
  content.attach(); hero.attach(); hero.toggleHero(); await flush();
  const select = (id: number) => mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
  select(7); await flush(); queueing = true; gateway.listPlayerBag.mockClear(); status.mockClear();
  clean.push(() => { hero.detach(); content.detach(); });
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const drain = async (failFirst = false) => { let n = 0; while (queue.length) { if (++n > 20) throw new Error("unexpected request loop"); queue.shift()!.finish(failFirst && n === 1); await flush(); } };
  return { hero, content, mount, onBag, status, gateway, session, queue, click, select, drain,
    rpc, raw: hero as any, relogin: () => { generation++; } };
}
it.each(actions)("%s normal link preserves original hero and opens real bag", async action => {
  const f = await setup(); f.click(action); expect(f.queue.map(q => q.route)).toEqual(["bag"]); await f.drain();
  expect(f.onBag).toHaveBeenCalledTimes(1); expect(f.onBag.mock.calls[0][0]).toMatchObject({ returnHeroId: 7, highlightItemId: 2017 });
  expect(f.mount.querySelector('[data-center-panel="bag"]')?.classList.contains("hidden")).toBe(false);
  expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(2);
});
for (const action of actions) {
  it.each(["shop", "close", "select", "back", "recruit", "reopen", "samehero", "aba", "relogin", "city", "detach"])(`${action}: newer %s navigation wins in FIFO order`, async mode => {
    const f = await setup(); f.click(action);
    if (mode === "shop") f.content.toggleShop();
    if (mode === "close") f.hero.toggleHero();
    if (mode === "select") f.select(8);
    if (mode === "back") f.click("hero-back-to-list");
    if (mode === "recruit") f.click("hero-goto-recruit");
    if (mode === "reopen") { f.hero.toggleHero(); f.hero.toggleHero(); }
    if (mode === "samehero") f.select(7);
    if (mode === "aba") { f.select(8); f.select(7); }
    if (mode === "relogin") f.relogin();
    if (mode === "city") f.session.cityId = 2;
    if (mode === "detach") { f.hero.detach(); f.hero.attach(); f.hero.toggleHero(); }
    const before = sessionStorage.getItem(HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY);
    await f.drain(); expect(f.onBag).not.toHaveBeenCalled();
    expect(f.mount.querySelector('[data-center-panel="bag"]')?.classList.contains("hidden")).toBe(true);
    expect(sessionStorage.getItem(HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY)).toBe(before);
    expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(mode === "reopen" || mode === "detach" ? 2 : 1);
  });
  it(`${action}: stale read failure and cached fallback cannot reopen or overwrite feedback`, async () => {
    const f = await setup(); f.click(action); f.content.toggleShop(); f.status.mockClear();
    await f.drain(true); expect(f.onBag).not.toHaveBeenCalled();
    expect(f.status.mock.calls.flat().join(" ")).not.toContain("old bag failure");
    expect(f.mount.querySelector('[data-role="hero-cultivation-form-error"]')?.textContent ?? "").not.toContain("old bag failure");
  });
}
it("related-items retains current-view cached fallback", async () => {
  const f = await setup(); f.click("hero-related-items"); await f.drain(true);
  expect(f.onBag).toHaveBeenCalledTimes(1); expect(f.onBag.mock.calls[0][0].returnHeroId).toBe(7);
});
it("latest bag link wins even when the earlier response arrives first", async () => {
  const f = await setup(); f.click(actions[0]); f.click(actions[1]);
  expect(f.queue.map(q => q.route)).toEqual(["bag", "bag"]);
  f.queue.shift()!.finish(); await flush(); expect(f.onBag).not.toHaveBeenCalled();
  await f.drain(); expect(f.onBag).toHaveBeenCalledTimes(1); expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(3);
});

it.each(actions)("a pending point receipt does not cancel newer %s navigation", async action => {
  const f = await setup();
  (f.gateway as any).addHeroPoint = vi.fn(() => f.rpc("points", {
    hero_id: 7, potential_remaining: 1, force_add: 1, intel_add: 0, politics_add: 0,
    attributes: { force: 1, intel: 0, politics: 0 },
  }));
  const point = f.mount.querySelector<HTMLButtonElement>('[data-action="hero-point-add"][data-stat="force"]')!;
  expect(point.disabled).toBe(false); point.click(); f.click(action);
  expect(f.queue.map(q => q.route)).toEqual(["points", "bag"]);
  await f.drain(); expect(f.raw.heroDetail.force_add).toBe(1);
  expect(f.onBag).toHaveBeenCalledTimes(1); expect(f.onBag.mock.calls[0][0].returnHeroId).toBe(7);
});
