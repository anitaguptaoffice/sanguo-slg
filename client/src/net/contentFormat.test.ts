import { describe, expect, it } from "vitest";
import { formatQuestLine, formatWalletPrice, itemLabel } from "@/net/contentFormat";

describe("contentFormat", () => {
  it("labels core subset items", () => {
    expect(itemLabel(2001)).toContain("谷袋");
    expect(itemLabel(9999)).toBe("道具#9999");
  });

  it("formats quest line and price", () => {
    expect(
      formatQuestLine({
        quest_cfg_id: 1001,
        quest_code: "tutorial_build_hall",
        state: 2,
        progress_current: 1,
        progress_target: 2,
      }),
    ).toContain("进行中");
    expect(formatWalletPrice({ gold: 10 })).toBe("币10");
  });
});
