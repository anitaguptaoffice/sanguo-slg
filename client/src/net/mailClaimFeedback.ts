import { formatMailClaimGrantedSummary } from "@/net/heroMailState";
import type { ResourceWallet } from "@/net/bootstrapSession";

/** 邮件领取成功行脉冲（与 CLIENT-087 批量领取、CLIENT-051 资源脉冲并存）。 */
export const MAIL_CLAIM_PULSE_CLASS = "mail-claim-pulse";

/** 单封领取详情区行内反馈脉冲（CLIENT-192）。 */
export const MAIL_CLAIM_INLINE_PULSE_CLASS = "mail-claim-inline-pulse";

/** 批量领取失败行标红（CLIENT-067 与 mail-form-error 并存）。 */
export const MAIL_CLAIM_ERROR_CLASS = "mail-claim-error";

export const MAIL_CLAIM_PULSE_MS = 1200;

export type MailClaimGrantedPayload = {
  items?: { item_cfg_id?: number; quantity?: number }[];
  resources?: ResourceWallet;
};

/** 单封领取详情行内文案（资源/道具摘要；与状态栏 `formatMailClaimGrantedSummary` 同源）。 */
export function formatMailClaimSuccessLine(granted?: MailClaimGrantedPayload): string {
  const summary = formatMailClaimGrantedSummary(granted);
  if (summary === "无附件明细") return "领取成功";
  return `领取成功：${summary}`;
}

export function scheduleMailClaimRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_PULSE_CLASS);
  }, MAIL_CLAIM_PULSE_MS);
}

export function scheduleMailClaimInlinePulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(MAIL_CLAIM_INLINE_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(MAIL_CLAIM_INLINE_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(MAIL_CLAIM_INLINE_PULSE_CLASS);
  }, MAIL_CLAIM_PULSE_MS);
}

export function findMailListRow(root: ParentNode, mailId: number): HTMLElement | null {
  if (mailId <= 0) return null;
  return root.querySelector<HTMLElement>(`.mail-list li[data-mail-id="${mailId}"]`);
}
