import { describe, expect, it } from "vitest";
import { MainCityBuildingPanel } from "@/ui/MainCityBuildingPanel";
import type { MainCitySession } from "@/net/bootstrapSession";

describe("MainCityBuildingPanel", () => {
  it("shows preview and disables upgrade when resources insufficient", () => {
    const mount = document.createElement("div");
    const session: MainCitySession = {
      cityId: 1,
      cityName: "测试",
      buildings: [{ slot_key: "farm", building_cfg_id: 2, level: 1 }],
      wallet: { food: 10_000, wood: 10, stone: 10_000, iron: 0 },
      cityTroops: [],
      player: { display_name: "君主", level: 1 },
    };
    const panel = new MainCityBuildingPanel(
      mount,
      { farm: "农田" },
      () => session,
      () => {},
      () => "idle",
    );
    panel.attach();
    panel.selectSlot("farm");

    const preview = mount.querySelector('[data-role="build-preview"]');
    expect(preview?.textContent).toContain("升至 Lv2");
    expect(preview?.querySelector(".resource-deficit")?.textContent).toContain("木");
    const btn = mount.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]');
    expect(btn?.disabled).toBe(true);
    const err = mount.querySelector('[data-role="build-form-error"]');
    expect(err?.textContent).toMatch(/^缺少：/);
    panel.detach();
  });

  it("has center-panel id and panel-scroll-body for narrow layout (CLIENT-111)", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { farm: "农田" }, () => null, () => {});
    panel.attach();
    expect(mount.querySelector('[data-center-panel="building"]')).toBeTruthy();
    expect(
      mount.querySelector('[data-center-panel="building"] .panel-scroll-body'),
    ).toBeTruthy();
    panel.detach();
  });
});

describe("MainCityBuildingPanel market and storehouse", () => {
  const session: MainCitySession = {
    cityId: 1,
    cityName: "测试",
    buildings: [{ slot_key: "market", building_cfg_id: 12, level: 3 }],
    wallet: { food: 10_000, wood: 10_000, stone: 10_000, iron: 10_000 },
    cityTroops: [],
    player: { display_name: "君主", level: 1 },
  };

  it("renders offers and dispatches merchant, offer and buy actions", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount,
      { market: "市场", warehouse: "仓库" },
      () => session,
      () => {},
      () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("market");
    panel.setMarket({
      market_level: 3,
      listing_capacity: 3,
      caravan_capacity: 3,
      max_listing_amount: 300000,
      gold: 500,
      offers: [{ offer_id: 9, seller_name: "邻居", resource_type: 1, amount: 200,
        price_milli: 100, gold_total: 20, distance: 4, deliver_seconds: 67 }],
      own_offers: [{ offer_id: 10, resource_type: 0, amount: 50, gold_total: 5 }],
      deliveries: [{ offer_id: 11, resource_type: 2, amount: 10, gold_total: 2,
        deliver_at_ms: Date.now() + 60_000 }],
    });
    const root = mount.querySelector<HTMLElement>('[data-role="market"]')!;
    expect(root.querySelector('[data-role="market-status"]')?.textContent).toContain("Lv3");
    expect(root.textContent).toContain("邻居");
    expect(root.textContent).toContain("商队运输");
    (root.querySelector('[data-action="buy-merchant"]') as HTMLButtonElement).click();
    (root.querySelector('[data-action="buy-offer"]') as HTMLButtonElement).click();
    (root.querySelector('[data-action="cancel-offer"]') as HTMLButtonElement).click();
    expect(calls.map((c) => c[0])).toEqual(["buy-merchant", "buy-offer", "cancel-offer"]);
    expect(calls[1][5]).toBe(9);
    expect(calls[2][5]).toBe(10);
    panel.detach();
  });

  it("shows warehouse level, capacity and protected resources", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { warehouse: "仓库" }, () => session, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("warehouse");
    panel.setStorehouse({
      level: 4, capacity_bonus: 100000, protection_percent: 16,
      protected_amount: { food: 1600, wood: 800, stone: 400, iron: 200 },
    });
    const status = mount.querySelector('[data-role="storehouse-status"]')?.textContent ?? "";
    expect(status).toContain("Lv4");
    expect(status).toContain("100000");
    expect(status).toContain("16%");
    expect(status).toContain("粮1600");
    panel.detach();
  });
});

describe("MainCityBuildingPanel drill tactics", () => {
  it("saves a per-role focus and renders the preset list", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount, { drill_ground: "校场" }, () => null, () => {}, () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("drill_ground");
    panel.setTactics([
      { unit_cfg_id: 2, target_type: 2, hold: true },
    ]);
    expect(mount.querySelector('[data-role="tactic-list"]')?.textContent).toContain("骑兵 → 弓兵 · 坚守");
    const section = mount.querySelector<HTMLElement>('[data-role="drill-tactics"]')!;
    (section.querySelector('[data-field="tactic-troop"]') as HTMLSelectElement).value = "2";
    (section.querySelector('[data-field="tactic-target"]') as HTMLSelectElement).value = "2";
    (section.querySelector('[data-field="tactic-hold"]') as HTMLInputElement).checked = true;
    (section.querySelector('[data-action="save-tactic"]') as HTMLButtonElement).click();
    expect(calls).toEqual([[2, 2, true]]);
    panel.detach();
  });
});
