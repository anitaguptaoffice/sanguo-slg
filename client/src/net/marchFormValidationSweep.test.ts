import { describe, expect, it } from "vitest";
import {
  formatMarchFormValidationSweepLine,
  MARCH_FORM_VALIDATION_SWEEP_WARN_CLASS,
  syncMarchFormValidationSweepLine,
} from "@/net/marchFormValidationSweep";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";
import { validateMarchForm, MARCH_FORM_INFANTRY_UNIT_CFG_ID } from "@/net/marchFormValidation";

describe("formatMarchFormValidationSweepLine (CLIENT-238)", () => {
  const troops = [{ unit_cfg_id: MARCH_FORM_INFANTRY_UNIT_CFG_ID, count: 100 }];
  const heroExtras = {
    heroIdRaw: "1",
    ownedHeroes: [{ hero_id: 1, template_cfg_id: 1001, status: 1 }],
  };

  it("summarizes coord, troop, and target when valid", () => {
    const validation = validateMarchForm({
      toXRaw: "10",
      toYRaw: "20",
      marchCountRaw: "30",
      ...heroExtras,
      cityX: 60,
      cityY: 60,
      cityTroops: troops,
    });
    expect(validation.ok).toBe(true);
    const reserve = formatMarchFormTroopReserveLine(30, 100);
    const r = formatMarchFormValidationSweepLine(validation, reserve, {
      toXRaw: "10",
      toYRaw: "20",
    });
    expect(r.hasWarn).toBe(false);
    expect(r.line).toContain("坐标 (10,20) ✓");
    expect(r.line).toContain("兵力 已选 30/可用 100 ✓");
    expect(r.line).toContain("目标 格点有效 ✓");
  });

  it("flags troop reserve deficit without hiding CLIENT-206 semantics", () => {
    const validation = validateMarchForm({
      toXRaw: "10",
      toYRaw: "20",
      marchCountRaw: "120",
      ...heroExtras,
      cityX: 60,
      cityY: 60,
      cityTroops: troops,
    });
    expect(validation.ok).toBe(false);
    const reserve = formatMarchFormTroopReserveLine(120, 100);
    const r = formatMarchFormValidationSweepLine(validation, reserve, {
      toXRaw: "10",
      toYRaw: "20",
    });
    expect(r.hasWarn).toBe(true);
    expect(r.line).toContain("兵力 超出城内可用");
  });

  it("syncMarchFormValidationSweepLine toggles warn class", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p data-role="march-form-validation-sweep-line"></p>`;
    syncMarchFormValidationSweepLine(root, { line: "校验汇总", hasWarn: true });
    const el = root.querySelector('[data-role="march-form-validation-sweep-line"]')!;
    expect(el.textContent).toBe("校验汇总");
    expect(el.classList.contains(MARCH_FORM_VALIDATION_SWEEP_WARN_CLASS)).toBe(true);
    syncMarchFormValidationSweepLine(root, { line: "ok", hasWarn: false });
    expect(el.classList.contains(MARCH_FORM_VALIDATION_SWEEP_WARN_CLASS)).toBe(false);
  });
});
