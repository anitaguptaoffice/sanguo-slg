import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { ContentPanels } from "@/ui/ContentPanels";
import { beginAssetRead, captureAssetRead } from "@/net/questClaimAssets";
import { CityStateFetch } from "@/net/cityStateFetch";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
function deferred<T = any>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((a,b) => {resolve=a;reject=b}); return {promise,resolve,reject}; }
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
async function setup(action: "template" | "captive" | "befriend" | "persuade", start = true) {
  let generation = 1;
  let session: MainCitySession = { serverId: 1, cityId: 1, cityName: "城", player: {player_id: 1},
    wallet: {food: 100, gold: 10000}, bag: [{item_cfg_id: 2004, quantity: 3}], buildings: [], cityTroops: [] };
  const root = document.createElement("div"); document.body.append(root);
  const mutation = deferred();
  const gateway = {
    getBoundServerId: () => 1, getSessionId: () => "token", getSessionGeneration: () => generation,
    listPlayerBag: vi.fn().mockResolvedValue({items: session.bag}),
    getCityState: vi.fn().mockResolvedValue({wallet: {food: 90, gold: 9500}}),
    listPlayerHeroes: vi.fn().mockResolvedValue({heroes: []}),
    listRecruitTemplates: vi.fn().mockResolvedValue({templates: [{template_cfg_id:1001, recruit_cost:{food:10}, recruit_item:{item_cfg_id:2004,quantity:1}}]}),
    listPlayerQuests: vi.fn().mockResolvedValue({quests:[]}),
    listHotelRecruitCandidates: vi.fn().mockResolvedValue({candidates:[]}),
    listCaptiveHeroes: vi.fn().mockResolvedValue({captives:[{hero_id: 21, city_id:1,display_name:"俘虏"}]}),
    listComingHeroes: vi.fn().mockResolvedValue({coming:[]}),
    listPersuadeTargets: vi.fn().mockResolvedValue({targets:[{npc_cfg_id:1,display_name:"甲",state:action === "befriend" ? 0 : 1,level:1,friend:0,hire_friend_min:30}]}),
    trySummonCaptive: vi.fn().mockResolvedValue({hero_id:21,gold_cost:500,items:[{item_cfg_id:2004,quantity:1}],summary:"费用500金币和1道具"}),
    sureSummonCaptive: vi.fn().mockReturnValue(mutation.promise),
    lionizeHero: vi.fn().mockReturnValue(mutation.promise),
    persuadeHero: vi.fn().mockReturnValue(mutation.promise),
    recruitHero: vi.fn().mockReturnValue(mutation.promise),
  };
  const port = gateway as unknown as GatewayPort;
  const patch = vi.fn((value: Partial<MainCitySession>) => {session={...session,...value}});
  const fetch = new CityStateFetch(port, () => 1, () => `token:${session.player?.player_id}:1`);
  const panels = new HeroMailPanels(root,port,()=>session,patch,()=>{},undefined,fetch);
  panels.attach(); panels.toggleHero(); await flush();
  for (const details of root.querySelectorAll<HTMLDetailsElement>("details")) details.open = true;
  patch.mockClear();
  const actions = {template:"recruit-hero",captive:"captive-summon-confirm",befriend:"persuade-primary",persuade:"persuade-primary"};
  const methods = {template:gateway.recruitHero,captive:gateway.sureSummonCaptive,befriend:gateway.lionizeHero,persuade:gateway.persuadeHero};
  const button = root.querySelector<HTMLButtonElement>(`[data-action="${actions[action]}"]`)!;
  const submit = async () => { expect(button.disabled).toBe(false); button.click(); await flush(); expect(methods[action]).toHaveBeenCalledTimes(1); };
  if (start) await submit();
  return {root,gateway,port,panels,patch,fetch,mutation,submit,session:()=>session,
    switchActor:()=>{session={...session,player:{player_id:2}}}, relogin:()=>{generation++}};
}
describe("family/template settlement epoch", () => {
  for (const action of ["template", "captive", "befriend"] as const) {
    it.each(["success", "unknown"])(`${action} invalidates during-request city read after %s`, async outcome => {
      const f = await setup(action), old = deferred();
      f.gateway.getCityState.mockReturnValueOnce(old.promise);
      const pending = f.fetch.fetch();
      f.gateway.listPlayerBag.mockResolvedValue({items:[{item_cfg_id:2004,quantity:2}]});
      if (outcome === "success") f.mutation.resolve(action === "befriend" ? {befriended:true,display_name:"甲"} : {hero_id:42,display_name:"新将领"});
      else f.mutation.reject(new Error("gateway timeout"));
      await flush(); old.resolve({wallet:{food:100,gold:10000}});
      const state = await pending; await flush();
      if (outcome === "success" && action !== "befriend") {
        // Production constructor supplies this same CityStateFetch; post-recruit recovery reused pre-commit poll.
        expect(f.session().bag).toEqual([{item_cfg_id:2004,quantity:2}]);
        expect(f.session().wallet).toEqual({food:90,gold:9500});
      }
      expect(state).toBeNull();
    });
  }
  it.each(["success", "unknown"])("persuade invalidates during-request bag read after %s", async outcome => {
    const f = await setup("persuade"), old = deferred();
    const content = new ContentPanels(f.root,f.port,f.session,f.patch,()=>{}); content.attach();
    f.gateway.listPlayerBag.mockReturnValueOnce(old.promise); content.toggleBag();
    expect(f.gateway.listPlayerBag).toHaveBeenCalledTimes(2);
    if (outcome === "success") f.mutation.resolve({friend_delta:10}); else f.mutation.reject(new Error("gateway timeout"));
    await flush(); old.resolve({items:[{item_cfg_id:2004,quantity:3}]}); await flush();
    expect(f.patch).not.toHaveBeenCalled();
  });
});

for (const action of ["template", "captive", "befriend", "persuade"] as const) {
  it(`${action} invalidates reads at submission, not only settlement`, async () => {
    const f = await setup(action, false), before = captureAssetRead(f.port);
    await f.submit(); expect(before()).toBe(false);
    f.mutation.reject(new Error("timeout")); await flush();
  });
  it.each(["actor", "session"])(`${action} old %s cannot invalidate reads or publish success/unknown`, async kind => {
    for (const outcome of ["success", "unknown"]) {
      const f = await setup(action);
      if (kind === "actor") f.switchActor(); else f.relogin();
      const current = beginAssetRead(f.port);
      if (outcome === "success") f.mutation.resolve({hero_id:42,befriended:true,friend_delta:10});
      else f.mutation.reject(new Error("timeout"));
      await flush(); expect(current()).toBe(true); expect(f.patch).not.toHaveBeenCalled();
      expect(f.gateway.getCityState).not.toHaveBeenCalled();
    }
  });
}
for (const action of ["template", "captive"] as const) {
  it.each(["actor", "session", "assets", "wallet", "bag"])(`${action} aggregate recovery rejects newer %s`, async kind => {
    const f = await setup(action), bag = deferred();
    f.gateway.listPlayerBag.mockReturnValueOnce(bag.promise);
    f.mutation.resolve({hero_id:42}); await flush();
    expect(f.gateway.getCityState).toHaveBeenCalledTimes(1);
    if (kind === "actor") f.switchActor();
    if (kind === "session") f.relogin();
    if (kind === "assets") beginAssetRead(f.port);
    if (kind === "wallet") f.session().wallet = {gold:8000};
    if (kind === "bag") f.session().bag = [];
    bag.resolve({items:[{item_cfg_id:2004,quantity:2}]}); await flush();
    expect(f.patch).not.toHaveBeenCalled();
  });
}
