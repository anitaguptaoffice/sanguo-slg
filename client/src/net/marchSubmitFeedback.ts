/** 出征提交中按钮文案（CLIENT-080）。 */
export const MARCH_SUBMIT_INFLIGHT_LABEL = "出征中…";

export const MARCH_SUBMIT_DEFAULT_LABEL = "出征攻击";

/** 出征成功状态栏 toast，含目标格点。 */
export function formatMarchDepartedStatusToast(toX: number, toY: number): string {
  return `已出征 (${toX},${toY})`;
}

/** 军事面板出征主按钮 disabled / 文案（`data-action="march"`）。 */
export function syncMarchSubmitButton(
  formRoot: ParentNode | null | undefined,
  inflight: boolean,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('button[data-action="march"]');
  if (!btn) return;
  btn.disabled = inflight;
  btn.textContent = inflight ? MARCH_SUBMIT_INFLIGHT_LABEL : MARCH_SUBMIT_DEFAULT_LABEL;
}
