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
