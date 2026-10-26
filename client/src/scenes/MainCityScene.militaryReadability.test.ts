import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinMilitaryPanel } from "@/engine/artPanelSkin";
import { formatMarchFormTroopReserveLine } from "@/net/marchFormTroopReserve";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine as format,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine as sync,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeper";

const html = readFileSync("index.html", "utf8");
const markup = readFileSync("src/scenes/MainCityScene.ts", "utf8")
  .match(/this\.militaryPanel\.innerHTML = `([\s\S]*?)`;/)![1];
const css = html.match(/\/\* MILITARY-HINT-READABILITY:[\s\S]*?(?=<\/style>)/)![0];
const rootSelector = ".march-form-troop-margin-residual-line";
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); });

describe("military preview helper readability", () => {
  it("scopes readable typography/wrapping to the existing readout without hiding rows", () => {
    const rules = [...css.matchAll(/([^{}]+)\{([^}]+)\}/g)];
    expect(rules).toHaveLength(5);
    for (const [, selector, declarations] of rules) {
      expect(selector).toMatch(/#layout-frame \.military-panel(?:\[data-military-paper-skin\])? \.march-form-troop-margin-residual-line/);
      expect(declarations).not.toMatch(/(?:^|[;\s])(?:display|height|overflow|position|transform|zoom):/);
    }
    expect(css).toContain("font-size: 14px;");
    expect(css).toContain("line-height: 1.5;");
    expect(css).toContain("font: inherit;");
    expect(css).toContain("color: inherit;");
    expect(css).toContain("overflow-wrap: anywhere;");
    expect(css).toContain("padding-inline-end: 1em;");
  });

  it.each(["on", "off", "missing-image", "missing-metadata"])("uses actual paper fill, not requested art mode (%s)", mode => {
    const style = document.createElement("style"); style.textContent = html.match(/<style>([\s\S]*?)<\/style>/)![1];
    document.head.appendChild(style);
    document.body.innerHTML = `<div id="layout-frame"><div class="military-panel">${markup}</div></div>`;
    const panel = document.querySelector<HTMLElement>(".military-panel")!;
    const img = document.createElement("img"); img.src = "paper.png";
    const assets = {
      getImageForAsset: () => mode === "missing-image" ? undefined : { img, scale: 1 },
      getArtMeta: () => mode === "missing-metadata" ? undefined : { nine_slice: { top: 24, right: 24, bottom: 24, left: 24 } },
    } as unknown as AssetLoader;
    if (mode === "off") panel.dataset.artSkin = "off";
    skinMilitaryPanel(panel, assets);
    expect(panel.hasAttribute("data-military-paper-skin")).toBe(mode === "on");
    const readout = panel.querySelector<HTMLElement>(rootSelector)!;
    readout.classList.remove("hidden");
    for (const warn of [false, true]) {
      readout.classList.toggle("march-form-troop-margin-residual-warn", warn);
      const computed = getComputedStyle(readout);
      expect(computed.fontSize).toBe("14px");
      expect(computed.color).toBe(mode === "on"
        ? (warn ? "rgb(139, 58, 24)" : "rgb(61, 46, 31)")
        : (warn ? "rgb(232, 184, 106)" : "rgb(232, 220, 200)"));
      expect(computed.backgroundColor).toBe(mode === "on" ? "rgba(0, 0, 0, 0)" : "rgb(26, 20, 16)");
    }
    // Turning off a request does not remove an already-installed image in this API.
    panel.dataset.artSkin = "off"; skinMilitaryPanel(panel, assets);
    expect(panel.hasAttribute("data-military-paper-skin")).toBe(mode === "on");
    panel.style.borderImageSource = "none"; skinMilitaryPanel(panel, assets);
    expect(panel.hasAttribute("data-military-paper-skin")).toBe(false);
  });

  it.each([false, true])("retains all ten production rows, reset and warning state (%s)", warn => {
    document.body.innerHTML = `<div id="layout-frame"><div class="military-panel">${markup}</div></div>`;
    const panel = document.querySelector(".military-panel")!;
    const readout = panel.querySelector(rootSelector)!;
    const rows = [...readout.querySelectorAll("span")];
    expect(rows).toHaveLength(10);
    const reserve = formatMarchFormTroopReserveLine(warn ? 400 : 200, 300);
    const summary = { summaryLine: "", resourceWarn: warn, resourceWarnLine: null, estimatedFoodCost: 400 };
    const value = format(reserve, summary, { food: warn ? 3 : 5000 });
    sync(panel, value);
    const texts = rows.map(row => row.textContent);
    expect(texts.every(text => text && text.length > 0)).toBe(true);
    expect(rows.every(row => !row.classList.contains("hidden"))).toBe(true);
    expect(readout.classList.contains("march-form-troop-margin-residual-warn")).toBe(warn);
    sync(panel, null);
    expect(readout.classList.contains("hidden")).toBe(true);
    expect(rows.every(row => row.textContent === "")).toBe(true);
    sync(panel, value);
    expect(rows.map(row => row.textContent)).toEqual(texts);
    expect(panel.querySelector('[data-action="march"]')?.parentElement).toBe(readout.parentElement);
  });
});
