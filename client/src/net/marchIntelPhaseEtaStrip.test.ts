import { describe, expect, it } from "vitest";
import {
  formatMarchIntelPhaseEtaStrip,
  INTEL_ROW_PHASE_SUBLINE_CLASS,
  MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  syncMarchIntelPhaseEtaMutualHighlight,
} from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";

describe("formatMarchIntelPhaseEtaStrip (CLIENT-205)", () => {
  const now = Date.UTC(2024, 0, 1, 8, 0, 0);

  it("shows phase label only for non-marching phases", () => {
    expect(formatMarchIntelPhaseEtaStrip({ phase: 1 }, now)).toBe("待发");
    expect(formatMarchIntelPhaseEtaStrip({ phase: 3 }, now)).toBe("已到达");
  });

  it("includes seconds, remaining minutes, and arrive time for marching phase", () => {
    const m: MarchSummary = {
      phase: 2,
      arrive_at_ms: now + 90_000,
    };
    const line = formatMarchIntelPhaseEtaStrip(m, now);
    expect(line).toContain("行军中");
    expect(line).toContain("剩 90s");
    expect(line).toContain("剩余 2m");
    expect(line).toContain("到达 ");
  });

  it("uses return phase label for phase 4", () => {
    const m: MarchSummary = {
      phase: 4,
      arrive_at_ms: now + 120_000,
    };
    const line = formatMarchIntelPhaseEtaStrip(m, now);
    expect(line).toContain("撤回中");
    expect(line).toContain("剩 120s");
  });
});

describe("syncMarchIntelPhaseEtaMutualHighlight (CLIENT-205)", () => {
  it("highlights info card strip and matching list subline", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <aside data-role="march-info-card">
        <p data-role="march-info-card-phase-eta-strip" class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}">行军中</p>
      </aside>
      <ul class="march-list">
        <li data-march-id="3"><span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">行军中</span></li>
        <li data-march-id="4"><span class="${INTEL_ROW_PHASE_SUBLINE_CLASS}">待发</span></li>
      </ul>
    `;
    syncMarchIntelPhaseEtaMutualHighlight(root, 3);
    expect(
      root.querySelector(
        `[data-role="march-info-card-phase-eta-strip"].${MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS}`,
      ),
    ).toBeTruthy();
    expect(
      root.querySelector(
        `li[data-march-id="3"] .${INTEL_ROW_PHASE_SUBLINE_CLASS}.${MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS}`,
      ),
    ).toBeTruthy();
    expect(
      root.querySelector(
        `li[data-march-id="4"] .${MARCH_INTEL_PHASE_ETA_MUTUAL_HIGHLIGHT_CLASS}`,
      ),
    ).toBeFalsy();
  });
});
