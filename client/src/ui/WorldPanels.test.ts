import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { WorldPanels } from "@/ui/WorldPanels";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("WorldPanels", () => {
  it("lists cities and fills march target on select", async () => {
    const mount = document.createElement("div");
    const form = document.createElement("div");
    form.innerHTML = `<input data-field="to-x" /><input data-field="to-y" />`;
    let filled: { x: number; y: number } | null = null;
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [
          { city_id: 1, name: "主城", x: 60, y: 60, is_capital: true },
          { city_id: 2, name: "分城", x: 10, y: 20 },
        ],
      }),
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "主城",
      player: {},
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new WorldPanels(
      mount,
      gateway,
      () => session,
      {
        marchFormRoot: form,
        onFilled: (x, y) => {
          filled = { x, y };
        },
      },
      () => {},
    );
    panels.attach();
    expect(mount.querySelector('[data-center-panel="world"] .panel-scroll-body')).toBeTruthy();
    panels.toggle();
    await flushPromises();
    const ul = mount.querySelector('[data-role="world-list"]');
    expect(ul?.textContent).toContain("主城 (60,60) · 主城");
    expect(ul?.textContent).toContain("分城 (10,20)");
    const row = ul?.querySelector('li[data-city-id="2"]');
    row?.dispatchEvent(new Event("click", { bubbles: true }));
    expect((form.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("10");
    expect((form.querySelector('[data-field="to-y"]') as HTMLInputElement).value).toBe("20");
    expect(filled).toEqual({ x: 10, y: 20 });
  });

  it("highlights march destination and filters via grid selection callback", async () => {
    const mount = document.createElement("div");
    const form = document.createElement("div");
    form.innerHTML = `<input data-field="to-x" /><input data-field="to-y" />`;
    let gridSel: { x: number; y: number } | null = null;
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true }],
      }),
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "主城",
      player: {},
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new WorldPanels(
      mount,
      gateway,
      () => session,
      { marchFormRoot: form },
      () => {},
      {
        onGridSelectionChange: (g) => {
          gridSel = g;
        },
      },
    );
    panels.attach();
    panels.toggle();
    await flushPromises();

    panels.setMarchDestHighlight({ x: 12, y: 34 });
    const coordRow = mount.querySelector(".world-city-coord-only");
    expect(coordRow?.textContent).toContain("(12,34)");

    mount.querySelector('li[data-city-id="1"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(gridSel).toEqual({ x: 60, y: 60 });
    const selectedRow = mount.querySelector('li[data-city-id="1"]');
    expect(selectedRow?.classList.contains("world-city-row-selected")).toBe(true);

    selectedRow?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(gridSel).toBeNull();
  });

  it("shows march dest count and deep-links to first march on count click", async () => {
    const mount = document.createElement("div");
    const form = document.createElement("div");
    form.innerHTML = `<input data-field="to-x" /><input data-field="to-y" />`;
    let marchGrid: { x: number; y: number } | null = null;
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true }],
      }),
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "主城",
      player: {},
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new WorldPanels(
      mount,
      gateway,
      () => session,
      { marchFormRoot: form },
      () => {},
      {
        getMarchesSnapshot: () => [
          { march_id: 9, to_x: 60, to_y: 60, phase: 1 },
          { march_id: 10, to_x: 60, to_y: 60, phase: 2 },
        ],
        onMarchCountClick: (g) => {
          marchGrid = g;
        },
      },
    );
    panels.attach();
    panels.toggle();
    await flushPromises();

    const countBtn = mount.querySelector(".world-city-row-march-count") as HTMLButtonElement;
    expect(countBtn?.textContent).toContain("指向此格的行军 2 条");
    countBtn?.click();
    expect(marchGrid).toEqual({ x: 60, y: 60 });
  });

  it("shows occupation hint, battle report shortcut, and intel deep link", async () => {
    const mount = document.createElement("div");
    const form = document.createElement("div");
    form.innerHTML = `<input data-field="to-x" /><input data-field="to-y" />`;
    let intelGrid: { x: number; y: number } | null = null;
    let reportGrid: { x: number; y: number; hint?: number } | null = null;
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true, wall_level: 2 }],
      }),
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "主城",
      cityX: 50,
      cityY: 50,
      player: {},
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new WorldPanels(
      mount,
      gateway,
      () => session,
      { marchFormRoot: form },
      () => {},
      {
        getMarchesSnapshot: () => [{ march_id: 1, to_x: 60, to_y: 60, phase: 1 }],
        onViewMarchesAtGrid: (g) => {
          intelGrid = g;
        },
        getBattleReportsSnapshot: () => [
          { report_id: 42, location_x: 60, location_y: 60, created_at_ms: 1 },
        ],
        onViewBattleReportsAtGrid: (g, hint) => {
          reportGrid = { ...g, hint };
        },
      },
    );
    panels.attach();
    panels.toggle();
    await flushPromises();

    mount.querySelector('li[data-city-id="1"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    const card = mount.querySelector('[data-role="world-tile-info"]');
    expect(card?.classList.contains("hidden")).toBe(false);
    expect(card?.textContent).toContain("指向此格进行中行军：1 条");
    expect(mount.querySelector('[data-action="view-marches-at-grid"]')?.textContent).toBe(
      "在军情中查看",
    );
    expect(card?.textContent).toContain("城墙 Lv.2");
    expect(mount.querySelector('[data-action="view-battle-reports-at-grid"]')).toBeTruthy();

    mount.querySelector('[data-action="view-marches-at-grid"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(intelGrid).toEqual({ x: 60, y: 60 });

    mount.querySelector('[data-action="view-battle-reports-at-grid"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    expect(reportGrid).toEqual({ x: 60, y: 60, hint: 42 });
  });

  it("shows CLIENT-129 loading on info card while cities refresh", async () => {
    const mount = document.createElement("div");
    let resolveCities: (v: unknown) => void = () => {};
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolveCities = r;
          }),
      ),
    } as unknown as GatewayPort;
    const panels = new WorldPanels(mount, gateway, () => null, { marchFormRoot: null }, () => {});
    panels.attach();
    panels.selectGridAt(3, 4);
    panels.toggle();
    const state = mount.querySelector('[data-role="world-tile-info-state"]');
    expect(state?.classList.contains("hidden")).toBe(false);
    expect(state?.getAttribute("data-panel-state")).toBe("loading");
    resolveCities({ cities: [] });
    await flushPromises();
    expect(state?.classList.contains("hidden")).toBe(true);
  });

  it("shows recent march secondary line and occupation summary (CLIENT-170)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({
        cities: [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true }],
      }),
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "主城",
      player: {},
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new WorldPanels(
      mount,
      gateway,
      () => session,
      { marchFormRoot: null },
      () => {},
      {
        getMarchesSnapshot: () => [
          { march_id: 7, to_x: 60, to_y: 60, phase: 2, arrive_at_ms: Date.now() + 60_000 },
        ],
      },
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    panels.selectGridAt(60, 60);
    const secondary = mount.querySelector('[data-role="world-tile-march-secondary"]');
    expect(secondary?.textContent).toContain("最近行军 #7");
    expect(mount.querySelector('[data-role="world-tile-info-lines"]')?.textContent).toContain(
      "己方主城",
    );
  });

  it("pulses info card on minimap grid sync and recenters minimap on card click", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({ cities: [] }),
    } as unknown as GatewayPort;
    let centered: { x: number; y: number } | null = null;
    const panels = new WorldPanels(
      mount,
      gateway,
      () => null,
      { marchFormRoot: null },
      () => {},
      {
        onCenterMinimapAtGrid: (g) => {
          centered = g;
        },
      },
    );
    panels.attach();
    panels.toggle();
    panels.selectGridAt(4, 5, { source: "minimap" });
    const card = mount.querySelector('[data-role="world-tile-info"]');
    expect(card?.classList.contains("world-tile-focus-pulse")).toBe(true);
    card?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(centered).toEqual({ x: 4, y: 5 });
  });

  it("shows neutral occupation hint on empty grid selection", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerCities: vi.fn().mockResolvedValue({ cities: [] }),
    } as unknown as GatewayPort;
    const panels = new WorldPanels(
      mount,
      gateway,
      () => null,
      { marchFormRoot: null },
      () => {},
    );
    panels.attach();
    panels.selectGridAt(7, 8);
    const hint = mount.querySelector('[data-role="world-tile-occupation-hint"]');
    expect(hint?.textContent).toContain("暂无城池或玩家占领");
  });
});
