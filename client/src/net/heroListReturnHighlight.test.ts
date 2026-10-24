import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  scheduleHeroRowReturnHighlight,
} from "@/net/heroListReturnHighlight";

describe("heroListReturnHighlight (CLIENT-231)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("scheduleHeroRowReturnHighlight adds class for 2s", () => {
    const panel = document.createElement("div");
    const ul = document.createElement("ul");
    ul.className = "hero-list";
    const row = document.createElement("li");
    row.setAttribute("data-hero-id", "7");
    ul.appendChild(row);
    panel.appendChild(ul);

    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const win = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    expect(scheduleHeroRowReturnHighlight(panel, 7, win)).toBe(true);
    expect(row.classList.contains(HERO_LIST_RETURN_HIGHLIGHT_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(2000);
    timeouts[0]?.fn();
    expect(row.classList.contains(HERO_LIST_RETURN_HIGHLIGHT_CLASS)).toBe(false);
  });

  it("returns false when row missing", () => {
    const panel = document.createElement("div");
    expect(scheduleHeroRowReturnHighlight(panel, 3)).toBe(false);
  });
});
