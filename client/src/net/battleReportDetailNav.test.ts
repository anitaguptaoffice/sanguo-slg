// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BATTLE_REPORT_ROUND_JUMP_CHIP_MAX,
  BATTLE_REPORT_ROUND_ROW_ID_PREFIX,
  battleReportRoundJumpNumbers,
  battleReportRoundRowDomId,
  parseBattleReportRoundRowDomId,
  shouldUseBattleReportRoundJumpSelect,
} from "@/net/battleReportDetailNav";

describe("battleReportDetailNav", () => {
  it("maps round index to stable row dom id", () => {
    expect(battleReportRoundRowDomId(1)).toBe(`${BATTLE_REPORT_ROUND_ROW_ID_PREFIX}1`);
    expect(battleReportRoundRowDomId(12)).toBe(`${BATTLE_REPORT_ROUND_ROW_ID_PREFIX}12`);
    expect(parseBattleReportRoundRowDomId(battleReportRoundRowDomId(7))).toBe(7);
    expect(parseBattleReportRoundRowDomId("other-id")).toBeNull();
  });

  it("dedupes and sorts jump round numbers", () => {
    expect(battleReportRoundJumpNumbers([3, 1, 2, 2, 0, -1])).toEqual([1, 2, 3]);
  });

  it("chooses select when many rounds", () => {
    expect(shouldUseBattleReportRoundJumpSelect(BATTLE_REPORT_ROUND_JUMP_CHIP_MAX)).toBe(false);
    expect(shouldUseBattleReportRoundJumpSelect(BATTLE_REPORT_ROUND_JUMP_CHIP_MAX + 1)).toBe(
      true,
    );
  });
});
