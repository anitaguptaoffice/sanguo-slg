import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  BATTLE_REPORT_DETAIL_NAV_CLASS,
  BATTLE_REPORT_DETAIL_NAV_SELECTOR,
  CHAT_INPUT_COUNTER_CLASS,
  CHAT_INPUT_COUNTER_ROLE,
  CHAT_INPUT_COUNTER_SELECTOR,
  MAIL_FILTER_TAB_BADGE_CLASS,
  CHAT_UNREAD_SEPARATOR_CLASS,
  CHAT_UNREAD_SEPARATOR_SELECTOR,
  GUILD_CHAT_UNREAD_SEPARATOR_CLASS,
  GUILD_CHAT_UNREAD_SEPARATOR_SELECTOR,
  CLIENT_163_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID,
  CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_163_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_163_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  GUILD_CHAT_DRAFT_CLASS,
  GUILD_CHAT_DRAFT_SELECTOR,
  MAIL_CLAIM_ALL_ATTACHMENTS_ACTION,
  MAIL_CLAIM_ALL_ATTACHMENTS_SELECTOR,
  MAIL_INBOX_BATCH_TOOLBAR_SELECTOR,
  MARCH_QUEUE_BANNER_CLASS,
  MARCH_QUEUE_BANNER_PULSE_CLASS,
  MARCH_QUEUE_BANNER_SELECTOR,
  MILITARY_RECRUIT_QUEUE_JUMP_ACTION,
  MILITARY_RECRUIT_QUEUE_JUMP_SELECTOR,
  mountClient163PanelSkins,
  panelScrollClearsBottomToolbar,
  queryClient163PanelRoot,
  WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave31MarchMailSocialNarrowManifest";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_CHAT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
} from "@/engine/artPanelSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("wave31MarchMailSocialNarrowManifest (CLIENT-163)", () => {
  it("registers military march battle-report mail guild chat center panels", () => {
    expect(CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "military",
      "march",
      "battle-report",
      "mail",
      "guild",
      "chat",
    ]);
  });

  it("maps panel assets and scroll roles", () => {
    expect(CLIENT_163_PANEL_ASSET_BY_CENTER_ID).toEqual({
      military: PANEL_ASSET_MILITARY,
      march: PANEL_ASSET_MARCH,
      "battle-report": PANEL_ASSET_BATTLE_REPORT,
      mail: PANEL_ASSET_DEFAULT,
      guild: PANEL_ASSET_GUILD,
      chat: PANEL_ASSET_CHAT,
    });
    expect(CLIENT_163_PANEL_SCROLL_ROLE_BY_CENTER_ID.mail).toBe("mail-scroll");
    expect(CLIENT_163_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID.march).toBe("li[data-march-id]");
  });

  it("toolbar clearance covers 56px bottom bar", () => {
    expect(
      panelScrollClearsBottomToolbar(WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX),
    ).toBe(true);
  });

  it("index.html encodes wave:31 narrow chrome and scroll clearance", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MARCH_QUEUE_BANNER_CLASS);
    expect(html).toContain(MARCH_QUEUE_BANNER_PULSE_CLASS);
    expect(html).toContain(MARCH_QUEUE_BANNER_SELECTOR);
    expect(html).toContain(MILITARY_RECRUIT_QUEUE_JUMP_ACTION);
    expect(html).toContain(MILITARY_RECRUIT_QUEUE_JUMP_SELECTOR);
    expect(html).toContain(BATTLE_REPORT_DETAIL_NAV_CLASS);
    expect(html).toContain(MAIL_CLAIM_ALL_ATTACHMENTS_ACTION);
    expect(html).toContain(MAIL_CLAIM_ALL_ATTACHMENTS_SELECTOR);
    expect(html).toContain(MAIL_INBOX_BATCH_TOOLBAR_SELECTOR.slice(1));
    expect(html).toContain(GUILD_CHAT_DRAFT_CLASS);
    expect(html).toContain(CHAT_UNREAD_SEPARATOR_CLASS);
    expect(html).toContain(GUILD_CHAT_UNREAD_SEPARATOR_CLASS);
    expect(html).toContain(CHAT_INPUT_COUNTER_ROLE);
    expect(html).toContain(CHAT_INPUT_COUNTER_CLASS);
    expect(html).toContain(MAIL_FILTER_TAB_BADGE_CLASS);
    expect(html).toContain(
      `padding-bottom: ${WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX}px`,
    );
    expect(html).toContain(CLIENT_163_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID.march);
    expect(html).toContain(GUILD_CHAT_DRAFT_SELECTOR);
    expect(html).toContain(CHAT_UNREAD_SEPARATOR_SELECTOR);
    expect(html).toContain(GUILD_CHAT_UNREAD_SEPARATOR_SELECTOR);
    expect(html).toContain(BATTLE_REPORT_DETAIL_NAV_SELECTOR);
  });

  it("queryClient163PanelRoot finds military and mail roots", () => {
    const military = document.createElement("div");
    military.dataset.centerPanel = "military";
    expect(queryClient163PanelRoot(military, "military")).toBe(military);

    const mail = document.createElement("div");
    mail.dataset.centerPanel = "mail";
    const wrap = document.createElement("div");
    wrap.append(mail);
    expect(queryClient163PanelRoot(wrap, "mail")).toBe(mail);
  });

  it("mountClient163PanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    const assets = { getImageForAsset: vi.fn() };
    mountClient163PanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
