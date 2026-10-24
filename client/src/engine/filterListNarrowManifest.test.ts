import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID,
  CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS,
  CLIENT_127_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  CITY_SLOT_PULSE_CLASS,
  DAILY_CHAIN_TAB_BAR_CLASS,
  DAILY_CHAIN_TAB_CLASS,
  DAILY_CHAIN_TAB_SESSION_KEY,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
  DAILY_QUEST_PROGRESS_SECONDARY_CLASS,
  GUILD_CHAT_RETRY_INLINE_CLASS,
  GUILD_ROLE_GROUP_HEADER_CLASS,
  HERO_GROWTH_COMPARE_STRIP_CLASS,
  HERO_LIST_RETURN_SESSION_KEY,
  HERO_LIST_SELECTED_SESSION_KEY,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  LEADERBOARD_TOP_DENSITY_LINE_CLASS,
  FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX,
  MAIL_CLAIM_ALL_ATTACHMENTS_ACTION,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
  RECRUIT_FORM_INLINE_HINT_CLASS,
  DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_ROLE,
  HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LOYALTY_WARN_DOT_CLASS,
  HUD_TODO_MERGED_SWEEP_CLASS,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  RANK_EMPTY_RETRY_INLINE_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_ROLE,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  RECRUIT_WALLET_COMPARE_LINE_CLASS,
  SHOP_WALLET_COMPARE_LINE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  HUD_MILITARY_TODO_PULSE_CLASS,
  HUD_MILITARY_TODO_SWEEP_CLASS,
  HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
  INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  OPEN_INTEL_FOR_REPORT_ACTION,
  REPORT_LIST_INTEL_JUMP_TAG_CLASS,
  REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
  BAG_USE_CONSUMABLE_PULSE_CLASS,
  BAG_USE_ECONOMY_ERROR_LINE_CLASS,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  DOMESTIC_SLOT_RETURN_RING_CLASS,
  DOMESTIC_SLOT_SCROLL_SESSION_KEY,
  GUILD_CHAT_UNREAD_SEPARATOR_CLASS,
  GUILD_ROLE_GROUP_HEADER_LINE_ROLE,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_PANEL_ART_MOUNT_ATTR,
  HERO_PANEL_ART_MOUNT_ID,
  QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEP_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS,
  isFilterListArtSkinOff,
  mountFilterListPanelSkins,
  PANEL_FILTER_CHIP_BAR_CLASS,
  queryFilterChipBar,
  queryFilterListPanelRoot,
} from "@/engine/filterListNarrowManifest";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
} from "@/engine/artPanelSkin";
import { FILTER_CHIP_HIT_MIN } from "@/engine/artUiFilterSkin";

const repoRoot = join(import.meta.dirname, "../..");

describe("filterListNarrowManifest (CLIENT-127)", () => {
  it("registers mail daily march battle-report center panels", () => {
    expect(CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS).toEqual([
      "mail",
      "daily",
      "march",
      "battle-report",
    ]);
  });

  it("maps panel roots to nine-slice asset ids", () => {
    expect(CLIENT_127_PANEL_ASSET_BY_CENTER_ID).toEqual({
      mail: PANEL_ASSET_DEFAULT,
      daily: PANEL_ASSET_DAILY,
      march: PANEL_ASSET_MARCH,
      "battle-report": PANEL_ASSET_BATTLE_REPORT,
    });
  });

  it("wires scroll roles and filter chip bar selectors", () => {
    expect(CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID.mail).toBe("mail-scroll");
    expect(CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID.daily).toContain(
      PANEL_FILTER_CHIP_BAR_CLASS,
    );
  });

  it("CLIENT-155 exposes daily quest progress secondary class for narrow manifest", () => {
    expect(DAILY_QUEST_PROGRESS_SECONDARY_CLASS).toBe("daily-quest-row-progress");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`.${DAILY_QUEST_PROGRESS_SECONDARY_CLASS}`);
  });

  it("CLIENT-174 exposes daily quest fine progress bar hooks for narrow manifest", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(".daily-quest-progress");
    expect(html).toContain(".daily-quest-progress-fill");
  });

  it("CLIENT-163 exposes mail claim-all action for batch toolbar manifest", () => {
    expect(MAIL_CLAIM_ALL_ATTACHMENTS_ACTION).toBe("claim-mail-all");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`data-action="${MAIL_CLAIM_ALL_ATTACHMENTS_ACTION}"`);
  });

  it("CLIENT-171 exposes daily chain tab bar hooks for narrow manifest", () => {
    expect(DAILY_CHAIN_TAB_SESSION_KEY).toBe("daily-chain-tab-v1");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DAILY_CHAIN_TAB_BAR_CLASS);
    expect(html).toContain(DAILY_CHAIN_TAB_CLASS);
  });

  it("CLIENT-179 exposes wave:33 intel/battle/mail/bag/daily/military narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain("march-info-card");
    expect(html).toContain("battle-report-row-summary");
    expect(html).toContain("mail-attachment-sweep");
    expect(html).toContain("bag-item-cfg-summary");
    expect(html).toContain("daily-quest-progress");
    expect(html).toContain("march-form-readonly-strip");
    expect(html).toContain("battle-report-outcome-filter-v1");
  });

  it("CLIENT-187 exposes wave:34 main-city hero rank social HUD narrow hooks", () => {
    expect(HERO_LIST_SELECTED_SESSION_KEY).toBe("hero-list-selected-v1");
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(CITY_SLOT_PULSE_CLASS);
    expect(html).toContain(DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS);
    expect(html).toContain(GUILD_ROLE_GROUP_HEADER_CLASS);
    expect(html).toContain(LEADERBOARD_TOP_DENSITY_LINE_CLASS);
  });

  it("CLIENT-195 exposes wave:35 world intel battle mail daily bag shop narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain("world-tile-info-card");
    expect(html).toContain("minimap-focus-pulse");
    expect(html).toContain("march-form-coord-sync-highlight");
    expect(html).toContain("battle-report-outcome-band");
    expect(html).toContain("mail-claim-inline-pulse");
    expect(html).toContain("daily-claim-progress-pulse");
    expect(html).toContain("bag-row-inline-state");
    expect(html).toContain("shop-price-wallet-gap-line");
    expect(html).toContain("battle-report-replay-v1");
  });

  it("CLIENT-203 exposes wave:36 queue hero social HUD deep-link narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(QUEUE_ROW_ETA_LINE_CLASS);
    expect(html).toContain(QUEUE_ROW_PROGRESS_BAR_CLASS);
    expect(html).toContain(HERO_GROWTH_COMPARE_STRIP_CLASS);
    expect(html).toContain(HERO_LIST_RETURN_SESSION_KEY);
    expect(html).toContain(GUILD_CHAT_RETRY_INLINE_CLASS);
    expect(html).toContain(RECRUIT_FORM_INLINE_HINT_CLASS);
    expect(html).toContain(HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE);
    expect(html).toContain(CENTER_PANEL_TAB_PULSE_CLASS);
  });

  it("CLIENT-243 exposes wave:41 world intel battle report mail shop rank recruit narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS);
    expect(html).toContain(MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY);
    expect(html).toContain(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS);
    expect(html).toContain(MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS);
    expect(html).toContain(MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS);
    expect(html).toContain(REPORT_LIST_DENSITY_ROW_CLASS);
    expect(html).toContain(REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS);
    expect(html).toContain(BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS);
    expect(html).toContain(COPY_REPORT_COORDS_READONLY_ACTION);
    expect(html).toContain(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
    expect(html).toContain(BAG_SHOP_CATEGORY_SCAN_RING_CLASS);
    expect(html).toContain(RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS);
    expect(html).toContain(RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS);
  });

  it("CLIENT-259 exposes wave:43 world intel battle report mail shop rank narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS);
    expect(html).toContain(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS);
    expect(html).toContain(MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS);
    expect(html).toContain(MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS);
    expect(html).toContain(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS);
    expect(html).toContain(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS);
    expect(html).toContain(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
    expect(html).toContain(MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS);
    expect(html).toContain(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS);
    expect(html).toContain(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS);
    expect(html).toContain(RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS);
    expect(html).toContain(RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS);
    expect(html).toContain(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS);
    expect(html).toContain(INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS);
    expect(html).toContain(PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION);
  });

  it("CLIENT-275 exposes wave:45 world intel battle report mail shop rank narrow hooks consolidate", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS);
    expect(html).toContain(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS);
    expect(html).toContain(MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS);
    expect(html).toContain(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS);
    expect(html).toContain(RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS);
    expect(html).toContain(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS);
    expect(html).toContain(INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEP_ACTION);
  });

  it("CLIENT-267 exposes wave:44 main-city hero daily social queue narrow hooks consolidate", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS);
    expect(html).toContain(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS);
    expect(html).toContain(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY);
    expect(html).toContain(RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS);
    expect(html).toContain(RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS);
    expect(html).toContain(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS);
    expect(html).toContain(GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS);
    expect(html).toContain(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS);
  });

  it("CLIENT-251 exposes wave:42 main-city hero daily social queue narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS);
    expect(html).toContain(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS);
    expect(html).toContain(QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS);
    expect(html).toContain(QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS);
    expect(html).toContain(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS);
    expect(html).toContain(HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS);
    expect(html).toContain(HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS);
    expect(html).toContain(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS);
    expect(html).toContain(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS);
    expect(html).toContain(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY);
    expect(html).toContain(RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS);
    expect(html).toContain(RANK_PIN_KEEP_RESIDUAL_RING_CLASS);
    expect(html).toContain(GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS);
    expect(html).toContain(GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS);
    expect(html).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS);
    expect(html).toContain(GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS);
    expect(html).toContain(QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS);
    expect(html).toContain(QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS);
    expect(html).toContain(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS);
    expect(html).toContain(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS);
  });

  it("CLIENT-235 exposes wave:40 main-city hero bag daily guild narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS);
    expect(html).toContain(DOMESTIC_SLOT_RETURN_RING_CLASS);
    expect(html).toContain(DOMESTIC_SLOT_SCROLL_SESSION_KEY);
    expect(html).toContain(HERO_PANEL_ART_MOUNT_ATTR);
    expect(html).toContain(HERO_PANEL_ART_MOUNT_ID);
    expect(html).toContain(HERO_LIST_RETURN_HIGHLIGHT_CLASS);
    expect(html).toContain(HERO_LIST_FILTER_SESSION_KEY);
    expect(html).toContain(BAG_USE_CONSUMABLE_PULSE_CLASS);
    expect(html).toContain(BAG_USE_ECONOMY_ERROR_LINE_CLASS);
    expect(html).toContain(QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE);
    expect(html).toContain(QUEST_CLAIM_PROGRESS_PULSE_CLASS);
    expect(html).toContain(GUILD_ROLE_GROUP_HEADER_LINE_ROLE);
    expect(html).toContain(GUILD_CHAT_UNREAD_SEPARATOR_CLASS);
  });

  it("CLIENT-227 exposes wave:39 world intel battle report mail march hud narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(MINIMAP_INTEL_SYNC_RING_CLASS);
    expect(html).toContain(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS);
    expect(html).toContain(INTEL_PHASE_CHANGE_FLASH_CLASS);
    expect(html).toContain(INTEL_NEW_MARCH_HIGHLIGHT_CLASS);
    expect(html).toContain(MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS);
    expect(html).toContain(REPORT_LIST_INTEL_JUMP_TAG_CLASS);
    expect(html).toContain(REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS);
    expect(html).toContain(OPEN_INTEL_FOR_REPORT_ACTION);
    expect(html).toContain(MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS);
    expect(html).toContain(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY);
    expect(html).toContain(HUD_MILITARY_TODO_SWEEP_CLASS);
    expect(html).toContain(HUD_MILITARY_TODO_SWEEP_LINE_ROLE);
    expect(html).toContain(HUD_MILITARY_TODO_PULSE_CLASS);
  });

  it("CLIENT-219 exposes wave:38 main-city hero social queue narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS);
    expect(html).toContain(DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS);
    expect(html).toContain(HERO_LIST_LOYALTY_SUBLINE_CLASS);
    expect(html).toContain(HERO_LOYALTY_WARN_DOT_CLASS);
    expect(html).toContain(RANK_REFRESH_COOLDOWN_STAMP_CLASS);
    expect(html).toContain(RANK_REFRESH_COOLDOWN_STAMP_ROLE);
    expect(html).toContain(RANK_MANUAL_REFRESH_SESSION_KEY);
    expect(html).toContain(RANK_EMPTY_RETRY_INLINE_CLASS);
    expect(html).toContain(RECRUIT_WALLET_COMPARE_LINE_CLASS);
    expect(html).toContain(SHOP_WALLET_COMPARE_LINE_CLASS);
    expect(html).toContain(HUD_TODO_MERGED_SWEEP_CLASS);
    expect(html).toContain(HUD_TODO_MERGED_SWEEP_LINE_ROLE);
    expect(html).toContain(TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS);
    expect(html).toContain(GUILD_MEMBER_ONLINE_SUMMARY_CLASS);
    expect(html).toContain(GUILD_MEMBER_ONLINE_SUMMARY_ROLE);
    expect(html).toContain(GUILD_CHAT_BACKOFF_RETRY_CLASS);
    expect(html).toContain(DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS);
    expect(html).toContain(QUEUE_NEXT_FINISH_PREVIEW_CLASS);
    expect(html).toContain(QUEUE_NEXT_FINISH_PREVIEW_ACTION);
  });

  it("CLIENT-220 exposes wave:39 minimap intel sync narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain("minimap-intel-sync-ring");
    expect(html).toContain("intel-row-minimap-sync-highlight");
  });

  it("CLIENT-211 exposes wave:37 world intel battle report mail bag narrow hooks", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain("minimap-march-stack-badge");
    expect(html).toContain("march-intel-phase-eta-strip");
    expect(html).toContain("march-form-reserve-warn");
    expect(html).toContain("battle-report-time-filter-v1");
    expect(html).toContain("battle-report-round-summary-strip");
    expect(html).toContain("mail-tab-hud-sync-pulse");
    expect(html).toContain("bag-row-return-highlight");
    expect(html).toContain("bag-category-scroll-v1");
  });

  it("index.html encodes toolbar clearance and ≥44px chip hits", () => {
    const html = readFileSync(join(repoRoot, "index.html"), "utf8");
    expect(html).toContain(`padding-bottom: ${FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX}px`);
    expect(html).toContain(`.${PANEL_FILTER_CHIP_BAR_CLASS}`);
    expect(html).toContain(`min-width: ${FILTER_CHIP_HIT_MIN}px`);
    expect(html).toContain("overflow-y: visible");
  });

  it("queryFilterChipBar finds bar inside panel skeleton", () => {
    const panel = document.createElement("div");
    panel.dataset.centerPanel = "mail";
    panel.innerHTML = `<div class="mail-inbox-toolbar panel-filter-chip-bar"></div>
      <div class="panel-scroll-body" data-role="mail-scroll"></div>`;
    expect(queryFilterListPanelRoot(panel, "mail")).toBe(panel);
    expect(queryFilterChipBar(panel, "mail")).toBeTruthy();
  });

  it("isFilterListArtSkinOff respects panel root data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    expect(isFilterListArtSkinOff(panel)).toBe(true);
  });

  it("mountFilterListPanelSkins skips when data-art-skin=off", () => {
    const panel = document.createElement("div");
    panel.dataset.artSkin = "off";
    panel.innerHTML = `<button type="button" data-ui-filter-chip>全部</button>`;
    const assets = {
      getImageForAsset: vi.fn(() => ({ img: { src: "/x.png" }, scale: 1 as const })),
      getArtMeta: vi.fn(),
    };
    mountFilterListPanelSkins(panel, assets as never);
    expect(assets.getImageForAsset).not.toHaveBeenCalled();
  });
});
