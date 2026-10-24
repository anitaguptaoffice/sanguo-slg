import { describe, expect, it } from "vitest";
import { formatGuildDutyHeaderResidualDeepLine } from "@/net/guildDutyHeaderResidualDeep";

describe("formatGuildDutyHeaderResidualDeepLine (CLIENT-265)", () => {
  it("consolidates duty header, role count, and online summaries", () => {
    const members = [
      { display_name: "甲", role: 2, is_online: true },
      { display_name: "乙", role: 2, is_online: false },
    ];
    const line = formatGuildDutyHeaderResidualDeepLine({
      label: "官员",
      expanded: false,
      members,
      guildOnlineSummary: {
        members,
        totalCount: 10,
        onlineCount: 3,
      },
    });
    expect(line).toContain("▶ 官员 · 2 人");
    expect(line).toContain("巩固 职务 2 人");
    expect(line).toContain("本组在线 1/2");
    expect(line).toContain("在线 3 / 共 10 人");
    expect(line).toContain("在线 1 / 共 2 人");
  });

  it("omits guild segment when guildOnlineSummary absent", () => {
    const members = [{ display_name: "团长", role: 1, is_online: true }];
    const line = formatGuildDutyHeaderResidualDeepLine({
      label: "团长",
      expanded: true,
      members,
    });
    expect(line).toContain("巩固 职务 1 人");
    expect(line).not.toContain("在线 3 / 共 10 人");
  });
});
