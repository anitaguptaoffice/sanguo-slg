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

describe("MainCityBuildingPanel equipment", () => {
  it("renders forge, equipped and inventory actions", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount, { smithy: "铁匠铺" }, () => null, () => {}, () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("smithy");
    panel.setEquipment(11, [
      { equipment_id: 9, slot_type: 2, name: "青龙刀", enhance_level: 2, max_enhance: 9,
        attrs: { force: 12 }, gems: [1], equipped: true },
    ], [
      { equipment_id: 10, slot_type: 3, name: "赤兔马", enhance_level: 0, max_enhance: 9,
        attrs: { force: 3, command: 3 }, speed_pct: 9 },
    ], 3, 3);
    const section = mount.querySelector<HTMLElement>('[data-role="equipment"]')!;
    expect(section.querySelector('[data-role="equipment-status"]')?.textContent).toContain("铁匠铺 Lv3");
    expect(section.querySelector('[data-role="equipment-equipped"]')?.textContent).toContain("青龙刀");
    expect(section.querySelector('[data-role="equipment-inventory"]')?.textContent).toContain("赤兔马");
    (section.querySelector('[data-action="forge-equipment"][data-slot-type="2"][data-tier="2"]') as HTMLButtonElement).click();
    (section.querySelector('[data-action="equip-item"]') as HTMLButtonElement).click();
    (section.querySelector('[data-action="unequip-item"]') as HTMLButtonElement).click();
    expect(calls.map((c) => c[0])).toEqual(["forge-equipment", "equip-item", "unequip-item"]);
    expect(calls[0]).toEqual(["forge-equipment", 2, 2, 0, 1]);
    expect(calls[1][3]).toBe(10);
    expect(calls[2][3]).toBe(9);
    panel.detach();
  });
});

describe("MainCityBuildingPanel historical heroes", () => {
  it("renders rumor states and dispatches search/persuade", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount, { inn: "客栈" }, () => null, () => {}, () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("inn");
    panel.setHistorical([
      { npc_cfg_id: 1001, display_name: "刘备", level: 40, state: 0, discovered: false, x: -1, y: -1 },
      { npc_cfg_id: 1002, display_name: "关羽", level: 40, state: 1, discovered: true, x: 68, y: 68 },
    ]);
    const section = mount.querySelector<HTMLElement>('[data-role="historical"]')!;
    expect(section.querySelector('[data-role="historical-status"]')?.textContent).toContain("500");
    expect(section.textContent).toContain("刘备");
    expect(section.textContent).toContain("被俘");
    (section.querySelector('[data-action="search-historical"]') as HTMLButtonElement).click();
    (section.querySelector('[data-action="persuade-historical"]') as HTMLButtonElement).click();
    expect(calls).toEqual([["search-historical", 1001], ["persuade-historical", 1002]]);
    panel.detach();
  });
});

describe("MainCityBuildingPanel tricks", () => {
  it("dispatches a selected trick with the target march", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount, { recruit_hall: "招贤馆" }, () => null, () => {}, () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("recruit_hall");
    const section = mount.querySelector<HTMLElement>('[data-role="tricks"]')!;
    (section.querySelector('[data-field="trick-march"]') as HTMLInputElement).value = "7";
    (section.querySelector('[data-action="cast-trick"][data-trick-type="2"]') as HTMLButtonElement).click();
    panel.setTrickResult("计谋成功");
    expect(calls).toEqual([[2, 7]]);
    expect(section.querySelector('[data-role="trick-status"]')?.textContent).toBe("计谋成功");
    panel.detach();
  });
});

describe("MainCityBuildingPanel rank and founding", () => {
  it("shows prestige and dispatches promote/found", () => {
    const mount = document.createElement("div");
    const calls: unknown[][] = [];
    const panel = new MainCityBuildingPanel(
      mount, { hall: "官府" }, () => null, () => {}, () => "idle",
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      undefined,
      (...args: unknown[]) => calls.push(args),
    );
    panel.attach();
    panel.selectSlot("hall");
    panel.setRank({ prestige: 120, rank_level: 1, city_cap: 2, next_prestige: 300, next_cap: 3 });
    const section = mount.querySelector<HTMLElement>('[data-role="rank"]')!;
    expect(section.textContent).toContain("声望 120");
    expect(section.textContent).toContain("城市上限 2");
    (section.querySelector('[data-action="promote-rank"]') as HTMLButtonElement).click();
    (section.querySelector('[data-field="found-name"]') as HTMLInputElement).value = "新野";
    (section.querySelector('[data-field="found-x"]') as HTMLInputElement).value = "70";
    (section.querySelector('[data-field="found-y"]') as HTMLInputElement).value = "71";
    (section.querySelector('[data-action="found-city"]') as HTMLButtonElement).click();
    expect(calls).toEqual([["promote", "", 0, 0], ["found", "新野", 70, 71]]);
    panel.detach();
  });
});
