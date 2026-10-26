import { describe, expect, it, vi } from "vitest";
import { readHotelCurrentState } from "./hotelOutcome";
import { beginAssetRead } from "./questClaimAssets";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";

function fixture() {
  const session = { serverId: 2, cityId: 9, bag: [], wallet: { gold: 20 } } as unknown as MainCitySession;
  const gateway = {
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 42 }] })),
    listPlayerBag: vi.fn(async () => ({ items: [{ item_cfg_id: 2004, quantity: 3 }] })),
    getCityState: vi.fn(async () => ({ wallet: { gold: 10, food: 50 } })),
    listHotelRecruitCandidates: vi.fn(async () => ({ candidates: [] })),
  };
  return { session, gateway, read: (pool = true) => readHotelCurrentState(gateway as unknown as GatewayPort, () => session, () => true, pool) };
}

describe("hotel current-state snapshots", () => {
  it("uses existing actor-scoped reads, leaves snapshots unpublished and never derives a receipt", async () => {
    const f = fixture(); const result = await f.read();
    expect(f.gateway.listPlayerHeroes).toHaveBeenCalledWith(2);
    expect(f.gateway.listPlayerBag).toHaveBeenCalledWith(2);
    expect(f.gateway.getCityState).toHaveBeenCalledWith(9);
    expect(f.gateway.listHotelRecruitCandidates).toHaveBeenCalledWith(2, 9);
    expect(result).toMatchObject({ heroes: [{ hero_id: 42 }], wallet: { gold: 10, food: 50 }, pool: { candidates: [] } });
    expect(result?.fresh()).toBe(true); expect(f.session.wallet.gold).toBe(20);
  });
  it("does not repeat the pool read after a confirmed paid-refresh snapshot", async () => {
    const f = fixture(); expect((await f.read(false))?.pool).toBeNull();
    expect(f.gateway.listHotelRecruitCandidates).not.toHaveBeenCalled();
  });
  it.each(["epoch", "wallet", "bag"])("rechecks %s freshness at the caller's consumption boundary", async change => {
    const f = fixture(); const snapshot = await f.read(); expect(snapshot?.fresh()).toBe(true);
    if (change === "epoch") beginAssetRead(f.gateway as unknown as GatewayPort);
    if (change === "wallet") f.session.wallet = { gold: 900 };
    if (change === "bag") f.session.bag = [];
    expect(snapshot?.fresh()).toBe(false);
  });
  it.each(["listPlayerHeroes", "listPlayerBag", "getCityState", "listHotelRecruitCandidates"] as const)("propagates %s failure instead of pretending to reload", async method => {
    const f = fixture(); f.gateway[method].mockRejectedValue(new Error("read unavailable"));
    await expect(f.read()).rejects.toThrow("read unavailable"); expect(f.session.wallet.gold).toBe(20);
  });
});
