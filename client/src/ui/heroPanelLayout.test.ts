import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HeroMailPanels } from "./HeroMailPanels";
import type { GatewayPort } from "@/net/GatewayClient";

// CSS/DOM contracts only: JSDOM does not measure flex layout, clipping or native input.
const html = readFileSync("index.html", "utf8");
let panels: HeroMailPanels;
let stylesheet: HTMLStyleElement;

beforeEach(() => {
  sessionStorage.clear();
  stylesheet = document.createElement("style");
  stylesheet.textContent = html.match(/<style>([\s\S]*?)<\/style>/)![1]!;
  document.head.append(stylesheet);
});
afterEach(() => {
  panels?.detach();
  stylesheet.remove();
  document.body.replaceChildren();
});

function mount(narrow: boolean, detail: boolean) {
  const frame = document.createElement("div");
  frame.id = "layout-frame";
  frame.classList.toggle("layout-narrow", narrow);
  document.body.append(frame);
  const gateway = { getBoundServerId: () => 1, getSessionGeneration: () => 1, call: vi.fn() };
  panels = new HeroMailPanels(frame, gateway as unknown as GatewayPort, () => null, vi.fn(), vi.fn());
  panels.attach();
  const panel = frame.querySelector<HTMLElement>('[data-center-panel="hero"]')!;
  panel.classList.remove("hidden");
  const recruit = panel.querySelector<HTMLDetailsElement>(".hero-recruit-host")!;
  const capture = panel.querySelector<HTMLElement>('[data-role="hero-capture-sections-row"]')!;
  const roster = panel.querySelector<HTMLElement>('[data-role="hero-scroll"]')!;
  if (detail) {
    // Exercise the production :has(detail-bust) selector without inventing geometry.
    const bust = document.createElement("img");
    bust.dataset.role = "hero-detail-bust";
    roster.append(bust);
  }
  return { panel, recruit, capture, roster, gateway };
}

describe.each([false, true])("hero panel CSS contracts, narrow=%s", narrow => {
  it.each([false, true])("reserves roster flex space with detail=%s", detail => {
    const { roster, recruit, capture } = mount(narrow, detail);
    const style = getComputedStyle(roster);
    expect(style.flexGrow).toBe("1");
    expect(style.flexShrink).toBe("0");
    expect(style.flexBasis).toBe("40%");
    expect(style.minHeight).toBe("0px");
    expect(style.overflowY).toBe("auto");
    for (const region of [recruit, capture]) {
      const regionStyle = getComputedStyle(region);
      expect(regionStyle.flexShrink).toBe("1");
      expect(regionStyle.minHeight).toBe("0px");
      expect(regionStyle.overflowY).toBe("auto");
      expect(regionStyle.boxSizing).toBe("border-box");
    }
    expect(getComputedStyle(recruit).maxHeight).toBe("30%");
    expect(getComputedStyle(capture).maxHeight).toBe("22%");
  });

  it("keeps expanded capture bodies in normal flow inside the scroll region", () => {
    const { capture } = mount(narrow, false);
    for (const disclosure of capture.querySelectorAll<HTMLDetailsElement>("details")) {
      disclosure.open = true;
      const body = disclosure.querySelector<HTMLElement>(".hero-capture-info-body")!;
      expect(getComputedStyle(body).position).toBe("static");
      expect(getComputedStyle(body).display).not.toBe("none");
      expect(getComputedStyle(disclosure).display).not.toBe("none");
      expect(disclosure.querySelector("summary")?.tabIndex).toBe(0);
    }
  });

  it("retains native disclosures and all recruit/capture controls without automatic commands", () => {
    const { recruit, capture, panel, gateway } = mount(narrow, false);
    expect(recruit.open).toBe(true);
    for (const open of [false, true, false, true]) {
      recruit.open = open;
      expect(recruit.open).toBe(open);
      expect(getComputedStyle(recruit).display).not.toBe("none");
      expect(getComputedStyle(recruit).visibility).not.toBe("hidden");
    }
    for (const action of ["refresh-templates", "recruit-hero", "refresh-hotel-candidates",
      "recruit-hotel-candidate", "refresh-captive-list", "captive-summon-confirm", "captive-release",
      "refresh-persuade-targets", "persuade-primary", "refresh-coming-list", "coming-accept-confirm",
      "coming-reject"]) {
      const button = panel.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
      expect(button).not.toBeNull();
      expect(recruit.contains(button) || capture.contains(button)).toBe(true);
      expect(getComputedStyle(button).display).not.toBe("none");
      expect(getComputedStyle(button).visibility).not.toBe("hidden");
      expect(button.tabIndex).toBe(0);
    }
    expect(gateway.call).not.toHaveBeenCalled();
  });
});
