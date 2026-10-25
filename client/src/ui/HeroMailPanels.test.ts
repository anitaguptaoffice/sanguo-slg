import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetLoader } from "@/engine/AssetLoader";
import {
  heroAvatarAssetId,
  heroBustAssetId,
  HERO_DETAIL_BUST_ROLE,
  HERO_LIST_AVATAR_ROLE,
} from "@/engine/heroPortraitFrameSkin";
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
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
  readHeroListFilterChipResidualSession,
} from "@/net/heroListFilterChipResidual";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
  readHeroListFilterChipResidualDeepSession,
} from "@/net/heroListFilterChipResidualDeep";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepest";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestSession,
} from "@/net/heroListFilterChipResidualDeepest";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeeperSession,
} from "@/net/heroListFilterChipResidualDeeper";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeepestDeeperSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeepestDeeperSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestDeeperSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepestSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeeperSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualDeepSweep";
import {
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE,
} from "@/net/heroPanelStateResidualSweep";
import { PANEL_GATEWAY_RETRY_CLASS } from "@/net/panelGatewayError";
import { HERO_DETAIL_STAT_PULSE_CLASS } from "@/net/heroDetailCultivationUse";
import { USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL } from "@/net/useConsumableSubmitFeedback";
import {
  RECRUIT_FORM_INLINE_WARN_CLASS,
  RECRUIT_GOTO_BAG_ITEM_GAP_ACTION,
} from "@/net/recruitFormInlineHint";
import {
  MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE,
  MAIL_TAB_HUD_SYNC_PULSE_CLASS,
  MAIL_TAB_UNREAD_SWEEP_ROLE,
} from "@/net/mailTabUnreadSweep";
import {
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
} from "@/net/mailClaimHudBadgeSync";
import {
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_ROLE,
} from "@/net/mailAttachmentClaimResidualSubline";
import { MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_ROLE } from "@/net/mailAttachmentClaimResidualDeepSubline";
import { MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_ROLE } from "@/net/mailAttachmentClaimResidualDeeperSubline";
import { MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_ROLE } from "@/net/mailAttachmentClaimResidualDeepestSubline";
import { MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE } from "@/net/mailAttachmentClaimResidualDeepestDeeperSubline";
import { MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE } from "@/net/mailAttachmentClaimResidualDeepestDeepestDeeperSubline";
import {
  MAIL_BATTLE_CATEGORY_SWEEP_ROLE,
  MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY,
} from "@/net/mailBattleCategory";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";

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
    sessionStorage.removeItem(MAIL_BATTLE_CATEGORY_TAB_SESSION_KEY);
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

  it("mail panel exposes battle/system category tabs and sweep line (CLIENT-225)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.openMailPanel();
    expect(mount.querySelector('[data-action="mail-category-battle"]')).toBeTruthy();
    expect(mount.querySelector('[data-action="mail-category-system"]')).toBeTruthy();
    expect(mount.querySelector(`[data-role="${MAIL_BATTLE_CATEGORY_SWEEP_ROLE}"]`)).toBeTruthy();
  });

  it("mail panel exposes HUD todo sweep lines (CLIENT-209)", () => {
    const mount = document.createElement("div");
    const gateway = { getBoundServerId: () => 1 } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.openMailPanel();
    panels.syncMailTabHudTodoLinkage({
      dailyRows: [{ quest_cfg_id: 42, state: DAILY_QUEST_STATE_CLAIMABLE }],
      stamp: 1700000000001,
      pulse: false,
    });
    expect(mount.querySelector(`[data-role="${MAIL_TAB_UNREAD_SWEEP_ROLE}"]`)).toBeTruthy();
    expect(mount.querySelector(`[data-role="${MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE}"]`)).toBeTruthy();
    const combined = mount.querySelector(`[data-role="${MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE}"]`);
    expect(combined?.textContent).toContain("日常可领 1 · #42");
  });

  it("mail claim success applies mail-claim-hud-sync-pulse and refreshes HUD sweep (CLIENT-241)", async () => {
    const mount = document.createElement("div");
    const inboxSnaps: MailRow[][] = [];
    const listPlayerMail = vi
      .fn()
      .mockResolvedValueOnce({
        mails: [
          {
            mail_id: 71,
            title: "奖",
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
          {
            mail_id: 72,
            title: "奖2",
            status: 1,
            attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
          },
        ],
        total_count: 2,
      })
      .mockResolvedValue({ mails: [], total_count: 0 });
    const gateway: GatewayPort = {
      listPlayerMail,
      listPlayerBag: vi.fn().mockResolvedValue({ items: [] }),
      claimPlayerMailAttachments: vi.fn().mockResolvedValue({
        mail: { mail_id: 71, status: 2, has_unclaimed_attachments: false },
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
      undefined,
      undefined,
      undefined,
      undefined,
      (mails) => inboxSnaps.push(mails.map((m) => ({ ...m }))),
    );
    panels.attach();
    panels.toggleMail();
    await flushPromises();
    panels.syncMailTabHudTodoLinkage({
      dailyRows: [{ quest_cfg_id: 42, state: DAILY_QUEST_STATE_CLAIMABLE }],
      stamp: 1,
      pulse: false,
    });
    mount.querySelector('[data-action="claim-mail"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const row = mount.querySelector('.mail-list li[data-mail-id="71"]');
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(true);
    expect(row?.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      row?.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    expect(
      row?.querySelector(`[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_ROLE}"]`)?.textContent,
    ).toContain("附件残余");
    expect(
      row?.querySelector(`[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_ROLE}"]`)?.textContent,
    ).toContain("附件残余加深");
    expect(
      row?.querySelector(`[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_ROLE}"]`)
        ?.textContent,
    ).toContain("巩固再加深");
    expect(
      row?.querySelector(`[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_SUBLINE_ROLE}"]`)
        ?.textContent,
    ).toContain("巩固再加深一层");
    expect(
      row?.querySelector(`[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE}"]`)
        ?.textContent,
    ).toContain("巩固再加深二层");
    expect(
      row?.querySelector(
        `[data-role="${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE}"]`,
      )?.textContent,
    ).toContain("巩固再加深三层");
    const combined = mount.querySelector(`[data-role="${MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE}"]`);
    expect(combined?.textContent).toContain("未领附件 1");
    expect(combined?.textContent).toContain("日常可领 1 · #42");
    expect(combined?.classList.contains(MAIL_TAB_HUD_SYNC_PULSE_CLASS)).toBe(true);
    expect(inboxSnaps.at(-1)?.find((m) => m.mail_id === 71)?.has_unclaimed_attachments).toBe(false);
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

  it("mounts placeholder avatar/bust frames for template 1001 when art assets load", async () => {
    const mount = document.createElement("div");
    const img = { src: "https://example.test/av.png" } as HTMLImageElement;
    const bustImg = { src: "https://example.test/bu.png" } as HTMLImageElement;
    const assets = {
      getArtMeta: vi.fn((id: string) => {
        if (id === heroAvatarAssetId(1001)) {
          return { id, display_size: { w: 56, h: 56 }, anchor: { x: 28, y: 48 }, anchor_unit: "pixels" };
        }
        if (id === heroBustAssetId(1001)) {
          return { id, display_size: { w: 128, h: 160 }, anchor: { x: 64, y: 152 }, anchor_unit: "pixels" };
        }
        return undefined;
      }),
      getImageForAsset: vi.fn((id: string) => {
        if (id === heroAvatarAssetId(1001)) return { img, scale: 1 };
        if (id === heroBustAssetId(1001)) return { img: bustImg, scale: 1 };
        return undefined;
      }),
    } as unknown as AssetLoader;
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [
          { hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 77 },
          { hero_id: 4, template_cfg_id: 1002, level: 1, loyalty: 50 },
        ],
        total_count: 2,
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
      undefined,
      undefined,
      assets,
    );
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const row1001 = mount.querySelector('li[data-hero-id="3"]');
    const row1002 = mount.querySelector('li[data-hero-id="4"]');
    expect(row1001?.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`)).toBeTruthy();
    expect(row1002?.querySelector(`[data-role="${HERO_LIST_AVATAR_ROLE}"]`)).toBeNull();
    row1001?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const detail = mount.querySelector('[data-role="hero-detail"]');
    expect(detail?.querySelector(`[data-role="${HERO_DETAIL_BUST_ROLE}"]`)).toBeTruthy();
    expect(detail?.querySelector(".hero-detail-head")?.previousElementSibling?.getAttribute("data-role")).toBe(
      HERO_DETAIL_BUST_ROLE,
    );
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
    const loyaltySubline = row?.querySelector('[data-role="hero-list-loyalty-subline"]');
    expect(loyaltySubline?.textContent).toContain("忠诚 77");
    expect(loyaltySubline?.textContent).toContain("可出征");
    expect(loyaltySubline?.querySelector(".hero-loyalty-warn-dot")).toBeNull();
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

  it("hero list loyalty residual deep subline consolidates exp and CLIENT-246 scan (CLIENT-262)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deep = mount.querySelector('[data-role="hero-list-loyalty-residual-deep-subline"]');
    expect(deep?.textContent).toContain("忠诚深巩固");
    expect(deep?.textContent).toContain("经验 12/80");
    expect(mount.querySelector('[data-role="hero-list-loyalty-residual-subline"]')).toBeTruthy();
    const deepSweep = mount.querySelector('[data-role="hero-detail-consumable-stack-residual-deep-sweep"]');
    expect(deepSweep?.textContent).toContain("堆叠深扫读");
    expect(deepSweep?.classList.contains("hero-detail-consumable-stack-residual-deep-sweep-ring")).toBe(
      true,
    );
    panels.detach();
  });

  it("hero list loyalty residual deeper subline and consumable deeper sweep (CLIENT-278)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deeper = mount.querySelector('[data-role="hero-list-loyalty-residual-deeper-subline"]');
    expect(deeper?.textContent).toContain("忠诚巩固再加深");
    expect(deeper?.textContent).toContain("经验 12/80");
    expect(mount.querySelector('[data-role="hero-list-loyalty-residual-deep-subline"]')).toBeTruthy();
    const deeperSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deeper-sweep"]',
    );
    expect(deeperSweep?.textContent).toContain("堆叠巩固再加深");
    expect(
      deeperSweep?.classList.contains("hero-detail-consumable-stack-residual-deeper-sweep-ring"),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest subline and consumable deepest sweep (CLIENT-294)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepest = mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-subline"]');
    expect(deepest?.textContent).toContain("忠诚巩固再加深一层");
    expect(deepest?.textContent).toContain("经验 12/80");
    expect(mount.querySelector('[data-role="hero-list-loyalty-residual-deeper-subline"]')).toBeTruthy();
    const deepestSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-sweep"]',
    );
    expect(deepestSweep?.textContent).toContain("堆叠巩固再加深一层");
    expect(
      deepestSweep?.classList.contains("hero-detail-consumable-stack-residual-deepest-sweep-ring"),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest-deeper subline and consumable deepest-deeper sweep (CLIENT-310)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepestDeeper = mount.querySelector(
      '[data-role="hero-list-loyalty-residual-deepest-deeper-subline"]',
    );
    expect(deepestDeeper?.textContent).toContain("忠诚巩固再加深二层");
    expect(deepestDeeper?.textContent).toContain("经验 12/80");
    expect(mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-subline"]')).toBeTruthy();
    const deepestDeeperSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-deeper-sweep"]',
    );
    expect(deepestDeeperSweep?.textContent).toContain("堆叠巩固再加深二层");
    expect(
      deepestDeeperSweep?.classList.contains(
        "hero-detail-consumable-stack-residual-deepest-deeper-sweep-ring",
      ),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest-deepest-deeper subline and consumable deepest-deepest-deeper sweep (CLIENT-326)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepestDeepestDeeper = mount.querySelector(
      '[data-role="hero-list-loyalty-residual-deepest-deepest-deeper-subline"]',
    );
    expect(deepestDeepestDeeper?.textContent).toContain("忠诚巩固再加深三层");
    expect(deepestDeepestDeeper?.textContent).toContain("经验 12/80");
    expect(
      mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-deeper-subline"]'),
    ).toBeTruthy();
    const deepestDeepestDeeperSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep"]',
    );
    expect(deepestDeepestDeeperSweep?.textContent).toContain("堆叠巩固再加深三层");
    expect(
      deepestDeepestDeeperSweep?.classList.contains(
        "hero-detail-consumable-stack-residual-deepest-deepest-deeper-sweep-ring",
      ),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest-deepest-deepest subline and consumable deepest-deepest-deepest sweep (CLIENT-342)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepestDeepestDeepest = mount.querySelector(
      '[data-role="hero-list-loyalty-residual-deepest-deepest-deepest-subline"]',
    );
    expect(deepestDeepestDeepest?.textContent).toContain("忠诚巩固再加深四层");
    expect(deepestDeepestDeepest?.textContent).toContain("经验 12/80");
    expect(
      mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-deepest-deeper-subline"]'),
    ).toBeTruthy();
    const deepestDeepestDeepestSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-deepest-deepest-sweep"]',
    );
    expect(deepestDeepestDeepestSweep?.textContent).toContain("堆叠巩固再加深四层");
    expect(
      deepestDeepestDeepestSweep?.classList.contains(
        "hero-detail-consumable-stack-residual-deepest-deepest-deepest-sweep-ring",
      ),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest-deepest-deepest-deeper subline and consumable deepest-deepest-deepest-deeper sweep (CLIENT-358)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepestDeepestDeepestDeeper = mount.querySelector(
      '[data-role="hero-list-loyalty-residual-deepest-deepest-deepest-deeper-subline"]',
    );
    expect(deepestDeepestDeepestDeeper?.textContent).toContain("忠诚巩固再加深五层");
    expect(deepestDeepestDeepestDeeper?.textContent).toContain("经验 12/80");
    expect(
      mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-deepest-deepest-subline"]'),
    ).toBeTruthy();
    const deepestDeepestDeepestDeeperSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-deepest-deepest-deeper-sweep"]',
    );
    expect(deepestDeepestDeepestDeeperSweep?.textContent).toContain("堆叠巩固再加深五层");
    expect(
      deepestDeepestDeepestDeeperSweep?.classList.contains(
        "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deeper-sweep-ring",
      ),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual deepest-deepest-deepest-deepest-deeper subline and consumable deepest-deepest-deepest-deepest-deeper sweep (CLIENT-374)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 2,
        template_cfg_id: 1002,
        level: 9,
        loyalty: 10,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 12,
        exp_to_next: 80,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(
      mount,
      gateway,
      () => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2017, quantity: 2 }],
      }),
      () => {},
      () => {},
    );
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    mount.querySelector('li[data-hero-id="2"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const deepestDeepestDeepestDeepestDeeper = mount.querySelector(
      '[data-role="hero-list-loyalty-residual-deepest-deepest-deepest-deepest-deeper-subline"]',
    );
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toContain("忠诚巩固再加深五层");
    expect(deepestDeepestDeepestDeepestDeeper?.textContent).toContain("经验 12/80");
    expect(
      mount.querySelector('[data-role="hero-list-loyalty-residual-deepest-deepest-deepest-deeper-subline"]'),
    ).toBeTruthy();
    const deepestDeepestDeepestDeepestDeeperSweep = mount.querySelector(
      '[data-role="hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-deeper-sweep"]',
    );
    expect(deepestDeepestDeepestDeepestDeeperSweep?.textContent).toContain("堆叠巩固再加深五层");
    expect(
      deepestDeepestDeepestDeepestDeeperSweep?.classList.contains(
        "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-deeper-sweep-ring",
      ),
    ).toBe(true);
    panels.detach();
  });

  it("hero list loyalty residual subline shows warn dot and threshold scan (CLIENT-246)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const residual = mount.querySelector('[data-role="hero-list-loyalty-residual-subline"]');
    expect(residual?.textContent).toContain("忠诚残余");
    expect(residual?.textContent).toContain("低忠诚警示");
    expect(residual?.querySelector(".hero-loyalty-residual-warn-dot")).toBeTruthy();
    const mainSubline = mount.querySelector('[data-role="hero-list-loyalty-subline"]');
    expect(mainSubline?.textContent).toContain("不可出征");
    panels.detach();
  });

  it("hero list loyalty subline shows warn dot when deployable threshold not met (CLIENT-213)", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 2, template_cfg_id: 1002, level: 9, loyalty: 10, morale: 40 }],
        total_count: 1,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    const subline = mount.querySelector('[data-role="hero-list-loyalty-subline"]');
    expect(subline?.textContent).toContain("不可出征");
    expect(subline?.textContent).toContain("士气 40");
    expect(subline?.querySelector(".hero-loyalty-warn-dot")).toBeTruthy();
    panels.detach();
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
    expect(
      mount.querySelector('li[data-hero-id="3"]')?.classList.contains("hero-list-return-highlight"),
    ).toBe(true);
    expect(readHeroListReturnState()).toBeNull();
    expect(scroll.scrollTop).toBe(64);
    expect(readHeroListFilterSession()).toBe("deployable");
    expect(readHeroListSortSession()).toBe("loyalty_desc");
    sessionStorage.removeItem(HERO_LIST_RETURN_SESSION_KEY);
    sessionStorage.removeItem(HERO_DETAIL_SELECTED_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
  });

  it("hero-panel-state-residual-deepest-deepest-deepest-deeper-sweep and filter chip deepest-deepest-deepest-deeper session (CLIENT-359)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepestDeepestDeepestDeeperResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`,
    );
    expect(deepestDeepestDeepestDeeperResidual?.textContent).toContain("panelState巩固再加深五层");
    expect(deepestDeepestDeepestDeeperResidual?.textContent).toContain("CLIENT-343");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(
      sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY),
    ).toBeTruthy();
    expect(
      mount.querySelector(
        '[data-role="hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-sweep"]',
      )?.textContent,
    ).toContain("筛选巩固再加深五层");
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deepest-deepest-deepest-sweep and filter chip deepest-deepest-deepest session (CLIENT-343)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepestDeepestDeepestResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`,
    );
    expect(deepestDeepestDeepestResidual?.textContent).toContain("panelState巩固再加深四层");
    expect(deepestDeepestDeepestResidual?.textContent).toContain("CLIENT-327");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepestDeepestDeepestSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(
      sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY),
    ).toBeTruthy();
    expect(
      mount.querySelector(
        '[data-role="hero-list-filter-chip-residual-deepest-deepest-deepest-sweep"]',
      )?.textContent,
    ).toContain("筛选巩固再加深四层");
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deepest-deepest-deeper-sweep and filter chip deepest-deepest-deeper session (CLIENT-327)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepestDeepestDeeperResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`,
    );
    expect(deepestDeepestDeeperResidual?.textContent).toContain("panelState巩固再加深三层");
    expect(deepestDeepestDeeperResidual?.textContent).toContain("CLIENT-311");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepestDeepestDeeperSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(
      sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY),
    ).toBeTruthy();
    expect(
      mount.querySelector(
        '[data-role="hero-list-filter-chip-residual-deepest-deepest-deeper-sweep"]',
      )?.textContent,
    ).toContain("筛选巩固再加深三层");
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deepest-deeper-sweep and filter chip deepest-deeper session (CLIENT-311)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepestDeeperResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`,
    );
    expect(deepestDeeperResidual?.textContent).toContain("panelState巩固再加深二层");
    expect(deepestDeeperResidual?.textContent).toContain("CLIENT-295");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepestDeeperSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(
      mount.querySelector('[data-role="hero-list-filter-chip-residual-deepest-deeper-sweep"]')?.textContent,
    ).toContain("筛选巩固再加深二层");
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deepest-sweep and filter chip deepest session (CLIENT-295)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepestResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS}`,
    );
    expect(deepestResidual?.textContent).toContain("panelState巩固再加深一层");
    expect(deepestResidual?.textContent).toContain("CLIENT-279");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepestSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(mount.querySelector('[data-role="hero-list-filter-chip-residual-deepest-sweep"]')?.textContent).toContain(
      "筛选巩固再加深一层",
    );
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deeper-sweep and filter chip deeper session (CLIENT-279)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deeperResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS}`,
    );
    expect(deeperResidual?.textContent).toContain("panelState巩固再加深");
    expect(deeperResidual?.textContent).toContain("CLIENT-173");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeeperSession()?.lastChipAction).toBe(
      "hero-filter-deployable",
    );
    expect(sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(mount.querySelector('[data-role="hero-list-filter-chip-residual-deeper-sweep"]')?.textContent).toContain(
      "筛选巩固再加深",
    );
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-deep-sweep and filter chip deep session (CLIENT-263)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const deepResidual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS}`,
    );
    expect(deepResidual?.textContent).toContain("panelState巩固");
    expect(deepResidual?.textContent).toContain("网关重试 hint");
    expect(
      mount.querySelector(
        `[data-role="${HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS}`,
      ),
    ).toBeTruthy();
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualDeepSession()?.lastChipAction).toBe("hero-filter-deployable");
    expect(sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(mount.querySelector('[data-role="hero-list-filter-chip-residual-deep-sweep"]')?.textContent).toContain(
      "筛选巩固",
    );
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
  });

  it("hero-panel-state-residual-sweep and filter chip residual session (CLIENT-247)", async () => {
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_FILTER_SESSION_KEY);
    sessionStorage.removeItem(HERO_LIST_SORT_SESSION_KEY);
    const mount = document.createElement("div");
    const err = Object.assign(new Error("网关超时"), { code: 10001 });
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockRejectedValue(err),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    await flushPromises();
    await flushPromises();
    const residual = mount.querySelector(
      `[data-role="${HERO_PANEL_STATE_RESIDUAL_SWEEP_ROLE}"].${HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS}`,
    );
    expect(residual?.textContent).toContain("刷新列表");
    expect(
      mount.querySelector(
        `button.${PANEL_GATEWAY_RETRY_CLASS}[data-action="retry-refresh-heroes"]`,
      ),
    ).toBeTruthy();
    const errEl = mount.querySelector('[data-role="hero-list-form-error"]');
    expect(errEl?.textContent).toContain("[10001]");
    mount
      .querySelector('[data-action="hero-filter-deployable"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
    expect(readHeroListFilterChipResidualSession()?.lastChipAction).toBe("hero-filter-deployable");
    expect(sessionStorage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(HERO_LIST_FILTER_SESSION_KEY)).toBe("deployable");
    expect(mount.querySelector('[data-role="hero-list-filter-chip-residual-sweep"]')?.textContent).toContain(
      "可出征",
    );
    sessionStorage.removeItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
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

  it("hero largess refreshes loyalty, sets cooldown, and blocks re-submit", async () => {
    const mount = document.createElement("div");
    let loyalty = 60;
    const nextAtByCall: number[] = [];
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
      largessHero: vi.fn().mockImplementation(async () => {
        loyalty = 75;
        const next = Date.now() + 900_000;
        nextAtByCall.push(next);
        return {
          hero_id: 3,
          loyalty: 75,
          loyalty_delta: 15,
          gold_spent: 200,
          next_largess_at_ms: next,
        };
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session: MainCitySession = {
      serverId: 1,
      cityId: 1,
      cityName: "城",
      wallet: { gold: 50_000 },
      buildings: [],
      cityTroops: [],
      bag: [],
    };
    const panels = new HeroMailPanels(mount, gateway, () => session, () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const submitBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-largess-submit"]');
    expect(submitBtn?.disabled).toBe(false);
    submitBtn?.click();
    await flushPromises();
    expect(gateway.largessHero).toHaveBeenCalledWith(1, 3, 1, 0);
    expect(mount.querySelector('[data-role="hero-largess-success"]')?.textContent).toContain("60→75");
    expect(mount.querySelector('li[data-hero-id="3"]')?.textContent).toContain("忠诚 75");
    expect(mount.querySelector('[data-role="hero-largess-cd"]')?.textContent).toContain("赏赐冷却");
    mount.querySelector<HTMLButtonElement>('[data-action="hero-largess-submit"]')?.click();
    await flushPromises();
    expect(gateway.largessHero).toHaveBeenCalledTimes(1);
    expect(nextAtByCall.length).toBe(1);
  });

  it("hero detail expr begin/cancel/faster calls BeginHeroExpr CancelHeroExpr FasterHeroExpr", async () => {
    const mount = document.createElement("div");
    const endsAt = Date.now() + 3_600_000;
    let status = 1;
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 11, template_cfg_id: 1001, level: 4, loyalty: 80, status }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockImplementation(async () => ({
        hero_id: 11,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 4,
        loyalty: 80,
        status,
        exp: 100,
      })),
      beginHeroExpr: vi.fn().mockImplementation(async () => {
        status = 4;
        return {
          hero_id: 11,
          status: 4,
          ends_at_ms: endsAt,
          gold_spent: 40,
          hours: 2,
        };
      }),
      cancelHeroExpr: vi.fn().mockResolvedValue({ hero_id: 11, status: 1 }),
      fasterHeroExpr: vi.fn().mockResolvedValue({
        hero_id: 11,
        status: 1,
        exp_gained: 160,
        exp: 260,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const session = { ...sessionBase(), wallet: { gold: 10_000 } };
    const onSessionPatch = vi.fn();
    const panels = new HeroMailPanels(mount, gateway, () => session, onSessionPatch, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="11"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const beginBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-expr-begin"]');
    expect(beginBtn?.disabled).toBe(false);
    mount.querySelector<HTMLButtonElement>('[data-action="hero-expr-hours"][data-hours="2"]')?.click();
    beginBtn?.click();
    await flushPromises();
    expect(gateway.beginHeroExpr).toHaveBeenCalledWith(1, 11, 2);
    expect(mount.querySelector('[data-role="hero-expr-success"]')?.textContent).toContain("开始历练");
    const cancelBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-expr-cancel"]');
    cancelBtn?.click();
    await flushPromises();
    expect(gateway.cancelHeroExpr).toHaveBeenCalledWith(1, 11);
    status = 4;
    mount.querySelector<HTMLButtonElement>('[data-action="hero-expr-begin"]')?.click();
    await flushPromises();
    mount.querySelector<HTMLButtonElement>('[data-action="hero-expr-faster"]')?.click();
    await flushPromises();
    expect(gateway.fasterHeroExpr).toHaveBeenCalledWith(1, 11);
    expect(mount.querySelector('[data-role="hero-expr-success"]')?.textContent).toContain("加速完成");
  });

  it("hero detail force rest calls RestHero and refreshes march_force", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 80, status: 1 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 9,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 3,
        loyalty: 80,
        status: 1,
        march_force: 8,
        march_force_max: 32,
        attributes: { force: 65, intel: 59, politics: 56, command: 61 },
      }),
      restHero: vi.fn().mockResolvedValue({
        hero_id: 9,
        march_force: 32,
        march_force_max: 32,
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="9"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    expect(mount.querySelector('[data-role="hero-force-summary"]')?.textContent).toContain("8/32");
    const restBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]');
    expect(restBtn?.disabled).toBe(false);
    restBtn?.click();
    await flushPromises();
    expect(gateway.restHero).toHaveBeenCalledWith(1, 9);
    expect(mount.querySelector('[data-role="hero-force-success"]')?.textContent).toContain("休整成功");
    expect(mount.querySelector('[data-role="hero-force-summary"]')?.textContent).toContain("32/32");
  });

  it("hero detail points add/clear calls AddHeroPoint and ClearHeroPoint", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 7, template_cfg_id: 1001, level: 3, loyalty: 80, status: 1 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 7,
        template_cfg_id: 1001,
        template_name: "玄德",
        level: 3,
        loyalty: 80,
        status: 1,
        attributes: { force: 65, intel: 59, politics: 56, command: 61 },
      }),
      addHeroPoint: vi.fn().mockResolvedValue({
        hero_id: 7,
        potential_remaining: 2,
        force_add: 1,
        intel_add: 0,
        politics_add: 0,
        attributes: { force: 66, intel: 59, politics: 56, command: 61 },
      }),
      clearHeroPoint: vi.fn().mockResolvedValue({
        hero_id: 7,
        potential_remaining: 3,
        force_add: 0,
        intel_add: 0,
        politics_add: 0,
        attributes: { force: 65, intel: 59, politics: 56, command: 61 },
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="7"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const forceBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-point-add"][data-stat="force"]');
    expect(forceBtn?.disabled).toBe(false);
    forceBtn?.click();
    await flushPromises();
    expect(gateway.addHeroPoint).toHaveBeenCalledWith(1, 7, { force: 66, intel: 59, politics: 56 });
    expect(mount.querySelector('[data-role="hero-point-success"]')?.textContent).toContain("武力");
    const clearBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-point-clear"]');
    expect(clearBtn?.disabled).toBe(false);
    clearBtn?.click();
    await flushPromises();
    expect(gateway.clearHeroPoint).toHaveBeenCalledWith(1, 7);
    expect(mount.querySelector('[data-role="hero-point-success"]')?.textContent).toContain("洗点成功");
  });

  it("hero detail upgrade calls UpgradeHero, updates level/exp, and shows success", async () => {
    const mount = document.createElement("div");
    let level = 2;
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level, loyalty: 80 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockImplementation(async () => ({
        hero_id: 3,
        template_cfg_id: 1001,
        template_name: "玄德",
        level,
        loyalty: 80,
        exp_toward_next: 150,
        upgrade_exp_required: 100,
      })),
      upgradeHero: vi.fn().mockImplementation(async () => {
        level = 3;
        return {
          hero_id: 3,
          level: 3,
          previous_level: 2,
          exp: 200,
          exp_toward_next: 0,
          upgrade_exp_required: 300,
        };
      }),
      getBoundServerId: () => 1,
    } as unknown as GatewayPort;
    const onStatus = vi.fn();
    const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, onStatus);
    panels.attach();
    panels.toggleHero();
    mount.querySelector('[data-action="refresh-heroes"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    mount.querySelector('li[data-hero-id="3"]')?.dispatchEvent(new Event("click", { bubbles: true }));
    await flushPromises();
    const upgradeBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]');
    expect(upgradeBtn?.disabled).toBe(false);
    upgradeBtn?.click();
    await flushPromises();
    expect(gateway.upgradeHero).toHaveBeenCalledWith(1, 3);
    expect(mount.querySelector('[data-role="hero-upgrade-success"]')?.textContent).toContain("Lv2→Lv3");
    expect(mount.querySelector(".hero-detail-level")?.textContent).toBe("Lv3");
    expect(mount.querySelector('li[data-hero-id="3"]')?.textContent).toContain("Lv3");
  });

  it("hero upgrade at max level disables button with reason", async () => {
    const mount = document.createElement("div");
    const gateway: GatewayPort = {
      listPlayerHeroes: vi.fn().mockResolvedValue({
        heroes: [{ hero_id: 3, template_cfg_id: 1001, level: 20, loyalty: 80 }],
        total_count: 1,
      }),
      getHeroDetail: vi.fn().mockResolvedValue({
        hero_id: 3,
        level: 20,
        exp_toward_next: 0,
        upgrade_exp_required: 0,
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
    const upgradeBtn = mount.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]');
    expect(upgradeBtn?.disabled).toBe(true);
    expect(mount.querySelector('[data-role="hero-upgrade-disabled-reason"]')?.textContent).toMatch(/上限/);
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
    const compareLine = mount.querySelector('[data-role="recruit-wallet-compare-line"]');
    expect(compareLine?.textContent).toMatch(/需20.*持5/);
    expect(compareLine?.classList.contains("recruit-wallet-compare-deficit")).toBe(true);
    const compareResidual = mount.querySelector('[data-role="recruit-wallet-compare-residual-line"]');
    expect(compareResidual?.textContent).toContain("列表口径");
    expect(compareResidual?.classList.contains("recruit-wallet-compare-residual-deficit")).toBe(true);
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
            template_name: "刘备",
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
        template_name: "刘备",
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
    expect(statuses.some((s) => s.includes("刘备") && s.includes("日常"))).toBe(true);
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
    mount
      .querySelector('[data-action="mail-category-battle"]')
      ?.dispatchEvent(new Event("click", { bubbles: true }));
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

  describe("captive summon panel (CLIENT-hero-captive-001)", () => {
    it("loads captives when opening hero panel and runs try/sure summon flow", async () => {
      const mount = document.createElement("div");
      const listCaptiveHeroes = vi.fn().mockResolvedValue({
        captives: [
          {
            hero_id: 55,
            city_id: 1,
            display_name: "吕布",
            level: 8,
            loyalty: 20,
            attributes: { force: 95, intel: 30, politics: 10, command: 88 },
          },
        ],
      });
      const trySummonCaptive = vi.fn().mockResolvedValue({
        hero_id: 55,
        gold_cost: 800,
        items: [{ item_cfg_id: 2050, quantity: 1 }],
        summary: "招降吕布需要黄金800，道具2050×1。",
      });
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listCaptiveHeroes,
        trySummonCaptive,
        sureSummonCaptive: vi.fn().mockResolvedValue({
          hero_id: 99,
          display_name: "吕布",
          level: 8,
          loyalty: 70,
        }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const session = (): MainCitySession => ({
        ...sessionBase(),
        wallet: { gold: 5000 },
        bag: [{ item_cfg_id: 2050, quantity: 3 }],
      });
      const panels = new HeroMailPanels(mount, gateway, session, () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      expect(listCaptiveHeroes).toHaveBeenCalledWith(1);
      expect(trySummonCaptive).toHaveBeenCalledWith(1, 1, 55);
      const preview = mount.querySelector('[data-role="captive-hero-preview"]');
      expect(preview?.textContent).toContain("黄金800");
      const summonBtn = mount.querySelector('[data-action="captive-summon-confirm"]') as HTMLButtonElement;
      expect(summonBtn.disabled).toBe(false);
      summonBtn.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(gateway.sureSummonCaptive).toHaveBeenCalledWith(1, 1, 55);
      expect(gateway.listPlayerHeroes).toHaveBeenCalled();
    });

    it("shows readable error for capacity full on sure summon", async () => {
      const mount = document.createElement("div");
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listCaptiveHeroes: vi.fn().mockResolvedValue({
          captives: [{ hero_id: 2, city_id: 1, display_name: "张辽", level: 5 }],
        }),
        trySummonCaptive: vi.fn().mockResolvedValue({
          hero_id: 2,
          gold_cost: 0,
          items: [],
          summary: "招降张辽免费。",
        }),
        sureSummonCaptive: vi.fn().mockRejectedValue(new Error("hero: hero capacity full (office level)")),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      mount.querySelector('[data-action="captive-summon-confirm"]')?.dispatchEvent(
        new Event("click", { bubbles: true }),
      );
      await flushPromises();
      expect(mount.querySelector('[data-role="captive-hero-form-error"]')?.textContent).toContain(
        "招贤馆容量已满",
      );
    });
  });

  describe("coming hero panel (CLIENT-hero-coming-001)", () => {
    it("loads coming heroes when opening hero panel and runs try/sure accept flow", async () => {
      const mount = document.createElement("div");
      const listComingHeroes = vi.fn().mockResolvedValue({
        coming: [
          {
            hero_id: 77,
            city_id: 1,
            display_name: "黄忠",
            level: 15,
            loyalty: 60,
            attributes: { force: 88, intel: 40, politics: 20, command: 75 },
          },
        ],
      });
      const tryAcceptComing = vi.fn().mockResolvedValue({
        hero_id: 77,
        summary: "是否接受将领黄忠加入麾下？",
      });
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listCaptiveHeroes: vi.fn().mockResolvedValue({ captives: [] }),
        listComingHeroes,
        tryAcceptComing,
        sureAcceptComing: vi.fn().mockResolvedValue({
          hero_id: 88,
          display_name: "黄忠",
          level: 15,
          loyalty: 70,
        }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      expect(listComingHeroes).toHaveBeenCalledWith(1);
      expect(tryAcceptComing).toHaveBeenCalledWith(1, 1, 77);
      const preview = mount.querySelector('[data-role="coming-hero-preview"]');
      expect(preview?.textContent).toContain("黄忠");
      const acceptBtn = mount.querySelector('[data-action="coming-accept-confirm"]') as HTMLButtonElement;
      expect(acceptBtn.disabled).toBe(false);
      acceptBtn.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(gateway.sureAcceptComing).toHaveBeenCalledWith(1, 1, 77);
      expect(gateway.listPlayerHeroes).toHaveBeenCalled();
    });

    it("shows readable error for capacity full on sure accept", async () => {
      const mount = document.createElement("div");
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listCaptiveHeroes: vi.fn().mockResolvedValue({ captives: [] }),
        listComingHeroes: vi.fn().mockResolvedValue({
          coming: [{ hero_id: 5, city_id: 1, display_name: "魏延", level: 6 }],
        }),
        tryAcceptComing: vi.fn().mockResolvedValue({
          hero_id: 5,
          summary: "是否接受将领魏延加入麾下？",
        }),
        sureAcceptComing: vi.fn().mockRejectedValue(new Error("hero: hero capacity full (office level)")),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      mount.querySelector('[data-action="coming-accept-confirm"]')?.dispatchEvent(
        new Event("click", { bubbles: true }),
      );
      await flushPromises();
      expect(mount.querySelector('[data-role="coming-hero-form-error"]')?.textContent).toContain(
        "招贤馆容量已满",
      );
    });

    it("reject coming refreshes list", async () => {
      const mount = document.createElement("div");
      const listComingHeroes = vi
        .fn()
        .mockResolvedValueOnce({
          coming: [{ hero_id: 9, city_id: 1, display_name: "姜维", level: 4 }],
        })
        .mockResolvedValueOnce({ coming: [] });
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listCaptiveHeroes: vi.fn().mockResolvedValue({ captives: [] }),
        listComingHeroes,
        tryAcceptComing: vi.fn().mockResolvedValue({ hero_id: 9, summary: "是否接受？" }),
        rejectComing: vi.fn().mockResolvedValue({ hero_id: 9 }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      mount.querySelector('[data-action="coming-reject"]')?.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(gateway.rejectComing).toHaveBeenCalledWith(1, 1, 9);
      expect(listComingHeroes).toHaveBeenCalledTimes(2);
      expect(mount.querySelector(".coming-hero-empty")?.textContent).toContain("暂无来投");
    });
  });

  describe("hotel recruit pool (CLIENT-hero-hotel-001)", () => {
    it("loads hotel candidates when opening hero panel and shows capacity meta", async () => {
      const mount = document.createElement("div");
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({
          candidates: [
            {
              candidate_id: 11,
              display_name: "赵武",
              level: 3,
              gold_cost: 400,
              attributes: { force: 40, intel: 30, politics: 20, command: 25 },
            },
          ],
          hotel_level: 2,
          hero_capacity: 5,
          hero_owned: 1,
        }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      expect(gateway.listHotelRecruitCandidates).toHaveBeenCalledWith(1, 1);
      const meta = mount.querySelector('[data-role="hotel-recruit-meta"]');
      expect(meta?.textContent).toContain("将领 1/5");
      const row = mount.querySelector('li[data-candidate-id="11"]');
      expect(row?.textContent).toContain("赵武");
    });

    it("recruit hotel candidate refreshes hero list and shows capacity gate error", async () => {
      const mount = document.createElement("div");
      const session = (): MainCitySession => ({
        ...sessionBase(),
        wallet: { gold: 5000 },
      });
      const listHotelRecruitCandidates = vi.fn().mockResolvedValue({
        candidates: [{ candidate_id: 3, display_name: "钱文", gold_cost: 10, level: 1 }],
        hotel_level: 1,
        hero_capacity: 1,
        hero_owned: 1,
      });
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [{ hero_id: 9 }], total_count: 1 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates,
        recruitHotelCandidate: vi.fn().mockResolvedValue({
          hero_id: 42,
          display_name: "钱文",
          level: 1,
          loyalty: 70,
        }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, session, () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      const recruitBtn = mount.querySelector('[data-action="recruit-hotel-candidate"]') as HTMLButtonElement;
      expect(recruitBtn.disabled).toBe(true);
      const capErr = mount.querySelector('[data-role="hotel-recruit-form-error"]');
      expect(capErr?.classList.contains("hidden")).toBe(true);
      recruitBtn.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(mount.querySelector('[data-role="hotel-recruit-form-error"]')?.textContent).toContain(
        "招贤馆容量已满",
      );
      listHotelRecruitCandidates.mockResolvedValue({
        candidates: [{ candidate_id: 3, display_name: "钱文", gold_cost: 10, level: 1 }],
        hotel_level: 1,
        hero_capacity: 5,
        hero_owned: 1,
      });
      mount.querySelector('[data-action="refresh-hotel-candidates"]')?.dispatchEvent(
        new Event("click", { bubbles: true }),
      );
      await flushPromises();
      expect(recruitBtn.disabled).toBe(false);
      recruitBtn.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(gateway.recruitHotelCandidate).toHaveBeenCalledWith(1, 1, 3);
      expect(gateway.listPlayerHeroes).toHaveBeenCalled();
    });
  });

  describe("persuade / lionize (CLIENT-hero-persuade-001)", () => {
    it("loads persuade targets when opening hero panel", async () => {
      const mount = document.createElement("div");
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listPersuadeTargets: vi.fn().mockResolvedValue({
          targets: [
            {
              npc_cfg_id: 1001,
              display_name: "刘备",
              level: 40,
              friend: 0,
              state: 0,
              hire_friend_min: 30,
            },
          ],
        }),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const panels = new HeroMailPanels(mount, gateway, () => sessionBase(), () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      expect(gateway.listPersuadeTargets).toHaveBeenCalledWith(1);
      expect(mount.querySelector('[data-role="persuade-meta"]')?.textContent).toContain("1 名");
      expect(mount.querySelector('li[data-npc-cfg-id="1001"]')?.textContent).toContain("刘备");
    });

    it("persuade primary shows cooldown error from gateway", async () => {
      const mount = document.createElement("div");
      const listPersuadeTargets = vi.fn().mockResolvedValue({
        targets: [
          {
            npc_cfg_id: 1002,
            display_name: "关羽",
            friend: 20,
            state: 1,
            hire_friend_min: 30,
          },
        ],
      });
      const gateway: GatewayPort = {
        listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [], total_count: 0 }),
        listRecruitTemplates: vi.fn().mockResolvedValue({ templates: [], total_count: 0 }),
        listHotelRecruitCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
        listPersuadeTargets,
        persuadeHero: vi.fn().mockRejectedValue(new Error("hero: persuade on cooldown")),
        getBoundServerId: () => 1,
      } as unknown as GatewayPort;
      const session = (): MainCitySession => ({
        ...sessionBase(),
        bag: [{ item_cfg_id: 2004, quantity: 1 }],
      });
      const panels = new HeroMailPanels(mount, gateway, session, () => {}, () => {});
      panels.attach();
      panels.toggleHero();
      await flushPromises();
      const btn = mount.querySelector('[data-action="persuade-primary"]') as HTMLButtonElement;
      expect(btn.textContent).toContain("游说");
      expect(btn.disabled).toBe(false);
      btn.dispatchEvent(new Event("click", { bubbles: true }));
      await flushPromises();
      expect(gateway.persuadeHero).toHaveBeenCalledWith(1, 1, 1002);
      expect(mount.querySelector('[data-role="persuade-form-error"]')?.textContent).toContain(
        "游说冷却",
      );
    });
  });
});
