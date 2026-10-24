import { describe, expect, it } from "vitest";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";
import { dailyToolbarBadgeCount } from "@/net/hudTodoBadges";
import {
  DAILY_CHAIN_TAB_SESSION_KEY,
  dailyChainTabClaimableMatchesHud,
  dailyQuestRowsForChain,
  findFirstInProgressQuestIndex,
  pickDailyChainTabs,
  pickFirstInProgressDailyQuestCfgId,
  readDailyChainTabSession,
  resolveActiveDailyChainTab,
  writeDailyChainTabSession,
} from "@/net/dailyQuestChainTab";

describe("dailyQuestChainTab", () => {
  const storage = {
    data: {} as Record<string, string>,
    getItem(k: string) {
      return this.data[k] ?? null;
    },
    setItem(k: string, v: string) {
      this.data[k] = v;
    },
  };

  it("persists tab in sessionStorage key daily-chain-tab-v1", () => {
    writeDailyChainTabSession(401, storage);
    expect(storage.data[DAILY_CHAIN_TAB_SESSION_KEY]).toBe("401");
    expect(readDailyChainTabSession(storage)).toBe(401);
  });

  it("pickDailyChainTabs hides empty chains", () => {
    const rows: DailyQuestRow[] = [
      { quest_cfg_id: 1012, chain_id: 400, state: 2 },
      { quest_cfg_id: 2001, chain_id: 401, state: 1 },
    ];
    const tabs = pickDailyChainTabs(rows);
    expect(tabs.map((t) => t.chainId)).toEqual([400, 401]);
    const only400 = pickDailyChainTabs([{ quest_cfg_id: 1012, chain_id: 400, state: 1 }]);
    expect(only400.map((t) => t.chainId)).toEqual([400]);
  });

  it("resolveActiveDailyChainTab falls back when preferred chain empty", () => {
    const rows: DailyQuestRow[] = [{ quest_cfg_id: 1012, chain_id: 400, state: 1 }];
    expect(resolveActiveDailyChainTab(rows, 401)).toBe(400);
    expect(resolveActiveDailyChainTab(rows, 400)).toBe(400);
  });

  it("findFirstInProgressQuestIndex uses progress_current < progress_target", () => {
    const rows: DailyQuestRow[] = [
      { quest_cfg_id: 1, progress_current: 10, progress_target: 10, state: 3 },
      { quest_cfg_id: 2, progress_current: 3, progress_target: 10, state: 2 },
      { quest_cfg_id: 3, progress_current: 1, progress_target: 5, state: 2 },
    ];
    expect(findFirstInProgressQuestIndex(rows)).toBe(1);
    expect(pickFirstInProgressDailyQuestCfgId(rows)).toBe(2);
    expect(findFirstInProgressQuestIndex([rows[0]])).toBe(-1);
  });

  it("chain 400 claimable chip matches HUD toolbar (CLIENT-162)", () => {
    const rows: DailyQuestRow[] = [
      { quest_cfg_id: 1012, chain_id: 400, state: 3 },
      { quest_cfg_id: 1013, chain_id: 400, state: 2 },
      { quest_cfg_id: 2100, chain_id: 401, state: 3 },
    ];
    const chain400 = dailyQuestRowsForChain(rows, DAILY_QUEST_CHAIN_ID);
    const hud = dailyToolbarBadgeCount(chain400);
    expect(dailyChainTabClaimableMatchesHud(rows, 400, hud)).toBe(true);
    expect(dailyChainTabClaimableMatchesHud(rows, 401, hud)).toBe(true);
    expect(dailyChainTabClaimableMatchesHud(rows, 400, hud + 1)).toBe(false);
  });
});
