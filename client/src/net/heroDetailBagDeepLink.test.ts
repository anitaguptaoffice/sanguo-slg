import { describe, expect, it } from "vitest";
import { pickHeroDetailBagDeepLink } from "@/net/heroDetailBagDeepLink";

describe("pickHeroDetailBagDeepLink", () => {
  it("rejects invalid hero_id", () => {
    const pick = pickHeroDetailBagDeepLink(0, []);
    expect(pick.ok).toBe(false);
    if (!pick.ok) expect(pick.errorMessage).toContain("将领");
  });

  it("picks first cultivation consumable with qty", () => {
    const pick = pickHeroDetailBagDeepLink(3, [
      { item_cfg_id: 2001, quantity: 5 },
      { item_cfg_id: 2017, quantity: 2 },
    ]);
    expect(pick).toEqual({ ok: true, itemCfgId: 2017 });
  });

  it("fails when bag lacks cultivation items", () => {
    const pick = pickHeroDetailBagDeepLink(1, [{ item_cfg_id: 2001, quantity: 1 }]);
    expect(pick.ok).toBe(false);
    if (!pick.ok) expect(pick.errorMessage).toContain("养成");
  });
});
