import { formatMailAttachmentClaimResidualDeepSubline } from "@/net/mailAttachmentClaimResidualDeepSubline";
import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";
import {
  formatMailClaimGrantedSummary,
  mailHasAttachments,
  type MailRow,
} from "@/net/heroMailState";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";

/** CLIENT-287：邮件列表行附件领取残余 **巩固再加深** 第三行 DOM（CLIENT-271 加深次行 **不退化**）。 */
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deeper-subline";
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPER_SUBLINE_ROLE =
  "mail-attachment-claim-residual-deeper-subline";

function attachmentTypeLabel(m: MailRow): string {
  const sweep = formatMailAttachmentTypeSweep(m).trim();
  if (!sweep) return "附件";
  return sweep.replace(/^[📎✓]\s*/u, "").trim() || "附件";
}

function claimResultScan(granted?: MailClaimGrantedPayload): string {
  const claimResult = formatMailClaimGrantedSummary(granted);
  if (claimResult === "无附件明细") return "已领取";
  return `已领 ${claimResult}`;
}

/**
 * 附件类型 + 领取结果只读 **巩固再加深** 第三行（**非** wave:46 CLIENT-282 日常 chain/HUD 深链主叙事）。
 */
export function formatMailAttachmentClaimResidualDeeperSubline(
  mailBeforeClaim: MailRow,
  granted?: MailClaimGrantedPayload,
): string | null {
  const deep = formatMailAttachmentClaimResidualDeepSubline(mailBeforeClaim, granted);
  if (!deep) {
    if (!mailHasAttachments(mailBeforeClaim) && !granted) return null;
  }
  const typeLabel = attachmentTypeLabel(mailBeforeClaim);
  const claimScan = claimResultScan(granted);
  const deepen = `巩固再加深 · ${typeLabel} ↔ ${claimScan}`;
  if (!deep) return deepen;
  return `${deepen} · 对照 ${deep}`;
}
