import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { ContentPanels } from "@/ui/ContentPanels";

function baseSession(): MainCitySession {
  return {
    serverId: 1,
    cityId: 1,
    cityName: "城",
    player: { player_id: 10001, display_name: "演示君主", power: 5000 },
    wallet: { food: 100, wood: 200, iron: 0, stone: 0, gold: 50 },
    buildings: [],
    cityTroops: [],
    bag: [],
  };
}

function minimalGateway(): GatewayPort {
  return {
    getBoundServerId: () => 1,
  } as unknown as GatewayPort;
}

describe("ContentPanels narrow scroll (CLIENT-095 + CLIENT-119)", () => {
  it("bag and shop panels have center-panel id and panel-scroll-body", () => {
    const mount = document.createElement("div");
    const panels = new ContentPanels(
      mount,
      minimalGateway(),
      () => baseSession(),
      () => {},
      () => {},
    );
    panels.attach();
    expect(mount.querySelector('[data-center-panel="bag"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="bag"] .panel-scroll-body')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="shop"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="shop"] .panel-scroll-body')).toBeTruthy();
    expect(mount.querySelector('[data-role="bag-wallet-gap"]')).toBeTruthy();
    expect(mount.querySelector('[data-role="shop-wallet-gap"]')).toBeTruthy();
    expect(mount.querySelector('[data-role="bag-category-tabs"]')).toBeTruthy();
  });

  it("CLIENT-153 bag category tabs filter list without RPC", async () => {
    sessionStorage.removeItem("bag-category-tab-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({
        items: [
          { item_cfg_id: 2001, quantity: 2 },
          { item_cfg_id: 2017, quantity: 1 },
        ],
      }),
    } as unknown as GatewayPort;
    const panels = new ContentPanels(
      mount,
      gateway,
      () => session,
      (patch) => Object.assign(session, patch),
      () => {},
    );
    panels.attach();
    panels.toggleBag();
    const list = () =>
      [...mount.querySelectorAll(".bag-stack-row")].map((li) =>
        li.getAttribute("data-item-cfg-id"),
      );
    await vi.waitFor(() => expect(list()).toEqual(["2001", "2017"]));
    const cultTab = mount.querySelector('[data-bag-category="cultivation"]') as HTMLButtonElement;
    cultTab.click();
    expect(list()).toEqual(["2017"]);
    expect(sessionStorage.getItem("bag-category-tab-v1")).toBe("cultivation");
  });

  it("resets bag scroll body when toggling open", () => {
    const mount = document.createElement("div");
    const panels = new ContentPanels(
      mount,
      minimalGateway(),
      () => baseSession(),
      () => {},
      () => {},
    );
    panels.attach();
    const body = mount.querySelector('[data-center-panel="bag"] .panel-scroll-body') as HTMLElement;
    body.scrollTop = 120;
    panels.toggleBag();
    panels.toggleBag();
    expect(body.scrollTop).toBe(0);
  });
});

describe("ContentPanels shop afford inline (CLIENT-154)", () => {
  it("shows purchase-area 缺少 line and disables buy when wallet insufficient", async () => {
    const mount = document.createElement("div");
    const listShopShelf = vi.fn().mockResolvedValue({
      offers: [
        {
          offer_id: 1001,
          shelf_name: "谷袋",
          item_cfg_id: 2001,
          quantity_per_purchase: 1,
          price_resources: { gold: 100 },
        },
      ],
    });
    const gateway = {
      getBoundServerId: () => 1,
      listShopShelf,
    } as unknown as GatewayPort;
    const panels = new ContentPanels(
      mount,
      gateway,
      () => ({ ...baseSession(), wallet: { gold: 5 } }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleShop();
    await vi.waitFor(() => expect(listShopShelf).toHaveBeenCalled());
    const gap = mount.querySelector('[data-role="shop-wallet-gap"]');
    expect(gap?.textContent).toMatch(/^缺少：/);
    expect(gap?.classList.contains("shop-afford-inline")).toBe(true);
    const buy = mount.querySelector('button[data-action="buy-offer"]') as HTMLButtonElement;
    expect(buy.disabled).toBe(true);
    const row = mount.querySelector(".shop-list li");
    expect(row?.textContent).toContain("缺少：");
  });
});
