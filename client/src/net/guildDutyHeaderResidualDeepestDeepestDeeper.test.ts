import { describe, expect, it } from "vitest";
import { formatGuildDutyHeaderResidualDeepestDeepestDeeperLine } from "@/net/guildDutyHeaderResidualDeepestDeepestDeeper";

describe("formatGuildDutyHeaderResidualDeepestDeepestDeeperLine (CLIENT-329)", () => {
  it("consolidates duty header with deepest-deepest-deeper fourth line and preserves deepest-deeper line", () => {
    const members = [
      { display_name: "甲", role: 2, is_online: true },
      { display_name: "乙", role: 2, is_online: false },
    ];
    const line = formatGuildDutyHeaderResidualDeepestDeepestDeeperLine({
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
    expect(line).toContain("巩固再加深三层 职务 2 人");
    expect(line).toContain("本组在线 1/2");
    expect(line).toContain("巩固再加深二层 职务 2 人");
    expect(line).toContain("巩固再加深一层 职务 2 人");
    expect(line).toContain("在线 3 / 共 10 人");
  });

  it("omits guild segment when guildOnlineSummary absent", () => {
    const members = [{ display_name: "团长", role: 1, is_online: true }];
    const line = formatGuildDutyHeaderResidualDeepestDeepestDeeperLine({
      label: "团长",
      expanded: true,
      members,
    });
    expect(line).toContain("巩固再加深三层 职务 1 人");
    expect(line).not.toContain("在线 3 / 共 10 人");
    expect(line).toContain("巩固再加深二层 职务 1 人");
  });
});
