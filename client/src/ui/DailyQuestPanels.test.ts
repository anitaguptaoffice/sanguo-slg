import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { DAILY_CHAIN_TAB_SESSION_KEY } from "@/net/dailyQuestChainTab";
import { DAILY_QUEST_FILTER_SESSION_KEY } from "@/net/dailyQuestListFilter";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";
import * as dailyQuestClaimFeedback from "@/net/dailyQuestClaimFeedback";
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
      chainId: 0,
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

  it("wires filter chips, claimable row dot, and hides count badge at 0 (CLIENT-123)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          { quest_cfg_id: 1010, chain_id: 400, state: 2, quest_code: "daily_train_1" },
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
    expect(mount.querySelectorAll("button[data-ui-filter-chip]")).toHaveLength(4);
    const claimableBtn = mount.querySelector(
      '[data-action="daily-filter"][data-filter="claimable"]',
    ) as HTMLButtonElement;
    expect(claimableBtn?.getAttribute("aria-pressed")).toBe("false");
    const countBadge = mount.querySelector('[data-role="daily-claimable-count-badge"]') as HTMLElement;
    expect(countBadge?.hidden).toBe(false);
    expect(countBadge?.dataset.filterBadgeCount).toBe("1");
    const claimRow = mount.querySelector('li[data-quest-cfg-id="1013"]');
    expect(claimRow?.getAttribute("data-ui-filter-row")).toBe("");
    expect(claimRow?.querySelector('[data-ui-filter-badge="dot"]')).toBeTruthy();
    mount
      .querySelector('[data-action="daily-filter"][data-filter="claimable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(claimableBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(claimableBtn?.classList.contains("selected")).toBe(true);
    sessionStorage.removeItem(DAILY_QUEST_FILTER_SESSION_KEY);
  });

  it("hides claimable filter count badge when no claimable dailies", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [{ quest_cfg_id: 1010, chain_id: 400, state: 2 }],
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new DailyQuestPanels(
      mount,
      gateway,
      () =>
        ({
          serverId: 1,
          cityId: 1,
          cityName: "城",
          wallet: {},
          buildings: [],
          cityTroops: [],
          bag: [],
        }) as MainCitySession,
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const countBadge = mount.querySelector('[data-role="daily-claimable-count-badge"]') as HTMLElement;
    expect(countBadge?.hidden).toBe(true);
  });

  it("batch claim pulses rows and shows secondary progress line (CLIENT-150)", async () => {
    const mount = document.createElement("div");
    const questRows = [
      {
        quest_cfg_id: 1012,
        quest_code: "daily_food_1",
        chain_id: 400,
        state: 3,
        progress_current: 5000,
        progress_target: 5000,
      },
      {
        quest_cfg_id: 1013,
        quest_code: "daily_wood_1",
        chain_id: 400,
        state: 3,
        progress_current: 5000,
        progress_target: 5000,
      },
    ];
    const claimQuestReward = vi.fn().mockImplementation(async (_sid, questCfgId: number) => {
      const row = questRows.find((q) => q.quest_cfg_id === questCfgId);
      if (row) row.state = 4;
      return { granted_rewards: { resources: { gold: 1 } }, quest: { state: 4 } };
    });
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockImplementation(async () => ({
        quests: questRows.map((q) => ({ ...q })),
      })),
      claimQuestReward,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      getCityState: vi.fn().mockResolvedValue({ wallet: {} }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const hudSnapshots: number[] = [];
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
      undefined,
      undefined,
      undefined,
      undefined,
      (rows) => {
        hudSnapshots.push(rows.filter((q) => q.state === 3).length);
      },
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const secondary = mount.querySelector(".daily-quest-row-secondary");
    expect(secondary?.textContent).toContain("链进度");
    const fill = mount.querySelector(".daily-quest-progress-fill") as HTMLElement;
    expect(fill?.style.width).toBe("100%");
    const batchBtn = mount.querySelector('[data-action="claim-daily-batch"]') as HTMLButtonElement;
    expect(batchBtn?.hidden).toBe(false);
    batchBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(claimQuestReward).toHaveBeenCalledTimes(2);
    expect(hudSnapshots.some((n) => n === 1)).toBe(true);
    expect(hudSnapshots[hudSnapshots.length - 1]).toBe(0);
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

  it("shows chain tabs, switches tab, and scrolls to first in-progress (CLIENT-169)", async () => {
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
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1010,
            chain_id: 400,
            state: 2,
            progress_current: 10,
            progress_target: 50,
          },
          {
            quest_cfg_id: 2100,
            chain_id: 401,
            state: 2,
            progress_current: 1,
            progress_target: 3,
          },
          {
            quest_cfg_id: 2101,
            chain_id: 401,
            state: 2,
            progress_current: 5,
            progress_target: 5,
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
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    expect(mount.querySelectorAll(".daily-chain-tab")).toHaveLength(2);
    expect(mount.querySelectorAll('li[data-quest-cfg-id="1010"]')).toHaveLength(1);

    const tab401 = mount.querySelector('[data-daily-chain-id="401"]') as HTMLButtonElement;
    tab401?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(storage.data[DAILY_CHAIN_TAB_SESSION_KEY]).toBe("401");
    expect(mount.querySelectorAll('li[data-quest-cfg-id="2100"]')).toHaveLength(1);
    expect(mount.querySelector('li[data-quest-cfg-id="2100"]')?.classList.contains("selected")).toBe(
      true,
    );
    expect(scrollIntoView).toHaveBeenCalled();

    mount
      .querySelector('[data-action="daily-filter"][data-filter="claimable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(mount.querySelector('[data-action="daily-locate-first"]')?.hidden).toBe(true);

    vi.unstubAllGlobals();
  });

  it("toggle scrolls first claimable row into view (CLIENT-233)", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          { quest_cfg_id: 1010, chain_id: 400, state: 2, progress_current: 1, progress_target: 5 },
          {
            quest_cfg_id: 1013,
            chain_id: 400,
            state: 3,
            progress_current: 4,
            progress_target: 4,
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
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    expect(scrollIntoView).toHaveBeenCalled();
    const scrolledRow = mount.querySelector('li[data-quest-cfg-id="1013"]');
    expect(scrolledRow).toBeTruthy();
  });

  it("single claim pulses progress secondary and updates bar (CLIENT-233)", async () => {
    const pulseSpy = vi.spyOn(dailyQuestClaimFeedback, "pulseDailyQuestClaimProgress");
    const mount = document.createElement("div");
    let claimed = false;
    const questRow = {
      quest_cfg_id: 1013,
      quest_code: "daily_wood_1",
      chain_id: 400,
      state: 3,
      progress_current: 4,
      progress_target: 4,
    };
    const claimQuestReward = vi.fn();
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockImplementation(async () => ({
        quests: [{ ...questRow, state: claimed ? 4 : questRow.state }],
      })),
      claimQuestReward,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      getCityState: vi.fn().mockResolvedValue({ wallet: {} }),
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
    const claimBtn = mount.querySelector('[data-action="claim-daily"]') as HTMLButtonElement;
    claimQuestReward.mockImplementation(async () => {
      claimed = true;
      return {
        granted_rewards: { resources: { gold: 1 } },
        quest: { state: 4, progress_current: 4, progress_target: 4 },
      };
    });
    claimBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(pulseSpy).toHaveBeenCalled();
    const secondary = mount.querySelector(".daily-quest-row-secondary");
    expect(secondary?.textContent).toContain("已完成");
    pulseSpy.mockRestore();
  });

  it("renders daily claimable sweep on panel header (CLIENT-193)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1013,
            quest_code: "daily_wood_1",
            chain_id: 400,
            state: 3,
            progress_current: 3,
            progress_target: 4,
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
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    const sweep = mount.querySelector('[data-role="daily-claimable-sweep"]');
    expect(sweep?.textContent).toBe("可领 1 · #1013 进度 75%");
    expect(mount.querySelector(".daily-quest-progress-fill")).toBeTruthy();
  });

  it("renders chain type subline on claimable row (CLIENT-218)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1013,
            quest_code: "daily_wood_1",
            chain_id: 400,
            state: 3,
            progress_current: 4,
            progress_target: 4,
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
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    const row = mount.querySelector('li[data-quest-cfg-id="1013"]');
    expect(row?.querySelector(".daily-quest-chain-type-subline")?.textContent).toBe(
      "主线 · 链进度 4/4 · 可领取",
    );
    expect(row?.querySelector(".daily-quest-progress-fill")).toBeTruthy();
  });

  it("renders chain-queue HUD residual subline when queue active (CLIENT-250)", async () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockReturnValue(now);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1013,
            quest_code: "daily_wood_1",
            chain_id: 400,
            state: 3,
            progress_current: 4,
            progress_target: 4,
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
      buildings: [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 90_000 }],
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
      { farm: "农田" },
      () => [],
    );
    panels.attach();
    panels.toggle();
    await flushPromises();
    const row = mount.querySelector('li[data-quest-cfg-id="1013"]');
    expect(row?.querySelector(".daily-quest-chain-type-subline")).toBeTruthy();
    expect(row?.querySelector(".daily-quest-chain-queue-hud-residual-subline")?.textContent).toBe(
      "主线 · 队列下一完成 <1h",
    );
    const deep = row?.querySelector(".daily-quest-chain-queue-hud-residual-deep-subline");
    expect(deep?.textContent).toContain("深链巩固");
    expect(deep?.textContent).toContain("队列下一完成");
    const deeper = row?.querySelector(".daily-quest-chain-queue-hud-residual-deeper-subline");
    expect(deeper?.textContent).toContain("巩固再加深");
    expect(deeper?.textContent).toContain("队列下一完成");
    const deepest = row?.querySelector(".daily-quest-chain-queue-hud-residual-deepest-subline");
    expect(deepest?.textContent).toContain("巩固再加深一层");
    expect(deepest?.textContent).toContain("队列下一完成");
    const deepestDeeper = row?.querySelector(
      ".daily-quest-chain-queue-hud-residual-deepest-deeper-subline",
    );
    expect(deepestDeeper?.textContent).toContain("巩固再加深二层");
    expect(deepestDeeper?.textContent).toContain("队列下一完成");
    const deepestDeepestDeeper = row?.querySelector(
      ".daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline",
    );
    expect(deepestDeepestDeeper?.textContent).toContain("巩固再加深三层");
    expect(deepestDeepestDeeper?.textContent).toContain("队列下一完成");
    const deepestDeepestDeepest = row?.querySelector(
      ".daily-quest-chain-queue-hud-residual-deepest-deepest-deepest-subline",
    );
    expect(deepestDeepestDeepest?.textContent).toContain("巩固再加深四层");
    expect(deepestDeepestDeepest?.textContent).toContain("队列下一完成");
    const deepestDeepestDeepestDeeper = row?.querySelector(
      ".daily-quest-chain-queue-hud-residual-deepest-deepest-deepest-deeper-subline",
    );
    expect(deepestDeepestDeepestDeeper?.textContent).toContain("巩固再加深五层");
    expect(deepestDeepestDeepestDeeper?.textContent).toContain("队列下一完成");
    vi.restoreAllMocks();
  });

  it("renders progress bar and reward line on secondary row (CLIENT-174)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [
          {
            quest_cfg_id: 1014,
            quest_code: "daily_train_1",
            chain_id: 400,
            state: 2,
            progress_current: 25,
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
    const panels = new DailyQuestPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggle();
    await flushPromises();
    const row = mount.querySelector('li[data-quest-cfg-id="1014"]');
    expect(row?.querySelector(".daily-quest-progress-fill")).toBeTruthy();
    expect((row?.querySelector(".daily-quest-progress-fill") as HTMLElement)?.style.width).toBe(
      "50%",
    );
    expect(row?.querySelector(".daily-quest-row-reward")?.textContent).toContain("急工符");
  });
});
