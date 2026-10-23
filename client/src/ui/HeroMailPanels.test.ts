import { describe, expect, it, vi } from "vitest";
import type { GatewayPort } from "@/net/GatewayClient";
import type { MainCitySession } from "@/net/bootstrapSession";
import { HeroMailPanels } from "@/ui/HeroMailPanels";
import { MAIL_INBOX_FILTER_UNREAD } from "@/net/heroMailState";

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
    expect(ul?.textContent).toContain("收件箱为空");
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
    const pre = mount.querySelector('[data-role="hero-detail"]');
    expect(pre?.textContent).toContain("玄德");
    expect(pre?.textContent).toContain("UseConsumable");
  });

  it("claim success updates session bag via patch", async () => {
    const mount = document.createElement("div");
    let patched: Partial<MainCitySession> | null = null;
    const gateway: GatewayPort = {
      listPlayerMail: vi.fn().mockResolvedValue({
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
      () => {},
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(gateway.claimPlayerMailAttachments).toHaveBeenCalledWith(1, 7);
    expect(patched?.bag).toEqual([{ item_cfg_id: 2001, quantity: 2 }]);
    expect(patched?.wallet?.gold).toBe(50);
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
    expect(listPlayerMail).toHaveBeenLastCalledWith(1, {
      filter: MAIL_INBOX_FILTER_UNREAD,
      pageSize: 50,
    });
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
});
