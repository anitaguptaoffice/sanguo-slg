import { describe, expect, it } from "vitest";
import { formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline } from "@/net/mailAttachmentClaimResidualDeepestDeepestDeepestSubline";

describe("formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline (CLIENT-351)", () => {
  it("deepens CLIENT-335 residual deepest-deepest-deeper with attachment type and claim scan", () => {
    const line = formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline(
      {
        mail_id: 1,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
      },
      { items: [{ item_cfg_id: 2001, quantity: 2 }] },
    );
    expect(line).toContain("巩固再加深四层");
    expect(line).toContain("↔");
    expect(line).toContain("巩固再加深三层");
    expect(line).toContain("对照");
    expect(line).toContain("已领");
    expect(line).toMatch(/2001|×2/);
  });

  it("returns null when no attachments and no grant payload", () => {
    expect(
      formatMailAttachmentClaimResidualDeepestDeepestDeepestSubline(
        { mail_id: 2, status: 2 },
        undefined,
      ),
    ).toBeNull();
  });
});
