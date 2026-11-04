import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
const flush = () => new Promise(r => setTimeout(r, 0));
let panel: HeroMailPanels;
beforeEach(() => sessionStorage.clear());
afterEach(() => { panel?.detach(); document.body.replaceChildren(); });
it("uses the new level cap after upgrade and allows rest without fabricating stamina", async () => {
  let level = 1;
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, template_cfg_id: 1001, level }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, level, march_force: 24, march_force_max: 24, exp_toward_next: 1000, upgrade_exp_required: 100 })),
    upgradeHero: vi.fn(async () => ({ hero_id: 7, previous_level: level++, level, exp: 1000, exp_current: 1000, exp_to_next: 200 })),
    restHero: vi.fn(async () => ({ hero_id: 7, march_force: 28, march_force_max: 28 })),
  };
  const root = document.createElement("div"); document.body.append(root);
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, buildings: [], cityTroops: [], bag: [] };
  panel = new HeroMailPanels(root, gateway as never, () => session as never, () => {}, () => {});
  panel.attach(); panel.toggleHero(); await flush(); root.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  const rest = () => root.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]')!;
  expect(rest().disabled).toBe(true);
  root.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]')!.click(); await flush();
  expect(root.textContent).toContain("出征体力 24/28"); expect(rest().disabled).toBe(false);
  expect(gateway.restHero).not.toHaveBeenCalled();
  rest().click(); await flush();
  expect(gateway.restHero).toHaveBeenCalledWith(1, 7); expect(root.textContent).toContain("出征体力 28/28"); expect(rest().disabled).toBe(true);
});

import { applyUpgradeHeroToDetail } from "@/net/heroDetailUpgrade";
import { heroMarchForceMax, heroRestDisabledReason } from "@/net/heroDetailForce";
function upgraded(level: number) { return { hero_id: 7, previous_level: level - 1, level, exp: 1000, exp_current: 100, exp_to_next: 200 }; }
it.each(Array.from({ length: 19 }, (_, i) => i + 2))("uses the existing M1 cap at level %s and keeps spent stamina", level => {
  const result = applyUpgradeHeroToDetail({ hero_id: 7, level: level - 1, march_force: 3, march_force_max: 20 + (level - 1) * 4 }, upgraded(level));
  expect(heroMarchForceMax(result)).toBe(Math.min(100, 20 + level * 4)); expect(result.march_force).toBe(3);
  expect(applyUpgradeHeroToDetail(result, upgraded(level))).toEqual(result);
});
it("preserves unknown current rather than assuming a full bar", () => {
  const after = applyUpgradeHeroToDetail({ hero_id: 7, level: 1, march_force_max: 24 }, upgraded(2));
  expect(after.march_force).toBeUndefined(); expect(heroMarchForceMax(after)).toBe(28); expect(heroRestDisabledReason(after)).toBe("");
  expect(applyUpgradeHeroToDetail(null, upgraded(2)).march_force).toBeUndefined();
});
it("does not replace a same-level authoritative cap on a duplicate response", () => {
  const detail = { hero_id: 7, level: 2, march_force: 28, march_force_max: 31 };
  expect(applyUpgradeHeroToDetail(detail, upgraded(2))).toMatchObject({ march_force: 28, march_force_max: 31 });
});
