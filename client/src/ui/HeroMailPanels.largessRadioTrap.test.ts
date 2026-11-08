import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import { listOverlayFocusables } from "./overlayFocusTrap";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

let panel: HeroMailPanels;
beforeEach(() => sessionStorage.clear());
afterEach(() => { panel?.detach(); document.body.replaceChildren(); vi.restoreAllMocks(); });

async function setup() {
  const style = document.createElement("style");
  style.textContent = ".hidden { display: none; }";
  document.body.append(style);
  const mount = document.createElement("div"), trigger = document.createElement("button");
  document.body.append(trigger, mount);
  const gateway = {
    getSessionId: () => "radio-trap", getSessionGeneration: () => 1, getBoundServerId: () => 1,
    listPlayerBag: vi.fn(async () => ({ items: [] })),
    listPlayerHeroes: vi.fn(async () => ({ heroes: [{ hero_id: 7, level: 1 }], total_count: 1 })),
    getHeroDetail: vi.fn(async () => ({ hero_id: 7, template_cfg_id: 1001, level: 1, loyalty: 50 })),
    listRecruitTemplates: vi.fn(async () => ({ templates: [], total_count: 0 })),
    largessHero: vi.fn(), recruitHero: vi.fn(),
  };
  const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: { gold: 0 },
    buildings: [], cityTroops: [], bag: [] } as MainCitySession;
  panel = new HeroMailPanels(mount, gateway as unknown as GatewayPort, () => session, vi.fn(), vi.fn());
  panel.attach(); trigger.focus(); panel.toggleHero();
  await new Promise(resolve => setTimeout(resolve, 0));
  mount.querySelector<HTMLElement>('li[data-hero-id="7"]')!.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 7);
  const root = mount.querySelector<HTMLElement>('[data-center-panel="hero"]')!;
  const radios = [...root.querySelectorAll<HTMLInputElement>('input[data-action="hero-largess-kind"]')];
  expect(radios.map(r => [r.type, r.name, r.value, r.checked, r.disabled])).toEqual([
    ["radio", "hero-largess-kind", "gold", true, false], ["radio", "hero-largess-kind", "item", false, false],
  ]);
  expect(root.querySelector<HTMLButtonElement>('[data-action="hero-largess-submit"]')!.disabled).toBe(true);
  expect(listOverlayFocusables(root).slice(-2)).toEqual(radios);
  return { root, radios, gateway };
}

it("wraps cancelable Tab from actual checked gold past its unchecked final sibling", async () => {
  const { root, radios, gateway } = await setup();
  radios[0].focus();
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  radios[0].dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(listOverlayFocusables(root)[0]);
  expect(radios.every(r => r.isConnected)).toBe(true);
  expect(radios.map(r => r.checked)).toEqual([true, false]);
  expect(gateway.largessHero).not.toHaveBeenCalled();
});

it("reverse-wraps to checked gold and leaves Arrow keys to native radio handling", async () => {
  const { root, radios } = await setup();
  const first = listOverlayFocusables(root)[0];
  first.focus();
  const tab = new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true });
  first.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(true);
  expect(document.activeElement).toBe(radios[0]);
  const arrow = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true });
  radios[0].dispatchEvent(arrow);
  expect(arrow.defaultPrevented).toBe(false);
  // jsdom does not execute native radio selection or the resulting production change/rerender.
  expect(radios.map(r => r.checked)).toEqual([true, false]);
});
