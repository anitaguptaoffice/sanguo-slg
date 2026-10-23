import type { BuildingUpgradeResourceCost } from "@/net/buildingUpgradeCatalog";
import type { ResourceWallet } from "@/net/bootstrapSession";
import { costToWallet } from "@/net/previewUpgradeCost";
import { walletMaterialDeductPulseKeys } from "@/net/recruitSubmitFeedback";

/** 建造/升级主按钮默认文案。 */
export const BUILD_SUBMIT_DEFAULT_LABEL = "确认升级";
/** StartBuildingUpgrade 网关往返期间主按钮文案（CLIENT-104）。 */
export const BUILD_SUBMIT_INFLIGHT_LABEL = "提交中…";

export type BuildSubmitState = "idle" | "submitting" | "error";

export type BuildSubmitEvent =
  | { type: "SUBMIT" }
  | { type: "SUCCESS" }
  | { type: "FAIL" }
  | { type: "CLEAR_ERROR" };

/** 建造提交纯函数状态机（单测覆盖）。 */
export function buildSubmitStateMachine(
  state: BuildSubmitState,
  event: BuildSubmitEvent,
): BuildSubmitState {
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

export function buildSubmitButtonDisabled(
  state: BuildSubmitState,
  canAfford: boolean,
  upgrading: boolean,
): boolean {
  if (upgrading || state === "submitting") return true;
  return !canAfford;
}

export function buildSubmitButtonLabel(state: BuildSubmitState): string {
  return state === "submitting" ? BUILD_SUBMIT_INFLIGHT_LABEL : BUILD_SUBMIT_DEFAULT_LABEL;
}

/** 建造面板确认按钮 disabled / 文案（`data-action="confirm-upgrade"`）。 */
export function syncBuildSubmitButton(
  formRoot: ParentNode | null | undefined,
  state: BuildSubmitState,
  canAfford: boolean,
  upgrading: boolean,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('[data-action="confirm-upgrade"]');
  if (!btn) return;
  btn.disabled = buildSubmitButtonDisabled(state, canAfford, upgrading);
  btn.textContent = buildSubmitButtonLabel(state);
}

/** 成功状态栏 / toast 文案。 */
export function formatBuildSubmitSuccess(
  slotKey: string,
  targetLevel: number,
  slotLabels?: Record<string, string>,
): string {
  const label = slotLabels?.[slotKey] ?? slotKey;
  return `${label} 已排队升至 Lv${targetLevel}`;
}

/** 扣费涉及四资源且钱包下降时，触发 CLIENT-051 顶栏脉冲。 */
export function walletBuildDeductPulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
  cost: BuildingUpgradeResourceCost | undefined,
): (keyof ResourceWallet)[] {
  return walletMaterialDeductPulseKeys(before, after, cost ? costToWallet(cost) : undefined);
}
