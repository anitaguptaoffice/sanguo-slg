import { describe, expect, it } from "vitest";
import { LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import {
  LEADERBOARD_RETURN_SCROLL_SESSION_KEY,
  applyRankPanelScrollTop,
  parseLeaderboardReturnScrollSession,
  readLeaderboardReturnScroll,
  readRankPanelScrollTop,
  writeLeaderboardReturnScroll,
} from "@/net/leaderboardReturnScroll";

describe("leaderboardReturnScroll session", () => {
  it("round-trips boardType and scrollTop", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    };
    writeLeaderboardReturnScroll({ boardType: LB_PLAYER_RESOURCE, scrollTop: 120 }, mock);
    expect(readLeaderboardReturnScroll(mock)).toEqual({
      boardType: LB_PLAYER_RESOURCE,
      scrollTop: 120,
    });
    expect(storage.get(LEADERBOARD_RETURN_SCROLL_SESSION_KEY)).toContain("120");
  });

  it("parse rejects invalid payload", () => {
    expect(parseLeaderboardReturnScrollSession("")).toBeNull();
    expect(parseLeaderboardReturnScrollSession('{"boardType":0,"scrollTop":1}')).toBeNull();
    expect(parseLeaderboardReturnScrollSession('{"boardType":2,"scrollTop":-1}')).toBeNull();
  });
});

describe("rankPanel scroll helpers", () => {
  it("reads and applies scrollTop on rank-table-scroll when it overflows", () => {
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="panel-scroll-body" data-role="rank-scroll" style="height:40px;overflow:auto">
        <div class="rank-table-scroll" style="height:30px;overflow:auto">
          <div style="height:200px"></div>
        </div>
      </div>
    `;
    const tableScroll = panel.querySelector(".rank-table-scroll") as HTMLElement;
    Object.defineProperty(tableScroll, "scrollHeight", { value: 200, configurable: true });
    Object.defineProperty(tableScroll, "clientHeight", { value: 30, configurable: true });
    tableScroll.scrollTop = 88;
    expect(readRankPanelScrollTop(panel)).toBe(88);
    applyRankPanelScrollTop(panel, 44);
    expect(tableScroll.scrollTop).toBe(44);
  });
});
