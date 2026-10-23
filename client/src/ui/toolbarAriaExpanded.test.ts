import { describe, expect, it } from "vitest";
import { syncToolbarAriaExpanded, type ToolbarPanelOpenState } from "@/ui/toolbarAriaExpanded";

function allClosed(): ToolbarPanelOpenState {
  return {
    military: false,
    reports: false,
    marches: false,
    chat: false,
    guild: false,
    rank: false,
    quest: false,
    daily: false,
    bag: false,
    shop: false,
    hero: false,
    mail: false,
    world: false,
    queue: false,
  };
}

describe("toolbarAriaExpanded", () => {
  it("sets aria-expanded on panel toggle buttons only", () => {
    const toolbar = document.createElement("div");
    toolbar.innerHTML = `
      <button type="button" data-action="refresh">刷新</button>
      <button type="button" data-action="toggle-mail"><span class="toolbar-btn-label">邮件</span></button>
      <button type="button" data-action="toggle-daily">日常</button>
    `;
    syncToolbarAriaExpanded(toolbar, { ...allClosed(), mail: true, daily: false });
    expect(toolbar.querySelector('[data-action="refresh"]')?.getAttribute("aria-expanded")).toBeNull();
    expect(toolbar.querySelector('[data-action="toggle-mail"]')?.getAttribute("aria-expanded")).toBe(
      "true",
    );
    expect(toolbar.querySelector('[data-action="toggle-daily"]')?.getAttribute("aria-expanded")).toBe(
      "false",
    );
  });
});
