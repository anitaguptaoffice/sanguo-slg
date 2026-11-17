import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import * as scrollClip from "./heroDetailScrollClip";

let panel: HeroMailPanels;
beforeEach(() => sessionStorage.clear());
afterEach(() => { panel?.detach(); document.body.replaceChildren(); vi.restoreAllMocks(); });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const goldSelector = 'input[data-action="hero-largess-kind"][value="gold"]';
const bustSelector = '[data-role="hero-detail-bust"]';

async function setup(withAssets = true) {
  const style = document.createElement("style");
  style.textContent = ".hidden { display: none; }";
  const mount = document.createElement("div");
  document.body.append(style, mount);
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 },
    wallet: { gold: 0, food: 500 }, buildings: [], cityTroops: [],
    bag: [{ item_cfg_id: 2051, quantity: 2 }, { item_cfg_id: 2052, quantity: 1 }] } as MainCitySession;
  const gateway = {
    getSessionId: () => "refresh-scroll", getSessionGeneration: () => 1, getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: session.bag })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 1 }, { hero_id: 8, level: 2 }], total_count: 2 })),
    getHeroDetail: vi.fn(async (_server: number, id: number) => ({ hero_id: id, template_cfg_id: 1001,
      level: id === 7 ? 1 : 2, loyalty: 50 })),
    listRecruitTemplates: vi.fn(async () => ({ templates: [{ template_cfg_id: 1001, template_name: "Test",
      recruit_cost: { food: 100 } }], total_count: 1 })),
    largessHero: vi.fn(), recruitHero: vi.fn(), beginHeroExpr: vi.fn(),
  };
  const img = document.createElement("img");
  img.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0foAAAAASUVORK5CYII=";
  const assets = {
    getArtMeta: (id: string) => id.startsWith("hero.") ? { display_size: { w: 128, h: 160 } } : undefined,
    getImageForAsset: vi.fn(() => ({ img, scale: 1 })),
  } as unknown as AssetLoader;
  panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn(),
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    withAssets ? assets : undefined);
  panel.attach();
  const root = mount.querySelector<HTMLElement>('[data-center-panel="hero"]')!;
  const owner = root.querySelector<HTMLElement>('[data-role="hero-scroll"]')!;
  const detail = root.querySelector<HTMLElement>('[data-role="hero-detail"]')!;
  // Synthetic JSDOM layout, not browser evidence: all targets are production-created nodes.
  // Prototype getters also cover later remounts; target positions follow the real scroll owner.
  const originalRect = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    if (this === owner) return new DOMRect(0, 100, 400, 600);
    if (detail.contains(this)) {
      const bust = this.matches(bustSelector);
      const offset = bust ? 400 : this.matches(".hero-detail-name") ? 564 : 1100;
      return new DOMRect(10, 100 + offset - owner.scrollTop, 128, bust ? 160 : 20);
    }
    return originalRect.call(this);
  });
  Object.defineProperties(owner, { scrollHeight: { value: 2000 }, clientHeight: { value: 600 } });
  const position = vi.spyOn(scrollClip, "ensureHeroDetailBustNameInScrollClip"); // Calls the real helper.
  const get = <T extends HTMLElement = HTMLElement>(selector: string) => detail.querySelector<T>(selector)!;
  const selectHero = (id: number) => root.querySelector<HTMLElement>(`li[data-hero-id="${id}"]`)!.click();
  panel.toggleHero(); await flush();
  owner.scrollTop = 1000;
  selectHero(7); await flush();
  expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 7);
  if (withAssets) expect(get<HTMLImageElement>(bustSelector).src).toBe(img.src);
  position.mockClear();
  return { mount, root, owner, detail, get, selectHero, session, gateway, position, assets };
}

function expectTargetVisible(target: HTMLElement, owner: HTMLElement) {
  const clip = scrollClip.effectiveVisibleClipForTargets([target])!;
  expect(clip).toEqual({ left: 0, top: 100, right: 400, bottom: 700 });
  expect.soft(scrollClip.rectsFullyVisibleInClip([target.getBoundingClientRect()], clip)).toBe(true);
  expect(target.closest('[data-role="hero-scroll"]')).toBe(owner);
  expect(target.getBoundingClientRect().top).toBe(1200 - owner.scrollTop);
}

function expectPortraitPositioned(detail: HTMLElement, owner: HTMLElement) {
  const bust = detail.querySelector<HTMLElement>(bustSelector)!;
  const name = detail.querySelector<HTMLElement>(".hero-detail-name")!;
  expect(bust).not.toBeNull(); expect(name).not.toBeNull();
  expect(bust.closest('[data-role="hero-scroll"]')).toBe(owner);
  expect(name.closest('[data-role="hero-scroll"]')).toBe(owner);
  expect(owner.scrollTop).toBe(396);
  expect(scrollClip.rectsFullyVisibleInClip([bust.getBoundingClientRect(), name.getBoundingClientRect()],
    scrollClip.effectiveVisibleClipForTargets([bust])!)).toBe(true);
}

it("retains intentional scroll, visible gold, original focus and live wallet guards across repeated refreshes", async () => {
  const { owner, detail, get, session, gateway, position } = await setup();
  expectPortraitPositioned(detail, owner);
  const gold = get<HTMLInputElement>(goldSelector), bust = get(bustSelector);
  const submit = get<HTMLButtonElement>('[data-action="hero-largess-submit"]');
  const controls = [...detail.querySelectorAll("input, select, button")];
  gold.focus(); owner.scrollTop = 1000;
  for (const [food, amount] of [[500, 0], [500, 0], [50, 1000], [700, 0], [700, 0]]) {
    session.wallet = { food, gold: amount };
    panel.refreshRecruitAffordability();
    expect.soft(owner.scrollTop).toBe(1000); expectTargetVisible(gold, owner);
    const currentControls = [...detail.querySelectorAll("input, select, button")];
    expect(currentControls).toHaveLength(controls.length);
    controls.forEach((control, index) => expect(currentControls[index]).toBe(control));
    expect(get(bustSelector)).toBe(bust); expect(get(goldSelector)).toBe(gold);
    expect(gold.isConnected && gold.checked).toBe(true); expect(document.activeElement).toBe(gold);
    expect(detail.textContent).toContain(`余${food}/需100`); expect(submit.disabled).toBe(amount === 0);
  }
  expect(position).not.toHaveBeenCalled(); expect(gateway.getHeroDetail).toHaveBeenCalledTimes(1);
  expect(gateway.largessHero).not.toHaveBeenCalled(); expect(gateway.recruitHero).not.toHaveBeenCalled();
});

it("keeps selected bag option and visible select while legitimate quantities and disabled guards change", async () => {
  const { owner, get, session, position } = await setup();
  get<HTMLInputElement>('input[data-action="hero-largess-kind"][value="item"]').click();
  const select = get<HTMLSelectElement>('[data-field="hero-largess-item"]');
  select.value = "2052"; select.dispatchEvent(new Event("change", { bubbles: true }));
  const original = get<HTMLSelectElement>('[data-field="hero-largess-item"]');
  const selected = original.querySelector<HTMLOptionElement>('option[value="2052"]')!;
  original.focus(); owner.scrollTop = 900; position.mockClear();
  for (const quantity of [1, 0, 0, 3]) {
    session.bag = [{ item_cfg_id: 2051, quantity: 5 }, { item_cfg_id: 2052, quantity }];
    panel.refreshRecruitAffordability();
    expect.soft(owner.scrollTop).toBe(900); expectTargetVisible(original, owner);
    expect(get('[data-field="hero-largess-item"]')).toBe(original); expect(document.activeElement).toBe(original);
    expect(original.value).toBe("2052");
    expect(original.querySelector('option[value="2052"]')).toBe(selected); expect(selected.disabled).toBe(quantity === 0);
    expect(original.querySelector('option[value="2051"]')!.textContent).toContain("×5");
    expect(get<HTMLInputElement>('input[value="item"]').checked).toBe(true);
    expect(get<HTMLButtonElement>('[data-action="hero-largess-submit"]').disabled).toBe(quantity === 0);
  }
  expect(position).not.toHaveBeenCalled();
});

it("retains each user-selected hour and scroll through repeated affordability updates", async () => {
  const { owner, get, session, gateway, position } = await setup();
  for (const hours of [2, 4, 1]) {
    const selector = `[data-action="hero-expr-hours"][data-hours="${hours}"]`;
    get(selector).click();
    const original = get(selector);
    // The wire parser omits status; approved reentry displays unknown rather than inventing idle.
    const summary = get('[data-role="hero-expr-summary"]').textContent;
    expect([
      `空闲可历练 · ${hours}小时 · 消耗黄金 ${hours * 10} · 预计经验 +${hours * 20}`,
      "当前详情未提供历练状态。若此前已开始历练且已到期，可尝试领取，由服务器核实。",
    ]).toContain(summary);
    original.focus(); owner.scrollTop = 1000; position.mockClear();
    for (const gold of [hours * 10 - 1, hours * 10, hours * 10, 0]) {
      session.wallet = { gold, food: 500 }; panel.refreshRecruitAffordability();
      expect.soft(owner.scrollTop).toBe(1000); expectTargetVisible(original, owner);
      expect(get(selector)).toBe(original); expect(document.activeElement).toBe(original);
      expect(original.getAttribute("aria-pressed")).toBe("true");
      expect(get<HTMLButtonElement>('[data-action="hero-expr-begin"]').disabled).toBe(gold < hours * 10);
      expect(get('[data-role="hero-expr-summary"]').textContent).toBe(summary);
    }
    expect(position).not.toHaveBeenCalled();
  }
  expect(gateway.beginHeroExpr).not.toHaveBeenCalled();
});

it("preserves outside focus and user scroll, then keeps hidden refresh inert", async () => {
  const { root, owner, detail, get, session, position } = await setup();
  const outside = document.createElement("button"); document.body.append(outside);
  outside.focus(); owner.scrollTop = 950;
  const original = get(goldSelector);
  session.wallet = { gold: 1000, food: 99 }; panel.refreshRecruitAffordability();
  expect.soft(owner.scrollTop).toBe(950); expect(document.activeElement).toBe(outside);
  expect(get(goldSelector)).toBe(original); expectTargetVisible(original, owner);
  panel.toggleHero(); const html = root.innerHTML; owner.scrollTop = 875;
  session.wallet = { gold: 0, food: 1 }; panel.refreshRecruitAffordability();
  expect(root.classList.contains("hidden")).toBe(true); expect(root.innerHTML).toBe(html);
  expect(owner.scrollTop).toBe(875); expect(detail.textContent).toContain("余99/需100");
  expect(position).not.toHaveBeenCalled();
});

it("keeps visible disconnected owner scroll safely without a native visibility or focus claim", async () => {
  const { mount, root, owner, get, session, position } = await setup();
  const original = get(goldSelector); mount.remove(); owner.scrollTop = 1000;
  expect(root.isConnected).toBe(false); expect(root.classList.contains("hidden")).toBe(false);
  session.wallet = { gold: 1000, food: 42 };
  expect(() => panel.refreshRecruitAffordability()).not.toThrow();
  expect.soft(owner.scrollTop).toBe(1000); expect(get(goldSelector)).toBe(original);
  expect(get<HTMLButtonElement>('[data-action="hero-largess-submit"]').disabled).toBe(false);
  expect(position).not.toHaveBeenCalled();
});

it("positions a new hero, then positions detail again after public collapse and expansion", async () => {
  const { owner, detail, get, selectHero, gateway, position } = await setup();
  const original = get(goldSelector); owner.scrollTop = 1000;
  selectHero(8); await flush();
  expect(gateway.getHeroDetail).toHaveBeenLastCalledWith(1, 8);
  expect(original.isConnected).toBe(false); expect(detail.querySelector(".hero-detail-level")!.textContent).toBe("Lv2");
  expect(position).toHaveBeenCalled(); expectPortraitPositioned(detail, owner);
  get('[data-action="hero-back-to-list"]').click();
  expect(detail.querySelector(bustSelector)).toBeNull();
  owner.scrollTop = 1000; position.mockClear();
  selectHero(8); await flush();
  expect(position).toHaveBeenCalled(); expectPortraitPositioned(detail, owner);
});

it("positions changed same-id detail and template through a new public load", async () => {
  const { owner, detail, get, selectHero, gateway, position, assets } = await setup();
  const original = get(goldSelector); owner.scrollTop = 1000;
  gateway.getHeroDetail.mockResolvedValue({ hero_id: 7, template_cfg_id: 1002, level: 9, loyalty: 60 });
  selectHero(7); await flush();
  expect(original.isConnected).toBe(false); expect(detail.querySelector(".hero-detail-level")!.textContent).toBe("Lv9");
  expect(assets.getImageForAsset).toHaveBeenCalledWith("hero.bust.1002.v1");
  expect(position).toHaveBeenCalled(); expectPortraitPositioned(detail, owner);
  owner.scrollTop = 1000; position.mockClear(); panel.refreshRecruitAffordability();
  expect(owner.scrollTop).toBe(1000); expect(position).not.toHaveBeenCalled();
});

it("retains ordinary portrait positioning when public refresh fails the DOM preflight", async () => {
  const { owner, detail, get, session, position } = await setup();
  const original = get(goldSelector), summary = get(".recruit-afford-secondary");
  const priorText = summary.textContent;
  get('[data-action="hero-largess-submit"]').remove(); owner.scrollTop = 1000;
  session.wallet = { gold: 1000, food: 42 }; panel.refreshRecruitAffordability();
  expect(original.isConnected).toBe(false); expect(summary.isConnected).toBe(false);
  expect(summary.textContent).toBe(priorText); expect(detail.textContent).toContain("余42/需100");
  expect(get<HTMLButtonElement>('[data-action="hero-largess-submit"]').disabled).toBe(false);
  expect(position).toHaveBeenCalledTimes(1); expectPortraitPositioned(detail, owner);
});

it.each([bustSelector, ".hero-detail-name", '[data-role="hero-detail"]', '[data-role="hero-scroll"]'])(
  "handles a missing %s target without changing the retained owner scroll", async selector => {
    const { root, owner, position } = await setup();
    root.querySelector(selector)!.remove(); owner.scrollTop = 1000;
    expect(() => panel.refreshRecruitAffordability()).not.toThrow();
    expect.soft(owner.scrollTop).toBe(1000); expect(position).not.toHaveBeenCalled();
  },
);

it("keeps no-asset detail safe during stable refresh and normal fallback", async () => {
  const { owner, detail, get, position } = await setup(false);
  expect(detail.querySelector(bustSelector)).toBeNull(); owner.scrollTop = 1000;
  panel.refreshRecruitAffordability();
  expect(owner.scrollTop).toBe(1000); expect(position).not.toHaveBeenCalled();
  get('[data-action="hero-largess-submit"]').remove(); panel.refreshRecruitAffordability();
  expect(position).toHaveBeenCalledTimes(1); expect(owner.scrollTop).toBe(1000);
  expect(detail.querySelector(bustSelector)).toBeNull();
});
