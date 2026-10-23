import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import { SocialPanels } from "@/ui/SocialPanels";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function baseSession(): MainCitySession {
  return {
    serverId: 1,
    cityId: 1,
    cityName: "城",
    player: { player_id: 10001, display_name: "演示君主", power: 5000 },
    wallet: { food: 100, wood: 200, iron: 0, stone: 0, gold: 50 },
    buildings: [],
    cityTroops: [],
    bag: [],
  };
}

function minimalGateway(overrides: Partial<GatewayPort> = {}): GatewayPort {
  return {
    getBoundServerId: () => 1,
    ...overrides,
  } as unknown as GatewayPort;
}

describe("SocialPanels rank", () => {
  it("fetches power leaderboard on open", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [{ rank: 1, display_name: "甲", score: 100 }],
      my_rank: 2,
      my_score: 90,
      snapshot_version: 1,
      snapshot_refreshed_at_ms: 1_700_000_000_000,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    expect(getLeaderboard).toHaveBeenCalledWith(1, LB_PLAYER_POWER, 1, 20);
    expect(mount.querySelector('[data-role="viewer-rank"]')?.textContent).toContain("第 2 名");
    expect(mount.querySelector('[data-role="rank-snapshot"]')?.textContent).toContain("快照批次");
  });

  it("switches to resource board and shows empty list", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 1,
        my_score: 100,
      })
      .mockResolvedValueOnce({
        entries: [],
        my_rank: 0,
        my_score: 350,
      });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const select = mount.querySelector('[data-field="rank-type"]') as HTMLSelectElement;
    select.value = String(LB_PLAYER_RESOURCE);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    expect(getLeaderboard).toHaveBeenLastCalledWith(1, LB_PLAYER_RESOURCE, 1, 20);
    expect(mount.querySelector('[data-role="viewer-rank"]')?.textContent).toContain("未上榜");
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("（空榜）");
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("种子");
  });
});

describe("SocialPanels chat & guild", () => {
  it("renders chat rows with channel and sender id", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      listChatMessages: vi.fn().mockResolvedValue({
        messages: [
          {
            channel: 1,
            sender_display_name: "演示君主",
            sender_player_id: 10001,
            content: "测试",
            sent_at_ms: Date.UTC(2026, 0, 15, 10, 0, 0),
          },
        ],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleChat();
    mount.querySelector('[data-action="refresh-chat"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const log = mount.querySelector('[data-role="chat-log"]');
    expect(log?.textContent).toContain("[世界]");
    expect(log?.textContent).toContain("(#10001)");
    expect(log?.textContent).toContain("测试");
  });

  it("blocks guild channel send without membership", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const gateway = minimalGateway({
      sendChatMessage: vi.fn(),
      listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), (m) => statuses.push(m));
    panels.attach();
    panels.toggleChat();
    const channel = mount.querySelector('[data-field="channel"]') as HTMLSelectElement;
    channel.value = "3";
    channel.dispatchEvent(new Event("change", { bubbles: true }));
    const content = mount.querySelector('[data-field="chat-content"]') as HTMLInputElement;
    content.value = "军团消息";
    mount.querySelector('[data-action="send-chat"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.sendChatMessage).not.toHaveBeenCalled();
    expect(statuses.some((s) => s.includes("军团"))).toBe(true);
  });

  it("shows guild-summary after create and formats mute errors", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营" },
        members: [{ display_name: "演示君主", role: 1, power: 12800, joined_at_ms: 1 }],
      }),
      sendChatMessage: vi.fn().mockRejectedValue(
        Object.assign(new Error("player muted"), { code: 61006 }),
      ),
      listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), (m) => statuses.push(m));
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const summary = mount.querySelector('[data-role="guild-summary"]');
    expect(summary?.textContent).toContain("虎贲营 (#7001)");

    panels.toggleChat();
    const channel = mount.querySelector('[data-field="channel"]') as HTMLSelectElement;
    channel.value = "1";
    (mount.querySelector('[data-field="chat-content"]') as HTMLInputElement).value = "hi";
    mount.querySelector('[data-action="send-chat"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(statuses.some((s) => s.includes("禁言") && s.includes("61006"))).toBe(true);
  });
});
