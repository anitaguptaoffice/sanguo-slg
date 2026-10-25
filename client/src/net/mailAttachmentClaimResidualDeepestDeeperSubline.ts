import { formatMailAttachmentClaimResidualDeepestSubline } from "@/net/mailAttachmentClaimResidualDeepestSubline";
import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";
import {
  formatMailClaimGrantedSummary,
  mailHasAttachments,
  type MailRow,
} from "@/net/heroMailState";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";

/** CLIENT-319：邮件列表行附件领取残余 **巩固再加深二层** 第五行 DOM（CLIENT-303 第四行 **不退化**）。 */
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deepest-deeper-subline";
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE =
  "mail-attachment-claim-residual-deepest-deeper-subline";

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
 * 附件类型 + 领取结果只读 **巩固再加深二层** 第五行（**非** wave:50 CLIENT-314 日常 chain/HUD 深链主叙事）。
 */
export function formatMailAttachmentClaimResidualDeepestDeeperSubline(
  mailBeforeClaim: MailRow,
  granted?: MailClaimGrantedPayload,
): string | null {
  const deepest = formatMailAttachmentClaimResidualDeepestSubline(mailBeforeClaim, granted);
  if (!deepest) {
    if (!mailHasAttachments(mailBeforeClaim) && !granted) return null;
  }
  const typeLabel = attachmentTypeLabel(mailBeforeClaim);
  const claimScan = claimResultScan(granted);
  const deepenLayer = `巩固再加深二层 · ${typeLabel} ↔ ${claimScan}`;
  if (!deepest) return deepenLayer;
  return `${deepenLayer} · 对照 ${deepest}`;
}
