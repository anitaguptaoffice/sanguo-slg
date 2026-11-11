import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import { appendDailyQuestRowSecondary, formatDailyQuestRewardLine } from "@/net/dailyQuestProgressFormat";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { mountDailyRewardIcon } from "./dailyRewardIcon";

describe("independent daily reward icons", () => {
  beforeEach(() => { document.body.innerHTML = ""; });
  function setup(q: DailyQuestRow, available = true, scale = 1) {
    const frame = document.createElement("div"); frame.dataset.artSkin = "on";
    const panel = document.createElement("div"), row = document.createElement("li");
    frame.append(panel); panel.append(row); document.body.append(frame);
    appendDailyQuestRowSecondary(row, q);
    const getImageForAsset = vi.fn((id: string) => {
      if (!available || !/^item.icon.20[0-4][0-9].v1$/.test(id)) return undefined;
      const img = document.createElement("img"); img.src = `/assets/art/v1/textures/${scale}x/items/${id.split(".")[2]}.png`;
      return { img, meta: { id, kind: "icon" }, scale };
    });
    const assets = { getImageForAsset } as unknown as AssetLoader;
    const mount = () => mountDailyRewardIcon(row, q, panel, assets);
    return { frame, panel, row, assets, mount, getImageForAsset };
  }
  it.each([[1014, 2003], [1032, 2011], [1033, 2042]])("uses the existing fallback %s", (quest_cfg_id, item) => {
    const q = { quest_cfg_id }, s = setup(q); s.mount();
    const img = s.row.querySelector("img")!;
    expect(img.getAttribute("src")).toContain(`/${item}.png`);
    expect(s.row.textContent).toContain(formatDailyQuestRewardLine(q));
    expect(img.width).toBe(20); expect(img.height).toBe(20);
    expect(img.alt).toBe(""); expect(img.getAttribute("aria-hidden")).toBe("true");
  });
  it.each([["daily_train_1", 2003], ["daily_build_1", 2011], ["daily_march_1", 2042]])("shares code fallback %s without changing its label", (quest_code, item) => {
    const q = { quest_code }, s = setup(q), text = s.row.textContent; s.mount();
    expect(s.getImageForAsset).toHaveBeenCalledWith(`item.icon.${item}.v1`);
    expect(s.row.textContent).toBe(text);
  });
  it("rejects a cache entry with a different identity or kind", () => {
    for (const meta of [{ id: "item.icon.2004.v1", kind: "icon" }, { id: "item.icon.2003.v1", kind: "panel" }]) {
      const q = { quest_cfg_id: 1014 }, s = setup(q), img = document.createElement("img"); img.src = "/wrong.png";
      mountDailyRewardIcon(s.row, q, s.panel, { getImageForAsset: () => ({ img, meta, scale: 1 }) } as unknown as AssetLoader);
      expect(s.row.querySelector("img")).toBeNull();
    }
  });
  it("uses snapshot identity over fallback and the selected DPR cache", () => {
    const s = setup({ quest_cfg_id: 1014, reward_item_id: 2002, quantity: 3 }, true, 2); s.mount();
    expect(s.getImageForAsset).toHaveBeenCalledWith("item.icon.2002.v1");
    expect(s.row.querySelector("img")?.src).toContain("/2x/items/2002.png");
  });
  it.each([{}, { reward_item_id: 2003.5, quantity: 1 }, { reward_item_id: Infinity, quantity: 1 }, { reward_item_id: 9999, quantity: 1 }])("preserves text when no valid decoration exists", q => {
    const s = setup(q), text = s.row.textContent; s.mount();
    expect(s.row.querySelector("img")).toBeNull(); expect(s.row.textContent).toBe(text);
  });
  it("handles absent cache/loader and broken image without touching text", () => {
    const q = { quest_cfg_id: 1014 }, missing = setup(q, false); missing.mount();
    mountDailyRewardIcon(missing.row, q, missing.panel); expect(missing.row.querySelector("img")).toBeNull();
    const s = setup(q), text = s.row.textContent; s.mount(); s.row.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(s.row.querySelector("img")).toBeNull(); expect(s.row.textContent).toBe(text);
  });
  it("keeps one decoration/style across refresh and restores after skin-off redraw", () => {
    const s = setup({ quest_cfg_id: 1014 }); s.mount(); s.mount();
    expect(s.row.querySelectorAll("img")).toHaveLength(1); expect(s.panel.querySelectorAll("style")).toHaveLength(1);
    s.frame.dataset.artSkin = "off"; expect(getComputedStyle(s.row.querySelector("img")!).display).toBe("none");
    s.mount(); expect(getComputedStyle(s.row.querySelector("img")!).display).toBe("none");
    s.frame.dataset.artSkin = "on"; expect(getComputedStyle(s.row.querySelector("img")!).display).not.toBe("none");
  });
});
