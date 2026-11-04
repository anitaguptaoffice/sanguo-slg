import { describe, expect, it, vi } from "vitest";
import { MainCityCityOfficePanel } from "./MainCityCityOfficePanel";
const heroes = [{ hero_id: 1, template_cfg_id: 1, level: 1 }, { hero_id: 2, template_cfg_id: 2, level: 2 }];
function setup(chief = 0) {
  const root = document.createElement("div"); root.innerHTML = '<div data-role="building-scroll"></div>';
  const onAppoint = vi.fn(), onClear = vi.fn(); const panel = new MainCityCityOfficePanel({ onAppoint, onClear }); panel.mountInto(root);
  panel.setVisibleForHallSlot("hall"); panel.setHeroes(heroes); panel.setChiefView({ city_id: 1, hero_id: chief }); panel.setPhase("idle");
  const select = () => root.querySelector<HTMLSelectElement>('[data-role="city-chief-hero-select"]')!;
  const button = () => root.querySelector<HTMLButtonElement>('[data-action="appoint-chief"]')!;
  const pick = (id: number) => { select().value = id ? String(id) : ""; select().dispatchEvent(new Event("change", { bubbles: true })); };
  return { root, panel, onAppoint, onClear, select, button, pick };
}
describe("city chief selection", () => {
  it("enables appointment immediately when selecting a hero for a vacant office", () => {
    const s = setup(); expect(s.button().disabled).toBe(true); s.pick(2); expect(s.button().disabled).toBe(false); s.button().click(); expect(s.onAppoint).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("preserves the chosen replacement across background hero and march refreshes", () => {
    const s = setup(1); s.pick(2); s.panel.setHeroes([...heroes]); s.panel.setMarchingHeroIds(new Set());
    expect(s.select().value).toBe("2"); s.button().click(); expect(s.onAppoint).toHaveBeenCalledExactlyOnceWith(2);
  });  it("defaults to the incumbent until the user explicitly chooses", () => {
    const s = setup(1); expect(s.select().value).toBe("1"); s.panel.setChiefView({ hero_id: 2 }); expect(s.select().value).toBe("2");
  });
  it("preserves an explicit empty choice rather than falling back to the incumbent", () => {
    const s = setup(1); s.pick(0); expect(s.button().disabled).toBe(true); s.panel.setHeroes([...heroes]); s.panel.setChiefView({ hero_id: 1 });
    expect(s.select().value).toBe(""); s.button().click(); expect(s.onAppoint).not.toHaveBeenCalled();
  });
  it("clears a removed selection without silently appointing a different hero", () => {
    const s = setup(1); s.pick(2); s.panel.setHeroes([heroes[0]]); expect(s.select().value).toBe(""); expect(s.button().disabled).toBe(true);
    s.panel.setHeroes(heroes); expect(s.select().value).toBe(""); s.button().click(); expect(s.onAppoint).not.toHaveBeenCalled();
  });
  it("keeps a marching choice visible but blocked, and enables it after return", () => {
    const s = setup(); s.pick(2); s.panel.setMarchingHeroIds(new Set([2])); expect(s.select().value).toBe("2"); expect(s.button().disabled).toBe(true);
    s.button().click(); expect(s.onAppoint).not.toHaveBeenCalled(); s.panel.setMarchingHeroIds(new Set()); expect(s.button().disabled).toBe(false);
    s.button().click(); expect(s.onAppoint).toHaveBeenCalledExactlyOnceWith(2);
  });
  it.each(["loading", "appointing", "clearing"] as const)("preserves a valid choice across %s while blocking submission", (phase) => {
    const s = setup(1); s.pick(2); s.panel.setPhase(phase); expect(s.select().disabled).toBe(true); expect(s.button().disabled).toBe(true);
    s.button().click(); expect(s.onAppoint).not.toHaveBeenCalled(); s.panel.setPhase("idle"); expect(s.select().value).toBe("2"); expect(s.button().disabled).toBe(false);
  });
  it("renders cached updates when the hall section becomes visible again", () => {
    const s = setup(1); s.pick(2); s.panel.setVisibleForHallSlot("farm"); s.panel.setHeroes([heroes[0]]); s.panel.setVisibleForHallSlot("hall");
    expect(s.select().value).toBe(""); expect(s.button().disabled).toBe(true);
  });
  it("preserves a valid replacement through hide/show and chief updates", () => {
    const s = setup(1); s.pick(2); s.panel.setVisibleForHallSlot(null); s.panel.setChiefView({ hero_id: 1, loyalty: 80 }); s.panel.setVisibleForHallSlot("hall");
    expect(s.select().value).toBe("2"); s.button().click(); expect(s.onAppoint).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("clears validation feedback on selection and leaves clear-chief behavior intact", () => {
    const s = setup(1); s.panel.setFormError("old error"); s.pick(2); expect(s.root.querySelector('[data-role="city-chief-form-error"]')!.textContent).toBe("");
    s.root.querySelector<HTMLButtonElement>('[data-action="clear-chief"]')!.click(); expect(s.onClear).toHaveBeenCalledTimes(1);
    s.panel.setChiefView({ hero_id: 0 }); expect(s.root.querySelector<HTMLButtonElement>('[data-action="clear-chief"]')!.disabled).toBe(true);
  });
  it("starts a remounted section with the current chief default, not an old explicit choice", () => {
    const s = setup(1); s.pick(2); s.root.innerHTML = '<div data-role="building-scroll"></div>'; s.panel.mountInto(s.root); s.panel.setVisibleForHallSlot("hall");
    expect(s.select().value).toBe("1");
  });
});
