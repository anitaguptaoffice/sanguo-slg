import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { PANEL_GATEWAY_RETRY_CLASS } from "@/net/panelGatewayError";
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
    expect(row?.querySelector(".shop-price-vs-wallet")?.textContent).toMatch(/现价/);
  });
});

describe("ContentPanels shop tab currency sweep (CLIENT-167)", () => {
  it("updates tab settlement wallet line when switching category tabs", async () => {
    const mount = document.createElement("div");
    const listShopShelf = vi.fn().mockResolvedValue({
      offers: [
        {
          offer_id: 1001,
          shelf_name: "谷袋",
          item_cfg_id: 2001,
          quantity_per_purchase: 1,
          price_resources: { gold: 10 },
        },
        {
          offer_id: 1022,
          shelf_name: "补给包",
          item_cfg_id: 2042,
          quantity_per_purchase: 2,
          price_resources: { food: 400 },
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
      () => ({ ...baseSession(), wallet: { gold: 50, food: 800 } }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleShop();
    await vi.waitFor(() => expect(listShopShelf).toHaveBeenCalled());
    const sweep = () => mount.querySelector('[data-role="shop-tab-currency-sweep"]');
    expect(sweep()?.textContent).toMatch(/本类余额：.*币 50/);
    const otherTab = mount.querySelector('[data-shop-category="other"]') as HTMLButtonElement;
    otherTab.click();
    expect(sweep()?.textContent).toMatch(/本类余额：.*粮 800/);
    expect(sweep()?.textContent).not.toMatch(/币 50/);
  });
});

describe("ContentPanels gateway list error (CLIENT-173)", () => {
  it("shop shelf failure shows prefixed error, empty filter stays empty", async () => {
    const mount = document.createElement("div");
    const listShopShelf = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("余额不足"), { code: 64003 }))
      .mockResolvedValueOnce({
        offers: [
          {
            offer_id: 1001,
            item_cfg_id: 2001,
            price_resources: { gold: 1 },
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
      () => baseSession(),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleShop();
    await vi.waitFor(() =>
      expect(mount.querySelector('[data-panel-state="error"]')?.textContent).toContain(
        "商城：余额不足",
      ),
    );
    const retry = mount.querySelector(
      `button.${PANEL_GATEWAY_RETRY_CLASS}[data-action="retry-refresh-shop"]`,
    ) as HTMLButtonElement;
    expect(retry).toBeTruthy();
    retry.click();
    await vi.waitFor(() => expect(listShopShelf).toHaveBeenCalledTimes(2));
    const speedupTab = mount.querySelector('[data-shop-category="speedup"]') as HTMLButtonElement;
    speedupTab.click();
    const emptyRow = mount.querySelector('[data-panel-state="empty"]');
    expect(emptyRow?.textContent).toMatch(/分类|加速/);
    expect(mount.querySelector('[data-panel-state="error"]')).toBeNull();
  });

  it("bag refresh failure shows retry when session bag is empty", async () => {
    const mount = document.createElement("div");
    const listPlayerBag = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("请求无效"), { code: 10001 }))
      .mockResolvedValueOnce({ items: [{ item_cfg_id: 2001, quantity: 1 }] });
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag,
    } as unknown as GatewayPort;
    const session = baseSession();
    const panels = new ContentPanels(
      mount,
      gateway,
      () => session,
      (patch) => Object.assign(session, patch),
      () => {},
    );
    panels.attach();
    panels.toggleBag();
    await vi.waitFor(() =>
      expect(mount.querySelector('[data-panel-state="error"]')?.textContent).toContain("背包："),
    );
    (
      mount.querySelector(
        `button.${PANEL_GATEWAY_RETRY_CLASS}[data-action="retry-refresh-bag"]`,
      ) as HTMLButtonElement
    ).click();
    await vi.waitFor(() => expect(listPlayerBag).toHaveBeenCalledTimes(2));
    await vi.waitFor(() =>
      expect(mount.querySelector('[data-panel-state="error"]')).toBeNull(),
    );
    expect(session.bag?.some((s) => s.item_cfg_id === 2001)).toBe(true);
  });
});
