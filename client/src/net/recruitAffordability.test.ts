import { describe, expect, it, vi } from "vitest";
import {
  compareRecruitAffordability,
  recruitAffordabilityPrimaryLine,
  recruitAffordabilitySecondaryLine,
  setRecruitAffordabilityErrorDisplay,
} from "@/net/recruitAffordability";

describe("compareRecruitAffordability", () => {
  it("marks each resource and item with sufficient vs insufficient", () => {
    const result = compareRecruitAffordability(
      { food: 100, gold: 50 },
      {
        recruit_cost: { food: 80, wood: 10, gold: 100 },
        recruit_item: { item_cfg_id: 2004, quantity: 2 },
      },
      [{ item_cfg_id: 2004, quantity: 1 }],
    );
    expect(result.canAfford).toBe(false);
    expect(result.insufficientReason).toContain("木不足");
    expect(result.insufficientReason).toContain("币不足");
    expect(result.insufficientReason).toContain("贤士名册不足");
    const food = result.lines.find((l) => l.label === "粮");
    const wood = result.lines.find((l) => l.label === "木");
    expect(food?.sufficient).toBe(true);
    expect(wood?.sufficient).toBe(false);
    expect(recruitAffordabilitySecondaryLine(result)).toContain("粮");
    expect(recruitAffordabilitySecondaryLine(result)).toContain("✓");
    expect(recruitAffordabilitySecondaryLine(result)).toContain("不足");
  });

  it("returns canAfford when wallet and bag cover cost", () => {
    const result = compareRecruitAffordability(
      { food: 500 },
      { recruit_cost: { food: 100 } },
      [],
    );
    expect(result.canAfford).toBe(true);
    expect(result.insufficientReason).toBeNull();
    expect(result.lines).toEqual([
      { kind: "resource", label: "粮", required: 100, available: 500, sufficient: true },
    ]);
  });

  it("does not call RecruitHero (pure function)", () => {
    const recruitHero = vi.fn();
    compareRecruitAffordability({}, { recruit_cost: { gold: 1 } });
    expect(recruitHero).not.toHaveBeenCalled();
  });
});

describe("recruitAffordabilityPrimaryLine", () => {
  it("shows template name and rarity", () => {
    expect(
      recruitAffordabilityPrimaryLine({
        template_cfg_id: 1001,
        template_name: "玄德",
        rarity: 5,
      }),
    ).toBe("玄德 · 稀有5");
  });
});

describe("setRecruitAffordabilityErrorDisplay", () => {
  it("shows and clears recruit-form-error sibling", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="march-form-error-sibling hidden" data-role="recruit-form-error"></p>`;
    const el = root.querySelector('[data-role="recruit-form-error"]')!;
    setRecruitAffordabilityErrorDisplay(root, "粮食不足");
    expect(el.textContent).toBe("粮食不足");
    expect(el.classList.contains("hidden")).toBe(false);
    setRecruitAffordabilityErrorDisplay(root, null);
    expect(el.textContent).toBe("");
    expect(el.classList.contains("hidden")).toBe(true);
  });
});
