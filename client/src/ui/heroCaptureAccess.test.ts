import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const session = () => ({ serverId: 1, cityId: 1, cityName: "城", wallet: { gold: 99999 }, buildings: [], cityTroops: [], bag: [] });
function setup(overrides: Record<string, unknown> = {}) {
  const root = document.createElement("div");
  root.className = "layout-narrow";
  document.body.append(root);
  const rows = [{ hero_id: 1, city_id: 1, display_name: "甲" }, { hero_id: 2, city_id: 1, display_name: "乙" }];
  const gateway = {
    getBoundServerId: () => 1,
    listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [] }),
    listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [] }),
    listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
    listCaptiveHeroes: vi.fn().mockResolvedValue({ captives: rows }),
    listComingHeroes: vi.fn().mockResolvedValue({ coming: rows }),
    listPersuadeTargets: vi.fn().mockResolvedValue({ targets: [{ npc_cfg_id: 1, display_name: "甲", state: 1, friend: 30, hire_friend_min: 30 }, { npc_cfg_id: 2, display_name: "乙", state: 1, friend: 30, hire_friend_min: 30 }] }),
    trySummonCaptive: vi.fn().mockImplementation(async (_s, _c, id) => ({ hero_id: id, gold_cost: 0, items: [], summary: `预览${id}` })),
    tryAcceptComing: vi.fn().mockImplementation(async (_s, _c, id) => ({ hero_id: id, summary: `预览${id}` })),
    sureSummonCaptive: vi.fn().mockRejectedValue(new Error("test request")),
    sureAcceptComing: vi.fn().mockRejectedValue(new Error("test request")),
    lionizeHero: vi.fn().mockRejectedValue(new Error("test request")),
    ...overrides,
  };
  const panels = new HeroMailPanels(root, gateway as unknown as GatewayPort, session, () => {}, () => {});
  panels.attach(); panels.toggleHero();
  return { root, gateway, panels };
}
beforeEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
describe("capture target disclosures", () => {
  it.each([
    ["captive-hero-section", "data-captive-id", "captive-summon-confirm", "sureSummonCaptive"],
    ["coming-hero-section", "data-coming-id", "coming-accept-confirm", "sureAcceptComing"],
    ["persuade-section", "data-npc-cfg-id", "persuade-primary", "lionizeHero"],
  ])("reveals %s before action and keyboard-selects the second target", async (role, attr, action, method) => {
    const { root, gateway, panels } = setup(); await tick();
    const section = root.querySelector(`[data-role="${role}"]`)!;
    const details = section.querySelector("details")!;
    const button = section.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
    expect(details.open).toBe(false);
    button.click(); expect(details.open).toBe(true);
    expect(gateway[method as keyof typeof gateway]).not.toHaveBeenCalled();
    section.querySelector(`[${attr}="2"]`)!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await tick();
    expect(section.querySelector("summary")!.textContent).toContain("乙");
    expect(section.querySelector("summary")!.getAttribute("aria-label")).toContain("乙");
    expect(section.querySelector(`[${attr}="2"]`)!.getAttribute("aria-pressed")).toBe("true");
    button.click(); button.click(); await tick();
    expect(gateway[method as keyof typeof gateway]).toHaveBeenCalledTimes(1);
    expect(gateway[method as keyof typeof gateway]).toHaveBeenCalledWith(1, 1, 2);
    panels.toggleHero(); panels.toggleHero(); await tick();
    expect(section.querySelector("summary")!.textContent).toContain("甲");
    panels.detach();
  });
  it.each([
    ["trySummonCaptive", "captive-hero-section", "data-captive-id", "captive-hero-preview", "captive-summon-confirm"],
    ["tryAcceptComing", "coming-hero-section", "data-coming-id", "coming-hero-preview", "coming-accept-confirm"],
  ])("ignores stale %s responses after target changes", async (method, role, attr, preview, action) => {
    let resolveFirst!: (value: unknown) => void;
    const first = new Promise((resolve) => { resolveFirst = resolve; });
    const request = vi.fn().mockImplementation((_s, _c, id) => id === 1 ? first : Promise.resolve({ hero_id: 2, gold_cost: 0, items: [], summary: "当前乙" }));
    const { root, panels } = setup({ [method]: request }); await tick();
    const section = root.querySelector(`[data-role="${role}"]`)!;
    section.querySelector<HTMLElement>(`[${attr}="2"]`)!.click(); await tick();
    expect(request).toHaveBeenCalledWith(1, 1, 2);
    resolveFirst({ hero_id: 1, gold_cost: 999999, items: [], summary: "过期甲" }); await tick();
    expect(section.querySelector(`[data-role="${preview}"]`)!.textContent).toContain("当前乙");
    expect(section.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled).toBe(false);
    panels.detach();
  });
  it("keeps empty and error states reachable without enabling target actions", async () => {
    const { root, panels } = setup({
      listCaptiveHeroes: vi.fn().mockResolvedValue({ captives: [] }),
      listComingHeroes: vi.fn().mockRejectedValue(new Error("test network failure")),
      listPersuadeTargets: vi.fn().mockResolvedValue({ targets: [] }),
    });
    await tick();
    expect(root.querySelector('[data-role="captive-hero-list"]')!.textContent).toContain("暂无俘虏");
    expect(root.querySelector('[data-role="coming-hero-form-error"]')!.textContent).toContain("test network failure");
    for (const action of ["captive-summon-confirm", "coming-accept-confirm", "persuade-primary"]) {
      expect(root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.disabled).toBe(true);
    }
    panels.detach();
  });

});
