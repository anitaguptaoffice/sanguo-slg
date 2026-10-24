import { describe, expect, it } from "vitest";
import {
  buildMarchFormTroopReserveLine,
  formatMarchFormTroopReserveLine,
  marchFormAllowsSubmit,
  marchFormTroopReserveBlocksSubmit,
  resolveIntelMarchIdForMarchForm,
  scrollIntelRowForMarchForm,
  syncMarchFormTroopReserveLine,
  MARCH_FORM_RESERVE_WARN_CLASS,
} from "@/net/marchFormTroopReserve";
import { validateMarchForm, MARCH_FORM_INFANTRY_UNIT_CFG_ID } from "@/net/marchFormValidation";
import { marchSubmitButtonDisabled, syncMarchSubmitButton } from "@/net/marchSubmitFeedback";

describe("marchFormTroopReserve (CLIENT-206)", () => {
  it("formatMarchFormTroopReserveLine compares selected vs available", () => {
    const ok = formatMarchFormTroopReserveLine(40, 100);
    expect(ok.line).toContain("已选 40");
    expect(ok.line).toContain("城内可用 100");
    expect(ok.insufficient).toBe(false);

    const warn = formatMarchFormTroopReserveLine(120, 100);
    expect(warn.insufficient).toBe(true);
    expect(warn.line).toContain("超出 20");
  });

  it("buildMarchFormTroopReserveLine hides when count unparsable", () => {
    expect(buildMarchFormTroopReserveLine("", [])).toBeNull();
    expect(buildMarchFormTroopReserveLine("abc", [])).toBeNull();
  });

  it("marchFormTroopReserveBlocksSubmit mirrors CLIENT-145 troop check", () => {
    const reserve = buildMarchFormTroopReserveLine("101", [
      { unit_cfg_id: MARCH_FORM_INFANTRY_UNIT_CFG_ID, count: 100 },
    ]);
    expect(marchFormTroopReserveBlocksSubmit(reserve)).toBe(true);

    const validation = validateMarchForm({
      toXRaw: "10",
      toYRaw: "20",
      marchCountRaw: "101",
      cityX: 60,
      cityY: 60,
      cityTroops: [{ unit_cfg_id: MARCH_FORM_INFANTRY_UNIT_CFG_ID, count: 100 }],
    });
    expect(validation.ok).toBe(false);
    expect(marchFormAllowsSubmit(validation, reserve)).toBe(false);
  });

  it("syncMarchFormTroopReserveLine toggles warn class and button disabled", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" class="hidden" data-role="march-form-troop-reserve-line" data-action="march-form-reserve-jump-intel"></button>`;
    const btn = root.querySelector("button")!;

    syncMarchFormTroopReserveLine(root, formatMarchFormTroopReserveLine(30, 100));
    expect(btn.classList.contains("hidden")).toBe(false);
    expect(btn.classList.contains(MARCH_FORM_RESERVE_WARN_CLASS)).toBe(false);
    expect(btn.disabled).toBe(true);

    syncMarchFormTroopReserveLine(root, formatMarchFormTroopReserveLine(150, 100));
    expect(btn.classList.contains(MARCH_FORM_RESERVE_WARN_CLASS)).toBe(true);
    expect(btn.disabled).toBe(false);
  });

  it("syncMarchSubmitButton disables when form cannot submit due to reserve", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="march">出征攻击</button>`;
    const btn = root.querySelector("button")!;
    syncMarchSubmitButton(root, "idle", false);
    expect(btn.disabled).toBe(true);
    expect(marchSubmitButtonDisabled("idle", false)).toBe(true);
    syncMarchSubmitButton(root, "idle", true);
    expect(btn.disabled).toBe(false);
  });

  it("resolveIntelMarchIdForMarchForm prefers march_id then destination", () => {
    const marches = [
      { march_id: 5, to_x: 10, to_y: 10 },
      { march_id: 2, to_x: 20, to_y: 20 },
    ];
    expect(
      resolveIntelMarchIdForMarchForm(marches, { preferredMarchId: 5, toX: 99, toY: 99 }),
    ).toBe(5);
    expect(
      resolveIntelMarchIdForMarchForm(marches, { preferredMarchId: null, toX: 20, toY: 20 }),
    ).toBe(2);
    expect(
      resolveIntelMarchIdForMarchForm(marches, { preferredMarchId: null, toX: 19, toY: 20 }),
    ).toBe(2);
  });

  it("scrollIntelRowForMarchForm highlights matching intel row", () => {
    const intel = document.createElement("div");
    intel.innerHTML = `<ul class="march-list"><li data-march-id="2"></li></ul>`;
    const id = scrollIntelRowForMarchForm(
      intel,
      [{ march_id: 2, to_x: 4, to_y: 6 }],
      { preferredMarchId: null, toX: 4, toY: 6 },
      { durationMs: 0 },
    );
    expect(id).toBe(2);
    expect(
      intel.querySelector("li")?.classList.contains("march-intel-row-coord-sync-highlight"),
    ).toBe(true);
  });
});
