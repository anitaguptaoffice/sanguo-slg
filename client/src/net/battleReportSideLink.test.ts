import { describe, expect, it } from "vitest";
import {
  formatBattleReportSideSummary,
  pickBattleHeroIdForPlayer,
  resolveBattleReportHeroDeepLink,
  resolveBattleReportRankDeepLink,
} from "@/net/battleReportSideLink";

describe("battleReportSideLink", () => {
  const report = {
    summary: {
      report_id: 9,
      attacker_player_id: 10001,
      defender_player_id: 10002,
      attacker_display_name: "演示君主",
      defender_hero_template_cfg_id: 1002,
      attacker_hero_id: 7,
    },
    detail: { attacker_hero_level: 12, defender_hero_level: 0 },
  };

  it("formatBattleReportSideSummary builds headline from names and cfg", () => {
    const parts = formatBattleReportSideSummary(report);
    expect(parts.attackerLine).toContain("演示君主");
    expect(parts.attackerLine).toContain("将领 Lv12");
    expect(parts.defenderLine).toContain("玩家#10002");
    expect(parts.defenderLine).toContain("关羽");
    expect(parts.headline).toContain("|");
  });

  it("resolveBattleReportHeroDeepLink opens viewer attacker hero", () => {
    expect(
      resolveBattleReportHeroDeepLink("attacker", report, {
        viewerPlayerId: 10001,
        viewerHeroes: [{ hero_id: 7, level: 3 }],
      }),
    ).toEqual({ action: "open", heroId: 7 });
    expect(
      resolveBattleReportHeroDeepLink("attacker", report, {
        viewerPlayerId: 10002,
      }).action,
    ).toBe("readonly");
  });

  it("resolveBattleReportHeroDeepLink opens viewer defender hero", () => {
    const defReport = {
      summary: {
        attacker_player_id: 1,
        defender_player_id: 2,
        defender_hero_id: 9,
      },
    };
    expect(
      resolveBattleReportHeroDeepLink("defender", defReport, {
        viewerPlayerId: 2,
        viewerHeroes: [{ hero_id: 9, level: 1 }],
      }),
    ).toEqual({ action: "open", heroId: 9 });
    expect(
      resolveBattleReportHeroDeepLink("defender", defReport, {
        viewerPlayerId: 1,
      }).message,
    ).toContain("己方守方将领");
  });

  it("pickBattleHeroIdForPlayer prefers explicit id then highest level", () => {
    expect(pickBattleHeroIdForPlayer([{ hero_id: 1, level: 2 }], 5)).toBe(5);
    expect(
      pickBattleHeroIdForPlayer(
        [{ hero_id: 1, level: 2 }, { hero_id: 2, level: 9 }],
        0,
      ),
    ).toBe(2);
  });

  it("resolveBattleReportRankDeepLink maps opponent entity", () => {
    expect(
      resolveBattleReportRankDeepLink(report, { viewerPlayerId: 10001 }),
    ).toEqual({ show: true, boardType: 1, entityId: 10002 });
    expect(
      resolveBattleReportRankDeepLink(report, { viewerPlayerId: 10002 }),
    ).toMatchObject({ entityId: 10001 });
  });
});
