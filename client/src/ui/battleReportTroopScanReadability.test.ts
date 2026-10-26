import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { skinBattleReportPanel } from "@/engine/artPanelSkin";
import { BattleReportPanel } from "./BattleReportPanel";
const html = readFileSync("index.html", "utf8");
const captured = JSON.parse(readFileSync("qa/fixtures/native-report1-detail.json", "utf8"));
afterEach(() => { document.head.replaceChildren(); document.body.replaceChildren(); sessionStorage.clear(); });
it.each(["on", "off", "missing-image", "missing-metadata"])("keeps troop-scan text/data readable without changing other report surfaces (%s)", async mode => {
  const style = document.createElement("style"); style.textContent = html.match(/<style>([\s\S]*?)<\/style>/)![1]; document.head.append(style);
  const frame = document.createElement("div"); frame.id = "layout-frame"; document.body.append(frame);
  const panel = new BattleReportPanel(frame, {
    listBattleReports: async () => ({ reports: [captured.value.report.summary], total: 1 }),
    getBattleReport: async () => structuredClone(captured.value),
  } as never, () => {});
  panel.attach(); await panel.openPanelWithDeepLink(1);
  const root = frame.querySelector<HTMLElement>('[data-center-panel="battle-report"]')!;
  const img = document.createElement("img"); img.src = "paper.png";
  if (mode === "off") root.dataset.artSkin = "off";
  skinBattleReportPanel(root, {
    getImageForAsset: () => mode === "missing-image" ? undefined : { img, scale: 1 },
    getArtMeta: () => mode === "missing-metadata" ? undefined : { nine_slice: { top: 24, right: 24, bottom: 24, left: 24 } },
  } as unknown as AssetLoader);
  try {
    const cells = () => [...root.querySelectorAll('.battle-report-troop-scan td')];
    const text = ["攻方玩家#1001", "步兵 194", "守方", "弓兵 37、步兵 111"];
    expect(cells().map(el => el.textContent)).toEqual(text);
    expect(getComputedStyle(root.querySelector('.battle-report-troop-scan')!).fontSize).toBe("14px");
    for (const cell of cells()) {
      expect(getComputedStyle(cell).color).toBe("rgb(232, 220, 200)");
      expect(getComputedStyle(cell).backgroundColor).toBe("rgb(34, 26, 20)");
    }
    expect(getComputedStyle(root.querySelector('.report-detail > pre')!).fontSize).toBe("14px");
    expect(getComputedStyle(root.querySelector('.battle-report-rounds-table')!).fontSize).toBe("14px");
    const status = root.querySelector<HTMLElement>('[data-role="report-list-status"]')!;
    expect(status.textContent).toContain("已加载 1/1 条");
    for (const text of [status.textContent!, "加载中…", "加载失败，请重试"]) {
      status.textContent = text;
      expect(getComputedStyle(status).color).toBe(mode === "on" ? "rgb(139, 58, 24)" : "rgb(232, 168, 124)");
      expect(getComputedStyle(status).backgroundColor).toBe(mode === "on" ? "rgba(0, 0, 0, 0)" : "rgb(26, 20, 16)");
      expect(getComputedStyle(status).fontSize).toBe("14px");
    }
    panel.toggle(); await panel.openPanelWithDeepLink(1);
    expect(cells().map(el => el.textContent)).toEqual(text);
  } finally { panel.detach(); }
});
it("limits this correction to report troop-scan/status text", () => {
  const css = html.slice(html.indexOf("/* CLIENT-REPORT-TROOP-SCAN:"), html.indexOf("/* CLIENT-REPORT-NARRATIVE:"));
  for (const [, selectors] of css.matchAll(/([^{}]+)\{[^}]+\}/g)) {
    for (const selector of selectors.replace(/\/\*[\s\S]*?\*\//g, "").split(",")) {
      expect(selector.trim()).toMatch(/^#layout-frame \.content-panel\[data-center-panel="battle-report"\](?:\[data-report-paper-skin\])? \.(?:battle-report-troop-scan|report-panel-status)/);
    }
  }
  expect(css).not.toMatch(/(?:^|[;\s])(?:display|height|overflow|position|transform):/);
});
