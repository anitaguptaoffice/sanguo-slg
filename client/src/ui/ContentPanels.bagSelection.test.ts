import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ContentPanels } from "./ContentPanels";

beforeEach(() => sessionStorage.clear());
async function setup() {
  let session: MainCitySession = { serverId: 1, cityId: 1, cityName: "城", player: { player_id: 1 },
    wallet: { food: 100 }, buildings: [], cityTroops: [], bag: [
      { item_cfg_id: 2001, quantity: 1 }, { item_cfg_id: 2002, quantity: 2 },
      { item_cfg_id: 2004, quantity: 1 }, { item_cfg_id: 2005, quantity: 1 },
      { item_cfg_id: 2007, quantity: 1 }, { item_cfg_id: 9999, quantity: 1 }] };
  const use = vi.fn(async (_sid: number, id: number, count: number) => ({
    remaining: (session.bag.find(row => row.item_cfg_id === id)?.quantity ?? 0) - count,
    wallet_after: { food: 1100 },
  }));
  const list = vi.fn(async () => ({ items: session.bag }));
  const gateway = { getBoundServerId: () => 1, listPlayerBag: list, useConsumable: use } as unknown as GatewayPort;
  const mount = document.createElement("div"), back = vi.fn();
  const panels = new ContentPanels(mount, gateway, () => session, p => Object.assign(session, p), vi.fn());
  panels.attach(); panels.setBagReturnHeroDetailHandler(back); panels.toggleBag();
  await vi.waitFor(() => expect(mount.querySelectorAll(".bag-stack-row").length).toBe(6));
  const select = mount.querySelector<HTMLSelectElement>('[data-field="item-id"]')!;
  const choose = (id: number) => {
    expect([...select.options].some(option => option.value === String(id))).toBe(true);
    select.value = String(id); select.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const click = (action: string) => mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const count = (value: number) => { mount.querySelector<HTMLInputElement>('[data-field="use-count"]')!.value = String(value); };
  return { session: () => session, switchActor: () => { session = { ...session, player: { player_id: 2 }, bag: [{ item_cfg_id: 2002, quantity: 9 }] }; },
    use, list, mount, panels, back, select, choose, click, count };
}

describe("owned bag native selection", () => {
  it("offers owned IDs plus existing defaults, with stable labels and counts", async () => {
    const f = await setup();
    expect([...f.select.options].map(o => o.value)).toEqual(["2001", "2002", "2003", "2004", "2005", "2007", "2020", "9999"]);
    expect(f.select.querySelector('[value="2002"]')?.textContent).toBe("2002 木料捆·初备 · 持有 2");
    expect(f.select.querySelector('[value="2007"]')?.textContent).toBe("2007 常备粮垛 · 持有 1");
    expect(f.mount.querySelector('[data-item-cfg-id="2007"] .bag-stack-name')?.textContent).toBe("常备粮垛");
  });
  it.each([[2007, 1], [2002, 2]])("submits natively selected #%i with count %i and preserves depleted selection", async (id, count) => {
    const f = await setup(); f.choose(id); f.count(count); f.click("use-item");
    await vi.waitFor(() => expect(f.select.selectedOptions[0].textContent).toContain("持有 0"));
    expect(f.use).toHaveBeenCalledWith(1, id, count); expect(f.select.value).toBe(String(id));
    expect(f.mount.querySelector(`[data-item-cfg-id="${id}"]`)).toBeNull();
    f.click("use-item"); expect(f.use).toHaveBeenCalledTimes(1);
    expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("背包中没有");
  });
  it("refreshes quantities and removes stale nonselected options without retargeting selection", async () => {
    const f = await setup(); f.choose(2007);
    f.list.mockResolvedValueOnce({ items: [{ item_cfg_id: 2002, quantity: 4 }, { item_cfg_id: 2008, quantity: 1 }] });
    f.click("refresh-bag");
    await vi.waitFor(() => expect(f.select.querySelector('[value="2008"]')).not.toBeNull());
    expect(f.select.value).toBe("2007"); expect(f.select.selectedOptions[0].textContent).toContain("持有 0");
    expect(f.select.querySelector('[value="2004"]')).toBeNull();
    expect(f.select.querySelector('[value="2002"]')?.textContent).toContain("持有 4");
    f.choose(2002); expect(f.select.querySelector('[value="2007"]')).toBeNull();
  });
  it.each([0, -1, 1.5, 3])("rejects invalid or excessive count %s for selected owned stock", async count => {
    const f = await setup(); f.choose(2002); f.count(count); f.click("use-item");
    expect(f.use).not.toHaveBeenCalled(); expect(f.mount.querySelector('[data-role="bag-form-error"]')?.textContent).toContain("数量");
  });
  it.each([2004, 2005, 9999])("keeps selected unsupported #%i disabled with guidance and hero return", async id => {
    const f = await setup(); f.panels.openBagWithDeepLink({ highlightItemId: 2001, returnHeroId: 7 }, "hero"); f.choose(id);
    for (const action of ["use-item", "use-item-batch"]) expect(f.mount.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)?.disabled).toBe(true);
    expect(f.mount.querySelector('[data-role="bag-use-capability"]')?.textContent).toContain("未提交，不会扣除");
    expect(f.mount.querySelector('[data-role="bag-slot-checkbox"]')).toBeNull();
    f.click("bag-return-hero"); expect(f.back).toHaveBeenCalledWith(7); expect(f.use).not.toHaveBeenCalled();
  });
  it("uses batch slots belonging to the newly selected owned item", async () => {
    const f = await setup(); f.choose(2002);
    for (const box of f.mount.querySelectorAll<HTMLInputElement>('[data-role="bag-slot-checkbox"]')) {
      box.checked = true; box.dispatchEvent(new Event("change", { bubbles: true }));
    }
    f.click("use-item-batch"); await vi.waitFor(() => expect(f.select.selectedOptions[0].textContent).toContain("持有 0"));
    expect(f.use.mock.calls).toEqual([[1, 2002, 1], [1, 2002, 1]]);
  });
  it.each([false, true])("keeps async ownership and duplicate protection while selection changes (actor=%s)", async actor => {
    const f = await setup(); let resolve!: (value: { remaining: number; wallet_after: { food: number } }) => void;
    f.use.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    f.choose(2007); f.click("use-item"); f.choose(2002); f.click("use-item"); f.click("use-item-batch");
    expect(f.use.mock.calls).toEqual([[1, 2007, 1]]);
    if (actor) { f.switchActor(); f.click("refresh-bag"); await vi.waitFor(() => expect(f.select.selectedOptions[0].textContent).toContain("持有 9")); }
    resolve({ remaining: 0, wallet_after: { food: 1100 } });
    for (let i = 0; i < 12; i++) await Promise.resolve();
    expect(f.select.value).toBe("2002"); expect(f.use).toHaveBeenCalledTimes(1);
    expect(f.session().wallet?.food).toBe(actor ? 100 : 1100);
    expect(f.select.selectedOptions[0].textContent).toContain(actor ? "持有 9" : "持有 2");
  });
});
