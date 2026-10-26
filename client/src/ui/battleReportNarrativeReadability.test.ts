import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinBattleReportPanel } from "@/engine/artPanelSkin";
import { BattleReportPanel } from "./BattleReportPanel";
const html = readFileSync("index.html", "utf8");
const captured = JSON.parse(readFileSync("qa/fixtures/native-report1-detail.json", "utf8"));
const labels = ':scope > h3, :scope > [data-role="report-hint"], .battle-report-filters > span, .battle-report-time-chip-group > span';
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); sessionStorage.clear(); });
function assets(mode: string): AssetLoader {
  const img = document.createElement("img"); img.src = "paper.png";
  return {
    getImageForAsset: () => mode === "missing-image" ? undefined : { img, scale: 1 },
    getArtMeta: () => mode === "missing-metadata" ? undefined : { nine_slice: { top: 24, right: 24, bottom: 24, left: 24 } },
  } as unknown as AssetLoader;
}
it.each(["on", "off", "missing-image", "missing-metadata"])("keeps report labels/narrative readable and table unchanged (%s)", async mode => {
  const style = document.createElement("style"); style.textContent = html.match(/<style>([\s\S]*?)<\/style>/)![1]; document.head.append(style);
  const frame = document.createElement("div"); frame.id = "layout-frame"; document.body.append(frame);
  const panel = new BattleReportPanel(frame, {
    listBattleReports: async () => ({ reports: [captured.value.report.summary], total: 1 }),
    getBattleReport: async () => structuredClone(captured.value),
  } as never, () => {});
  panel.attach(); await panel.openPanelWithDeepLink(1);
  const root = frame.querySelector<HTMLElement>('[data-center-panel="battle-report"]')!;
  if (mode === "off") root.dataset.artSkin = "off";
  skinBattleReportPanel(root, assets(mode));
  try {
    expect(root.hasAttribute("data-report-paper-skin")).toBe(mode === "on");
    for (const el of root.querySelectorAll<HTMLElement>(labels)) {
      const s = getComputedStyle(el);
      expect(s.color).toBe(mode === "on" ? "rgb(61, 46, 31)" : "rgb(232, 220, 200)");
      expect(s.backgroundColor).toBe(mode === "on" ? "rgba(0, 0, 0, 0)" : "rgb(26, 20, 16)");
      expect(parseFloat(s.fontSize)).toBeGreaterThanOrEqual(14);
    }
    const pre = root.querySelector<HTMLElement>(".report-detail > pre")!, text = pre.textContent;
    const s = getComputedStyle(pre);
    expect(s.color).toBe("rgb(232, 220, 200)"); expect(s.backgroundColor).toBe("rgb(26, 20, 16)");
    expect(s.fontSize).toBe("14px"); expect(s.whiteSpace).toBe("pre-wrap");
    expect(text).toContain("攻方伤亡：步兵 34");
    for (const td of root.querySelectorAll(".battle-report-rounds-table td")) {
      expect(getComputedStyle(td).color).toBe("rgb(232, 220, 200)");
      expect(getComputedStyle(td).backgroundColor).toBe("rgb(26, 20, 16)");
    }
    root.querySelector<HTMLButtonElement>('[data-action="jump-round"][data-round="8"]')!.click();
    expect(getComputedStyle(root.querySelector('.battle-report-round-row-highlight td')!).backgroundColor).toBe("rgb(61, 74, 40)");
    panel.toggle(); await panel.openPanelWithDeepLink(1);
    expect(root.querySelector(".report-detail > pre")?.textContent).toBe(text);
    expect(root.querySelectorAll(".battle-report-rounds-table tbody tr")).toHaveLength(8);
  } finally { panel.detach(); }
});
it("tracks actual retained/removed/restored paper instead of requested art mode", () => {
  const root = document.createElement("div"), paper = assets("on");
  const applied = () => root.hasAttribute("data-report-paper-skin");
  skinBattleReportPanel(root, paper); expect(applied()).toBe(true);
  root.dataset.artSkin = "off"; skinBattleReportPanel(root, paper); expect(applied()).toBe(true);
  root.style.borderImageSource = "none"; skinBattleReportPanel(root, paper); expect(applied()).toBe(false);
  delete root.dataset.artSkin; skinBattleReportPanel(root, paper); expect(applied()).toBe(true);
  skinBattleReportPanel(root, assets("missing-image")); expect(applied()).toBe(true);
  root.style.borderImageSlice = "24"; skinBattleReportPanel(root, assets("missing-metadata")); expect(applied()).toBe(false);
  skinBattleReportPanel(root, paper); expect(applied()).toBe(true);
});
it("does not change other panels, report data or the approved table stylesheet", () => {
  const css = html.slice(html.indexOf("/* CLIENT-REPORT-NARRATIVE:"), html.indexOf("/* CLIENT-REPORT-READABILITY:"));
  for (const [, selectors] of css.matchAll(/([^{}]+)\{[^}]+\}/g)) {
    for (const selector of selectors.replace(/\/\*[\s\S]*?\*\//g, "").split(",")) {
      expect(selector.trim()).toMatch(/^#layout-frame \.content-panel\[data-center-panel="battle-report"\]/);
      expect(selector).not.toMatch(/rounds-table|hero|military-panel/);
    }
  }
  expect(css).not.toMatch(/(?:^|[;\s])(?:display|height|overflow|position|transform):/);
});
