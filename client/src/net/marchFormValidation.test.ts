import { describe, expect, it } from "vitest";
import { HERO_MARCH_FORCE_SESSION_KEY } from "@/net/heroMarchForceSession";
import {
  MARCH_FORM_INFANTRY_UNIT_CFG_ID,
  setMarchFormErrorDisplay,
  validateMarchForm,
  WORLD_MAP_COORD_MAX,
} from "@/net/marchFormValidation";

describe("validateMarchForm", () => {
  const ownedHeroes = [{ hero_id: 7, template_cfg_id: 1001, level: 1, loyalty: 50, status: 1 }];
  const base = {
    toXRaw: "10",
    toYRaw: "20",
    marchCountRaw: "30",
    heroIdRaw: "7",
    ownedHeroes,
    cityX: 60,
    cityY: 60,
    cityTroops: [{ unit_cfg_id: MARCH_FORM_INFANTRY_UNIT_CFG_ID, count: 100 }],
  };

  it("accepts valid coords in 0..499 and march count within available", () => {
    expect(validateMarchForm({ ...base, toXRaw: "0", toYRaw: String(WORLD_MAP_COORD_MAX) })).toEqual({
      ok: true,
      toX: 0,
      toY: WORLD_MAP_COORD_MAX,
      marchCount: 30,
      heroId: 7,
    });
  });

  it("rejects empty coordinate fields", () => {
    const r = validateMarchForm({ ...base, toXRaw: "", toYRaw: " " });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toContain("目标 X 不能为空");
      expect(r.message).toContain("目标 Y 不能为空");
    }
  });

  it("rejects NaN and non-integer coordinates", () => {
    const nan = validateMarchForm({ ...base, toXRaw: "abc" });
    expect(nan).toEqual({ ok: false, message: "目标 X 须为有效数字" });

    const frac = validateMarchForm({ ...base, toYRaw: "3.5" });
    expect(frac).toEqual({ ok: false, message: "目标 Y 须为整数" });
  });

  it("rejects coordinates outside 0..499", () => {
    const low = validateMarchForm({ ...base, toXRaw: "-1" });
    expect(low.ok).toBe(false);
    if (!low.ok) expect(low.message).toContain("0～499");

    const high = validateMarchForm({ ...base, toYRaw: "500" });
    expect(high.ok).toBe(false);
    if (!high.ok) expect(high.message).toContain("0～499");
  });

  it("rejects target on own city tile", () => {
    const r = validateMarchForm({ ...base, toXRaw: "60", toYRaw: "60" });
    expect(r).toEqual({ ok: false, message: "不能与己方城池同格" });
  });

  it("rejects march count above available infantry", () => {
    const r = validateMarchForm({
      ...base,
      marchCountRaw: "101",
      cityTroops: [{ unit_cfg_id: 1, count: 100 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("不能超过城内可用（当前 100）");
  });

  it("rejects empty or non-positive march count", () => {
    expect(validateMarchForm({ ...base, marchCountRaw: "" }).ok).toBe(false);
    expect(validateMarchForm({ ...base, marchCountRaw: "0" }).ok).toBe(false);
  });

  it("rejects march without hero selection", () => {
    const r = validateMarchForm({ ...base, heroIdRaw: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("请选择带队将领");
  });

  it("rejects march when session cached hero march force is too low", () => {
    sessionStorage.setItem(
      HERO_MARCH_FORCE_SESSION_KEY,
      JSON.stringify({ "7": { current: 5, max: 40, updatedAtMs: 1 } }),
    );
    const r = validateMarchForm({
      ...base,
      heroIdRaw: "7",
      ownedHeroes: [{ hero_id: 7, template_cfg_id: 1001, level: 1, loyalty: 50, status: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("体力不足");
    sessionStorage.removeItem(HERO_MARCH_FORCE_SESSION_KEY);
  });
});

describe("setMarchFormErrorDisplay", () => {
  it("shows and clears march-form-error element", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="march-form-error hidden" data-role="march-form-error"></p>`;
    const el = root.querySelector('[data-role="march-form-error"]')!;
    setMarchFormErrorDisplay(root, "校验失败");
    expect(el.textContent).toBe("校验失败");
    expect(el.classList.contains("hidden")).toBe(false);
    setMarchFormErrorDisplay(root, null);
    expect(el.textContent).toBe("");
    expect(el.classList.contains("hidden")).toBe(true);
  });
});
