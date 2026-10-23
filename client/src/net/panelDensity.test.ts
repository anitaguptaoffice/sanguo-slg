import { describe, expect, it } from "vitest";
import { MAIL_INBOX_FILTER_UNREAD, mailEmptyInboxMessage } from "@/net/heroMailState";
import {
  BATTLE_REPORT_FILTER_EMPTY_TEXT,
  MAIL_LIST_ROW_UNREAD_CLASS,
  bagEmptyListMessage,
  battleReportListEmptyMessage,
  formatBagListItemIdCell,
  formatBagListQuantityCell,
  formatBagStackRowLabel,
  mailListRowClassName,
  mailRowMetaLine,
  mailRowTitleLine,
} from "@/net/panelDensity";
import {
  battleReportOutcomeChipClass,
  battleReportOutcomeChipLabel,
  formatBattleReportFoeSummary,
} from "@/net/militaryFormat";

describe("panelDensity", () => {
  it("mail empty copy and unread row class", () => {
    expect(mailEmptyInboxMessage(MAIL_INBOX_FILTER_UNREAD)).toContain("未读");
    expect(mailEmptyInboxMessage(0)).toContain("日常");
    expect(mailListRowClassName({ mail_id: 1, status: 0 })).toBe(MAIL_LIST_ROW_UNREAD_CLASS);
    expect(mailListRowClassName({ mail_id: 1, status: 1 })).toBe("");
  });

  it("mail two-line row helpers", () => {
    const when = Date.UTC(2024, 2, 1, 12, 0, 0);
    expect(mailRowTitleLine({ mail_id: 2, title: "系统", created_at_ms: when })).toContain("系统");
    expect(mailRowTitleLine({ mail_id: 2, title: "系统", created_at_ms: when })).toMatch(/\d/);
    expect(
      mailRowMetaLine({
        mail_id: 3,
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
    ).toBe("附件待领");
    expect(mailRowMetaLine({ mail_id: 4, status: 1 })).toContain("已读");
  });

  it("bag empty and aligned cells", () => {
    expect(bagEmptyListMessage()).toContain("商城");
    expect(bagEmptyListMessage()).toContain("日常");
    expect(formatBagListItemIdCell(2001)).toMatch(/2001/);
    expect(formatBagListQuantityCell(3)).toBe("   3");
    const row = formatBagStackRowLabel({ item_cfg_id: 2001, quantity: 12 });
    expect(row.name).toContain("谷袋");
    expect(row.qtyCell.trim()).toBe("12");
  });

  it("battle empty and filter copy", () => {
    expect(battleReportListEmptyMessage()).toContain("暂无战报");
    expect(BATTLE_REPORT_FILTER_EMPTY_TEXT).toBe("无匹配战报");
    expect(formatBattleReportFoeSummary({ defender_player_id: 9, location_x: 1, location_y: 2 })).toContain(
      "守方玩家#9",
    );
    expect(battleReportOutcomeChipClass(1)).toBe("outcome-attacker-win");
    expect(battleReportOutcomeChipLabel(2)).toBe("守胜");
  });
});
