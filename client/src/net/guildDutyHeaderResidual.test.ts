import { describe, expect, it } from "vitest";
import { formatGuildDutyHeaderResidualLine } from "@/net/guildDutyHeaderResidual";

describe("formatGuildDutyHeaderResidualLine (CLIENT-249)", () => {
  it("joins role group header with group and guild online summaries", () => {
    const members = [
      { display_name: "甲", role: 2, is_online: true },
      { display_name: "乙", role: 2, is_online: false },
    ];
    const line = formatGuildDutyHeaderResidualLine({
      label: "官员",
      expanded: false,
      members,
      guildOnlineSummary: {
        members,
        totalCount: 10,
        onlineCount: 3,
      },
    });
    expect(line).toBe(
      "▶ 官员 · 2 人 · 在线 1 / 共 2 人 · 在线 3 / 共 10 人",
    );
  });

  it("omits guild summary when not provided", () => {
    const members = [{ display_name: "团长", role: 1, is_online: true }];
    expect(
      formatGuildDutyHeaderResidualLine({
        label: "团长",
        expanded: true,
        members,
      }),
    ).toBe("▼ 团长 · 1 人 · 在线 1 / 共 1 人");
  });
});
