import type { ResourceWallet } from "@/net/bootstrapSession";
import type { TroopRecruitResourceCost } from "@/net/troopRecruitCatalog";
import { formatTimeMs, unitLabel } from "@/net/militaryFormat";
import type { RecruitQueueEntry } from "@/net/queueState";
import { formatRecruitQueueLine } from "@/net/queueState";
import { walletMaterialDeductPulseKeys } from "@/net/recruitSubmitFeedback";

/** 募兵主按钮默认文案。 */
export const RECRUIT_TROOP_SUBMIT_DEFAULT_LABEL = "募兵";
/** RecruitTroop 网关往返期间主按钮文案（CLIENT-117）。 */
export const RECRUIT_TROOP_SUBMIT_INFLIGHT_LABEL = "募兵中…";

export const RECRUIT_ROW_PULSE_CLASS = "recruit-row-pulse";
export const RECRUIT_ROW_PULSE_MS = 3000;

export const QUEUE_RECRUIT_ROW_ID_PREFIX = "queue-recruit-row-";

export type RecruitTroopSubmitState = "idle" | "submitting" | "error";

export type RecruitTroopSubmitEvent =
  | { type: "SUBMIT" }
  | { type: "SUCCESS" }
  | { type: "FAIL" }
  | { type: "CLEAR_ERROR" };

/** 募兵提交纯函数状态机（单测覆盖）。 */
export function recruitTroopSubmitStateMachine(
  state: RecruitTroopSubmitState,
  event: RecruitTroopSubmitEvent,
): RecruitTroopSubmitState {
  switch (state) {
    case "idle":
      if (event.type === "SUBMIT") return "submitting";
      return "idle";
    case "submitting":
      if (event.type === "SUCCESS") return "idle";
      if (event.type === "FAIL") return "error";
      return "submitting";
    case "error":
      if (event.type === "SUBMIT") return "submitting";
      if (event.type === "CLEAR_ERROR") return "idle";
      return "error";
    default:
      return "idle";
  }
}

export function recruitTroopSubmitButtonDisabled(
  state: RecruitTroopSubmitState,
  canAfford: boolean,
): boolean {
  if (state === "submitting") return true;
  return !canAfford;
}

export function recruitTroopSubmitButtonLabel(state: RecruitTroopSubmitState): string {
  return state === "submitting"
    ? RECRUIT_TROOP_SUBMIT_INFLIGHT_LABEL
    : RECRUIT_TROOP_SUBMIT_DEFAULT_LABEL;
}

/** 军事面板募兵主按钮 disabled / 文案（`data-action="recruit"`）。 */
export function syncRecruitTroopSubmitButton(
  formRoot: ParentNode | null | undefined,
  state: RecruitTroopSubmitState,
  canAfford: boolean,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('[data-action="recruit"]');
  if (!btn) return;
  btn.disabled = recruitTroopSubmitButtonDisabled(state, canAfford);
  btn.textContent = recruitTroopSubmitButtonLabel(state);
}

export function queueRecruitRowDomId(queueId: number): string {
  return `${QUEUE_RECRUIT_ROW_ID_PREFIX}${queueId}`;
}

export function scheduleRecruitRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(RECRUIT_ROW_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(RECRUIT_ROW_PULSE_CLASS);
  window.setTimeout(() => row.classList.remove(RECRUIT_ROW_PULSE_CLASS), RECRUIT_ROW_PULSE_MS);
}

export function formatRecruitTroopSuccess(
  unitCfgId: number,
  count: number,
  res: {
    queue_id?: number;
    finish_at_ms?: number;
    troop?: { count?: number };
  },
): string {
  if ((res.queue_id ?? 0) > 0) {
    const finish = res.finish_at_ms ? formatTimeMs(res.finish_at_ms) : "—";
    return `${unitLabel(unitCfgId)}×${count} 已排队 #${res.queue_id}，预计 ${finish}（见「队列」）`;
  }
  const total = res.troop?.count ?? count;
  return `募兵完成，${unitLabel(unitCfgId)} 城内 ${total}`;
}

function troopCostToWallet(cost: TroopRecruitResourceCost): ResourceWallet {
  return {
    food: cost.food,
    wood: cost.wood,
    iron: cost.iron,
    stone: cost.stone,
  };
}

/** 扣费涉及四资源且钱包下降时，触发 CLIENT-051 顶栏脉冲。 */
export function walletRecruitTroopDeductPulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
  cost: TroopRecruitResourceCost | undefined,
): (keyof ResourceWallet)[] {
  return walletMaterialDeductPulseKeys(before, after, cost ? troopCostToWallet(cost) : undefined);
}

/** 军事面板只读募兵队列行（与队列面板同源快照，不发 RPC）。 */
export function syncMilitaryRecruitQueueList(
  panel: ParentNode | null | undefined,
  entries: RecruitQueueEntry[],
  nowMs = Date.now(),
): void {
  const ul = panel?.querySelector<HTMLElement>('[data-role="military-recruit-queue-list"]');
  if (!ul) return;
  ul.classList.toggle("hidden", entries.length === 0);
  ul.innerHTML = "";
  for (const entry of entries) {
    const li = document.createElement("li");
    li.className = "queue-list-row";
    li.id = queueRecruitRowDomId(entry.queue_id);
    li.dataset.queueId = String(entry.queue_id);
    const span = document.createElement("span");
    span.textContent = formatRecruitQueueLine(entry, nowMs);
    li.appendChild(span);
    ul.appendChild(li);
  }
}
