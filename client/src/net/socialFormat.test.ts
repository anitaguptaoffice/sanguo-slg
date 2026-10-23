import { describe, expect, it } from "vitest";
import {
  chatChannelLabel,
  formatChatDayGroupTitle,
  formatChatLogLine,
  formatGuildMemberLine,
  formatGuildMentionDraft,
  formatGuildSummaryText,
  formatServerLine,
  formatSocialGatewayError,
  groupChatMessagesByLocalDay,
  groupGuildMembersByRole,
  guildRoleChipClass,
  guildRoleGroupDefaultExpanded,
  guildRoleLabel,
  localCalendarDayKey,
  parseGameServerInfo,
  serverStatusLabel,
  sortGuildMembers,
  truncatePlayerId,
  SOCIAL_LIST_EMPTY_CLASS,
  formatSocialChatEmptyMessage,
  formatSocialGuildMembersEmptyMessage,
  formatSocialGuildNotJoinedReadonlyMessage,
  formatSocialPanelListRefreshHint,
  formatSocialPanelStaleDataLabel,
  formatSocialRankEmptyMessage,
  socialChatEmptyListClass,
  socialGuildMembersEmptyListClass,
  socialRankEmptyRowClass,
} from "@/net/socialFormat";

describe("socialFormat", () => {
  it("parses game server info from proto shape", () => {
    const row = parseGameServerInfo({
      shard: { server_id: 2, display_name: "双线二服", status: 2 },
      online_count: 120,
      has_player: true,
    });
    expect(row.server_id).toBe(2);
    expect(formatServerLine(row)).toContain("双线二服");
    expect(formatServerLine(row)).toContain("火爆");
  });

  it("labels guild roles", () => {
    expect(guildRoleLabel(1)).toBe("团长");
    expect(serverStatusLabel(3)).toBe("停服");
  });

  it("formats chat log line with channel, sender id and time", () => {
    const line = formatChatLogLine({
      channel: 1,
      sender_display_name: "演示君主",
      sender_player_id: 10001,
      content: "hello",
      sent_at_ms: Date.UTC(2026, 0, 15, 8, 30, 0),
    });
    expect(line).toContain("[世界]");
    expect(line).toContain("演示君主 (#10001)");
    expect(line).toContain("hello");
    expect(chatChannelLabel(3)).toBe("军团");
  });

  it("formats guild mention draft for chat input", () => {
    expect(formatGuildMentionDraft("虎贲甲")).toBe("@虎贲甲 ");
    expect(formatGuildMentionDraft("  ")).toBe("@? ");
    expect(formatGuildMentionDraft("")).toBe("@? ");
  });

  it("formats guild summary and member rows", () => {
    expect(formatGuildSummaryText(0, "")).toBe("尚未加入军团");
    expect(formatGuildSummaryText(7001, "虎贲营")).toContain("虎贲营 (#7001)");
    const member = formatGuildMemberLine({
      display_name: "甲",
      role: 2,
      power: 9000,
      joined_at_ms: Date.UTC(2026, 0, 1, 12, 0, 0),
    });
    expect(member).toContain("官员");
    expect(member).toContain("加入");
  });

  it("groups guild members by role in leader-officer-member order (CLIENT-101)", () => {
    const groups = groupGuildMembersByRole([
      { display_name: "丙", role: 3, power: 9000 },
      { display_name: "甲", role: 1, power: 12000 },
      { display_name: "乙", role: 2, power: 10000 },
      { display_name: "丁", role: 2, power: 8000 },
    ]);
    expect(groups.map((g) => g.roleKey)).toEqual([1, 2, 3]);
    expect(groups[0].members.map((m) => m.display_name)).toEqual(["甲"]);
    expect(groups[1].members.map((m) => m.display_name)).toEqual(["乙", "丁"]);
    expect(guildRoleGroupDefaultExpanded(1)).toBe(true);
    expect(guildRoleGroupDefaultExpanded(2)).toBe(false);
    expect(guildRoleChipClass(1)).toContain("guild-role-chip-leader");
    expect(guildRoleChipClass(99)).toContain("guild-role-chip-unknown");
  });

  it("sorts guild members leader to member by role then power", () => {
    const sorted = sortGuildMembers([
      { display_name: "丙", role: 3, power: 9000, player_id: 3 },
      { display_name: "甲", role: 1, power: 12000, player_id: 1 },
      { display_name: "乙", role: 2, power: 10000, player_id: 2 },
    ]);
    expect(sorted.map((m) => m.role)).toEqual([1, 2, 3]);
    expect(truncatePlayerId(100_012_345)).toBe("#…2345");
    const line = formatGuildMemberLine({
      display_name: "甲",
      role: 1,
      player_id: 100_012_345,
      power: 1,
    });
    expect(line).toContain("#…2345");
  });

  it("groups chat messages by local calendar day with 今日/昨日 titles", () => {
    const now = new Date(2026, 9, 23, 15, 0, 0).getTime();
    const todayMorning = new Date(2026, 9, 23, 9, 0, 0).getTime();
    const yesterday = new Date(2026, 9, 22, 20, 0, 0).getTime();
    const groups = groupChatMessagesByLocalDay(
      [
        { content: "a", sent_at_ms: yesterday },
        { content: "b", sent_at_ms: todayMorning },
        { content: "c", sent_at_ms: todayMorning + 1000 },
      ],
      now,
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].title).toBe("昨日");
    expect(groups[1].title).toBe("今日");
    expect(groups[1].messages).toHaveLength(2);
    const todayKey = localCalendarDayKey(todayMorning);
    expect(formatChatDayGroupTitle(todayKey, now)).toBe("今日");
  });

  it("exposes unified social panel empty keys and copy (CLIENT-053)", () => {
    expect(socialChatEmptyListClass()).toBe(SOCIAL_LIST_EMPTY_CLASS);
    expect(socialGuildMembersEmptyListClass()).toBe(SOCIAL_LIST_EMPTY_CLASS);
    expect(socialRankEmptyRowClass()).toBe("rank-empty-row");
    expect(formatSocialChatEmptyMessage()).toContain("刷新");
    expect(formatSocialGuildMembersEmptyMessage()).toContain("刷新成员");
    expect(formatSocialRankEmptyMessage()).toContain("刷新排行榜");
    expect(formatSocialRankEmptyMessage()).toContain("种子");
    expect(formatSocialGuildNotJoinedReadonlyMessage()).toContain("尚未加入军团");
    expect(formatSocialPanelListRefreshHint()).toBe("请点「刷新」重试");
    expect(formatSocialPanelStaleDataLabel()).toBe("数据可能已过期");
  });

  it("maps social gateway error codes to readable hints", () => {
    const muted = new Error("player muted");
    (muted as Error & { code: number }).code = 61006;
    expect(formatSocialGatewayError(muted)).toContain("禁言");
    expect(formatSocialGatewayError(muted)).toContain("61006");
    const missing = new Error("guild not found");
    (missing as Error & { code: number }).code = 60001;
    expect(formatSocialGatewayError(missing)).toContain("军团不存在");
  });
});
