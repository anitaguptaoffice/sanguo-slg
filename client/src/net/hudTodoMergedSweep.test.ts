import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_MS,
  formatHudTodoMergedSweepLine,
  hudTodoMergedSweepSegments,
  resolveToolbarPanelFromHudTodo,
  scheduleToolbarPanelDeepLinkPulse,
  toolbarPanelActionFromHudTodo,
} from "@/net/hudTodoMergedSweep";
import { formatHudCenterPanelDeepLinkLine } from "@/net/hudCenterPanelDeepLink";

describe("formatHudTodoMergedSweepLine (CLIENT-216)", () => {
  it("merges mail/daily/queue/social into one sweep line", () => {
    expect(
      formatHudTodoMergedSweepLine({
        mailClaimable: 2,
        dailyClaimable: 1,
        queueBuilding: 1,
        chatUnread: 3,
      }),
    ).toBe("邮件附件 2 · 日常可领 1 · 建造中 1 · 聊天未读 3");
    expect(
      formatHudTodoMergedSweepLine({
        mailClaimable: 0,
        dailyClaimable: 0,
        queueBuilding: 2,
        chatUnread: 0,
      }),
    ).toBe("建造中 2");
    expect(
      formatHudTodoMergedSweepLine({
        mailClaimable: 0,
        dailyClaimable: 0,
        queueBuilding: 0,
        chatUnread: 0,
      }),
    ).toBeNull();
  });

  it("mail/daily wording matches CLIENT-193 formatHudTodoSweepLine", () => {
    const segments = hudTodoMergedSweepSegments({
      mailClaimable: 4,
      dailyClaimable: 0,
      queueBuilding: 0,
      chatUnread: 1,
    });
    expect(segments.map((s) => s.label)).toEqual(["邮件附件 4", "聊天未读 1"]);
  });

  it("stays aligned with formatHudCenterPanelDeepLinkLine (CLIENT-202)", () => {
    const counts = {
      mailClaimable: 1,
      dailyClaimable: 2,
      queueBuilding: 0,
      chatUnread: 5,
    };
    expect(formatHudTodoMergedSweepLine(counts)).toBe(formatHudCenterPanelDeepLinkLine(counts));
  });
});

describe("resolveToolbarPanelFromHudTodo (CLIENT-216)", () => {
  const counts = {
    mailClaimable: 1,
    dailyClaimable: 2,
    queueBuilding: 3,
    chatUnread: 4,
  };

  it("returns facet when count positive", () => {
    expect(resolveToolbarPanelFromHudTodo("daily", counts)).toBe("daily");
    expect(resolveToolbarPanelFromHudTodo("mail", counts)).toBe("mail");
    expect(resolveToolbarPanelFromHudTodo("queue", counts)).toBe("queue");
    expect(resolveToolbarPanelFromHudTodo("social", counts)).toBe("social");
  });

  it("returns null when facet has no todo", () => {
    expect(resolveToolbarPanelFromHudTodo("mail", { ...counts, mailClaimable: 0 })).toBeNull();
  });

  it("maps panels to toolbar data-action", () => {
    expect(toolbarPanelActionFromHudTodo("social")).toBe("toggle-chat");
    expect(toolbarPanelActionFromHudTodo("queue")).toBe("toggle-queue");
  });
});

describe("scheduleToolbarPanelDeepLinkPulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS} for ${TOOLBAR_PANEL_DEEP_LINK_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleToolbarPanelDeepLinkPulse(btn);
    expect(btn.classList.contains(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(TOOLBAR_PANEL_DEEP_LINK_PULSE_MS);
    expect(btn.classList.contains(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS)).toBe(false);
  });
});
