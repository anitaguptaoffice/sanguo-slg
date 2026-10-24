import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";
import { formatMailClaimGrantedSummary, mailHasAttachments, type MailRow } from "@/net/heroMailState";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";

/** CLIENT-255：邮件列表行附件领取残余次行（CLIENT-177 主 meta 行 **不退化**）。 */
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS =
  "mail-attachment-claim-residual-subline";
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_ROLE =
  "mail-attachment-claim-residual-subline";

function attachmentTypeLabel(m: MailRow): string {
  const sweep = formatMailAttachmentTypeSweep(m).trim();
  if (!sweep) return "附件";
  return sweep.replace(/^[📎✓]\s*/u, "").trim() || "附件";
}

/**
 * 附件类型 + 领取结果只读残余次行（**非** wave:42 日常 chain/HUD 深链主叙事）。
 */
export function formatMailAttachmentClaimResidualSubline(
  mailBeforeClaim: MailRow,
  granted?: MailClaimGrantedPayload,
): string | null {
  if (!mailHasAttachments(mailBeforeClaim) && !granted) return null;
  const typeLabel = attachmentTypeLabel(mailBeforeClaim);
  const claimResult = formatMailClaimGrantedSummary(granted);
  if (claimResult === "无附件明细") {
    return `附件残余 · ${typeLabel} · 已领取`;
  }
  return `附件残余 · ${typeLabel} · 已领 ${claimResult}`;
}
