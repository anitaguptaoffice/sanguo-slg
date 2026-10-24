import { applyUseResult, bagStackQuantity, type BagStack } from "@/net/bagState";
import { BAG_ROW_INLINE_STATE_CLASS } from "@/net/bagRowInlineState";
import type { ResourceWallet } from "@/net/bootstrapSession";
import {
  formatPanelGatewayError,
  formatPanelGatewayErrorFromUnknown,
} from "@/net/contentFormValidation";
import { walletResourcePulseKeys } from "@/net/hudResourcePulse";

/** 背包「使用道具」主按钮默认文案。 */
export const USE_CONSUMABLE_SUBMIT_DEFAULT_LABEL = "使用道具";
/** 背包「批量使用勾选格」主按钮默认文案。 */
export const USE_CONSUMABLE_BATCH_DEFAULT_LABEL = "批量使用勾选格";
/** UseConsumable 网关往返期间主按钮文案（CLIENT-112）。 */
export const USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL = "使用中…";

export const BAG_ROW_USED_PULSE_CLASS = "bag-row-used-pulse";
/** 消耗行内脉冲时长（3s，与验收一致）。 */
export const BAG_ROW_USED_PULSE_MS = 3000;

/** CLIENT-194：使用成功时 `bag-row-inline-state` 行内脉冲（列表行 `bag-row-used-pulse` 不退化）。 */
export const BAG_USE_INLINE_PULSE_CLASS = "bag-use-inline-pulse";
export const BAG_USE_INLINE_PULSE_MS = BAG_ROW_USED_PULSE_MS;

/** CLIENT-232：使用成功时堆叠数量格 `bag-stack-qty` 行内执行脉冲（2s；CLIENT-112 行脉冲不退化）。 */
export const BAG_USE_CONSUMABLE_PULSE_CLASS = "bag-use-consumable-pulse";
export const BAG_USE_CONSUMABLE_PULSE_MS = 2000;

const BAG_USE_ECONOMY_ITEM_INSUFFICIENT_CODE = 10001;
const BAG_USE_ECONOMY_RESOURCE_INSUFFICIENT_CODE = 40001;

export type UseConsumableSubmitState = "idle" | "submitting" | "error";

export type UseConsumableSubmitEvent =
  | { type: "SUBMIT" }
  | { type: "SUCCESS" }
  | { type: "FAIL" }
  | { type: "CLEAR_ERROR" };

/** 背包使用提交纯函数状态机（单测覆盖）。 */
export function useConsumableSubmitStateMachine(
  state: UseConsumableSubmitState,
  event: UseConsumableSubmitEvent,
): UseConsumableSubmitState {
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

/** 使用成功后该道具在背包中的堆叠数量（与服务端 remaining 对齐）。 */
export function countBagStackAfterUse(
  bag: BagStack[],
  itemCfgId: number,
  remainingAfterUse: number,
): number {
  const next = applyUseResult(bag, itemCfgId, remainingAfterUse);
  return bagStackQuantity(next, itemCfgId);
}

export function useConsumableSubmitButtonsDisabled(state: UseConsumableSubmitState): boolean {
  return state === "submitting";
}

export function useConsumableSubmitButtonLabel(
  state: UseConsumableSubmitState,
  action: "use-item" | "use-item-batch",
): string {
  if (state === "submitting") return USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL;
  return action === "use-item-batch"
    ? USE_CONSUMABLE_BATCH_DEFAULT_LABEL
    : USE_CONSUMABLE_SUBMIT_DEFAULT_LABEL;
}

/** 同步背包使用/批量使用按钮 disabled 与文案。 */
export function syncUseConsumableSubmitButtons(
  formRoot: ParentNode | null | undefined,
  state: UseConsumableSubmitState,
): void {
  for (const action of ["use-item", "use-item-batch"] as const) {
    const btn = formRoot?.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
    if (!btn) continue;
    btn.disabled = useConsumableSubmitButtonsDisabled(state);
    btn.textContent = useConsumableSubmitButtonLabel(state, action);
  }
}

export function scheduleBagRowUsedPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(BAG_ROW_USED_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(BAG_ROW_USED_PULSE_CLASS);
  window.setTimeout(() => row.classList.remove(BAG_ROW_USED_PULSE_CLASS), BAG_ROW_USED_PULSE_MS);
}

export function scheduleBagUseInlinePulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  const inline = row.querySelector<HTMLElement>(`.${BAG_ROW_INLINE_STATE_CLASS}`);
  if (!inline) return;
  inline.classList.remove(BAG_USE_INLINE_PULSE_CLASS);
  void inline.offsetWidth;
  inline.classList.add(BAG_USE_INLINE_PULSE_CLASS);
  window.setTimeout(
    () => inline.classList.remove(BAG_USE_INLINE_PULSE_CLASS),
    BAG_USE_INLINE_PULSE_MS,
  );
}

export function scheduleBagUseConsumablePulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  const qty = row.querySelector<HTMLElement>(".bag-stack-qty");
  if (!qty) return;
  qty.classList.remove(BAG_USE_CONSUMABLE_PULSE_CLASS);
  void qty.offsetWidth;
  qty.classList.add(BAG_USE_CONSUMABLE_PULSE_CLASS);
  window.setTimeout(
    () => qty.classList.remove(BAG_USE_CONSUMABLE_PULSE_CLASS),
    BAG_USE_CONSUMABLE_PULSE_MS,
  );
}

function isBagUseEconomyGatewayError(code: number | undefined, msg: string): boolean {
  if (code === BAG_USE_ECONOMY_RESOURCE_INSUFFICIENT_CODE) return true;
  if (code !== BAG_USE_ECONOMY_ITEM_INSUFFICIENT_CODE) return false;
  const trimmed = msg.trim();
  if (!trimmed) return false;
  return /道具|item/i.test(trimmed) && /不足|insufficient|missing/i.test(trimmed);
}

/** CLIENT-232 / CLIENT-067：UseConsumable 经济类网关失败；非经济类返回 null。 */
export function formatBagUseEconomyErrorLine(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const code = (err as Error & { code?: number }).code;
  const msg = err.message?.trim() ?? "";
  if (!isBagUseEconomyGatewayError(code, msg)) return null;
  if (code === BAG_USE_ECONOMY_ITEM_INSUFFICIENT_CODE) {
    return formatPanelGatewayError("recruit", code, "道具不足");
  }
  return formatPanelGatewayError("bag", code, msg || "资源不足");
}

/** 背包 UseConsumable 网关失败：经济类走专用口径，其余仍用 bag 域 CLIENT-067。 */
export function formatBagUseGatewayErrorFromUnknown(err: unknown): string {
  return formatBagUseEconomyErrorLine(err) ?? formatPanelGatewayErrorFromUnknown("bag", err);
}

export function findBagStackRow(
  formRoot: ParentNode | null | undefined,
  itemCfgId: number,
): HTMLElement | null {
  if (itemCfgId <= 0) return null;
  return formRoot?.querySelector<HTMLElement>(
    `.bag-list li.bag-stack-row[data-item-cfg-id="${itemCfgId}"]`,
  ) ?? null;
}

/** 钱包增量脉冲键（CLIENT-051，供面板在 patch 前对比）。 */
export function walletUseConsumablePulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
): (keyof ResourceWallet)[] {
  return walletResourcePulseKeys(before, after);
}

/** 堆叠数量变化（含减少）时应对行触发 bag-row-used-pulse。 */
export function shouldPulseBagStackAfterUse(
  quantityBefore: number,
  quantityAfter: number,
): boolean {
  return quantityBefore !== quantityAfter;
}
