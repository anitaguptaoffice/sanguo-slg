import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ContentPanels } from "./ContentPanels";

beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());
function setup(itemId = 2001) {
  const session: MainCitySession = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { food: 100 }, buildings: [], cityTroops: [], bag: [{ item_cfg_id: itemId, quantity: 3 }] };
  const use = vi.fn().mockResolvedValue({ remaining: 2, wallet_after: { food: 1100 } });
  const gateway = { getBoundServerId: () => 1, listPlayerBag: async () => ({ items: session.bag }), useConsumable: use } as unknown as GatewayPort;
  const mount = document.createElement("div");
  const panels = new ContentPanels(mount, gateway, () => session, p => Object.assign(session, p), vi.fn());
  panels.attach();
  panels.openBagWithDeepLink({ highlightItemId: itemId, returnHeroId: 7 }, "hero");
  return { session, use, mount, panels };
}

describe("bag direct-use capability safety", () => {
  it.each([2004, 2005, 2006, 2012, 2013, 2014, 2037, 2038, 2039, 2040, 2041, 9999])(
    "does not offer or send single/batch use for unsupported #%i", async id => {
      const { mount, use } = setup(id);
      await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
      for (const action of ["use-item", "use-item-batch"]) {
        const button = mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
        expect(button.disabled).toBe(true);
        button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      expect(mount.querySelector('[data-role="bag-slot-checkbox"]')).toBeNull();
      expect(mount.querySelector('[data-role="bag-use-capability"]')?.textContent).toContain("未提交，不会扣除");
      expect(mount.querySelector('[data-role="bag-use-capability"]')?.classList.contains("panel-feedback")).toBe(true);
      expect(use).not.toHaveBeenCalled();
    });
  it.each([2001, 2002, 2003, 2007, 2011, 2035, 2036, 2049])("preserves supported #%i", async id => {
    const { mount, use } = setup(id);
    await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
    mount.querySelector<HTMLButtonElement>('[data-action="use-item"]')!.click();
    expect(use).toHaveBeenCalledWith(1, id, 1);
  });
  it("keeps the existing return-to-hero route", async () => {
    const { panels, mount } = setup(2004);
    const back = vi.fn(); panels.setBagReturnHeroDetailHandler(back);
    await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
    mount.querySelector<HTMLButtonElement>('[data-action="bag-return-hero"]')!.click();
    expect(back).toHaveBeenCalledWith(7);
  });
});
