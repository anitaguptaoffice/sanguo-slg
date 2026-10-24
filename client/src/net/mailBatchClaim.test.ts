import { describe, expect, it } from "vitest";
import {
  batchClaimSummary,
  orderBatchClaimMailIds,
  selectAllUnclaimedMailIds,
  validateBatchClaimMailSelection,
  validateClaimAllUnclaimedMail,
} from "@/net/mailBatchClaim";
import type { MailRow } from "@/net/heroMailState";

describe("validateBatchClaimMailSelection", () => {
  const mails: MailRow[] = [
    { mail_id: 1, status: 1, attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] } },
    { mail_id: 2, status: 2, attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] } },
  ];

  it("accepts claimable mails", () => {
    expect(validateBatchClaimMailSelection({ mails, selectedMailIds: [1] })).toEqual({ ok: true });
  });

  it("rejects empty selection", () => {
    const r = validateBatchClaimMailSelection({ mails, selectedMailIds: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("至少 1 封");
  });

  it("rejects already claimed mail", () => {
    const r = validateBatchClaimMailSelection({ mails, selectedMailIds: [2] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("无可领附件");
  });
});

describe("orderBatchClaimMailIds", () => {
  it("preserves inbox list order", () => {
    const mails: MailRow[] = [{ mail_id: 3 }, { mail_id: 1 }, { mail_id: 2 }];
    expect(orderBatchClaimMailIds(mails, new Set([1, 2, 3]))).toEqual([3, 1, 2]);
  });
});

describe("selectAllUnclaimedMailIds", () => {
  const mails: MailRow[] = [
    { mail_id: 10, status: 1, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
    { mail_id: 11, status: 2, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
    { mail_id: 12, status: 0, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
    { mail_id: 13, status: 1, body: "no attach" },
  ];

  it("returns claimable ids in list order for current tab snapshot", () => {
    expect(selectAllUnclaimedMailIds(mails)).toEqual([10, 12]);
  });

  it("validateClaimAllUnclaimedMail reuses batch cap rules", () => {
    expect(validateClaimAllUnclaimedMail(mails).ok).toBe(true);
    expect(validateClaimAllUnclaimedMail([]).ok).toBe(false);
  });
});

describe("batchClaimSummary", () => {
  it("aggregates all success", () => {
    const s = batchClaimSummary([{ ok: true }, { ok: true }]);
    expect(s.successCount).toBe(2);
    expect(s.failureCount).toBe(0);
    expect(s.summaryText).toContain("成功 2 封");
    expect(s.lastError).toBeNull();
  });

  it("aggregates mixed results with last CLIENT-067 style error", () => {
    const s = batchClaimSummary([
      { ok: true },
      { ok: false, message: "[40012] 附件已领" },
      { ok: false, message: "[10001] 请求无效" },
    ]);
    expect(s.successCount).toBe(1);
    expect(s.failureCount).toBe(2);
    expect(s.summaryText).toContain("失败 2 封");
    expect(s.summaryText).toContain("[10001] 请求无效");
    expect(s.lastError).toBe("[10001] 请求无效");
  });
});
