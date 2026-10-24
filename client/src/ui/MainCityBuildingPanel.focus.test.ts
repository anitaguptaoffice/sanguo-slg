import { describe, expect, it } from "vitest";
import { MainCityBuildingPanel } from "@/ui/MainCityBuildingPanel";

describe("MainCityBuildingPanel keyboard (CLIENT-135)", () => {
  it("Escape closes panel and returns focus to dismiss trigger", () => {
    const mount = document.createElement("div");
    const trigger = document.createElement("button");
    trigger.type = "button";
    document.body.append(trigger);

    const panel = new MainCityBuildingPanel(
      mount,
      { farm: "农田" },
      () => null,
      () => {},
      () => "idle",
      undefined,
      () => trigger,
    );
    panel.attach();
    panel.selectSlot("farm");
    expect(panel.isOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(panel.isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);

    panel.detach();
    trigger.remove();
  });
});
