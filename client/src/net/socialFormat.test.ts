import { describe, expect, it } from "vitest";
import {
  chatChannelLabel,
  formatChatLogLine,
  formatGuildMemberLine,
  formatGuildSummaryText,
  formatServerLine,
  formatSocialGatewayError,
  guildRoleLabel,
  parseGameServerInfo,
  serverStatusLabel,
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
