import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { applyHeroExprFinishToDetail } from "@/net/heroDetailExpr";
import { applyUpgradeHeroToDetail } from "@/net/heroDetailUpgrade";
const flush = () => new Promise(r => setTimeout(r, 0));
const panels: HeroMailPanels[] = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; });
async function setup(action: "finish" | "faster", gain = 20, level = 2) {
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, template_cfg_id: 1001, level, status: 1 }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, template_name: "测试将领", level, exp: 280, exp_toward_next: 80, upgrade_exp_required: level === 20 ? 0 : 100 })),
    beginHeroExpr: vi.fn(async () => ({ hero_id: 7, status: 4, ends_at_ms: Date.now() + (action === "finish" ? -1 : 3600000), gold_spent: 20, hours: 1 })),
    finishHeroExpr: vi.fn(async () => ({ hero_id: 7, status: 1, exp: 280 + gain, exp_gained: gain })),
    fasterHeroExpr: vi.fn(async () => ({ hero_id: 7, status: 1, exp: 280 + gain, exp_gained: gain })),
    upgradeHero: vi.fn(async () => ({ hero_id: 7, level: level + 1, previous_level: level, exp: 280 + gain, exp_current: gain - 20, exp_to_next: 200 })),
  };
  const mount = document.createElement("div"); document.body.append(mount);
  const session = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 }, wallet: { gold: 10000 }, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, () => {}, () => {}); panels.push(panel);
  panel.attach(); panel.toggleHero(); await flush(); mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  const button = (name: string) => mount.querySelector<HTMLButtonElement>(`[data-action="hero-${name}"]`)!;
  const begin = async () => { button("expr-begin").click(); await flush(); };
  const finish = async () => { button(`expr-${action}`).click(); await flush(); };
  await begin();
  return { gateway, mount, button, begin, finish };
}
describe("experience after training settlement", () => {
  it.each(["finish", "faster"] as const)("%s immediately enables upgrade with newly earned experience", async action => {
    const f = await setup(action); expect(f.button("upgrade").disabled).toBe(true);
    await f.finish(); expect(f.button("upgrade").disabled).toBe(false);
    f.button("upgrade").click(); await flush(); expect(f.gateway.upgradeHero).toHaveBeenCalledWith(1, 7);
    expect(f.mount.querySelector(".hero-detail-level")?.textContent).toBe("Lv3");
  });
  it.each(["finish", "faster"] as const)("%s retains insufficient/max-level gates and leaves experience unchanged on failure", async action => {
    const f = await setup(action, 19); await f.finish(); expect(f.button("upgrade").disabled).toBe(true);
    expect(f.mount.querySelector('[data-role="hero-upgrade-disabled-reason"]')?.textContent).toContain("99/100");
    const capped = await setup(action, 1000, 20); await capped.finish(); expect(capped.button("upgrade").disabled).toBe(true);
    expect(capped.gateway.upgradeHero).not.toHaveBeenCalled();
    const failed = await setup(action); const request = action === "finish" ? failed.gateway.finishHeroExpr : failed.gateway.fasterHeroExpr;
    request.mockRejectedValueOnce(new Error("offline")); await failed.finish();
    expect(failed.button("upgrade").disabled).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(failed.mount.querySelector('[data-role="hero-upgrade-disabled-reason"]')?.textContent).toContain("80/100");
  });
  it("preserves overflow progress without automatic level changes", async () => {
    const f = await setup("finish", 220); await f.finish();
    expect(f.button("upgrade").disabled).toBe(false); expect(f.gateway.upgradeHero).not.toHaveBeenCalled();
    expect(f.mount.querySelector(".hero-detail-level")?.textContent).toBe("Lv2");
    expect(f.button("expr-begin").disabled).toBe(false);
  });
  const before = { hero_id: 7, level: 2, exp: 280, exp_current: 80, exp_to_next: 100, status: 4, expr_ends_at_ms: 1, expr_hours: 1 };
  const result = { hero_id: 7, status: 1, exp: 320, exp_gained: 40 };
  it("uses authoritative totals exactly once, including other experience since the cached detail", () => {
    const after = applyHeroExprFinishToDetail(before, { ...result, exp: 350 });
    expect(after.exp_current).toBe(150); expect(after.exp_to_next).toBe(100); expect(after.level).toBe(2);
    expect(after.expr_ends_at_ms).toBeUndefined(); expect(after.expr_hours).toBeUndefined();
    expect(applyHeroExprFinishToDetail(after, { ...result, exp: 350 }).exp_current).toBe(150);
    expect(applyHeroExprFinishToDetail(after, { ...result, exp: 370, exp_gained: 20 }).exp_current).toBe(170);
  });
  it("keeps the current level threshold when an upgrade occurred before training settlement", () => {
    const leveled = applyUpgradeHeroToDetail(before, { hero_id: 7, level: 3, previous_level: 2, exp: 300, exp_current: 0, exp_to_next: 200 });
    expect(applyHeroExprFinishToDetail(leveled, { ...result, exp: 340 }).exp_current).toBe(40);
  });
  it("preserves unknown/non-finite/mismatched baselines rather than inventing progress", () => {
    expect(applyHeroExprFinishToDetail({ hero_id: 7, exp: 280 }, result).exp_current).toBeUndefined();
    expect(applyHeroExprFinishToDetail({ hero_id: 7, exp_current: 80 }, result).exp_current).toBe(80);
    expect(applyHeroExprFinishToDetail(null, result).exp_current).toBeUndefined();
    expect(applyHeroExprFinishToDetail({ ...before, exp: NaN }, result).exp_current).toBe(80);
    expect(applyHeroExprFinishToDetail(before, { ...result, exp: Infinity }).exp_current).toBe(80);
    expect(applyHeroExprFinishToDetail({ ...before, hero_id: 9 }, result).exp_current).toBe(80);
  });
  it("preserves negative protocol progress and ignores older lower totals", () => {
    expect(applyHeroExprFinishToDetail({ ...before, exp_current: -100 }, result).exp_current).toBe(-60);
    const older = applyHeroExprFinishToDetail(before, { ...result, exp: 200 });
    expect(older.exp).toBe(280); expect(older.exp_current).toBe(80);
    expect(applyHeroExprFinishToDetail(older, { ...result, exp: 320 }).exp_current).toBe(120);
  });

});

it.each(["finish", "faster"] as const)("%s cannot roll back newer same-hero experience while settlement is pending", async action => {
  const f = await setup(action, 40);
  const request = action === "finish" ? f.gateway.finishHeroExpr : f.gateway.fasterHeroExpr;
  let resolve!: (value: { hero_id: number; status: number; exp: number; exp_gained: number }) => void;
  request.mockReturnValueOnce(new Promise(r => { resolve = r; }));
  const pending = f.finish();
  const prior = await f.gateway.getHeroDetail.mock.results[0].value;
  f.gateway.getHeroDetail.mockResolvedValue({ ...prior, level: 3, exp: 520, exp_toward_next: 220, upgrade_exp_required: 200 });
  f.mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  expect(f.button("upgrade").disabled).toBe(false);
  resolve({ hero_id: 7, status: 1, exp: 320, exp_gained: 40 }); await pending; await flush();
  expect(f.button("upgrade").disabled).toBe(false);
});
