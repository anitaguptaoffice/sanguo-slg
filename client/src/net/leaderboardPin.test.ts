import { describe, expect, it } from "vitest";
import {
  LEADERBOARD_PIN_SESSION_KEY,
  applyLeaderboardPinAfterRefresh,
  captureLeaderboardPinBeforeRefresh,
  parseLeaderboardPinSession,
  readLeaderboardPin,
  shouldDeferPinApplyForReturnScroll,
  writeLeaderboardPin,
} from "@/net/leaderboardPin";
import { LB_PLAYER_POWER } from "@/net/leaderboardFormat";

describe("leaderboardPin", () => {
  it("round-trips boardType and scrollTop via leaderboard-pin-v1", () => {
    const storage = {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
    };
    writeLeaderboardPin({ boardType: LB_PLAYER_POWER, scrollTop: 88 }, storage);
    expect(readLeaderboardPin(storage)).toEqual({ boardType: LB_PLAYER_POWER, scrollTop: 88 });
    expect(storage.getItem(LEADERBOARD_PIN_SESSION_KEY)).toContain("88");
  });

  it("parseLeaderboardPinSession rejects invalid payloads", () => {
    expect(parseLeaderboardPinSession(null)).toBeNull();
    expect(parseLeaderboardPinSession("{}")).toBeNull();
    expect(parseLeaderboardPinSession(JSON.stringify({ boardType: 0, scrollTop: 1 }))).toBeNull();
  });

  it("captureLeaderboardPinBeforeRefresh reads rank scroll container", () => {
    const storage = {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
    };
    const rankPanel = document.createElement("div");
    rankPanel.innerHTML = `<div class="panel-scroll-body" data-role="rank-scroll" style="height:40px;overflow:auto"><div style="height:200px"></div></div>`;
    const scroll = rankPanel.querySelector('[data-role="rank-scroll"]') as HTMLElement;
    scroll.scrollTop = 55;
    captureLeaderboardPinBeforeRefresh(rankPanel, LB_PLAYER_POWER, storage);
    expect(readLeaderboardPin(storage)?.scrollTop).toBe(55);
  });

  it("applyLeaderboardPinAfterRefresh restores scroll and clears session", () => {
    const storage = {
      store: new Map<string, string>(),
      getItem(k: string) {
        return this.store.get(k) ?? null;
      },
      setItem(k: string, v: string) {
        this.store.set(k, v);
      },
      removeItem(k: string) {
        this.store.delete(k);
      },
    };
    writeLeaderboardPin({ boardType: LB_PLAYER_POWER, scrollTop: 42 }, storage);
    const rankPanel = document.createElement("div");
    rankPanel.innerHTML = `<div data-role="rank-scroll" style="height:40px;overflow:auto"><div style="height:200px"></div></div>`;
    applyLeaderboardPinAfterRefresh(rankPanel, LB_PLAYER_POWER, storage);
    const scroll = rankPanel.querySelector('[data-role="rank-scroll"]') as HTMLElement;
    expect(scroll.scrollTop).toBe(42);
    expect(readLeaderboardPin(storage)).toBeNull();
  });

  it("shouldDeferPinApplyForReturnScroll when hero return pending", () => {
    expect(shouldDeferPinApplyForReturnScroll({ boardType: LB_PLAYER_POWER, scrollTop: 1 }, LB_PLAYER_POWER)).toBe(
      true,
    );
    expect(shouldDeferPinApplyForReturnScroll(null, LB_PLAYER_POWER)).toBe(false);
  });
});
