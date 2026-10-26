// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatQuestLine, formatWalletPrice, itemLabel } from "@/net/contentFormat";

describe("contentFormat", () => {
  it("labels core subset items", () => {
    expect(itemLabel(2001)).toContain("谷袋");
    expect(itemLabel(9999)).toBe("道具#9999");
  });

  it("uses canonical DATA-002 names only where established UI labels are absent", () => {
    const catalog = JSON.parse(readFileSync(new URL("../../../internal/content/seed/catalog.json", import.meta.url), "utf8"));
    const established = new Set([2001, 2002, 2003, 2004, 2005, 2006, 2017, 2020]);
    for (const item of catalog.items) if (!established.has(item.item_cfg_id)) expect(itemLabel(item.item_cfg_id)).toBe(item.name);
    expect(itemLabel(2001)).toBe("谷袋·初备");
    expect(itemLabel(2002)).toBe("木料捆·初备");
    expect(itemLabel(2007)).toBe("常备粮垛");
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
