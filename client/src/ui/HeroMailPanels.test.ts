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
    expect(ul?.textContent).toContain("暂无邮件");
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
    const detail = mount.querySelector('[data-role="hero-detail"]');
    expect(detail?.querySelector(".hero-detail-name")?.textContent).toContain("玄德");
    expect(detail?.querySelector(".hero-detail-level")?.textContent).toContain("Lv2");
    expect(detail?.querySelector(".hero-attr-table")).toBeTruthy();
    expect(detail?.textContent).toContain("UseConsumable");
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
    expect(preview?.textContent).toContain("持");
    const recruitBtn = mount.querySelector('[data-action="recruit-hero"]') as HTMLButtonElement;
    expect(recruitBtn.disabled).toBe(true);
    const errEl = mount.querySelector('[data-role="recruit-form-error"]');
    expect(errEl?.textContent).toContain("不足");
    mount.querySelector('li[data-template-id="1002"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(preview?.textContent).toContain("云长");
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
    expect(onBag).toHaveBeenCalledWith([2017]);
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
    expect(mount.querySelector(".mail-unclaimed-badge")).toBeNull();
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
    expect(mount.querySelector(".mail-unclaimed-badge")?.textContent).toBe("未领取");
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
    expect(mount.querySelector(".mail-unclaimed-badge")).toBeNull();
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
    expect(recruitBtn.textContent).toBe("提交中…");
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
    const session: MainCitySession = {
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
      () => {},
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
    expect(gateway.getHeroDetail).toHaveBeenCalledWith(1, 99);
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
