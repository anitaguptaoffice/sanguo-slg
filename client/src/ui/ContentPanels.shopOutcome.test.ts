import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { beginAssetRead } from "@/net/questClaimAssets";
import { CityStateFetch } from "@/net/cityStateFetch";
import { ContentPanels } from "./ContentPanels";

function deferred<T = unknown>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => sessionStorage.clear());
async function setup() {
  let session: MainCitySession = { serverId: 1, cityId: 11, cityName: "城", player: { player_id: 1 },
    wallet: { gold: 100 }, buildings: [], cityTroops: [], bag: [{ item_cfg_id: 2004, quantity: 4 }] };
  let generation = 1;
  const request = deferred(), purchase = vi.fn().mockReturnValue(request.promise);
  const bag = vi.fn(async () => ({ items: [{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }] }));
  const city = vi.fn(async () => ({ wallet: { gold: 90 } }));
  const shelf = vi.fn(async () => ({ offers: [{ offer_id: 1001, item_cfg_id: 2001,
    quantity_per_purchase: 3, price_resources: { gold: 10 }, purchase_limit: 10, purchased_count: 0 }] }));
  const gateway = { getBoundServerId: () => 1, getSessionId: () => "token", getSessionGeneration: () => generation,
    listPlayerBag: bag, getCityState: city, listShopShelf: shelf, purchaseShopOffer: purchase } as unknown as GatewayPort;
  const mount = document.createElement("div"), status = vi.fn();
  const patch = vi.fn((p: Partial<MainCitySession>) => Object.assign(session, p));
  const panels = new ContentPanels(mount, gateway, () => session, patch, status);
  panels.attach(); panels.toggleShop();
  await vi.waitFor(() => expect(mount.querySelector('[data-offer-id="1001"]')).toBeTruthy());
  const button = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
  const click = (action: string) => button(action).click();
  const settle = async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); };
  const text = (role: string) => mount.querySelector(`[data-role="shop-${role}"]`)?.textContent;
  const success = { granted_items: { items: [{ item_cfg_id: 2001, quantity: 3 }] }, wallet_after: { gold: 90 } };
  patch.mockClear(); status.mockClear();
  return { request, purchase, bag, city, shelf, gateway, mount, patch, status, panels, button, click, settle, text, success,
    session: () => session, switchActor: () => { session = { ...session, player: { player_id: 2 } }; }, relogin: () => { generation++; } };
}

describe("SHOP purchase outcome ownership", () => {
  it("replaces item currency and wallet snapshots rather than delta-merging grants", async () => {
    const f = await setup(); f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
    expect(f.purchase).toHaveBeenCalledWith(1, 1001, 1);
    expect(f.session().bag).toEqual([{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }]);
    expect(f.session().wallet).toEqual({ gold: 90 }); expect(f.shelf).toHaveBeenCalledTimes(2);
    expect(f.text("feedback")).toContain("购买成功"); expect(f.text("feedback")).toContain("×3");
  });
  it("keeps confirmed success after read failure and retries only all three reads", async () => {
    const f = await setup(); f.city.mockRejectedValueOnce(new Error("read unavailable"));
    f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.text("feedback")).toContain("购买成功");
    expect(f.text("form-error")).toContain("待同步"); expect(f.button("buy-offer").disabled).toBe(true);
    f.click("reload-shop-state"); await f.settle();
    expect(f.purchase).toHaveBeenCalledTimes(1); expect(f.bag).toHaveBeenCalledTimes(2);
    expect(f.city).toHaveBeenCalledTimes(2); expect(f.shelf).toHaveBeenCalledTimes(3);
    expect(f.text("feedback")).toContain("购买成功"); expect(f.button("buy-offer").disabled).toBe(false);
  });
  it("keeps an unknown result unknown after successful reads; a new purchase is explicit", async () => {
    const f = await setup(); f.click("buy-offer"); f.request.reject(new Error("gateway timeout")); await f.settle();
    expect(f.text("feedback")).toContain("结果未知"); expect(f.bag).not.toHaveBeenCalled();
    f.click("buy-offer"); expect(f.purchase).toHaveBeenCalledTimes(1);
    f.click("reload-shop-state"); await f.settle();
    expect(f.text("feedback")).toContain("结果未知"); expect(f.text("form-error")).toContain("不能据此判定");
    expect(f.button("buy-offer").textContent).toContain("非重试"); expect(f.purchase).toHaveBeenCalledTimes(1);
    const next = deferred(); f.purchase.mockReturnValueOnce(next.promise); f.click("buy-offer");
    expect(f.purchase).toHaveBeenCalledTimes(2); next.resolve(f.success); await f.settle();
  });
  it("distinguishes a known pre-write rejection without claiming rollback", async () => {
    const f = await setup(); f.click("buy-offer");
    f.request.reject(Object.assign(new Error("shop: purchase limit exceeded"), { code: 10001 })); await f.settle();
    expect(f.text("feedback")).toBe(""); expect(f.text("form-error")).toContain("purchase limit exceeded");
    expect(f.bag).not.toHaveBeenCalled(); expect(f.purchase).toHaveBeenCalledTimes(1);
  });
  it("blocks double clicks and manual refresh while the action is in flight", async () => {
    const f = await setup(); f.click("buy-offer"); f.click("buy-offer"); f.click("refresh-shop"); f.click("reload-shop-state");
    expect(f.purchase).toHaveBeenCalledTimes(1); expect(f.shelf).toHaveBeenCalledTimes(1);
    f.request.resolve(f.success); await f.settle();
  });
  it.each(["actor", "session", "unmount"])("ignores stale mutation results after %s", async kind => {
    const f = await setup(); f.click("buy-offer");
    if (kind === "actor") f.switchActor(); else if (kind === "session") f.relogin(); else f.panels.detach();
    f.request.resolve(f.success); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(f.bag).not.toHaveBeenCalled();
  });
});


describe("SHOP interrupted and superseded DOM flows", () => {
  it("close/reopen keeps one pending purchase; closing suppresses hidden recovery/status", async () => {
    const f = await setup(); f.click("buy-offer"); f.panels.toggleShop(); f.panels.toggleShop();
    expect(f.purchase).toHaveBeenCalledTimes(1); expect(f.shelf).toHaveBeenCalledTimes(1);
    f.panels.toggleShop(); f.request.resolve(f.success); await f.settle();
    expect(f.bag).not.toHaveBeenCalled(); expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled();
    f.panels.toggleShop(); await f.settle();
    expect(f.purchase).toHaveBeenCalledTimes(1); expect(f.city).toHaveBeenCalledTimes(1);
    expect(f.text("feedback")).toContain("购买成功");
  });
  it("reopening unknown reloads only reads and never resolves the unknown receipt", async () => {
    const f = await setup(); f.click("buy-offer"); f.request.reject(new Error("disconnected")); await f.settle();
    f.panels.toggleShop(); f.panels.toggleShop(); await f.settle();
    expect(f.purchase).toHaveBeenCalledTimes(1); expect(f.city).toHaveBeenCalledTimes(1);
    expect(f.text("feedback")).toContain("结果未知");
    f.relogin(); f.click("refresh-shop"); await f.settle(); expect(f.purchase).toHaveBeenCalledTimes(1);
  });
  it.each(["epoch", "bag", "wallet"])("preserves newer %s snapshot during post-purchase reload", async change => {
    const f = await setup(), read = deferred<{ items: { item_cfg_id: number; quantity: number }[] }>();
    f.bag.mockReturnValueOnce(read.promise); f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
    if (change === "epoch") beginAssetRead(f.gateway);
    if (change === "bag") f.session().bag = [{ item_cfg_id: 2004, quantity: 9 }];
    if (change === "wallet") f.session().wallet = { gold: 900 };
    read.resolve({ items: [{ item_cfg_id: 2001, quantity: 3 }] }); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.text("feedback")).toContain("购买成功");
    expect(f.text("form-error")).toContain("待同步"); expect(f.button("buy-offer").disabled).toBe(true);
  });
  it("invalidates a bag read begun before the purchase", async () => {
    const f = await setup(), old = deferred<{ items: { item_cfg_id: number; quantity: number }[] }>();
    f.bag.mockReturnValueOnce(old.promise); f.panels.toggleBag(); f.panels.toggleShop(); await f.settle();
    f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
    old.resolve({ items: [{ item_cfg_id: 2004, quantity: 99 }] }); await f.settle();
    expect(f.session().bag).toEqual([{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }]);
  });
  it("does not let an old action unlock a new actor's pending action", async () => {
    const f = await setup(); f.click("buy-offer"); f.switchActor(); f.panels.toggleShop(); f.panels.toggleShop(); await f.settle();
    const next = deferred(); f.purchase.mockReturnValueOnce(next.promise); f.click("buy-offer");
    f.request.resolve(f.success); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.button("buy-offer").disabled).toBe(true);
    expect(f.purchase).toHaveBeenCalledTimes(2); next.resolve(f.success); await f.settle();
    expect(f.patch).toHaveBeenCalledTimes(1);
  });
  it("ignores an old shelf read after actor switch and a newer read", async () => {
    const f = await setup(), old = deferred<Awaited<ReturnType<typeof f.shelf>>>();
    f.shelf.mockReturnValueOnce(old.promise); f.click("refresh-shop"); f.switchActor();
    f.panels.toggleShop(); f.panels.toggleShop(); await f.settle();
    old.resolve({ offers: [] }); await f.settle();
    expect(f.mount.querySelector('[data-offer-id="1001"]')).toBeTruthy();
  });
  it("ignores a pending aggregate after unmount and does not submit from detached controls", async () => {
    const f = await setup(), read = deferred<Awaited<ReturnType<typeof f.bag>>>();
    f.bag.mockReturnValueOnce(read.promise); f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
    const buy = f.button("buy-offer"); f.panels.detach(); f.status.mockClear();
    read.resolve({ items: [] }); await f.settle(); buy.disabled = false; buy.click();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(f.purchase).toHaveBeenCalledTimes(1);
  });
  it("keeps unknown and the read-only retry when shelf reload fails", async () => {
    const f = await setup(); f.click("buy-offer"); f.request.reject(new Error("timeout")); await f.settle();
    f.shelf.mockRejectedValueOnce(new Error("counter read failed")); f.click("reload-shop-state"); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.text("feedback")).toContain("结果未知");
    expect(f.text("form-error")).toContain("待同步"); expect(f.button("reload-shop-state").hidden).toBe(false);
    f.click("reload-shop-state"); await f.settle(); expect(f.purchase).toHaveBeenCalledTimes(1);
    expect(f.text("feedback")).toContain("结果未知");
  });
});


it("does not reuse a prior successful purchase stamp for a new unknown action", async () => {
  const f = await setup(); f.click("buy-offer"); f.request.resolve(f.success); await f.settle();
  expect(f.mount.querySelector(".shop-list")?.textContent).toContain("已购 +1");
  const next = deferred(); f.purchase.mockReturnValueOnce(next.promise); f.click("buy-offer");
  next.reject(new Error("timeout")); await f.settle();
  expect(f.text("feedback")).toContain("结果未知");
  expect(f.mount.querySelector(".shop-list")?.textContent).not.toContain("已购 +1");
  expect(f.button("shop-view-granted-bag").classList.contains("hidden")).toBe(true);
});


describe("SHOP settlement invalidates reads started during the request", () => {
  it.each(["success", "unknown"])("rejects an intervening bag read after hidden %s", async outcome => {
    const f = await setup(), old = deferred<Awaited<ReturnType<typeof f.bag>>>();
    f.click("buy-offer"); f.bag.mockReturnValueOnce(old.promise); f.panels.toggleBag();
    if (outcome === "success") f.request.resolve(f.success); else f.request.reject(new Error("timeout"));
    await f.settle(); old.resolve({ items: [{ item_cfg_id: 2004, quantity: 4 }] }); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.city).not.toHaveBeenCalled();
    f.panels.toggleShop(); await f.settle(); expect(f.purchase).toHaveBeenCalledTimes(1);
    expect(f.session().bag).toEqual([{ item_cfg_id: 2001, quantity: 3 }, { item_cfg_id: 2004, quantity: 1 }]);
    expect(f.text("feedback")).toContain(outcome === "success" ? "购买成功" : "结果未知");
  });
  it.each(["success", "unknown"])("discards a pending CityStateFetch after hidden %s", async outcome => {
    const f = await setup(), old = deferred<Awaited<ReturnType<typeof f.city>>>();
    f.click("buy-offer"); f.city.mockReturnValueOnce(old.promise);
    const cityReads = new CityStateFetch(f.gateway, () => 11, () => "session");
    const read = cityReads.fetch(); f.panels.toggleShop();
    if (outcome === "success") f.request.resolve(f.success); else f.request.reject(new Error("timeout"));
    await f.settle(); old.resolve({ wallet: { gold: 100 } });
    expect(await read).toBeNull(); expect(f.city).toHaveBeenCalledTimes(1);
  });
  it.each(["actor", "session"])("does not invalidate new %s reads when obsolete actions settle", async kind => {
    for (const outcome of ["success", "unknown"]) {
      const f = await setup(); f.click("buy-offer");
      if (kind === "actor") f.switchActor(); else f.relogin();
      const current = beginAssetRead(f.gateway);
      if (outcome === "success") f.request.resolve(f.success); else f.request.reject(new Error("timeout"));
      await f.settle(); expect(current()).toBe(true); expect(f.patch).not.toHaveBeenCalled();
    }
  });
});
