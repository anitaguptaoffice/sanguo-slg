/** 邮件领取成功行脉冲（与 CLIENT-087 批量领取、CLIENT-051 资源脉冲并存）。 */
export const MAIL_CLAIM_PULSE_CLASS = "mail-claim-pulse";

/** 批量领取失败行标红（CLIENT-067 与 mail-form-error 并存）。 */
export const MAIL_CLAIM_ERROR_CLASS = "mail-claim-error";

export const MAIL_CLAIM_PULSE_MS = 1200;

export function scheduleMailClaimRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_PULSE_CLASS);
  }, MAIL_CLAIM_PULSE_MS);
}

export function findMailListRow(root: ParentNode, mailId: number): HTMLElement | null {
  if (mailId <= 0) return null;
  return root.querySelector<HTMLElement>(`.mail-list li[data-mail-id="${mailId}"]`);
}
