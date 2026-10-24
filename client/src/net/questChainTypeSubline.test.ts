import { describe, expect, it } from "vitest";
import { formatQuestChainTypeSubline } from "@/net/questChainTypeSubline";

describe("formatQuestChainTypeSubline (CLIENT-218)", () => {
  it("returns chain label and progress for claimable rows", () => {
    expect(
      formatQuestChainTypeSubline({
        quest_cfg_id: 1013,
        chain_id: 400,
        state: 3,
        progress_current: 3,
        progress_target: 4,
      }),
    ).toBe("主线 · 链进度 3/4 · 可领取");
    expect(
      formatQuestChainTypeSubline({
        quest_cfg_id: 2001,
        chain_id: 401,
        state: 3,
        progress_current: 0,
        progress_target: 0,
      }),
    ).toBe("支线");
  });

  it("returns null for non-claimable rows", () => {
    expect(
      formatQuestChainTypeSubline({
        quest_cfg_id: 1014,
        chain_id: 400,
        state: 2,
        progress_current: 1,
        progress_target: 2,
      }),
    ).toBeNull();
  });
});
