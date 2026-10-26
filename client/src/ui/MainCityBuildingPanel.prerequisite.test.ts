import { afterEach, describe, expect, it, vi } from "vitest";
import type { MainCitySession } from "@/net/bootstrapSession";
import { buildUpgradePrerequisiteHint } from "@/net/buildUpgradePrerequisite";
import { MainCityBuildingPanel } from "@/ui/MainCityBuildingPanel";

function city(hallLevel = 2): MainCitySession {
  return {
    serverId: 1, cityId: 1, cityName: "测试", player: {}, bag: [], cityTroops: [],
    wallet: { food: 10000, wood: 10000, stone: 10000, iron: 10000 },
    buildings: [
      { slot_key: "hall", building_cfg_id: 1, level: hallLevel },
      { slot_key: "farm", building_cfg_id: 2, level: 2 },
    ],
  };
}

describe("building hall prerequisites", () => {
  let panel: MainCityBuildingPanel;
  afterEach(() => panel?.detach());
  function mount(initial: MainCitySession | null = city(), submitState = "idle" as "idle" | "submitting" | "error") {
    let session = initial;
    const onUpgrade = vi.fn();
    panel = new MainCityBuildingPanel(document.createElement("div"),
      { farm: "农田", hall: "城主府" }, () => session, onUpgrade, () => submitState);
    panel.attach();
    panel.selectSlot("farm");
    const root = panel.getRoot();
    return {
      onUpgrade,
      button: root.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]')!,
      hint: root.querySelector<HTMLElement>('[data-role="build-prerequisite"]')!,
      update(next: MainCitySession | null, sync = true) { session = next; if (sync) panel.sync(); },
    };
  }

  it("disables affordable farm 2→3 at hall 2 with an accessible actionable reason", () => {
    const { button, hint, onUpgrade } = mount();
    expect(button.disabled).toBe(true);
    expect(hint.textContent).toBe("需城主府达到 Lv3（当前 Lv2）；请先升级城主府");
    expect(button.getAttribute("aria-describedby")).toBe(hint.id);
    button.click();
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("allows the exact boundary after normal session refresh and clears the warning", () => {
    const { update, button, hint, onUpgrade } = mount();
    update(city(3));
    expect(button.disabled).toBe(false);
    expect(hint.textContent).toBe("");
    expect(hint.classList.contains("hidden")).toBe(true);
    button.click();
    expect(onUpgrade).toHaveBeenCalledExactlyOnceWith("farm", 2);
  });

  it("permits hall 2→3 rather than applying its own level cap", () => {
    const { button, hint, onUpgrade } = mount();
    panel.selectSlot("hall");
    expect(button.disabled).toBe(false);
    expect(hint.textContent).toBe("");
    button.click();
    expect(onUpgrade).toHaveBeenCalledExactlyOnceWith("hall", 1);
  });

  it("waits for hydration, does not count an in-progress hall level, and resets when session disappears", () => {
    const { update, button, hint } = mount(null);
    expect(button.disabled).toBe(true);
    const state = city();
    state.buildings[0].upgrade_finish_at_ms = Date.now() + 60000;
    update(state);
    expect(button.disabled).toBe(true);
    expect(hint.textContent).toContain("当前 Lv2");
    update(city(3));
    expect(button.disabled).toBe(false);
    update(null);
    expect(button.disabled).toBe(true);
    expect(hint.textContent).toBe("");
  });

  it("rechecks changed state at activation and never calls the upgrade callback", () => {
    const { update, button, hint, onUpgrade } = mount(city(3));
    update(city(2), false);
    button.click();
    expect(button.disabled).toBe(true);
    expect(hint.textContent).toContain("当前 Lv2");
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it.each(["wallet", "upgrading", "submitting"])("keeps the existing %s blocker", (blocker) => {
    const state = city(3);
    if (blocker === "wallet") state.wallet = {};
    if (blocker === "upgrading") state.buildings[1].upgrade_finish_at_ms = Date.now() + 60000;
    const { button, onUpgrade } = mount(state, blocker === "submitting" ? "submitting" : "idle");
    expect(button.disabled).toBe(true);
    button.click();
    expect(onUpgrade).not.toHaveBeenCalled();
  });

  it("does not hide a current prerequisite behind a previous server error", () => {
    const { hint, button } = mount(city(2), "error");
    panel.setFormError("服务端错误");
    panel.sync();
    expect(hint.textContent).toContain("需城主府达到 Lv3");
    expect(button.disabled).toBe(true);
    expect(panel.getRoot().querySelector('[data-role="build-form-error"]')?.textContent).toBe("服务端错误");
  });

  it.each([[6, 2], [7, 3]])("preserves first-construction threshold for cfg %i", (cfg, required) => {
    expect(buildUpgradePrerequisiteHint(cfg, 1, city(required - 1).buildings)).toContain(`Lv${required}`);
    expect(buildUpgradePrerequisiteHint(cfg, 1, city(required).buildings)).toBeNull();
  });

  it("uses cfg identity, handles missing hall as level 0, and preserves hall's other-building guard", () => {
    expect(buildUpgradePrerequisiteHint(2, 3, [{ slot_key: "capital", building_cfg_id: 1, level: 3 }])).toBeNull();
    expect(buildUpgradePrerequisiteHint(2, 1, [])).toContain("当前 Lv0");
    expect(buildUpgradePrerequisiteHint(1, 1, [])).toBeNull();
    expect(buildUpgradePrerequisiteHint(1, 2, [{ building_cfg_id: 2, level: 3 }])).toContain("当前最高 Lv3");
  });
});
