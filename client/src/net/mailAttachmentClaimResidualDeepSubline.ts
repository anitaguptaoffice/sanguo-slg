import { formatMailAttachmentClaimResidualSubline } from "@/net/mailAttachmentClaimResidualSubline";
import {
  formatMailClaimGrantedSummary,
  mailHasAttachments,
  type MailRow,
} from "@/net/heroMailState";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";
import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";

/** CLIENT-271：邮件列表行附件领取残余 **加深** 次行（CLIENT-255 残余次行 **不退化**）。 */
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deep-subline";
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_ROLE =
  "mail-attachment-claim-residual-deep-subline";

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
 * 附件类型 + 领取结果只读 **加深** 次行（**非** wave:44 CLIENT-266 日常 chain/HUD 深链主叙事）。
 */
export function formatMailAttachmentClaimResidualDeepSubline(
  mailBeforeClaim: MailRow,
  granted?: MailClaimGrantedPayload,
): string | null {
  const residual = formatMailAttachmentClaimResidualSubline(mailBeforeClaim, granted);
  if (!residual) {
    if (!mailHasAttachments(mailBeforeClaim) && !granted) return null;
  }
  const typeLabel = attachmentTypeLabel(mailBeforeClaim);
  const claimScan = claimResultScan(granted);
  const deepen = `附件残余加深 · ${typeLabel} ↔ ${claimScan}`;
  if (!residual) return deepen;
  return `${deepen} · ${residual}`;
}
