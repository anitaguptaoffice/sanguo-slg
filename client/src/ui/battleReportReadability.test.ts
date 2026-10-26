import { readFileSync } from "node:fs";
import { afterEach, expect, it } from "vitest";
import { BattleReportPanel } from "./BattleReportPanel";

const html = readFileSync("index.html", "utf8");
const start = html.indexOf("/* CLIENT-REPORT-READABILITY:");
const end = html.indexOf("/* END CLIENT-REPORT-READABILITY */", start);
if (start < 0 || end <= start) throw new Error("missing scoped report readability CSS boundaries");
const rules = html.slice(start, end);
const captured = JSON.parse(readFileSync("qa/fixtures/native-report1-detail.json", "utf8"));
const luminance = (hex: string) => hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
  .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
  .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
afterEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
it("scopes readable type and AA contrast to normal/header/highlight report table surfaces", () => {
  expect(rules).toContain("font-size: 14px; line-height: 1.5;");
  expect(rules).toContain("color: #e8dcc8; background: #1a1410;");
  for (const background of ["#1a1410", "#2a221c", "#3d4a28"]) {
    expect(rules).toContain(`background: ${background};`);
    expect((luminance("#e8dcc8") + .05) / (luminance(background) + .05)).toBeGreaterThanOrEqual(4.5);
  }
  for (const block of rules.replace(/\/\*[\s\S]*?\*\//g, "").split("}").filter(s => s.trim())) {
    for (const selector of block.split("{")[0].split(",")) {
      expect(selector.trim()).toMatch(/^#layout-frame \.content-panel\[data-center-panel="battle-report"\] \.battle-report-rounds-table/);
    }
  }
});
it("renders the recorded actual eight-round report and preserves survivor values on reopen", async () => {
  const mount = document.createElement("div"); document.body.append(mount);
  const panel = new BattleReportPanel(mount, {
    listBattleReports: async () => ({ reports: [captured.value.report.summary], total: 1 }),
    getBattleReport: async () => structuredClone(captured.value),
  } as never, () => {});
  panel.attach();
  try {
    for (let i = 0; i < 2; i++) {
      await panel.openPanelWithDeepLink(1);
      expect(mount.querySelectorAll(".battle-report-rounds-table tbody tr")).toHaveLength(8);
      const row = mount.querySelector<HTMLTableRowElement>('.battle-report-rounds-table tr[data-round="8"]')!;
      expect([...row.cells].map(c => c.textContent)).toEqual(["8", "造成伤害 1124", "造成伤害 186", "步兵 166", "弓兵 15、步兵 46"]);
      panel.toggle();
    }
  } finally { panel.detach(); }
});
