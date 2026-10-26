import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { beginAssetRead } from "@/net/questClaimAssets";
import { ContentPanels } from "./ContentPanels";

function deferred<T = unknown>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
beforeEach(() => sessionStorage.clear());
async function setup() {
  let session: MainCitySession = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { food: 100 }, buildings: [], cityTroops: [], bag: [{ item_cfg_id: 2001, quantity: 3 }] };
  let generation = 1;
  const request = deferred();
  const use = vi.fn().mockReturnValue(request.promise);
  const list = vi.fn(async () => ({ items: session.bag }));
  const city = vi.fn(async () => ({ wallet: session.wallet }));
  const gateway = { getBoundServerId: () => 1, getSessionId: () => "token", getSessionGeneration: () => generation,
    listPlayerBag: list, getCityState: city, useConsumable: use } as unknown as GatewayPort;
  const mount = document.createElement("div");
  const patch = vi.fn((p: Partial<MainCitySession>) => Object.assign(session, p));
  const status = vi.fn();
  const panels = new ContentPanels(mount, gateway, () => session, patch, status);
  panels.attach(); panels.toggleBag();
  await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
  patch.mockClear(); status.mockClear();
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const batch = () => {
    mount.querySelectorAll<HTMLInputElement>('[data-role="bag-slot-checkbox"]').forEach(box => { box.checked = true; box.dispatchEvent(new Event("change", { bubbles: true })); });
    click("use-item-batch");
  };
  const settle = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
  return { request, use, list, city, gateway, mount, patch, status, panels, click, batch, settle,
    session: () => session, switchActor: () => { session = { ...session, player: { player_id: 2 } }; }, relogin: () => { generation++; } };
}

describe("bag use async ownership and outcome safety", () => {
  it.each(["actor", "session"])("ignores old single-use result after %s changes", async kind => {
    const f = await setup(); f.click("use-item");
    if (kind === "actor") f.switchActor(); else f.relogin();
    f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } }); await f.settle();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled();
    expect(f.session().wallet?.food).toBe(100);
  });
  it("stops a batch after actor changes", async () => {
    const f = await setup(); f.batch(); f.switchActor();
    f.request.resolve({ remaining: 2 }); await f.settle();
    expect(f.use).toHaveBeenCalledTimes(1); expect(f.patch).not.toHaveBeenCalled();
  });
  it.each([false, true])("deduplicates double clicks and overlapping single/batch submissions (batch=%s)", async batch => {
    const f = await setup(); if (batch) f.batch(); else f.click("use-item"); f.batch(); f.click("use-item");
    expect(f.use).toHaveBeenCalledTimes(1);
    f.request.reject(new Error("gateway timeout")); await f.settle();
  });
  it("does not replace newer snapshots with an older use response", async () => {
    const f = await setup(); f.click("use-item"); beginAssetRead(f.gateway);
    f.session().bag = [{ item_cfg_id: 2001, quantity: 8 }]; f.session().wallet = { food: 9000 };
    f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } }); await f.settle();
    expect(f.session().wallet?.food).toBe(9000); expect(f.session().bag?.[0].quantity).toBe(8);
    expect(f.city).toHaveBeenCalledTimes(1);
  });
  it("invalidates a bag read started before the mutation", async () => {
    const f = await setup(); const read = deferred<{ items: NonNullable<MainCitySession["bag"]> }>();
    f.list.mockReturnValueOnce(read.promise); f.click("refresh-bag"); f.click("use-item");
    f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } }); await f.settle();
    read.resolve({ items: [{ item_cfg_id: 2001, quantity: 99 }] }); await f.settle();
    expect(f.session().bag?.[0].quantity).toBe(2); expect(f.session().wallet?.food).toBe(1100);
  });
  it("does not let an old response unlock or patch a new actor's in-flight use", async () => {
    const f = await setup(); f.click("use-item"); f.switchActor();
    f.click("refresh-bag"); await f.settle();
    const next = deferred(); f.use.mockReturnValueOnce(next.promise); f.patch.mockClear();
    f.click("use-item"); expect(f.use).toHaveBeenCalledTimes(2);
    f.request.resolve({ remaining: 1, wallet_after: { food: 1100 } }); await f.settle();
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.mount.querySelector<HTMLButtonElement>('[data-action="use-item"]')?.disabled).toBe(true);
    next.resolve({ remaining: 2, wallet_after: { food: 2100 } }); await f.settle();
    expect(f.session().wallet?.food).toBe(2100);
  });
  it("discards a current-state refresh overtaken by a newer snapshot", async () => {
    const f = await setup(); const read = deferred<{ items: NonNullable<MainCitySession["bag"]> }>();
    f.click("use-item"); beginAssetRead(f.gateway); f.list.mockReturnValueOnce(read.promise);
    f.request.resolve({ remaining: 2, effect_summary: "使用已确认" }); await f.settle();
    f.session().bag = [{ item_cfg_id: 2001, quantity: 9 }]; f.session().wallet = { food: 9000 }; beginAssetRead(f.gateway);
    read.resolve({ items: [{ item_cfg_id: 2001, quantity: 2 }] }); await f.settle();
    expect(f.session().bag?.[0].quantity).toBe(9); expect(f.session().wallet?.food).toBe(9000);
    expect(f.mount.querySelector('[data-role="bag-feedback"]')?.textContent).toContain("使用已确认");
    expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("资产待同步");
  });
  it("keeps confirmed success separate from a current-state refresh failure", async () => {
    const f = await setup(); f.click("use-item"); beginAssetRead(f.gateway);
    f.list.mockRejectedValueOnce(new Error("read unavailable"));
    f.request.resolve({ remaining: 2, effect_summary: "已使用资源包", wallet_after: { food: 1100 } }); await f.settle();
    expect(f.mount.querySelector('[data-role="bag-feedback"]')?.textContent).toContain("已使用资源包");
    expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("资产待同步");
    f.click("use-item"); expect(f.use).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("stops unknown outcome without retry or an uncharged claim (batch=%s)", async batch => {
    const f = await setup(); if (batch) f.batch(); else f.click("use-item");
    f.request.reject(new Error("gateway timeout")); await f.settle();
    const error = f.mount.querySelector('[data-role="bag-form-error"]')?.textContent;
    expect(error).toContain("结果未知"); expect(error).toContain("可能已扣除"); expect(error).not.toContain("未扣除");
    f.click("use-item"); f.click("use-item-batch"); expect(f.use).toHaveBeenCalledTimes(1);
    expect(f.city).not.toHaveBeenCalled();
    f.click("refresh-bag"); await f.settle(); expect(f.city).toHaveBeenCalledTimes(1);
    expect(f.use).toHaveBeenCalledTimes(1);
  });
});

import { CityStateFetch } from "@/net/cityStateFetch";
describe("bag settlement epoch", () => {
  for (const batch of [false, true]) {
    it.each(["success", "unknown"])(`batch=${batch} rejects during-use city read after %s`, async outcome => {
      const f = await setup(), old = deferred<any>();
      if (batch) {
        // Select exactly one batch slot so the final mutation settlement has no next mutation to invalidate reads.
        const box = f.mount.querySelector<HTMLInputElement>('[data-role="bag-slot-checkbox"]')!;
        box.checked = true; box.dispatchEvent(new Event("change", { bubbles: true })); f.click("use-item-batch");
      } else f.click("use-item");
      expect(f.use).toHaveBeenCalledTimes(1);
      f.city.mockReturnValueOnce(old.promise);
      const fetch = new CityStateFetch(f.gateway, () => 1, () => "same-session");
      const pending = fetch.fetch();
      if (outcome === "success") f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } });
      else f.request.reject(new Error("gateway timeout"));
      await f.settle();
      if (outcome === "success") expect(f.session().wallet.food).toBe(1100);
      old.resolve({ wallet: { food: 100 } });
      const state = await pending;
      if (state && fetch.isCurrent(state)) f.patch({ wallet: state.wallet }); // same gate as MainCityScene.applyPolledCityState
      expect(state).toBeNull();
      if (outcome === "success") expect(f.session().wallet.food).toBe(1100);
    });
    it(`batch=${batch} rejects a during-use bag read after unknown outcome`, async () => {
      const f = await setup(), old = deferred<any>();
      if (batch) f.batch(); else f.click("use-item");
      expect(f.use).toHaveBeenCalledTimes(1);
      f.list.mockReturnValueOnce(old.promise); f.click("refresh-bag");
      expect(f.list).toHaveBeenCalledTimes(2);
      f.request.reject(new Error("gateway timeout")); await f.settle();
      old.resolve({ items: [{ item_cfg_id: 2001, quantity: 3 }] }); await f.settle();
      expect(f.patch).not.toHaveBeenCalled();
    });
  }
  it("CONTROL: during-use bag read is discarded after confirmed use starts fresh aggregate recovery", async () => {
    const f = await setup(), old = deferred<any>();
    f.click("use-item"); f.list.mockReturnValueOnce(old.promise); f.click("refresh-bag");
    f.list.mockResolvedValue({ items: [{ item_cfg_id: 2001, quantity: 2 }] });
    f.city.mockResolvedValue({ wallet: { food: 1100 } });
    f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } }); await f.settle();
    old.resolve({ items: [{ item_cfg_id: 2001, quantity: 3 }] }); await f.settle();
    expect(f.session().bag[0].quantity).toBe(2); expect(f.session().wallet.food).toBe(1100);
    expect(f.city).toHaveBeenCalledTimes(1);
  });
});

it.each(["actor", "session"])("bag settlement does not invalidate new %s reads", async kind => {
  for (const outcome of ["success", "unknown"]) {
    const f = await setup(); f.click("use-item");
    if (kind === "actor") f.switchActor(); else f.relogin();
    const current = beginAssetRead(f.gateway);
    if (outcome === "success") f.request.resolve({ remaining: 2 }); else f.request.reject(new Error("timeout"));
    await f.settle(); expect(current()).toBe(true); expect(f.patch).not.toHaveBeenCalled();
  }
});
it("partial batch invalidates the final unknown item's reads without replaying or losing confirmed assets", async () => {
  const f = await setup(), second = deferred(), oldCity = deferred<any>(), oldBag = deferred<any>();
  f.use.mockReturnValueOnce(f.request.promise).mockReturnValueOnce(second.promise); f.batch();
  f.request.resolve({ remaining: 2, wallet_after: { food: 1100 } }); await f.settle();
  expect(f.use).toHaveBeenCalledTimes(2);
  f.city.mockReturnValueOnce(oldCity.promise); const fetch = new CityStateFetch(f.gateway, () => 1);
  const city = fetch.fetch(); f.list.mockReturnValueOnce(oldBag.promise); f.click("refresh-bag");
  second.reject(new Error("timeout")); await f.settle();
  oldCity.resolve({ wallet: { food: 100 } }); oldBag.resolve({ items: [{ item_cfg_id: 2001, quantity: 3 }] });
  expect(await city).toBeNull(); await f.settle();
  expect(f.session().wallet.food).toBe(1100); expect(f.session().bag[0].quantity).toBe(2);
  expect(f.mount.querySelector('[data-role="bag-feedback"]')?.textContent).toContain("1");
  f.click("use-item-batch"); expect(f.use).toHaveBeenCalledTimes(2);
});
