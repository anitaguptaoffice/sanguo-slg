import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinMilitaryPanel } from "@/engine/artPanelSkin";

const markup = readFileSync("src/scenes/MainCityScene.ts", "utf8")
  .match(/this\.militaryPanel\.innerHTML = `([\s\S]*?)`;/)![1];
afterEach(() => { document.body.replaceChildren(); });

describe("military panel readability", () => {
  it("keeps the base march form readouts and the primary submit action", () => {
    document.body.innerHTML = `<div id="layout-frame"><div class="military-panel">${markup}</div></div>`;
    const panel = document.querySelector<HTMLElement>(".military-panel")!;
    expect(panel.querySelector('[data-role="march-form-summary"]')).not.toBeNull();
    expect(panel.querySelector('[data-role="march-form-summary-warn"]')).not.toBeNull();
    expect(panel.querySelector('[data-role="march-form-error"]')).not.toBeNull();
    expect(panel.querySelector('[data-role="march-intel-last-troops"]')).not.toBeNull();
    expect(panel.querySelector('[data-action="march"]')?.textContent).toContain("出征");
  });

  it.each(["on", "off", "missing-image", "missing-metadata"])(
    "uses actual paper fill, not requested art mode (%s)",
    (mode) => {
      document.body.innerHTML = `<div id="layout-frame"><div class="military-panel">${markup}</div></div>`;
      const panel = document.querySelector<HTMLElement>(".military-panel")!;
      const img = document.createElement("img");
      img.src = "paper.png";
      const assets = {
        getImageForAsset: () => (mode === "missing-image" ? undefined : { img, scale: 1 }),
        getArtMeta: () =>
          mode === "missing-metadata"
            ? undefined
            : { nine_slice: { top: 24, right: 24, bottom: 24, left: 24 } },
      } as unknown as AssetLoader;
      if (mode === "off") panel.dataset.artSkin = "off";
      skinMilitaryPanel(panel, assets);
      expect(panel.hasAttribute("data-military-paper-skin")).toBe(mode === "on");
      // Turning off a request does not remove an already-installed image in this API.
      panel.dataset.artSkin = "off";
      skinMilitaryPanel(panel, assets);
      expect(panel.hasAttribute("data-military-paper-skin")).toBe(mode === "on");
      panel.style.borderImageSource = "none";
      skinMilitaryPanel(panel, assets);
      expect(panel.hasAttribute("data-military-paper-skin")).toBe(false);
    },
  );
});
