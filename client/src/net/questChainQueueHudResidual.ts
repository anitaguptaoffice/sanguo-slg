import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import { dailyQuestChainTabLabel } from "@/net/dailyQuestChainTab";
import { formatQuestChainTypeSubline } from "@/net/questChainTypeSubline";
import { formatDomesticQueueEtaSegmentLabel } from "@/net/domesticQueueEtaSegment";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import { DAILY_QUEST_CHAIN_ID, type DailyQuestRow } from "@/net/dailyQuestState";
import { formatNextQueueFinishPreviewLine } from "@/net/nextQueueFinishPreview";
import type { RecruitQueueEntry } from "@/net/queueState";

/** CLIENT-250：可领日常行 chain·队列·HUD 只读残余次行。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-subline";

/** CLIENT-266：可领日常行 chain·队列·HUD 深链巩固次行（CLIENT-250/218 **不退化**）。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deep-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deep-subline";

/** CLIENT-282：可领日常行 chain·队列·HUD 深链 **巩固再加深** 第三行（CLIENT-266/218 **不退化**）。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deeper-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deeper-subline";

/** CLIENT-298：可领日常行 chain·队列·HUD 深链 **巩固再加深一层** 第四行（CLIENT-282/218 **不退化**）。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-subline";

/** CLIENT-314：可领日常行 chain·队列·HUD 深链 **巩固再加深二层** 第五行（CLIENT-298/218 **不退化**）。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-deeper-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-deeper-subline";

/** CLIENT-330：可领日常行 chain·队列·HUD 深链 **巩固再加深三层** 第六行（CLIENT-314/218 **不退化**）。 */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline";
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline";

export function formatQuestChainQueueHudResidualQueueEtaSnippet(
  finishAtMs: number,
  nowMs: number,
): string {
  const segment = formatDomesticQueueEtaSegmentLabel(finishAtMs, nowMs);
  return segment ? `队列下一完成 ${segment}` : "队列下一完成 即将到期";
}

/**
 * 可领日常行：chain 类型标签 + 全局队列下一完成 ETA 只读残余次行（CLIENT-218/233 不退化）。
 */
export function formatQuestChainQueueHudResidualSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  if ((q.state ?? 0) !== DAILY_QUEST_STATE_CLAIMABLE) return null;
  const chainLabel = dailyQuestChainTabLabel(q.chain_id ?? DAILY_QUEST_CHAIN_ID);
  const preview = formatNextQueueFinishPreviewLine(
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!preview) return null;
  const eta = formatQuestChainQueueHudResidualQueueEtaSnippet(preview.finishAtMs, nowMs);
  return `${chainLabel} · ${eta}`;
}

/**
 * 可领日常行：CLIENT-218 chain 类型次行 + CLIENT-250 队列下一完成 ETA 只读 **巩固** 深链次行。
 */
export function formatQuestChainQueueHudResidualDeepSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  const residual = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!residual) return null;
  const chainHint = formatQuestChainTypeSubline(q);
  const eta = residual.includes(" · ")
    ? residual.slice(residual.indexOf(" · ") + 3)
    : residual;
  if (chainHint) return `深链巩固 · ${chainHint} ↔ ${eta}`;
  return `深链巩固 · ${residual}`;
}

/**
 * 可领日常行：CLIENT-266 深链巩固次行 + chain 类型 ↔ 队列下一完成 ETA **巩固再加深** 第三行。
 */
export function formatQuestChainQueueHudResidualDeeperSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  const deep = formatQuestChainQueueHudResidualDeepSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deep) return null;
  const chainHint = formatQuestChainTypeSubline(q);
  const residual = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!residual) return null;
  const eta = residual.includes(" · ")
    ? residual.slice(residual.indexOf(" · ") + 3)
    : residual;
  const chainPart =
    chainHint ?? dailyQuestChainTabLabel(q.chain_id ?? DAILY_QUEST_CHAIN_ID);
  const deepen = `巩固再加深 · ${chainPart} ↔ ${eta}`;
  return `${deepen} · 对照 ${deep}`;
}

/**
 * 可领日常行：CLIENT-282 巩固再加深第三行 + chain 类型 ↔ 队列下一完成 ETA **巩固再加深一层** 第四行。
 */
export function formatQuestChainQueueHudResidualDeepestSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  const deeper = formatQuestChainQueueHudResidualDeeperSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deeper) return null;
  const chainHint = formatQuestChainTypeSubline(q);
  const residual = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!residual) return null;
  const eta = residual.includes(" · ")
    ? residual.slice(residual.indexOf(" · ") + 3)
    : residual;
  const chainPart =
    chainHint ?? dailyQuestChainTabLabel(q.chain_id ?? DAILY_QUEST_CHAIN_ID);
  const deepenLayer = `巩固再加深一层 · ${chainPart} ↔ ${eta}`;
  return `${deepenLayer} · 对照 ${deeper}`;
}

/**
 * 可领日常行：CLIENT-298 巩固再加深一层第四行 + chain 类型 ↔ 队列下一完成 ETA **巩固再加深二层** 第五行。
 */
export function formatQuestChainQueueHudResidualDeepestDeeperSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  const deepest = formatQuestChainQueueHudResidualDeepestSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deepest) return null;
  const chainHint = formatQuestChainTypeSubline(q);
  const residual = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!residual) return null;
  const eta = residual.includes(" · ")
    ? residual.slice(residual.indexOf(" · ") + 3)
    : residual;
  const chainPart =
    chainHint ?? dailyQuestChainTabLabel(q.chain_id ?? DAILY_QUEST_CHAIN_ID);
  const deepenLayer = `巩固再加深二层 · ${chainPart} ↔ ${eta}`;
  return `${deepenLayer} · 对照 ${deepest}`;
}

/**
 * 可领日常行：CLIENT-314 巩固再加深二层第五行 + chain 类型 ↔ 队列下一完成 ETA **巩固再加深三层** 第六行。
 */
export function formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline(
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): string | null {
  const deepestDeeper = formatQuestChainQueueHudResidualDeepestDeeperSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!deepestDeeper) return null;
  const chainHint = formatQuestChainTypeSubline(q);
  const residual = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!residual) return null;
  const eta = residual.includes(" · ")
    ? residual.slice(residual.indexOf(" · ") + 3)
    : residual;
  const chainPart =
    chainHint ?? dailyQuestChainTabLabel(q.chain_id ?? DAILY_QUEST_CHAIN_ID);
  const deepenLayer = `巩固再加深三层 · ${chainPart} ↔ ${eta}`;
  return `${deepenLayer} · 对照 ${deepestDeeper}`;
}

export function appendQuestChainQueueHudResidualDeepestDeepestDeeperSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS;
  span.setAttribute(
    "data-role",
    DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE,
  );
  span.textContent = text;
  li.appendChild(span);
}

export function appendQuestChainQueueHudResidualDeepestDeeperSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualDeepestDeeperSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS;
  span.setAttribute("data-role", DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE);
  span.textContent = text;
  li.appendChild(span);
}

export function appendQuestChainQueueHudResidualDeepestSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualDeepestSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS;
  span.setAttribute("data-role", DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_ROLE);
  span.textContent = text;
  li.appendChild(span);
}

export function appendQuestChainQueueHudResidualDeeperSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualDeeperSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS;
  span.setAttribute("data-role", DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_ROLE);
  span.textContent = text;
  li.appendChild(span);
}

export function appendQuestChainQueueHudResidualDeepSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualDeepSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS;
  span.setAttribute("data-role", DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_ROLE);
  span.textContent = text;
  li.appendChild(span);
}

export function appendQuestChainQueueHudResidualSubline(
  li: HTMLElement,
  q: DailyQuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): void {
  const text = formatQuestChainQueueHudResidualSubline(
    q,
    buildings,
    recruits,
    slotLabels,
    dailyRows,
    nowMs,
  );
  if (!text) return;
  const span = document.createElement("span");
  span.className = DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS;
  span.setAttribute("data-role", DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_ROLE);
  span.textContent = text;
  li.appendChild(span);
}
