import { describe, expect, it } from "vitest";
import {
  MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY,
  classifyMailBattleCategory,
  filterMailRowsByBattleCategory,
  formatMailBattleCategorySweepLine,
  mailBattleCategorySweepCounts,
  readMailBattleCategoryTabSession,
  writeMailBattleCategoryTabSession,
} from "@/net/mailBattleCategory";
import type { MailRow } from "@/net/heroMailState";

describe("formatMailBattleCategorySweepLine (CLIENT-225)", () => {
  it("formats battle/system unread and unclaimed counts", () => {
    const counts = { unreadCount: 2, unclaimedCount: 1 };
    expect(formatMailBattleCategorySweepLine("battle", counts)).toBe(
      "战报 · 未读 2 · 未领附件 1",
    );
    expect(formatMailBattleCategorySweepLine("system", { unreadCount: 0, unclaimedCount: 0 })).toBeNull();
    expect(formatMailBattleCategorySweepLine("system", { unreadCount: 1, unclaimedCount: 0 })).toBe(
      "系统 · 未读 1",
    );
    expect(
      formatMailBattleCategorySweepLine("battle", { unreadCount: 0, unclaimedCount: 0 }),
    ).toBeNull();
  });

  it("classifies battle mail via battle-report link heuristics", () => {
    const battle: MailRow = { mail_id: 1, title: "战报", body: "report_id=9" };
    const system: MailRow = { mail_id: 2, title: "系统", body: "维护通知" };
    expect(classifyMailBattleCategory(battle)).toBe("battle");
    expect(classifyMailBattleCategory(system)).toBe("system");
    expect(filterMailRowsByBattleCategory([battle, system], "battle")).toHaveLength(1);
  });

  it("counts unread/unclaimed within category snapshot", () => {
    const rows: MailRow[] = [
      {
        mail_id: 1,
        title: "战报",
        body: "战报：3",
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      },
      { mail_id: 2, title: "系统", status: 1 },
      { mail_id: 3, title: "战报", body: "战报 2", status: 0 },
    ];
    expect(mailBattleCategorySweepCounts(rows, "battle")).toEqual({
      unreadCount: 2,
      unclaimedCount: 1,
    });
  });

  it("persists category tab in sessionStorage mail-battle-category-tab-v1", () => {
    sessionStorage.removeItem(MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY);
    expect(readMailBattleCategoryTabSession()).toBe("system");
    writeMailBattleCategoryTabSession("battle");
    expect(sessionStorage.getItem(MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY)).toBe("battle");
    expect(readMailBattleCategoryTabSession()).toBe("battle");
  });
});
