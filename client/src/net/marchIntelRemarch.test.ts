import { describe, expect, it } from "vitest";
import {
  applyMarchIntelRemarchPrefill,
  applyMarchIntelRemarchPrefillWithFeedback,
  buildMarchIntelRemarchPrefill,
  formatMarchIntelLastTroopsSummary,
} from "@/net/marchIntelRemarch";
import { MARCH_TARGET_SESSION_KEY } from "@/net/marchTargetMemory";
import type { MarchSummary } from "@/net/militaryFormat";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("marchIntelRemarch", () => {
  const march: MarchSummary = {
    march_id: 9,
    to_x: 40,
    to_y: 41,
    troops: [{ unit_cfg_id: 1, count: 120 }],
  };

  it("builds prefill from march row destination and troops snapshot", () => {
    expect(buildMarchIntelRemarchPrefill(march)).toEqual({
      toX: 40,
      toY: 41,
      lastTroopsSummary: "上次兵力：步兵×120",
    });
    expect(formatMarchIntelLastTroopsSummary({ march_id: 1 })).toBeNull();
    expect(buildMarchIntelRemarchPrefill({ march_id: 1, to_x: Number.NaN, to_y: 1 })).toBeNull();
  });

  it("applyMarchIntelRemarchPrefill writes form and session memory", () => {
    const storage = mockStorage();
    const root = document.createElement("div");
    root.innerHTML = `<div data-role="march-target-fields"><input data-field="to-x" /><input data-field="to-y" /></div>`;
    const prefill = buildMarchIntelRemarchPrefill(march);
    expect(prefill).not.toBeNull();
    expect(applyMarchIntelRemarchPrefill(root, prefill!, storage)).toBe(true);
    expect((root.querySelector('[data-field="to-x"]') as HTMLInputElement).value).toBe("40");
    expect((root.querySelector('[data-field="to-y"]') as HTMLInputElement).value).toBe("41");
    expect(storage.getItem(MARCH_TARGET_SESSION_KEY)).toBe(JSON.stringify({ x: 40, y: 41 }));
  });

  it("applyMarchIntelRemarchPrefillWithFeedback updates summary after remarch prefill", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <div data-role="march-target-fields"><input data-field="to-x" /><input data-field="to-y" /></div>
      <input data-field="march-count" value="50" />
      <p data-role="march-form-summary"></p>
      <p class="hidden" data-role="march-form-error"></p>
    `;
    const prefill = buildMarchIntelRemarchPrefill(march)!;
    applyMarchIntelRemarchPrefillWithFeedback(root, prefill, {
      cityX: 5,
      cityY: 5,
      cityTroops: [{ unit_cfg_id: 1, count: 200 }],
      clockMs: 0,
    });
    expect(root.querySelector('[data-role="march-form-summary"]')?.textContent).toContain("(40,41)");
  });
});
