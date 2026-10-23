import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { DAILY_QUEST_FILTER_SESSION_KEY } from "@/net/dailyQuestListFilter";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";
import { DailyQuestPanels } from "@/ui/DailyQuestPanels";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

describe("DailyQuestPanels", () => {
  it("daily panel has panel-scroll-body for narrow layout (CLIENT-070)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new DailyQuestPanels(mount, gateway, () => null, () => {}, () => {});
    panels.attach();
    expect(mount.querySelector('[data-center-panel="daily"] .panel-scroll-body')).toBeTruthy();
  });

  it("daily panel keeps claim actions outside scroll body (CLIENT-103)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new DailyQuestPanels(mount, gateway, () => null, () => {}, () => {});
    panels.attach();
    const scroll = mount.querySelector('[data-center-panel="daily"] .panel-scroll-body');
    expect(scroll?.querySelector('[data-action="daily-locate-first"]')).toBeTruthy();
    expect(scroll?.querySelector('[data-role="daily-list"]')).toBeTruthy();
    expect(mount.querySelector('[data-action="claim-daily"]')?.closest(".panel-scroll-body")).toBeNull();
  });

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
    expect(ul?.textContent).toContain("[采集]");
    expect(ul?.textContent).toContain("daily_food_1");
    expect(mount.querySelector('[data-action="report-quest"]')).toBeNull();
    const nextBtn = mount.querySelector('[data-action="daily-go-next"]') as HTMLButtonElement;
    expect(nextBtn?.hidden).toBe(true);
  });

  it("shows next-step navigation for in-progress train daily", async () => {
    const mount = document.createElement("div");
    const onNavigate = vi.fn();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1014,
            quest_code: "daily_train_1",
            state: 2,
            progress_current: 5,
            progress_target: 50,
          },
        ],
      }),
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
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      onNavigate,
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const nextBtn = mount.querySelector('[data-action="daily-go-next"]') as HTMLButtonElement;
    expect(nextBtn?.hidden).toBe(false);
    nextBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "train_troops" });
  });

  it("shows nearest recruit countdown on train daily row", async () => {
    const mount = document.createElement("div");
    const now = Date.now();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1014,
            quest_code: "daily_train_1",
            state: 2,
            progress_current: 5,
            progress_target: 50,
          },
        ],
      }),
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
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      () => session.buildings,
      {},
      () => [{ queue_id: 2, unit_cfg_id: 1, count: 8, finish_at_ms: now + 45_000 }],
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const row = mount.querySelector('li[data-quest-cfg-id="1014"]');
    expect(row?.textContent).toContain("队列：");
    expect(row?.textContent).toContain("×8");
  });

  it("claim failure shows CLIENT-067 style daily-form-error", async () => {
    const mount = document.createElement("div");
    const err = Object.assign(new Error("奖励已领取"), { code: 40012 });
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [{ quest_cfg_id: 1012, quest_code: "daily_food_1", state: 3 }],
      }),
      claimQuestReward: vi.fn().mockRejectedValue(err),
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
    mount.querySelector('[data-action="claim-daily"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector('[data-role="daily-form-error"]')?.textContent).toContain("[40012]");
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
    const row = mount.querySelector('li[data-quest-cfg-id="1012"]');
    expect(row?.classList.contains("daily-quest-claimable")).toBe(true);
  });

  it("shows battle-report unread banner and opens via callback", async () => {
    const mount = document.createElement("div");
    const onOpenBattleReports = vi.fn();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
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
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      undefined,
      () => 2,
      onOpenBattleReports,
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const banner = mount.querySelector('[data-role="daily-report-banner"]') as HTMLElement;
    expect(banner?.hidden).toBe(false);
    expect(banner?.textContent).toContain("未读战报");
    banner?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenBattleReports).toHaveBeenCalledTimes(1);
  });

  it("daily_march_1 shows readiness tag and bag next-step", async () => {
    const mount = document.createElement("div");
    const onNavigate = vi.fn();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1033,
            quest_code: "daily_march_1",
            state: 2,
            progress_current: 0,
            progress_target: 1,
          },
        ],
      }),
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
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      onNavigate,
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const ul = mount.querySelector('[data-role="daily-list"]');
    expect(ul?.textContent).toContain("[战备]");
    expect(ul?.querySelector('[data-action="daily-cross-battle-report"]')?.textContent).toBe("战报");
    const nextBtn = mount.querySelector('[data-action="daily-go-next"]') as HTMLButtonElement;
    expect(nextBtn?.hidden).toBe(false);
    nextBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onNavigate).toHaveBeenCalledWith({ kind: "use_item", itemCfgId: 2020 });
  });

  it("daily_build_1 shows mail cross-link tag", async () => {
    const mount = document.createElement("div");
    const onOpenMail = vi.fn();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [{ quest_cfg_id: 1032, quest_code: "daily_build_1", state: 2 }],
      }),
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
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      onOpenMail,
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const tag = mount.querySelector('[data-action="daily-cross-mail"]') as HTMLButtonElement;
    expect(tag?.textContent).toBe("邮件");
    tag?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenMail).toHaveBeenCalledTimes(1);
  });

  it("filters dailies by state and persists filter in sessionStorage", async () => {
    const storage = {
      data: {} as Record<string, string>,
      getItem(k: string) {
        return this.data[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.data[k] = v;
      },
      removeItem(k: string) {
        delete this.data[k];
      },
      clear() {
        this.data = {};
      },
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("sessionStorage", storage);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          { quest_cfg_id: 1010, chain_id: 400, state: 2, quest_code: "daily_train_1" },
          { quest_cfg_id: 1012, chain_id: 400, state: 4, quest_code: "daily_food_1" },
          { quest_cfg_id: 1013, chain_id: 400, state: 3, quest_code: "daily_wood_1" },
        ],
      }),
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
    const summary = mount.querySelector('[data-role="daily-state-summary"]');
    expect(summary?.textContent).toContain("进行中 1");
    expect(summary?.textContent).toContain("可领取 1");
    const rows = () =>
      Array.from(mount.querySelectorAll("li[data-quest-cfg-id]")).map((el) =>
        el.getAttribute("data-quest-cfg-id"),
      );
    expect(rows()).toEqual(["1010", "1013", "1012"]);
    mount
      .querySelector('[data-action="daily-filter"][data-filter="claimable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(rows()).toEqual(["1013"]);
    expect(storage.data[DAILY_QUEST_FILTER_SESSION_KEY]).toBe("claimable");
    const locateBtn = mount.querySelector(
      '[data-action="daily-locate-first"]',
    ) as HTMLButtonElement;
    expect(locateBtn?.hidden).toBe(false);
    locateBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(mount.querySelector('li[data-quest-cfg-id="1013"]')?.classList.contains("selected")).toBe(
      true,
    );
    vi.unstubAllGlobals();
  });

  it("openFromTodoBadge highlights first acceptable daily", async () => {
    const mount = document.createElement("div");
    const listPlayerQuests = vi.fn().mockResolvedValue({
      quests: [
        { quest_cfg_id: 1010, chain_id: 400, state: 2 },
        { quest_cfg_id: 1012, chain_id: 400, state: 1 },
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
    panels.openFromTodoBadge(1012);
    await flushPromises();
    const row = mount.querySelector('li[data-quest-cfg-id="1012"]');
    expect(row?.classList.contains("selected")).toBe(true);
  });
});
