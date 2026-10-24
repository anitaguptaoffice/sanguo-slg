import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { MAIL_INBOX_FILTER_UNREAD, type MailRow } from "@/net/heroMailState";
import {
  MAIL_INBOX_FILTER_SESSION_KEY,
  readMailInboxFilterSession,
} from "@/net/mailInboxFilter";
import { HERO_DETAIL_SELECTED_SESSION_KEY } from "@/net/heroDetailSelectedSession";
import {
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_SORT_SESSION_KEY,
  readHeroListFilterSession,
  readHeroListSortSession,
} from "@/net/heroListFilter";
import {
  HERO_LIST_INFLIGHT_ATTR,
  HERO_LIST_REFRESH_PULSE_CLASS,
} from "@/net/heroListRefreshFeedback";
import {
  HERO_LIST_SELECTED_SESSION_KEY,
  readHeroListSelectedSession,
} from "@/net/heroListSelectedSession";
import {
  HERO_LIST_RETURN_SESSION_KEY,
  readHeroListReturnState,
} from "@/net/heroListReturnState";
import { HERO_DETAIL_STAT_PULSE_CLASS } from "@/net/heroDetailCultivationUse";
import { USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL } from "@/net/useConsumableSubmitFeedback";
import {
  RECRUIT_FORM_INLINE_WARN_CLASS,
  RECRUIT_GOTO_BAG_ITEM_GAP_ACTION,
} from "@/net/recruitFormInlineHint";

function flushPromises(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

function sessionBase(): MainCitySession {
  return {
    serverId: 1,
    cityId: 1,
    cityName: "城",
    wallet: {},
    buildings: [],
    cityTroops: [],
    bag: [],
  };
}

describe("HeroMailPanels", () => {
  beforeEach(() => {
    sessionStorage.removeItem(MAIL_INBOX_FILTER_SESSION_KEY);
  });

  it("mail filter toolbar exposes ART-UI-FILTER chip hooks (CLIENT-122)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    expect(mount.querySelector('[data-action="mail-filter-all"][data-ui-filter-chip]')).toBeTruthy();
    expect(mount.querySelector('[data-action="mail-filter-unread"][data-ui-filter-chip]')).toBeTruthy();
    expect(mount.querySelector('[data-action="mail-filter-unclaimed"][data-ui-filter-chip]')).toBeTruthy();
    expect(mount.querySelector('[data-role="mail-filter-bar"]')).toBeTruthy();
    expect(mount.querySelector(".mail-inbox-toolbar.panel-filter-chip-bar")).toBeTruthy();
  });

  it("mail panel has panel-scroll-body for narrow layout (CLIENT-070)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    expect(mount.querySelector('[data-center-panel="mail"] .panel-scroll-body')).toBeTruthy();
  });

  it("hero panel has panel-scroll-body and center-panel id (CLIENT-078)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    expect(mount.querySelector('[data-center-panel="hero"]')).toBeTruthy();
    expect(mount.querySelector('[data-center-panel="hero"] .panel-scroll-body')).toBeTruthy();
  });

  it("hero panel scroll body wraps list and detail for narrow layout (CLIENT-103)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    const scroll = mount.querySelector('[data-center-panel="hero"] .panel-scroll-body');
    expect(scroll?.querySelector('[data-role="hero-list"]')).toBeTruthy();
    expect(scroll?.querySelector('[data-role="hero-detail"]')).toBeTruthy();
    expect(mount.querySelector('[data-action="recruit-hero"]')?.closest(".panel-scroll-body")).toBeNull();
  });

  it("renders empty mail list after refresh", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({ mails: [], total_count: 0 }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    mount.querySelector('[data-action="refresh-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const ul = mount.querySelector('[data-role="mail-list"]');
    expect(ul?.textContent).toContain("空收件箱");
    expect(ul?.querySelector("li[data-panel-state='empty']")).toBeTruthy();
  });

  it("opening unread mail calls MarkPlayerMailRead", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [{ mail_id: 3, title: "系统", status: 0, body: "你好" }],
        total_count: 1,
      }),
      markPlayerMailRead: vi.fn().mockResolvedValue({ mail: { mail_id: 3, status: 1 } }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector("li[data-mail-id='3']")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.markPlayerMailRead).toHaveBeenCalledWith(1, 3);
  });

  it("hero list refresh shows refreshed-at stamp and data-hero-list-inflight while loading", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1001 }],
        total_count: 1,
      }),
      listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const heroPanel = mount.querySelector('[data-center-panel="hero"]') as HTMLElement;
    const refreshBtn = mount.querySelector('[data-action="refresh-heroes"]') as HTMLButtonElement;
    refreshBtn.dispatchEvent(new Event("click", { bubbles: true }));
    expect(heroPanel.getAttribute(HERO_LIST_INFLIGHT_ATTR)).toBe("1");
    await flushPromises();
    expect(heroPanel.hasAttribute(HERO_LIST_INFLIGHT_ATTR)).toBe(false);
    const stamp = mount.querySelector('[data-role="hero-list-refreshed-at"]');
    expect(stamp?.textContent).toMatch(/^列表更新：/);
    expect(stamp?.classList.contains("hidden")).toBe(false);
  });

  it("hero list refresh disables button, pulses on success, and shows CLIENT-067 error on failure", async () => {
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi
        .fn()
        .mockResolvedValueOnce({ heroes: [{ hero_id: 2, template_cfg_id: 1001 }], total_count: 1 })
        .mockResolvedValueOnce({ heroes: [{ hero_id: 2, template_cfg_id: 1001 }], total_count: 1 })
        .mockRejectedValueOnce(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const refreshBtn = mount.querySelector('[data-action="refresh-heroes"]') as HTMLButtonElement;
    refreshBtn.dispatchEvent(new Event("click", { bubbles: true }));
    expect(refreshBtn.disabled).toBe(true);
    await flushPromises();
    const list = mount.querySelector('[data-role="hero-list"]')!;
    expect(list.classList.contains(HERO_LIST_REFRESH_PULSE_CLASS)).toBe(true);
    refreshBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const errEl = mount.querySelector('[data-role="hero-list-form-error"]');
    expect(errEl?.textContent).toContain("[10001]");
    expect(errEl?.classList.contains("hidden")).toBe(false);
  });

  it("restores sessionStorage hero selection when hero panel reopens", async () => {
    sessionStorage.setItem(HERO_DETAIL_SELECTED_SESSION_KEY, "8");
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [
          { hero_id: 8, template_cfg_id: 1001, level: 1, loyalty: 50 },
          { hero_id: 9, template_cfg_id: 1002, level: 1, loyalty: 50 },
        ],
        total_count: 2,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 8,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 1,
        loyalty: 50,
        attributes: { force: 1, intel: 1, politics: 1, command: 1 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    panels.toggleHero();
    panels.toggleHero();
    await flushPromises();
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 8);
    expect(mount.querySelector('li[data-hero-id="8"].selected')).toBeTruthy();
    sessionStorage.removeItem(HERO_DETAIL_SELECTED_SESSION_KEY);
  });

  it("persists hero-list-selected-v1 and restores scrollTop when panel reopens", async () => {
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [
          { hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 },
          { hero_id: 4, template_cfg_id: 1002, level: 1, loyalty: 50 },
        ],
        total_count: 2,
      }),
      listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 2,
        loyalty: 77,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const scroll = mount.querySelector('[data-role="hero-scroll"]') as HTMLElement;
    scroll.scrollTop = 120;
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(readHeroListSelectedSession()).toEqual({ heroId: 3, scrollTop: 120 });
    panels.toggleHero();
    panels.toggleHero();
    await flushPromises();
    expect(scroll.scrollTop).toBe(120);
    expect(mount.querySelector('li[data-hero-id="3"].selected')).toBeTruthy();
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
  });

  it("persists hero-detail-selected-id when a hero row is clicked", async () => {
    sessionStorage.removeItem(HERO_DETAIL_SELECTED_SESSION_KEY);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 2,
        loyalty: 77,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(sessionStorage.getItem(HERO_DETAIL_SELECTED_SESSION_KEY)).toBe("3");
  });

  it("loads GetHeroDetail into detail pane when hero row clicked", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        rarity: 5,
        level: 2,
        loyalty: 77,
        loyalty_min: 0,
        loyalty_max: 100,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const row = mount.querySelector('li[data-hero-id="3"]');
    row?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 3);
    const detail = mount.querySelector('[data-role="hero-detail"]');
    expect(detail?.querySelector(".hero-detail-name")?.textContent).toContain("玄德");
    expect(detail?.querySelector(".hero-detail-level")?.textContent).toContain("Lv2");
    expect(detail?.querySelector(".hero-attr-table")).toBeTruthy();
    expect(detail?.textContent).toContain("UseConsumable");
  });

  it("hero list rows use primary/secondary scan lines (CLIENT-132)", async () => {
    sessionStorage.removeItem(HERO_DETAIL_SELECTED_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 2,
        loyalty: 77,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const row = mount.querySelector('li[data-hero-id="3"]') as HTMLElement;
    expect(row?.getAttribute("data-ui-panel-listrow")).toBe("ui.panel.listrow.default.v1");
    expect(row?.querySelector(".hero-list-row-primary")?.textContent).toContain("Lv2");
    expect(row?.querySelector(".hero-list-row-primary")?.textContent).toContain("忠诚 77");
    expect(row?.querySelector(".hero-list-row-secondary")?.textContent).toBe("详情查看养成");
    row?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 3);
    const rowAfter = mount.querySelector('li[data-hero-id="3"]');
    expect(rowAfter?.querySelector(".hero-list-row-secondary")?.textContent).toContain("武60");
  });

  it("filters and sorts hero list with sessionStorage memory (CLIENT-151)", async () => {
    const mount = document.createElement("div");
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [
          { hero_id: 1, template_cfg_id: 1001, level: 3, loyalty: 80 },
          { hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10 },
          { hero_id: 3, template_cfg_id: 1003, level: 5, loyalty: 60 },
        ],
        total_count: 3,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    expect(mount.querySelector(".hero-list-toolbar.panel-filter-chip-bar")).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(storage.get(HERO_LIST_FILTER_SESSION_KEY)).toBe("deployable");
    expect(mount.querySelectorAll("li[data-hero-id]").length).toBe(2);
    mount
      .querySelector('[data-action="hero-sort-loyalty"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(storage.get(HERO_LIST_SORT_SESSION_KEY)).toBe("loyalty_desc");
    const ids = [...mount.querySelectorAll("li[data-hero-id]")].map((li) =>
      li.getAttribute("data-hero-id"),
    );
    expect(ids).toEqual(["1", "3"]);
    panels.detach();
    const mount2 = document.createElement("div");
    const panels2 = new HeroMailPanels(mount2, gateway, () => sessionBase(), () => {}, () => {});
    panels2.attach();
    expect(readHeroListFilterSession()).toBe("deployable");
    expect(readHeroListSortSession()).toBe("loyalty_desc");
    vi.unstubAllGlobals();
  });

  it("hero list return restores filter sort scroll and shows list hint (CLIENT-199)", async () => {
    sessionStorage.removeItem(HERO_LIST_RETURN_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [
          { hero_id: 1, template_cfg_id: 1001, level: 3, loyalty: 80 },
          { hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10 },
          { hero_id: 3, template_cfg_id: 1003, level: 5, loyalty: 60 },
        ],
        total_count: 3,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1003,
        template_name: "玄德",
        level: 5,
        loyalty: 60,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    mount
      .querySelector('[data-action="hero-sort-loyalty"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    const scroll = mount.querySelector('[data-role="hero-scroll"]') as HTMLElement;
    scroll.scrollTop = 64;
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(readHeroListReturnState()?.filter).toBe("deployable");
    expect(readHeroListReturnState()?.sort).toBe("loyalty_desc");
    expect(readHeroListReturnState()?.scrollTop).toBe(64);
    const hint = mount.querySelector('[data-role="hero-detail-list-hint"]');
    expect(hint?.textContent).toContain("可出征");
    expect(hint?.textContent).toContain("忠诚↓");
    mount
      .querySelector('[data-action="hero-back-to-list"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(mount.querySelector('[data-role="hero-detail-list-hint"]')).toBeNull();
    expect(mount.querySelector('li[data-hero-id="3"].selected')).toBeTruthy();
    expect(scroll.scrollTop).toBe(64);
    expect(readHeroListFilterSession()).toBe("deployable");
    expect(readHeroListSortSession()).toBe("loyalty_desc");
    sessionStorage.removeItem(HERO_LIST_RETURN_SESSION_KEY);
    sessionStorage.removeItem(HERO_DETAIL_SELECTED_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
  });

  it("hero detail cultivation use shows inflight label, refreshes detail, and pulses on success", async () => {
    const mount = document.createElement("div");
    let loyalty = 70;
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockImplementation(async () => ({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        rarity: 5,
        level: 2,
        loyalty,
        loyalty_min: 0,
        loyalty_max: 100,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      })),
      useConsumable: vi.fn().mockImplementation(async () => {
        loyalty = 85;
        return { remaining: 1, effect_summary: "忠诚提升" };
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: {},
      buildings: [],
      cityTroops: [],
      bag: [{ item_cfg_id: 2017, quantity: 2 }],
    };
    const onStatus = vi.fn();
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, onStatus);
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const useBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-use-cultivation-item"]');
    expect(useBtn?.disabled).toBe(false);
    useBtn?.click();
    expect(useBtn?.textContent).toBe(USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL);
    await flushPromises();
    expect(gateway.useConsumable).toHaveBeenCalledWith(1, 2017, 1);
    expect(gateway.getHeroDetail).toHaveBeenCalled();
    expect(gateway.getHeroDetail.mock.calls.filter((c) => c[1] === 3).length).toBeGreaterThanOrEqual(2);
    const detail = mount.querySelector('[data-role="hero-detail"]');
    expect(detail?.querySelector(".hero-detail-head")?.classList.contains(HERO_DETAIL_STAT_PULSE_CLASS)).toBe(
      true,
    );
    expect(mount.querySelector('[data-role="hero-cultivation-success"]')?.textContent).toContain("忠诚 70→85");
    expect(mount.querySelector('li[data-hero-id="3"]')?.textContent).toContain("忠诚 85");
    expect(onStatus).toHaveBeenCalled();
  });

  it("disables hero cultivation use when bag lacks consumables", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 2,
        loyalty: 77,
        attributes: { force: 1, intel: 1, politics: 1, command: 1 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const useBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-use-cultivation-item"]');
    expect(useBtn?.disabled).toBe(true);
    expect(mount.querySelector('[data-role="hero-cultivation-disabled-reason"]')?.textContent).toMatch(
      /缺口|养成消耗品/,
    );
    expect(mount.querySelector('[data-role="hero-upgrade-item-gap"]')?.textContent).toContain("缺口");
  });

  it("marks owned recruit template and shows affordability preview on selection", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            template_name: "玄德",
            recruit_cost: { food: 100 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
          },
          { template_cfg_id: 1002, template_name: "云长", rarity: 5 },
        ],
        total_count: 2,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 1, template_cfg_id: 1001, level: 1, loyalty: 100 }],
        total_count: 1,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = sessionBase();
    session.wallet = { food: 50 };
    session.bag = [{ item_cfg_id: 2004, quantity: 0 }];
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const ownedLi = mount.querySelector('li[data-template-id="1001"]');
    expect(ownedLi?.textContent).toContain("已招募");
    expect(ownedLi?.classList.contains("recruit-owned")).toBe(true);
    expect(ownedLi?.querySelector(".recruit-afford-secondary")?.textContent).toContain("粮");
    const preview = mount.querySelector('[data-role="recruit-preview"]');
    expect(preview?.textContent).toContain("玄德");
    expect(preview?.textContent).toContain("余");
    const recruitBtn = mount.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement;
    expect(recruitBtn.disabled).toBe(true);
    const errEl = mount.querySelector('[data-role="recruit-form-error"]');
    expect(errEl?.textContent).toContain("不足");
    mount.querySelector('li[data-template-id="1002"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(preview?.textContent).toContain("云长");
  });

  it("shows recruit form inline hint, disables submit, and opens bag on item gap (CLIENT-201)", async () => {
    const mount = document.createElement("div");
    const onOpenBag = vi.fn();
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            template_name: "玄德",
            recruit_cost: { food: 10 },
            recruit_item: { item_cfg_id: 2004, quantity: 2 },
          },
        ],
        total_count: 1,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = sessionBase();
    session.wallet = { food: 100 };
    session.bag = [{ item_cfg_id: 2004, quantity: 0 }];
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => session,
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onOpenBag,
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const hint = mount.querySelector('[data-role="recruit-form-inline-hint"]');
    expect(hint?.textContent).toContain("校验");
    expect(hint?.classList.contains(RECRUIT_FORM_INLINE_WARN_CLASS)).toBe(true);
    const recruitBtn = mount.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement;
    expect(recruitBtn.disabled).toBe(true);
    const bagBtn = mount.querySelector(
      `[data-action="${RECRUIT_GOTO_BAG_ITEM_GAP_ACTION}"]`,
    ) as HTMLButtonElement;
    expect(bagBtn.classList.contains("hidden")).toBe(false);
    bagBtn.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenBag).toHaveBeenCalledWith(
      expect.objectContaining({ highlightItemId: 2004, recruitItemGap: true }),
    );
  });

  it("recruit template row shows wallet sweep deficit and view-hero deep link (CLIENT-166)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            template_name: "玄德",
            recruit_cost: { gold: 20 },
          },
          { template_cfg_id: 1002, template_name: "云长", recruit_cost: { gold: 1 } },
        ],
        total_count: 2,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 1, loyalty: 90 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 1,
        loyalty: 90,
        attributes: { force: 1, intel: 1, politics: 1, command: 1 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = sessionBase();
    session.wallet = { gold: 5 };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const ownedRow = mount.querySelector('li[data-template-id="1001"]');
    expect(ownedRow?.querySelector(".recruit-cost-deficit")?.textContent).toContain("不足");
    const viewBtn = ownedRow?.querySelector('[data-action="recruit-view-hero"]') as HTMLButtonElement;
    expect(viewBtn.disabled).toBe(false);
    expect(viewBtn.getAttribute("data-hero-id")).toBe("3");
    const lockedRow = mount.querySelector('li[data-template-id="1002"]');
    expect(lockedRow?.classList.contains("recruit-template-locked")).toBe(true);
    expect(
      (lockedRow?.querySelector('[data-action="recruit-view-hero"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    viewBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 3);
  });

  it("hero-goto-recruit preselects matching template_cfg_id", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          { template_cfg_id: 1001, template_name: "玄德" },
          { template_cfg_id: 1002, template_name: "云长" },
        ],
        total_count: 2,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1002, level: 1, loyalty: 90 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1002,
        template_name: "云长",
        level: 1,
        loyalty: 90,
        loyalty_min: 0,
        loyalty_max: 100,
        attributes: { force: 95, intel: 62, politics: 55, command: 82 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="hero-goto-recruit"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const sel = mount.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    expect(sel?.value).toBe("1002");
    expect(mount.querySelector('li[data-template-id="1002"]')?.classList.contains("selected")).toBe(true);
  });

  it("hero-goto-recruit writes scroll anchor and scrolls template row (CLIENT-166)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          { template_cfg_id: 1001, template_name: "玄德" },
          { template_cfg_id: 1002, template_name: "云长" },
        ],
        total_count: 2,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1002, level: 1, loyalty: 90 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1002,
        template_name: "云长",
        level: 1,
        loyalty: 90,
        attributes: { force: 1, intel: 1, politics: 1, command: 1 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const row = mount.querySelector('li[data-template-id="1002"]') as HTMLLIElement;
    row.scrollIntoView = vi.fn();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="hero-goto-recruit"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(sessionStorage.getItem("recruit-scroll-anchor-v1")).toBeNull();
    expect(row.scrollIntoView).toHaveBeenCalled();
  });

  it("hero-goto-bag-cultivation opens bag with first consumable via callback", async () => {
    const mount = document.createElement("div");
    const onBag = vi.fn();
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 1, template_cfg_id: 1001, level: 1, loyalty: 100 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 1,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 1,
        loyalty: 100,
        loyalty_min: 0,
        loyalty_max: 100,
        attributes: { force: 72, intel: 75, politics: 88, command: 78 },
      }),
      listPlayerBag: vi.fn().mockResolvedValue({
        items: [{ item_cfg_id: 2017, quantity: 3 }],
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onBag,
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="1"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="hero-goto-bag-cultivation"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(onBag).toHaveBeenCalledWith(
      expect.objectContaining({ highlightItemId: 2017, bagCategory: "cultivation", returnHeroId: 1 }),
    );
  });

  it("hero detail load failure shows CLIENT-129 error chrome", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 5, template_cfg_id: 1001, level: 1, loyalty: 50 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockRejectedValue(Object.assign(new Error("将领不存在"), { code: 10001 })),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="5"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const detail = mount.querySelector('[data-role="hero-detail"]');
    expect(detail?.querySelector(".panel-state-error")).toBeTruthy();
    expect(detail?.textContent).toMatch(/将领不存在|10001/);
  });

  it("hero-related-items opens bag highlight via callback", async () => {
    const mount = document.createElement("div");
    const onBag = vi.fn();
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 1, template_cfg_id: 1001, level: 1, loyalty: 100 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 1,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 1,
        loyalty: 100,
        attributes: { force: 72, intel: 75, politics: 88, command: 78 },
      }),
      listPlayerBag: vi.fn().mockResolvedValue({
        items: [{ item_cfg_id: 2017, quantity: 3 }, { item_cfg_id: 2001, quantity: 1 }],
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onBag,
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="1"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount
      .querySelector('[data-action="hero-related-items"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.listPlayerBag).toHaveBeenCalled();
    expect(onBag).toHaveBeenCalledWith(
      expect.objectContaining({ highlightItemId: 2017, returnHeroId: 1 }),
    );
  });

  it("hero detail shows same recruit affordability summary as template list", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            template_name: "玄德",
            rarity: 4,
            recruit_cost: { gold: 10 },
          },
        ],
        total_count: 1,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        rarity: 4,
        level: 2,
        loyalty: 77,
        attributes: { force: 60, intel: 70, politics: 80, command: 65 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = sessionBase();
    session.wallet = { gold: 5 };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const listSecondary = mount.querySelector('li[data-template-id="1001"] .recruit-afford-secondary')?.textContent;
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const detailSecondary = mount.querySelector('[data-role="hero-detail"] .recruit-afford-secondary')?.textContent;
    expect(listSecondary).toBeTruthy();
    expect(detailSecondary).toBe(listSecondary);
    expect(detailSecondary).toContain("不足");
  });

  it("claim success updates session bag via patch", async () => {
    const mount = document.createElement("div");
    let patched: Partial<MainCitySession> | null = null;
    const statuses: string[] = [];
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 7,
            title: "奖",
            status: 0,
            body: "正文",
            attachments: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
          },
        ],
        total_count: 1,
      })
      .mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      listPlayerBag: vi.fn().mockResolvedValue({
        items: [{ item_cfg_id: 2001, quantity: 2 }],
      }),
      markPlayerMailRead: vi.fn().mockResolvedValue({ mail: { mail_id: 7, status: 1 } }),
      claimPlayerMailAttachments: vi.fn().mockResolvedValue({
        mail: { mail_id: 7, status: 2 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
        wallet_after: { gold: 50 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = sessionBase();
    session.wallet = { gold: 10 };
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => session,
      (p) => {
        patched = p;
        Object.assign(session, p);
      },
      (msg) => statuses.push(msg),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.claimPlayerMailAttachments).toHaveBeenCalledWith(1, 7);
    expect(gateway.listPlayerBag).toHaveBeenCalledWith(1);
    const unreadCalls = listPlayerMail.mock.calls.filter(
      (c) => (c[1] as { pageSize?: number })?.pageSize === 1,
    );
    expect(unreadCalls.length).toBeGreaterThanOrEqual(1);
    expect(listPlayerMail.mock.calls.some((c) => (c[1] as { pageSize?: number })?.pageSize === 50)).toBe(
      true,
    );
    expect(patched?.bag).toEqual([{ item_cfg_id: 2001, quantity: 2 }]);
    expect(session.wallet?.gold).toBe(50);
    expect(statuses.some((s) => s.includes("领取成功") && s.includes("谷袋"))).toBe(true);
    expect(mount.querySelector(".mail-row-count-badge")).toBeNull();
    const inline = mount.querySelector('[data-role="mail-claim-inline"]');
    expect(inline?.classList.contains("hidden")).toBe(false);
    expect(inline?.textContent).toMatch(/领取成功/);
    expect(inline?.textContent).toContain("谷袋");
  });

  it("mail without attachments hides claim button", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 6200,
            title: "已读无附件",
            body: "无附件正文",
            status: 1,
          },
        ],
        total_count: 1,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('.mail-list [data-mail-id="6200"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    const claimBtn = mount.querySelector('[data-action="claim-mail"]') as HTMLElement | null;
    expect(claimBtn?.classList.contains("hidden")).toBe(true);
    expect(claimBtn?.offsetParent).toBeNull();
  });

  it("read mail with unclaimed attachments shows badge and highlighted claim button", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 9,
            title: "已读奖",
            status: 1,
            body: "领我",
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 1,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    const rowCount = mount.querySelector('.mail-list [data-mail-id="9"] [data-ui-filter-badge="count"]');
    expect(rowCount?.getAttribute("data-filter-badge-count")).toBe("1");
    const claimBtn = mount.querySelector('[data-action="claim-mail"]');
    expect(claimBtn?.classList.contains("hidden")).toBe(false);
    expect(claimBtn?.classList.contains("mail-claim-highlight")).toBe(true);
  });

  it("syncUnreadBadge count drops after claim refresh", async () => {
    const mount = document.createElement("div");
    const badgeCalls: number[] = [];
    const hudSnaps: { count: number; firstId: number }[] = [];
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 11,
            title: "未读奖",
            status: 0,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 2,
      })
      .mockResolvedValue({
        mails: [{ mail_id: 12, status: 0 }],
        total_count: 1,
      });
    const gateway: GatewayPort = {
      listPlayerMail,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments: vi.fn().mockResolvedValue({
        mail: { mail_id: 11, status: 2 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      () => {},
      (n) => badgeCalls.push(n),
      undefined,
      undefined,
      (snap) => hudSnaps.push(snap),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    badgeCalls.length = 0;
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector(".mail-row-count-badge")).toBeNull();
    expect(hudSnaps.at(-1)).toEqual({ count: 1, firstId: 12 });
    panels.toggleMail();
    await panels.syncUnreadBadge();
    expect(badgeCalls.at(-1)).toBe(1);
  });

  it("disables claim button while claim RPC is in flight", async () => {
    const mount = document.createElement("div");
    let resolveClaim!: (v: unknown) => void;
    const claimPlayerMailAttachments = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveClaim = resolve;
        }),
    );
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 5,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 1,
      }),
      claimPlayerMailAttachments,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector("li[data-mail-id='5']")?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const claimBtn = mount.querySelector('[data-action="claim-mail"]') as HTMLButtonElement;
    claimBtn?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(claimBtn.disabled).toBe(true);
    resolveClaim({ mail: { mail_id: 5, status: 2 }, granted: { items: [] } });
    await flushPromises();
    expect(claimBtn.disabled).toBe(false);
  });

  it("claim failure surfaces gateway message", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 8,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 1,
      }),
      claimPlayerMailAttachments: vi.fn().mockRejectedValue(
        Object.assign(new Error("附件已领"), { code: 40012 }),
      ),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      (msg) => statuses.push(msg),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(statuses.some((s) => s.includes("[40012]") && s.includes("附件已领"))).toBe(true);
    expect(mount.querySelector('[data-role="mail-status"]')?.textContent).toContain("附件已领");
  });

  it("unread filter passes filter=1 to listPlayerMail", async () => {
    const mount = document.createElement("div");
    const listPlayerMail = vi.fn().mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="mail-filter-unread"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(listPlayerMail).toHaveBeenCalledWith(1, {
      filter: MAIL_INBOX_FILTER_UNREAD,
      pageSize: 50,
    });
  });

  it("inbox filter tabs show unread and attachment counts from snapshot", async () => {
    const mount = document.createElement("div");
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 1,
            status: 0,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
          { mail_id: 2, status: 0 },
        ],
        total_count: 2,
      })
      .mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    const unreadBtn = mount.querySelector('[data-action="mail-filter-unread"]');
    expect(unreadBtn?.querySelector(".art-filter-chip-label")?.textContent).toBe("未读");
    const unreadCount = mount.querySelector('[data-role="mail-filter-unread-count"]');
    expect(unreadCount?.getAttribute("data-filter-badge-count")).toBe("2");
    expect(unreadCount?.textContent).toBe("2");
    const attachBadge = mount.querySelector('[data-role="mail-filter-all-count"]');
    expect(attachBadge?.getAttribute("data-filter-badge-count")).toBe("1");
    expect(attachBadge?.textContent).toBe("1");
  });

  it("tab attachment badge drops immediately after claim", async () => {
    const mount = document.createElement("div");
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 5,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 1,
      })
      .mockResolvedValue({ mails: [{ mail_id: 5, status: 2 }], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments: vi.fn().mockResolvedValue({
        mail: { mail_id: 5, status: 2, has_unclaimed_attachments: false },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    expect(mount.querySelector('[data-role="mail-filter-all-count"]')?.textContent).toBe("1");
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const badge = mount.querySelector('[data-role="mail-filter-all-count"]');
    expect(badge?.textContent).toBe("");
    expect(badge?.classList.contains("hidden")).toBe(true);
  });

  it("persists inbox filter in sessionStorage (CLIENT-122)", async () => {
    const mount = document.createElement("div");
    const storage = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    });
    const listPlayerMail = vi.fn().mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = { listPlayerMail, getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="mail-filter-unread"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(storage.get(MAIL_INBOX_FILTER_SESSION_KEY)).toBe(String(MAIL_INBOX_FILTER_UNREAD));
    panels.detach();
    const mount2 = document.createElement("div");
    const panels2 = new HeroMailPanels(mount2, gateway, () => sessionBase(), () => {}, () => {});
    panels2.attach();
    expect(readMailInboxFilterSession()).toBe(MAIL_INBOX_FILTER_UNREAD);
    vi.unstubAllGlobals();
  });

  it("syncUnreadBadge reports total_count to callback", async () => {
    const mount = document.createElement("div");
    let unread = -1;
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({ mails: [], total_count: 4 }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      () => {},
      (n) => {
        unread = n;
      },
    );
    panels.attach();
    await panels.syncUnreadBadge();
    expect(unread).toBe(4);
  });

  it("shows submitting label while RecruitHero is in flight", async () => {
    const mount = document.createElement("div");
    let resolveRecruit!: (v: unknown) => void;
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            recruit_cost: { food: 10 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
          },
        ],
        total_count: 1,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      getCityState: vi.fn().mockResolvedValue({ wallet: { food: 90 } }),
      getHeroDetail: vi.fn().mockResolvedValue({ hero_id: 1, template_cfg_id: 1001 }),
      listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
      recruitHero: vi.fn().mockImplementation(
        () =>
          new Promise((r) => {
            resolveRecruit = r;
          }),
      ),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: { food: 100 },
      buildings: [],
      cityTroops: [],
      bag: [{ item_cfg_id: 2004, quantity: 1 }],
    };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const recruitBtn = mount.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement;
    recruitBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(recruitBtn.disabled).toBe(true);
    expect(recruitBtn.textContent).toBe("招募中…");
    const preview = mount.querySelector('[data-role="recruit-preview"]');
    expect(preview?.classList.contains("recruit-submitting")).toBe(true);
    expect(preview?.textContent).toBe("招募提交中…");
    resolveRecruit({
      hero_id: 1,
      template_cfg_id: 1001,
      level: 1,
      loyalty: 100,
    });
    await flushPromises();
    await flushPromises();
    expect(recruitBtn.textContent).toBe("招募");
  });

  it("recruit failure keeps template selection and shows inline error", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            recruit_cost: { food: 10 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
          },
        ],
        total_count: 1,
      }),
      listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
      recruitHero: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("道具不足"), { code: 10001 })),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: { food: 100 },
      buildings: [],
      cityTroops: [],
      bag: [{ item_cfg_id: 2004, quantity: 1 }],
    };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const sel = mount.querySelector('[data-field="template-select"]') as HTMLSelectElement;
    expect(sel.value).toBe("1001");
    mount.querySelector('[data-action="recruit-hero"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    await flushPromises();
    expect(mount.querySelector('[data-role="recruit-form-error"]')?.textContent).toContain("道具不足");
    expect(sel.value).toBe("1001");
    const toast = mount.querySelector('[data-role="recruit-success-toast"]');
    expect(toast?.classList.contains("hidden")).toBe(true);
  });

  it("recruit success refreshes list, selects new hero, and nudges daily recruit", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const onDaily = vi.fn().mockResolvedValue(undefined);
    const gateway: GatewayPort = {
      listRecruitTemplates: vi.fn().mockResolvedValue({
        templates: [
          {
            template_cfg_id: 1001,
            template_name: "玄德府君",
            recruit_cost: { food: 100 },
            recruit_item: { item_cfg_id: 2004, quantity: 1 },
          },
        ],
        total_count: 1,
      }),
      listPlayerHeroes: vi
        .fn()
        .mockResolvedValueOnce({ heroes: [], total_count: 0 })
        .mockResolvedValueOnce({
          heroes: [{ hero_id: 99, template_cfg_id: 1001, level: 1, loyalty: 100 }],
          total_count: 1,
        }),
      listPlayerQuests: vi.fn().mockResolvedValue({
        quests: [{ quest_cfg_id: 1015, quest_code: "daily_recruit_1", state: 2 }],
      }),
      recruitHero: vi.fn().mockResolvedValue({
        hero_id: 99,
        template_cfg_id: 1001,
        level: 1,
        loyalty: 100,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 99,
        template_cfg_id: 1001,
        template_name: "玄德府君",
        level: 1,
        loyalty: 100,
      }),
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      getCityState: vi.fn().mockResolvedValue({ wallet: { food: 900 } }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    let session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: { food: 1000 },
      buildings: [],
      cityTroops: [],
      bag: [{ item_cfg_id: 2004, quantity: 1 }],
    };
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => session,
      (patch) => {
        session = { ...session, ...patch };
      },
      (msg) => statuses.push(msg),
      undefined,
      undefined,
      onDaily,
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('[data-action="refresh-templates"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const recruitBtn = mount.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement;
    expect(recruitBtn.disabled).toBe(false);
    recruitBtn.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    await flushPromises();
    expect(gateway.recruitHero).toHaveBeenCalled();
    expect(gateway.listPlayerHeroes).toHaveBeenCalledTimes(2);
    expect(gateway.getHeroDetail).not.toHaveBeenCalled();
    expect(gateway.getCityState).toHaveBeenCalled();
    const sweepLine = mount.querySelector(
      'li[data-template-id="1001"] .recruit-afford-secondary',
    )?.textContent;
    expect(sweepLine).toContain("余900");
    expect(
      mount.querySelector('[data-role="recruit-preview"]')?.classList.contains("recruit-success-pulse"),
    ).toBe(true);
    const selected = mount.querySelector('li[data-hero-id="99"].selected');
    expect(selected).toBeTruthy();
    expect(onDaily).toHaveBeenCalled();
    expect(statuses.some((s) => s.includes("玄德府君") && s.includes("日常"))).toBe(true);
    const toast = mount.querySelector('[data-role="recruit-success-toast"]');
    expect(toast?.classList.contains("hidden")).toBe(false);
    const detailBtn = mount.querySelector(
      '[data-action="recruit-open-hero-detail"]',
    ) as HTMLButtonElement;
    expect(detailBtn.hidden).toBe(false);
    expect(detailBtn.getAttribute("data-hero-id")).toBe("99");
    expect(sessionStorage.getItem("hero-detail-selected-id")).toBe("99");
    const row = mount.querySelector('li[data-hero-id="99"]');
    expect(row?.classList.contains("hero-row-recruited-pulse")).toBe(true);
  });

  it("appends world panel hint when mail body has coordinates", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [{ mail_id: 2, title: "侦察", status: 1, body: "目标 (20,30)" }],
        total_count: 1,
      }),
      markPlayerMailRead: vi.fn(),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      (s) => statuses.push(s),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    expect(statuses.some((s) => s.includes("可在世界面板查看"))).toBe(true);
  });

  it("batch claim calls claim RPC in list order and summarizes results", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const hudSnaps: { count: number; firstId: number }[] = [];
    const claimPlayerMailAttachments = vi
      .fn()
      .mockResolvedValueOnce({
        mail: { mail_id: 20, status: 2 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      })
      .mockRejectedValueOnce(Object.assign(new Error("附件已领"), { code: 40012 }));
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 20,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
          {
            mail_id: 21,
            status: 0,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 2,
      })
      .mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      (msg) => statuses.push(msg),
      undefined,
      undefined,
      undefined,
      (snap) => hudSnaps.push(snap),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    const boxes = mount.querySelectorAll('input[data-role="mail-batch-checkbox"]');
    expect(boxes.length).toBe(2);
    (boxes[1] as HTMLInputElement).checked = true;
    boxes[1].dispatchEvent(new Event("change", { bubbles: true }));
    (boxes[0] as HTMLInputElement).checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    mount.querySelector('[data-action="claim-mail-batch"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(claimPlayerMailAttachments).toHaveBeenCalledTimes(2);
    expect(claimPlayerMailAttachments.mock.calls[0][1]).toBe(20);
    expect(claimPlayerMailAttachments.mock.calls[1][1]).toBe(21);
    expect(statuses.some((s) => s.includes("批量领取") && s.includes("成功 1 封"))).toBe(true);
    expect(statuses.some((s) => s.includes("失败 1 封"))).toBe(true);
    expect(mount.querySelector('[data-role="mail-form-error"]')?.textContent).toContain("[40012]");
    expect(hudSnaps.length).toBeGreaterThan(0);
  });

  it("claim all attachments calls RPC for every claimable row on current tab", async () => {
    const mount = document.createElement("div");
    const statuses: string[] = [];
    const inboxSnaps: MailRow[][] = [];
    const claimPlayerMailAttachments = vi.fn().mockResolvedValue({
      mail: { mail_id: 30, status: 2 },
      granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
    });
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 30,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
          {
            mail_id: 31,
            status: 0,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 2,
      }),
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      (msg) => statuses.push(msg),
      undefined,
      undefined,
      undefined,
      undefined,
      (mails) => inboxSnaps.push(mails.slice()),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="claim-mail-all"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(claimPlayerMailAttachments).toHaveBeenCalledTimes(2);
    expect(claimPlayerMailAttachments.mock.calls[0][1]).toBe(30);
    expect(claimPlayerMailAttachments.mock.calls[1][1]).toBe(31);
    expect(statuses.some((s) => s.includes("批量领取") && s.includes("成功 2 封"))).toBe(true);
    expect(inboxSnaps.length).toBeGreaterThan(0);
  });

  it("marks failed batch claim rows with mail-claim-error", async () => {
    const mount = document.createElement("div");
    const claimPlayerMailAttachments = vi
      .fn()
      .mockResolvedValueOnce({
        mail: { mail_id: 40, status: 2 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      })
      .mockRejectedValueOnce(Object.assign(new Error("附件已领"), { code: 40012 }));
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [
          {
            mail_id: 40,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
          {
            mail_id: 41,
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 2,
      }),
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="claim-mail-all"]')?.dispatchEvent(
      new Event("click", { bubbles: true }),
    );
    await flushPromises();
    expect(mount.querySelector('.mail-list [data-mail-id="41"]')?.classList.contains("mail-claim-error")).toBe(
      true,
    );
  });

  it("shows 查看战报 when mail body has report_id and opens deep link", async () => {
    const mount = document.createElement("div");
    const onOpenBattleReport = vi.fn();
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
        mails: [{ mail_id: 5, title: "战报", status: 1, body: "report_id=77" }],
        total_count: 1,
      }),
      markPlayerMailRead: vi.fn(),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => sessionBase(),
      () => {},
      () => {},
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      onOpenBattleReport,
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    const btn = mount.querySelector('[data-action="mail-open-battle-report"]') as HTMLButtonElement;
    expect(btn?.hidden).toBe(false);
    expect(btn?.dataset.reportId).toBe("77");
    btn?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(onOpenBattleReport).toHaveBeenCalledWith(77);
  });

  it("openFromTodoBadge selects first unread with unread filter", async () => {
    const mount = document.createElement("div");
    const listPlayerMail = vi.fn().mockResolvedValue({
      mails: [
        { mail_id: 9, title: "A", status: 0, body: "a" },
        { mail_id: 10, title: "B", status: 0, body: "b" },
      ],
      total_count: 2,
    });
    const markPlayerMailRead = vi.fn().mockResolvedValue({ mail: { mail_id: 9, status: 1 } });
    const gateway: GatewayPort = {
      listPlayerMail,
      markPlayerMailRead,
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.openFromTodoBadge(9);
    await flushPromises();
    await flushPromises();
    expect(listPlayerMail).toHaveBeenCalledWith(1, {
      filter: MAIL_INBOX_FILTER_UNREAD,
      pageSize: 50,
    });
    expect(mount.querySelector(".mail-inbox-panel")?.classList.contains("hidden")).toBe(false);
    expect(markPlayerMailRead).toHaveBeenCalledWith(1, 9);
  });
});
