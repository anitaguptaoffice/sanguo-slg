import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
// Mounted production controller and DOM events, strictly FIFO read responses.
// These tests do not substitute for real browser/layout acceptance.
const clean: Array<() => void> = [];
const flush = () => new Promise<void>(r => setTimeout(r, 0));
const templates = [1001, 1002, 1003].map(template_cfg_id => ({
  template_cfg_id, template_name: `Template ${template_cfg_id}`, pool: "standard",
  recruit_cost: { food: 10 }, recruit_item: { item_cfg_id: 2004, quantity: 1 },
}));
const heroes = [{ hero_id: 7, template_cfg_id: 1002, level: 1 },
  { hero_id: 8, template_cfg_id: 1003, level: 1 }];
const detail = (id: number) => ({ hero_id: id, template_cfg_id: id === 7 ? 1002 : 1003,
  template_name: `Hero ${id}`, level: 1, loyalty: 90,
  attributes: { force: 1, intel: 1, politics: 1, command: 1 } });
beforeEach(() => sessionStorage.clear());
afterEach(() => { clean.splice(0).forEach(fn => fn()); document.body.innerHTML = ""; vi.restoreAllMocks(); });
async function setup(cold = false) {
  let queueing = false, generation = 1;
  const queue: Array<{ route: string; finish: (error?: Error) => void }> = [];
  const completed: string[] = [];
  const rpc = (route: string, result: unknown): Promise<unknown> => queueing
    ? new Promise((resolve, reject) => queue.push({ route, finish: error => {
      completed.push(route); error ? reject(error) : resolve(result);
    } })) : Promise.resolve(result);
  const gateway = {
    getSessionId: () => "actor-one", getSessionGeneration: () => generation, getBoundServerId: () => 1,
    listPlayerBag: vi.fn(() => rpc("bag", { items: [{ item_cfg_id: 2004, quantity: 2 }] })),
    listPlayerHeroes: vi.fn(() => rpc("heroes", { heroes, total_count: heroes.length })),
    getHeroDetail: vi.fn((_sid: number, id: number) => rpc(`detail${id}`, detail(id))),
    listRecruitTemplates: vi.fn(() => rpc("templates", { templates, total_count: templates.length })),
    listHotelRecruitCandidates: vi.fn(() => rpc("hotel", { candidates: [] })),
    listCaptiveHeroes: vi.fn(() => rpc("captives", { captives: [] })),
    listPersuadeTargets: vi.fn(() => rpc("persuade", { targets: [] })),
    listComingHeroes: vi.fn(() => rpc("coming", { coming: [] })),
    listPlayerMail: vi.fn(() => rpc("mail", { mails: [], total_count: 0 })),
    recruitHero: vi.fn(),
  };
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 },
    wallet: { food: 10000, wood: 10000, stone: 10000, iron: 10000, gold: 10000 },
    bag: [], buildings: [], cityTroops: [] } as MainCitySession;
  const mount = document.createElement("div"); document.body.append(mount);
  const status = vi.fn();
  const panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session,
    patch => Object.assign(session, patch), status);
  panel.attach(); clean.push(() => panel.detach());
  const click = (action: string) => {
    const button = mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
    expect(button, `real mounted ${action} button`).not.toBeNull(); button!.click();
  };
  const selectHero = (id: number) => {
    const row = mount.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`);
    expect(row, `real mounted hero row ${id}`).not.toBeNull(); row!.click();
  };
  if (cold) await panel.openHeroDetailDeepLink(7);
  else { panel.toggleHero(); await flush(); selectHero(7); await flush(); }
  await flush();
  const host = () => mount.querySelector<HTMLDetailsElement>('[data-role="hero-recruit-host"]')!;
  const select = () => mount.querySelector<HTMLSelectElement>('[data-field="template-select"]')!;
  const button = () => mount.querySelector<HTMLButtonElement>('[data-action="recruit-hero"]')!;
  const feedback = () => status.mock.calls.map(args => args[0] as string);
  const drain = async (failFirst = false) => {
    let n = 0;
    while (queue.length) {
      if (++n > 30) throw new Error("unexpected request loop");
      queue.shift()!.finish(failFirst && n === 1 ? new Error("cold template failure") : undefined);
      await flush();
    }
  };
  status.mockClear();
  return { panel, mount, gateway, click, selectHero, host, select, button, status, feedback,
    session, relogin: () => { generation++; }, queue, completed, drain, startQueue: () => { queueing = true; } };
}
describe("passing controls", () => {
  it("warm path really selects matching template without submitting recruitment", async () => {
    const f = await setup();
    expect(f.host().open).toBe(false);
    expect(f.button().closest("details")).toBe(f.host());
    expect(f.mount.querySelector('li[data-template-id="1002"]')!.closest("details")).toBeNull();
    f.click("hero-goto-recruit"); await flush();
    expect(f.select().value).toBe("1002");
    expect(f.mount.querySelector('li[data-template-id="1002"]')!.classList.contains("selected")).toBe(true);
    expect(f.gateway.recruitHero).not.toHaveBeenCalled();
    expect(f.feedback()).toContain("招募区已预选模板 #1002");
  });
  it("fresh public hero deep link genuinely leaves templates cold, then reads one controller route", async () => {
    const f = await setup(true);
    expect(f.gateway.listRecruitTemplates).not.toHaveBeenCalled();
    expect(f.mount.querySelector('[data-role="hero-detail"]')!.textContent).toContain("Hero 7");
    f.startQueue(); f.click("hero-goto-recruit");
    expect(f.queue.map(q => q.route)).toEqual(["templates"]);
    await f.drain(); expect(f.completed).toEqual(["templates"]);
    expect(f.select().value).toBe("1002");
    expect(f.gateway.recruitHero).not.toHaveBeenCalled();
  });
  it("manual native summary expansion really opens recruitment controls", async () => {
    const f = await setup(); f.host().querySelector("summary")!.click();
    expect(f.host().open).toBe(true);
    expect(f.button().closest("details")!.open).toBe(true);
  });
});
describe("expected behavior regressions", () => {
  it("warm hero to recruit should reveal the selector, cost and submit controls", async () => {
    const f = await setup(); f.click("hero-goto-recruit"); await flush();
    expect(f.select().value).toBe("1002");
    expect(f.host().open, "explicit recruit handoff must reveal native details controls").toBe(true);
  });
  it.each(["selector", "row"])("manual expansion survives a newer template %s selection", async source => {
    const f = await setup(); f.host().querySelector("summary")!.click();
    expect(f.host().open).toBe(true);
    if (source === "selector") {
      f.select().value = "1001";
      f.select().dispatchEvent(new Event("change", { bubbles: true }));
    } else f.mount.querySelector<HTMLElement>('li[data-template-id="1001"]')!.click();
    await flush(); expect(f.select().value).toBe("1001");
    expect(f.host().open, "template selection must not collapse the form being used").toBe(true);
  });
  for (const mode of ["back", "hero", "peer"] as const) {
    it.each([false, true])(`cold template read cannot publish after newer ${mode}, rejection=%s`, async fail => {
      const f = await setup(true); f.startQueue(); f.click("hero-goto-recruit");
      expect(f.queue.map(q => q.route)).toEqual(["templates"]);
      if (mode === "back") f.click("hero-back-to-list");
      if (mode === "hero") f.selectHero(8);
      if (mode === "peer") f.panel.openMailPanel();
      const sent = f.queue.map(q => q.route); expect(sent[0]).toBe("templates");
      if (mode === "hero") expect(sent).toEqual(["templates", "detail8"]);
      f.status.mockClear(); await f.drain(fail);
      expect(f.completed.slice(0, sent.length)).toEqual(sent); // No reversed response fixture.
      if (mode === "hero") expect(f.mount.querySelector('[data-role="hero-detail"]')!.textContent).toContain("Hero 8");
      if (mode === "peer") expect(f.panel.getHeroRoot().classList.contains("hidden")).toBe(true);
      if (!fail) expect.soft(f.select().value, "obsolete hero 7 handoff must not select its template").not.toBe("1002");
      expect.soft(f.feedback(), "inner template read must not overwrite newer navigation feedback")
        .not.toContain(fail ? "cold template failure" : "招募模板 3/3 条");
      expect.soft(f.feedback(), "outer continuation must not claim stale handoff success")
        .not.toContain("招募区已预选模板 #1002");
      expect(f.gateway.recruitHero).not.toHaveBeenCalled();
    });
  }
});

it("current cold failure stays truthful and a later explicit retry succeeds", async () => {
  const f = await setup(true); f.startQueue(); f.click("hero-goto-recruit"); await f.drain(true);
  expect(f.feedback()).toContain("cold template failure");
  expect(f.feedback()).not.toContain("招募区已预选模板 #1002");
  f.click("hero-goto-recruit"); await f.drain();
  expect(f.host().open).toBe(true); expect(f.select().value).toBe("1002");
  expect(f.gateway.listRecruitTemplates).toHaveBeenCalledTimes(2);
  expect(f.gateway.recruitHero).not.toHaveBeenCalled();
});
it("an unavailable template does not claim a successful handoff", async () => {
  const f = await setup(true);
  f.gateway.listRecruitTemplates.mockImplementationOnce(() => Promise.resolve({ templates: templates.slice(0, 1), total_count: 1 }));
  f.click("hero-goto-recruit"); await flush();
  expect(f.feedback()).toContain("招募模板 #1002 当前不可用，请刷新模板列表");
  expect(f.feedback()).not.toContain("招募区已预选模板 #1002");
});
it.each(["close", "reopen", "relogin", "city", "detach", "aba"])("cold handoff loses ownership on %s", async mode => {
  const f = await setup(true); f.startQueue(); f.click("hero-goto-recruit");
  if (mode === "close") f.panel.toggleHero();
  if (mode === "reopen") { f.panel.toggleHero(); f.panel.toggleHero(); }
  if (mode === "relogin") f.relogin();
  if (mode === "city") f.session.cityId = 2;
  if (mode === "detach") { f.panel.detach(); f.panel.attach(); }
  if (mode === "aba") { f.selectHero(8); f.selectHero(7); }
  f.status.mockClear(); await f.drain();
  expect(f.feedback()).not.toContain("招募区已预选模板 #1002");
  expect(f.gateway.recruitHero).not.toHaveBeenCalled();
});
it("explicit handoff persists across template refresh; new hero restores compact layout", async () => {
  const f = await setup(); f.click("hero-goto-recruit"); await flush();
  expect(f.host().open).toBe(true); f.click("refresh-templates"); await flush();
  expect(f.host().open).toBe(true);
  f.selectHero(8); await flush(); expect(f.host().open).toBe(false);
  f.click("hero-back-to-list"); expect(f.host().open).toBe(true);
});
it("manual collapsed recruitment survives data refresh in list view", async () => {
  const f = await setup(); f.click("hero-back-to-list");
  f.host().querySelector("summary")!.click(); expect(f.host().open).toBe(false);
  f.click("refresh-templates"); await flush(); expect(f.host().open).toBe(false);
});
it("a newer bag navigation cancels a cold recruit handoff in FIFO order", async () => {
  const f = await setup(true); f.startQueue(); f.click("hero-goto-recruit");
  f.click("hero-goto-bag-cultivation"); await f.drain();
  expect(f.feedback()).not.toContain("招募区已预选模板 #1002");
});

it("a manual close supersedes a pending cold handoff", async () => {
  const f = await setup(true); f.startQueue(); f.click("hero-goto-recruit");
  f.host().querySelector("summary")!.click(); expect(f.host().open).toBe(true);
  f.host().querySelector("summary")!.click(); expect(f.host().open).toBe(false);
  await f.drain(); expect(f.host().open).toBe(false);
  expect(f.feedback()).not.toContain("招募区已预选模板 #1002");
  expect(f.gateway.recruitHero).not.toHaveBeenCalled();
});
