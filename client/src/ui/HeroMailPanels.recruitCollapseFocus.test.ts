import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

const panels: HeroMailPanels[] = [];
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  panels.splice(0).forEach(panel => panel.detach());
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

async function setup(detail = true, templates = false) {
  const gateway = {
    getSessionId: () => "collapse-focus",
    getSessionGeneration: () => 1,
    getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 1 }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, template_name: "Hero 7", level: 1 })),
    listRecruitTemplates: vi.fn(async () => ({ templates: templates ? [{ template_cfg_id: 1001,
      template_name: "Hero 7", already_owned: true, costs: [] }] : [], total_count: templates ? 1 : 0 })),
    recruitHero: vi.fn(),
  };
  const mount = document.createElement("div");
  document.body.append(mount);
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {},
    buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn());
  panels.push(panel);
  panel.attach();
  panel.toggleHero();
  await flush();
  if (templates) {
    mount.querySelector<HTMLElement>('[data-action="refresh-templates"]')!.click();
    await flush();
    expect(mount.querySelector<HTMLSelectElement>('[data-field="template-select"]')!.value).toBe("1001");
  }
  if (detail) {
    mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click();
    await flush();
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 7);
  }
  const host = mount.querySelector<HTMLDetailsElement>('[data-role="hero-recruit-host"]')!;
  const summary = host.querySelector<HTMLElement>(":scope > summary")!;
  expect(host.open).toBe(!detail);
  if (detail) summary.click(); // Native activation, not private controller state injection.
  expect(host.open).toBe(true);
  return { panel, gateway, mount, host, summary };
}

const controls = ['[data-action="refresh-templates"]', '[data-field="template-select"]'];

it.each(controls)("public affordability refresh reaches collapse with the same focused %s", async selector => {
  const { panel, host, gateway } = await setup();
  const control = host.querySelector<HTMLElement>(selector)!;
  control.focus();
  expect(document.activeElement).toBe(control);
  const raw = panel as unknown as { syncHeroRecruitHostExpanded(): void };
  const original = raw.syncHeroRecruitHostExpanded.bind(panel);
  const observations: unknown[] = [];
  vi.spyOn(raw, "syncHeroRecruitHostExpanded").mockImplementation(() => {
    observations.push({ active: document.activeElement, connected: control.isConnected,
      sameNode: host.querySelector(selector) === control, open: host.open });
    original();
  });
  // Production wallet/bag patch entry point calls renderTemplateList before renderHeroList.
  panel.refreshRecruitAffordability();
  expect(observations).toEqual([{ active: control, connected: true, sameNode: true, open: true }]);
  expect(host.open).toBe(false);
  expect(control.isConnected).toBe(true);
  expect(gateway.recruitHero).not.toHaveBeenCalled();
});

it.each(controls)("returns focus to the summary when refresh hides %s", async selector => {
  const { panel, host, summary } = await setup();
  const focus = summary.focus.bind(summary);
  const openAtFocus: boolean[] = [];
  vi.spyOn(summary, "focus").mockImplementation(options => {
    openAtFocus.push(host.open);
    focus(options);
  });
  host.querySelector<HTMLElement>(selector)!.focus();
  panel.refreshRecruitAffordability();
  expect(host.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(openAtFocus).toEqual([true]);
  expect(summary.focus).toHaveBeenCalledWith({ preventScroll: true });
});

it.each(["summary", "outside-host", "outside-root"])("does not steal %s focus on collapse", async location => {
  const { panel, host, summary, mount } = await setup();
  const outside = document.createElement("button");
  document.body.append(outside);
  const target = location === "summary" ? summary : location === "outside-host"
    ? mount.querySelector<HTMLElement>('[data-action="refresh-heroes"]')! : outside;
  target.focus();
  const focus = vi.spyOn(summary, "focus");
  panel.refreshRecruitAffordability();
  expect(host.open).toBe(false);
  expect(document.activeElement).toBe(target);
  expect(focus).not.toHaveBeenCalled();
});

it("does not move focus when list-only refresh keeps recruitment open", async () => {
  const { panel, host, summary } = await setup(false);
  const control = host.querySelector<HTMLElement>(controls[0]!)!;
  control.focus();
  const focus = vi.spyOn(summary, "focus");
  panel.refreshRecruitAffordability();
  expect(host.open).toBe(true);
  expect(document.activeElement).toBe(control);
  expect(focus).not.toHaveBeenCalled();
});

it("does not refocus an already-closed host, and transfers again after native reopening", async () => {
  const { panel, host, summary } = await setup();
  summary.click();
  expect(host.open).toBe(false);
  summary.focus();
  const focus = vi.spyOn(summary, "focus");
  panel.refreshRecruitAffordability();
  expect(host.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(focus).not.toHaveBeenCalled();
  summary.click();
  expect(host.open).toBe(true);
  host.querySelector<HTMLElement>(controls[0]!)!.focus();
  panel.refreshRecruitAffordability();
  expect(host.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(focus).toHaveBeenCalledTimes(1);
});

it("a hidden panel affordability refresh leaves external focus alone", async () => {
  const { panel, summary } = await setup();
  panel.toggleHero();
  const outside = document.createElement("button");
  document.body.append(outside);
  outside.focus();
  const focus = vi.spyOn(summary, "focus");
  panel.refreshRecruitAffordability();
  expect(document.activeElement).toBe(outside);
  expect(focus).not.toHaveBeenCalled();
});

it.each(controls)("loaded templates retain %s until the first of two real list renders", async selector => {
  const { panel, host, summary } = await setup(true, true);
  const control = host.querySelector<HTMLElement>(selector)!;
  control.focus();
  const raw = panel as unknown as { syncHeroRecruitHostExpanded(): void };
  const original = raw.syncHeroRecruitHostExpanded.bind(panel);
  const observations: unknown[] = [];
  vi.spyOn(raw, "syncHeroRecruitHostExpanded").mockImplementation(() => {
    observations.push({ active: document.activeElement, open: host.open,
      sameNode: host.querySelector(selector) === control, connected: control.isConnected });
    original();
  });
  const focus = vi.spyOn(summary, "focus");
  panel.refreshRecruitAffordability();
  expect(observations).toEqual([
    { active: control, open: true, sameNode: true, connected: true },
    { active: summary, open: false, sameNode: true, connected: true },
  ]);
  expect(host.open).toBe(false);
  expect(document.activeElement).toBe(summary);
  expect(focus).toHaveBeenCalledTimes(1);
});
