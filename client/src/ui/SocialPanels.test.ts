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
    player: { player_id: 10001, display_name: "我", power: 5000 },
    wallet: { food: 100, wood: 200, iron: 0, stone: 0, gold: 50 },
    buildings: [],
    cityTroops: [],
    bag: [],
  };
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
  });
});
