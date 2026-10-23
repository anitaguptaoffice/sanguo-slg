import { describe, expect, it } from "vitest";
import { readTroopRecruitForm, syncTroopRecruitFormPreview } from "@/ui/troopRecruitForm";

describe("syncTroopRecruitFormPreview", () => {
  it("shows preview and disables recruit when resources insufficient", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <select data-field="unit"><option value="1" selected>步兵</option></select>
      <input data-field="recruit-count" value="20" />
      <p data-role="troop-recruit-preview"></p>
      <p class="hidden" data-role="troop-recruit-form-error"></p>
      <button data-action="recruit">募兵</button>
    `;
    syncTroopRecruitFormPreview(root, { food: 0, wood: 0, stone: 0, iron: 0 });
    const preview = root.querySelector('[data-role="troop-recruit-preview"]');
    const err = root.querySelector('[data-role="troop-recruit-form-error"]');
    const btn = root.querySelector<HTMLButtonElement>('[data-action="recruit"]');
    expect(preview?.textContent).toContain("步兵×20");
    expect(preview?.textContent).toContain("耗时");
    expect(err?.textContent).toMatch(/^缺少：/);
    expect(btn?.disabled).toBe(true);
  });

  it("enables recruit when wallet covers cost", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <select data-field="unit"><option value="1" selected>步兵</option></select>
      <input data-field="recruit-count" value="1" />
      <p data-role="troop-recruit-preview"></p>
      <p class="hidden" data-role="troop-recruit-form-error"></p>
      <button data-action="recruit">募兵</button>
    `;
    syncTroopRecruitFormPreview(root, { food: 10_000, wood: 10_000, stone: 0, iron: 0 });
    const btn = root.querySelector<HTMLButtonElement>('[data-action="recruit"]');
    const err = root.querySelector('[data-role="troop-recruit-form-error"]');
    expect(btn?.disabled).toBe(false);
    expect(err?.classList.contains("hidden")).toBe(true);
  });

  it("readTroopRecruitForm reads select and count", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <select data-field="unit"><option value="2" selected>骑兵</option></select>
      <input data-field="recruit-count" value="15" />
    `;
    expect(readTroopRecruitForm(root)).toEqual({ unitCfgId: 2, count: 15 });
  });
});
