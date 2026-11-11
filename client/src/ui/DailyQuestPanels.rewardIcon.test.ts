import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyQuestPanels } from "./DailyQuestPanels";
import type { AssetLoader } from "@/engine/AssetLoader";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";

const tick = () => new Promise(r => setTimeout(r, 0));
afterEach(() => { document.body.innerHTML = ""; sessionStorage.clear(); });
describe("daily panel reward decorations", () => {
  it("mounts real reward rows and preserves text, refresh and claim ownership", async () => {
    const frame = document.createElement("div"); frame.dataset.artSkin = "on"; document.body.append(frame);
    const gateway = { getBoundServerId: () => 1, listPlayerQuests: vi.fn().mockResolvedValue({ quests: [
      { quest_cfg_id: 1014, quest_code: "daily_train_1", chain_id: 400, state: 2, progress_target: 1, progress_current: 0 },
      { quest_cfg_id: 1032, quest_code: "daily_build_1", chain_id: 400, state: 2, progress_target: 1, progress_current: 0 },
    ] }), claimQuest: vi.fn() };
    const assets = { getArtMeta: () => undefined, getImageForAsset: vi.fn((id: string) => {
      if (!id.startsWith("item.icon.")) return undefined;
      const img = document.createElement("img"); img.src = `/assets/art/v1/textures/1x/items/${id.split(".")[2]}.png`;
      return { img, meta: { id, kind: "icon" }, scale: 1 };
    }) } as unknown as AssetLoader;
    const session = { serverId: 1, cityId: 1, cityName: "城", wallet: {}, buildings: [], cityTroops: [], bag: [] } as MainCitySession;
    const panels = new DailyQuestPanels(frame, gateway as unknown as GatewayPort, () => session, () => {}, () => {},
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, assets);
    panels.attach(); panels.toggle(); await tick(); await tick();
    const icons = () => frame.querySelectorAll<HTMLImageElement>(".daily-reward-item-icon");
    expect(icons()).toHaveLength(2);
    expect([...icons()].map(x => new URL(x.src).pathname)).toEqual(expect.arrayContaining([
      "/assets/art/v1/textures/1x/items/2003.png", "/assets/art/v1/textures/1x/items/2011.png",
    ]));
    const text = frame.querySelector('[data-role="daily-list"]')!.textContent;
    frame.dataset.artSkin = "off"; await panels.refreshChainList();
    expect(icons()).toHaveLength(2); expect(getComputedStyle(icons()[0]).display).toBe("none");
    frame.dataset.artSkin = "on"; expect(getComputedStyle(icons()[0]).display).not.toBe("none");
    await panels.refreshChainList(); expect(icons()).toHaveLength(2);
    expect(frame.querySelector('[data-role="daily-list"]')!.textContent).toBe(text);
    expect(gateway.claimQuest).not.toHaveBeenCalled();
    panels.toggle(); panels.toggle(); await tick(); expect(icons()).toHaveLength(2);
    panels.detach(); expect(frame.querySelectorAll(".daily-reward-item-icon")).toHaveLength(0);
  });
});
