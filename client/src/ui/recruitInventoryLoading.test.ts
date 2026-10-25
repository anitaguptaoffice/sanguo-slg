import { beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
beforeEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
function setup(listPlayerBag = vi.fn().mockResolvedValue({ items: [] })) {
  let session: MainCitySession = { serverId: 1, player: { player_id: 1 }, cityId: 1,
    cityName: "城", wallet: { food: 100 }, buildings: [], cityTroops: [], bag: [] };
  const mount = document.createElement("div"); document.body.append(mount);
  const gateway = { listPlayerBag, getBoundServerId: () => 1,
    listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [{ template_cfg_id: 1001,
      recruit_cost: { food: 10 }, recruit_item: { item_cfg_id: 2004, quantity: 1 } }] }),
    listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [] }),
    listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
    recruitHero: vi.fn().mockResolvedValue({ hero_id: 1 }),
    getCityState: vi.fn().mockResolvedValue({ wallet: { food: 90 } }),
  } as unknown as GatewayPort;
  const patch = vi.fn((value: Partial<MainCitySession>) => { session = { ...session, ...value }; });
  const panels = new HeroMailPanels(mount, gateway, () => session, patch, () => {});
  panels.attach();
  const button = () => mount.querySelector<HTMLButtonElement>('[data-action="recruit-hero"]')!;
  return { panels, mount, patch, button, gateway, session: () => session,
    switchSession: () => { session = { ...session, player: { player_id: 2 }, bag: [] }; } };
}
it("first open waits for inventory and enables the real book without opening backpack", async () => {
  const bag = deferred<{ items: { item_cfg_id: number; quantity: number }[] }>();
  const load = vi.fn(() => bag.promise); const h = setup(load);
  h.panels.toggleHero(); await flush();
  expect(h.button().disabled).toBe(true);
  expect(h.mount.querySelector('[data-role="recruit-preview"]')?.textContent).toContain("加载背包");
  h.panels.toggleHero(); h.panels.toggleHero();
  expect(load).toHaveBeenCalledTimes(1);
  bag.resolve({ items: [{ item_cfg_id: 2004, quantity: 1 }] }); await flush();
  expect(h.button().disabled).toBe(false);
  expect(h.patch).toHaveBeenCalledTimes(1);
  h.panels.detach();
});
it("loaded empty inventory remains insufficient", async () => {
  const h = setup(); h.panels.toggleHero(); await flush();
  expect(h.button().disabled).toBe(true);
  expect(h.mount.querySelector('[data-role="recruit-form-error"]')?.textContent).toContain("不足");
  h.panels.detach();
});
it("failed inventory is retriable without reporting a false zero", async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({ items: [{ item_cfg_id: 2004, quantity: 1 }] });
  const h = setup(load); h.panels.toggleHero(); await flush();
  expect(h.button().disabled).toBe(true);
  expect(h.mount.querySelector('[data-role="recruit-form-error"]')?.textContent).toContain("加载失败");
  h.mount.querySelector<HTMLButtonElement>('[data-action="retry-recruit-bag"]')!.click();
  await flush(); expect(h.button().disabled).toBe(false); h.panels.detach();
});
for (const change of ["session", "closed", "detached"] as const) {
  it(`discards inventory response after ${change}`, async () => {
    const bag = deferred<{ items: [] }>(); const h = setup(vi.fn(() => bag.promise));
    h.panels.toggleHero();
    if (change === "session") h.switchSession();
    if (change === "closed") h.panels.toggleHero();
    if (change === "detached") h.panels.detach();
    bag.resolve({ items: [] }); await flush(); expect(h.patch).not.toHaveBeenCalled();
    h.panels.detach();
  });
}
it("locks recruit before the asynchronous daily preflight", async () => {
  const h = setup(vi.fn().mockResolvedValue({ items: [{ item_cfg_id: 2004, quantity: 1 }] }));
  const daily = deferred<{ quests: [] }>();
  vi.mocked(h.gateway.listPlayerQuests).mockReturnValueOnce(daily.promise);
  h.panels.toggleHero(); await flush(); h.button().click(); h.button().click();
  expect(h.gateway.listPlayerQuests).toHaveBeenCalledTimes(1);
  daily.resolve({ quests: [] }); await flush(); await flush();
  expect(h.gateway.recruitHero).toHaveBeenCalledTimes(1); h.panels.detach();
});
it("new account request wins over an older account's late inventory", async () => {
  const old = deferred<{ items: { item_cfg_id: number; quantity: number }[] }>();
  const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ items: [] });
  const h = setup(load); h.panels.toggleHero(); await flush(); h.switchSession();
  h.panels.toggleHero(); h.panels.toggleHero(); await flush();
  old.resolve({ items: [{ item_cfg_id: 2004, quantity: 99 }] }); await flush();
  expect(h.patch).toHaveBeenCalledTimes(1); expect(h.session().bag).toEqual([]);
  expect(h.button().disabled).toBe(true); h.panels.detach();
});
it("account change during daily preflight never sends recruit under the new account", async () => {
  const h = setup(vi.fn().mockResolvedValue({ items: [{ item_cfg_id: 2004, quantity: 1 }] }));
  const daily = deferred<{ quests: [] }>();
  vi.mocked(h.gateway.listPlayerQuests).mockReturnValueOnce(daily.promise);
  h.panels.toggleHero(); await flush(); h.button().click(); h.switchSession();
  daily.resolve({ quests: [] }); await flush();
  expect(h.gateway.recruitHero).not.toHaveBeenCalled(); h.panels.detach();
});
