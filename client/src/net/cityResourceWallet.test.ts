import { afterEach, expect, it, vi } from "vitest";
import { getProtoRoot } from "./loadProto";
import { decodeGatewayResponse } from "./decodeGatewayResponse";
import { bootstrapMainCity, type MainCitySession } from "./bootstrapSession";
import type { GatewayPort } from "./GatewayClient";
import { refreshQuestAssets } from "./questClaimAssets";
import { readHotelCurrentState } from "./hotelOutcome";
import { readShopCurrentState } from "./shopOutcome";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { QueuePanels } from "@/ui/QueuePanels";
import { MainCityScene } from "@/scenes/MainCityScene";
const panels: { detach(): void }[] = [];
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; });
function wire(name = "sanguo.domestic.v1.GetCityStateResponse") {
 const type = getProtoRoot().lookupType(name);
 return decodeGatewayResponse(type, type.encode(type.fromObject({ wallet: { food: 0, wood: 8, iron: 9, stone: 10 } })).finish()) as any;
}
function fixture() {
 const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { gold: 700, food: 20 }, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
 const gateway = { getSessionId: () => "a", getSessionGeneration: () => 1, getBoundServerId: () => 1, listPlayerBag: vi.fn(async () => ({ items: [] })), getCityState: vi.fn(async () => wire()), listPlayerHeroes: vi.fn(async () => ({ heroes: [] })), listShopShelf: vi.fn(async () => ({ offers: [] })), listHotelRecruitCandidates: vi.fn(async () => ({ candidates: [] })) };
 const patch = (value: Partial<MainCitySession>) => Object.assign(session, value);
 return { session, gateway: gateway as unknown as GatewayPort, patch };
}
it("production protobuf defaults synthesize gold zero for the four-resource city wire payload", () => {
 expect(getProtoRoot().lookupType("sanguo.common.v1.ResourceWallet").fields.gold.id).toBe(5);
 expect(wire().wallet).toEqual({ food: 0, wood: 8, iron: 9, stone: 10, gold: 0 });
});
it.each([700, 0])("bootstrap retains authoritative entry gold %s, even when login had 999", async gold => {
 const f = fixture(); Object.assign(f.gateway, { login: vi.fn(async () => ({ wallet: { gold: 999 } })), enterGameServer: vi.fn(async () => ({ wallet: { gold } })), listPlayerCities: vi.fn(async () => ({ cities: [{ city_id: 1 }] })) });
 const session = await bootstrapMainCity(f.gateway, "player", "unused", 1); expect(session.wallet.gold).toBe(gold); expect(session.wallet.food).toBe(0);
});
it.each(["quest", "hotel", "shop", "hero"])("%s city refresh preserves existing player gold and accepts true zero city resources", async kind => {
 const f = fixture(); let wallet;
 if (kind === "quest") { await refreshQuestAssets(f.gateway, () => f.session, f.patch); wallet = f.session.wallet; }
 else if (kind === "hotel") wallet = (await readHotelCurrentState(f.gateway, () => f.session, () => true, false))!.wallet;
 else if (kind === "shop") wallet = (await readShopCurrentState(f.gateway, () => f.session, () => true))!.wallet;
 else { const p = new HeroMailPanels(document.createElement("div"), f.gateway, () => f.session, f.patch, () => {}); panels.push(p); await (p as any).syncEconomyAfterRecruit(); wallet = f.session.wallet; }
 expect(wallet.gold).toBe(700); expect(wallet.food).toBe(0); expect(wallet.wood).toBe(8);
});
it("queue refresh uses only city resources", async () => {
 const f = fixture(), p = new QueuePanels(document.createElement("div"), f.gateway, () => f.session, {}, () => {}, () => {}, () => {}); panels.push(p); p.attach(); p.open(); await (p as any).refreshCityState(); expect(f.session.wallet.gold).toBe(700); expect(f.session.wallet.food).toBe(0);
});
it("main-city snapshot application uses city resources without clobbering gold", () => {
 const f = fixture(), s = new MainCityScene() as any; Object.assign(s, { session: f.session, cityStateFetch: { isCurrent: () => true }, patchSession: f.patch, buildCompleteTodos: { onCityBuildings: () => {}, pendingSlotKeys: () => [] }, renderHud: () => {}, syncSlotUpgradeOverlay: () => {} });
 const state = wire(); delete state.buildings; s.applyCityStateFromFetch(state); expect(f.session.wallet.gold).toBe(700); expect(f.session.wallet.food).toBe(0);
});
it("source-specific merging preserves gold but accepts zero resources and absent wallet", async () => {
 const { mergeCityResourceWallet } = await import("./cityResourceWallet");
 const current = { gold: 700, food: 20, wood: 15 };
 expect(mergeCityResourceWallet(current, null)).toBe(current);
 expect(mergeCityResourceWallet(current, { gold: 999, food: 0 })).toEqual({ gold: 700, food: 0, wood: 15 });
 expect(current.food).toBe(20);
});
it("real authoritative consumable gold zero is accepted and stays zero after city refresh", async () => {
 const { useBagItemWithAssets } = await import("./bagUseAssets");
 const f = fixture(); f.session.bag = [{ item_cfg_id: 2001, quantity: 1 }];
 Object.assign(f.gateway, { useConsumable: vi.fn(async () => ({ remaining: 0, wallet_after: { gold: 0, food: 80 } })) });
 await useBagItemWithAssets(f.gateway, 2001, 1, () => f.session, f.patch, () => true);
 expect(f.session.wallet.gold).toBe(0); await refreshQuestAssets(f.gateway, () => f.session, f.patch); expect(f.session.wallet.gold).toBe(0);
});
it("building wallet receipt cannot erase player gold", async () => {
 const f = fixture(), s = new MainCityScene() as any; Object.assign(f.gateway, { startBuildingUpgrade: vi.fn(async () => wire("sanguo.domestic.v1.StartBuildingUpgradeResponse")) });
 Object.assign(s, { session: f.session, gateway: f.gateway, buildingPanel: { setFormError: () => {}, sync: () => {} }, renderHud: () => {}, refreshState: async () => {}, hud: document.createElement("div") });
 await s.startBuildingUpgrade("hall", 1); expect(f.session.wallet.gold).toBe(700); expect(f.session.wallet.food).toBe(0); expect(f.gateway.startBuildingUpgrade).toHaveBeenCalledTimes(1);
});
it("troop recruitment wallet receipt cannot erase player gold", async () => {
 const f = fixture(), s = new MainCityScene() as any, military = document.createElement("div");
 military.innerHTML = '<select data-field="unit"><option value="1">步兵</option></select><input data-field="recruit-count" value="1" />';
 f.session.wallet = { gold: 700, food: 10000, wood: 10000, iron: 10000, stone: 10000 };
 Object.assign(f.gateway, { recruitTroop: vi.fn(async () => wire("sanguo.military.v1.RecruitTroopResponse")) });
 Object.assign(s, { session: f.session, gateway: f.gateway, militaryPanel: military, renderHud: () => {}, syncMilitaryPanel: () => {}, hud: document.createElement("div"), cityStateFetch: { clear: () => {} }, queuePanels: { addRecruitEntry: () => {} } });
 await s.recruit(); expect(f.gateway.recruitTroop).toHaveBeenCalledTimes(1); expect(f.session.wallet.gold).toBe(700); expect(f.session.wallet.food).toBe(0);
});
