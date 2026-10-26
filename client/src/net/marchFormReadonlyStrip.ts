import type { ResourceWallet } from "@/net/bootstrapSession";
import {
  formatMarchListDestCell,
  formatMarchEta,
  formatMarchPhase,
  MARCH_PHASE_RETURNED,
  formatTroopStacks,
  type MarchSummary,
} from "@/net/militaryFormat";
import { MARCH_FORM_INFANTRY_UNIT_CFG_ID } from "@/net/marchFormValidation";
import {
  formatMarchFormSummary,
  readMarchFormSnapshot,
  type MarchFormSnapshot,
} from "@/net/marchFormSummary";

export const MARCH_FORM_READONLY_STRIP_CLASS = "march-form-readonly-strip";
export const MARCH_FORM_VIEW_INTEL_INFO_ACTION = "march-form-view-intel-info";

export type MarchFormReadonlyStripSource = "intel" | "queue" | "form";

export type MarchFormReadonlyStripModel = {
  summaryLine: string;
  jumpMarchId: number | null;
  source: MarchFormReadonlyStripSource;
};

export type MarchFormReadonlyStripInput = {
  intelSelectedMarch: MarchSummary | null;
  queueBannerMarchId: number | null;
  queueBannerMarch: MarchSummary | null;
  formRoot: ParentNode | null | undefined;
  cityX?: number;
  cityY?: number;
  wallet?: ResourceWallet;
  nowMs: number;
};

/**
 * 出征表单只读扫读行（CLIENT-178）：格点 + 兵力 + ETA hint（较 CLIENT-089 全文更短）。
 */
export function formatMarchFormSummaryLine(
  snapshot: MarchFormSnapshot,
  nowMs: number,
): string {
  const full = formatMarchFormSummary(snapshot, nowMs);
  const inner = full.summaryLine.replace(/^出征汇总：/, "").trim();
  const withoutFood = inner.replace(/\s·\s途粮约\s[^·]+$/u, "");
  return withoutFood;
}

/** 军情选中行军 → 军事只读条（ListMarches 快照）。 */
export function formatMarchReadonlyLineFromMarch(m: MarchSummary, nowMs: number): string {
  const tile = formatMarchListDestCell(m);
  const troops = formatTroopStacks(m.troops);
  const troopPart = troops && troops !== "无" ? troops : "兵力—";
  if (m.phase === MARCH_PHASE_RETURNED) {
    return `${tile} · ${troopPart} · ${formatMarchPhase(m.phase)}`;
  }
  const phase = m.phase ?? 0;
  const etaHint =
    phase === 2 || phase === 4
      ? formatMarchEta(m, nowMs)
      : `ETA ${formatMarchEta(m, nowMs)}`;
  return `${tile} · ${troopPart} · ${etaHint}`;
}

export function resolveMarchFormReadonlyStripModel(
  input: MarchFormReadonlyStripInput,
): MarchFormReadonlyStripModel {
  const intel = input.intelSelectedMarch;
  if (intel?.march_id != null && intel.march_id > 0) {
    return {
      summaryLine: formatMarchReadonlyLineFromMarch(intel, input.nowMs),
      jumpMarchId: Math.trunc(intel.march_id),
      source: "intel",
    };
  }

  const queueMarch = input.queueBannerMarch;
  const queueId = input.queueBannerMarchId;
  if (queueMarch?.march_id != null && queueMarch.march_id > 0) {
    return {
      summaryLine: formatMarchReadonlyLineFromMarch(queueMarch, input.nowMs),
      jumpMarchId: Math.trunc(queueMarch.march_id),
      source: "queue",
    };
  }
  if (queueId != null && queueId > 0) {
    return {
      summaryLine: `行军 #${queueId}（列表刷新后显示详情）`,
      jumpMarchId: Math.trunc(queueId),
      source: "queue",
    };
  }

  const snap = readMarchFormSnapshot(input.formRoot, {
    cityX: input.cityX,
    cityY: input.cityY,
    wallet: input.wallet,
  });
  if (snap.unitCfgId <= 0) snap.unitCfgId = MARCH_FORM_INFANTRY_UNIT_CFG_ID;
  return {
    summaryLine: formatMarchFormSummaryLine(snap, input.nowMs),
    jumpMarchId: null,
    source: "form",
  };
}

export function syncMarchFormReadonlyStripFromInput(
  militaryRoot: ParentNode | null | undefined,
  input: MarchFormReadonlyStripInput,
): void {
  syncMarchFormReadonlyStrip(militaryRoot, resolveMarchFormReadonlyStripModel(input));
}

export function syncMarchFormReadonlyStrip(
  militaryRoot: ParentNode | null | undefined,
  model: MarchFormReadonlyStripModel,
): void {
  const strip = militaryRoot?.querySelector<HTMLElement>('[data-role="march-form-readonly-strip"]');
  const lineEl = militaryRoot?.querySelector('[data-role="march-form-readonly-strip-line"]');
  const jumpBtn = militaryRoot?.querySelector<HTMLButtonElement>(
    `[data-action="${MARCH_FORM_VIEW_INTEL_INFO_ACTION}"]`,
  );
  if (!strip || !lineEl) return;

  strip.classList.add(MARCH_FORM_READONLY_STRIP_CLASS);
  strip.classList.remove("hidden");
  lineEl.textContent = model.summaryLine;
  strip.dataset.stripSource = model.source;

  if (jumpBtn) {
    const canJump = model.jumpMarchId != null && model.jumpMarchId > 0;
    jumpBtn.disabled = !canJump;
    jumpBtn.classList.toggle("hidden", !canJump);
    if (canJump) jumpBtn.setAttribute("data-march-id", String(model.jumpMarchId));
    else jumpBtn.removeAttribute("data-march-id");
  }
}
