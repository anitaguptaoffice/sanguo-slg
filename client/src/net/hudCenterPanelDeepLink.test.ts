import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  CENTER_PANEL_TAB_PULSE_MS,
  formatHudCenterPanelDeepLinkLine,
  hudCenterPanelDeepLinkSegments,
  pickDefaultCenterPanelTabFromHudTodo,
  resolveCenterPanelTabFromHudTodo,
  scheduleCenterPanelTabPulse,
  centerPanelTabToolbarAction,
} from "@/net/hudCenterPanelDeepLink";

describe("formatHudCenterPanelDeepLinkLine (CLIENT-202)", () => {
  it("merges mail/daily sweep with queue and social segments", () => {
    expect(
      formatHudCenterPanelDeepLinkLine({
        mailClaimable: 2,
        dailyClaimable: 1,
        queueBuilding: 1,
        chatUnread: 3,
      }),
    ).toBe("邮件附件 2 · 日常可领 1 · 建造中 1 · 聊天未读 3");
    expect(
      formatHudCenterPanelDeepLinkLine({
        mailClaimable: 0,
        dailyClaimable: 0,
        queueBuilding: 2,
        chatUnread: 0,
      }),
    ).toBe("建造中 2");
    expect(
      formatHudCenterPanelDeepLinkLine({
        mailClaimable: 0,
        dailyClaimable: 0,
        queueBuilding: 0,
        chatUnread: 0,
      }),
    ).toBeNull();
  });

  it("hudCenterPanelDeepLinkSegments align with CLIENT-193 mail/daily wording", () => {
    const segments = hudCenterPanelDeepLinkSegments({
      mailClaimable: 4,
      dailyClaimable: 0,
      queueBuilding: 0,
      chatUnread: 1,
    });
    expect(segments.map((s) => s.label)).toEqual(["邮件附件 4", "聊天未读 1"]);
  });
});

describe("resolveCenterPanelTabFromHudTodo (CLIENT-202)", () => {
  const counts = {
    mailClaimable: 1,
    dailyClaimable: 2,
    queueBuilding: 3,
    chatUnread: 4,
  };

  it("returns facet when count positive", () => {
    expect(resolveCenterPanelTabFromHudTodo("daily", counts)).toBe("daily");
    expect(resolveCenterPanelTabFromHudTodo("mail", counts)).toBe("mail");
    expect(resolveCenterPanelTabFromHudTodo("queue", counts)).toBe("queue");
    expect(resolveCenterPanelTabFromHudTodo("social", counts)).toBe("social");
  });

  it("returns null when facet has no todo", () => {
    expect(resolveCenterPanelTabFromHudTodo("mail", { ...counts, mailClaimable: 0 })).toBeNull();
  });

  it("pickDefaultCenterPanelTabFromHudTodo prefers daily > mail > queue > social", () => {
    expect(pickDefaultCenterPanelTabFromHudTodo(counts)).toBe("daily");
    expect(
      pickDefaultCenterPanelTabFromHudTodo({
        mailClaimable: 1,
        dailyClaimable: 0,
        queueBuilding: 1,
        chatUnread: 5,
      }),
    ).toBe("mail");
    expect(
      pickDefaultCenterPanelTabFromHudTodo({
        mailClaimable: 0,
        dailyClaimable: 0,
        queueBuilding: 1,
        chatUnread: 2,
      }),
    ).toBe("queue");
  });

  it("maps tabs to toolbar data-action", () => {
    expect(centerPanelTabToolbarAction("social")).toBe("toggle-chat");
    expect(centerPanelTabToolbarAction("queue")).toBe("toggle-queue");
  });
});

describe("scheduleCenterPanelTabPulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${CENTER_PANEL_TAB_PULSE_CLASS} for ${CENTER_PANEL_TAB_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const btn = document.createElement("button");
    scheduleCenterPanelTabPulse(btn);
    expect(btn.classList.contains(CENTER_PANEL_TAB_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(CENTER_PANEL_TAB_PULSE_MS);
    expect(btn.classList.contains(CENTER_PANEL_TAB_PULSE_CLASS)).toBe(false);
  });
});
