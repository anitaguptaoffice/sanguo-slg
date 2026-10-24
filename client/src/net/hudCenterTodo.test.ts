import { describe, expect, it } from "vitest";
import {
  centerTodoScrollTargetId,
  countClaimableDailyQuests,
  countClaimableMails,
  formatHudCenterTodoBadge,
  hudCenterTodoTitle,
  pickFirstClaimableDailyQuestCfgId,
  pickFirstClaimableMailId,
  pickHudCenterTodoTarget,
  shouldSkipRepeatCenterTodoScroll,
  sumHudCenterTodoCounts,
} from "@/net/hudCenterTodo";

describe("hudCenterTodo", () => {
  it("sums mail claimable, daily claimable, and build complete for badge", () => {
    expect(
      sumHudCenterTodoCounts({ mailClaimable: 2, dailyClaimable: 1, buildComplete: 1 }),
    ).toBe(4);
    expect(formatHudCenterTodoBadge({ mailClaimable: 0, dailyClaimable: 0, buildComplete: 0 })).toBe(
      "",
    );
  });

  it("counts only claimable daily (state 3)", () => {
    expect(
      countClaimableDailyQuests([
        { quest_cfg_id: 1, state: 1 },
        { quest_cfg_id: 2, state: 3 },
        { quest_cfg_id: 3, state: 2 },
      ]),
    ).toBe(1);
    expect(
      pickFirstClaimableDailyQuestCfgId([
        { quest_cfg_id: 10, state: 1 },
        { quest_cfg_id: 11, state: 3 },
      ]),
    ).toBe(11);
  });

  it("picks first claimable mail in inbox order", () => {
    const mails = [
      { mail_id: 1, status: 2, attachments: { items: [{ item_cfg_id: 1 }] }, has_unclaimed_attachments: false },
      { mail_id: 2, status: 1, attachments: { items: [{ item_cfg_id: 2 }] }, has_unclaimed_attachments: true },
    ];
    expect(countClaimableMails(mails)).toBe(1);
    expect(pickFirstClaimableMailId(mails)).toBe(2);
  });

  it("picks center todo target by priority daily > mail > queue", () => {
    expect(
      pickHudCenterTodoTarget({
        counts: { dailyClaimable: 1, mailClaimable: 2, buildComplete: 1 },
        firstClaimableDailyCfgId: 101,
        firstClaimableMailId: 9,
        firstBuildCompleteSlotKey: "farm",
      }),
    ).toEqual({
      panel: "daily",
      scrollTargetId: centerTodoScrollTargetId("daily", 101),
      questCfgId: 101,
    });
    expect(
      pickHudCenterTodoTarget({
        counts: { dailyClaimable: 0, mailClaimable: 1, buildComplete: 1 },
        firstClaimableDailyCfgId: 0,
        firstClaimableMailId: 5,
        firstBuildCompleteSlotKey: "farm",
      })?.scrollTargetId,
    ).toBe(centerTodoScrollTargetId("mail", 5));
    expect(
      pickHudCenterTodoTarget({
        counts: { dailyClaimable: 0, mailClaimable: 0, buildComplete: 1 },
        firstClaimableDailyCfgId: 0,
        firstClaimableMailId: 0,
        firstBuildCompleteSlotKey: "hall",
      })?.scrollTargetId,
    ).toBe(centerTodoScrollTargetId("queue", "hall"));
  });

  it("hudCenterTodoTitle uses formatHudTodoSweepLine for mail and daily (CLIENT-193)", () => {
    expect(
      hudCenterTodoTitle({ mailClaimable: 2, dailyClaimable: 1, buildComplete: 0 }),
    ).toBe("待办 · 邮件附件 2 · 日常可领 1");
    expect(
      hudCenterTodoTitle({ mailClaimable: 0, dailyClaimable: 0, buildComplete: 2 }),
    ).toBe("待办 · 建造完成 2");
  });

  it("skips repeat scroll when same target and panel already open", () => {
    const target = {
      panel: "mail" as const,
      scrollTargetId: centerTodoScrollTargetId("mail", 3),
      mailId: 3,
    };
    expect(shouldSkipRepeatCenterTodoScroll(null, target, false)).toBe(false);
    expect(shouldSkipRepeatCenterTodoScroll(target.scrollTargetId, target, true)).toBe(true);
    expect(shouldSkipRepeatCenterTodoScroll(target.scrollTargetId, target, false)).toBe(false);
  });
});
