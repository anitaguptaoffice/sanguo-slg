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
});
