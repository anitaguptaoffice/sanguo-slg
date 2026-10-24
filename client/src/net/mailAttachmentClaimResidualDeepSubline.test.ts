import { describe, expect, it } from "vitest";
import { formatMailAttachmentClaimResidualDeepSubline } from "@/net/mailAttachmentClaimResidualDeepSubline";

describe("formatMailAttachmentClaimResidualDeepSubline (CLIENT-271)", () => {
  it("deepens CLIENT-255 residual with attachment type and claim scan", () => {
    const line = formatMailAttachmentClaimResidualDeepSubline(
      {
        mail_id: 1,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 2 }] },
      },
      { items: [{ item_cfg_id: 2001, quantity: 2 }] },
    );
    expect(line).toContain("附件残余加深");
    expect(line).toContain("↔");
    expect(line).toContain("附件残余");
    expect(line).toContain("已领");
    expect(line).toMatch(/2001|×2/);
  });

  it("returns null when no attachments and no grant payload", () => {
    expect(
      formatMailAttachmentClaimResidualDeepSubline({ mail_id: 2, status: 2 }, undefined),
    ).toBeNull();
  });
});
