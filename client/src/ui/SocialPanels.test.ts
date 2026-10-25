import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import { RANK_MY_RANK_CHANGED_PULSE_CLASS } from "@/net/leaderboardMyRankRefresh";
import { ChatUnreadTracker } from "@/net/chatUnread";
import { RANK_LAST_REFRESH_SESSION_KEY } from "@/net/rankLastRefreshSession";
import {
  formatRankRefreshCooldownStamp,
  RANK_MANUAL_REFRESH_COOLDOWN_MS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
} from "@/net/rankRefreshCooldown";
import { formatRankRefreshCooldownResidualStamp } from "@/net/rankRefreshCooldownResidual";
import { RANK_MANUAL_REFRESH_COUNT_SESSION_KEY } from "@/net/rankManualRefreshCountSession";
import { formatRankRefreshCooldownResidualDeepStamp } from "@/net/rankRefreshCooldownResidualDeep";
import { formatRankRefreshCooldownResidualDeeperStamp } from "@/net/rankRefreshCooldownResidualDeeper";
import { formatRankRefreshCooldownResidualDeepestStamp } from "@/net/rankRefreshCooldownResidualDeepest";
import { formatRankRefreshCooldownResidualDeepestDeeperStamp } from "@/net/rankRefreshCooldownResidualDeepestDeeper";
import { formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp } from "@/net/rankRefreshCooldownResidualDeepestDeepestDeeper";
import { formatRankRefreshCooldownResidualDeepestDeepestDeepestStamp } from "@/net/rankRefreshCooldownResidualDeepestDeepestDeepest";
import { formatRankRefreshCooldownResidualDeepestDeepestDeepestDeeperStamp } from "@/net/rankRefreshCooldownResidualDeepestDeepestDeepestDeeper";
import { RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS } from "@/net/rankPinKeepResidualDeepRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS } from "@/net/rankPinKeepResidualDeeperRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS } from "@/net/rankPinKeepResidualDeepestRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS } from "@/net/rankPinKeepResidualDeepestDeeperRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS } from "@/net/rankPinKeepResidualDeepestDeepestDeeperRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS } from "@/net/rankPinKeepResidualDeepestDeepestDeepestRing";
import { RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS } from "@/net/rankPinKeepResidualDeepestDeepestDeepestDeeperRing";
import { RANK_PIN_KEEP_RESIDUAL_RING_CLASS } from "@/net/rankPinKeepResidualRing";
import { LEADERBOARD_PIN_SESSION_KEY } from "@/net/leaderboardPin";
import {
  LEADERBOARD_RETURN_SCROLL_SESSION_KEY,
  writeLeaderboardReturnScroll,
} from "@/net/leaderboardReturnScroll";
import {
  CHAT_PANEL_LAST_REFRESH_SESSION_KEY,
  GUILD_PANEL_LAST_REFRESH_SESSION_KEY,
} from "@/net/socialPanelRefreshSession";
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

describe("SocialPanels narrow scroll (CLIENT-078 + CLIENT-095)", () => {
  beforeEach(() => {
    sessionStorage.removeItem(RANK_MANUAL_REFRESH_SESSION_KEY);
    sessionStorage.removeItem(RANK_MANUAL_REFRESH_COUNT_SESSION_KEY);
  });

  it("guild and chat panels have center-panel id and scroll body (CLIENT-095)", () => {
    const mount = document.createElement("div");
    const panels = new SocialPanels(mount, minimalGateway(), () => baseSession(), () => {});
    panels.attach();
    expect(mount.querySelector('[data-center-panel="guild"] .panel-scroll-body')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="chat"] .panel-scroll-body')).toBeTruthy();
  });

  it("rank panel uses content-panel scroll body for narrow layout (CLIENT-078)", () => {
    const mount = document.createElement("div");
    const panels = new SocialPanels(mount, minimalGateway(), () => baseSession(), () => {});
    panels.attach();
    expect(mount.querySelector('[data-center-panel="rank"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="rank"] .panel-scroll-body')).toBeTruthy();
  });

  it("rank dual-board controls stay outside scroll body (CLIENT-103)", () => {
    const mount = document.createElement("div");
    const panels = new SocialPanels(mount, minimalGateway(), () => baseSession(), () => {});
    panels.attach();
    const scroll = mount.querySelector('[data-center-panel="rank"] .panel-scroll-body');
    expect(scroll?.querySelector('[data-role="rank-list"]')).toBeTruthy();
    expect(scroll?.querySelector('[data-role="viewer-rank"]')).toBeTruthy();
    expect(mount.querySelector('[data-field="rank-type"]')?.closest(".panel-scroll-body")).toBeNull();
    expect(mount.querySelector('[data-action="refresh-rank"]')?.closest(".panel-scroll-body")).toBeNull();
  });

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
    expect(mount.querySelector('[data-role="rank-refresh-status"]')?.textContent).toContain("上次刷新");
    expect(mount.querySelector(".rank-pin-row")?.textContent).toContain("我的排名 #2");
    expect(mount.querySelector('[data-role="rank-last-refresh"]')?.textContent).toContain("上次刷新：");
    expect(sessionStorage.getItem(RANK_LAST_REFRESH_SESSION_KEY)).toContain(String(LB_PLAYER_POWER));
  });

  it("CLIENT-214: empty rank list shows rank-empty-retry-inline", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [],
      my_rank: 0,
      my_score: 0,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const emptyRow = mount.querySelector(".rank-empty-row");
    expect(emptyRow?.querySelector(".rank-empty-retry-inline")).toBeTruthy();
    expect(emptyRow?.textContent).toContain("（空榜）");
    vi.mocked(getLeaderboard).mockClear();
    emptyRow?.querySelector(".rank-empty-retry-inline")?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(getLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("CLIENT-214: manual refresh shows cooldown stamp and blocks repeat RPC", async () => {
    const mount = document.createElement("div");
    const now = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [{ rank: 1, display_name: "甲", score: 100 }],
      my_rank: 1,
      my_score: 100,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const openCalls = getLeaderboard.mock.calls.length;
    try {
      mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(getLeaderboard.mock.calls.length).toBe(openCalls + 1);
      const stamp = mount.querySelector('[data-role="rank-refresh-cooldown"]');
      expect(stamp?.textContent).toBe(formatRankRefreshCooldownStamp(now, now));
      expect(stamp?.classList.contains("hidden")).toBe(false);
      vi.mocked(getLeaderboard).mockClear();
      mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(getLeaderboard).not.toHaveBeenCalled();
      nowSpy.mockReturnValue(now + RANK_MANUAL_REFRESH_COOLDOWN_MS + 1);
      mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(getLeaderboard).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
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
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("刷新排行榜");
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("种子");
    expect(mount.querySelector(".rank-pin-row")).toBeNull();
  });

  it("CLIENT-152: pulses pin row when my_rank changes on manual refresh", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 2,
        my_score: 90,
      })
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 4,
        my_score: 88,
      });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const pin = mount.querySelector(".rank-pin-row");
    expect(pin?.querySelector(".rank-pin-primary")?.textContent).toContain("我的排名 #2");
    expect(pin?.querySelector(".rank-pin-secondary")?.textContent).toContain("上次刷新");
    expect(
      mount.querySelector('[data-role="rank-pin-refresh-residual-line"]')?.textContent,
    ).toContain("钉选 #2");
    expect(pin?.classList.contains(RANK_MY_RANK_CHANGED_PULSE_CLASS)).toBe(false);
    mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const pinAfter = mount.querySelector(".rank-pin-row");
    expect(pinAfter?.querySelector(".rank-pin-primary")?.textContent).toContain("我的排名 #4");
    expect(pinAfter?.classList.contains(RANK_MY_RANK_CHANGED_PULSE_CLASS)).toBe(true);
  });

  it("CLIENT-184: manual refresh shows top density rows and keeps pin scroll + hero deep link", async () => {
    const mount = document.createElement("div");
    const onOpenHero = vi.fn();
    const getLeaderboard = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [
          { rank: 1, display_name: "榜首甲", score: 20_000 },
          { rank: 2, entity_id: 10001, display_name: "演示君主", score: 5000, hero_id: 8001 },
        ],
        my_rank: 2,
        my_score: 5000,
      })
      .mockResolvedValueOnce({
        entries: [
          { rank: 1, display_name: "榜首甲", score: 21_000 },
          { rank: 2, entity_id: 10001, display_name: "演示君主", score: 5100, hero_id: 8001 },
          { rank: 3, display_name: "丙", score: 100 },
        ],
        my_rank: 2,
        my_score: 5100,
      });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.setRankDeepLinkHandlers({
      getViewerHeroIds: async () => [8001],
      onOpenHeroDetail: onOpenHero,
    });
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    expect(mount.querySelector(".rank-refreshed-hint-row")).toBeNull();
    const scrollBody = mount.querySelector('[data-role="rank-scroll"]') as HTMLElement;
    scrollBody.scrollTop = 72;
    mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector(".rank-refreshed-hint-row")?.textContent).toContain("三甲快览");
    expect(mount.querySelectorAll(".rank-top-density-row").length).toBe(3);
    expect(
      mount.querySelector(".rank-top-density-row [data-role='rank-list-density-scan-residual-line']")
        ?.textContent,
    ).toContain("密度扫读");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deep-line']",
      )?.textContent,
    ).toContain("扫读加深");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deeper-line']",
      )?.textContent,
    ).toContain("扫读巩固再加深");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deepest-line']",
      )?.textContent,
    ).toContain("扫读巩固再加深一层");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deepest-deeper-line']",
      )?.textContent,
    ).toContain("扫读巩固再加深二层");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deepest-deepest-deeper-line']",
      )?.textContent,
    ).toContain("扫读巩固再加深三层");
    expect(
      mount.querySelector(
        ".rank-top-density-row [data-role='rank-list-density-scan-residual-deepest-deepest-deepest-line']",
      )?.textContent,
    ).toContain("扫读巩固再加深四层");
    expect(mount.querySelector(".rank-pin-row")?.querySelector(".rank-pin-primary")?.textContent).toContain(
      "我的排名 #2",
    );
    expect(scrollBody.scrollTop).toBe(72);
    expect(sessionStorage.getItem(LEADERBOARD_PIN_SESSION_KEY)).toBeNull();
    const heroBtn = mount.querySelector('[data-action="rank-view-hero"]');
    heroBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(onOpenHero).toHaveBeenCalledWith(8001);
    expect(sessionStorage.getItem(LEADERBOARD_RETURN_SCROLL_SESSION_KEY)).toContain("72");
  });

  it("keeps last rank snapshot on refresh failure and marks stale", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 1,
        my_score: 100,
      })
      .mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: 500 }));
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("甲");
    mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector('[data-role="rank-list"]')?.textContent).toContain("甲");
    const status = mount.querySelector('[data-role="rank-refresh-status"]');
    expect(status?.textContent).toContain("刷新失败");
    expect(status?.textContent).toContain("数据可能已过期");
  });

  it("disables rank refresh while in-flight and dedupes double click", async () => {
    const mount = document.createElement("div");
    let resolve!: (v: object) => void;
    const getLeaderboard = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    const btn = mount.querySelector('[data-action="refresh-rank"]') as HTMLButtonElement;
    btn?.dispatchEvent(new Event("click", { bubbles: true }));
    btn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(getLeaderboard).toHaveBeenCalledTimes(1);
    expect(btn.disabled).toBe(true);
    resolve({ entries: [], my_rank: 0, my_score: 0 });
    await flushPromises();
  });

  it("CLIENT-248: manual refresh shows cooldown residual stamp and pin keep ring", async () => {
    const mount = document.createElement("div");
    const now = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
    const getLeaderboard = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 2,
        my_score: 90,
      })
      .mockResolvedValueOnce({
        entries: [{ rank: 1, display_name: "甲", score: 100 }],
        my_rank: 2,
        my_score: 91,
      });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    try {
      mount.querySelector('[data-action="refresh-rank"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      const residual = mount.querySelector('[data-role="rank-refresh-cooldown-residual"]');
      expect(residual?.textContent).toBe(
        formatRankRefreshCooldownResidualStamp(now, now, now),
      );
      expect(residual?.classList.contains("hidden")).toBe(false);
      expect(mount.querySelector(".rank-pin-row")?.classList.contains(RANK_PIN_KEEP_RESIDUAL_RING_CLASS)).toBe(
        true,
      );
      expect(mount.querySelector('[data-role="rank-refresh-cooldown"]')?.textContent).toBe(
        formatRankRefreshCooldownStamp(now, now),
      );
      const deep = mount.querySelector('[data-role="rank-refresh-cooldown-residual-deep"]');
      expect(deep?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepStamp(now, now, 1, now),
      );
      expect(deep?.classList.contains("hidden")).toBe(false);
      expect(
        mount.querySelector(".rank-pin-row")?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS),
      ).toBe(true);
      const deeper = mount.querySelector('[data-role="rank-refresh-cooldown-residual-deeper"]');
      expect(deeper?.textContent).toBe(
        formatRankRefreshCooldownResidualDeeperStamp(now, now, 1, now),
      );
      expect(deeper?.classList.contains("hidden")).toBe(false);
      expect(
        mount.querySelector(".rank-pin-row")?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS),
      ).toBe(true);
      const deepest = mount.querySelector('[data-role="rank-refresh-cooldown-residual-deepest"]');
      expect(deepest?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepestStamp(now, now, 1, now),
      );
      expect(deepest?.classList.contains("hidden")).toBe(false);
      expect(
        mount.querySelector(".rank-pin-row")?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS),
      ).toBe(true);
      const deepestDeeper = mount.querySelector(
        '[data-role="rank-refresh-cooldown-residual-deepest-deeper"]',
      );
      expect(deepestDeeper?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepestDeeperStamp(now, now, 1, now),
      );
      expect(deepestDeeper?.classList.contains("hidden")).toBe(false);
      expect(
        mount
          .querySelector(".rank-pin-row")
          ?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS),
      ).toBe(true);
      const deepestDeepestDeeper = mount.querySelector(
        '[data-role="rank-refresh-cooldown-residual-deepest-deepest-deeper"]',
      );
      expect(deepestDeepestDeeper?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp(now, now, 1, now),
      );
      expect(deepestDeepestDeeper?.classList.contains("hidden")).toBe(false);
      expect(
        mount
          .querySelector(".rank-pin-row")
          ?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
      ).toBe(true);
      const deepestDeepestDeepest = mount.querySelector(
        '[data-role="rank-refresh-cooldown-residual-deepest-deepest-deepest"]',
      );
      expect(deepestDeepestDeepest?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepestDeepestDeepestStamp(now, now, 1, now),
      );
      expect(deepestDeepestDeepest?.classList.contains("hidden")).toBe(false);
      expect(
        mount
          .querySelector(".rank-pin-row")
          ?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
      ).toBe(true);
      const deepestDeepestDeepestDeeper = mount.querySelector(
        '[data-role="rank-refresh-cooldown-residual-deepest-deepest-deepest-deeper"]',
      );
      expect(deepestDeepestDeepestDeeper?.textContent).toBe(
        formatRankRefreshCooldownResidualDeepestDeepestDeepestDeeperStamp(now, now, 1, now),
      );
      expect(deepestDeepestDeepestDeeper?.classList.contains("hidden")).toBe(false);
      expect(
        mount
          .querySelector(".rank-pin-row")
          ?.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
      ).toBe(true);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("CLIENT-214: keeps refresh disabled during manual cooldown after refresh completes", async () => {
    const mount = document.createElement("div");
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [],
      my_rank: 0,
      my_score: 0,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const btn = mount.querySelector('[data-action="refresh-rank"]') as HTMLButtonElement;
    btn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(btn.disabled).toBe(true);
  });

  it("CLIENT-097: power row opens hero deep link for viewer entry", async () => {
    const mount = document.createElement("div");
    const onOpenHero = vi.fn();
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [{ rank: 2, entity_id: 10001, display_name: "演示君主", score: 5000 }],
      my_rank: 2,
      my_score: 5000,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.setRankDeepLinkHandlers({
      getViewerHeroIds: async () => [8001],
      onOpenHeroDetail: onOpenHero,
    });
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    mount.querySelector("tr.rank-data-row")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(onOpenHero).toHaveBeenCalledWith(8001);
  });

  it("CLIENT-097: power row for other player shows viewer-only toast", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [{ rank: 1, entity_id: 10002, display_name: "路人", score: 9000 }],
      my_rank: 5,
      my_score: 100,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), (m) => statuses.push(m));
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    mount.querySelector("tr.rank-data-row")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(statuses.some((s) => s.includes("仅支持查看己方将领"))).toBe(true);
  });

  it("CLIENT-168: list row shows 查看将领 and persists return scroll on hero deep link", async () => {
    const mount = document.createElement("div");
    const onOpenHero = vi.fn();
    const getLeaderboard = vi.fn().mockResolvedValue({
      entries: [
        { rank: 2, entity_id: 10001, display_name: "演示君主", score: 5000, hero_id: 8001 },
        { rank: 1, entity_id: 10002, display_name: "路人", score: 9000 },
      ],
      my_rank: 2,
      my_score: 5000,
    });
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.setRankDeepLinkHandlers({
      getViewerHeroIds: async () => [8001],
      onOpenHeroDetail: onOpenHero,
    });
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const rows = mount.querySelectorAll("tr.rank-data-row");
    expect(rows[0]?.querySelector('[data-action="rank-view-hero"]')?.textContent).toBe("查看将领");
    expect(rows[1]?.querySelector('[data-action="rank-view-hero"]')).toBeNull();
    const scrollBody = mount.querySelector('[data-role="rank-scroll"]') as HTMLElement;
    scrollBody.scrollTop = 64;
    rows[0]?.querySelector('[data-action="rank-view-hero"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(onOpenHero).toHaveBeenCalledWith(8001);
    const raw = sessionStorage.getItem(LEADERBOARD_RETURN_SCROLL_SESSION_KEY);
    expect(raw).toContain(String(LB_PLAYER_POWER));
    expect(raw).toContain("64");
  });

  it("CLIENT-168: reopen rank restores tab and scroll from session", async () => {
    const mount = document.createElement("div");
    writeLeaderboardReturnScroll({ boardType: LB_PLAYER_RESOURCE, scrollTop: 42 });
    const getLeaderboard = vi.fn().mockImplementation((_sid: number, type: number) =>
      Promise.resolve({
        entries: [{ rank: 1, entity_id: 10001, score: 1 }],
        my_rank: 1,
        my_score: 1,
        type,
      }),
    );
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const select = mount.querySelector('[data-field="rank-type"]') as HTMLSelectElement;
    expect(select.value).toBe(String(LB_PLAYER_RESOURCE));
    expect(getLeaderboard).toHaveBeenCalledWith(1, LB_PLAYER_RESOURCE, 1, 20);
    const scrollBody = mount.querySelector('[data-role="rank-scroll"]') as HTMLElement;
    expect(scrollBody.scrollTop).toBe(42);
    expect(sessionStorage.getItem(LEADERBOARD_RETURN_SCROLL_SESSION_KEY)).toBeNull();
  });

  it("CLIENT-097: resource row with grid opens world deep link", async () => {
    const mount = document.createElement("div");
    const onWorld = vi.fn();
    const getLeaderboard = vi.fn().mockImplementation((_sid: number, type: number) =>
      Promise.resolve(
        type === LB_PLAYER_RESOURCE
          ? {
              entries: [
                { rank: 1, entity_id: 10003, display_name: "富贾", score: 25000, grid_x: 8, grid_y: 9 },
              ],
              my_rank: 0,
              my_score: 0,
            }
          : { entries: [], my_rank: 0, my_score: 0 },
      ),
    );
    const gateway: GatewayPort = {
      getLeaderboard,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.setRankDeepLinkHandlers({ onOpenWorldAtGrid: onWorld });
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const select = mount.querySelector('[data-field="rank-type"]') as HTMLSelectElement;
    select.value = String(LB_PLAYER_RESOURCE);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    mount.querySelector("tr.rank-data-row")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(onWorld).toHaveBeenCalledWith(8, 9);
  });

  it("shows rank refresh error in panel", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      getLeaderboard: vi.fn().mockRejectedValue(Object.assign(new Error("timeout"), { code: 500 })),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleRank();
    await flushPromises();
    const status = mount.querySelector('[data-role="rank-refresh-status"]');
    expect(status?.textContent).toContain("刷新失败");
    expect(status?.textContent).toContain("[500]");
    expect(status?.textContent).toContain("timeout");
    expect(mount.querySelector('[data-role="rank-refresh-retry"]')?.classList.contains("hidden")).toBe(
      false,
    );
    expect(status?.classList.contains("social-refresh-error")).toBe(true);
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
    expect(mount.querySelector('[data-role="chat-refresh-status"]')?.textContent).toContain("上次刷新");
  });

  it("shows guild-not-joined readonly chat empty with navigate to guild panel", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleChat();
    await flushPromises();
    vi.mocked(gateway.listChatMessages!).mockClear();
    const channel = mount.querySelector('[data-field="channel"]') as HTMLSelectElement;
    channel.value = "3";
    channel.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    expect(gateway.listChatMessages).not.toHaveBeenCalled();
    const log = mount.querySelector('[data-role="chat-log"]');
    expect(log?.querySelector(".social-list-empty")?.textContent).toContain("尚未加入军团");
    mount.querySelector('[data-action="navigate-guild-panel"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(mount.querySelector(".social-panel.hidden h3")?.textContent).not.toBe("军团");
    expect(mount.querySelectorAll(".social-panel:not(.hidden) h3")[0]?.textContent).toBe("军团");
  });

  it("shows chat gateway error row with guild-chat-retry-inline on load error (CLIENT-200)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      listChatMessages: vi.fn().mockRejectedValue(new Error("network")),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleChat();
    await flushPromises();
    const errRow = mount.querySelector('[data-role="chat-log"] [data-panel-state="error"]');
    expect(errRow?.textContent).toContain("聊天：network");
    expect(errRow?.textContent).toContain("建议 2 秒后重试");
    expect(errRow?.querySelector(".guild-chat-retry-inline")).toBeTruthy();
    expect(errRow?.querySelector(".guild-chat-backoff-retry")).toBeTruthy();
    expect(mount.querySelector('[data-role="chat-refresh-status"]')?.textContent).toContain("刷新失败");
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
    expect(mount.querySelector('[data-role="guild-refresh-status-text"]')?.textContent).toContain(
      "上次刷新",
    );

    panels.toggleChat();
    const channel = mount.querySelector('[data-field="channel"]') as HTMLSelectElement;
    channel.value = "1";
    (mount.querySelector('[data-field="chat-content"]') as HTMLInputElement).value = "hi";
    mount.querySelector('[data-action="send-chat"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(statuses.some((s) => s.includes("禁言") && s.includes("61006"))).toBe(true);
  });

  it("restores guild chat draft after closing and reopening chat panel (CLIENT-160)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营" },
        members: [{ display_name: "副官乙", role: 2, power: 9000, player_id: 10002 }],
      }),
      listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="toggle-guild-role-group"][data-role-key="2"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    mount
      .querySelector('[data-action="guild-mention"][data-display-name="副官乙"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect((mount.querySelector('[data-field="chat-content"]') as HTMLInputElement).value).toBe("@副官乙 ");
    expect(sessionStorage.getItem("guild-chat-draft-v1")).toBe("@副官乙 ");
    panels.toggleChat();
    panels.toggleChat();
    expect((mount.querySelector('[data-field="chat-content"]') as HTMLInputElement).value).toBe("@副官乙 ");
    expect(mount.querySelector('[data-role="chat-input-counter"]')?.textContent).toBe("@副官乙 ".length + "/500");
  });

  it("fills guild chat draft and opens chat panel when mentioning a member", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营" },
        members: [
          { display_name: "副官乙", role: 2, power: 9000, player_id: 10002 },
          { display_name: "演示君主", role: 1, power: 12800, player_id: 10001 },
        ],
      }),
      sendChatMessage: vi.fn(),
      listChatMessages: vi.fn().mockResolvedValue({ messages: [] }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="toggle-guild-role-group"][data-role-key="2"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    const mentionBtn = mount.querySelector(
      '[data-action="guild-mention"][data-display-name="副官乙"]',
    ) as HTMLButtonElement;
    expect(mentionBtn?.textContent).toBe("提到");
    mentionBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    const chatPanel = mount.querySelector(".social-panel:not(.hidden)");
    expect(chatPanel?.querySelector("h3")?.textContent).toBe("聊天");
    const channel = mount.querySelector('[data-field="channel"]') as HTMLSelectElement;
    expect(channel.value).toBe("3");
    const content = mount.querySelector('[data-field="chat-content"]') as HTMLInputElement;
    expect(content.value).toBe("@副官乙 ");
    expect(gateway.sendChatMessage).not.toHaveBeenCalled();
  });

  it("renders role chips and collapses non-leader groups by default (CLIENT-101)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营" },
        members: [
          { display_name: "团长甲", role: 1, power: 1, player_id: 1 },
          { display_name: "官员乙", role: 2, power: 2, player_id: 2 },
          { display_name: "成员丙", role: 3, power: 3, player_id: 3 },
        ],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelectorAll('[data-role="guild-role-chip"]')).toHaveLength(1);
    expect(mount.querySelector('[data-role="guild-role-chip"]')?.textContent).toBe("团长");
    const primary = mount.querySelector('[data-role="guild-member-primary"]');
    expect(primary?.querySelector(".guild-member-nick")?.textContent).toBe("团长甲");
    expect(primary?.querySelector('[data-role="guild-role-chip"]')?.textContent).toBe("团长");
    expect(mount.querySelector('[data-action="toggle-guild-role-group"][data-role-key="2"]')?.textContent).toContain(
      "官员",
    );
    const officerToggle = mount.querySelector(
      '[data-action="toggle-guild-role-group"][data-role-key="2"]',
    );
    expect(officerToggle?.getAttribute("aria-label")).toBe("▶ 官员 · 1 人");
    expect(
      officerToggle?.parentElement?.querySelector('[data-role="guild-role-group-count"]')?.textContent,
    ).toBe("1");
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("▼ 团长 · 1 人");
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("在线");
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("巩固再加深一层");
    expect(
      mount.querySelector(".guild-duty-header-residual-deepest-line"),
    ).toBeTruthy();
    expect(
      mount.querySelector(".guild-duty-header-residual-deepest-deepest-deeper-line"),
    ).toBeTruthy();
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("巩固再加深三层");
    expect(
      mount.querySelector(".guild-duty-header-residual-deepest-deepest-deepest-line"),
    ).toBeTruthy();
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("巩固再加深四层");
    expect(
      mount.querySelector(".guild-duty-header-residual-deepest-deepest-deepest-deeper-line"),
    ).toBeTruthy();
    expect(
      mount.querySelector('[data-role="guild-role-group-header-line"]')?.textContent,
    ).toContain("巩固再加深五层");
    mount
      .querySelector('[data-action="toggle-guild-role-group"][data-role-key="2"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    mount
      .querySelector('[data-action="toggle-guild-role-group"][data-role-key="3"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(mount.querySelectorAll(".guild-member-row")).toHaveLength(3);
    expect(mount.querySelectorAll('[data-action="guild-mention"]')).toHaveLength(3);
  });

  it("does not show mention buttons before joining a guild", () => {
    const mount = document.createElement("div");
    const panels = new SocialPanels(mount, minimalGateway(), () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    expect(mount.querySelector('[data-action="guild-mention"]')).toBeNull();
  });

  it("renders chat-unread-separator and keeps badge until mark read (CLIENT-161 + CLIENT-185)", async () => {
    const mount = document.createElement("div");
    const tracker = new ChatUnreadTracker(null);
    tracker.markChannelRead("world", 1_000);
    const gateway = minimalGateway({
      listChatMessages: vi.fn().mockResolvedValue({
        messages: [
          {
            channel: 1,
            sender_display_name: "旧",
            sender_player_id: 10001,
            content: "read",
            sent_at_ms: 1_000,
          },
          {
            channel: 1,
            sender_display_name: "新",
            sender_player_id: 10002,
            content: "unread",
            sent_at_ms: 5_000,
          },
        ],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {}, tracker);
    panels.attach();
    panels.toggleChat();
    await flushPromises();
    const separator = mount.querySelector(".chat-unread-separator");
    expect(separator).toBeTruthy();
    expect(separator?.classList.contains("guild-chat-unread-separator")).toBe(true);
    expect(separator?.classList.contains("guild-chat-unread-divider-residual-sweep")).toBe(true);
    expect(separator?.classList.contains("guild-chat-unread-divider-residual-deep-sweep")).toBe(
      true,
    );
    expect(separator?.classList.contains("guild-chat-unread-divider-residual-deeper-sweep")).toBe(
      true,
    );
    expect(separator?.classList.contains("guild-chat-unread-divider-residual-deepest-sweep")).toBe(
      true,
    );
    expect(
      separator?.classList.contains("guild-chat-unread-divider-residual-deepest-deeper-sweep"),
    ).toBe(true);
    expect(
      separator?.classList.contains("guild-chat-unread-divider-residual-deepest-deepest-deeper-sweep"),
    ).toBe(true);
    expect(
      separator?.classList.contains("guild-chat-unread-divider-residual-deepest-deepest-deepest-sweep"),
    ).toBe(true);
    expect(
      separator?.classList.contains(
        "guild-chat-unread-divider-residual-deepest-deepest-deepest-deeper-sweep",
      ),
    ).toBe(true);
    expect(separator?.textContent).toBe("1 条未读");
    const unreadRow = mount.querySelector(".chat-log li.chat-msg:last-child");
    expect(unreadRow?.classList.contains("guild-chat-unread-first-msg-sweep-ring")).toBe(true);
    expect(unreadRow?.classList.contains("guild-chat-unread-first-msg-deep-sweep-ring")).toBe(
      true,
    );
    expect(unreadRow?.classList.contains("guild-chat-unread-first-msg-deeper-sweep-ring")).toBe(
      true,
    );
    expect(mount.querySelector('[data-role="chat-mark-read"]')?.classList.contains("hidden")).toBe(
      false,
    );
    const badge = mount.querySelector('[data-role="chat-tab-badge-1"]');
    expect(badge?.textContent).toBe("1");
    mount.querySelector('[data-action="mark-chat-read"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector(".chat-unread-separator")).toBeNull();
    expect(badge?.classList.contains("hidden")).toBe(true);
  });

  it("syncs chat tab badge after manual refresh (CLIENT-144 + CLIENT-102)", async () => {
    const mount = document.createElement("div");
    const tracker = new ChatUnreadTracker(null);
    const gateway = minimalGateway({
      listChatMessages: vi.fn().mockResolvedValue({
        messages: [
          {
            channel: 1,
            sender_display_name: "新消息",
            sender_player_id: 10002,
            content: "hi",
            sent_at_ms: 9_000,
          },
        ],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {}, tracker);
    panels.attach();
    panels.toggleChat();
    await flushPromises();
    const badge = mount.querySelector('[data-role="chat-tab-badge-1"]');
    expect(badge?.textContent).toBe("1");
    expect(badge?.classList.contains("hidden")).toBe(false);
    expect(sessionStorage.getItem(CHAT_PANEL_LAST_REFRESH_SESSION_KEY)).toBeTruthy();
  });

  it("persists guild refresh stamp in session (CLIENT-144)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营" },
        members: [{ display_name: "甲", role: 1, power: 1 }],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(sessionStorage.getItem(GUILD_PANEL_LAST_REFRESH_SESSION_KEY)).toBeTruthy();
  });

  it("shows guild member refresh error via formatSocialPanelRefreshError", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi
        .fn()
        .mockResolvedValueOnce({ guild: { name: "虎贲营" }, members: [] })
        .mockRejectedValueOnce(new Error("gateway down")),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('[data-action="refresh-members"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector('[data-role="guild-refresh-status-text"]')?.textContent).toContain(
      "刷新失败：gateway down",
    );
    expect(mount.querySelector('[data-role="guild-refresh-retry"]')?.classList.contains("hidden")).toBe(
      false,
    );
    const guildListErr = mount.querySelector(
      '.guild-members [data-panel-state="error"]',
    );
    expect(guildListErr?.textContent).toContain("军团：");
    expect(
      guildListErr?.querySelector('[data-action="retry-refresh-members"]'),
    ).toBeTruthy();
    expect(guildListErr?.querySelector(".guild-chat-retry-inline")).toBeTruthy();
  });

  it("shows guild member online summary after refresh (CLIENT-217)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      createGuild: vi.fn().mockResolvedValue({ guild: { guild_id: 7001, name: "虎贲营" } }),
      listGuildMembers: vi.fn().mockResolvedValue({
        guild: { name: "虎贲营", member_count: 4, online_count: 2 },
        total_count: 4,
        members: [
          { display_name: "甲", role: 1, is_online: true },
          { display_name: "乙", role: 2, is_online: true },
        ],
      }),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleGuild();
    (mount.querySelector('[data-field="guild-name"]') as HTMLInputElement).value = "虎贲营";
    mount.querySelector('[data-action="create-guild"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const summary = mount.querySelector('[data-role="guild-member-online-summary"]');
    expect(summary?.classList.contains("hidden")).toBe(false);
    expect(summary?.textContent).toBe("在线 2 / 共 4 人");
  });

  it("shows chat refresh gateway error with guild-chat-retry-inline (CLIENT-200)", async () => {
    const mount = document.createElement("div");
    const gateway = minimalGateway({
      listChatMessages: vi
        .fn()
        .mockRejectedValueOnce(Object.assign(new Error("已被禁言"), { code: 61006 })),
    });
    const panels = new SocialPanels(mount, gateway, () => baseSession(), () => {});
    panels.attach();
    panels.toggleChat();
    await flushPromises();
    const errRow = mount.querySelector('.chat-log [data-panel-state="error"]');
    expect(errRow?.textContent).toContain("聊天：已被禁言 [61006]");
    const inlineRetry = errRow?.querySelector(".guild-chat-retry-inline");
    expect(inlineRetry?.getAttribute("data-action")).toBe("retry-refresh-chat");
    expect(inlineRetry?.classList.contains("hidden")).toBe(false);
    gateway.listChatMessages = vi.fn().mockResolvedValue({ messages: [] });
    inlineRetry?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.listChatMessages).toHaveBeenCalled();
  });
});
