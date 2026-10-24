/** 出征提交中按钮文案（CLIENT-080 / CLIENT-116）。 */
export const MARCH_SUBMIT_INFLIGHT_LABEL = "出征中…";

export const MARCH_SUBMIT_DEFAULT_LABEL = "出征攻击";

export type MarchSubmitState = "idle" | "submitting";

export type MarchSubmitEvent = { type: "SUBMIT" } | { type: "SETTLE" };

/** StartMarch 往返纯函数状态机（CLIENT-116 巩固，单测覆盖）。 */
export function marchSubmitStateMachine(
  state: MarchSubmitState,
  event: MarchSubmitEvent,
): MarchSubmitState {
  switch (state) {
    case "idle":
      return event.type === "SUBMIT" ? "submitting" : "idle";
    case "submitting":
      return event.type === "SETTLE" ? "idle" : "submitting";
    default:
      return "idle";
  }
}

export function marchSubmitButtonDisabled(
  state: MarchSubmitState,
  canSubmitForm = true,
): boolean {
  return state === "submitting" || !canSubmitForm;
}

export function marchSubmitButtonLabel(state: MarchSubmitState): string {
  return state === "submitting" ? MARCH_SUBMIT_INFLIGHT_LABEL : MARCH_SUBMIT_DEFAULT_LABEL;
}

/** 出征成功状态栏 toast，含目标格点。 */
export function formatMarchDepartedStatusToast(toX: number, toY: number): string {
  return `已出征 (${toX},${toY})`;
}

/** 军事面板出征主按钮 disabled / 文案（`data-action="march"`）。 */
export function syncMarchSubmitButton(
  formRoot: ParentNode | null | undefined,
  state: MarchSubmitState,
  canSubmitForm = true,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('button[data-action="march"]');
  if (!btn) return;
  btn.disabled = marchSubmitButtonDisabled(state, canSubmitForm);
  btn.textContent = marchSubmitButtonLabel(state);
}
