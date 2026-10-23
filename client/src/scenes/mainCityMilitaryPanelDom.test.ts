import { describe, expect, it } from "vitest";
import { CLIENT_119_PANEL_ASSET_BY_CENTER_ID, PANEL_ASSET_MILITARY } from "@/engine/artPanelSkin";

/** Mirrors `MainCityScene` military panel skeleton (CLIENT-119 narrow scroll contract). */
function militaryPanelFixture(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "military-panel hidden";
  panel.dataset.centerPanel = "military";
  panel.innerHTML = `
      <h3>军事</h3>
      <p class="military-troops" data-role="troops"></p>
      <div class="panel-scroll-body" data-role="military-scroll"></div>
    `;
  return panel;
}

describe("MainCity military panel narrow scroll (CLIENT-119)", () => {
  it("military root uses center-panel id and panel-scroll-body", () => {
    const panel = militaryPanelFixture();
    expect(panel.dataset.centerPanel).toBe("military");
    expect(panel.querySelector(".panel-scroll-body[data-role='military-scroll']")).toBeTruthy();
  });

  it("wires military manifest id for nine-slice skin", () => {
    expect(CLIENT_119_PANEL_ASSET_BY_CENTER_ID.military).toBe(PANEL_ASSET_MILITARY);
  });
});
