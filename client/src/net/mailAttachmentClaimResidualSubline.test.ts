import { describe, expect, it } from "vitest";
import { formatMailAttachmentClaimResidualSubline } from "@/net/mailAttachmentClaimResidualSubline";

describe("formatMailAttachmentClaimResidualSubline (CLIENT-255)", () => {
  it("combines attachment type sweep with granted summary", () => {
    const line = formatMailAttachmentClaimResidualSubline(
      {
        mail_id: 1,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
      },
      { items: [{ item_cfg_id: 2001, quantity: 2 }] },
    );
    expect(line).toContain("附件残余");
    expect(line).toContain("已领");
    expect(line).toMatch(/2001|×2/);
  });

  it("returns null when no attachments and no grant payload", () => {
    expect(formatMailAttachmentClaimResidualSubline({ mail_id: 2, status: 2 }, undefined)).toBeNull();
  });
});
