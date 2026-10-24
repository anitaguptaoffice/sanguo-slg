import { describe, expect, it } from "vitest";
import {
  militaryListPhaseChipReducer,
  MILITARY_LIST_PHASE_CHIP_ORDER,
  parseMilitaryListPhaseChipPhase,
} from "@/net/militaryListPhaseChip";
import { DEFAULT_MILITARY_LIST_FILTER } from "@/net/militaryListFilter";

describe("militaryListPhaseChipReducer", () => {
  it("selects phase and preserves eta sort", () => {
    const base = { phase: "all" as const, etaSort: "eta_desc" as const };
    const next = militaryListPhaseChipReducer(base, { type: "select", phase: "outbound" });
    expect(next).toEqual({ phase: "outbound", etaSort: "eta_desc" });
  });

  it("toggles active non-all phase back to all", () => {
    const base = { phase: "return" as const, etaSort: "default" as const };
    expect(militaryListPhaseChipReducer(base, { type: "select", phase: "return" })).toEqual({
      phase: "all",
      etaSort: "default",
    });
  });

  it("does not change state when clicking all while already all", () => {
    const base = DEFAULT_MILITARY_LIST_FILTER;
    expect(militaryListPhaseChipReducer(base, { type: "select", phase: "all" })).toBe(base);
  });

  it("restore replaces filter wholesale", () => {
    const saved = { phase: "stationed" as const, etaSort: "eta_asc" as const };
    expect(
      militaryListPhaseChipReducer(DEFAULT_MILITARY_LIST_FILTER, { type: "restore", filter: saved }),
    ).toEqual(saved);
  });

  it("ignores unknown phase tokens", () => {
    const base = { phase: "outbound" as const, etaSort: "default" as const };
    expect(
      militaryListPhaseChipReducer(base, {
        type: "select",
        phase: "nope" as "outbound",
      }),
    ).toBe(base);
  });
});

describe("parseMilitaryListPhaseChipPhase", () => {
  it("covers chip order tokens", () => {
    for (const phase of MILITARY_LIST_PHASE_CHIP_ORDER) {
      expect(parseMilitaryListPhaseChipPhase(phase)).toBe(phase);
    }
    expect(parseMilitaryListPhaseChipPhase("bogus")).toBeNull();
  });
});
