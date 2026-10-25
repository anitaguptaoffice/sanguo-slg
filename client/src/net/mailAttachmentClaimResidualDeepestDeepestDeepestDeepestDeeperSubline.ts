import { formatMailAttachmentClaimResidualDeepestDeepestDeepestDeeperSubline } from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestDeeperSubline";
import { formatMailAttachmentTypeSweep } from "@/net/mailInboxTabFormat";
import {
  formatMailClaimGrantedSummary,
  mailHasAttachments,
  type MailRow,
} from "@/net/heroMailState";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";

/** CLIENT-383：邮件列表行附件领取残余 **巩固再加深五层** 第九行 DOM（CLIENT-367 第八行 **不退化**）。 */
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deepest-deepest-deepest-deepest-deeper-subline";
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "mail-attachment-claim-residual-deepest-deepest-deepest-deepest-deeper-subline";

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
 * 附件类型 + 领取结果只读 **巩固再加深五层** 第九行（**非** wave:58 CLIENT-378 日常 chain/HUD 深链主叙事）。
 */
export function formatMailAttachmentClaimResidualDeepestDeepestDeepestDeepestDeeperSubline(
  mailBeforeClaim: MailRow,
  granted?: MailClaimGrantedPayload,
): string | null {
  const deepestDeepestDeepestDeeper = formatMailAttachmentClaimResidualDeepestDeepestDeepestDeeperSubline(
    mailBeforeClaim,
    granted,
  );
  if (!deepestDeepestDeepestDeeper) {
    if (!mailHasAttachments(mailBeforeClaim) && !granted) return null;
  }
  const typeLabel = attachmentTypeLabel(mailBeforeClaim);
  const claimScan = claimResultScan(granted);
  const deepenLayer = `巩固再加深五层 · ${typeLabel} ↔ ${claimScan}`;
  if (!deepestDeepestDeepestDeeper) return deepenLayer;
  return `${deepenLayer} · 对照 ${deepestDeepestDeepestDeeper}`;
}
