import { describe, expect, it, vi } from "vitest";
import {
  formatMarchIntelSecondaryLine,
  formatMarchListSecondaryWithSubmitted,
  formatMarchQueueBanner,
  MARCH_INTEL_TO_QUEUE_BANNER_ACTION,
  MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION,
  MARCH_ROW_SUBMITTED_STAMP,
  marchQueueBannerDomId,
  openMarchPanelAndHighlight,
  openMilitaryQueueBannerAndHighlight,
  resolveMarchQueueJumpIndex,
  syncMarchQueueBanner,
} from "@/net/marchQueueBanner";

describe("marchQueueBanner", () => {
  it("formatMarchQueueBanner renders latest march summary", () => {
    expect(formatMarchQueueBanner(42, 10, 20)).toBe("最新出征 #42 → (10,20)");
  });

  it("resolveMarchQueueJumpIndex wires banner dom id and intel row selector", () => {
    expect(resolveMarchQueueJumpIndex(7)).toEqual({
      marchId: 7,
      bannerDomId: marchQueueBannerDomId(7),
      intelRowSelector: '.march-list li[data-march-id="7"]',
    });
  });

  it("formatMarchListSecondaryWithSubmitted prefixes stamp", () => {
    expect(formatMarchListSecondaryWithSubmitted("剩余 3m · 行军中", true)).toBe(
      `${MARCH_ROW_SUBMITTED_STAMP} · 剩余 3m · 行军中`,
    );
    expect(formatMarchListSecondaryWithSubmitted("行军中", false)).toBe("行军中");
  });

  it("formatMarchIntelSecondaryLine adds stamp for recent highlight", () => {
    const line = formatMarchIntelSecondaryLine(
      { march_id: 1, phase: 2, arrive_at_ms: Date.now() + 120_000 },
      Date.now(),
      { march_id: 1, highlighted_at_ms: Date.now() },
    );
    expect(line.startsWith(`${MARCH_ROW_SUBMITTED_STAMP} ·`)).toBe(true);
  });

  it("syncMarchQueueBanner renders clickable banner and optional pulse", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" class="hidden" data-role="march-queue-banner"></button>`;
    syncMarchQueueBanner(root, { march_id: 9, to_x: 3, to_y: 4 }, { pulse: true });
    const btn = root.querySelector<HTMLButtonElement>('[data-role="march-queue-banner"]')!;
    expect(btn.classList.contains("hidden")).toBe(false);
    expect(btn.textContent).toBe("最新出征 #9 → (3,4)");
    expect(btn.getAttribute("data-action")).toBe(MARCH_QUEUE_BANNER_OPEN_INTEL_ACTION);
    expect(btn.id).toBe(marchQueueBannerDomId(9));
    expect(btn.classList.contains("march-queue-banner-pulse")).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(btn.classList.contains("march-queue-banner-pulse")).toBe(false);
    vi.useRealTimers();
  });

  it("openMarchPanelAndHighlight delegates to intel open + row highlight", () => {
    const openMarchIntel = vi.fn();
    const highlightIntelRow = vi.fn();
    openMarchPanelAndHighlight(5, { openMarchIntel, highlightIntelRow });
    expect(openMarchIntel).toHaveBeenCalledWith(5);
    expect(highlightIntelRow).toHaveBeenCalledWith(resolveMarchQueueJumpIndex(5));
  });

  it("openMilitaryQueueBannerAndHighlight opens military and highlights banner", () => {
    const openMilitaryPanel = vi.fn();
    const highlightMilitaryBanner = vi.fn();
    openMilitaryQueueBannerAndHighlight(8, { openMilitaryPanel, highlightMilitaryBanner });
    expect(openMilitaryPanel).toHaveBeenCalled();
    expect(highlightMilitaryBanner).toHaveBeenCalledWith(resolveMarchQueueJumpIndex(8));
  });

  it("intel row jump action constant is stable for DOM wiring", () => {
    expect(MARCH_INTEL_TO_QUEUE_BANNER_ACTION).toBe("march-intel-to-queue-banner");
  });
});
