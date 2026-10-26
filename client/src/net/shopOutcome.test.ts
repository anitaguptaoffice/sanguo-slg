import { describe, expect, it, vi } from "vitest";
import { isKnownShopRejection, readShopCurrentState, SHOP_RELOAD_FAILED } from "./shopOutcome";
import { beginAssetRead } from "./questClaimAssets";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession } from "./bootstrapSession";

function fixture() {
  const session = { serverId: 2, cityId: 9, bag: [{ item_cfg_id: 2004, quantity: 4 }], wallet: { gold: 20 } } as MainCitySession;
  let current = true;
  const gateway = {
    listPlayerBag: vi.fn(async () => ({ items: [{ item_cfg_id: 2004, quantity: 1 }, { item_cfg_id: 2001, quantity: 3 }] })),
    getCityState: vi.fn(async () => ({ wallet: { gold: 10 } })),
    listShopShelf: vi.fn(async () => ({ offers: [{ offer_id: 1001, purchased_count: 3 }] })),
  };
  return { session, gateway, switchActor: () => { current = false; },
    read: () => readShopCurrentState(gateway as unknown as GatewayPort, () => session, () => current) };
}

describe("SHOP authoritative current-state read", () => {
  it("reads all snapshots without publishing or merging a grant delta", async () => {
    const f = fixture(), result = await f.read();
    expect(f.gateway.listPlayerBag).toHaveBeenCalledWith(2);
    expect(f.gateway.getCityState).toHaveBeenCalledWith(9);
    expect(f.gateway.listShopShelf).toHaveBeenCalledWith(2);
    expect(result).toMatchObject({ bag: [{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }], wallet: { gold: 10 }, offers: [{ purchased_count: 3 }] });
    expect(f.session.bag[0].quantity).toBe(4); expect(f.session.wallet.gold).toBe(20);
  });
  it.each(["epoch", "bag", "wallet", "actor"])("rejects stale %s at the consumption boundary", async change => {
    const f = fixture(), result = await f.read(); expect(result?.fresh()).toBe(true);
    if (change === "epoch") beginAssetRead(f.gateway as unknown as GatewayPort);
    if (change === "bag") f.session.bag = [];
    if (change === "wallet") f.session.wallet = { gold: 90 };
    if (change === "actor") f.switchActor();
    expect(result?.fresh()).toBe(false);
  });
  it.each(["listPlayerBag", "getCityState", "listShopShelf"] as const)("propagates %s failure", async method => {
    const f = fixture(); f.gateway[method].mockRejectedValueOnce(new Error("read unavailable"));
    await expect(f.read()).rejects.toThrow("read unavailable");
    expect(f.session.wallet.gold).toBe(20);
  });
  it("fails closed without a city wallet", async () => {
    const f = fixture(); f.gateway.getCityState.mockResolvedValueOnce({} as never);
    await expect(f.read()).rejects.toThrow(SHOP_RELOAD_FAILED);
  });
  it("discards an old actor result", async () => {
    const f = fixture(), read = f.read(); f.switchActor();
    expect(await read).toBeNull();
  });
});

describe("SHOP known rejection boundary", () => {
  it.each(["offer not found", "shop: purchase_count must be positive", "shop: purchase limit exceeded"])("recognizes pre-write rejection %s", message => {
    expect(isKnownShopRejection(Object.assign(new Error(message), { code: 10001 }))).toBe(true);
  });
  it.each([new Error("gateway timeout"), { code: 10002 }, { code: 10001, message: "shop: sold out" },
    { code: 10001, message: "shop: insufficient items" }, { code: 10001, message: "unknown validation" }])("does not infer rollback from %j", error => {
    expect(isKnownShopRejection(error)).toBe(false);
  });
});
