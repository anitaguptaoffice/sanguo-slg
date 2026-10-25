import { describe, expect, it, vi } from "vitest";
import {
  buildRecruitSuccessFeedback,
  focusRecruitedHeroListRow,
  formatRecruitSuccessLine,
  HERO_ROW_RECRUITED_PULSE_CLASS,
  RECRUIT_SUBMIT_INFLIGHT_LABEL,
  RECRUIT_SUBMIT_INFLIGHT_PREVIEW,
  RECRUIT_SUBMITTING_CLASS,
  RECRUIT_SUCCESS_PULSE_CLASS,
  RECRUIT_SUCCESS_PULSE_MS,
  recruitSubmitButtonDisabled,
  recruitSubmitButtonLabel,
  resolveRecruitSubmitPhase,
  scheduleHeroRecruitRowPulse,
  scheduleRecruitWalletSweepPulse,
  syncRecruitSubmitButton,
  syncRecruitSubmittingLine,
  walletMaterialDeductPulseKeys,
} from "@/net/recruitSubmitFeedback";

describe("resolveRecruitSubmitPhase", () => {
  it("prioritizes inflight over success and error", () => {
    expect(
      resolveRecruitSubmitPhase({
        inflight: true,
        lastError: "道具不足",
        lastSuccessHeroId: 9,
      }),
    ).toBe("inflight");
  });

  it("maps error and success when idle", () => {
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: "粮食不足", lastSuccessHeroId: null }),
    ).toBe("error");
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: null, lastSuccessHeroId: 42 }),
    ).toBe("success");
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: null, lastSuccessHeroId: null }),
    ).toBe("idle");
  });

  it("treats whitespace-only error and non-positive hero id as idle", () => {
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: "   ", lastSuccessHeroId: 5 }),
    ).toBe("success");
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: null, lastSuccessHeroId: 0 }),
    ).toBe("idle");
    expect(
      resolveRecruitSubmitPhase({ inflight: false, lastError: null, lastSuccessHeroId: -1 }),
    ).toBe("idle");
  });

  it("prefers error over success when both are set while idle", () => {
    expect(
      resolveRecruitSubmitPhase({
        inflight: false,
        lastError: "道具不足 [10001]",
        lastSuccessHeroId: 12,
      }),
    ).toBe("error");
  });
});

describe("recruit submit button helpers", () => {
  it("disables while inflight even when affordable", () => {
    expect(recruitSubmitButtonDisabled("inflight", true)).toBe(true);
    expect(recruitSubmitButtonDisabled("idle", false)).toBe(true);
    expect(recruitSubmitButtonDisabled("success", true)).toBe(false);
    expect(recruitSubmitButtonLabel("inflight")).toBe(RECRUIT_SUBMIT_INFLIGHT_LABEL);
    expect(recruitSubmitButtonLabel("error")).toBe("招募");
  });

  it("syncRecruitSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="recruit-hero">招募</button>`;
    const btn = root.querySelector("button")!;
    syncRecruitSubmitButton(root, "inflight", true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(RECRUIT_SUBMIT_INFLIGHT_LABEL);
    syncRecruitSubmitButton(root, "idle", true);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("招募");
  });
});

describe("walletMaterialDeductPulseKeys", () => {
  it("returns material keys with cost and negative wallet delta only", () => {
    expect(
      walletMaterialDeductPulseKeys(
        { food: 1000, wood: 500, gold: 10 },
        { food: 400, wood: 500, gold: 10 },
        { food: 600, wood: 100, gold: 5 },
      ),
    ).toEqual(["food"]);
    expect(
      walletMaterialDeductPulseKeys({ food: 100, wood: 40 }, { food: 50, wood: 25 }, { food: 50, wood: 10 }),
    ).toEqual(["food", "wood"]);
    expect(walletMaterialDeductPulseKeys({ food: 100 }, { food: 100 }, { food: 50 })).toEqual([]);
  });
});

describe("hero recruit row pulse", () => {
  it("scheduleHeroRecruitRowPulse toggles hero-row-recruited-pulse class", () => {
    const row = document.createElement("li");
    scheduleHeroRecruitRowPulse(row);
    expect(row.classList.contains(HERO_ROW_RECRUITED_PULSE_CLASS)).toBe(true);
  });

  it("focusRecruitedHeroListRow scrolls hero-scroll and pulses matching row", () => {
    const panel = document.createElement("div");
    const scroll = document.createElement("div");
    scroll.setAttribute("data-role", "hero-scroll");
    const row = document.createElement("li");
    row.setAttribute("data-hero-id", "7");
    row.setAttribute("data-template-cfg-id", "1001");
    scroll.appendChild(row);
    panel.appendChild(scroll);
    focusRecruitedHeroListRow(panel, 7);
    expect(row.classList.contains(HERO_ROW_RECRUITED_PULSE_CLASS)).toBe(true);
  });
});

describe("formatRecruitSuccessLine", () => {
  it("includes template name and deduct summary without extra hero RPC fields", () => {
    const line = formatRecruitSuccessLine(
      { hero_id: 7, template_cfg_id: 1001, level: 2 },
      { template_cfg_id: 1001, template_name: "玄德", recruit_cost: { food: 100 } },
    );
    expect(line).toBe("招募成功：玄德 · 已扣 粮100");
    expect(line).not.toContain("#7");
  });
});

describe("recruit submitting line (CLIENT-183)", () => {
  it("syncRecruitSubmittingLine toggles recruit-submitting on preview", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p data-role="recruit-preview">预览</p>`;
    const preview = root.querySelector("[data-role='recruit-preview']")!;
    syncRecruitSubmittingLine(root, true);
    expect(preview.classList.contains(RECRUIT_SUBMITTING_CLASS)).toBe(true);
    expect(preview.textContent).toBe(RECRUIT_SUBMIT_INFLIGHT_PREVIEW);
    syncRecruitSubmittingLine(root, false);
    expect(preview.classList.contains(RECRUIT_SUBMITTING_CLASS)).toBe(false);
  });

  it("scheduleRecruitWalletSweepPulse applies recruit-success-pulse for 1.5s", () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="recruit-preview"></p>
      <ul><li data-template-id="1001"><span class="recruit-afford-secondary"></span></li></ul>
    `;
    const secondary = root.querySelector(".recruit-afford-secondary")!;
    scheduleRecruitWalletSweepPulse(root, 1001);
    expect(secondary.classList.contains(RECRUIT_SUCCESS_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(RECRUIT_SUCCESS_PULSE_MS);
    expect(secondary.classList.contains(RECRUIT_SUCCESS_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});

describe("buildRecruitSuccessFeedback", () => {
  it("includes formatRecruitSuccessLine text and detail link when hero_id present", () => {
    const fb = buildRecruitSuccessFeedback(
      { hero_id: 7, template_cfg_id: 1001, level: 2 },
      { template_cfg_id: 1001, template_name: "玄德", recruit_cost: { food: 1 } },
    );
    expect(fb.statusText).toContain("玄德");
    expect(fb.statusText).toContain("已扣");
    expect(fb.showDetailLink).toBe(true);
    expect(fb.heroId).toBe(7);
    const noLink = buildRecruitSuccessFeedback({ template_cfg_id: 1001 }, undefined);
    expect(noLink.showDetailLink).toBe(false);
  });
});
