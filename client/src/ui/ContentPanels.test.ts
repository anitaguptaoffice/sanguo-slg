import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import {
  applyBagPanelScrollTop,
  readBagCategoryScrollState,
  readBagPanelScrollTop,
} from "@/net/bagCategoryScroll";
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
    expect(sessionStorage.getItem("bag-category-tab-v1")).toContain('"tab":"cultivation"');
  });

  it("CLIENT-242 highlights first bag row on category tab switch", async () => {
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
    await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
    const consumableTab = mount.querySelector(
      '[data-bag-category="consumable"]',
    ) as HTMLButtonElement;
    consumableTab.click();
    const first = mount.querySelector(".bag-stack-row");
    expect(first?.classList.contains("bag-shop-category-scan-ring")).toBe(true);
  });

  it("CLIENT-210 restores bag scroll when reopening and across category tabs", async () => {
    sessionStorage.removeItem("bag-category-tab-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [
      { item_cfg_id: 2001, quantity: 2 },
      { item_cfg_id: 2017, quantity: 1 },
    ];
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({ items: session.bag }),
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
    await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
    const bagRoot = mount.querySelector('[data-center-panel="bag"]') as HTMLElement;
    applyBagPanelScrollTop(bagRoot, 120);
    panels.toggleBag();
    panels.toggleBag();
    await vi.waitFor(() => expect(readBagPanelScrollTop(bagRoot)).toBe(120));
    const cultTab = mount.querySelector('[data-bag-category="cultivation"]') as HTMLButtonElement;
    cultTab.click();
    expect(readBagCategoryScrollState().scrollTops.all).toBe(120);
    applyBagPanelScrollTop(bagRoot, 40);
    const allTab = mount.querySelector('[data-bag-category="all"]') as HTMLButtonElement;
    allTab.click();
    expect(readBagCategoryScrollState().scrollTops.cultivation).toBe(40);
    expect(readBagCategoryScrollState().scrollTops.all).toBe(120);
    await vi.waitFor(() => expect(readBagPanelScrollTop(bagRoot)).toBe(120));
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

describe("ContentPanels bag cfg summary and source tag (CLIENT-175)", () => {
  it("shows stack secondary line and hero open-source tag on deep link", async () => {
    sessionStorage.removeItem("bag-open-source-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [{ item_cfg_id: 2017, quantity: 2 }];
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({
        items: [{ item_cfg_id: 2017, quantity: 2 }],
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
    panels.openBagFromHeroDeepLink({
      bagCategory: "cultivation",
      highlightItemId: 2017,
      returnHeroId: 9,
      openSource: "hero",
    });
    await vi.waitFor(() =>
      expect(mount.querySelector(".bag-stack-secondary")?.textContent).toContain("养成"),
    );
    const tag = mount.querySelector('[data-role="bag-open-source-tag"]');
    expect(tag?.getAttribute("data-bag-open-source")).toBe("hero");
    expect(tag?.textContent).toContain("将领");
    expect(sessionStorage.getItem("bag-open-source-v1")).toBe("hero");
    const row = mount.querySelector('.bag-stack-row[data-item-cfg-id="2017"]');
    expect(row?.classList.contains("item-highlight")).toBe(true);
    panels.toggleBag();
    panels.toggleBag();
    expect(row?.classList.contains("item-highlight")).toBe(true);
    expect(mount.querySelector('[data-role="bag-open-source-tag"]')?.hidden).toBe(false);
  });
});

describe("ContentPanels recruit item gap bag highlight (CLIENT-201)", () => {
  it("applies bag-hero-item-gap-highlight on recruit deep link", async () => {
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [{ item_cfg_id: 2004, quantity: 1 }];
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({
        items: [{ item_cfg_id: 2004, quantity: 1 }],
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
    panels.openBagFromRecruitItemGapDeepLink({
      bagCategory: "all",
      highlightItemId: 2004,
      returnHeroId: 0,
      recruitItemGap: true,
      openSource: "hero",
    });
    await vi.waitFor(() =>
      expect(mount.querySelector('.bag-stack-row[data-item-cfg-id="2004"]')).toBeTruthy(),
    );
    const row = mount.querySelector('.bag-stack-row[data-item-cfg-id="2004"]');
    expect(row?.classList.contains("item-highlight")).toBe(true);
    expect(row?.classList.contains("bag-hero-item-gap-highlight")).toBe(true);
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
    const compare = () => mount.querySelector('[data-role="shop-wallet-compare-line"]');
    expect(sweep()?.textContent).toMatch(/本类余额：.*币 50/);
    expect(compare()?.textContent).toMatch(/标价10.*余额50/);
    const otherTab = mount.querySelector('[data-shop-category="other"]') as HTMLButtonElement;
    otherTab.click();
    expect(sweep()?.textContent).toMatch(/本类余额：.*粮 800/);
    expect(sweep()?.textContent).not.toMatch(/币 50/);
    expect(compare()?.textContent).toMatch(/标价400.*余额800/);
  });
});

describe("ContentPanels bag shop return highlight (CLIENT-210)", () => {
  it("highlights last viewed stack when returning from shop", async () => {
    sessionStorage.removeItem("bag-shop-return-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [{ item_cfg_id: 2001, quantity: 3 }];
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({ items: session.bag }),
      listShopShelf: vi.fn().mockResolvedValue({ offers: [] }),
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
    await vi.waitFor(() => expect(mount.querySelector(".bag-stack-row")).toBeTruthy());
    const itemSel = mount.querySelector('[data-field="item-id"]') as HTMLSelectElement;
    itemSel.value = "2001";
    itemSel.dispatchEvent(new Event("change", { bubbles: true }));
    panels.toggleShop();
    await vi.waitFor(() => expect(gateway.listShopShelf).toHaveBeenCalled());
    panels.toggleBag();
    panels.toggleBag();
    await vi.waitFor(() =>
      expect(
        mount
          .querySelector('.bag-stack-row[data-item-cfg-id="2001"]')
          ?.classList.contains("bag-row-return-highlight"),
      ).toBe(true),
    );
  });
});

describe("ContentPanels bag shop inline residual and panel return highlight (CLIENT-256)", () => {
  it("rings bag inline state at stack cap and highlights category tab after rank return", async () => {
    sessionStorage.removeItem("bag-category-tab-v1");
    sessionStorage.removeItem("panel-return-source-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [{ item_cfg_id: 2001, quantity: 99 }];
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({ items: session.bag }),
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
    await vi.waitFor(() => {
      const inline = mount.querySelector(".bag-row-inline-state");
      expect(inline?.classList.contains("bag-shop-inline-state-residual-ring")).toBe(true);
      expect(inline?.classList.contains("bag-shop-inline-state-residual-deep-ring")).toBe(true);
      expect(inline?.classList.contains("bag-shop-inline-state-residual-deeper-ring")).toBe(true);
      expect(inline?.classList.contains("bag-shop-inline-state-residual-deepest-ring")).toBe(true);
      expect(
        inline?.classList.contains("bag-shop-inline-state-residual-deepest-deeper-ring"),
      ).toBe(true);
    });
    const consumableTab = mount.querySelector(
      '[data-bag-category="consumable"]',
    ) as HTMLButtonElement;
    consumableTab.click();
    panels.capturePanelReturnSourceBeforeRankIntel("rank");
    panels.toggleBag();
    expect(sessionStorage.getItem("panel-return-source-v1")).toContain("consumable");
    panels.toggleBag();
    await vi.waitFor(() => {
      const tab = mount.querySelector('[data-bag-category="consumable"]');
      expect(tab?.classList.contains("panel-return-source-highlight-residual")).toBe(true);
      expect(tab?.classList.contains("panel-return-source-highlight-residual-deep")).toBe(true);
      expect(tab?.classList.contains("panel-return-source-highlight-residual-deeper")).toBe(true);
      expect(tab?.classList.contains("panel-return-source-highlight-residual-deepest")).toBe(true);
      expect(
        tab?.classList.contains("panel-return-source-highlight-residual-deepest-deeper"),
      ).toBe(true);
    });
  });

  it("rings shop afford inline when wallet insufficient", async () => {
    sessionStorage.removeItem("panel-return-source-v1");
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
    await vi.waitFor(() => {
      const afford = mount.querySelector(".shop-offer-afford-inline");
      expect(afford?.classList.contains("bag-shop-inline-state-residual-ring")).toBe(true);
      expect(afford?.classList.contains("bag-shop-inline-state-residual-deep-ring")).toBe(true);
      expect(afford?.classList.contains("bag-shop-inline-state-residual-deeper-ring")).toBe(true);
      expect(afford?.classList.contains("bag-shop-inline-state-residual-deepest-ring")).toBe(true);
      expect(
        afford?.classList.contains("bag-shop-inline-state-residual-deepest-deeper-ring"),
      ).toBe(true);
    });
  });
});

describe("ContentPanels bag inline state and shop wallet gap (CLIENT-194)", () => {
  it("shows bag-row-inline-state on selected stack and shop-price-wallet-gap on offers", async () => {
    sessionStorage.removeItem("bag-category-tab-v1");
    const mount = document.createElement("div");
    const session = baseSession();
    session.bag = [
      { item_cfg_id: 2001, quantity: 5 },
      { item_cfg_id: 2017, quantity: 2 },
    ];
    session.wallet = { gold: 5 };
    const listShopShelf = vi.fn().mockResolvedValue({
      offers: [
        {
          offer_id: 1001,
          shelf_name: "谷袋",
          item_cfg_id: 2001,
          quantity_per_purchase: 1,
          price_resources: { gold: 10 },
        },
      ],
    });
    const gateway = {
      getBoundServerId: () => 1,
      listPlayerBag: async () => ({ items: session.bag }),
      listShopShelf,
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
    await vi.waitFor(() =>
      expect(
        mount.querySelector('.bag-stack-row[data-item-cfg-id="2001"] .bag-row-inline-state')
          ?.textContent,
      ).toMatch(/^×5/),
    );
    panels.toggleShop();
    await vi.waitFor(() => expect(listShopShelf).toHaveBeenCalled());
    const gap = mount.querySelector(".shop-price-wallet-gap");
    expect(gap?.textContent).toBe("币 标价10/余额5/缺5");
    expect(mount.querySelector(".shop-price-vs-wallet")?.textContent).toMatch(/现价/);
    expect(mount.querySelector('[data-role="shop-tab-currency-sweep"]')?.textContent).toMatch(
      /本类余额/,
    );
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
