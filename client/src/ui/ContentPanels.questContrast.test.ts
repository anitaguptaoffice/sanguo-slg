import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ContentPanels } from "./ContentPanels";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
const html = readFileSync("index.html", "utf8");
function luminance(hex: string) {
  return hex.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
}
describe("unskinned quest panel contrast", () => {
  it("scopes the foreground-only repair without changing paper-backed panels", () => {
    const rule = html.match(/\.content-panel\.quest-panel,[\s\S]*?\{([^}]+)\}/)!;
    expect(rule[0]).toContain(".content-panel.quest-panel h3");
    expect(rule[0]).toContain(".content-panel.quest-panel label");
    expect(rule[1].trim()).toBe("color: #e8dcc8;");
    expect((luminance("#e8dcc8") + .05) / (luminance("#2a221c") + .05)).toBeGreaterThanOrEqual(4.5);
  });
  it("marks only the real quest panel and preserves ordinary rendered quest rows", async () => {
    const mount = document.createElement("div");
    const session = { serverId: 1, cityId: 1, player: { player_id: 1 }, wallet: {}, buildings: [], bag: [] } as unknown as MainCitySession;
    const gateway = { getBoundServerId: () => 1, listPlayerQuests: async () => ({ quests: [{ quest_cfg_id: 1001, quest_code: "tutorial_hall_2", state: 2, progress_json: '{"count":1}' }] }) } as unknown as GatewayPort;
    const panels = new ContentPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleQuest();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(mount.querySelectorAll(".quest-panel")).toHaveLength(1);
    expect(mount.querySelector(".quest-panel h3")?.textContent).toBe("任务");
    expect(mount.querySelector(".quest-panel .quest-list")?.textContent).toContain("1001");
    expect(mount.querySelector('[data-center-panel="bag"]')?.classList.contains("quest-panel")).toBe(false);
    expect(mount.querySelector('[data-center-panel="shop"]')?.classList.contains("quest-panel")).toBe(false);
    panels.detach();
  });
});
