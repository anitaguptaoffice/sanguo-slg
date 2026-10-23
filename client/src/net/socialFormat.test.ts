import { describe, expect, it } from "vitest";
import { formatServerLine, guildRoleLabel, parseGameServerInfo, serverStatusLabel } from "@/net/socialFormat";

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
});
