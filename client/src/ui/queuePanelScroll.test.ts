import { describe, expect, it } from "vitest";
import {
  resetContentPanelScroll,
  resetGameViewportScroll,
  resetQueuePanelViewportScroll,
} from "@/ui/queuePanelScroll";

describe("queuePanelScroll", () => {
  it("resets panel scroll offsets to origin", () => {
    const el = document.createElement("div");
    el.scrollTop = 120;
    el.scrollLeft = 40;
    resetContentPanelScroll(el);
    expect(el.scrollTop).toBe(0);
    expect(el.scrollLeft).toBe(0);
  });

  it("resets #game-viewport scroll", () => {
    const vp = document.createElement("div");
    vp.id = "game-viewport";
    document.body.appendChild(vp);
    vp.scrollTop = 262;
    resetGameViewportScroll();
    expect(vp.scrollTop).toBe(0);
    vp.remove();
  });

  it("resets viewport and panel together", () => {
    const vp = document.createElement("div");
    vp.id = "game-viewport";
    const panel = document.createElement("div");
    vp.appendChild(panel);
    document.body.appendChild(vp);
    vp.scrollTop = 40;
    panel.scrollTop = 80;
    resetQueuePanelViewportScroll(panel);
    expect(vp.scrollTop).toBe(0);
    expect(panel.scrollTop).toBe(0);
    vp.remove();
  });
});
