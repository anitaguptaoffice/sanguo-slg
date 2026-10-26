import { beforeEach, expect, it, vi } from "vitest";
import { GatewayClient } from "@/net/GatewayClient";
import { getTypes, Routes } from "@/net/loadProto";
import { CityStateFetch } from "@/net/cityStateFetch";
import type { MainCitySession } from "@/net/bootstrapSession";
import { HeroMailPanels } from "./HeroMailPanels";
import { ContentPanels } from "./ContentPanels";

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred() {
  let resolve!: (value: ArrayBuffer) => void, reject!: (reason: Error) => void;
  const promise = new Promise<ArrayBuffer>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const types = getTypes();
function packet(type: keyof typeof types, value: object) {
  return Uint8Array.from(types.ServerPacket.encode({ code: 0, data: types[type].encode(value).finish() }).finish()).buffer;
}
beforeEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
const actions = [
  ["recruit-hotel-candidate", "RecruitHotelCandidate"], ["refresh-hotel-pool", "RefreshHotelRecruitPool"],
  ["recruit-hero", "RecruitHero"], ["captive-summon-confirm", "SureSummonCaptive"],
  ["befriend", "LionizeHero"], ["persuade", "PersuadeHero"], ["use-item", "UseConsumable"],
] as const;
for (const [action, method] of actions) {
  it.each(["success", "unknown"])(`protobuf ${method} rejects during-RPC city snapshots on %s`, async outcome => {
    let session: MainCitySession = { serverId: 1, cityId: 7, cityName: "城", player: {player_id: 1},
      wallet: {food: 100, gold: 10000}, bag: [{item_cfg_id:2001,quantity:3},{item_cfg_id:2004,quantity:3}], buildings: [], cityTroops: [] };
    const gateway = new GatewayClient(), mutation = deferred(), oldCity = deferred();
    let holdCity = false, committed = false;
    const wireRoutes: string[] = [];
    const pool = {candidates:[{candidate_id:11,display_name:"甲",gold_cost:10}],hotel_level:1,hero_capacity:5,hero_owned:0};
    const send = vi.spyOn(gateway as never, "sendAndWait").mockImplementation((wire: Uint8Array) => {
      const request = types.ClientPacket.decode(wire) as unknown as {route:string;payload:Uint8Array};
      wireRoutes.push(request.route);
      const name = request.route.split(".").at(-1)!;
      if (name === method) {
        const body = types[`${method}Request`].decode(request.payload) as unknown as {server_id:number};
        expect(body.server_id).toBe(1); return mutation.promise;
      }
      if (name === "GetCityState" && holdCity) { holdCity = false; return oldCity.promise; }
      const fixtures: Record<string, object> = {
        Login: {session_id:"token"}, ListPlayerHeroes:{heroes:[]}, ListPlayerQuests:{quests:[]}, ListComingHeroes:{coming:[]},
        ListPlayerBag:{items:committed ? [{item_cfg_id:2004,quantity:2}] : session.bag},
        GetCityState:{wallet:committed ? {food:90,gold:9500} : session.wallet},
        ListRecruitTemplates:{templates:[{template_cfg_id:1001,recruit_cost:{food:10},recruit_item:{item_cfg_id:2004,quantity:1}}]},
        ListHotelRecruitCandidates:pool, ListCaptiveHeroes:{captives:[{hero_id:21,city_id:7,display_name:"俘虏"}]},
        TrySummonCaptive:{hero_id:21,gold_cost:500,items:[{item_cfg_id:2004,quantity:1}]},
        ListPersuadeTargets:{targets:[{npc_cfg_id:1,display_name:"甲",state:action === "befriend" ? 0 : 1,level:1,friend:0,hire_friend_min:30}]},
      };
      expect(fixtures[name], `unexpected wire route ${name}`).toBeDefined();
      return Promise.resolve(packet(`${name}Response` as keyof typeof types, fixtures[name]));
    });
    await gateway.login("actor", "not-stored", 1);
    const mount = document.createElement("div"); document.body.append(mount);
    const patch = vi.fn((value: Partial<MainCitySession>) => {session={...session,...value}});
    const fetch = new CityStateFetch(gateway, () => 7, () => `token:${session.player?.player_id}`);
    const hero = new HeroMailPanels(mount,gateway,()=>session,patch,()=>{},undefined,fetch);
    const content = new ContentPanels(mount,gateway,()=>session,patch,()=>{});
    hero.attach(); content.attach();
    if (method === "UseConsumable") content.toggleBag(); else hero.toggleHero();
    await flush(); patch.mockClear();
    const buttonAction = action === "befriend" || action === "persuade" ? "persuade-primary" : action;
    const button = mount.querySelector<HTMLButtonElement>(`[data-action="${buttonAction}"]`)!;
    expect(button.disabled).toBe(false); button.click(); await flush();
    expect(wireRoutes.filter(route => route === Routes[method])).toHaveLength(1);
    holdCity = true; const pending = fetch.fetch();
    if (method === "RecruitHotelCandidate" || method === "RefreshHotelRecruitPool") hero.toggleHero();
    if (outcome === "success") {
      committed = true;
      const value = method === "RefreshHotelRecruitPool" ? pool : method === "UseConsumable"
        ? {remaining:2,wallet_after:{food:1100,gold:10000}} : {hero_id:42,befriended:true,friend_delta:10};
      mutation.resolve(packet(`${method}Response`, value));
    } else mutation.reject(new Error("gateway timeout"));
    await flush(); oldCity.resolve(packet("GetCityStateResponse",{wallet:{food:100,gold:10000}}));
    expect(await pending).toBeNull(); await flush();
    if (outcome === "success" && (method === "RecruitHero" || method === "SureSummonCaptive")) {
      expect(session.wallet).toMatchObject({food:90,gold:9500}); expect(session.bag).toEqual([{item_cfg_id:2004,quantity:2}]);
    }
    expect(wireRoutes.filter(route => route === Routes[method])).toHaveLength(1);
    expect(session.player?.level).toBeUndefined();
    hero.detach(); content.detach(); send.mockRestore();
  });
}
