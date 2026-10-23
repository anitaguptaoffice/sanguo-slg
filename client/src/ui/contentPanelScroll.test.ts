import { describe, expect, it } from "vitest";
import {
  NARROW_SCROLL_CENTER_PANEL_IDS,
  NARROW_SCROLL_SIDEBAR_PANEL_IDS,
  panelScrollBody,
  resetCenterPanelViewportScroll,
} from "@/ui/contentPanelScroll";

describe("contentPanelScroll (CLIENT-070 + CLIENT-078 + CLIENT-095 + CLIENT-103 + CLIENT-111 + CLIENT-119)", () => {
  it("lists narrow-scroll center panel ids including military mail daily world rank", () => {
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("military");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("mail");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("daily");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("hero");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("world");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("rank");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("march");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("battle-report");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("shop");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("guild");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("chat");
  });

  it("lists narrow-scroll sidebar id for main-city building panel (CLIENT-111)", () => {
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("mail");
    expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain("queue");
  });

  it("lists narrow-scroll center ids for bag shop hero military (CLIENT-119)", () => {
    for (const id of ["bag", "shop", "hero", "military"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("resets scroll on panel-scroll-body when present", () => {
    const panel = document.createElement("div");
    const body = document.createElement("div");
    body.className = "panel-scroll-body";
    body.scrollTop = 90;
    panel.appendChild(body);
    resetCenterPanelViewportScroll(panel);
    expect(body.scrollTop).toBe(0);
  });

  it("panelScrollBody finds nested scroll region", () => {
    const panel = document.createElement("div");
    panel.innerHTML = `<div class="panel-scroll-body" data-role="mail-scroll"></div>`;
    expect(panelScrollBody(panel)?.dataset.role).toBe("mail-scroll");
  });
});
