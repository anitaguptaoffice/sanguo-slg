import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { beginAssetRead } from "@/net/questClaimAssets";

const pool = { candidates: [{ candidate_id: 11, display_name: "赵武", gold_cost: 10 }], hero_capacity: 5, hero_owned: 0, hotel_level: 1 };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function deferred<T>() { let resolve!: (value: T) => void, reject!: (reason: Error) => void; const promise = new Promise<T>((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
async function fixture() {
  const mount = document.createElement("div"); document.body.append(mount);
  let session: MainCitySession = { serverId: 1, player: { player_id: 1 }, cityId: 7, cityName: "城", buildings: [], cityTroops: [], wallet: { gold: 100 }, bag: [{ item_cfg_id: 2001, quantity: 3 }] };
  let generation = 1;
  const gateway = {
    getBoundServerId: () => 1, getSessionId: () => "same-token", getSessionGeneration: () => generation,
    listPlayerBag: vi.fn(async () => ({ items: session.bag })), getCityState: vi.fn(async () => ({ wallet: { gold: 90 } })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [] })), listRecruitTemplates: vi.fn(async () => ({ templates: [] })),
    listHotelRecruitCandidates: vi.fn(async () => pool), refreshHotelRecruitPool: vi.fn(async () => pool),
    recruitHotelCandidate: vi.fn(async () => ({ hero_id: 42, display_name: "赵武" })),
    listCaptiveHeroes: vi.fn(async () => ({ captives: [] })), listComingHeroes: vi.fn(async () => ({ coming: [] })), listPersuadeTargets: vi.fn(async () => ({ targets: [] })),
  };
  const patch = vi.fn((value: Partial<MainCitySession>) => { session = { ...session, ...value }; });
  const status = vi.fn();
  const panels = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, patch, status);
  panels.attach(); panels.toggleHero(); await flush(); patch.mockClear(); status.mockClear();
  const button = (name: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const click = (name: string) => button(name).dispatchEvent(new MouseEvent("click", { bubbles: true }));
  const outcome = () => mount.querySelector('[data-role="hotel-outcome"]')!.textContent;
  const warning = () => mount.querySelector('[data-role="hotel-recruit-form-error"]')!.textContent;
  return { mount, gateway, panels, patch, status, button, click, outcome, warning, session: () => session,
    changeActor: () => { session.player.player_id = 2; }, reenter: () => { generation++; } };
}

beforeEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
describe("CLIENT-HOTEL-OUTCOME", () => {
  it("retains confirmed recruit after list reload failure and never repeats its purchase", async () => {
    const f = await fixture(); f.gateway.listHotelRecruitCandidates.mockRejectedValue(new Error("gateway not connected"));
    f.click("recruit-hotel-candidate"); await flush();
    expect(f.outcome()).toContain("已招入 赵武（#42）"); expect(f.warning()).toContain("当前状态加载未完成");
    expect(f.button("recruit-hotel-candidate").disabled).toBe(true); expect(f.button("refresh-hotel-pool").disabled).toBe(true);
    expect(f.mount.querySelector('[data-candidate-id="11"]')).toBeNull();
    f.click("recruit-hotel-candidate"); f.click("refresh-hotel-pool");
    expect(f.gateway.recruitHotelCandidate).toHaveBeenCalledTimes(1); expect(f.gateway.refreshHotelRecruitPool).not.toHaveBeenCalled();
    f.gateway.listHotelRecruitCandidates.mockResolvedValue({ ...pool, candidates: [] });
    f.click("reload-hotel-state"); await flush();
    expect(f.outcome()).toContain("已招入"); expect(f.warning()).toContain("仅显示当前状态");
    expect(f.session().wallet.gold).toBe(90); expect(f.gateway.recruitHotelCandidate).toHaveBeenCalledTimes(1);
  });
  it.each(["listPlayerBag", "getCityState", "listPlayerHeroes"] as const)("retains confirmed paid refresh when %s fails", async method => {
    const f = await fixture(); f.gateway[method].mockRejectedValue(new Error("lost read"));
    f.click("refresh-hotel-pool"); await flush();
    expect(f.outcome()).toBe("客栈池已刷新"); expect(f.warning()).toContain("当前状态加载未完成");
    expect(f.patch).not.toHaveBeenCalled(); expect(f.gateway.refreshHotelRecruitPool).toHaveBeenCalledTimes(1);
  });
  it.each(["recruit-hotel-candidate", "refresh-hotel-pool"])("keeps %s timeout unknown through recovery and reopen", async action => {
    const f = await fixture(); const purchase = action === "recruit-hotel-candidate" ? f.gateway.recruitHotelCandidate : f.gateway.refreshHotelRecruitPool;
    purchase.mockRejectedValue(new Error("gateway timeout")); f.click(action); f.click(action); await flush();
    expect(purchase).toHaveBeenCalledTimes(1); expect(f.outcome()).toContain("结果暂无法确认");
    expect(f.outcome()).not.toMatch(/未扣|没扣|已回滚|gateway timeout/);
    const reads = f.gateway.listHotelRecruitCandidates.mock.calls.length;
    f.panels.toggleHero(); f.panels.toggleHero(); await flush();
    expect(f.gateway.listHotelRecruitCandidates).toHaveBeenCalledTimes(reads); expect(f.button(action).disabled).toBe(true);
    f.gateway.listHotelRecruitCandidates.mockResolvedValue({ ...pool, candidates: [] });
    f.click("reload-hotel-state"); f.click("reload-hotel-state"); await flush();
    expect(f.gateway.listHotelRecruitCandidates).toHaveBeenCalledTimes(reads + 1);
    expect(f.outcome()).toContain("结果暂无法确认"); expect(f.warning()).toContain("不能据此判定上次操作结果");
    expect(f.gateway.listPlayerHeroes).toHaveBeenCalled(); expect(f.gateway.listPlayerBag).toHaveBeenCalled(); expect(f.gateway.getCityState).toHaveBeenCalled();
    expect(f.button("refresh-hotel-pool").disabled).toBe(false); expect(purchase).toHaveBeenCalledTimes(1);
  });
  it.each(["gateway not connected", "outcome unavailable; reload state"])("treats %s as unknown without automatic reads or retries", async message => {
    const f = await fixture(); f.gateway.recruitHotelCandidate.mockRejectedValue(new Error(message));
    f.click("recruit-hotel-candidate"); await flush();
    expect(f.outcome()).toContain("可能已生效"); expect(f.gateway.getCityState).not.toHaveBeenCalled();
    expect(f.gateway.recruitHotelCandidate).toHaveBeenCalledTimes(1);
  });
  it("keeps a known capacity failure separate from an uncertain outcome", async () => {
    const f = await fixture(); f.gateway.recruitHotelCandidate.mockRejectedValue(new Error("hero: hero capacity full (office level)"));
    f.click("recruit-hotel-candidate"); await flush();
    expect(f.outcome()).toBe(""); expect(f.warning()).toContain("招贤馆容量已满"); expect(f.button("refresh-hotel-pool").disabled).toBe(false);
  });
  it("holds pending purchase across close/reopen and records confirmation without reopening a closed panel", async () => {
    const f = await fixture(); const pending = deferred<{ hero_id: number }>();
    f.gateway.recruitHotelCandidate.mockReturnValue(pending.promise as never);
    f.click("recruit-hotel-candidate"); f.panels.toggleHero(); f.panels.toggleHero(); f.click("recruit-hotel-candidate");
    expect(f.gateway.recruitHotelCandidate).toHaveBeenCalledTimes(1); f.panels.toggleHero(); f.status.mockClear();
    pending.resolve({ hero_id: 42 }); await flush();
    expect(f.panels.getHeroRoot().classList.contains("hidden")).toBe(true); expect(f.outcome()).toContain("已招入");
    expect(f.gateway.getCityState).not.toHaveBeenCalled();
    f.panels.toggleHero(); await flush(); expect(f.outcome()).toContain("已招入"); expect(f.button("recruit-hotel-candidate").disabled).toBe(true);
  });
  it.each(["changeActor", "reenter", "detach"] as const)("discards old purchase completion after %s", async change => {
    const f = await fixture(); const pending = deferred<{ hero_id: number }>();
    f.gateway.recruitHotelCandidate.mockReturnValue(pending.promise as never); f.click("recruit-hotel-candidate");
    if (change === "detach") f.panels.detach(); else f[change]();
    pending.resolve({ hero_id: 42 }); await flush();
    expect(f.patch).not.toHaveBeenCalled(); expect(f.status).not.toHaveBeenCalled(); expect(f.gateway.getCityState).not.toHaveBeenCalled();
    if (change !== "detach") { f.panels.toggleHero(); f.panels.toggleHero(); await flush(); expect(f.outcome()).toBe(""); }
  });
  it.each(["actor", "generation", "assets", "wallet", "detach"])("rejects stale current-state reload after %s changes", async change => {
    const f = await fixture(); const pending = deferred<{ wallet: { gold: number } }>();
    f.gateway.getCityState.mockReturnValue(pending.promise); f.click("refresh-hotel-pool"); await flush();
    if (change === "actor") f.changeActor(); if (change === "generation") f.reenter();
    if (change === "assets") beginAssetRead(f.gateway as unknown as GatewayPort);
    if (change === "wallet") f.session().wallet = { gold: 700 }; if (change === "detach") f.panels.detach();
    pending.resolve({ wallet: { gold: 90 } }); await flush(); expect(f.patch).not.toHaveBeenCalled();
    if (change === "assets" || change === "wallet") { expect(f.outcome()).toBe("客栈池已刷新"); expect(f.warning()).toContain("加载未完成"); }
  });
});

import { CityStateFetch } from "@/net/cityStateFetch";
import { ContentPanels } from "@/ui/ContentPanels";
describe("hotel settlement epoch", () => {
  for (const action of ["recruit-hotel-candidate", "refresh-hotel-pool"] as const) {
    it.each(["success", "unknown"])(`${action} rejects during-request city read after hidden %s`, async outcome => {
      const f = await fixture(), mutation = deferred<any>(), old = deferred<any>();
      const method = action === "recruit-hotel-candidate" ? f.gateway.recruitHotelCandidate : f.gateway.refreshHotelRecruitPool;
      method.mockReturnValueOnce(mutation.promise); f.click(action);
      expect(method).toHaveBeenCalledTimes(1);
      f.gateway.getCityState.mockReturnValueOnce(old.promise);
      const fetch = new CityStateFetch(f.gateway as unknown as GatewayPort, () => 7, () => "same-session");
      const pending = fetch.fetch(); f.panels.toggleHero();
      if (outcome === "success") mutation.resolve(action === "recruit-hotel-candidate" ? { hero_id: 42 } : pool);
      else mutation.reject(new Error("gateway timeout"));
      await flush(); old.resolve({ wallet: { gold: 100 } });
      const state = await pending;
      expect(f.gateway.getCityState).toHaveBeenCalledTimes(1);
      expect(state).toBeNull();
    });
    it.each(["success", "unknown"])(`${action} rejects during-request bag read after hidden %s`, async outcome => {
      const f = await fixture(), mutation = deferred<any>(), old = deferred<any>();
      const content = new ContentPanels(f.mount, f.gateway as unknown as GatewayPort, f.session, f.patch, f.status);
      content.attach();
      const method = action === "recruit-hotel-candidate" ? f.gateway.recruitHotelCandidate : f.gateway.refreshHotelRecruitPool;
      method.mockReturnValueOnce(mutation.promise); f.click(action);
      expect(method).toHaveBeenCalledTimes(1);
      f.gateway.listPlayerBag.mockReturnValueOnce(old.promise); content.toggleBag();
      expect(f.panels.getHeroRoot().classList.contains("hidden")).toBe(true);
      if (outcome === "success") mutation.resolve(action === "recruit-hotel-candidate" ? { hero_id: 42 } : pool);
      else mutation.reject(new Error("gateway timeout"));
      await flush(); old.resolve({ items: [{ item_cfg_id: 2001, quantity: 3 }] }); await flush();
      expect(f.gateway.getCityState).not.toHaveBeenCalled();
      expect(f.patch).not.toHaveBeenCalled();
    });
  }
});

it.each(["actor", "session"])("obsolete hotel %s settlement leaves current reads intact", async kind => {
  for (const action of ["recruit-hotel-candidate", "refresh-hotel-pool"]) {
    for (const outcome of ["success", "unknown"]) {
      const f = await fixture(), mutation = deferred<any>();
      const method = action === "recruit-hotel-candidate" ? f.gateway.recruitHotelCandidate : f.gateway.refreshHotelRecruitPool;
      method.mockReturnValueOnce(mutation.promise); f.click(action);
      if (kind === "actor") f.changeActor(); else f.reenter();
      const current = beginAssetRead(f.gateway as unknown as GatewayPort);
      if (outcome === "success") mutation.resolve({ hero_id: 42 }); else mutation.reject(new Error("timeout"));
      await flush(); expect(current()).toBe(true); expect(f.patch).not.toHaveBeenCalled();
      expect(method).toHaveBeenCalledTimes(1);
    }
  }
});
it.each(["success", "unknown"])("hidden hotel %s settlement permits only fresh recovery on reopen", async outcome => {
  const f = await fixture(), mutation = deferred<any>(), old = deferred<any>();
  f.gateway.recruitHotelCandidate.mockReturnValueOnce(mutation.promise); f.click("recruit-hotel-candidate");
  f.gateway.getCityState.mockReturnValueOnce(old.promise);
  const fetch = new CityStateFetch(f.gateway as unknown as GatewayPort, () => 7);
  const pending = fetch.fetch(); f.panels.toggleHero();
  if (outcome === "success") mutation.resolve({ hero_id: 42 }); else mutation.reject(new Error("timeout"));
  await flush(); expect(f.patch).not.toHaveBeenCalled();
  f.panels.toggleHero(); await flush();
  expect(f.gateway.getCityState).toHaveBeenCalledTimes(1);
  f.click("reload-hotel-state"); await flush();
  old.resolve({ wallet: { gold: 100 } }); expect(await pending).toBeNull();
  expect(f.session().wallet.gold).toBe(90); expect(f.gateway.recruitHotelCandidate).toHaveBeenCalledTimes(1);
});
