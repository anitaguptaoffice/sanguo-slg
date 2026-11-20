import { describe, expect, it, vi } from "vitest";
import { MainCityCityOfficePanel } from "./MainCityCityOfficePanel";

function setup() {
  const root = document.createElement("div");
  root.innerHTML = '<div data-role="building-scroll"></div>';
  const onCivicDecree = vi.fn();
  const panel = new MainCityCityOfficePanel({ onAppoint: vi.fn(), onClear: vi.fn(), onCivicDecree });
  panel.mountInto(root);
  panel.setVisibleForHallSlot("hall");
  return { root, panel, onCivicDecree };
}

describe("city civic panel", () => {
  it("renders population, tax and work rate", () => {
    const { root, panel } = setup();
    panel.setCivicView({
      name: "新野", population: 1600, population_cap: 2000, morale: 82, tax_rate: 10,
      work_rate: 100, effective_work_rate: 80, idle_population: 1100, troops: 120,
      food_upkeep_per_hour: 12, gold_per_hour: 16, gold: 240,
    });
    expect(root.textContent).toContain("人口 1,600/2,000");
    expect(root.textContent).toContain("民心 82");
    expect(root.textContent).toContain("实际 80%");
    expect(root.textContent).toContain("税金 16/h");
  });

  it("sends the five decree actions with their values", () => {
    const { root, panel, onCivicDecree } = setup();
    panel.setCivicView({ name: "主城", tax_rate: 10, work_rate: 100 });
    root.querySelector<HTMLInputElement>('[data-field="civic-tax"]')!.value = "25";
    root.querySelector<HTMLButtonElement>('[data-action="decree-tax"]')!.click();
    expect(onCivicDecree).toHaveBeenLastCalledWith(1, 25, "主城");
    root.querySelector<HTMLInputElement>('[data-field="civic-work"]')!.value = "70";
    root.querySelector<HTMLButtonElement>('[data-action="decree-work"]')!.click();
    expect(onCivicDecree).toHaveBeenLastCalledWith(2, 70, "主城");
    for (const [action, decree] of [["decree-pacify", 3], ["decree-levy", 4]]) {
      root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
      expect(onCivicDecree).toHaveBeenLastCalledWith(decree, 0, "主城");
    }
    root.querySelector<HTMLInputElement>('[data-field="civic-name"]')!.value = "新野";
    root.querySelector<HTMLButtonElement>('[data-action="decree-rename"]')!.click();
    expect(onCivicDecree).toHaveBeenLastCalledWith(5, 0, "新野");
  });
});
