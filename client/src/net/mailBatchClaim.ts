import type { ContentFormValidationResult } from "@/net/contentFormValidation";
import { mailHasUnclaimedAttachments, type MailRow } from "@/net/heroMailState";

/** 单次批量最多勾选邮件数（逐封 ClaimMailAttachments）。 */
export const BATCH_CLAIM_MAIL_CAP = 20;

export type MailBatchClaimStepResult = { ok: true } | { ok: false; message: string };

export type BatchClaimSummary = {
  successCount: number;
  failureCount: number;
  /** 状态栏 / 面板汇总文案 */
  summaryText: string;
  /** 末条失败 CLIENT-067 口径，供 `mail-form-error` */
  lastError: string | null;
};

/** 批量领取前校验（不发 RPC）。 */
export function validateBatchClaimMailSelection(input: {
  mails: MailRow[];
  selectedMailIds: number[];
}): ContentFormValidationResult {
  const errors: string[] = [];
  const { mails, selectedMailIds } = input;
  const unique = [...new Set(selectedMailIds.filter((id) => id > 0))];

  if (!unique.length) {
    errors.push("请勾选至少 1 封含未领附件的邮件");
  } else if (unique.length > BATCH_CLAIM_MAIL_CAP) {
    errors.push(`单次最多批量领取 ${BATCH_CLAIM_MAIL_CAP} 封`);
  }

  const byId = new Map(mails.map((m) => [m.mail_id ?? 0, m]));
  for (const id of unique) {
    const row = byId.get(id);
    if (!row) {
      errors.push(`邮件 #${id} 不在当前列表`);
    } else if (!mailHasUnclaimedAttachments(row)) {
      errors.push(`邮件 #${id} 无可领附件`);
    }
  }

  if (errors.length) {
    return { ok: false, message: errors.join("；") };
  }
  return { ok: true };
}

/** 按列表顺序排列勾选 id（稳定逐封领取顺序）。 */
export function orderBatchClaimMailIds(mails: MailRow[], selectedMailIds: ReadonlySet<number>): number[] {
  const ordered: number[] = [];
  for (const m of mails) {
    const id = m.mail_id ?? 0;
    if (id > 0 && selectedMailIds.has(id)) ordered.push(id);
  }
  return ordered;
}

/** 汇总顺序领取结果（单测覆盖 batchClaimSummary）。 */
export function batchClaimSummary(results: MailBatchClaimStepResult[]): BatchClaimSummary {
  let successCount = 0;
  let failureCount = 0;
  let lastError: string | null = null;
  for (const r of results) {
    if (r.ok) successCount += 1;
    else {
      failureCount += 1;
      lastError = r.message;
    }
  }
  const parts: string[] = [];
  parts.push(`批量领取：成功 ${successCount} 封`);
  if (failureCount > 0) {
    parts.push(`失败 ${failureCount} 封`);
    if (lastError) parts.push(`末条 ${lastError}`);
  }
  return {
    successCount,
    failureCount,
    summaryText: parts.join(" · "),
    lastError: failureCount > 0 ? lastError : null,
  };
}
