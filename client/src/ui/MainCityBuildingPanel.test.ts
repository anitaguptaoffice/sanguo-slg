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

describe("MainCityBuildingPanel beacon", () => {
  it("renders warnings and scout reports", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { beacon: "烽火台" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("beacon");
    panel.setIntel(
      [{ warning_id: 1, x: 70, y: 70, attacker_player_id: 9, attacker_troops: 500, beacon_level: 3, arrive_at_ms: Date.now() + 60000 }],
      [{ report_id: 2, x: 61, y: 60, tier: 3, target_name: "平地 Lv7" }],
    );
    const section = mount.querySelector<HTMLElement>('[data-role="beacon"]')!;
    expect(section.textContent).toContain("烽火预警 1 条");
    expect(section.textContent).toContain("敌袭");
    expect(section.textContent).toContain("平地 Lv7");
    panel.detach();
  });
});

describe("MainCityBuildingPanel diplomacy", () => {
  it("renders guild relations and ally garrison", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { diplomacy: "鸿胪寺" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("diplomacy");
    panel.setDiplomacy(
      [{ guild_id: 1, target_guild_id: 2, state: 3, effective_at_ms: Date.now() + 8 * 3600_000, pending: true }],
      [{ city_id: 1, player_id: 1001, unit_cfg_id: 1, count: 4 }],
    );
    const section = mount.querySelector<HTMLElement>('[data-role="diplomacy"]')!;
    expect(section.textContent).toContain("外交 1 条");
    expect(section.textContent).toContain("敌对");
    expect(section.textContent).toContain("待生效");
    expect(section.textContent).toContain("兵种#1 ×4");
    panel.detach();
  });
});

describe("MainCityBuildingPanel special cities", () => {
  it("renders ownership and unlocked units", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { hall: "官府" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("hall");
    panel.setSpecialCities(
      [{ city_cfg_id: 8, city_type: 4, name: "洛阳", x: 250, y: 250, owner_guild_id: 1, owner_guild_name: "汉室盟", garrison: 22000, unit_cfg_id: 14, unit_name: "虎豹骑" }],
      [14],
    );
    const section = mount.querySelector<HTMLElement>('[data-role="rank"]')!;
    expect(section.textContent).toContain("都城 洛阳");
    expect(section.textContent).toContain("汉室盟");
    expect(section.textContent).toContain("守军 22000");
    expect(section.textContent).toContain("已解锁精锐 14");
    panel.detach();
  });
});

describe("MainCityBuildingPanel campaign", () => {
  it("renders unlocked stages and rewards", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { drill_ground: "校场" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("drill_ground");
    panel.setCampaignStages([
      { stage_id: 1, name: "广宗黄巾", chapter: 1, troop_cap: 4000, unlocked: true, cleared: true, stars: 3, defender_total: 2500 },
      { stage_id: 2, name: "宛城黄巾", chapter: 1, troop_cap: 6000, unlocked: false, cleared: false, stars: 0, defender_total: 3800 },
    ]);
    const section = mount.querySelector<HTMLElement>('[data-role="drill-tactics"]')!;
    expect(section.textContent).toContain("已通关 3 星");
    expect(section.textContent).toContain("宛城黄巾（未解锁）");
    const select = section.querySelector<HTMLSelectElement>('[data-field="campaign-stage"]')!;
    expect(select.value).toBe("1");
    panel.detach();
  });
});

describe("MainCityBuildingPanel arena", () => {
  it("renders arena opponents and daily rewards", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { drill_ground: "校场" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("drill_ground");
    panel.setArenaOpponents([
      { opponent_id: 2, name: "西凉骁将", troop_cap: 8000, defender_total: 3800, reward_gold: 500, reward_prestige: 50, reward_item_cfg_id: 2061, reward_item_count: 1 },
    ]);
    const section = mount.querySelector<HTMLElement>('[data-role="drill-tactics"]')!;
    expect(section.textContent).toContain("西凉骁将");
    expect(section.textContent).toContain("上限 8000");
    expect(section.textContent).toContain("宝珠 1");
    expect(section.querySelector<HTMLSelectElement>('[data-field="arena-opponent"]')!.value).toBe("2");
    panel.detach();
  });
});

describe("MainCityBuildingPanel achievements", () => {
  it("renders world phase and claimable milestones", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { hall: "官府" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("hall");
    panel.setAchievements(
      [{ achievement_id: 1, name: "初露锋芒", description: "声望达到 100。", threshold: 100, progress: 120, can_claim: true, reward_gold: 300, reward_prestige: 50 }],
      { phase: 2, name: "群雄割据", next: "占领洛阳", owned_cities: 1, campaign_clears: 5 },
    );
    const section = mount.querySelector<HTMLElement>('[data-role="rank"]')!;
    expect(section.textContent).toContain("世界阶段 2 · 群雄割据");
    expect(section.textContent).toContain("初露锋芒");
    expect(section.textContent).toContain("可领取");
    expect(section.querySelector('[data-action="claim-achievement"]')).toBeTruthy();
    panel.detach();
  });
});

describe("MainCityBuildingPanel world phase reward", () => {
  it("offers the phase reward once the phase is open", () => {
    const mount = document.createElement("div");
    const panel = new MainCityBuildingPanel(mount, { hall: "官府" }, () => null, () => {}, () => "idle");
    panel.attach();
    panel.selectSlot("hall");
    panel.setAchievements([], {
      phase: 2, name: "群雄割据", unlock: "开放郡城、州城国战与州郡税赋。", next: "攻占一座州城",
      can_claim: true, reward_gold: 500, reward_prestige: 50, reward_item_cfg_id: 2061, reward_item_count: 1,
    });
    const section = mount.querySelector<HTMLElement>('[data-role="rank"]')!;
    const btn = section.querySelector<HTMLButtonElement>('[data-action="claim-phase-reward"]')!;
    expect(btn.classList.contains("hidden")).toBe(false);
    expect(btn.disabled).toBe(false);
    expect(section.textContent).toContain("阶段奖励 金500 声望50");
    panel.detach();
  });
});
