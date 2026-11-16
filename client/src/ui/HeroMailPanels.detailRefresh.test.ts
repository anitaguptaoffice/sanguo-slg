import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

let panel: HeroMailPanels;
beforeEach(() => sessionStorage.clear());
afterEach(() => { panel?.detach(); document.body.replaceChildren(); vi.restoreAllMocks(); });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
async function setup(detailOverrides: Record<string, unknown> = {}) {
  const style = document.createElement("style");
  style.textContent = ".hidden { display: none; }";
  const mount = document.createElement("div");
  document.body.append(style, mount);
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 },
    wallet: { gold: 0, food: 500 }, buildings: [], cityTroops: [],
    bag: [{ item_cfg_id: 2051, quantity: 2 }, { item_cfg_id: 2052, quantity: 1 }] } as MainCitySession;
  const gateway = {
    getSessionId: () => "detail-refresh", getSessionGeneration: () => 1, getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: session.bag })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 1 }, { hero_id: 8, level: 2 }], total_count: 2 })),
    getHeroDetail: vi.fn(async (_server: number, id: number) => ({ hero_id: id, template_cfg_id: 1001, level: id === 7 ? 1 : 2, loyalty: 50, ...detailOverrides })),
    listRecruitTemplates: vi.fn(async () => ({ templates: [{ template_cfg_id: 1001, template_name: "Test", recruit_cost: { food: 100 } }], total_count: 1 })),
    largessHero: vi.fn(), recruitHero: vi.fn(),
  };
  panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn());
  panel.attach(); panel.toggleHero(); await flush();
  mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 7);
  const root = mount.querySelector<HTMLElement>('[data-center-panel="hero"]')!;
  const detail = root.querySelector<HTMLElement>('[data-role="hero-detail"]')!;
  const radio = (value = "gold") => detail.querySelector<HTMLInputElement>(`input[data-action="hero-largess-kind"][value="${value}"]`)!;
  const submit = () => detail.querySelector<HTMLButtonElement>('[data-action="hero-largess-submit"]')!;
  expect(radio().checked).toBe(true); expect(submit().disabled).toBe(true);
  return { mount, root, detail, radio, submit, session, gateway };
}

it("preserves original focused gold and detail nodes through three unchanged public refreshes", async () => {
  const { root, detail, radio, gateway } = await setup();
  const original = radio(); original.focus();
  expect(document.activeElement).toBe(original);
  for (let i = 0; i < 3; i++) {
    panel.refreshRecruitAffordability();
    expect.soft(root.querySelector('[data-role="hero-detail"]')).toBe(detail);
    expect.soft(radio() === original, `original radio at refresh ${i}`).toBe(true);
    expect.soft(original.isConnected, `connected at refresh ${i}`).toBe(true);
    expect.soft(document.activeElement === original, `active at refresh ${i}`).toBe(true);
    expect(radio().checked).toBe(true);
  }
  expect(gateway.largessHero).not.toHaveBeenCalled(); expect(gateway.recruitHero).not.toHaveBeenCalled();
});

it("updates live food affordability and gold guards without discarding focused gold", async () => {
  const { detail, radio, submit, session } = await setup();
  expect(detail.textContent).toContain("余500/需100");
  const original = radio(); original.focus();
  session.wallet = { food: 50, gold: 1000 }; panel.refreshRecruitAffordability();
  expect(detail.textContent).toContain("余50/需100"); expect(submit().disabled).toBe(false);
  expect.soft(radio() === original).toBe(true); expect.soft(document.activeElement === original).toBe(true);
  session.wallet = { food: 700, gold: 0 }; panel.refreshRecruitAffordability();
  expect(detail.textContent).toContain("余700/需100"); expect(submit().disabled).toBe(true);
});

it("keeps selected item semantics while live bag options and submit guard change", async () => {
  const { detail, radio, submit, session } = await setup();
  radio("item").click();
  const select = detail.querySelector<HTMLSelectElement>('[data-field="hero-largess-item"]')!;
  select.value = "2052"; select.dispatchEvent(new Event("change", { bubbles: true }));
  const original = detail.querySelector<HTMLSelectElement>('[data-field="hero-largess-item"]')!;
  original.focus(); expect(original.value).toBe("2052"); expect(submit().disabled).toBe(false);
  session.bag = [{ item_cfg_id: 2051, quantity: 5 }]; panel.refreshRecruitAffordability();
  const current = detail.querySelector<HTMLSelectElement>('[data-field="hero-largess-item"]')!;
  expect(current.value).toBe("2052"); expect(radio("item").checked).toBe(true);
  expect(current.querySelector<HTMLOptionElement>('option[value="2051"]')!.textContent).toContain("×5");
  expect(current.querySelector<HTMLOptionElement>('option[value="2052"]')!.disabled).toBe(true);
  expect(submit().disabled).toBe(true);
  expect.soft(current === original).toBe(true); expect.soft(document.activeElement === original).toBe(true);
});

it("still loads a newly selected hero and leaves hidden/detached refresh inert", async () => {
  const { root, radio, gateway } = await setup(); const original = radio();
  root.querySelector<HTMLElement>('li[data-hero-id="8"]')!.click(); await flush();
  expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 8); expect(original.isConnected).toBe(false);
  expect(root.querySelector(".hero-detail-level")!.textContent).toBe("Lv2");
  panel.toggleHero(); const html = root.innerHTML;
  panel.refreshRecruitAffordability(); expect(root.innerHTML).toBe(html);
  panel.detach(); expect(() => panel.refreshRecruitAffordability()).not.toThrow();
});

it("characterizes visible disconnected refresh without claiming detach removes DOM", async () => {
  const { mount, root } = await setup(); mount.remove();
  expect(root.isConnected).toBe(false); expect(root.classList.contains("hidden")).toBe(false);
  expect(() => panel.refreshRecruitAffordability()).not.toThrow();
  expect(root.querySelector(".hero-detail-level")!.textContent).toBe("Lv1");
});

it("retains a focused training-hour control and its selection on resource refresh", async () => {
  const { detail, session } = await setup();
  const hour = detail.querySelector<HTMLButtonElement>('[data-action="hero-expr-hours"][data-hours="2"]')!;
  hour.click();
  const selected = detail.querySelector<HTMLButtonElement>('[data-action="hero-expr-hours"][data-hours="2"]')!;
  selected.focus(); expect(selected.getAttribute("aria-pressed")).toBe("true");
  session.wallet = { gold: 1000, food: 10 }; panel.refreshRecruitAffordability();
  const current = detail.querySelector<HTMLButtonElement>('[data-action="hero-expr-hours"][data-hours="2"]')!;
  expect(current.getAttribute("aria-pressed")).toBe("true");
  expect.soft(current === selected).toBe(true); expect.soft(document.activeElement === selected).toBe(true);
});

it("updates cultivation, training and optional bag rows while preserving art and statuses", async () => {
  const { detail, radio, session } = await setup({ exp_max: 0, loyalty: 100 });
  const original = radio(); original.focus();
  const art = document.createElement("img"), residual = document.createElement("span");
  detail.querySelector(".hero-detail-head")!.append(art); detail.append(residual);
  const status = detail.querySelector<HTMLElement>('[data-role="hero-largess-success"]')!;
  const error = detail.querySelector<HTMLElement>('[data-role="hero-largess-form-error"]')!;
  status.textContent = "prior success"; error.textContent = "prior error";
  status.classList.remove("hidden"); error.classList.remove("hidden");
  expect(detail.querySelector('[data-role="hero-detail-consumable-stack-line"]')).toBeNull();
  session.bag = [{ item_cfg_id: 2017, quantity: 3 }]; session.wallet = { gold: 10000 };
  panel.refreshRecruitAffordability();
  expect(detail.querySelector('[data-role="hero-detail-consumable-stack-line"]')!.textContent).toContain("×3");
  expect(detail.querySelector<HTMLButtonElement>('[data-action="hero-use-cultivation-item"]')!.disabled).toBe(false);
  expect(detail.querySelector<HTMLButtonElement>('[data-action="hero-expr-begin"]')!.disabled).toBe(false);
  session.bag = []; session.wallet = { gold: 0 }; panel.refreshRecruitAffordability();
  expect(detail.querySelector('[data-role="hero-detail-consumable-stack-line"]')).toBeNull();
  expect(detail.querySelector<HTMLButtonElement>('[data-action="hero-use-cultivation-item"]')!.disabled).toBe(true);
  expect(detail.querySelector<HTMLButtonElement>('[data-action="hero-expr-begin"]')!.disabled).toBe(true);
  expect(document.activeElement).toBe(original); expect(art.isConnected && residual.isConnected).toBe(true);
  expect(status.isConnected && error.isConnected).toBe(true);
  expect(status.textContent).toBe("prior success"); expect(error.textContent).toBe("prior error");
  expect(status.classList.contains("hidden") || error.classList.contains("hidden")).toBe(false);
});

it("falls back before any partial update if a required control is missing", async () => {
  const { detail, radio, session } = await setup(); const original = radio();
  const summary = detail.querySelector(".recruit-afford-secondary")!;
  const oldText = summary.textContent;
  detail.querySelector('[data-action="hero-largess-submit"]')!.remove();
  session.wallet = { food: 99, gold: 1000 }; panel.refreshRecruitAffordability();
  expect(summary.textContent).toBe(oldText); expect(summary.isConnected).toBe(false);
  expect(original.isConnected).toBe(false); expect(detail.textContent).toContain("余99/需100");
  expect(detail.querySelector('[data-action="hero-largess-submit"]')).not.toBeNull();
});

it("loads changed same-id detail and keeps current item selection on later refresh", async () => {
  const { root, detail, radio, gateway } = await setup(); const original = radio();
  gateway.getHeroDetail.mockResolvedValue({ hero_id: 7, template_cfg_id: 1002, level: 9, loyalty: 50 });
  root.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click(); await flush();
  expect(original.isConnected).toBe(false); expect(detail.querySelector(".hero-detail-level")!.textContent).toBe("Lv9");
  radio("item").click(); const selected = radio("item"); selected.focus();
  panel.refreshRecruitAffordability(); expect(radio("item")).toBe(selected);
  expect(selected.checked).toBe(true); expect(document.activeElement).toBe(selected);
});
