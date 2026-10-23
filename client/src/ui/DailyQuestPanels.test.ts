import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";
import { DailyQuestPanels } from "@/ui/DailyQuestPanels";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("DailyQuestPanels", () => {
  it("lists dailies with chain_id 400", async () => {
    const mount = document.createElement("div");
    const listPlayerQuests = vi.fn().mockResolvedValue({
      quests: [
        {
          quest_cfg_id: 1012,
          quest_code: "daily_food_1",
          chain_id: 400,
          state: 1,
          progress_current: 0,
          progress_target: 5000,
        },
      ],
    });
    const gateway: GatewayPort = {
      listPlayerQuests,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    expect(listPlayerQuests).toHaveBeenCalledWith(1, {
      chainId: DAILY_QUEST_CHAIN_ID,
      includeCompleted: true,
    });
    const ul = mount.querySelector('[data-role="daily-list"]');
    expect(ul?.textContent).toContain("daily_food_1");
    expect(mount.querySelector('[data-action="report-quest"]')).toBeNull();
  });

  it("claim merges session and refreshes economy", async () => {
    const mount = document.createElement("div");
    let patched: Partial<MainCitySession> | null = null;
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1012,
            quest_code: "daily_food_1",
            state: 3,
            progress_current: 5000,
            progress_target: 5000,
          },
        ],
      }),
      claimQuestReward: vi.fn().mockResolvedValue({
        granted_rewards: { resources: { gold: 75 }, items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
      listPlayerBag: vi.fn().mockResolvedValue({ items: [{ item_cfg_id: 2001, quantity: 3 }] }),
      getCityState: vi.fn().mockResolvedValue({ wallet: { food: 9000, gold: 75 } }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: { gold: 10 },
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      (p) => {
        patched = p;
        Object.assign(session, p);
      },
      () => {},
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    mount.querySelector('[data-action="claim-daily"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.claimQuestReward).toHaveBeenCalledWith(1, 1012);
    expect(patched?.bag).toEqual([{ item_cfg_id: 2001, quantity: 3 }]);
    expect(patched?.wallet?.food).toBe(9000);
    expect(patched?.wallet?.gold).toBe(75);
  });
});
