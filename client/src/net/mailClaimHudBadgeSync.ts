import type { DailyQuestRow } from "@/net/dailyQuestState";
import { syncMailInboxSnapshotAfterClaim, type MailRow } from "@/net/heroMailState";
import { buildHudTodoBadges, mailHudBadgeFacetCounts, mailPanelTabBadgeCounts } from "@/net/hudTodoBadges";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";
import { formatMailAttachmentClaimResidualSubline } from "@/net/mailAttachmentClaimResidualSubline";
import { formatMailAttachmentClaimResidualDeepSubline } from "@/net/mailAttachmentClaimResidualDeepSubline";
import { formatMailAttachmentClaimResidualDeeperSubline } from "@/net/mailAttachmentClaimResidualDeeperSubline";
import { formatMailAttachmentClaimResidualDeepestSubline } from "@/net/mailAttachmentClaimResidualDeepestSubline";
import { formatMailAttachmentClaimResidualDeepestDeeperSubline } from "@/net/mailAttachmentClaimResidualDeepestDeeperSubline";
import { formatMailAttachmentClaimResidualDeepestDeepestDeeperSubline } from "@/net/mailAttachmentClaimResidualDeepestDeepestDeeperSubline";
import { formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline } from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestSubline";
import {
  formatMailTabUnreadSweepLine,
  type MailTabUnreadSweepTab,
} from "@/net/mailTabUnreadSweep";
import { formatMailPanelHudCombinedSweepLine } from "@/net/questClaimHudLink";

/** CLIENT-241：领取成功后列表行 HUD 角标同步脉冲（与 CLIENT-192 `mail-claim-pulse` 并存）。 */
export const MAIL_CLAIM_HUD_SYNC_PULSE_CLASS = "mail-claim-hud-sync-pulse";
export const MAIL_CLAIM_HUD_SYNC_PULSE_MS = 2000;

/** CLIENT-255：CLIENT-241 同步基础上的残余深脉冲（2.5s；与 `mail-claim-hud-sync-pulse` 并存）。 */
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS = "mail-claim-hud-sync-deep-pulse";
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS = 2500;

/** CLIENT-271：CLIENT-255 深脉冲之上的残余加深 HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deep sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deep-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_MS = 3000;

/** CLIENT-287：CLIENT-271 残余加深脉冲之上的 **巩固再加深** HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deeper sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deeper-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_MS = 3000;

/** CLIENT-303：CLIENT-287 残余巩固再加深脉冲之上的 **巩固再加深一层** HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deepest sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deepest-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_MS = 3000;

/** CLIENT-319：CLIENT-303 残余巩固再加深一层脉冲之上的 **巩固再加深二层** HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deepest-deeper sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deepest-deeper-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_MS = 3000;

/** CLIENT-335：CLIENT-319 残余巩固再加深二层脉冲之上的 **巩固再加深三层** HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deepest-deepest-deeper sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deepest-deepest-deeper-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 3000;

/** CLIENT-351：CLIENT-335 残余巩固再加深三层脉冲之上的 **巩固再加深四层** HUD 脉冲（3s；CLIENT-050/106/209 角标推导仍走 residual deepest-deepest-deepest sync）。 */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deepest-deepest-deepest-pulse";
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS = 3000;

export type HudMailQuestBadgeSyncInput = {
  mailUnreadTotal: number;
  mailInboxSnapshot: MailRow[];
  dailyChainRows: DailyQuestRow[];
};

/** 领取后 HUD 邮件 tab / 底栏角标与日常可领计数切面（CLIENT-050/106/209/193 同源推导）。 */
export type HudMailQuestBadgeSyncResult = HudMailQuestBadgeSyncInput & {
  toolbarMail: number;
  unreadTab: number;
  unclaimedTab: number;
  mailClaimable: number;
  dailyClaimable: number;
  toolbarDaily: number;
  hudTodoSweepLine: string | null;
  mailCombinedSweepLine: string | null;
  mailTabUnreadSweepLine: string | null;
};

/** CLIENT-255：在 CLIENT-241 同步结果上附带附件领取残余次行文案。 */
export type HudMailQuestBadgeDeepSyncResult = HudMailQuestBadgeSyncResult & {
  attachmentClaimResidualSubline: string | null;
};

/** CLIENT-271：在 CLIENT-255 同步结果上附带附件领取残余加深次行文案。 */
export type HudMailQuestBadgeResidualDeepSyncResult = HudMailQuestBadgeDeepSyncResult & {
  attachmentClaimResidualDeepSubline: string | null;
};

/** CLIENT-287：在 CLIENT-271 同步结果上附带附件领取残余巩固再加深第三行文案。 */
export type HudMailQuestBadgeResidualDeeperSyncResult = HudMailQuestBadgeResidualDeepSyncResult & {
  attachmentClaimResidualDeeperSubline: string | null;
};

/** CLIENT-303：在 CLIENT-287 同步结果上附带附件领取残余巩固再加深一层第四行文案。 */
export type HudMailQuestBadgeResidualDeepestSyncResult = HudMailQuestBadgeResidualDeeperSyncResult & {
  attachmentClaimResidualDeepestSubline: string | null;
};

/** CLIENT-319：在 CLIENT-303 同步结果上附带附件领取残余巩固再加深二层第五行文案。 */
export type HudMailQuestBadgeResidualDeepestDeeperSyncResult =
  HudMailQuestBadgeResidualDeepestSyncResult & {
    attachmentClaimResidualDeepestDeeperSubline: string | null;
  };

/** CLIENT-335：在 CLIENT-319 同步结果上附带附件领取残余巩固再加深三层第六行文案。 */
export type HudMailQuestBadgeResidualDeepestDeepestDeeperSyncResult =
  HudMailQuestBadgeResidualDeepestDeeperSyncResult & {
    attachmentClaimResidualDeepestDeepestDeeperSubline: string | null;
  };

/** CLIENT-351：在 CLIENT-335 同步结果上附带附件领取残余巩固再加深四层第七行文案。 */
export type HudMailQuestBadgeResidualDeepestDeepestDeepestSyncResult =
  HudMailQuestBadgeResidualDeepestDeepestDeeperSyncResult & {
    attachmentClaimResidualDeepestDeepestDeepestSubline: string | null;
  };

/**
 * 邮件附件领取成功后刷新收件箱快照并推导 HUD 邮件未读/未领附件与日常可领计数（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaim(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
): HudMailQuestBadgeSyncResult {
  const mailInboxSnapshot = syncMailInboxSnapshotAfterClaim(
    input.mailInboxSnapshot,
    mailId,
    rowAfter,
  );
  const mailUnreadTotal = Math.max(0, input.mailUnreadTotal);
  const dailyChainRows = input.dailyChainRows ?? [];

  const facets = mailHudBadgeFacetCounts({
    mailUnreadTotal,
    mailInboxSnapshot,
  });
  const panelTabs = mailPanelTabBadgeCounts({
    mailUnreadTotal,
    mailClaimablePage: mailInboxSnapshot,
  });
  const bundle = buildHudTodoBadges({
    mailUnreadTotal,
    mailClaimablePage: mailInboxSnapshot,
    dailyRows: dailyChainRows,
    buildCompleteCount: 0,
    battleReportUnread: 0,
  });

  const mailCounts = {
    unreadForTab: panelTabs.unreadTab,
    unclaimedCount: panelTabs.unclaimedTab,
  };

  return {
    mailUnreadTotal,
    mailInboxSnapshot,
    dailyChainRows,
    toolbarMail: facets.toolbarMail,
    unreadTab: panelTabs.unreadTab,
    unclaimedTab: panelTabs.unclaimedTab,
    mailClaimable: bundle.center.mailClaimable,
    dailyClaimable: bundle.center.dailyClaimable,
    toolbarDaily: bundle.toolbar.daily,
    hudTodoSweepLine: formatHudTodoSweepLine({
      mailClaimable: bundle.center.mailClaimable,
      dailyClaimable: bundle.center.dailyClaimable,
    }),
    mailCombinedSweepLine: formatMailPanelHudCombinedSweepLine(mailCounts, dailyChainRows),
    mailTabUnreadSweepLine: formatMailTabUnreadSweepLine(mailFilterTab, mailCounts),
  };
}

/**
 * CLIENT-255：CLIENT-241 `syncHudMailQuestBadgeAfterClaim` + 附件类型/领取结果残余次行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimDeep(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeDeepSyncResult {
  const base = syncHudMailQuestBadgeAfterClaim(input, mailId, rowAfter, mailFilterTab);
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualSubline = formatMailAttachmentClaimResidualSubline(before, granted);
  return { ...base, attachmentClaimResidualSubline };
}

/**
 * CLIENT-271：CLIENT-255 `syncHudMailQuestBadgeAfterClaimDeep` + 附件类型/领取结果残余 **加深** 次行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeep(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeepSyncResult {
  const deep = syncHudMailQuestBadgeAfterClaimDeep(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeepSubline = formatMailAttachmentClaimResidualDeepSubline(
    before,
    granted,
  );
  return { ...deep, attachmentClaimResidualDeepSubline };
}

/**
 * CLIENT-287：CLIENT-271 `syncHudMailQuestBadgeAfterClaimResidualDeep` + 附件类型/领取结果残余 **巩固再加深** 第三行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeeper(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeeperSyncResult {
  const residualDeep = syncHudMailQuestBadgeAfterClaimResidualDeep(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeeperSubline = formatMailAttachmentClaimResidualDeeperSubline(
    before,
    granted,
  );
  return { ...residualDeep, attachmentClaimResidualDeeperSubline };
}

/**
 * CLIENT-303：CLIENT-287 `syncHudMailQuestBadgeAfterClaimResidualDeeper` + 附件类型/领取结果残余 **巩固再加深一层** 第四行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeepest(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeepestSyncResult {
  const residualDeeper = syncHudMailQuestBadgeAfterClaimResidualDeeper(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeepestSubline = formatMailAttachmentClaimResidualDeepestSubline(
    before,
    granted,
  );
  return { ...residualDeeper, attachmentClaimResidualDeepestSubline };
}

/**
 * CLIENT-319：CLIENT-303 `syncHudMailQuestBadgeAfterClaimResidualDeepest` + 附件类型/领取结果残余 **巩固再加深二层** 第五行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeepestDeeper(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeepestDeeperSyncResult {
  const residualDeepest = syncHudMailQuestBadgeAfterClaimResidualDeepest(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeepestDeeperSubline =
    formatMailAttachmentClaimResidualDeepestDeeperSubline(before, granted);
  return { ...residualDeepest, attachmentClaimResidualDeepestDeeperSubline };
}

/**
 * CLIENT-335：CLIENT-319 `syncHudMailQuestBadgeAfterClaimResidualDeepestDeeper` + 附件类型/领取结果残余 **巩固再加深三层** 第六行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeeper(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeepestDeepestDeeperSyncResult {
  const residualDeepestDeeper = syncHudMailQuestBadgeAfterClaimResidualDeepestDeeper(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeepestDeepestDeeperSubline =
    formatMailAttachmentClaimResidualDeepestDeepestDeeperSubline(before, granted);
  return { ...residualDeepestDeeper, attachmentClaimResidualDeepestDeepestDeeperSubline };
}

/**
 * CLIENT-351：CLIENT-335 `syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeeper` + 附件类型/领取结果残余 **巩固再加深四层** 第七行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeepest(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeResidualDeepestDeepestDeepestSyncResult {
  const residualDeepestDeepestDeeper = syncHudMailQuestBadgeAfterClaimResidualDeepestDeepestDeeper(
    input,
    mailId,
    rowAfter,
    mailFilterTab,
    granted,
    mailBeforeClaim,
  );
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualDeepestDeepestDeepestSubline =
    formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline(before, granted);
  return {
    ...residualDeepestDeepestDeeper,
    attachmentClaimResidualDeepestDeepestDeepestSubline,
  };
}

export function scheduleMailClaimHudSyncPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_PULSE_MS);
}

export function scheduleMailClaimHudSyncDeepPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS);
}

/** CLIENT-255：CLIENT-241 列表脉冲 + 残余深脉冲（CLIENT-050/106/209 角标推导仍走 deep sync）。 */
export function pulseMailClaimHudSyncAfterClaimDeep(row: HTMLElement | null | undefined): void {
  scheduleMailClaimHudSyncPulse(row);
  scheduleMailClaimHudSyncDeepPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeepPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_MS);
}

/** CLIENT-271：CLIENT-241/255 脉冲栈 + 残余加深 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeep(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimDeep(row);
  scheduleMailClaimHudSyncResidualDeepPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeeperPulse(
  row: HTMLElement | null | undefined,
): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPER_PULSE_MS);
}

/** CLIENT-287：CLIENT-241/255/271 脉冲栈 + 巩固再加深 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeeper(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimResidualDeep(row);
  scheduleMailClaimHudSyncResidualDeeperPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeepestPulse(
  row: HTMLElement | null | undefined,
): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_PULSE_MS);
}

/** CLIENT-303：CLIENT-241/255/271/287 脉冲栈 + 巩固再加深一层 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeepest(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimResidualDeeper(row);
  scheduleMailClaimHudSyncResidualDeepestPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeepestDeeperPulse(
  row: HTMLElement | null | undefined,
): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPER_PULSE_MS);
}

/** CLIENT-319：CLIENT-241/255/271/287/303 脉冲栈 + 巩固再加深二层 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeepestDeeper(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimResidualDeepest(row);
  scheduleMailClaimHudSyncResidualDeepestDeeperPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeepestDeepestDeeperPulse(
  row: HTMLElement | null | undefined,
): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
}

/** CLIENT-335：CLIENT-241/255/271/287/303/319 脉冲栈 + 巩固再加深三层 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeepestDeepestDeeper(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimResidualDeepestDeeper(row);
  scheduleMailClaimHudSyncResidualDeepestDeepestDeeperPulse(row);
}

export function scheduleMailClaimHudSyncResidualDeepestDeepestDeepestPulse(
  row: HTMLElement | null | undefined,
): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS);
}

/** CLIENT-351：CLIENT-241/255/271/287/303/319/335 脉冲栈 + 巩固再加深四层 HUD 脉冲（CLIENT-050/106/209 **不退化**）。 */
export function pulseMailClaimHudSyncAfterClaimResidualDeepestDeepestDeepest(
  row: HTMLElement | null | undefined,
): void {
  pulseMailClaimHudSyncAfterClaimResidualDeepestDeepestDeeper(row);
  scheduleMailClaimHudSyncResidualDeepestDeepestDeepestPulse(row);
}
