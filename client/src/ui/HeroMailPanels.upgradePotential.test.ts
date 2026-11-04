import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { applyUpgradeHeroToDetail, type UpgradeHeroResult } from "@/net/heroDetailUpgrade";
import { heroPointSnapshotFromDetail, mergeHeroPointSnapshot } from "@/net/heroDetailPoints";
const flush = () => new Promise(r => setTimeout(r, 0));
const panels: HeroMailPanels[] = [];
beforeEach(() => sessionStorage.clear());
afterEach(() => { panels.splice(0).forEach(p => p.detach()); document.body.innerHTML = ""; });
async function setup() {
  let level = 1, allocated = 0;
  const attrs = () => ({ force: 50 + level + allocated, intel: 40 + level, politics: 30 + level, command: 20 });
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, template_cfg_id: 1001, level, status: 1 }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, template_name: "测试将领", level, attributes: attrs(), exp_toward_next: 1000, upgrade_exp_required: 100 })),
    addHeroPoint: vi.fn(async (_sid: number, _id: number, target: { force: number; intel: number; politics: number }) => {
      expect(target).toEqual({ force: attrs().force + 1, intel: attrs().intel, politics: attrs().politics });
      allocated++;
      return { hero_id: 7, potential_remaining: level - allocated, force_add: allocated, intel_add: 0, politics_add: 0, attributes: attrs() };
    }),
    upgradeHero: vi.fn(async () => {
      const previous_level = level++;
      return { hero_id: 7, previous_level, level, exp: 1000, exp_current: 1000, exp_to_next: 100, attributes: attrs() };
    }),
  };
  const mount = document.createElement("div"); document.body.append(mount);
  const session = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 }, wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, () => {}, () => {}); panels.push(panel);
  panel.attach(); panel.toggleHero(); await flush();
  const reopen = async () => { mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush(); };
  await reopen();
  const point = () => mount.querySelector<HTMLButtonElement>('[data-action="hero-point-add"][data-stat="force"]')!;
  const upgrade = async () => { mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click(); await flush(); };
  const summary = () => mount.querySelector('[data-role="hero-point-summary"]')!.textContent;
  return { gateway, point, upgrade, reopen, summary };
}
describe("hero upgrade potential", () => {
  it("unlocks the new potential point immediately after upgrading an exhausted hero", async () => {
    const f = await setup(); f.point().click(); await flush(); expect(f.point().disabled).toBe(true);
    await f.upgrade(); expect(f.point().disabled).toBe(false); expect(f.summary()).toContain("剩余 1/2");
  });
  it("keeps the newly gained point when reopening detail without allocating", async () => {
    const f = await setup(); f.point().click(); await flush(); await f.upgrade(); await f.reopen();
    expect(f.point().disabled).toBe(false); expect(f.summary()).toContain("剩余 1/2");
  });
  it("spends the new point with existing absolute targets and never recreates it on reopen", async () => {
    const f = await setup(); f.point().click(); await flush(); await f.upgrade();
    f.point().click(); await flush(); expect(f.gateway.addHeroPoint).toHaveBeenCalledTimes(2);
    expect(f.summary()).toContain("剩余 0/2"); expect(f.summary()).toContain("武+2");
    await f.reopen(); await f.reopen(); expect(f.point().disabled).toBe(true);
    expect(f.summary()).toContain("剩余 0/2"); expect(f.summary()).toContain("武+2");
  });
  it("accumulates only level gains across repeated upgrades and detail reloads", async () => {
    const f = await setup(); f.point().click(); await flush(); await f.upgrade(); await f.upgrade();
    expect(f.summary()).toContain("剩余 2/3"); await f.reopen(); await f.reopen();
    expect(f.summary()).toContain("剩余 2/3"); f.point().click(); await flush();
    expect(f.summary()).toContain("剩余 1/3"); await f.upgrade(); await f.reopen();
    expect(f.summary()).toContain("剩余 2/4"); expect(f.summary()).toContain("武+2");
  });
  it("retains unspent starting potential while leveling", async () => {
    const f = await setup(); await f.upgrade(); expect(f.summary()).toContain("剩余 2/2");
    await f.reopen(); expect(f.summary()).toContain("剩余 2/2");
  });
  const upgradeResult = (level: number): UpgradeHeroResult => ({ hero_id: 7, level, previous_level: level - 1, exp: 100, exp_current: 0, exp_to_next: 200 });
  it("anchors snapshots to their level and leaves old unversioned snapshots compatible", () => {
    const snapshot = heroPointSnapshotFromDetail({ hero_id: 7, level: 3, potential_remaining: 1, force_add: 2 });
    expect(snapshot?.level).toBe(3);
    const next = mergeHeroPointSnapshot({ hero_id: 7, level: 5 }, snapshot);
    expect(next.potential_remaining).toBe(3); expect(next.force_add).toBe(2);
    expect(mergeHeroPointSnapshot(next, heroPointSnapshotFromDetail(next)).potential_remaining).toBe(3);
    expect(mergeHeroPointSnapshot({ hero_id: 7, level: 5 }, { potential_remaining: 1, force_add: 2 }).potential_remaining).toBe(1);
  });
  it("preserves unknown remaining values and does not invent gains without a known snapshot level", () => {
    expect(applyUpgradeHeroToDetail({ hero_id: 7, level: 2 }, upgradeResult(3)).potential_remaining).toBeUndefined();
    expect(mergeHeroPointSnapshot({ hero_id: 7, level: 4 }, { level: 2, force_add: 1 }).potential_remaining).toBeUndefined();
    expect(mergeHeroPointSnapshot({ hero_id: 7 }, { level: 2, potential_remaining: 1 }).potential_remaining).toBe(1);
    expect(heroPointSnapshotFromDetail(null)).toBeNull();
  });
  it("keeps allocations and clamps reduced budgets without rewriting attributes", () => {
    const before = { hero_id: 7, level: 4, potential_remaining: 0, force_add: 2, intel_add: 1, politics_add: 1 };
    const attrs = { force: 90, intel: 80, politics: 70, command: 60 };
    const after = applyUpgradeHeroToDetail(before, { ...upgradeResult(5), attributes: attrs });
    expect(after).toMatchObject({ potential_remaining: 1, force_add: 2, intel_add: 1, politics_add: 1, attributes: attrs });
    expect(applyUpgradeHeroToDetail(after, { ...upgradeResult(5), attributes: attrs }).potential_remaining).toBe(1);
    expect(mergeHeroPointSnapshot({ hero_id: 7, level: 1 }, heroPointSnapshotFromDetail(before)).potential_remaining).toBe(0);
  });

  it("does not recreate spent points after a lower-level detail reanchors the cache", () => {
    const spent = { hero_id: 7, level: 3, potential_remaining: 0, force_add: 3, intel_add: 0, politics_add: 0 };
    const older = mergeHeroPointSnapshot({ hero_id: 7, level: 2 }, heroPointSnapshotFromDetail(spent));
    expect(older.potential_remaining).toBe(0);
    const restored = mergeHeroPointSnapshot({ hero_id: 7, level: 3 }, heroPointSnapshotFromDetail(older));
    expect(restored.potential_remaining).toBe(0);
    expect(applyUpgradeHeroToDetail(older, upgradeResult(3)).potential_remaining).toBe(0);
  });

});

it("keeps spent points unavailable after a delayed lower-level detail and current reload", async () => {
  const f = await setup(); f.point().click(); await flush();
  const oldDetail = await f.gateway.getHeroDetail.mock.results[0].value;
  let resolve!: (value: typeof oldDetail) => void;
  f.gateway.getHeroDetail.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  const oldReload = f.reopen(); await f.reopen();
  await f.upgrade(); f.point().click(); await flush(); expect(f.summary()).toContain("剩余 0/2");
  resolve(oldDetail); await oldReload; await f.reopen();
  expect(f.summary()).toContain("剩余 0/2"); expect(f.point().disabled).toBe(true);
});

it("does not inflate a legacy balance when defaulted adds understate its spent points", () => {
  const cached = heroPointSnapshotFromDetail({ hero_id: 7, level: 5, potential_remaining: 1, force_add: 2 });
  expect(mergeHeroPointSnapshot({ hero_id: 7, level: 6 }, cached).potential_remaining).toBe(2);
  const before = { hero_id: 7, ...cached };
  expect(applyUpgradeHeroToDetail(before, { hero_id: 7, level: 6, previous_level: 5, exp: 0, exp_current: 0, exp_to_next: 100 }).potential_remaining).toBe(2);
});
